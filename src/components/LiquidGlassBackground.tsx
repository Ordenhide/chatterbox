import React, {useMemo} from 'react';
import {StyleSheet, View, useColorScheme, useWindowDimensions} from 'react-native';
import Svg, {Line} from 'react-native-svg';
import {getColors} from '../theme/colors';

const GRID_SIZE = 44;

/**
 * Ambient app backdrop: a blueprint grid under two restrained accent glows.
 *
 * The glows are the original "liquid glass" blobs, kept for depth but dimmed
 * and re-tinted off the accent range by the theme tokens. The grid is what
 * carries the technical read, and mirrors the web client's `body::before`
 * (see web/src/styles.css) so the two clients feel like one product.
 */
function LiquidGlassBackground() {
  const colors = getColors(useColorScheme());
  const {width, height} = useWindowDimensions();

  // Static geometry — recomputed only on rotation/resize, not per render.
  const {verticals, horizontals} = useMemo(() => {
    const v: number[] = [];
    const h: number[] = [];
    for (let x = GRID_SIZE; x < width; x += GRID_SIZE) v.push(x);
    for (let y = GRID_SIZE; y < height; y += GRID_SIZE) h.push(y);
    return {verticals: v, horizontals: h};
  }, [width, height]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: colors.backdrop}]}>
      <View style={[styles.blob, styles.blobTopRight, {backgroundColor: colors.glassTint1}]} />
      <View style={[styles.blob, styles.blobBottomLeft, {backgroundColor: colors.glassTint2}]} />
      <View style={[styles.blob, styles.blobBottomRight, {backgroundColor: colors.glassTint3}]} />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} opacity={0.5}>
        {verticals.map(x => (
          <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke={colors.border} strokeWidth={1} />
        ))}
        {horizontals.map(y => (
          <Line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke={colors.border} strokeWidth={1} />
        ))}
      </Svg>
      <View style={[styles.overlay, {backgroundColor: colors.glassHighlight}]} />
    </View>
  );
}

export default React.memo(LiquidGlassBackground);

const styles = StyleSheet.create({
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
