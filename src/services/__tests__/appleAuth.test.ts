/**
 * The nonce is the only thing standing between this flow and replayed Apple
 * identity tokens, and every way of getting it wrong still produces a sign-in
 * that works on the happy path. So it gets tested against the exact property
 * Firebase checks: that the value sent to Apple is the SHA-256 of the value
 * kept on the device.
 */
import {createHash} from 'crypto';
import {appleNonce, formatAppleName} from '../appleAuth';

describe('appleNonce', () => {
  it('sends Apple the SHA-256 of the value it keeps', () => {
    // This is precisely what Firebase recomputes. If the two ever disagree,
    // every Apple sign-in fails with an error that names neither of them.
    const {raw, hashed} = appleNonce();
    expect(hashed).toBe(createHash('sha256').update(raw, 'utf8').digest('hex'));
  });

  it('never sends the raw nonce itself', () => {
    // Sending the same value in both places is the mistake that silently
    // removes replay protection while leaving sign-in working.
    const {raw, hashed} = appleNonce();
    expect(hashed).not.toBe(raw);
  });

  it('draws a fresh nonce every time', () => {
    // A reused nonce lets one captured token be replayed indefinitely.
    const seen = new Set(Array.from({length: 100}, () => appleNonce().raw));
    expect(seen.size).toBe(100);
  });

  it('produces a raw nonce with real entropy behind it', () => {
    // 32 bytes, hex-encoded.
    const {raw} = appleNonce();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a hash of the right shape', () => {
    expect(appleNonce().hashed).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('formatAppleName', () => {
  it('joins the two halves Apple sends', () => {
    expect(formatAppleName({givenName: 'Ada', familyName: 'Lovelace'})).toBe('Ada Lovelace');
  });

  it('copes with only one half', () => {
    expect(formatAppleName({givenName: 'Ada', familyName: null})).toBe('Ada');
    expect(formatAppleName({givenName: null, familyName: 'Lovelace'})).toBe('Lovelace');
  });

  it('returns null when Apple sends no name, which it does on every sign-in after the first', () => {
    // Distinguishable from a blank name so the caller can keep the stored one
    // instead of overwriting it with nothing.
    expect(formatAppleName(null)).toBeNull();
    expect(formatAppleName(undefined)).toBeNull();
    expect(formatAppleName({})).toBeNull();
    expect(formatAppleName({givenName: '', familyName: ''})).toBeNull();
  });

  it('does not return a stray space when a half is blank', () => {
    expect(formatAppleName({givenName: 'Ada', familyName: ''})).toBe('Ada');
  });
});
