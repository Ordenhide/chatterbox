import {
  decryptMessage,
  isEncryptedPayload,
  isSealedEnvelope,
  openEnvelope,
  type EncryptedPayload,
} from './e2ee';

/** Which encrypted envelope field decrypts into which plaintext media field. */
const ENCRYPTED_MEDIA_FIELDS = ['encryptedImage', 'encryptedVideo', 'encryptedAudio', 'encryptedFileUri'] as const;

/**
 * Collects every Storage-hosted (or inline data:) media URL a message points
 * at, decrypting E2EE-sealed pointers with `secretKey` when one is available.
 * X25519 is symmetric, so a chat participant's own device key opens a
 * pointer whether they sent or received the message (see e2ee.ts).
 *
 * Never throws. A field that can't be decrypted (no key, wrong/rotated key,
 * corrupt payload, or a message from before this device enrolled) is simply
 * skipped — callers that use this for Storage cleanup should treat a missing
 * URL as "left orphaned," not as an error to surface.
 */
export function resolveMessageMediaUrls(
  message: Record<string, unknown>,
  secretKey: Uint8Array | null,
  chatId: string,
): string[] {
  const urls: string[] = [];

  const plain = [message.image, message.video, message.audio, (message.file as {uri?: string} | undefined)?.uri];
  for (const u of plain) {
    if (typeof u === 'string' && u.length > 0) urls.push(u);
  }

  if (!secretKey) return urls;

  for (const encField of ENCRYPTED_MEDIA_FIELDS) {
    const payload = message[encField];
    try {
      // Two shapes coexist: a fan-out envelope from a group-capable client, and
      // a bare payload from before group support. Both stay readable forever —
      // there is no migration.
      //
      // The empty uid is deliberate. openEnvelope looks up a copy by uid and,
      // failing that, tries every copy in turn; passing no uid takes that second
      // path, which finds this device's copy wherever it is. That is what lets
      // this keep its signature — callers here (Storage cleanup, data export)
      // have a secret key but not always the uid it belongs to.
      if (isSealedEnvelope(payload)) {
        const url = openEnvelope(payload, secretKey, '', chatId);
        if (url) urls.push(url);
      } else if (isEncryptedPayload(payload)) {
        const url = decryptMessage(payload as EncryptedPayload, secretKey, chatId);
        if (url) urls.push(url);
      }
    } catch {
      // Wrong/rotated key, or a payload from before this device enrolled.
    }
  }

  return urls;
}
