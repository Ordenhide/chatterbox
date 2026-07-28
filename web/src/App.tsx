import {Suspense, lazy, useEffect, useState} from 'react';
import {onAuthStateChanged, signOut, type User} from 'firebase/auth';
import {auth} from './firebase';
import {colors} from './theme';
import {useT} from './i18n';
import {listenForSessionTakeover, verifyOrAdoptSession} from './services/session';
import BrandMark from './components/BrandMark';
import ConnectionBanner from './components/ConnectionBanner';
import LoginScreen from './screens/LoginScreen';

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
      signOut(auth).catch(() => undefined);
    };

    verifyOrAdoptSession(user.uid)
      .then(owned => {
        if (cancelled) return;
        if (!owned) {
          // Another device claimed the account while this tab was away.
          signOutDisplaced();
          return;
        }
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

  if (loading) return <FullscreenLoader />;

  return (
    <>
      <ConnectionBanner />
      {user ? (
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
