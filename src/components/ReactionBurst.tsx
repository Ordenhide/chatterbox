import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import {makeBurst, useReduceMotion, type BurstParticle} from '../utils/motion';

/**
 * Emoji that float up from where a reaction was tapped — the mobile twin of
 * the web's `.cb-particle`.
 *
 * Rendered as a full-screen, non-interactive overlay rather than inside the
 * bubble: the message list clips its children, so a particle anchored to a
 * bubble would be cut off at the edge of the thread.
 */
export function useReactionBurst() {
  const [bursts, setBursts] = useState<{key: string; x: number; y: number; particles: BurstParticle[]}[]>([]);

  const burst = useCallback((emoji: string, x: number, y: number) => {
    setBursts(prev => [...prev, {key: `${Date.now()}-${prev.length}`, x, y, particles: makeBurst(emoji)}]);
  }, []);

  const done = useCallback((key: string) => {
    setBursts(prev => prev.filter(b => b.key !== key));
  }, []);

  return {bursts, burst, done};
}

function Particle({particle}: {particle: BurstParticle}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: particle.life,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, particle.life]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [
          {
            translateX: progress.interpolate({inputRange: [0, 1], outputRange: [0, particle.drift]}),
          },
          {
            translateY: progress.interpolate({inputRange: [0, 1], outputRange: [0, -96]}),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0.4, 1.15, 0.75],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${particle.spin}deg`],
            }),
          },
        ],
        opacity: progress.interpolate({
          inputRange: [0, 0.15, 1],
          outputRange: [0, 1, 0],
        }),
      }}>
      <Text style={styles.emoji}>{particle.emoji}</Text>
    </Animated.View>
  );
}

export default function ReactionBurst({
  bursts,
  onDone,
}: {
  bursts: {key: string; x: number; y: number; particles: BurstParticle[]}[];
  onDone: (key: string) => void;
}) {
  const reduced = useReduceMotion();

  // Each burst clears itself once its longest-lived particle is done. A timer
  // rather than an animation callback so one stopped animation (unmount,
  // backgrounding) can't strand the group on screen.
  useEffect(() => {
    if (!bursts.length) return;
    const timers = bursts.map(b =>
      setTimeout(() => onDone(b.key), Math.max(...b.particles.map(p => p.life)) + 60),
    );
    return () => timers.forEach(clearTimeout);
  }, [bursts, onDone]);

  if (reduced || !bursts.length) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bursts.map(b => (
        <View key={b.key} style={{position: 'absolute', left: b.x, top: b.y}}>
          {b.particles.map(p => (
            <Particle key={p.id} particle={p} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emoji: {fontSize: 22, lineHeight: 26},
});
