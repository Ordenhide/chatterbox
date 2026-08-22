import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {db} from '../firebase';
import {deleteQueryInChunks} from './firestoreBatch';

// STUN only gets calls working on the same network or behind friendly NATs.
// Between two symmetric NATs neither peer is directly reachable and the call
// fails with no obvious cause, so TURN is what makes calling work off a shared
// network rather than an optimisation. Configure it via env (VITE_TURN_URL /
// VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL).
//
// Read at build time, so rotating credentials needs a rebuild and redeploy —
// acceptable here, where that's a static-site push. The mobile client reads
// the same three values from Firebase Remote Config instead (config/rtc.ts),
// since rotating them there would otherwise mean a store release.
const TURN_URLS = (import.meta.env.VITE_TURN_URL || '')
  .split(',')
  .map((u: string) => u.trim())
  .filter(Boolean);
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

export const ICE_SERVERS: RTCIceServer[] = [
  {urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']},
  ...(TURN_URLS.length > 0
    ? [
        // Username/credential are omitted rather than passed through as
        // undefined when unset: a TURN server rejects blank credentials, and
        // an entry that always fails auth is worse than no entry, since ICE
        // spends time on it before giving up.
        TURN_USERNAME && TURN_CREDENTIAL
          ? ({urls: TURN_URLS, username: TURN_USERNAME, credential: TURN_CREDENTIAL} as RTCIceServer)
          : ({urls: TURN_URLS} as RTCIceServer),
      ]
    : []),
];

export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended';

export interface CallSession {
  id: string;
  chatId: string;
  participants: string[];
  createdBy: string;
  type: CallType;
  status: CallStatus;
  offer?: {type: string; sdp: string} | null;
  answer?: {type: string; sdp: string} | null;
  createdAt?: {toMillis?: () => number} | null;
}

const callsCol = (chatId: string) => collection(db, 'chats', chatId, 'calls');
const callDoc = (chatId: string, callId: string) => doc(db, 'chats', chatId, 'calls', callId);

export async function createCall(
  chatId: string,
  fromUid: string,
  toUid: string,
  type: CallType,
): Promise<string> {
  const ref = doc(callsCol(chatId));
  await setDoc(ref, {
    id: ref.id,
    chatId,
    participants: [fromUid, toUid],
    createdBy: fromUid,
    type,
    status: 'ringing',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCall(
  chatId: string,
  callId: string,
  updates: Partial<CallSession>,
): Promise<void> {
  await setDoc(
    callDoc(chatId, callId),
    {
      ...updates,
      updatedAt: serverTimestamp(),
      ...(updates.status === 'ended' ? {endedAt: serverTimestamp()} : {}),
    },
    {merge: true},
  );
}

export async function endCall(chatId: string, callId: string): Promise<void> {
  await updateCall(chatId, callId, {status: 'ended'});
  try {
    await deleteQueryInChunks(collection(db, 'chats', chatId, 'calls', callId, 'candidates'));
  } catch {
    /* best-effort cleanup */
  }
}

export function listenCall(chatId: string, callId: string, cb: (c: CallSession | null) => void) {
  return onSnapshot(callDoc(chatId, callId), s =>
    cb(s.exists() ? ({id: s.id, ...(s.data() as Omit<CallSession, 'id'>)}) : null),
  );
}

export function listenLatestCall(chatId: string, cb: (c: CallSession | null) => void) {
  return onSnapshot(
    query(callsCol(chatId), orderBy('createdAt', 'desc'), limit(1)),
    s => cb(s.empty ? null : ({id: s.docs[0].id, ...(s.docs[0].data() as Omit<CallSession, 'id'>)})),
    () => cb(null),
  );
}

export async function addCallCandidate(
  chatId: string,
  callId: string,
  fromUid: string,
  candidate: {candidate: string; sdpMid: string | null; sdpMLineIndex: number | null},
): Promise<void> {
  const ref = doc(collection(db, 'chats', chatId, 'calls', callId, 'candidates'));
  await setDoc(ref, {from: fromUid, candidate, createdAt: serverTimestamp()});
}

export function listenCallCandidates(
  chatId: string,
  callId: string,
  cb: (candidate: RTCIceCandidateInit, from: string) => void,
) {
  return onSnapshot(collection(db, 'chats', chatId, 'calls', callId, 'candidates'), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const data = change.doc.data();
        cb(data.candidate as RTCIceCandidateInit, data.from as string);
      }
    });
  });
}
