/**
 * An exported service function nothing calls.
 *
 * Twin of src/services/__tests__/noUnreachableExports.test.ts on mobile, and
 * it exists because the mobile one kept finding things the web client had the
 * same way. The mobile version was written after services/appLock.ts turned
 * out to be complete and unreachable while the privacy policy promised, in
 * fifteen languages, "Lock the app with a PIN or biometrics."
 *
 * This client has its own copy of that exact bug: setAppLockPIN, verifyAppPIN,
 * disableAppLock and isAppLockEnabled are implemented here and no screen
 * reaches any of them. It is on the allowlist below rather than fixed, because
 * whether the browser should offer an app lock at all is a product call — but
 * it is now a written-down decision instead of something nobody knew.
 *
 * The two other findings in the same pass were reachability failures of a
 * different kind: republishKeyIfAccountHasNone, which mobile calls at sign-in
 * to repair an account advertising no key, was never wired up here (now it
 * is, in App.tsx), and a plaintext sendTextMessage sat in chat.ts sharing its
 * name with mobile's *encrypted* send path.
 *
 * ## The allowlist is the useful half
 *
 * Some entries are legitimate: a primitive its tests drive, a platform pair's
 * other half, a helper kept deliberately. The point is not to have none, it is
 * that each one is a decision someone wrote down.
 */
import {readFileSync, statSync} from 'fs';
import {dirname, join} from 'path';
import {describe, expect, it} from 'vitest';

const WEB_ROOT = join(__dirname, '..', '..');

/**
 * Reachable only from tests, or kept on purpose. Every entry is a claim that
 * someone looked.
 */
const ALLOWED: Record<string, string> = {
  // ---- Cryptographic primitives and library surface -----------------------
  // e2ee.ts is a port of the mobile module and is kept as close to it as the
  // platform allows, because the two must derive identical ciphertext from
  // identical inputs. crossClient.test.ts checks exactly that by importing
  // both and comparing, which is why these have tests but no callers.
  generateKeypair:
    'e2ee primitive. This client must never mint a key — getOrCreateDeviceKeypair ' +
    'throws instead, because every account key here is derived from the recovery ' +
    'phrase. Kept because crossClient.test.ts derives web/mobile parity from it and ' +
    'most crypto tests build their fixtures with it.',
  encryptWithPassphrase:
    'crypto.ts primitive, and half of a pair. Same decision as the mobile client: ' +
    'crypto.ts is kept byte-identical across the two, and diverging it is worse ' +
    'than an unused pair.',
  decryptWithPassphrase:
    'Same pair as encryptWithPassphrase, and removed only together with it.',
  credentialsFromPhrase:
    'anonymousIdentity convenience wrapper; the auth path composes seedFromPhrase ' +
    'and credentialsFromSeed itself so it can reuse the seed.',
  bytesSource:
    'mediaCrypto ByteSource helper. This client supplies blob-backed sources instead ' +
    '(blobSource), since everything it reads arrives as a Response.',
  ciphertextLength:
    'mediaCrypto size calculation. Mobile needs it to know when a resumed download ' +
    'is complete; this client fetches whole objects in one request and has no ' +
    'partial state to measure.',
  generateKeyHex:
    'crypto.ts primitive. Mobile keys its encrypted MMKV message store with it; this ' +
    'client has no persisted store to key — nothing it decrypts survives the tab.',
  isStructuredBody:
    'messageBody predicate, kept for tests and logs — decodeBody handles both the ' +
    'structured and the bare-text shape without being asked which it has.',
  checkRecipient:
    'recipient.ts probe returning why a recipient is unreachable. The send path calls ' +
    'assertRecipientReachable, which throws rather than reporting.',
  sealedField:
    'e2eeArtifacts helper for a shape the artifact tests construct directly, rather ' +
    'than a field any caller assembles by hand.',

  // ---- Features with a working half and an unbuilt half -------------------
  // Named so each gap is a decision rather than a surprise.
  deleteReminder:
    'A reminder can be set but not deleted from the UI, on either client. Same entry ' +
    'sits in the mobile guard.',
  hasRevealedRecoveryPhrase:
    'Mobile reads this to nag a user who has not written their phrase down yet. This ' +
    'client records the reveal (markRecoveryPhraseRevealed, called from auth.ts) and ' +
    'has no banner to read it back — a written-and-never-read flag, deliberately, ' +
    'until the browser gets that prompt.',
  isExpired:
    'ephemeral.ts helper for disappearing moments. The moments feature has no web ' +
    'surface at all, so this and MOMENT_EXPIRY_HOURS are what a web moments view ' +
    'would need, kept beside the burn-duration helpers that are in use.',

  // ---- The app lock: complete, and reachable from nothing ------------------
  // Four functions and a working scrypt implementation with no UI. Mobile
  // ships this screen; the browser does not, and an app lock in a tab is a
  // weaker promise than one on a phone — the tab can be reopened, and site
  // data can be cleared. Left as a decision rather than deleted.
  setAppLockPIN:
    'appLock is implemented and has no UI on web. Whether a browser tab should ' +
    'offer an app lock at all is a product call; mobile ships the screen and this ' +
    'client does not.',
  verifyAppPIN: 'Reader for the same unbuilt app lock. Removed only together with its writer.',
  disableAppLock: 'Teardown for the same unbuilt app lock.',
  isAppLockEnabled: 'Predicate for the same unbuilt app lock.',

  // ---- Storage helpers with no current caller -----------------------------
  uploadChatImage:
    'storage.ts helper. The composer uploads through uploadSealedMedia, which seals ' +
    'the bytes first; this one uploads in the clear and is kept only for the paths ' +
    'that still have no sealed equivalent.',
  uploadChatFile: 'Same as uploadChatImage, for the file slot rather than the image slot.',
  uploadChatBlob: 'Lowest layer of the same unsealed trio; the other two compose it.',
};

/** Resolves a relative import the way Vite does, extensions and index files included. */
function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(fromFile), spec);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.js'),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Not this candidate.
    }
  }
  return null;
}

function importsOf(text: string): string[] {
  return [
    ...[...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]),
    ...[...text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]),
    ...[...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]),
  ];
}

/**
 * Every file reachable from the bundle's entry point, by following relative
 * imports — including the dynamic ones, since half this app is code-split
 * behind `lazy(() => import(...))`.
 *
 * Reachability, not presence. Collecting every file under src/ and asking
 * whether a name appears anywhere passes happily when a whole module is
 * orphaned, because its exports are still referenced by itself. Walking the
 * graph is what catches a screen that stopped being mounted.
 */
const ENTRIES = [join(WEB_ROOT, 'src', 'main.tsx')];

const production: {path: string; text: string}[] = [];
const seen = new Set<string>();
const queue = [...ENTRIES];
while (queue.length) {
  const path = queue.shift()!;
  if (seen.has(path)) continue;
  seen.add(path);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  production.push({path, text});
  for (const spec of importsOf(text)) {
    const target = resolveImport(path, spec);
    if (target && !seen.has(target)) queue.push(target);
  }
}

/**
 * The modules whose exports must be reachable — services and utils the graph
 * above actually reaches. A module no longer imported at all drops out of
 * `production` entirely, and its exports then have nowhere to be called from,
 * which is the case this exists to catch.
 */
const surface = production.filter(
  f => f.path.includes('/services/') || f.path.includes('/utils/'),
);

function exportedFunctions(text: string): string[] {
  return [...text.matchAll(/^export (?:async )?function ([A-Za-z_][A-Za-z0-9_]*)/gm)]
    .map(m => m[1])
    .filter(name => !name.startsWith('_')); // `_`-prefixed are test hooks by convention
}

const unreachable: string[] = [];
for (const file of surface) {
  for (const name of exportedFunctions(file.text)) {
    const pattern = new RegExp(`\\b${name}\\b`, 'g');
    const uses = production.reduce(
      (n, f) => n + (f.text.match(pattern)?.length ?? 0) - (f.path === file.path ? 1 : 0),
      0,
    );
    if (uses === 0) unreachable.push(name);
  }
}

describe('every exported service function is reachable', () => {
  it('finds the exports it is checking, and counts a real caller', () => {
    // Pinned first, twice over. A parser that matched nothing would report
    // perfect reachability, and a reference counter that never counted would
    // report everything unreachable — the allowlist would then look like the
    // whole surface and nobody would read it.
    const names = surface.flatMap(f => exportedFunctions(f.text));
    expect(names.length).toBeGreaterThan(150);
    expect(names).toContain('claimSession');
    // claimSession has production callers (auth.ts). If the counter were
    // broken this would be in `unreachable`.
    expect(unreachable).not.toContain('claimSession');
  });

  it('walks the graph rather than globbing the tree', () => {
    // The mobile version's first attempt globbed every file, which passes
    // while a whole module is orphaned. Reached through a lazy import, so it
    // also pins that dynamic imports are followed.
    expect(seen.size).toBeGreaterThan(40);
    expect([...seen].some(p => p.endsWith('/components/ChatPane.tsx'))).toBe(true);
  });

  it('has nothing unreachable that is not written down', () => {
    expect(unreachable.filter(n => !(n in ALLOWED)).sort()).toEqual([]);
  });

  it('has no allowlist entry that has stopped being true', () => {
    // An entry outliving its subject is how a check quietly stops checking.
    const stale = Object.keys(ALLOWED).filter(n => !unreachable.includes(n));
    expect(stale).toEqual([]);
  });

  it('gives every entry a reason, not a shrug', () => {
    for (const [name, reason] of Object.entries(ALLOWED)) {
      expect(reason.length).toBeGreaterThan(30);
      expect(reason).not.toBe(name);
    }
  });
});
