import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, useColorScheme} from 'react-native';
import {getColors} from '../theme/colors';
import {coldOpenFrame, scrambleFrame, useReduceMotion} from '../utils/motion';
import {fonts} from '../theme/typography';

/**
 * The launch sequence: the wordmark arrives sealed and resolves into itself.
 *
 * Same claim CipherText makes about messages, made about the product: this app
 * seals everything it sends (services/e2ee.ts), and the first thing it shows
 * you is that fact rather than a logo that could belong to any messenger. The
 * effect is the same primitive — scrambleFrame over CIPHER_GLYPHS — so the
 * launch and the first message you receive are visibly the same gesture.
 *
 * It plays over work that is genuinely happening. App.tsx renders nothing
 * while the auth check is in flight; this occupies exactly that gap instead of
 * manufacturing a delay, and holds only as long as its own sequence needs (see
 * `played` below and the hold in App.tsx).
 */

const WORDMARK = 'Chatterbox';

/**
 * Cold opens are for cold starts. Module scope rather than component state, so
 * a remount — a re-render of AppContent, a fast refresh, signing out and back
 * in — replays nothing. Only a fresh JS context, which is exactly what a cold
 * start is, gets the sequence.
 */
let played = false;

/** True before the first play. App.tsx asks so it can skip the hold entirely
 * on a warm start rather than waiting on a sequence that will not run. */
export function coldOpenPending(): boolean {
  return !played;
}

/** ~30fps, matching CipherText. The scramble is text churn, not motion. */
const FRAME_MS = 33;

export default function ColdOpen({onDone}: {onDone: () => void}) {
  const reduced = useReduceMotion();
  const colors = getColors(useColorScheme());
  const [text, setText] = useState(() =>
    // First paint is fully sealed, never the real word: a single frame of
    // "Chatterbox" before the scramble starts would give away the reveal.
    scrambleFrame(WORDMARK, 0),
  );

  // Native-driven, so the fade and lift never cross the bridge per frame. The
  // text above is JS-side by necessity — it is a string, not a transform.
  const enter = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  // onDone is called from inside a ticker that must not restart when the
  // parent re-renders with a new callback identity.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    played = true;

    if (reduced) {
      setText(WORDMARK);
      onDoneRef.current();
      return;
    }

    Animated.timing(enter, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const startedAt = Date.now();
    let lastFrame = 0;
    let raf = requestAnimationFrame(function tick() {
      const now = Date.now();
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        const {phase, progress} = coldOpenFrame(now - startedAt);
        if (phase === 'seal') {
          // Held at 0: fully ciphertext, re-randomising every frame so the
          // wordmark reads as live rather than as a static string of symbols.
          setText(scrambleFrame(WORDMARK, 0));
        } else if (phase === 'resolve') {
          setText(scrambleFrame(WORDMARK, progress));
        } else {
          setText(WORDMARK);
          if (phase === 'done') {
            Animated.timing(exit, {
              toValue: 1,
              // Shortened with the phases in motion.ts — this fade is time the
              // app is ready and still hidden.
              duration: 160,
              useNativeDriver: true,
            }).start(() => onDoneRef.current());
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(raf);
  }, [enter, exit, reduced]);

  if (reduced) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        {
          backgroundColor: colors.backdrop,
          opacity: exit.interpolate({inputRange: [0, 1], outputRange: [1, 0]}),
        },
      ]}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
            // Settles from slightly large, so the wordmark reads as coming to
            // rest rather than as popping in.
            {
              scale: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [1.06, 1],
              }),
            },
          ],
        }}>
        <Text style={[styles.wordmark, {color: colors.text}]}>{text}</Text>
        {/* Grows from the centre as the reveal lands — scaleX has no
            transform-origin in React Native, and a symmetrical grow suits an
            underline anyway. */}
        <Animated.View
          style={[
            styles.rule,
            {
              backgroundColor: colors.primary,
              opacity: enter,
              transform: [{scaleX: enter}],
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    // Above the navigator and the ambient backdrop both.
    zIndex: 10,
  },
  wordmark: {
    // Mono, not the display face, and for a reason that outranks branding:
    // this text is *ciphertext* for most of its life, re-randomising every
    // frame. In any proportional face the line would change width on each
    // frame and visibly jitter — `tabular-nums` does not save it, since that
    // only equalises digits and this alphabet is mostly letters and symbols.
    // A fixed advance makes the resolve land dead still.
    //
    // It also happens to be the honest reading: the machine half of the app
    // speaks in mono (see CipherTexture and the seal pill), and this is the
    // machine handing the name over.
    fontFamily: fonts.mono.medium,
    fontSize: 30,
    letterSpacing: 2,
    textAlign: 'center',
  },
  rule: {
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    alignSelf: 'stretch',
  },
});
