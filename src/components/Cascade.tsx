import React, {useEffect, useRef} from 'react';
import {Animated} from 'react-native';
import {
  CASCADE_SCALE,
  CASCADE_TRAVEL,
  SPRING,
  cascadeDelay,
  useReduceMotion,
} from '../utils/motion';

/**
 * Lifts one element of a screen into place, staggered by its position.
 *
 * The counterpart to ListEntrance, for a different situation. ListEntrance
 * paces scrolling list rows at 28ms with a 10pt slide — deliberately quiet,
 * because it fires constantly as rows recycle. A cascade fires once, on a
 * screen you have just arrived at, with nothing else competing: it can afford
 * a longer step and real travel (see CASCADE_* in utils/motion).
 *
 * Driven by the house spring rather than a timing curve, so elements land with
 * the same slight overshoot as everything else that settles in this app.
 *
 * `index` is position in the cascade, not an array index — the caller decides
 * the order things should arrive in, which is rarely the order they appear in
 * the JSX.
 */
export default function Cascade({
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
    const anim = Animated.spring(progress, {
      toValue: 1,
      delay: cascadeDelay(index),
      ...SPRING,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, index, reduced]);

  // Rendered without the wrapper entirely rather than with a settled one: an
  // Animated.View that never animates is still a view, and this wraps enough
  // elements per screen for that to be worth avoiding.
  if (reduced) return <>{children}</>;

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [CASCADE_TRAVEL, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [CASCADE_SCALE, 1],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
}
