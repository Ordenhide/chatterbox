/**
 * Sealing and opening 1:1 messages with the ratchet — phase 2c.
 *
 * This is the layer that actually gives a conversation forward secrecy, and
 * the one place where getting the fallback wrong would quietly undo the whole
 * exercise.
 *
 * ## Interoperability, and why the fallback is safe
 *
 * A peer is only sent ratchet messages if they have published a prekey bundle,
 * and only a client that implements the ratchet publishes one. So the bundle
 * is the capability signal: an older client never advertises one, and this
 * code falls back to the existing static-DH path for them automatically. No
 * version negotiation, and no possibility of sending someone a message their
 * client cannot open.
 *
 * ## The fallback must be loud
 *
 * Falling back is a real loss — the conversation keeps working but stops being
 * forward-secret — so `sealText` reports which path it took rather than
 * returning a bare envelope. A downgrade nobody can see is the same failure
 * mode as the fail-open plaintext downgrade this project has already had to
 * fix, one property up.
 *
 * The distinction that matters most is between "this peer has no ratchet" and
 * "I could not find out". The first is answered by falling back; the second
 * throws, because answering it with a fallback is how an intermittent network
 * turns into a permanently downgraded conversation.
 */
import {
  initSessionAsInitiator,
  initSessionAsResponder,
  isRatchetMessage,
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetMessage,
} from './ratchet/doubleRatchet';
import {
  X3DH_ALG,
  initiateX3DH,
  respondX3DH,
  type InitialMessageKeys,
} from './ratchet/x3dh';
import {
  burnOneTimePreKey,
  fetchPeerPreKeyBundle,
  getOrCreateRatchetIdentity,
  preKeySecretsForResponding,
  type PeerRatchetStatus,
} from './ratchetKeys';
import {withSession} from './ratchetSessionStore';
import {base64ToBytes, bytesToBase64, utf8ToBytes} from './crypto';
import {reportError} from './telemetry';

export const RATCHET_ENVELOPE_ALG = 'chatterbox-ratchet-envelope-v1';

/** The X3DH half, present only on the first message of a session. */
type SerializedInitial = {
  identityKey: string;
  ephemeralKey: string;
  signedPreKeyId: string;
  oneTimePreKeyId?: string;
};

export type RatchetEnvelope = {
  alg: typeof RATCHET_ENVELOPE_ALG;
  /** Sender uid — selects which session opens this. */
  from: string;
  message: RatchetMessage;
  initial?: SerializedInitial;
};

export function isRatchetEnvelope(value: unknown): value is RatchetEnvelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<RatchetEnvelope>;
  return e.alg === RATCHET_ENVELOPE_ALG && typeof e.from === 'string' && isRatchetMessage(e.message);
}

/**
 * Associated data binding a ciphertext to this conversation.
 *
 * Built from the two uids and the chat id rather than the identity keys,
 * because both sides must derive it identically with nothing but what they
 * already have — the receiver has not necessarily fetched the sender's
 * identity key, and requiring it would add a network round trip to every
 * decrypt. Nothing is lost: the X3DH shared secret already incorporates both
 * identity keys, so the session is bound to them regardless. What this adds is
 * that a ciphertext cannot be moved to a different conversation and still
 * authenticate.
 */
function conversationAd(uidA: string, uidB: string, chatId: string): Uint8Array {
  const [first, second] = [uidA, uidB].sort();
  return utf8ToBytes(`${X3DH_ALG}|${first}|${second}|${chatId}`);
}

function encodeInitial(initial: InitialMessageKeys): SerializedInitial {
  return {
    identityKey: bytesToBase64(initial.identityKey),
    ephemeralKey: bytesToBase64(initial.ephemeralKey),
    signedPreKeyId: initial.signedPreKeyId,
    ...(initial.oneTimePreKeyId ? {oneTimePreKeyId: initial.oneTimePreKeyId} : null),
  };
}

function decodeInitial(initial: SerializedInitial): InitialMessageKeys {
  return {
    identityKey: base64ToBytes(initial.identityKey),
    ephemeralKey: base64ToBytes(initial.ephemeralKey),
    signedPreKeyId: initial.signedPreKeyId,
    ...(initial.oneTimePreKeyId ? {oneTimePreKeyId: initial.oneTimePreKeyId} : null),
  };
}

export type SealOutcome =
  | {
      protection: 'ratchet';
      envelope: RatchetEnvelope;
      /**
       * Set only when this send established a new session, because that is the
       * only moment the peer's identity is consulted. 'changed' means their
       * ratchet identity is not the one this device trusted before — a
       * reinstall, or a substitution. Undefined on sends that reused an
       * existing session, which touch no identity at all.
       */
      identityStatus?: PeerRatchetStatus;
    }
  /** The peer has not published a bundle — an older client. */
  | {protection: 'unavailable'};

/**
 * Seals `text` for a 1:1 conversation.
 *
 * Returns `{protection: 'unavailable'}` only when the peer genuinely has no
 * ratchet identity, which the caller answers by using the existing static-DH
 * path. A lookup that *failed* throws instead — see the module comment.
 */
export async function sealText(
  myUid: string,
  chatId: string,
  peerUid: string,
  text: string,
): Promise<SealOutcome> {
  const ad = conversationAd(myUid, peerUid, chatId);

  return withSession<SealOutcome>(myUid, chatId, peerUid, async session => {
    if (session) {
      const sent = ratchetEncrypt(session, text, ad);
      return {
        session: sent.session,
        result: {
          protection: 'ratchet',
          envelope: {alg: RATCHET_ENVELOPE_ALG, from: myUid, message: sent.message},
        },
      };
    }

    // No session yet: establish one against the peer's published bundle.
    const fetched = await fetchPeerPreKeyBundle(myUid, peerUid);
    if (!fetched) return {session: null, result: {protection: 'unavailable'}};
    const {bundle, identityStatus} = fetched;

    const identity = await getOrCreateRatchetIdentity(myUid);
    const {sharedSecret, initial} = initiateX3DH(identity, bundle);
    const fresh = initSessionAsInitiator(sharedSecret, bundle.signedPreKey);
    const sent = ratchetEncrypt(fresh, text, ad);

    return {
      session: sent.session,
      result: {
        protection: 'ratchet',
        identityStatus,
        envelope: {
          alg: RATCHET_ENVELOPE_ALG,
          from: myUid,
          message: sent.message,
          initial: encodeInitial(initial),
        },
      },
    };
  });
}

export type OpenOutcome =
  | {status: 'ok'; text: string; sessionReset: boolean}
  /** Sealed for a session this device cannot reconstruct. */
  | {status: 'undecryptable'};

/**
 * Opens a ratchet envelope, establishing the session if this is the first
 * message of one.
 *
 * `sessionReset` is true when an existing session was replaced because the
 * sender started a new one — which in practice means they reinstalled or
 * switched devices. It is surfaced rather than handled silently for the same
 * reason the existing key-change banner exists: from here, a peer legitimately
 * reinstalling and an attacker substituting themselves look identical, and
 * only the user can tell them apart.
 */
export async function openEnvelope(
  envelope: RatchetEnvelope,
  myUid: string,
  chatId: string,
): Promise<OpenOutcome> {
  const peerUid = envelope.from;
  const ad = conversationAd(myUid, peerUid, chatId);

  const outcome = await withSession<OpenOutcome & {burn?: string}>(
    myUid,
    chatId,
    peerUid,
    async session => {
      if (session) {
        try {
          const got = ratchetDecrypt(session, envelope.message, ad);
          return {
            session: got.session,
            result: {status: 'ok', text: got.plaintext, sessionReset: false},
          };
        } catch (error) {
          // Falls through to the establish path below, which only proceeds for
          // an `initial`-bearing message. Anything else is a plain decrypt
          // failure and ends as undecryptable with the session untouched —
          // discarding state the conversation still depends on, because one
          // message was corrupt, would turn a single bad packet into a broken
          // conversation.
          reportError(error, 'ratchet_decrypt_failed');
        }
      }

      // Establishing requires the X3DH half; without it there is nothing to
      // build a session from.
      if (!envelope.initial) return {session: null, result: {status: 'undecryptable'}};

      const secrets = await preKeySecretsForResponding(myUid, envelope.initial.signedPreKeyId);
      if (!secrets) {
        // The signed prekey it names is more than one rotation old, or this
        // device never held it. Reported rather than guessed at: substituting
        // the current key would derive a different secret and fail later in a
        // far more confusing way.
        reportError(
          new Error('no matching signed prekey'),
          'ratchet_respond_missing_prekey',
        );
        return {session: null, result: {status: 'undecryptable'}};
      }

      try {
        const identity = await getOrCreateRatchetIdentity(myUid);
        const initial = decodeInitial(envelope.initial);
        const shared = respondX3DH(identity, secrets, initial);
        const fresh = initSessionAsResponder(shared, secrets.signedPreKey);
        const got = ratchetDecrypt(fresh, envelope.message, ad);
        return {
          session: got.session,
          result: {
            status: 'ok',
            text: got.plaintext,
            sessionReset: session !== null,
            burn: envelope.initial.oneTimePreKeyId,
          },
        };
      } catch (error) {
        reportError(error, 'ratchet_establish_failed');
        return {session: null, result: {status: 'undecryptable'}};
      }
    },
  );

  // Burned only after the session is durably stored. Doing it inside the
  // transaction would mean a crash in between left the prekey consumed and the
  // session unsaved, making that first message undecryptable forever.
  if (outcome.status === 'ok' && outcome.burn) {
    await burnOneTimePreKey(myUid, outcome.burn).catch(() => undefined);
  }

  return outcome.status === 'ok'
    ? {status: 'ok', text: outcome.text, sessionReset: outcome.sessionReset}
    : {status: 'undecryptable'};
}
