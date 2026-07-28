import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {createCall, endCall, listenLatestCall, type CallSession, type CallType} from '../services/call';
import {getUserById, listenChatsForUser, logMissedCall} from '../services/chat';
import {deliverDueScheduledMessages} from '../services/scheduledMessages';
import CallModal from '../components/CallModal';
import IncomingCall from '../components/IncomingCall';
import {createRingtone} from './ringtone';

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
  /** Camera state chosen on the answer screen, before the call opened. */
  camOn: boolean;
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
  const [ringAudible, setRingAudible] = useState(true);
  const handled = useRef<Set<string>>(new Set());
  const missTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeRef = useRef(active);
  activeRef.current = active;
  const ringtone = useRef(createRingtone());

  // Ring (and flash the tab title) for as long as a call is pending. The title
  // alert matters because the ringtone is silenced by autoplay policy until the
  // page has seen a user gesture — a background tab may have never had one.
  useEffect(() => {
    if (!incoming || active) return;

    let cancelled = false;
    ringtone.current.start().then(ok => {
      if (!cancelled) setRingAudible(ok);
    });

    if (navigator.vibrate) navigator.vibrate([400, 200, 400]);

    const original = document.title;
    let on = false;
    const flash = setInterval(() => {
      on = !on;
      document.title = on ? `📞 ${incoming.otherName}…` : original;
    }, 900);

    return () => {
      cancelled = true;
      ringtone.current.stop();
      clearInterval(flash);
      document.title = original;
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [incoming, active]);

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
      setActive({chatId, callId, isCaller: true, type, otherName, camOn: type === 'video'});
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

  const acceptIncoming = ({camOn}: {camOn: boolean}) => {
    if (!incoming) return;
    handled.current.add(incoming.session.id);
    clearMissTimer(incoming.session.id);
    setActive({
      chatId: incoming.session.chatId,
      callId: incoming.session.id,
      isCaller: false,
      type: incoming.session.type,
      otherName: incoming.otherName,
      camOn,
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
        <IncomingCall
          callerName={incoming.otherName}
          type={incoming.session.type}
          audible={ringAudible}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {active && (
        <CallModal
          chatId={active.chatId}
          callId={active.callId}
          isCaller={active.isCaller}
          type={active.type}
          me={user}
          otherName={active.otherName}
          initialCamOn={active.camOn}
          onClose={() => setActive(null)}
        />
      )}
    </Ctx.Provider>
  );
}
