import {Suspense, lazy, useEffect, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {auth} from './firebase';
// Not firebase/auth's signOut: the service one also drops the decrypted media
// cache, and a displaced session is the last place to skip that.
import {signOut} from './services/auth';
import {colors} from './theme';
import {useT} from './i18n';
import {listenForSessionTakeover, verifyOrAdoptSession} from './services/session';
import {republishKeyIfAccountHasNone} from './services/e2eeKeys';
import {useBackdropParallax} from './hooks/useBackdropParallax';
import BrandMark from './components/BrandMark';
import CipherTexture from './components/CipherTexture';
import ConnectionBanner from './components/ConnectionBanner';
import LoginScreen from './screens/LoginScreen';
import ColdOpen, {coldOpenPending} from './components/ColdOpen';

// Code-split the authenticated app: the whole chat/moments/calls surface (and
// its Firestore/Storage/WebRTC code) loads only after sign-in.
const MainApp = lazy(() => import('./screens/MainApp'));

function FullscreenLoader() {
  const {t} = useT();
  return (
    <div style={styles.loader}>
      <BrandMark size={52} />
      <div style={{color: colors.textSecondary, fontSize: 14}}>{t('app.loading')}</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Gates rendering until we know this browser owns the session, so the
  // authenticated UI never flashes for a session that has been displaced.
  const [sessionReady, setSessionReady] = useState(false);
  const [displaced, setDisplaced] = useState(false);
  // Seeded from ColdOpen's module-scope flag rather than `true`, so only a
  // genuine first load waits on the sequence — a fast refresh or remount
  // reads it as already played and skips straight to the app.
  const [coldOpenDone, setColdOpenDone] = useState(() => !coldOpenPending());

  // Drifts body::before against whichever screen is scrolling. Mounted here
  // because the backdrop is global — it outlives every screen below it.
  useBackdropParallax();

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setSessionReady(false);
      setLoading(false);
    });
  }, []);

  // Validate a restored sign-in, then watch for another device taking over.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const signOutDisplaced = () => {
      setDisplaced(true);
      signOut().catch(() => undefined);
    };

    verifyOrAdoptSession(user.uid)
      .then(owned => {
        if (cancelled) return;
        if (!owned) {
          // Another device claimed the account while this tab was away.
          signOutDisplaced();
          return;
        }
        // Publishes this browser's existing key if the account is advertising
        // none, so peers can encrypt to this user. It never mints and never
        // overwrites another device's key — see e2eeKeys.ts. Fire-and-forget:
        // nothing below waits on it.
        //
        // After the ownership check, deliberately, and for the same reason
        // mobile publishes inside its own established gate: a displaced
        // session is still inside the session rule's 120-second allowance, so
        // its writes are not always denied, and a device on its way out has no
        // business writing what this account advertises.
        republishKeyIfAccountHasNone(user.uid);
        setSessionReady(true);
      })
      .catch(() => {
        // Never strand the user on a loader because of a transient failure —
        // the live listener still covers a genuine takeover.
        if (!cancelled) setSessionReady(true);
      });

    const unsubscribe = listenForSessionTakeover(user.uid, () => {
      if (!cancelled) signOutDisplaced();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  // A successful sign-in clears the previous "you were signed out" notice.
  useEffect(() => {
    if (user) setDisplaced(false);
  }, [user]);

  return (
    <>
      <CipherTexture />
      <ConnectionBanner />
      {loading ? (
        <FullscreenLoader />
      ) : user ? (
        sessionReady ? (
          <Suspense fallback={<FullscreenLoader />}>
            <MainApp user={user} />
          </Suspense>
        ) : (
          <FullscreenLoader />
        )
      ) : (
        <LoginScreen displaced={displaced} />
      )}
      {/* Overlays whatever's above rather than gating it, so its closing fade
          reveals the real page instead of cutting from a blank screen to it.
          Mounted once, here, for the same reason: gating loading/login/main
          each with their own cold open would remount it as the branch above
          switches, restarting the sequence. */}
      {!coldOpenDone && <ColdOpen onDone={() => setColdOpenDone(true)} />}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loader: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
};
