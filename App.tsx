import React, {useEffect, useRef, useState} from 'react';
import {Alert, AppState, PermissionsAndroid, Platform, StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/contexts/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import {useAuth} from './src/contexts/AuthContext';
import {getApp, getApps, initializeApp} from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import {firebaseConfig} from './src/firebaseConfig';
import {listenLatestCall, listenChatsForUser, setUserFcmToken, updateCall} from './src/services/firebaseChat';
import {logBreadcrumb, trackEvent, trackScreen} from './src/services/telemetry';
import {initFeatureFlags} from './src/services/featureFlags';
import LiquidGlassBackground from './src/components/LiquidGlassBackground';
import i18n from './src/i18n';
import {flushReadReceipts} from './src/services/readReceipts';
import {clearOldImageCache} from './src/services/imageCache';
import {isAppLockEnabled} from './src/services/appLock';
import {checkRemoteWipe, clearRemoteWipeFlag, checkInDeadMan, isDeadManTriggered} from './src/services/messageExpiry';
import AppLockScreen from './src/screens/AppLockScreen';

const APP_START_TS = Date.now();

const navigationRef = createNavigationContainerRef();

function AppContent() {
  const {user, loading, signOut} = useAuth();
  const callListenersRef = useRef<Map<string, () => void>>(new Map());
  const handledCallIdsRef = useRef<Set<string>>(new Set());
  const routeNameRef = useRef<string | undefined>(undefined);
  const scheme = useColorScheme();
  const [appLocked, setAppLocked] = useState(() => isAppLockEnabled());

  useEffect(() => {
    if (!user?.uid) return;
    checkInDeadMan();
    let active = true;
    (async () => {
      try {
        const wipe = await checkRemoteWipe(user.uid);
        if (wipe && active) {
          const {performLocalWipe} = require('./src/services/messageExpiry');
          await performLocalWipe();
          await clearRemoteWipeFlag(user.uid);
          Alert.alert('Remote Wipe', 'A remote wipe was triggered. All local data has been cleared.', [
            {text: 'OK', onPress: () => signOut()},
          ]);
        }
      } catch { /* ignore */ }
      try {
        const triggered = await isDeadManTriggered();
        if (triggered && active) {
          const {performLocalWipe} = require('./src/services/messageExpiry');
          await performLocalWipe();
          Alert.alert('Account Inactive', 'Your dead man\'s switch has been triggered. Local data has been cleared.', [
            {text: 'I\'m here!', onPress: () => checkInDeadMan()},
          ]);
        }
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [user?.uid]);

  useEffect(() => {
    let backgroundTimestamp = 0;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        backgroundTimestamp = Date.now();
      } else if (state === 'active' && isAppLockEnabled()) {
        const {getAutoLockDelay} = require('./src/services/privacyGuard');
        const delay = getAutoLockDelay() * 1000;
        if (delay === 0 || Date.now() - backgroundTimestamp >= delay) {
          setAppLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user || loading) return;

    const cleanupCallListeners = (keepIds: Set<string>) => {
      callListenersRef.current.forEach((unsub, chatId) => {
        if (!keepIds.has(chatId)) {
          unsub();
          callListenersRef.current.delete(chatId);
        }
      });
    };

    const unsubscribeChats = listenChatsForUser(user.uid, chats => {
      const currentChatIds = new Set(chats.map(chat => chat.id));
      cleanupCallListeners(currentChatIds);

      chats.forEach(chat => {
        if (callListenersRef.current.has(chat.id)) return;
        const unsubscribeCall = listenLatestCall(chat.id, call => {
          if (!call) return;
          if (call.status !== 'ringing') return;
          if (call.createdBy === user.uid) return;
          if (handledCallIdsRef.current.has(call.id)) return;
          const createdAt = (call.createdAt as any)?.toDate
            ? (call.createdAt as any).toDate().getTime()
            : new Date(call.createdAt as any).getTime();
          if (Number.isFinite(createdAt) && Date.now() - createdAt > 60000) {
            updateCall(chat.id, call.id, {status: 'ended'});
            return;
          }
          handledCallIdsRef.current.add(call.id);
          Alert.alert(
            i18n.t('calls.incomingTitle'),
            call.type === 'video' ? i18n.t('calls.video') : i18n.t('calls.voice'),
            [
              {
                text: i18n.t('common.decline'),
                style: 'destructive',
                onPress: () => updateCall(chat.id, call.id, {status: 'ended'}),
              },
              {
                text: i18n.t('common.accept'),
                onPress: () => {
                  if (navigationRef.isReady()) {
                    navigationRef.navigate('Call' as never, {
                      chatId: chat.id,
                      callId: call.id,
                      isCaller: false,
                      type: call.type,
                    } as never);
                  }
                },
              },
            ],
          );
        });
        callListenersRef.current.set(chat.id, unsubscribeCall);
      });
    });

    return () => {
      unsubscribeChats();
      callListenersRef.current.forEach(unsub => unsub());
      callListenersRef.current.clear();
      handledCallIdsRef.current.clear();
    };
  }, [user, loading]);

  useEffect(() => {
    if (!user || loading || Platform.OS !== 'android') return;
    let active = true;
    let unsubscribeToken: (() => void) | null = null;
    let unsubscribeOnMessage: (() => void) | null = null;

    const setupMessaging = async () => {
      const messaging = getMessaging();
      if (Platform.Version >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      const token = await getToken(messaging);
      if (active) {
        await setUserFcmToken(user.uid, token);
      }
      unsubscribeToken = onTokenRefresh(messaging, nextToken => {
        setUserFcmToken(user.uid, nextToken);
      });
      unsubscribeOnMessage = onMessage(messaging, async remoteMessage => {
        const {isNotificationContentHidden} = require('./src/services/privacyGuard');
        if (isNotificationContentHidden()) {
          Alert.alert(i18n.t('notifications.newMessageTitle'), i18n.t('notifications.newMessageBody'));
          return;
        }
        const title = remoteMessage.notification?.title || i18n.t('notifications.newMessageTitle');
        const body =
          remoteMessage.notification?.body ||
          remoteMessage.data?.text ||
          i18n.t('notifications.newMessageBody');
        Alert.alert(title, body);
      });
    };

    setupMessaging().catch(error => {
      if (__DEV__) {
        console.warn('FCM setup failed:', error);
      }
    });

    return () => {
      active = false;
      if (unsubscribeToken) unsubscribeToken();
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, [user, loading]);

  if (loading) {
    return null;
  }

  if (appLocked && user) {
    return (
      <View style={styles.appRoot}>
        <LiquidGlassBackground />
        <AppLockScreen onUnlock={() => setAppLocked(false)} />
      </View>
    );
  }

  return (
    <View style={styles.appRoot}>
      <LiquidGlassBackground />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          const currentRoute = navigationRef.getCurrentRoute();
          routeNameRef.current = currentRoute?.name;
          const startupMs = Date.now() - APP_START_TS;
          trackEvent('app_startup_time', {ms: startupMs});
          logBreadcrumb(`app_startup_time:${startupMs}`);
          if (currentRoute?.name) {
            trackScreen(currentRoute.name);
          }
        }}
        onStateChange={() => {
          const currentRoute = navigationRef.getCurrentRoute();
          const currentName = currentRoute?.name;
          if (currentName && routeNameRef.current !== currentName) {
            routeNameRef.current = currentName;
            trackScreen(currentName);
          }
        }}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        {user ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </View>
  );
}

function App(): React.JSX.Element {
  useEffect(() => {
    try {
      if (getApps().length === 0) {
        initializeApp(firebaseConfig);
      }
      const app = getApp();
      if (__DEV__) {
        console.log('[firebase] default app initialized:', app.name);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[firebase] default app not initialized:', error);
      }
    }
    initFeatureFlags().catch(() => undefined);
    
    // Cleanup old image cache on startup
    clearOldImageCache().catch(() => undefined);
    
    // Handle app state changes for read receipt flushing
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Flush read receipts when app goes to background
        flushReadReceipts().catch(() => undefined);
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
});

