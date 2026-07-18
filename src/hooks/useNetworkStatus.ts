import {useEffect, useMemo, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const update = (state: any) => {
      const connected = state.isConnected ?? true;
      const reachable = state.isInternetReachable ?? connected;
      setIsOnline(Boolean(connected && reachable));
    };
    const unsubscribe = NetInfo.addEventListener(update);
    NetInfo.fetch().then(update);
    return () => unsubscribe();
  }, []);

  return useMemo(() => ({isOnline, isOffline: !isOnline}), [isOnline]);
}

