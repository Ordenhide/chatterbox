import {useCallback, useEffect, useLayoutEffect, useState} from 'react';
import {colors} from '../theme';
import {useT, type TKey} from '../i18n';
import Icon, {type IconName} from './Icon';

interface Step {
  // data-tour attribute of the element to spotlight; omit for a centered card.
  target?: string;
  icon: IconName;
  title: TKey;
  body: TKey;
}

// Shell elements get a real spotlight; in-chat capabilities (which need an open
// conversation) are described as centered cards so the tour works on first run.
const STEPS: Step[] = [
  {icon: 'sparkles', title: 'tour.welcomeTitle', body: 'tour.welcomeBody'},
  {target: 'nav-chats', icon: 'comment', title: 'tour.chatsTitle', body: 'tour.chatsBody'},
  {target: 'new-chat', icon: 'plus', title: 'tour.newChatTitle', body: 'tour.newChatBody'},
  {icon: 'paperclip', title: 'tour.composerTitle', body: 'tour.composerBody'},
  {icon: 'more', title: 'tour.spacesTitle', body: 'tour.spacesBody'},
  {icon: 'phone', title: 'tour.callsTitle', body: 'tour.callsBody'},
  {target: 'nav-profile', icon: 'settings', title: 'tour.profileTitle', body: 'tour.profileBody'},
  {icon: 'check', title: 'tour.doneTitle', body: 'tour.doneBody'},
];

const CARD_W = 320;
const CARD_H = 220; // estimate used only for edge-flipping placement

export default function TourOverlay({onClose}: {onClose: () => void}) {
  const {t} = useT();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI(v => Math.min(v + 1, STEPS.length - 1));
      else if (e.key === 'ArrowLeft') setI(v => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const next = () => (last ? onClose() : setI(v => v + 1));
  const back = () => setI(v => Math.max(v - 1, 0));

  // Position the tooltip card relative to the spotlight (or centered).
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let card: React.CSSProperties;
  if (rect) {
    const clampX = (x: number) => Math.max(12, Math.min(x, vw - CARD_W - 12));
    if (rect.left < vw * 0.3) {
      // Left rail → place to the right of the target.
      card = {top: Math.max(12, Math.min(rect.top, vh - CARD_H - 12)), left: clampX(rect.right + 16)};
    } else if (rect.top > vh * 0.55) {
      // Bottom bar → place above.
      card = {top: Math.max(12, rect.top - CARD_H - 12), left: clampX(rect.left + rect.width / 2 - CARD_W / 2)};
    } else {
      // Otherwise below.
      card = {top: Math.min(rect.bottom + 16, vh - CARD_H - 12), left: clampX(rect.left + rect.width / 2 - CARD_W / 2)};
    }
  } else {
    card = {top: '50%', left: '50%', transform: 'translate(-50%, -50%)'};
  }

  return (
    <div style={styles.root} role="dialog" aria-modal="true" aria-label={t('tour.aria')}>
      {rect ? (
        <div
          style={{
            ...styles.spotlight,
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      ) : (
        <div style={styles.dim} />
      )}

      <div style={{...styles.card, ...card}}>
        <div style={styles.iconWrap}>
          <Icon name={step.icon} size={22} style={{color: colors.primary}} />
        </div>
        <div style={styles.title}>{t(step.title)}</div>
        <div style={styles.body}>{t(step.body)}</div>

        <div style={styles.dots}>
          {STEPS.map((_, idx) => (
            <span key={idx} style={{...styles.dot, ...(idx === i ? styles.dotOn : null)}} />
          ))}
        </div>

        <div style={styles.actions}>
          <button style={styles.skip} onClick={onClose}>
            {last ? '' : t('tour.skip')}
          </button>
          <div style={{display: 'flex', gap: 8}}>
            {i > 0 && (
              <button style={styles.back} onClick={back}>
                {t('tour.back')}
              </button>
            )}
            <button style={styles.next} onClick={next}>
              {last ? t('tour.done') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {position: 'fixed', inset: 0, zIndex: 100},
  dim: {position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.68)'},
  spotlight: {
    position: 'absolute',
    borderRadius: 2,
    boxShadow: '0 0 0 9999px rgba(2,6,23,0.68)',
    border: `2px solid ${colors.primary}`,
    pointerEvents: 'none',
    transition: 'all .2s ease',
  },
  card: {
    position: 'absolute',
    width: CARD_W,
    maxWidth: 'calc(100vw - 24px)',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 20,
    boxShadow: colors.shadow,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 2,
    background: colors.primaryLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {fontSize: 18, fontWeight: 800, color: colors.text},
  body: {fontSize: 14, lineHeight: 1.5, color: colors.textSecondary},
  dots: {display: 'flex', gap: 6, marginTop: 2},
  dot: {width: 6, height: 6, borderRadius: 999, background: colors.border},
  dotOn: {background: colors.primary, width: 18},
  actions: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6},
  skip: {
    border: 'none',
    background: 'transparent',
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '8px 4px',
    minWidth: 40,
    textAlign: 'left',
  },
  back: {
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '9px 16px',
    borderRadius: 999,
  },
  next: {
    border: 'none',
    background: colors.primary,
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '9px 18px',
    borderRadius: 999,
  },
};
