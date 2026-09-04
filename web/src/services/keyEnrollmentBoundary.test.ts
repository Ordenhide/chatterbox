import {execSync} from 'child_process';
import path from 'path';
import {describe, expect, it} from 'vitest';

/**
 * The web twin of src/services/__tests__/keyEnrollmentBoundary.test.ts — see
 * that file for why this boundary exists.
 *
 * It matters at least as much here. A browser holds its key in local storage,
 * so "this client is not enrolled" is the *ordinary* state — a new browser, a
 * new profile, cleared site data — rather than the rare one it is on a phone.
 * That is exactly how the read paths in this client came to mint and publish a
 * key on first use, which is to say: opening a chat in a second browser used
 * to destroy the account's history everywhere else.
 */
const MAY_ENROLL: Record<string, string> = {
  'web/src/services/e2eeKeys.ts':
    'defines it, and getRecoveryPhrase — revealing a phrase is not a read',
  'web/src/services/e2eeMessages.ts': 'sealing a forwarded message',
  'web/src/services/liveLocation.ts': 'sealing an outgoing position',
  'web/src/components/ChatPane.tsx': 'sealing an outgoing message',
};

const ROOT = path.resolve(__dirname, '../../..');

// Matches the call, not the name: files that explain in a comment why they
// avoid the enrolling variant should not be flagged for saying so.
function filesCalling(symbol: string): string[] {
  const out = execSync(`git grep -l --fixed-strings -- '${symbol}(' web/src`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(Boolean)
    .filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
}

describe('the enrollment boundary', () => {
  it('is crossed only by code whose job is to enroll', () => {
    const offenders = filesCalling('getOrCreateDeviceKeypair').filter(f => !(f in MAY_ENROLL));

    expect(offenders).toEqual([]);
  });

  it('lists nothing that has since stopped enrolling', () => {
    const actual = new Set(filesCalling('getOrCreateDeviceKeypair'));
    const stale = Object.keys(MAY_ENROLL).filter(f => !actual.has(f));

    expect(stale).toEqual([]);
  });
});
