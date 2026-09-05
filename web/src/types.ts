// Schema-compatible subset of the mobile app's types (src/types) — only the
// fields the web client reads/writes. Kept intentionally narrow.
import type {Timestamp} from 'firebase/firestore';

/**
 * The `users/{uid}` document, which is readable by anyone who knows the uid.
 *
 * No `email` and no `photoURL`: both were removed on 2026-09-05 and the rules
 * now refuse to let either be introduced or changed. The address lives in
 * Firebase Auth, where a credential belongs, and this type omits them so
 * nothing can quietly start reading them again.
 */
export interface UserProfile {
  uid: string;
  displayName?: string | null;
  profileVisibility?: 'public' | 'friends' | 'private';
  lastActiveAt?: Timestamp;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  name?: string;
  nameBy?: Record<string, string>;
  /** Written by createChat and never changed; the fallback when a chat has
   *  never been used. Mirrors the mobile ChatRoom. */
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastMessage?: {
    text?: string;
    createdAt?: Timestamp;
  };
  unreadCountBy?: Record<string, number>;
  pinnedBy?: string[];
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
  lastReadAt?: Record<string, number>;
  // Per-user chat appearance (matches mobile ChatSettings).
  // Disappearing-messages policy (hours; 0/undefined = off). Matches mobile.
  messageExpiry?: number;
  // When the current disappearing-messages policy was enabled (epoch ms). The
  // timer applies only to messages sent at/after this, so turning the policy on
  // never retroactively deletes older history.
  messageExpirySince?: number;
  // Ids of messages pinned within this chat.
  pinnedMessageIds?: string[];
}

// Matches react-native-gifted-chat's IMessage shape used by the mobile app.
export interface ChatMessage {
  _id: string;
  text?: string;
  createdAt?: Timestamp;
  editedAt?: Timestamp;
  user: {_id: string; name?: string};
  image?: string | null;
  video?: string | null;
  audio?: string | null;
  audioDuration?: number;
  // Real capture settings, needed by transcribeVoiceMessage's explicit
  // (non-auto-detect) decoding config for AAC clips — unlike Opus, AAC's
  // actual sample rate isn't a fixed codec property, so the server can't
  // assume it. Absent on messages sent before this field existed.
  audioSampleRateHertz?: number;
  audioChannelCount?: number;
  file?: {uri: string; name: string; size?: number} | null;
  reactions?: Record<string, string[]>; // emoji -> uids
  // Reply/quote: a snapshot of the message being replied to.
  replyTo?: {_id: string; text?: string; image?: string; video?: string; user?: {_id: string; name?: string}} | null;
  // @mentions — uids mentioned in the text.
  mentions?: string[];
  // GIF message (GIPHY).
  gif?: {url: string; previewUrl?: string; mp4Url?: string; mp4PreviewUrl?: string; width?: number; height?: number} | null;
  // Voice-message transcription (from the transcribeVoiceMessage function).
  transcription?: string;
  // System event rendered as a centered notice rather than a normal message.
  system?: boolean;
  call?: {type: 'voice' | 'video'; outcome: 'missed' | 'declined'};
  // Ephemeral: burn-after-reading (self-destructs `duration`s after first read).
  burnAfterReading?: {duration: number; burnStartedAt?: number; burned?: boolean} | null;
  // Ephemeral: view-once media (viewable a single time, then expired).
  viewOnce?: boolean;
  viewOnceViewedBy?: string[];
  viewOnceExpired?: boolean;
  viewOnceOpenedAt?: Timestamp;
  // E2EE — see services/e2ee.ts and services/e2eeKeys.ts. Both mobile and web
  // now enroll a device keypair and can decrypt these; the plain field (text/
  // image/audio/file.uri) is populated once decryption succeeds and is what
  // the rest of the UI renders, so no separate "encrypted" code path exists
  // outside ChatPane's decrypt effect.
  encrypted?: EncryptedField | SealedEnvelopeField | null;
  encryptedImage?: EncryptedField | SealedEnvelopeField | null;
  encryptedVideo?: EncryptedField | SealedEnvelopeField | null;
  encryptedAudio?: EncryptedField | SealedEnvelopeField | null;
  encryptedFileUri?: EncryptedField | SealedEnvelopeField | null;
  // Link preview, resolved once by the sender and sealed the same way (see
  // services/linkPreview.ts). `linkPreview` is the legacy plaintext field the
  // mobile client wrote before this, and the fallback when there's no peer key
  // to encrypt to; ChatPane's decrypt pass fills it in from the sealed copy.
  linkPreview?: {url: string; title?: string | null; description?: string | null; image?: string | null} | null;
  encryptedLinkPreview?: EncryptedField | null;
}

/**
 * A fan-out envelope: one independently-decryptable copy per recipient uid —
 * see sealForRecipients in services/e2ee.ts.
 *
 * Messages written before group support carry a bare EncryptedField instead, so
 * readers must handle both shapes. `isSealed`/`openSealed` do; there is no
 * migration and old messages stay readable indefinitely.
 */
export interface SealedEnvelopeField {
  alg: string;
  copies: Record<string, EncryptedField>;
}

export interface EncryptedField {
  alg: string;
  body: string;
  senderKey: string;
  recipientKey: string;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  status: string;
}

export interface Friend {
  id: string;
  userIds: string[];
  status: string;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
}

export interface Bookmark {
  id: string;
  chatId: string;
  messageId: string;
  text: string;
  senderId: string;
  senderName?: string;
  bookmarkedAt?: Timestamp;
}

// ---- Shared chat spaces (schema-matched to mobile src/types) ---------------

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

export interface SharedListItem {
  id: string;
  text: string;
  checked: boolean;
  checkedBy?: string;
}

export interface SharedList {
  id: string;
  title: string;
  items: SharedListItem[];
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

export interface ContextCard {
  id: string;
  entity: string;
  type: 'place' | 'film' | 'person' | 'topic';
  title: string;
  description: string;
  image?: string;
  url?: string;
}
