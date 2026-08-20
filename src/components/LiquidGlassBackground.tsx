import React, {useMemo} from 'react';
import {Animated, StyleSheet, View, useColorScheme, useWindowDimensions} from 'react-native';
import Svg, {Line} from 'react-native-svg';
import {getColors} from '../theme/colors';
import {useScrollMotionValue} from '../contexts/ScrollMotionContext';
import {PARALLAX_BACKDROP, PARALLAX_GLOW, useReduceMotion} from '../utils/motion';

const GRID_SIZE = 44;

/** How far the glows are allowed to drift before they hold position. Past this
 * they would leave their corners and stop reading as ambient lighting. */
const GLOW_DRIFT_LIMIT = 1200;

/**
 * Ambient app backdrop: a blueprint grid under two restrained accent glows.
 *
 * The glows are the original "liquid glass" blobs, kept for depth but dimmed
 * and re-tinted off the accent range by the theme tokens. The grid is what
 * carries the technical read, and mirrors the web client's `body::before`
 * (see web/src/styles.css) so the two clients feel like one product.
 *
 * Both layers parallax against the focused screen's scroll (see
 * contexts/ScrollMotionContext) at different rates — the grid closer to scroll
 * speed, the glows lagging further behind. The gap between those two rates is
 * the entire illusion of depth; matching them would just look like scrolling.
 *
 * The grid's offset is taken modulo GRID_SIZE, so it wraps seamlessly and
 * parallaxes forever instead of running out after a screenful. That only works
 * because the pattern is periodic — the glows are not, so they interpolate to
 * a ceiling and stop.
 */
function LiquidGlassBackground() {
  const colors = getColors(useColorScheme());
  const {width, height} = useWindowDimensions();
  const scrollY = useScrollMotionValue();
  const reduced = useReduceMotion();

  const gridHeight = height + GRID_SIZE * 2;

  // Static geometry — recomputed only on rotation/resize, not per render.
  //
  // Every coordinate is >= 0 on purpose. An <Svg> with no viewBox clips to its
  // own box, so a line drawn at a negative y is not "just above the edge", it
  // is not drawn at all. The extra row that hides the drift seam therefore has
  // to come from making the canvas taller and moving it up (see gridLayer),
  // never from negative coordinates.
  const {verticals, horizontals} = useMemo(() => {
    const v: number[] = [];
    const h: number[] = [];
    for (let x = 0; x <= width + GRID_SIZE; x += GRID_SIZE) v.push(x);
    for (let y = 0; y <= gridHeight; y += GRID_SIZE) h.push(y);
    return {verticals: v, horizontals: h};
  }, [width, gridHeight]);

  const parallax = useMemo(() => {
    if (!scrollY || reduced) return null;
    return {
      grid: Animated.modulo(Animated.multiply(scrollY, -PARALLAX_BACKDROP), GRID_SIZE),
      glow: scrollY.interpolate({
        inputRange: [0, GLOW_DRIFT_LIMIT],
        outputRange: [0, -GLOW_DRIFT_LIMIT * PARALLAX_GLOW],
        extrapolate: 'clamp',
      }),
    };
  }, [scrollY, reduced]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: colors.backdrop}]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          parallax ? {transform: [{translateY: parallax.glow}]} : null,
        ]}>
        <View style={[styles.blob, styles.blobTopRight, {backgroundColor: colors.glassTint1}]} />
        <View style={[styles.blob, styles.blobBottomLeft, {backgroundColor: colors.glassTint2}]} />
        <View style={[styles.blob, styles.blobBottomRight, {backgroundColor: colors.glassTint3}]} />
      </Animated.View>
      {/* Sized one cell taller than the screen and offset one cell above it, so
          the drift always has a drawn row to move into and the seam stays off
          screen. Explicitly positioned and sized rather than relying on
          overflow: iOS lets a child spill past its parent, Android clips it, and
          depending on that difference is what made the grid render differently
          on the two platforms. */}
      <Animated.View
        style={[
          styles.gridLayer,
          {top: -GRID_SIZE, height: gridHeight},
          parallax ? {transform: [{translateY: parallax.grid}]} : null,
        ]}>
        <Svg width={width} height={gridHeight} opacity={0.5}>
          {verticals.map(x => (
            <Line
              key={`v${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={gridHeight}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {horizontals.map(y => (
            <Line
              key={`h${y}`}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
        </Svg>
      </Animated.View>
      <View style={[styles.overlay, {backgroundColor: colors.glassHighlight}]} />
    </View>
  );
}

export default React.memo(LiquidGlassBackground);

const styles = StyleSheet.create({
  gridLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    // Dimmed from 0.7: the glows now frame the grid rather than dominate it.
    opacity: 0.45,
  },
  blobTopRight: {
    width: 320,
    height: 320,
    top: -120,
    right: -80,
  },
  blobBottomLeft: {
    width: 360,
    height: 360,
    bottom: -160,
    left: -120,
  },
  blobBottomRight: {
    width: 240,
    height: 240,
    bottom: -80,
    right: -60,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.25,
  },
});
