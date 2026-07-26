import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {colors} from '../theme';
import {createCall, endCall, listenLatestCall, type CallSession, type CallType} from '../services/call';
import {getUserById, listenChatsForUser, logMissedCall} from '../services/chat';
import {deliverDueScheduledMessages} from '../services/scheduledMessages';
import CallModal from '../components/CallModal';

// If a call is still ringing this long after it started, the recipient logs it
// as missed on the caller's behalf (covers the caller's tab dying mid-ring).
const RING_TIMEOUT_MS = 45_000;
// Calls left ringing longer than this are treated as ancient junk — cleaned up
// silently rather than surfaced as a fresh "missed call".
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

interface ActiveCall {
  chatId: string;
  callId: string;
  isCaller: boolean;
  type: CallType;
  otherName: string;
}

interface CallCtx {
  startCall: (chatId: string, otherUid: string, otherName: string, type: CallType) => Promise<void>;
}

const Ctx = createContext<CallCtx | null>(null);

export function useCall() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

export default function CallProvider({
  user,
  children,
}: {
  user: {uid: string; name: string};
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [incoming, setIncoming] = useState<{session: CallSession; otherName: string} | null>(null);
  const [chatIds, setChatIds] = useState<string[]>([]);
  const handled = useRef<Set<string>>(new Set());
  const missTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeRef = useRef(active);
  activeRef.current = active;

  // Track the user's chats so we can watch each for an incoming call.
  useEffect(() => listenChatsForUser(user.uid, chats => setChatIds(chats.map(c => c.id))), [user.uid]);

  // Deliver due scheduled messages across ALL the user's chats while the app is
  // open — mirrors the (undeployed) processScheduledMessages Cloud Function, so
  // it isn't tied to any one chat being open.
  useEffect(() => {
    if (!chatIds.length) return;
    const sweep = () => {
      if (document.visibilityState === 'hidden') return;
      chatIds.forEach(id => deliverDueScheduledMessages(id, user.uid).catch(() => undefined));
    };
    sweep();
    const id = setInterval(sweep, 30_000);
    return () => clearInterval(id);
  }, [chatIds, user.uid]);

  /**
   * Logs a missed-call notice (idempotent, keyed to the call id) on the caller's
   * behalf and ends the call doc. Runs on the RECIPIENT's client, so an
   * unanswered call is recorded even if the caller's tab died mid-ring — no
   * Cloud Function needed.
   */
  const logMiss = useCallback((call: CallSession, callerName: string) => {
    if (handled.current.has(call.id)) return;
    handled.current.add(call.id);
    const tm = missTimers.current[call.id];
    if (tm) {
      clearTimeout(tm);
      delete missTimers.current[call.id];
    }
    setIncoming(prev => (prev?.session.id === call.id ? null : prev));
    logMissedCall(call.chatId, call.id, {uid: call.createdBy, name: callerName}, call.type).catch(
      () => undefined,
    );
    endCall(call.chatId, call.id).catch(() => undefined);
  }, []);

  // Watch the latest call in each chat: surface incoming rings AND sweep stale
  // ones into missed-call notices (both live and on app-open).
  useEffect(() => {
    const unsubs = chatIds.map(chatId =>
      listenLatestCall(chatId, async call => {
        if (!call) return;

        // Not ringing → stop tracking (answered or ended).
        if (call.status !== 'ringing') {
          const tm = missTimers.current[call.id];
          if (tm) {
            clearTimeout(tm);
            delete missTimers.current[call.id];
          }
          if (call.status === 'ended') {
            setIncoming(prev => (prev?.session.id === call.id ? null : prev));
          }
          return;
        }

        // Only the recipient sweeps (the caller has its own timeout).
        const forMe = call.createdBy !== user.uid && call.participants.includes(user.uid);
        if (!forMe || handled.current.has(call.id)) return;

        const createdMs = call.createdAt?.toMillis?.() ?? Date.now();
        const age = Date.now() - createdMs;

        if (age > MAX_STALE_MS) {
          handled.current.add(call.id);
          endCall(call.chatId, call.id).catch(() => undefined); // ancient junk — clean up quietly
          return;
        }

        const other = await getUserById(call.createdBy);
        const callerName = other?.displayName || other?.email || 'Someone';

        if (age >= RING_TIMEOUT_MS) {
          logMiss(call, callerName); // stale on arrival (on-open, or caller gone)
          return;
        }

        // Fresh ring: show the banner (unless already in a call) and arm the
        // fallback timer for the remaining time.
        if (!activeRef.current) setIncoming({session: call, otherName: callerName});
        if (!missTimers.current[call.id]) {
          missTimers.current[call.id] = setTimeout(() => logMiss(call, callerName), RING_TIMEOUT_MS - age);
        }
      }),
    );
    return () => {
      unsubs.forEach(u => u());
      Object.values(missTimers.current).forEach(clearTimeout);
      missTimers.current = {};
    };
  }, [chatIds, user.uid, logMiss]);

  const startCall = useCallback(
    async (chatId: string, otherUid: string, otherName: string, type: CallType) => {
      const callId = await createCall(chatId, user.uid, otherUid, type);
      setActive({chatId, callId, isCaller: true, type, otherName});
    },
    [user.uid],
  );

  const clearMissTimer = (callId: string) => {
    const tm = missTimers.current[callId];
    if (tm) {
      clearTimeout(tm);
      delete missTimers.current[callId];
    }
  };

  const acceptIncoming = () => {
    if (!incoming) return;
    handled.current.add(incoming.session.id);
    clearMissTimer(incoming.session.id);
    setActive({
      chatId: incoming.session.chatId,
      callId: incoming.session.id,
      isCaller: false,
      type: incoming.session.type,
      otherName: incoming.otherName,
    });
    setIncoming(null);
  };

  const declineIncoming = () => {
    if (!incoming) return;
    // A decline is a missed call for the caller — log it, then end the call.
    logMiss(incoming.session, incoming.otherName);
  };

  return (
    <Ctx.Provider value={{startCall}}>
      {children}

      {incoming && !active && (
        <div style={styles.incoming}>
          <div style={styles.incomingAvatar}>{incoming.otherName.charAt(0).toUpperCase()}</div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={styles.incomingName}>{incoming.otherName}</div>
            <div style={styles.incomingSub}>
              Incoming {incoming.session.type === 'video' ? 'video' : 'voice'} call…
            </div>
          </div>
          <button style={styles.decline} onClick={declineIncoming}>
            Decline
          </button>
          <button style={styles.accept} onClick={acceptIncoming}>
            Accept
          </button>
        </div>
      )}

      {active && (
        <CallModal
          chatId={active.chatId}
          callId={active.callId}
          isCaller={active.isCaller}
          type={active.type}
          me={user}
          otherName={active.otherName}
          onClose={() => setActive(null)}
        />
      )}
    </Ctx.Provider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  incoming: {
    position: 'fixed',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: '12px 16px',
    boxShadow: '0 20px 50px -15px rgba(20,30,60,0.35)',
    zIndex: 50,
    minWidth: 360,
  },
  incomingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    background: colors.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  incomingName: {fontWeight: 700, color: colors.text},
  incomingSub: {fontSize: 13, color: colors.textSecondary},
  decline: {
    padding: '9px 16px',
    borderRadius: 999,
    border: `1px solid ${colors.danger}`,
    background: 'transparent',
    color: colors.danger,
    fontWeight: 700,
  },
  accept: {
    padding: '9px 18px',
    borderRadius: 999,
    border: 'none',
    background: colors.success,
    color: '#fff',
    fontWeight: 700,
  },
};
