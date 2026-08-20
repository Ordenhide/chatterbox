import React, {useCallback, useMemo, useRef} from 'react';
import {Animated, NativeSyntheticEvent, StyleSheet, View} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerEventPayload,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import Icon from './Icon';
import {fire} from '../utils/haptics';
import {
  PullDirection,
  rubberbandRange,
  shouldCommit,
  SPRING,
  useReduceMotion,
} from '../utils/motion';

/** How far you pull before releasing would commit. */
const THRESHOLD = 74;

/**
 * The ceiling `rubberband` asymptotes toward past the threshold. Deliberately
 * larger than the threshold: resistance you can feel needs somewhere to go, but
 * a bubble that can be dragged halfway across the screen stops reading as
 * attached to the conversation.
 */
const RESIST_DIMENSION = 120;

/**
 * Degrees of tilt at full pull. Tiny on purpose — it should register as the
 * bubble hanging off an edge rather than as the bubble rotating.
 */
const TILT_DEG = 2;

/** Only respond once the finger has clearly chosen horizontal. */
const DIRECTION_HYSTERESIS = 14;

/**
 * Swipe a message sideways to reply to it.
 *
 * Replaces gesture-handler's stock `Swipeable`, which tracked the finger
 * linearly, offered no resistance at the commit point, fired no haptic, threw
 * away the release velocity, and — because nothing ever called `close()` —
 * left the row sitting open afterwards.
 *
 * The four properties that make direct manipulation feel physical, all of them
 * from utils/motion.ts:
 *
 *   1. Rubber-banding. 1:1 to the threshold, resisted past it. The curve is
 *      sampled into an interpolation table (rubberbandRange) so it evaluates on
 *      the native side; computing it in JS would drag every frame back across
 *      the bridge.
 *   2. A haptic detent on the frame the gesture arms, not on the touch that
 *      eventually leads there — which is what lets you reply without watching.
 *   3. Velocity handoff. The release spring starts at the finger's actual
 *      speed, so there is no seam between dragging and animating.
 *   4. Interruptibility. Grabbing a bubble mid-spring picks it up from where it
 *      is rather than snapping it back to zero first.
 */
export default function SwipeToReply({
  children,
  onReply,
  enabled = true,
  direction = -1,
  tintColor,
}: {
  children: React.ReactNode;
  onReply: () => void;
  enabled?: boolean;
  /** -1 swipes left (the default), 1 swipes right. */
  direction?: PullDirection;
  tintColor: string;
}) {
  const reduced = useReduceMotion();
  const pull = useRef(new Animated.Value(0)).current;
  // Whether the gesture is currently past the commit point. A ref rather than
  // state: this is read and written from a gesture callback that runs every
  // frame, and re-rendering the bubble on each crossing would be absurd.
  const armed = useRef(false);
  // True only between BEGAN and the gesture ending; see onHandlerStateChange.
  const gestureActive = useRef(false);

  const {inputRange, outputRange} = useMemo(
    () => rubberbandRange(THRESHOLD, RESIST_DIMENSION, direction),
    [direction],
  );

  const translateX = useMemo(
    () => pull.interpolate({inputRange, outputRange, extrapolate: 'clamp'}),
    [pull, inputRange, outputRange],
  );

  // Tilt opposes travel, so the bubble reads as hinged at the edge it is
  // anchored to rather than sliding flat.
  const rotate = useMemo(
    () =>
      pull.interpolate({
        inputRange: direction < 0 ? [-THRESHOLD, 0] : [0, THRESHOLD],
        outputRange:
          direction < 0 ? [`${TILT_DEG}deg`, '0deg'] : ['0deg', `${-TILT_DEG}deg`],
        extrapolate: 'clamp',
      }),
    [pull, direction],
  );

  // The affordance stays hidden for the first third of the pull: revealing it
  // immediately turns every incidental horizontal scroll into a flash of UI.
  const revealRange = useMemo(
    () =>
      direction < 0
        ? [-THRESHOLD, -THRESHOLD * 0.35, 0]
        : [0, THRESHOLD * 0.35, THRESHOLD],
    [direction],
  );
  const iconOpacity = useMemo(
    () =>
      pull.interpolate({
        inputRange: revealRange,
        outputRange: direction < 0 ? [1, 0, 0] : [0, 0, 1],
        extrapolate: 'clamp',
      }),
    [pull, revealRange, direction],
  );
  const iconScale = useMemo(
    () =>
      pull.interpolate({
        inputRange: revealRange,
        outputRange: direction < 0 ? [1, 0.6, 0.6] : [0.6, 0.6, 1],
        extrapolate: 'clamp',
      }),
    [pull, revealRange, direction],
  );

  const onGestureEvent = useMemo(
    () =>
      // Generic is the *payload*: Animated.event types its listener as
      // NativeSyntheticEvent<T>, and PanGestureHandlerGestureEvent is already
      // that wrapper, so passing it here would nest the event inside itself.
      Animated.event<PanGestureHandlerEventPayload>([{nativeEvent: {translationX: pull}}], {
        useNativeDriver: true,
        // The transform above is driven natively; this listener exists only to
        // watch for the threshold crossing. It fires on the same frame the
        // detent visually catches, which is the entire point of a detent.
        listener: (event: NativeSyntheticEvent<PanGestureHandlerEventPayload>) => {
          const travel = event.nativeEvent.translationX;
          const next = direction < 0 ? travel <= -THRESHOLD : travel >= THRESHOLD;
          if (next === armed.current) return;
          armed.current = next;
          fire(next ? 'arm' : 'revert');
        },
      }),
    [pull, direction],
  );

  const settle = useCallback(
    (velocity: number) => {
      if (reduced) {
        pull.setValue(0);
        return;
      }
      // Velocity handoff. `pull` is in points, so the gesture's px/s velocity
      // is already in the right units — no normalisation (see
      // normalizedVelocity, which is for 0→1 drivers instead).
      Animated.spring(pull, {toValue: 0, velocity, ...SPRING}).start();
    },
    [pull, reduced],
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const {state, translationX, velocityX} = event.nativeEvent;

      if (state === State.BEGAN) {
        // Interruptibility: adopt wherever the spring currently is as the new
        // origin, so a mid-flight grab continues from the presentation value
        // instead of jumping to zero. gesture-handler reports translation
        // relative to the start of *this* gesture, hence the offset.
        //
        // stopAnimation's callback is asynchronous — it has to ask the native
        // side where the value actually is. A very short tap can therefore end
        // before it lands, and applying an offset after flattenOffset has
        // already run would stick that offset on permanently, leaving the
        // bubble parked off to one side. The flag makes the callback a no-op
        // once the gesture is over.
        gestureActive.current = true;
        pull.stopAnimation((current: number) => {
          if (!gestureActive.current) return;
          pull.setOffset(current);
          pull.setValue(0);
        });
        return;
      }

      if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) {
        return;
      }

      gestureActive.current = false;
      pull.flattenOffset();
      const commit =
        state === State.END && shouldCommit(translationX, velocityX, THRESHOLD, direction);
      armed.current = false;

      if (commit) fire('commit');
      settle(velocityX);
      // After the spring is under way, so the reply bar appearing never
      // competes with the bubble still travelling.
      if (commit) onReply();
    },
    [pull, direction, settle, onReply],
  );

  return (
    <PanGestureHandler
      enabled={enabled}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      // Horizontal intent only. Without this the handler competes with the
      // message list and the thread stops scrolling.
      activeOffsetX={[-DIRECTION_HYSTERESIS, DIRECTION_HYSTERESIS]}
      failOffsetY={[-DIRECTION_HYSTERESIS, DIRECTION_HYSTERESIS]}>
      <Animated.View>
        <View
          pointerEvents="none"
          style={[styles.affordance, direction < 0 ? styles.affordanceRight : styles.affordanceLeft]}>
          <Animated.View style={{opacity: iconOpacity, transform: [{scale: iconScale}]}}>
            <Icon name="forward" size={18} color={tintColor} />
          </Animated.View>
        </View>
        <Animated.View style={{transform: [{translateX}, {rotate}]}}>{children}</Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  affordance: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affordanceRight: {right: 0},
  affordanceLeft: {left: 0},
});
