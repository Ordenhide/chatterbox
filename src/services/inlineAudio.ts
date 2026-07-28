import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * Filesystem access goes through react-native-blob-util because it registers via
 * RCT_EXPORT_MODULE (the legacy bridge). This app runs the Legacy Architecture
 * (`RCT_NEW_ARCH_ENABLED = '0'`), where pure-TurboModule filesystem libraries
 * compile and link fine but throw "could not be found" at runtime.
 */
const fs = ReactNativeBlobUtil.fs;

/**
 * Voice messages stored *inside* the Firestore message document as a base64
 * data URI, so they work without Cloud Storage (which requires a paid Firebase
 * plan). Mirrors the web client's web/src/services/storage.ts helpers — the
 * budget and wire format are deliberately identical so a voice message recorded
 * on either platform plays on the other.
 */

/**
 * Ceiling on the data URI we will embed. Firestore caps a document at 1 MiB and
 * base64 inflates by 4/3; this leaves headroom for the rest of the message
 * (reply preview, user, filter). Matches the web client exactly.
 */
export const MAX_INLINE_DATA_URI_CHARS = 700_000;

/** Room for the `data:<mime>;base64,` prefix. */
const DATA_URI_PREFIX_BUDGET = 128;

/** Raw byte budget that stays under the character ceiling once encoded. */
export const MAX_INLINE_BYTES = Math.floor(
  ((MAX_INLINE_DATA_URI_CHARS - DATA_URI_PREFIX_BUDGET) * 3) / 4,
);

/** The recorder writes .m4a (AAC) on both platforms. */
const AUDIO_MIME = 'audio/mp4';

/** Strips the `file://` scheme — the native FS module expects a bare path. */
function toPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri;
}

export function isDataUri(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

/**
 * File extension for a clip's declared MIME type. The container must be named
 * honestly: native players pick a decoder partly from the extension, and a web
 * client may have recorded WebM/Opus rather than the AAC we record here.
 */
export function extensionForAudioMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base === 'audio/webm') return 'webm';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mpeg') return 'mp3';
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav';
  return 'm4a'; // audio/mp4, audio/aac, and anything unrecognised
}

/** Reads the MIME type out of a `data:<mime>;base64,…` URI. */
function mimeOfDataUri(dataUri: string): string {
  const semi = dataUri.indexOf(';');
  return semi > 5 ? dataUri.slice(5, semi) : AUDIO_MIME;
}

/**
 * Reads a recorded file and returns it as a data URI, or null when it is too
 * large to embed — in which case the caller should fall back to a Storage
 * upload. Checking the encoded length (rather than estimating from file size)
 * keeps this exact regardless of container overhead.
 */
export async function encodeAudioForInline(fileUri: string): Promise<string | null> {
  const base64 = await fs.readFile(toPath(fileUri), 'base64');
  const uri = `data:${AUDIO_MIME};base64,${base64}`;
  return uri.length > MAX_INLINE_DATA_URI_CHARS ? null : uri;
}

/**
 * Materialises an inline data URI to a real file and returns its path.
 *
 * Necessary because playback goes through native AVAudioPlayer / MediaPlayer,
 * which accept a file or http(s) URL but not a `data:` URI — so inline audio
 * cannot be played directly the way it can in a browser's <audio> element.
 * Written to the caches directory, which the OS may reclaim; that is fine,
 * since the message document remains the source of truth.
 */
export async function materializeInlineAudio(
  dataUri: string,
  messageId: string | number,
): Promise<string> {
  const comma = dataUri.indexOf(',');
  if (comma < 0) throw new Error('malformed audio data URI');
  const base64 = dataUri.slice(comma + 1);

  // Keyed by message id so a given message resolves to a stable path and is
  // only decoded once, however many times it is replayed.
  const safeId = String(messageId).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = extensionForAudioMime(mimeOfDataUri(dataUri));
  const path = `${fs.dirs.CacheDir}/voice_${safeId}.${ext}`;

  if (!(await fs.exists(path))) {
    await fs.writeFile(path, base64, 'base64');
  }
  return path;
}

/** Best-effort cleanup of a materialized clip. */
export async function discardMaterializedAudio(path: string): Promise<void> {
  try {
    await fs.unlink(path);
  } catch {
    // already gone, or the OS reclaimed the caches directory
  }
}
