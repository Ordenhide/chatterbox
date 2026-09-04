import {execSync} from 'child_process';
import path from 'path';

/**
 * getOrCreateDeviceKeypair mints a keypair *and publishes the public half*,
 * replacing whatever key the account had published before. That makes calling
 * it an act of enrollment, and enrollment is destructive: every message any
 * peer ever sealed to the previous key becomes permanently unopenable, and the
 * recovery phrase the user wrote down stops matching. AuthContext therefore
 * refuses to enroll unless enrollmentReadiness says it is safe.
 *
 * A read path that reaches for it walks straight around that gate. It happened
 * here, repeatedly, because the enrolling call is the obvious-looking one and
 * "get me the key" is what a reader thinks it wants: opening a chat, showing a
 * safety number, sweeping expired trash, exporting your data, and — worst —
 * rendering a push notification, which runs in the background on a phone that
 * has just been reinstalled and had no chance to restore first.
 *
 * So the boundary is asserted structurally rather than one call site at a time.
 * A file may enroll only if enrolling is what it is *for*, and adding one to
 * this list should require saying why out loud.
 */
const MAY_ENROLL: Record<string, string> = {
  'src/services/e2eeKeys.ts':
    'defines it, and getRecoveryPhrase — revealing a phrase is not a read',
  'src/contexts/AuthContext.tsx': 'the one gated enrollment, behind enrollmentReadiness',
  'src/services/e2eeMessages.ts': 'sealing an outgoing message',
  'src/services/liveLocation.ts': 'sealing an outgoing position',
  'src/screens/chat/ChatScreen.tsx': 'sealing an outgoing message',
};

const ROOT = path.resolve(__dirname, '../../..');

// Matches the *call*, not the name: several files discuss the enrolling
// function in a comment explaining why they deliberately don't use it, and
// naming the hazard should not count as touching it.
function filesCalling(symbol: string): string[] {
  const out = execSync(`git grep -l --fixed-strings -- '${symbol}(' src`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(Boolean)
    .filter(f => !f.includes('__tests__'));
}

describe('the enrollment boundary', () => {
  it('is crossed only by code whose job is to enroll', () => {
    const offenders = filesCalling('getOrCreateDeviceKeypair').filter(
      f => !(f in MAY_ENROLL),
    );

    expect(offenders).toEqual([]);
  });

  it('lists nothing that has since stopped enrolling', () => {
    // Keeps the list honest in the other direction: a stale entry is a
    // standing permission nobody re-examines.
    const actual = new Set(filesCalling('getOrCreateDeviceKeypair'));
    const stale = Object.keys(MAY_ENROLL).filter(f => !actual.has(f));

    expect(stale).toEqual([]);
  });
});
