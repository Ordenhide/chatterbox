import React, {useEffect, useRef, useState} from 'react';
import {StyleProp, Text, TextStyle} from 'react-native';
import {scrambleDuration, scrambleFrame, useReduceMotion} from '../utils/motion';

/**
 * A message that arrives as ciphertext and resolves into words.
 *
 * The signature effect. Every message in this app really is sealed to a
 * recipient key before it leaves the sender's device (services/e2ee.ts), and
 * this is the moment that stops being invisible: the bubble lands sealed and
 * the sentence resolves left to right.
 *
 * Applied to *incoming* messages only, and that restriction is the point. For
 * a message you received, "it arrived as ciphertext and became legible" is
 * literally what happened. Playing the same animation on your own outgoing
 * message would be theatre — you typed it, it was never ciphertext to you. The
 * honest outgoing counterpart is the opposite motion (plaintext sealing shut
 * before it commits), which has to hook the send pipeline rather than the
 * renderer, so it is deliberately not bolted on here.
 */

/**
 * When this module was first evaluated — effectively when the app launched.
 *
 * Everything older than this is history, and history does not perform. Without
 * this the entire scrollback would resolve at once every time a chat is opened,
 * which is both absurd and the single most expensive thing this component
 * could do.
 *
 * Clock skew on a server timestamp can push a genuinely new message just under
 * the line, and that is the right way to be wrong: the failure is a message
 * that quietly does not animate, never the whole history animating at once.
 */
const SESSION_START = Date.now();

/**
 * Message ids that have already resolved. GiftedChat reuses component
 * instances as the list re-renders, so without this a message would replay
 * every time something above it changed.
 */
const played = new Set<string>();

/** ~30fps. The scramble is text churn, not motion — it does not need 60. */
const FRAME_MS = 33;

/* One rAF loop for every CipherText on screen. In practice only the newest
 * message is ever animating, but a per-instance loop would mean a stack of
 * them if several land together. */
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

function createdAtMs(createdAt: unknown): number {
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt === 'number') return createdAt;
  return NaN;
}

export default function CipherText({
  text,
  messageId,
  createdAt,
  style,
  sealedColor,
  children,
}: {
  text: string;
  messageId: string;
  createdAt: unknown;
  style?: StyleProp<TextStyle>;
  /** Colour of the not-yet-resolved glyphs. */
  sealedColor: string;
  /** The real, fully formatted message — rendered the moment it resolves. */
  children: React.ReactNode;
}) {
  const reduced = useReduceMotion();
  // null means "resolved" — render the real thing. A string means mid-resolve.
  const [frame, setFrame] = useState<string | null>(null);
  const progress = useRef(0);

  // Read through refs so they cannot become effect dependencies.
  //
  // `createdAt` is a Date *object*, rebuilt every time the message list is
  // remapped. Depending on it directly re-ran this effect on unrelated
  // re-renders, and because the id is claimed in `played` on the first pass,
  // the re-run would bail out immediately — tearing down the ticker and
  // leaving the message frozen as ciphertext forever.
  const textRef = useRef(text);
  const createdAtRef = useRef(createdAt);
  textRef.current = text;
  createdAtRef.current = createdAt;

  useEffect(() => {
    const real = textRef.current;
    if (reduced || !real) return;
    if (played.has(messageId)) return;
    const at = createdAtMs(createdAtRef.current);
    if (!Number.isFinite(at) || at < SESSION_START) return;

    // Claimed immediately, not on completion: a re-render mid-resolve must not
    // start a second pass over the same message.
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
  }, [messageId, reduced]);

  if (frame === null) return <>{children}</>;

  // Split rather than per-character views: two Text spans give the resolving
  // edge its colour change for a fixed cost, where one view per glyph would
  // mean a hundred views on a long message.
  const resolved = Math.floor(progress.current * frame.length);
  return (
    <Text style={style}>
      <Text>{frame.slice(0, resolved)}</Text>
      <Text style={{color: sealedColor}}>{frame.slice(resolved)}</Text>
    </Text>
  );
}
