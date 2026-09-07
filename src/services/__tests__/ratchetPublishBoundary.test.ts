import {execSync} from 'child_process';
import path from 'path';

/**
 * Forward secrecy is off unless something publishes this device's ratchet
 * bundle, and for a long time nothing did.
 *
 * Every other piece was here and working: X3DH, the double ratchet, group
 * sender keys, prekey rotation, all of it under test. But publishing is
 * deliberately separate from generating an identity — getOrCreateRatchetIdentity
 * says so in its own docstring, because generating is local and cheap while
 * publishing is a claim to peers — and the call that makes the claim was never
 * wired to anything. So `users/{uid}/publicKeys/ratchet` never existed, every
 * peer lookup answered 'unenrolled', fetchPeerPreKeyBundle returned null, and
 * both send paths fell back to the static long-lived key. Every message. The
 * privacy policy and the landing page meanwhile told users that most
 * conversations were forward-secret, in fifteen languages.
 *
 * Nothing failed. No test went red, no error was reported, and the per-message
 * protection label quietly read `static` forever. That is the whole problem
 * with this class of bug: the feature does not break, it just never starts,
 * and the fallback it lands in is a working one.
 *
 * So the wiring is asserted structurally rather than trusted. This is the test
 * that would have caught it.
 */
const ROOT = path.resolve(__dirname, '../../..');

/** Files that call `symbol(`, excluding tests — the call, not the mention. */
function productionCallers(symbol: string): string[] {
  let out = '';
  try {
    out = execSync(`git grep -l --fixed-strings -- '${symbol}(' src`, {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    // git grep exits non-zero when nothing matches.
    return [];
  }
  return out
    .split('\n')
    .filter(Boolean)
    .filter(f => !f.includes('__tests__'))
    .filter(f => f !== 'src/services/ratchetKeys.ts');
}

describe('the ratchet publish boundary', () => {
  it('is reached from production code, or forward secrecy is off', () => {
    // If this fails, no device publishes a bundle, no peer can start a
    // forward-secret session, and every message silently takes the static
    // path — while the policy says otherwise. Wire it back up; do not delete
    // this test.
    expect(productionCallers('ensureRatchetKeysPublished')).not.toEqual([]);
  });

  it('is reached from sign-in, where every account passes', () => {
    // Anywhere else and it covers only the users who happen to visit that
    // screen. The auth-state callback runs for every account on every launch.
    expect(productionCallers('ensureRatchetKeysPublished')).toEqual([
      'src/contexts/AuthContext.tsx',
    ]);
  });

  it('keeps the lower-level publish steps behind it', () => {
    // publishRatchetKeys replaces the account's bundle, topUpOneTimePreKeys is
    // strictly additive, and rotateSignedPreKey retires the current one. The
    // order and the conditions between them are what stop a republish from
    // invalidating keys a peer has already claimed — which produces a
    // permanently undecryptable first message, reported as nothing at all.
    // ensureRatchetKeysPublished is where that reasoning lives; calling past it
    // is how it gets lost.
    for (const step of ['publishRatchetKeys', 'topUpOneTimePreKeys', 'rotateSignedPreKey']) {
      expect(productionCallers(step)).toEqual([]);
    }
  });
});
