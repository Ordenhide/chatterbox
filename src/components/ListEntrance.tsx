import React, {useEffect, useRef} from 'react';
import {Animated} from 'react-native';
import {staggerDelay, TIMING, useReduceMotion} from '../utils/motion';

/**
 * Slides a list row in from the leading edge, staggered by its position — the
 * mobile twin of the web chat list's `.chat-row` cascade.
 *
 * The delay is capped (see staggerDelay) so a long list never leaves its last
 * rows visibly waiting. Rows recycled by FlatList as you scroll get a fresh
 * mount and animate again, which reads as content arriving rather than as a
 * glitch — but only for rows past the first screenful, since `index` keeps
 * growing while the cap holds the delay at its ceiling.
 */
export default function ListEntrance({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      delay: staggerDelay(index),
      ...TIMING,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, index, reduced]);

  if (reduced) return <>{children}</>;

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {translateX: progress.interpolate({inputRange: [0, 1], outputRange: [-10, 0]})},
        ],
      }}>
      {children}
    </Animated.View>
  );
}
