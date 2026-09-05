import {useEffect, useState} from 'react';
import {openIntroductions} from '../services/introductions';
import type {ChatRoom} from '../types';

/**
 * The names the other side of each direct chat sealed to this account, keyed
 * by chat id.
 *
 * Companion to useChatUserCache, and needed for the same reason it is no
 * longer enough on its own: `users/{uid}` stopped carrying a display name, so
 * a peer's name now arrives encrypted on the chat document and has to be
 * opened here. See services/introductions.ts.
 *
 * Keyed on the chats' identity rather than their contents so a message
 * arriving does not re-run the decryption; an introduction is written once, at
 * the moment an invite is accepted.
 */
export function useChatIntroductions(chats: ChatRoom[], myUid: string): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = chats.map(c => c.id).join('|');

  useEffect(() => {
    if (!myUid || chats.length === 0) return;
    let active = true;
    openIntroductions(chats, myUid).then(found => {
      // Merged rather than replaced: a chat that briefly drops out of the list
      // should not take a name that is still correct with it.
      if (active) setNames(prev => ({...prev, ...found}));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, myUid]);

  return names;
}
