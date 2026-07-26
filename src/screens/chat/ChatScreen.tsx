import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
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
  Linking,
  useColorScheme,
  FlatList,
  ScrollView,
} from 'react-native';
import {GiftedChat, IMessage, MessageImage, Bubble, Time, Send} from 'react-native-gifted-chat';
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
import HapticFeedback from 'react-native-haptic-feedback';
import {Swipeable} from 'react-native-gesture-handler';
import ImageViewing from 'react-native-image-viewing';
import {getDraft, setDraft} from '../../services/drafts';
import {
  enqueueOutboxMessage,
  getCachedMessages,
  getOutboxMessages,
  removeOutboxMessage,
  setCachedMessages,
} from '../../services/offlineCache';
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
  listenLatestCall,
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
import {scheduleMessage, listenScheduledMessages} from '../../services/scheduledMessages';
import {createSharedList, updateSharedListItem} from '../../services/sharedLists';
import {createReminder} from '../../services/reminders';
import {transcribeVoiceMessage} from '../../services/transcription';
import {getChatSummary} from '../../services/aiSummary';
import {translateMessage} from '../../services/translation';
import {addBookmark} from '../../services/bookmarks';
import {addToQuoteWall} from '../../services/quoteWall';
import {searchGifs, getTrendingGifs} from '../../services/gifSearch';
import {getContextCards} from '../../services/contextCards';
import {listenChatPet, feedPet, calculatePetMood, decayHealth} from '../../services/chatPet';
import {getSmartReplies} from '../../services/smartReply';
import {isChatLocked, verifyChatPIN} from '../../services/appLock';
import {isScreenshotProtectionEnabled, isLinkPreviewEnabled, isStealthMode, generateWatermark, isExifStrippingEnabled} from '../../services/privacyGuard';
import {generateSafetyNumber} from '../../services/messageExpiry';
import {SharedListItem, GifResult, ContextCard, ChatPet, VoiceFilter, MessageStyle, SoundscapeId, GestureStroke} from '../../types';
import {SHOW_NATIVE_ONLY_FEATURES} from '../../config/parity';

export default function ChatScreen() {
  const {t} = useTranslation();
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<IMessage[]>([]);
  const [uploading, setUploading] = useState<{label: string; progress: number} | null>(null);
  const [inputText, setInputText] = useState('');
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
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [canListenCalls, setCanListenCalls] = useState(false);
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
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifSearch, setGifSearch] = useState('');
  const [gifLoading, setGifLoading] = useState(false);
  const [timeCapsuleMode, setTimeCapsuleMode] = useState(false);
  const [capsuleHours, setCapsuleHours] = useState(24);
  const [capsulePickerVisible, setCapsulePickerVisible] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const [dictationSeconds, setDictationSeconds] = useState(0);
  const [contextCards, setContextCards] = useState<Record<string, ContextCard[]>>({});
  const [chatPet, setChatPet] = useState<ChatPet | null>(null);
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
  const [msgSelectMode, setMsgSelectMode] = useState(false);
  const [msgSelected, setMsgSelected] = useState<Set<string>>(new Set());
  const dictationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burnTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [burnCountdowns, setBurnCountdowns] = useState<Record<string, number>>({});
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const navigation = useNavigation();
  const route = useRoute();
  const chatId = (route.params as any)?.chatId;
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

  const audioSet: AudioSet = {
    // Android
    AudioSourceAndroid: AudioSourceAndroidType.MIC,
    OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioEncodingBitRateAndroid: 128000,
    AudioSamplingRateAndroid: 44100,
    AudioChannelsAndroid: 1,
    // iOS
    AVFormatIDKeyIOS: AVEncodingOption.aac,
    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
    AVNumberOfChannelsKeyIOS: 1,
    AVSampleRateKeyIOS: 44100,
    AVModeIOS: AVModeIOSOption.voicechat,
  };

  useEffect(() => {
    pendingRef.current = pendingMessages;
  }, [pendingMessages]);

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
    const unsub = listenScheduledMessages(chatId, msgs => setScheduledCount(msgs.length));
    return () => unsub();
  }, [chatId]);

  const startBurnCountdown = useCallback(
    (messageId: string | number, duration: number, startedAt: number) => {
      const key = String(messageId);
      if (burnTimersRef.current[key]) {
        return;
      }
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      if (remaining <= 0) {
        if (chatId) {
          burnMessage(chatId, key).catch(() => {});
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
            if (chatId) {
              burnMessage(chatId, key).catch(() => {});
            }
            const {[key]: _, ...rest} = prev;
            return rest;
          }
          return {...prev, [key]: left};
        });
      }, 1000);
    },
    [chatId],
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

      let active = true;
      const loadCached = async () => {
        const cached = await getCachedMessages(chatId);
        if (!active) return;
        if (cached.length) {
          setMessages(prev => (prev.length ? prev : cached));
        }
      };
      loadCached();

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
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
        })();
        setMessages(merged);
        scheduleMessageCacheWrite(chatId, formattedMessages);
        
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
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
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
      setInputText(draft);
    };
    loadDraft();
  }, [chatId, user]);

  useEffect(() => {
    if (!chatId || !user || !isOnline) return;
    let active = true;
    const flushOutbox = async () => {
      const queued = await getOutboxMessages(user.uid);
      const forChat = queued.filter(item => item.chatId === chatId);
      for (const item of forChat) {
        if (!active) return;
        try {
          await sendMessage(chatId, item.message);
          await removeOutboxMessage(user.uid, item.id);
          setPendingMessages(prev => prev.filter(m => String(m._id) !== item.id));
          setMessages(prev => prev.filter(m => !(String(m._id) === item.id && (m as any).pending)));
        } catch (error) {
          // Keep in outbox if it still fails.
        }
      }
    };
    flushOutbox();
    return () => {
      active = false;
    };
  }, [chatId, user, isOnline]);

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
          setCanListenCalls(false);
          return;
        }
        if (!chat.participants.includes(user.uid)) {
          setCanListenCalls(false);
          return;
        }
        setCanListenCalls(true);
        const otherId = chat.participants.find(id => id !== user.uid);
        if (otherId) {
          const otherUser = await getUserById(otherId);
          const customName = chat.nameBy?.[user.uid] || '';
          const name = customName || otherUser?.displayName || otherUser?.email || 'Chat';
          setOtherUserName(name);
          setOtherUser(otherUser);
          setCustomName(customName);
          setOtherUserId(otherId);
          setOtherLastReadAt(chat.lastReadAt?.[otherId] || 0);
        }
        setPinnedMessageIds(chat.pinnedMessageIds || []);
        const theme = chat.themeBy?.[user.uid] || '#007AFF';
        setThemeColor(theme);
        setChatWallpaper(chat.wallpaperBy?.[user.uid] || null);

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

  useFocusEffect(
    useCallback(() => {
      if (!chatId || !user || !canListenCalls) return;
      let handledCallId: string | null = null;
      const unsubscribe = listenLatestCall(chatId, call => {
        if (!call) return;
        if (call.status !== 'ringing') return;
        if (call.createdBy === user.uid) return;
        if (handledCallId === call.id) return;
        const createdAt = (call.createdAt as any)?.toDate
          ? (call.createdAt as any).toDate().getTime()
          : new Date(call.createdAt as any).getTime();
        if (Number.isFinite(createdAt) && Date.now() - createdAt > 60000) {
          updateCall(chatId, call.id, {status: 'ended'});
          return;
        }
        handledCallId = call.id;
        Alert.alert('Incoming call', call.type === 'video' ? 'Video call' : 'Voice call', [
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => updateCall(chatId, call.id, {status: 'ended'}),
          },
          {
            text: 'Accept',
            onPress: () =>
              navigation.navigate('Call' as never, {
                chatId,
                callId: call.id,
                isCaller: false,
                type: call.type,
              } as never),
          },
        ]);
      });
      return () => unsubscribe();
    }, [chatId, user, navigation, canListenCalls]),
  );

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
      navigation.navigate('Call' as never, {
        chatId,
        callId,
        isCaller: true,
        type,
      } as never);
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

  const extractUrl = (text: string) => {
    const match = text.match(/https?:\/\/[^\s]+/i);
    return match ? match[0] : null;
  };

  const addLinkPreview = async (currentChatId: string, messageId: string | number, url: string) => {
    try {
      const {httpsCallable} = require('@react-native-firebase/functions');
      const {getFunctions} = require('@react-native-firebase/functions');
      const fn = httpsCallable(getFunctions(), 'fetchLinkPreview');
      const result = await fn({url});
      const preview = (result as any)?.data?.preview;
      if (preview) {
        await updateMessage(currentChatId, messageId, {
          linkPreview: {
            url: preview.url || url,
            title: preview.title,
            description: preview.description,
            image: preview.image,
          },
        });
      }
    } catch {
      try {
        const data: any = await getLinkPreview(url);
        await updateMessage(currentChatId, messageId, {
          linkPreview: {
            url,
            title: data?.title,
            description: data?.description,
            image: data?.images?.[0],
          },
        });
      } catch {}
    }
  };

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
    await scheduleMessage(chatId, messageData, scheduledFor);
    setInputText('');
    setSchedulePickerVisible(false);
    Alert.alert('Scheduled', `Message will be sent in ${mins} minute${mins > 1 ? 's' : ''}.`);
  }, [chatId, user, inputText, scheduleMinutes]);

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
    await createSharedList(chatId, listId, title, items);
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
      await updateSharedListItem(chatId, listId, updated);
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
        messagePreview: (message.text || '[media]').substring(0, 100),
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
    async (messageId: string | number) => {
      if (!chatId) return;
      try {
        const text = await transcribeVoiceMessage(chatId, messageId);
        Alert.alert('Transcription', text);
      } catch {
        Alert.alert('Error', 'Failed to transcribe voice message.');
      }
    },
    [chatId],
  );

  const handleSummarize = useCallback(async () => {
    if (!chatId) return;
    setSummaryLoading(true);
    setSummaryModalVisible(true);
    try {
      const summary = await getChatSummary(chatId, 50);
      setSummaryText(summary);
    } catch (err: any) {
      setSummaryText(err?.message || 'Failed to generate summary. Please try again.');
    } finally {
      setSummaryLoading(false);
    }
  }, [chatId]);

  const handleTranslateMessage = useCallback(
    async (messageId: string | number) => {
      if (!chatId) return;
      try {
        const translation = await translateMessage(chatId, messageId, 'en');
        setTranslatedTexts(prev => ({...prev, [String(messageId)]: translation}));
      } catch {
        Alert.alert('Error', 'Failed to translate message.');
      }
    },
    [chatId],
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
        HapticFeedback.trigger('notificationSuccess');
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
        HapticFeedback.trigger('notificationSuccess');
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
        HapticFeedback.trigger('impactLight');
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

      const tempMsgId = `dictation_${Date.now()}`;
      await sendMessage(chatId, {
        _id: tempMsgId,
        text: '',
        createdAt: new Date(),
        audio: uri,
        audioDuration: dictationSeconds,
        user: {_id: user.uid, name: user.displayName || user.email || 'User'},
      } as any);

      try {
        const transcription = await transcribeVoiceMessage(chatId, tempMsgId);
        if (transcription) {
          setInputText(prev => prev ? `${prev} ${transcription}` : transcription);
        }
      } catch {
        Alert.alert('Info', 'Voice recorded but transcription failed. The voice message was sent.');
      }
    } catch {
      setDictating(false);
      Alert.alert('Error', 'Failed to process dictation.');
    }
  }, [chatId, user, dictationSeconds]);

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

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      if (!chatId || !user) return;

      const message = newMessages[0];
      if (!message?.text?.trim()) return;
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

      const pendingMessage: IMessage = {
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
      setInputText('');
      HapticFeedback.trigger('impactLight');

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
        await sendMessage(chatId, messageData);
        removePendingMessage(String(messageData._id));
      } catch (error) {
        await enqueueOutboxMessage(user.uid, {
          id: String(messageData._id),
          chatId,
          message: messageData,
          createdAt: Date.now(),
        });
      }

      const url = extractUrl(message.text);
      if (url && isLinkPreviewEnabled() && !incognitoMode) {
        void addLinkPreview(chatId, messageData._id, url);
      }
    },
    [chatId, user, replyTo, isOnline, removePendingMessage, burnMode, burnDuration, invisibleInkMode, messageStyle, anonymousMode, chatPet],
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
      text: '\uD83C\uDFB0 Mystery Box',
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

    if (isVideo) {
      try {
        mediaUrl = await runUpload('Uploading video', progress =>
          uploadFile(chatId, uploadUri, fileName, progress),
        );
      } catch (error) {
        Alert.alert('Storage required', 'Video messages need Firebase Storage enabled.');
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
            false,
            {mode: stripExif ? 'none' : 'copy', onlyScaleDown: true},
          );
          uploadUri = resized.uri || asset.uri;
          fileName = resized.name || fileName;
        } catch (resizeError) {
          reportError(resizeError, 'image_resize_failed');
          if (__DEV__) {
            console.warn('Image resize failed, uploading original.', resizeError);
          }
        }
        mediaUrl = await runUpload('Uploading image', progress =>
          uploadFile(chatId, uploadUri, fileName, progress),
        );
      } catch (error) {
        const base64 = asset.base64;
        const maxBase64Length = 700000;
        if (!base64 || base64.length > maxBase64Length) {
          Alert.alert(
            'Storage required',
            'This image is too large to store in Firestore. Enable Firebase Storage or choose a smaller image.',
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
    await sendMessage(chatId, messageData);
    setReplyTo(null);
  }, [chatId, user, replyTo, isOnline, viewOnceMode]);

  const handlePickFile = useCallback(async () => {
    if (!chatId || !user) return;
    if (!isOnline) {
      Alert.alert('Offline', 'File attachments require an internet connection.');
      return;
    }
    try {
      const file = await DocumentPicker.pickSingle();
      if (!file?.uri) return;
      if (file.size && file.size > MAX_FILE_BYTES) {
        Alert.alert('File too large', 'Please select a file under 25MB.');
        return;
      }
      let remoteUrl: string | null = null;
      try {
        remoteUrl = await runUpload('Uploading file', progress =>
          uploadFile(chatId, file.uri, file.name || `file_${Date.now()}`, progress),
        );
      } catch (error) {
        Alert.alert('Storage required', 'File attachments need Firebase Storage enabled.');
        return;
      }

      const messageData: ChatMessage = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        text: '',
        createdAt: new Date(),
        file: {
          uri: remoteUrl,
          name: file.name,
          type: file.type,
          size: file.size,
        },
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

      await sendMessage(chatId, messageData);
      setReplyTo(null);
      HapticFeedback.trigger('impactLight');
    } catch (error: any) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Error', 'Unable to pick file');
      }
    }
  }, [chatId, user, replyTo, isOnline]);

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
    if (!isOnline) {
      Alert.alert('Offline', 'Voice messages require an internet connection.');
      return;
    }
    let remoteUrl: string | null = null;
    try {
      remoteUrl = await runUpload('Uploading voice message', progress =>
        uploadFile(chatId, recordedUri, `audio_${Date.now()}.m4a`, progress),
      );
    } catch (error) {
      Alert.alert('Storage required', 'Voice messages need Firebase Storage enabled.');
      return;
    }
    const messageData: ChatMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      text: '',
      createdAt: new Date(),
      audio: remoteUrl,
      audioDuration: recordedDuration || undefined,
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
    await sendMessage(chatId, messageData);
    setReplyTo(null);
    setRecordModalVisible(false);
    setRecordedUri(null);
    setRecordedDuration(null);
    setVoiceFilter('none');
    HapticFeedback.trigger('impactLight');
  }, [recordedUri, recordedDuration, chatId, user, replyTo, isOnline, voiceFilter]);

  const playAudio = async (messageId: string | number, uri: string) => {
    try {
      if (playingAudioId === messageId) {
        await recorderRef.current.stopPlayer();
        setPlayingAudioId(null);
        return;
      }
      setPlayingAudioId(messageId);
      await recorderRef.current.startPlayer(uri);
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

    Alert.alert('Attach Media', 'Choose a source', [
      {text: 'Camera', onPress: () => openMediaPicker('camera')},
      {text: 'Gallery', onPress: () => openMediaPicker('library')},
      {text: 'File', onPress: handlePickFile},
      {text: 'Voice', onPress: () => setRecordModalVisible(true)},
      {text: 'Cancel', style: 'cancel'},
    ]);
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
                const index = imageMessages.findIndex(img => img.uri === uri);
                setImageViewerIndex(index >= 0 ? index : 0);
                setImageViewerVisible(true);
              }
            }}>
            <Text style={styles.viewOnceIcon}>{'👁'}</Text>
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
            <Text style={styles.videoOverlayText}>▶</Text>
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
        onPress={() => Linking.openURL(file.uri)}>
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
        <Text style={[styles.audioIcon, {color: colors.primary}]}>
          {playingAudioId === message._id ? '⏸' : '▶'}
        </Text>
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
        onPress={() => Linking.openURL(preview.url)}>
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
        onPress={() => navigation.navigate('MomentsTab' as never)}
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
              <Text style={styles.invisibleInkHint}>{'\uD83D\uDCA7'} Hold to reveal</Text>
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
      return (
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
    },
    [colors.primary, colors.text, colors.textOnPrimary, colors.warning, revealedMessages],
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
    const ids = [...msgSelected];
    if (!chatId || ids.length === 0) return;
    Alert.alert(
      'Delete messages',
      `Permanently delete ${ids.length} message${ids.length > 1 ? 's' : ''} for everyone? This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessages(chatId, ids);
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
    if (!chatId) return;
    Alert.alert('Delete message', 'Permanently delete this message for everyone? This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => deleteMessages(chatId, [id]).catch(() => {})},
    ]);
  };

  const handleLongPress = (_: any, message: IMessage) => {
    if (msgSelectMode) {
      toggleMsgSelect(String(message._id));
      return;
    }
    if (!user || !chatId) return;
    const emojiOptions = ['😀', '😍', '😢', '😡', '🎉', '🔥', '👏'];
    const hasAudio = !!(message as any).audio;
    const actions = [
      {label: 'Reply', onPress: () => setReplyTo(message)},
      {label: 'Select Messages', onPress: () => enterMsgSelect(String(message._id))},
      {label: 'Delete Message', onPress: () => handleDeleteSingle(message._id)},
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
            Alert.alert('Remind Me', 'When?', [
              {text: '5 min', onPress: () => handleSetReminder(message, 5)},
              {text: '30 min', onPress: () => handleSetReminder(message, 30)},
              {text: '1 hour', onPress: () => handleSetReminder(message, 60)},
              {text: 'Cancel', style: 'cancel'},
            ]);
          }
        },
      },
      {
        label: 'Translate',
        onPress: () => handleTranslateMessage(message._id),
      },
      {
        label: 'Bookmark',
        onPress: () => handleBookmarkMessage(message),
      },
      ...(message.text
        ? [{label: 'Save to Quote Wall', onPress: () => handleAddToQuoteWall(message)}]
        : []),
      ...(hasAudio
        ? [{label: 'Transcribe', onPress: () => handleTranscribe(message._id)}]
        : []),
      {
        label: 'More Reactions',
        onPress: () => {
          if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: ['Cancel', ...emojiOptions],
                cancelButtonIndex: 0,
              },
              index => {
                if (index > 0) {
                  toggleReaction(chatId, message._id, emojiOptions[index - 1], user.uid);
                  HapticFeedback.trigger('impactLight');
                }
              },
            );
            return;
          }

          Alert.alert(
            'React',
            '',
            [
              ...emojiOptions.map(emoji => ({
                text: emoji,
                onPress: () => {
                  toggleReaction(chatId, message._id, emoji, user.uid);
                  HapticFeedback.trigger('impactLight');
                },
              })),
              {text: 'Cancel', style: 'cancel'},
            ],
            {cancelable: true},
          );
        },
      },
      {
        label: 'React 👍',
        onPress: () => {
          toggleReaction(chatId, message._id, '👍', user.uid);
          HapticFeedback.trigger('impactLight');
        },
      },
      {
        label: 'React ❤️',
        onPress: () => {
          toggleReaction(chatId, message._id, '❤️', user.uid);
          HapticFeedback.trigger('impactLight');
        },
      },
      {
        label: 'React 😂',
        onPress: () => {
          toggleReaction(chatId, message._id, '😂', user.uid);
          HapticFeedback.trigger('impactLight');
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
            Alert.alert('Reaction Story', 'Pick an emoji to add', [
              ...chainEmojis.slice(0, 6).map(e => ({text: e, onPress: () => {
                const current = (message as any).reactionChain || [];
                updateMessage(chatId, message._id, {reactionChain: [...current, e]}).catch(() => {});
              }})),
              {text: 'Cancel', style: 'cancel' as const},
            ]);
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

    Alert.alert('Message Actions', '', [
      ...actions.map(a => ({text: a.label, onPress: a.onPress})),
      {text: 'Cancel', style: 'cancel'},
    ]);
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
    const reactions = current.reactions || {};
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
          <Text style={styles.burnedIcon}>🔥</Text>
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
          <Text style={styles.burnOverlayIcon}>🔥</Text>
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
      <Swipeable
        renderRightActions={() => (
          <View style={styles.swipeReply}>
            <Text style={[styles.swipeReplyText, {color: colors.primary}]}>Reply</Text>
          </View>
        )}
        onSwipeableOpen={() => setReplyTo(current)}
      >
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
            <Text style={[styles.forwardedLabel, {color: colors.textSecondary}]}>↪ Forwarded</Text>
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
                  <Text style={styles.burnCountdownIcon}>🔥</Text>
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
                left: isSelected ? {backgroundColor: colors.primaryLight} : undefined,
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
              <Text style={styles.capsuleIcon}>{'\u23F3'}</Text>
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
              <Text style={[styles.sharedListTitle, {color: colors.primary}]}>
                {'📋'} {current.sharedList.title}
              </Text>
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
                  <Text style={styles.sharedListCheck}>
                    {item.checked ? '☑' : '☐'}
                  </Text>
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
              <Text style={[styles.expenseCardIcon]}>{'💰'}</Text>
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
              <Text style={styles.locationIcon}>{'📍'}</Text>
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
              <Text style={[styles.translationLabel, {color: colors.textSecondary}]}>
                {'🌐'} Translation
              </Text>
              <Text style={[styles.translationText, {color: colors.text}]}>
                {translatedTexts[String(current._id)]}
              </Text>
            </View>
          ) : null}
          {(current as any).transcription ? (
            <View style={[styles.translationCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.translationLabel, {color: colors.textSecondary}]}>
                {'🎙'} Transcription
              </Text>
              <Text style={[styles.translationText, {color: colors.text}]}>
                {(current as any).transcription}
              </Text>
            </View>
          ) : null}
          {SHOW_NATIVE_ONLY_FEATURES && contextCards[String(current._id)]?.map(card => (
            <TouchableOpacity
              key={card.id}
              activeOpacity={0.7}
              onPress={() => card.url && Linking.openURL(card.url)}
              style={[styles.contextCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              {card.image ? (
                <Image source={{uri: card.image}} style={styles.contextCardImage} />
              ) : null}
              <View style={styles.contextCardBody}>
                <View style={styles.contextCardHeader}>
                  <Text style={styles.contextCardTypeIcon}>
                    {card.type === 'place' ? '\uD83D\uDDFA\uFE0F' : card.type === 'film' ? '\uD83C\uDFAC' : card.type === 'person' ? '\uD83D\uDC64' : '\uD83D\uDCD6'}
                  </Text>
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
              <Text style={styles.lotteryIcon}>{current.lottery.revealedIndex != null ? '\uD83C\uDF89' : '\uD83C\uDFB0'}</Text>
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
              <Text style={styles.anonymousText}>{'\uD83D\uDC7B'} Anonymous</Text>
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
      </Swipeable>
    );
  }, [colors, playingAudioId, lastOutgoingMessageId, otherLastReadAt, pinnedMessageIds, imageMessages, themeColor, scrollToMessageId, user, burnCountdowns, handleRevealBurnMessage, formatBurnDuration, translatedTexts, handleToggleListItem, contextCards, msgSelectMode, msgSelected]);

  const renderAccessory = () => {
    if (!replyTo && !burnMode) {
      return null;
    }
    return (
      <View>
        {burnMode ? (
          <View style={[styles.burnAccessoryBar, {backgroundColor: colors.surface, borderTopColor: colors.warning}]}>
            <Text style={styles.burnAccessoryIcon}>🔥</Text>
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
      <GlassScreen style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.chatLockContainer}>
          <Text style={styles.chatLockIcon}>{'\uD83D\uDD12'}</Text>
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

  return (
    <GlassScreen style={styles.container} edges={['top', 'bottom']}>
      {chatWallpaper ? (
        <View style={[StyleSheet.absoluteFill, {backgroundColor: chatWallpaper, opacity: 0.15}]} />
      ) : null}
      {incognitoMode ? (
        <View style={[styles.offlineBanner, {backgroundColor: '#1A1A2E'}]}>
          <Text style={styles.offlineText}>{'\uD83D\uDD35'} Incognito — no previews, no cache, no read receipts</Text>
        </View>
      ) : null}
      {isScreenshotProtectionEnabled() ? (
        <View style={[styles.offlineBanner, {backgroundColor: colors.success}]}>
          <Text style={styles.offlineText}>{'\uD83D\uDEE1\uFE0F'} Screenshot protection active</Text>
        </View>
      ) : null}
      {isOffline ? (
        <View style={[styles.offlineBanner, {backgroundColor: colors.warning}]}>
          <Text style={styles.offlineText}>Offline — messages will send when you're back online</Text>
        </View>
      ) : null}
      {uploading ? (
        <View style={[styles.uploadBanner, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
          <Text style={[styles.uploadText, {color: colors.text}]}>
            {uploading.label} ({uploading.progress}%)
          </Text>
          <View style={[styles.uploadBar, {backgroundColor: colors.border}]}>
            <View style={[styles.uploadBarFill, {width: `${uploading.progress}%`, backgroundColor: colors.primary}]} />
          </View>
        </View>
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
      {SHOW_NATIVE_ONLY_FEATURES && chatPet ? (
        <View style={[styles.petWidget, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
          <Text style={styles.petAvatar}>
            {chatPet.species === 'plant' ? '\uD83C\uDF31' : chatPet.species === 'cat' ? '\uD83D\uDC31' : chatPet.species === 'dog' ? '\uD83D\uDC36' : chatPet.species === 'bunny' ? '\uD83D\uDC30' : '\uD83E\uDD8A'}
          </Text>
          <View style={styles.petInfo}>
            <Text style={[styles.petName, {color: colors.text}]}>{chatPet.name} Lv.{chatPet.level}</Text>
            <View style={[styles.petHealthBar, {backgroundColor: colors.border}]}>
              <View style={[styles.petHealthFill, {width: `${Math.max(0, Math.min(100, decayHealth(chatPet)))}%`, backgroundColor: decayHealth(chatPet) > 50 ? colors.success : decayHealth(chatPet) > 20 ? colors.warning : colors.danger}]} />
            </View>
          </View>
          <Text style={styles.petMood}>
            {calculatePetMood({...chatPet, health: decayHealth(chatPet)}) === 'happy' ? '\u2764\uFE0F' : calculatePetMood({...chatPet, health: decayHealth(chatPet)}) === 'neutral' ? '\uD83D\uDE10' : calculatePetMood({...chatPet, health: decayHealth(chatPet)}) === 'sad' ? '\uD83D\uDE22' : '\uD83D\uDCA4'}
          </Text>
        </View>
      ) : null}
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
      {smartReplies.length > 0 && !inputText ? (
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
      <GiftedChat
        messages={filteredMessages}
        onSend={onSend}
        loadEarlier={hasMoreMessages}
        onLoadEarlier={loadEarlier}
        isLoadingEarlier={isLoadingEarlier}
        user={giftedUser}
        text={inputText}
        onInputTextChanged={setInputText}
        renderActions={renderActions}
        renderMessageImage={renderMessageImage}
        renderMessageVideo={renderMessageVideo}
        renderMessageAudio={renderMessageAudio}
        renderMessageText={renderMessageText}
        renderBubble={renderBubble}
        renderAccessory={renderAccessory}
        onLongPress={handleLongPress}
        onPress={(_: any, message: IMessage) => {
          if (msgSelectMode) toggleMsgSelect(String(message._id));
        }}
        renderTime={
          showTimestamps
            ? (props: any) => {
                const {key: _key, ...timeProps} = props || {};
                return <Time {...timeProps} />;
              }
            : undefined
        }
        listViewProps={listViewProps}
        placeholder={t('chat.composerPlaceholder')}
        showUserAvatar
        alwaysShowSend
        renderSend={(props: any) => <Send {...props} label={t('common.send')} />}
        textInputProps={{
          autoCorrect: !incognitoMode,
          autoComplete: incognitoMode ? 'off' : undefined,
          spellCheck: !incognitoMode,
        }}
      />
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
        <Modal visible transparent animationType="slide" onRequestClose={() => setAttachSheetVisible(false)}>
          <Pressable style={styles.actionSheetBackdrop} onPress={() => setAttachSheetVisible(false)}>
            <Pressable style={[styles.attachSheet, {backgroundColor: colors.background}]} onPress={e => e.stopPropagation()}>
              <View style={[styles.attachSheetHandle, {backgroundColor: colors.border}]} />
              <Text style={[styles.attachSheetTitle, {color: colors.text}]}>Attach & style</Text>
              <ScrollView style={styles.attachSheetScroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.attachSectionLabel, {color: colors.textSecondary}]}>Media</Text>
                <View style={styles.attachSectionRow}>
                  <TouchableOpacity style={[styles.attachOption, {backgroundColor: colors.surface}]} onPress={() => { setAttachSheetVisible(false); handlePickMedia(); }}>
                    <Text style={styles.attachOptionIcon}>{'\uD83D\uDCF7'}</Text>
                    <Text style={[styles.attachOptionText, {color: colors.text}]}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, {backgroundColor: colors.surface}]} onPress={() => { setAttachSheetVisible(false); setGifPickerVisible(true); loadTrendingGifs(); }}>
                    <Text style={styles.attachOptionIcon}>GIF</Text>
                    <Text style={[styles.attachOptionText, {color: colors.text}]}>GIF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, {backgroundColor: colors.surface}]} onPress={() => { setAttachSheetVisible(false); dictating ? stopDictation() : startDictation(); }}>
                    <Text style={styles.attachOptionIcon}>{'\uD83C\uDFA4'}</Text>
                    <Text style={[styles.attachOptionText, {color: colors.text}]}>{dictating ? 'Stop' : 'Voice'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.attachSectionLabel, {color: colors.textSecondary}]}>Message style</Text>
                <View style={styles.attachSectionRow}>
                  {SHOW_NATIVE_ONLY_FEATURES && (
                    <>
                  <TouchableOpacity style={[styles.attachOption, timeCapsuleMode && {backgroundColor: '#8B5CF6'}]} onPress={() => { setTimeCapsuleMode(prev => !prev); }} onLongPress={() => setCapsulePickerVisible(true)}>
                    <Text style={[styles.attachOptionIcon, timeCapsuleMode && {color: '#fff'}]}>{'\u23F3'}</Text>
                    <Text style={[styles.attachOptionText, {color: timeCapsuleMode ? '#fff' : colors.text}]}>Timer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, invisibleInkMode && {backgroundColor: '#6366F1'}]} onPress={() => setInvisibleInkMode(prev => !prev)}>
                    <Text style={[styles.attachOptionIcon, invisibleInkMode && {color: '#fff'}]}>{'\uD83D\uDCA7'}</Text>
                    <Text style={[styles.attachOptionText, {color: invisibleInkMode ? '#fff' : colors.text}]}>Invisible</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, messageStyle !== 'none' && {backgroundColor: '#EC4899'}]} onPress={() => { setAttachSheetVisible(false); setStylePickerVisible(true); }}>
                    <Text style={[styles.attachOptionIcon, messageStyle !== 'none' && {color: '#fff'}]}>Aa</Text>
                    <Text style={[styles.attachOptionText, {color: messageStyle !== 'none' ? '#fff' : colors.text}]}>Style</Text>
                  </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={[styles.attachOption, burnMode && {backgroundColor: colors.warning}]} onPress={() => setBurnMode(prev => !prev)} onLongPress={() => setBurnDurationPickerVisible(true)}>
                    <Text style={[styles.attachOptionIcon, burnMode && {color: colors.textOnPrimary}]}>🔥</Text>
                    <Text style={[styles.attachOptionText, {color: burnMode ? colors.textOnPrimary : colors.text}]}>Burn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.attachOption, viewOnceMode && {backgroundColor: '#10B981'}]} onPress={() => setViewOnceMode(prev => !prev)}>
                    <Text style={[styles.attachOptionIcon, viewOnceMode && {color: '#fff'}]}>{'👁'}</Text>
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
                navigation.navigate('ChatMedia' as never, {chatId} as never);
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
                handleSummarize();
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Catch Up (AI Summary)</Text>
            </TouchableOpacity>
              <Text style={[styles.actionSectionHeader, {color: colors.textSecondary}]}>Activities</Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('Whiteboard' as never, {chatId} as never);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Whiteboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('Playlist' as never, {chatId} as never);
              }}>
              <Text style={[styles.actionSheetText, {color: colors.text}]}>Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                navigation.navigate('Countdown' as never, {chatId} as never);
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
                {anonymousMode ? '\uD83D\uDC7B Anonymous ON' : '\uD83D\uDC7B Anonymous'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setActionsModalVisible(false);
                setIncognitoMode(prev => !prev);
              }}>
              <Text style={[styles.actionSheetText, {color: incognitoMode ? colors.success : colors.text}]}>
                {incognitoMode ? '\uD83D\uDD35 Incognito ON' : '\uD83D\uDD35 Incognito'}
              </Text>
            </TouchableOpacity>
            {otherUserId && user ? (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  setActionsModalVisible(false);
                  const sn = generateSafetyNumber(user.uid, otherUserId);
                  Alert.alert('Safety Number', `Your verification code with this contact:\n\n${sn}\n\nCompare this with your contact in person to verify identity.`);
                }}>
                <Text style={[styles.actionSheetText, {color: colors.text}]}>{'\uD83D\uDD10'} Verify Contact</Text>
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
                navigation.navigate('ChatSettings' as never, {chatId} as never);
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
                    <Text style={styles.burnPickerCheck}>✓</Text>
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
                Chat Summary
              </Text>
              {summaryLoading ? (
                <Text style={[styles.summaryLoading, {color: colors.textSecondary}]}>
                  Generating summary...
                </Text>
              ) : (
                <Text style={[styles.summaryBody, {color: colors.text}]}>{summaryText}</Text>
              )}
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
              <Text style={[styles.summarySheetTitle, {color: colors.text}]}>
                {'\uD83C\uDFB0'} Mystery Box
              </Text>
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  offlineText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
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
    fontSize: 11,
    fontWeight: '600',
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
  swipeReply: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    marginLeft: 8,
  },
  swipeReplyText: {
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
    fontSize: 16,
    lineHeight: 22,
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
  sharedListTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
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
  translationLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
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
  summarySheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
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

