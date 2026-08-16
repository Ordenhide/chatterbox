import React, {useCallback, useRef, useState} from 'react';
import {
  Animated,
  Image,
  ImageResizeMode,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ImageStyle,
} from 'react-native';
import {fitContain, SPRING, TIMING, useReduceMotion} from '../utils/motion';

/** Breathing room around the expanded photo, in points. */
const VIEWER_PADDING = 24;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A thumbnail that expands into a full-screen viewer *from where it sits*,
 * rather than cross-fading a separate modal over it.
 *
 * The mobile counterpart of the web client's layoutId pairing (see
 * web/src/context/LightboxContext). framer-motion does this by measuring both
 * elements and interpolating between them; with no equivalent on this platform
 * the same three steps are done by hand:
 *
 *   1. measureInWindow the thumbnail at the moment of the tap — its position
 *      is only knowable then, since it moves with the scroll,
 *   2. render the photo at its *final* rect, then transform it back onto the
 *      thumbnail's rect,
 *   3. animate that transform to identity.
 *
 * Doing it in that direction — placing the destination and transforming
 * backwards — is what keeps the whole thing on the native driver. Animating
 * width/height/top/left would be the obvious approach and would relayout every
 * frame on the JS thread.
 *
 * The thumbnail stays mounted underneath; it is covered by the viewer's
 * backdrop, and leaving it there means the reverse animation has something to
 * land on if the list scrolled while the viewer was open.
 */
export default function ExpandingImage({
  uri,
  style,
  resizeMode = 'cover',
  accessibilityLabel,
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
}) {
  const thumbRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const {width: screenW, height: screenH} = useWindowDimensions();
  const reduced = useReduceMotion();

  const [from, setFrom] = useState<Rect | null>(null);
  const [natural, setNatural] = useState<{width: number; height: number} | null>(null);
  const [open, setOpen] = useState(false);

  const handlePress = useCallback(() => {
    const node = thumbRef.current;
    if (!node) return;
    // Natural size decides the destination rect. Requested alongside the
    // measurement rather than up front so a feed of photos never fetches
    // dimensions for images nobody opens.
    Image.getSize(
      uri,
      (width, height) => setNatural({width, height}),
      () => setNatural(null),
    );
    node.measureInWindow((x, y, width, height) => {
      if (!width || !height) return;
      setFrom({x, y, width, height});
      setOpen(true);
      progress.setValue(reduced ? 1 : 0);
      if (!reduced) Animated.spring(progress, {toValue: 1, ...SPRING}).start();
    });
  }, [uri, progress, reduced]);

  const handleClose = useCallback(() => {
    if (reduced) {
      setOpen(false);
      return;
    }
    // Timing rather than SPRING on the way out: an overshoot here would send
    // the photo past its thumbnail and back, drawing attention to a gesture
    // whose whole point is dismissal.
    Animated.timing(progress, {toValue: 0, ...TIMING}).start(({finished}) => {
      if (finished) setOpen(false);
    });
  }, [progress, reduced]);

  const target = fitContain(natural ?? {width: 0, height: 0}, {
    width: screenW - VIEWER_PADDING * 2,
    height: screenH - VIEWER_PADDING * 2,
  });

  // The transform that maps the destination rect back onto the thumbnail.
  // Both are measured from their centres, which is where RN applies scale.
  const viewer = from
    ? (() => {
        const dstX = (screenW - target.width) / 2;
        const dstY = (screenH - target.height) / 2;
        return {
          left: dstX,
          top: dstY,
          width: target.width,
          height: target.height,
          translateX: from.x + from.width / 2 - (dstX + target.width / 2),
          translateY: from.y + from.height / 2 - (dstY + target.height / 2),
          scaleX: target.width > 0 ? from.width / target.width : 1,
          scaleY: target.height > 0 ? from.height / target.height : 1,
        };
      })()
    : null;

  const at = (a: number, b: number) =>
    progress.interpolate({inputRange: [0, 1], outputRange: [a, b]});

  return (
    <>
      <Pressable
        onPress={handlePress}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel}>
        <View ref={thumbRef} collapsable={false}>
          <Image source={{uri}} style={style} resizeMode={resizeMode} />
        </View>
      </Pressable>

      {open && viewer && (
        <Modal visible transparent onRequestClose={handleClose} statusBarTranslucent>
          <Animated.View style={[styles.backdrop, {opacity: progress}]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>
          {/* The transform rides the wrapper rather than the Image so that
              pointerEvents can be declared on a View, where it is typed. Off,
              so a tap anywhere — photo included — reaches the backdrop and
              dismisses. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: viewer.left,
              top: viewer.top,
              width: viewer.width,
              height: viewer.height,
              transform: [
                {translateX: at(viewer.translateX, 0)},
                {translateY: at(viewer.translateY, 0)},
                {scaleX: at(viewer.scaleX, 1)},
                {scaleY: at(viewer.scaleY, 1)},
              ],
            }}>
            <Image source={{uri}} resizeMode="contain" style={styles.viewerImage} />
          </Animated.View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 7, 16, 0.86)',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
});
