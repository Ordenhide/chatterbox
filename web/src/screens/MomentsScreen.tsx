import {useCallback, useEffect, useRef, useState} from 'react';
import type {User} from 'firebase/auth';
import {avatarColor, colors} from '../theme';
import {useT, type TKey} from '../i18n';
import {useLightbox} from '../context/LightboxContext';
import {formatRemaining, isExpired, MOMENT_EXPIRY_HOURS} from '../utils/ephemeral';
import {createMoment, deleteMoment, fetchFeed, getLikedMomentIds, newMomentId, toggleLike} from '../services/moments';
import {getUserById} from '../services/chat';
import {uploadMomentImage} from '../services/storage';
import type {Moment, MomentVisibility, UserProfile} from '../types';
import FriendsModal from '../components/FriendsModal';
import MomentComments from '../components/MomentComments';
import RevealOnScroll from '../components/RevealOnScroll';
import Icon from '../components/Icon';
import {motion} from 'framer-motion';

export default function MomentsScreen({user, requestCount = 0}: {user: User; requestCount?: number}) {
  const {t} = useT();
  const lightbox = useLightbox();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [authors, setAuthors] = useState<Record<string, UserProfile>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<MomentVisibility>('friends');
  const [posting, setPosting] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [expiryHours, setExpiryHours] = useState(0);
  const [now, setNow] = useState(Date.now());
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Tick so expiring moments drop out of the feed and the badge counts down.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const onImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const feed = await fetchFeed(user.uid);
      setMoments(feed);
      const likedIds = await getLikedMomentIds(feed.map(m => m.id), user.uid);
      setLiked(likedIds);
      const uids = Array.from(new Set(feed.map(m => m.authorId).filter(id => !authors[id])));
      const pairs = await Promise.all(uids.map(id => getUserById(id).then(p => [id, p] as const)));
      setAuthors(prev => {
        const next = {...prev};
        for (const [id, p] of pairs) if (p) next[id] = p;
        return next;
      });
    } catch (err) {
      console.warn('load moments failed:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if ((!t && !imageFile) || posting) return;
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      // Reserved before the upload: the media path contains the moment id,
      // which is what lets the Storage rule apply this moment's visibility.
      const momentId = newMomentId();
      if (imageFile) {
        setUploadPct(0);
        mediaUrl = await uploadMomentImage(user.uid, momentId, imageFile, p => setUploadPct(p));
      }
      await createMoment(user.uid, {
        text: t,
        visibility,
        mediaUrl,
        mediaType: mediaUrl ? 'image' : undefined,
        expiresAt: expiryHours > 0 ? Date.now() + expiryHours * 3600 * 1000 : undefined,
      }, momentId);
      setText('');
      clearImage();
      setExpiryHours(0);
      await load();
    } catch (err) {
      console.warn('post moment failed:', err);
    } finally {
      setUploadPct(null);
      setPosting(false);
    }
  };

  const onToggleLike = async (m: Moment) => {
    const isLiked = liked.has(m.id);
    // optimistic
    setLiked(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(m.id) : next.add(m.id);
      return next;
    });
    setMoments(prev =>
      prev.map(x =>
        x.id === m.id ? {...x, likeCount: (x.likeCount || 0) + (isLiked ? -1 : 1)} : x,
      ),
    );
    try {
      await toggleLike(m.id, user.uid, isLiked);
    } catch (err) {
      console.warn('like failed:', err);
      load(); // resync on failure
    }
  };

  const onDelete = async (m: Moment) => {
    if (!window.confirm(t('moments.deleteConfirm'))) return;
    setMoments(prev => prev.filter(x => x.id !== m.id));
    try {
      await deleteMoment(m.id, m.mediaUrl);
    } catch (err) {
      console.warn('delete moment failed:', err);
      load(); // resync on failure
    }
  };

  const authorName = (uid: string) =>
    uid === user.uid
      ? t('moments.you')
      : authors[uid]?.displayName || authors[uid]?.email || t('moments.someone');

  const visLabel = (v: MomentVisibility) =>
    t(`moments.${v === 'friends' ? 'friendsVis' : v}` as 'moments.public');

  // Hide moments that have passed their "burn after time-up" deadline.
  const shownMoments = moments.filter(m => !isExpired(m.expiresAt, now));

  return (
    <div style={styles.wrap}>
      <div className="scroll" style={styles.scroll}>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>{t('moments.title')}</h1>
          <button
            className="btn btn-soft"
            style={{...styles.friendsBtn, position: 'relative'}}
            onClick={() => setShowFriends(true)}>
            {t('moments.friends')}
            {requestCount > 0 && (
              <span style={styles.friendsBadge}>{requestCount > 99 ? '99+' : requestCount}</span>
            )}
          </button>
        </div>

        <form onSubmit={post} style={styles.composer}>
          <textarea
            style={styles.textarea}
            placeholder={t('moments.share')}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
          />
          {imagePreview && (
            <div style={styles.previewWrap}>
              <img src={imagePreview} alt="" style={styles.previewImg} />
              <button type="button" className="btn btn-soft" style={styles.previewClose} onClick={clearImage} aria-label="Remove image">
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          {uploadPct !== null && (
            <div style={styles.uploadBar}>
              <div style={{...styles.uploadFill, width: `${uploadPct}%`}} />
            </div>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={onImageSelected}
            style={{display: 'none'}}
          />
          <div style={styles.expiryRow}>
            <span style={styles.expiryRowLabel}>
              <Icon name="timer" size={14} /> {t('moments.disappears')}
            </span>
            {MOMENT_EXPIRY_HOURS.map(hours => (
              <button
                type="button"
                key={hours}
                onClick={() => setExpiryHours(hours)}
                style={{
                  ...styles.expiryChip,
                  ...(expiryHours === hours ? styles.expiryChipOn : null),
                }}>
                {momentExpiryLabel(t, hours)}
              </button>
            ))}
          </div>
          <div style={styles.composerBar}>
            <div style={styles.visRow}>
              <button
                type="button"
                className="btn btn-soft"
                style={styles.attachBtn}
                onClick={() => imageInputRef.current?.click()}
                aria-label={t('moments.addPhoto')}>
                <Icon name="image" size={17} />
              </button>
              {(['public', 'friends', 'private'] as MomentVisibility[]).map(v => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setVisibility(v)}
                  style={{
                    ...styles.visChip,
                    background: visibility === v ? colors.primary : 'transparent',
                    color: visibility === v ? '#fff' : colors.textSecondary,
                    borderColor: visibility === v ? colors.primary : colors.border,
                  }}>
                  {visLabel(v)}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={styles.postBtn}
              disabled={(!text.trim() && !imageFile) || posting}>
              {posting ? <span className="spinner" /> : t('moments.post')}
            </button>
          </div>
        </form>

        {loading ? (
          <div style={styles.info}>{t('moments.loading')}</div>
        ) : shownMoments.length === 0 ? (
          <div style={styles.info}>{t('moments.empty')}</div>
        ) : (
          shownMoments.map(m => (
            <RevealOnScroll key={m.id}>
            <article className="cv-card" style={styles.card}>
              <header style={styles.cardHead}>
                <div style={{...styles.avatar, background: avatarColor(m.authorId)}}>
                  {authorName(m.authorId).charAt(0).toUpperCase()}
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={styles.author}>{authorName(m.authorId)}</div>
                  <div style={styles.meta}>
                    {formatDate(m.createdAt)} · {visLabel(m.visibility)}
                  </div>
                </div>
                {m.expiresAt && (
                  <span style={styles.expiryBadge} title={t('moments.expiresIn')}>
                    <Icon name="timer" size={12} style={{verticalAlign: '-2px'}} /> {formatRemaining(m.expiresAt - now)}
                  </span>
                )}
              </header>
              {m.text && <p style={styles.body}>{m.text}</p>}
              {m.mediaUrl && m.mediaType === 'image' && (
                // layoutId pairs this thumbnail with the lightbox photo, so
                // tapping grows it out of here instead of fading in over it.
                // Keyed by moment id rather than URL: the same image posted
                // twice would otherwise give two elements the same id.
                <motion.img
                  layoutId={`moment-photo-${m.id}`}
                  src={m.mediaUrl}
                  alt=""
                  style={styles.cardImage}
                  loading="lazy"
                  onClick={() => lightbox.open(m.mediaUrl!, `moment-photo-${m.id}`)}
                />
              )}
              <div style={styles.actions}>
                <button
                  onClick={() => onToggleLike(m)}
                  style={{...styles.actionBtn, color: liked.has(m.id) ? colors.danger : colors.textSecondary}}>
                  <Icon name={liked.has(m.id) ? 'heartFilled' : 'heart'} size={17} />
                  {m.likeCount || 0}
                </button>
                <button
                  onClick={() =>
                    setOpenComments(prev => {
                      const next = new Set(prev);
                      next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                      return next;
                    })
                  }
                  style={{...styles.actionBtn, color: colors.textSecondary}}>
                  <Icon name="comment" size={16} />
                  {m.commentCount || 0}
                </button>
                {m.authorId === user.uid && (
                  <button
                    style={styles.iconBtn}
                    onClick={() => onDelete(m)}
                    aria-label={t('common.delete')}>
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </div>
              {openComments.has(m.id) && (
                <MomentComments momentId={m.id} momentAuthorId={m.authorId} myUid={user.uid} />
              )}
            </article>
            </RevealOnScroll>
          ))
        )}
      </div>
      {showFriends && <FriendsModal myUid={user.uid} onClose={() => setShowFriends(false)} />}
    </div>
  );
}

function formatDate(ts: Moment['createdAt']): string {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return 'just now';
  return d.toLocaleDateString([], {month: 'short', day: 'numeric'}) + ' ' +
    d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

function momentExpiryLabel(t: (k: TKey) => string, hours: number): string {
  switch (hours) {
    case 1:
      return '1h';
    case 24:
      return '24h';
    case 168:
      return '7d';
    default:
      return t('moments.keep');
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center'},
  scroll: {width: '100%', maxWidth: 620, overflowY: 'auto', padding: '24px 20px 48px'},
  titleRow: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18},
  title: {fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', margin: 0, color: colors.text},
  friendsBtn: {padding: '8px 16px', fontSize: 13},
  friendsBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    borderRadius: 999,
    background: colors.danger,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  composer: {
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
    boxShadow: colors.shadowSoft,
  },
  textarea: {
    width: '100%',
    border: 'none',
    resize: 'vertical',
    fontSize: 15,
    background: 'transparent',
    color: colors.text,
    outline: 'none',
  },
  composerBar: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10},
  expiryRow: {display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap'},
  expiryRowLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12.5,
    fontWeight: 600,
    color: colors.textSecondary,
    marginRight: 2,
  },
  expiryChip: {
    padding: '5px 11px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 600,
  },
  expiryChipOn: {background: colors.primary, color: '#fff', borderColor: colors.primary},
  expiryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    padding: '3px 9px',
    borderRadius: 999,
    background: colors.primaryLight,
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: 700,
  },
  visRow: {display: 'flex', gap: 6},
  visChip: {
    padding: '5px 12px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  postBtn: {padding: '9px 22px', fontSize: 14, minWidth: 72, minHeight: 38},
  attachBtn: {
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textSecondary,
  },
  previewWrap: {position: 'relative', marginTop: 12, display: 'inline-block'},
  previewImg: {
    maxWidth: '100%',
    maxHeight: 240,
    borderRadius: 14,
    display: 'block',
    border: `1px solid ${colors.border}`,
  },
  previewClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    padding: 0,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10,10,20,0.6)',
    color: '#fff',
  },
  uploadBar: {height: 4, borderRadius: 999, background: colors.border, overflow: 'hidden', marginTop: 10},
  uploadFill: {height: '100%', background: colors.primary, transition: 'width 0.15s ease'},
  info: {textAlign: 'center', color: colors.textSecondary, padding: 32},
  card: {
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    boxShadow: colors.shadowSoft,
  },
  cardHead: {display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10},
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    background: colors.secondary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  author: {fontWeight: 700, color: colors.text},
  meta: {fontSize: 12.5, color: colors.textSecondary, textTransform: 'capitalize'},
  body: {fontSize: 15, lineHeight: 1.45, color: colors.text, margin: '0 0 12px', whiteSpace: 'pre-wrap'},
  cardImage: {
    width: '100%',
    maxHeight: 420,
    objectFit: 'cover',
    borderRadius: 14,
    margin: '0 0 12px',
    border: `1px solid ${colors.border}`,
    cursor: 'zoom-in',
  },
  actions: {display: 'flex', alignItems: 'center', gap: 18},
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    padding: 0,
  },
  iconBtn: {
    marginLeft: 'auto',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    padding: 0,
  },
};
