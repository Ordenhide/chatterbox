import type {MediaKeyInfo} from '../services/mediaCrypto';
import type {MediaSlot} from '../services/messageBody';

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
  safetyNumber?: string;
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
  /**
   * There was a `messagePreview: string` here, read by processReminders as the
   * body of the push it sent. It is gone: the reminder names the message and
   * the device opens it, so no copy of a message's text is stored on the
   * server for a notification to quote. See src/services/firebase/push.ts.
   */
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
  transcription?: string;
  viewOnce?: boolean;
  viewOnceViewedBy?: string[];
  viewOnceExpired?: boolean;
  viewOnceOpenedAt?: any;
  reactionChain?: string[];
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
  /**
   * The sealed form of `transcription` above. Written by the client, never by
   * the Cloud Function — a transcript is the message, and a function running
   * with the Admin SDK has no key to seal one with. Older messages still carry
   * the plaintext field; both are read, only this one is written.
   */
  encryptedTranscription?: EncryptedField;
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
  /**
   * The chat-list preview, which is its own small thing rather than a Message.
   *
   * It used to be typed as `Message`, which claimed the document carried
   * forty fields when sendMessage writes six — and left no honest home for
   * `sealed`, which belongs to the preview and not to a message.
   *
   * `sealed` says the preview stands for an encrypted message, so `text`
   * holds a fixed marker rather than a body. Render from the flag: the
   * preview is written by the *sender*, and the marker used to be a literal
   * "🔒 Encrypted message" in English, reaching a chat list drawn in
   * whichever of 53 languages the reader picked. A flag can be localised
   * where it is displayed; a sentence cannot. Mirrored in web/src/types.ts.
   */
  lastMessage?: {
    text?: string;
    sealed?: boolean;
    createdAt?: Date | any;
    image?: string;
    video?: string;
    audio?: string;
    file?: Message['file'];
  };
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
  incognito?: boolean;
  messageExpiry?: number;
  /**
   * When the current disappearing-messages policy was enabled (epoch ms).
   * The timer applies only to messages sent at or after this, so enabling a
   * policy never deletes existing history — see services/messageExpiry.ts and
   * processExpiredMessages in functions/index.js, which both depend on it.
   */
  messageExpirySince?: number;
  /*
   * `lockedBy?: Record<string, boolean>` was here. Per-chat PIN locks were
   * removed from this client, and the field outlived them: nothing on either
   * client read or wrote it, and no rule or function mentioned it. A type
   * member is the quietest place for a removed feature to survive, because it
   * costs nothing and reads as a schema someone should respect — the next
   * person adding chat settings finds a documented field and fills it in.
   *
   * The browser still has per-chat locks, in localStorage only
   * (web/src/services/appLock.ts), so nothing there depended on this either.
   */
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

export interface GestureStroke {
  color: string;
  width: number;
  points: Array<{x: number; y: number}>;
}

