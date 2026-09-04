import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, useWindowDimensions, View} from 'react-native';
import {fanOutGhosts, useReduceMotion, type FanGhost} from '../utils/motion';

/**
 * One faint copy per recipient, blooming outward from a group send.
 *
 * Group messages really are fanned out — `sealForRecipients` seals a separate
 * envelope per member (services/e2ee.ts), so a twelve-person room means twelve
 * sealed copies leaving the device. This makes that visible: you learn the
 * security model without reading a word about it, and a group send stops
 * feeling identical to a 1:1.
 *
 * Nothing blooms in a 1:1 chat. With a single recipient there is no fan-out to
 * describe, and a lone copy drifting off a bubble would imply the message went
 * somewhere it did not.
 */

/** One pass, in ms. Long enough to read as distribution, short enough to be
 * over before the bubble has settled. */
const BLOOM_MS = 420;

export function useFanOutBloom() {
  const [blooms, setBlooms] = useState<{key: string; ghosts: FanGhost[]}[]>([]);

  const bloom = useCallback((memberCount: number) => {
    const ghosts = fanOutGhosts(memberCount);
    if (ghosts.length === 0) return;
    setBlooms(prev => [...prev, {key: `${Date.now()}-${prev.length}`, ghosts}]);
  }, []);

  const done = useCallback((key: string) => {
    setBlooms(prev => prev.filter(b => b.key !== key));
  }, []);

  return {blooms, bloom, done};
}

function Ghost({ghost, color}: {ghost: FanGhost; color: string}) {
  // One driver per ghost, every derived property interpolated off it, all of
  // it native — same shape as ReactionBurst's particles.
  const drive = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(drive, {
      toValue: 1,
      duration: BLOOM_MS,
      delay: ghost.delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [drive, ghost.delay]);

  // Out, then back: the copy is delivered, not thrown away.
  const translateX = drive.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, Math.cos(ghost.angle) * ghost.radius, 0],
  });
  const translateY = drive.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, Math.sin(ghost.angle) * ghost.radius, 0],
  });
  const scale = drive.interpolate({inputRange: [0, 0.55, 1], outputRange: [1, 0.5, 0.2]});
  const opacity = drive.interpolate({inputRange: [0, 0.55, 1], outputRange: [0.9, 0.55, 0]});

  return (
    <Animated.View
      style={[
        styles.ghost,
        {borderColor: color, opacity, transform: [{translateX}, {translateY}, {scale}]},
      ]}
    />
  );
}

export default function FanOutBloom({
  blooms,
  onDone,
  color,
}: {
  blooms: {key: string; ghosts: FanGhost[]}[];
  onDone: (key: string) => void;
  color: string;
}) {
  const reduced = useReduceMotion();
  const {width, height} = useWindowDimensions();

  // Anchored where an outgoing bubble lands rather than measured: the send has
  // already happened by the time this fires, and chasing the new bubble's rect
  // would mean a layout pass on the hot path of sending a message.
  const origin = {left: width - 96, top: height - 220};

  if (reduced || blooms.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {blooms.map(b => (
        <BloomHost key={b.key} bloom={b} onDone={onDone} color={color} origin={origin} />
      ))}
    </View>
  );
}

function BloomHost({
  bloom,
  onDone,
  color,
  origin,
}: {
  bloom: {key: string; ghosts: FanGhost[]};
  onDone: (key: string) => void;
  color: string;
  origin: {left: number; top: number};
}) {
  const {key, ghosts} = bloom;

  useEffect(() => {
    // Torn down on a timer rather than an animation callback: the ghosts are
    // staggered, so the last one finishes last, and a per-ghost callback would
    // race to remove the host out from under its siblings.
    const last = ghosts.length > 0 ? ghosts[ghosts.length - 1].delay : 0;
    const timer = setTimeout(() => onDone(key), BLOOM_MS + last + 80);
    return () => clearTimeout(timer);
  }, [key, ghosts, onDone]);

  return (
    <View style={[styles.host, origin]}>
      {ghosts.map(g => (
        <Ghost key={g.id} ghost={g} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    position: 'absolute',
    width: 74,
    height: 26,
    marginStart: -37,
    marginTop: -13,
    borderRadius: 2,
    borderWidth: 1,
  },
});
