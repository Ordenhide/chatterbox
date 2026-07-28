import {Suspense, lazy, useEffect, useRef, useState} from 'react';
import type {User} from 'firebase/auth';
import {colors} from '../theme';
import {useT} from '../i18n';
import BrandMark from '../components/BrandMark';
import {heartbeat} from '../services/presence';
import {useIsMobile} from '../hooks/useIsMobile';
import {useHashRoute, type Tab} from '../hooks/useHashRoute';
import {useChatNotifications} from '../hooks/useChatNotifications';
import {useReminders} from '../hooks/useReminders';
import {useIncomingRequests} from '../hooks/useIncomingRequests';
import {useToast} from '../context/ToastContext';
import {hasSeenTour, markTourSeen, TOUR_EVENT} from '../services/tour';
import HomeScreen from './HomeScreen';
import CallProvider from '../call/CallProvider';
import TourOverlay from '../components/TourOverlay';

// Moments and Profile load on demand — they're not the default tab, so their
// code (and the Moments/Friends Firestore paths) stay out of the initial chunk.
const MomentsScreen = lazy(() => import('./MomentsScreen'));
const ProfileScreen = lazy(() => import('./ProfileScreen'));

const ICONS: Record<Tab, React.ReactNode> = {
  chats: (
    <path
      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  moments: (
    <>
      <path
        d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  profile: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

const TAB_KEYS = ['chats', 'moments', 'profile'] as const;

export default function MainApp({user}: {user: User}) {
  const {route, navigate} = useHashRoute();
  const tab = route.tab;
  const setTab = (key: Tab) => navigate({tab: key, chatId: undefined});
  const isMobile = useIsMobile();
  const {t} = useT();
  const unread = useChatNotifications(user.uid, route.chatId ?? null);
  useReminders(user.uid);
  const me = {uid: user.uid, name: user.displayName || user.email || 'Me'};

  // Live incoming friend-request count → badge on the Moments tab (where the
  // Friends screen lives) + a toast when a new one arrives.
  const friendRequests = useIncomingRequests(user.uid);
  const requestCount = friendRequests.length;
  const toast = useToast();
  const prevRequests = useRef<number | null>(null);
  useEffect(() => {
    if (prevRequests.current !== null && requestCount > prevRequests.current) {
      toast.show(t('friends.newRequestToast'));
    }
    prevRequests.current = requestCount;
  }, [requestCount, toast, t]);

  // Guided tour: auto-runs once on first login, and re-runs on demand (Profile →
  // "Replay tutorial", which fires TOUR_EVENT).
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());
  useEffect(() => {
    const open = () => setTourOpen(true);
    window.addEventListener(TOUR_EVENT, open);
    return () => window.removeEventListener(TOUR_EVENT, open);
  }, []);
  const closeTour = () => {
    markTourSeen();
    setTourOpen(false);
  };

  const TABS: {key: Tab; label: string}[] = TAB_KEYS.map(key => ({
    key,
    label: t(`nav.${key}` as 'nav.chats'),
  }));

  // Reflect the unread count in the browser tab title.
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Chatterbox` : 'Chatterbox';
    return () => {
      document.title = 'Chatterbox';
    };
  }, [unread]);

  const navIcon = (key: Tab) => (
    <span className="nav-icon">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.9}>
        {ICONS[key]}
      </svg>
      {key === 'chats' && unread > 0 && (
        <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>
      )}
      {key === 'moments' && requestCount > 0 && (
        <span className="nav-badge">{requestCount > 99 ? '99+' : requestCount}</span>
      )}
    </span>
  );

  // Presence heartbeat while the tab is open/visible.
  useEffect(() => {
    heartbeat(user.uid);
    const beat = () => document.visibilityState === 'visible' && heartbeat(user.uid);
    const id = setInterval(beat, 45_000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [user.uid]);

  const content = (
    <Suspense fallback={<div style={styles.tabLoading}><span className="spinner" /></div>}>
      {tab === 'chats' && (
        <HomeScreen
          user={user}
          selectedId={route.chatId ?? null}
          onSelectChat={id => navigate({tab: 'chats', chatId: id ?? undefined})}
        />
      )}
      {tab === 'moments' && <MomentsScreen user={user} requestCount={requestCount} />}
      {tab === 'profile' && <ProfileScreen user={user} />}
    </Suspense>
  );

  return (
    <CallProvider user={me}>
      {isMobile ? (
        <div style={styles.mobileShell}>
          <div style={styles.mobileContent}>{content}</div>
          <nav style={styles.bottomBar}>
            {TABS.map(t => (
              <button
                key={t.key}
                data-tour={`nav-${t.key}`}
                className={`tab-btn${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}>
                {navIcon(t.key)}
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div style={styles.shell}>
          <nav style={styles.rail}>
            <div style={{marginBottom: 12}}>
              <BrandMark size={40} />
            </div>
            {TABS.map(t => (
              <button
                key={t.key}
                title={t.label}
                data-tour={`nav-${t.key}`}
                className={`rail-btn${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}>
                {navIcon(t.key)}
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          {content}
        </div>
      )}

      {tourOpen && <TourOverlay onClose={closeTour} />}
    </CallProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {height: '100%', display: 'flex'},
  tabLoading: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'},
  mobileShell: {height: '100%', display: 'flex', flexDirection: 'column'},
  mobileContent: {flex: 1, minHeight: 0, display: 'flex'},
  rail: {
    width: 78,
    flexShrink: 0,
    background: colors.surface,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '16px 0',
  },
  bottomBar: {
    flexShrink: 0,
    display: 'flex',
    background: colors.surfaceStrong,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderTop: `1px solid ${colors.border}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
};
