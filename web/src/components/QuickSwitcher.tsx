import {useEffect, useMemo, useState} from 'react';
import {avatarColor, colors} from '../theme';
import {useT} from '../i18n';
import {useModal} from '../hooks/useModal';
import {useChatUserCache} from '../hooks/useChatUserCache';
import {listenChatsForUser} from '../services/chat';
import {resolveChatMeta} from '../utils/chatMeta';
import {useChatIntroductions} from '../hooks/useChatIntroductions';
import Icon from './Icon';
import type {ChatRoom} from '../types';

/**
 * Cmd/Ctrl+K's actual destination — a Spotlight-style palette that jumps to
 * any chat from anywhere in the app, not just a focus() on the sidebar's
 * inline search box.
 *
 * That's what Cmd+K used to do (see the shortcut's own name, 'search', still
 * matching what HomeScreen's box is called), and it only ever worked from the
 * Chats tab: HomeScreen owns that box, so it unmounts — listener and all —
 * the moment you're on Moments, Store, or Profile, which is exactly where
 * "jump to a chat" is most useful. This is a separate, always-available
 * subscription (see useChatUserCache's own note on why a second listener
 * next to HomeScreen's is fine) so it works regardless of which tab mounted it.
 *
 * Row order is Firestore's own (updatedAt desc, from listenChatsForUser) —
 * most-recent-first with no query, which is what a quick switcher should show
 * before you've typed anything; pinned-first is a sidebar-only concern.
 */

const MAX_RESULTS = 8;

export default function QuickSwitcher({
  myUid,
  onClose,
  onSelect,
  title,
  placeholder,
  excludeChatId,
}: {
  myUid: string;
  onClose: () => void;
  onSelect: (chatId: string) => void;
  /** Overrides the dialog's accessible name and placeholder — same picker,
   * reused for message forwarding (see ChatPane's handleForwardPick), which
   * needs different copy than "jump to a chat" but not different behavior. */
  title?: string;
  placeholder?: string;
  /** Left out of the results entirely — forwarding into the chat a message
   * already came from is a no-op, not a real destination. */
  excludeChatId?: string;
}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const userCache = useChatUserCache(chats, myUid);
  const introduced = useChatIntroductions(chats, myUid);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogTitle = title ?? t('quickSwitcher.title');
  const dialogPlaceholder = placeholder ?? t('quickSwitcher.placeholder');

  useEffect(() => listenChatsForUser(myUid, setChats), [myUid]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = excludeChatId ? chats.filter(c => c.id !== excludeChatId) : chats;
    const matches = q
      ? pool.filter(
          c =>
            resolveChatMeta(c, myUid, userCache, introduced).title.toLowerCase().includes(q) ||
            // Same exclusion as HomeScreen's search: a sealed preview's text
            // is a marker, not content.
            (c.lastMessage?.sealed
              ? false
              : (c.lastMessage?.text || '').toLowerCase().includes(q)),
        )
      : pool;
    return matches.slice(0, MAX_RESULTS);
  }, [chats, query, myUid, userCache, excludeChatId]);

  // Typing (which changes what's at each index) or running out of rows both
  // invalidate wherever the highlight was — always land back on the top hit.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  const select = (chatId: string) => {
    onSelect(chatId);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[activeIndex];
      if (hit) select(hit.id);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        style={styles.panel}
        onClick={e => e.stopPropagation()}>
        <div style={styles.searchRow}>
          <Icon name="search" size={17} style={{color: colors.textTertiary}} />
          <input
            style={styles.input}
            placeholder={dialogPlaceholder}
            aria-label={dialogTitle}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
          />
        </div>

        <div style={styles.results}>
          {results.length === 0 ? (
            <div style={styles.empty}>
              {chats.length === 0 ? t('chats.empty') : t('quickSwitcher.noMatch')}
            </div>
          ) : (
            results.map((chat, i) => {
              const {title: chatTitle, seed} = resolveChatMeta(chat, myUid, userCache, introduced);
              return (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-item${i === activeIndex ? ' active' : ''}`}
                  style={styles.row}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(chat.id)}>
                  <div style={{...styles.avatar, background: avatarColor(seed)}}>
                    {chatTitle.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={styles.rowTitle}>{chatTitle}</div>
                    {/* Same three cases as HomeScreen's preview, for the same reasons. */}
                    <div style={styles.rowPreview}>
                      {chat.lastMessage?.sealed
                        ? t('chat.encryptedPreview')
                        : chat.lastMessage?.text ||
                          (chat.lastMessage?.createdAt ? '' : t('chat.empty'))}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={styles.hint}>
          <span><kbd style={styles.kbd}>↑</kbd><kbd style={styles.kbd}>↓</kbd> {t('quickSwitcher.hintNavigate')}</span>
          <span><kbd style={styles.kbd}>↵</kbd> {t('quickSwitcher.hintOpen')}</span>
          <span><kbd style={styles.kbd}>Esc</kbd> {t('quickSwitcher.hintClose')}</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,15,30,0.35)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 24,
    paddingTop: '12vh',
    zIndex: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '70vh',
    background: colors.surfaceStrong,
    borderRadius: 2,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.35)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    border: 'none',
    background: 'none',
    outline: 'none',
    fontSize: 16,
    color: colors.text,
  },
  results: {
    overflowY: 'auto',
    padding: 8,
  },
  empty: {
    padding: '28px 12px',
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSecondary,
  },
  row: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 2,
    border: 'none',
    background: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
  },
  rowTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: colors.text,
  },
  rowPreview: {
    fontSize: 12.5,
    color: colors.textSecondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 1,
  },
  hint: {
    display: 'flex',
    gap: 16,
    padding: '10px 20px',
    borderTop: `1px solid ${colors.border}`,
    fontSize: 12,
    color: colors.textTertiary,
    flexShrink: 0,
  },
  kbd: {
    display: 'inline-block',
    minWidth: 16,
    padding: '1px 5px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    fontSize: 11,
    textAlign: 'center',
    marginInlineEnd: 3,
  },
};
