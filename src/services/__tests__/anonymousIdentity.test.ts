import {
  ANON_ADDRESS_DOMAIN,
  credentialsFromPhrase,
  credentialsFromSeed,
  newAccountSeed,
  SEED_BYTES,
  seedFromPhrase,
  seedToPhrase,
} from '../anonymousIdentity';
import {bytesToHex, base64ToBytes} from '../crypto';

const SEED = new Uint8Array(32).map((_, i) => i);

describe('credentials derived from a seed', () => {
  /**
   * The one test in this file that must never be "fixed" by updating the
   * expected values.
   *
   * These strings are the account. There is no email to reset from and no
   * support address to write to, so changing the salt, either info label, or
   * the output lengths does not migrate anyone — it silently points every
   * existing phrase at an account that does not exist, and the user is told
   * their words are wrong. If this test fails, the derivation changed, and the
   * change has to be reverted or given a new version alongside the old one.
   */
  it('derives these exact credentials, forever', () => {
    expect(credentialsFromSeed(SEED)).toEqual({
      address: 'baee77a155eae610a69954509b0a1785@anon.chatterbox.invalid',
      secret: 'f5HmtKx2c1RdNDZMfXIZc2tXxEjegED/Jsas7Kb9FDQ=',
    });
  });

  it('is deterministic, because that is what makes restore work', () => {
    expect(credentialsFromSeed(SEED)).toEqual(credentialsFromSeed(SEED.slice()));
  });

  it('gives different seeds different accounts', () => {
    const other = new Uint8Array(32).map((_, i) => i + 1);
    const a = credentialsFromSeed(SEED);
    const b = credentialsFromSeed(other);
    expect(a.address).not.toBe(b.address);
    expect(a.secret).not.toBe(b.secret);
  });

  it('rejects a seed of the wrong length instead of deriving from it', () => {
    // Silently accepting a short seed would mint a *valid-looking* account
    // that no phrase can ever reproduce.
    expect(() => credentialsFromSeed(new Uint8Array(16))).toThrow();
    expect(() => credentialsFromSeed(new Uint8Array(33))).toThrow();
  });
});

describe('what the credentials must not reveal', () => {
  const {address, secret} = credentialsFromSeed(SEED);
  const seedHex = bytesToHex(SEED);

  it('puts no part of the seed in the address', () => {
    // The address is stored in plaintext by Firebase and visible to anyone
    // with project access. Any run of the seed appearing in it would hand
    // that reader material for the key that decrypts the account.
    const local = address.split('@')[0];
    expect(seedHex).not.toContain(local);
    for (let i = 0; i + 8 <= seedHex.length; i += 2) {
      expect(local).not.toContain(seedHex.slice(i, i + 8));
    }
  });

  it('does not use the seed itself as the login secret', () => {
    expect(bytesToHex(base64ToBytes(secret))).not.toBe(seedHex);
  });

  it('derives the two credentials independently of each other', () => {
    // Same seed, same salt: only the info labels separate them, and a prefix
    // check is what that has to be tested with rather than equality. HKDF's
    // expand step emits one stream and truncates it, so two derivations that
    // differ only in output length produce the *shorter one as a prefix of the
    // longer*. Collapsing the two labels would therefore not make the address
    // equal the secret — it would make the public address the secret's first
    // sixteen bytes, which an equality assertion sails straight past.
    const local = address.split('@')[0];
    const secretHex = bytesToHex(base64ToBytes(secret));
    expect(secretHex.startsWith(local)).toBe(false);
    expect(local.startsWith(secretHex)).toBe(false);
  });

  it('uses a domain that cannot receive mail', () => {
    // RFC 2606 reserves .invalid. A registrable domain here could be given a
    // catch-all mailbox by anyone who noticed the pattern.
    expect(ANON_ADDRESS_DOMAIN.endsWith('.invalid')).toBe(true);
    expect(address.endsWith(`@${ANON_ADDRESS_DOMAIN}`)).toBe(true);
  });

  it('makes a secret long enough that Firebase is storing real entropy', () => {
    expect(base64ToBytes(secret).length).toBe(32);
  });
});

describe('phrases', () => {
  it('round-trips a seed through the words the user writes down', () => {
    const seed = newAccountSeed();
    expect(seed.length).toBe(SEED_BYTES);
    expect(seedFromPhrase(seedToPhrase(seed))).toEqual(seed);
  });

  it('reaches the same account from the phrase as from the seed', () => {
    expect(credentialsFromPhrase(seedToPhrase(SEED))).toEqual(credentialsFromSeed(SEED));
  });

  it('mints a different seed every time', () => {
    expect(bytesToHex(newAccountSeed())).not.toBe(bytesToHex(newAccountSeed()));
  });

  it('forgives the casing and spacing of a phrase typed back in', () => {
    const phrase = seedToPhrase(SEED);
    const mangled = `  ${phrase.toUpperCase().split(' ').join('\n  ')}  `;
    expect(credentialsFromPhrase(mangled)).toEqual(credentialsFromSeed(SEED));
  });

  it('answers null for anything that is not one of our phrases', () => {
    const phrase = seedToPhrase(SEED);
    const words = phrase.split(' ');
    expect(seedFromPhrase('')).toBeNull();
    expect(seedFromPhrase('not a real recovery phrase at all')).toBeNull();
    // Right words, wrong order — the BIP39 checksum catches it.
    expect(seedFromPhrase([...words.slice(1), words[0]].join(' '))).toBeNull();
    // One word short.
    expect(seedFromPhrase(words.slice(0, 23).join(' '))).toBeNull();
    expect(credentialsFromPhrase('zzz not words')).toBeNull();
  });

  it('rejects a 12-word phrase, which encodes half the entropy', () => {
    // Valid BIP39, wrong size for us: 16 bytes cannot be an X25519 key, and
    // accepting one would halve the security of every account created from it.
    const twelve = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    expect(seedFromPhrase(twelve)).toBeNull();
  });
});
