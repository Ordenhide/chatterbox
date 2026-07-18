import {mmkvStorage} from './storageMMKV';
import {VaultItem} from '../types';

const VAULT_KEY = 'secure_vault';

export async function getVaultItems(): Promise<VaultItem[]> {
  const raw = await mmkvStorage.getItem(VAULT_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addVaultItem(
  item: Omit<VaultItem, 'id' | 'createdAt'>,
): Promise<VaultItem> {
  const newItem: VaultItem = {
    ...item,
    id: `vault_${Date.now()}`,
    createdAt: Date.now(),
  };
  const items = await getVaultItems();
  items.unshift(newItem);
  await mmkvStorage.setItem(VAULT_KEY, JSON.stringify(items));
  return newItem;
}

export async function removeVaultItem(itemId: string): Promise<void> {
  const items = await getVaultItems();
  await mmkvStorage.setItem(
    VAULT_KEY,
    JSON.stringify(items.filter(i => i.id !== itemId)),
  );
}

export async function updateVaultNote(
  itemId: string,
  note: string,
): Promise<void> {
  const items = await getVaultItems();
  const item = items.find(i => i.id === itemId);
  if (item) {
    item.note = note;
    await mmkvStorage.setItem(VAULT_KEY, JSON.stringify(items));
  }
}

export async function clearVault(): Promise<void> {
  await mmkvStorage.removeItem(VAULT_KEY);
}

export async function getVaultItemCount(): Promise<number> {
  const items = await getVaultItems();
  return items.length;
}
