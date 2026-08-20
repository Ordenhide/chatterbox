import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {effectForAccent} from '../services/themeCatalog';
import {makeThemeParticles, useReduceMotion, type ThemeParticle} from '../utils/motion';

type Props = {
  /** The chat's accent — looked up against the catalog for its curated effect. */
  accent: string;
  /** The chat's wallpaper hex — same value as the gradient's last stop, used
   * as the static base layer and the whole backdrop when motion is reduced. */
  tint: string;
};

function Particle({particle, accent}: {particle: ThemeParticle; accent: string}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: particle.duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    // Staggered start so a batch of particles doesn't pulse in lockstep.
    const timer = setTimeout(() => loop.start(), particle.delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [progress, particle.delay, particle.duration]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${particle.left}%`,
        bottom: -particle.size * 2,
        width: particle.size,
        height: particle.size,
        borderRadius: particle.size / 2,
        backgroundColor: accent,
        transform: [
          {
            translateY: progress.interpolate({inputRange: [0, 1], outputRange: [0, -140]}),
          },
        ],
        opacity: progress.interpolate({
          inputRange: [0, 0.12, 0.88, 1],
          outputRange: [0, 0.75, 0.5, 0],
        }),
      }}
    />
  );
}

/**
 * Animated per-theme backdrop: two crossfading gradient layers plus a small
 * looping particle field, replacing the old flat wallpaper tint. The mobile
 * twin of web's `.cb-aurora` + `.cb-particles` (ChatPane.tsx/styles.css) —
 * same idea (curated stops, capped particle count, reduced-motion collapse
 * to a flat tint), different renderer because this platform has no CSS.
 *
 * Only `opacity`/`transform` are animated, all `useNativeDriver: true` —
 * this file's equivalent of the web's compositor-only rule (see motion.ts).
 */
export default function ThemeBackdrop({accent, tint}: Props) {
  const reduced = useReduceMotion();
  const {gradientStops, particles} = effectForAccent(accent);
  const phase = useRef(new Animated.Value(0)).current;
  // Built once per mount, not per render — same reasoning as
  // useReactionBurst's makeBurst call, just without needing a trigger.
  const particleList = useRef(makeThemeParticles(particles.density, particles.style)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 9000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, phase]);

  if (reduced) {
    return <View style={[StyleSheet.absoluteFill, {backgroundColor: tint, opacity: 0.15}]} />;
  }

  const layerAOpacity = phase.interpolate({inputRange: [0, 0.5, 1], outputRange: [0.3, 0.6, 0.3]});
  const layerBOpacity = phase.interpolate({inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0.6]});
  const breathe = phase.interpolate({inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1]});

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, {backgroundColor: tint, opacity: 0.15}]} />
      <Animated.View
        style={[StyleSheet.absoluteFill, {opacity: layerAOpacity, transform: [{scale: breathe}]}]}>
        <LinearGradient
          colors={gradientStops}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, {opacity: layerBOpacity}]}>
        <LinearGradient
          colors={gradientStops}
          start={{x: 1, y: 0}}
          end={{x: 0, y: 1}}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {particleList.map(particle => (
        <Particle key={particle.id} particle={particle} accent={gradientStops[0]} />
      ))}
    </View>
  );
}
