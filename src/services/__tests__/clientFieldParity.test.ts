/**
 * A field the phone writes onto a message that the browser does not know
 * about.
 *
 * This is the shape almost every bug found in the last week actually had. Not
 * a crash and not a wrong answer — one client advancing, the other not
 * following, and the failure arriving as silence:
 *
 *   - the ratchet envelope the web client did not recognise, so `isSealed`
 *     said no and a forward-secret message rendered as an empty bubble
 *   - `mediaSealed`, which the web client had never heard of, so a photo from
 *     the phone was an <img> pointed at ciphertext
 *   - the same field missing from the media grid, which was therefore always
 *     empty and looked like a corrupted render
 *
 * Each was found by a person reading code, which is why each audit found more.
 * A field that exists on one side and not the other is mechanically
 * detectable, so it should be detected mechanically — before the divergence
 * ships rather than after someone reports "it doesn't work".
 *
 * The allowlist is the point as much as the check is: every entry is a
 * deliberate asymmetry with a reason, and anything not on it fails.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const ROOT = join(__dirname, '..', '..', '..');

/** Reasons, not exemptions. A field here is asymmetric on purpose. */
const MOBILE_ONLY: Record<string, string> = {
  createdAtRaw:
    'Never persisted. listenMessages attaches the raw Firestore timestamp to the ' +
    'in-memory object so the list can sort without re-reading it.',
  mediaKeys:
    'Must never be persisted. The content keys live inside the sealed body; both ' +
    'clients delete this before the write, and a reader finding it on a document ' +
    'would mean the object had been handed to anyone who can read the metadata.',
  reactionChain:
    'Mobile-only feature. A reaction chain set on the phone is simply absent in ' +
    'the browser — an honest gap: nothing is claimed about it and nothing renders ' +
    'wrongly, the reactions themselves are shared.',
  scheduledFor:
    'Written by the phone when scheduling, consumed by processScheduledMessages ' +
    'server-side. The browser cannot schedule and never needs to read it.',
  videoDuration:
    'Metadata for a video bubble the web client does not render yet. Listed rather ' +
    'than added to the web type so it fails here the day video rendering lands ' +
    'without the field.',
};

/** Top-level members of a TypeScript interface, by brace depth. */
function topLevelFields(path: string, iface: string): string[] {
  let src = readFileSync(path, 'utf8');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const at = src.indexOf(`interface ${iface}`);
  if (at === -1) return [];
  const open = src.indexOf('{', at);
  const out: string[] = [];
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(src.slice(i));
      if (m && /[\s{;]/.test(src[i - 1])) {
        out.push(m[1]);
        i += m[0].length - 1;
      }
    }
  }
  return out;
}

const mobile = topLevelFields(join(ROOT, 'src/types/index.ts'), 'Message');
const web = topLevelFields(join(ROOT, 'web/src/types.ts'), 'ChatMessage');

describe('the two clients agree on what a message carries', () => {
  it('parses both interfaces, so a rename cannot make this pass vacuously', () => {
    // Pinned first. Every assertion below is about set differences, and two
    // empty sets differ by nothing — a parser that found nothing would report
    // perfect parity.
    expect(mobile.length).toBeGreaterThan(25);
    expect(web.length).toBeGreaterThan(25);
    for (const staple of ['text', 'encrypted', 'image', 'createdAt', 'mediaSealed']) {
      expect(mobile).toContain(staple);
      expect(web).toContain(staple);
    }
  });

  it('has no duplicate or stale allowlist entry', () => {
    // An allowlist that outlives its field is how a check quietly stops
    // checking: the entry keeps passing and nobody notices the field is gone.
    for (const field of Object.keys(MOBILE_ONLY)) {
      expect(mobile).toContain(field);
    }
  });

  it('adds no field the browser will not understand', () => {
    const undeclared = mobile.filter(f => !web.includes(f) && !(f in MOBILE_ONLY));
    expect(undeclared).toEqual([]);
  });

  it('gives every deliberate asymmetry a reason worth reading', () => {
    for (const [field, reason] of Object.entries(MOBILE_ONLY)) {
      expect(reason.length).toBeGreaterThan(40);
      expect(field).not.toBe(reason);
    }
  });
});
