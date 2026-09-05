import type {MediaKeyInfo} from '../services/mediaCrypto';
import type {MediaSlot} from '../services/messageBody';

export interface StealthSettings {
  hideOnline: boolean;
  hideTyping: boolean;
  hideReadReceipts: boolean;
  hideLastSeen: boolean;
}

export interface DeadManSwitch {
  enabled: boolean;
  days: number;
  lastCheckIn: number;
}

export interface TrustedContact {
  uid: string;
  displayName?: string;
  addedAt: number;
  confirmed?: boolean;
}

export interface VaultItem {
  id: string;
  type: 'photo' | 'file' | 'note';
  uri?: string;
  name: string;
  note?: string;
  createdAt: number;
}

/**
 * A user as this client holds one in memory.
 *
 * `email` and `photoURL` come from Firebase Auth and never leave the device:
 * they are deliberately **not** in the `users/{uid}` document any more, and
 * the rules refuse to let either be introduced or changed there (see
 * upsertUserProfile in services/firebaseChat.ts). A peer profile fetched from
 * Firestore therefore has neither, whatever this type says is optional —
 * reading `peer.email` will find nothing.
 */
export interface User {
  uid: string;
  /** From Firebase Auth, for your own account only. Never a peer's. */
  email: string;
  displayName?: string;
  /** From Firebase Auth, for your own account only. Never a peer's. */
  photoURL?: string;
  fcmToken?: string | null;
  profileVisibility?: 'public' | 'friends' | 'private';
  defaultMomentVisibility?: 'public' | 'friends' | 'private';
  focusMode?: {
    enabled: boolean;
    until?: number;
    autoReply?: string;
  };
  voiceStatus?: {
    url: string;
    duration: number;
    createdAt: number;
  };
  stealth?: StealthSettings;
  deadManSwitch?: DeadManSwitch;
  trustedContacts?: TrustedContact[];
  safetyNumber?: string;
}

export interface SharedListItem {
  id: string;
  text: string;
  checked: boolean;
  checkedBy?: string;
}

export interface Expense {
  id: string;
  chatId: string;
  amount: number;
  currency: string;
  description: string;
  paidBy: string;
  splitBetween: string[];
  createdAt: Date | number | any;
}

export interface Reminder {
  id: string;
  userId: string;
  chatId: string;
  messageId: string | number;
  messagePreview: string;
  remindAt: number;
  createdAt: number;
  sent?: boolean;
}

/** An E2EE-sealed value — see services/e2ee.ts. */
export interface EncryptedField {
  alg: string;
  body: string;
  senderKey: string;
  recipientKey: string;
}

/**
 * A fan-out envelope: one independently-decryptable copy per recipient uid —
 * see sealForRecipients in services/e2ee.ts.
 *
 * Messages written before group support carry a bare EncryptedField instead, so
 * anything reading `Message.encrypted` has to handle both shapes. `isSealedEnvelope`
 * distinguishes them; there is no migration and old messages stay readable.
 */
export interface SealedEnvelopeField {
  alg: string;
  copies: Record<string, EncryptedField>;
}

/**
 * A forward-secret 1:1 message — see services/ratchetMessages.ts.
 *
 * A third shape rather than a variant of the two above, because it is opened
 * from stored session state rather than from a key pair, and handing it to the
 * static-DH opener would fail and report the message as undecryptable.
 * `isRatchetEnvelope` distinguishes it. Old messages keep their old shape and
 * stay readable; there is no migration.
 */
export interface RatchetEnvelopeField {
  alg: string;
  from: string;
  message: {header: {dh: string; pn: number; n: number}; body: string; alg: string};
  initial?: {
    identityKey: string;
    ephemeralKey: string;
    signedPreKeyId: string;
    oneTimePreKeyId?: string;
  };
}

/**
 * A forward-secret *group* message — see services/groupRatchetMessages.ts.
 *
 * One ciphertext for the whole chat, opened from the sender's chain rather
 * than per-recipient copies. `isGroupSealed` distinguishes it.
 */
export interface GroupEnvelopeField {
  alg: string;
  from: string;
  message: {alg: string; chainId: string; index: number; body: string; signature: string};
}

/** Every shape `Message.encrypted` can hold. */
export type SealedField =
  | EncryptedField
  | SealedEnvelopeField
  | RatchetEnvelopeField
  | GroupEnvelopeField;

export interface Message {
  _id: string | number;
  text: string;
  createdAt: Date | number | any;
  createdAtRaw?: any;
  image?: string;
  video?: string;
  videoDuration?: number;
  replyTo?: {
    _id: string | number;
    text?: string;
    image?: string;
    video?: string;
    user?: {
      _id: string | number;
      name?: string;
    };
  };
  audio?: string;
  audioDuration?: number;
  // Real capture settings, needed by transcribeVoiceMessage's explicit
  // (non-auto-detect) decoding config for AAC clips — unlike Opus, AAC's
  // actual sample rate isn't a fixed codec property, so the server can't
  // assume it. Absent on messages sent before this field existed.
  audioSampleRateHertz?: number;
  audioChannelCount?: number;
  file?: {
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  };
  linkPreview?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
  };
  reactions?: Record<string, string[]>;
  mentions?: string[];
  burnAfterReading?: {
    duration: number;
    burnStartedAt?: number;
    burned?: boolean;
  };
  scheduledFor?: number;
  sharedList?: {
    id: string;
    title: string;
    items: SharedListItem[];
  };
  transcription?: string;
  expense?: {
    id: string;
    amount: number;
    currency: string;
    description: string;
    paidBy: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    isLive?: boolean;
    expiresAt?: number;
  };
  translations?: Record<string, string>;
  gif?: {
    url: string;
    previewUrl?: string;
    mp4Url?: string;
    mp4PreviewUrl?: string;
    width?: number;
    height?: number;
  };
  timeCapsule?: {
    unlocksAt: number;
  };
  invisibleInk?: boolean;
  revealed?: boolean;
  voiceFilter?: VoiceFilter;
  messageStyle?: MessageStyle;
  anonymous?: boolean;
  viewOnce?: boolean;
  viewOnceViewedBy?: string[];
  viewOnceExpired?: boolean;
  viewOnceOpenedAt?: any;
  forwarded?: boolean;
  gesture?: GestureStroke[];
  reactionChain?: string[];
  lottery?: LotteryMessage;
  /**
   * E2EE envelope. When present, `text` is empty on the wire and the real body
   * lives here, decryptable only by the chat members' devices.
   *
   * Three shapes: a bare EncryptedField for messages sealed before group
   * support, a SealedEnvelopeField (one copy per recipient) for group and
   * legacy 1:1 messages, and a RatchetEnvelopeField for forward-secret 1:1
   * messages. resolveMessageText handles all three — see
   * services/e2eeMessages.ts.
   */
  encrypted?: SealedField;
  /**
   * Same envelope shape, applied to media: when present, the corresponding
   * plaintext field (image/video/audio, or file.uri) is empty on the wire.
   * Only the access pointer is protected — for Storage-hosted media the
   * download URL doubles as a bearer token (Firebase embeds an access token
   * in it), so a Firestore-only leak no longer hands out working links to
   * every photo/video/voice message. The bytes at that URL, and file
   * name/type/size, are still plaintext — see e2ee.ts's documented limits.
   */
  encryptedImage?: EncryptedField | SealedEnvelopeField;
  encryptedVideo?: EncryptedField | SealedEnvelopeField;
  encryptedAudio?: EncryptedField | SealedEnvelopeField;
  encryptedFileUri?: EncryptedField | SealedEnvelopeField;
  /**
   * Set when this message's attachment *bytes* are encrypted at rest
   * (services/mediaCrypto.ts), which supersedes the four fields above: the
   * plaintext URL stays in the clear because the object it names is
   * ciphertext, and the content key travels inside the sealed body.
   *
   * A reader that does not understand this flag must not render the URL, so
   * it is plaintext by design — it is the one part of the scheme every client
   * has to be able to see. It reveals only that the message has an
   * attachment, which the message already reveals.
   */
  mediaSealed?: boolean;
  /**
   * Content keys for this message's attachments, on the way *out* only.
   *
   * Never written to Firestore: encryptOutgoingMessage folds it into the
   * sealed body (services/messageBody.ts) and clears it. It exists so the
   * upload path can hand keys to the seal step without a side channel.
   */
  mediaKeys?: Partial<Record<MediaSlot, MediaKeyInfo>>;
  /**
   * The sealed form of `linkPreview` above (a JSON-encoded preview — see
   * services/linkPreview.ts). When present the plaintext field is absent; the
   * chat screen's decrypt pass fills it back in for rendering.
   */
  encryptedLinkPreview?: EncryptedField;
  user: {
    _id: string;
    name?: string;
    avatar?: string;
  };
}

export interface ChatRoom {
  id: string;
  name: string;
  nameBy?: Record<string, string | null>;
  lastMessage?: Message;
  participants: string[];
  createdAt: Date | any;
  updatedAt?: Date | any;
  pinnedBy?: string[];
  lastReadAt?: Record<string, number>;
  pinnedMessageIds?: Array<string | number>;
  mutedBy?: string[];
  /** Per-user hidden flag — see services/hiddenChats.ts. */
  hiddenBy?: string[];
  typingBy?: Record<string, number>;
  /**
   * Sealed self-introductions, keyed by the uid that wrote one. See
   * services/introductions.ts — the server holds a blob it cannot read, in
   * place of the display name that used to sit on the public profile.
   */
  introBy?: Record<string, unknown>;
  unreadCountBy?: Record<string, number>;
  soundscape?: SoundscapeId;
  incognito?: boolean;
  messageExpiry?: number;
  lockedBy?: Record<string, boolean>;
}

export type CallType = 'voice' | 'video';

export interface CallSession {
  id: string;
  chatId: string;
  participants: string[];
  createdBy: string;
  type: CallType;
  status: 'ringing' | 'active' | 'ended';
  createdAt: Date | number | any;
  updatedAt?: Date | number | any;
  endedAt?: Date | number | any;
  offer?: any;
  answer?: any;
  needsOffer?: boolean;
  needsOfferFrom?: string | null;
}

export type FriendRequestStatus = 'pending' | 'accepted';

export interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  status: FriendRequestStatus;
  createdAt: Date | number | any;
}

export interface Friend {
  id: string;
  userIds: [string, string];
  status: 'accepted';
  createdAt: Date | number | any;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date | number | any;
}

export interface BookmarkedMessage {
  id: string;
  chatId: string;
  messageId: string | number;
  text: string;
  senderName?: string;
  senderId: string;
  image?: string;
  audio?: string;
  createdAt: number;
  bookmarkedAt: number;
}

export interface QuoteWallEntry {
  id: string;
  messageId: string | number;
  text: string;
  senderName?: string;
  senderId: string;
  pinnedBy: string;
  pinnedByName?: string;
  createdAt: number;
  pinnedAt: number;
}

export interface MemoryCard {
  id: string;
  type: 'on_this_day' | 'first_message' | 'milestone' | 'most_reacted';
  chatId: string;
  chatName: string;
  messageId: string | number;
  text: string;
  image?: string;
  senderName: string;
  senderId: string;
  messageDate: number;
  agoLabel: string;
  reactionCount?: number;
}

export interface ContextCard {
  id: string;
  entity: string;
  type: 'place' | 'film' | 'person' | 'topic';
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export interface ChatWrappedStats {
  year: number;
  totalMessages: number;
  totalMedia: number;
  topEmoji: {emoji: string; count: number}[];
  topSender: {name: string; count: number};
  busiestHour: number;
  longestStreakDays: number;
  mostReactedMessage?: {text: string; reactions: number};
  wordCount: number;
  firstMessageDate?: number;
  topWords: string[];
}

export type VoiceFilter = 'none' | 'chipmunk' | 'deep' | 'echo' | 'robot' | 'whisper';

export interface ChatRitual {
  id: string;
  chatId: string;
  title: string;
  prompt: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  time: string;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  streak: number;
  lastCompleted?: number;
}

export type SoundscapeId = 'none' | 'rain' | 'ocean' | 'forest' | 'cafe' | 'campfire' | 'lofi' | 'thunder' | 'wind';

export type MessageStyle = 'none' | 'neon' | 'handwriting' | 'gradient' | 'typewriter' | 'bounce';

export interface GestureStroke {
  color: string;
  width: number;
  points: Array<{x: number; y: number}>;
}

export interface LotteryMessage {
  options: string[];
  revealedIndex?: number;
  revealedBy?: string;
}

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  mp4Url?: string;
  mp4PreviewUrl?: string;
  width: number;
  height: number;
  title?: string;
}
