import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, AppState} from 'react-native';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  updateProfile,
  type ConfirmationResult,
  type User as FirebaseUser,
} from '../services/firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {requestAppleCredential} from '../services/appleAuth';
import {doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc} from '../services/firebase/firestore';
import {User} from '../types';
import {sameUser} from '../utils/sameUser';
import {clearUserCache, upsertUserProfile} from '../services/firebaseChat';
import {reportError, setTelemetryUser, trackEvent} from '../services/telemetry';
import {clearSessionId, getSessionId, rotateSessionId} from '../services/session';
import {getDeviceInfo} from '../services/deviceInfo';
import {getFunctions, httpsCallable} from '../services/firebase/functions';
import i18n from '../i18n';
import {_resetKeypairCache, enrollmentReadiness, getOrCreateDeviceKeypair} from '../services/e2eeKeys';
import {clearBodies} from '../services/messageBodyStore';
import {clearMediaCache} from '../services/mediaVault';
import {guardDocSnapshot} from '../services/snapshotGuard';

const TOKEN_CHECK_INTERVAL_MS = 30_000;
const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const SESSION_CLAIM_WAIT_MS = 15_000;
const SESSION_ALERT_COOLDOWN_MS = 4_000;
// The SDK default is 70s. claimSession/sessionHeartbeat both have a fallback
// for when the function is unreachable (see claimNewSession and the
// heartbeat's catch block below), but that fallback only helps if the call
// actually *fails* in a reasonable time — a hung call still blocks sign-in
// for up to 70s otherwise. This project's Cloud Functions currently run
// against a closed billing account (2nd-gen functions need active billing to
// execute, not just deploy — confirmed via the Cloud Billing API), so this
// is a real, present failure mode, not a hypothetical one.
const CLAIM_FUNCTION_TIMEOUT_MS = 8_000;

function getAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  const map: Record<string, string> = {
    'auth/user-not-found': i18n.t('auth.errors.userNotFound'),
    'auth/wrong-password': i18n.t('auth.errors.wrongPassword'),
    'auth/invalid-email': i18n.t('auth.errors.invalidEmail'),
    'auth/user-disabled': i18n.t('auth.errors.userDisabled'),
    'auth/email-already-in-use': i18n.t('auth.errors.emailInUse'),
    'auth/weak-password': i18n.t('auth.errors.weakPassword'),
    'auth/network-request-failed': i18n.t('auth.errors.networkError'),
    'auth/too-many-requests': i18n.t('auth.errors.tooManyRequests'),
    'auth/invalid-verification-code': i18n.t('auth.errors.invalidVerificationCode'),
    'auth/invalid-phone-number': i18n.t('auth.errors.invalidPhoneNumber'),
    'auth/account-exists-with-different-credential': i18n.t(
      'auth.errors.accountExistsDifferentCredential',
    ),
  };
  return map[code] || error?.message || i18n.t('auth.errors.generic');
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<ConfirmationResult>;
  confirmPhoneCode: (confirmation: ConfirmationResult, code: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(true);
  const auth = getAuth();
  const db = getFirestore();
  const functions = getFunctions();
  const signingOutRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const claimInProgressRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTokenCheckAtRef = useRef(0);
  const lastSessionAlertAtRef = useRef(0);

  const showSingleSessionAlert = () => {
    const now = Date.now();
    if (now - lastSessionAlertAtRef.current < SESSION_ALERT_COOLDOWN_MS) {
      return;
    }
    lastSessionAlertAtRef.current = now;
    Alert.alert(i18n.t('auth.session.title'), i18n.t('auth.session.message'));
  };

  useEffect(() => {
    const checkTokenRevocation = async () => {
      if (appStateRef.current !== 'active' || signingOutRef.current) return;
      const now = Date.now();
      if (now - lastTokenCheckAtRef.current < TOKEN_CHECK_INTERVAL_MS) return;
      lastTokenCheckAtRef.current = now;
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const tokenResult = await currentUser.getIdTokenResult();
        const expirationMs = tokenResult.expirationTime
          ? new Date(tokenResult.expirationTime).getTime()
          : 0;

        // Avoid force-refreshing tokens that are still fresh.
        if (expirationMs && expirationMs - Date.now() > TOKEN_REFRESH_WINDOW_MS) {
          return;
        }

        await currentUser.getIdToken(true);
      } catch (error: any) {
        if (
          error?.code === 'auth/user-token-expired' ||
          error?.code === 'auth/user-disabled' ||
          error?.code === 'auth/invalid-user-token'
        ) {
          if (!signingOutRef.current) {
            signingOutRef.current = true;
            try {
              await clearSessionId();
              await firebaseSignOut(auth);
              showSingleSessionAlert();
            } finally {
              signingOutRef.current = false;
            }
          }
        }
      }
    };

    const appStateSub = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        checkTokenRevocation().catch(() => undefined);
      }
    });

    // Check token revocation periodically (only when app is active)
    const tokenCheckInterval = setInterval(() => {
      checkTokenRevocation().catch(() => undefined);
    }, TOKEN_CHECK_INTERVAL_MS);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const profile: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
        };
        // Keep the previous object when nothing in it changed. This callback
        // fires again on a token refresh and on any user reload, and a fresh
        // object each time is a new identity for every consumer — the chat
        // screen keys four effects off `user`, including the one that opens
        // the message listener, seeds the body cache and runs the decrypt
        // pass. Those were tearing down and re-running for a profile that was
        // field-for-field identical. React bails out of the re-render
        // entirely when the state value is the same reference, so returning
        // `prev` costs nothing and stops the churn at the source rather than
        // asking every consumer to depend on `user.uid` and remember why.
        setUser(prev => (sameUser(prev, profile) ? prev : profile));
        setSessionReady(false);
        setTelemetryUser(firebaseUser.uid);
        (async () => {
          try {
            await upsertUserProfile(profile);
          } catch (error) {
            reportError(error, 'startup_profile_sync');
          }
        })();
        // Enrolls (or loads) this device's E2EE keypair and publishes the
        // public half, so peers can encrypt to this user. Fire-and-forget:
        // messaging still works as plaintext if this hasn't completed yet —
        // see e2eeMessages.ts, which falls back when a peer key is missing.
        //
        // Enrolls only when that's known to be safe. On a reinstall/new
        // device for an account that already published a key elsewhere,
        // enrolling here would happen within milliseconds of login — long
        // before the user could reach Settings to restore — and would
        // silently overwrite the very key restore needs to match against.
        // Held off, this device just stays unenrolled (the same
        // plaintext-fallback state as before first-ever enrollment) until
        // the user restores or explicitly sends a message.
        (async () => {
          try {
            if ((await enrollmentReadiness(firebaseUser.uid)) !== 'safe') return;
            await getOrCreateDeviceKeypair(firebaseUser.uid);
          } catch (error) {
            reportError(error, 'e2ee_enroll_failed');
          }
        })();
      } else {
        setUser(null);
        setTelemetryUser(null);
        clearUserCache();
        claimInProgressRef.current = false;
        setSessionReady(true);
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
      clearInterval(tokenCheckInterval);
    };
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | null = null;
    let active = true;
    let heartbeatUnavailable = false;
    const sessionRef = doc(db, 'users', user.uid);
    setSessionReady(false);

    const resolveSessionId = async () => {
      if (sessionIdRef.current) return sessionIdRef.current;
      const next = await getSessionId();
      sessionIdRef.current = next;
      return next;
    };

    const signOutDueToSession = async () => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      try {
        const uid = auth.currentUser?.uid;
        sessionIdRef.current = null;
        await clearSessionId();
        await firebaseSignOut(auth);
        // Same reasoning as the explicit sign-out below. This path fires when
        // the account was claimed on another device, which is exactly when
        // leaving readable history behind would be worst.
        if (uid) await clearBodies(uid).catch(error => reportError(error, 'signout_bodies'));
        await clearMediaCache().catch(error => reportError(error, 'signout_media_cache'));
      } finally {
        signingOutRef.current = false;
        setSessionReady(true);
      }
      showSingleSessionAlert();
    };

    const checkSession = async () => {
      if (appStateRef.current !== 'active') return;
      try {
        const sessionId = await resolveSessionId();
        const snap = await getDoc(sessionRef);
        const current = (snap.data() as any)?.activeSessionId;
        if (current && current !== sessionId) {
          await signOutDueToSession();
        }
      } catch (error) {
        // Deliberately non-fatal, including for permission-denied.
        // firestore.rules *is* written to deny this read once a token's
        // auth_time falls behind the account's latest sessionClaimedAt — which
        // would make permission-denied a genuine displacement signal — but
        // those rules are not deployed yet. Until they are, a permission error
        // here can only mean something unexpected (e.g. a token that has not
        // propagated yet), and signing the user out over it costs a working
        // session for no security benefit. Revisit alongside the rules
        // deployment; ensureActiveSession below already handles the denial
        // path for the case that actually matters today.
        reportError(error, 'session_check');
      }
    };

    const ensureActiveSession = async (sessionId: string): Promise<boolean> => {
      try {
        const snap = await getDoc(sessionRef);
        const current = (snap.data() as any)?.activeSessionId;

        // If a different device owns the session and we're not mid-claim, we're stale.
        if (current && current !== sessionId && !claimInProgressRef.current) {
          await signOutDueToSession();
          return false;
        }

        // Write activeSessionId if it's missing or already ours.
        // Always writing (not just when null) handles the case where the
        // field exists but the value was corrupted, or a previous write
        // was only partially applied.
        if (!current || current === sessionId) {
          await setDoc(
            sessionRef,
            {
              activeSessionId: sessionId,
              sessionUpdatedAt: serverTimestamp(),
            },
            {merge: true},
          );
        }

        return true;
      } catch (error) {
        reportError(error, 'ensureActiveSession');
        const code = (error as any)?.code;
        if (code === 'permission-denied' || code === 'firestore/permission-denied') {
          if (!claimInProgressRef.current) {
            await signOutDueToSession();
          }
          return false;
        }
        // Network/transient errors — we'll retry below.
        return false;
      }
    };

    const registerAndSubscribe = async () => {
      const sessionId = await resolveSessionId();
      if (!active) return;

      // Avoid race: wait for sign-in/sign-up claim to complete first.
      if (claimInProgressRef.current) {
        const maxWait = SESSION_CLAIM_WAIT_MS;
        const start = Date.now();
        while (claimInProgressRef.current && Date.now() - start < maxWait && active) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Ensure the session is established in Firestore. Retry once on
      // transient failure so a brief network blip doesn't leave the user
      // stuck on the loading screen.
      let established = await ensureActiveSession(sessionId);
      if (!established && active && !signingOutRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        established = await ensureActiveSession(sessionId);
      }

      if (!active) return;

      // If session couldn't be established (e.g., wrong Firestore rules
      // deployed, CF not available), still unblock the UI so the user can
      // at least navigate to sign out. Firestore operations will fail with
      // permission-denied, but that's better than a frozen loading screen.
      if (!established) {
        if (active) {
          setSessionReady(true);
        }
        return;
      }

      // Set up real-time listener for session changes
      unsub = onSnapshot(
        sessionRef,
        guardDocSnapshot('session_listener', snap => {
          const current = (snap.data() as any)?.activeSessionId;
          if (current && current !== sessionId && !claimInProgressRef.current) {
            signOutDueToSession();
          }
        }),
        error => {
          reportError(error, 'session_listener');
          const code = (error as any)?.code;
          if ((code === 'permission-denied' || code === 'firestore/permission-denied') && !claimInProgressRef.current) {
            signOutDueToSession();
          }
        },
      );

      // Start heartbeat to keep session alive
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(async () => {
        if (!active || !user || appStateRef.current !== 'active' || heartbeatUnavailable) return;
        try {
          const heartbeatSessionId = await resolveSessionId();
          const heartbeatFn = httpsCallable(functions, 'sessionHeartbeat', {timeout: CLAIM_FUNCTION_TIMEOUT_MS});
          await heartbeatFn({sessionId: heartbeatSessionId});
        } catch (error) {
          const code = (error as any)?.code;
          // If function is not deployed, stop retrying every minute.
          if (code === 'functions/not-found' || code === 'functions/unimplemented') {
            heartbeatUnavailable = true;
          }
          reportError(error, 'session_heartbeat');
        }
      }, 60000); // Every 60 seconds

      if (active) {
        setSessionReady(true);
      }
    };

    registerAndSubscribe().catch(error => {
      reportError(error, 'session_register_unhandled');
      // Do NOT set sessionReady here — the session was not established.
      // The user will stay on the loading screen. Signing out and back
      // in will re-trigger this flow.
      if (active && !signingOutRef.current) {
        Alert.alert(
          i18n.t('auth.session.title'),
          i18n.t('auth.session.unavailable'),
        );
        // Allow the user to at least sign out by marking session ready.
        setSessionReady(true);
      }
    });

    const appStateSub = AppState.addEventListener('change', nextState => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev !== 'active' && nextState === 'active') {
        checkSession();
      }
    });

    return () => {
      active = false;
      if (unsub) unsub();
      appStateSub.remove();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [user, auth, db, functions]);

  /**
   * Claim session via Cloud Function (or direct Firestore write as fallback).
   * The new session always wins — the old device detects the change via its
   * real-time Firestore listener and signs itself out automatically.
   */
  const claimNewSession = async (uid: string, sessionId: string) => {
    try {
      const deviceInfo = await getDeviceInfo();
      const claimSessionFn = httpsCallable(functions, 'claimSession', {timeout: CLAIM_FUNCTION_TIMEOUT_MS});
      await claimSessionFn({
        sessionId,
        deviceInfo: {
          platform: deviceInfo.platform,
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          appVersion: deviceInfo.appVersion,
        },
      });

      // The Cloud Function sets custom claims on the auth token. Force-refresh
      // the token so the client picks up the new claims immediately. Without
      // this, Firestore rules that check request.auth.token.sessionId would
      // reject operations until the token naturally refreshes (~1 hour).
      try {
        await auth.currentUser?.getIdToken(true);
      } catch {
        // Non-critical — the token will refresh on its own eventually.
      }
    } catch (error: any) {
      // If Cloud Function fails, fall back to direct Firestore write.
      reportError(error, 'claimSession_cloud_function_failed');
      const sessionRef = doc(db, 'users', uid);
      await setDoc(
        sessionRef,
        {
          activeSessionId: sessionId,
          sessionUpdatedAt: serverTimestamp(),
        },
        {merge: true},
      );
    }
  };

  const waitForSessionConfirmed = async (uid: string, sessionId: string) => {
    const sessionRef = doc(db, 'users', uid);
    const start = Date.now();
    while (Date.now() - start < SESSION_CLAIM_WAIT_MS) {
      const snap = await getDoc(sessionRef);
      const current = (snap.data() as any)?.activeSessionId;
      if (current === sessionId) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    // If it still hasn't propagated, write it directly as a last resort.
    await setDoc(
      sessionRef,
      {
        activeSessionId: sessionId,
        sessionUpdatedAt: serverTimestamp(),
      },
      {merge: true},
    );
  };

  const signIn = useCallback(async (email: string, password: string) => {
    setSessionReady(false);
    claimInProgressRef.current = true;
    let success = false;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const nextSessionId = await rotateSessionId();
      sessionIdRef.current = nextSessionId;
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await claimNewSession(credential.user.uid, nextSessionId);
      await waitForSessionConfirmed(credential.user.uid, nextSessionId);
      trackEvent('login', {method: 'password'}).catch(() => undefined);
      success = true;
    } catch (error) {
      sessionIdRef.current = null;
      try {
        await clearSessionId();
        await firebaseSignOut(auth);
      } catch {
        // ignore cleanup failures
      }
      const friendlyError = new Error(getAuthErrorMessage(error));
      (friendlyError as any).code = (error as any)?.code;
      throw friendlyError;
    } finally {
      claimInProgressRef.current = false;
      if (!success) {
        setSessionReady(true);
      }
    }
  }, [auth]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    setSessionReady(false);
    claimInProgressRef.current = true;
    let success = false;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedDisplayName = displayName?.trim();
      const nextSessionId = await rotateSessionId();
      sessionIdRef.current = nextSessionId;
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      if (normalizedDisplayName && userCredential.user) {
        await updateProfile(userCredential.user, {displayName: normalizedDisplayName});
      }
      if (userCredential.user) {
        await claimNewSession(userCredential.user.uid, nextSessionId);
        await waitForSessionConfirmed(userCredential.user.uid, nextSessionId);

        await setDoc(
          doc(db, 'users', userCredential.user.uid),
          {
            uid: userCredential.user.uid,
            // No email, no photo, no name: see upsertUserProfile in
            // services/firebaseChat.ts. Firebase Auth holds the address and
            // the name, which is where a credential belongs; this document is
            // readable by anyone who knows the uid. The name reaches the other
            // side of a conversation sealed (services/introductions.ts).
            defaultMomentVisibility: 'friends',
            updatedAt: serverTimestamp(),
          },
          {merge: true},
        );
        trackEvent('sign_up', {method: 'password'}).catch(() => undefined);
      }
      success = true;
    } catch (error) {
      sessionIdRef.current = null;
      try {
        await clearSessionId();
        await firebaseSignOut(auth);
      } catch {
        // ignore cleanup failures
      }
      const friendlyError = new Error(getAuthErrorMessage(error));
      (friendlyError as any).code = (error as any)?.code;
      throw friendlyError;
    } finally {
      claimInProgressRef.current = false;
      if (!success) {
        setSessionReady(true);
      }
    }
  }, [auth, db]);

  // Shared by signInWithGoogle and confirmPhoneCode: both are single-step
  // credential exchanges that can either sign in an existing account or
  // silently create a new one, unlike email/password where sign-in and
  // sign-up are separate user-driven actions. Claims the session the same
  // way signIn/signUp do, and — only for brand-new accounts — bootstraps the
  // Firestore profile doc the same way signUp does.
  const completeCredentialSignIn = useCallback(
    async (firebaseUser: FirebaseUser, nextSessionId: string, isNewUser: boolean, method: string) => {
      await claimNewSession(firebaseUser.uid, nextSessionId);
      await waitForSessionConfirmed(firebaseUser.uid, nextSessionId);
      if (isNewUser) {
        await setDoc(
          doc(db, 'users', firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            // No email, no photo, no name — same reason as signUp above. A
            // Google or Apple sign-in hands all three over, and none is
            // written down.
            defaultMomentVisibility: 'friends',
            updatedAt: serverTimestamp(),
          },
          {merge: true},
        );
        trackEvent('sign_up', {method}).catch(() => undefined);
      } else {
        trackEvent('login', {method}).catch(() => undefined);
      }
    },
    [db],
  );

  const signInWithGoogle = useCallback(async () => {
    setSessionReady(false);
    claimInProgressRef.current = true;
    let success = false;
    try {
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') {
        // User backed out of the picker — not an error, nothing was claimed yet.
        return;
      }
      const {idToken} = response.data;
      if (!idToken) {
        throw new Error(i18n.t('auth.errors.generic'));
      }
      const nextSessionId = await rotateSessionId();
      sessionIdRef.current = nextSessionId;
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      await completeCredentialSignIn(
        userCredential.user,
        nextSessionId,
        !!userCredential.additionalUserInfo?.isNewUser,
        'google',
      );
      success = true;
    } catch (error) {
      sessionIdRef.current = null;
      try {
        await clearSessionId();
        await firebaseSignOut(auth);
      } catch {
        // ignore cleanup failures
      }
      const friendlyError = new Error(getAuthErrorMessage(error));
      (friendlyError as any).code = (error as any)?.code;
      throw friendlyError;
    } finally {
      claimInProgressRef.current = false;
      if (!success) {
        setSessionReady(true);
      }
    }
  }, [auth, completeCredentialSignIn]);

  /**
   * Sign in with Apple.
   *
   * Structurally the same as Google above — a single credential exchange that
   * signs in or silently creates — with two differences that are easy to get
   * wrong and impossible to notice later.
   *
   * The raw nonce goes to Firebase while only its hash went to Apple; see
   * services/appleAuth.ts for why that ordering is the whole replay defence.
   *
   * And the display name is written **only on the first sign-in**. Apple sends
   * a name once per app/account pair and null forever after, so a later
   * sign-in that wrote what Apple sent would overwrite a real name with
   * nothing. `isNewUser` is exactly the "first time" signal, so the write is
   * gated on it and on Apple actually having sent something.
   */
  const signInWithApple = useCallback(async () => {
    setSessionReady(false);
    claimInProgressRef.current = true;
    let success = false;
    try {
      const apple = await requestAppleCredential();
      if (!apple) {
        // Sheet dismissed. Nothing was claimed, so there is nothing to undo.
        return;
      }
      const nextSessionId = await rotateSessionId();
      sessionIdRef.current = nextSessionId;
      const credential = new OAuthProvider('apple.com').credential({
        idToken: apple.identityToken,
        rawNonce: apple.rawNonce,
      });
      const userCredential = await signInWithCredential(auth, credential);
      const isNewUser = !!userCredential.additionalUserInfo?.isNewUser;

      // Before completeCredentialSignIn, which copies displayName into the
      // Firestore profile — doing it after would store null and need a second
      // write to correct.
      if (isNewUser && apple.fullName && !userCredential.user.displayName) {
        await updateProfile(userCredential.user, {displayName: apple.fullName});
      }

      await completeCredentialSignIn(userCredential.user, nextSessionId, isNewUser, 'apple');
      success = true;
    } catch (error) {
      sessionIdRef.current = null;
      try {
        await clearSessionId();
        await firebaseSignOut(auth);
      } catch {
        // ignore cleanup failures
      }
      const friendlyError = new Error(getAuthErrorMessage(error));
      (friendlyError as any).code = (error as any)?.code;
      throw friendlyError;
    } finally {
      claimInProgressRef.current = false;
      if (!success) {
        setSessionReady(true);
      }
    }
  }, [auth, completeCredentialSignIn]);

  // Step 1 of phone sign-in: sends the SMS code and hands back RNFB's
  // confirmation object. The calling screen holds onto it across the
  // user-driven pause until they type the code in, then passes it to
  // confirmPhoneCode below — this can't be a single call the way Google
  // sign-in is, since there's no way to synchronously wait for an SMS.
  const sendPhoneCode = useCallback(async (phoneNumber: string): Promise<ConfirmationResult> => {
    try {
      return await signInWithPhoneNumber(auth, phoneNumber);
    } catch (error) {
      const friendlyError = new Error(getAuthErrorMessage(error));
      (friendlyError as any).code = (error as any)?.code;
      throw friendlyError;
    }
  }, [auth]);

  const confirmPhoneCode = useCallback(
    async (confirmation: ConfirmationResult, code: string) => {
      setSessionReady(false);
      claimInProgressRef.current = true;
      let success = false;
      try {
        const nextSessionId = await rotateSessionId();
        sessionIdRef.current = nextSessionId;
        const userCredential = await confirmation.confirm(code);
        await completeCredentialSignIn(
          userCredential.user,
          nextSessionId,
          !!userCredential.additionalUserInfo?.isNewUser,
          'phone',
        );
        success = true;
      } catch (error) {
        sessionIdRef.current = null;
        try {
          await clearSessionId();
          await firebaseSignOut(auth);
        } catch {
          // ignore cleanup failures
        }
        const friendlyError = new Error(getAuthErrorMessage(error));
        (friendlyError as any).code = (error as any)?.code;
        throw friendlyError;
      } finally {
        claimInProgressRef.current = false;
        if (!success) {
          setSessionReady(true);
        }
      }
    },
    [auth, completeCredentialSignIn],
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  }, [auth]);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    claimInProgressRef.current = false;
    setSessionReady(false);
    try {
      // Read before the auth user goes away — the cleanup below is scoped by
      // uid and there is nothing to scope it by afterwards.
      const uid = auth.currentUser?.uid;
      sessionIdRef.current = null;
      await clearSessionId().catch(() => undefined);
      await firebaseSignOut(auth).catch(error => reportError(error, 'signout_auth'));
      // Locally stored message plaintext is the one cache readable without
      // ever reaching the network, so it must not outlive the session that
      // produced it: otherwise the next person to pick up the phone is one tap
      // from the previous account's history.
      if (uid) await clearBodies(uid).catch(error => reportError(error, 'signout_bodies'));
      // Same reasoning, for attachment bytes. clearMediaCache's own doc says it
      // is called from "sign-out and account deletion", but only the deletion
      // half was ever wired: a decrypted photo outlived the session that could
      // read it and was still on disk for whoever signed in next.
      await clearMediaCache().catch(error => reportError(error, 'signout_media_cache'));
      // Defense in depth: getOrCreateDeviceKeypair already scopes its cache by
      // uid, but drop it anyway so a signed-out account's secret key doesn't
      // linger in memory longer than it needs to.
      _resetKeypairCache();
    } finally {
      signingOutRef.current = false;
    }
  }, [auth]);

  const contextValue = useMemo(
    () => ({
      user,
      loading: loading || !sessionReady,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      sendPhoneCode,
      confirmPhoneCode,
      resetPassword,
      signOut,
    }),
    [
      user,
      loading,
      sessionReady,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      sendPhoneCode,
      confirmPhoneCode,
      resetPassword,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

