/**
 * The invite link is now the only way two strangers reach each other, so its
 * failure modes are the app's introduction surface. The tests below are mostly
 * about refusals: a link that is expired, spent, malformed, or your own has to
 * come back with a reason rather than open a chat with the wrong person.
 */
// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockStore: {
  invites: Map<string, Record<string, unknown>>;
  writes: {path: string; data: Record<string, unknown>}[];
  updates: {path: string; data: Record<string, unknown>}[];
  deleted: string[];
  failWrites: boolean;
} = {
  invites: new Map(),
  writes: [],
  updates: [],
  deleted: [],
  failWrites: false,
};
const mockGetKeypair = jest.fn();
const mockReportError = jest.fn();

jest.mock('../firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: async (ref: {path: string}) => {
    const data = mockStore.invites.get(ref.path);
    return {exists: () => !!data, data: () => data};
  },
  setDoc: async (ref: {path: string}, data: Record<string, unknown>) => {
    if (mockStore.failWrites) throw new Error('permission-denied');
    mockStore.writes.push({path: ref.path, data});
    mockStore.invites.set(ref.path, data);
  },
  updateDoc: async (ref: {path: string}, data: Record<string, unknown>) => {
    if (mockStore.failWrites) throw new Error('permission-denied');
    mockStore.updates.push({path: ref.path, data});
    mockStore.invites.set(ref.path, {...mockStore.invites.get(ref.path), ...data});
  },
  deleteDoc: async (ref: {path: string}) => {
    if (mockStore.failWrites) throw new Error('permission-denied');
    mockStore.deleted.push(ref.path);
    mockStore.invites.delete(ref.path);
  },
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}));
// Called through a wrapper rather than passed directly: the factories run
// while these consts are still in their temporal dead zone.
jest.mock('../e2eeKeys', () => ({
  getDeviceKeypairIfEnrolled: (...args: unknown[]) => mockGetKeypair(...args),
}));
jest.mock('../telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import {
  INVITE_SCHEME,
  INVITE_TTL_MS,
  acceptInvite,
  createInvite,
  inviteLink,
  newInviteToken,
  parseInviteLink,
  revokeInvite,
} from '../invites';

const ALICE_KEY = new Uint8Array(32).fill(7);

function seedInvite(token: string, over: Record<string, unknown> = {}) {
  mockStore.invites.set(`invites/${token}`, {
    inviterUid: 'alice',
    inviterKey: 'AAAA',
    expiresAt: Date.now() + INVITE_TTL_MS,
    acceptedBy: null,
    ...over,
  });
}

beforeEach(() => {
  mockStore.invites.clear();
  mockStore.writes = [];
  mockStore.updates = [];
  mockStore.deleted = [];
  mockStore.failWrites = false;
  mockGetKeypair.mockReset();
  mockGetKeypair.mockResolvedValue({publicKey: ALICE_KEY, secretKey: new Uint8Array(32)});
  mockReportError.mockClear();
});

describe('newInviteToken', () => {
  it('is 32 bytes of hex', () => {
    expect(newInviteToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not repeat', () => {
    const tokens = new Set(Array.from({length: 200}, newInviteToken));
    expect(tokens.size).toBe(200);
  });
});

describe('createInvite', () => {
  it('publishes only the uid, the key and an expiry', async () => {
    const result = await createInvite('alice');
    expect(result.ok).toBe(true);
    // The document is the thing a stranger reads. Anything here is public to
    // whoever holds the link, so the shape is the privacy boundary — in
    // particular there is no name, which is why the email directory went.
    expect(Object.keys(mockStore.writes[0].data).sort()).toEqual(
      ['acceptedBy', 'createdAt', 'expiresAt', 'inviterKey', 'inviterUid'].sort(),
    );
    expect(mockStore.writes[0].data.inviterUid).toBe('alice');
    expect(mockStore.writes[0].data.acceptedBy).toBeNull();
  });

  it('expires within a day', async () => {
    const before = Date.now();
    const result = await createInvite('alice');
    if (!result.ok) throw new Error('expected an invite');
    expect(result.invite.expiresAt).toBeGreaterThan(before);
    expect(result.invite.expiresAt).toBeLessThanOrEqual(before + INVITE_TTL_MS + 50);
  });

  it('refuses on a device with no published key rather than minting one', async () => {
    // The guard that matters: the enrolling variant of this call would publish
    // a fresh keypair over an account that already has one, silently locking
    // the user out of their own history.
    mockGetKeypair.mockResolvedValue(null);
    expect(await createInvite('alice')).toEqual({ok: false, reason: 'not-enrolled'});
    expect(mockStore.writes).toHaveLength(0);
  });

  it('reports a rejected write instead of returning a link that does not exist', async () => {
    mockStore.failWrites = true;
    expect(await createInvite('alice')).toEqual({ok: false, reason: 'failed'});
    expect(mockReportError).toHaveBeenCalled();
  });
});

describe('acceptInvite', () => {
  it('returns who the invite was from and stamps the claim', async () => {
    seedInvite('t1');
    expect(await acceptInvite('t1', 'bob')).toEqual({
      ok: true,
      inviterUid: 'alice',
      inviterKey: 'AAAA',
    });
    expect(mockStore.updates).toEqual([{path: 'invites/t1', data: {acceptedBy: 'bob'}}]);
  });

  it('refuses a token nobody minted', async () => {
    expect(await acceptInvite('nope', 'bob')).toEqual({ok: false, reason: 'not-found'});
  });

  it('refuses one that has already been claimed', async () => {
    seedInvite('t2', {acceptedBy: 'carol'});
    expect(await acceptInvite('t2', 'bob')).toEqual({ok: false, reason: 'already-used'});
    expect(mockStore.updates).toHaveLength(0);
  });

  it('refuses one that has expired', async () => {
    seedInvite('t3', {expiresAt: Date.now() - 1});
    expect(await acceptInvite('t3', 'bob')).toEqual({ok: false, reason: 'expired'});
  });

  it('tells you when the link is your own', async () => {
    // Reported ahead of expiry and reuse: someone testing their own link needs
    // to hear what they did, not that the link is broken.
    seedInvite('t4');
    expect(await acceptInvite('t4', 'alice')).toEqual({ok: false, reason: 'own-invite'});
    expect(mockStore.updates).toHaveLength(0);
  });

  it('refuses a document missing the key it exists to carry', async () => {
    mockStore.invites.set('invites/t5', {inviterUid: 'alice', acceptedBy: null});
    expect(await acceptInvite('t5', 'bob')).toEqual({ok: false, reason: 'not-found'});
  });

  it('never claims one before deciding it is claimable', async () => {
    seedInvite('spent', {acceptedBy: 'carol'});
    seedInvite('stale', {expiresAt: Date.now() - 1});
    await acceptInvite('spent', 'bob');
    await acceptInvite('stale', 'bob');
    expect(mockStore.updates).toHaveLength(0);
  });
});

describe('revokeInvite', () => {
  it('deletes the link', async () => {
    seedInvite('t6');
    await revokeInvite('t6');
    expect(mockStore.deleted).toEqual(['invites/t6']);
  });

  it('swallows a rejected delete — the caller is withdrawing, not depending on it', async () => {
    seedInvite('t7');
    mockStore.failWrites = true;
    await expect(revokeInvite('t7')).resolves.toBeUndefined();
    expect(mockReportError).toHaveBeenCalled();
  });
});

describe('the link itself', () => {
  it('carries the token in the fragment', () => {
    // The fragment is the half of a URL a server never sees, so a link that
    // does travel through one leaks nothing.
    const token = newInviteToken();
    expect(inviteLink(token)).toBe(`${INVITE_SCHEME}#${token}`);
    expect(parseInviteLink(inviteLink(token))).toBe(token);
  });

  it('survives the whitespace a paste picks up', () => {
    const token = newInviteToken();
    expect(parseInviteLink(`  ${inviteLink(token)}\n`)).toBe(token);
  });

  it('rejects anything that is not one of our links', () => {
    const token = newInviteToken();
    for (const bad of [
      null,
      undefined,
      '',
      'https://chatterbox.app/invite#' + token,
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

  it('never hands a path segment to Firestore that is not a token', () => {
    // parseInviteLink is what stands between a crafted link and a document
    // path, so its output is checked in shape, not just in truthiness.
    const parsed = parseInviteLink(`${INVITE_SCHEME}#${newInviteToken()}`);
    expect(parsed).toMatch(/^[0-9a-f]{64}$/);
  });
});
