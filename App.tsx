import React, {useEffect, useRef, useState} from 'react';
import {Alert, AppState, DeviceEventEmitter, PermissionsAndroid, Platform, StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/contexts/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import {useAuth} from './src/contexts/AuthContext';
import {getApp, getApps, initializeApp} from '@react-native-firebase/app';
import appCheckModule, {initializeAppCheck} from '@react-native-firebase/app-check';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import {firebaseConfig} from './src/firebaseConfig';
import {setUserFcmToken} from './src/services/firebaseChat';
import {logBreadcrumb, trackEvent, trackScreen} from './src/services/telemetry';
import {initFeatureFlags} from './src/services/featureFlags';
import LiquidGlassBackground from './src/components/LiquidGlassBackground';
import i18n from './src/i18n';
import {flushReadReceipts} from './src/services/readReceipts';
import {clearOldImageCache} from './src/services/imageCache';
import ErrorBoundary from './src/components/ErrorBoundary';
import TutorialTour from './src/components/TutorialTour';
import IncomingCallManager from './src/components/IncomingCallManager';
import {hasSeenTutorial, markTutorialSeen, TUTORIAL_EVENT} from './src/services/tutorial';

const APP_START_TS = Date.now();

const navigationRef = createNavigationContainerRef();

function AppContent() {
  const {user, loading} = useAuth();
  const routeNameRef = useRef<string | undefined>(undefined);
  const scheme = useColorScheme();
  const [tutorialVisible, setTutorialVisible] = useState(false);

  // Guided tour: auto-runs once after first sign-in, and re-runs on demand
  // (Profile → "Replay tutorial", which fires TUTORIAL_EVENT).
  useEffect(() => {
    if (user && !hasSeenTutorial()) setTutorialVisible(true);
    const sub = DeviceEventEmitter.addListener(TUTORIAL_EVENT, () => setTutorialVisible(true));
    return () => sub.remove();
  }, [user]);


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
      {user && (
        <IncomingCallManager
          isBusy={() => navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'Call'}
          onAccept={(call, {camOn}) => {
            if (!navigationRef.isReady()) return;
            // The navigator has no ParamList, so navigate() resolves to `never`
            // for both arguments; cast the function rather than each argument.
            (navigationRef.navigate as (screen: string, params: object) => void)('Call', {
              chatId: call.chatId,
              callId: call.id,
              isCaller: false,
              type: call.type,
              camOn,
            });
          }}
        />
      )}
      {user && (
        <TutorialTour
          visible={tutorialVisible}
          onClose={() => {
            markTutorialSeen();
            setTutorialVisible(false);
          }}
        />
      )}
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

      // App Check: attests that requests to Firestore/Storage/Functions come from
      // this real, unmodified app build, blocking scripted abuse of the backend.
      // In debug builds this uses the Debug provider, which logs a token on first
      // run — register that token once in Firebase Console > App Check > Manage
      // debug tokens. Release builds use Play Integrity (Android) / App Attest (iOS),
      // which require enabling App Check for this app in the Firebase Console first.
      const appCheckProvider = appCheckModule(app).newReactNativeFirebaseAppCheckProvider();
      appCheckProvider.configure({
        android: {provider: __DEV__ ? 'debug' : 'playIntegrity'},
        apple: {provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback'},
      });
      initializeAppCheck(app, {provider: appCheckProvider, isTokenAutoRefreshEnabled: true});
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
    <ErrorBoundary>
      <GestureHandlerRootView style={{flex: 1}}>
        <SafeAreaProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default App;

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
});

