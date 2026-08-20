import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import Icon from './Icon';

/**
 * The animated half of the lightbox, split out from context/LightboxContext so
 * that it can be lazy-loaded.
 *
 * The provider is mounted in main.tsx, which is the eagerly-loaded entry chunk.
 * Importing framer-motion there would drag the whole library out of the lazy
 * post-sign-in bundle and into the initial download — roughly 40kB gzipped
 * charged to everyone who opens the login screen, for a photo viewer they
 * cannot reach until they have signed in and tapped an image. Keeping the
 * framer import on this side of a lazy() boundary means it arrives with the
 * first photo someone opens instead.
 *
 * `layoutId` is what produces the expansion: paired with the same id on the
 * thumbnail's <motion.img>, framer measures both and animates between them, so
 * the photo grows out of the thumbnail rather than fading in over it.
 */

/** Matches the layout spring in MessageMotion — one physical feel across the app. */
const EXPAND_SPRING = {type: 'spring', stiffness: 320, damping: 34, mass: 0.9} as const;

export default function LightboxOverlay({
  url,
  layoutId,
  onClose,
}: {
  url: string | null;
  layoutId?: string;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();

  return (
    // AnimatePresence keeps the photo mounted while it animates back down into
    // its thumbnail — without it, closing would simply unmount and the
    // expansion would only ever play in one direction.
    <AnimatePresence>
      {url && (
        <motion.div
          className="lightbox"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.18}}
          onClick={onClose}>
          <button className="lightbox-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
          <motion.img
            // Under Reduce Motion the id is dropped rather than the animation
            // suppressed: a shared layout with nothing to animate still
            // measures and reflows both elements for no benefit.
            layoutId={reduced ? undefined : layoutId}
            transition={EXPAND_SPRING}
            src={url}
            alt=""
            onClick={e => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
