import React from 'react';
import {StyleSheet, View, useColorScheme} from 'react-native';
import {getColors} from '../theme/colors';

function LiquidGlassBackground() {
  const colors = getColors(useColorScheme());

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: colors.backdrop}]}>
      <View style={[styles.blob, styles.blobTopRight, {backgroundColor: colors.glassTint1}]} />
      <View style={[styles.blob, styles.blobBottomLeft, {backgroundColor: colors.glassTint2}]} />
      <View style={[styles.blob, styles.blobBottomRight, {backgroundColor: colors.glassTint3}]} />
      <View style={[styles.overlay, {backgroundColor: colors.glassHighlight}]} />
    </View>
  );
}

export default React.memo(LiquidGlassBackground);

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.7,
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

