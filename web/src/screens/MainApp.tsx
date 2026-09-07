import {Suspense, lazy, useCallback, useEffect, useRef, useState} from 'react';
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
import {useKeyboardShortcuts} from '../hooks/useKeyboardShortcuts';
import {emitShortcut, type ShortcutId} from '../services/shortcuts';
import FriendsModal from '../components/FriendsModal';
import ShortcutsHelp from '../components/ShortcutsHelp';
import QuickSwitcher from '../components/QuickSwitcher';
import HomeScreen from './HomeScreen';
import CallProvider from '../call/CallProvider';
import TourOverlay from '../components/TourOverlay';

// Moments and Profile load on demand — they're not the default tab, so their
// code (and the Moments/Friends Firestore paths) stay out of the initial chunk.
const ProfileScreen = lazy(() => import('./ProfileScreen'));

const ICONS: Record<Tab, React.ReactNode> = {
  chats: (
    <path
      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  profile: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

const TAB_KEYS = ['chats', 'profile'] as const satisfies readonly Tab[];

export default function MainApp({user}: {user: User}) {
  const {route, navigate} = useHashRoute();
  const tab = route.tab;
  const setTab = (key: Tab) => navigate({tab: key, chatId: undefined});
  const isMobile = useIsMobile();
  const {t} = useT();
  const unread = useChatNotifications(user.uid, route.chatId ?? null);
  useReminders(user.uid);
  const me = {uid: user.uid, name: user.displayName || 'Me'};

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

  // ---- Keyboard shortcuts ---------------------------------------------------
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);

  const onShortcut = useCallback(
    (id: ShortcutId) => {
      // While the help overlay is up it is the only thing that should respond:
      // '?' toggles it back off (as its own hint promises) and Escape closes
      // it, but Ctrl+K must not yank focus to a search box hidden behind it.
      // An earlier version disabled the whole hook instead, which also killed
      // the '?' that was supposed to close it. QuickSwitcher gets the same
      // gate for the same reason — Cmd+2 shouldn't switch tabs underneath it.
      if (shortcutsOpen && id !== 'help' && id !== 'closeOrClear') return;
      if (quickSwitcherOpen && id !== 'closeOrClear') return;

      switch (id) {
        case 'help':
          setShortcutsOpen(open => !open);
          return;
        case 'search':
          // Cmd+K used to just focus HomeScreen's inline search box, which
          // meant it silently did nothing from any tab but Chats — that box,
          // and its shortcut listener, only exist while HomeScreen is
          // mounted. QuickSwitcher is its own overlay, so it works everywhere.
          setQuickSwitcherOpen(true);
          return;
        case 'tabChats':
          navigate({tab: 'chats', chatId: undefined});
          return;
        case 'tabFriends':
          setFriendsOpen(true);
          return;
        case 'tabProfile':
          navigate({tab: 'profile', chatId: undefined});
          return;
        case 'closeOrClear':
          // Only the help overlay is the shell's to close — every other dialog
          // handles its own Escape in the capture phase and stops propagation,
          // so this never runs for them.
          setShortcutsOpen(false);
          setQuickSwitcherOpen(false);
          emitShortcut(id);
          return;
        default:
          // Chat-list shortcuts belong to HomeScreen, which owns the filtered,
          // ordered list the user is actually looking at.
          if (route.tab !== 'chats') navigate({tab: 'chats'});
          emitShortcut(id);
      }
    },
    [navigate, route.tab, shortcutsOpen, quickSwitcherOpen],
  );

  useKeyboardShortcuts(onShortcut);

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
      {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}
      {/* Rehoused from the Moments screen, which is gone. Contacts are not a
          feed, and they were only ever in there because the feed needed them
          to decide who could see a post. */}
      {friendsOpen && <FriendsModal myUid={user.uid} onClose={() => setFriendsOpen(false)} />}
      {quickSwitcherOpen && (
        <QuickSwitcher
          myUid={user.uid}
          onClose={() => setQuickSwitcherOpen(false)}
          onSelect={chatId => navigate({tab: 'chats', chatId})}
        />
      )}
      {tab === 'profile' && <ProfileScreen user={user} />}
    </Suspense>
  );

  return (
    <CallProvider user={me}>
      {isMobile ? (
        <div style={styles.mobileShell}>
          <div style={styles.mobileContent} role="main">{content}</div>
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
            <button
              type="button"
              className="brand-btn"
              style={styles.brandBtn}
              title={t('nav.chats')}
              onClick={() => setTab('chats')}>
              <BrandMark size={40} />
            </button>
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
          <div role="main" style={styles.mainContent}>
            {content}
          </div>
        </div>
      )}

      {tourOpen && <TourOverlay onClose={closeTour} />}
    </CallProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {height: '100%', display: 'flex'},
  brandBtn: {
    marginBottom: 12,
    padding: 0,
    border: 'none',
    background: 'none',
    display: 'flex',
    cursor: 'pointer',
  },
  tabLoading: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'},
  mobileShell: {height: '100%', display: 'flex', flexDirection: 'column'},
  mobileContent: {flex: 1, minHeight: 0, display: 'flex'},
  mainContent: {flex: 1, minWidth: 0, display: 'flex'},
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
