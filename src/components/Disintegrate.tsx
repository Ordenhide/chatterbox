import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, View} from 'react-native';
import {
  DISINTEGRATE_MS,
  disintegrateShards,
  shouldBandDisintegrate,
  useReduceMotion,
} from '../utils/motion';

/**
 * A message coming apart as it burns.
 *
 * Burn-after-reading messages used to simply stop existing — the one moment in
 * the product where destruction is the *feature*, rendered as a list item
 * disappearing. Here the glyphs lift and drift instead, leading edge first, so
 * the sentence is consumed rather than deleted.
 *
 * Long messages degrade to a three-band wipe: the read is nearly identical and
 * the cost is three views instead of hundreds (see shouldBandDisintegrate).
 */
export default function Disintegrate({
  text,
  active,
  style,
  tint,
  children,
}: {
  text: string;
  /** Flips true the moment the message expires. Plays once. */
  active: boolean;
  style?: StyleProp<TextStyle>;
  /** Colour the glyphs take on as they go. */
  tint: string;
  /** The message as normally rendered, shown until `active`. */
  children: React.ReactNode;
}) {
  const reduced = useReduceMotion();
  const drive = useRef(new Animated.Value(0)).current;
  const banded = shouldBandDisintegrate(text.length);
  const shards = useMemo(
    () => (active && !banded ? disintegrateShards(text.length) : []),
    [active, banded, text.length],
  );

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      // Reduce Motion still needs the message to *go*; it just does not need to
      // be watched leaving.
      drive.setValue(1);
      return;
    }
    const anim = Animated.timing(drive, {
      toValue: 1,
      duration: DISINTEGRATE_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [active, reduced, drive]);

  if (!active) return <>{children}</>;

  if (banded || reduced) {
    // Three horizontal bands wiping out on a stagger. Fixed cost, and at this
    // length the per-glyph version would not read as glyphs anyway.
    return (
      <View>
        {[0, 1, 2].map(band => (
          <Animated.View
            key={band}
            style={{
              opacity: drive.interpolate({
                inputRange: [band * 0.22, band * 0.22 + 0.5],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            }}>
            <View style={styles.bandClip}>
              <View style={{marginTop: -band * BAND_HEIGHT}}>{children}</View>
            </View>
          </Animated.View>
        ))}
      </View>
    );
  }

  return (
    <Text style={style}>
      {Array.from(text).map((char, i) => {
        const shard = shards[i];
        if (!shard) return <Text key={i}>{char}</Text>;
        const at = shard.delay / (DISINTEGRATE_MS + shard.delay);
        return (
          <Animated.Text
            key={i}
            style={{
              color: tint,
              opacity: drive.interpolate({
                inputRange: [at, Math.min(1, at + 0.55)],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateX: drive.interpolate({
                    inputRange: [at, 1],
                    outputRange: [0, shard.dx],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  translateY: drive.interpolate({
                    inputRange: [at, 1],
                    outputRange: [0, shard.dy],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}>
            {char}
          </Animated.Text>
        );
      })}
    </Text>
  );
}

const BAND_HEIGHT = 22;

const styles = StyleSheet.create({
  bandClip: {
    height: BAND_HEIGHT,
    overflow: 'hidden',
  },
});
