import {readFileSync} from 'fs';
import path from 'path';

/**
 * Key publishing runs only once this device's session is confirmed.
 *
 * Both publishes — the static E2EE key and the ratchet bundle — used to run
 * from the auth-state callback, which fires the moment a persisted user is
 * restored and before anything has checked that this device still holds the
 * account. A device displaced by a sign-in elsewhere therefore tried to publish
 * on its way out. Mostly the session rule denied it (two console errors, then
 * sign-out); inside the rule's 120-second allowance it did not, and
 * ensureRatchetKeysPublished replaces any bundle that is not this device's —
 * the active device's, in that case.
 *
 * Asserted on source order because the property is exactly an ordering inside
 * one effect, and rendering AuthProvider with Firebase mocked would test the
 * mocks. See ratchetPublishBoundary.test.ts for the other half: that the calls
 * exist at all.
 */
const SOURCE = readFileSync(
  path.resolve(__dirname, '../../contexts/AuthContext.tsx'),
  'utf8',
);

/** Source with comments removed, so a mention in prose cannot satisfy or trip a check. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join('\n');
}

const CODE = codeOnly(SOURCE);

function onlyIndexOf(needle: string): number {
  const first = CODE.indexOf(needle);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(CODE.indexOf(needle, first + 1)).toBe(-1);
  return first;
}

describe('key publishing waits for the session', () => {
  const registerStart = onlyIndexOf('const registerAndSubscribe = async');
  const establishedGate = onlyIndexOf('if (!established) {');
  const registerCalled = onlyIndexOf('registerAndSubscribe().catch');

  it.each(['republishKeyIfAccountHasNone(', 'ensureRatchetKeysPublished('])(
    '%s is called once, inside registerAndSubscribe, after the established check',
    call => {
      const at = onlyIndexOf(call);
      expect(registerStart).toBeLessThan(establishedGate);
      expect(at).toBeGreaterThan(establishedGate);
      expect(at).toBeLessThan(registerCalled);
    },
  );
});
