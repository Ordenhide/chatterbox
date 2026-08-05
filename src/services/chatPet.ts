import {doc, getDoc, getFirestore, setDoc, onSnapshot} from '@react-native-firebase/firestore';
import {ChatPet} from '../types';
import {guardDocSnapshot} from './snapshotGuard';

const db = getFirestore();

export async function getChatPet(chatId: string): Promise<ChatPet | null> {
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.data()?.pet ?? null;
}

export async function createChatPet(
  chatId: string,
  species: ChatPet['species'],
  name: string,
): Promise<void> {
  const pet: ChatPet = {
    species,
    name,
    level: 1,
    xp: 0,
    health: 100,
    lastFed: Date.now(),
    createdAt: Date.now(),
    mood: 'happy',
  };
  await setDoc(doc(db, 'chats', chatId), {pet}, {merge: true});
}

export async function feedPet(chatId: string): Promise<void> {
  const pet = await getChatPet(chatId);
  if (!pet) return;

  let xp = pet.xp + 10;
  let level = pet.level;

  if (xp >= level * 100) {
    xp = 0;
    level += 1;
  }

  const health = Math.min(pet.health + 10, 100);
  const updated: ChatPet = {...pet, xp, level, health, lastFed: Date.now()};
  updated.mood = calculatePetMood(updated);

  await setDoc(doc(db, 'chats', chatId), {pet: updated}, {merge: true});
}

export function listenChatPet(
  chatId: string,
  callback: (pet: ChatPet | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'chats', chatId),
    guardDocSnapshot('listen_chat_pet', snap => {
      callback(snap.data()?.pet ?? null);
    }),
  );
}

export function calculatePetMood(pet: ChatPet): ChatPet['mood'] {
  if (pet.health >= 80) return 'happy';
  if (pet.health >= 50) return 'neutral';
  if (pet.health >= 20) return 'sad';
  return 'sleeping';
}

export function decayHealth(pet: ChatPet): number {
  const daysSinceLastFed = (Date.now() - pet.lastFed) / (1000 * 60 * 60 * 24);
  return Math.max(pet.health - Math.floor(daysSinceLastFed) * 5, 0);
}
