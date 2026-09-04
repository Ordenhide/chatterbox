import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {avatarColor, colors} from '../theme';
import {
  burnMessage,
  deleteChat,
  deleteMessage,
  deleteMessages,
  editMessage,
  EXPIRY_OPTIONS,
  fetchOlderMessages,
  getChat,
  getInitialUnread,
  listenChat,
  listenMessages,
  markChatRead,
  markViewOnceViewed,
  revealBurnMessage,
  sendMessage,
  setChatExpiryPolicy,
  setMessageLinkPreview,
  setTyping,
  sweepExpiredMessages,
  toggleMuteChat,
  togglePinChat,
  togglePinMessage,
  toggleReaction,
  type MessageCursor,
  type OutgoingMedia,
} from '../services/chat';
import {
  describeUploadError,
  encodeInlineMedia,
  extensionForMime,
  logUploadError,
  uploadChatBlob,
  uploadChatFile,
  uploadChatImage,
} from '../services/storage';
import {listenPresence, ONLINE_WINDOW_MS} from '../services/presence';
import {hasLostPeer, isProfileDeleted, isRecipientUnreachable} from '../services/recipient';
import {isSealed, openSealed, sealForRecipients, type EnvelopeRecipient} from '../services/e2ee';
import {
  EncryptionUnavailableError,
  fetchPeerPublicKeyChecked,
  getKeyGeneration,
  getDeviceKeypairIfEnrolled,
  getOrCreateDeviceKeypair,
  isEncryptionUnavailable,
} from '../services/e2eeKeys';
import {makeArtifactCrypto} from '../services/e2eeArtifacts';
import {sealAndSendText} from '../services/e2eeMessages';
import {
  buildLinkPreviewPatch,
  extractFirstUrl,
  hasPreviewContent,
  isLinkPreviewEnabled,
  normalizePreview,
  parsePreview,
  type LinkPreviewData,
} from '../services/linkPreview';
import {
  listenLiveLocation,
  shouldSendLocationUpdate,
  startSharingLocation,
  stopSharingLocation,
  updateSharedLocation,
  type LiveLocationShare,
} from '../services/liveLocation';
import {useEntitlement} from '../context/EntitlementContext';
import {safeExternalUrl} from '../utils/safeUrl';
import {formatDayLabel, isSameDay} from '../utils/messageDay';
import ProUpsellModal from './ProUpsellModal';
import RecentlyDeletedModal from './RecentlyDeletedModal';
import {getCurrentPosition, watchMyPosition, LocationError} from '../utils/geolocation';
import {formatCoordinates, staticMapTileUrl} from '../utils/mapTile';
import ShareLocationModal from './ShareLocationModal';
import {addBookmark} from '../services/bookmarks';
import {fetchLinkPreview, summarizeChat, transcribeVoiceMessage, translateMessage} from '../services/ai';
import {isAiConsentError} from '../services/aiConsent';
import AiConsentModal from './AiConsentModal';
import {getDraft, setDraft} from '../services/drafts';
import {
  cancelScheduledMessage,
  deliverDueScheduledMessages,
  listenScheduledMessages,
  scheduleMessage,
  type ScheduledMessage,
} from '../services/scheduledMessages';
import type {GifResult} from '../services/gifSearch';
import {getSmartReplies} from '../services/smartReply';
import {createReminder} from '../services/reminders';
import {useCall} from '../call/CallProvider';
import {useToast} from '../context/ToastContext';
import {useLightbox} from '../context/LightboxContext';
import {useT, type TKey} from '../i18n';
import {cycleBurnDuration, formatBurnDuration} from '../utils/ephemeral';
import LinkPreviewCard from './LinkPreviewCard';
import {celebrate, useReactionBurst} from './ReactionBurst';
import MessageMotion from './MessageMotion';
import CipherText from './CipherText';
import QuickSwitcher from './QuickSwitcher';
import Icon from './Icon';
import AudioMessage from './AudioMessage';
import WhiteboardModal from './WhiteboardModal';
import GifPicker from './GifPicker';
import GroupMembersModal from './GroupMembersModal';
import ChatLockModal from './ChatLockModal';
import ReportMessageModal from './ReportMessageModal';
import {isChatLocked} from '../services/appLock';
import {useDismissOnOutside} from '../hooks/useDismissOnOutside';
import ChatSettingsModal from './ChatSettingsModal';
import ChatMediaModal from './ChatMediaModal';
import PlaylistModal from './PlaylistModal';
import CountdownModal from './CountdownModal';
import SharedListsModal from './SharedListsModal';
import VerifyContactModal from './VerifyContactModal';
import type {ChatMessage, ChatRoom, Reminder} from '../types';

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '🔥'];
const TYPING_WINDOW_MS = 6000;
const GROUP_WINDOW_MS = 5 * 60 * 1000; // consecutive-message grouping window

/** Opus at voice grade — ~4 KB/s, so ~60s fits the Firestore inline budget. */
const VOICE_BITRATE = 32_000;

/**
 * First container the browser admits to supporting.
 *
 * AAC/MP4 is tried first for cross-platform reasons, not browser ones: iOS
 * plays voice messages through AVAudioPlayer, which cannot decode Opus/WebM at
 * all. Recording MP4 where possible means a clip sent from the web plays on a
 * phone. WebM remains the fallback for browsers that will not record MP4
 * (notably Firefox) — those clips still play on web and Android.
 *
 * Safari only ever records audio/mp4, so hardcoding webm previously produced a
 * blob mislabelled with a type it could not decode.
 */
const VOICE_MIME = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(
  type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type),
);

export default function ChatPane({
  chatId,
  title,
  me,
  onDeleted,
  onBack,
}: {
  chatId: string;
  title: string;
  me: {uid: string; name: string};
  onDeleted: () => void;
  onBack?: () => void;
}) {
  const {t, lang} = useT();
  const toast = useToast();
  const lightbox = useLightbox();
  const {startCall} = useCall();
  const {isPro} = useEntitlement();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<ChatRoom | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  /** Text of the send currently in flight, for synchronous double-submit detection. */
  const inFlightTextRef = useRef<string | null>(null);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showLockSettings, setShowLockSettings] = useState(false);
  // Gate state is per-mount and keyed by chat: switching to a locked chat must
  // re-challenge rather than inherit the previous chat's unlocked state.
  const [unlockedChatId, setUnlockedChatId] = useState<string | null>(null);
  const menuWrapRef = useDismissOnOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryQuestion, setSummaryQuestion] = useState('');
  const [summaryAskedQuestion, setSummaryAskedQuestion] = useState('');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);
  const [editing, setEditing] = useState<{id: string; text: string} | null>(null);
  const [dragging, setDragging] = useState(false);
  const [otherLastActive, setOtherLastActive] = useState<number | null>(null);
  const [burnMode, setBurnMode] = useState(false);
  const [burnDuration, setBurnDuration] = useState(10);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [burnCountdowns, setBurnCountdowns] = useState<Record<string, number>>({});
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  // The message currently being forwarded — set while the destination-chat
  // picker (QuickSwitcher, reused) is open, null otherwise.
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    messageId: string;
    authorUid: string;
    content: string;
  } | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [showScheduled, setShowScheduled] = useState(false);
  const [mention, setMention] = useState<{query: string; start: number} | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reactionOpen, setReactionOpen] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  // Set when an AI call is refused for want of consent; holds the action to
  // re-run once the disclosure is accepted, so the user isn't made to repeat
  // whatever they were doing.
  const [aiConsentRetry, setAiConsentRetry] = useState<(() => void) | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [reminderFor, setReminderFor] = useState<ChatMessage | null>(null);
  const [reminderAt, setReminderAt] = useState('');
  const [peerKeyChanged, setPeerKeyChanged] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [peerProfileGone, setPeerProfileGone] = useState(false);
  const [proPromptOpen, setProPromptOpen] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [shareLocationModalOpen, setShareLocationModalOpen] = useState(false);
  const [peerLiveLocation, setPeerLiveLocation] = useState<LiveLocationShare | null>(null);
  const draftLoadedRef = useRef(false);
  const stopLocationWatchRef = useRef<(() => void) | null>(null);
  const lastLocationSentAtRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStartRef = useRef<number>(0);

  const cursorRef = useRef<MessageCursor | null>(null);
  const hasPagedRef = useRef(false);
  const hasMoreRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const atBottomRef = useRef(true);
  const lastSeenIdRef = useRef<string | null>(null);
  const prependAdjustRef = useRef<number | null>(null);
  const burnTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // E2EE: caches of already-resolved plaintext, keyed by message id. `.has(id)`
  // means "already attempted" (success or failure), which is what stops the
  // decrypt effect below from retrying forever — a failed decrypt caches an
  // empty/failure sentinel just like a successful one caches real content.
  // Message ids are random UUIDs (see services/chat.ts), so these never need
  // clearing on chat switch — a collision across chats isn't possible.
  const decryptedTextRef = useRef<Map<string, string>>(new Map());
  const decryptedImageRef = useRef<Map<string, string>>(new Map());
  const decryptedVideoRef = useRef<Map<string, string>>(new Map());
  const decryptedAudioRef = useRef<Map<string, string>>(new Map());
  const decryptedFileUriRef = useRef<Map<string, string>>(new Map());
  // Reaction confetti + the send button's kick. Both are pure feedback, so
  // they live in local state and never touch what gets persisted.
  const {burst} = useReactionBurst();
  const [launching, setLaunching] = useState(false);
  // Link previews decrypt to a JSON blob rather than a URL, so this cache
  // holds the parsed card (or null when the payload is unreadable/invalid).
  const decryptedPreviewRef = useRef<Map<string, LinkPreviewData | null>>(new Map());
  // The caches above are keyed by message id, not by the key that decrypted
  // them, so they'd survive a key change and keep serving results (including
  // "couldn't decrypt" placeholders) produced under the old key. Tracking the
  // generation lets the decrypt pass below drop them when the key changes.
  const decryptKeyGenerationRef = useRef<number>(getKeyGeneration());

  /**
   * Substitutes decrypted (or placeholder) content for any encrypted field a
   * message carries, reading whatever this device has already resolved.
   * Applied wherever raw Firestore data first enters `messages` state (the
   * live listener and loadOlder's page fetch) so a newly-arrived encrypted
   * message shows "🔒 …" immediately instead of a blank bubble, ahead of the
   * async decrypt pass below actually running.
   */
  const withDecryptedPlaceholders = useCallback((m: ChatMessage): ChatMessage => {
    const hasEncryptedImage = isSealed(m.encryptedImage);
    const hasEncryptedVideo = isSealed(m.encryptedVideo);
    const hasEncryptedAudio = isSealed(m.encryptedAudio);
    const hasEncryptedFile = isSealed(m.encryptedFileUri);
    const hasEncryptedText = isSealed(m.encrypted);
    if (!hasEncryptedText && !hasEncryptedImage && !hasEncryptedVideo && !hasEncryptedAudio && !hasEncryptedFile) {
      return m;
    }
    const id = m._id;
    const next: ChatMessage = {...m};
    if (hasEncryptedText) {
      next.text = decryptedTextRef.current.get(id) ?? '🔒 …';
    }
    if (hasEncryptedImage) next.image = decryptedImageRef.current.get(id) || undefined;
    if (hasEncryptedVideo) next.video = decryptedVideoRef.current.get(id) || undefined;
    if (hasEncryptedAudio) next.audio = decryptedAudioRef.current.get(id) || undefined;
    if (hasEncryptedFile) {
      next.file = decryptedFileUriRef.current.has(id)
        ? {...m.file!, uri: decryptedFileUriRef.current.get(id)!}
        : undefined;
    }
    // A media-only message has no `encrypted` text of its own to carry a
    // placeholder, so it would otherwise render as a blank bubble until its
    // media resolves — reuse the same "🔒 …" marker there.
    if (
      !hasEncryptedText &&
      (hasEncryptedImage || hasEncryptedVideo || hasEncryptedAudio || hasEncryptedFile) &&
      !decryptedImageRef.current.has(id) &&
      !decryptedVideoRef.current.has(id) &&
      !decryptedAudioRef.current.has(id) &&
      !decryptedFileUriRef.current.has(id)
    ) {
      next.text = '🔒 …';
    }
    return next;
  }, []);

  // ---- Subscribe to messages + chat doc; reset paging on chat switch --------
  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setNewCount(0);
    setAtBottom(true);
    setUnreadAtOpen(0);
    setReplyTarget(null);
    setMention(null);
    cursorRef.current = null;
    hasPagedRef.current = false;
    hasMoreRef.current = false;
    atBottomRef.current = true;
    lastSeenIdRef.current = null;
    prependAdjustRef.current = null;

    // Restore any saved draft for this chat.
    draftLoadedRef.current = false;
    setText(getDraft(me.uid, chatId));
    draftLoadedRef.current = true;

    getInitialUnread(chatId, me.uid).then(setUnreadAtOpen);

    const unsubMsgs = listenMessages(chatId, (liveMsgs, oldest, maybeMore) => {
      // service returns newest-first; substitute placeholders for anything
      // encrypted before it ever lands in state (see withDecryptedPlaceholders).
      const liveChrono = [...liveMsgs].reverse().map(withDecryptedPlaceholders);
      // Boundary = oldest *resolved* time in the live window; ignore pending
      // (just-sent) messages, which belong at the newest end, not the oldest.
      const resolved = liveChrono
        .map(m => m.createdAt?.toMillis?.())
        .filter((x): x is number => typeof x === 'number');
      const liveOldestMs = resolved.length ? Math.min(...resolved) : 0;
      setMessages(prev => {
        const older = prev.filter(m => (m.createdAt?.toMillis?.() ?? Infinity) < liveOldestMs);
        const map = new Map<string, ChatMessage>();
        for (const m of [...older, ...liveChrono]) map.set(m._id, m);
        return sortByTime(Array.from(map.values()));
      });
      if (!hasPagedRef.current) {
        cursorRef.current = oldest;
        hasMoreRef.current = maybeMore;
        setHasMore(maybeMore);
      }
    });
    const unsubChat = listenChat(chatId, setChat);
    markChatRead(chatId, me.uid).catch(() => undefined);
    return () => {
      unsubMsgs();
      unsubChat();
    };
  }, [chatId, me.uid]);

  // ---- Scroll management: pin to bottom / restore on prepend / new badge -----
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prependAdjustRef.current != null) {
      el.scrollTop = el.scrollHeight - prependAdjustRef.current;
      prependAdjustRef.current = null;
      return;
    }
    const lastId = messages[messages.length - 1]?._id;
    if (lastId && lastId !== lastSeenIdRef.current) {
      const mine = messages[messages.length - 1]?.user?._id === me.uid;
      if (atBottomRef.current || mine) {
        endRef.current?.scrollIntoView({block: 'end'});
        setNewCount(0);
      } else {
        setNewCount(c => c + 1);
      }
      lastSeenIdRef.current = lastId;
    }
  }, [messages, me.uid]);

  useEffect(() => {
    markChatRead(chatId, me.uid).catch(() => undefined);
  }, [messages, chatId, me.uid]);

  // Persist the composer draft (debounced) so it survives reloads / tab close.
  useEffect(() => {
    if (!draftLoadedRef.current || editing) return;
    const id = setTimeout(() => setDraft(me.uid, chatId, text), 400);
    return () => clearTimeout(id);
  }, [text, chatId, me.uid, editing]);

  // Live list of my own pending scheduled messages in this chat (for the composer
  // UI — it is an outbox, and only its author can cancel one).
  // Actual *delivery* runs globally in CallProvider so it isn't tied to this chat
  // being open — but sweep once on open too for immediacy.
  useEffect(() => {
    deliverDueScheduledMessages(chatId, me.uid).catch(() => undefined);
    let live = true;
    // The bodies are sealed to the recipients, so showing the author their own
    // pending message means opening it. openSealed handles that: the sender has
    // no copy addressed to them, and openEnvelope falls back to any copy for
    // exactly this case. A body that won't open shows as empty rather than as
    // ciphertext — the row still carries its time and its cancel button.
    const unsub = listenScheduledMessages(chatId, me.uid, async msgs => {
      // Read-only: a scheduled-message preview must never be the thing that
      // enrolls this browser. Null flows into the `!secretKey` branch below,
      // which already renders the row without its body.
      const secretKey = await getDeviceKeypairIfEnrolled(me.uid)
        .then(k => k?.secretKey ?? null)
        .catch(() => null);
      const shown = msgs.map(m => {
        if (!m.encrypted || !secretKey) return m;
        try {
          return {...m, text: openSealed(m.encrypted, secretKey, me.uid, chatId)};
        } catch {
          return {...m, text: ''};
        }
      });
      if (live) setScheduled(shown);
    });
    return () => {
      live = false;
      unsub();
    };
  }, [chatId, me.uid]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreRef.current || !cursorRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    prependAdjustRef.current = el ? el.scrollHeight - el.scrollTop : null;
    try {
      const {messages: older, oldest, maybeMore} = await fetchOlderMessages(chatId, cursorRef.current);
      hasPagedRef.current = true;
      if (oldest) cursorRef.current = oldest;
      hasMoreRef.current = maybeMore;
      setHasMore(maybeMore);
      if (older.length) {
        const olderChrono = [...older].reverse().map(withDecryptedPlaceholders);
        setMessages(prev => {
          const map = new Map<string, ChatMessage>();
          for (const m of [...olderChrono, ...prev]) if (!map.has(m._id)) map.set(m._id, m);
          return sortByTime(Array.from(map.values()));
        });
      } else {
        prependAdjustRef.current = null;
      }
    } catch (err) {
      console.warn('loadOlder failed:', err);
      prependAdjustRef.current = null;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [chatId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    atBottomRef.current = nearBottom;
    setAtBottom(nearBottom);
    if (nearBottom) setNewCount(0);
    if (el.scrollTop < 80) loadOlder();
  };

  const jumpToLatest = () => {
    endRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
    setNewCount(0);
  };

  // ---- Ephemeral: burn-after-reading countdowns -----------------------------
  const startBurnCountdown = useCallback(
    (messageId: string, duration: number, startedAt: number) => {
      const key = String(messageId);
      if (burnTimersRef.current[key]) return;
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      if (remaining <= 0) {
        burnMessage(chatId, key, me.uid).catch(() => undefined);
        return;
      }
      setBurnCountdowns(prev => ({...prev, [key]: remaining}));
      burnTimersRef.current[key] = setInterval(() => {
        setBurnCountdowns(prev => {
          const left = (prev[key] ?? remaining) - 1;
          if (left <= 0) {
            clearInterval(burnTimersRef.current[key]);
            delete burnTimersRef.current[key];
            burnMessage(chatId, key, me.uid).catch(() => undefined);
            const {[key]: _removed, ...rest} = prev;
            return rest;
          }
          return {...prev, [key]: left};
        });
      }, 1000);
    },
    [chatId, me.uid],
  );

  // Resume countdowns for any already-revealed (but not burned) burn messages —
  // covers both the recipient and the sender, and reloads mid-countdown.
  useEffect(() => {
    messages.forEach(m => {
      const burn = m.burnAfterReading;
      if (!burn?.burnStartedAt || burn.burned) return;
      if (burnTimersRef.current[m._id]) return;
      startBurnCountdown(m._id, burn.duration, burn.burnStartedAt);
    });
  }, [messages, startBurnCountdown]);

  // Clear all burn timers when leaving the chat / unmounting.
  useEffect(() => {
    const timers = burnTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearInterval);
      burnTimersRef.current = {};
    };
  }, [chatId]);

  /**
   * E2EE: decrypts any message in the current list not already resolved, then
   * patches its plain field(s) in place. Runs after messages have already
   * rendered with their "🔒 …" placeholder (see withDecryptedPlaceholders)
   * rather than blocking on it, so a big page of history doesn't delay the
   * list appearing.
   *
   * Re-scans the full `messages` array on every change, including the
   * setMessages call this same effect makes — that second pass finds nothing
   * left in `toDecrypt` (the ref caches are already populated by then) and
   * exits immediately, so this converges rather than looping.
   */
  useEffect(() => {
    const currentKeyGeneration = getKeyGeneration();
    if (currentKeyGeneration !== decryptKeyGenerationRef.current) {
      decryptKeyGenerationRef.current = currentKeyGeneration;
      decryptedTextRef.current.clear();
      decryptedImageRef.current.clear();
      decryptedVideoRef.current.clear();
      decryptedAudioRef.current.clear();
      decryptedFileUriRef.current.clear();
      decryptedPreviewRef.current.clear();
    }

    const needsDecrypt = (m: ChatMessage) => {
      const id = m._id;
      return (
        (isSealed(m.encrypted) && !decryptedTextRef.current.has(id)) ||
        (isSealed(m.encryptedImage) && !decryptedImageRef.current.has(id)) ||
        (isSealed(m.encryptedVideo) && !decryptedVideoRef.current.has(id)) ||
        (isSealed(m.encryptedAudio) && !decryptedAudioRef.current.has(id)) ||
        (isSealed(m.encryptedFileUri) && !decryptedFileUriRef.current.has(id)) ||
        (isSealed(m.encryptedLinkPreview) && !decryptedPreviewRef.current.has(id))
      );
    };
    const toDecrypt = messages.filter(needsDecrypt);
    if (!toDecrypt.length) return;

    let active = true;
    (async () => {
      try {
        // Emphatically not getOrCreateDeviceKeypair: this effect runs on
        // opening a chat, and minting here would publish a fresh key over the
        // account's real one — orphaning the very messages it is trying to
        // read, and invalidating the user's recovery phrase for good.
        const keypair = await getDeviceKeypairIfEnrolled(me.uid);
        if (!active) return;

        toDecrypt.forEach(m => {
          const id = m._id;
          let mediaFailed = false;

          if (!keypair) {
            // Nothing to decrypt with, so by definition these were sealed to a
            // key held elsewhere. Every cache is filled, the media ones
            // included, so they stop matching needsDecrypt — left unfilled
            // they would re-enter this effect on every snapshot. A successful
            // restore bumps the key generation, which clears them all and
            // re-runs this for real.
            if (isSealed(m.encrypted)) {
              decryptedTextRef.current.set(id, '🔒 Sealed to another device');
            }
            if (isSealed(m.encryptedImage)) decryptedImageRef.current.set(id, '');
            if (isSealed(m.encryptedVideo)) decryptedVideoRef.current.set(id, '');
            if (isSealed(m.encryptedAudio)) decryptedAudioRef.current.set(id, '');
            if (isSealed(m.encryptedFileUri)) decryptedFileUriRef.current.set(id, '');
            if (isSealed(m.encryptedLinkPreview)) decryptedPreviewRef.current.set(id, null);
            if (!isSealed(m.encrypted)) {
              decryptedTextRef.current.set(id, '🔒 Sealed to another device');
            }
            return;
          }
          const {secretKey} = keypair;

          if (isSealed(m.encrypted) && !decryptedTextRef.current.has(id)) {
            try {
              decryptedTextRef.current.set(id, openSealed(m.encrypted, secretKey, me.uid, chatId));
            } catch (err) {
              // Wrong/rotated key, or a payload from before this device
              // enrolled — distinct from "still loading" so it doesn't spin
              // on the placeholder forever.
              console.warn('e2ee decrypt failed:', err);
              decryptedTextRef.current.set(id, '🔒 Unable to decrypt');
            }
          }

          const mediaField = (payload: unknown, cache: React.MutableRefObject<Map<string, string>>) => {
            if (!isSealed(payload) || cache.current.has(id)) return;
            try {
              cache.current.set(id, openSealed(payload, secretKey, me.uid, chatId));
            } catch (err) {
              console.warn('e2ee decrypt failed:', err);
              cache.current.set(id, '');
              mediaFailed = true;
            }
          };
          mediaField(m.encryptedImage, decryptedImageRef);
          mediaField(m.encryptedVideo, decryptedVideoRef);
          mediaField(m.encryptedAudio, decryptedAudioRef);
          mediaField(m.encryptedFileUri, decryptedFileUriRef);

          // A preview that won't decrypt is cached as null rather than left
          // absent, so this doesn't retry it on every render — and a missing
          // card is a far smaller loss than an unreadable message, so it
          // deliberately doesn't count towards mediaFailed.
          if (isSealed(m.encryptedLinkPreview) && !decryptedPreviewRef.current.has(id)) {
            try {
              decryptedPreviewRef.current.set(
                id,
                parsePreview(openSealed(m.encryptedLinkPreview, secretKey, me.uid, chatId)),
              );
            } catch {
              decryptedPreviewRef.current.set(id, null);
            }
          }

          // A media-only message has no `encrypted` text of its own to carry
          // a failure message, so surface it the same way a text decrypt
          // failure does.
          if (mediaFailed && !isSealed(m.encrypted)) {
            decryptedTextRef.current.set(id, '🔒 Unable to decrypt');
          }
        });

        if (active) {
          setMessages(prev =>
            prev.map(item => {
              const id = item._id;
              const patch: Partial<ChatMessage> = {};
              if (decryptedTextRef.current.has(id)) patch.text = decryptedTextRef.current.get(id);
              if (decryptedImageRef.current.has(id)) patch.image = decryptedImageRef.current.get(id) || undefined;
              if (decryptedVideoRef.current.has(id)) patch.video = decryptedVideoRef.current.get(id) || undefined;
              if (decryptedAudioRef.current.has(id)) patch.audio = decryptedAudioRef.current.get(id) || undefined;
              if (decryptedFileUriRef.current.has(id) && item.file) {
                patch.file = {...item.file, uri: decryptedFileUriRef.current.get(id) || ''};
              }
              if (decryptedPreviewRef.current.has(id)) {
                patch.linkPreview = decryptedPreviewRef.current.get(id);
              }
              return Object.keys(patch).length ? {...item, ...patch} : item;
            }),
          );
        }
      } catch (err) {
        console.warn('e2ee decrypt key unavailable:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [messages, chatId, me.uid]);

  const revealBurn = async (m: ChatMessage) => {
    const burn = m.burnAfterReading;
    if (!burn || burn.burnStartedAt || burn.burned) return;
    const now = Date.now();
    try {
      await revealBurnMessage(chatId, m._id, {duration: burn.duration});
      startBurnCountdown(m._id, burn.duration, now);
    } catch {
      // stays hidden on failure
    }
  };

  const openViewOnce = (m: ChatMessage) => {
    if (!m.image) return;
    lightbox.open(m.image);
    if (m.user?._id !== me.uid) markViewOnceViewed(chatId, m._id, me.uid).catch(() => undefined);
  };

  // ---- Disappearing messages: sweep on policy + interval --------------------
  // Only messages sent after the policy was enabled (messageExpirySince) are
  // eligible, so enabling it never deletes existing history.
  const expiryHours = chat?.messageExpiry || 0;
  const expirySince = chat?.messageExpirySince || 0;
  useEffect(() => {
    if (!expiryHours || !expirySince) return;
    sweepExpiredMessages(chatId, expiryHours, expirySince).catch(() => undefined);
    const id = setInterval(
      () => sweepExpiredMessages(chatId, expiryHours, expirySince).catch(() => undefined),
      60_000,
    );
    return () => clearInterval(id);
  }, [chatId, expiryHours, expirySince]);

  // ---- Derived --------------------------------------------------------------
  const otherUid = chat?.participants.find(p => p !== me.uid);

  // Presence of the other participant (heartbeat-based).
  useEffect(() => {
    if (!otherUid) {
      setOtherLastActive(null);
      return;
    }
    return listenPresence(otherUid, setOtherLastActive);
  }, [otherUid]);

  // The other participant's active live-location share, if any.
  useEffect(() => {
    setPeerLiveLocation(null);
    if (!otherUid) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    // Listening is a read. This effect runs on opening any chat, so minting
    // here made simply looking at a conversation overwrite the account's key.
    getDeviceKeypairIfEnrolled(me.uid)
      .then(keypair => {
        if (cancelled || !otherUid || !keypair) return;
        unsubscribe = listenLiveLocation(chatId, otherUid, keypair.secretKey, setPeerLiveLocation);
      })
      .catch(err => console.warn('live location listen failed:', err));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [chatId, otherUid, me.uid]);

  // Pause the outgoing watch whenever the chat changes (foreground-only
  // tracking, scoped to one open chat at a time) — the share itself (the
  // Firestore doc) is left in place, only the local GPS watch stops, so the
  // peer still sees the last known position rather than it vanishing.
  useEffect(() => {
    return () => {
      stopLocationWatchRef.current?.();
      stopLocationWatchRef.current = null;
    };
  }, [chatId]);

  // "Updated Xs ago" ticks even between Firestore snapshots.
  const [, forceLocationAgeTick] = useState(0);
  useEffect(() => {
    if (!peerLiveLocation) return;
    const interval = setInterval(() => forceLocationAgeTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [peerLiveLocation]);

  const beginSharingLocation = useCallback(
    async (durationMs: number) => {
      setShareLocationModalOpen(false);
      if (!otherUid) return;
      try {
        const initial = await getCurrentPosition();
        await startSharingLocation(chatId, me.uid, otherUid, durationMs, initial);
        setSharingLocation(true);
        lastLocationSentAtRef.current = Date.now();
        stopLocationWatchRef.current = watchMyPosition(
          position => {
            const now = Date.now();
            if (!shouldSendLocationUpdate(lastLocationSentAtRef.current, now)) return;
            lastLocationSentAtRef.current = now;
            updateSharedLocation(chatId, me.uid, otherUid, position).catch(err =>
              console.warn('live location update failed:', err),
            );
          },
          err => console.warn('live location watch failed:', err),
        );
      } catch (err) {
        if (err instanceof LocationError && err.reason === 'denied') {
          toast.error('Allow location access to share your live location.');
        } else if (err instanceof LocationError && err.reason === 'services-off') {
          toast.error('Turn on location services to share your live location.');
        } else if (err instanceof Error && err.message.includes('encryption key')) {
          toast.error("Can't share location securely until they've opened Chatterbox once.");
        } else {
          console.warn('live location start failed:', err);
          toast.error('Unable to start sharing your location.');
        }
      }
    },
    [chatId, me.uid, otherUid, toast],
  );

  const handleStopSharingLocation = useCallback(() => {
    stopLocationWatchRef.current?.();
    stopLocationWatchRef.current = null;
    lastLocationSentAtRef.current = null;
    setSharingLocation(false);
    stopSharingLocation(chatId, me.uid).catch(() => undefined);
  }, [chatId, me.uid]);

  const openInMaps = useCallback((lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
  }, []);

  // E2EE: proactively checks the peer's key when the chat is opened, not just
  // on send — so a device that only ever reads a conversation still gets
  // warned about a substitution.
  //
  // Placed here, after `otherUid`'s own declaration above, deliberately: a
  // `useEffect` dependency array is evaluated synchronously as part of this
  // component's render, at the line where the `useEffect(fn, deps)` call
  // itself appears — not deferred like the effect body. Referencing `otherUid`
  // in the array before its `const` runs would be a real temporal-dead-zone
  // crash, not a lint nit (this is exactly what happened once already on the
  // mobile port of this same feature; see ChatScreen.tsx's encryptOutgoingMessage
  // for the equivalent fix there).
  useEffect(() => {
    setPeerKeyChanged(false); // reset first — this component instance is reused across chats
    if (!otherUid) return;
    let active = true;
    fetchPeerPublicKeyChecked(me.uid, otherUid)
      .then(({status}) => {
        if (active && status === 'changed') setPeerKeyChanged(true);
      })
      .catch(err => console.warn('e2ee key change check failed:', err));
    return () => {
      active = false;
    };
  }, [otherUid, me.uid]);

  // ---- Deleted recipient ----------------------------------------------------
  // A deleted account leaves its chats behind — the survivor keeps their own
  // messages, so the conversation still renders, and the rules still accept
  // writes into it from any *current* participant. Both signals live in
  // services/recipient.ts; this is where they become something the user sees.
  //
  // The structural one is free and always current, but `chat` still holds the
  // previous conversation for the moment between switching chats and the new
  // snapshot arriving, so it is only trusted once the two agree on which chat
  // this is.
  const peerMissingFromChat = chat?.id === chatId && hasLostPeer(chat?.participants, me.uid);

  useEffect(() => {
    setPeerProfileGone(false); // reset first — this component instance is reused across chats
    if (!otherUid) return;
    let active = true;
    isProfileDeleted(otherUid)
      .then(gone => {
        if (active) setPeerProfileGone(gone);
      })
      .catch(err => console.warn('recipient check failed:', err));
    return () => {
      active = false;
    };
  }, [otherUid]);

  const peerDeleted = peerMissingFromChat || peerProfileGone;

  const presenceText =
    otherLastActive == null
      ? ''
      : Date.now() - otherLastActive < ONLINE_WINDOW_MS
      ? t('chat.online')
      : `${t('chat.lastSeen')} ${formatRelative(otherLastActive, t)}`;

  const otherTypingTs = otherUid ? chat?.typingBy?.[otherUid] || 0 : 0;
  const otherTyping = otherTypingTs > Date.now() - TYPING_WINDOW_MS;
  const isPinned = !!chat?.pinnedBy?.includes(me.uid);
  const isMuted = !!chat?.mutedBy?.includes(me.uid);
  const pinnedIds = chat?.pinnedMessageIds || [];
  const latestPinnedId = pinnedIds[pinnedIds.length - 1];
  const latestPinned = latestPinnedId ? messages.find(m => m._id === latestPinnedId) : null;

  const myLastMsg = [...messages].reverse().find(m => m.user?._id === me.uid);
  const otherRead = otherUid ? chat?.lastReadAt?.[otherUid] || 0 : 0;
  const seen = !!myLastMsg && !!myLastMsg.createdAt && myLastMsg.createdAt.toMillis() <= otherRead;
  // "Seen 3:42 PM" — the read-receipt timestamp is when the other side last
  // marked the chat read (lastReadAt), matching the mobile read-receipt data.
  const seenAt =
    seen && otherRead
      ? new Date(otherRead).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
      : '';

  // Per-user chat appearance. A chat's own stored value wins; otherwise the
  // account-wide Store theme applies, so a conversation created after the
  // theme was chosen still looks right (the Store's batch write can only
  // reach chats that already existed).
  // A 1:1 thread doesn't need sender names — the side a bubble sits on says
  // who wrote it. Group chats still label each speaker.
  const isGroupChat = (chat?.participants?.length || 0) > 2;

  // Suggested quick replies: shown when the composer is empty and the other
  // person spoke last (so you can one-tap a response). English-keyword heuristic.
  const lastMsg = messages[messages.length - 1];
  const showSmartReplies =
    !text.trim() && !editing && !recording && !!lastMsg && lastMsg.user?._id !== me.uid && !lastMsg.system;
  const smartReplies = showSmartReplies
    ? getSmartReplies(
        messages.slice(-3).map(m => ({text: m.text || '', isOutgoing: m.user?._id === me.uid})),
        t,
      )
    : [];

  const searching = search !== null && search.trim() !== '';
  const shownMessages = searching
    ? messages.filter(m => (m.text || '').toLowerCase().includes(search!.trim().toLowerCase()))
    : messages;

  // First unread message id (for the "new messages" divider), hidden while searching.
  const firstUnreadId =
    !searching && unreadAtOpen > 0 && messages.length >= unreadAtOpen
      ? messages[messages.length - unreadAtOpen]?._id
      : null;
  const firstUnreadIsMine =
    firstUnreadId && messages.find(m => m._id === firstUnreadId)?.user?._id === me.uid;

  // Participants you can @mention (everyone but yourself). 1:1 → just the other.
  const mentionCandidates: {name: string; uid: string}[] = otherUid ? [{name: title, uid: otherUid}] : [];
  const mentionNames = [me.name, ...mentionCandidates.map(c => c.name)].filter(Boolean);
  const computeMentions = (txt: string) =>
    mentionCandidates.filter(c => txt.includes(`@${c.name}`)).map(c => c.uid);

  /**
   * Seals text/image/audio/file.uri with the recipient's public key before a
   * send, if one is enrolled — mirrors the mobile app's encryptOutgoingMessage
   * (ChatScreen.tsx) exactly, including which fields it does and doesn't
   * touch. No `video` case: unlike mobile, this client has no video-send path
   * (see OutgoingMedia in services/chat.ts), only a video *render* path for
   * clips mobile already sent.
   *
   * A plain function, not useCallback: it's only ever invoked later from
   * event handlers (send/uploadAndSend/sendVoiceMessage below), never from a
   * hook dependency array, so closing over `otherUid`/`chatId` here carries
   * none of the temporal-dead-zone risk the effects above have to avoid.
   */
  const encryptOutgoingMessage = async (data: OutgoingMedia): Promise<OutgoingMedia> => {
    const memberUids = (chat?.participants || []).filter(p => p !== me.uid);
    if (memberUids.length === 0 || !chatId) return data;
    try {
      // One sealed copy per member — a 1:1 chat is just the single-recipient
      // case, so there is no separate direct-message path. See sealForRecipients
      // in services/e2ee.ts for why fan-out rather than sender keys.
      const recipients: EnvelopeRecipient[] = [];
      for (const uid of memberUids) {
        const {key, status} = await fetchPeerPublicKeyChecked(me.uid, uid);
        if (status === 'changed') setPeerKeyChanged(true);
        // Not knowing whether a peer has a key is not the same as knowing they
        // have none, and only the second may be answered with plaintext.
        // Throwing hands the failure to the caller, which restores the
        // composer and shows an error — so a dropped connection delays the
        // message instead of stripping its encryption.
        if (status === 'unavailable') {
          throw new EncryptionUnavailableError(`peer key unavailable for ${uid}`);
        }
        // All-or-nothing: a message sealed for only some members would be blank
        // for the rest, which is worse than one everyone can read. Reached only
        // on a definite 'unenrolled' — a positive "this peer has no key".
        if (!key) return data;
        recipients.push({uid, publicKey: key});
      }

      const {secretKey} = await getOrCreateDeviceKeypair(me.uid);
      const seal = (plaintext: string) => sealForRecipients(plaintext, secretKey, recipients, chatId);
      const next: OutgoingMedia = {...data};

      if (next.text) {
        next.encrypted = seal(next.text);
        next.text = '';
      }
      if (next.image) {
        next.encryptedImage = seal(next.image);
        next.image = undefined;
      }
      if (next.audio) {
        next.encryptedAudio = seal(next.audio);
        next.audio = undefined;
      }
      if (next.file?.uri) {
        next.encryptedFileUri = seal(next.file.uri);
        next.file = {...next.file, uri: ''};
      }
      return next;
    } catch (err) {
      // Rethrow rather than returning `data`, which sent the message in clear.
      // Returning the plaintext here meant anything going wrong between "the
      // peer has a key" and "the message is sealed" — a failed key fetch, a
      // keypair that couldn't be published — silently produced an unencrypted
      // message that looked identical to an encrypted one in the thread.
      //
      // Safe to fail closed because every error reachable here is transient,
      // and all five call sites already catch, surface a toast, and (for text)
      // restore the composer. Matches the mobile client's encryptOutgoingMessage.
      console.warn('e2ee send failed:', err);
      throw isEncryptionUnavailable(err) ? err : new EncryptionUnavailableError();
    }
  };

  /**
   * Resolves a link preview for a message that was just sent, and writes it
   * back sealed. Fire-and-forget: the bubble is already on screen, and a slow
   * or unreachable site must never hold up the send.
   *
   * Only the *sender* does this, and only once. Previously every viewer
   * fetched the preview as the bubble rendered, which told the server about
   * every link in a supposedly private chat on every single load — see
   * services/linkPreview.ts.
   */
  const attachLinkPreview = async (messageId: string, text: string) => {
    if (!isLinkPreviewEnabled()) return;
    const url = extractFirstUrl(text);
    if (!url) return;
    try {
      const preview = normalizePreview(await fetchLinkPreview(url));
      if (!preview || !hasPreviewContent(preview)) return;
      const crypto = await makeArtifactCrypto(me.uid, otherUid, chatId);
      await setMessageLinkPreview(chatId, messageId, buildLinkPreviewPatch(preview, crypto));
    } catch (err) {
      // A site with no metadata, a blocked host, or a rate limit — the message
      // is already delivered, so this is cosmetic.
      console.warn('link preview failed:', err);
    }
  };

  // ---- Sending / editing ----------------------------------------------------

  /**
   * A send can fail because the recipient deleted their account — the composer
   * is normally replaced before that's reachable, but the account can be
   * deleted while this chat sits open, and the guard in services/chat.ts
   * catches paths (upload, voice) that finish long after the click. Reporting
   * that as a generic "message failed to send" would invite retrying forever.
   */
  const sendErrorKey = (err: unknown, fallback: TKey): TKey =>
    isRecipientUnreachable(err)
      ? 'chat.recipientDeletedToast'
      : // Distinct from a generic send failure on purpose: the message was
        // withheld *because* it could not be encrypted, and saying so is the
        // difference between "retry in a moment" and "something is broken".
        isEncryptionUnavailable(err)
        ? 'chat.encryptionUnavailable'
        : fallback;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) return saveEdit();
    const trimmed = text.trim();
    if (!trimmed) return;
    // Guard only against re-submitting the *same* text. The previous version
    // bailed on `sending`, which meant hitting Enter while an earlier message
    // was still in flight silently dropped the new one — it just sat in the
    // composer with no feedback, and in a fast exchange you'd assume it sent.
    // A ref, not state: React may not have flushed setText('') yet when a
    // second Enter arrives in the same tick, so this has to update
    // synchronously to catch a true double-submit.
    if (inFlightTextRef.current === trimmed) return;
    inFlightTextRef.current = trimmed;
    const reply = replyTarget ? buildReplyTo(replyTarget) : undefined;
    const mentions = computeMentions(trimmed);
    setText('');
    setReplyTarget(null);
    setMention(null);
    setTyping(chatId, me.uid, false);
    setDraft(me.uid, chatId, '');
    setSending(true);
    try {
      const messageId = await sendMessage(
        chatId,
        await encryptOutgoingMessage({
          text: trimmed,
          ...(burnMode ? {burnAfterReading: {duration: burnDuration}} : {}),
          ...(reply ? {replyTo: reply} : {}),
          ...(mentions.length ? {mentions} : {}),
        }),
        me,
      );
      // Not for burn-after-reading: the whole point of that mode is leaving no
      // trace, and a preview card would outlive the text it came from.
      if (!burnMode) void attachLinkPreview(messageId, trimmed);
      // Kicks only once the send has actually landed, so the animation is
      // confirmation rather than optimism.
      setLaunching(true);
      window.setTimeout(() => setLaunching(false), 1100);
      // A first message is worth marking. Only the first: confetti on every
      // send would be exhausting within a minute.
      if (messages.length === 0) celebrate(colors.primary);
    } catch (err) {
      console.warn('send failed:', err);
      setText(trimmed);
      setReplyTarget(replyTarget);
      toast.error(t(sendErrorKey(err, 'chat.sendFailed')));
    } finally {
      inFlightTextRef.current = null;
      setSending(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const trimmed = editing.text.trim();
    if (!trimmed) return;
    try {
      await editMessage(chatId, editing.id, trimmed);
    } catch (err) {
      console.warn('edit failed:', err);
      toast.error(t('chat.sendFailed'));
    } finally {
      setEditing(null);
    }
  };

  const startEdit = (m: ChatMessage) => {
    setEditing({id: m._id, text: m.text || ''});
    setActiveMsg(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onInput = (v: string) => {
    if (editing) {
      setEditing({...editing, text: v});
      return;
    }
    setText(v);
    setTyping(chatId, me.uid, v.length > 0);
    // Mention autocomplete: trigger while typing "@partial" at the end.
    const mm = /(?:^|\s)@(\S*)$/.exec(v);
    setMention(mm && mentionCandidates.length ? {query: mm[1].toLowerCase(), start: mm.index} : null);
  };

  const pickMention = (c: {name: string; uid: string}) => {
    const at = text.lastIndexOf('@');
    if (at < 0) return;
    setText(`${text.slice(0, at)}@${c.name} `);
    setMention(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const mentionMatches = mention
    ? mentionCandidates.filter(c => c.name.toLowerCase().includes(mention.query))
    : [];

  // Auto-grow the composer/edit textarea to fit its content (capped by CSS).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, editing]);

  // Enter sends; Shift+Enter inserts a newline. Never send mid-IME-composition
  // (important for Pinyin/CJK input, where Enter confirms a candidate).
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
      return;
    }

    // Escape backs out of whatever the composer is currently attached to,
    // innermost first: an edit, then a reply. Without this the only way out is
    // to hunt for the small ✕, and Escape appearing to do nothing in a text
    // field reads as the app ignoring you.
    if (e.key === 'Escape') {
      if (editing) {
        e.preventDefault();
        setEditing(null);
        return;
      }
      if (replyTarget) {
        e.preventDefault();
        setReplyTarget(null);
        return;
      }
      return;
    }

    // Up-arrow in an *empty* composer edits your last message — the convention
    // in Slack, Discord and iMessage. Guarded on empty so it never steals the
    // caret while there's a draft to move around in.
    if (
      e.key === 'ArrowUp' &&
      !e.shiftKey &&
      !e.altKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !editing &&
      e.currentTarget.value === ''
    ) {
      const mine = [...messages].reverse().find(m => m.user?._id === me.uid && !m.system && m.text);
      if (mine) {
        e.preventDefault();
        startEdit(mine);
      }
    }
  };

  const saveBookmark = (m: ChatMessage) => {
    addBookmark(me.uid, {
      chatId,
      messageId: m._id,
      text: m.text || '',
      senderId: m.user?._id || '',
      senderName: m.user?.name || '',
    })
      .then(() => toast.success(t('chat.save')))
      .catch(() => undefined);
    setActiveMsg(null);
  };

  /**
   * Sends forwardTarget's text into a different chat, freshly sealed for
   * *that* chat's current members — never the original envelope, which was
   * sealed for this chat's members and would be unreadable elsewhere.
   * sealAndSendText does the recipient lookup + seal + send for an arbitrary
   * target chat; ChatPane's own encryptOutgoingMessage above can't be reused
   * here since it's closed over *this* chat's participants specifically.
   */
  const handleForwardPick = async (targetChatId: string) => {
    const target = forwardTarget;
    setForwardTarget(null);
    const forwardText = (target?.text || '').trim();
    if (!forwardText) return;
    try {
      const targetChat = await getChat(targetChatId);
      const recipientUids = (targetChat?.participants || []).filter(uid => uid !== me.uid);
      await sealAndSendText(targetChatId, forwardText, me, recipientUids);
      toast.success(t('chat.forwarded'));
    } catch (err) {
      console.warn('forward message failed:', err);
      toast.error(t(sendErrorKey(err, 'chat.forwardFailed')));
    }
  };

  const onGifPick = async (g: GifResult) => {
    setGifOpen(false);
    const reply = replyTarget ? buildReplyTo(replyTarget) : undefined;
    setReplyTarget(null);
    try {
      await sendMessage(
        chatId,
        {
          gif: {
            url: g.url,
            previewUrl: g.previewUrl,
            mp4Url: g.mp4Url,
            mp4PreviewUrl: g.mp4PreviewUrl,
            width: g.width,
            height: g.height,
          },
          ...(reply ? {replyTo: reply} : {}),
        },
        me,
      );
    } catch (err) {
      toast.error(t(sendErrorKey(err, 'chat.sendFailed')));
    }
  };

  const onTogglePin = (m: ChatMessage) => {
    togglePinMessage(chatId, m._id).catch(() => undefined);
    setActiveMsg(null);
  };

  const onTranscribe = async (m: ChatMessage) => {
    setActiveMsg(null);
    if (m.transcription || transcribing.has(m._id)) return;
    // m.audio is already the decrypted plaintext clip by this point (patched
    // in from decryptedAudioRef once decrypted — see the effect above);
    // voice messages are otherwise end-to-end encrypted, so the server has
    // no way to read this itself.
    if (!m.audio) {
      toast.error(t('chat.transcribeFailed'));
      return;
    }
    setTranscribing(prev => new Set(prev).add(m._id));
    try {
      // writes onto the message → arrives via listener
      await transcribeVoiceMessage(chatId, m._id, m.audio, lang, m.audioSampleRateHertz, m.audioChannelCount);
    } catch (err) {
      // Not an error the user caused: they haven't been shown the disclosure
      // yet. Prompt, then re-run exactly what they asked for.
      if (isAiConsentError(err)) setAiConsentRetry(() => () => onTranscribe(m));
      else toast.error(t('chat.transcribeFailed'));
    } finally {
      setTranscribing(prev => {
        const n = new Set(prev);
        n.delete(m._id);
        return n;
      });
    }
  };

  const scrollToMessage = (id: string) => {
    scrollRef.current?.querySelector(`[data-mid="${id}"]`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
  };

  const doSchedule = async () => {
    const at = scheduleAt ? new Date(scheduleAt).getTime() : 0;
    const trimmed = text.trim();
    if (!trimmed || !at || at <= Date.now()) return;
    try {
      // Sealed now, not at delivery: the document sits in Firestore until its
      // time comes and is then copied verbatim into the thread, so anything
      // stored here in the clear stays in the clear. encryptOutgoingMessage
      // throws rather than falling back to plaintext, and the catch below puts
      // the text back in the composer — the message is not going anywhere for
      // at least a minute, so there is nothing to lose by asking again.
      const sealed = await encryptOutgoingMessage({text: trimmed});
      await scheduleMessage(chatId, {text: sealed.text, encrypted: sealed.encrypted}, at, me);
      setText('');
      setDraft(me.uid, chatId, '');
      setScheduleOpen(false);
      setScheduleAt('');
      toast.success(t('chat.scheduledCount'));
    } catch {
      toast.error(t('chat.sendFailed'));
    }
  };

  // Create a reminder for the selected message at the chosen time.
  const doRemind = async () => {
    if (!reminderFor || !reminderAt) return;
    const remindAt = new Date(reminderAt).getTime();
    if (remindAt <= Date.now()) {
      toast.error(t('reminder.future'));
      return;
    }
    // A sealed message contributes no preview. `reminderFor.text` here is the
    // *decrypted* body (withDecryptedPlaceholders filled it in for display),
    // and this doc is written to Firestore and read back by the server, which
    // sends it as a push notification body — so copying it here would put the
    // plaintext of an end-to-end encrypted message on the server and across
    // FCM/APNs in clear. The reminder still fires; it just names itself
    // instead of quoting the message, the same trade the chat notification
    // already makes on iOS.
    const sealed = isSealed(reminderFor.encrypted);
    const raw = sealed
      ? ''
      : reminderFor.text || (reminderFor.gif ? '[GIF]' : reminderFor.image ? '[Photo]' : '');
    const preview = raw ? raw.slice(0, 80) : t('reminder.default');
    const reminder: Reminder = {
      id: `${chatId}_${reminderFor._id}_${remindAt}`,
      userId: me.uid,
      chatId,
      messageId: reminderFor._id,
      messagePreview: preview,
      remindAt,
      createdAt: Date.now(),
      sent: false,
    };
    try {
      await createReminder(me.uid, reminder);
      toast.success(t('reminder.set'));
    } catch {
      toast.error(t('common.error'));
    }
    setReminderFor(null);
    setReminderAt('');
  };

  const confirmDelete = async () => {
    if (!window.confirm(t('chat.confirmDelete'))) return;
    await deleteChat(chatId);
    onDeleted();
  };

  // ---- Multi-select delete --------------------------------------------------
  const enterSelect = (firstId?: string) => {
    setActiveMsg(null);
    setMenuOpen(false);
    setSelected(firstId ? new Set([firstId]) : new Set());
    setSelectMode(true);
  };
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const deleteSelected = async () => {
    // Only your own messages are deletable (firestore.rules). Dropping the
    // others silently would leave the user believing a message was gone when
    // it was not, so say how many were left out.
    const chosen = [...selected];
    const ownIds = new Set(messages.filter(m => String(m.user?._id) === me.uid).map(m => m._id));
    const ids = chosen.filter(id => ownIds.has(id));
    const skipped = chosen.length - ids.length;
    if (ids.length === 0) {
      toast.error('You can only delete your own messages.');
      exitSelect();
      return;
    }
    if (!window.confirm(t('chat.confirmDeleteSelected'))) return;
    try {
      await deleteMessages(chatId, ids, me.uid);
      toast.success(
        skipped > 0
          ? `Deleted ${ids.length}. ${skipped} left out — you can only delete your own.`
          : t('chat.deletedCount'),
      );
    } catch {
      toast.error(t('common.error'));
    }
    exitSelect();
  };

  const doSummarize = async (question?: string) => {
    setMenuOpen(false);
    // Pro gate. The server enforces this too (functions/index.js's
    // requirePro) — this check only spares subscribers-to-be a raw
    // permission error and shows them what they'd be buying.
    if (!isPro) {
      setProPromptOpen(true);
      return;
    }
    setSummarizing(true);
    setSummary('');
    setSummaryAskedQuestion(question?.trim() || '');
    try {
      // messages is newest-first with decrypted .text already patched in
      // (see decryptedTextRef above) — reverse to chronological order for
      // the transcript sent to the AI.
      const transcript = messages
        .slice(0, 50)
        .map(m => ({sender: m.user?.name || 'User', text: m.text || '[media]'}))
        .reverse();
      setSummary(await summarizeChat(chatId, transcript, question));
    } catch (err) {
      if (isAiConsentError(err)) {
        setSummary('');
        setAiConsentRetry(() => () => doSummarize(question));
      } else {
        setSummary(t('chat.summaryFailed'));
      }
    } finally {
      setSummarizing(false);
    }
  };

  const doTranslate = async (m: ChatMessage) => {
    setActiveMsg(null);
    if (translations[m._id] || !m.text) return;
    try {
      const tr = await translateMessage(chatId, m._id, m.text, lang);
      setTranslations(prev => ({...prev, [m._id]: tr}));
    } catch (err) {
      if (isAiConsentError(err)) setAiConsentRetry(() => () => doTranslate(m));
      else setTranslations(prev => ({...prev, [m._id]: '(translation unavailable)'}));
    }
  };

  // Calls are pointless once the account is gone: there is no device left to
  // ring. `otherUid` already goes undefined when the peer leaves participants,
  // but not in the partial-purge case where only the profile is deleted.
  //
  // Groups are excluded because the call stack is 1:1 (startCall takes a single
  // callee). Without this the button would silently ring whichever member
  // happens to sit first in `participants` — a call to one person that everyone
  // else in the group never sees, and that the caller believes went to the group.
  // Better to offer nothing than something that misleads; group calling needs
  // real multi-party signalling, not a reused 1:1 path.
  const canCall = !!otherUid && !peerDeleted && !isGroupChat;
  const startVoice = () => canCall && startCall(chatId, otherUid!, title, 'voice');
  const startVideo = () => canCall && startCall(chatId, otherUid!, title, 'video');

  // ---- Uploads (button / drag / paste) --------------------------------------
  const uploadAndSend = async (file: File, kind: 'image' | 'file' | 'auto') => {
    const asImage = kind === 'image' || (kind === 'auto' && file.type.startsWith('image/'));
    const burn = burnMode ? {burnAfterReading: {duration: burnDuration}} : {};
    setUploadPct(0);
    try {
      if (asImage) {
        const url = await uploadChatImage(chatId, file, setUploadPct);
        await sendMessage(
          chatId,
          await encryptOutgoingMessage({image: url, ...(viewOnceMode ? {viewOnce: true} : {}), ...burn}),
          me,
        );
        if (viewOnceMode) setViewOnceMode(false); // one-shot, like mobile
      } else {
        const url = await uploadChatFile(chatId, file, setUploadPct);
        await sendMessage(
          chatId,
          await encryptOutgoingMessage({file: {uri: url, name: file.name, size: file.size}, ...burn}),
          me,
        );
      }
    } catch (err) {
      logUploadError('upload', err);
      toast.error(t(sendErrorKey(err, describeUploadError(err) as TKey)));
    } finally {
      setUploadPct(null);
    }
  };

  const onImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadAndSend(file, 'image');
  };
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadAndSend(file, 'file');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && uploadPct === null) uploadAndSend(file, 'auto');
  };
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      if (!dragging) setDragging(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f && uploadPct === null) {
          e.preventDefault();
          uploadAndSend(f, 'image');
          return;
        }
      }
    }
  };

  /**
   * Sends a recording without touching Cloud Storage when it can. Short clips
   * (the overwhelming majority) are embedded in the message document as a data
   * URI, which keeps voice messages working on the no-cost Firebase plan where
   * Storage is unavailable. Only clips too big to inline fall back to a Storage
   * upload, so enabling billing later widens the limit without a code change.
   */
  const sendVoiceMessage = async (
    blob: Blob,
    secs: number,
    audioSampleRateHertz?: number,
    audioChannelCount?: number,
  ) => {
    const burn = burnMode ? {burnAfterReading: {duration: burnDuration}} : {};
    const inline = await encodeInlineMedia(blob);
    const audioMeta = {audioDuration: secs, audioSampleRateHertz, audioChannelCount};

    if (!inline) {
      try {
        const url = await uploadChatBlob(chatId, blob, extensionForMime(blob.type), setUploadPct);
        await sendMessage(chatId, await encryptOutgoingMessage({audio: url, ...audioMeta, ...burn}), me);
      } catch (err) {
        // Storage is the only route for a clip this long, so surface the
        // length as the actionable problem rather than the Storage error —
        // unless there is nobody left to send it to, which trimming won't fix.
        logUploadError('voice overflow upload', err);
        toast.error(t(sendErrorKey(err, 'chat.voiceTooLong')));
      }
      return;
    }

    await sendMessage(chatId, await encryptOutgoingMessage({audio: inline, ...audioMeta, ...burn}), me);
  };

  // ---- Voice recording ------------------------------------------------------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const recorder = new MediaRecorder(stream, {
        ...(VOICE_MIME ? {mimeType: VOICE_MIME} : {}),
        // Voice-grade Opus. Keeps a couple of minutes of speech inside the
        // Firestore inline budget, and is indistinguishable from the browser
        // default for spoken audio.
        audioBitsPerSecond: VOICE_BITRATE,
      });
      recorderRef.current = recorder;
      recChunksRef.current = [];
      recorder.ondataavailable = ev => ev.data.size && recChunksRef.current.push(ev.data);
      recorder.onstop = async () => {
        // Read the track's actual negotiated capture settings before
        // stopping it — needed for AAC clips (audio/mp4), where, unlike
        // Opus, the real sample rate isn't a fixed codec property the
        // transcription function could assume server-side.
        const trackSettings = stream.getAudioTracks()[0]?.getSettings();
        stream.getTracks().forEach(tr => tr.stop());
        const secs = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000));
        // Use what the recorder actually produced — Safari yields audio/mp4,
        // not webm, and the data URI is decoded using this type.
        const type = recorder.mimeType || VOICE_MIME || 'audio/webm';
        const blob = new Blob(recChunksRef.current, {type});
        if (blob.size > 0) {
          setUploadPct(0);
          try {
            await sendVoiceMessage(blob, secs, trackSettings?.sampleRate, trackSettings?.channelCount);
          } catch (err) {
            logUploadError('voice send', err);
            toast.error(t(sendErrorKey(err, describeUploadError(err) as TKey)));
          } finally {
            setUploadPct(null);
          }
        }
      };
      recorder.start();
      recStartRef.current = Date.now();
      setRecording(true);
      setRecSecs(0);
      recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
    } catch {
      toast.error(t('chat.micDenied'));
    }
  };

  const stopRecording = (doSend: boolean) => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (!doSend) recChunksRef.current = [];
    recorder.stop();
    recorderRef.current = null;
  };

  // ---- Render ---------------------------------------------------------------

  // A locked chat renders *only* the PIN gate. Returning early rather than
  // overlaying the real pane matters: an overlay still mounts the thread, so
  // the messages would be in the DOM (and briefly on screen before paint) for
  // anyone who inspected or screenshotted it — which is exactly what the lock
  // is meant to prevent.
  if (isChatLocked(chatId) && unlockedChatId !== chatId) {
    return (
      <div style={styles.pane}>
        <ChatLockModal
          chatId={chatId}
          mode="unlock"
          onClose={() => onBack?.()}
          onUnlocked={() => setUnlockedChatId(chatId)}
        />
      </div>
    );
  }

  return (
    <div style={styles.pane} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {dragging && <div className="drop-hint">{t('chat.dropToSend')}</div>}

      {/* A plain div, not <header> — this is the per-chat title bar inside
          MainApp's main landmark, not the page's global banner; the
          semantic <header> tag only avoids an implicit banner role when
          nested inside main/article/section, which axe flagged as not
          reliably holding here. */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {onBack && (
            <button style={styles.backBtn} onClick={onBack} title="Back">
              <Icon name="back" size={22} strokeWidth={2.2} />
            </button>
          )}
          <div style={styles.headerTitleCol}>
            <span style={styles.headerTitle}>
              {title}
              {isPinned && <span style={styles.tag}><Icon name="pin" size={14} /></span>}
              {isMuted && <span style={styles.tag}><Icon name="bellOff" size={14} /></span>}
            </span>
            {presenceText && (
              <span style={{...styles.presence, color: otherLastActive != null && Date.now() - otherLastActive < ONLINE_WINDOW_MS ? colors.success : colors.textSecondary}}>
                {presenceText}
              </span>
            )}
          </div>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.menuBtn}
            title={t('chat.search')}
            onClick={() => setSearch(prev => (prev === null ? '' : null))}>
            <Icon name="search" size={17} />
          </button>
          <button
            style={{...styles.menuBtn, opacity: canCall ? 1 : 0.4}}
            title={t('chat.voiceCall')}
            disabled={!canCall}
            onClick={startVoice}>
            <Icon name="phone" size={18} />
          </button>
          <button
            style={{...styles.menuBtn, opacity: canCall ? 1 : 0.4}}
            title={t('chat.videoCall')}
            disabled={!canCall}
            onClick={startVideo}>
            <Icon name="video" size={18} />
          </button>
          {/* Ref wraps the trigger as well as the menu: see useDismissOnOutside
              for why excluding the button would leave the menu stuck open. */}
          <div ref={menuWrapRef} style={{position: 'relative'}}>
            <button
              style={styles.menuBtn}
              title="More"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}>
              <Icon name="more" size={20} />
            </button>
            {menuOpen && (
              <div style={styles.menu}>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setSummaryQuestion('');
                    doSummarize();
                  }}>
                  <Icon name="sparkles" size={15} /> {t('chat.summarize')}
                  {!isPro && <span style={styles.menuProTag}>{t('pro.badge')}</span>}
                </button>
                <button style={styles.menuItemRow} onClick={() => enterSelect()}>
                  <Icon name="check" size={15} /> {t('chat.selectMessages')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setShowMembers(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="person" size={15} /> Members ({chat?.participants?.length || 0})
                </button>
                <button style={styles.menuItem} onClick={() => togglePinChat(chatId, me.uid, isPinned)}>
                  {isPinned ? t('chat.unpin') : t('chat.pin')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setShowLockSettings(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="lock" size={15} /> {isChatLocked(chatId) ? 'Chat lock' : 'Lock chat'}
                </button>
                <button style={styles.menuItem} onClick={() => toggleMuteChat(chatId, me.uid, isMuted)}>
                  {isMuted ? t('chat.unmute') : t('chat.mute')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setBurnMode(v => !v);
                    setMenuOpen(false);
                  }}>
                  <Icon name="flame" size={15} /> {t('chat.burnAfterReading')}
                  {burnMode ? <Icon name="check" size={14} style={styles.menuCheck} /> : null}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setViewOnceMode(v => !v);
                    setMenuOpen(false);
                  }}>
                  <Icon name="eye" size={15} /> {t('chat.viewOnce')}
                  {viewOnceMode ? <Icon name="check" size={14} style={styles.menuCheck} /> : null}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setExpiryOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="timer" size={15} /> {t('chat.disappearing')}
                  {expiryHours ? <span style={styles.menuCheck}>{expiryLabel(t, expiryHours)}</span> : null}
                </button>
                {otherUid && (
                  <button
                    style={styles.menuItemRow}
                    onClick={() => {
                      setVerifyOpen(true);
                      setMenuOpen(false);
                    }}>
                    <Icon name="lock" size={15} /> {t('chat.verifyContact')}
                  </button>
                )}
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setWhiteboardOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="edit" size={15} /> {t('chat.whiteboard')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setScheduleOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="timer" size={15} /> {t('chat.schedule')}
                </button>
                <div style={styles.menuDivider} />
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setMediaOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="image" size={15} /> {t('media.title')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setPlaylistOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="music" size={15} /> {t('playlist.title')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setCountdownOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="calendar" size={15} /> {t('countdown.title')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setListsOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="list" size={15} /> {t('lists.title')}
                </button>
                <div style={styles.menuDivider} />
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setTrashOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="trash" size={15} /> {t('trash.title')}
                </button>
                <button
                  style={styles.menuItemRow}
                  onClick={() => {
                    setSettingsOpen(true);
                    setMenuOpen(false);
                  }}>
                  <Icon name="settings" size={15} /> {t('chatSettings.title')}
                </button>
                <button style={{...styles.menuItem, color: colors.danger}} onClick={confirmDelete}>
                  {t('chat.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectMode && (
        <div style={styles.selectBar}>
          <button style={styles.selectCancel} onClick={exitSelect} title={t('common.cancel')}>
            <Icon name="close" size={18} />
          </button>
          <span style={styles.selectCount}>
            {selected.size} {t('chat.selected')}
          </span>
          <button
            style={styles.selectAllBtn}
            onClick={() => setSelected(new Set(shownMessages.map(m => m._id)))}>
            {t('chat.selectAll')}
          </button>
          <button
            style={{...styles.selectDelete, opacity: selected.size ? 1 : 0.45}}
            disabled={!selected.size}
            onClick={deleteSelected}>
            <Icon name="trash" size={16} /> {t('common.delete')}
          </button>
        </div>
      )}

      {(summarizing || summary !== null) && (
        <div style={styles.summaryBar}>
          <div style={styles.summaryRow}>
            <div style={styles.summaryTitle}>
              <Icon name="sparkles" size={14} />{' '}
              {summaryAskedQuestion ? `Re: "${summaryAskedQuestion}"` : t('chat.summaryTitle')}
            </div>
            <div style={styles.summaryText}>
              {summarizing ? (summaryAskedQuestion ? 'Searching this chat...' : t('chat.summarizing')) : summary}
            </div>
            {!summarizing && (
              <button style={styles.summaryClose} onClick={() => setSummary(null)} title={t('common.close')}>
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <form
            style={styles.summaryAskRow}
            onSubmit={e => {
              e.preventDefault();
              doSummarize(summaryQuestion);
            }}>
            <input
              style={styles.summaryAskInput}
              placeholder="Ask about this chat (e.g. what did we decide about the trip?)"
              aria-label="Ask about this chat"
              value={summaryQuestion}
              onChange={e => setSummaryQuestion(e.target.value)}
              disabled={summarizing}
            />
            <button type="submit" style={styles.summaryAskBtn} disabled={summarizing}>
              {summaryQuestion.trim() ? 'Ask' : 'Regenerate'}
            </button>
          </form>
        </div>
      )}

      {search !== null && (
        <div style={styles.searchBar}>
          <Icon name="search" size={16} style={{color: colors.textTertiary}} />
          <input
            style={styles.searchInput}
            placeholder={t('chat.searchPlaceholder')}
            aria-label={t('chat.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <button style={styles.searchClose} aria-label={t('common.close')} onClick={() => setSearch(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {expiryOpen && (
        <div style={styles.expiryBar}>
          <span style={styles.expiryTitle}>
            <Icon name="timer" size={15} /> {t('chat.disappearing')}
          </span>
          <div style={styles.expiryChips}>
            {EXPIRY_OPTIONS.map(o => (
              <button
                key={o.hours}
                onClick={() => {
                  setChatExpiryPolicy(chatId, o.hours).catch(() => undefined);
                  setExpiryOpen(false);
                }}
                style={{
                  ...styles.expiryChip,
                  ...(expiryHours === o.hours ? styles.expiryChipOn : null),
                }}>
                {expiryLabel(t, o.hours)}
              </button>
            ))}
          </div>
          <button style={styles.searchClose} aria-label={t('common.close')} onClick={() => setExpiryOpen(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {peerDeleted && (
        <div style={styles.deletedBanner} role="status">
          <Icon name="blocked" size={14} style={{marginRight: 6, flexShrink: 0}} />
          <span>{t('chat.recipientDeleted')}</span>
        </div>
      )}

      {peerKeyChanged && !peerDeleted && (
        <button style={styles.keyChangedBanner} onClick={() => setVerifyOpen(true)}>
          <Icon name="alertTriangle" size={14} style={{marginRight: 6, flexShrink: 0}} />
          <span>{t('chat.keyChanged')}</span>
        </button>
      )}

      {pinnedIds.length > 0 && (
        <button style={styles.pinnedBanner} onClick={() => scrollToMessage(latestPinnedId)}>
          <Icon name="pin" size={14} style={{color: colors.primary, flexShrink: 0}} />
          <span style={styles.pinnedBannerText}>{latestPinned?.text || '[Media]'}</span>
          {pinnedIds.length > 1 && <span style={styles.pinnedBannerCount}>{pinnedIds.length}</span>}
        </button>
      )}

      {sharingLocation && (
        <div style={{...styles.locationBanner, background: colors.primary}}>
          <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <Icon name="pin" size={13} />
            Sharing your location
          </span>
          <button type="button" style={styles.locationBannerStop} onClick={handleStopSharingLocation}>
            Stop
          </button>
        </div>
      )}

      {peerLiveLocation?.position && (
        <button
          style={styles.locationPreview}
          aria-label={`Live location shared by ${title}, open in Maps`}
          onClick={() => openInMaps(peerLiveLocation.position!.latitude, peerLiveLocation.position!.longitude)}>
          <img
            src={staticMapTileUrl(peerLiveLocation.position.latitude, peerLiveLocation.position.longitude)}
            alt=""
            style={styles.locationPreviewImage}
          />
          <span style={styles.locationPreviewInfo}>
            <span style={{...styles.locationPreviewTitle, display: 'flex', alignItems: 'center', gap: 4}}>
              <Icon name="pin" size={12} />
              Live location
            </span>
            <span style={styles.locationPreviewCoords}>
              {formatCoordinates(peerLiveLocation.position.latitude, peerLiveLocation.position.longitude)}
            </span>
            <span style={styles.locationPreviewMeta}>
              Updated {Math.max(0, Math.round((Date.now() - peerLiveLocation.updatedAt) / 1000))}s ago · Open in Maps
            </span>
          </span>
        </button>
      )}

      {/* No backdrop layer here any more. The thread's ground is the app's
          own canvas — a conversation should look like the app it is in, and
          only the dark/light theme moves it. */}

      <div
        ref={scrollRef}
        className="scroll"
        data-thread="true"
        style={styles.messages}
        onScroll={onScroll}
        onClick={() => setActiveMsg(null)}>
        {shownMessages.length > 0 && <div style={styles.msgSpacer} />}
        {hasMore && !searching && (
          <div style={styles.loadOlder}>
            <button style={styles.loadOlderBtn} onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? <span className="spinner" /> : t('chat.loadOlder')}
            </button>
          </div>
        )}
        {shownMessages.length === 0 ? (
          <div style={styles.emptyMsgs}>{searching ? t('chat.noMatch') : t('chat.empty')}</div>
        ) : (
          shownMessages.map((m, i) => {
            const mine = m.user?._id === me.uid;
            // Inverted, matching the mobile app: an outgoing bubble is a solid
            // block of the foreground colour rather than a tint, which reads as
            // "sent" without spending the accent on authorship. A chat themed
            // from the store still wins.
            // Always the foreground colour now. The `||` branch here was
            // dead: resolveAccent fell back to the accent, so the un-themed
            // case this comment describes never actually rendered, and web
            // and mobile disagreed about what a sent bubble looks like.
            const bubbleBg = mine ? 'var(--cb-text)' : 'transparent';
            // Not #FFFFFF: on the inverted fill the correct ink is whatever
            // contrasts with the *foreground* colour, which is the token the
            // themes already disagree about on purpose — black in dark, white
            // in light. Hardcoding white was right only while the bubble was a
            // saturated accent.
            // An incoming bubble is transparent over the app's own canvas, so
            // the theme's ordinary ink is correct by construction. This used to
            // hand-pick a light ink whenever the wallpaper was dark — a check
            // that only existed because a chat could paint its own ground.
            const bubbleText = mine ? 'var(--cb-text-on-primary)' : colors.text;
            const bubbleDim = mine ? 'var(--cb-text-on-primary)' : colors.textTertiary;
            const reactions = Object.entries(m.reactions || {}).filter(([, u]) => u.length > 0);
            const showDivider = m._id === firstUnreadId && !firstUnreadIsMine;

            // System notices (e.g. missed calls) render as a centered pill.
            if (m.system || m.call) {
              return (
                <div key={m._id} className="cv-row">
                  {showDivider && <div className="unread-divider">{t('chat.newMessages')}</div>}
                  <div style={styles.systemRow}>
                    <span style={styles.systemPill}>
                      <Icon name={m.call?.type === 'video' ? 'cameraOff' : 'phoneOff'} size={14} />
                      {/* Server writes an English fallback; localize from the
                          structured `call` field when present. */}
                      {m.call?.outcome === 'missed'
                        ? t(m.call.type === 'video' ? 'call.missedVideo' : 'call.missedVoice')
                        : m.text}
                      <span style={styles.systemTime}>{formatTime(m.createdAt)}</span>
                    </span>
                  </div>
                </div>
              );
            }

            const burn = m.burnAfterReading;
            const burned = !!burn?.burned;
            const burnUnrevealed = !!burn && !burn.burnStartedAt && !burned && !mine;
            const contentHidden = burned || burnUnrevealed;
            const countdown = burnCountdowns[m._id];
            const viewedBy = m.viewOnceViewedBy || [];
            const voExpired = !!m.viewOnce && !mine && (!!m.viewOnceExpired || viewedBy.includes(me.uid));
            const voLocked = !!m.viewOnce && !mine && !voExpired;
            // Group consecutive messages from the same author within a short window.
            const prev = shownMessages[i - 1];
            // A day change always starts a fresh run, so a message sent at
            // 00:01 never groups onto yesterday's last one.
            const newDay = !prev || !isSameDay(msgTime(m), msgTime(prev));
            const grouped =
              !showDivider &&
              !newDay &&
              !!prev &&
              prev.user?._id === m.user?._id &&
              msgTime(m) - msgTime(prev) < GROUP_WINDOW_MS;
            const senderName = m.user?.name || (mine ? me.name : 'User');
            const seed = m.user?._id || m._id;
            const isMsgPinned = (chat?.pinnedMessageIds || []).includes(m._id);
            return (
              <div key={m._id} className="cv-row">
                {newDay && <div style={styles.dayDivider}><span style={styles.dayPill}>{formatDayLabel(msgTime(m), t)}</span></div>}
                {showDivider && <div className="unread-divider">{t('chat.newMessages')}</div>}
                <div
                  // `mine`/`theirs` pick which side the bubble springs in
                  // from — see the motion section in styles.css.
                  className={`msg-row ${mine ? 'mine' : 'theirs'}`}
                  data-mid={m._id}
                  style={{
                    ...styles.msgRow,
                    flexDirection: mine ? 'row-reverse' : 'row',
                    marginTop: grouped ? 2 : 10,
                    ...(selectMode ? {cursor: 'pointer'} : null),
                    ...(selectMode && selected.has(m._id) ? styles.msgRowSelected : null),
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    if (selectMode) {
                      toggleSelect(m._id);
                      return;
                    }
                    setReactionOpen(null);
                    setActiveMsg(activeMsg === m._id ? null : m._id);
                  }}>
                  {selectMode && (
                    <span style={{...styles.selCheck, ...(selected.has(m._id) ? styles.selCheckOn : null)}}>
                      {selected.has(m._id) && <Icon name="check" size={13} style={{color: '#fff'}} />}
                    </span>
                  )}
                  {/* Your own messages need no avatar — the right-hand side
                      already identifies them, and dropping it widens the thread. */}
                  {!mine && (
                    <div style={styles.gutter}>
                      {grouped ? (
                        <span style={styles.gutterSpacer} />
                      ) : (
                        <div style={{...styles.msgAvatar, background: avatarColor(seed)}}>
                          {senderName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}

                  <MessageMotion
                    mine={mine}
                    style={{
                      ...styles.msgMain,
                      background: bubbleBg,
                      borderColor: mine ? 'transparent' : 'var(--cb-border)',
                      alignItems: mine ? 'flex-end' : 'flex-start',
                      // Square off the corner nearest the speaker so a run of
                      // bubbles reads as one turn rather than separate cards.
                      borderTopRightRadius: mine && grouped ? 0 : 2,
                      borderTopLeftRadius: !mine && grouped ? 0 : 2,
                    }}>
                    {/* Names only earn their space in a group thread. */}
                    {!grouped && !mine && isGroupChat && (
                      <div style={styles.msgHead}>
                        <span style={{...styles.senderName, color: colors.primary}}>{senderName}</span>
                      </div>
                    )}

                    <div style={{...styles.msgContent, color: bubbleText}}>
                      {burned ? (
                        <div style={styles.burnedRow}>
                          <Icon name="flame" size={16} /> {t('chat.messageBurned')}
                        </div>
                      ) : burnUnrevealed ? (
                        <button style={styles.burnReveal} onClick={e => {e.stopPropagation(); revealBurn(m);}}>
                          <Icon name="flame" size={18} />
                          <span style={styles.burnRevealTitle}>{t('chat.tapToReveal')}</span>
                          <span style={styles.burnRevealSub}>{formatBurnDuration(burn!.duration)}</span>
                        </button>
                      ) : (
                        <>
                          {m.replyTo && (
                            <button
                              style={styles.replyQuote}
                              onClick={e => {
                                e.stopPropagation();
                                scrollToMessage(m.replyTo!._id);
                              }}>
                              <span style={styles.replyQuoteName}>{m.replyTo.user?.name || 'User'}</span>
                              <span style={styles.replyQuoteText}>
                                {m.replyTo.text || (m.replyTo.image ? '[Photo]' : '')}
                              </span>
                            </button>
                          )}
                          {m.image &&
                            (voLocked ? (
                              <button
                                style={styles.voPlaceholder}
                                onClick={e => {e.stopPropagation(); openViewOnce(m);}}>
                                <Icon name="eye" size={18} />
                                <span>{t('chat.viewOncePhoto')}</span>
                              </button>
                            ) : voExpired ? (
                              <div style={styles.voExpired}>
                                <Icon name="eyeOff" size={16} /> {t('chat.viewOnceExpired')}
                              </div>
                            ) : (
                              <div>
                                {m.viewOnce && (
                                  <span style={styles.voBadge}>
                                    <Icon name="eye" size={11} /> {t('chat.viewOnceBadge')}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  style={styles.imageBtn}
                                  aria-label={`Photo from ${m.user?.name || 'User'}, open full size`}
                                  onClick={e => {e.stopPropagation(); lightbox.open(m.image!);}}>
                                  <img src={m.image} alt="" style={styles.image} />
                                </button>
                              </div>
                            ))}
                          {m.gif && (
                            <button
                              type="button"
                              style={styles.imageBtn}
                              aria-label={`GIF from ${m.user?.name || 'User'}, open full size`}
                              onClick={e => {
                                e.stopPropagation();
                                if (m.gif?.url) lightbox.open(m.gif.url);
                              }}>
                              <img src={m.gif.previewUrl || m.gif.url} alt="" style={styles.gifMsg} />
                            </button>
                          )}
                          {m.audio && <AudioMessage url={m.audio} duration={m.audioDuration} mine={mine} />}
                          {m.audio && (transcribing.has(m._id) || m.transcription) && (
                            <div style={styles.transcription}>
                              {transcribing.has(m._id) ? t('chat.transcribing') : m.transcription}
                            </div>
                          )}
                          {m.file &&
                            // The sender's client writes this uri; a hostile one
                            // could make it `javascript:…`. Legitimate values are
                            // Storage URLs or inline data: attachments, both of
                            // which survive the check — anything else renders as
                            // a non-clickable card instead of running code.
                            (() => {
                              const fileUrl = safeExternalUrl(m.file.uri);
                              const inner = (
                                <>
                                  <Icon name="file" size={20} />
                                  <span style={styles.fileName}>{m.file.name}</span>
                                  {fileUrl && <Icon name="download" size={16} />}
                                </>
                              );
                              return fileUrl ? (
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={styles.fileCard}>
                                  {inner}
                                </a>
                              ) : (
                                <div style={styles.fileCard} title={t('chat.unsafeLink')}>
                                  {inner}
                                </div>
                              );
                            })()}
                          {m.text &&
                            // Own messages, and the "🔒 …" placeholder shown
                            // ahead of decryption, never animate — see
                            // CipherText for why outgoing is excluded, and
                            // withDecryptedPlaceholders above for the marker.
                            (mine || m.text.startsWith('🔒') ? (
                              <span style={styles.msgText}>{renderMentions(m.text, mentionNames)}</span>
                            ) : (
                              <CipherText
                                text={m.text}
                                messageId={m._id}
                                createdAtMs={m.createdAt?.toMillis?.()}
                                sealedColor={colors.primary}
                                style={styles.msgText}>
                                <span style={styles.msgText}>{renderMentions(m.text, mentionNames)}</span>
                              </CipherText>
                            ))}
                          {(countdown != null || m.editedAt) && (
                            <span style={styles.inlineMeta}>
                              {countdown != null && (
                                <span style={styles.burnCountdown}>
                                  <Icon name="flame" size={11} style={{verticalAlign: '-1px'}} /> {countdown}s
                                </span>
                              )}
                              {m.editedAt && <span style={styles.edited}> {t('chat.edited')}</span>}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Time sits in the bubble's trailing corner, the way a
                        modern messenger does, instead of on a header line
                        that repeated the sender's name on every message. */}
                    <div style={{...styles.bubbleFoot, color: bubbleDim}}>
                      {isMsgPinned && <Icon name="pin" size={11} />}
                      <span>{formatTime(m.createdAt)}</span>
                    </div>

                    {!contentHidden && translations[m._id] && (
                      <div style={styles.translation}>
                        <Icon name="globe" size={13} style={{marginRight: 5, verticalAlign: '-2px'}} />
                        {translations[m._id]}
                      </div>
                    )}
                    {!contentHidden && <LinkPreviewCard preview={m.linkPreview} />}

                    {reactions.length > 0 && (
                      <div style={styles.reactions}>
                        {reactions.map(([emoji, uids]) => (
                          <button
                            key={emoji}
                            className="cb-reaction"
                            onClick={e => {
                              e.stopPropagation();
                              // Only celebrate adding one. Bursting on removal
                              // would reward taking a reaction back.
                              if (!uids.includes(me.uid)) burst(emoji, e.clientX, e.clientY);
                              toggleReaction(chatId, m._id, emoji, me.uid);
                            }}
                            style={{
                              ...styles.reactionChip,
                              borderColor: uids.includes(me.uid) ? colors.primary : colors.border,
                            }}>
                            {emoji} {uids.length}
                          </button>
                        ))}
                      </div>
                    )}

                    {activeMsg === m._id && (
                      <div style={styles.actionBar} onClick={e => e.stopPropagation()}>
                        {reactionOpen === m._id && (
                          <div style={styles.reactionGroup}>
                            {QUICK_EMOJI.map(emoji => (
                              <button
                                key={emoji}
                                className="cb-reaction"
                                style={styles.emojiBtn}
                                onClick={e => {
                                  burst(emoji, e.clientX, e.clientY);
                                  toggleReaction(chatId, m._id, emoji, me.uid);
                                  setActiveMsg(null);
                                  setReactionOpen(null);
                                }}>
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        <div style={styles.actionGroup}>
                        <button
                          style={
                            reactionOpen === m._id
                              ? {...styles.smallAction, borderColor: colors.primary, color: colors.primary}
                              : styles.smallAction
                          }
                          title={t('chat.react')}
                          onClick={() => setReactionOpen(reactionOpen === m._id ? null : m._id)}>
                          <Icon name="smile" size={15} />
                        </button>
                        {!contentHidden && (
                          <button
                            style={styles.smallAction}
                            title={t('chat.reply')}
                            onClick={() => {
                              setReplyTarget(m);
                              setActiveMsg(null);
                              setTimeout(() => inputRef.current?.focus(), 0);
                            }}>
                            <Icon name="reply" size={15} />
                          </button>
                        )}
                        {!contentHidden && m.text && (
                          <button
                            style={styles.smallAction}
                            title={t('chat.forward')}
                            onClick={() => {
                              setForwardTarget(m);
                              setActiveMsg(null);
                            }}>
                            <Icon name="forward" size={15} />
                          </button>
                        )}
                        {!contentHidden && (
                          <button
                            style={styles.smallAction}
                            title={isMsgPinned ? t('chat.unpinMessage') : t('chat.pinMessage')}
                            onClick={() => onTogglePin(m)}>
                            <Icon name="pin" size={15} style={isMsgPinned ? {color: colors.primary} : undefined} />
                          </button>
                        )}
                        {!contentHidden && m.audio && !m.transcription && (
                          <button style={styles.smallAction} title={t('chat.transcribe')} onClick={() => onTranscribe(m)}>
                            <Icon name="sparkles" size={15} />
                          </button>
                        )}
                        {!contentHidden && (
                          <button style={styles.smallAction} title={t('chat.save')} onClick={() => saveBookmark(m)}>
                            <Icon name="bookmark" size={15} />
                          </button>
                        )}
                        {!contentHidden && (
                          <button
                            style={styles.smallAction}
                            title={t('reminder.remindMe')}
                            onClick={() => {
                              const d = new Date(Date.now() + 60 * 60 * 1000);
                              d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                              setReminderAt(d.toISOString().slice(0, 16));
                              setReminderFor(m);
                              setActiveMsg(null);
                            }}>
                            <Icon name="bell" size={15} />
                          </button>
                        )}
                        {!contentHidden && m.text && (
                          <button style={styles.smallAction} title={t('chat.translate')} onClick={() => doTranslate(m)}>
                            <Icon name="globe" size={15} />
                          </button>
                        )}
                        {!contentHidden && mine && m.text && !m.burnAfterReading && (
                          <button style={styles.smallAction} title={t('chat.edit')} onClick={() => startEdit(m)}>
                            <Icon name="edit" size={15} />
                          </button>
                        )}
                        <button
                          style={styles.smallAction}
                          title={t('chat.selectMessages')}
                          onClick={() => enterSelect(m._id)}>
                          <Icon name="check" size={15} />
                        </button>
                        {mine ? (
                          <button
                            style={styles.smallAction}
                            title={t('common.delete')}
                            onClick={() => {
                              deleteMessage(chatId, m._id, me.uid);
                              setActiveMsg(null);
                            }}>
                            <Icon name="trash" size={15} />
                          </button>
                        ) : (
                          // Deleting is author-only (firestore.rules), so the
                          // action on someone else's message is to report it.
                          <button
                            style={styles.smallAction}
                            title="Report"
                            onClick={() => {
                              setReportTarget({
                                messageId: m._id,
                                authorUid: String(m.user?._id ?? ''),
                                content: typeof m.text === 'string' ? m.text : '',
                              });
                              setActiveMsg(null);
                            }}>
                            <Icon name="alertTriangle" size={15} />
                          </button>
                        )}
                        </div>
                      </div>
                    )}
                  </MessageMotion>
                </div>
              </div>
            );
          })
        )}
        {seen && (
          <div style={styles.seen}>
            <Icon name="check" size={12} style={{verticalAlign: '-1px'}} /> {t('chat.seen')} {seenAt}
          </div>
        )}
        {/* The bouncing dots carry the meaning, so the label is visually
            dropped and kept for screen readers only. */}
        {otherTyping && (
          <div style={styles.typing}>
            <span className="cb-typing" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="sr-only">{t('chat.typing')}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!atBottom && (
        <button className="jump-latest" onClick={jumpToLatest} title={t('chat.newMessages')}>
          <Icon name="back" size={18} style={{transform: 'rotate(-90deg)'}} />
          {newCount > 0 && <span className="badge">{newCount}</span>}
        </button>
      )}

      {uploadPct !== null && (
        <div style={styles.uploadBar}>
          <div style={{...styles.uploadFill, width: `${uploadPct}%`}} />
          <span style={styles.uploadLabel}>
            {t('chat.uploading')} {uploadPct}%
          </span>
        </div>
      )}

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={onImageSelected} />
      <input ref={fileInputRef} type="file" hidden onChange={onFileSelected} />

      {(burnMode || viewOnceMode) && !editing && !recording && (
        <div style={styles.ephemeralBar}>
          {burnMode && (
            <button
              style={styles.ephemChip}
              title={t('chat.burnAfterReading')}
              onClick={() => setBurnDuration(cycleBurnDuration)}>
              <Icon name="flame" size={13} /> {t('chat.burnAfterReading')} · {formatBurnDuration(burnDuration)}
            </button>
          )}
          {viewOnceMode && (
            <span style={styles.ephemChip}>
              <Icon name="eye" size={13} /> {t('chat.viewOnce')}
            </span>
          )}
          <button
            style={styles.ephemClose}
            title={t('common.close')}
            onClick={() => {
              setBurnMode(false);
              setViewOnceMode(false);
            }}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {scheduled.length > 0 && !editing && (
        <div style={styles.scheduledWrap}>
          <button style={styles.scheduledChip} onClick={() => setShowScheduled(v => !v)}>
            <Icon name="timer" size={13} /> {t('chat.scheduledCount')} · {scheduled.length}
          </button>
          {showScheduled && (
            <div style={styles.scheduledList}>
              {scheduled.map(s => (
                <div key={s._id} style={styles.scheduledItem}>
                  <span style={styles.scheduledText}>{s.text}</span>
                  <span style={styles.scheduledTime}>
                    {new Date(s.scheduledFor).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                  </span>
                  <button
                    style={styles.searchClose}
                    aria-label={`Cancel scheduled message: ${s.text}`}
                    onClick={() => cancelScheduledMessage(chatId, s._id).catch(() => undefined)}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scheduleOpen && !editing && (
        <div style={styles.expiryBar}>
          <span style={styles.expiryTitle}>
            <Icon name="timer" size={15} /> {t('chat.schedule')}
          </span>
          <input
            type="datetime-local"
            style={styles.scheduleInput}
            aria-label={t('chat.schedule')}
            value={scheduleAt}
            onChange={e => setScheduleAt(e.target.value)}
          />
          <button style={styles.recSend} onClick={doSchedule} disabled={!text.trim() || !scheduleAt}>
            {t('chat.schedule')}
          </button>
          <button style={styles.searchClose} aria-label={t('common.close')} onClick={() => setScheduleOpen(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {reminderFor && (
        <div style={styles.expiryBar}>
          <span style={styles.expiryTitle}>
            <Icon name="bell" size={15} /> {t('reminder.remindMe')}
          </span>
          <input
            type="datetime-local"
            style={styles.scheduleInput}
            aria-label={t('reminder.remindMe')}
            value={reminderAt}
            onChange={e => setReminderAt(e.target.value)}
          />
          <button style={styles.recSend} onClick={doRemind} disabled={!reminderAt}>
            {t('reminder.set')}
          </button>
          <button style={styles.searchClose} aria-label={t('common.close')} onClick={() => setReminderFor(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {smartReplies.length > 0 && (
        <div style={styles.smartReplies}>
          {smartReplies.map(s => (
            <button
              key={s}
              style={styles.smartReplyChip}
              onClick={() => {
                setText(s);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {replyTarget && !editing && (
        <div style={styles.replyBar}>
          <Icon name="reply" size={15} style={{color: colors.primary, flexShrink: 0}} />
          <div style={styles.replyBarBody}>
            <span style={styles.replyBarName}>
              {t('chat.replyingTo')} {replyTarget.user?.name || 'User'}
            </span>
            <span style={styles.replyBarText}>
              {replyTarget.text ||
                (replyTarget.image ? '[Photo]' : replyTarget.gif ? '[GIF]' : replyTarget.audio ? '[Voice message]' : '[Media]')}
            </span>
          </div>
          <button style={styles.ephemClose} onClick={() => setReplyTarget(null)} title={t('common.cancel')}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {mention && mentionMatches.length > 0 && !editing && (
        <div style={styles.mentionPopup}>
          {mentionMatches.map(c => (
            <button key={c.uid} style={styles.mentionItem} onClick={() => pickMention(c)}>
              <div style={{...styles.mentionAvatar, background: avatarColor(c.uid)}}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {peerDeleted ? (
        // Replaces the composer outright rather than disabling it. A greyed-out
        // input still invites you to type something you can't send; a plain
        // statement of why the conversation is over does not.
        <div style={styles.deletedComposer} role="status">
          {t('chat.recipientDeletedComposer')}
        </div>
      ) : editing ? (
        <form onSubmit={send} style={styles.composer}>
          <div style={styles.editTag}>
            <Icon name="edit" size={14} /> {t('chat.editing')}
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            style={styles.input}
            value={editing.text}
            onChange={e => onInput(e.target.value)}
            onKeyDown={onComposerKeyDown}
            autoFocus
          />
          <button
            type="submit"
            className="cb-send"
            style={{...styles.sendBtn, background: colors.primary}}>
            {t('common.save')}
          </button>
          <button type="button" style={styles.composerIcon} title={t('common.cancel')} onClick={() => setEditing(null)}>
            <Icon name="close" size={20} />
          </button>
        </form>
      ) : recording ? (
        <div style={styles.recBar}>
          <span style={styles.recDot} />
          <span style={styles.recTime}>
            {t('chat.recording')} · {formatSecs(recSecs)}
          </span>
          <button style={styles.recCancel} onClick={() => stopRecording(false)}>
            {t('common.cancel')}
          </button>
          <button style={styles.recSend} onClick={() => stopRecording(true)}>
            {t('common.send')}
          </button>
        </div>
      ) : (
        <form onSubmit={send} style={styles.composer}>
          <button
            type="button"
            style={styles.composerIcon}
            title={t('moments.addPhoto')}
            disabled={uploadPct !== null}
            onClick={() => imageInputRef.current?.click()}>
            <Icon name="image" size={20} />
          </button>
          <button
            type="button"
            style={styles.composerIcon}
            title="Attach a file"
            disabled={uploadPct !== null}
            onClick={() => fileInputRef.current?.click()}>
            <Icon name="paperclip" size={20} />
          </button>
          <button
            type="button"
            style={styles.composerIcon}
            title={t('chat.sendGif')}
            onClick={() => setGifOpen(true)}>
            <Icon name="gif" size={22} />
          </button>
          <button
            type="button"
            style={{...styles.composerIcon, ...(sharingLocation ? {color: colors.primary} : null)}}
            title={sharingLocation ? 'Stop sharing location' : 'Share live location'}
            onClick={() => (sharingLocation ? handleStopSharingLocation() : setShareLocationModalOpen(true))}>
            <Icon name="pin" size={18} />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            style={styles.input}
            placeholder={t('chat.typeMessage')}
            value={text}
            onChange={e => onInput(e.target.value)}
            onKeyDown={onComposerKeyDown}
            onBlur={() => setTyping(chatId, me.uid, false)}
            onPaste={onPaste}
            autoFocus
          />
          {text.trim() ? (
            <button
              type="submit"
              className={`cb-send cb-glow${launching ? ' cb-launch cb-shimmer' : ''}`}
              style={
                {...styles.sendBtn, background: colors.primary, '--cb-anim-accent': colors.primary} as React.CSSProperties
              }
              disabled={sending}>
              {t('common.send')}
            </button>
          ) : (
            <button type="button" style={styles.composerIcon} title="Record a voice message" onClick={startRecording}>
              <Icon name="mic" size={20} />
            </button>
          )}
        </form>
      )}

      {whiteboardOpen && (
        <WhiteboardModal chatId={chatId} myUid={me.uid} onClose={() => setWhiteboardOpen(false)} />
      )}
      {gifOpen && <GifPicker onPick={onGifPick} onClose={() => setGifOpen(false)} />}
      {reportTarget && (
        <ReportMessageModal
          chatId={chatId}
          messageId={reportTarget.messageId}
          authorUid={reportTarget.authorUid}
          content={reportTarget.content}
          me={me}
          onClose={() => setReportTarget(null)}
        />
      )}
      {forwardTarget && (
        <QuickSwitcher
          myUid={me.uid}
          title={t('chat.forwardTo')}
          placeholder={t('chat.forwardTo')}
          excludeChatId={chatId}
          onSelect={handleForwardPick}
          onClose={() => setForwardTarget(null)}
        />
      )}
      {showLockSettings && (
        <ChatLockModal chatId={chatId} mode="manage" onClose={() => setShowLockSettings(false)} />
      )}
      {showMembers && chat && (
        <GroupMembersModal
          chatId={chatId}
          myUid={me.uid}
          participants={chat.participants || []}
          onClose={() => setShowMembers(false)}
          // Leaving revokes read access, so staying on the thread would just
          // show permission errors — send them back to the chat list.
          onLeft={() => {
            setShowMembers(false);
            onBack?.();
          }}
        />
      )}
      {proPromptOpen && <ProUpsellModal onClose={() => setProPromptOpen(false)} />}
      {shareLocationModalOpen && (
        <ShareLocationModal onClose={() => setShareLocationModalOpen(false)} onChoose={beginSharingLocation} />
      )}
      {aiConsentRetry && (
        <AiConsentModal
          onAccept={() => {
            const retry = aiConsentRetry;
            setAiConsentRetry(null);
            retry();
          }}
          onClose={() => setAiConsentRetry(null)}
        />
      )}
      {trashOpen && (
        <RecentlyDeletedModal chatId={chatId} uid={me.uid} onClose={() => setTrashOpen(false)} />
      )}
      {settingsOpen && (
        <ChatSettingsModal
          chatId={chatId}
          me={me}
          chat={chat}
          onClose={() => setSettingsOpen(false)}
          onDeleted={onDeleted}
        />
      )}
      {mediaOpen && <ChatMediaModal messages={messages} onClose={() => setMediaOpen(false)} />}
      {playlistOpen && <PlaylistModal chatId={chatId} me={me} peerUid={otherUid} onClose={() => setPlaylistOpen(false)} />}
      {countdownOpen && <CountdownModal chatId={chatId} me={me} peerUid={otherUid} onClose={() => setCountdownOpen(false)} />}
      {listsOpen && (
        <SharedListsModal chatId={chatId} me={me} peerUid={otherUid} onClose={() => setListsOpen(false)} />
      )}
      {verifyOpen && otherUid && (
        <VerifyContactModal
          myUid={me.uid}
          peerUid={otherUid}
          peerName={title}
          onClose={() => setVerifyOpen(false)}
          onVerified={() => setPeerKeyChanged(false)}
        />
      )}
    </div>
  );
}

function formatTime(ts: ChatMessage['createdAt']): string {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

function formatSecs(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

const MENTION_STYLE: React.CSSProperties = {color: colors.primary, fontWeight: 700};

// Renders message text with @mentions of known participant names highlighted.
function renderMentions(text: string, names: string[]): React.ReactNode {
  if (!names.length) return text;
  const escaped = names
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`@(?:${escaped.join('|')})`, 'g');
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} style={MENTION_STYLE}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

// Builds the compact reply snapshot stored on a reply message, omitting empty
// fields (Firestore rejects nested `undefined`).
function buildReplyTo(m: ChatMessage): NonNullable<ChatMessage['replyTo']> {
  const r: NonNullable<ChatMessage['replyTo']> = {
    _id: m._id,
    user: {_id: m.user?._id || '', name: m.user?.name || ''},
  };
  if (m.text) r.text = m.text;
  else if (m.image) r.text = '[Photo]';
  else if (m.gif) r.text = '[GIF]';
  else if (m.audio) r.text = '[Voice message]';
  else if (m.file) r.text = '[File]';
  else if (m.encrypted || m.encryptedImage || m.encryptedVideo || m.encryptedAudio || m.encryptedFileUri) {
    r.text = '🔒 Encrypted message';
  }
  if (m.image) r.image = m.image;
  return r;
}

function formatRelative(ms: number, t: (k: TKey) => string): string {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return t('chat.justNow');
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ms).toLocaleDateString([], {month: 'short', day: 'numeric'});
}

// Chronological order; messages with an unresolved (pending) timestamp sort to
// the newest end so a just-sent message stays at the bottom, not the top.
function msgTime(m: ChatMessage): number {
  return m.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
}
function sortByTime(list: ChatMessage[]): ChatMessage[] {
  return list.sort((a, b) => msgTime(a) - msgTime(b));
}

function expiryLabel(t: (k: TKey) => string, hours: number): string {
  switch (hours) {
    case 1:
      return t('chat.expiry1h');
    case 24:
      return t('chat.expiry24h');
    case 168:
      return t('chat.expiry7d');
    case 720:
      return t('chat.expiry30d');
    default:
      return t('chat.expiryOff');
  }
}

const styles: Record<string, React.CSSProperties> = {
  pane: {flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative'},
  header: {
    // backdrop-filter creates a stacking context, which traps the dropdown
    // menu's z-index inside this element. Without a position/z-index of its
    // own the whole header stacks below the messages container that follows
    // it in the DOM, so message bubbles painted over the open menu.
    position: 'relative',
    zIndex: 20,
    padding: '15px 24px',
    fontWeight: 700,
    fontSize: 17,
    color: colors.text,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {display: 'flex', alignItems: 'center', flex: 1, minWidth: 0},
  headerTitleCol: {display: 'flex', flexDirection: 'column', minWidth: 0},
  headerTitle: {display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
  presence: {fontSize: 12, fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'},
  backBtn: {
    background: 'none',
    border: 'none',
    color: colors.primary,
    display: 'flex',
    alignItems: 'center',
    marginRight: 6,
    marginLeft: -6,
    padding: 4,
  },
  tag: {marginLeft: 8, display: 'inline-flex', alignItems: 'center', color: colors.textSecondary},
  headerActions: {display: 'flex', alignItems: 'center', gap: 8},
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 40,
    background: colors.menuSolid,
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    boxShadow: '0 24px 48px -16px rgba(0,0,0,0.5)',
    // The menu has grown past what a short window can show. Without a cap it
    // ran off the bottom and its last items (Chat settings, Delete chat) sat
    // under the composer, unclickable. Cap to the space below the header and
    // scroll the overflow instead.
    maxHeight: 'calc(100vh - 96px)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    zIndex: 30,
    minWidth: 168,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '11px 16px',
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    color: colors.text,
  },
  menuDivider: {height: 1, background: colors.border, margin: '4px 8px'},
  smartReplies: {display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 16px 0'},
  smartReplyChip: {
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.primary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  menuItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    textAlign: 'left',
    padding: '11px 16px',
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    color: colors.text,
  },
  menuProTag: {
    marginLeft: 'auto',
    padding: '1px 7px',
    borderRadius: 999,
    background: colors.primaryLight,
    color: colors.primary,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.3px',
  },
  summaryBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 24px',
    background: colors.primaryLight,
    borderBottom: `1px solid ${colors.border}`,
  },
  summaryRow: {display: 'flex', alignItems: 'flex-start', gap: 10},
  summaryTitle: {display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: colors.primary, flexShrink: 0, marginTop: 2},
  summaryText: {flex: 1, fontSize: 14, color: colors.text, lineHeight: 1.4, whiteSpace: 'pre-wrap'},
  summaryClose: {background: 'none', border: 'none', color: colors.textSecondary, display: 'flex', alignItems: 'center'},
  summaryAskRow: {display: 'flex', gap: 8},
  summaryAskInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 13,
    outline: 'none',
  },
  summaryAskBtn: {
    padding: '8px 14px',
    borderRadius: 2,
    border: 'none',
    background: colors.primary,
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  translation: {
    marginTop: 4,
    padding: '6px 10px',
    borderRadius: 2,
    background: colors.surfaceStrong,
    border: `1px dashed ${colors.border}`,
    fontSize: 13.5,
    color: colors.textSecondary,
    maxWidth: '100%',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    // Symmetric gutters: bubbles are aligned to both edges now, so the
    // Slack-style left-anchored column this used to have left own-messages
    // floating far from the right edge on wide screens.
    padding: '20px max(24px, calc((100% - 1064px) / 2))',
    display: 'flex',
    flexDirection: 'column',
  },
  // Grows to push a short conversation to the bottom; collapses to 0 once the
  // content overflows (so scrolling/pagination is unaffected).
  msgSpacer: {flexGrow: 1, flexShrink: 1, minHeight: 0},
  loadOlder: {display: 'flex', justifyContent: 'center', marginBottom: 12},
  loadOlderBtn: {
    padding: '7px 16px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    minWidth: 120,
    minHeight: 32,
  },
  emptyMsgs: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary},
  systemRow: {display: 'flex', justifyContent: 'center', margin: '10px 0'},
  systemPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '6px 14px',
    borderRadius: 999,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 600,
  },
  systemTime: {fontSize: 11, color: colors.textTertiary},
  // ---- Slack/Discord-style message rows ----
  msgRow: {display: 'flex', gap: 8, padding: '0 14px', position: 'relative', alignItems: 'flex-end'},
  msgRowSelected: {background: colors.primaryLight},
  selCheck: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 999,
    border: `2px solid ${colors.borderStrong}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  selCheckOn: {background: colors.primary, borderColor: colors.primary},
  selectBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
  },
  selectCancel: {
    border: 'none',
    background: 'transparent',
    color: colors.text,
    display: 'flex',
    cursor: 'pointer',
    padding: 4,
  },
  selectCount: {flex: 1, fontWeight: 700, color: colors.text, fontSize: 15},
  selectAllBtn: {
    border: 'none',
    background: 'transparent',
    color: colors.primary,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    padding: '6px 8px',
  },
  selectDelete: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: 'none',
    background: colors.danger,
    color: colors.textOnDanger,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  gutter: {width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', alignSelf: 'flex-end'},
  gutterSpacer: {width: 32, height: 1},
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  groupedTime: {fontSize: 10.5, color: colors.textTertiary, lineHeight: '22px'},
  msgMain: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    maxWidth: 'min(68%, 560px)',
    padding: '8px 12px 6px',
    borderRadius: 2,
    // A ruled edge instead of a drop shadow. On a black ground a soft shadow
    // is invisible, and the outgoing bubble no longer needs lifting off the
    // surface — it *is* the brightest thing in the thread.
    border: '1px solid transparent',
  },
  msgHead: {display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2},
  dayDivider: {display: 'flex', justifyContent: 'center', margin: '18px 0 10px'},
  dayPill: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: colors.textSecondary,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 999,
    padding: '4px 12px',
  },
  senderName: {fontWeight: 700, fontSize: 13},
  msgHeadTime: {fontSize: 11.5, color: colors.textTertiary, flexShrink: 0},
  msgContent: {fontSize: 15, lineHeight: 1.45, color: colors.text, wordBreak: 'break-word', overflowWrap: 'anywhere'},
  bubbleFoot: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    fontSize: 10.5,
    lineHeight: 1,
    marginTop: 4,
    whiteSpace: 'nowrap',
  },
  msgText: {whiteSpace: 'pre-wrap'},
  inlineMeta: {marginLeft: 8, fontSize: 11, color: colors.textTertiary, whiteSpace: 'nowrap'},
  gifMsg: {display: 'block', maxWidth: 260, width: '100%', borderRadius: 2, margin: '4px 0', cursor: 'zoom-in'},
  transcription: {
    margin: '4px 0',
    padding: '7px 11px',
    borderRadius: 2,
    background: colors.surfaceStrong,
    border: `1px dashed ${colors.border}`,
    fontSize: 13.5,
    color: colors.textSecondary,
    maxWidth: 360,
  },
  replyQuote: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    textAlign: 'left',
    maxWidth: 320,
    margin: '2px 0 5px',
    padding: '5px 10px',
    border: 'none',
    borderLeft: `3px solid ${colors.primary}`,
    borderRadius: '4px 8px 8px 4px',
    background: colors.surfaceStrong,
    cursor: 'pointer',
  },
  replyQuoteName: {fontSize: 12, fontWeight: 700, color: colors.primary},
  replyQuoteText: {fontSize: 13, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300},
  keyChangedBanner: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '9px 24px',
    border: 'none',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.danger,
    color: colors.textOnDanger,
    fontSize: 13.5,
    fontWeight: 600,
    textAlign: 'left',
  },
  deletedBanner: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '9px 24px',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: 600,
    textAlign: 'left',
  },
  deletedComposer: {
    padding: '16px 24px',
    borderTop: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 1.5,
    textAlign: 'center',
  },
  pinnedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '9px 24px',
    border: 'none',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    textAlign: 'left',
  },
  pinnedBannerText: {flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, color: colors.textSecondary},
  pinnedBannerCount: {fontSize: 11, fontWeight: 700, color: colors.primary, background: colors.primaryLight, borderRadius: 999, padding: '1px 8px'},
  locationBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '9px 24px',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 600,
  },
  locationBannerStop: {
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 700,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  locationPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '8px 16px 0',
    padding: 8,
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    textAlign: 'left',
    cursor: 'pointer',
  },
  locationPreviewImage: {width: 56, height: 56, borderRadius: 2, objectFit: 'cover', flexShrink: 0},
  locationPreviewInfo: {display: 'flex', flexDirection: 'column', minWidth: 0},
  locationPreviewTitle: {fontSize: 13.5, fontWeight: 700, color: colors.text},
  locationPreviewCoords: {fontSize: 12.5, color: colors.textSecondary, marginTop: 1},
  locationPreviewMeta: {fontSize: 11.5, color: colors.textSecondary, marginTop: 2},
  replyBar: {display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: `1px solid ${colors.border}`, background: colors.surface},
  replyBarBody: {flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'},
  replyBarName: {fontSize: 12.5, fontWeight: 700, color: colors.primary},
  replyBarText: {fontSize: 13, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
  mentionPopup: {
    margin: '0 16px',
    background: colors.menuSolid,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    boxShadow: colors.shadowSoft,
    overflow: 'hidden',
  },
  mentionItem: {display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', color: colors.text, textAlign: 'left', fontSize: 14},
  mentionAvatar: {width: 26, height: 26, borderRadius: 999, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0},
  scheduledWrap: {borderTop: `1px solid ${colors.border}`, background: colors.surface, padding: '8px 16px'},
  scheduledChip: {display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: 12.5, fontWeight: 600},
  scheduledList: {marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4},
  scheduledItem: {display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px'},
  scheduledText: {flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, color: colors.text},
  scheduledTime: {fontSize: 12, color: colors.textTertiary, flexShrink: 0},
  scheduleInput: {padding: '7px 10px', borderRadius: 2, border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text, fontSize: 13, fontFamily: 'inherit'},
  image: {display: 'block', maxWidth: 360, width: '100%', borderRadius: 2, margin: '4px 0', cursor: 'zoom-in'},
  // Resets default button chrome so wrapping a message image in a real
  // <button> (for keyboard access) doesn't change how it looks — the image's
  // own style (image/gifMsg) still controls sizing.
  imageBtn: {display: 'block', border: 'none', background: 'none', padding: 0, margin: 0, cursor: 'zoom-in'},
  fileCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    margin: '4px 0',
    borderRadius: 2,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    textDecoration: 'none',
    minWidth: 200,
    maxWidth: 320,
  },
  fileName: {flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14},
  searchBar: {display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${colors.border}`, background: colors.surface},
  searchInput: {flex: 1, padding: '8px 12px', borderRadius: 2, border: `1px solid ${colors.border}`, background: colors.inputBg, fontSize: 14, color: colors.text},
  searchClose: {background: 'none', border: 'none', color: colors.textSecondary, display: 'flex', alignItems: 'center'},
  uploadBar: {position: 'relative', height: 26, background: colors.surface, borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center'},
  uploadFill: {position: 'absolute', left: 0, top: 0, bottom: 0, background: colors.primaryLight},
  uploadLabel: {position: 'relative', fontSize: 12, color: colors.textSecondary, paddingLeft: 16},
  composerIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  editTag: {display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: colors.primary, alignSelf: 'center', flexShrink: 0},
  recBar: {display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderTop: `1px solid ${colors.border}`, background: colors.surface},
  recDot: {width: 12, height: 12, borderRadius: 999, background: colors.danger, animation: 'spin 1s linear infinite'},
  recTime: {flex: 1, color: colors.text, fontWeight: 600},
  recCancel: {padding: '9px 16px', borderRadius: 999, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text, fontWeight: 600},
  recSend: {padding: '9px 20px', borderRadius: 999, border: 'none', background: colors.primary, color: colors.textOnDanger, fontWeight: 700},
  time: {display: 'block', fontSize: 10.5, marginTop: 3, textAlign: 'right'},
  edited: {opacity: 0.85, fontStyle: 'italic'},
  burnCountdown: {color: colors.danger, fontWeight: 700},
  burnedRow: {display: 'flex', alignItems: 'center', gap: 7, color: colors.textSecondary, fontStyle: 'italic', fontSize: 14},
  burnReveal: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '10px 22px',
    minWidth: 150,
    border: 'none',
    background: 'transparent',
    color: colors.text,
  },
  burnRevealTitle: {fontWeight: 700, fontSize: 14},
  burnRevealSub: {fontSize: 12, color: colors.textSecondary},
  voPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 18px',
    minWidth: 170,
    borderRadius: 2,
    border: `1px dashed ${colors.borderStrong}`,
    background: 'transparent',
    color: colors.text,
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 4,
  },
  voExpired: {display: 'flex', alignItems: 'center', gap: 7, color: colors.textSecondary, fontStyle: 'italic', fontSize: 13.5},
  voBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    color: colors.secondary,
    marginBottom: 5,
  },
  ephemeralBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderTop: `1px solid ${colors.border}`,
    background: colors.primaryLight,
  },
  ephemChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 999,
    border: `1px solid ${colors.primary}`,
    background: 'transparent',
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: 700,
  },
  ephemClose: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
    flexWrap: 'wrap',
  },
  expiryTitle: {display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: colors.text},
  expiryChips: {display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1},
  expiryChip: {
    padding: '6px 12px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: 600,
  },
  expiryChipOn: {background: colors.primary, color: colors.textOnPrimary, borderColor: colors.primary},
  menuCheck: {marginLeft: 'auto', color: colors.primary, fontWeight: 700, fontSize: 12},
  reactions: {display: 'flex', gap: 4, marginTop: 4},
  reactionChip: {
    padding: '2px 8px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    fontSize: 12,
    color: colors.text,
  },
  actionBar: {display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center'},
  // Emoji reactions grouped into one cohesive pill, distinct from the actions.
  reactionGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: '3px 6px',
    borderRadius: 999,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    boxShadow: colors.shadowSoft,
  },
  emojiBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    fontSize: 17,
    lineHeight: 1,
    padding: 0,
    cursor: 'pointer',
  },
  actionGroup: {display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap'},
  smallAction: {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.text,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seen: {textAlign: 'right', fontSize: 11.5, color: colors.textSecondary, margin: '4px 16px 8px 0'},
  typing: {fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', padding: '2px 4px'},
  composer: {
    display: 'flex',
    gap: 10,
    padding: '16px max(24px, calc(100% - 1064px)) 16px 24px',
    borderTop: `1px solid ${colors.border}`,
    background: colors.surface,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    padding: '11px 16px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    fontSize: 15,
    lineHeight: 1.4,
    color: colors.text,
    fontFamily: 'inherit',
    resize: 'none',
    maxHeight: 140,
    overflowY: 'auto',
    display: 'block',
  },
  sendBtn: {padding: '0 22px', height: 44, borderRadius: 999, border: 'none', background: colors.primary, color: colors.textOnPrimary, fontWeight: 700, fontSize: 15, flexShrink: 0},
};
