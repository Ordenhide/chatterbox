import {revealOffer} from '../recoveryPhraseReveal';

describe('revealOffer', () => {
  it('offers the reveal on a device that holds the account key', () => {
    expect(revealOffer('safe', false)).toBe('offer');
  });

  it('refuses on a device that still has history to restore', () => {
    // The bug this exists for: RecoveryPhraseScreen offered "View recovery
    // phrase" here, and revealing enrolls — publishing this device's brand-new
    // key over the one the user's saved phrase matches. The screen you visit
    // in order to restore contained the one button that makes restoring fail.
    expect(revealOffer('needs-restore', false)).toBe('restore-first');
  });

  it('refuses when readiness could not be determined', () => {
    // Never folded into `offer`: that turns a network blip into an overwrite.
    expect(revealOffer('unknown', false)).toBe('unavailable');
  });

  it('reports checking until both inputs have arrived', () => {
    expect(revealOffer(null, null)).toBe('checking');
    expect(revealOffer('safe', null)).toBe('checking');
    expect(revealOffer(null, false)).toBe('checking');
    // Including when the phrase is already revealed: that used to be answered
    // without waiting for readiness, which is precisely how a superseded
    // device got told it was fine.
    expect(revealOffer(null, true)).toBe('checking');
  });

  it('says already-revealed for any readiness that leaves the key intact', () => {
    // Re-offering the phrase would break the one-time-reveal rule, and none of
    // these readiness values is a reason to.
    for (const readiness of ['safe', 'needs-restore', 'unknown'] as const) {
      expect(revealOffer(readiness, true)).toBe('already-revealed');
    }
  });

  it('reports a superseded key even to a device that already revealed its phrase', () => {
    // The end of the trap: the chat thread says "sealed on another device" and
    // links here, and this screen used to answer "you already saved your
    // phrase" — true, and about the wrong key. It is also the only combination
    // that can happen to a long-standing device, since revealing is what a
    // device does *before* another one supersedes it.
    expect(revealOffer('superseded', true)).toBe('superseded');
    expect(revealOffer('superseded', false)).toBe('superseded');
  });

  it('never offers on anything but safe', () => {
    const offered = (['safe', 'needs-restore', 'superseded', 'unknown', null] as const).filter(
      r => revealOffer(r, false) === 'offer',
    );
    expect(offered).toEqual(['safe']);
  });
});
