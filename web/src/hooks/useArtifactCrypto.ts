import {useEffect, useState} from 'react';
import {
  INERT_ARTIFACT_CRYPTO,
  makeArtifactCrypto,
  type ArtifactCrypto,
} from '../services/e2eeArtifacts';

/**
 * The sealer for a chat's shared artifacts (lists, playlists, countdowns).
 *
 * Starts inert and upgrades once the keys resolve, so a modal never blocks on
 * crypto: worst case an early write goes out in plaintext exactly as it did
 * before this existed, rather than being lost.
 */
export function useArtifactCrypto(
  myUid: string,
  peerUid: string | undefined,
  chatId: string,
): ArtifactCrypto {
  const [crypto, setCrypto] = useState<ArtifactCrypto>(INERT_ARTIFACT_CRYPTO);

  useEffect(() => {
    let active = true;
    setCrypto(INERT_ARTIFACT_CRYPTO); // reset when switching chats
    makeArtifactCrypto(myUid, peerUid, chatId)
      .then(next => {
        if (active) setCrypto(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [myUid, peerUid, chatId]);

  return crypto;
}
