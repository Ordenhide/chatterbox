import React, {useMemo} from 'react';
import {Platform, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {cipherTexture, hashSeed} from '../utils/motion';

/**
 * The sealed field a conversation sits on.
 *
 * Every message in this app really is ciphertext until a key opens it
 * (services/e2ee.ts), and CipherText.tsx already animates that moment on
 * arrival. This is the other half of the same idea, held still: the material
 * the thread was decrypted *out of*, left visible underneath it.
 *
 * Static by design — see the note on cipherTexture in utils/motion.ts. The
 * resolve animation churns because it is about to stop; a background doing
 * that permanently would be unreadable to sit beside all day.
 *
 * Seeded from the chat id, so a conversation's field is its own and is the
 * same every time you open it.
 */

/** Monospace metrics at FONT_SIZE, used to work out how many glyphs fill the
 * screen. Approximate on purpose: overshooting costs a few characters in a
 * string, undershooting would leave a visible bare corner. */
const FONT_SIZE = 10;
const LINE_HEIGHT = 17;
const CHAR_WIDTH = 6.1;

/** Low enough to read as paper texture rather than content competing with the
 * messages on top of it. Tuned against the darkest surface, where it shows most. */
const OPACITY = 0.05;

function CipherTexture({chatId, color}: {chatId: string; color: string}) {
  const {width, height} = useWindowDimensions();

  const text = useMemo(() => {
    const perLine = Math.ceil(width / CHAR_WIDTH);
    const lines = Math.ceil(height / LINE_HEIGHT);
    // +2 lines of slack so a rotation or a keyboard dismissal can't reveal an
    // unfilled edge before the next render.
    return cipherTexture(perLine * (lines + 2), hashSeed(chatId || 'chatterbox'));
  }, [width, height, chatId]);

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

/** Memoised on chatId/color: the texture is static, so re-rendering it as
 * messages arrive is pure waste behind a list that updates constantly. */
export default React.memo(CipherTexture);

const styles = StyleSheet.create({
  root: {
    opacity: OPACITY,
    overflow: 'hidden',
  },
  glyphs: {
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'}),
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
});
