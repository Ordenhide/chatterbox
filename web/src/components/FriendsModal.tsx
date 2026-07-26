import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {getUserByEmail, getUserById} from '../services/chat';
import {
  acceptFriendRequest,
  blockUser,
  declineFriendRequest,
  listenBlocked,
  listenFriends,
  listenIncomingRequests,
  listenOutgoingRequests,
  removeFriend,
  sendFriendRequest,
  unblockUser,
} from '../services/friends';
import Icon from './Icon';
import type {BlockRecord, Friend, FriendRequest, UserProfile} from '../types';

export default function FriendsModal({myUid, onClose}: {myUid: string; onClose: () => void}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [tab, setTab] = useState<'friends' | 'requests' | 'sent' | 'blocked'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<BlockRecord[]>([]);
  const [names, setNames] = useState<Record<string, UserProfile>>({});
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => listenFriends(myUid, setFriends), [myUid]);
  useEffect(() => listenIncomingRequests(myUid, setRequests), [myUid]);
  useEffect(() => listenOutgoingRequests(myUid, setSent), [myUid]);
  useEffect(() => listenBlocked(myUid, setBlocked), [myUid]);

  // Resolve display names for every uid we might show.
  useEffect(() => {
    const uids = new Set<string>();
    friends.forEach(f => f.userIds.forEach(u => u !== myUid && uids.add(u)));
    requests.forEach(r => uids.add(r.fromId));
    sent.forEach(r => uids.add(r.toId));
    blocked.forEach(b => uids.add(b.blockedId));
    const missing = Array.from(uids).filter(u => !names[u]);
    if (missing.length === 0) return;
    Promise.all(missing.map(u => getUserById(u).then(p => [u, p] as const))).then(pairs =>
      setNames(prev => {
        const next = {...prev};
        for (const [u, p] of pairs) if (p) next[u] = p;
        return next;
      }),
    );
  }, [friends, requests, sent, blocked, myUid, names]);

  const nameOf = (uid: string) => names[uid]?.displayName || names[uid]?.email || uid.slice(0, 6);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const target = email.trim().toLowerCase();
    if (!target) return;
    // Look up and send in separate try/catch blocks so failures are attributed
    // to the right step (a denied users query vs a denied request write).
    let user: UserProfile | null = null;
    try {
      user = await getUserByEmail(target);
    } catch (err) {
      console.warn('getUserByEmail failed:', err);
      return setMsg(t('friends.lookupFailed'));
    }
    if (!user) return setMsg(t('friends.noUserFound'));
    if (user.uid === myUid) return setMsg(t('friends.cantAddSelf'));
    try {
      const result = await sendFriendRequest(myUid, user.uid);
      setEmail('');
      setMsg(
        result === 'friends'
          ? t('friends.alreadyFriends')
          : result === 'exists'
          ? t('friends.alreadyPending')
          : t('friends.requestSent'),
      );
    } catch (err) {
      console.warn('sendFriendRequest failed:', err);
      setMsg(t('friends.sendFailed'));
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('friends.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <h2 style={styles.title}>{t('friends.title')}</h2>
          <button style={styles.close} onClick={onClose} title={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={add} style={styles.addRow}>
          <input
            style={styles.input}
            placeholder={t('friends.addByEmail')}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button type="submit" style={styles.addBtn}>
            {t('friends.add')}
          </button>
        </form>
        {msg && <div style={styles.msg}>{msg}</div>}

        <div style={styles.tabs}>
          {(['friends', 'requests', 'sent', 'blocked'] as const).map(tabKey => {
            const label =
              tabKey === 'friends'
                ? t('friends.tabFriends')
                : tabKey === 'requests'
                ? `${t('friends.tabRequests')}${requests.length ? ` (${requests.length})` : ''}`
                : tabKey === 'sent'
                ? `${t('friends.tabSent')}${sent.length ? ` (${sent.length})` : ''}`
                : t('friends.tabBlocked');
            return (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                style={{...styles.tab, color: tab === tabKey ? colors.primary : colors.textSecondary, borderBottomColor: tab === tabKey ? colors.primary : 'transparent'}}>
                {label}
              </button>
            );
          })}
        </div>

        <div className="scroll" style={styles.list}>
          {tab === 'friends' &&
            (friends.length === 0 ? (
              <Empty>{t('friends.noFriends')}</Empty>
            ) : (
              friends.map(f => {
                const other = f.userIds.find(u => u !== myUid)!;
                return (
                  <Row key={f.id} name={nameOf(other)}>
                    <button style={styles.ghost} onClick={() => removeFriend(myUid, other)}>
                      {t('friends.remove')}
                    </button>
                    <button style={styles.danger} onClick={() => blockUser(myUid, other)}>
                      {t('friends.block')}
                    </button>
                  </Row>
                );
              })
            ))}

          {tab === 'requests' &&
            (requests.length === 0 ? (
              <Empty>{t('friends.noRequests')}</Empty>
            ) : (
              requests.map(r => (
                <Row key={r.id} name={nameOf(r.fromId)}>
                  <button style={styles.primary} onClick={() => acceptFriendRequest(r.id, myUid)}>
                    {t('friends.accept')}
                  </button>
                  <button style={styles.ghost} onClick={() => declineFriendRequest(r.id)}>
                    {t('friends.decline')}
                  </button>
                </Row>
              ))
            ))}

          {tab === 'sent' &&
            (sent.length === 0 ? (
              <Empty>{t('friends.noSent')}</Empty>
            ) : (
              sent.map(r => (
                <Row key={r.id} name={nameOf(r.toId)}>
                  <span style={styles.pending}>{t('friends.pending')}</span>
                  <button style={styles.ghost} onClick={() => declineFriendRequest(r.id)}>
                    {t('friends.cancel')}
                  </button>
                </Row>
              ))
            ))}

          {tab === 'blocked' &&
            (blocked.length === 0 ? (
              <Empty>{t('friends.noBlocked')}</Empty>
            ) : (
              blocked.map(b => (
                <Row key={b.id} name={nameOf(b.blockedId)}>
                  <button style={styles.ghost} onClick={() => unblockUser(myUid, b.blockedId)}>
                    {t('friends.unblock')}
                  </button>
                </Row>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}

function Row({name, children}: {name: string; children: React.ReactNode}) {
  return (
    <div style={styles.row}>
      <div style={styles.rowAvatar}>{name.charAt(0).toUpperCase()}</div>
      <span style={styles.rowName}>{name}</span>
      <div style={{display: 'flex', gap: 6}}>{children}</div>
    </div>
  );
}

function Empty({children}: {children: React.ReactNode}) {
  return <div style={styles.empty}>{children}</div>;
}

const btn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  border: `1px solid ${colors.border}`,
  background: 'transparent',
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,15,30,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80vh',
    background: colors.surfaceStrong,
    borderRadius: 20,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.35)',
  },
  head: {display: 'flex', alignItems: 'center', justifyContent: 'space-between'},
  title: {margin: 0, fontSize: 20, color: colors.text},
  close: {background: 'none', border: 'none', color: colors.textSecondary, display: 'flex', alignItems: 'center'},
  addRow: {display: 'flex', gap: 8, margin: '14px 0 4px'},
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 14,
    color: colors.text,
  },
  addBtn: {padding: '0 18px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700},
  msg: {fontSize: 13, color: colors.primary, marginTop: 6},
  tabs: {display: 'flex', gap: 4, borderBottom: `1px solid ${colors.border}`, margin: '14px 0 4px'},
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 14,
  },
  list: {overflowY: 'auto', marginTop: 8},
  row: {display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px'},
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: colors.secondary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    flexShrink: 0,
  },
  rowName: {flex: 1, fontWeight: 600, color: colors.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
  empty: {textAlign: 'center', color: colors.textSecondary, padding: 24, fontSize: 14},
  primary: {...btn, background: colors.primary, color: '#fff', border: 'none'},
  ghost: {...btn, color: colors.text},
  danger: {...btn, color: colors.danger, borderColor: colors.danger},
  pending: {fontSize: 12, fontWeight: 600, color: colors.textSecondary, padding: '0 4px'},
};
