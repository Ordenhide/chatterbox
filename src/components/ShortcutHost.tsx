import React, {useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {HANDLED_KEYS, isMacOS, matchShortcut, type KeyLike, type ShortcutId} from '../services/shortcuts';
import {
  DEFAULT_TOUCH_BAR,
  isTouchBarSupported,
  onTouchBarPress,
  setTouchBarItems,
} from '../services/touchBar';

/**
 * Delivers keyboard shortcuts and Touch Bar presses to one handler.
 *
 * Wraps the app root because react-native-macos routes key events through the
 * view hierarchy: a view only receives a key it has claimed via
 * `keyDownEvents`, and anything unclaimed is handled by AppKit instead (which
 * for an unbound chord means the system beep). Claiming exactly the bound set
 * at the root leaves every other key with its normal behaviour, including
 * typing in the composer.
 *
 * On iOS and Android this renders a plain View and nothing else — the props
 * below are macOS-only and simply ignored, so there is no platform fork in the
 * navigator.
 *
 * The Touch Bar mirrors the same ids, so a tap and a key press converge on one
 * code path rather than drifting apart.
 */
export default function ShortcutHost({
  onShortcut,
  children,
}: {
  onShortcut: (id: ShortcutId) => void;
  children: React.ReactNode;
}) {
  // Kept in a ref so the Touch Bar subscription doesn't need re-creating each
  // time the handler identity changes.
  const handlerRef = useRef(onShortcut);
  handlerRef.current = onShortcut;

  useEffect(() => {
    if (!isMacOS()) return;
    let active = true;
    isTouchBarSupported().then(supported => {
      if (active && supported) setTouchBarItems(DEFAULT_TOUCH_BAR);
    });
    const unsubscribe = onTouchBarPress(id => handlerRef.current(id as ShortcutId));
    return () => {
      active = false;
      unsubscribe();
      // Leave a clean strip behind rather than buttons that no longer route
      // anywhere once this host unmounts (e.g. on sign-out).
      setTouchBarItems([]);
    };
  }, []);

  if (!isMacOS()) return <View style={styles.fill}>{children}</View>;

  // `keyDownEvents` / `onKeyDown` exist only on react-native-macos's View. This
  // project typechecks against the `react-native` types (shared with iOS and
  // Android), which don't declare them, so they're applied as untyped props.
  // Narrowed to this one object rather than casting the whole element, so the
  // style and children stay checked.
  const macOSKeyProps = {
    // Claiming the chords is what makes macOS deliver them here rather than
    // letting AppKit beep at an unhandled shortcut.
    keyDownEvents: HANDLED_KEYS,
    onKeyDown: (e: {nativeEvent?: KeyLike}) => {
      const native = e?.nativeEvent;
      if (!native) return;
      // `typing` is false because a focused TextInput consumes its own key
      // events before they reach this view — bare '?' still types normally.
      const id = matchShortcut(native, {typing: false});
      if (id) handlerRef.current(id);
    },
  } as unknown as Record<string, unknown>;

  return (
    <View style={styles.fill} {...macOSKeyProps}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({fill: {flex: 1}});
