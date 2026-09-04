import React, {useMemo} from 'react';
import {
  Animated,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
  requireNativeComponent,
  useColorScheme,
} from 'react-native';
import {getColors} from '../theme/colors';
import {useScrollMotionValue} from '../contexts/ScrollMotionContext';
import {useReduceMotion} from '../utils/motion';

/** How far the highlight slides, in points. */
const SPECULAR_TRAVEL = 90;
/** Scroll distance for one full sweep. */
const SPECULAR_PERIOD = 520;
/** Fraction of scroll the highlight tracks — well under the backdrop grid's,
 * so the glass reads as a separate surface catching the light. */
const SPECULAR_RATE = 0.6;

type GlassViewProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blur?: boolean;
  pointerEvents?: ViewProps['pointerEvents'];
};

const NativeGlassBlurView =
  Platform.OS === 'ios'
    ? requireNativeComponent<{
        style?: StyleProp<ViewStyle>;
        pointerEvents?: ViewProps['pointerEvents'];
      }>('GlassBlurView')
    : null;

/**
 * The highlight that slides across the glass as content moves under it.
 *
 * iOS 26's Liquid Glass defines itself by a specular highlight driven by the
 * device gyroscope. We cannot run Metal against the framebuffer from React
 * Native, and a shader dependency is not worth paying for chrome — but the
 * *read* only needs the highlight to answer to a real input rather than loop on
 * a timer. Scroll position is that input, and it is already being published for
 * the backdrop parallax (contexts/ScrollMotionContext), so this costs one
 * interpolation and no new plumbing.
 *
 * `Animated.modulo` makes it periodic, so it keeps sliding for as long as you
 * keep scrolling instead of running out after a screenful — the same trick the
 * backdrop grid uses.
 *
 * If a motion sensor is ever added, swapping the input here upgrades every
 * glass surface in the app at once.
 */
function Specular({tone}: {tone: {backgroundColor: string}}) {
  const scrollY = useScrollMotionValue();
  const reduced = useReduceMotion();

  const translateX = useMemo(() => {
    if (!scrollY || reduced) return null;
    return Animated.modulo(Animated.multiply(scrollY, SPECULAR_RATE), SPECULAR_PERIOD).interpolate({
      inputRange: [0, SPECULAR_PERIOD],
      outputRange: [-SPECULAR_TRAVEL, SPECULAR_TRAVEL],
    });
  }, [scrollY, reduced]);

  if (!translateX) return <View pointerEvents="none" style={[styles.specular, tone]} />;
  return (
    <Animated.View pointerEvents="none" style={[styles.specular, tone, {transform: [{translateX}]}]} />
  );
}

function GlassView({children, style, blur = true, pointerEvents = 'auto'}: GlassViewProps) {
  const colors = getColors(useColorScheme());
  const glassTone = {backgroundColor: colors.surface, borderColor: colors.glassBorder};
  const highlightTone = {backgroundColor: colors.glassHighlight};
  const useBlur = blur && Platform.OS === 'ios' && NativeGlassBlurView;
  return (
    <View style={[styles.container, style]} pointerEvents={pointerEvents}>
      {/* Glass effect background */}
      {useBlur ? (
        <NativeGlassBlurView
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.glass, glassTone]}
        />
      ) : (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glass, glassTone]} />
      )}
      <View pointerEvents="none" style={[styles.tint, {backgroundColor: colors.glassTint1}]} />
      <View pointerEvents="none" style={[styles.tintTwo, {backgroundColor: colors.glassTint2}]} />
      <View pointerEvents="none" style={[styles.tintThree, {backgroundColor: colors.glassTint3}]} />
      {/* Highlight overlay for depth */}
      <View pointerEvents="none" style={[styles.highlight, highlightTone]} />
      <Specular tone={highlightTone} />
      {/* Content */}
      {children}
    </View>
  );
}

export default React.memo(GlassView);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  glass: {
    // Subtle border for glass effect
    borderWidth: StyleSheet.hairlineWidth,
  },
  tint: {
    position: 'absolute',
    top: -40,
    left: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.55,
  },
  tintTwo: {
    position: 'absolute',
    right: -30,
    bottom: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.45,
  },
  tintThree: {
    position: 'absolute',
    top: 20,
    right: -60,
    width: 220,
    height: 120,
    borderRadius: 80,
    opacity: 0.35,
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    // Gradient-like effect using opacity
    opacity: 0.28,
  },
  specular: {
    position: 'absolute',
    top: -18,
    left: -24,
    right: -24,
    height: 70,
    borderRadius: 999,
    // Colour comes from the theme (glassHighlight) at the call site, not from
    // a literal here. A fixed white sheen is a glass-gloss convention, and on
    // a black ground it reads as a smudge rather than as light; the dark theme
    // sweeps a faint green across the panel instead, which is the same gesture
    // in this design's own vocabulary.
    opacity: 0.45,
  },
});

