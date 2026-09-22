/**
 * The shared key schema, checked mechanically instead of by asking the right
 * question.
 *
 * `clientFieldParity.test.ts` next door guards the fields of a *message*. This
 * guards the layer underneath it — `users/{uid}/publicKeys/*` and the
 * capability list published alongside the key — which both clients write to
 * the same documents in the same project. Three real bugs lived there, all
 * found by a person happening to ask, and all with the same shape: one client
 * writing the shared schema as though it were the only client.
 *
 *   - the browser published `caps: []` while being perfectly able to honour
 *     `media-v1`. The phone's peersSupportEncryptedMedia reads that list, so
 *     clearing it stopped every sender encrypting attachment *bytes* to the
 *     account — photos went to Cloud Storage in the clear, for an account
 *     whose owner had opened a browser tab
 *   - the browser deleted `publicKeys/ratchet` and every one-time prekey the
 *     phone had published, taking the whole account off forward secrecy until
 *     the phone next signed in
 *   - a stale doc comment claimed the opposite of both, which is how they
 *     survived being read several times
 *
 * None of those was detectable from one client's source alone, and all three
 * are mechanically detectable from both. So they are checked here, before the
 * divergence ships rather than after someone asks the right question.
 *
 * Deliberately narrow: this reads source text rather than analysing Firestore
 * calls. The two clients build document references in different styles (and
 * one nests `doc(collection(...))`), so a general path analyser would be a
 * large brittle thing that failed for its own reasons. Each check below is
 * exact about one property that actually broke.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const ROOT = join(__dirname, '..', '..', '..');

const MOBILE_KEYS = readFileSync(join(ROOT, 'src/services/e2eeKeys.ts'), 'utf8');
const WEB_KEYS = readFileSync(join(ROOT, 'web/src/services/e2eeKeys.ts'), 'utf8');
const MOBILE_RATCHET = readFileSync(join(ROOT, 'src/services/ratchetKeys.ts'), 'utf8');

/**
 * The capabilities a source actually *publishes* on the key document.
 *
 * Deliberately not "every capability string in the file". The first version of
 * this check did that, and it could not fail: `MEDIA_CAPABILITY = 'media-v1'`
 * stays declared whether or not the publish uses it, so setting `caps: []`
 * — the exact bug this exists to catch — left the regex finding 'media-v1' on
 * both sides and reporting perfect parity.
 *
 * So the value assigned to `caps` is read out of the publish itself and then
 * resolved, through two levels because both clients use both: the assignment
 * may be an inline array or a `const` naming one, and the array's entries may
 * be string literals or `const`s naming them. `[MEDIA_CAPABILITY]` resolving
 * to nothing is how the first fix of this function still failed to see
 * anything.
 */
function publishedCapabilities(src: string): string[] {
  const at = src.indexOf("'publicKeys', 'e2ee'");
  if (at === -1) return [];
  const payload = src.slice(at, src.indexOf('{merge', at));
  const assigned = /caps:\s*([^,\n]+)/.exec(payload)?.[1]?.trim();
  if (!assigned) return [];

  const isIdentifier = (text: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(text);
  const constValue = (name: string) =>
    new RegExp(`const ${name}\\s*=\\s*([^;\\n]+)`).exec(src)?.[1]?.trim() ?? '';

  const array = isIdentifier(assigned) ? constValue(assigned) : assigned;
  const entries = (/\[([^\]]*)\]/.exec(array)?.[1] ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);

  const resolved = entries.map(entry => (isIdentifier(entry) ? constValue(entry) : entry));
  return [...new Set(resolved.flatMap(text => [...text.matchAll(/'([a-z]+-v\d+)'/g)].map(m => m[1])))].sort();
}

/**
 * The field names an object literal passed to `setDoc` carries.
 *
 * Matched from the `setDoc(` call to the first `{merge` so the options object
 * is not mistaken for the payload.
 */
function publishedFields(src: string): string[] {
  const at = src.indexOf("'publicKeys', 'e2ee'");
  if (at === -1) return [];
  const payload = src.slice(at, src.indexOf('{merge', at));
  return [...new Set([...payload.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)].map(m => m[1]))]
    .filter(f => f !== 'db' && f !== 'users')
    .sort();
}

describe('both clients publish the same capabilities', () => {
  const mobile = publishedCapabilities(MOBILE_KEYS);
  const web = publishedCapabilities(WEB_KEYS);

  // Pinned first: every assertion below is a set comparison, and two empty
  // sets agree about nothing. A regex that matched nothing would report
  // perfect parity.
  it('finds a capability on each side, so this cannot pass vacuously', () => {
    expect(mobile).toContain('media-v1');
    expect(web).toContain('media-v1');
  });

  /**
   * The exact bug. A capability is a promise to the *sender*, who acts on it
   * by encrypting bytes this account then has to be able to open. Two clients
   * publishing different lists means whichever signed in last decides what
   * the account can receive — silently, and for everyone messaging it.
   */
  it('agrees on the list, so the last client to sign in cannot change it', () => {
    expect(web).toEqual(mobile);
  });

  /**
   * A capability may only be claimed by a client that honours it, and the
   * browser's claim to `media-v1` is only true because these two exist. If
   * either goes, the claim has to go with it.
   */
  it('backs the browser\'s media claim with code that actually seals and opens', () => {
    const vault = readFileSync(join(ROOT, 'web/src/services/mediaVault.ts'), 'utf8');
    const storage = readFileSync(join(ROOT, 'web/src/services/storage.ts'), 'utf8');
    expect(vault).toContain('decryptMedia');
    expect(storage).toContain('encryptMedia');
  });
});

describe('both clients write the same key document', () => {
  const mobile = publishedFields(MOBILE_KEYS);
  const web = publishedFields(WEB_KEYS);

  it('finds the publish in both, so this cannot pass vacuously', () => {
    expect(mobile).toContain('publicKey');
    expect(web).toContain('publicKey');
  });

  // The write merges, so a field one client sets and the other does not is a
  // field that survives from whichever signed in earlier — the state that is
  // hardest to reason about and the one `caps` was stuck in.
  it('sets the same fields, since the write merges', () => {
    expect(web).toEqual(mobile);
  });
});

/**
 * Documents under `publicKeys/` belong to whichever part of the app publishes
 * them, and deleting another one is how the forward-secrecy bundle
 * disappeared. The rule is blunt on purpose: a client that cannot *use* a key
 * document has no standing to remove it.
 */
describe('neither client deletes the other\'s key documents', () => {
  /** Reasons, not exemptions. A deletion here is deliberate. */
  const ALLOWED_DELETIONS: Record<string, string> = {
    'src/services/ratchetKeys.ts':
      'Owns the ratchet bundle: it publishes publicKeys/ratchet and the one-time ' +
      'prekeys, claims and purges them as peers use them, and rotates the signed ' +
      'prekey. Deleting what it wrote is the whole lifecycle, not a takeover.',
  };

  const sources: Record<string, string> = {
    'src/services/e2eeKeys.ts': MOBILE_KEYS,
    'src/services/ratchetKeys.ts': MOBILE_RATCHET,
    'web/src/services/e2eeKeys.ts': WEB_KEYS,
  };

  it('reads every source it claims to, so this cannot pass vacuously', () => {
    // Reported as a list rather than asserted in the loop, so a failure names
    // the file instead of just the first length that disappointed it.
    const unreadable = Object.entries(sources)
      .filter(([, src]) => src.length < 1000 || !src.includes('publicKeys'))
      .map(([path]) => path);
    expect(unreadable).toEqual([]);
  });

  it('has no stale allowlist entry', () => {
    // An allowlist outliving the thing it excused is how a check quietly stops
    // checking.
    for (const path of Object.keys(ALLOWED_DELETIONS)) {
      expect(Object.keys(sources)).toContain(path);
      expect(sources[path]).toContain('deleteDoc');
    }
  });

  it('gives every allowed deletion a reason worth reading', () => {
    const unexplained = Object.entries(ALLOWED_DELETIONS)
      .filter(([, reason]) => reason.length <= 40)
      .map(([path]) => path);
    expect(unexplained).toEqual([]);
  });

  it('deletes nothing from the key schema outside the allowlist', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !(path in ALLOWED_DELETIONS))
      .filter(([, src]) => /\bdeleteDoc\s*\(/.test(src))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

/**
 * The browser cannot open a forward-secret message, and that is settled (see
 * MULTIDEVICE.md). What must not happen again is the browser acting on that
 * gap by changing what the *account* advertises: senders read the account's
 * bundle, so retracting it downgrades every peer rather than only this client.
 */
describe('the browser leaves forward secrecy to the phone', () => {
  it('names the ratchet document only to explain why it leaves it alone', () => {
    // Referencing the document name is fine — the reasoning is written down
    // there — but it must not be reached through a Firestore call.
    expect(/\bdeleteDoc\s*\(/.test(WEB_KEYS)).toBe(false);
    expect(/setDoc\([^)]*'ratchet'/.test(WEB_KEYS)).toBe(false);
  });

  it('still says, somewhere a reader will find, that it cannot read them', () => {
    const pane = readFileSync(join(ROOT, 'web/src/components/ChatPane.tsx'), 'utf8');
    expect(pane).toContain('forwardSecretElsewhere');
  });
});
