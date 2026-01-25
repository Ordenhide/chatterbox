import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import NewChatScreen from '../screens/chat/NewChatScreen';
import ChatMediaScreen from '../screens/chat/ChatMediaScreen';
import ChatSettingsScreen from '../screens/chat/ChatSettingsScreen';
import CallScreen from '../screens/chat/CallScreen';
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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  const colors = getColors(useColorScheme());
  const {user} = useAuth();
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
  }, [user?.uid, friendIds.join(','), momentsLastSeen, momentsReady]);

  const showChatsBadge = hasUnreadChats;
  const showMomentsBadge = hasNewMoments || hasFriendRequests;

  const stackScreenOptions = {
    headerTransparent: false,
    headerTitleStyle: {color: colors.text},
    headerTintColor: colors.text,
    headerShadowVisible: false,
    headerStyle: {backgroundColor: 'transparent'},
    headerBackground: () => <GlassView pointerEvents="none" blur={false} style={styles.headerGlass} />,
    contentStyle: {backgroundColor: 'transparent'},
  };

  function ChatStack() {
    return (
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="ChatList"
          component={ChatListScreen}
          options={{title: 'Chats', headerShown: false}}
        />
        <Stack.Screen
          name="NewChat"
          component={NewChatScreen}
          options={{title: 'New Chat'}}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({route}: any) => ({
            title: route.params?.chatName || 'Chat',
          })}
        />
        <Stack.Screen
          name="ChatMedia"
          component={ChatMediaScreen}
          options={{title: 'Media'}}
        />
        <Stack.Screen
          name="ChatSettings"
          component={ChatSettingsScreen}
          options={{title: 'Chat Settings'}}
        />
        <Stack.Screen
          name="Call"
          component={CallScreen}
          options={{title: 'Call'}}
        />
      </Stack.Navigator>
    );
  }

  function MomentsStack() {
    return (
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="Moments" component={MomentsScreen} options={{title: 'Moments', headerShown: false}} />
        <Stack.Screen name="Friends" component={FriendsScreen} options={{title: 'Friends'}} />
      </Stack.Navigator>
    );
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: [
          styles.tabBar,
          {backgroundColor: 'transparent', borderTopColor: colors.glassBorder},
        ],
        tabBarBackground: () => <GlassView pointerEvents="none" blur={false} style={styles.tabBarGlass} />,
      }}>
      <Tab.Screen
        name="Chats"
        component={ChatStack}
        options={{
          tabBarLabel: 'Chats',
          tabBarBadge: showChatsBadge ? ' ' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#FF3B30',
            color: 'transparent',
            minWidth: 8,
            height: 8,
            borderRadius: 4,
          },
        }}
      />
      <Tab.Screen
        name="MomentsTab"
        component={MomentsStack}
        options={{
          tabBarLabel: 'Moments',
          tabBarBadge: showMomentsBadge ? ' ' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#FF3B30',
            color: 'transparent',
            minWidth: 8,
            height: 8,
            borderRadius: 4,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  tabBarGlass: {
    ...StyleSheet.absoluteFillObject,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
  },
});

