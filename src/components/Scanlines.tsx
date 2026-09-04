import React from 'react';
import {Image, StyleSheet, View, useColorScheme} from 'react-native';

/**
 * The CRT scanline field, drawn over a screen's background.
 *
 * A 1x4 PNG — three transparent rows and one at ~4% white — tiled with
 * resizeMode="repeat". A row of Views would need one per 4dp, roughly 200 on a
 * phone screen, for a purely decorative layer; an Image is a single node and
 * the tile is 73 bytes inlined, so nothing is fetched.
 *
 * Deliberately faint enough to be deniable. CipherTexture already sits on this
 * ground and is the stronger idea — it is real ciphertext, the material the
 * screen's content was decrypted out of, rather than a reference to old
 * hardware. This is grain on top of that, not a second thing competing with
 * it, which is why the alpha is 10/255 rather than anything you would notice
 * directly.
 *
 * Light theme only inverts the problem: dark lines on a pale ground read as
 * dirt rather than as a display, so the layer is dark-only. It is decoration
 * with no meaning to lose, so skipping it costs nothing.
 */
function Scanlines() {
  if (useColorScheme() !== 'dark') return null;
  return (
    // Wrapped rather than given pointerEvents directly: Image accepts it
    // neither as a prop nor in ImageStyle, and an overlay that takes touches
    // would make every screen under it inert.
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image
        source={{uri: TILE}}
        resizeMode="repeat"
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAECAYAAABP2FU6AAAAEElEQVR42mNgQAX////nAgAJFQMI+bEVfgAAAABJRU5ErkJggg==';

export default React.memo(Scanlines);
