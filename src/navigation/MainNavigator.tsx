import React, {useEffect, useMemo, useState} from 'react';
import {Platform, StyleSheet, useColorScheme} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import NewChatScreen from '../screens/chat/NewChatScreen';
import ChatMediaScreen from '../screens/chat/ChatMediaScreen';
import ChatSettingsScreen from '../screens/chat/ChatSettingsScreen';
import CallScreen from '../screens/chat/CallScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StoreScreen from '../screens/StoreScreen';
import RecentlyDeletedScreen from '../screens/chat/RecentlyDeletedScreen';
import MomentsScreen from '../screens/moments/MomentsScreen';
import FriendsScreen from '../screens/moments/FriendsScreen';
import {lazyLoad} from '../utils/lazyLoading';

// Less-frequently-visited screens are lazy-loaded: with Babel's inlineRequires
// (see metro.config.js) a plain `import` still gets evaluated the first time
// ANY screen in the same stack renders (all `<Stack.Screen component={X}>`
// entries are dereferenced together when the stack mounts), so without this
// every one of these modules' top-level work runs on first opening the Chats
// tab. Wrapping them in React.lazy defers that work until the user actually
// navigates to each specific screen.
const WhiteboardScreen = lazyLoad(() => import('../screens/chat/WhiteboardScreen'));
const PlaylistScreen = lazyLoad(() => import('../screens/chat/PlaylistScreen'));
const CountdownScreen = lazyLoad(() => import('../screens/chat/CountdownScreen'));
const BookmarksScreen = lazyLoad(() => import('../screens/BookmarksScreen'));
const PrivacyPolicyScreen = lazyLoad(() => import('../screens/PrivacyPolicyScreen'));
const RecoveryPhraseScreen = lazyLoad(() => import('../screens/RecoveryPhraseScreen'));
import {useAuth} from '../contexts/AuthContext';
import {listenFriends, listenFriendRequests} from '../services/friends';
import {listenMomentsForAuthors} from '../services/moments';
import {listenChatsForUser} from '../services/firebaseChat';
import {getMomentsLastSeen, onMomentsLastSeen} from '../services/notifications';
import {Friend, Moment} from '../types';
import {getColors} from '../theme/colors';
import GlassView from '../components/GlassView';
import TabIcon from '../components/TabIcon';
import {useTranslation} from 'react-i18next';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  const colors = getColors(useColorScheme());
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const {t} = useTranslation();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [momentsLastSeen, setMomentsLastSeen] = useState(0);
  const [momentsReady, setMomentsReady] = useState(false);
  const [hasNewMoments, setHasNewMoments] = useState(false);
  const [hasUnreadChats, setHasUnreadChats] = useState(false);
  const [hasFriendRequests, setHasFriendRequests] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setFriends([]);
      setMomentsLastSeen(0);
      setMomentsReady(false);
      setHasNewMoments(false);
      setHasUnreadChats(false);
      setHasFriendRequests(false);
      return;
    }
    let active = true;
    getMomentsLastSeen(user.uid)
      .then(timestamp => {
        if (active) {
          setMomentsLastSeen(timestamp);
          setMomentsReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setMomentsLastSeen(0);
          setMomentsReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return onMomentsLastSeen(({userId, timestamp}) => {
      if (userId === user.uid) {
        setMomentsLastSeen(timestamp);
      }
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = listenFriends(user.uid, setFriends);
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = listenFriendRequests(user.uid, requests => {
      setHasFriendRequests(requests.length > 0);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = listenChatsForUser(user.uid, chats => {
      const hasUnread = chats.some(chat => (chat.unreadCountBy?.[user.uid] || 0) > 0);
      setHasUnreadChats(hasUnread);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const friendIds = useMemo(() => {
    if (!user?.uid) return [];
    return friends
      .map(friend => friend.userIds.find(id => id !== user.uid))
      .filter(Boolean) as string[];
  }, [friends, user?.uid]);

  const friendIdsKey = useMemo(() => friendIds.join(','), [friendIds]);

  useEffect(() => {
    if (!user?.uid || !momentsReady) return;
    const getMomentTime = (moment: Moment) => {
      const raw = (moment.updatedAt as any) ?? (moment.createdAt as any);
      if (raw?.toMillis) return raw.toMillis();
      if (raw?.toDate) return raw.toDate().getTime();
      if (typeof raw === 'number') return raw;
      if (typeof moment.clientCreatedAt === 'number') return moment.clientCreatedAt;
      return 0;
    };
    const unsubscribe = listenMomentsForAuthors(user.uid, friendIds, moments => {
      const latest = moments.reduce((max, moment) => Math.max(max, getMomentTime(moment)), 0);
      setHasNewMoments(latest > momentsLastSeen);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, friendIdsKey, momentsLastSeen, momentsReady]);

  const showChatsBadge = hasUnreadChats;
  const showMomentsBadge = hasNewMoments || hasFriendRequests;

  const headerTitleStyle = useMemo(
    () => ({color: colors.text, fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2}),
    [colors.text],
  );
  const headerBg = React.useCallback(
    () => <GlassView pointerEvents="none" blur={false} style={styles.headerGlass} />,
    [],
  );
  const stackScreenOptions = useMemo(
    () => ({
      headerTransparent: false,
      headerTitleStyle,
      headerTintColor: colors.primary,
      headerShadowVisible: false,
      headerStyle: styles.transparentBg,
      headerBackground: headerBg,
      contentStyle: styles.transparentBg,
    }),
    [headerTitleStyle, colors.primary, headerBg],
  );

  const tabBarBg = React.useCallback(
    () => <GlassView pointerEvents="none" blur={false} style={styles.tabBarGlass} />,
    [],
  );
  // Android's bottom inset was hardcoded to 28, which happens to be about the
  // gesture-pill inset and so looked right on gesture-nav devices — but a
  // three-button nav bar is roughly 48dp, and the system bar then sat on top of
  // the tab labels. Taking the larger of the two keeps the gesture-nav look
  // byte-identical while giving three-button devices the room they need.
  const tabBarInset =
    Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 28);
  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        backgroundColor: 'transparent' as const,
        borderTopColor: colors.glassBorder,
        height: (Platform.OS === 'ios' ? 88 : 60) + tabBarInset,
        paddingBottom: tabBarInset,
      },
    ],
    [colors.glassBorder, tabBarInset],
  );
  const chatIcon = React.useCallback(({color}: {color: string}) => <TabIcon name="chats" color={color} />, []);
  const momentsIcon = React.useCallback(({color}: {color: string}) => <TabIcon name="moments" color={color} />, []);
  const storeIcon = React.useCallback(({color}: {color: string}) => <TabIcon name="store" color={color} />, []);
  const profileIcon = React.useCallback(({color}: {color: string}) => <TabIcon name="profile" color={color} />, []);

  const ChatStack = useMemo(() => {
    function _ChatStack() {
      return (
        <Stack.Navigator screenOptions={stackScreenOptions}>
          <Stack.Screen
            name="ChatList"
            component={ChatListScreen}
            options={{title: t('headers.chats'), headerShown: false}}
          />
          <Stack.Screen
            name="NewChat"
            component={NewChatScreen}
            options={{title: t('headers.newChat')}}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({route}: any) => ({
              title: route.params?.chatName || t('headers.chat'),
            })}
          />
          <Stack.Screen
            name="ChatMedia"
            component={ChatMediaScreen}
            options={{title: t('headers.media')}}
          />
          <Stack.Screen
            name="ChatSettings"
            component={ChatSettingsScreen}
            options={{title: t('headers.chatSettings')}}
          />
          <Stack.Screen
            name="RecentlyDeleted"
            component={RecentlyDeletedScreen}
            options={{title: t('trash.title')}}
          />
          <Stack.Screen
            name="Call"
            component={CallScreen}
            options={{title: t('headers.call')}}
          />
          <Stack.Screen
            name="Whiteboard"
            component={WhiteboardScreen}
            options={{title: 'Whiteboard'}}
          />
          <Stack.Screen
            name="Bookmarks"
            component={BookmarksScreen}
            options={{title: 'Saved Messages'}}
          />
          <Stack.Screen
            name="Playlist"
            component={PlaylistScreen}
            options={{title: 'Playlist'}}
          />
          <Stack.Screen
            name="Countdown"
            component={CountdownScreen}
            options={{title: 'Countdowns'}}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{title: 'Privacy Policy'}}
          />
          <Stack.Screen
            name="RecoveryPhrase"
            component={RecoveryPhraseScreen}
            options={{title: 'Recovery Phrase'}}
          />
        </Stack.Navigator>
      );
    }
    return _ChatStack;
  }, [stackScreenOptions, t]);

  const MomentsStack = useMemo(() => {
    function _MomentsStack() {
      return (
        <Stack.Navigator screenOptions={stackScreenOptions}>
          <Stack.Screen name="Moments" component={MomentsScreen} options={{title: t('headers.moments'), headerShown: false}} />
          <Stack.Screen name="Friends" component={FriendsScreen} options={{title: t('headers.friends')}} />
        </Stack.Navigator>
      );
    }
    return _MomentsStack;
  }, [stackScreenOptions, t]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle,
        tabBarBackground: tabBarBg,
      }}>
      <Tab.Screen
        name="Chats"
        component={ChatStack}
        options={{
          tabBarLabel: t('tabs.chats'),
          tabBarIcon: chatIcon,
          tabBarBadge: showChatsBadge ? ' ' : undefined,
          tabBarBadgeStyle: styles.tabBadge,
        }}
      />
      <Tab.Screen
        name="MomentsTab"
        component={MomentsStack}
        options={{
          tabBarLabel: t('tabs.moments'),
          tabBarIcon: momentsIcon,
          tabBarBadge: showMomentsBadge ? ' ' : undefined,
          tabBarBadgeStyle: styles.tabBadge,
        }}
      />
      <Tab.Screen
        name="Store"
        component={StoreScreen}
        options={{
          tabBarLabel: t('tabs.store'),
          tabBarIcon: storeIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: profileIcon,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  transparentBg: {
    backgroundColor: 'transparent',
  },
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    height: 88,
    paddingBottom: 28,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  tabBadge: {
    backgroundColor: '#FF453A',
    color: 'transparent',
    minWidth: 9,
    height: 9,
    borderRadius: 2.5,
    top: 2,
    right: -4,
  },
  tabBarGlass: {
    ...StyleSheet.absoluteFillObject,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
  },
});

