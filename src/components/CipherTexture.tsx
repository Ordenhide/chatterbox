import React, {useMemo} from 'react';
import {StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {cipherTexture, hashSeed} from '../utils/motion';
import {fonts} from '../theme/typography';

/**
 * The sealed field every screen sits on.
 *
 * Every message in this app really is ciphertext until a key opens it
 * (services/e2ee.ts), and CipherText.tsx already animates that moment on
 * arrival. This is the other half of the same idea, held still: the material
 * a screen's content was decrypted *out of*, left visible underneath it.
 * Rendered once from GlassScreen, which is why every screen in the app has
 * one now rather than just an open chat.
 *
 * Static by design — see the note on cipherTexture in utils/motion.ts. The
 * resolve animation churns because it is about to stop; a background doing
 * that permanently would be unreadable to sit beside all day.
 *
 * Seeded from whatever identity the caller passes — a chat id for a
 * conversation, a fixed route name for everything else — so a given screen's
 * field is its own and is the same every time you open it.
 */

const FONT_SIZE = 10;
const LINE_HEIGHT = 17;
/**
 * IBM Plex Mono advances exactly 0.6em, so 6.0px at FONT_SIZE — deliberately
 * under-stated here.
 *
 * The estimate divides into the width to get glyphs-per-line, so a value that
 * is too *large* yields too few glyphs and can leave a bare strip at the
 * bottom of the screen; too small merely generates a few characters that wrap
 * off the end and cost nothing. The error is only safe in one direction.
 */
const CHAR_WIDTH = 5.8;

/** Low enough to read as paper texture rather than content competing with the
 * messages on top of it. Tuned against the darkest surface, where it shows most. */
const OPACITY = 0.05;

function CipherTexture({seed, color}: {seed: string; color: string}) {
  const {width, height} = useWindowDimensions();

  const text = useMemo(() => {
    const perLine = Math.ceil(width / CHAR_WIDTH);
    const lines = Math.ceil(height / LINE_HEIGHT);
    // +2 lines of slack so a rotation or a keyboard dismissal can't reveal an
    // unfilled edge before the next render.
    return cipherTexture(perLine * (lines + 2), hashSeed(seed || 'chatterbox'));
  }, [width, height, seed]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      <Text
        // Never announced: this is decorative texture standing in for content
        // the reader already has above it, and a screen reader spelling out a
        // few thousand cipher glyphs would be actively hostile.
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        selectable={false}
        style={[styles.glyphs, {color}]}>
        {text}
      </Text>
    </View>
  );
}

/** Memoised on seed/color: the texture is static, so re-rendering it as
 * messages arrive is pure waste behind a list that updates constantly. */
export default React.memo(CipherTexture);

const styles = StyleSheet.create({
  root: {
    opacity: OPACITY,
    overflow: 'hidden',
  },
  glyphs: {
    fontFamily: fonts.mono.regular,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
});
