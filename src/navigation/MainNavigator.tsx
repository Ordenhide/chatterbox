import React, {useEffect, useMemo, useState} from 'react';
import {Platform, StyleSheet, Text, useColorScheme} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import NewChatScreen from '../screens/chat/NewChatScreen';
import ChatMediaScreen from '../screens/chat/ChatMediaScreen';
import ChatSettingsScreen from '../screens/chat/ChatSettingsScreen';
import CallScreen from '../screens/chat/CallScreen';
import WhiteboardScreen from '../screens/chat/WhiteboardScreen';
import QuoteWallScreen from '../screens/chat/QuoteWallScreen';
import ChatWrappedScreen from '../screens/chat/ChatWrappedScreen';
import RitualsScreen from '../screens/chat/RitualsScreen';
import PlaylistScreen from '../screens/chat/PlaylistScreen';
import CountdownScreen from '../screens/chat/CountdownScreen';
import ChatTimelineScreen from '../screens/chat/ChatTimelineScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PrivacyDashboardScreen from '../screens/PrivacyDashboardScreen';
import SecureVaultScreen from '../screens/SecureVaultScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MomentsScreen from '../screens/moments/MomentsScreen';
import FriendsScreen from '../screens/moments/FriendsScreen';
import {useAuth} from '../contexts/AuthContext';
import {listenFriends, listenFriendRequests} from '../services/friends';
import {listenMomentsForAuthors} from '../services/moments';
import {listenChatsForUser} from '../services/firebaseChat';
import {getMomentsLastSeen, onMomentsLastSeen} from '../services/notifications';
import {Friend, Moment} from '../types';
import {getColors} from '../theme/colors';
import GlassView from '../components/GlassView';
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
  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        backgroundColor: 'transparent' as const,
        borderTopColor: colors.glassBorder,
        height: Platform.OS === 'ios' ? 88 + insets.bottom : 88,
        paddingBottom: Platform.OS === 'ios' ? insets.bottom : 28,
      },
    ],
    [colors.glassBorder, insets.bottom],
  );
  const chatIcon = React.useCallback(() => <Text style={styles.tabIcon}>{'💬'}</Text>, []);
  const momentsIcon = React.useCallback(() => <Text style={styles.tabIcon}>{'✨'}</Text>, []);
  const profileIcon = React.useCallback(() => <Text style={styles.tabIcon}>👤</Text>, []);

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
            name="QuoteWall"
            component={QuoteWallScreen}
            options={{title: 'Quote Wall'}}
          />
          <Stack.Screen
            name="Bookmarks"
            component={BookmarksScreen}
            options={{title: 'Saved Messages'}}
          />
          <Stack.Screen
            name="Memories"
            component={MemoriesScreen}
            options={{title: 'Memories'}}
          />
          <Stack.Screen
            name="ChatWrapped"
            component={ChatWrappedScreen}
            options={{title: 'Year in Review'}}
          />
          <Stack.Screen
            name="Rituals"
            component={RitualsScreen}
            options={{title: 'Chat Rituals'}}
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
            name="ChatTimeline"
            component={ChatTimelineScreen}
            options={{title: 'Timeline'}}
          />
          <Stack.Screen
            name="PrivacyDashboard"
            component={PrivacyDashboardScreen}
            options={{title: 'Privacy & Security'}}
          />
          <Stack.Screen
            name="SecureVault"
            component={SecureVaultScreen}
            options={{title: 'Secure Vault'}}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{title: 'Privacy Policy'}}
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
  tabIcon: {
    fontSize: 22,
  },
  tabBadge: {
    backgroundColor: '#FF453A',
    color: 'transparent',
    minWidth: 9,
    height: 9,
    borderRadius: 4.5,
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

