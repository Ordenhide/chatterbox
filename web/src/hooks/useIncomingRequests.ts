import {useEffect, useState} from 'react';
import {listenIncomingRequests} from '../services/friends';
import type {FriendRequest} from '../types';

/**
 * Live list of pending friend requests addressed to the user. Mounted app-wide
 * (MainApp) so the count/badge is always current, not just when the Friends
 * modal is open.
 */
export function useIncomingRequests(uid: string): FriendRequest[] {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  useEffect(() => {
    if (!uid) return;
    return listenIncomingRequests(uid, setRequests);
  }, [uid]);
  return requests;
}
