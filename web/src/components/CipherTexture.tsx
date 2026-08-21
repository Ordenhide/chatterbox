import {useMemo} from 'react';
import {colors} from '../theme';
import {cipherTexture, hashSeed} from '../motion';

/**
 * The sealed field the app sits on — twin of CipherTexture.tsx on mobile,
 * same claim: this app seals everything it sends (services/e2ee.ts), and
 * this is the material the screen was decrypted out of, left visible
 * underneath it.
 *
 * Mobile renders one per screen (GlassScreen wraps nearly every screen
 * there). The web client has no such per-screen wrapper — one root persists
 * for the whole session (see App.tsx) — so this mounts once, fixed behind
 * everything, the same way body::before's grid-and-glow backdrop already
 * does (see styles.css and useBackdropParallax). One field for the whole
 * app rather than one per tab.
 *
 * Static by design, for the same reason as the mobile twin: MessageMotion's
 * resolve churns because it is about to stop; a background doing that
 * permanently would be unreadable to sit beside all day.
 *
 * Sized generously fixed rather than measured against the viewport: CSS
 * clips the overflow for free, so there's no resize listener to maintain and
 * no chance of a bare edge when the window changes size.
 */

const FONT_SIZE = 10;
const LINE_HEIGHT = 17;
const COLS = 700; // comfortably covers viewports past 4000px wide
const ROWS = 140; // comfortably covers viewports past 2300px tall
const OPACITY = 0.05;

export default function CipherTexture({seed = 'chatterbox'}: {seed?: string}) {
  const text = useMemo(() => cipherTexture(COLS * ROWS, hashSeed(seed)), [seed]);

  return (
    <div aria-hidden="true" style={styles.root}>
      {text}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: -1,
    overflow: 'hidden',
    pointerEvents: 'none',
    userSelect: 'none',
    opacity: OPACITY,
    color: colors.primary,
    fontFamily: 'var(--cb-mono)',
    fontSize: FONT_SIZE,
    lineHeight: `${LINE_HEIGHT}px`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
};
