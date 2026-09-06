import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {safeExternalUrl} from '../utils/safeUrl';
import {wikipediaSearchUrl} from '../services/wikipediaLookup';
import {fetchWikipediaSummary, type WikipediaSummary} from '../services/wikipediaSummary';

type State =
  | {phase: 'loading'}
  | {phase: 'found'; summary: WikipediaSummary}
  | {phase: 'missing'}
  | {phase: 'failed'};

/**
 * The card for one name the reader asked about.
 *
 * The request happens here, when this mounts, because this is the first
 * moment anyone has asked for it. Its ancestor — context cards — fetched on
 * its own initiative for every thread that opened and rendered nothing, which
 * is how a feature manages to cost a private conversation's proper nouns and
 * return no value at all.
 *
 * Closing aborts. A reader who has moved on is not waiting for this, and the
 * request should stop with them rather than finish into a component that no
 * longer exists.
 */
export default function WikipediaCardModal({
  phrase,
  lang,
  onClose,
}: {
  phrase: string;
  lang: string;
  onClose: () => void;
}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [state, setState] = useState<State>({phase: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({phase: 'loading'});
    setImageBroken(false);
    fetchWikipediaSummary(phrase, lang, ctrl.signal).then(
      summary => {
        if (ctrl.signal.aborted) return;
        setState(summary ? {phase: 'found', summary} : {phase: 'missing'});
      },
      () => {
        // Distinguished from `missing` on purpose: telling someone their word
        // does not exist because the network is down is a lie.
        if (!ctrl.signal.aborted) setState({phase: 'failed'});
      },
    );
    return () => ctrl.abort();
  }, [phrase, lang, attempt]);

  const summary = state.phase === 'found' ? state.summary : null;
  const articleUrl = summary ? safeExternalUrl(summary.url) : null;
  const imageSrc =
    summary && !summary.ambiguous && !imageBroken ? safeExternalUrl(summary.image) : null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-busy={state.phase === 'loading'}
        aria-label={t('chat.lookUp')}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        {state.phase === 'loading' && <p style={styles.status}>{t('chat.lookUpLoading')}</p>}

        {state.phase === 'missing' && (
          <>
            <p style={styles.status}>{t('chat.lookUpNotFound', {name: phrase})}</p>
            <a
              href={wikipediaSearchUrl(phrase, lang)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={styles.action}>
              {t('chat.lookUpSearch')}
            </a>
          </>
        )}

        {state.phase === 'failed' && (
          <>
            <p style={styles.status}>{t('chat.lookUpFailed')}</p>
            <button
              type="button"
              className="btn btn-primary"
              style={styles.action}
              onClick={() => setAttempt(n => n + 1)}>
              {t('chat.lookUpRetry')}
            </button>
          </>
        )}

        {summary && (
          <>
            <div style={styles.head}>
              {imageSrc && (
                // The browser sends its own User-Agent, which Wikimedia
                // accepts, so no header is needed here — only the retreat when
                // an image does not load, so it leaves no empty square.
                <img
                  src={imageSrc}
                  alt=""
                  style={styles.thumb}
                  onError={() => setImageBroken(true)}
                />
              )}
              <div style={styles.headText}>
                <h2 style={styles.title}>{summary.title}</h2>
                <p style={styles.extract}>
                  {summary.ambiguous ? t('chat.lookUpAmbiguous') : summary.extract}
                </p>
              </div>
            </div>
            <p style={styles.attribution}>{t('chat.lookUpAttribution')}</p>
            {articleUrl && (
              <a
                href={articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={styles.action}>
                {t('chat.lookUpOpen')}
              </a>
            )}
          </>
        )}

        <button type="button" style={styles.cancel} onClick={onClose}>
          {t('common.close')}
        </button>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    background: colors.surfaceStrong,
    borderRadius: 2,
    padding: 26,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.35)',
  },
  head: {display: 'flex', gap: 14, alignItems: 'flex-start'},
  thumb: {
    width: 72,
    height: 72,
    objectFit: 'cover',
    borderRadius: 2,
    flexShrink: 0,
    background: colors.border,
  },
  headText: {minWidth: 0},
  title: {margin: '0 0 6px', fontSize: 18, color: colors.text, lineHeight: 1.3},
  extract: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: colors.textSecondary,
    display: '-webkit-box',
    WebkitLineClamp: 6,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  status: {margin: '0 0 16px', fontSize: 14.5, color: colors.textSecondary},
  attribution: {margin: '16px 0 0', fontSize: 12, color: colors.textSecondary, opacity: 0.75},
  action: {
    display: 'block',
    width: '100%',
    marginTop: 14,
    padding: '12px',
    borderRadius: 2,
    fontSize: 14.5,
    textAlign: 'center',
    textDecoration: 'none',
    boxSizing: 'border-box',
  },
  cancel: {
    width: '100%',
    marginTop: 10,
    padding: '10px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontWeight: 600,
  },
};
