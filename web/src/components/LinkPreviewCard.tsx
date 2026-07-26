import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {fetchLinkPreview, type LinkPreview} from '../services/ai';

const cache = new Map<string, LinkPreview | null>();

export default function LinkPreviewCard({url}: {url: string}) {
  const [preview, setPreview] = useState<LinkPreview | null>(cache.get(url) ?? null);
  const [tried, setTried] = useState(cache.has(url));

  useEffect(() => {
    if (cache.has(url)) return;
    let active = true;
    fetchLinkPreview(url)
      .then(p => {
        cache.set(url, p);
        if (active) {
          setPreview(p);
          setTried(true);
        }
      })
      .catch(() => {
        cache.set(url, null);
        if (active) setTried(true);
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (!tried || !preview || (!preview.title && !preview.description && !preview.image)) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={styles.card}>
      {preview.image && <img src={preview.image} alt="" style={styles.image} />}
      <div style={styles.body}>
        {preview.title && <div style={styles.title}>{preview.title}</div>}
        {preview.description && <div style={styles.desc}>{preview.description}</div>}
        <div style={styles.host}>{safeHost(url)}</div>
      </div>
    </a>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'block',
    marginTop: 6,
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    textDecoration: 'none',
    maxWidth: 320,
  },
  image: {width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block'},
  body: {padding: '10px 12px'},
  title: {fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 3},
  desc: {
    fontSize: 12.5,
    color: colors.textSecondary,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  host: {fontSize: 11.5, color: colors.primary, marginTop: 5},
};
