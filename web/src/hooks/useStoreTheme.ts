import {useEffect, useState} from 'react';
import {listenStoreTheme} from '../services/storeTheme';
import type {StoreTheme} from '../services/themeCatalog';

/**
 * The account-wide theme chosen in the Store, or undefined if none.
 *
 * Applying a theme overwrites every chat that exists at that moment, so this
 * is only load-bearing for chats created *afterwards* — including ones the
 * other person starts, which no client-side write of ours could have reached.
 */
export function useStoreTheme(uid: string): StoreTheme | undefined {
  const [theme, setTheme] = useState<StoreTheme | undefined>(undefined);
  useEffect(() => listenStoreTheme(uid, setTheme), [uid]);
  return theme;
}
