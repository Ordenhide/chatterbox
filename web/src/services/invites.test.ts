/**
 * The web half of the invite flow. The mobile suite
 * (src/services/__tests__/invites.test.ts) covers the same behaviour against
 * the same collection; the risk this file carries on top of that is *drift* —
 * two reimplementations of one wire format, either of which can quietly stop
 * being able to open the other's links.
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

/** In-memory localStorage, matching account.test.ts's stand-in. */
const memoryStorage = (() => {
  let data: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(data).length;
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = String(v);
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    clear: () => {
      data = {};
    },
  };
})();
vi.stubGlobal('localStorage', memoryStorage);

const mockFixtures = vi.hoisted(() => ({
  invites: new Map<string, Record<string, unknown>>(),
  writes: [] as {path: string; data: Record<string, unknown>}[],
  updates: [] as {path: string; data: Record<string, unknown>}[],
  deleted: [] as string[],
  failWrites: false,
  failReads: false,
  keypair: null as {publicKey: Uint8Array; secretKey: Uint8Array} | null,
}));

vi.mock('../firebase', () => ({db: {}}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: async (ref: {path: string}) => {
    if (mockFixtures.failReads) throw new Error('unavailable');
    const data = mockFixtures.invites.get(ref.path);
    return {exists: () => !!data, data: () => data};
  },
  setDoc: async (ref: {path: string}, data: Record<string, unknown>) => {
    if (mockFixtures.failWrites) throw new Error('permission-denied');
    mockFixtures.writes.push({path: ref.path, data});
    mockFixtures.invites.set(ref.path, data);
  },
  updateDoc: async (ref: {path: string}, data: Record<string, unknown>) => {
    if (mockFixtures.failWrites) throw new Error('permission-denied');
    mockFixtures.updates.push({path: ref.path, data});
    mockFixtures.invites.set(ref.path, {...mockFixtures.invites.get(ref.path), ...data});
  },
  deleteDoc: async (ref: {path: string}) => {
    if (mockFixtures.failWrites) throw new Error('permission-denied');
    mockFixtures.deleted.push(ref.path);
    mockFixtures.invites.delete(ref.path);
  },
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}));
vi.mock('./e2eeKeys', () => ({
  getDeviceKeypairIfEnrolled: async () => mockFixtures.keypair,
}));

import {
  INVITE_SCHEME,
  INVITE_TTL_MS,
  acceptInvite,
  createInvite,
  forgetInvite,
  inviteLink,
  inviteState,
  newInviteToken,
  outstandingInvite,
  parseInviteLink,
  rememberInvite,
  revokeInvite,
  type Invite,
} from './invites';

function seedInvite(token: string, over: Record<string, unknown> = {}) {
  mockFixtures.invites.set(`invites/${token}`, {
    inviterUid: 'alice',
    inviterKey: 'AAAA',
    expiresAt: Date.now() + INVITE_TTL_MS,
    acceptedBy: null,
    ...over,
  });
}

beforeEach(() => {
  mockFixtures.invites.clear();
  mockFixtures.writes = [];
  mockFixtures.updates = [];
  mockFixtures.deleted = [];
  mockFixtures.failWrites = false;
  mockFixtures.failReads = false;
  mockFixtures.keypair = {publicKey: new Uint8Array(32).fill(7), secretKey: new Uint8Array(32)};
  localStorage.clear();
});

describe('createInvite', () => {
  it('publishes only the uid, the key and an expiry', () => {
    // The document is what a stranger reads, so its shape is the privacy
    // boundary. No name, in particular — that is why the email lookup went.
    return createInvite('alice').then(result => {
      expect(result.ok).toBe(true);
      expect(Object.keys(mockFixtures.writes[0].data).sort()).toEqual([
        'acceptedBy',
        'createdAt',
        'expiresAt',
        'inviterKey',
        'inviterUid',
      ]);
      expect(mockFixtures.writes[0].data.acceptedBy).toBeNull();
    });
  });

  it('refuses on a browser with no published key rather than minting one', async () => {
    mockFixtures.keypair = null;
    expect(await createInvite('alice')).toEqual({ok: false, reason: 'not-enrolled'});
    expect(mockFixtures.writes).toHaveLength(0);
  });

  it('reports a rejected write instead of returning a link that does not exist', async () => {
    mockFixtures.failWrites = true;
    expect(await createInvite('alice')).toEqual({ok: false, reason: 'failed'});
  });
});

describe('acceptInvite', () => {
  it('returns who it was from and stamps the claim', async () => {
    seedInvite('t1');
    expect(await acceptInvite('t1', 'bob')).toEqual({
      ok: true,
      inviterUid: 'alice',
      inviterKey: 'AAAA',
    });
    expect(mockFixtures.updates).toEqual([{path: 'invites/t1', data: {acceptedBy: 'bob'}}]);
  });

  it('refuses a token nobody minted', async () => {
    expect(await acceptInvite('nope', 'bob')).toEqual({ok: false, reason: 'not-found'});
  });

  it('refuses one already claimed, one expired, and your own', async () => {
    seedInvite('spent', {acceptedBy: 'carol'});
    seedInvite('stale', {expiresAt: Date.now() - 1});
    seedInvite('mine');
    expect(await acceptInvite('spent', 'bob')).toEqual({ok: false, reason: 'already-used'});
    expect(await acceptInvite('stale', 'bob')).toEqual({ok: false, reason: 'expired'});
    expect(await acceptInvite('mine', 'alice')).toEqual({ok: false, reason: 'own-invite'});
    expect(mockFixtures.updates).toHaveLength(0);
  });

  it('reports a failed read as a failure, not as a missing invite', async () => {
    seedInvite('t2');
    mockFixtures.failReads = true;
    expect(await acceptInvite('t2', 'bob')).toEqual({ok: false, reason: 'failed'});
  });
});

describe('revokeInvite', () => {
  it('deletes the link and survives a refusal', async () => {
    seedInvite('t3');
    await revokeInvite('t3');
    expect(mockFixtures.deleted).toEqual(['invites/t3']);
    mockFixtures.failWrites = true;
    await expect(revokeInvite('t3')).resolves.toBeUndefined();
  });
});

describe('inviteState', () => {
  it('distinguishes open, claimed, lapsed and absent', async () => {
    seedInvite('open');
    seedInvite('claimed', {acceptedBy: 'bob'});
    seedInvite('lapsed', {expiresAt: Date.now() - 1});
    expect(await inviteState('open')).toBe('pending');
    expect(await inviteState('claimed')).toBe('accepted');
    expect(await inviteState('lapsed')).toBe('expired');
    expect(await inviteState('absent')).toBe('gone');
  });

  it('does not report a failed read as gone', async () => {
    seedInvite('open');
    mockFixtures.failReads = true;
    expect(await inviteState('open')).toBe('pending');
  });
});

describe('the invite this browser is offering', () => {
  const mine = (over: Partial<Invite> = {}): Invite => ({
    token: newInviteToken(),
    inviterUid: 'alice',
    inviterKey: 'AAAA',
    expiresAt: Date.now() + INVITE_TTL_MS,
    acceptedBy: null,
    ...over,
  });

  it('comes back after a reload', () => {
    const invite = mine();
    rememberInvite(invite);
    expect(outstandingInvite()).toEqual(invite);
  });

  it('is nothing when none was ever made', () => {
    expect(outstandingInvite()).toBeNull();
  });

  it('drops an expired one rather than offering it', () => {
    rememberInvite(mine({expiresAt: Date.now() - 1}));
    expect(outstandingInvite()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('ignores a stored value that is not an invite', () => {
    for (const junk of ['', 'not json', '{}', '{"token":"zzz","expiresAt":1}']) {
      localStorage.setItem('chatterbox:invite:outstanding', junk);
      expect(outstandingInvite()).toBeNull();
    }
  });

  it('forgets on request', () => {
    rememberInvite(mine());
    forgetInvite();
    expect(outstandingInvite()).toBeNull();
  });
});

describe('the link itself', () => {
  it('is 32 bytes of hex in the fragment', () => {
    const token = newInviteToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(inviteLink(token)).toBe(`${INVITE_SCHEME}#${token}`);
    expect(parseInviteLink(inviteLink(token))).toBe(token);
  });

  it('rejects anything that is not one of our links', () => {
    const token = newInviteToken();
    for (const bad of [
      null,
      undefined,
      '',
      `https://chatterbox.app/invite#${token}`,
      `chatterbox://chat#${token}`,
      `${INVITE_SCHEME}?${token}`,
      `${INVITE_SCHEME}#${token.toUpperCase()}`,
      `${INVITE_SCHEME}#${token}extra`,
      `${INVITE_SCHEME}#${token.slice(0, 63)}`,
      `${INVITE_SCHEME}#../../users/alice`,
      `${INVITE_SCHEME}#`,
    ]) {
      expect(parseInviteLink(bad)).toBeNull();
    }
  });
});
