import type React from 'react';
import {cascadeDelay} from '../motion';

/**
 * Lifts one element of a screen into place, staggered by its position.
 *
 * Twin of Cascade.tsx on mobile. Deliberately plain CSS (the .cb-cascade-in
 * class in styles.css) rather than framer-motion: this wraps content in
 * LoginScreen, which App.tsx imports eagerly, and framer-motion is reserved
 * for the lazy-loaded authenticated app (see usePrefersReducedMotion's own
 * comment on why) — pulling it in here would tax the login screen's bundle
 * to animate the login screen. The reduced-motion opt-out is free for the
 * same reason: it's the blanket CSS rule in styles.css, not a per-component
 * check.
 *
 * `index` is position in the cascade, not an array index — the caller decides
 * arrival order, which is rarely JSX order.
 */
export default function Cascade({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="cb-cascade-in"
      style={{
        ...style,
        // Custom property rather than the shorthand animation-delay directly:
        // the class already sets the rest of the `animation` shorthand, and a
        // second declaration of the same property here would silently lose to
        // source order instead of composing with it.
        ['--cb-cascade-delay' as string]: `${cascadeDelay(index)}ms`,
      }}>
      {children}
    </div>
  );
}
