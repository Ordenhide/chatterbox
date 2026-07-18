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

export interface User {
  uid: string;
  email: string;
  displayName?: string;
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

export interface WhiteboardStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Array<{x: number; y: number}>;
}

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
      _id: string;
      name?: string;
    };
  };
  audio?: string;
  audioDuration?: number;
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
  moment?: {
    id: string;
    authorId: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
  };
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
  themeBy?: Record<string, string>;
  wallpaperBy?: Record<string, string>;
  typingBy?: Record<string, number>;
  unreadCountBy?: Record<string, number>;
  pet?: ChatPet;
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

export type MomentVisibility = 'friends' | 'public' | 'private';

export interface Moment {
  id: string;
  authorId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  visibility: MomentVisibility;
  createdAt: Date | number | any;
  clientCreatedAt?: number;
  updatedAt?: Date | number | any;
  likeCount?: number;
  commentCount?: number;
}

export interface MomentComment {
  id: string;
  momentId: string;
  authorId: string;
  text: string;
  createdAt: Date | number | any;
  mentions?: string[];
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

export interface ChatPet {
  species: 'plant' | 'cat' | 'dog' | 'bunny' | 'fox';
  name: string;
  level: number;
  xp: number;
  health: number;
  lastFed: number;
  createdAt: number;
  mood: 'happy' | 'neutral' | 'sad' | 'sleeping';
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

export type MessageStyle = 'none' | 'neon' | 'handwriting' | 'gradient' | 'typewriter' | 'bounce';

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
  tasks?: Array<{id: string; text: string; done: boolean; assignee?: string}>;
}

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
