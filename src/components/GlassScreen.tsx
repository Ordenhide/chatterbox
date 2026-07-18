import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle, useColorScheme} from 'react-native';
import {SafeAreaView, Edge} from 'react-native-safe-area-context';
import {getColors} from '../theme/colors';

type GlassScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

function GlassScreen({
  children,
  style,
  edges = ['top', 'bottom'],
  pointerEvents = 'box-none',
}: GlassScreenProps) {
  const colors = getColors(useColorScheme());
  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.backdrop}, style]}
      edges={edges}
      pointerEvents={pointerEvents}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, {backgroundColor: colors.background}]} />
      <View pointerEvents="none" style={[styles.blob, {backgroundColor: colors.glassTint1}]} />
      <View pointerEvents="none" style={[styles.blobTwo, {backgroundColor: colors.glassTint2}]} />
      <View pointerEvents="none" style={[styles.blobThree, {backgroundColor: colors.glassTint3}]} />
      {children}
    </SafeAreaView>
  );
}

export default React.memo(GlassScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    top: -80,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.35,
  },
  blobTwo: {
    position: 'absolute',
    right: -60,
    top: 120,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.3,
  },
  blobThree: {
    position: 'absolute',
    left: 40,
    bottom: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.25,
  },
});

