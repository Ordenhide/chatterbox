import {colors} from '../theme';
import {hasPreviewContent, type LinkPreviewData} from '../services/linkPreview';
import {safeExternalUrl} from '../utils/safeUrl';

/**
 * Renders a preview the message already carries. Deliberately does no
 * fetching: this used to call the `fetchLinkPreview` function as it mounted,
 * which meant every viewer reported every link to the server on every load.
 * The sender now resolves it once and encrypts it into the message — see
 * services/linkPreview.ts for why.
 *
 * A message sent before that change has no stored preview and simply renders
 * without a card.
 */
export default function LinkPreviewCard({preview}: {preview: LinkPreviewData | null | undefined}) {
  if (!preview || !hasPreviewContent(preview)) return null;
  const {url} = preview;

  // The URL comes from the sender's message, so it is not trustworthy.
  // A preview that can't be linked safely isn't worth rendering at all.
  const href = safeExternalUrl(url);
  if (!href) return null;
  // Same for the thumbnail: it's a URL scraped from a page the sender chose.
  const imageSrc = safeExternalUrl(preview.image);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={styles.card}>
      {imageSrc && <img src={imageSrc} alt="" style={styles.image} />}
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
