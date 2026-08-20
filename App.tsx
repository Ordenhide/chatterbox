import React, {useEffect, useRef, useState} from 'react';
import {Alert, AppState, DeviceEventEmitter, PermissionsAndroid, Platform, StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/contexts/AuthContext';
import {ScrollMotionProvider} from './src/contexts/ScrollMotionContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import {useAuth} from './src/contexts/AuthContext';
import {initFirebase} from './src/services/firebase/bootstrap';
import {getMessaging, getToken, onMessage, onTokenRefresh} from './src/services/firebase/push';
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
      // Platform.Version is number | string in RN's types (string on iOS),
      // but the enclosing effect already returned early unless Platform.OS
      // === 'android', where it's always the numeric API level.
      if ((Platform.Version as number) >= 33) {
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
        const dataText =
          typeof remoteMessage.data?.text === 'string' ? remoteMessage.data.text : undefined;
        const body =
          remoteMessage.notification?.body ||
          dataText ||
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
      // App init + App Check, behind the platform seam. On HarmonyOS the
      // Firebase JS SDK is initialised instead and App Check is absent — it
      // needs Play Integrity / App Attest, which that platform has no
      // counterpart for. See src/services/firebase/bootstrap.harmony.ts.
      const appName = initFirebase();
      if (__DEV__) {
        console.log('[firebase] default app initialized:', appName);
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
    <ErrorBoundary>
      <GestureHandlerRootView style={{flex: 1}}>
        <SafeAreaProvider>
          <AuthProvider>
            {/* Above AppContent so the backdrop and the screens that scroll it
                share one value — see contexts/ScrollMotionContext. */}
            <ScrollMotionProvider>
              <AppContent />
            </ScrollMotionProvider>
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

