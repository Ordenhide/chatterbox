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
  | 'unavailable';

export function revealOffer(
  readiness: EnrollmentReadiness | null,
  revealed: boolean | null,
): RevealOffer {
  // Checked before readiness: a device that has already saved its phrase is
  // enrolled by definition, and re-reading readiness would only ever agree.
  if (revealed === null) return 'checking';
  if (revealed) return 'already-revealed';
  if (readiness === null) return 'checking';
  if (readiness === 'needs-restore') return 'restore-first';
  if (readiness === 'unknown') return 'unavailable';
  return 'offer';
}
