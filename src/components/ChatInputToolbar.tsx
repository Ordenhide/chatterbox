import React from 'react';
import {StyleSheet, View} from 'react-native';

/**
 * The composer's container, replacing GiftedChat's InputToolbar.
 *
 * GiftedChat's version keeps its own keyboard listeners and toggles the
 * toolbar's `position` between 'absolute' and 'relative' as the keyboard opens
 * and closes:
 *
 *     const [position, setPosition] = useState('absolute');
 *     Keyboard.addListener('keyboardWillShow', () => setPosition('relative'));
 *
 * That re-lays-out the toolbar — and the live, first-responder TextInput inside
 * it — in the middle of the keyboard transition. Under Fabric the text input
 * loses its session, UIKit's insertion request goes unanswered ("Result
 * accumulator timeout: 0.250000, exceeded"), and keystrokes reach the keyboard
 * but never reach the field. Confirmed by bisection: a bare TextInput elsewhere
 * on the same screen types perfectly, and only the toolbar's is dead.
 *
 * Those listeners are internal to InputToolbar, so GiftedChat's
 * `isKeyboardInternallyHandled={false}` does not switch them off — the only way
 * out is to not use the component. This one is a plain flex child: no
 * positioning, no keyboard listeners, nothing that moves the input while you
 * are typing into it. The keyboard is handled once, by the platform's
 * KeyboardAvoidingView in ChatScreen.
 */
export default function ChatInputToolbar(props: any) {
  const {
    renderActions,
    renderComposer,
    renderSend,
    renderAccessory,
    containerStyle,
    primaryStyle,
    accessoryStyle,
    surfaceColor,
    baseColor,
    borderColor,
  } = props || {};

  return (
    // Two layers, because the theme's surfaces are deliberately translucent
    // (`surfaceStrong` is 93% white). Over a saturated chat wallpaper that 7%
    // bleeds through and the composer reads as frosted — GiftedChat's toolbar
    // was flat opaque white, so this looked like a blur appearing from nowhere.
    // An opaque base underneath keeps the glass tint without the haze, which is
    // the same layering GlassScreen uses.
    <View style={[styles.container, {backgroundColor: baseColor, borderTopColor: borderColor}, containerStyle]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: surfaceColor}]} />
      {/* Above the input, not below it. GiftedChat renders the accessory after
          the primary row, which put "Replying to …" underneath the field you
          are replying from. Owning the toolbar means that is now just a
          question of order. */}
      {renderAccessory ? (
        <View style={[styles.accessory, accessoryStyle]}>{renderAccessory(props)}</View>
      ) : null}
      <View style={[styles.primary, primaryStyle]}>
        {renderActions?.(props)}
        {renderComposer?.(props)}
        {renderSend?.(props)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  accessory: {
    minHeight: 44,
    justifyContent: 'center',
  },
});
