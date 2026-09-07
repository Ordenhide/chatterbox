/**
 * An outgoing message carries a sender name, and that name is written to the
 * message document in the clear — `sendMessage` in services/firebaseChat.ts
 * spreads the whole object into `setDoc`. Everyone in the chat can read it,
 * and so can the server.
 *
 * Every one of the ten send paths in ChatScreen used to fall back
 * `displayName || email`, and the display name is optional at sign-up
 * (SignUpScreen requires only an address and a password). An account created
 * without a name therefore put its owner's email address on every message it
 * ever sent. firestore.rules refuses `email` on a *profile* document for
 * exactly this reason, and explains at length why a real-world identifier
 * readable by anyone who knows your uid is the worst thing on the record; the
 * message document had no equivalent guard, so it went round the front.
 *
 * The property under test is narrow and absolute: no input produces an email
 * address. It is asserted rather than reviewed because the fallback is one
 * `||` away from coming back, at any of ten call sites, in a file of seven
 * thousand lines.
 */
import {senderName} from '../senderName';

describe('the name written onto an outgoing message', () => {
  it('uses the display name when there is one', () => {
    expect(senderName({displayName: 'Ada'})).toBe('Ada');
  });

  it('never falls back to an email address', () => {
    expect(senderName({displayName: null, email: 'ada@example.com'} as never)).toBe('User');
    expect(senderName({displayName: '', email: 'ada@example.com'} as never)).toBe('User');
    // Whitespace is not a name. Without the trim this renders as a blank
    // sender, which reads as a rendering bug rather than as "no name".
    expect(senderName({displayName: '   ', email: 'ada@example.com'} as never)).toBe('User');
  });

  it('has something to say when there is no user at all', () => {
    expect(senderName(null)).toBe('User');
    expect(senderName(undefined)).toBe('User');
  });
});
