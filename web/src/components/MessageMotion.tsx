import {motion, useMotionValue, useReducedMotion, useSpring, useTransform} from 'framer-motion';
import type React from 'react';

/**
 * The physics behind a message bubble: it springs in from the side it was sent
 * from, and tilts in 3D toward your cursor while you're over it.
 *
 * The previous version was a CSS keyframe. framer-motion replaces it for two
 * reasons a keyframe can't cover: a real spring (mass/stiffness/damping, so the
 * overshoot is computed rather than approximated by a bezier), and pointer-
 * tracked tilt, which needs per-frame values that CSS has no access to.
 *
 * `useReducedMotion` is framer's own hook and reads the same media query as the
 * blanket rule in styles.css — this component just needs it in JS to skip the
 * tilt maths entirely rather than animating to a suppressed value.
 */

/** Degrees of tilt at the far edge of the bubble. Past ~10 it stops reading as depth and starts reading as broken. */
const MAX_TILT = 8;

export default function MessageMotion({
  mine,
  children,
  style,
}: {
  mine: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const reduced = useReducedMotion();

  // Raw pointer position within the bubble, -0.5 … 0.5 on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // Springs smooth the pointer jitter into something that feels weighted
  // rather than glued to the cursor.
  const sx = useSpring(px, {stiffness: 260, damping: 22, mass: 0.4});
  const sy = useSpring(py, {stiffness: 260, damping: 22, mass: 0.4});
  const rotateY = useTransform(sx, v => v * MAX_TILT * 2);
  const rotateX = useTransform(sy, v => -v * MAX_TILT * 2);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  if (reduced) return <div style={style}>{children}</div>;

  return (
    <motion.div
      initial={{opacity: 0, scale: 0.7, x: mine ? 40 : -40, y: 16}}
      animate={{opacity: 1, scale: 1, x: 0, y: 0}}
      transition={{
        // Under-damped on purpose: it lands past its target and settles back,
        // which is what makes it read as physical instead of as a fade.
        type: 'spring',
        stiffness: 480,
        damping: 26,
        mass: 0.9,
      }}
      whileHover={{scale: 1.02}}
      whileTap={{scale: 0.98}}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformPerspective: 700,
        transformStyle: 'preserve-3d',
      }}>
      {children}
    </motion.div>
  );
}
