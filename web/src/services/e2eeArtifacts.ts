/**
 * End-to-end encryption for the *shared artifacts* inside a chat — playlists,
 * shared lists, countdowns — not just the message stream.
 *
 * Messages have been encrypted since the app shipped, but everything else two
 * people build together sat on the server in the clear: the title of a list,
 * every item on it, the name of a countdown, the songs you sent each other.
 * For an app whose whole claim is a private shared space, that content is
 * arguably more revealing than any single message.
 *
 * This reuses the exact message primitives — same X25519 ECDH against the
 * peer's device key, same chat-scoped derivation — so there is one crypto
 * path to keep correct, not two.
 *
 * ## Backward compatibility
 *
 * Encrypted values go in a *new* field (`encryptedTitle` alongside `title`),
 * mirroring how messages carry `encrypted` next to `text`. Anything written
 * before this exists keeps its plaintext field and keeps rendering. Nothing
 * is migrated, and no read path assumes encryption is present.
 *
 * ## What this does not do
 *
 * If the peer has never enrolled a device key there is nobody to encrypt to,
 * so writes stay plaintext rather than failing — identical to the message
 * path. Encryption is best-effort at the edges and total in the common case.
 */
import {decryptMessage, encryptMessage, isEncryptedPayload, type EncryptedPayload} from './e2ee';
import {fetchPeerPublicKeyChecked, getOrCreateDeviceKeypair} from './e2eeKeys';

export interface ArtifactCrypto {
  /** True when a peer key was available and writes will actually be sealed. */
  readonly active: boolean;
  /** Encrypts a value, or returns null when there's no peer key to encrypt to. */
  seal(plaintext: string | undefined | null): EncryptedPayload | null;
  /**
   * Resolves a field to display text: the encrypted value when present and
   * readable, otherwise the legacy plaintext one.
   */
  open(plain: string | undefined | null, encrypted: unknown): string;
}

/** A crypto that seals nothing and passes plaintext through, for callers with no peer yet. */
export const INERT_ARTIFACT_CRYPTO: ArtifactCrypto = {
  active: false,
  seal: () => null,
  open: (plain, encrypted) => (typeof plain === 'string' ? plain : encrypted ? '' : ''),
};

/**
 * Builds the sealer for one chat. Returns an inert one rather than throwing
 * when keys are unavailable, so a shared list still works for a peer who
 * hasn't enrolled — it just stays readable to the server, exactly as before.
 */
export async function makeArtifactCrypto(
  myUid: string,
  peerUid: string | undefined,
  chatId: string,
): Promise<ArtifactCrypto> {
  if (!myUid || !peerUid || !chatId) return INERT_ARTIFACT_CRYPTO;
  try {
    const {secretKey} = await getOrCreateDeviceKeypair(myUid);
    const {key: peerPublicKey} = await fetchPeerPublicKeyChecked(myUid, peerUid);

    // Decryption only needs my own secret, so reading still works even when
    // the peer has no key published — old encrypted content stays readable.
    const open: ArtifactCrypto['open'] = (plain, encrypted) => {
      if (isEncryptedPayload(encrypted)) {
        try {
          return decryptMessage(encrypted, secretKey, chatId);
        } catch {
          // Fall through: a key rotation can leave older items unreadable, and
          // showing the legacy plaintext beats showing nothing.
        }
      }
      return typeof plain === 'string' ? plain : '';
    };

    if (!peerPublicKey) return {active: false, seal: () => null, open};

    return {
      active: true,
      seal: plaintext =>
        typeof plaintext === 'string' && plaintext.length > 0
          ? encryptMessage(plaintext, secretKey, peerPublicKey, chatId)
          : null,
      open,
    };
  } catch (err) {
    console.warn('artifact e2ee unavailable:', err);
    return INERT_ARTIFACT_CRYPTO;
  }
}

/**
 * Splits a value into the pair of fields to persist: the encrypted one when
 * sealing succeeded, otherwise the plaintext one. Callers spread the result so
 * exactly one of the two is ever written.
 *
 * Firestore rejects `undefined`, so the unused half is omitted rather than set.
 */
export function sealedField<K extends string>(
  crypto: ArtifactCrypto,
  plainKey: K,
  encryptedKey: `encrypted${Capitalize<K>}`,
  value: string | undefined | null,
): Record<string, unknown> {
  const sealed = crypto.seal(value);
  if (sealed) return {[encryptedKey]: sealed, [plainKey]: ''};
  return {[plainKey]: value ?? ''};
}
