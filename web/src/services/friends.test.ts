import {describe, expect, it, vi} from 'vitest';

// friends.ts pulls in firebase/firestore + ../firebase at import time; stub them
// so these pure-function tests stay hermetic (no Firebase init / network).
vi.mock('../firebase', () => ({db: {}}));

import {blockId, pairId} from './friends';

describe('pairId', () => {
  it('is order-independent (same id regardless of argument order)', () => {
    expect(pairId('alice', 'bob')).toBe(pairId('bob', 'alice'));
  });

  it('sorts the two uids deterministically', () => {
    expect(pairId('bob', 'alice')).toBe('alice_bob');
    expect(pairId('alice', 'bob')).toBe('alice_bob');
  });
});

describe('blockId', () => {
  it('is directional (blocker first, blocked second)', () => {
    expect(blockId('alice', 'bob')).toBe('alice_bob');
    expect(blockId('bob', 'alice')).toBe('bob_alice');
    expect(blockId('alice', 'bob')).not.toBe(blockId('bob', 'alice'));
  });
});
