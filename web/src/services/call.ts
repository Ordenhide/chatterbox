import {getApp} from 'firebase/app';
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
import {getFunctions, httpsCallable} from 'firebase/functions';
import {db} from '../firebase';
import {deleteQueryInChunks} from './firestoreBatch';

// STUN only gets calls working on the same network or behind friendly NATs.
// Between two symmetric NATs neither peer is directly reachable and the call
// fails with no obvious cause, so TURN is what makes calling work off a shared
// network rather than an optimisation.
//
// The TURN entry comes from the getTurnCredentials Cloud Function rather than
// a build-time env var: Cloudflare Realtime (the provider, see CALLING.md)
// doesn't issue a static username/password to bake into a build at all — it
// mints a short-lived, per-connection credential on request. The mobile
// client calls the same function (src/config/rtc.ts).
const functions = getFunctions(getApp());

const STUN_SERVERS: RTCIceServer[] = [
  {urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']},
];

/**
 * Never rejects. A call that falls back to STUN may fail to connect across
 * NATs, but one that throws here fails to start at all — the same contract
 * as the mobile client's describeIceServers().
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const fn = httpsCallable<void, {iceServers: RTCIceServer[]}>(functions, 'getTurnCredentials');
    const res = await fn();
    const servers = res.data.iceServers;
    return Array.isArray(servers) && servers.length > 0 ? servers : STUN_SERVERS;
  } catch {
    // Covers both an unconfigured server (failed-precondition) and a real
    // failure (network, auth) — either way, STUN-only is the same safe
    // fallback the app shipped with before TURN existed.
    return STUN_SERVERS;
  }
}

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
