import React, {useEffect, useRef, useState} from 'react';
import {AppState, DeviceEventEmitter, PermissionsAndroid, Platform, StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/contexts/AuthContext';
import {ScrollMotionProvider} from './src/contexts/ScrollMotionContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import {useAuth} from './src/contexts/AuthContext';
import {initFirebase} from './src/services/firebase/bootstrap';
import {getMessaging, getToken, onTokenRefresh} from './src/services/firebase/push';
import {setUserFcmToken} from './src/services/firebaseChat';
import {logBreadcrumb, trackEvent, trackScreen} from './src/services/telemetry';
import {initFeatureFlags} from './src/services/featureFlags';
import {warmSecureStorage} from './src/services/storageMMKV';
import LiquidGlassBackground from './src/components/LiquidGlassBackground';
import ColdOpen, {coldOpenPending} from './src/components/ColdOpen';
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
  // Seeded from the module-scope flag in ColdOpen rather than `true`, so only
  // a genuine cold start waits on the sequence. A remount — signing out and
  // back in, a fast refresh — reads it as already played and skips the hold.
  const [coldOpenDone, setColdOpenDone] = useState(() => !coldOpenPending());

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
      // No foreground handler: a message that arrives while the app is open
      // already shows up live via the Firestore listener the chat screen and
      // chat list already hold open, so a popup on top of it would just be
      // announcing something already on screen. Background/killed-app
      // delivery is unaffected -- see src/services/firebase/push.ts.
    };

    setupMessaging().catch(error => {
      if (__DEV__) {
        console.warn('FCM setup failed:', error);
      }
    });

    return () => {
      active = false;
      if (unsubscribeToken) unsubscribeToken();
    };
  }, [user, loading]);

  // Still gated on `loading` — rendering the navigator before the auth check
  // resolves would mount AuthNavigator for a moment and then swap it for
  // MainNavigator, which is the flash the old early-return existed to avoid.
  const appTree = loading ? null : (
    <>
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
    </>
  );

  // The cold open overlays the app rather than replacing it, and is mounted in
  // exactly one place. Both of those matter: ColdOpen's last act is to fade
  // itself out, so the real UI has to already be behind it to fade out *to* —
  // and rendering it from two branches would unmount/remount it as `loading`
  // flips, restarting the sequence from its first frame.
  return (
    <View style={styles.appRoot}>
      <LiquidGlassBackground />
      {appTree}
      {!coldOpenDone && <ColdOpen ready={!loading} onDone={() => setColdOpenDone(true)} />}
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

    // Opens the encrypted store, whose key now comes from the OS key store and
    // so costs one async round trip. Purely a warm-up — every async accessor
    // awaits the same open — but doing it here means the first chat to load
    // cached messages is not the one that pays for it.
    warmSecureStorage().catch(() => undefined);
    
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

