/**
 * Deciding what a conversation's media grid can actually show.
 *
 * Kept out of the screen because this is the part that was wrong. The media
 * grid used to filter `image || video` off the raw snapshot, which is broken
 * in two opposite directions once media is encrypted:
 *
 *   - sealed *bytes* (`mediaSealed`) leave the URL in the clear on purpose, so
 *     the message was listed and the tile rendered ciphertext as an image
 *   - a sealed *pointer* blanks `image` and puts the URL in `encryptedImage`,
 *     so the message was not listed at all
 *
 * A component cannot be made to say which branch it took. A function can.
 */
import {isSealed, openSealed} from './e2ee';
import {type MediaSlot} from './messageBody';
import {type MediaKeyInfo} from './mediaCrypto';

export type VisualSlot = Extract<MediaSlot, 'image' | 'video'>;

const VISUAL_SLOTS: readonly VisualSlot[] = ['image', 'video'];

/** Which sealed-pointer field carries each slot's URL. */
const POINTER_FIELD: Record<VisualSlot, string> = {
  image: 'encryptedImage',
  video: 'encryptedVideo',
};

export type MediaTile = {
  /** `${messageId}:${slot}` — also the resolved-cache key. */
  key: string;
  id: string;
  slot: VisualSlot;
  /** Renderable uri, or null when it could not be produced on this device. */
  uri: string | null;
  durationSeconds?: number;
};

/** A sealed-bytes attachment that still needs fetch-and-decrypt. */
export type MediaJob = {
  key: string;
  id: string;
  slot: VisualSlot;
  /** The ciphertext URL. Never render this. */
  url: string;
  info: MediaKeyInfo;
};

export type PlanOptions = {
  uid: string;
  chatId: string;
  /** This device's key, or null when it has never enrolled. */
  secretKey: Uint8Array | null;
  /** Content keys from the stored body — never from the ratchet. */
  keysFor: (messageId: string) => Partial<Record<MediaSlot, MediaKeyInfo>>;
  /**
   * Resolved uris by tile key, read and written. A present null means "decided
   * and unavailable", which is what stops a hopeless slot being retried on
   * every snapshot.
   */
  resolved: Map<string, string | null>;
};

/**
 * Sorts every visual attachment in `messages` into a tile, and the ones whose
 * bytes are encrypted into a job for the caller's pool.
 *
 * Anything decidable without I/O is decided here and recorded in `resolved`:
 * a sealed pointer opens with the device key alone (pure X25519, repeatable),
 * and an attachment from before media encryption is already a usable URL.
 */
export function planMediaTiles(
  messages: readonly Record<string, unknown>[],
  opts: PlanOptions,
): {tiles: MediaTile[]; jobs: MediaJob[]} {
  const {uid, chatId, secretKey, keysFor, resolved} = opts;
  const tiles: MediaTile[] = [];
  const jobs: MediaJob[] = [];

  for (const m of messages) {
    const id = String(m._id);

    for (const slot of VISUAL_SLOTS) {
      const pointer = m[POINTER_FIELD[slot]];
      const plain = typeof m[slot] === 'string' ? (m[slot] as string) : undefined;
      if (!plain && !isSealed(pointer)) continue;

      const key = `${id}:${slot}`;
      const duration = typeof m.videoDuration === 'number' ? m.videoDuration : undefined;
      const tile: MediaTile = {
        key,
        id,
        slot,
        uri: null,
        durationSeconds: slot === 'video' ? duration : undefined,
      };

      if (resolved.has(key)) {
        tile.uri = resolved.get(key) ?? null;
      } else if (m.mediaSealed === true && plain) {
        const info = keysFor(id)[slot];
        if (info) {
          jobs.push({key, id, slot, url: plain, info});
        } else {
          // No stored body for this message on this device — its key was
          // inside a ratchet envelope that has already been spent. There is
          // nothing to fetch, and nothing to ask about again.
          resolved.set(key, null);
        }
      } else if (isSealed(pointer) && secretKey) {
        try {
          const url = openSealed(pointer, secretKey, uid, chatId);
          resolved.set(key, url || null);
          tile.uri = url || null;
        } catch {
          // Wrong or rotated key, or a message sealed before this device
          // enrolled. Decided, not retried.
          resolved.set(key, null);
        }
      } else if (plain) {
        // Neither sealed: an attachment from before media encryption.
        resolved.set(key, plain);
        tile.uri = plain;
      }

      tiles.push(tile);
    }
  }

  return {tiles, jobs};
}
