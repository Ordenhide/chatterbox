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
  failReads: boolean;
  local: Map<string, string>;
  failLocal: boolean;
} = {
  invites: new Map(),
  writes: [],
  updates: [],
  deleted: [],
  failWrites: false,
  failReads: false,
  local: new Map(),
  failLocal: false,
};
const mockGetKeypair = jest.fn();
const mockReportError = jest.fn();

jest.mock('../firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: async (ref: {path: string}) => {
    if (mockStore.failReads) throw new Error('unavailable');
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
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (key: string) => {
      if (mockStore.failLocal) throw new Error('store unavailable');
      return mockStore.local.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      if (mockStore.failLocal) throw new Error('store unavailable');
      mockStore.local.set(key, value);
    },
    removeItem: async (key: string) => {
      if (mockStore.failLocal) throw new Error('store unavailable');
      mockStore.local.delete(key);
    },
  },
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
  mockStore.failReads = false;
  mockStore.local.clear();
  mockStore.failLocal = false;
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

  it('reports a failed read as a failure, not as a missing invite', async () => {
    seedInvite('t13');
    mockStore.failReads = true;
    expect(await acceptInvite('t13', 'bob')).toEqual({ok: false, reason: 'failed'});
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

describe('the invite this device is offering', () => {
  const mine = (over: Partial<Invite> = {}): Invite => ({
    token: newInviteToken(),
    inviterUid: 'alice',
    inviterKey: 'AAAA',
    expiresAt: Date.now() + INVITE_TTL_MS,
    acceptedBy: null,
    ...over,
  });

  it('comes back after the screen is closed and reopened', async () => {
    // There is nowhere else to look: `list` is denied, so an invite the device
    // forgets is one the inviter can no longer show or withdraw.
    const invite = mine();
    await rememberInvite(invite);
    expect(await outstandingInvite()).toEqual(invite);
  });

  it('is nothing when none was ever made', async () => {
    expect(await outstandingInvite()).toBeNull();
  });

  it('drops an expired one rather than offering it', async () => {
    await rememberInvite(mine({expiresAt: Date.now() - 1}));
    expect(await outstandingInvite()).toBeNull();
    expect(mockStore.local.size).toBe(0);
  });

  it('ignores a stored value that is not an invite', async () => {
    for (const junk of ['', 'not json', '{}', '{"token":"zzz","expiresAt":1}']) {
      mockStore.local.set('chatterbox:invite:outstanding', junk);
      expect(await outstandingInvite()).toBeNull();
    }
  });

  it('forgets on request', async () => {
    await rememberInvite(mine());
    await forgetInvite();
    expect(await outstandingInvite()).toBeNull();
  });

  it('survives a store that cannot be written or read', async () => {
    mockStore.failLocal = true;
    await expect(rememberInvite(mine())).resolves.toBeUndefined();
    expect(await outstandingInvite()).toBeNull();
    await expect(forgetInvite()).resolves.toBeUndefined();
    expect(mockReportError).toHaveBeenCalled();
  });
});

describe('inviteState', () => {
  it('is pending while nobody has opened it', async () => {
    seedInvite('t8');
    expect(await inviteState('t8')).toBe('pending');
  });

  it('is accepted once someone has', async () => {
    seedInvite('t9', {acceptedBy: 'bob'});
    expect(await inviteState('t9')).toBe('accepted');
  });

  it('is expired when its time ran out unused', async () => {
    seedInvite('t10', {expiresAt: Date.now() - 1});
    expect(await inviteState('t10')).toBe('expired');
  });

  it('is gone when the server does not have it', async () => {
    expect(await inviteState('t11')).toBe('gone');
  });

  it('does not report a failed read as gone', async () => {
    // Saying "this link is dead" because the network was down would push the
    // user to mint a second live link while the first one is still open.
    seedInvite('t12');
    mockStore.failReads = true;
    expect(await inviteState('t12')).toBe('pending');
    expect(mockReportError).toHaveBeenCalled();
  });
});

/**
 * `web/` is a separate reimplementation, so the two invite services are two
 * pieces of code writing one collection. Anything that differs between them
 * shows up as a link one client mints and the other cannot open — and a paste
 * that silently does nothing is a bad way to find that out.
 *
 * These read the web source rather than importing it, because the web module
 * pulls in the Firebase web SDK, which this jest environment does not have.
 * The values are the wire format: the scheme in the link, the token's shape,
 * the collection, and the exact field set the rules will accept.
 */
describe('parity with the web client', () => {
  const web = require('fs').readFileSync(
    require('path').join(__dirname, '../../../web/src/services/invites.ts'),
    'utf8',
  );

  it.each([
    ["const TOKEN_BYTES = 32;", 'token length'],
    ["export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;", 'lifetime'],
    ["export const INVITE_SCHEME = 'chatterbox://invite';", 'link scheme'],
    ["/^[0-9a-f]{64}$/.test(token)", 'accepted token shape'],
    ["const OUTSTANDING_KEY = 'chatterbox:invite:outstanding';", 'local key'],
  ])('agrees on %s (%s)', line => {
    expect(web).toContain(line);
    expect(
      require('fs').readFileSync(require('path').join(__dirname, '../invites.ts'), 'utf8'),
    ).toContain(line);
  });

  it('writes the same five fields, which is what the rules will accept', () => {
    // keys().hasOnly([...]) in firestore.rules rejects a create carrying
    // anything else, so a field added on one side alone is a silent refusal.
    for (const field of ['inviterUid', 'inviterKey', 'expiresAt', 'acceptedBy', 'createdAt']) {
      expect(web).toContain(`${field}:`);
    }
    expect(web).toContain("'invites'");
  });
});
