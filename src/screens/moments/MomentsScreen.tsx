import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  FlatList,
  Modal,
  TextInput,
  Alert,
  useColorScheme,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import GlassScreen from '../../components/GlassScreen';
import RevealOnScroll from '../../components/RevealOnScroll';
import PressableScale from '../../components/PressableScale';
import ExpandingImage from '../../components/ExpandingImage';
import {useParallaxScroll} from '../../contexts/ScrollMotionContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {launchImageLibrary} from 'react-native-image-picker';
import Video from 'react-native-video';
import ImageResizer from 'react-native-image-resizer';
import {useAuth} from '../../contexts/AuthContext';
import {getColors} from '../../theme/colors';
import GlassView from '../../components/GlassView';
import {useTranslation} from 'react-i18next';
import {
  addMomentComment,
  createMoment,
  deleteMoment,
  fetchMomentsForAuthors,
  fetchUserMoments,
  likeMoment,
  listenMomentComments,
  unlikeMoment,
  updateMoment,
  uploadMomentMedia,
} from '../../services/moments';
import {Moment, MomentComment, MomentVisibility, Friend, User, BlockRecord, ChatRoom} from '../../types';
import {getUsersByIds, listenChatsForUser, sendMessage} from '../../services/firebaseChat';
import {reportError} from '../../services/telemetry';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from '../../services/firebase/firestore';

type MediaDraft = {uri: string; type: 'image' | 'video'; isRemote?: boolean};

export default function MomentsScreen() {
  const {user} = useAuth();
  const navigation = useNavigation();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const {onScroll, scrollEventThrottle} = useParallaxScroll();
  const [feedMoments, setFeedMoments] = useState<Moment[]>([]);
  const [selfMoments, setSelfMoments] = useState<Moment[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, User | null>>({});
  const [commentAuthors, setCommentAuthors] = useState<Record<string, User | null>>({});
  const [createVisible, setCreateVisible] = useState(false);
  const [momentText, setMomentText] = useState('');
  const [visibility, setVisibility] = useState<MomentVisibility>('friends');
  const [defaultVisibility, setDefaultVisibility] = useState<MomentVisibility>('friends');
  const [media, setMedia] = useState<MediaDraft | null>(null);
  const [mediaChanged, setMediaChanged] = useState(false);
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [likesByMoment, setLikesByMoment] = useState<Record<string, {count: number; liked: boolean}>>({});
  const db = getFirestore();
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [activeMoment, setActiveMoment] = useState<Moment | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareMoment, setShareMoment] = useState<Moment | null>(null);
  const [shareChats, setShareChats] = useState<ChatRoom[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareNames, setShareNames] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canSubmit = editingMoment
    ? !uploading
    : !uploading && (momentText.trim().length > 0 || !!media);

  const feedKeyRef = useRef<string>('');
  const selfKeyRef = useRef<string>('');

  const getMomentTime = useCallback((moment: Moment) => {
    const raw = (moment.updatedAt as any) ?? (moment.createdAt as any);
    if (raw?.toMillis) return raw.toMillis();
    if (raw?.toDate) return raw.toDate().getTime();
    if (typeof raw === 'number') return raw;
    if (typeof moment.clientCreatedAt === 'number') return moment.clientCreatedAt;
    return 0;
  }, []);

  const moments = useMemo(() => {
    const merged = new Map<string, Moment>();
    [...feedMoments, ...selfMoments].forEach(item => {
      if (item?.id) merged.set(item.id, item);
    });
    return Array.from(merged.values()).sort((a, b) => {
      const diff = getMomentTime(b) - getMomentTime(a);
      if (diff === 0) {
        return b.id.localeCompare(a.id);
      }
      return diff;
    });
  }, [feedMoments, selfMoments, getMomentTime]);

  const refreshFeed = useCallback(async () => {
    if (!user?.uid) return;
    setRefreshing(true);
    setLoadError(null);
    try {
      const [friendsSnap, blockedBySnap, blockedMeSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, 'friends'), where('userIds', 'array-contains', user.uid))),
        getDocs(query(collection(db, 'blocks'), where('blockerId', '==', user.uid))),
        getDocs(query(collection(db, 'blocks'), where('blockedId', '==', user.uid))),
        getDoc(doc(db, 'users', user.uid)),
      ]);

      const nextFriends = friendsSnap.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Friend, 'id'>),
      })) as Friend[];
      const blockedByMe = blockedBySnap.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<BlockRecord, 'id'>),
      })) as BlockRecord[];
      const blockedMe = blockedMeSnap.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<BlockRecord, 'id'>),
      })) as BlockRecord[];

      const blockedIds = new Set<string>();
      blockedByMe.forEach(record => blockedIds.add(record.blockedId));
      blockedMe.forEach(record => blockedIds.add(record.blockerId));

      const friendIds = nextFriends
        .map(friend => friend.userIds.find(id => id !== user.uid))
        .filter((id): id is string => !!id)
        .filter(id => !blockedIds.has(id))
        .sort();

      const nextDefault = (userSnap.data() as any)?.defaultMomentVisibility || 'friends';
      setDefaultVisibility(prev => (prev === nextDefault ? prev : nextDefault));

      const [feedList, selfList] = await Promise.all([
        fetchMomentsForAuthors(user.uid, friendIds),
        fetchUserMoments(user.uid),
      ]);

      const filteredFeed = feedList.filter(moment => !blockedIds.has(moment.authorId));
      const feedKey = filteredFeed
        .map(moment => moment.id)
        .sort()
        .join('|');
      if (feedKeyRef.current !== feedKey) {
        feedKeyRef.current = feedKey;
        setFeedMoments(filteredFeed);
      }

      const selfKey = selfList
        .map(moment => moment.id)
        .sort()
        .join('|');
      if (selfKeyRef.current !== selfKey) {
        selfKeyRef.current = selfKey;
        setSelfMoments(selfList);
      }

      setLikesByMoment({});
    } catch (error) {
      reportError(error, 'refreshMoments');
      if (__DEV__) {
        console.error('refresh moments error:', error);
      }
      setLoadError(t('moments.alerts.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid, db, t]);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  useEffect(() => {
    if (!commentsVisible || !activeMoment?.id) return;
    const unsubscribe = listenMomentComments(activeMoment.id, setComments);
    return () => unsubscribe();
  }, [commentsVisible, activeMoment?.id]);

  useEffect(() => {
    let active = true;
    const loadAuthors = async () => {
      const ids = Array.from(new Set(comments.map(comment => comment.authorId))).filter(
        id => id && !commentAuthors[id],
      );
      if (!ids.length) return;
      const fetched = await getUsersByIds(ids);
      if (!active) return;
      if (Object.keys(fetched).length) {
        setCommentAuthors(prev => ({...prev, ...fetched}));
      }
    };
    if (comments.length) {
      loadAuthors();
    }
    return () => {
      active = false;
    };
  }, [comments]);

  const openComments = (moment: Moment) => {
    setActiveMoment(moment);
    setCommentDraft('');
    setCommentsVisible(true);
  };

  const closeComments = () => {
    setCommentsVisible(false);
    setComments([]);
    setActiveMoment(null);
    setCommentDraft('');
  };

  const extractMentions = (text: string) => {
    const matches = text.match(/@([a-zA-Z0-9_]+)/g) || [];
    return matches.map(match => match.slice(1));
  };

  const handleSubmitComment = async () => {
    if (!user?.uid || !activeMoment?.id) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    try {
      const mentions = extractMentions(trimmed);
      await addMomentComment(activeMoment.id, user.uid, trimmed, mentions);
      setCommentDraft('');
    } catch (error) {
      reportError(error, 'addMomentComment');
      if (__DEV__) {
        console.error('addMomentComment error:', error);
      }
      Alert.alert(t('common.error'), t('moments.alerts.commentFailed'));
    }
  };

  const handleToggleLike = async (moment: Moment, liked: boolean) => {
    if (!user?.uid) return;
    try {
      if (liked) {
        await unlikeMoment(moment.id, user.uid);
      } else {
        await likeMoment(moment.id, user.uid);
      }
    } catch (error) {
      reportError(error, 'toggleLike');
      if (__DEV__) {
        console.error('toggleLike error:', error);
      }
    }
  };

  const openShare = (moment: Moment) => {
    if (!user?.uid) return;
    setShareMoment(moment);
    setShareVisible(true);
  };

  const closeShare = () => {
    setShareVisible(false);
    setShareMoment(null);
    setShareChats([]);
    setShareLoading(false);
    setShareNames({});
  };

  useEffect(() => {
    if (!shareVisible || !user?.uid) return;
    setShareLoading(true);
    const unsubscribe = listenChatsForUser(user.uid, chats => {
      setShareChats(chats);
      setShareLoading(false);
    });
    return () => unsubscribe();
  }, [shareVisible, user?.uid]);

  useEffect(() => {
    let active = true;
    const loadShareNames = async () => {
      if (!user?.uid) return;
      const updates: Record<string, string> = {};
      const otherIds = shareChats
        .map(chat => {
          if (shareNames[chat.id]) return null;
          const customName = chat.nameBy?.[user.uid] || '';
          if (customName) return null;
          return chat.participants?.find(id => id !== user.uid) || null;
        })
        .filter((id): id is string => !!id);
      const usersById = await getUsersByIds(otherIds);
      shareChats.forEach(chat => {
        if (shareNames[chat.id]) return;
        const customName = chat.nameBy?.[user.uid] || '';
        if (customName) {
          updates[chat.id] = customName;
          return;
        }
        const otherId = chat.participants?.find(id => id !== user.uid);
        if (otherId) {
          const otherUser = usersById[otherId];
          updates[chat.id] = otherUser?.displayName || otherUser?.email || chat.name || t('headers.chat');
        } else {
          updates[chat.id] = chat.name || t('headers.chat');
        }
      });
      if (!active) return;
      if (Object.keys(updates).length) {
        setShareNames(prev => ({...prev, ...updates}));
      }
    };
    if (shareChats.length) {
      loadShareNames();
    }
    return () => {
      active = false;
    };
  }, [shareChats, user?.uid, t]);

  const handleShareToChat = async (chatId: string) => {
    if (!shareMoment || !user?.uid) return;
    try {
      await sendMessage(chatId, {
        _id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: t('moments.sharedMoment'),
        createdAt: new Date(),
        moment: {
          id: shareMoment.id,
          authorId: shareMoment.authorId,
          text: shareMoment.text,
          mediaUrl: shareMoment.mediaUrl,
          mediaType: shareMoment.mediaType,
        },
        user: {
          _id: user.uid,
          name: user.displayName || user.email || t('profile.defaultName'),
          avatar: user.photoURL,
        },
      });
      closeShare();
      Alert.alert(t('moments.alerts.shareSuccessTitle'), t('moments.alerts.shareSuccessBody'));
    } catch (error) {
      reportError(error, 'shareMoment');
      if (__DEV__) {
        console.error('shareMoment error:', error);
      }
      Alert.alert(t('moments.alerts.shareFailedTitle'), t('moments.alerts.shareFailedBody'));
    }
  };

  useEffect(() => {
    let active = true;
    const loadAuthors = async () => {
      const ids = Array.from(new Set(moments.map(moment => moment.authorId))).filter(
        id => id && !authorById[id],
      );
      if (!ids.length) return;
      const fetched = await getUsersByIds(ids);
      if (!active) return;
      if (Object.keys(fetched).length) {
        setAuthorById(prev => ({...prev, ...fetched}));
      }
    };
    loadAuthors();
    return () => {
      active = false;
    };
  }, [moments]);

  const resetDraft = () => {
    setMomentText('');
    setVisibility(defaultVisibility || 'friends');
    setMedia(null);
    setMediaChanged(false);
    setEditingMoment(null);
    setUploadProgress(0);
  };

  const openCreate = () => {
    resetDraft();
    setCreateVisible(true);
  };

  const openEdit = (moment: Moment) => {
    setEditingMoment(moment);
    setMomentText(moment.text || '');
    setVisibility(moment.visibility || 'friends');
    if (moment.mediaUrl && moment.mediaType) {
      setMedia({uri: moment.mediaUrl, type: moment.mediaType, isRemote: true});
    } else {
      setMedia(null);
    }
    setMediaChanged(false);
    setCreateVisible(true);
  };

  const handleSaveMoment = async () => {
    if (!user?.uid) return;
    try {
      setUploading(true);
      let mediaUrl: string | null | undefined;
      let mediaType: 'image' | 'video' | null | undefined;

      if (editingMoment) {
        if (!mediaChanged) {
          mediaUrl = editingMoment.mediaUrl ?? null;
          mediaType = editingMoment.mediaType ?? null;
        } else if (!media) {
          mediaUrl = null;
          mediaType = null;
        } else if (media.isRemote) {
          mediaUrl = media.uri;
          mediaType = media.type;
        } else {
          mediaType = media.type;
          mediaUrl = await uploadMomentMedia(user.uid, media.uri, media.type, setUploadProgress);
        }
        await updateMoment(editingMoment.id, {
          text: momentText.trim(),
          visibility,
          mediaUrl,
          mediaType,
        });
      } else {
        if (media) {
          mediaType = media.type;
          mediaUrl = await uploadMomentMedia(user.uid, media.uri, media.type, setUploadProgress);
        }
        const payload: {
          text: string;
          visibility: MomentVisibility;
          mediaUrl?: string;
          mediaType?: 'image' | 'video';
        } = {
          text: momentText.trim(),
          visibility,
        };
        if (mediaUrl && mediaType) {
          payload.mediaUrl = mediaUrl;
          payload.mediaType = mediaType;
        }
        await createMoment(user.uid, payload);
      }
      resetDraft();
      setCreateVisible(false);
    } catch (error) {
      reportError(error, 'createMoment');
      if (__DEV__) {
        console.error('createMoment error:', error);
      }
      Alert.alert(t('common.error'), t('moments.alerts.postFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handlePickMedia = async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
      videoQuality: 'medium',
    });
    if (result.didCancel || !result.assets?.length) {
      return;
    }
    const asset = result.assets[0];
    if (!asset.uri) {
      return;
    }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    if (type === 'image') {
      try {
        const resized = await ImageResizer.createResizedImage(asset.uri, 1280, 1280, 'JPEG', 80);
        setMedia({uri: resized.uri, type});
      } catch (error) {
        reportError(error, 'moment_image_resize_failed');
        if (__DEV__) {
          console.error('image resize failed:', error);
        }
        setMedia({uri: asset.uri, type});
      }
    } else {
      setMedia({uri: asset.uri, type});
    }
    setMediaChanged(true);
  };

  const handleDeleteMoment = (momentId: string, mediaUrl?: string | null) => {
    Alert.alert(t('moments.alerts.deleteTitle'), t('moments.alerts.deleteConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMoment(momentId, mediaUrl);
          } catch (error) {
            reportError(error, 'deleteMoment');
            if (__DEV__) {
              console.error('deleteMoment error:', error);
            }
            Alert.alert(t('common.error'), t('moments.alerts.deleteFailed'));
          }
        },
      },
    ]);
  };

  const renderItem = ({item}: {item: Moment}) => {
    const author = authorById[item.authorId];
    const authorName = author?.displayName || author?.email || t('profile.defaultName');
    const createdAt =
      (item.createdAt as any)?.toDate?.() ?? (typeof item.createdAt === 'number' ? new Date(item.createdAt) : null);
    const likeInfo = likesByMoment[item.id];
    const likeCount = likeInfo?.count ?? item.likeCount ?? 0;
    const liked = likeInfo?.liked ?? false;
    const commentCount = item.commentCount ?? 0;
    return (
      <RevealOnScroll>
      <GlassView blur={false} style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, {color: colors.text}]}>{authorName}</Text>
          <Text style={[styles.cardMeta, {color: colors.textSecondary}]}>
                {createdAt ? createdAt.toLocaleString() : t('common.justNow')}
          </Text>
        </View>
        <Text style={[styles.cardText, {color: colors.text}]}>{item.text || ''}</Text>
        {item.mediaUrl && item.mediaType === 'image' ? (
          <ExpandingImage
            uri={item.mediaUrl}
            style={styles.media}
            resizeMode="cover"
            accessibilityLabel={t('moments.actions.viewPhoto')}
          />
        ) : null}
        {item.mediaUrl && item.mediaType === 'video' ? (
          <Video source={{uri: item.mediaUrl}} style={styles.media} resizeMode="cover" paused />
        ) : null}
            <Text style={[styles.cardMeta, {color: colors.textSecondary}]}>
              {t('moments.visibilityLabel', {visibility: t(`moments.visibility.${item.visibility}`)})}
            </Text>
        <View style={styles.actionRow}>
          <PressableScale
            style={[
              styles.actionPill,
              {backgroundColor: liked ? colors.primary : colors.surface, borderColor: colors.glassBorder},
            ]}
            onPress={() => handleToggleLike(item, liked)}>
            <Text style={[styles.actionText, {color: liked ? colors.textOnPrimary : colors.text}]}>
                  {liked ? t('moments.actions.liked') : t('moments.actions.like')}{' '}
                  {likeCount > 0 ? `· ${likeCount}` : ''}
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.actionPill, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}
            onPress={() => openComments(item)}>
            <Text style={[styles.actionText, {color: colors.text}]}>
                  {t('moments.actions.comment')} {commentCount > 0 ? `· ${commentCount}` : ''}
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.actionPill, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}
            onPress={() => openShare(item)}>
                <Text style={[styles.actionText, {color: colors.text}]}>{t('moments.actions.share')}</Text>
          </PressableScale>
        </View>
        {item.authorId === user?.uid ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.cardActionButton, {backgroundColor: colors.primary}]}
              onPress={() => openEdit(item)}>
                  <Text style={[styles.cardActionTextPrimary, {color: colors.textOnPrimary}]}>{t('common.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionButton, {backgroundColor: colors.surface}]}
              onPress={() => handleDeleteMoment(item.id, item.mediaUrl)}>
                  <Text style={[styles.cardActionText, {color: colors.text}]}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </GlassView>
      </RevealOnScroll>
    );
  };

  const listHeader = (
    <View>
      <View style={[styles.header, {backgroundColor: colors.backdrop}]}>
        <Text style={[styles.title, {color: colors.text}]}>{t('moments.title')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: colors.surface}]}
            onPress={() => navigation.navigate('Friends' as never)}>
            <Text style={[styles.headerButtonText, {color: colors.text}]}>{t('moments.friends')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: colors.primary}]}
            onPress={openCreate}>
            <Text style={[styles.headerButtonTextPrimary, {color: colors.textOnPrimary}]}>{t('moments.post')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: colors.surface}]}
            onPress={refreshFeed}>
            <Text style={[styles.headerButtonText, {color: colors.text}]}>{t('moments.refresh')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loadError ? (
        <TouchableOpacity style={[styles.errorBanner, {borderColor: colors.glassBorder}]} onPress={refreshFeed}>
          <Text style={[styles.errorText, {color: colors.text}]}>
            {loadError} {t('common.tapToRetry')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <GlassScreen style={styles.container} textureSeed="moments">
      <Animated.FlatList
        data={moments}
        keyExtractor={(item: Moment) => item.id}
        renderItem={renderItem}
        // Publishes scroll offset to the app backdrop and to each card's
        // reveal — see contexts/ScrollMotionContext.
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshing={refreshing}
        onRefresh={refreshFeed}
        ListHeaderComponent={listHeader}
        ListFooterComponent={<View style={styles.listFooter} />}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {t('moments.empty')}
          </Text>
        }
      />

      {createVisible && (
      <Modal visible animationType="slide">
        <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>
            {editingMoment ? t('moments.modal.editTitle') : t('moments.modal.newTitle')}
          </Text>
          <TextInput
            style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
            placeholder={t('moments.modal.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={momentText}
            onChangeText={setMomentText}
            multiline
          />
          {media ? (
            <View style={styles.mediaPreview}>
              {media.type === 'image' ? (
                <Image
                  source={{uri: media.uri}}
                  style={styles.media}
                  resizeMode="cover"
                  resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                />
              ) : (
                <Video source={{uri: media.uri}} style={styles.media} resizeMode="cover" paused />
              )}
            </View>
          ) : null}
          <View style={styles.mediaRow}>
            <TouchableOpacity
              style={[styles.mediaButton, {backgroundColor: colors.surface}]}
              onPress={handlePickMedia}>
              <Text style={[styles.mediaButtonText, {color: colors.text}]}>
                {media ? t('moments.modal.changeMedia') : t('moments.modal.addMedia')}
              </Text>
            </TouchableOpacity>
            {media ? (
              <TouchableOpacity
                style={[styles.mediaButton, {backgroundColor: colors.surface}]}
                onPress={() => {
                  setMedia(null);
                  setMediaChanged(true);
                }}>
                <Text style={[styles.mediaButtonText, {color: colors.text}]}>{t('common.remove')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {uploading ? (
            <View style={styles.uploadRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.uploadText, {color: colors.textSecondary}]}>
                {t('moments.modal.uploading', {percent: uploadProgress})}
              </Text>
            </View>
          ) : null}
          <View style={styles.visibilityRow}>
            {(['friends', 'public', 'private'] as MomentVisibility[]).map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.visibilityButton,
                  {borderColor: colors.glassBorder},
                  visibility === option && {backgroundColor: colors.primary},
                ]}
                onPress={() => setVisibility(option)}>
                <Text
                  style={[
                    styles.visibilityText,
                    {color: visibility === option ? colors.textOnPrimary : colors.text},
                  ]}>
                  {t(`moments.visibility.${option}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.primary}]}
              onPress={handleSaveMoment}
              disabled={!canSubmit}>
              <Text style={[styles.modalButtonTextPrimary, {color: colors.textOnPrimary}]}>
                {editingMoment ? t('common.update') : t('common.post')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.surface}]}
              onPress={() => {
                setCreateVisible(false);
                resetDraft();
              }}>
              <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      )}
      {commentsVisible && (
      <Modal visible animationType="slide" onRequestClose={closeComments}>
        <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>{t('moments.comments.title')}</Text>
          <FlatList
            data={comments}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            ListEmptyComponent={
              <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
                {t('moments.comments.empty')}
              </Text>
            }
            renderItem={({item}) => {
              const author = commentAuthors[item.authorId];
              const name = author?.displayName || author?.email || item.authorId;
              return (
                <View style={[styles.commentCard, {borderColor: colors.glassBorder}]}>
                  <Text style={[styles.commentAuthor, {color: colors.text}]}>{name}</Text>
                  <Text style={[styles.commentText, {color: colors.text}]}>{item.text}</Text>
                </View>
              );
            }}
          />
          <View style={[styles.commentInputRow, {borderColor: colors.glassBorder}]}>
            <TextInput
              style={[styles.commentInput, {color: colors.text}]}
              placeholder={t('moments.comments.placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={commentDraft}
              onChangeText={setCommentDraft}
            />
            <TouchableOpacity
              style={[styles.commentSend, {backgroundColor: colors.primary}]}
              onPress={handleSubmitComment}>
              <Text style={[styles.commentSendText, {color: colors.textOnPrimary}]}>{t('moments.comments.post')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.modalClose} onPress={closeComments}>
            <Text style={[styles.modalCloseText, {color: colors.primary}]}>
              {t('moments.comments.close')}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
      )}
      {shareVisible && (
      <Modal visible animationType="slide" onRequestClose={closeShare}>
        <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>{t('moments.share.title')}</Text>
          {shareLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <FlatList
              data={shareChats}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={7}
              removeClippedSubviews={Platform.OS === 'android'}
              ListEmptyComponent={
                <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
                  {t('chatList.empty')}
                </Text>
              }
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[styles.shareRow, {borderColor: colors.glassBorder}]}
                  onPress={() => handleShareToChat(item.id)}>
                  <Text style={[styles.shareName, {color: colors.text}]}>
                    {shareNames[item.id] || item.name || t('headers.chat')}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
          <TouchableOpacity style={styles.modalClose} onPress={closeShare}>
            <Text style={[styles.modalCloseText, {color: colors.primary}]}>
              {t('moments.share.close')}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listFooter: {
    height: 24,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardText: {
    fontSize: 15,
    marginBottom: 8,
  },
  media: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  actionPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cardActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cardActionText: {
    fontWeight: '600',
  },
  cardActionTextPrimary: {
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  commentCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 1,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderColor: 'transparent',
  },
  commentSend: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  commentSendText: {
    fontWeight: '600',
  },
  modalClose: {
    marginTop: 16,
    alignItems: 'center',
  },
  modalCloseText: {
    fontWeight: '600',
  },
  shareRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  shareName: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInput: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  mediaPreview: {
    marginTop: 12,
  },
  mediaButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  mediaButtonText: {
    fontWeight: '600',
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  uploadText: {
    fontSize: 12,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  visibilityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  visibilityText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    fontWeight: '600',
  },
});

