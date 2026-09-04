import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View} from 'react-native';
import {fire as haptic} from '../utils/haptics';
import {
  ARC_MAGNET_SCALE,
  arcMagnetism,
  nearestArcSlot,
  reactionArcSlots,
  SPRING,
  staggerDelay,
  useReduceMotion,
} from '../utils/motion';

const ARC_RADIUS = 96;

/**
 * Pick a reaction from an arc that leans toward your thumb.
 *
 * Two things separate this from a row of buttons. The arc puts every option
 * about the same distance from where your hand already is. And the nearest one
 * grows to meet your finger while its neighbours yield, with a light haptic
 * each time the selection changes — so you can pick without looking, which is
 * the entire point of a reaction.
 *
 * Entered from the message action menu rather than directly from the long
 * press. The long press already owns a full menu (reply, pin, translate,
 * bookmark, delete), and taking that gesture for reactions alone would cost far
 * more than the arc adds. The magnetism works the same either way — it just
 * begins on a fresh touch instead of continuing one.
 */
export default function ReactionArc({
  visible,
  emojis,
  onSelect,
  onClose,
  surfaceColor,
}: {
  visible: boolean;
  emojis: string[];
  onSelect: (emoji: string) => void;
  onClose: () => void;
  surfaceColor: string;
}) {
  const reduced = useReduceMotion();
  const slots = useMemo(() => reactionArcSlots(emojis.length, ARC_RADIUS), [emojis.length]);
  const [pulls, setPulls] = useState<number[]>(() => emojis.map(() => 0));
  // Read and written from the pan handlers on every move; state here would
  // re-render the whole arc per frame just to decide whether to buzz.
  const activeRef = useRef(-1);

  const reset = useCallback(() => {
    activeRef.current = -1;
    setPulls(emojis.map(() => 0));
  }, [emojis]);

  const commit = useCallback(
    (index: number) => {
      if (index >= 0 && index < emojis.length) {
        haptic('commit');
        onSelect(emojis[index]);
      }
      reset();
      onClose();
    },
    [emojis, onSelect, onClose, reset],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          // Relative to the arc's centre, which sits under the initial touch.
          const x = gesture.dx;
          const y = gesture.dy;
          setPulls(arcMagnetism(slots, x, y));
          const next = nearestArcSlot(slots, x, y);
          if (next !== activeRef.current) {
            activeRef.current = next;
            // Fires on the frame the selection actually changes — the faintest
            // beat available, because a sweep across six reactions would
            // otherwise be a rattle.
            if (next >= 0) haptic('select');
          }
        },
        onPanResponderRelease: () => commit(activeRef.current),
        onPanResponderTerminate: () => {
          reset();
          onClose();
        },
      }),
    [slots, commit, reset, onClose],
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.centre} {...responder.panHandlers}>
          {emojis.map((emoji, i) => (
            <Slot
              key={emoji}
              emoji={emoji}
              slot={slots[i]}
              pull={pulls[i] ?? 0}
              index={i}
              reduced={reduced}
              surfaceColor={surfaceColor}
              onPress={() => commit(i)}
            />
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function Slot({
  emoji,
  slot,
  pull,
  index,
  reduced,
  surfaceColor,
  onPress,
}: {
  emoji: string;
  slot: {x: number; y: number};
  pull: number;
  index: number;
  reduced: boolean;
  surfaceColor: string;
  onPress: () => void;
}) {
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const magnet = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (reduced) return;
    // Staggered outward from the centre, reusing the house stagger so the arc
    // blooms on the same cadence as every other list in the app.
    const anim = Animated.spring(enter, {toValue: 1, delay: staggerDelay(index), ...SPRING});
    anim.start();
    return () => anim.stop();
  }, [enter, index, reduced]);

  React.useEffect(() => {
    const target = 1 + pull * ARC_MAGNET_SCALE;
    if (reduced) {
      magnet.setValue(target);
      return;
    }
    // Interruptible by construction: Animated.spring on a value already in
    // flight continues from where it is, which is what keeps the arc tracking a
    // finger that changes direction mid-sweep.
    const anim = Animated.spring(magnet, {toValue: target, ...SPRING});
    anim.start();
    return () => anim.stop();
  }, [pull, magnet, reduced]);

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          backgroundColor: surfaceColor,
          transform: [
            {translateX: slot?.x ?? 0},
            {translateY: slot?.y ?? 0},
            {scale: Animated.multiply(enter, magnet)},
          ],
          opacity: enter,
        },
      ]}>
      <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={emoji}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  centre: {
    position: 'absolute',
    left: '50%',
    top: '55%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    position: 'absolute',
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {fontSize: 26, lineHeight: 32},
});
