// Schema-compatible subset of the mobile app's types (src/types) — only the
// fields the web client reads/writes. Kept intentionally narrow.
import type {Timestamp} from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  profileVisibility?: 'public' | 'friends' | 'private';
  lastActiveAt?: Timestamp;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  name?: string;
  nameBy?: Record<string, string>;
  updatedAt?: Timestamp;
  lastMessage?: {
    text?: string;
    createdAt?: Timestamp;
  };
  unreadCountBy?: Record<string, number>;
  pinnedBy?: string[];
  mutedBy?: string[];
  typingBy?: Record<string, number>;
  lastReadAt?: Record<string, number>;
  // Per-user chat appearance (matches mobile ChatSettings).
  themeBy?: Record<string, string>;
  wallpaperBy?: Record<string, string | null>;
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
  encrypted?: EncryptedField | null;
  encryptedImage?: EncryptedField | null;
  encryptedVideo?: EncryptedField | null;
  encryptedAudio?: EncryptedField | null;
  encryptedFileUri?: EncryptedField | null;
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

export interface MomentComment {
  id: string;
  authorId: string;
  text: string;
  createdAt?: Timestamp;
}

export interface WhiteboardStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Array<{x: number; y: number}>;
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

export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  artist?: string;
  addedBy: string;
  addedByName?: string;
  addedAt: number;
  votes: string[];
}

export interface CountdownTask {
  id: string;
  text: string;
  done: boolean;
  assignee?: string;
}

export interface SharedCountdown {
  id: string;
  chatId: string;
  title: string;
  targetDate: number;
  emoji?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  rsvps?: Record<string, 'going' | 'maybe' | 'skip'>;
  tasks?: CountdownTask[];
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

export type MomentVisibility = 'public' | 'friends' | 'private';

export interface Moment {
  id: string;
  authorId: string;
  text?: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  visibility: MomentVisibility;
  createdAt?: Timestamp;
  clientCreatedAt?: number;
  likeCount?: number;
  commentCount?: number;
  // "Burn after time-up": epoch ms after which the moment auto-disappears.
  expiresAt?: number | null;
}
