import {doc, getDoc, getFirestore, setDoc, onSnapshot} from './firebase/firestore';
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
): Promise<ChatPet> {
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
  return pet;
}

/**
 * Swaps a chat's pet to a different species, in place.
 *
 * Deliberately writes only `pet.species` and `pet.name` — via Firestore's
 * nested-merge, not a read-modify-write of the whole pet — rather than
 * routing through feedPet's read-then-write-the-whole-object pattern. Two
 * reasons: level/xp/health/lastFed are meant to survive a species change (this
 * is a reskin, not starting over), and a targeted merge can't clobber a
 * concurrent feedPet the way two competing read-modify-writes on the same
 * document could.
 */
export async function changePetSpecies(
  chatId: string,
  species: ChatPet['species'],
  name: string,
): Promise<void> {
  await setDoc(doc(db, 'chats', chatId), {pet: {species, name}}, {merge: true});
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

/**
 * Whether `next` is the result of `prev` having just been fed — the signal
 * PetAvatar's celebration animation fires on.
 *
 * Keyed on `lastFed` rather than `xp` or `health`: those two are also read
 * back already decayed/leveled by the time this runs, and health in
 * particular is clamped at 100, so a pet fed while already full would show no
 * change and silently swallow its own celebration. `lastFed` is written by
 * feedPet on every call and nowhere else, so a change in it is exactly and
 * only "this chat just fed its pet."
 *
 * `chatId` isn't compared here — the caller only ever passes readings from
 * one chat's listener, so a change of `prev`/`next` already implies a change
 * over time within that same pet, not a switch between two different pets.
 */
export function didPetJustEat(prev: ChatPet | null, next: ChatPet | null): boolean {
  if (!prev || !next) return false;
  return next.lastFed > prev.lastFed;
}
