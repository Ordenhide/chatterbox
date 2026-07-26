import {
  doc,
  collection,
  getDocs,
  getDoc,
  getFirestore,
  setDoc,
  deleteDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import {mmkvStorage} from './storageMMKV';

const db = getFirestore();

export async function setChatExpiryPolicy(
  chatId: string,
  hours: number,
): Promise<void> {
  await setDoc(doc(db, 'chats', chatId), {messageExpiry: hours}, {merge: true});
}

export async function removeChatExpiryPolicy(
  chatId: string,
): Promise<void> {
  await setDoc(doc(db, 'chats', chatId), {messageExpiry: 0}, {merge: true});
}

export function getExpiryOptions(): Array<{label: string; hours: number}> {
  return [
    {label: 'Off', hours: 0},
    {label: '1 Hour', hours: 1},
    {label: '24 Hours', hours: 24},
    {label: '7 Days', hours: 168},
    {label: '30 Days', hours: 720},
  ];
}

const DMS_KEY = 'dead_man_switch';

export async function getDeadManSwitch(): Promise<{
  enabled: boolean;
  days: number;
  lastCheckIn: number;
}> {
  const raw = await mmkvStorage.getItem(DMS_KEY);
  return raw
    ? JSON.parse(raw)
    : {enabled: false, days: 90, lastCheckIn: Date.now()};
}

export async function setDeadManSwitch(
  enabled: boolean,
  days: number,
): Promise<void> {
  await mmkvStorage.setItem(
    DMS_KEY,
    JSON.stringify({enabled, days, lastCheckIn: Date.now()}),
  );
}

export async function checkInDeadMan(): Promise<void> {
  const current = await getDeadManSwitch();
  current.lastCheckIn = Date.now();
  await mmkvStorage.setItem(DMS_KEY, JSON.stringify(current));
}

export async function isDeadManTriggered(): Promise<boolean> {
  const {enabled, days, lastCheckIn} = await getDeadManSwitch();
  return enabled && Date.now() - lastCheckIn > days * 86400000;
}

export async function requestRemoteWipe(userId: string): Promise<void> {
  await setDoc(doc(db, 'users', userId), {remoteWipe: true}, {merge: true});
}

export async function checkRemoteWipe(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.data()?.remoteWipe ?? false;
}

export async function clearRemoteWipeFlag(userId: string): Promise<void> {
  await setDoc(doc(db, 'users', userId), {remoteWipe: false}, {merge: true});
}

export async function setTrustedContacts(
  userId: string,
  contacts: Array<{uid: string; displayName?: string}>,
): Promise<void> {
  const withTimestamps = contacts.map(c => ({...c, addedAt: Date.now()}));
  await setDoc(
    doc(db, 'users', userId),
    {trustedContacts: withTimestamps},
    {merge: true},
  );
}

export async function getTrustedContacts(
  userId: string,
): Promise<Array<{uid: string; displayName?: string; addedAt: number}>> {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.data()?.trustedContacts ?? [];
}

export async function performLocalWipe(): Promise<void> {
  const {mmkvStorage} = require('./storageMMKV');
  const {clearUserCache} = require('./firebaseChat');
  try {
    await mmkvStorage.clear();
  } catch {}
  try {
    clearUserCache();
  } catch {}
}

export function generateSafetyNumber(
  myUid: string,
  otherUid: string,
): string {
  const combined = [myUid, otherUid].sort().join('');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash += combined.charCodeAt(i);
  }
  const hex = hash.toString(16).padStart(16, '0').slice(0, 16);
  return hex.match(/.{4}/g)!.join(' ');
}
