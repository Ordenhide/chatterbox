/**
 * An exported service function nothing calls.
 *
 * This is the check that would have caught the app lock. services/appLock.ts
 * was complete — scrypt at the backup passphrase's parameters, a CSPRNG salt,
 * a v2-to-v3 upgrade path — and had no caller for setAppLockPIN, verifyPIN,
 * disableAppLock, authenticateWithBiometrics or setBiometricsEnabled. Its only
 * three references were prose inside .harmony.ts comments. Meanwhile section 8
 * of the privacy policy promised, in fifteen languages, "Lock the app with a
 * PIN or biometrics." A control that cannot be reached is not a control, and
 * claiming one that does not exist is the worst thing this app can do.
 *
 * It is the same finding as the ones the design notes already record —
 * stealth mode's setter with no callers, privacyGuard's accessors with no
 * consumers — and those were found by reading, one audit at a time. Reading
 * does not scale and does not repeat reliably. This does.
 *
 * ## The allowlist is the useful half
 *
 * Some of these are legitimate: a primitive a test drives, a platform pair's
 * other half, a helper kept deliberately. The point is not to have none, it is
 * that each one is a decision someone wrote down. A new name appearing here
 * means either wire it up or say why not — and in the app lock's case, the
 * answer would have been "wire it up, the policy already sold it".
 */
import {readFileSync, statSync} from 'fs';
import {dirname, join} from 'path';

const ROOT = join(__dirname, '..', '..', '..');

/**
 * Reachable only from tests, or kept on purpose. Every entry is a claim that
 * someone looked.
 */
const ALLOWED: Record<string, string> = {
  // Cryptographic primitives and library surface, exercised by their own tests.
  bytesSource: 'mediaCrypto ByteSource helper; the app supplies file- and blob-backed sources instead.',
  ciphertextLength: 'Size arithmetic for callers that need to budget before encrypting. Tested directly.',
  isStructuredBody: 'messageBody predicate, kept for tests and logs — decodeBody handles both shapes.',
  sealedField: 'e2eeArtifacts helper for a shape the artifact tests construct.',
  sessionAssociatedData: 'X3DH AD derivation, verified against its own vectors.',
  consumeOneTimePreKey: 'X3DH prekey consumption, driven by the ratchet tests rather than the client.',
  encryptWithPassphrase: 'crypto.ts primitive. Its caller went with the backup export; kept because crypto.ts is byte-identical across clients and diverging it is worse than an unused pair.',
  decryptWithPassphrase: 'Same pair as encryptWithPassphrase, and removed only together.',
  credentialsFromPhrase: 'anonymousIdentity convenience wrapper; the auth path composes seedFromPhrase and credentialsFromSeed itself.',

  // State that other code reaches through a different door.
  deleteSession: 'ratchetSessionStore; sessions are cleared wholesale on sign-out, not one at a time.',
  forgetGroupState: 'Group sender-key state, cleared with the rest on sign-out.',
  getStoredSessionId: 'session.ts reader; the live path holds the id it claimed.',
  backupAvailability: 'keyBackup capability probe, kept for the restore screen it will need.',
  checkRecipient: 'recipient.ts probe; the send path uses assertRecipientReachable.',
  discardMaterializedAudio: 'inlineAudio cleanup, exercised by its tests.',
  cacheImage: 'imageCache writer; prefetchMessageImages is the entry the app uses.',
  hasPendingInvite: 'inviteDeepLink predicate; the app takes the invite rather than asking first.',

  // Features with a working half and an unbuilt half. Named so the gap is a
  // decision rather than a surprise.
  deleteReminder: 'Reminders can be set but not deleted from the UI yet.',
  listenReminders: 'Reminders are not listed in the UI yet; the scheduled function consumes them.',
  cancelScheduledMessage: 'A scheduled message cannot be cancelled from the UI yet.',

  // Known dead flags, already recorded in the design notes. Left rather than
  // quietly deleted because the decision is whether to build them or drop
  // them, and that is a product call, not a cleanup.
  getScreenshotAlertEnabled: 'privacyGuard flag with no consumer — documented as unbuilt, not wired.',
  setScreenshotAlert: 'Writer for the same unbuilt flag.',
  isWatermarkEnabled: 'privacyGuard flag with no consumer — documented as unbuilt.',
  setWatermark: 'Writer for the same unbuilt flag.',
  generateWatermark: 'Renderer for the same unbuilt flag.',
  getAutoLockDelay: 'Auto-lock delay has no consumer: the app lock relocks on backgrounding rather than on a timer.',
  setAutoLockDelay: 'Writer for the same unused delay.',

  // Presentation helpers used only through their modules' other exports.
  revealWindow: 'motion.ts helper; screens use the animation wrappers around it.',
  fireOnChange: 'haptics.ts wrapper kept beside the ones in use.',
  isMessageEncrypted: 'e2eeMessages predicate; the UI asks messageProtection, which is the stronger question.',
};

/**
 * Every file reachable from the bundle's entry points, by following relative
 * imports.
 *
 * Reachability, not presence. The first version of this guard collected every
 * file under src/ and asked whether a name appeared anywhere — which passes
 * happily when a whole module is orphaned, because its exports are still
 * referenced by itself. Deleting the one line in App.tsx that mounts
 * AppLockScreen left the lock screen calling verifyPIN into the void, and the
 * check said everything was fine. A guard that holds while the thing it
 * guards is broken is worse than no guard, so this walks the graph.
 */
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

const ENTRIES = [join(ROOT, 'index.js'), join(ROOT, 'App.tsx')];

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
 * The modules whose exports must be reachable — services and utils that the
 * graph above actually reaches. A module no longer imported at all simply
 * drops out of `production`, and its exports then have nowhere to be called
 * from, which is the case this exists to catch.
 */
const surface = production.filter(
  f =>
    (f.path.includes('/services/') || f.path.includes('/utils/')) &&
    !f.path.endsWith('.harmony.ts'),
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
    // perfect reachability, and a reference counter that never counts would
    // report everything unreachable — the allowlist would then look like the
    // whole surface and nobody would read it.
    const names = surface.flatMap(f => exportedFunctions(f.text));
    expect(names.length).toBeGreaterThan(200);
    expect(names).toContain('verifyPIN');
    // verifyPIN has exactly one production caller, the lock screen. If the
    // counter were broken this would be in `unreachable`.
    expect(unreachable).not.toContain('verifyPIN');
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
