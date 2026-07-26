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

// STUN gets calls working on the same network / friendly NATs. For reliable
// connectivity across strict/symmetric NATs, configure a TURN server via env
// (VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL); it's appended to
// the ICE server list when present. Matches the mobile app's STUN defaults.
const TURN_URL = import.meta.env.VITE_TURN_URL;

export const ICE_SERVERS: RTCIceServer[] = [
  {urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']},
  ...(TURN_URL
    ? [
        {
          urls: TURN_URL.split(',').map(u => u.trim()),
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        } as RTCIceServer,
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
