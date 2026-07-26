import {useEffect, useMemo, useState} from 'react';
import type {User} from 'firebase/auth';
import {avatarColor, colors} from '../theme';
import {useT} from '../i18n';
import {getUserById, listenChatsForUser} from '../services/chat';
import {useIsMobile} from '../hooks/useIsMobile';
import type {ChatRoom, UserProfile} from '../types';
import ChatPane from '../components/ChatPane';
import NewChatModal from '../components/NewChatModal';
import Icon from '../components/Icon';

export default function HomeScreen({
  user,
  selectedId,
  onSelectChat,
}: {
  user: User;
  selectedId: string | null;
  onSelectChat: (id: string | null) => void;
}) {
  const {t} = useT();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [userCache, setUserCache] = useState<Record<string, UserProfile>>({});
  const [showNewChat, setShowNewChat] = useState(false);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => listenChatsForUser(user.uid, setChats), [user.uid]);

  useEffect(() => {
    const missing = new Set<string>();
    chats.forEach(c =>
      c.participants.forEach(uid => {
        if (uid !== user.uid && !userCache[uid]) missing.add(uid);
      }),
    );
    if (missing.size === 0) return;
    let active = true;
    Promise.all(Array.from(missing).map(uid => getUserById(uid).then(p => [uid, p] as const))).then(
      pairs => {
        if (!active) return;
        setUserCache(prev => {
          const next = {...prev};
          for (const [uid, p] of pairs) if (p) next[uid] = p;
          return next;
        });
      },
    );
    return () => {
      active = false;
    };
  }, [chats, user.uid, userCache]);

  const chatMeta = useMemo(
    () => (chat: ChatRoom) => {
      const custom = chat.nameBy?.[user.uid];
      const otherUid = chat.participants.find(p => p !== user.uid) || chat.id;
      const other = otherUid ? userCache[otherUid] : undefined;
      const title = custom || other?.displayName || other?.email || chat.name || 'Chat';
      return {title, seed: otherUid};
    },
    [user.uid, userCache],
  );

  const orderedChats = useMemo(() => {
    const pinned = (c: ChatRoom) => (c.pinnedBy?.includes(user.uid) ? 0 : 1);
    const list = [...chats].sort((a, b) => pinned(a) - pinned(b));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      c => chatMeta(c).title.toLowerCase().includes(q) || (c.lastMessage?.text || '').toLowerCase().includes(q),
    );
  }, [chats, user.uid, search, chatMeta]);

  const selectedChat = chats.find(c => c.id === selectedId) || null;
  const myName = user.displayName || user.email || 'Me';

  // On mobile, show the list OR the open chat — never both side by side.
  const showSidebar = !isMobile || !selectedChat;
  const showMain = !isMobile || !!selectedChat;

  return (
    <div style={styles.shell}>
      {showSidebar && (
      <aside style={{...styles.sidebar, ...(isMobile ? styles.sidebarMobile : null)}}>
        <div style={styles.sidebarHeader}>
          <span style={styles.brand}>{t('chats.title')}</span>
          <button
            className="btn btn-primary"
            style={styles.newBtn}
            data-tour="new-chat"
            onClick={() => setShowNewChat(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {t('chats.newChat')}
          </button>
        </div>

        <div style={styles.searchWrap}>
          <svg style={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            style={styles.searchInput}
            placeholder={t('chats.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="scroll" style={styles.chatList}>
          {orderedChats.length === 0 ? (
            <div style={styles.emptyList}>{search ? t('chat.noMatch') : t('chats.empty')}</div>
          ) : (
            orderedChats.map(chat => {
              const {title, seed} = chatMeta(chat);
              const unread = chat.unreadCountBy?.[user.uid] || 0;
              const active = chat.id === selectedId;
              const pinned = chat.pinnedBy?.includes(user.uid);
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`chat-item${active ? ' active' : ''}`}>
                  <div style={{...styles.avatar, background: avatarColor(seed)}}>
                    {title.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={styles.chatTopRow}>
                      <span style={styles.chatName}>
                        {pinned && (
                          <Icon name="pin" size={12} style={{marginRight: 4, verticalAlign: '-1px', color: colors.textTertiary}} />
                        )}
                        {title}
                      </span>
                      <span style={styles.chatTime}>{formatTime(chat)}</span>
                    </div>
                    <div style={styles.chatBottomRow}>
                      <span style={{...styles.chatPreview, fontWeight: unread ? 600 : 400, color: unread ? colors.text : colors.textSecondary}}>
                        {chat.lastMessage?.text || t('chat.empty')}
                      </span>
                      {unread > 0 && <span style={styles.badge}>{unread}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>
      )}

      {showMain && (
      <main style={styles.main}>
        {selectedChat ? (
          <ChatPane
            key={selectedChat.id}
            chatId={selectedChat.id}
            title={chatMeta(selectedChat).title}
            me={{uid: user.uid, name: myName}}
            onDeleted={() => onSelectChat(null)}
            onBack={isMobile ? () => onSelectChat(null) : undefined}
          />
        ) : (
          <div style={styles.emptyState} className="fade-in">
            <div style={styles.emptyIcon}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.6">
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 style={styles.emptyTitle}>{t('chats.title')}</h2>
            <p style={styles.emptySub}>{t('chats.pickAConversation')}</p>
            <button className="btn btn-primary" style={styles.emptyCta} onClick={() => setShowNewChat(true)}>
              {t('chats.newChat')}
            </button>
          </div>
        )}
      </main>
      )}

      {showNewChat && (
        <NewChatModal
          myUid={user.uid}
          onClose={() => setShowNewChat(false)}
          onCreated={id => {
            setShowNewChat(false);
            onSelectChat(id);
          }}
        />
      )}
    </div>
  );
}

function formatTime(chat: ChatRoom): string {
  const ts = chat.lastMessage?.createdAt || chat.updatedAt;
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    : d.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

const styles: Record<string, React.CSSProperties> = {
  shell: {flex: 1, minWidth: 0, height: '100%', display: 'flex'},
  sidebar: {
    width: 340,
    flexShrink: 0,
    background: colors.surface,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarMobile: {width: '100%', flex: 1, borderRight: 'none'},
  sidebarHeader: {
    padding: '20px 18px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 26, fontWeight: 800, letterSpacing: '-0.6px', color: colors.text},
  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 15px',
    fontSize: 13,
  },
  searchWrap: {position: 'relative', padding: '4px 14px 10px'},
  searchIcon: {position: 'absolute', left: 26, top: 14, color: colors.textTertiary},
  searchInput: {
    width: '100%',
    padding: '10px 14px 10px 38px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 14,
    color: colors.text,
  },
  chatList: {flex: 1, overflowY: 'auto', padding: '2px 8px 8px'},
  emptyList: {padding: 24, color: colors.textSecondary, fontSize: 14, textAlign: 'center'},
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 17,
    flexShrink: 0,
  },
  chatTopRow: {display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8},
  chatBottomRow: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2},
  pin: {fontSize: 11},
  chatName: {
    fontWeight: 700,
    fontSize: 15,
    color: colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chatTime: {fontSize: 12, color: colors.textTertiary, flexShrink: 0},
  chatPreview: {
    fontSize: 13.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  badge: {
    background: colors.primary,
    color: '#fff',
    fontSize: 11.5,
    fontWeight: 700,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    flexShrink: 0,
  },
  main: {flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'},
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    background: colors.primaryLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  emptyTitle: {fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 8px', color: colors.text},
  emptySub: {fontSize: 15, color: colors.textSecondary, margin: '0 0 22px', maxWidth: 320, lineHeight: 1.5},
  emptyCta: {padding: '12px 24px', fontSize: 15},
};
