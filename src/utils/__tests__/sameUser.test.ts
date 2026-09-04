import {sameUser} from '../sameUser';
import type {User} from '../../types';

const ALICE: User = {
  uid: 'uid1',
  email: 'alice@example.com',
  displayName: 'Alice',
  photoURL: 'https://example.com/a.jpg',
};

describe('sameUser', () => {
  it('is true for two separate objects with identical fields', () => {
    // The case that matters: onAuthStateChanged rebuilds the profile on every
    // token refresh, so this is what a "nothing changed" refresh looks like.
    expect(sameUser({...ALICE}, {...ALICE})).toBe(true);
  });

  it('is true for the same reference', () => {
    expect(sameUser(ALICE, ALICE)).toBe(true);
  });

  it('is true for two nulls — signed out is signed out', () => {
    expect(sameUser(null, null)).toBe(true);
  });

  it.each([
    ['uid', {uid: 'uid2'}],
    ['email', {email: 'alice@work.example.com'}],
    ['displayName', {displayName: 'Alice B.'}],
    ['photoURL', {photoURL: 'https://example.com/b.jpg'}],
  ])('notices a changed %s', (_field, change) => {
    expect(sameUser(ALICE, {...ALICE, ...change})).toBe(false);
  });

  it('notices a field being cleared', () => {
    expect(sameUser(ALICE, {...ALICE, displayName: undefined})).toBe(false);
    expect(sameUser(ALICE, {...ALICE, photoURL: undefined})).toBe(false);
  });

  it('is false when exactly one side is null', () => {
    expect(sameUser(ALICE, null)).toBe(false);
    expect(sameUser(null, ALICE)).toBe(false);
  });

  it('compares fields, not key order', () => {
    const reordered = {
      photoURL: ALICE.photoURL,
      displayName: ALICE.displayName,
      email: ALICE.email,
      uid: ALICE.uid,
    } as User;
    expect(sameUser(ALICE, reordered)).toBe(true);
  });
});
