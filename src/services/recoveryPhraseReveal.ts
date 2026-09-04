/**
 * Whether the recovery-phrase screen may offer to reveal a phrase.
 *
 * Revealing is not a read. getRecoveryPhrase calls getOrCreateDeviceKeypair,
 * which mints *and publishes* a keypair when this device has none — so on a
 * device that has not enrolled, tapping "View recovery phrase" overwrites the
 * account's published key.
 *
 * That is ordinarily harmless, and on the one screen where it is catastrophic
 * it was unguarded: a device arrives at RecoveryPhraseScreen precisely because
 * it has no key and needs to restore one, and the published key it must match
 * against is the thing the reveal button destroys. ChatListScreen already
 * gates the same modal on enrollmentReadiness; this is the predicate both use,
 * extracted so the rule is stated once and can be tested without a screen.
 */
import type {EnrollmentReadiness} from './e2eeKeys';

export type RevealOffer =
  /** Readiness or the revealed flag is still being read. */
  | 'checking'
  /** Shown once already; the phrase is never volunteered a second time. */
  | 'already-revealed'
  /** Safe: this device holds the account's key, or no key exists anywhere. */
  | 'offer'
  /**
   * The account has a key this device does not hold. Revealing would enroll,
   * publishing over that key and stranding the history the user came here to
   * recover. Restoring is the only thing that helps, and it is on this screen.
   */
  | 'restore-first'
  /**
   * Readiness could not be determined. Deliberately not folded into `offer`:
   * that is how one network blip becomes a permanent overwrite. Costs nothing
   * — the phrase is still revealable once the check succeeds.
   */
  | 'unavailable'
  /**
   * This device's key was replaced from another device. The phrase this screen
   * could show is the *stale* one, so showing it would hand the user a backup
   * of the key that is currently failing to open their messages — and they
   * would have no way to tell it apart from the one that works.
   */
  | 'superseded';

export function revealOffer(
  readiness: EnrollmentReadiness | null,
  revealed: boolean | null,
): RevealOffer {
  if (revealed === null || readiness === null) return 'checking';

  // Ahead of `revealed`, which used to be checked first on the reasoning that
  // a device which has saved its phrase is enrolled by definition, so readiness
  // "would only ever agree". It agrees right up until another device publishes
  // a different key, and then this is the one state where the two disagree —
  // so the short-circuit silenced the screen exactly when it had something to
  // say. A user arriving from the chat banner ("sealed on another device") was
  // told they had already saved their phrase and offered nothing else.
  if (readiness === 'superseded') return 'superseded';

  if (revealed) return 'already-revealed';
  if (readiness === 'needs-restore') return 'restore-first';
  if (readiness === 'unknown') return 'unavailable';
  return 'offer';
}
