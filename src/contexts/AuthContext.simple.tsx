import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Alert, AppState} from 'react-native';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {doc, getDoc, getFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc} from '@react-native-firebase/firestore';
import {User} from '../types';
import {clearUserCache, upsertUserProfile} from '../services/firebaseChat';
import {reportError, setTelemetryUser, trackEvent} from '../services/telemetry';
import {clearSessionId, getSessionId, getStoredSessionId, rotateSessionId} from '../services/session';
import i18n from '../i18n';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Simplified AuthContext that doesn't require Cloud Functions.
 * Uses Firestore transactions to atomically claim sessions.
 * 
 * To use this version:
 * 1. Rename this file to AuthContext.tsx (backup the original first)
 * 2. Deploy firestore.rules.simple as firestore.rules
 * 3. Remove @react-native-firebase/functions dependency (optional)
 */
export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(true);
  const auth = getAuth();
  const db = getFirestore();
  const signingOutRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthTypes.User | null) => {
      if (firebaseUser) {
        const profile: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
        };
        setUser(profile);
        setSessionReady(false);
        setTelemetryUser(firebaseUser.uid);
        (async () => {
          try {
            await upsertUserProfile(profile);
          } catch (error) {
            reportError(error, 'startup_profile_sync');
          }
        })();
      } else {
        setUser(null);
        setTelemetryUser(null);
        clearUserCache();
        setSessionReady(true);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | null = null;
    let active = true;
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
        sessionIdRef.current = null;
        await clearSessionId();
        await firebaseSignOut(auth);
      } finally {
        signingOutRef.current = false;
        setSessionReady(true);
      }
      Alert.alert(i18n.t('auth.session.title'), i18n.t('auth.session.message'));
    };

    const checkSession = async () => {
      try {
        const sessionId = await resolveSessionId();
        const snap = await getDoc(sessionRef);
        const current = (snap.data() as any)?.activeSessionId;
        if (current && current !== sessionId) {
          await signOutDueToSession();
        }
      } catch (error) {
        reportError(error, 'session_check');
      }
    };

    const registerAndSubscribe = async () => {
      const sessionId = await resolveSessionId();
      if (!active) return;

      // Check current session
      try {
        const snap = await getDoc(sessionRef);
        const current = (snap.data() as any)?.activeSessionId;
        if (current && current !== sessionId) {
          await signOutDueToSession();
          return;
        }
        if (!current) {
          await setDoc(
            sessionRef,
            {
              activeSessionId: sessionId,
              sessionUpdatedAt: serverTimestamp(),
            },
            {merge: true},
          );
        }
      } catch (error) {
        reportError(error, 'session_register');
        if ((error as any)?.code === 'permission-denied') {
          await signOutDueToSession();
          return;
        }
      }

      if (!active) return;
      unsub = onSnapshot(
        sessionRef,
        snap => {
          const current = (snap.data() as any)?.activeSessionId;
          if (current && current !== sessionId) {
            signOutDueToSession();
          }
        },
        error => {
          reportError(error, 'session_listener');
          if ((error as any)?.code === 'permission-denied') {
            signOutDueToSession();
          }
        },
      );
      if (active) {
        setSessionReady(true);
      }
    };

    registerAndSubscribe().catch(error => {
      reportError(error, 'session_register_unhandled');
      if (active) {
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
    };
  }, [user, auth, db]);

  /**
   * Atomically claim session using Firestore transaction.
   * This ensures only one session can claim at a time.
   */
  const claimSessionAtomically = async (uid: string, sessionId: string) => {
    const sessionRef = doc(db, 'users', uid);
    await runTransaction(db, async tx => {
      const snap = await tx.get(sessionRef);
      const current = snap.data()?.activeSessionId;
      // If there's an existing session, we still claim it (new login takes over)
      // The old session will be signed out via the listener
      tx.set(
        sessionRef,
        {
          activeSessionId: sessionId,
          sessionUpdatedAt: serverTimestamp(),
        },
        {merge: true},
      );
    });
  };

  const signIn = async (email: string, password: string) => {
    setSessionReady(false);
    try {
      const nextSessionId = await rotateSessionId();
      sessionIdRef.current = nextSessionId;
      const credential = await signInWithEmailAndPassword(auth, email, password);
      // Atomically claim session
      await claimSessionAtomically(credential.user.uid, nextSessionId);
      trackEvent('login', {method: 'password'}).catch(() => undefined);
    } catch (error) {
      sessionIdRef.current = null;
      try {
        await clearSessionId();
        await firebaseSignOut(auth);
      } catch {
        // ignore cleanup failures
      }
      throw error;
    } finally {
      setSessionReady(true);
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    setSessionReady(false);
    try {
      const nextSessionId = await rotateSessionId();
      sessionIdRef.current = nextSessionId;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, {displayName});
      }
      if (userCredential.user) {
        // Atomically claim session and create user profile
        await runTransaction(db, async tx => {
          const userRef = doc(db, 'users', userCredential.user.uid);
          tx.set(userRef, {
            uid: userCredential.user.uid,
            email,
            displayName: displayName || null,
            photoURL: userCredential.user.photoURL || null,
            profileVisibility: 'public',
            defaultMomentVisibility: 'friends',
            activeSessionId: nextSessionId,
            sessionUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        trackEvent('sign_up', {method: 'password'}).catch(() => undefined);
      }
    } catch (error) {
      sessionIdRef.current = null;
      try {
        await clearSessionId();
        await firebaseSignOut(auth);
      } catch {
        // ignore cleanup failures
      }
      throw error;
    } finally {
      setSessionReady(true);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async () => {
    if (user?.uid) {
      try {
        // Clear session on sign out
        const sessionId = sessionIdRef.current || (await getStoredSessionId());
        const sessionRef = doc(db, 'users', user.uid);
        const snap = await getDoc(sessionRef);
        if (snap.data()?.activeSessionId === sessionId) {
          await setDoc(sessionRef, {activeSessionId: null, sessionUpdatedAt: serverTimestamp()}, {merge: true});
        }
      } catch (error) {
        reportError(error, 'signout_session_clear');
      }
    }
    sessionIdRef.current = null;
    await clearSessionId();
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{user, loading: loading || !sessionReady, signIn, signUp, resetPassword, signOut}}>
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

