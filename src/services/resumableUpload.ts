/**
 * Byte-level resumable uploads to Cloud Storage.
 *
 * ## Why not putFile
 *
 * `@react-native-firebase/storage`'s `putFile` is one-shot from this side: the
 * task it returns has `pause()` and `resume()`, but both operate on an object
 * that exists only inside the process that made it. Nothing persists the
 * upload session, so a killed app cannot pick the transfer back up — it can
 * only start over. {@link ./mediaUploads} made that survivable by recording
 * the *send* before the transfer begins; this module is what stops the
 * transferred bytes being thrown away too.
 *
 * ## The protocol
 *
 * Firebase Storage speaks Google's resumable upload protocol, the same one the
 * Firebase JS SDK uses, driven entirely by `X-Goog-Upload-*` headers:
 *
 *   start    POST /v0/b/{bucket}/o?name={path}
 *            X-Goog-Upload-Protocol: resumable
 *            X-Goog-Upload-Command: start
 *            → X-Goog-Upload-URL: the session URL, good for a week
 *
 *   query    POST {session}     X-Goog-Upload-Command: query
 *            → X-Goog-Upload-Size-Received: bytes the server actually holds
 *
 *   upload   POST {session}     X-Goog-Upload-Command: upload[, finalize]
 *                               X-Goog-Upload-Offset: where this chunk starts
 *            → X-Goog-Upload-Status: active, or final with the object metadata
 *
 * The session URL is the whole point: persisted alongside the queued send, it
 * turns "start the 40MB video again" into "ask how much arrived and send the
 * rest".
 *
 * ## Memory
 *
 * A chunk is cut out of the source file with `fs.slice` and streamed from that
 * temporary file, never read into JS. At this app's own 50MB video limit,
 * holding even one chunk as a base64 string would cost more than the chunk.
 * That is also why the offset is the server's answer rather than a local
 * count: it is the only number that is true after a crash.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import {discard, scratchPath, toPath} from './mediaFiles';

const fs = ReactNativeBlobUtil.fs;

/**
 * Bytes per request.
 *
 * The protocol requires every chunk but the last to be a multiple of 256 KiB.
 * The JS SDK starts at one 256 KiB block and ramps up; a fixed 4 MiB is the
 * simpler choice here and costs at most one re-sent chunk after a drop, which
 * on a phone network is a better trade than thirteen round trips per megabyte.
 */
export const CHUNK_BYTES = 4 * 1024 * 1024;

/** What the server says about a session. */
export type SessionState = {
  /** Bytes the server holds. The only count that survives a crash. */
  offset: number;
  /** Whether the object is complete. */
  final: boolean;
};

/**
 * Reads a header regardless of how its name was capitalised.
 *
 * Not defensiveness: react-native-blob-util hands back whatever casing the
 * platform's HTTP stack used, and the two do not agree. Looking up
 * 'X-Goog-Upload-URL' verbatim finds nothing on the platform that lowercased
 * it, and the failure is a resumable upload that silently behaves like a
 * one-shot one — every attempt starting a brand new session.
 */
export function headerValue(
  headers: Record<string, string> | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return headers[key];
  }
  return null;
}

/**
 * The session's status, as one of the two values that mean it is still usable.
 *
 * Anything else — 'cancelled', a missing header, a value this code does not
 * know — throws rather than being treated as 'active'. Guessing here would
 * send the rest of a large file into a session the server has already thrown
 * away, and report success when the object does not exist.
 */
export function uploadStatus(headers: Record<string, string> | undefined): 'active' | 'final' {
  const status = headerValue(headers, 'X-Goog-Upload-Status');
  if (status === 'active' || status === 'final') return status;
  throw new Error(`resumableUpload: unusable session status ${status ?? 'missing'}`);
}

/**
 * The byte count the server reports holding.
 *
 * Validated rather than trusted: a missing, non-numeric or out-of-range answer
 * has to fail loudly, because this number decides where the next chunk is cut
 * from. An offset past the end of the file would send nothing and finalize a
 * truncated object; a negative one would re-send from before the start.
 */
export function receivedOffset(
  headers: Record<string, string> | undefined,
  total: number,
): number {
  const raw = headerValue(headers, 'X-Goog-Upload-Size-Received');
  if (raw === null || raw === '') {
    throw new Error('resumableUpload: server did not report a received size');
  }
  const offset = Number(raw);
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || offset < 0 || offset > total) {
    throw new Error(`resumableUpload: implausible received size ${raw} for ${total} bytes`);
  }
  return offset;
}

export type ChunkPlan = {
  start: number;
  end: number;
  /** The X-Goog-Upload-Command for this request. */
  command: 'upload' | 'upload, finalize' | 'finalize';
};

/**
 * Which bytes go in the next request, and whether it closes the object.
 *
 * The three commands are the protocol's, not an invention: a chunk that
 * happens to end at the last byte must say 'upload, finalize' in the same
 * request, and an upload already complete on the server still needs a bare
 * 'finalize' to be committed. Sending plain 'upload' for the final chunk
 * leaves the object stuck in an unfinished session forever.
 */
export function planChunk(total: number, offset: number, chunkBytes = CHUNK_BYTES): ChunkPlan {
  if (offset >= total) return {start: total, end: total, command: 'finalize'};
  const end = Math.min(total, offset + chunkBytes);
  return {start: offset, end, command: end === total ? 'upload, finalize' : 'upload'};
}

/** Where a session is opened for an object. */
export function startUrl(bucket: string, objectPath: string): string {
  const encode = encodeURIComponent;
  return `https://firebasestorage.googleapis.com/v0/b/${encode(bucket)}/o?name=${encode(
    objectPath,
  )}`;
}

type Response = {
  info(): {status: number; headers?: Record<string, string>};
};

function assertOk(response: Response, what: string): Record<string, string> | undefined {
  const {status, headers} = response.info();
  if (status < 200 || status >= 300) {
    throw new Error(`resumableUpload: ${what} failed with HTTP ${status}`);
  }
  return headers;
}

/**
 * Opens a session and returns its URL.
 *
 * `fullPath` in the metadata body and `name` in the query string are the same
 * object path; the SDK sends both and so does this, because the server reads
 * the query string and the metadata is what the stored object keeps.
 */
export async function beginSession(options: {
  bucket: string;
  objectPath: string;
  totalBytes: number;
  mime: string;
  idToken: string;
  /**
   * Custom metadata for the object, sent in the session-opening request's
   * metadata body rather than alongside the bytes — the resumable protocol
   * takes the object's metadata once, when the session is created.
   *
   * `uploaderUid` is what storage.rules reads to decide who may delete or
   * overwrite an attachment (see uploaderIsMe there). Optional so the
   * protocol layer stays a protocol layer: it does not know what the app
   * stamps, only how to send it.
   */
  customMetadata?: Record<string, string>;
}): Promise<string> {
  const response = await ReactNativeBlobUtil.fetch(
    'POST',
    startUrl(options.bucket, options.objectPath),
    {
      Authorization: `Firebase ${options.idToken}`,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(options.totalBytes),
      'X-Goog-Upload-Header-Content-Type': options.mime,
      'Content-Type': 'application/json; charset=utf-8',
    },
    JSON.stringify({
      name: options.objectPath,
      fullPath: options.objectPath,
      contentType: options.mime,
      ...(options.customMetadata ? {metadata: options.customMetadata} : null),
    }),
  );
  const headers = assertOk(response, 'opening a session');
  uploadStatus(headers);
  const url = headerValue(headers, 'X-Goog-Upload-URL');
  if (!url) throw new Error('resumableUpload: server opened no session URL');
  return url;
}

/** Asks how much of the object the server already holds. */
export async function querySession(
  sessionUrl: string,
  totalBytes: number,
  idToken: string,
): Promise<SessionState> {
  const response = await ReactNativeBlobUtil.fetch('POST', sessionUrl, {
    Authorization: `Firebase ${idToken}`,
    'X-Goog-Upload-Command': 'query',
  });
  const headers = assertOk(response, 'querying a session');
  const status = uploadStatus(headers);
  return {offset: receivedOffset(headers, totalBytes), final: status === 'final'};
}

/**
 * Sends one chunk, cut out of `path` into a temporary file first.
 *
 * Streamed with `wrap` rather than passed as a string: the body is a file, not
 * base64 in a JS variable, which is what keeps a 4 MiB chunk costing 4 MiB of
 * disk and nothing of memory.
 */
export async function sendChunk(options: {
  sessionUrl: string;
  path: string;
  plan: ChunkPlan;
  totalBytes: number;
  idToken: string;
}): Promise<SessionState> {
  const {sessionUrl, path, plan, totalBytes, idToken} = options;
  const headers: Record<string, string> = {
    Authorization: `Firebase ${idToken}`,
    'X-Goog-Upload-Command': plan.command,
    'X-Goog-Upload-Offset': String(plan.start),
  };

  if (plan.command === 'finalize') {
    const response = await ReactNativeBlobUtil.fetch('POST', sessionUrl, headers);
    const got = assertOk(response, 'finalizing');
    return {offset: totalBytes, final: uploadStatus(got) === 'final'};
  }

  const chunk = scratchPath('upchunk');
  try {
    await fs.slice(toPath(path), toPath(chunk), plan.start, plan.end);
    const response = await ReactNativeBlobUtil.fetch(
      'POST',
      sessionUrl,
      headers,
      ReactNativeBlobUtil.wrap(toPath(chunk)),
    );
    const got = assertOk(response, 'sending a chunk');
    // The server's own count, not plan.end: a short write has to be visible
    // here rather than assumed away, or the next chunk is cut from the wrong
    // place and the object is committed with a hole in it.
    const status = uploadStatus(got);
    if (status === 'final') return {offset: totalBytes, final: true};
    return {offset: receivedOffset(got, totalBytes), final: false};
  } finally {
    await discard(chunk);
  }
}

/**
 * Uploads `path` in full, resuming an earlier session when given one.
 *
 * `onSession` fires the instant a session URL exists, before any bytes move,
 * so the caller can persist it. That ordering is the feature: a URL learned
 * but not written down is a URL lost to the next crash, which is exactly the
 * failure this module exists to remove.
 *
 * Returns nothing — the caller already knows the object path and asks Storage
 * for its download URL, which keeps URL construction (and its download token)
 * in the SDK rather than duplicated here.
 */
export async function uploadResumable(options: {
  bucket: string;
  objectPath: string;
  path: string;
  mime: string;
  idToken: string;
  customMetadata?: Record<string, string>;
  sessionUrl?: string;
  onSession?: (url: string) => void | Promise<void>;
  onProgress?: (percent: number) => void;
  chunkBytes?: number;
}): Promise<void> {
  const stat = await fs.stat(toPath(options.path));
  const totalBytes = Number(stat.size);
  if (!Number.isFinite(totalBytes) || totalBytes < 0) {
    throw new Error(`resumableUpload: cannot size ${options.path}`);
  }

  let sessionUrl = options.sessionUrl;
  let state: SessionState;
  if (sessionUrl) {
    // A session from a previous run of the app. Its offset is the server's to
    // report; anything this process believed is gone.
    state = await querySession(sessionUrl, totalBytes, options.idToken);
  } else {
    sessionUrl = await beginSession({
      bucket: options.bucket,
      objectPath: options.objectPath,
      totalBytes,
      mime: options.mime,
      idToken: options.idToken,
      customMetadata: options.customMetadata,
    });
    await options.onSession?.(sessionUrl);
    state = {offset: 0, final: false};
  }

  const report = () => {
    if (totalBytes > 0) {
      options.onProgress?.(Math.min(100, Math.round((state.offset / totalBytes) * 100)));
    }
  };
  report();

  while (!state.final) {
    const plan = planChunk(totalBytes, state.offset, options.chunkBytes);
    const next = await sendChunk({
      sessionUrl,
      path: options.path,
      plan,
      totalBytes,
      idToken: options.idToken,
    });
    // Guards against a server that accepts a chunk and reports no progress:
    // without this the loop would re-send the same bytes forever.
    if (!next.final && next.offset <= state.offset) {
      throw new Error(
        `resumableUpload: no progress at ${state.offset}/${totalBytes} bytes`,
      );
    }
    state = next;
    report();
  }
}
