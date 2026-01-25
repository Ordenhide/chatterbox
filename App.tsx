import React, {useEffect, useRef} from 'react';
import {Alert, PermissionsAndroid, Platform, StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
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
import {listenChatsForUser, listenLatestCall, setUserFcmToken, updateCall} from './src/services/firebaseChat';
import {logBreadcrumb, trackEvent, trackScreen} from './src/services/telemetry';
import {initFeatureFlags} from './src/services/featureFlags';
import LiquidGlassBackground from './src/components/LiquidGlassBackground';
import {getColors} from './src/theme/colors';

const APP_START_TS = Date.now();

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

function AppContent() {
  const {user, loading} = useAuth();
  const callListenersRef = useRef<Map<string, () => void>>(new Map());
  const handledCallIdsRef = useRef<Set<string>>(new Set());
  const routeNameRef = useRef<string | undefined>(undefined);
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  useEffect(() => {
    if (!user) return;

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
          Alert.alert('Incoming call', call.type === 'video' ? 'Video call' : 'Voice call', [
            {
              text: 'Decline',
              style: 'destructive',
              onPress: () => updateCall(chat.id, call.id, {status: 'ended'}),
            },
            {
              text: 'Accept',
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
          ]);
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
  }, [user]);

  useEffect(() => {
    if (!user || Platform.OS !== 'android') return;
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
        const title = remoteMessage.notification?.title || 'New message';
        const body =
          remoteMessage.notification?.body ||
          remoteMessage.data?.text ||
          'You have a new message.';
        Alert.alert(title, body);
      });
    };

    setupMessaging().catch(error => {
      console.warn('FCM setup failed:', error);
    });

    return () => {
      active = false;
      if (unsubscribeToken) unsubscribeToken();
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, [user]);

  if (loading) {
    return null; // You can add a loading screen here
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
      console.log('[firebase] default app initialized:', app.name);
    } catch (error) {
      console.error('[firebase] default app not initialized:', error);
    }
    initFeatureFlags().catch(() => undefined);
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

