import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {useReduceMotion} from '../utils/motion';

const DOT_COUNT = 3;
const STAGGER_MS = 150;
const CYCLE_MS = 1100;

/**
 * Three dots on a staggered bounce — the mobile twin of the web's `.cb-typing`.
 *
 * The movement carries the meaning, so there is no text; the caller supplies an
 * accessibilityLabel instead, which is what a screen reader announces.
 *
 * Under Reduce Motion the dots hold still rather than disappearing: the
 * indicator still needs to say someone is typing, it just stops moving.
 */
export default function TypingDots({
  color,
  accessibilityLabel,
}: {
  color: string;
  accessibilityLabel: string;
}) {
  const reduced = useReduceMotion();
  const dots = useRef(
    Array.from({length: DOT_COUNT}, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (reduced) {
      dots.forEach(d => d.setValue(0));
      return;
    }
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER_MS),
          Animated.timing(dot, {
            toValue: 1,
            duration: CYCLE_MS * 0.3,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: CYCLE_MS * 0.3,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Pads each dot back out to a full cycle so the stagger stays fixed
          // instead of drifting apart over time.
          Animated.delay(CYCLE_MS * 0.4 - i * STAGGER_MS),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [dots, reduced]);

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: dot.interpolate({inputRange: [0, 1], outputRange: [0.45, 1]}),
              transform: [
                {translateY: dot.interpolate({inputRange: [0, 1], outputRange: [0, -5]})},
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7},
  dot: {width: 6, height: 6, borderRadius: 999},
});
