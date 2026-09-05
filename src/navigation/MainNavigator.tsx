import React, {useEffect, useMemo, useState} from 'react';
import {Platform, StyleSheet, useColorScheme} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import {lazyLoad} from '../utils/lazyLoading';

// Everything off the startup path is lazy-loaded: with Babel's inlineRequires
// (see metro.config.js) a plain `import` still gets evaluated the first time
// ANY screen in the same stack renders (all `<Stack.Screen component={X}>`
// entries are dereferenced together when the stack mounts), so without this
// every one of these modules' top-level work runs on first opening the Chats
// tab. Wrapping them in React.lazy defers that work until the user actually
// navigates to each specific screen.
//
// ChatListScreen and ChatScreen are deliberately NOT here. The first is what
// launch renders, and the second is what launch exists to get you to — making
// either lazy would move cost onto the path being optimised rather than off
// it. The nine below are ~5,000 lines that a cold start has no reason to
// evaluate: Profile, Store, Moments, Friends, Call, and the chat sub-screens.
const ProfileScreen = lazyLoad(() => import('../screens/ProfileScreen'));
const StoreScreen = lazyLoad(() => import('../screens/StoreScreen'));
const FriendsScreen = lazyLoad(() => import('../screens/moments/FriendsScreen'));
const CallScreen = lazyLoad(() => import('../screens/chat/CallScreen'));
const ChatSettingsScreen = lazyLoad(() => import('../screens/chat/ChatSettingsScreen'));
const ChatMediaScreen = lazyLoad(() => import('../screens/chat/ChatMediaScreen'));
const NewChatScreen = lazyLoad(() => import('../screens/chat/NewChatScreen'));
const RecentlyDeletedScreen = lazyLoad(() => import('../screens/chat/RecentlyDeletedScreen'));
const BookmarksScreen = lazyLoad(() => import('../screens/BookmarksScreen'));
const PrivacyPolicyScreen = lazyLoad(() => import('../screens/PrivacyPolicyScreen'));
const RecoveryPhraseScreen = lazyLoad(() => import('../screens/RecoveryPhraseScreen'));
import {useAuth} from '../contexts/AuthContext';
import {listenFriends, listenFriendRequests} from '../services/friends';
import {listenChatsForUser} from '../services/firebaseChat';
import {Friend} from '../types';
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
  const [hasUnreadChats, setHasUnreadChats] = useState(false);
  const [hasFriendRequests, setHasFriendRequests] = useState(false);

  // Clears the badges on sign-out. The listeners below each bail on a missing
  // uid, but they do not run their cleanups until the *next* uid arrives, so
  // without this the previous account's badges survive the sign-out.
  useEffect(() => {
    if (user?.uid) return;
    setFriends([]);
    setHasUnreadChats(false);
    setHasFriendRequests(false);
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

  const showChatsBadge = hasUnreadChats;
  // Friend requests were one of two things this badge meant; the other was
  // new moments, which no longer exist.
  const showFriendsBadge = hasFriendRequests;

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
            name="Bookmarks"
            component={BookmarksScreen}
            options={{title: 'Saved Messages'}}
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
          {/* Rehoused from the Moments tab, which is gone. Contacts belong
              next to the conversations they start, not behind a feed. */}
          <Stack.Screen
            name="Friends"
            component={FriendsScreen}
            options={{title: t('headers.friends')}}
          />
        </Stack.Navigator>
      );
    }
    return _ChatStack;
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
    end: -4,
  },
  tabBarGlass: {
    ...StyleSheet.absoluteFillObject,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
  },
});

