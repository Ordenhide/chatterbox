import React, {useCallback, useRef} from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
  type AccessibilityRole,
} from 'react-native';
import {PRESS_SCALE, PRESS_SPRING, useReduceMotion} from '../utils/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A pressable that compresses under your finger and springs back.
 *
 * Built on Pressable rather than TouchableOpacity on purpose: TouchableOpacity
 * fades to 0.2 opacity on press, which reads as the control switching off
 * rather than as it being pushed. Scale reads as physical — the control is
 * still fully there, it just moved under the touch — and it composes with the
 * surface colours the glass components already carry, which a fade fights.
 *
 * PRESS_SPRING is stiffer and flatter than the house SPRING (see utils/motion):
 * feedback that overshoots under a finger that is still down feels loose, so
 * this one arrives and stops.
 */
export default function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
}) {
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = useCallback(
    (toValue: number) => {
      if (reduced) return;
      Animated.spring(scale, {toValue, ...PRESS_SPRING}).start();
    },
    [reduced, scale],
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => springTo(PRESS_SCALE)}
      // Both restore the resting size: onPressOut alone leaves a control stuck
      // compressed if the gesture is cancelled by a parent scroll taking over.
      onPressOut={() => springTo(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{disabled: !!disabled}}
      testID={testID}
      // Caller styles and the press transform go on the *same* element, which
      // is what TouchableOpacity does and what callers assume when they hand us
      // a style. Wrapping an inner Animated.View instead splits them: the
      // touchable ends up an unstyled box around a styled child, so hitSlop is
      // measured from different bounds than the ones drawn, and any layout the
      // caller expected to apply to the touchable lands on the child instead.
      style={[style, reduced ? null : {transform: [{scale}]}]}>
      {children}
    </AnimatedPressable>
  );
}
