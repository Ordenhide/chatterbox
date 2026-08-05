import React, {useEffect, useRef} from 'react';
import {Animated} from 'react-native';
import {ENTRANCE_OFFSET, ENTRANCE_SCALE, SPRING, useReduceMotion} from '../utils/motion';

/**
 * Springs a message bubble in from the side it was sent from — your own from
 * the composer's side, your partner's from theirs.
 *
 * Wraps GiftedChat's rendered bubble rather than replacing it, so every
 * existing bubble variant (burn, view-once, media, selection) keeps its own
 * rendering untouched.
 *
 * The animation runs once, on mount. GiftedChat keys rows by message id, so a
 * re-render of an existing message reuses this component instance and does not
 * re-trigger — only genuinely new messages animate.
 */
export default function MessageEntrance({
  mine,
  children,
}: {
  mine: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReduceMotion();
  // Starts at 0 and is driven to 1; every visual property is derived from it,
  // so the whole entrance is a single native-driven value.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.spring(progress, {toValue: 1, ...SPRING});
    anim.start();
    return () => anim.stop();
  }, [progress, reduced]);

  if (reduced) return <>{children}</>;

  return (
    <Animated.View
      style={{
        // This wrapper must be invisible to layout, and that takes both
        // properties below.
        //
        // GiftedChat renders each message in a `flexDirection: 'row'`, and the
        // bubble it wraps carries `flex: 1` (styles.bubbleWrapper) — meaning
        // "fill the remaining *width*" in that row. Inserting a default View
        // here made the bubble's parent a *column*, so that same `flex: 1`
        // started meaning "fill the remaining *height*": every message row grew
        // to the height of the list, the avatar was pushed far below its
        // bubble, and only one message fit on screen.
        //
        // Matching the row direction is the whole fix: the cross axis becomes
        // vertical again, so the bubble stretches in height (as it did when it
        // was a direct child of GiftedChat's row) and sizes to its content in
        // width.
        //
        // Deliberately no `flex: 1` here — that made this wrapper claim the
        // entire row, which left-aligned outgoing bubbles and shoved their
        // avatar to the far edge. The wrapper must size to content, exactly
        // like the element it replaced.
        flexDirection: 'row',
        opacity: progress,
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [mine ? ENTRANCE_OFFSET : -ENTRANCE_OFFSET, 0],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [ENTRANCE_SCALE, 1],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
}
