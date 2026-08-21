import {useEffect, useRef, useState} from 'react';
import {colors} from '../theme';
import {usePrefersReducedMotion} from '../hooks/usePrefersReducedMotion';
import {coldOpenFrame, scrambleFrame} from '../motion';

/**
 * The launch sequence: the wordmark arrives sealed and resolves into itself.
 *
 * Twin of ColdOpen.tsx on mobile — same claim, same primitive. This app seals
 * everything it sends (services/e2ee.ts) and the first thing it shows you is
 * that fact rather than a logo that could belong to any messenger. It's the
 * same scrambleFrame the (also new) message-arrival effect will use, so the
 * launch and a message resolving are visibly the same gesture.
 *
 * Deliberately no framer-motion: App.tsx is the eagerly-loaded entry chunk
 * (MainApp is lazy — see its comment there), so this uses the same plain
 * CSS-classes-plus-rAF approach as the rest of the pre-auth UI. See
 * Cascade.tsx for the fuller version of that reasoning.
 */

const WORDMARK = 'Chatterbox';

/** Module scope, not component state: a remount (fast refresh, App.tsx
 * re-mounting) must not replay a sequence that already played this session. */
let played = false;

/** True before the first play. App.tsx uses this to seed its own state so a
 * warm start skips the hold on a sequence that will never run. */
export function coldOpenPending(): boolean {
  return !played;
}

/** ~30fps, matching the mobile component. Text churn, not motion — doesn't need 60. */
const FRAME_MS = 33;

export default function ColdOpen({onDone}: {onDone: () => void}) {
  const reduced = usePrefersReducedMotion();
  const [text, setText] = useState(() => scrambleFrame(WORDMARK, 0));
  const [ruleShown, setRuleShown] = useState(false);
  const [exiting, setExiting] = useState(false);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    played = true;

    if (reduced) {
      onDoneRef.current();
      return;
    }

    const startedAt = Date.now();
    let lastFrame = 0;
    let raf = requestAnimationFrame(function tick() {
      const now = Date.now();
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        const {phase, progress} = coldOpenFrame(now - startedAt);
        if (phase === 'seal') {
          // Re-randomised every frame so the wordmark reads as live rather
          // than as a static string of symbols.
          setText(scrambleFrame(WORDMARK, 0));
        } else if (phase === 'resolve') {
          setText(scrambleFrame(WORDMARK, progress));
        } else {
          setText(WORDMARK);
          setRuleShown(true);
          if (phase === 'done') {
            setExiting(true);
            const exitTimer = setTimeout(() => onDoneRef.current(), 260);
            return () => clearTimeout(exitTimer);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  if (reduced) return null;

  return (
    <div
      style={styles.root}
      className={exiting ? 'cb-cold-open-exit' : undefined}
      aria-hidden="true">
      <div className="cb-cold-open" style={styles.inner}>
        <div style={styles.wordmark}>{text}</div>
        <div
          className={`cb-cold-open-rule${ruleShown ? ' cb-cold-open-rule-shown' : ''}`}
          style={styles.rule}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: colors.canvas,
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: 220,
  },
  wordmark: {
    // Mono for the same reason as the mobile twin: this is ciphertext for most
    // of its life, re-randomising every frame, and any proportional face would
    // change width per frame and visibly jitter. tabular-nums cannot save it —
    // that only equalises digits, and this alphabet is mostly letters and
    // symbols. A fixed advance makes the resolve land dead still.
    fontFamily: 'var(--cb-mono)',
    fontSize: 30,
    fontWeight: 500,
    letterSpacing: '2px',
    textAlign: 'center',
    color: colors.text,
  },
  rule: {
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    background: colors.primary,
    transformOrigin: 'center',
  },
};
