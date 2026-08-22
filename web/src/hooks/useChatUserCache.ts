import {useEffect, useState} from 'react';
import {getUserById} from '../services/chat';
import type {ChatRoom, UserProfile} from '../types';

/**
 * Resolves display profiles for every chat's other participants, incrementally.
 *
 * Extracted from HomeScreen (its original home) so QuickSwitcher can resolve
 * the same titles without a second, divergent copy of this fetch-and-merge
 * logic — both list the same chats and need to agree on what each is called.
 */
export function useChatUserCache(
  chats: ChatRoom[],
  myUid: string,
): Record<string, UserProfile> {
  const [userCache, setUserCache] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    const missing = new Set<string>();
    chats.forEach(c =>
      c.participants.forEach(uid => {
        if (uid !== myUid && !userCache[uid]) missing.add(uid);
      }),
    );
    if (missing.size === 0) return;
    let active = true;
    Promise.all(Array.from(missing).map(uid => getUserById(uid).then(p => [uid, p] as const))).then(
      pairs => {
        if (!active) return;
        setUserCache(prev => {
          const next = {...prev};
          for (const [uid, p] of pairs) if (p) next[uid] = p;
          return next;
        });
      },
    );
    return () => {
      active = false;
    };
  }, [chats, myUid, userCache]);

  return userCache;
}
