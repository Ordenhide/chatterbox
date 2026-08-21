import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle, useColorScheme} from 'react-native';
import {SafeAreaView, Edge} from 'react-native-safe-area-context';
import {getColors} from '../theme/colors';
import CipherTexture from './CipherTexture';

type GlassScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  /**
   * Identity for this screen's cipher field — see CipherTexture. A chat id
   * for a conversation, a fixed route name for everything else. Every
   * GlassScreen gets a field either way; this only controls which one.
   */
  textureSeed?: string;
  /**
   * Chat screens paint a custom wallpaper as their first child and need the
   * field to sit *above* that, not below it — so they render their own
   * CipherTexture in the right place and pass false here rather than get a
   * second copy that would just be hidden underneath.
   */
  showTexture?: boolean;
};

function GlassScreen({
  children,
  style,
  edges = ['top', 'bottom'],
  pointerEvents = 'box-none',
  textureSeed = 'chatterbox',
  showTexture = true,
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
      {showTexture ? <CipherTexture seed={textureSeed} color={colors.primary} /> : null}
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

