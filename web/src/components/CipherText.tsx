import {useEffect, useRef, useState} from 'react';
import {useReducedMotion} from 'framer-motion';
import {scrambleDuration, scrambleFrame} from '../motion';

/**
 * A message that arrives as ciphertext and resolves into words — twin of
 * CipherText.tsx on mobile, the app's signature effect. MessageMotion covers
 * how a bubble arrives (spring in from the sender's side); this is what
 * happens to the text inside it, and until now the web client had no
 * counterpart — the bubble sprang in already legible.
 *
 * Every message really is sealed to a recipient key before it leaves the
 * sender's device (services/e2ee.ts), and this is the moment that stops
 * being invisible: the text lands sealed and resolves left to right.
 *
 * Applied to *incoming* messages only, and that restriction is the point.
 * For a message you received, "it arrived as ciphertext and became legible"
 * is literally what happened. Playing the same animation on your own
 * outgoing message would be theatre — you typed it, it was never ciphertext
 * to you.
 *
 * framer-motion's useReducedMotion rather than the standalone hook in
 * hooks/usePrefersReducedMotion: that one exists only for the eagerly-loaded
 * pre-auth entry chunk, to keep framer-motion out of it. ChatPane is deep in
 * the lazy MainApp chunk and already pulls framer-motion in via
 * MessageMotion, so there's no bundle cost left to avoid here.
 */

/**
 * When this module was first evaluated — effectively when the tab opened.
 *
 * Everything older than this is history, and history does not perform.
 * Without this, opening a chat would resolve the entire visible scrollback
 * at once, which is both absurd and the single most expensive thing this
 * component could do.
 */
const SESSION_START = Date.now();

/**
 * Message ids that have already resolved. React can remount this component
 * for the same message (a list re-key, a re-render that recreates the
 * element), and without this it would replay every time.
 */
const played = new Set<string>();

/** ~30fps, matching the mobile twin. The scramble is text churn, not motion — it doesn't need 60. */
const FRAME_MS = 33;

/* One rAF loop for every CipherText on screen, same reasoning as the mobile
 * twin: in practice only the newest message or two are ever animating, but a
 * per-instance loop would mean a stack of them if several land together. */
type Subscriber = () => void;
const subscribers = new Set<Subscriber>();
let rafId = 0;

function pump() {
  for (const run of Array.from(subscribers)) run();
  rafId = subscribers.size > 0 ? requestAnimationFrame(pump) : 0;
}

function subscribe(run: Subscriber): () => void {
  subscribers.add(run);
  if (rafId === 0) rafId = requestAnimationFrame(pump);
  return () => {
    subscribers.delete(run);
    if (subscribers.size === 0 && rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}

export default function CipherText({
  text,
  messageId,
  createdAtMs,
  style,
  sealedColor,
  children,
}: {
  text: string;
  messageId: string;
  /** Milliseconds since epoch, or undefined for a message with no server
   * timestamp yet (an optimistic send) — either way, not eligible to animate
   * here, since this component is never used for outgoing messages anyway. */
  createdAtMs: number | undefined;
  style?: React.CSSProperties;
  /** Color of the not-yet-resolved glyphs. */
  sealedColor: string;
  /** The real, fully formatted content — rendered the moment it resolves. */
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  // null means "resolved" — render the real thing. A string means mid-resolve.
  const [frame, setFrame] = useState<string | null>(null);
  const progress = useRef(0);

  // Read through a ref so it cannot become an effect dependency — `text` is
  // a fresh string on every render of the message list, and depending on it
  // directly would re-run this effect on unrelated re-renders. Because the id
  // is claimed in `played` on the first pass, that re-run would bail out
  // immediately, tearing down the ticker and leaving the message frozen mid-scramble.
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const real = textRef.current;
    if (reduced || !real) return;
    if (played.has(messageId)) return;
    if (createdAtMs === undefined || createdAtMs < SESSION_START) return;

    // Claimed immediately, not on completion: a re-render mid-resolve must
    // not start a second pass over the same message.
    played.add(messageId);

    const duration = scrambleDuration(real.length);
    const startedAt = Date.now();
    let lastFrame = 0;
    progress.current = 0;
    setFrame(scrambleFrame(real, 0));

    const unsubscribe = subscribe(() => {
      const now = Date.now();
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      const p = (now - startedAt) / duration;
      if (p >= 1) {
        progress.current = 1;
        setFrame(null);
        unsubscribe();
        return;
      }
      progress.current = p;
      setFrame(scrambleFrame(real, p));
    });

    return unsubscribe;
    // Deliberately only the identity of the message and the accessibility
    // setting. Everything else is read through a ref above.
  }, [messageId, reduced, createdAtMs]);

  if (frame === null) return <>{children}</>;

  // Two spans rather than one per character: a fixed cost for the resolving
  // edge's color change, where a span per glyph would mean a hundred nodes
  // for a long message.
  const resolved = Math.floor(progress.current * frame.length);
  return (
    <span style={style}>
      <span>{frame.slice(0, resolved)}</span>
      <span style={{color: sealedColor}}>{frame.slice(resolved)}</span>
    </span>
  );
}
