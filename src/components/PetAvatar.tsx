import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleProp, View, ViewStyle} from 'react-native';
import Icon, {type IconName} from './Icon';
import {petMotionProfile, SPRING, useReduceMotion} from '../utils/motion';
import type {ChatPet} from '../types';

const SPECIES_ICON: Record<ChatPet['species'], IconName> = {
  plant: 'seedling',
  cat: 'cat',
  dog: 'dog',
  bunny: 'rabbit',
  fox: 'fox',
};

/**
 * A chat pet that idles, breathes, and reacts to being fed — the animated
 * replacement for a single frozen species icon.
 *
 * Three independent animation drivers, each an Animated.Value looping or
 * firing on its own trigger:
 *
 *   `idle`  — a continuous 0→1→0 loop that bob, sway and breathing scale are
 *             all interpolated from together (see petMotionProfile), so the
 *             pet reads as one organic motion rather than three animations
 *             that happen to overlap. Its speed and amplitude come from
 *             `mood`, so a happier pet is visibly livelier, not just faster.
 *   `bounce`— a one-shot overshoot-and-settle on the house SPRING, fired when
 *             `feedPulse` advances. The caller (ChatScreen) is the thing that
 *             knows a feed just happened — see services/chatPet's
 *             didPetJustEat — this component only reacts to the counter.
 *   `sleepFloat` — a slow separate loop driving a small "z" that drifts up
 *             and fades, shown only while sleeping. Kept off the idle driver
 *             deliberately: a floating glyph and a breathing bob are two
 *             different gestures, and forcing them to share a phase would
 *             make both look worse.
 *
 * All three collapse to a static pose under Reduce Motion — mood still shows
 * through `restOpacity` (a sleeping pet is dimmed even standing still), just
 * without anything moving.
 */
export default function PetAvatar({
  species,
  mood,
  feedPulse,
  arrivalPulse = 0,
  size = 24,
  color,
  style,
}: {
  species: ChatPet['species'];
  mood: ChatPet['mood'];
  feedPulse: number;
  /** Bumped whenever a message arrives, so the pet can react to it. */
  arrivalPulse?: number;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReduceMotion();
  const idle = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const sleepFloat = useRef(new Animated.Value(0)).current;
  // Compared against on every feedPulse change, not read as a dependency's
  // value — that's what makes pulse 3->4, 4->5, etc. each retrigger the
  // bounce, rather than only the first change after mount.
  const prevPulse = useRef(feedPulse);
  // Same retrigger trick as feedPulse above.
  const prevArrival = useRef(arrivalPulse);
  const lean = useRef(new Animated.Value(0)).current;

  const profile = petMotionProfile(mood);

  useEffect(() => {
    if (reduced) return;
    idle.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, {
          toValue: 1,
          duration: profile.bobDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(idle, {
          toValue: 0,
          duration: profile.bobDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, profile.bobDuration, idle]);

  useEffect(() => {
    if (reduced || mood !== 'sleeping') return;
    sleepFloat.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sleepFloat, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, mood, sleepFloat]);

  useEffect(() => {
    if (feedPulse === prevPulse.current) return;
    prevPulse.current = feedPulse;
    if (reduced) return;
    bounce.setValue(0);
    Animated.sequence([
      Animated.spring(bounce, {toValue: 1, ...SPRING}),
      Animated.timing(bounce, {toValue: 0, duration: 220, useNativeDriver: true}),
    ]).start();
  }, [feedPulse, reduced, bounce]);

  // An arriving message tugs the pet toward the thread and lets it recover.
  //
  // Summed onto the idle loop rather than replacing it — that continuity is the
  // whole difference between a creature that got nudged and a mascot that
  // switched animations. The idle bob, sway and breathing all keep running
  // underneath while this plays out.
  useEffect(() => {
    if (arrivalPulse === prevArrival.current) return;
    prevArrival.current = arrivalPulse;
    if (reduced) return;
    lean.setValue(0);
    Animated.sequence([
      Animated.timing(lean, {toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true}),
      Animated.spring(lean, {toValue: 0, ...SPRING}),
    ]).start();
  }, [arrivalPulse, reduced, lean]);

  const leanRotate = lean.interpolate({inputRange: [0, 1], outputRange: ['0deg', '-12deg']});
  const leanShift = lean.interpolate({inputRange: [0, 1], outputRange: [0, -5]});

  const idleTranslateY = idle.interpolate({inputRange: [0, 1], outputRange: [0, -profile.bobAmplitude]});
  const idleRotate = idle.interpolate({inputRange: [0, 1], outputRange: ['0deg', `${profile.rotateDeg}deg`]});
  const idleScale = idle.interpolate({inputRange: [0, 1], outputRange: [1, 1 + profile.scalePulse]});
  // A hop roughly twice the idle bob's reach reads as a distinct celebration
  // rather than one more idle cycle.
  const bounceLift = bounce.interpolate({inputRange: [0, 1], outputRange: [0, -(profile.bobAmplitude * 2 + 4)]});
  const bounceScale = bounce.interpolate({inputRange: [0, 1], outputRange: [1, 1.3]});

  return (
    <View style={style}>
      <Animated.View
        style={{
          opacity: profile.restOpacity,
          transform: reduced
            ? undefined
            : [
                {translateX: leanShift},
                {translateY: Animated.add(idleTranslateY, bounceLift)},
                {rotate: idleRotate},
                {rotate: leanRotate},
                {scale: Animated.multiply(idleScale, bounceScale)},
              ],
        }}>
        <Icon name={SPECIES_ICON[species]} size={size} color={color} />
      </Animated.View>
      {mood === 'sleeping' && !reduced ? (
        <Animated.Text
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            fontSize: Math.max(10, Math.round(size * 0.4)),
            fontWeight: '700',
            color,
            opacity: sleepFloat.interpolate({
              inputRange: [0, 0.15, 0.75, 1],
              outputRange: [0, 0.8, 0.8, 0],
            }),
            transform: [
              {translateY: sleepFloat.interpolate({inputRange: [0, 1], outputRange: [0, -10]})},
            ],
          }}>
          z
        </Animated.Text>
      ) : null}
    </View>
  );
}
