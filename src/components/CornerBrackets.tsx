import React from 'react';
import {StyleSheet, View, useColorScheme} from 'react-native';
import {getColors} from '../theme/colors';

/**
 * Four L-shaped ticks at the corners of a panel.
 *
 * The design's framing device: it marks a region as a readout without drawing
 * a full box around it, so a list of panels does not turn into a grid of
 * competing rectangles. Borrowed from targeting reticles and instrument
 * bezels, which is also why the ticks are short — a longer tick stops reading
 * as a corner mark and starts reading as a broken border.
 *
 * Absolutely positioned and non-interactive, so it composes onto any container
 * without touching that container's layout. The parent needs no relative
 * positioning of its own; RN views already establish one.
 *
 * `inset` exists because the ticks sit *on* the parent's edge by default,
 * which collides with a parent that also draws a hairline border — the two
 * lines land on the same pixel and the accent loses. Push them in by 2 in that
 * case rather than removing the parent's border.
 */
function CornerBrackets({size = 7, inset = 0, color}: {size?: number; inset?: number; color?: string}) {
  const colors = getColors(useColorScheme());
  const tint = color ?? colors.primary;
  const arm = {width: size, height: size, borderColor: tint, position: 'absolute' as const};
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={[arm, {top: inset, left: inset, borderTopWidth: 1, borderLeftWidth: 1}]} />
      <View style={[arm, {top: inset, right: inset, borderTopWidth: 1, borderRightWidth: 1}]} />
      <View style={[arm, {bottom: inset, left: inset, borderBottomWidth: 1, borderLeftWidth: 1}]} />
      <View style={[arm, {bottom: inset, right: inset, borderBottomWidth: 1, borderRightWidth: 1}]} />
    </View>
  );
}

export default React.memo(CornerBrackets);
