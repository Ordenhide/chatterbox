import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, AppState} from 'react-native';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from '../services/firebase/auth';
import {doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc} from '../services/firebase/firestore';
import {User} from '../types';
import {sameUser} from '../utils/sameUser';
import {clearUserCache, upsertUserProfile} from '../services/firebaseChat';
import {reportError} from '../services/errorLog';
import {clearSessionId, getSessionId, rotateSessionId} from '../services/session';
import {getFunctions, httpsCallable} from '../services/firebase/functions';
import i18n from '../i18n';
import {
  _resetKeypairCache,
  adoptSeedAsDeviceKey,
  markRecoveryPhraseRevealed,
  republishKeyIfAccountHasNone,
} from '../services/e2eeKeys';
import {credentialsFromSeed, seedFromPhrase} from '../services/anonymousIdentity';
import {ensureRatchetKeysPublished} from '../services/ratchetKeys';
import {clearBodies} from '../services/messageBodyStore';
import {clearMediaCache} from '../services/mediaVault';
import {guardDocSnapshot} from '../services/snapshotGuard';

const TOKEN_CHECK_INTERVAL_MS = 30_000;
const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const SESSION_CLAIM_WAIT_MS = 15_000;
const SESSION_ALERT_COOLDOWN_MS = 4_000;
// The SDK default is 70s. claimSession has a fallback for when the function
// is unreachable (see claimNewSession), but that fallback only helps if the call
// actually *fails* in a reasonable time — a hung call still blocks sign-in
// for up to 70s otherwise. This project's Cloud Functions currently run
// against a closed billing account (2nd-gen functions need active billing to
// execute, not just deploy — confirmed via the Cloud Billing API), so this
// is a real, present failure mode, not a hypothetical one.
const CLAIM_FUNCTION_TIMEOUT_MS = 8_000;

function getAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  // Only the codes a phrase sign-in can actually produce. The address and the
  // secret are both derived from the same 24 words, so Firebase's whole family
  // of email-shaped complaints — invalid address, weak password, address
  // already in use, wrong code, wrong number — describes inputs no user can
  // supply any more. Every credential rejection means one thing here: those
  // words do not open an account on this server. (Firebase returns
  // `invalid-credential` for that when email-enumeration protection is on, and
  // the older pair when it is not; all three are mapped to the same sentence.)
  const map: Record<string, string> = {
    'auth/user-disabled': i18n.t('auth.errors.userDisabled'),
    'auth/network-request-failed': i18n.t('auth.errors.networkError'),
    'auth/too-many-requests': i18n.t('auth.errors.tooManyRequests'),
    'auth/invalid-credential': i18n.t('auth.errors.noAccountForPhrase'),
    'auth/invalid-login-credentials': i18n.t('auth.errors.noAccountForPhrase'),
    'auth/user-not-found': i18n.t('auth.errors.noAccountForPhrase'),
    'auth/wrong-password': i18n.t('auth.errors.noAccountForPhrase'),
  };
  return map[code] || error?.message || i18n.t('auth.errors.generic');
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Creates the account a freshly generated phrase names. See createAccount. */
  createAccount: (phrase: string, displayName?: string) => Promise<void>;
  /** Opens the account a phrase names, and restores its keys in the same step. */
  signInWithPhrase: (phrase: string) => Promise<void>;
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
        (async () => {
          try {
            await upsertUserProfile(profile);
          } catch (error) {
            reportError(error, 'startup_profile_sync');
          }
        })();
        // Publishes this device's existing public key if the account is
        // advertising none, so peers can encrypt to this user. Fire-and-forget:
        // messaging still works as plaintext if this hasn't completed yet —
        // see e2eeMessages.ts, which falls back when a peer key is missing.
        //
        // This used to *enrol* — mint a keypair when this device had none —
        // gated on enrollmentReadiness saying it was safe. It can't any more.
        // An account's identity is now its recovery phrase, and sign-in adopts
        // the key derived from that phrase (adoptSeedAsDeviceKey); both start
        // from the same moment, because Firebase fires this callback as soon
        // as sign-in resolves. A minted key whose publish happened to land
        // second would leave the account advertising a public key its own
        // phrase cannot match — permanently, and silently. No ordering fixes
        // that, so the minting is gone rather than sequenced.
        republishKeyIfAccountHasNone(firebaseUser.uid);

        /**
         * Publishes this device's ratchet bundle, which is what turns forward
         * secrecy on.
         *
         * Everything else about the ratchet has been here for a while — X3DH,
         * the double ratchet, group sender keys, all of it tested — and none
         * of it ever ran, because this one call was missing. The publish step
         * is deliberately separate from generating the identity
         * (getOrCreateRatchetIdentity says so in its own docstring: generating
         * is local and cheap, publishing is a claim to peers), and nothing
         * made the claim. So `users/{uid}/publicKeys/ratchet` never existed,
         * every peer lookup answered 'unenrolled', and both send paths fell
         * back to the static long-lived key — for every message, in every
         * conversation, while the privacy policy said most of them were
         * forward-secret.
         *
         * Fire-and-forget, and it swallows its own failures: a device that
         * cannot publish simply cannot be reached over the ratchet yet, which
         * the send path already treats as "no session" and answers with the
         * static path. It must not block signing in.
         *
         * Groups need every member to have published before sealGroupText will
         * use sender keys — it is all-or-nothing, because a message some
         * members cannot read is worse than one everybody can. So group
         * forward secrecy arrives per conversation as members update, rather
         * than all at once.
         */
        ensureRatchetKeysPublished(firebaseUser.uid);
      } else {
        setUser(null);
        clearUserCache();
        claimInProgressRef.current = false;
        setSessionReady(true);
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
    };
  }, [user, auth, db, functions]);

  /**
   * Claim session via Cloud Function (or direct Firestore write as fallback).
   * The new session always wins — the old device detects the change via its
   * real-time Firestore listener and signs itself out automatically.
   */
  const claimNewSession = async (uid: string, sessionId: string) => {
    try {
      const claimSessionFn = httpsCallable(functions, 'claimSession', {timeout: CLAIM_FUNCTION_TIMEOUT_MS});
      // Session id only. A device description used to travel with it and land
      // on the public profile document — see claimSession in functions/index.js.
      await claimSessionFn({sessionId});

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

  /*
   * The two phrase flows below both adopt the key the phrase encodes before
   * claiming the session, because for these accounts those are not two facts:
   * the seed *is* the account (services/anonymousIdentity.ts), so opening one
   * and being able to read it are the same act. There is no separate "restore
   * your keys" step to forget, and no window in which someone is signed in and
   * silently unable to decrypt.
   *
   * Adoption is awaited and its failure fails the sign-in, because the
   * alternative is an account nobody can encrypt to that nothing would ever
   * retry. That is only tolerable because the account is deterministic: the
   * same phrase reaches the same account, so "try again" re-runs the lot.
   *
   * The three calls are repeated in each flow rather than factored into a
   * shared helper, matching signIn/signUp above — claimNewSession and
   * waitForSessionConfirmed are plain closures, so a helper holding them would
   * be a new dependency of both useCallbacks and would defeat the memoization
   * it sits inside.
   */
  /**
   * Creates the account that a freshly generated phrase names.
   *
   * The caller must have shown the user the phrase and had them confirm they
   * kept it *before* calling this. There is no reset email, no support
   * address, and no second factor — an account created before its phrase was
   * written down is an account already lost, and nothing downstream can
   * detect that or repair it.
   *
   * `email-already-in-use` is treated as success-by-another-route rather than
   * an error. A fresh seed is 256 bits, so it is never a genuine collision;
   * what it actually means is that a previous attempt got as far as creating
   * the auth account and then failed at a later step. Signing in instead is
   * what makes that retryable, and retrying is the documented recovery for
   * every failure in this path.
   */
  const createAccount = useCallback(
    async (phrase: string, displayName?: string) => {
      const seed = seedFromPhrase(phrase);
      if (!seed) {
        throw new Error(i18n.t('auth.errors.phraseNotRecognized'));
      }
      const {address, secret} = credentialsFromSeed(seed);
      setSessionReady(false);
      claimInProgressRef.current = true;
      let success = false;
      try {
        const nextSessionId = await rotateSessionId();
        sessionIdRef.current = nextSessionId;

        let firebaseUser: FirebaseUser;
        try {
          firebaseUser = (await createUserWithEmailAndPassword(auth, address, secret)).user;
        } catch (error: any) {
          if (error?.code !== 'auth/email-already-in-use') throw error;
          firebaseUser = (await signInWithEmailAndPassword(auth, address, secret)).user;
        }

        const normalizedDisplayName = displayName?.trim();
        if (normalizedDisplayName) {
          await updateProfile(firebaseUser, {displayName: normalizedDisplayName});
        }

        await adoptSeedAsDeviceKey(firebaseUser.uid, seed);
        await claimNewSession(firebaseUser.uid, nextSessionId);
        await waitForSessionConfirmed(firebaseUser.uid, nextSessionId);
        // Sign-up is the one moment the phrase is shown, and it has just been
        // shown. Without this the app would open on a prompt to go and reveal
        // the phrase the user is still holding.
        await markRecoveryPhraseRevealed(firebaseUser.uid);

        await setDoc(
          doc(db, 'users', firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            // No email, no photo, no name — see upsertUserProfile in
            // services/firebaseChat.ts. There is now no email to leave out:
            // Firebase Auth holds a random handle under a domain that cannot
            // receive mail, and nothing else.
            //
            // `defaultMomentVisibility: 'friends'` was written here too, for a
            // feature with no screen on either client. A default nothing reads
            // is not a default.
            updatedAt: serverTimestamp(),
          },
          {merge: true},
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
    [auth, db],
  );

  /** Opens the account a phrase names, restoring its keys in the same step. */
  const signInWithPhrase = useCallback(
    async (phrase: string) => {
      // Checked before anything is attempted, so a mistyped word is answered
      // by the screen rather than by a round trip that comes back as a
      // credential error and reads as "your account does not exist".
      const seed = seedFromPhrase(phrase);
      if (!seed) {
        throw new Error(i18n.t('auth.errors.phraseNotRecognized'));
      }
      const {address, secret} = credentialsFromSeed(seed);
      setSessionReady(false);
      claimInProgressRef.current = true;
      let success = false;
      try {
        const nextSessionId = await rotateSessionId();
        sessionIdRef.current = nextSessionId;
        const credential = await signInWithEmailAndPassword(auth, address, secret);
        await adoptSeedAsDeviceKey(credential.user.uid, seed);
        await claimNewSession(credential.user.uid, nextSessionId);
        await waitForSessionConfirmed(credential.user.uid, nextSessionId);
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
    [auth],
  );

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
      createAccount,
      signInWithPhrase,
      signOut,
    }),
    [
      user,
      loading,
      sessionReady,
      createAccount,
      signInWithPhrase,
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

