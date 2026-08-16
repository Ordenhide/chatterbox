import React, {useMemo, useState} from 'react';
import {Animated, LayoutChangeEvent, StyleProp, useWindowDimensions, ViewStyle} from 'react-native';
import {useScrollMotionValue} from '../contexts/ScrollMotionContext';
import {
  REVEAL_SCALE,
  REVEAL_TRAVEL,
  revealWindow,
  useReduceMotion,
} from '../utils/motion';

/**
 * Reveals its child as a function of *scroll position* rather than on mount.
 *
 * The distinction matters: ListEntrance (its sibling) fires a timed animation
 * when a row mounts, so a fast scroll produces rows that are still catching up
 * long after they arrived. This instead maps the card's own position in the
 * viewport onto its progress, so a card is exactly as revealed as its place on
 * screen says it should be — hold it half-visible and it stays half-revealed,
 * scroll back up and it un-reveals. That continuous coupling to input is what
 * separates scroll-driven motion from motion that merely happens near a
 * scroll.
 *
 * Measures itself with onLayout to learn its offset inside the list's content,
 * then interpolates the shared scroll value over the window revealWindow()
 * computes for that offset. Until it has measured it renders fully visible:
 * anything above the fold should already be there when you arrive, and
 * anything below it is off screen anyway, so there is no frame where the wrong
 * choice is visible.
 */
export default function RevealOnScroll({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scrollY = useScrollMotionValue();
  const reduced = useReduceMotion();
  const {height} = useWindowDimensions();
  const [top, setTop] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const {y} = e.nativeEvent.layout;
    // Only re-interpolate when the position actually moved. Sub-pixel layout
    // jitter would otherwise rebuild the interpolations on every pass.
    setTop(prev => (prev !== null && Math.abs(prev - y) < 1 ? prev : y));
  };

  const revealStyle = useMemo(() => {
    if (!scrollY || reduced || top === null) return null;
    const inputRange = revealWindow(top, height);
    const at = (outputRange: [number, number]) =>
      scrollY.interpolate({inputRange, outputRange, extrapolate: 'clamp'});
    return {
      opacity: at([0, 1]),
      transform: [{translateY: at([REVEAL_TRAVEL, 0])}, {scale: at([REVEAL_SCALE, 1])}],
    };
  }, [scrollY, reduced, top, height]);

  return (
    <Animated.View onLayout={onLayout} style={[style, revealStyle]}>
      {children}
    </Animated.View>
  );
}
