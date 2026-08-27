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
  });

  it('says already-revealed regardless of readiness', () => {
    // A device that has saved its phrase is enrolled by definition, so
    // readiness cannot make this any less safe — and re-offering the phrase
    // would break the one-time-reveal rule.
    for (const readiness of ['safe', 'needs-restore', 'unknown', null] as const) {
      expect(revealOffer(readiness, true)).toBe('already-revealed');
    }
  });

  it('never offers on anything but safe', () => {
    const offered = (['safe', 'needs-restore', 'unknown', null] as const).filter(
      r => revealOffer(r, false) === 'offer',
    );
    expect(offered).toEqual(['safe']);
  });
});
