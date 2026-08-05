import {useEffect, useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {getChat} from '../services/firebaseChat';
import {
  INERT_ARTIFACT_CRYPTO,
  makeArtifactCrypto,
  type ArtifactCrypto,
} from '../services/e2eeArtifacts';

/**
 * The sealer for a chat's shared artifacts (lists, playlists, countdowns).
 *
 * Resolves the peer from the chat document rather than taking it as a prop:
 * these screens are reached by navigation with only a chatId in the route, and
 * threading a peer id through every call site would be easy to get wrong in
 * exactly the places where getting it wrong means writing plaintext.
 *
 * Starts inert and upgrades once the keys resolve, so a screen never blocks on
 * crypto — worst case an early write goes out in plaintext exactly as it did
 * before this existed, rather than being lost.
 */
export function useArtifactCrypto(chatId: string | undefined): ArtifactCrypto {
  const {user} = useAuth();
  const [crypto, setCrypto] = useState<ArtifactCrypto>(INERT_ARTIFACT_CRYPTO);

  useEffect(() => {
    let active = true;
    setCrypto(INERT_ARTIFACT_CRYPTO); // reset when switching chats
    if (!chatId || !user?.uid) return;

    (async () => {
      try {
        const chat = await getChat(chatId);
        const peerUid = chat?.participants?.find((id: string) => id !== user.uid);
        const next = await makeArtifactCrypto(user.uid, peerUid, chatId);
        if (active) setCrypto(next);
      } catch {
        // Stay inert: reads fall back to plaintext, writes stay plaintext.
      }
    })();

    return () => {
      active = false;
    };
  }, [chatId, user?.uid]);

  return crypto;
}
