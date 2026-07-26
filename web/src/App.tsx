import {Suspense, lazy, useEffect, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {auth} from './firebase';
import {colors} from './theme';
import {useT} from './i18n';
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

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <ConnectionBanner />
      {loading ? (
        <FullscreenLoader />
      ) : user ? (
        <Suspense fallback={<FullscreenLoader />}>
          <MainApp user={user} />
        </Suspense>
      ) : (
        <LoginScreen />
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
