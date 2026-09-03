import React, {useContext, useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  Image,
  ActionSheetIOS,
  Platform,
  Pressable,
  TextInput,
  Keyboard,
  Linking,
  useColorScheme,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {GiftedChat, IMessage, MessageImage, Bubble, Time} from 'react-native-gifted-chat';
import MessageEntrance from '../../components/MessageEntrance';
import TypingDots from '../../components/TypingDots';
import ReactionBurst, {useReactionBurst} from '../../components/ReactionBurst';
import CipherText from '../../components/CipherText';
import Disintegrate from '../../components/Disintegrate';
import ReactionArc from '../../components/ReactionArc';
import ChatComposer from '../../components/ChatComposer';
import ChatInputToolbar from '../../components/ChatInputToolbar';
import ActionSheet, {type SheetAction} from '../../components/ActionSheet';
import {BottomTabBarHeightContext} from '@react-navigation/bottom-tabs';
import FanOutBloom, {useFanOutBloom} from '../../components/FanOutBloom';
import ThemeBackdrop from '../../components/ThemeBackdrop';
import CipherTexture from '../../components/CipherTexture';
import Icon from '../../components/Icon';
import {useTranslation} from 'react-i18next';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import Video from 'react-native-video';
import {useAuth} from '../../contexts/AuthContext';
import {useRoute, useNavigation, useFocusEffect} from '@react-navigation/native';
import {Message as ChatMessage, CallType, User} from '../../types';
import {getColors} from '../../theme/colors';
import GlassScreen from '../../components/GlassScreen';
import DocumentPicker from 'react-native-document-picker';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AVModeIOSOption,
  OutputFormatAndroidType,
  AudioSet,
} from 'react-native-audio-recorder-player';
import {getLinkPreview} from 'link-preview-js';
import {fire as haptic} from '../../utils/haptics';
import ImageViewing from 'react-native-image-viewing';
import SwipeToReply from '../../components/SwipeToReply';
import {getDraft, setDraft} from '../../services/drafts';
import {
  listenLiveLocation,
  shouldSendLocationUpdate,
  startSharingLocation,
  stopSharingLocation,
  updateSharedLocation,
  type LiveLocationShare,
} from '../../services/liveLocation';
import {isProActive, listenEntitlement, type Entitlement} from '../../services/entitlement';
import {listenStoreTheme, resolveAccent, resolveWallpaper} from '../../services/storeTheme';
import {useArtifactCrypto} from '../../hooks/useArtifactCrypto';
import {isAiConsentError} from '../../services/aiConsent';
import {promptAiConsent} from '../../utils/aiConsentPrompt';
import {safeExternalUrl} from '../../utils/safeUrl';
import type {StoreTheme} from '../../services/themeCatalog';
import type {Edge} from 'react-native-safe-area-context';
import {getCurrentPosition, watchMyPosition, LocationError} from '../../utils/geolocation';
import {formatCoordinates, staticMapTileUrl} from '../../utils/mapTile';
import {
  enqueueOutboxMessage,
  getCachedMessages,
  getOutboxMessages,
  removeOutboxMessage,
  setCachedMessages,
} from '../../services/offlineCache';
import {loadBodies, saveBodies} from '../../services/messageBodyStore';
import {useNetworkStatus} from '../../hooks/useNetworkStatus';
import {prefetchMessageImages} from '../../services/imageCache';
import {
  burnMessage,
  createCall,
  deleteMessages,
  getChat,
  getMessagesPage,
  getUserById,
  listenChat,
  listenMessages,
  sendMessage,
  setChatName,
  setLastRead,
  setTyping,
  togglePinMessage,
  toggleReaction,
  updateMessage,
  uploadFile,
  updateCall,
  cleanupStaleCalls,
} from '../../services/firebaseChat';
import {reportError} from '../../services/telemetry';
import {REPORT_REASONS, reportMessage} from '../../services/reports';
import {computeSafetyNumber, diagnoseSealed, isGroupSealed, isRatchetSealed, isSealed, openSealed, sealForRecipients, type EnvelopeRecipient} from '../../services/e2ee';
import {openEnvelope as openRatchetEnvelope} from '../../services/ratchetMessages';
import {fetchPeerRatchetIdentity, getOrCreateRatchetIdentity} from '../../services/ratchetKeys';
import {sealText} from '../../services/ratchetMessages';
import {
  handleMembershipChange,
  isGroupEnvelope,
  openGroupEnvelope,
  sealGroupText,
} from '../../services/groupRatchetMessages';
import {sealedKeyCount, sendTextMessage} from '../../services/e2eeMessages';
import ChatPickerModal from '../../components/ChatPickerModal';
import {fonts} from '../../theme/typography';
import {makeArtifactCrypto} from '../../services/e2eeArtifacts';
import {
  buildLinkPreviewPatch,
  extractFirstUrl,
  hasPreviewContent,
  isSafeToFetchDirectly,
  normalizePreview,
  parsePreview,
  type LinkPreviewData,
} from '../../services/linkPreview';
import {
  fetchPeerPublicKeyChecked,
  getDeviceKeypairIfEnrolled,
  getKeyGeneration,
  getOrCreateDeviceKeypair,
  peersSupportEncryptedMedia,
} from '../../services/e2eeKeys';
import {type MediaKeyInfo} from '../../services/mediaCrypto';
import {discard, encryptToScratch} from '../../services/mediaFiles';
import {resolveSealedMedia} from '../../services/mediaVault';
import {markViewOnceViewed} from '../../services/viewOnce';
import {MEDIA_SLOTS, decodeBody, encodeBody, type MediaSlot} from '../../services/messageBody';
import {
  hasLostPeer,
  isProfileDeleted,
  isRecipientUnreachable,
} from '../../services/recipient';
import {scheduleMessage, listenScheduledMessages} from '../../services/scheduledMessages';
import {createSharedList, updateSharedListItem} from '../../services/sharedLists';
import {createReminder} from '../../services/reminders';
import {transcribeVoiceMessage} from '../../services/transcription';
import {
  encodeAudioForInline,
  isDataUri,
  materializeInlineAudio,
} from '../../services/inlineAudio';
import {getChatSummary} from '../../services/aiSummary';
import {translateMessage} from '../../services/translation';
import {addBookmark} from '../../services/bookmarks';
import {addToQuoteWall} from '../../services/quoteWall';
import {searchGifs, getTrendingGifs} from '../../services/gifSearch';
import {getContextCards} from '../../services/contextCards';
import {listenChatPet, feedPet, calculatePetMood, decayHealth, didPetJustEat} from '../../services/chatPet';
import PetAvatar from '../../components/PetAvatar';
import {getSmartReplies} from '../../services/smartReply';
import {isChatLocked, verifyChatPIN} from '../../services/appLock';
import {isScreenshotProtectionEnabled, isLinkPreviewEnabled, isStealthMode, generateWatermark, isExifStrippingEnabled} from '../../services/privacyGuard';
import {SharedListItem, GifResult, ContextCard, ChatPet, VoiceFilter, MessageStyle, SoundscapeId, GestureStroke} from '../../types';
import {SHOW_NATIVE_ONLY_FEATURES, SHOW_CHAT_PET} from '../../config/parity';

// Fixed AAC capture settings used by both Android and iOS (see audioSet
// below) — unlike web's Opus recordings, AAC's sample rate isn't a fixed
// codec property, so transcribeVoiceMessage needs the real value sent
// alongside the clip rather than assuming one server-side.
/** Shared by the long-press menu and the magnetic arc, so the two cannot drift. */
const EMOJI_OPTIONS = ['😀', '😍', '😢', '😡', '🎉', '🔥', '👏'];

const VOICE_SAMPLE_RATE_HERTZ = 24000;
const VOICE_CHANNEL_COUNT = 1;

/** IMessage#createdAt is Date | number (gifted-chat); sort comparators need a
 * plain number from either. */
function toCreatedAtMillis(createdAt: Date | number): number {
  return createdAt instanceof Date ? createdAt.getTime() : createdAt;
}

/**
 * Strips decrypted bodies back out before a message reaches the offline cache.
 *
 * That cache is a plain JSON blob in MMKV and was only ever meant to hold what
 * the server holds. It quietly stopped doing so: `text` on a sealed message is
 * read from the decrypt cache, so any snapshot arriving after the first one
 * carried real plaintext into it — unplanned, undocumented, and not covered by
 * the reasoning in storageMMKV.ts about what may live there.
 *
 * Bodies have a proper home now (services/messageBodyStore.ts), encrypted under
 * a key of their own, so this puts the placeholder back and lets that store be
 * the only place plaintext is written.
 */
function withoutDecryptedBody(message: IMessage): IMessage {
  const em = message as any;
  if (!isSealed(em.encrypted)) return message;
  return {...message, text: '🔒 …', awaitingDecryption: true} as IMessage;
}

/** Module-level so the identity is stable: GlassScreen is memoized, and a fresh
 * array literal each render would defeat that for the whole screen. */
const NO_SAFE_AREA_EDGES: Edge[] = [];

export default function ChatScreen() {
  const {t, i18n} = useTranslation();
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<IMessage[]>([]);
  const [uploading, setUploading] = useState<{label: string; progress: number} | null>(null);
  const [inputText, setInputText] = useState('');
  // The composer is uncontrolled (see components/ChatComposer for why). These
  // two exist so the rare programmatic *writes* still work: bumping the
  // generation remounts the field with a fresh defaultValue.
  const [composerGeneration, setComposerGeneration] = useState(0);
  const composerSeedRef = useRef('');
  // The live text, tracked alongside state. Callbacks that need to *read* what
  // is currently typed must use this rather than the `inputText` closure: the
  // composer no longer round-trips through state on every keystroke, so a
  // memoised callback's captured copy can be several characters behind.
  const inputTextRef = useRef('');
  const handleComposerChange = useCallback((value: string) => {
    inputTextRef.current = value;
    setInputText(value);
  }, []);
  const composerRef = useRef<TextInput>(null);

  // Keyboard avoidance without KeyboardAvoidingView.
  //
  // KAV's `behavior="padding"` drives its padding change through
  // LayoutAnimation. On Fabric that left the message list rendered from a
  // stale rasterised snapshot — visibly blurred and faded, and it stayed that
  // way after the keyboard closed. Plain state-driven padding produces the
  // same layout with no animation anywhere near the thread.
  //
  // iOS only: Android's windowSoftInputMode=adjustResize already resizes the
  // window, so adding padding there would double-count the keyboard.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillChangeFrame', e => {
      // The keyboard's height overlaps the tab bar, which is already below us.
      //
      // Rounded to whole points, and that rounding is the entire point of this
      // line. GiftedChat's thread is an *inverted* FlatList, which React Native
      // implements by applying `transform: [{scaleY: -1}]` to the scroll view
      // and to every cell — so the whole thread is a GPU-composited layer,
      // and it is the only part of this screen that is.
      //
      // A transformed layer that lands on a fractional offset gets resampled
      // bilinearly, which softens everything inside it. Keyboard heights on a
      // 3x device are thirds (336.6667), so an unrounded inset put the thread
      // on a half-pixel boundary for exactly as long as the keyboard was up:
      // the messages blurred while you typed and sharpened when it closed.
      // Whole points are always pixel-aligned, so this cannot recur.
      setKeyboardInset(Math.round(Math.max(0, e.endCoordinates.height - tabBarHeight)));
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [tabBarHeight]);
  const setComposerText = useCallback((value: string) => {
    composerSeedRef.current = value;
    inputTextRef.current = value;
    setInputText(value);
    if (value === '') {
      // Clearing after a send goes through the imperative API so the field
      // keeps focus. Remounting here would close the keyboard every time you
      // sent a message, which is worse than the bug this all fixes.
      composerRef.current?.clear();
      return;
    }
    setComposerGeneration(g => g + 1);
  }, []);
  const [replyTo, setReplyTo] = useState<IMessage | null>(null);
  const [preview, setPreview] = useState<{uri: string; type: 'image' | 'video'} | null>(
    null,
  );
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number | null>(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | number | null>(null);
  const [otherUserName, setOtherUserName] = useState<string>('Chat');
  const [customName, setCustomName] = useState<string>('');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  // Every member except me — the fan-out recipient set. Distinct from
  // otherUserId, which is only the *first* other member and still drives the
  // 1:1-shaped header, safety number and recipient checks.
  const [otherUserIds, setOtherUserIds] = useState<string[]>([]);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  // Set when e2eeKeys detects the peer's public key changed after this device
  // had already trusted one for them — could be a substitution attack, could
  // be a reinstall. Surfaced as a banner rather than acted on automatically,
  // since this prototype cannot tell the two apart on its own.
  const [peerKeyChanged, setPeerKeyChanged] = useState(false);
  // The other person deleted their account. Two independent signals feed this
  // (services/recipient.ts): they vanished from the chat's participants, or
  // their profile document is gone. A deleted account leaves its chats behind —
  // this side keeps their own messages — so without this the conversation looks
  // completely normal and messages sent into it are read by nobody, forever.
  const [peerMissingFromChat, setPeerMissingFromChat] = useState(false);
  const [peerProfileGone, setPeerProfileGone] = useState(false);
  const peerDeleted = peerMissingFromChat || peerProfileGone;
  const [isTyping, setIsTyping] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Array<string | number>>([]);
  const [otherLastReadAt, setOtherLastReadAt] = useState<number>(0);
  const [themeColor, setThemeColor] = useState<string>('#007AFF');
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestCursor, setOldestCursor] = useState<any | null>(null);
  const [burnMode, setBurnMode] = useState(false);
  const [burnDuration, setBurnDuration] = useState(10);
  const [burnDurationPickerVisible, setBurnDurationPickerVisible] = useState(false);
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const [scheduleMinutes, setScheduleMinutes] = useState('5');
  const [scheduledCount, setScheduledCount] = useState(0);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listItems, setListItems] = useState<string[]>(['']);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryQuestion, setSummaryQuestion] = useState('');
  const [summaryAskedQuestion, setSummaryAskedQuestion] = useState('');
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifSearch, setGifSearch] = useState('');
  const [gifLoading, setGifLoading] = useState(false);
  const [timeCapsuleMode, setTimeCapsuleMode] = useState(false);
  const [capsuleHours, setCapsuleHours] = useState(24);
  const [capsulePickerVisible, setCapsulePickerVisible] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
  // The chat's own stored appearance, kept raw (undefined = never set) so the
  // account-wide Store theme can fill in for chats created after it was
  // applied. `null` is a real "no wallpaper" choice and must not fall through.
  const [chatAccent, setChatAccent] = useState<string | undefined>(undefined);
  const [chatWallpaperRaw, setChatWallpaperRaw] = useState<string | null | undefined>(undefined);
  const [storeTheme, setStoreTheme] = useState<StoreTheme | undefined>(undefined);
  const [dictating, setDictating] = useState(false);
  const [dictationSeconds, setDictationSeconds] = useState(0);
  const [contextCards, setContextCards] = useState<Record<string, ContextCard[]>>({});
  const [chatPet, setChatPet] = useState<ChatPet | null>(null);
  // Bumped whenever didPetJustEat sees a feed go through, so PetAvatar can
  // retrigger its celebration on every feed, not just the first one.
  const [petFeedPulse, setPetFeedPulse] = useState(0);
  // Same idea for arrivals: bumped when a message lands from the other side, so
  // the pet can lean toward it.
  const [petArrivalPulse, setPetArrivalPulse] = useState(0);
  // The message currently having a reaction picked for it, or null.
  const [arcTarget, setArcTarget] = useState<IMessage | null>(null);
  // The message currently being forwarded — set while the destination-chat
  // picker (ChatPickerModal) is open, null otherwise.
  const [forwardTarget, setForwardTarget] = useState<IMessage | null>(null);
  const prevChatPetRef = useRef<ChatPet | null>(null);
  const petWidgetRef = useRef<View>(null);
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilter>('none');
  const [invisibleInkMode, setInvisibleInkMode] = useState(false);
  const [revealedMessages, setRevealedMessages] = useState<Set<string>>(new Set());
  const [messageStyle, setMessageStyle] = useState<MessageStyle>('none');
  const [stylePickerVisible, setStylePickerVisible] = useState(false);
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [gestureMode, setGestureMode] = useState(false);
  const [gestureStrokes, setGestureStrokes] = useState<GestureStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<GestureStroke | null>(null);
  const [lotteryMode, setLotteryMode] = useState(false);
  const [lotteryOptions, setLotteryOptions] = useState<string[]>(['', '']);
  const [lotteryModalVisible, setLotteryModalVisible] = useState(false);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [chatUnlocked, setChatUnlocked] = useState(true);
  const [chatPinInput, setChatPinInput] = useState('');
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [attachSheetVisible, setAttachSheetVisible] = useState(false);
  // Anything the attach sheet launches that presents its own native UI —
  // the photo library, the camera, the document picker — has to wait until
  // this sheet is *fully* dismissed.
  //
  // iOS allows only one presented view controller at a time. Calling
  // setAttachSheetVisible(false) and launching the picker in the same handler
  // does not close the sheet first: the state update is async, so the picker
  // tries to present while the RN <Modal> is still on screen and mid-dismiss.
  // UIKit refuses, silently — no error, no picker, and the only visible effect
  // is the sheet disappearing. That is the "menu vanishes and nothing happens"
  // symptom.
  //
  // Modal's onDismiss (iOS-only) fires after the dismissal animation actually
  // completes, which is the earliest moment a second presentation is legal.
  // Deferring through it is exact, unlike a setTimeout guess that breaks on a
  // slow device or when animations are disabled.
  const pendingAttachActionRef = useRef<(() => void) | null>(null);
  const [msgSelectMode, setMsgSelectMode] = useState(false);
  const [msgSelected, setMsgSelected] = useState<Set<string>>(new Set());
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [peerLiveLocation, setPeerLiveLocation] = useState<LiveLocationShare | null>(null);
  const stopLocationWatchRef = useRef<(() => void) | null>(null);
  const lastLocationSentAtRef = useRef<number | null>(null);
  const dictationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burnTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  // Last member list this device saw, so a removal can be detected. Null until
  // the first snapshot — the initial list is not a change and must not rotate.
  const knownMembersRef = useRef<string[] | null>(null);
  const [burnCountdowns, setBurnCountdowns] = useState<Record<string, number>>({});
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const navigation = useNavigation<any>();
  const route = useRoute();
  const chatId = (route.params as any)?.chatId;
  // Seals shared-list contents to this pair — see services/e2eeArtifacts.ts.
  // Declared after chatId on purpose: it is an argument here, and a hook
  // placed above the declaration is a temporal-dead-zone crash.
  const artifactCrypto = useArtifactCrypto(chatId);
  const {isOnline, isOffline} = useNetworkStatus();
  const recorderRef = useRef(new AudioRecorderPlayer());
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDraftRef = useRef('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef<{value: boolean; at: number}>({value: false, at: 0});
  const listRef = useRef<FlatList<IMessage>>(null);
  const pendingRef = useRef<IMessage[]>([]);
  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCacheRef = useRef<{chatId: string; messages: IMessage[]} | null>(null);
  // Decrypted plaintext by message id, so a message is decrypted once and
  // reused across snapshot re-renders rather than re-decrypted every time the
  // listener fires for an unrelated change elsewhere in the chat. One map per
  // field, mirroring the encryptedX sibling fields on the Message type.
  const decryptedTextRef = useRef<Map<string, string>>(new Map());
  const decryptedImageRef = useRef<Map<string, string>>(new Map());
  const decryptedVideoRef = useRef<Map<string, string>>(new Map());
  const decryptedAudioRef = useRef<Map<string, string>>(new Map());
  const decryptedFileUriRef = useRef<Map<string, string>>(new Map());
  // Link previews decrypt to a JSON blob rather than a URL, so this cache
  // holds the parsed card (or null when the payload is unreadable/invalid).
  const decryptedPreviewRef = useRef<Map<string, LinkPreviewData | null>>(new Map());
  // Content keys recovered from a decrypted body, awaiting the download-and-
  // decrypt pass. Separate from the caches above because opening the body and
  // fetching the object are different costs: the first is local and instant,
  // the second is a network round trip per attachment. Keeping them apart is
  // what lets a caption appear immediately while its photo is still arriving.
  const pendingMediaRef = useRef<Map<string, Partial<Record<MediaSlot, MediaKeyInfo>>>>(new Map());
  // Tracks which device-key "generation" the caches above were decrypted
  // under, so a recovery-phrase restore (which changes the key without
  // remounting this screen) invalidates them instead of leaving messages
  // stuck showing a stale "Unable to decrypt".
  const decryptKeyGenerationRef = useRef<number>(getKeyGeneration());
  // Set when at least one message in this chat failed to decrypt *because it
  // was sealed to a key this device doesn't hold* — the recoverable failure,
  // as opposed to a damaged ciphertext. Drives the restore banner below.
  // Cleared per chat, not per snapshot: once you've seen one such message the
  // offer stays relevant for as long as you're in the thread.
  const [sealedToOtherDevice, setSealedToOtherDevice] = useState(false);
  // Latched when a peer's forward-secret session was replaced — a reinstall,
  // or an impersonation. The two are indistinguishable from here, so the user
  // is told rather than the app choosing for them.
  const [peerSessionReset, setPeerSessionReset] = useState(false);
  // Android's action menus. null when closed; setting it while one is open
  // swaps the contents, which is how a menu opens a submenu without the
  // dismiss/present race a second Modal would cause. iOS uses ActionSheetIOS
  // and never touches this.
  const [sheet, setSheet] = useState<{
    title?: string;
    message?: string;
    actions: SheetAction[];
  } | null>(null);

  // Reaction confetti. Reactions are chosen from an action sheet here rather
  // than tapped in place, so there is no pointer position to spawn from — the
  // burst starts where the sheet was, just below centre.
  const {bursts, burst, done: burstDone} = useReactionBurst();
  const {blooms, bloom, done: bloomDone} = useFanOutBloom();
  const burstAtSheet = useCallback(
    (emoji: string) => {
      const {width, height} = Dimensions.get('window');
      burst(emoji, width / 2, height * 0.62);
    },
    [burst],
  );

  /**
   * Best-effort E2EE for everything personal in an outgoing message: text,
   * and any of image/video/audio/file.uri that are present. If the peer has
   * no published key — not enrolled, offline, or any failure resolving one —
   * every field is returned exactly as given: plaintext, same as before this
   * feature existed. A message is never held back or dropped for lack of a
   * key. Used by every send path, INCLUDING the outbox flush, so a message
   * queued while offline gets the same protection as one sent live once the
   * network returns — that path used to send the queued plaintext outright.
   *
   * This is also where a changed peer key is noticed and surfaced: see
   * fetchPeerPublicKeyChecked in e2eeKeys.ts.
   *
   * Declared this early (rather than near onSend, its main caller) because
   * the outbox-flush effect further down needs it in a dependency array —
   * useCallback/useEffect deps are evaluated as part of the component's
   * synchronous render, so referencing a `const` before its own declaration
   * line is a real temporal-dead-zone crash, not just a style nit.
   */
  /**
   * `allowRatchet: false` forces the stateless fan-out path below, skipping the
   * double ratchet. Used for scheduled messages, which are sealed now and
   * delivered hours or days later.
   *
   * The ratchet would very likely survive that — a DH step stores the skipped
   * keys for the chain it leaves behind, which is exactly what makes
   * out-of-order delivery work — but "very likely" is doing real work in that
   * sentence: the skipped-key store is capped and evicts oldest-first, and a
   * cancelled scheduled message burns a chain position that never arrives.
   * Fan-out has no state to go stale, so a message sealed today opens next week
   * for the same reason it opens now.
   *
   * The cost is forward secrecy, and it is worth being exact about the
   * comparison: this is weaker than the ratchet, and stronger than what
   * scheduling did before, which was to store the text in the clear.
   */
  const encryptOutgoingMessage = useCallback(
    async (data: ChatMessage, opts?: {allowRatchet?: boolean}): Promise<ChatMessage> => {
      const allowRatchet = opts?.allowRatchet !== false;
      if (!user || !chatId || otherUserIds.length === 0) return data;
      try {
        /**
         * The sealed body carries the text *and* the content keys for any
         * attachments whose bytes were encrypted at upload time
         * (services/messageBody.ts). That is what lets media take the same
         * forward-secret path as text rather than needing one of its own: a
         * message with an encrypted photo is, from here, just a message with a
         * slightly longer body.
         *
         * An attachment that could *not* be encrypted — some recipient runs a
         * client that would render the ciphertext — still needs its URL sealed
         * field-by-field below, and the fan-out path is the only one that can
         * carry those. So the ratchet is used exactly when there is nothing
         * left outside the body.
         */
        const body = encodeBody({text: data.text ?? '', media: data.mediaKeys});
        const hasUnsealedMedia =
          !data.mediaSealed && !!(data.image || data.video || data.audio || data.file);
        const bodyOnly = !!body && !hasUnsealedMedia;

        if (allowRatchet && bodyOnly && otherUserIds.length === 1) {
          const outcome = await sealText(user.uid, chatId, otherUserIds[0], body);
          if (outcome.protection === 'ratchet') {
            if (outcome.identityStatus === 'changed') setPeerSessionReset(true);
            return {...data, text: '', mediaKeys: undefined, encrypted: outcome.envelope} as ChatMessage;
          }
          // 'unavailable' — peer runs an older client. Fall through to fan-out.
        } else if (allowRatchet && bodyOnly && otherUserIds.length > 1) {
          // Groups use sender keys: one ciphertext, distributed over the
          // pairwise sessions. All-or-nothing — one member without a ratchet
          // identity sends the whole chat back to fan-out, because a message
          // some members cannot read is worse than one everybody can.
          const outcome = await sealGroupText(
            user.uid,
            chatId,
            [user.uid, ...otherUserIds],
            body,
          );
          if (outcome.protection === 'sender-key') {
            return {...data, text: '', mediaKeys: undefined, encrypted: outcome.envelope} as ChatMessage;
          }
        }

        // One sealed copy per member — a 1:1 chat is just the single-recipient
        // case, so there is no separate direct-message path. See
        // sealForRecipients in services/e2ee.ts for why fan-out over sender keys.
        const recipients: EnvelopeRecipient[] = [];
        for (const uid of otherUserIds) {
          const {key, status} = await fetchPeerPublicKeyChecked(uid);
          if (status === 'changed') setPeerKeyChanged(true);
          // Not knowing whether a peer has a key is not the same as knowing
          // they have none, and only the second one may be answered with
          // plaintext. Throwing hands the message to the outbox, which retries
          // it — so a dropped connection delays the message instead of
          // stripping its encryption.
          if (status === 'unavailable') {
            throw new Error(`e2ee: peer key unavailable for ${uid}`);
          }
          // All-or-nothing: a message sealed for only some members would be
          // blank for the rest, which is worse than one everyone can read.
          // Reached only on a definite 'unenrolled', never on a failed lookup.
          if (!key) return data;
          recipients.push({uid, publicKey: key});
        }

        const {secretKey} = await getOrCreateDeviceKeypair(user.uid);
        const seal = (plaintext: string) =>
          sealForRecipients(plaintext, secretKey, recipients, chatId);
        const next: ChatMessage = {...data, mediaKeys: undefined};

        // The body, which may be nothing but content keys for an attachment
        // with no caption — hence `body` rather than `next.text`.
        if (body) {
          next.encrypted = seal(body);
          next.text = '';
        }
        // Only pointers to *unencrypted* objects need sealing. When the bytes
        // are encrypted the URL stays in the clear on purpose: it reveals that
        // an attachment exists, which the message already reveals, and sealing
        // it would cost a field without protecting anything.
        if (!next.mediaSealed) {
          if (next.image) {
            next.encryptedImage = seal(next.image);
            next.image = undefined;
          }
          if (next.video) {
            next.encryptedVideo = seal(next.video);
            next.video = undefined;
          }
          if (next.audio) {
            next.encryptedAudio = seal(next.audio);
            next.audio = undefined;
          }
          if (next.file?.uri) {
            next.encryptedFileUri = seal(next.file.uri);
            next.file = {...next.file, uri: ''};
          }
        }
        return next;
      } catch (e2eeError) {
        // Rethrow rather than returning `data`, which would have sent the
        // message in clear. Returning the plaintext here meant that anything
        // going wrong between "the peer has a key" and "the message is sealed"
        // — a failed key fetch, a keypair publish that couldn't reach the
        // server — silently produced an unencrypted message that looked
        // identical to an encrypted one.
        //
        // Safe to fail closed because every error reachable here is transient:
        // both callers queue to the outbox and retry, and the one permanent
        // failure sealForRecipients can raise (over MAX_GROUP_MEMBERS) cannot
        // occur, since the cap is enforced at chat creation, on member-add,
        // and again in firebaseChat's GroupFullError.
        reportError(e2eeError, 'e2ee_send_failed');
        throw e2eeError;
      }
    },
    [user, otherUserIds, chatId],
  );

  /**
   * Encrypt-then-send for the media paths, reporting failure instead of
   * losing it.
   *
   * Text messages go through onSend, which queues to the outbox and retries.
   * Media can't take that route — the file is already uploaded and the message
   * only references it — so the requirement here is simply that a failure is
   * *seen*. Previously these call sites had no error handling at all and
   * relied on encryptOutgoingMessage swallowing its own errors, so a message
   * that couldn't be sealed was either sent in clear or disappeared with the
   * rejected promise, leaving the UI mid-send with nothing on screen.
   *
   * Returns whether it sent, so callers can hold on to the reply context and
   * the recording rather than clearing state after a send that didn't happen.
   */
  const sendEncrypted = useCallback(
    async (messageData: ChatMessage): Promise<boolean> => {
      if (!chatId) return false;
      try {
        await sendMessage(chatId, await encryptOutgoingMessage(messageData));
        return true;
      } catch (error) {
        reportError(error, 'e2ee_media_send_failed');
        Alert.alert(
          'Not sent',
          "This message couldn't be encrypted, so it wasn't sent. Check your connection and try again.",
        );
        return false;
      }
    },
    [chatId, encryptOutgoingMessage],
  );

  // Voice-grade AAC. At 128 kbps a clip outgrew the inline budget after ~30s;
  // 32 kbps mono at 24 kHz is transparent for speech and fits ~60s, which is
  // what lets voice messages live inside the Firestore document. Matches the
  // web client's recorder settings.
  const audioSet: AudioSet = {
    // Android
    AudioSourceAndroid: AudioSourceAndroidType.MIC,
    OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioEncodingBitRateAndroid: 32000,
    AudioSamplingRateAndroid: VOICE_SAMPLE_RATE_HERTZ,
    AudioChannelsAndroid: VOICE_CHANNEL_COUNT,
    // iOS
    AVFormatIDKeyIOS: AVEncodingOption.aac,
    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.medium,
    AVEncoderBitRateKeyIOS: 32000,
    AVNumberOfChannelsKeyIOS: VOICE_CHANNEL_COUNT,
    AVSampleRateKeyIOS: VOICE_SAMPLE_RATE_HERTZ,
    AVModeIOS: AVModeIOSOption.voicechat,
  };

  useEffect(() => {
    pendingRef.current = pendingMessages;
  }, [pendingMessages]);

  // Account-wide Store theme, and the appearance actually rendered. Kept as a
  // separate effect so a theme applied in the Store repaints an already-open
  // chat without waiting for a chat-document write to arrive.
  useEffect(() => {
    if (!user) return;
    return listenStoreTheme(user.uid, setStoreTheme);
  }, [user]);

  useEffect(() => {
    setThemeColor(resolveAccent(chatAccent, storeTheme?.accent, '#007AFF'));
    setChatWallpaper(resolveWallpaper(chatWallpaperRaw, storeTheme?.wallpaper));
  }, [chatAccent, chatWallpaperRaw, storeTheme]);

  useEffect(() => {
    return () => {
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(burnTimersRef.current).forEach(clearInterval);
      burnTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!chatId) return;
    if (!user?.uid) return;
    const unsub = listenScheduledMessages(chatId, user.uid, msgs =>
      setScheduledCount(msgs.length),
    );
    return () => unsub();
  }, [chatId, user?.uid]);

  const startBurnCountdown = useCallback(
    (messageId: string | number, duration: number, startedAt: number) => {
      const key = String(messageId);
      if (burnTimersRef.current[key]) {
        return;
      }
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      if (remaining <= 0) {
        if (chatId && user) {
          burnMessage(chatId, key, user.uid).catch(() => {});
        }
        return;
      }
      setBurnCountdowns(prev => ({...prev, [key]: remaining}));
      burnTimersRef.current[key] = setInterval(() => {
        setBurnCountdowns(prev => {
          const left = (prev[key] ?? remaining) - 1;
          if (left <= 0) {
            clearInterval(burnTimersRef.current[key]);
            delete burnTimersRef.current[key];
            if (chatId && user) {
              burnMessage(chatId, key, user.uid).catch(() => {});
            }
            const {[key]: _, ...rest} = prev;
            return rest;
          }
          return {...prev, [key]: left};
        });
      }, 1000);
    },
    [chatId, user],
  );

  useEffect(() => {
    if (!chatId) return;
    if (SHOW_NATIVE_ONLY_FEATURES && isChatLocked(chatId)) {
      setChatUnlocked(false);
    }
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      if (!chatId || !user) return;

      const currentKeyGeneration = getKeyGeneration();
      if (currentKeyGeneration !== decryptKeyGenerationRef.current) {
        decryptKeyGenerationRef.current = currentKeyGeneration;
        decryptedTextRef.current.clear();
        decryptedImageRef.current.clear();
        decryptedVideoRef.current.clear();
        decryptedAudioRef.current.clear();
        decryptedFileUriRef.current.clear();
        decryptedPreviewRef.current.clear();
        // The restore this banner was offering has happened. Retract the offer
        // and let the re-decrypt below decide whether it's still warranted —
        // if the restored key opens everything, it never comes back.
        setSealedToOtherDevice(false);
      }

      let active = true;

      /**
       * Seeds the plaintext this device has already opened, and hydrates the
       * offline cache with it.
       *
       * The offline cache holds ciphertext, and decryption used to happen only
       * inside the snapshot callback below — so a returning reader watched
       * every sealed message sit at "🔒 …" for a full network round trip, with
       * the bytes needed to read them on disk the whole time. Bodies come from
       * local storage, so this path never touches the network.
       *
       * Everything downstream waits on this promise. That is not an
       * optimisation: a ratchet envelope opens exactly once, so attempting one
       * whose plaintext is already stored would consume the attempt, fail, and
       * cache a padlock over a message that was perfectly readable.
       */
      const bodiesReady = (async () => {
        const [cached, bodies] = await Promise.all([
          getCachedMessages(chatId),
          loadBodies(user.uid, chatId),
        ]);
        if (!active) return;

        bodies.forEach((text, id) => {
          if (!decryptedTextRef.current.has(id)) decryptedTextRef.current.set(id, text);
        });

        if (cached.length) {
          const hydrated = bodies.size
            ? cached.map(item => {
                const text = decryptedTextRef.current.get(String(item._id));
                return text ? {...item, text, awaitingDecryption: false} : item;
              })
            : cached;
          setMessages(prev => (prev.length ? prev : hydrated));
        }
      })().catch(error => {
        // Must never reject. The decrypt pass below awaits this promise from
        // outside its own try, so a rejection here would surface as an
        // unhandled rejection and silently skip decryption altogether — the
        // same shape of failure as the scheduled-send bug. Seeding is an
        // optimisation; failing to seed costs a slower chat, nothing more.
        reportError(error, 'message_bodies_seed_failed');
      });

      const unsubscribe = listenMessages(chatId, snapshotMessages => {
        const oldest = snapshotMessages[snapshotMessages.length - 1];
        if (oldest?.createdAtRaw || oldest?.createdAt) {
          setOldestCursor(oldest.createdAtRaw || oldest.createdAt);
        }
        setHasMoreMessages(snapshotMessages.length >= 50);
        const formattedMessages: IMessage[] = snapshotMessages
          .map(msg => ({
            _id: typeof msg._id === 'string' ? msg._id : String(msg._id),
            text: msg.text,
            createdAt: msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt),
            image: msg.image,
            video: msg.video,
            videoDuration: msg.videoDuration,
            audio: msg.audio,
            audioDuration: msg.audioDuration,
            audioSampleRateHertz: msg.audioSampleRateHertz,
            audioChannelCount: msg.audioChannelCount,
            file: msg.file,
            linkPreview: msg.linkPreview,
            replyTo: msg.replyTo,
            reactions: msg.reactions,
            mentions: msg.mentions,
            moment: msg.moment,
            burnAfterReading: msg.burnAfterReading,
            sharedList: (msg as any).sharedList,
            transcription: (msg as any).transcription,
            expense: (msg as any).expense,
            location: (msg as any).location,
            translations: (msg as any).translations,
            scheduledFor: (msg as any).scheduledFor,
            gif: (msg as any).gif,
            timeCapsule: (msg as any).timeCapsule,
            // E2EE: substitute cached plaintext once decrypted (below); until
            // then, the plain field is genuinely empty — the sender clears it
            // when sealing, so there is no ciphertext to accidentally render —
            // and a "🔒 …" placeholder stands in via `text`. Each encryptedX
            // field is carried through so the decrypt pass below can find it
            // again without re-reading the original snapshot.
            ...(isSealed((msg as any).encrypted)
              ? {
                  text: decryptedTextRef.current.get(String(msg._id)) ?? '🔒 …',
                  encrypted: (msg as any).encrypted,
                  // Marks the placeholder above as not-yet-real text. CipherText
                  // resolves a message exactly once, so without this it would
                  // spend that one pass scrambling "🔒 …" and then swap the
                  // decrypted text in with no animation at all.
                  awaitingDecryption: !decryptedTextRef.current.has(String(msg._id)),
                }
              : null),
            ...(isSealed((msg as any).encryptedImage)
              ? {
                  image: decryptedImageRef.current.get(String(msg._id)) || undefined,
                  encryptedImage: (msg as any).encryptedImage,
                }
              : null),
            ...(isSealed((msg as any).encryptedVideo)
              ? {
                  video: decryptedVideoRef.current.get(String(msg._id)) || undefined,
                  encryptedVideo: (msg as any).encryptedVideo,
                }
              : null),
            ...(isSealed((msg as any).encryptedAudio)
              ? {
                  audio: decryptedAudioRef.current.get(String(msg._id)) || undefined,
                  encryptedAudio: (msg as any).encryptedAudio,
                }
              : null),
            ...(isSealed((msg as any).encryptedFileUri)
              ? {
                  file: decryptedFileUriRef.current.has(String(msg._id))
                    ? {...msg.file, uri: decryptedFileUriRef.current.get(String(msg._id))!}
                    : undefined,
                  encryptedFileUri: (msg as any).encryptedFileUri,
                }
              : null),
            ...(isSealed((msg as any).encryptedLinkPreview)
              ? {
                  linkPreview: decryptedPreviewRef.current.get(String(msg._id)) ?? undefined,
                  encryptedLinkPreview: (msg as any).encryptedLinkPreview,
                }
              : null),
            // Attachment bytes are encrypted at rest, so the URL on the wire
            // points at ciphertext. Handing it to <Image> or the video player
            // would render a broken attachment; the decrypted local file
            // replaces it once the resolve pass below produces one. The raw
            // URL is deliberately dropped rather than carried through — this
            // is the only thing standing between it and a renderer.
            ...((msg as any).mediaSealed
              ? {
                  mediaSealed: true,
                  // The ciphertext URLs, kept for the resolve pass. They have
                  // to be carried separately because the fields they came
                  // from are being overwritten right here, and the resolver
                  // runs against the formatted message rather than the
                  // original snapshot.
                  sealedMediaUrls: {
                    image: msg.image,
                    video: msg.video,
                    audio: msg.audio,
                    file: msg.file?.uri,
                  },
                  image: msg.image
                    ? decryptedImageRef.current.get(String(msg._id)) || undefined
                    : undefined,
                  video: msg.video
                    ? decryptedVideoRef.current.get(String(msg._id)) || undefined
                    : undefined,
                  audio: msg.audio
                    ? decryptedAudioRef.current.get(String(msg._id)) || undefined
                    : undefined,
                  file: msg.file?.uri
                    ? {
                        ...msg.file,
                        uri: decryptedFileUriRef.current.get(String(msg._id)) || '',
                      }
                    : msg.file,
                }
              : null),
            // A media message has empty `text` from the sender; show the same
            // lock placeholder there until its own field (above) resolves, so
            // the bubble isn't just blank while decryption is in flight.
            ...(!isSealed((msg as any).encrypted) &&
            (isSealed((msg as any).encryptedImage) ||
              isSealed((msg as any).encryptedVideo) ||
              isSealed((msg as any).encryptedAudio) ||
              isSealed((msg as any).encryptedFileUri)) &&
            !decryptedImageRef.current.has(String(msg._id)) &&
            !decryptedVideoRef.current.has(String(msg._id)) &&
            !decryptedAudioRef.current.has(String(msg._id)) &&
            !decryptedFileUriRef.current.has(String(msg._id))
              ? {text: '🔒 …'}
              : null),
            user: {
              _id: msg.user._id,
              name: msg.user.name || 'User',
              avatar: msg.user.avatar,
            },
          }))
          .filter(m => m._id && m.createdAt)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const merged = (() => {
          const byId = new Map<string, IMessage>();
          formattedMessages.forEach(item => byId.set(String(item._id), item));
          pendingRef.current.forEach(item => {
            if (!byId.has(String(item._id))) {
              byId.set(String(item._id), item);
            }
          });
          return Array.from(byId.values()).sort(
            (a, b) => toCreatedAtMillis(b.createdAt) - toCreatedAtMillis(a.createdAt),
          );
        })();
        setMessages(merged);
        scheduleMessageCacheWrite(chatId, formattedMessages.map(withoutDecryptedBody));

        // E2EE: decrypt any messages in this batch not already resolved, then
        // patch their placeholder(s) in place. Deliberately runs after
        // setMessages(merged) rather than blocking it, so the placeholder
        // ("🔒 …") is visible immediately instead of delaying the whole list.
        /** The cache holding a given slot's resolved local path. */
        const mediaCacheForSlot = (slot: MediaSlot) =>
          slot === 'image'
            ? decryptedImageRef
            : slot === 'video'
              ? decryptedVideoRef
              : slot === 'audio'
                ? decryptedAudioRef
                : decryptedFileUriRef;

        /** Slots this message actually carries, by their ciphertext URL. */
        const sealedSlots = (em: any): MediaSlot[] =>
          em.mediaSealed
            ? MEDIA_SLOTS.filter(slot => !!em.sealedMediaUrls?.[slot])
            : [];

        const needsDecrypt = (m: IMessage) => {
          const em = m as any;
          const id = String(m._id);
          return (
            sealedSlots(em).some(slot => !mediaCacheForSlot(slot).current.has(id)) ||
            (isSealed(em.encrypted) && !decryptedTextRef.current.has(id)) ||
            (isSealed(em.encryptedImage) && !decryptedImageRef.current.has(id)) ||
            (isSealed(em.encryptedVideo) && !decryptedVideoRef.current.has(id)) ||
            (isSealed(em.encryptedAudio) && !decryptedAudioRef.current.has(id)) ||
            (isSealed(em.encryptedFileUri) && !decryptedFileUriRef.current.has(id)) ||
            (isSealed(em.encryptedLinkPreview) && !decryptedPreviewRef.current.has(id))
          );
        };
        /**
         * Patches every message whose plaintext has resolved so far into
         * the list.
         *
         * Called more than once per batch, and that is the point. This
         * used to run only after the whole batch finished, so the slowest
         * message in a snapshot set the latency for all of them — every
         * bubble sat at "🔒 …" until the last one was open. The stateless
         * envelopes below resolve synchronously, while the forward-secret
         * ones each cost a storage round trip, so flushing between the
         * two passes lets the cheap majority appear immediately instead
         * of waiting behind the expensive minority.
         *
         * Idempotent: it reads the caches rather than a delta, so a
         * message already patched simply patches to the same value, and
         * the `Object.keys(patch).length` check keeps untouched items
         * referentially identical for the list's benefit.
         */
        const flushDecrypted = () => {
          if (!active) return;
          setMessages(prev =>
            prev.map(item => {
              const id = String(item._id);
              const patch: Record<string, unknown> = {};
              if (decryptedTextRef.current.has(id)) {
                patch.text = decryptedTextRef.current.get(id);
              }
              if (decryptedImageRef.current.has(id)) {
                patch.image = decryptedImageRef.current.get(id) || undefined;
              }
              if (decryptedVideoRef.current.has(id)) {
                patch.video = decryptedVideoRef.current.get(id) || undefined;
              }
              if (decryptedAudioRef.current.has(id)) {
                patch.audio = decryptedAudioRef.current.get(id) || undefined;
              }
              if (decryptedFileUriRef.current.has(id) && (item as any).file) {
                patch.file = {
                  ...(item as any).file,
                  uri: decryptedFileUriRef.current.get(id) || '',
                };
              }
              if (decryptedPreviewRef.current.has(id)) {
                patch.linkPreview = decryptedPreviewRef.current.get(id) ?? undefined;
              }
              return Object.keys(patch).length ? {...item, ...patch} : item;
            }),
          );
        };

        (async () => {
          // What still needs opening can only be decided once the locally
          // stored bodies are in the caches — see bodiesReady. Deciding first
          // and seeding later would send a ratchet envelope whose plaintext is
          // already on disk into a decrypt that consumes its only attempt.
          await bodiesReady;
          if (!active) return;

          const toDecrypt = merged.filter(needsDecrypt);
          if (!toDecrypt.length) {
            // Nothing to open, but the seeded bodies still have to reach the
            // list: this snapshot rebuilt every item from the raw documents.
            flushDecrypted();
            return;
          }

          try {
            // Deliberately the non-enrolling read. This used to call
            // getOrCreateDeviceKeypair, which publishes on first call — so
            // simply *opening* a chat containing sealed messages was enough
            // for a newly-installed second device to mint a key and
            // overwrite the account's published one, orphaning every message
            // sealed to the original. Reading must never enroll.
            const keypair = await getDeviceKeypairIfEnrolled(user.uid);
            if (!active) return;
            if (!keypair) {
              // No key on this device, but sealed messages in the thread —
              // so by definition they were sealed to a key held elsewhere.
              // No need to ask diagnoseSealed; there is no key to diagnose
              // against.
              setSealedToOtherDevice(true);
              toDecrypt.forEach(m => {
                const em = m as any;
                const id = String(m._id);
                // Every cache is filled, including the media ones, so these
                // messages stop matching needsDecrypt. Left unfilled they
                // would re-enter this block on every single snapshot. A
                // successful restore bumps the key generation, which clears
                // all of them and re-runs this for real.
                const sealedMedia =
                  isSealed(em.encryptedImage) ||
                  isSealed(em.encryptedVideo) ||
                  isSealed(em.encryptedAudio) ||
                  isSealed(em.encryptedFileUri) ||
                  sealedSlots(em).length > 0;
                if (isSealed(em.encryptedImage)) decryptedImageRef.current.set(id, '');
                if (isSealed(em.encryptedVideo)) decryptedVideoRef.current.set(id, '');
                if (isSealed(em.encryptedAudio)) decryptedAudioRef.current.set(id, '');
                if (isSealed(em.encryptedFileUri)) decryptedFileUriRef.current.set(id, '');
                // Same for attachments whose bytes are encrypted: their key
                // is inside a body this device cannot open, so there is
                // nothing to fetch. Left unfilled they would keep matching
                // needsDecrypt and re-enter this block on every snapshot.
                for (const slot of sealedSlots(em)) {
                  mediaCacheForSlot(slot).current.set(id, '');
                }
                if (isSealed(em.encryptedLinkPreview)) decryptedPreviewRef.current.set(id, null);
                // A message whose only sealed field is its link preview keeps
                // its real text — losing the card is not worth overwriting a
                // perfectly readable message with a padlock.
                if (isSealed(em.encrypted) || sealedMedia) {
                  decryptedTextRef.current.set(id, '🔒 Sealed to another device');
                }
              });
              setMessages(prev =>
                prev.map(item => {
                  const text = decryptedTextRef.current.get(String(item._id));
                  return text ? {...item, text} : item;
                }),
              );
              return;
            }
            const {secretKey, publicKey} = keypair;
            // Whether anything in this batch failed the *recoverable* way.
            // Accumulated across the batch and committed once, rather than
            // calling setState from inside the loop.
            let anyWrongKey = false;
            let anyPeerSessionReset = false;
            /**
             * The user-facing text for a failure, and a note of whether it
             * is the recoverable kind.
             *
             * "Unable to decrypt" was true but useless: it reads as data
             * loss, when the overwhelmingly common cause is simply that the
             * message was sealed to this account's *other* device — which
             * the recovery phrase fixes. diagnoseSealed can tell those apart
             * from the addressing alone, so the placeholder says which one
             * happened instead of making the user guess.
             */
            const failureText = (payload: unknown): string => {
              const reason = diagnoseSealed(payload, publicKey, user.uid);
              if (reason === 'wrong-key') {
                anyWrongKey = true;
                return '🔒 Sealed to another device';
              }
              if (reason === 'unsupported-algorithm') {
                return '🔒 Update the app to read this';
              }
              return '🔒 Unable to decrypt';
            };

            /**
             * Records a decrypted body: its text for display, and any
             * attachment content keys for the resolve pass below.
             *
             * Every path that opens a body goes through this — static,
             * ratchet and sender-key alike — so that a message carrying an
             * attachment behaves the same however it was sealed. Routing
             * only some of them would leave photos permanently unopenable
             * on whichever path was missed, with no error anywhere.
             */
            /**
             * Bodies opened in this pass, for the local store.
             *
             * Deliberately filled here and not from decryptedTextRef, which
             * also holds the "🔒 …" failure placeholders. Persisting one of
             * those would be irreversible on the ratchet path: the envelope
             * it stood in for cannot be opened a second time, so a padlock
             * written over a message would be the last word on it.
             */
            const resolvedBodies = new Map<string, string>();

            const acceptBody = (id: string, raw: string) => {
              const body = decodeBody(raw);
              decryptedTextRef.current.set(id, body.text);
              resolvedBodies.set(id, body.text);
              if (body.media) pendingMediaRef.current.set(id, body.media);
            };

            toDecrypt.forEach(m => {
              const em = m as any;
              const id = String(m._id);
              let mediaFailed = false;
              // The payload blamed when a *media* field fails: media has no
              // `encrypted` text of its own to diagnose, so the first field
              // that failed stands in for the message.
              let failedPayload: unknown = null;

              // Ratchet envelopes are handled in the async pass below:
              // opening one needs stored session state, which openSealed
              // has no access to and would throw on.
              if (
                isSealed(em.encrypted) &&
                !isRatchetSealed(em.encrypted) &&
                !isGroupSealed(em.encrypted) &&
                !decryptedTextRef.current.has(id)
              ) {
                try {
                  acceptBody(id, openSealed(em.encrypted, secretKey, user.uid, chatId));
                } catch (decryptError) {
                  // Wrong/rotated key, or a payload from before this device
                  // enrolled — distinct from "still loading" so it doesn't
                  // spin on the placeholder forever.
                  reportError(decryptError, 'e2ee_decrypt_failed');
                  decryptedTextRef.current.set(id, failureText(em.encrypted));
                }
              }

              const mediaField = (
                payload: unknown,
                cache: React.MutableRefObject<Map<string, string>>,
              ) => {
                if (!isSealed(payload) || cache.current.has(id)) return;
                try {
                  cache.current.set(id, openSealed(payload, secretKey, user.uid, chatId));
                } catch (decryptError) {
                  reportError(decryptError, 'e2ee_decrypt_failed');
                  cache.current.set(id, '');
                  mediaFailed = true;
                  if (failedPayload === null) failedPayload = payload;
                }
              };
              mediaField(em.encryptedImage, decryptedImageRef);
              mediaField(em.encryptedVideo, decryptedVideoRef);
              mediaField(em.encryptedAudio, decryptedAudioRef);
              mediaField(em.encryptedFileUri, decryptedFileUriRef);

              // A preview that won't decrypt is cached as null rather than
              // left absent, so this doesn't retry it on every snapshot —
              // and a missing card is a far smaller loss than an unreadable
              // message, so it deliberately doesn't count as mediaFailed.
              if (
                isSealed(em.encryptedLinkPreview) &&
                !decryptedPreviewRef.current.has(id)
              ) {
                try {
                  decryptedPreviewRef.current.set(
                    id,
                    parsePreview(openSealed(em.encryptedLinkPreview, secretKey, user.uid, chatId)),
                  );
                } catch {
                  decryptedPreviewRef.current.set(id, null);
                }
              }

              // A media message has no `encrypted` text of its own to carry
              // a failure message, so surface it the same way a text
              // decrypt failure does.
              if (mediaFailed && !isSealed(em.encrypted)) {
                decryptedTextRef.current.set(id, failureText(failedPayload));
              }
            });

            // The stateless envelopes are all open at this point. Show them
            // now rather than holding them behind the awaited pass below.
            flushDecrypted();

            /**
             * Forward-secret messages, opened separately because each one
             * reads and advances stored session state and so must be
             * awaited — and awaited *in order*, which is why this is a
             * for-of rather than a Promise.all. Out-of-order decrypts of the
             * same session are serialized by the session store anyway, but
             * doing it here keeps the ordering obvious rather than relying
             * on that.
             */
            for (const m of toDecrypt) {
              if (!active) break;
              const em = m as any;
              const id = String(m._id);
              if (decryptedTextRef.current.has(id)) continue;

              if (isGroupEnvelope(em.encrypted)) {
                const opened = await openGroupEnvelope(em.encrypted, user.uid, chatId);
                if (opened.status === 'ok') acceptBody(id, opened.text);
                else decryptedTextRef.current.set(id, '🔒 Unable to decrypt');
                // Each pass through this loop costs a storage round trip, so
                // a message is shown the moment it opens rather than at the
                // end — the queue behind it may be seconds long.
                flushDecrypted();
                continue;
              }

              if (!isRatchetSealed(em.encrypted)) continue;
              const outcome = await openRatchetEnvelope(em.encrypted, user.uid, chatId);
              if (outcome.status === 'ok') {
                acceptBody(id, outcome.text);
                // The peer started a new session — they reinstalled, or
                // someone is impersonating them. Indistinguishable from
                // here, so it is surfaced rather than absorbed.
                if (outcome.sessionReset) anyPeerSessionReset = true;
              } else {
                decryptedTextRef.current.set(id, '🔒 Unable to decrypt');
              }
              flushDecrypted();
            }

            /**
             * Fetch and decrypt attachment bytes.
             *
             * Last, and separately, because it is the only part of this that
             * touches the network: bodies are already in the caches above,
             * so captions and text messages have rendered by now and a slow
             * photo delays nothing but itself.
             *
             * Failures are cached as an empty string, matching how the
             * legacy media fields behave. That trades a retry for
             * termination — without it a message whose object is missing or
             * corrupt would re-enter this pass on every snapshot, forever.
             * Re-opening the chat retries.
             */
            for (const m of toDecrypt) {
              if (!active) break;
              const em = m as any;
              const id = String(m._id);
              const keys = pendingMediaRef.current.get(id);

              for (const slot of sealedSlots(em)) {
                const cache = mediaCacheForSlot(slot);
                if (cache.current.has(id)) continue;

                const info = keys?.[slot];
                if (!info) {
                  // The body did not open, or carried no key for this slot.
                  // Either way there is nothing to fetch and no point
                  // asking again.
                  cache.current.set(id, '');
                  continue;
                }
                try {
                  const path = await resolveSealedMedia(
                    id,
                    slot,
                    em.sealedMediaUrls[slot],
                    info,
                  );
                  // Players need a scheme; a bare path silently fails to
                  // load on iOS.
                  cache.current.set(id, `file://${path}`);
                } catch (mediaError) {
                  reportError(mediaError, 'media_decrypt_failed');
                  cache.current.set(id, '');
                }
              }
            }

            // Latches on: a later snapshot that happens to contain only
            // readable messages must not retract an offer the user may be
            // halfway through acting on.
            if (active && anyWrongKey) setSealedToOtherDevice(true);
            if (active && anyPeerSessionReset) setPeerSessionReset(true);
            flushDecrypted();

            // Recorded after the list is patched, not before: the write is the
            // slower half and nothing on screen is waiting for it, so it is
            // deliberately not awaited. Nor is it gated on `active` — a body
            // opened just as the screen closes is the one case where storing it
            // matters most, because on the ratchet path there is no second
            // chance to open it. saveBodies reports its own failures.
            saveBodies(user.uid, chatId, resolvedBodies);
          } catch (keyError) {
            reportError(keyError, 'e2ee_decrypt_key_unavailable');
          }
        })();

        // Prefetch images for better UX
        prefetchMessageImages(formattedMessages.slice(0, 20));
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }, [chatId, user]),
  );

  useEffect(() => {
    if (!messages.length) return;
    const recent = messages.slice(0, 15);
    const toCheck = recent.filter(m => {
      const text = (m as any).text || '';
      return text.length >= 10 && !contextCards[String(m._id)];
    });
    if (!toCheck.length) return;
    let cancelled = false;
    (async () => {
      const entries: Record<string, ContextCard[]> = {};
      for (const msg of toCheck) {
        if (cancelled) break;
        try {
          const cards = await getContextCards((msg as any).text || '');
          if (cards.length) entries[String(msg._id)] = cards;
        } catch { /* ignore */ }
      }
      if (!cancelled && Object.keys(entries).length) {
        setContextCards(prev => ({...prev, ...entries}));
      }
    })();
    return () => { cancelled = true; };
  }, [messages.length]);

  useEffect(() => {
    if (!chatId) return;
    return listenChatPet(chatId, setChatPet);
  }, [chatId]);

  // Detects a feed via the Firestore round-trip (feedPet's writer runs
  // fire-and-forget below, and this listens for its result coming back
  // through listenChatPet above), rather than pulsing on the send itself —
  // that way the celebration reflects what actually got written, not an
  // optimistic guess that might not match if the write failed.
  useEffect(() => {
    if (didPetJustEat(prevChatPetRef.current, chatPet)) {
      setPetFeedPulse(p => p + 1);
      petWidgetRef.current?.measureInWindow((x, y, width, height) => {
        burst('❤️', x + width / 2, y + height / 2);
      });
    }
    prevChatPetRef.current = chatPet;
  }, [chatPet, burst]);

  useEffect(() => {
    if (!messages.length) { setSmartReplies([]); return; }
    const recent = messages.slice(0, 5).reverse().map(m => ({
      text: (m as any).text || '',
      isOutgoing: (m as any).user?._id === user?.uid,
    }));
    setSmartReplies(getSmartReplies(recent));
  }, [messages.length, user?.uid]);

  const loadEarlier = async () => {
    if (!chatId || !user || isLoadingEarlier || !hasMoreMessages) return;
    setIsLoadingEarlier(true);
    try {
      const older = await getMessagesPage(chatId, oldestCursor, 50);
      if (older.length === 0) {
        setHasMoreMessages(false);
        return;
      }
      const olderCursor =
        older[older.length - 1]?.createdAtRaw || older[older.length - 1]?.createdAt;
      if (olderCursor) setOldestCursor(olderCursor);
      setHasMoreMessages(older.length >= 50);
      const formattedOlder: IMessage[] = older
        .map(msg => ({
          _id: typeof msg._id === 'string' ? msg._id : String(msg._id),
          text: msg.text,
          createdAt: msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt),
          image: msg.image,
          video: msg.video,
          videoDuration: msg.videoDuration,
          audio: msg.audio,
          audioDuration: msg.audioDuration,
          audioSampleRateHertz: msg.audioSampleRateHertz,
          audioChannelCount: msg.audioChannelCount,
          file: msg.file,
          linkPreview: msg.linkPreview,
          replyTo: msg.replyTo,
          reactions: msg.reactions,
          mentions: msg.mentions,
          moment: msg.moment,
          burnAfterReading: msg.burnAfterReading,
          sharedList: (msg as any).sharedList,
          transcription: (msg as any).transcription,
          expense: (msg as any).expense,
          location: (msg as any).location,
          translations: (msg as any).translations,
          scheduledFor: (msg as any).scheduledFor,
          user: {
            _id: msg.user._id,
            name: msg.user.name || 'User',
            avatar: msg.user.avatar,
          },
        }))
        .filter(m => m._id && m.createdAt);
      setMessages(prev => {
        const byId = new Map(prev.map(item => [String(item._id), item]));
        formattedOlder.forEach(item => byId.set(String(item._id), item));
        return Array.from(byId.values()).sort(
          (a, b) => toCreatedAtMillis(b.createdAt) - toCreatedAtMillis(a.createdAt),
        );
      });
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  useEffect(() => {
    return () => {
      // Ensure audio player/recorder is stopped when switching user/chat or unmounting
      try {
        recorderRef.current.stopPlayer();
      } catch (_e) {}
      try {
        recorderRef.current.removePlayBackListener();
      } catch (_e) {}
      try {
        recorderRef.current.stopRecorder();
      } catch (_e) {}
      try {
        recorderRef.current.removeRecordBackListener();
      } catch (_e) {}
      setPlayingAudioId(null);
    };
  }, [chatId, user]);

  useFocusEffect(
    useCallback(() => {
      if (!chatId || !user || incognitoMode) return;
      setLastRead(chatId, user.uid);
    }, [chatId, user, incognitoMode]),
  );

  useEffect(() => {
    if (!chatId || !user) return;
    const loadDraft = async () => {
      const draft = await getDraft(user.uid, chatId);
      setComposerText(draft);
    };
    loadDraft();
  }, [chatId, user, setComposerText]);

  useEffect(() => {
    if (!chatId || !user || !isOnline) return;
    let active = true;
    const flushOutbox = async () => {
      const queued = await getOutboxMessages(user.uid);
      const forChat = queued.filter(item => item.chatId === chatId);
      for (const item of forChat) {
        if (!active) return;
        try {
          // Encrypts here, not at enqueue time: fetching the peer's key needs
          // network, which is exactly what wasn't available when this was
          // queued. This used to send `item.message` — the original plaintext
          // — outright, so anything sent while offline permanently skipped
          // E2EE even when the peer had a key.
          const outgoing = await encryptOutgoingMessage(item.message);
          await sendMessage(chatId, outgoing);
          await removeOutboxMessage(user.uid, item.id);
          setPendingMessages(prev => prev.filter(m => String(m._id) !== item.id));
          setMessages(prev => prev.filter(m => !(String(m._id) === item.id && (m as any).pending)));
        } catch (error) {
          // Keep in outbox if it still fails — unless the recipient deleted
          // their account, which no amount of retrying will fix. Left queued,
          // it would be re-attempted on every launch and stay stuck on screen
          // as a pending message that never resolves.
          if (isRecipientUnreachable(error)) {
            await removeOutboxMessage(user.uid, item.id);
            setPendingMessages(prev => prev.filter(m => String(m._id) !== item.id));
            setMessages(prev => prev.filter(m => String(m._id) !== item.id));
          }
        }
      }
    };
    flushOutbox();
    return () => {
      active = false;
    };
  }, [chatId, user, isOnline, encryptOutgoingMessage]);

  // Proactively checks the peer's key when the chat opens, not just when this
  // device sends something — encryptOutgoingMessage's check would otherwise
  // miss a device that only ever reads this conversation and never sends.
  useEffect(() => {
    // Reset first: a screen instance can be reused across chats (e.g. tapping
    // between conversations without fully unmounting), and a flag left over
    // from the previous peer must not paint onto this one while we check.
    setPeerKeyChanged(false);
    if (!otherUserId) return;
    let active = true;
    fetchPeerPublicKeyChecked(otherUserId)
      .then(({status}) => {
        if (active && status === 'changed') setPeerKeyChanged(true);
      })
      .catch(error => reportError(error, 'e2ee_key_change_check_failed'));
    return () => {
      active = false;
    };
  }, [otherUserId]);

  // Authoritative half of the deleted-account check: the peer is still listed
  // as a participant, but their profile is gone — a purge that removed the
  // account without finishing every chat. Same reset-first reasoning as above.
  useEffect(() => {
    setPeerProfileGone(false);
    if (!otherUserId) return;
    let active = true;
    isProfileDeleted(otherUserId)
      .then(gone => {
        if (active) setPeerProfileGone(gone);
      })
      .catch(error => reportError(error, 'recipient_check_failed'));
    return () => {
      active = false;
    };
  }, [otherUserId]);

  useEffect(() => {
    if (!chatId || !user) return;
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }
    draftSaveTimeoutRef.current = setTimeout(() => {
      const text = inputText.trimEnd();
      if (text !== lastDraftRef.current) {
        setDraft(user.uid, chatId, text);
        lastDraftRef.current = text;
      }
    }, 400);
  }, [chatId, user, inputText]);

  useEffect(() => {
    if (!chatId || !user) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    const typing = inputText.trim().length > 0;
    const now = Date.now();
    const last = lastTypingRef.current;
    const shouldSend = typing !== last.value || now - last.at > 2000;
    if (!shouldSend) return;
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(chatId, user.uid, typing);
      lastTypingRef.current = {value: typing, at: Date.now()};
    }, 400);
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatId, user, inputText]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (chatId && user) {
          setTyping(chatId, user.uid, false);
        }
      };
    }, [chatId, user]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!chatId || !user) return;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const unsubscribe = listenChat(chatId, async chat => {
        if (!chat || !Array.isArray(chat.participants)) {
          return;
        }
        if (!chat.participants.includes(user.uid)) {
          return;
        }
        // Structural half of the deleted-account check. purgeChat in
        // services/account.ts is the only code that ever removes a participant,
        // and createChat writes both uids at once, so a 1:1 chat down to one
        // participant means the other person deleted their account.
        setPeerMissingFromChat(hasLostPeer(chat.participants, user.uid));

        /**
         * Rotate this device's group chain when somebody has left.
         *
         * Driven by observing the member list rather than by whoever performed
         * the removal, because every remaining member has to rotate their own
         * chain — the departing member holds a copy of each, and can advance
         * any of them unaided. One member forgetting is one member still
         * readable.
         *
         * Only removals rotate; the check is inside handleMembershipChange.
         */
        const previousMembers = knownMembersRef.current;
        knownMembersRef.current = chat.participants;
        if (previousMembers && chat.participants.length > 2) {
          handleMembershipChange(user.uid, chatId, previousMembers, chat.participants).catch(
            error => reportError(error, 'group_rotation_failed'),
          );
        }

        setOtherUserIds(chat.participants.filter((id: string) => id !== user.uid));

        const otherId = chat.participants.find(id => id !== user.uid);
        if (otherId) {
          const otherUser = await getUserById(otherId);
          const customName = chat.nameBy?.[user.uid] || '';
          // A group titled after whichever member happens to be first in the
          // array reads as a 1:1 with the wrong person, so groups fall back to
          // the chat's own name (set at creation from the member list) and then
          // to a plain count — never to a single member's name.
          const isGroup = chat.participants.length > 2;
          const name = isGroup
            ? customName ||
              chat.name ||
              t('members.title', {count: chat.participants.length})
            : customName || otherUser?.displayName || otherUser?.email || 'Chat';
          setOtherUserName(name);
          setOtherUser(otherUser);
          setCustomName(customName);
          setOtherUserId(otherId);
          setOtherLastReadAt(chat.lastReadAt?.[otherId] || 0);
        }
        setPinnedMessageIds(chat.pinnedMessageIds || []);
        // Raw stored values only — the account-wide Store theme is folded in
        // by the effect below, which also reruns when that theme changes.
        setChatAccent(chat.themeBy?.[user.uid]);
        setChatWallpaperRaw(chat.wallpaperBy?.[user.uid]);

        const typingAt = chat.typingBy?.[otherId || ''] || 0;
        if (typingAt && Date.now() - typingAt < 3000) {
          setIsTyping(true);
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => setIsTyping(false), 3000);
        } else {
          setIsTyping(false);
        }
      });

      return () => {
        unsubscribe();
        if (timeout) clearTimeout(timeout);
      };
    }, [chatId, user]),
  );

  // Incoming calls are handled app-wide by IncomingCallManager (mounted in
  // App.tsx), which rings and shows the answer UI wherever the user is. A
  // second listener here fired a competing Alert whenever this chat happened
  // to be open, so the same call prompted twice.

  useEffect(() => {
    if (!chatId) return;
    cleanupStaleCalls(chatId).catch(error => reportError(error, 'cleanupStaleCalls'));
  }, [chatId]);

  const handleSaveCustomName = async () => {
    if (!chatId || !user) return;
    const trimmed = customName.trim();
    await setChatName(chatId, user.uid, trimmed ? trimmed : null);
    setNameModalVisible(false);
  };

  const startCall = async (type: CallType) => {
    if (!chatId || !user) {
      Alert.alert('Error', 'Unable to start a call right now.');
      return;
    }
    // The call stack is 1:1 — it rings a single callee. In a group it would
    // silently ring whichever member sits first in `participants`: a call to
    // one person that nobody else sees, and that the caller believes went to
    // the group. Refusing is the honest outcome until multi-party signalling
    // exists.
    if (otherUserIds.length > 1) {
      Alert.alert(t('call.groupUnsupportedTitle'), t('call.groupUnsupportedBody'));
      return;
    }
    try {
      let targetUserId = otherUserId;
      if (!targetUserId) {
        const chat = await getChat(chatId);
        const otherId = chat?.participants?.find(id => id !== user.uid) || null;
        targetUserId = otherId;
        if (otherId) setOtherUserId(otherId);
      }
      if (!targetUserId) {
        Alert.alert('Error', 'Unable to find the recipient for this chat.');
        return;
      }
      const callId = await createCall(chatId, user.uid, targetUserId, type);
      navigation.navigate('Call', {
        chatId,
        callId,
        isCaller: true,
        type,
      });
    } catch (error) {
      reportError(error, 'start_call_failed');
      if (__DEV__) {
        console.error('Start call failed:', error);
      }
      const message = error instanceof Error ? error.message : 'Unable to start a call right now.';
      Alert.alert('Error', message);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: isTyping ? t('chat.isTyping', {name: otherUserName}) : otherUserName,
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowSearch(prev => !prev)}>
            <Text style={[styles.headerButtonText, {color: colors.primary}]}>
              {showSearch ? t('chat.done') : t('chat.search')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setActionsModalVisible(true)}>
            <Text style={[styles.headerButtonText, {color: colors.primary}]}>{t('chat.more')}</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [
    navigation,
    showSearch,
    chatId,
    colors.primary,
    otherUserName,
    isTyping,
    showTimestamps,
    t,
  ]);

  const getReplyPreviewText = (message?: any) => {
    if (!message) return '';
    if (message.text) return message.text;
    if (message.image) return t('chat.replyPreview.photo');
    if (message.video) return t('chat.replyPreview.video');
    if (message.audio) return t('chat.replyPreview.voiceMessage');
    if (message.file) return t('chat.replyPreview.file');
    return '';
  };

  /**
   * Resolves a link preview for a message that was just sent, and writes it
   * back **sealed** to the peer's key.
   *
   * The fetch already happened once, here, on the sender's device — but the
   * result used to be written to the message document in the clear, so a chat
   * whose text was end-to-end encrypted still handed the server the title,
   * description and image of every link either person shared. See
   * services/linkPreview.ts.
   */
  const addLinkPreview = useCallback(
    async (currentChatId: string, messageId: string | number, url: string) => {
      const persist = async (raw: unknown) => {
        const preview = normalizePreview(raw);
        if (!preview || !hasPreviewContent(preview)) return;
        // No peer (a group chat) means nothing to encrypt to, and
        // makeArtifactCrypto returns an inert sealer — the write falls back to
        // the plaintext field, exactly as the message path does.
        const crypto = await makeArtifactCrypto(user!.uid, otherUserId ?? undefined, currentChatId);
        await updateMessage(currentChatId, messageId, buildLinkPreviewPatch(preview, crypto) as any);
      };
      if (!user) return;
      try {
        const {httpsCallable} = require('../../services/firebase/functions');
        const {getFunctions} = require('../../services/firebase/functions');
        const fn = httpsCallable(getFunctions(), 'fetchLinkPreview');
        const result = await fn({url});
        const preview = (result as any)?.data?.preview;
        await persist(preview ? {...preview, url: preview.url || url} : null);
      } catch {
        // The callable is rate-limited and refuses private/blocked hosts, so
        // fall back to fetching from the device directly — which reveals the
        // link to nobody but the site itself. That fetch goes through
        // link-preview-js with no SSRF protection of its own, so the same
        // check the callable would have done is repeated here first — see
        // isSafeToFetchDirectly.
        if (!isSafeToFetchDirectly(url)) return;
        try {
          const data: any = await getLinkPreview(url);
          await persist({
            url,
            title: data?.title,
            description: data?.description,
            image: data?.images?.[0],
          });
        } catch {}
      }
    },
    [user, otherUserId],
  );

  const formatDuration = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '';
    const total = Math.round(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase();
    return messages.filter(message => (message.text || '').toLowerCase().includes(query));
  }, [messages, searchQuery]);

  /**
   * The fan-out width of the most recent sealed message, or null when nothing
   * in this thread is sealed (a peer who has not enrolled a key yet — see
   * collectRecipients in services/e2eeMessages.ts, which falls back to
   * plaintext rather than sending something only some members can read).
   *
   * Read off the newest message rather than the participant list because the
   * envelope is the honest source: it says how many keys this conversation is
   * *actually* being sealed to right now, which is what changes when someone
   * joins, leaves, or re-enrols on a new device.
   *
   * `messages` is newest-first (the thread is an inverted list), so the first
   * match is the latest.
   */
  const sealedKeys = useMemo(() => {
    for (const message of messages) {
      const count = sealedKeyCount(message as unknown as ChatMessage);
      if (count !== null) return count;
    }
    return null;
  }, [messages]);

  const scrollToMessageId = useCallback((messageId: string | number) => {
    const index = filteredMessages.findIndex(m => String(m._id) === String(messageId));
    if (index >= 0) {
      listRef.current?.scrollToIndex({index, animated: true});
    }
  }, [filteredMessages]);

  const lastOutgoingMessageId = useMemo(() => {
    if (!user) return null;
    return messages.find(m => m.user?._id === user.uid)?._id || null;
  }, [messages, user]);

  const firstUnreadMessageId = useMemo(() => {
    if (!user || !otherLastReadAt) return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      const createdAt =
        message.createdAt instanceof Date
          ? message.createdAt.getTime()
          : new Date(message.createdAt).getTime();
      if (createdAt > otherLastReadAt && message.user?._id !== user.uid) {
        return message._id || null;
      }
    }
    return null;
  }, [messages, otherLastReadAt, user]);

  const imageMessages = useMemo(
    () => messages.filter(m => m.image).map(m => ({uri: m.image as string})),
    [messages],
  );

  const giftedUser = useMemo(
    () => ({
      _id: user?.uid || '',
      name: user?.displayName || user?.email || 'User',
      avatar: user?.photoURL,
    }),
    [user],
  );

  const listViewProps = useMemo(
    () => ({
      ref: listRef,
      onScrollToIndexFailed: () => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({index: 0, animated: true});
        }, 50);
      },
      initialNumToRender: 20,
      maxToRenderPerBatch: 20,
      windowSize: 9,
      removeClippedSubviews: Platform.OS === 'android',
    }),
    [],
  );

  const scheduleMessageCacheWrite = useCallback((targetChatId: string, nextMessages: IMessage[]) => {
    pendingCacheRef.current = {chatId: targetChatId, messages: nextMessages};
    if (cacheWriteTimeoutRef.current) return;
    cacheWriteTimeoutRef.current = setTimeout(() => {
      const payload = pendingCacheRef.current;
      pendingCacheRef.current = null;
      cacheWriteTimeoutRef.current = null;
      if (!payload) return;
      setCachedMessages(payload.chatId, payload.messages).catch(error => reportError(error, 'cache_messages'));
    }, 700);
  }, []);

  const runUpload = useCallback(
    async (label: string, task: (onProgress: (percent: number) => void) => Promise<string>) => {
      setUploading({label, progress: 0});
      try {
        const url = await task(percent => {
          setUploading(prev => (prev ? {...prev, progress: percent} : {label, progress: percent}));
        });
        return url;
      } finally {
        setUploading(null);
      }
    },
    [],
  );

  /**
   * Uploads an attachment, encrypting its bytes first whenever every recipient
   * can read them (services/mediaCrypto.ts).
   *
   * The capability check is all-or-nothing and deliberately fails closed: if a
   * recipient's capabilities cannot be read, `peersSupportEncryptedMedia`
   * throws rather than guessing, and the caller reports a failed upload. The
   * alternative — treating "I could not find out" as "send it unencrypted" —
   * is the same silent-downgrade shape this codebase has already had to fix
   * twice, and it would be invisible to both ends.
   *
   * The stored object gets a random name when encrypted. Uploading a document
   * under its own filename would publish the title to anyone who can list the
   * bucket, which is most of what encrypting the bytes was for.
   */
  const uploadAttachment = useCallback(
    async (
      label: string,
      localUri: string,
      fileName: string,
      mime: string | undefined,
    ): Promise<{url: string; key?: MediaKeyInfo}> => {
      if (!(await peersSupportEncryptedMedia(otherUserIds))) {
        return {url: await runUpload(label, p => uploadFile(chatId, localUri, fileName, p))};
      }

      const {path, info} = await encryptToScratch(localUri, {mime});
      try {
        const objectName = `enc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const url = await runUpload(label, p => uploadFile(chatId, path, objectName, p));
        return {url, key: info};
      } finally {
        // The ciphertext is now in Storage; the local copy is dead weight and
        // sits in a directory the OS will not necessarily reclaim promptly.
        await discard(path);
      }
    },
    [chatId, otherUserIds, runUpload],
  );

  /**
   * Resolves a locally recorded file into something the *recipient* can play.
   *
   * Inline-first: short clips are embedded in the message document as a base64
   * data URI, so voice messages work without Cloud Storage (which requires a
   * paid Firebase plan). Only clips too large to embed are uploaded, so
   * enabling billing later widens the limit with no code change. Mirrors the
   * web client. Returns null when neither route is available.
   */
  const prepareAudioForSend = useCallback(
    async (fileUri: string, label: string): Promise<{uri: string; key?: MediaKeyInfo} | null> => {
      try {
        // An inline clip lives inside the message document, so it is sealed
        // by the body envelope like any other field and needs no content key
        // of its own. Only the Storage overflow below puts bytes somewhere
        // the envelope cannot reach.
        const inline = await encodeAudioForInline(fileUri);
        if (inline) return {uri: inline};
      } catch (error) {
        reportError(error, 'voice_inline_encode');
      }
      if (!chatId) return null;
      try {
        const uploaded = await uploadAttachment(
          label,
          fileUri,
          `audio_${Date.now()}.m4a`,
          'audio/mp4',
        );
        return {uri: uploaded.url, key: uploaded.key};
      } catch (error) {
        reportError(error, 'voice_overflow_upload');
        return null;
      }
    },
    [chatId, uploadAttachment],
  );

  const handleScheduleSend = useCallback(async () => {
    if (!chatId || !user || !inputText.trim()) return;
    const mins = parseInt(scheduleMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert('Invalid time', 'Enter a positive number of minutes.');
      return;
    }
    const scheduledFor = Date.now() + mins * 60 * 1000;
    const messageData: ChatMessage = {
      _id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: inputText.trim(),
      createdAt: new Date(),
      user: {_id: user.uid, name: user.displayName || user.email || 'User', avatar: user.photoURL},
    };
    /**
     * Sealed here, not at delivery. A scheduled message used to be written to
     * Firestore as plain text and sat there until its time came — in a chat
     * where every ordinary message goes out encrypted, and with no sign in the
     * UI that this one was different. Delivery copies the document verbatim
     * (the Cloud Function uses the Admin SDK), so an unsealed one stayed
     * unsealed in the thread forever.
     *
     * A failure here aborts the schedule rather than falling back to plaintext:
     * the message is not going anywhere for at least a minute, so there is
     * nothing to lose by making the user try again.
     */
    let outgoing: ChatMessage;
    try {
      outgoing = await encryptOutgoingMessage(messageData, {allowRatchet: false});
    } catch (error) {
      reportError(error, 'schedule_encrypt_failed');
      Alert.alert('Not scheduled', 'Could not encrypt the message. Please try again.');
      return;
    }
    // Awaited into a catch. Without this the write's rejection went nowhere:
    // the button did nothing, showed nothing, and left the picker open — which
    // is exactly how a broken scheduled send survived a release. Anything that
    // can fail here has to say so.
    try {
      await scheduleMessage(chatId, outgoing, scheduledFor);
    } catch (error) {
      reportError(error, 'schedule_write_failed');
      Alert.alert('Not scheduled', 'Could not save the scheduled message. Please try again.');
      return;
    }
    setComposerText('');
    setSchedulePickerVisible(false);
    Alert.alert('Scheduled', `Message will be sent in ${mins} minute${mins > 1 ? 's' : ''}.`);
  }, [chatId, user, inputText, scheduleMinutes, setComposerText, encryptOutgoingMessage]);

  const handleCreateList = useCallback(async () => {
    if (!chatId || !user) return;
    const title = listTitle.trim() || 'Shared List';
    const items: SharedListItem[] = listItems
      .filter(t => t.trim())
      .map((t, i) => ({id: `item_${i}`, text: t.trim(), checked: false}));
    if (!items.length) {
      Alert.alert('Empty list', 'Add at least one item.');
      return;
    }
    const listId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await createSharedList(chatId, listId, title, items, artifactCrypto);
    const msg: ChatMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: `[Shared List] ${title}`,
      createdAt: new Date(),
      sharedList: {id: listId, title, items},
      user: {_id: user.uid, name: user.displayName || user.email || 'User', avatar: user.photoURL},
    };
    await sendMessage(chatId, msg);
    setListTitle('');
    setListItems(['']);
    setListModalVisible(false);
  }, [chatId, user, listTitle, listItems]);

  const handleToggleListItem = useCallback(
    async (listId: string, items: SharedListItem[], itemId: string) => {
      if (!chatId) return;
      const updated = items.map(it =>
        it.id === itemId ? {...it, checked: !it.checked, checkedBy: user?.uid} : it,
      );
      await updateSharedListItem(chatId, listId, updated, artifactCrypto);
    },
    [chatId, user],
  );

  const handleSetReminder = useCallback(
    (message: IMessage, minutes: number) => {
      if (!user) return;
      const reminder = {
        id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: user.uid,
        chatId: chatId || '',
        messageId: message._id,
        // A sealed message contributes no preview. `message.text` here is the
        // *decrypted* body (the decrypt pass filled it in for display), and
        // this doc is written to Firestore and read back by processReminders,
        // which sends it as a push notification body — so copying it here
        // would put the plaintext of an end-to-end encrypted message on the
        // server and across FCM/APNs in clear. The server already falls back
        // to a generic line when this is empty.
        messagePreview: isSealed((message as any).encrypted)
          ? ''
          : (message.text || '[media]').substring(0, 100),
        remindAt: Date.now() + minutes * 60 * 1000,
        createdAt: Date.now(),
      };
      createReminder(user.uid, reminder)
        .then(() => Alert.alert('Reminder Set', `You'll be reminded in ${minutes} minute${minutes > 1 ? 's' : ''}.`))
        .catch(() => Alert.alert('Error', 'Failed to set reminder.'));
    },
    [user, chatId],
  );

  const handleTranscribe = useCallback(
    async (message: IMessage) => {
      if (!chatId) return;
      // The plaintext clip lives here, decrypted client-side for playback —
      // the server never has it (see transcription.ts's doc comment).
      const audio = decryptedAudioRef.current.get(String(message._id));
      if (!audio) {
        Alert.alert('Error', 'Failed to transcribe voice message.');
        return;
      }
      try {
        const text = await transcribeVoiceMessage(
          chatId,
          message._id,
          audio,
          i18n.language,
          (message as any).audioSampleRateHertz,
          (message as any).audioChannelCount,
        );
        Alert.alert('Transcription', text);
      } catch (err) {
        // Not a failure the user caused: they haven't seen the disclosure yet.
        // Prompt, then re-run exactly what they asked for.
        if (isAiConsentError(err)) {
          if (await promptAiConsent(t)) await handleTranscribe(message);
        } else {
          Alert.alert('Error', 'Failed to transcribe voice message.');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, i18n.language, t],
  );

  // Chatterbox Pro entitlement. Declared HERE, above the first callback whose
  // dependency array names `isPro` — a dep array is evaluated synchronously
  // during render at the line the useCallback appears on, so declaring this
  // further down would be a real temporal-dead-zone crash, not a lint nit
  // (the same trap ChatPane.tsx documents for `otherUid`).
  //
  // `isPro` is recomputed per render rather than stored, because an
  // entitlement expires by the passage of time, not by an event.
  useEffect(() => {
    if (!user?.uid) return;
    return listenEntitlement(user.uid, setEntitlement);
  }, [user?.uid]);
  const isPro = isProActive(entitlement);

  const handleSummarize = useCallback(
    async (question?: string) => {
      if (!chatId) return;
      // Pro gate. The server enforces this too (functions/index.js's
      // requirePro); this only spares non-subscribers a raw permission
      // error. Purchase happens on the web — Apple and Google require their
      // own in-app purchase for digital goods sold inside the app, so this
      // explains rather than sells.
      if (!isPro) {
        Alert.alert(t('pro.title'), t('pro.lockedAiMobile'));
        return;
      }
      setSummaryLoading(true);
      setSummaryModalVisible(true);
      setSummaryAskedQuestion(question?.trim() || '');
      try {
        // messages is already newest-first with decrypted .text (see
        // decryptedTextRef above) — reverse to chronological order for the
        // transcript Gemini sees.
        const transcript = messages
          .slice(0, 50)
          .map(m => ({sender: (m.user?.name as string) || 'User', text: (m.text as string) || '[media]'}))
          .reverse();
        const summary = await getChatSummary(chatId, transcript, question);
        setSummaryText(summary);
      } catch (err: any) {
        if (isAiConsentError(err)) {
          setSummaryText('');
          if (await promptAiConsent(t)) await handleSummarize(question);
        } else {
          setSummaryText(err?.message || 'Failed to generate summary. Please try again.');
        }
      } finally {
        setSummaryLoading(false);
      }
    },
    [chatId, messages, isPro, t],
  );

  const handleTranslateMessage = useCallback(
    async (message: IMessage) => {
      if (!chatId || !message.text) return;
      try {
        const translation = await translateMessage(chatId, message._id, message.text, i18n.language);
        setTranslatedTexts(prev => ({...prev, [String(message._id)]: translation}));
      } catch (err) {
        if (isAiConsentError(err)) {
          if (await promptAiConsent(t)) await handleTranslateMessage(message);
        } else {
          Alert.alert('Error', 'Failed to translate message.');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, i18n.language, t],
  );

  const handleBookmarkMessage = useCallback(
    async (message: IMessage) => {
      if (!user || !chatId) return;
      try {
        await addBookmark(user.uid, {
          chatId,
          messageId: message._id,
          text: message.text || '',
          senderName: message.user?.name || 'Unknown',
          senderId: String(message.user?._id || ''),
          image: (message as any).image,
          audio: (message as any).audio,
          createdAt: message.createdAt instanceof Date
            ? message.createdAt.getTime()
            : typeof message.createdAt === 'number'
              ? message.createdAt
              : Date.now(),
        });
        haptic('confirm');
        Alert.alert('Bookmarked', 'Message saved to your bookmarks.');
      } catch {
        Alert.alert('Error', 'Failed to bookmark message.');
      }
    },
    [user, chatId],
  );

  const handleAddToQuoteWall = useCallback(
    async (message: IMessage) => {
      if (!user || !chatId) return;
      try {
        await addToQuoteWall(chatId, {
          messageId: message._id,
          text: message.text || '',
          senderName: message.user?.name || 'Unknown',
          senderId: String(message.user?._id || ''),
          pinnedBy: user.uid,
          pinnedByName: user.displayName || user.email || 'User',
          createdAt: message.createdAt instanceof Date
            ? message.createdAt.getTime()
            : typeof message.createdAt === 'number'
              ? message.createdAt
              : Date.now(),
        });
        haptic('confirm');
        Alert.alert('Saved', 'Message added to the Quote Wall.');
      } catch {
        Alert.alert('Error', 'Failed to save to Quote Wall.');
      }
    },
    [user, chatId],
  );

  const loadTrendingGifs = useCallback(async () => {
    setGifLoading(true);
    try {
      const results = await getTrendingGifs();
      setGifResults(results);
    } catch {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const handleGifSearch = useCallback(async (q: string) => {
    setGifSearch(q);
    if (!q.trim()) {
      loadTrendingGifs();
      return;
    }
    setGifLoading(true);
    try {
      const results = await searchGifs(q.trim());
      setGifResults(results);
    } catch {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, [loadTrendingGifs]);

  const handleSendGif = useCallback(
    async (gif: GifResult) => {
      if (!chatId || !user) return;
      setGifPickerVisible(false);
      const messageData = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        text: '',
        createdAt: new Date(),
        gif: {
          url: gif.url,
          previewUrl: gif.previewUrl,
          mp4Url: gif.mp4Url,
          mp4PreviewUrl: gif.mp4PreviewUrl,
          width: gif.width,
          height: gif.height,
        },
        user: {
          _id: user.uid,
          name: user.displayName || user.email || 'User',
          avatar: user.photoURL,
        },
      };
      try {
        await sendMessage(chatId, messageData as any);
        haptic('commit');
      } catch {
        Alert.alert('Error', 'Failed to send GIF.');
      }
    },
    [chatId, user],
  );

  const startDictation = useCallback(async () => {
    try {
      setDictating(true);
      setDictationSeconds(0);
      dictationTimerRef.current = setInterval(() => {
        setDictationSeconds(s => s + 1);
      }, 1000);
      await recorderRef.current.startRecorder();
      recorderRef.current.addRecordBackListener(() => {});
    } catch {
      setDictating(false);
      if (dictationTimerRef.current) clearInterval(dictationTimerRef.current);
      Alert.alert('Error', 'Failed to start dictation.');
    }
  }, []);

  const stopDictation = useCallback(async () => {
    if (dictationTimerRef.current) {
      clearInterval(dictationTimerRef.current);
      dictationTimerRef.current = null;
    }
    try {
      const uri = await recorderRef.current.stopRecorder();
      recorderRef.current.removeRecordBackListener();
      setDictating(false);
      if (!chatId || !user) return;

      Alert.alert('Transcribing...', 'Converting your speech to text.');

      // `uri` is a path on *this* device; sending it raw produced a message the
      // recipient could never play. Resolve it to an inline clip (or an upload)
      // the same way a normal voice message is sent.
      const prepared = await prepareAudioForSend(uri, 'Uploading dictation');
      // This path sends the message unencrypted on purpose (see below), so a
      // content key would have nowhere to travel and the clip would be
      // unplayable for everyone. Treat a sealed upload as unusable here.
      const audioUrl = prepared && !prepared.key ? prepared.uri : null;
      if (!audioUrl) {
        setDictating(false);
        Alert.alert(t('chat.voiceTooLongTitle'), t('chat.voiceTooLongBody'));
        return;
      }

      // Deliberately NOT run through encryptOutgoingMessage: this message
      // itself is sent as a plain, unencrypted voice message rather than
      // going through transcribeVoiceMessage's normal "client sends
      // already-decrypted audio" opt-in path — dictation has the plaintext
      // clip on hand already, so there is no reason to encrypt it first only
      // to immediately decrypt-and-send it again for transcription below.
      // The plain voice-message path (sendRecording, below) is unaffected
      // and stays encrypted.
      const tempMsgId = `dictation_${Date.now()}`;
      await sendMessage(chatId, {
        _id: tempMsgId,
        text: '',
        createdAt: new Date(),
        audio: audioUrl,
        audioDuration: dictationSeconds,
        audioSampleRateHertz: VOICE_SAMPLE_RATE_HERTZ,
        audioChannelCount: VOICE_CHANNEL_COUNT,
        user: {_id: user.uid, name: user.displayName || user.email || 'User'},
      } as ChatMessage);

      const runTranscription = async () => {
        const transcription = await transcribeVoiceMessage(
          chatId,
          tempMsgId,
          audioUrl,
          i18n.language,
          VOICE_SAMPLE_RATE_HERTZ,
          VOICE_CHANNEL_COUNT,
        );
        if (transcription) {
          setComposerText(
            inputTextRef.current ? `${inputTextRef.current} ${transcription}` : transcription,
          );
        }
      };
      const transcriptionFailed = () =>
        Alert.alert('Info', 'Voice recorded but transcription failed. The voice message was sent.');

      try {
        await runTranscription();
      } catch (err) {
        // Same split the other three transcription call sites make: AI being
        // switched off is a setting, not a fault, and reporting it as "failed"
        // sends the user looking for a problem that does not exist. The clip is
        // already sent by this point, so accepting the prompt re-runs only the
        // transcription rather than the whole dictation.
        if (isAiConsentError(err)) {
          if (!(await promptAiConsent(t))) return;
          try {
            await runTranscription();
          } catch {
            transcriptionFailed();
          }
        } else {
          transcriptionFailed();
        }
      }
    } catch {
      setDictating(false);
      Alert.alert('Error', 'Failed to process dictation.');
    }
  }, [chatId, user, dictationSeconds, prepareAudioForSend, t]);

  const renderActions = useCallback(
    () => (
      <TouchableOpacity
        style={[styles.attachSingleBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
        onPress={() => setAttachSheetVisible(true)}>
        <Text style={[styles.attachSingleIcon, {color: colors.primary}]}>＋</Text>
        <Text style={[styles.attachSingleLabel, {color: colors.textSecondary}]}>{t('chat.attach')}</Text>
      </TouchableOpacity>
    ),
    [colors.surface, colors.border, colors.primary, colors.textSecondary, t],
  );

  const removePendingMessage = useCallback((id: string) => {
    setPendingMessages(prev => prev.filter(m => String(m._id) !== id));
    setMessages(prev => prev.filter(m => !(String(m._id) === id && (m as any).pending)));
  }, []);

  const extractMentions = (text: string) => {
    const matches = text.match(/@([a-zA-Z0-9_]+)/g) || [];
    return matches.map(match => match.slice(1));
  };

  /**
   * Computes and shows the safety number for out-of-band verification, and
   * clears the "key changed" banner — verifying is the one action that should
   * dismiss it, since nothing else naturally would once it's set.
   */
  const verifyContact = useCallback(async () => {
    if (!otherUserId || !user) return;
    try {
      const [{publicKey: myPublicKey}, peer] = await Promise.all([
        getOrCreateDeviceKeypair(user.uid),
        fetchPeerPublicKeyChecked(otherUserId),
      ]);
      // "Couldn't look it up" is not "they haven't enrolled". Reporting the
      // second when the first happened tells the user something false about
      // their contact's security, on the one screen whose entire job is
      // telling them the truth about it.
      if (peer.status === 'unavailable') {
        Alert.alert(
          'Verify Contact',
          "We couldn't fetch your contact's key just now. Check your connection and try again.",
        );
        return;
      }
      const peerPublicKey = peer.key;
      if (!peerPublicKey) {
        Alert.alert(
          'Verify Contact',
          "Your contact hasn't set up secure messaging on their device yet, so there's no key to verify.",
        );
        return;
      }
      // Both identities, when both sides have one: the X25519 key this chat's
      // older messages are sealed with, and the Ed25519 ratchet identity that
      // authenticates the forward-secret path. Verifying only the first would
      // leave the path users are told to trust more covered by nothing.
      //
      // Read-only — deliberately not the bundle fetch, which claims a one-time
      // prekey. Opening this screen must not drain a peer's supply.
      const [myRatchet, peerRatchet] = await Promise.all([
        getOrCreateRatchetIdentity(user.uid).catch(() => null),
        fetchPeerRatchetIdentity(user.uid, otherUserId).catch(() => ({
          identityKey: null,
          status: 'unavailable' as const,
        })),
      ]);

      const sn = computeSafetyNumber(
        {encryptionKey: myPublicKey, ratchetIdentity: myRatchet?.publicKey},
        {encryptionKey: peerPublicKey, ratchetIdentity: peerRatchet.identityKey ?? undefined},
      );
      setPeerKeyChanged(false);
      setPeerSessionReset(false);

      const covers = myRatchet && peerRatchet.identityKey ? 'both keys' : 'their message key';
      const changedNote =
        peerRatchet.status === 'changed'
          ? "\n\n⚠️ Their forward-secrecy identity changed since you last checked. Usually a reinstall — but if they didn't reinstall, do not trust this chat until you've confirmed the number in person."
          : '';
      Alert.alert(
        'Safety Number',
        `${sn}\n\nCovers ${covers}. Compare it with your contact in person or over a trusted channel. If it matches on both devices, this chat is encrypted directly between you two.${changedNote}`,
      );
    } catch (error) {
      reportError(error, 'safety_number_failed');
      Alert.alert('Verify Contact', 'Unable to compute a safety number right now.');
    }
  }, [otherUserId, user]);

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      if (!chatId || !user) return;

      const message = newMessages[0];
      if (!message?.text?.trim()) return;

      // Fired here, at the moment of sending, rather than after the write
      // lands: the bloom is showing that the message is being sealed once per
      // member, and that fan-out happens on this device before anything is
      // uploaded. No-ops for a 1:1 chat, where there is nothing to fan out.
      bloom(otherUserIds.length);

      const mentions = extractMentions(message.text);
      const messageData: ChatMessage = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        text: message.text,
        createdAt: new Date(),
        mentions,
        replyTo: replyTo
          ? {
              _id: replyTo._id,
              text: replyTo.text,
              image: (replyTo as any).image,
              video: (replyTo as any).video,
              user: {
                _id: replyTo.user?._id || '',
                name: replyTo.user?.name,
              },
            }
          : undefined,
        burnAfterReading: burnMode ? {duration: burnDuration} : undefined,
        timeCapsule: timeCapsuleMode ? {unlocksAt: Date.now() + capsuleHours * 60 * 60 * 1000} : undefined,
        invisibleInk: invisibleInkMode || undefined,
        messageStyle: messageStyle !== 'none' ? messageStyle : undefined,
        anonymous: anonymousMode || undefined,
        user: anonymousMode ? {
          _id: 'anonymous',
          name: 'Someone',
          avatar: undefined,
        } : {
          _id: user.uid,
          name: user.displayName || user.email || 'User',
          avatar: user.photoURL,
        },
      };

      if (timeCapsuleMode) setTimeCapsuleMode(false);
      if (invisibleInkMode) setInvisibleInkMode(false);
      if (messageStyle !== 'none') setMessageStyle('none');

      if (chatPet) {
        feedPet(chatId).catch(() => {});
      }

      const pendingMessage: IMessage & {burnAfterReading?: ChatMessage['burnAfterReading']} = {
        _id: String(messageData._id),
        text: messageData.text || '',
        createdAt: new Date(),
        burnAfterReading: messageData.burnAfterReading,
        user: {
          _id: user.uid,
          name: user.displayName || user.email || 'User',
          avatar: user.photoURL,
        },
        pending: true,
      };

      setPendingMessages(prev => [pendingMessage, ...prev]);
      setMessages(prev => GiftedChat.append(prev, [pendingMessage]));
      setReplyTo(null);
      setComposerText('');
      haptic('commit');

      if (!isOnline) {
        await enqueueOutboxMessage(user.uid, {
          id: String(messageData._id),
          chatId,
          message: messageData,
          createdAt: Date.now(),
        });
        return;
      }

      try {
        const outgoing = await encryptOutgoingMessage(messageData);
        await sendMessage(chatId, outgoing);
        removePendingMessage(String(messageData._id));
      } catch (error) {
        // A deleted recipient is permanent, so it must never reach the outbox:
        // every retry would fail identically and the message would sit in the
        // queue forever, re-appearing as pending on each launch.
        if (isRecipientUnreachable(error)) {
          removePendingMessage(String(messageData._id));
          setMessages(prev => prev.filter(m => String(m._id) !== String(messageData._id)));
          setComposerText(message.text || '');
          Alert.alert(t('chat.recipientDeleted'), t('chat.recipientDeletedComposer'));
          return;
        }
        // Queued for retry as the original, unencrypted messageData —
        // flushOutbox re-encrypts at send time rather than here, since the
        // peer's key may only become fetchable once connectivity returns.
        await enqueueOutboxMessage(user.uid, {
          id: String(messageData._id),
          chatId,
          message: messageData,
          createdAt: Date.now(),
        });
      }

      const url = extractFirstUrl(message.text);
      // Not for burn-after-reading: the whole point of that mode is leaving no
      // trace, and a preview card would outlive the text it came from.
      if (url && isLinkPreviewEnabled() && !incognitoMode && !burnMode) {
        void addLinkPreview(chatId, messageData._id, url);
      }
    },
    [
      chatId,
      user,
      replyTo,
      isOnline,
      otherUserId,
      removePendingMessage,
      addLinkPreview,
      incognitoMode,
      burnMode,
      burnDuration,
      invisibleInkMode,
      messageStyle,
      anonymousMode,
      chatPet,
      encryptOutgoingMessage,
      t,
      // Both feed the fan-out bloom. otherUserIds.length in particular has to
      // be a dependency: memoising it away would keep blooming the member count
      // the room had when this callback was created, so a send right after
      // someone joined would show the wrong number of sealed copies.
      bloom,
      otherUserIds.length,
    ],
  );

  const sendGestureMessage = useCallback(async () => {
    if (!chatId || !user || !gestureStrokes.length) return;
    const messageData: ChatMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      text: '',
      createdAt: new Date(),
      gesture: gestureStrokes,
      user: {_id: user.uid, name: user.displayName || user.email || 'User', avatar: user.photoURL},
    };
    try {
      await sendMessage(chatId, messageData);
    } catch { /* ignore */ }
    setGestureStrokes([]);
    setGestureMode(false);
  }, [chatId, user, gestureStrokes]);

  const sendLotteryMessage = useCallback(async () => {
    const validOptions = lotteryOptions.filter(o => o.trim());
    if (!chatId || !user || validOptions.length < 2) return;
    const messageData: ChatMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      text: 'Mystery Box',
      createdAt: new Date(),
      lottery: {options: validOptions},
      user: {_id: user.uid, name: user.displayName || user.email || 'User', avatar: user.photoURL},
    };
    try {
      await sendMessage(chatId, messageData);
    } catch { /* ignore */ }
    setLotteryOptions(['', '']);
    setLotteryMode(false);
    setLotteryModalVisible(false);
  }, [chatId, user, lotteryOptions]);

  const revealLottery = useCallback(async (msgId: string | number) => {
    if (!chatId || !user) return;
    const msg = messages.find(m => String(m._id) === String(msgId));
    if (!msg || !(msg as any).lottery || (msg as any).lottery.revealedIndex != null) return;
    const lottery = (msg as any).lottery;
    const idx = Math.floor(Math.random() * lottery.options.length);
    try {
      const {updateMessage: updateMsg} = require('../../services/firebaseChat');
      await updateMsg(chatId, msgId, {lottery: {...lottery, revealedIndex: idx, revealedBy: user.displayName || 'User'}});
    } catch { /* ignore */ }
  }, [chatId, user, messages]);

  const openMediaPicker = useCallback(async (source: 'camera' | 'library') => {
    if (!chatId || !user) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Media messages require an internet connection.');
      return;
    }

    const picker = source === 'camera' ? launchCamera : launchImageLibrary;
    const result = await picker({
      mediaType: 'mixed',
      selectionLimit: 1,
      includeBase64: true,
      quality: 0.7,
    });

    if (result.didCancel) {
      return;
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Error', 'Unable to load selected media');
      return;
    }

    const isVideo = asset.type?.startsWith('video/') ?? false;
    if (isVideo && asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
      Alert.alert('Video too large', 'Please select a video under 50MB.');
      return;
    }
    let fileName = asset.fileName || `media_${Date.now()}`;
    let uploadUri = asset.uri;
    let mediaUrl: string | null = null;
    let mediaKey: MediaKeyInfo | undefined;

    if (isVideo) {
      try {
        const uploaded = await uploadAttachment('Uploading video', uploadUri, fileName, asset.type);
        mediaUrl = uploaded.url;
        mediaKey = uploaded.key;
      } catch (error) {
        // The cause is not knowable from here — a missing bucket, a rules
        // rejection and a dropped connection all land in this catch — so
        // record it rather than asserting one in the copy below.
        reportError(error, 'video_upload_failed');
        Alert.alert(
          "Couldn't send video",
          "The upload didn't finish. Check your connection and try again.",
        );
        return;
      }
    } else {
      try {
        try {
          const stripExif = isExifStrippingEnabled();
          const resized = await ImageResizer.createResizedImage(
            asset.uri,
            1080,
            1080,
            'JPEG',
            70,
            0,
            undefined,
            // keepMeta: EXIF (including GPS) survives the resize unless
            // stripping is enabled. Previously hardcoded to false — EXIF was
            // always stripped regardless of this setting.
            !stripExif,
            {mode: 'contain', onlyScaleDown: true},
          );
          uploadUri = resized.uri || asset.uri;
          fileName = resized.name || fileName;
        } catch (resizeError) {
          reportError(resizeError, 'image_resize_failed');
          if (__DEV__) {
            console.warn('Image resize failed, uploading original.', resizeError);
          }
        }
        const uploaded = await uploadAttachment(
          'Uploading image',
          uploadUri,
          fileName,
          // The resize above rewrites to JPEG, so the asset's own type would
          // be wrong for anything that started as PNG or HEIC.
          uploadUri === asset.uri ? asset.type : 'image/jpeg',
        );
        mediaUrl = uploaded.url;
        mediaKey = uploaded.key;
      } catch (error) {
        // Falling back to an inline copy, which encryptOutgoingMessage still
        // seals field-by-field — so this is a downgrade in *transport*, not in
        // confidentiality. Recorded either way: a silent fallback that fires on
        // every send is a broken upload nobody would otherwise hear about.
        reportError(error, 'image_upload_failed_inline_fallback');
        const base64 = asset.base64;
        const maxBase64Length = 700000;
        if (!base64 || base64.length > maxBase64Length) {
          Alert.alert(
            "Couldn't send photo",
            "The upload didn't finish, and this image is too large to send inside the message. " +
              'Check your connection, or try a smaller image.',
          );
          return;
        }
        const mime = asset.type || 'image/jpeg';
        mediaUrl = `data:${mime};base64,${base64}`;
      }
    }
    const messageData: ChatMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      text: '',
      createdAt: new Date(),
      image: isVideo ? undefined : mediaUrl || undefined,
      video: isVideo ? mediaUrl || undefined : undefined,
      videoDuration: isVideo ? asset.duration : undefined,
      // Set together, always: `mediaSealed` tells every reader the URL points
      // at ciphertext, and `mediaKeys` is what encryptOutgoingMessage folds
      // into the sealed body. A message with one and not the other is either
      // unreadable or leaks the object, so they are never assigned apart.
      mediaSealed: mediaKey ? true : undefined,
      mediaKeys: mediaKey ? {[isVideo ? 'video' : 'image']: mediaKey} : undefined,
      viewOnce: viewOnceMode || undefined,
      replyTo: replyTo
        ? {
            _id: replyTo._id,
            text: replyTo.text,
            image: (replyTo as any).image,
            video: (replyTo as any).video,
            user: {
              _id: replyTo.user?._id || '',
              name: replyTo.user?.name,
            },
          }
        : undefined,
      user: {
        _id: user.uid,
        name: user.displayName || user.email || 'User',
        avatar: user.photoURL,
      },
    };

    if (viewOnceMode) setViewOnceMode(false);
    if (await sendEncrypted(messageData)) setReplyTo(null);
  }, [chatId, user, replyTo, isOnline, viewOnceMode, sendEncrypted]);

  const handlePickFile = useCallback(async () => {
    if (!chatId || !user) return;
    if (!isOnline) {
      Alert.alert('Offline', 'File attachments require an internet connection.');
      return;
    }
    try {
      // copyTo, because the picker otherwise hands back a content:// URI and
      // mediaFiles' toPath only strips file://. That URI reached fs.stat()
      // verbatim, which threw, so *every* file attachment died in
      // encryptToScratch while photos — which arrive as file:// — uploaded
      // fine. fileCopyUri is a real path in the cache directory.
      const file = await DocumentPicker.pickSingle({copyTo: 'cachesDirectory'});
      if (!file?.uri) return;
      if (file.size && file.size > MAX_FILE_BYTES) {
        Alert.alert('File too large', 'Please select a file under 25MB.');
        return;
      }
      const pickedUri = file.fileCopyUri ?? file.uri;
      let remoteUrl: string | null = null;
      let fileKey: MediaKeyInfo | undefined;
      try {
        const uploaded = await uploadAttachment(
          'Uploading file',
          pickedUri,
          file.name || `file_${Date.now()}`,
          file.type ?? undefined,
        );
        remoteUrl = uploaded.url;
        fileKey = uploaded.key;
      } catch (error) {
        // Unlike images there is no inline fallback for files, so this is the
        // end of the send. See the video catch for why the cause is recorded
        // rather than named.
        reportError(error, 'file_upload_failed');
        Alert.alert(
          "Couldn't send file",
          "The upload didn't finish. Check your connection and try again.",
        );
        return;
      } finally {
        // Only the copy copyTo made is ours to delete; file.uri belongs to the
        // document provider. Same reasoning as uploadAttachment's own finally.
        if (file.fileCopyUri) await discard(file.fileCopyUri);
      }

      const messageData: ChatMessage = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        text: '',
        createdAt: new Date(),
        file: {
          uri: remoteUrl,
          name: file.name ?? undefined,
          type: file.type ?? undefined,
          size: file.size ?? undefined,
        },
        mediaSealed: fileKey ? true : undefined,
        mediaKeys: fileKey ? {file: fileKey} : undefined,
        replyTo: replyTo
          ? {
              _id: replyTo._id,
              text: replyTo.text,
              image: (replyTo as any).image,
              video: (replyTo as any).video,
              user: {
                _id: replyTo.user?._id || '',
                name: replyTo.user?.name,
              },
            }
          : undefined,
        user: {
          _id: user.uid,
          name: user.displayName || user.email || 'User',
          avatar: user.photoURL,
        },
      };

      // sendEncrypted reports its own failures, and reports them accurately —
      // reaching the catch below would have blamed the file picker for what is
      // actually a send failure.
      if (await sendEncrypted(messageData)) {
        setReplyTo(null);
        haptic('commit');
      }
    } catch (error: any) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Error', 'Unable to pick file');
      }
    }
  }, [chatId, user, replyTo, isOnline, sendEncrypted]);

  const startRecording = async () => {
    try {
      setRecordedUri(null);
      setRecordedDuration(null);
      const path = await recorderRef.current.startRecorder(undefined, audioSet, true);
      setRecording(true);
      recorderRef.current.addRecordBackListener(e => {
        setRecordedDuration(Math.floor(e.currentPosition / 1000));
        return;
      });
      setRecordedUri(path);
    } catch (error) {
      Alert.alert('Error', 'Unable to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      await recorderRef.current.stopRecorder();
      recorderRef.current.removeRecordBackListener();
      setRecording(false);
    } catch (error) {
      Alert.alert('Error', 'Unable to stop recording');
    }
  };

  const sendRecording = useCallback(async () => {
    if (!recordedUri || !chatId || !user) return;
    // Stop first, unconditionally — Send is reachable while still recording and
    // used to leave the recorder running. The microphone stayed live after the
    // message had gone out, the file kept growing past the bytes that were
    // uploaded, and the record-back listener went on raising recordedDuration
    // against the *accumulated* position, which is why a ten-second clip was
    // sent as "140s". Harmless when the user already pressed Stop.
    try {
      await recorderRef.current.stopRecorder();
      recorderRef.current.removeRecordBackListener();
    } catch {
      // Nothing was recording, which is the Stop-then-Send path.
    }
    setRecording(false);
    if (!isOnline) {
      Alert.alert('Offline', 'Voice messages require an internet connection.');
      return;
    }
    const prepared = await prepareAudioForSend(recordedUri, 'Uploading voice message');
    if (!prepared) {
      Alert.alert(t('chat.voiceTooLongTitle'), t('chat.voiceTooLongBody'));
      return;
    }
    const messageData: ChatMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      text: '',
      createdAt: new Date(),
      audio: prepared.uri,
      mediaSealed: prepared.key ? true : undefined,
      mediaKeys: prepared.key ? {audio: prepared.key} : undefined,
      audioDuration: recordedDuration || undefined,
      audioSampleRateHertz: VOICE_SAMPLE_RATE_HERTZ,
      audioChannelCount: VOICE_CHANNEL_COUNT,
      voiceFilter: voiceFilter !== 'none' ? voiceFilter : undefined,
      replyTo: replyTo
        ? {
            _id: replyTo._id,
            text: replyTo.text,
            image: (replyTo as any).image,
            video: (replyTo as any).video,
            user: {
              _id: replyTo.user?._id || '',
              name: replyTo.user?.name,
            },
          }
        : undefined,
      user: {
        _id: user.uid,
        name: user.displayName || user.email || 'User',
        avatar: user.photoURL,
      },
    };
    // Everything below discards the recording, so it is all gated on the send
    // actually happening — a failed send used to wipe the clip anyway, leaving
    // nothing to retry with.
    if (!(await sendEncrypted(messageData))) return;
    setReplyTo(null);
    setRecordModalVisible(false);
    setRecordedUri(null);
    setRecordedDuration(null);
    setVoiceFilter('none');
    haptic('commit');
  }, [
    recordedUri,
    recordedDuration,
    chatId,
    user,
    replyTo,
    isOnline,
    voiceFilter,
    prepareAudioForSend,
    t,
    sendEncrypted,
  ]);

  const playAudio = async (messageId: string | number, uri: string) => {
    try {
      if (playingAudioId === messageId) {
        await recorderRef.current.stopPlayer();
        setPlayingAudioId(null);
        return;
      }
      setPlayingAudioId(messageId);
      // Native playback (AVAudioPlayer / MediaPlayer) accepts a file or http(s)
      // URL but not a `data:` URI, so an inline clip is decoded to a real file
      // first. Cached per message id, so replaying costs nothing after the
      // first decode.
      const playableUri = isDataUri(uri)
        ? await materializeInlineAudio(uri, messageId)
        : uri;
      await recorderRef.current.startPlayer(playableUri);
      await recorderRef.current.setVolume(1.0);
      recorderRef.current.addPlayBackListener(e => {
        if (e.currentPosition >= e.duration) {
          recorderRef.current.stopPlayer();
          recorderRef.current.removePlayBackListener();
          setPlayingAudioId(null);
        }
        return;
      });
    } catch (error) {
      Alert.alert('Error', 'Unable to play audio');
    }
  };

  const handleStopSharingLocation = useCallback(() => {
    stopLocationWatchRef.current?.();
    stopLocationWatchRef.current = null;
    lastLocationSentAtRef.current = null;
    setSharingLocation(false);
    if (chatId && user) {
      stopSharingLocation(chatId, user.uid).catch(() => {});
    }
  }, [chatId, user]);

  const beginSharingLocation = useCallback(
    async (durationMs: number) => {
      if (!chatId || !user || !otherUserId) return;
      try {
        const initial = await getCurrentPosition();
        await startSharingLocation(chatId, user.uid, otherUserId, durationMs, initial);
        setSharingLocation(true);
        lastLocationSentAtRef.current = Date.now();
        stopLocationWatchRef.current = watchMyPosition(
          position => {
            const now = Date.now();
            if (!shouldSendLocationUpdate(lastLocationSentAtRef.current, now)) return;
            lastLocationSentAtRef.current = now;
            updateSharedLocation(chatId, user.uid, otherUserId, position).catch(error => {
              reportError(error, 'live_location_update_failed');
            });
          },
          error => {
            reportError(error, 'live_location_watch_failed');
          },
        );
      } catch (error) {
        if (error instanceof LocationError && error.reason === 'denied') {
          Alert.alert('Location permission needed', 'Allow location access to share your live location.');
        } else if (error instanceof LocationError && error.reason === 'services-off') {
          Alert.alert('Location services off', 'Turn on Location Services to share your live location.');
        } else if (error instanceof Error && error.message.includes('encryption key')) {
          Alert.alert(
            "Can't share location securely",
            "This works only once the other person has opened Chatterbox at least once.",
          );
        } else {
          reportError(error, 'live_location_start_failed');
          Alert.alert('Error', 'Unable to start sharing your location.');
        }
      }
    },
    [chatId, user, otherUserId],
  );

  const handleShareLocation = useCallback(() => {
    Alert.alert('Share Live Location', 'How long do you want to share your location?', [
      {text: 'Cancel', style: 'cancel'},
      {text: '15 minutes', onPress: () => beginSharingLocation(15 * 60 * 1000)},
      {text: '1 hour', onPress: () => beginSharingLocation(60 * 60 * 1000)},
      {text: '8 hours', onPress: () => beginSharingLocation(8 * 60 * 60 * 1000)},
    ]);
  }, [beginSharingLocation]);

  // Built here from numeric coordinates, so it is not participant-controlled
  // and deliberately skips openExternal — Android's map intent uses `geo:`,
  // which that allowlist (correctly) rejects for untrusted input.
  const openInMaps = useCallback((lat: number, lng: number) => {
    const url = Platform.OS === 'ios' ? `https://maps.apple.com/?ll=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  /**
   * Opens a link that came from the other participant (file URIs, link
   * previews, context cards). Anything outside the safe-scheme allowlist is
   * dropped rather than handed to whatever app claims that scheme.
   */
  const openExternal = useCallback(
    (raw: string | null | undefined) => {
      const url = safeExternalUrl(raw);
      if (!url) {
        Alert.alert(t('common.error'), t('chat.unsafeLink'));
        return;
      }
      Linking.openURL(url).catch(() => {});
    },
    [t],
  );

  // Pause the outgoing watch on blur (foreground-only tracking) — the share
  // itself (the Firestore doc) is left in place so the peer still sees the
  // last known position rather than it vanishing; only an explicit Stop
  // deletes it. Resumes automatically on refocus if still sharing.
  useFocusEffect(
    useCallback(() => {
      if (sharingLocation && chatId && user && otherUserId && !stopLocationWatchRef.current) {
        lastLocationSentAtRef.current = Date.now();
        stopLocationWatchRef.current = watchMyPosition(
          position => {
            const now = Date.now();
            if (!shouldSendLocationUpdate(lastLocationSentAtRef.current, now)) return;
            lastLocationSentAtRef.current = now;
            updateSharedLocation(chatId, user.uid, otherUserId, position).catch(error => {
              reportError(error, 'live_location_update_failed');
            });
          },
          error => reportError(error, 'live_location_watch_failed'),
        );
      }
      return () => {
        stopLocationWatchRef.current?.();
        stopLocationWatchRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId, user, otherUserId]),
  );

  // Listen for the peer's active share, whenever this device's own key is available.
  useEffect(() => {
    if (!chatId || !user || !otherUserId) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    getOrCreateDeviceKeypair(user.uid)
      .then(({secretKey}) => {
        if (cancelled) return;
        unsubscribe = listenLiveLocation(chatId, otherUserId, secretKey, setPeerLiveLocation);
      })
      .catch(error => reportError(error, 'live_location_listen_failed'));
    return () => {
      cancelled = true;
      unsubscribe?.();
      setPeerLiveLocation(null);
    };
  }, [chatId, user, otherUserId]);

  // Keeps "Updated Xs ago" fresh between Firestore snapshots, which only
  // arrive roughly every MIN_LOCATION_UPDATE_INTERVAL_MS while sharing.
  const [, forceLocationAgeTick] = useState(0);
  useEffect(() => {
    if (!peerLiveLocation) return;
    const interval = setInterval(() => forceLocationAgeTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [peerLiveLocation]);

  const handlePickMedia = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo or Video', 'Choose from Library', 'Attach File', 'Record Voice'],
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex === 1) {
            openMediaPicker('camera');
          } else if (buttonIndex === 2) {
            openMediaPicker('library');
          } else if (buttonIndex === 3) {
            handlePickFile();
          } else if (buttonIndex === 4) {
            setRecordModalVisible(true);
          }
        },
      );
      return;
    }

    // ActionSheet, not Alert.alert: this menu has five entries and Android's
    // AlertDialog has three button slots, so 'Voice' and 'Cancel' were dropped
    // with no error — the voice recorder had no reachable entry point on
    // Android at all, and the dialog could not even be cancelled. Same failure
    // the message menu hit; see the module doc on components/ActionSheet.
    setSheet({
      title: 'Attach Media',
      message: 'Choose a source',
      actions: [
        {label: 'Camera', onPress: () => openMediaPicker('camera')},
        {label: 'Gallery', onPress: () => openMediaPicker('library')},
        {label: 'File', onPress: handlePickFile},
        {label: 'Voice', onPress: () => setRecordModalVisible(true)},
      ],
    });
  }, [openMediaPicker, handlePickFile]);

  const renderMessageImage = useCallback(
    (props: any) => {
      const msg = props?.currentMessage;
      const {key: _key, ...imageProps} = props || {};
      if (msg?.viewOnce && msg?.viewOnceExpired) {
        return (
          <View style={styles.viewOnceExpired}>
            <Text style={[styles.viewOnceExpiredText, {color: colors.textSecondary}]}>View-once media expired</Text>
          </View>
        );
      }
      if (msg?.viewOnce && msg?.user?._id !== user?.uid && !msg?.viewOnceViewedBy?.includes(user?.uid)) {
        return (
          <Pressable
            style={styles.viewOncePlaceholder}
            onPress={() => {
              const uri = msg?.image;
              if (uri) {
                // Recorded, not awaited: the photo opens now. Without this the
                // view was never registered at all, so the placeholder came
                // back on the next render and the media stayed openable
                // forever — the feature did nothing.
                markViewOnceViewed(chatId, msg._id);
                const index = imageMessages.findIndex(img => img.uri === uri);
                setImageViewerIndex(index >= 0 ? index : 0);
                setImageViewerVisible(true);
              }
            }}>
            <Icon name="eye" size={32} color="#10B981" style={styles.viewOnceIcon} />
            <Text style={styles.viewOnceText}>View once photo</Text>
          </Pressable>
        );
      }
      return (
        <Pressable
          onPress={() => {
            const uri = msg?.image;
            if (uri) {
              const index = imageMessages.findIndex(img => img.uri === uri);
              setImageViewerIndex(index >= 0 ? index : 0);
              setImageViewerVisible(true);
            }
          }}>
          {msg?.viewOnce ? <Text style={styles.viewOnceBadge}>View once</Text> : null}
          <MessageImage {...imageProps} />
        </Pressable>
      );
    },
    [imageMessages, user?.uid],
  );

  const renderMessageVideo = useCallback(
    (props: any) => (
      <Pressable
        onPress={() => {
          const uri = props?.currentMessage?.video;
          if (uri) {
            setPreview({uri, type: 'video'});
          }
        }}>
        <View style={styles.videoBubble}>
          <Video
            source={{uri: props?.currentMessage?.video}}
            style={styles.videoThumb}
            resizeMode="cover"
            paused
          />
          <View style={styles.videoOverlay}>
            <Icon name="play" size={32} color="#fff" />
            {props?.currentMessage?.videoDuration ? (
              <Text style={styles.videoDurationText}>
                {formatDuration(props.currentMessage.videoDuration)}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    ),
    [],
  );

  const renderFileCard = (file?: ChatMessage['file']) => {
    if (!file?.uri) return null;
    return (
      <Pressable
        style={[styles.fileCard, {backgroundColor: colors.surface}]}
        onPress={() => openExternal(file.uri)}>
        <View>
          <Text style={[styles.fileName, {color: colors.text}]}>{file.name || 'File'}</Text>
          {file.size ? (
            <Text style={[styles.fileMeta, {color: colors.textSecondary}]}>
              {Math.round(file.size / 1024)} KB
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderAudioBubble = (message: ChatMessage) => {
    if (!message.audio) return null;
    const filterLabel = message.voiceFilter && message.voiceFilter !== 'none'
      ? ` (${message.voiceFilter})`
      : '';
    return (
      <Pressable
        style={[styles.audioBubble, {backgroundColor: colors.surface}]}
        onPress={() => playAudio(message._id, message.audio || '')}>
        <Icon
          name={playingAudioId === message._id ? 'pause' : 'play'}
          size={16}
          color={colors.primary}
          style={styles.audioIcon}
        />
        <Text style={[styles.audioText, {color: colors.text}]}>
          {message.audioDuration ? `${message.audioDuration}s` : 'Voice message'}{filterLabel}
        </Text>
      </Pressable>
    );
  };

  const renderMessageAudio = useCallback(
    (props: any) => renderAudioBubble(props?.currentMessage as ChatMessage),
    [playingAudioId, colors],
  );

  const renderLinkPreview = (preview?: ChatMessage['linkPreview']) => {
    if (!preview?.url) return null;
    return (
      <Pressable
        style={[styles.linkPreview, {backgroundColor: colors.surface}]}
        onPress={() => openExternal(preview.url)}>
        {preview.image ? (
          <Image source={{uri: preview.image}} style={styles.linkImage} />
        ) : null}
        <View style={styles.linkTextWrap}>
          <Text style={[styles.linkTitle, {color: colors.text}]} numberOfLines={1}>
            {preview.title || preview.url}
          </Text>
          {preview.description ? (
            <Text style={[styles.linkDescription, {color: colors.textSecondary}]} numberOfLines={2}>
              {preview.description}
            </Text>
          ) : null}
          <Text style={[styles.linkUrl, {color: colors.primary}]} numberOfLines={1}>
            {preview.url}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderMomentCard = (moment: ChatMessage['moment']) => {
    if (!moment) return null;
    return (
      <Pressable
        style={[styles.momentCard, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}
        onPress={() => navigation.navigate('MomentsTab')}
      >
        <Text style={[styles.momentTitle, {color: colors.text}]}>Shared a moment</Text>
        {moment.text ? (
          <Text style={[styles.momentText, {color: colors.text}]} numberOfLines={2}>
            {moment.text}
          </Text>
        ) : null}
        {moment.mediaUrl && moment.mediaType === 'image' ? (
          <Image source={{uri: moment.mediaUrl}} style={styles.momentMedia} resizeMode="cover" />
        ) : null}
        {moment.mediaUrl && moment.mediaType === 'video' ? (
          <Video source={{uri: moment.mediaUrl}} style={styles.momentMedia} resizeMode="cover" paused />
        ) : null}
      </Pressable>
    );
  };

  const renderMessageText = useCallback(
    (props: any) => {
      const current = props?.currentMessage || {};
      const text = current.text || '';
      const msgId = String(current._id);
      const isOutgoing = props?.position === 'right';
      const baseColor = isOutgoing ? colors.textOnPrimary : colors.text;
      const mentionColor = isOutgoing ? colors.warning : colors.primary;

      if (current.invisibleInk && !revealedMessages.has(msgId)) {
        return (
          <Pressable
            onLongPress={() => setRevealedMessages(prev => new Set(prev).add(msgId))}
            style={styles.invisibleInkWrap}>
            <Text style={[styles.messageText, {color: 'transparent'}]}>{text}</Text>
            <View style={styles.invisibleInkOverlay}>
              <View style={styles.invisibleInkHintRow}>
                <Icon name="droplet" size={14} color="#fff" />
                <Text style={styles.invisibleInkHint}>Hold to reveal</Text>
              </View>
            </View>
          </Pressable>
        );
      }

      const styleMap: Record<string, any> = {
        neon: {color: '#0FF', textShadowColor: '#0FF', textShadowRadius: 10, fontWeight: '700'},
        handwriting: {fontStyle: 'italic', fontSize: 18, letterSpacing: 0.5},
        gradient: {color: '#EC4899', fontWeight: '800'},
        typewriter: {fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1},
        bounce: {fontSize: 18, fontWeight: '800'},
      };
      const extraStyle = current.messageStyle ? styleMap[current.messageStyle] || {} : {};

      const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
      const body = (
        <Text style={[styles.messageText, {color: baseColor}, extraStyle]}>
          {parts.map((part: string, index: number) =>
            part.startsWith('@') ? (
              <Text key={`${part}-${index}`} style={{color: mentionColor, fontWeight: '700'}}>
                {part}
              </Text>
            ) : (
              <Text key={`${part}-${index}`}>{part}</Text>
            ),
          )}
        </Text>
      );

      // Incoming only — for a message you received, resolving out of ciphertext
      // is literally what happened. CipherText decides for itself whether this
      // message is new enough to animate, and only ever plays once.
      // A burn-after-reading message whose countdown has run out. Wrapped
      // before the CipherText branch below because a message can only be doing
      // one of these at a time, and expiring outranks arriving.
      if (current.burnAfterReading?.burnStartedAt && burnCountdowns[msgId] === 0) {
        return (
          <Disintegrate
            text={text}
            active
            style={[styles.messageText, {color: baseColor}, extraStyle]}
            tint={colors.warning}>
            {body}
          </Disintegrate>
        );
      }

      if (isOutgoing || current.awaitingDecryption) return body;
      return (
        <CipherText
          text={text}
          messageId={msgId}
          createdAt={current.createdAt}
          style={[styles.messageText, {color: baseColor}, extraStyle]}
          sealedColor={colors.primary}>
          {body}
        </CipherText>
      );
    },
    [colors.primary, colors.text, colors.textOnPrimary, colors.warning, revealedMessages, burnCountdowns],
  );

  // ---- Multi-select delete --------------------------------------------------
  const toggleMsgSelect = (id: string) =>
    setMsgSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const enterMsgSelect = (id?: string) => {
    setMsgSelected(id ? new Set([id]) : new Set());
    setMsgSelectMode(true);
  };
  const exitMsgSelect = () => {
    setMsgSelectMode(false);
    setMsgSelected(new Set());
  };
  const handleDeleteSelectedMsgs = () => {
    if (!chatId || !user) return;
    // Only your own messages are deletable (firestore.rules). A mixed
    // selection silently dropping the others would be worse than saying so:
    // the user would believe a message was gone when it was not.
    const selected = [...msgSelected];
    const ownIds = new Set(
      messages.filter(m => String(m.user?._id) === user.uid).map(m => String(m._id)),
    );
    const ids = selected.filter(id => ownIds.has(id));
    const skipped = selected.length - ids.length;
    if (ids.length === 0) {
      Alert.alert(
        'Nothing to delete',
        'You can only delete your own messages. Report a message instead if you object to it.',
      );
      return;
    }
    Alert.alert(
      'Delete messages',
      `Permanently delete ${ids.length} message${ids.length > 1 ? 's' : ''} for everyone? This cannot be undone.` +
        (skipped > 0
          ? `\n\n${skipped} message${skipped > 1 ? 's were' : ' was'} left out — you can only delete your own.`
          : ''),
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessages(chatId, ids, user.uid);
            } catch {
              /* ignore */
            }
            exitMsgSelect();
          },
        },
      ],
    );
  };
  const handleDeleteSingle = (id: string | number) => {
    if (!chatId || !user) return;
    Alert.alert('Delete message', 'Permanently delete this message for everyone? This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => deleteMessages(chatId, [id], user.uid).catch(() => {})},
    ]);
  };

  /**
   * Sends forwardTarget's text into a different chat, freshly sealed for
   * *that* chat's recipients — never the original envelope, which was sealed
   * for this chat's members and would be unreadable (or worse, silently
   * unsealable in a way that looks like a bug) to anyone else. sendTextMessage
   * already does exactly this key lookup + seal + send for an arbitrary
   * target chat, so forwarding is that call with a fresh message id, not a
   * copy of ChatScreen's own encryptOutgoingMessage (which is closed over
   * *this* chat's recipients specifically).
   */
  const handleForwardPick = async (targetChatId: string) => {
    const target = forwardTarget;
    if (!target || !user) return;
    const text = String(target.text || '').trim();
    setForwardTarget(null);
    if (!text) return;
    try {
      const targetChat = await getChat(targetChatId);
      const recipientUids = (targetChat?.participants || []).filter(id => id !== user.uid);
      await sendTextMessage(
        targetChatId,
        {
          _id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          text,
          createdAt: new Date(),
          user: {_id: user.uid, name: user.displayName || user.email || 'Me', avatar: user.photoURL || undefined},
        },
        user.uid,
        recipientUids,
      );
      haptic('confirm');
      Alert.alert('Forwarded', 'Message forwarded.');
    } catch (error) {
      reportError(error, 'forward_message');
      Alert.alert('Error', 'Could not forward the message. Please try again.');
    }
  };

  /**
   * Reports someone else's message.
   *
   * Two-step on purpose. The reason picker is the first step; the second is a
   * confirmation that says, in words, that the message's text will be sent to
   * the moderators. In an end-to-end encrypted app that disclosure is the
   * whole point of the confirmation — the server cannot read the message, so
   * reporting is the one action that deliberately hands one message's
   * plaintext out of the conversation, and the user should not discover that
   * afterwards.
   */
  const handleReportMessage = (message: IMessage) => {
    if (!user || !chatId) return;
    const authorUid = String(message.user?._id ?? '');
    const reportText = typeof message.text === 'string' ? message.text : '';

    Alert.alert('Report message', 'Why are you reporting this?', [
      ...REPORT_REASONS.map(reason => ({
        text: t(`chat.reportReason.${reason}`, {defaultValue: reason}),
        onPress: () => {
          Alert.alert(
            'Send report?',
            reportText
              ? 'This message\'s text will be sent to the moderators along with your report. The rest of this conversation stays encrypted and is not included.'
              : 'Your report will be sent to the moderators. This message has no text to include.',
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Send report',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await reportMessage({
                      chatId,
                      messageId: String(message._id),
                      authorUid,
                      reporterUid: user.uid,
                      reason,
                      ...(reportText ? {content: reportText} : null),
                    });
                    haptic('confirm');
                    Alert.alert('Reported', 'Thanks — the report has been sent.');
                  } catch (error) {
                    reportError(error, 'report_message');
                    Alert.alert('Error', 'Could not send the report. Please try again.');
                  }
                },
              },
            ],
          );
        },
      })),
      {text: 'Cancel', style: 'cancel' as const},
    ]);
  };

  const handleLongPress = (_: any, message: IMessage) => {
    if (msgSelectMode) {
      toggleMsgSelect(String(message._id));
      return;
    }
    if (!user || !chatId) return;
    const hasAudio = !!(message as any).audio;
    // Deleting is the author's own action (firestore.rules enforces it, since
    // only the deleter can restore from trash). Someone else's message is
    // reported instead — offering a Delete that the server would refuse would
    // just be a button that fails.
    const isOwnMessage = String(message.user?._id) === user.uid;
    const actions: SheetAction[] = [
      {label: 'Reply', onPress: () => setReplyTo(message)},
      ...(message.text ? [{label: 'Forward', onPress: () => setForwardTarget(message)}] : []),
      {label: 'Select Messages', onPress: () => enterMsgSelect(String(message._id))},
      ...(isOwnMessage
        ? [{label: 'Delete Message', destructive: true, onPress: () => handleDeleteSingle(message._id)}]
        : [{label: 'Report Message', destructive: true, onPress: () => handleReportMessage(message)}]),
      {
        label: pinnedMessageIds.includes(message._id) ? 'Unpin Message' : 'Pin Message',
        onPress: () => togglePinMessage(chatId, message._id),
      },
      {
        label: 'Remind Me',
        onPress: () => {
          if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
              {options: ['Cancel', '5 min', '30 min', '1 hour', '3 hours'], cancelButtonIndex: 0},
              idx => {
                const mins = [0, 5, 30, 60, 180][idx];
                if (mins > 0) handleSetReminder(message, mins);
              },
            );
          } else {
            // Four buttons — one past Android's Alert cap, so "1 hour" never
            // rendered. Now the same four options iOS gets.
            setSheet({
              title: 'Remind Me',
              message: 'When?',
              actions: [5, 30, 60, 180].map(mins => ({
                label: mins < 60 ? `${mins} min` : `${mins / 60} hour${mins > 60 ? 's' : ''}`,
                onPress: () => handleSetReminder(message, mins),
              })),
            });
          }
        },
      },
      {
        label: 'Translate',
        onPress: () => handleTranslateMessage(message),
      },
      {
        label: 'Bookmark',
        onPress: () => handleBookmarkMessage(message),
      },
      ...(message.text
        ? [{label: 'Save to Quote Wall', onPress: () => handleAddToQuoteWall(message)}]
        : []),
      ...(hasAudio
        ? [{label: 'Transcribe', onPress: () => handleTranscribe(message)}]
        : []),
      {
        label: 'More Reactions',
        // Opens the magnetic arc (components/ReactionArc) rather than a platform
        // action sheet. Same options; the difference is that they are pickable
        // by feel instead of read as a list of emoji rendered as text.
        onPress: () => setArcTarget(message),
      },
      {
        label: 'React 👍',
        onPress: () => {
          toggleReaction(chatId, message._id, '👍', user.uid);
          burstAtSheet('👍');
          haptic('commit');
        },
      },
      {
        label: 'React ❤️',
        onPress: () => {
          toggleReaction(chatId, message._id, '❤️', user.uid);
          burstAtSheet('❤️');
          haptic('commit');
        },
      },
      {
        label: 'React 😂',
        onPress: () => {
          toggleReaction(chatId, message._id, '😂', user.uid);
          burstAtSheet('😂');
          haptic('commit');
        },
      },
      {
        label: 'Add to Reaction Story',
        onPress: () => {
          const chainEmojis = ['😀', '😎', '🐱', '🐟', '🌊', '🌈', '⭐', '🎵', '🍕', '🚀'];
          if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
              {options: ['Cancel', ...chainEmojis], cancelButtonIndex: 0},
              idx => {
                if (idx > 0) {
                  const emoji = chainEmojis[idx - 1];
                  const current = (message as any).reactionChain || [];
                  updateMessage(chatId, message._id, {reactionChain: [...current, emoji]}).catch(() => {});
                }
              },
            );
          } else {
            // Was capped to six and then silently truncated to three. The
            // sheet scrolls, so all ten are offered — same list as iOS, rather
            // than a different (and broken) one per platform.
            setSheet({
              title: 'Reaction Story',
              message: 'Pick an emoji to add',
              actions: chainEmojis.map(e => ({
                label: e,
                onPress: () => {
                  const current = (message as any).reactionChain || [];
                  updateMessage(chatId, message._id, {reactionChain: [...current, e]}).catch(() => {});
                },
              })),
            });
          }
        },
      },
    ];

    if (Platform.OS === 'ios') {
      const options = ['Cancel', ...actions.map(a => a.label)];
      ActionSheetIOS.showActionSheetWithOptions(
        {options, cancelButtonIndex: 0},
        index => {
          if (index > 0) {
            actions[index - 1].onPress();
          }
        },
      );
      return;
    }

    setSheet({title: 'Message Actions', actions});
  };

  const formatBurnDuration = useCallback((seconds: number) => {
    if (seconds >= 60) {
      return `${seconds / 60}m`;
    }
    return `${seconds}s`;
  }, []);

  const BURN_DURATIONS = useMemo(() => [5, 10, 30, 60, 300], []);

  const handleRevealBurnMessage = useCallback(
    async (msg: IMessage) => {
      if (!chatId) {
        return;
      }
      const now = Date.now();
      const burn = (msg as any).burnAfterReading;
      if (!burn || burn.burnStartedAt || burn.burned) {
        return;
      }
      try {
        await updateMessage(chatId, msg._id, {
          burnAfterReading: {...burn, burnStartedAt: now},
        });
        startBurnCountdown(msg._id, burn.duration, now);
      } catch (_e) {
        // Silently fail - message remains hidden
      }
    },
    [chatId, startBurnCountdown],
  );

  // The pet reacts to messages arriving from the other side. Deliberately not
  // on mount: opening a chat is not an arrival, and a pet that lurched every
  // time you opened a thread would read as a glitch rather than as attention.
  const lastArrivalIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newest = messages[0];
    if (!newest) return;
    const id = String(newest._id);
    if (lastArrivalIdRef.current === null) {
      lastArrivalIdRef.current = id;
      return;
    }
    if (id === lastArrivalIdRef.current) return;
    lastArrivalIdRef.current = id;
    if (user && String(newest.user?._id) === user.uid) return;
    setPetArrivalPulse(p => p + 1);
  }, [messages, user]);

  useEffect(() => {
    messages.forEach(msg => {
      const burn = (msg as any).burnAfterReading;
      if (!burn?.burnStartedAt || burn.burned) return;
      const key = String(msg._id);
      if (burnTimersRef.current[key]) return;
      startBurnCountdown(msg._id, burn.duration, burn.burnStartedAt);
    });
  }, [messages, startBurnCountdown]);

  const renderBubble = useCallback((props: any) => {
    const {key: _key, ...bubbleProps} = props || {};
    const current = props?.currentMessage || {};
    const burn = current.burnAfterReading;
    const reactions: Record<string, string[]> = current.reactions || {};
    const reactionList = Object.entries(reactions).filter(([, users]) => users?.length);
    const isLastOutgoing =
      lastOutgoingMessageId && String(current._id) === String(lastOutgoingMessageId);
    const seen =
      isLastOutgoing &&
      otherLastReadAt > 0 &&
      (() => {
        const createdAt =
          current.createdAt instanceof Date
            ? current.createdAt.getTime()
            : new Date(current.createdAt).getTime();
        return createdAt <= otherLastReadAt;
      })();

    const isMine = user && current.user?._id === user.uid;
    const isSelected = msgSelectMode && msgSelected.has(String(current._id));

    if (burn?.burned) {
      return (
        <View style={styles.burnedContainer}>
          <Icon name="flame" size={14} color={colors.textSecondary} style={styles.burnedIcon} />
          <Text style={[styles.burnedText, {color: colors.textSecondary}]}>
            Message burned
          </Text>
        </View>
      );
    }

    const isBurnUnrevealed = burn && !burn.burnStartedAt && !isMine;
    const isBurnCountingDown =
      burn && burn.burnStartedAt && !burn.burned;
    const countdownKey = String(current._id);
    const countdown = burnCountdowns[countdownKey];

    if (isBurnUnrevealed) {
      return (
        <Pressable
          onPress={() => handleRevealBurnMessage(current)}
          style={[styles.burnOverlay, {backgroundColor: colors.surface, borderColor: colors.warning}]}>
          <Icon name="flame" size={24} color={colors.warning} style={styles.burnOverlayIcon} />
          <Text style={[styles.burnOverlayText, {color: colors.text}]}>
            Tap to reveal
          </Text>
          <Text style={[styles.burnOverlaySub, {color: colors.textSecondary}]}>
            Burns in {formatBurnDuration(burn.duration)}
          </Text>
        </Pressable>
      );
    }

    return (
      <SwipeToReply onReply={() => setReplyTo(current)} tintColor={colors.primary}>
        <View style={styles.bubbleWrapper}>
          {current.replyTo ? (
            <Pressable
              onPress={() => scrollToMessageId(current.replyTo._id)}
              style={[styles.replyPreview, {backgroundColor: colors.surface, borderLeftColor: colors.primary}]}>
              <Text style={[styles.replyName, {color: colors.primary}]}>
                {current.replyTo.user?.name || 'User'}
              </Text>
              <Text style={[styles.replyText, {color: colors.text}]} numberOfLines={1}>
                {getReplyPreviewText(current.replyTo)}
              </Text>
            </Pressable>
          ) : null}
          {current.forwarded ? (
            <View style={styles.forwardedLabel}>
              <Icon name="forward" size={11} color={colors.textSecondary} />
              <Text style={{color: colors.textSecondary, fontSize: 11, fontWeight: '600'}}>Forwarded</Text>
            </View>
          ) : null}
          {burn ? (
            <View style={styles.burnBubbleWrap}>
              <Bubble
                {...bubbleProps}
                wrapperStyle={{
                  right: {backgroundColor: isSelected ? colors.primary : colors.warning},
                  left: {backgroundColor: isSelected ? colors.primaryLight : colors.surface},
                }}
              />
              {isBurnCountingDown && countdown != null ? (
                <View style={styles.burnCountdownBar}>
                  <Icon name="flame" size={10} color="#FF6B35" style={styles.burnCountdownIcon} />
                  <View style={styles.burnCountdownTrack}>
                    <View
                      style={[
                        styles.burnCountdownFill,
                        {width: `${Math.max(0, (countdown / burn.duration) * 100)}%`},
                      ]}
                    />
                  </View>
                  <Text style={styles.burnCountdownText}>{countdown}s</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Bubble
              {...bubbleProps}
              wrapperStyle={{
                right: {backgroundColor: isSelected ? colors.primary : themeColor},
                left: {backgroundColor: isSelected ? colors.primaryLight : colors.surface},
              }}
            />
          )}
          {current.gif ? (
            <View style={[styles.gifCard, {borderColor: colors.border}]}>
              {(current.gif.mp4Url || current.gif.mp4PreviewUrl) ? (
                <Video
                  source={{uri: current.gif.mp4PreviewUrl || current.gif.mp4Url}}
                  style={[styles.gifImage, {
                    width: Math.min(current.gif.width || 220, 250),
                    height: Math.min(current.gif.height || 220, 200),
                  }]}
                  resizeMode="cover"
                  repeat
                  muted
                  paused={false}
                />
              ) : (
                <Image
                  source={{uri: current.gif.previewUrl || current.gif.url}}
                  style={[styles.gifImage, {
                    width: Math.min(current.gif.width || 220, 250),
                    height: Math.min(current.gif.height || 220, 200),
                  }]}
                  resizeMode="cover"
                />
              )}
            </View>
          ) : null}
          {current.timeCapsule && Date.now() < current.timeCapsule.unlocksAt ? (
            <View style={[styles.capsuleOverlay, {backgroundColor: colors.surface, borderColor: '#8B5CF6'}]}>
              <Icon name="timer" size={36} color="#8B5CF6" style={styles.capsuleIcon} />
              <Text style={[styles.capsuleTitle, {color: '#8B5CF6'}]}>Time Capsule</Text>
              <Text style={[styles.capsuleSub, {color: colors.textSecondary}]}>
                Opens {new Date(current.timeCapsule.unlocksAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
              </Text>
            </View>
          ) : null}
          {renderMomentCard(current.moment)}
          {renderAudioBubble(current)}
          {renderFileCard(current.file)}
          {renderLinkPreview(current.linkPreview)}
          {current.sharedList ? (
            <View style={[styles.sharedListCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <View style={styles.sharedListTitleRow}>
                <Icon name="list" size={14} color={colors.primary} />
                <Text style={[styles.sharedListTitle, {color: colors.primary}]}>
                  {current.sharedList.title}
                </Text>
              </View>
              {(current.sharedList.items || []).map((item: SharedListItem) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.sharedListItem}
                  onPress={() =>
                    handleToggleListItem(
                      current.sharedList.id,
                      current.sharedList.items,
                      item.id,
                    )
                  }>
                  <Icon name={item.checked ? 'checkSquare' : 'square'} size={16} color={colors.text} />
                  <Text
                    style={[
                      styles.sharedListItemText,
                      {color: colors.text},
                      item.checked && styles.sharedListItemChecked,
                    ]}>
                    {item.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {current.expense ? (
            <View style={[styles.expenseCard, {backgroundColor: colors.surface, borderColor: colors.primary}]}>
              <Icon name="wallet" size={20} color={colors.primary} style={styles.expenseCardIcon} />
              <Text style={[styles.expenseCardDesc, {color: colors.text}]}>
                {current.expense.description || 'Expense'}
              </Text>
              <Text style={[styles.expenseCardAmount, {color: colors.primary}]}>
                {current.expense.currency || ''} {(current.expense.amount ?? 0).toFixed(2)}
              </Text>
            </View>
          ) : null}
          {current.location ? (
            <View style={[styles.locationCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Icon name="pin" size={18} color={colors.text} />
              <Text style={[styles.locationText, {color: colors.text}]}>
                {current.location.address ||
                  `${current.location.latitude.toFixed(4)}, ${current.location.longitude.toFixed(4)}`}
              </Text>
              {current.location.isLive ? (
                <Text style={[styles.locationLive, {color: colors.success}]}>LIVE</Text>
              ) : null}
            </View>
          ) : null}
          {translatedTexts[String(current._id)] ? (
            <View style={[styles.translationCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <View style={styles.translationLabelRow}>
                <Icon name="globe" size={12} color={colors.textSecondary} />
                <Text style={[styles.translationLabel, {color: colors.textSecondary}]}>Translation</Text>
              </View>
              <Text style={[styles.translationText, {color: colors.text}]}>
                {translatedTexts[String(current._id)]}
              </Text>
            </View>
          ) : null}
          {(current as any).transcription ? (
            <View style={[styles.translationCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <View style={styles.translationLabelRow}>
                <Icon name="mic" size={12} color={colors.textSecondary} />
                <Text style={[styles.translationLabel, {color: colors.textSecondary}]}>Transcription</Text>
              </View>
              <Text style={[styles.translationText, {color: colors.text}]}>
                {(current as any).transcription}
              </Text>
            </View>
          ) : null}
          {SHOW_NATIVE_ONLY_FEATURES && contextCards[String(current._id)]?.map(card => (
            <TouchableOpacity
              key={card.id}
              activeOpacity={0.7}
              onPress={() => openExternal(card.url)}
              style={[styles.contextCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              {card.image ? (
                <Image source={{uri: card.image}} style={styles.contextCardImage} />
              ) : null}
              <View style={styles.contextCardBody}>
                <View style={styles.contextCardHeader}>
                  <Icon
                    name={
                      card.type === 'place'
                        ? 'pin'
                        : card.type === 'film'
                        ? 'play'
                        : card.type === 'person'
                        ? 'person'
                        : 'book'
                    }
                    size={11}
                    color={colors.primary}
                    style={styles.contextCardTypeIcon}
                  />
                  <Text style={[styles.contextCardType, {color: colors.primary}]}>
                    {card.type.charAt(0).toUpperCase() + card.type.slice(1)}
                  </Text>
                </View>
                <Text style={[styles.contextCardTitle, {color: colors.text}]} numberOfLines={1}>
                  {card.title}
                </Text>
                <Text style={[styles.contextCardDesc, {color: colors.textSecondary}]} numberOfLines={3}>
                  {card.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {current.gesture?.length ? (
            <View style={[styles.gestureCard, {borderColor: colors.border}]}>
              {current.gesture.map((stroke: GestureStroke, si: number) => (
                <View key={si}>
                  {stroke.points.map((pt, pi) => pi > 0 ? (
                    <View key={pi} style={{
                      position: 'absolute',
                      left: pt.x - 1,
                      top: pt.y - 1,
                      width: stroke.width,
                      height: stroke.width,
                      borderRadius: stroke.width / 2,
                      backgroundColor: stroke.color,
                    }} />
                  ) : null)}
                </View>
              ))}
            </View>
          ) : null}
          {current.lottery ? (
            <Pressable
              onPress={() => current.lottery.revealedIndex == null && revealLottery(current._id)}
              style={[styles.lotteryCard, {backgroundColor: colors.surface, borderColor: current.lottery.revealedIndex != null ? colors.success : '#F59E0B'}]}>
              <Icon
                name={current.lottery.revealedIndex != null ? 'sparkles' : 'gift'}
                size={28}
                color={current.lottery.revealedIndex != null ? colors.success : '#F59E0B'}
                style={styles.lotteryIcon}
              />
              {current.lottery.revealedIndex != null ? (
                <>
                  <Text style={[styles.lotteryRevealed, {color: colors.success}]}>
                    {current.lottery.options[current.lottery.revealedIndex]}
                  </Text>
                  <Text style={[styles.lotteryRevealedBy, {color: colors.textSecondary}]}>
                    Revealed by {current.lottery.revealedBy || 'someone'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.lotteryTitle, {color: colors.text}]}>Mystery Box</Text>
                  <Text style={[styles.lotteryHint, {color: colors.textSecondary}]}>
                    {current.lottery.options.length} options inside - tap to reveal!
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
          {current.anonymous ? (
            <View style={styles.anonymousBadge}>
              <Icon name="ghost" size={12} color="#AF52DE" />
              <Text style={styles.anonymousText}>Anonymous</Text>
            </View>
          ) : null}
          {current.reactionChain?.length ? (
            <View style={[styles.reactionChainRow, {backgroundColor: colors.surface}]}>
              <Text style={[styles.reactionChainLabel, {color: colors.textSecondary}]}>Story: </Text>
              {current.reactionChain.map((emoji: string, i: number) => (
                <Text key={i} style={styles.reactionChainEmoji}>{emoji}</Text>
              ))}
            </View>
          ) : null}
          {reactionList.length ? (
            <View style={styles.reactionsRow}>
              {reactionList.map(([emoji, users]) => (
                <View key={emoji} style={[styles.reactionChip, {backgroundColor: colors.surface}]}>
                  <Text style={[styles.reactionText, {color: colors.text}]}>
                    {emoji} {users.length}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {seen ? (
            <Text style={[styles.seenText, {color: colors.textSecondary}]}>Seen</Text>
          ) : null}
        </View>
      </SwipeToReply>
    );
  }, [colors, playingAudioId, lastOutgoingMessageId, otherLastReadAt, pinnedMessageIds, imageMessages, themeColor, scrollToMessageId, user, burnCountdowns, handleRevealBurnMessage, formatBurnDuration, translatedTexts, handleToggleListItem, contextCards, msgSelectMode, msgSelected]);

  // GiftedChat keys the accessory bar off whether this *prop is passed*, not off
  // what it returns: InputToolbar renders a fixed 44dp <View> around it, and
  // GiftedChat doubles minInputToolbarHeight (see calculateInputToolbarHeight).
  // Passing it unconditionally therefore parks an empty 44dp bar under the
  // composer forever. Gate at the call site instead — the guard below only
  // covers the render, not the reserved space.
  // `dictating` belongs here for a reason beyond tidiness: its only other
  // appearance is the Voice entry inside the attach sheet, which closes the
  // instant it is tapped. Recording therefore ran with the microphone live and
  // nothing on screen saying so, and the one control that stops it was behind a
  // sheet the user had no reason to reopen. Killing the app was the only exit.
  const hasAccessory = !!replyTo || burnMode || dictating;

  const renderAccessory = () => {
    if (!hasAccessory) {
      return null;
    }
    return (
      <View>
        {dictating ? (
          <View
            style={[
              styles.burnAccessoryBar,
              {backgroundColor: colors.surface, borderTopColor: colors.danger},
            ]}>
            <Icon name="mic" size={14} color={colors.danger} style={styles.burnAccessoryIcon} />
            <Text style={[styles.burnAccessoryText, {color: colors.danger}]}>
              {`Recording ${Math.floor(dictationSeconds / 60)}:${String(dictationSeconds % 60).padStart(2, '0')}`}
            </Text>
            <TouchableOpacity
              style={[styles.burnDurationButton, {marginLeft: 'auto'}]}
              onPress={stopDictation}>
              <Text style={[styles.burnDurationButtonText, {color: colors.danger}]}>Stop</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {burnMode ? (
          <View style={[styles.burnAccessoryBar, {backgroundColor: colors.surface, borderTopColor: colors.warning}]}>
            <Icon name="flame" size={14} color={colors.warning} style={styles.burnAccessoryIcon} />
            <Text style={styles.burnAccessoryText}>
              Burn after reading ({formatBurnDuration(burnDuration)})
            </Text>
            <TouchableOpacity
              style={styles.burnDurationButton}
              onPress={() => setBurnDurationPickerVisible(true)}>
              <Text style={styles.burnDurationButtonText}>
                {formatBurnDuration(burnDuration)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accessoryClose, {backgroundColor: colors.primaryLight, marginLeft: 4}]}
              onPress={() => setBurnMode(false)}>
              <Text style={[styles.accessoryCloseText, {color: colors.warning}]}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {replyTo ? (
          <View style={[styles.accessoryBar, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
            <View style={styles.accessoryTextWrap}>
              <Text style={[styles.accessoryTitle, {color: colors.primary}]}>
                Replying to
              </Text>
              <Text style={[styles.accessoryText, {color: colors.text}]} numberOfLines={1}>
                {`${replyTo?.user?.name || 'User'}: ${getReplyPreviewText(replyTo)}`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.accessoryClose, {backgroundColor: colors.border}]}
              onPress={() => {
                setReplyTo(null);
              }}>
              <Text style={[styles.accessoryCloseText, {color: colors.text}]}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  if (!chatUnlocked) {
    return (
      <GlassScreen style={styles.container} edges={NO_SAFE_AREA_EDGES} textureSeed={chatId}>
        <View style={styles.chatLockContainer}>
          <Icon name="lock" size={48} color={colors.text} style={styles.chatLockIcon} />
          <Text style={[styles.chatLockTitle, {color: colors.text}]}>Chat Locked</Text>
          <Text style={[styles.chatLockSubtitle, {color: colors.textSecondary}]}>Enter PIN to access this chat</Text>
          <TextInput
            style={[styles.chatLockInput, {color: colors.text, borderColor: colors.border}]}
            placeholder="Enter PIN"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            keyboardType="number-pad"
            value={chatPinInput}
            onChangeText={setChatPinInput}
          />
          <TouchableOpacity
            style={[styles.chatLockBtn, {backgroundColor: colors.primary}]}
            onPress={async () => {
              if (chatId && await verifyChatPIN(chatId, chatPinInput)) {
                setChatUnlocked(true);
                setChatPinInput('');
              } else {
                Alert.alert('Wrong PIN', 'The PIN you entered is incorrect.');
                setChatPinInput('');
              }
            }}>
            <Text style={styles.chatLockBtnText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </GlassScreen>
    );
  }

  /** Closes the attach sheet, then runs `action` once it is safely gone. */
  const closeAttachSheetThen = (action: () => void) => {
    if (Platform.OS === 'ios') {
      pendingAttachActionRef.current = action;
      setAttachSheetVisible(false);
      return;
    }
    // Android has no such presentation restriction, and its Modal never fires
    // onDismiss — deferring there would strand the action forever.
    setAttachSheetVisible(false);
    action();
  };

  return (
    // No safe-area edges: this screen sits between a native stack header and
    // the tab bar, and both already consume their inset. Neither React
    // Navigation stack nor bottom-tabs narrows SafeAreaInsetsContext for screen
    // content, so a SafeAreaView in here reads the *full* device inset and pads
    // a second time — which is what left a dead strip of backdrop between the
    // composer and the tab bar.
    <GlassScreen style={styles.container} edges={NO_SAFE_AREA_EDGES} showTexture={false}>
      {chatWallpaper ? (
        // Custom wallpapers are Storage download URLs (always start with
        // "http"); preset wallpapers are hex colors — same field
        // (wallpaperBy), distinguished by shape rather than a schema change.
        chatWallpaper.startsWith('http') ? (
          <Image
            source={{uri: chatWallpaper}}
            style={[StyleSheet.absoluteFill, {opacity: 0.4}]}
            resizeMode="cover"
          />
        ) : (
          <ThemeBackdrop accent={themeColor} tint={chatWallpaper} />
        )
      ) : null}
      {/* Above the wallpaper, below everything else: the sealed field this
          conversation was decrypted out of. See components/CipherTexture.tsx. */}
      <CipherTexture seed={chatId} color={colors.primary} />
      {/* The count is real — copies in the newest envelope, not a participant
          tally — so it stays honest when the two disagree. Hidden entirely
          when nothing is sealed rather than shown as "0 keys", which would
          read as a broken feature instead of an un-enrolled peer. */}
      {sealedKeys !== null ? (
        <View style={[styles.sealPill, {borderColor: colors.primary}]}>
          <Icon name="lock" size={9} color={colors.primary} />
          <Text style={[styles.sealPillText, {color: colors.primary}]}>
            {t('chat.sealedToKeys', {count: sealedKeys})}
          </Text>
        </View>
      ) : null}
      {incognitoMode ? (
        <View style={[styles.offlineBanner, {backgroundColor: '#1A1A2E'}]}>
          <Icon name="blocked" size={13} color="#111" />
          <Text style={styles.offlineText}>Incognito — no previews, no cache, no read receipts</Text>
        </View>
      ) : null}
      {isScreenshotProtectionEnabled() ? (
        <View style={[styles.offlineBanner, {backgroundColor: colors.success}]}>
          <Icon name="shield" size={13} color="#111" />
          <Text style={styles.offlineText}>Screenshot protection active</Text>
        </View>
      ) : null}
      {isOffline ? (
        <View style={[styles.offlineBanner, {backgroundColor: colors.warning}]}>
          <Text style={styles.offlineText}>Offline — messages will send when you're back online</Text>
        </View>
      ) : null}
      {peerDeleted ? (
        // A fixed slate rather than a palette token: styles.offlineText is
        // hard-coded to dark ink, so every banner background has to stay light
        // in dark mode too, and no neutral in the palette is light in both.
        <View style={[styles.offlineBanner, {backgroundColor: '#C7CDD6'}]}>
          <Icon name="blocked" size={13} color="#111" />
          <Text style={styles.offlineText}>{t('chat.recipientDeleted')}</Text>
        </View>
      ) : null}
      {peerKeyChanged && !peerDeleted ? (
        <TouchableOpacity
          style={[styles.offlineBanner, {backgroundColor: colors.danger}]}
          onPress={verifyContact}>
          <Icon name="alertTriangle" size={13} color="#111" />
          <Text style={styles.offlineText}>
            {otherUserName}'s security code changed. Tap to verify.
          </Text>
        </TouchableOpacity>
      ) : null}
      {sealedToOtherDevice && !peerDeleted ? (
        // The other half of "🔒 Sealed to another device". The bubble says what
        // happened; this says what to do about it. Deliberately not an Alert:
        // this is a standing condition for the whole thread, not an event, and
        // a modal over a conversation you cannot read is just a second thing
        // in the way.
        <TouchableOpacity
          style={[styles.offlineBanner, {backgroundColor: colors.warning}]}
          accessibilityRole="button"
          accessibilityLabel="Restore your encrypted message history"
          onPress={() => navigation.navigate('RecoveryPhrase')}>
          <Icon name="lock" size={13} color="#111" />
          <Text style={styles.offlineText}>
            Some messages were sealed on another device. Tap to restore with your recovery phrase.
          </Text>
        </TouchableOpacity>
      ) : null}
      {peerSessionReset && !peerDeleted ? (
        // A forward-secret session was replaced by the peer. Benign in the
        // common case (they reinstalled or switched devices) and serious in
        // the rare one (someone is impersonating them), and nothing available
        // here can tell the two apart — so it says exactly that, and points at
        // the one check that can: comparing the safety number out of band.
        <TouchableOpacity
          style={[styles.offlineBanner, {backgroundColor: colors.warning}]}
          accessibilityRole="button"
          accessibilityLabel="This contact's encryption session changed. Tap to verify."
          onPress={verifyContact}>
          <Icon name="lock" size={13} color="#111" />
          <Text style={styles.offlineText}>
            This contact's encryption session changed — usually a reinstall. Tap to verify their
            safety number.
          </Text>
        </TouchableOpacity>
      ) : null}
      {pinnedMessageIds.length ? (
        <Pressable
          style={[styles.pinnedBar, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}
          onPress={() => scrollToMessageId(pinnedMessageIds[0])}>
          <Text style={[styles.pinnedTitle, {color: colors.primary}]}>
            Pinned {pinnedMessageIds.length}
          </Text>
          <Text style={[styles.pinnedText, {color: colors.text}]} numberOfLines={1}>
            Tap to jump
          </Text>
        </Pressable>
      ) : null}
      {firstUnreadMessageId && !searchQuery ? (
        <Pressable
          style={[styles.unreadBar, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}
          onPress={() => scrollToMessageId(firstUnreadMessageId)}>
          <Text style={[styles.unreadTextBar, {color: colors.primary}]}>Jump to first unread</Text>
        </Pressable>
      ) : null}
      {showSearch ? (
        <View style={[styles.searchBar, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
          <TextInput
            style={[
              styles.searchInput,
              {backgroundColor: colors.background, borderColor: colors.glassBorder, color: colors.text},
            ]}
            placeholder="Search messages..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={[styles.searchClear, {color: colors.primary}]}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {SHOW_CHAT_PET && chatPet ? (() => {
        // Computed once here rather than three times inline below: health
        // decays continuously (see decayHealth), so re-deriving mood per icon
        // risked each one reading a subtly different instant.
        const livePetMood = calculatePetMood({...chatPet, health: decayHealth(chatPet)});
        return (
        <View ref={petWidgetRef} style={[styles.petWidget, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
          <PetAvatar
            species={chatPet.species}
            mood={livePetMood}
            feedPulse={petFeedPulse}
            arrivalPulse={petArrivalPulse}
            size={24}
            color={colors.text}
            style={styles.petAvatar}
          />
          <View style={styles.petInfo}>
            <Text style={[styles.petName, {color: colors.text}]}>{chatPet.name} Lv.{chatPet.level}</Text>
            <View style={[styles.petHealthBar, {backgroundColor: colors.border}]}>
              <View style={[styles.petHealthFill, {width: `${Math.max(0, Math.min(100, decayHealth(chatPet)))}%`, backgroundColor: decayHealth(chatPet) > 50 ? colors.success : decayHealth(chatPet) > 20 ? colors.warning : colors.danger}]} />
            </View>
          </View>
          <Icon
            name={
              livePetMood === 'happy'
                ? 'heartFilled'
                : livePetMood === 'neutral'
                ? 'faceNeutral'
                : livePetMood === 'sad'
                ? 'faceSad'
                : 'faceSleepy'
            }
            size={16}
            color={colors.text}
            style={styles.petMood}
          />
        </View>
        );
      })() : null}
      {msgSelectMode ? (
        <View style={[styles.msgSelectBar, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
          <TouchableOpacity onPress={exitMsgSelect} style={styles.msgSelectCancel}>
            <Text style={[styles.msgSelectCancelText, {color: colors.text}]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.msgSelectCount, {color: colors.text}]}>{msgSelected.size} selected</Text>
          <TouchableOpacity
            onPress={handleDeleteSelectedMsgs}
            disabled={msgSelected.size === 0}
            style={[styles.msgSelectDelete, {backgroundColor: colors.danger, opacity: msgSelected.size ? 1 : 0.4}]}>
            <Text style={styles.msgSelectDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {sharingLocation ? (
        <View style={[styles.locationBanner, {backgroundColor: colors.primary}]}>
          <View style={styles.locationBannerRow}>
            <Icon name="pin" size={14} color="#fff" />
            <Text style={styles.locationBannerText}>Sharing your location</Text>
          </View>
          <TouchableOpacity onPress={handleStopSharingLocation}>
            <Text style={styles.locationBannerStop}>Stop</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {peerLiveLocation?.position ? (
        <TouchableOpacity
          style={[styles.locationPreview, {backgroundColor: colors.surface, borderColor: colors.border}]}
          onPress={() => openInMaps(peerLiveLocation.position!.latitude, peerLiveLocation.position!.longitude)}>
          <Image
            source={{uri: staticMapTileUrl(peerLiveLocation.position.latitude, peerLiveLocation.position.longitude)}}
            style={styles.locationPreviewImage}
          />
          <View style={styles.locationPreviewInfo}>
            <View style={styles.locationBannerRow}>
              <Icon name="pin" size={13} color={colors.text} />
              <Text style={[styles.locationPreviewTitle, {color: colors.text}]}>Live location</Text>
            </View>
            <Text style={[styles.locationPreviewCoords, {color: colors.textSecondary}]}>
              {formatCoordinates(peerLiveLocation.position.latitude, peerLiveLocation.position.longitude)}
            </Text>
            <Text style={[styles.locationPreviewMeta, {color: colors.textSecondary}]}>
              Updated {Math.max(0, Math.round((Date.now() - peerLiveLocation.updatedAt) / 1000))}s ago · Open in Maps
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
      {/* Not gated on `inputText`, deliberately.
          Hiding this row while you typed unmounted it, and removing a view from
          this subtree made GiftedChat's thread resample: React Native renders
          an `inverted` FlatList as `transform: [{scaleY: -1}]`, so the thread is
          a GPU-composited layer, and re-compositing it left every message soft
          and washed out for exactly as long as you were typing — precisely when
          you most need to read the conversation you are replying to.
          Verified by bisection: keeping this row mounted, and separately
          dropping the transform with `inverted={false}`, each cleared it. This
          is the cheaper of the two — `inverted` also governs message order,
          scroll-to-bottom and loadEarlier paging. */}
      {smartReplies.length > 0 ? (
        <View style={styles.smartReplyRow}>
          {smartReplies.map((reply, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.smartReplyChip, {backgroundColor: colors.surface, borderColor: colors.border}]}
              onPress={() => onSend([{_id: Date.now(), text: reply, createdAt: new Date(), user: {_id: user?.uid || ''}}])}>
              <Text style={[styles.smartReplyText, {color: colors.primary}]}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {/* Keyboard avoidance: plain padding from `keyboardInset` (see above).
          GiftedChat's own handling is disabled via isKeyboardInternallyHandled
          below, and its input toolbar is not rendered at all — the composer is
          the sibling further down. */}
      <View style={[styles.chatFlex, keyboardInset ? {paddingBottom: keyboardInset} : null]}>
      {/* An overlay, not a flex sibling — and that is the point.
          The other banners above describe standing states (offline, incognito,
          a peer's key changing) and earning a row of their own is correct for
          them. Upload progress is transient and appears mid-conversation,
          typically while you carry on typing. As a sibling, its mount and
          unmount resized the thread, and resizing that subtree is exactly what
          made it resample and go soft — the same mechanism as the smart-reply
          row above, which is the bug you reported. Floating it over the thread
          leaves the thread's frame untouched for the whole upload, so there is
          nothing to re-composite. */}
      {uploading ? (
        <View
          pointerEvents="none"
          style={[
            styles.uploadBanner,
            {backgroundColor: colors.surface, borderBottomColor: colors.border},
          ]}>
          <Text style={[styles.uploadText, {color: colors.text}]}>
            {uploading.label} ({uploading.progress}%)
          </Text>
          <View style={[styles.uploadBar, {backgroundColor: colors.border}]}>
            <View style={[styles.uploadBarFill, {width: `${uploading.progress}%`, backgroundColor: colors.primary}]} />
          </View>
        </View>
      ) : null}
      <GiftedChat
        messages={filteredMessages}
        onSend={onSend}
        loadEarlier={hasMoreMessages}
        onLoadEarlier={loadEarlier}
        isLoadingEarlier={isLoadingEarlier}
        user={giftedUser}
        text={inputText}
        onInputTextChanged={handleComposerChange}
        // Replaces the composer outright rather than disabling it. A greyed-out
        // input still invites you to type something you can't send; a plain
        // statement of why the conversation is over does not. Returning null
        // from renderInputToolbar would leave a bare screen with no explanation.
        // GiftedChat renders the thread only; the composer lives outside it now.
        //
        // Bisection established that a plain TextInput placed directly in this
        // screen types perfectly (single-line *and* multiline), while the same
        // input inside GiftedChat's toolbar is dead. Rather than keep shaving
        // props off it, the composer is moved to the configuration that is
        // known to work: an ordinary child of this screen.
        renderInputToolbar={() => null}
        renderMessageImage={renderMessageImage}
        renderMessageVideo={renderMessageVideo}
        renderMessageAudio={renderMessageAudio}
        renderMessageText={renderMessageText}
        // Wrapped at the call site rather than inside renderBubble: that
        // function has several early returns (burned, unrevealed, media), and
        // one wrapper here covers every one of them without touching any.
        // A live "someone is typing" cue inside the thread. Until now this
        // only appeared in the navigation title, where it is easy to miss.
        renderFooter={() =>
          isTyping ? (
            <TypingDots
              color={colors.primary}
              accessibilityLabel={t('chat.isTyping', {name: otherUserName})}
            />
          ) : null
        }
        renderBubble={(props: any) => (
          <MessageEntrance mine={!!user && props?.currentMessage?.user?._id === user.uid}>
            {renderBubble(props)}
          </MessageEntrance>
        )}
        renderAccessory={hasAccessory ? renderAccessory : undefined}
        onLongPress={handleLongPress}
        onPress={(_: any, message: IMessage) => {
          if (msgSelectMode) toggleMsgSelect(String(message._id));
        }}
        renderTime={
          showTimestamps
            ? (props: any) => {
                const {key: _key, ...timeProps} = props || {};
                // Match the text's horizontal inset (styles.messageText), so
                // the timestamp lines up with the message above it instead of
                // sitting on GiftedChat's narrower default margin.
                const inset = {marginLeft: 14, marginRight: 14, marginBottom: 6};
                // Mono for the clock, matching the seal pill and the web
                // client's --cb-mono rule: technical metadata sets in mono, so
                // timestamps stop drifting in width between :11 and :44.
                const timeText = {left: styles.timeText, right: styles.timeText};
                return (
                  <Time
                    {...timeProps}
                    containerStyle={{left: inset, right: inset}}
                    timeTextStyle={timeText}
                  />
                );
              }
            : undefined
        }
        // GiftedChat's own keyboard handling is a legacy-era hand-roll: it
        // listens for keyboardWillShow and drives the message container's
        // height through component state, then wraps everything in a
        // KeyboardAvoidingView with no `behavior` — which on iOS does nothing
        // at all. That state churn lands in the middle of the keyboard
        // transition, and UIKit's text-insertion request goes unanswered
        // ("Result accumulator timeout: 0.250000, exceeded"), so keystrokes
        // reach the keyboard but never reach the field.
        //
        // Turning it off hands the job to the platform's KeyboardAvoidingView
        // below, which measures its own frame and therefore accounts for the
        // tab bar without being told about it.
        isKeyboardInternallyHandled={false}
        listViewProps={listViewProps}
        placeholder={t('chat.composerPlaceholder')}
        showUserAvatar
        alwaysShowSend
        textInputProps={{
          autoCorrect: !incognitoMode,
          autoComplete: incognitoMode ? 'off' : undefined,
          spellCheck: !incognitoMode,
        }}
      />
        {peerDeleted ? (
          <View
            style={[
              styles.deletedComposer,
              {backgroundColor: colors.surface, borderTopColor: colors.border},
            ]}>
            <Text style={[styles.deletedComposerText, {color: colors.textSecondary}]}>
              {t('chat.recipientDeletedComposer')}
            </Text>
          </View>
        ) : (
          <ChatInputToolbar
            surfaceColor={colors.surfaceStrong}
            baseColor={colors.backdrop}
            borderColor={colors.border}
            renderAccessory={hasAccessory ? renderAccessory : undefined}
            renderActions={renderActions}
            renderComposer={() => (
              <ChatComposer
                ref={composerRef}
                generation={composerGeneration}
                defaultValue={composerSeedRef.current}
                onChangeText={handleComposerChange}
                placeholder={t('chat.composerPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                textInputStyle={{color: colors.text}}
              />
            )}
            renderSend={() => (
              <TouchableOpacity
                style={styles.ownSend}
                disabled={!inputText.trim()}
                onPress={() =>
                  onSend([
                    {
                      _id: Date.now(),
                      text: inputText,
                      createdAt: new Date(),
                      user: {_id: user?.uid || ''},
                    } as IMessage,
                  ])
                }>
                <Text
                  style={[
                    styles.ownSendText,
                    {color: inputText.trim() ? colors.primary : colors.textSecondary},
                  ]}>
                  {t('common.send')}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      {/* Overlays the whole screen, so particles aren't clipped by the
          message list the way an in-bubble animation would be. */}
      <ReactionBurst bursts={bursts} onDone={burstDone} />
      <FanOutBloom blooms={blooms} onDone={bloomDone} color={colors.primary} />
      <ReactionArc
        visible={!!arcTarget}
        emojis={EMOJI_OPTIONS}
        surfaceColor={colors.surfaceStrong}
        onSelect={emoji => {
          if (!chatId || !user || !arcTarget) return;
          toggleReaction(chatId, arcTarget._id, emoji, user.uid);
          burstAtSheet(emoji);
        }}
        onClose={() => setArcTarget(null)}
      />
      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        message={sheet?.message}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
      {forwardTarget && user && (
        <ChatPickerModal
          myUid={user.uid}
          title="Forward to..."
          onPick={handleForwardPick}
          onClose={() => setForwardTarget(null)}
        />
      )}
      {recordModalVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setRecordModalVisible(false)}>
          <View style={styles.previewBackdrop}>
            <View style={[styles.recordModal, {backgroundColor: colors.background}]}>
              <Text style={styles.recordTitle}>
                {recording ? 'Recording...' : 'Voice Message'}
              </Text>
            <Text style={[styles.recordTimer, {color: colors.textSecondary}]}>
              {recordedDuration ? `${recordedDuration}s` : '0s'}
            </Text>
            <View style={styles.recordActions}>
              {!recording ? (
                <TouchableOpacity style={[styles.recordButton, {backgroundColor: colors.primary}]} onPress={startRecording}>
                  <Text style={styles.recordButtonText}>Record</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.recordButton, {backgroundColor: colors.primary}]} onPress={stopRecording}>
                  <Text style={styles.recordButtonText}>Stop</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  {backgroundColor: colors.primary},
                  !recordedUri && styles.recordButtonDisabled,
                ]}
                onPress={sendRecording}
                disabled={!recordedUri}>
                <Text style={styles.recordButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
            {SHOW_NATIVE_ONLY_FEATURES && (
            <View style={styles.smartReplyRow}>
              {(['none', 'chipmunk', 'deep', 'echo', 'robot', 'whisper'] as VoiceFilter[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.smartReplyChip, {
                    backgroundColor: voiceFilter === f ? colors.primary : colors.surface,
                    borderColor: voiceFilter === f ? colors.primary : colors.border,
                  }]}
                  onPress={() => setVoiceFilter(f)}>
                  <Text style={[styles.smartReplyText, {color: voiceFilter === f ? '#fff' : colors.text}]}>
                    {f === 'none' ? 'Normal' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            )}
            <TouchableOpacity
              style={styles.recordCancel}
              onPress={() => {
                if (recording) {
                  stopRecording();
                }
                setRecordModalVisible(false);
                setRecording(false);
                setRecordedUri(null);
                setRecordedDuration(null);
                setVoiceFilter('none');
              }}>
              <Text style={[styles.recordCancelText, {color: colors.primary}]}>Cancel</Text>
            </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {nameModalVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setNameModalVisible(false)}>
        <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>Edit Recipient Name</Text>
          <TextInput
            style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
            value={customName}
            onChangeText={setCustomName}
            placeholder="Enter a custom name"
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.primary}]}
              onPress={handleSaveCustomName}>
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.surface}]}
              onPress={() => setNameModalVisible(false)}>
              <Text style={[styles.modalButtonText, {color: colors.text}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.clearNameButton, {borderColor: colors.glassBorder}]}
            onPress={() => setCustomName('')}>
            <Text style={[styles.clearNameText, {color: colors.textSecondary}]}>Clear name</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      )}
      {attachSheetVisible && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setAttachSheetVisible(false)}
          onDismiss={() => {
            const action = pendingAttachActionRef.current;
            pendingAttachActionRef.current = null;
            action?.();
          }}>
          <Pressable style={styles.actionSheetBackdrop} onPress={() => setAttachSheetVisible(false)}>
            <Pressable style={[styles.attachSheet, {backgroundColor: colors.background}]} onPress={e => e.stopPropagation()}>
              <View style={[styles.attachSheetHandle, {backgroundColor: colors.border}]} />
              <Text style={[styles.attachSheetTitle, {color: colors.text}]}>Attach & style</Text>
              <ScrollView style={styles.attachSheetScroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.attachSectionLabel, {color: colors.textSecondary}]}>Media</Text>
                <View style={styles.attachSectionRow}>
                  <TouchableOpacity style={[styles.attachOption, {backgroundColor: colors.surface}]} onPress={() => closeAttachSheetThen(handlePickMedia)}>
                    <Icon name="camera" size={22} color={colors.text} style={styles.attachOptionIcon} />
                    <Text style={[styles.attachOptionText, {color: colors.text}]}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, {backgroundColor: colors.surface}]} onPress={() => closeAttachSheetThen(() => { setGifPickerVisible(true); loadTrendingGifs(); })}>
                    <Text style={styles.attachOptionIcon}>GIF</Text>
                    <Text style={[styles.attachOptionText, {color: colors.text}]}>GIF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, {backgroundColor: colors.surface}]} onPress={() => closeAttachSheetThen(() => { dictating ? stopDictation() : startDictation(); })}>
                    <Icon name="mic" size={22} color={colors.text} style={styles.attachOptionIcon} />
                    <Text style={[styles.attachOptionText, {color: colors.text}]}>{dictating ? 'Stop' : 'Voice'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.attachOption, sharingLocation && {backgroundColor: colors.primary}]}
                    onPress={() => closeAttachSheetThen(() => { sharingLocation ? handleStopSharingLocation() : handleShareLocation(); })}>
                    <Icon name="pin" size={22} color={sharingLocation ? '#fff' : colors.text} style={styles.attachOptionIcon} />
                    <Text style={[styles.attachOptionText, {color: sharingLocation ? '#fff' : colors.text}]}>{sharingLocation ? 'Stop' : 'Location'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.attachSectionLabel, {color: colors.textSecondary}]}>Message style</Text>
                <View style={styles.attachSectionRow}>
                  {SHOW_NATIVE_ONLY_FEATURES && (
                    <>
                  <TouchableOpacity style={[styles.attachOption, timeCapsuleMode && {backgroundColor: '#8B5CF6'}]} onPress={() => { setTimeCapsuleMode(prev => !prev); }} onLongPress={() => setCapsulePickerVisible(true)}>
                    <Icon name="timer" size={22} color={timeCapsuleMode ? '#fff' : colors.text} style={styles.attachOptionIcon} />
                    <Text style={[styles.attachOptionText, {color: timeCapsuleMode ? '#fff' : colors.text}]}>Timer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, invisibleInkMode && {backgroundColor: '#6366F1'}]} onPress={() => setInvisibleInkMode(prev => !prev)}>
                    <Icon name="droplet" size={22} color={invisibleInkMode ? '#fff' : colors.text} style={styles.attachOptionIcon} />
                    <Text style={[styles.attachOptionText, {color: invisibleInkMode ? '#fff' : colors.text}]}>Invisible</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, messageStyle !== 'none' && {backgroundColor: '#EC4899'}]} onPress={() => closeAttachSheetThen(() => setStylePickerVisible(true))}>
                    <Text style={[styles.attachOptionIcon, messageStyle !== 'none' && {color: '#fff'}]}>Aa</Text>
                    <Text style={[styles.attachOptionText, {color: messageStyle !== 'none' ? '#fff' : colors.text}]}>Style</Text>
                  </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={[styles.attachOption, burnMode && {backgroundColor: colors.warning}]} onPress={() => setBurnMode(prev => !prev)} onLongPress={() => setBurnDurationPickerVisible(true)}>
                    <Icon name="flame" size={22} color={burnMode ? colors.textOnPrimary : colors.text} style={styles.attachOptionIcon} />
                    <Text style={[styles.attachOptionText, {color: burnMode ? colors.textOnPrimary : colors.text}]}>Burn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, viewOnceMode && {backgroundColor: '#10B981'}]} onPress={() => setViewOnceMode(prev => !prev)}>
                    <Icon name="eye" size={22} color={viewOnceMode ? '#fff' : colors.text} style={styles.attachOptionIcon} />
                    <Text style={[styles.attachOptionText, {color: viewOnceMode ? '#fff' : colors.text}]}>View Once</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {actionsModalVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActionsModalVisible(false)}>
        <Pressable style={styles.actionSheetBackdrop} onPress={() => setActionsModalVisible(false)}>
          <View style={[styles.actionSheet, styles.actionSheetScrollable, {backgroundColor: colors.background}]}>
            <Text style={[styles.actionSheetTitle, {color: colors.text}]}>Chat Actions</Text>
            <ScrollView style={styles.actionSheetScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>View</Text>
              <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setShowTimestamps(prev => !prev);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>
                {showTimestamps ? 'Hide Timestamps' : 'Show Timestamps'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('ChatMedia', {chatId});
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setNameModalVisible(true);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Rename</Text>
            </TouchableOpacity>
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>Call</Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                startCall('voice');
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Voice Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                startCall('video');
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Video Call</Text>
            </TouchableOpacity>
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>Tools</Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setSchedulePickerVisible(true);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>
                Schedule Message {scheduledCount > 0 ? `(${scheduledCount})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setListModalVisible(true);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Create Shared List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setSummaryQuestion('');
                handleSummarize();
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Catch Up (AI Summary)</Text>
            </TouchableOpacity>
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>Activities</Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('Whiteboard', {chatId});
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Whiteboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('Playlist', {chatId});
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('Countdown', {chatId});
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Countdowns</Text>
            </TouchableOpacity>
            {SHOW_NATIVE_ONLY_FEATURES && (
              <>
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>Privacy</Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setAnonymousMode(prev => !prev);
              }}>
              <Text style={[styles.actionSheetText, {color: anonymousMode ? '#AF52DE' : colors.text}]}>
                {anonymousMode ? 'Anonymous ON' : 'Anonymous'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setIncognitoMode(prev => !prev);
              }}>
              <Text style={[styles.actionSheetText, {color: incognitoMode ? colors.success : colors.text}]}>
                {incognitoMode ? 'Incognito ON' : 'Incognito'}
              </Text>
            </TouchableOpacity>
            {otherUserId && user ? (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  setActionsModalVisible(false);
                  verifyContact();
                }}>
                <Text style={[styles.actionSheetText, {color: colors.text}]}>Verify Contact</Text>
              </TouchableOpacity>
            ) : null}
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>Special</Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setGestureMode(true);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Gesture Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setLotteryModalVisible(true);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Mystery Box</Text>
            </TouchableOpacity>
              </>
            )}
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>Settings</Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('RecentlyDeleted', {chatId});
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>{t('trash.title')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('ChatSettings', {chatId});
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Chat Settings</Text>
            </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity
              style={[styles.actionSheetItem, styles.actionSheetCancel]}
              onPress={() => setActionsModalVisible(false)}>
              <Text style={[styles.actionSheetText, {color: colors.textSecondary}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      )}
      {gifPickerVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setGifPickerVisible(false)}>
          <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>GIFs</Text>
          <TextInput
            style={[styles.gifSearchInput, {color: colors.text, borderColor: colors.glassBorder, backgroundColor: colors.surface}]}
            value={gifSearch}
            onChangeText={handleGifSearch}
            placeholder="Search GIFs..."
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
          />
          {gifLoading ? (
            <View style={styles.gifLoading}>
              <Text style={[styles.gifLoadingText, {color: colors.textSecondary}]}>Loading...</Text>
            </View>
          ) : (
            <FlatList
              data={gifResults}
              numColumns={2}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.gifGrid}
              columnWrapperStyle={styles.gifRow}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[styles.gifItem, {backgroundColor: colors.surface}]}
                  onPress={() => handleSendGif(item)}>
                  {item.mp4PreviewUrl ? (
                    <Video
                      source={{uri: item.mp4PreviewUrl}}
                      style={styles.gifPreview}
                      resizeMode="cover"
                      repeat
                      muted
                      paused={false}
                    />
                  ) : (
                    <Image
                      source={{uri: item.previewUrl}}
                      style={styles.gifPreview}
                      resizeMode="cover"
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.gifEmptyText, {color: colors.textSecondary}]}>No GIFs found</Text>
              }
            />
          )}
          <TouchableOpacity
            style={[styles.modalButton, {backgroundColor: colors.surface, marginTop: 10}]}
            onPress={() => { setGifPickerVisible(false); setGifSearch(''); }}>
            <Text style={[styles.modalButtonText, {color: colors.text}]}>Close</Text>
          </TouchableOpacity>
          </View>
        </Modal>
      )}
      {capsulePickerVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setCapsulePickerVisible(false)}>
          <Pressable style={styles.actionSheetBackdrop} onPress={() => setCapsulePickerVisible(false)}>
            <View style={[styles.actionSheet, {backgroundColor: colors.background}]}>
              <Text style={[styles.actionSheetTitle, {color: colors.text}]}>Time Capsule Duration</Text>
              {[
                {label: '1 hour', hours: 1},
                {label: '6 hours', hours: 6},
                {label: '12 hours', hours: 12},
                {label: '1 day', hours: 24},
                {label: '3 days', hours: 72},
                {label: '1 week', hours: 168},
                {label: '1 month', hours: 720},
              ].map(opt => (
                <TouchableOpacity
                  key={opt.hours}
                  style={styles.actionSheetItem}
                  onPress={() => {
                    setCapsuleHours(opt.hours);
                    setTimeCapsuleMode(true);
                    setCapsulePickerVisible(false);
                  }}>
                  <Text style={[
                    styles.actionSheetText,
                    {color: capsuleHours === opt.hours ? '#8B5CF6' : colors.text},
                    capsuleHours === opt.hours && {fontWeight: '700'},
                  ]}>
                    {opt.label} {capsuleHours === opt.hours ? '  \u2713' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.actionSheetItem, styles.actionSheetCancel]}
                onPress={() => setCapsulePickerVisible(false)}>
                <Text style={[styles.actionSheetText, {color: colors.textSecondary}]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
      {imageViewerVisible && (
        <ImageViewing
          images={imageMessages}
          imageIndex={imageViewerIndex}
          visible
          onRequestClose={() => setImageViewerVisible(false)}
          swipeToCloseEnabled
        />
      )}
      {preview && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreview(null)}>
          <View style={styles.previewBackdrop}>
            <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
              {preview.type === 'image' ? (
                <Image source={{uri: preview.uri}} style={styles.previewImage} resizeMode="contain" />
              ) : (
                <Video source={{uri: preview.uri}} style={styles.previewVideo} resizeMode="contain" controls />
              )}
            </Pressable>
          </View>
        </Modal>
      )}
      {burnDurationPickerVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setBurnDurationPickerVisible(false)}>
          <Pressable
            style={styles.burnPickerBackdrop}
            onPress={() => setBurnDurationPickerVisible(false)}>
            <View style={[styles.burnPickerSheet, {backgroundColor: colors.background}]}>
              <Text style={[styles.burnPickerTitle, {color: colors.text}]}>
                Burn Timer
              </Text>
              <Text style={[styles.burnPickerSub, {color: colors.textSecondary}]}>
                Message will be destroyed after being read
              </Text>
              {BURN_DURATIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.burnPickerOption,
                    burnDuration === d && styles.burnPickerOptionActive,
                    {borderColor: colors.border},
                  ]}
                  onPress={() => {
                    setBurnDuration(d);
                    setBurnDurationPickerVisible(false);
                  }}>
                  <Text
                    style={[
                      styles.burnPickerOptionText,
                      {color: burnDuration === d ? colors.warning : colors.text},
                    ]}>
                    {formatBurnDuration(d)}
                  </Text>
                  {burnDuration === d ? (
                    <Icon name="check" size={16} color="#FF6B35" />
                  ) : null}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.burnPickerCancel}
                onPress={() => setBurnDurationPickerVisible(false)}>
                <Text style={[styles.burnPickerCancelText, {color: colors.primary}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      {schedulePickerVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSchedulePickerVisible(false)}>
          <Pressable
            style={styles.burnPickerBackdrop}
            onPress={() => setSchedulePickerVisible(false)}>
            <View style={[styles.burnPickerSheet, {backgroundColor: colors.background}]}>
              <Text style={[styles.burnPickerTitle, {color: colors.text}]}>
                Schedule Message
              </Text>
              <Text style={[styles.burnPickerSub, {color: colors.textSecondary}]}>
                Send in how many minutes?
              </Text>
              <TextInput
                style={[styles.scheduleInput, {color: colors.text, borderColor: colors.glassBorder}]}
                value={scheduleMinutes}
                onChangeText={setScheduleMinutes}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor={colors.textSecondary}
              />
              <View style={styles.schedulePresets}>
                {[5, 15, 30, 60, 120].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.schedulePreset, {borderColor: colors.border}]}
                    onPress={() => setScheduleMinutes(String(m))}>
                    <Text style={[styles.schedulePresetText, {color: colors.text}]}>
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.scheduleButton, {backgroundColor: colors.primary}]}
                onPress={handleScheduleSend}>
                <Text style={styles.scheduleButtonText}>Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.burnPickerCancel}
                onPress={() => setSchedulePickerVisible(false)}>
                <Text style={[styles.burnPickerCancelText, {color: colors.primary}]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      {listModalVisible && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setListModalVisible(false)}>
          <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>Create Shared List</Text>
            <TextInput
              style={[styles.listTitleInput, {color: colors.text, borderColor: colors.glassBorder}]}
              value={listTitle}
              onChangeText={setListTitle}
              placeholder="List title"
              placeholderTextColor={colors.textSecondary}
            />
            {listItems.map((item, idx) => (
              <View key={idx} style={styles.listItemInputRow}>
                <TextInput
                  style={[styles.listItemInput, {color: colors.text, borderColor: colors.glassBorder}]}
                  value={item}
                  onChangeText={text => {
                    const updated = [...listItems];
                    updated[idx] = text;
                    setListItems(updated);
                  }}
                  placeholder={`Item ${idx + 1}`}
                  placeholderTextColor={colors.textSecondary}
                />
                {listItems.length > 1 && (
                  <TouchableOpacity onPress={() => setListItems(prev => prev.filter((_, i) => i !== idx))}>
                    <Text style={[styles.listItemRemove, {color: colors.danger}]}>x</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={[styles.listAddBtn, {borderColor: colors.border}]}
              onPress={() => setListItems(prev => [...prev, ''])}>
              <Text style={[styles.listAddText, {color: colors.primary}]}>+ Add Item</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={handleCreateList}>
                <Text style={styles.modalButtonText}>Create List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setListModalVisible(false)}>
                <Text style={[styles.modalButtonText, {color: colors.text}]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {summaryModalVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSummaryModalVisible(false)}>
          <Pressable
            style={styles.burnPickerBackdrop}
            onPress={() => setSummaryModalVisible(false)}>
            <View style={[styles.summarySheet, {backgroundColor: colors.background}]}>
              <Text style={[styles.summarySheetTitle, {color: colors.text}]}>
                {summaryAskedQuestion ? `Re: "${summaryAskedQuestion}"` : 'Chat Summary'}
              </Text>
              {summaryLoading ? (
                <Text style={[styles.summaryLoading, {color: colors.textSecondary}]}>
                  {summaryAskedQuestion ? 'Searching this chat...' : 'Generating summary...'}
                </Text>
              ) : (
                <Text style={[styles.summaryBody, {color: colors.text}]}>{summaryText}</Text>
              )}
              <TextInput
                style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder, minHeight: 44}]}
                placeholder="Ask about this chat (e.g. what did we decide about the trip?)"
                placeholderTextColor={colors.textSecondary}
                value={summaryQuestion}
                onChangeText={setSummaryQuestion}
                editable={!summaryLoading}
              />
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}, summaryLoading && {opacity: 0.5}]}
                disabled={summaryLoading}
                onPress={() => handleSummarize(summaryQuestion)}>
                {summaryLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>{summaryQuestion.trim() ? 'Ask' : 'Regenerate Summary'}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.burnPickerCancel}
                onPress={() => setSummaryModalVisible(false)}>
                <Text style={[styles.burnPickerCancelText, {color: colors.primary}]}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
      {stylePickerVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setStylePickerVisible(false)}>
          <Pressable style={styles.burnPickerBackdrop} onPress={() => setStylePickerVisible(false)}>
            <View style={[styles.summarySheet, {backgroundColor: colors.background}]}>
              <Text style={[styles.summarySheetTitle, {color: colors.text}]}>Message Style</Text>
              {(['none', 'neon', 'handwriting', 'gradient', 'typewriter', 'bounce'] as MessageStyle[]).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.actionSheetItem, messageStyle === s && {backgroundColor: colors.primary + '20'}]}
                  onPress={() => { setMessageStyle(s); setStylePickerVisible(false); }}>
                  <Text style={[
                    styles.actionSheetText,
                    {color: messageStyle === s ? colors.primary : colors.text},
                    s === 'neon' && {color: '#0FF', fontWeight: '700'},
                    s === 'handwriting' && {fontStyle: 'italic'},
                    s === 'gradient' && {color: '#EC4899', fontWeight: '800'},
                    s === 'typewriter' && {fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'},
                    s === 'bounce' && {fontWeight: '800'},
                  ]}>
                    {s === 'none' ? 'Normal' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}
      {gestureMode && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setGestureMode(false)}>
          <View style={[styles.gestureModal, {backgroundColor: colors.background}]}>
            <View style={styles.gestureHeader}>
              <TouchableOpacity onPress={() => setGestureMode(false)}>
                <Text style={[styles.gestureHeaderBtn, {color: colors.danger}]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.gestureHeaderTitle, {color: colors.text}]}>Draw a Gesture</Text>
              <TouchableOpacity onPress={sendGestureMessage}>
                <Text style={[styles.gestureHeaderBtn, {color: colors.primary}]}>Send</Text>
              </TouchableOpacity>
            </View>
            <View
              style={[styles.gestureCanvas, {borderColor: colors.border}]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                const {locationX, locationY} = e.nativeEvent;
                setCurrentStroke({color: colors.primary, width: 3, points: [{x: locationX, y: locationY}]});
              }}
              onResponderMove={(e) => {
                const {locationX, locationY} = e.nativeEvent;
                setCurrentStroke(prev => prev ? {...prev, points: [...prev.points, {x: locationX, y: locationY}]} : prev);
              }}
              onResponderRelease={() => {
                if (currentStroke && currentStroke.points.length > 1) {
                  setGestureStrokes(prev => [...prev, currentStroke]);
                }
                setCurrentStroke(null);
              }}>
              {[...gestureStrokes, ...(currentStroke ? [currentStroke] : [])].map((stroke, si) =>
                stroke.points.map((pt, pi) => pi > 0 ? (
                  <View key={`${si}-${pi}`} style={{
                    position: 'absolute', left: pt.x - 1.5, top: pt.y - 1.5,
                    width: stroke.width, height: stroke.width,
                    borderRadius: stroke.width / 2, backgroundColor: stroke.color,
                  }} />
                ) : null)
              )}
            </View>
            <TouchableOpacity style={styles.gestureClearBtn} onPress={() => setGestureStrokes([])}>
              <Text style={[styles.gestureClearText, {color: colors.textSecondary}]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
      {lotteryModalVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLotteryModalVisible(false)}>
          <Pressable style={styles.burnPickerBackdrop} onPress={() => setLotteryModalVisible(false)}>
            <View style={[styles.summarySheet, {backgroundColor: colors.background}]}>
              <View style={styles.summarySheetTitleRow}>
                <Icon name="gift" size={18} color={colors.text} />
                <Text style={[styles.summarySheetTitle, {color: colors.text, marginBottom: 0}]}>
                  Mystery Box
                </Text>
              </View>
              <Text style={[{color: colors.textSecondary, fontSize: 13, marginBottom: 12}]}>
                Add 2+ options. The recipient randomly reveals one!
              </Text>
              {lotteryOptions.map((opt, i) => (
                <TextInput
                  key={i}
                  style={[styles.scheduleInput, {color: colors.text, borderColor: colors.border, marginBottom: 8}]}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={colors.textSecondary}
                  value={opt}
                  onChangeText={(val) => setLotteryOptions(prev => { const n = [...prev]; n[i] = val; return n; })}
                />
              ))}
              <TouchableOpacity
                onPress={() => setLotteryOptions(prev => [...prev, ''])}
                style={{marginBottom: 12}}>
                <Text style={{color: colors.primary, fontWeight: '600'}}>+ Add option</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.burnPickerOption, {backgroundColor: colors.primary}]}
                onPress={sendLotteryMessage}>
                <Text style={{color: '#fff', fontWeight: '700', textAlign: 'center'}}>Send Mystery Box</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  chatFlex: {flex: 1},
  ownSend: {paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center'},
  ownSendText: {fontSize: 16, fontWeight: '700'},
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  offlineBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  // Deliberately not an offlineBanner: those are full-width, filled, and
  // demand attention because each reports something wrong. This reports
  // something *right*, so it sits quietly — a hairline pill, self-sized,
  // stating the fan-out width rather than warning about it.
  sealPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 9,
    marginTop: 6,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timeText: {
    fontFamily: fonts.mono.regular,
  },
  sealPillText: {
    fontFamily: fonts.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  offlineText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  deletedComposer: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deletedComposerText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  uploadBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    // Floats over the top of the thread. With an inverted list the newest
    // messages sit at the *bottom*, so this covers the oldest rows on screen
    // rather than the ones being written — and only for the length of an
    // upload. zIndex because it is declared before the list it covers.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  uploadText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  uploadBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  uploadBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 0,
  },
  searchClear: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  bubbleWrapper: {
    flex: 1,
  },
  forwardedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  replyPreview: {
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    maxWidth: 260,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    lineHeight: 16,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginLeft: 6,
    gap: 4,
  },
  reactionChip: {
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  seenText: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 6,
  },
  pinnedBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  pinnedTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  pinnedText: {
    fontSize: 12,
  },
  unreadBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  unreadTextBar: {
    fontSize: 12,
    fontWeight: '600',
  },
  fileCard: {
    marginTop: 6,
    borderRadius: 14,
    padding: 14,
    maxWidth: 260,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
  },
  fileMeta: {
    marginTop: 3,
    fontSize: 12,
  },
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  audioIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  audioText: {
    fontSize: 13,
  },
  linkPreview: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
    maxWidth: 260,
  },
  linkImage: {
    width: '100%',
    height: 120,
  },
  linkTextWrap: {
    padding: 10,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  linkDescription: {
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 16,
  },
  linkUrl: {
    fontSize: 12,
  },
  messageText: {
    fontFamily: fonts.body.regular,
    fontSize: 16,
    lineHeight: 22,
    // GiftedChat's stock MessageText supplies its own inset, but a custom
    // renderMessageText replaces that component outright — so without this the
    // text sat flush against the bubble edge on both platforms.
    // Bottom is lighter than top because the timestamp sits underneath and
    // carries its own margin.
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 3,
  },
  momentCard: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    maxWidth: 260,
    overflow: 'hidden',
  },
  momentTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  momentText: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  momentMedia: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  accessoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accessoryTextWrap: {
    flex: 1,
  },
  accessoryTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  accessoryText: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  accessoryClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  accessoryCloseText: {
    fontSize: 18,
    fontWeight: '600',
  },
  recordModal: {
    width: '85%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  clearNameButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearNameText: {
    fontSize: 13,
  },
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  actionSheet: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  actionSheetItem: {
    paddingVertical: 14,
  },
  actionSheetText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionSheetCancel: {
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 14,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  recordTimer: {
    fontSize: 15,
    marginBottom: 20,
  },
  recordActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  recordButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  recordButtonDisabled: {
    opacity: 0.5,
  },
  recordButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  recordCancel: {
    marginTop: 4,
  },
  recordCancelText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  videoBubble: {
    width: 200,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  videoOverlayText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
  videoDurationText: {
    marginTop: 6,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '90%',
    height: '80%',
  },
  previewVideo: {
    width: '90%',
    height: '80%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  burnToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginBottom: 4,
  },
  burnToggleIcon: {
    fontSize: 16,
  },
  burnAccessoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  burnAccessoryIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  burnAccessoryText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  burnDurationButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  burnDurationButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  burnedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginVertical: 2,
  },
  burnedIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  burnedText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  burnOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 2,
    minWidth: 160,
  },
  burnOverlayIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  burnOverlayText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  burnOverlaySub: {
    fontSize: 11,
  },
  burnBubbleWrap: {
    position: 'relative',
  },
  burnCountdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 4,
  },
  burnCountdownIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  burnCountdownTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD5C2',
    overflow: 'hidden',
  },
  burnCountdownFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  burnCountdownText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF6B35',
    marginLeft: 4,
    minWidth: 28,
    textAlign: 'right',
  },
  burnPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  burnPickerSheet: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  burnPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  burnPickerSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  burnPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  burnPickerOptionActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3ED',
  },
  burnPickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  burnPickerCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  burnPickerCancel: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  burnPickerCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sharedListCard: {
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  sharedListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sharedListTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sharedListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  sharedListCheck: {
    fontSize: 16,
  },
  sharedListItemText: {
    fontSize: 14,
    flex: 1,
  },
  sharedListItemChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  expenseCard: {
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  expenseCardIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  expenseCardDesc: {
    fontSize: 14,
    fontWeight: '600',
  },
  expenseCardAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  locationCard: {
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationIcon: {
    fontSize: 18,
  },
  locationText: {
    fontSize: 13,
    flex: 1,
  },
  locationLive: {
    fontSize: 11,
    fontWeight: '800',
  },
  translationCard: {
    marginTop: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  translationLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  translationLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  translationText: {
    fontSize: 14,
  },
  contextCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 6,
    marginHorizontal: 4,
    maxWidth: 280,
  },
  contextCardImage: {
    width: 70,
    height: '100%' as any,
    minHeight: 70,
  },
  contextCardBody: {
    flex: 1,
    padding: 8,
  },
  contextCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  contextCardTypeIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  contextCardType: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  contextCardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  scheduleInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  schedulePresets: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  schedulePreset: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  schedulePresetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  scheduleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  listTitleInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  listItemInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  listItemInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  listItemRemove: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  listAddBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  listAddText: {
    fontSize: 15,
    fontWeight: '600',
  },
  summarySheet: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 16,
    padding: 20,
  },
  summarySheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  summarySheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryLoading: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 15,
  },
  summaryBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  smallActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallActionIcon: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
  },
  gifCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  gifImage: {
    borderRadius: 12,
  },
  gifSearchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  gifGrid: {
    paddingBottom: 20,
  },
  gifRow: {
    gap: 8,
  },
  gifItem: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gifPreview: {
    width: '100%',
    height: 130,
  },
  gifLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifLoadingText: {
    fontSize: 15,
  },
  gifEmptyText: {
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 15,
  },
  capsuleOverlay: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  capsuleIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  capsuleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  capsuleSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  petWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  petAvatar: {fontSize: 24, marginRight: 8},
  petInfo: {flex: 1},
  petName: {fontSize: 12, fontWeight: '700'},
  petHealthBar: {height: 4, borderRadius: 2, marginTop: 3, overflow: 'hidden'},
  petHealthFill: {height: '100%', borderRadius: 2},
  petMood: {fontSize: 16, marginLeft: 6},
  msgSelectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  msgSelectCancel: {paddingVertical: 4, paddingRight: 4},
  msgSelectCancelText: {fontSize: 15, fontWeight: '600'},
  msgSelectCount: {flex: 1, fontSize: 15, fontWeight: '700'},
  msgSelectDelete: {paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999},
  msgSelectDeleteText: {color: '#fff', fontSize: 14, fontWeight: '700'},
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  locationBannerRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  locationBannerText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  locationBannerStop: {color: '#fff', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline'},
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locationPreviewImage: {width: 56, height: 56, borderRadius: 10},
  locationPreviewInfo: {flex: 1},
  locationPreviewTitle: {fontSize: 13.5, fontWeight: '700'},
  locationPreviewCoords: {fontSize: 12.5, marginTop: 1},
  locationPreviewMeta: {fontSize: 11.5, marginTop: 2},
  // Every vertical measurement here is a whole number on purpose, and it is
  // load-bearing rather than tidiness.
  //
  // This row unmounts the moment you start typing, which shifts everything
  // below it — including GiftedChat's thread. That thread is an *inverted*
  // FlatList, which React Native implements with `transform: [{scaleY: -1}]`,
  // so it is a GPU-composited layer and the only one on this screen. Shift a
  // transformed layer onto a fractional offset and it gets resampled
  // bilinearly: the whole thread turns soft and washed out, for exactly as
  // long as you are typing.
  //
  // Left to content sizing the chips were fractional (13pt text ≈ 15.6pt line
  // box, plus hairline borders), so the shift was fractional too. A fixed
  // integral chip height with integral padding and gap keeps the row's height
  // whole however it wraps, so the shift never lands mid-pixel.
  smartReplyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  smartReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  smartReplyText: {fontSize: 13, fontWeight: '600'},
  invisibleInkWrap: {position: 'relative', padding: 10},
  invisibleInkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  invisibleInkHintRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  invisibleInkHint: {color: '#fff', fontWeight: '700', fontSize: 13},
  gestureCard: {
    width: 200,
    height: 150,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginHorizontal: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  lotteryCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 6,
    marginHorizontal: 4,
    alignItems: 'center',
    minWidth: 200,
  },
  lotteryIcon: {fontSize: 28, marginBottom: 4},
  lotteryTitle: {fontSize: 15, fontWeight: '700'},
  lotteryHint: {fontSize: 12, marginTop: 2, textAlign: 'center'},
  lotteryRevealed: {fontSize: 18, fontWeight: '800', marginTop: 2},
  lotteryRevealedBy: {fontSize: 11, marginTop: 4},
  anonymousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(175,82,222,0.15)',
    marginTop: 4,
    marginHorizontal: 4,
  },
  anonymousText: {fontSize: 10, color: '#AF52DE', fontWeight: '600'},
  reactionChainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    marginHorizontal: 4,
  },
  reactionChainLabel: {fontSize: 10, fontWeight: '600'},
  reactionChainEmoji: {fontSize: 16, marginHorizontal: 1},
  gestureModal: {flex: 1},
  gestureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  gestureHeaderBtn: {fontSize: 16, fontWeight: '600'},
  gestureHeaderTitle: {fontSize: 17, fontWeight: '700'},
  gestureCanvas: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  gestureClearBtn: {alignSelf: 'center', paddingVertical: 12, paddingBottom: 40},
  gestureClearText: {fontSize: 15, fontWeight: '600'},
  chatLockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  chatLockIcon: {fontSize: 48, marginBottom: 16},
  chatLockTitle: {fontSize: 22, fontWeight: '800', marginBottom: 6},
  chatLockSubtitle: {fontSize: 14, marginBottom: 24},
  chatLockInput: {
    width: 200,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  chatLockBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  chatLockBtnText: {color: '#fff', fontWeight: '700', fontSize: 16},
  attachSingleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  attachSingleIcon: {fontSize: 18, fontWeight: '700'},
  attachSingleLabel: {fontSize: 13, fontWeight: '600'},
  attachSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '50%',
  },
  attachSheetHandle: {width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16},
  attachSheetTitle: {fontSize: 18, fontWeight: '700', marginBottom: 16},
  attachSheetScroll: {maxHeight: 280},
  attachSectionLabel: {fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 4},
  attachSectionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8},
  attachOption: {
    width: 72,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachOptionIcon: {fontSize: 22, marginBottom: 4},
  attachOptionText: {fontSize: 11, fontWeight: '600'},
  actionSectionHeader: {fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 16, marginBottom: 4},
  actionSheetScrollable: {maxHeight: '75%'},
  actionSheetScroll: {maxHeight: 400},
  viewOncePlaceholder: {
    width: 200,
    height: 150,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  viewOnceIcon: {fontSize: 32, marginBottom: 6},
  viewOnceText: {fontSize: 13, fontWeight: '600', color: '#10B981'},
  viewOnceBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: 'center',
  },
  viewOnceExpired: {
    width: 200,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(120,120,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  viewOnceExpiredText: {fontSize: 12, fontWeight: '500', fontStyle: 'italic'},
});

