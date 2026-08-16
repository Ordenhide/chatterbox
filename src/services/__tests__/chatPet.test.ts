const mockSetDoc = jest.fn();

jest.mock('../firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (...args: unknown[]) => ({path: args.slice(1).join('/')}),
  getDoc: jest.fn(),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: jest.fn(),
}));
jest.mock('../snapshotGuard', () => ({guardDocSnapshot: (_label: string, cb: unknown) => cb}));

import {calculatePetMood, changePetSpecies, decayHealth, didPetJustEat} from '../chatPet';
import type {ChatPet} from '../../types';

beforeEach(() => {
  mockSetDoc.mockReset().mockResolvedValue(undefined);
});

function makePet(overrides: Partial<ChatPet> = {}): ChatPet {
  return {
    species: 'cat',
    name: 'Mochi',
    level: 1,
    xp: 0,
    health: 100,
    lastFed: Date.now(),
    createdAt: Date.now(),
    mood: 'happy',
    ...overrides,
  };
}

describe('calculatePetMood', () => {
  it('reads the boundaries the widget actually renders differently at', () => {
    expect(calculatePetMood(makePet({health: 100}))).toBe('happy');
    expect(calculatePetMood(makePet({health: 80}))).toBe('happy');
    expect(calculatePetMood(makePet({health: 79}))).toBe('neutral');
    expect(calculatePetMood(makePet({health: 50}))).toBe('neutral');
    expect(calculatePetMood(makePet({health: 49}))).toBe('sad');
    expect(calculatePetMood(makePet({health: 20}))).toBe('sad');
    expect(calculatePetMood(makePet({health: 19}))).toBe('sleeping');
    expect(calculatePetMood(makePet({health: 0}))).toBe('sleeping');
  });
});

describe('decayHealth', () => {
  it('leaves health untouched for a pet fed moments ago', () => {
    expect(decayHealth(makePet({health: 100, lastFed: Date.now()}))).toBe(100);
  });

  it('drops 5 health per full day unfed', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    expect(decayHealth(makePet({health: 100, lastFed: threeDaysAgo}))).toBe(85);
  });

  it('floors at 0 rather than going negative on a long-abandoned pet', () => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    expect(decayHealth(makePet({health: 100, lastFed: monthAgo}))).toBe(0);
  });
});

describe('didPetJustEat', () => {
  it('is false with no prior reading — nothing to compare a fresh listener snapshot against', () => {
    expect(didPetJustEat(null, makePet())).toBe(false);
  });

  it('is false once the pet is gone, even if it had been fed before', () => {
    expect(didPetJustEat(makePet({lastFed: 1000}), null)).toBe(false);
  });

  it('is true when lastFed has advanced', () => {
    expect(didPetJustEat(makePet({lastFed: 1000}), makePet({lastFed: 2000}))).toBe(true);
  });

  it('is false when nothing changed — an unrelated chat field updating must not fire the celebration', () => {
    const pet = makePet({lastFed: 1000});
    expect(didPetJustEat(pet, {...pet})).toBe(false);
  });

  // Health is clamped at 100 by feedPet, so feeding an already-full pet would
  // show no change in health — lastFed is the one field guaranteed to move.
  it('is true even when health was already at its cap', () => {
    const prev = makePet({lastFed: 1000, health: 100});
    const next = makePet({lastFed: 2000, health: 100});
    expect(didPetJustEat(prev, next)).toBe(true);
  });
});

describe('changePetSpecies', () => {
  it('writes only species and name, never the rest of the pet', async () => {
    await changePetSpecies('chat1', 'fox', 'Fox');
    expect(mockSetDoc).toHaveBeenCalledWith(
      {path: 'chats/chat1'},
      {pet: {species: 'fox', name: 'Fox'}},
      {merge: true},
    );
  });

  // The whole point of a targeted merge over feedPet's read-modify-write: it
  // can't clobber level/xp/health/lastFed, because it never reads or writes
  // them in the first place.
  it('never touches progress fields in the payload it sends', async () => {
    await changePetSpecies('chat1', 'dog', 'Dog');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.pet).not.toHaveProperty('level');
    expect(payload.pet).not.toHaveProperty('xp');
    expect(payload.pet).not.toHaveProperty('health');
    expect(payload.pet).not.toHaveProperty('lastFed');
  });
});
