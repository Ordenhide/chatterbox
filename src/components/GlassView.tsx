import React from 'react';
import {
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

type GlassViewProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blur?: boolean;
  pointerEvents?: ViewProps['pointerEvents'];
};

const NativeGlassBlurView =
  Platform.OS === 'ios'
    ? requireNativeComponent<{style?: ViewStyle}>('GlassBlurView')
    : null;

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
      <View pointerEvents="none" style={styles.specular} />
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    opacity: 0.45,
  },
});

