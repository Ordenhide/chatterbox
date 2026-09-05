import {useEffect, useMemo, useRef, useState} from 'react';
import type {User} from 'firebase/auth';
import {avatarColor, colors} from '../theme';
import {useT} from '../i18n';
import {listenChatsForUser, toggleHideChat} from '../services/chat';
import {partitionChats, unreadTotal} from '../services/hiddenChats';
import {useToast} from '../context/ToastContext';
import {useIsMobile} from '../hooks/useIsMobile';
import {useChatUserCache} from '../hooks/useChatUserCache';
import {resolveChatMeta} from '../utils/chatMeta';
import type {ChatRoom} from '../types';
import Cascade from '../components/Cascade';
import ChatPane from '../components/ChatPane';
import NewChatModal from '../components/NewChatModal';
import InviteModal from '../components/InviteModal';
import Icon from '../components/Icon';
import {SHORTCUT_EVENT, stepChat, type ShortcutId} from '../services/shortcuts';

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
  const userCache = useChatUserCache(chats, user.uid);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState('');
  // The hidden list is a separate view of the same sidebar rather than a
  // section inside it — a collapsed group still advertises that hidden chats
  // exist every time you glance at the list.
  const [viewingHidden, setViewingHidden] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const toast = useToast();

  useEffect(() => listenChatsForUser(user.uid, setChats), [user.uid]);

  const chatMeta = useMemo(
    () => (chat: ChatRoom) => resolveChatMeta(chat, user.uid, userCache),
    [user.uid, userCache],
  );

  const {visible: visibleChats, hidden: hiddenChats} = useMemo(
    () => partitionChats(chats, user.uid),
    [chats, user.uid],
  );
  const hiddenUnread = useMemo(() => unreadTotal(hiddenChats, user.uid), [hiddenChats, user.uid]);

  const orderedChats = useMemo(() => {
    const source = viewingHidden ? hiddenChats : visibleChats;
    const pinned = (c: ChatRoom) => (c.pinnedBy?.includes(user.uid) ? 0 : 1);
    const list = [...source].sort((a, b) => pinned(a) - pinned(b));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      c => chatMeta(c).title.toLowerCase().includes(q) || (c.lastMessage?.text || '').toLowerCase().includes(q),
    );
  }, [visibleChats, hiddenChats, viewingHidden, user.uid, search, chatMeta]);

  /**
   * Chat-list shortcuts, dispatched by the app shell (see services/shortcuts).
   * Handled here because this is where the *filtered, ordered* list lives —
   * stepping through anything else would not match what is on screen.
   */
  useEffect(() => {
    const onShortcut = (e: Event) => {
      const id = (e as CustomEvent<ShortcutId>).detail;
      if (id === 'newChat') {
        setShowNewChat(true);
        return;
      }
      if (id === 'closeOrClear') {
        // Escape clears an active filter first; only then does it give up
        // focus, so one press never does both and loses your place.
        if (search) setSearch('');
        else searchRef.current?.blur();
        return;
      }
      if (id === 'prevChat' || id === 'nextChat') {
        const next = stepChat(orderedChats.map(c => c.id), selectedId, id === 'nextChat' ? 1 : -1);
        if (next) onSelectChat(next);
      }
    };
    window.addEventListener(SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(SHORTCUT_EVENT, onShortcut);
  }, [orderedChats, selectedId, onSelectChat, search]);

  /**
   * Hiding the chat you're reading would leave it open with no way back to it
   * from the list, so close it on the way out.
   */
  const setHidden = async (chat: ChatRoom, hidden: boolean) => {
    try {
      await toggleHideChat(chat.id, user.uid, hidden);
      if (!hidden && selectedId === chat.id) onSelectChat(null);
      toast.show(t(hidden ? 'chats.recovered' : 'chats.hidden'));
    } catch {
      toast.error(t('common.error'));
    }
  };

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
          {viewingHidden ? (
            <>
              <button
                style={styles.backBtn}
                aria-label={t('common.close')}
                onClick={() => {
                  setViewingHidden(false);
                  setSearch('');
                }}>
                <Icon name="back" size={20} />
              </button>
              <h1 style={styles.brand}>{t('chats.hiddenTitle')}</h1>
            </>
          ) : (
            <>
              <h1 style={styles.brand}>{t('chats.title')}</h1>
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
            </>
          )}
        </div>

        <div style={styles.searchWrap}>
          <svg style={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            style={styles.searchInput}
            placeholder={t('chats.search')}
            aria-label={t('chats.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="scroll" style={styles.chatList}>
          {orderedChats.length === 0 ? (
            <Cascade index={0}>
              <div style={styles.emptyList}>
                {search ? t('chat.noMatch') : viewingHidden ? t('chats.hiddenEmpty') : t('chats.empty')}
              </div>
            </Cascade>
          ) : (
            orderedChats.map((chat, i) => {
              const {title, seed} = chatMeta(chat);
              const unread = chat.unreadCountBy?.[user.uid] || 0;
              const active = chat.id === selectedId;
              const pinned = chat.pinnedBy?.includes(user.uid);
              return (
                <div
                  key={chat.id}
                  className="chat-row"
                  // Capped at 10 steps: past that the stagger stops reading as
                  // a cascade and just becomes the last rows arriving late.
                  style={{'--cb-stagger': `${Math.min(i, 10) * 28}ms`} as React.CSSProperties}>
                <button
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
                      {unread > 0 && <span className="cb-badge" style={styles.badge}>{unread}</span>}
                    </div>
                  </div>
                </button>
                {/* A sibling of the row button, never a child: an interactive
                    element nested inside another is invalid, and its label gets
                    absorbed into the row's own accessible name — which made the
                    control unclickable, selecting the chat instead. */}
                <button
                  className="chat-hide-btn"
                  style={styles.hideBtn}
                  aria-label={`${viewingHidden ? t('chats.recover') : t('chats.hide')} — ${title}`}
                  title={viewingHidden ? t('chats.recover') : t('chats.hide')}
                  onClick={() => setHidden(chat, viewingHidden)}>
                  <Icon name={viewingHidden ? 'eye' : 'eyeOff'} size={16} />
                </button>
                </div>
              );
            })
          )}
        </div>

        {/* Only advertised once something is actually hidden — an always-present
            "Hidden (0)" row would defeat the point of hiding a chat. */}
        {!viewingHidden && hiddenChats.length > 0 && (
          <button style={styles.hiddenEntry} onClick={() => setViewingHidden(true)}>
            <Icon name="eyeOff" size={16} />
            <span style={{flex: 1, textAlign: 'left'}}>{t('chats.hiddenTitle')}</span>
            <span style={styles.hiddenCount}>
              {hiddenUnread > 0 ? `${hiddenChats.length} · ${hiddenUnread}` : hiddenChats.length}
            </span>
          </button>
        )}
      </aside>
      )}

      {showMain && (
      // A plain div, not a <main> — MainApp.tsx already provides the single
      // main landmark for whichever tab is active, and a second one here
      // would violate axe's landmark-no-duplicate-main/landmark-unique rules.
      <div style={styles.main}>
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
      </div>
      )}

      {showNewChat && (
        <NewChatModal
          myUid={user.uid}
          onClose={() => setShowNewChat(false)}
          onUseInvite={() => {
            setShowNewChat(false);
            setShowInvite(true);
          }}
          onCreated={id => {
            setShowNewChat(false);
            onSelectChat(id);
          }}
        />
      )}

      {showInvite && (
        <InviteModal
          myUid={user.uid}
          onClose={() => setShowInvite(false)}
          onCreated={id => {
            setShowInvite(false);
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
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  hideBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textTertiary,
    flexShrink: 0,
    cursor: 'pointer',
  },
  hiddenEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderTop: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.textSecondary,
    font: 'inherit',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  hiddenCount: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.textTertiary,
    background: colors.inputBg,
    borderRadius: 999,
    padding: '2px 8px',
  },
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
    borderRadius: 2,
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
    color: colors.textOnPrimary,
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
    borderRadius: 2,
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
