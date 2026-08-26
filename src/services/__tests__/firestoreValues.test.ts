import {stripUndefined} from '../firestoreValues';

/**
 * Firestore throws on an `undefined` field value rather than ignoring the key,
 * and object spreads produce them constantly — `{...data, mediaKeys: undefined}`
 * is how encryptOutgoingMessage clears a field.
 */
describe('stripUndefined', () => {
  it('removes undefined keys and keeps everything else, including null', () => {
    expect(stripUndefined({a: 1, b: undefined, c: null, d: ''})).toEqual({a: 1, c: null, d: ''});
  });

  it('recurses into nested plain objects', () => {
    expect(stripUndefined({user: {_id: 'me', avatar: undefined}})).toEqual({user: {_id: 'me'}});
  });

  it('drops undefined entries from arrays rather than leaving holes', () => {
    expect(stripUndefined([1, undefined, 2])).toEqual([1, 2]);
  });

  /**
   * The subtle half. Dates, Timestamps and FieldValue sentinels are class
   * instances; walking them would strip their internals and hand Firestore a
   * meaningless object. Recognised by constructor rather than by name, so a
   * sentinel type nobody anticipated still survives.
   */
  it('passes class instances through untouched', () => {
    const date = new Date(0);
    expect(stripUndefined({createdAt: date}).createdAt).toBe(date);

    class Sentinel {
      constructor(public kind = 'serverTimestamp') {}
    }
    const sentinel = new Sentinel();
    expect(stripUndefined({at: sentinel}).at).toBe(sentinel);
  });

  it('returns undefined for a bare undefined, so callers can drop the key', () => {
    expect(stripUndefined(undefined)).toBeUndefined();
  });
});
