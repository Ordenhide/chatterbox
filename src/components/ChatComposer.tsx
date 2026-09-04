import React from 'react';
import {NativeSyntheticEvent, Platform, StyleSheet, TextInput, TextInputContentSizeChangeEventData} from 'react-native';
import {fonts} from '../theme/typography';

/**
 * The message input, deliberately *uncontrolled*.
 *
 * GiftedChat's own Composer is a controlled TextInput: it renders
 * `value={text}` and round-trips every keystroke out to the parent's state and
 * back (see node_modules/react-native-gifted-chat/lib/Composer.js). On Fabric
 * iOS that round-trip is what breaks typing — the native text view is
 * re-committed with the previous `value` before the state update lands, so
 * characters are reverted as fast as they are typed and the field stays empty
 * while the keyboard sits there looking fine. Android's Fabric text input is a
 * separate implementation and does not suffer from it.
 *
 * So the native side owns the text here. `onChangeText` still fires, but purely
 * to *mirror* the value outward for the things that need to read it — send,
 * scheduling, smart replies, drafts. Nothing is ever fed back in, so nothing
 * can revert what was typed.
 *
 * The rare cases that must *write* the text — restoring a draft, inserting a
 * transcription, editing a message — remount the field with a new
 * `defaultValue` via `generation` (see setComposerText in ChatScreen).
 * Remounting rather than `setNativeProps` on purpose: setNativeProps is not
 * supported under the New Architecture.
 *
 * Clearing is the exception and goes through the forwarded ref's `clear()`
 * instead. Clearing happens after every send, and a remount there would tear
 * the field down mid-conversation and take the keyboard with it.
 */
function ChatComposerInner({
  generation,
  defaultValue,
  onChangeText,
  onInputSizeChanged,
  composerHeight,
  placeholder,
  placeholderTextColor,
  textInputStyle,
  textInputProps,
  disableComposer,
  multiline = true,
}: {
  /** Bumped to force the field to adopt `defaultValue`. */
  generation: number;
  defaultValue: string;
  onChangeText: (text: string) => void;
  onInputSizeChanged?: (size: {width: number; height: number}) => void;
  composerHeight?: number;
  placeholder?: string;
  placeholderTextColor?: string;
  textInputStyle?: any;
  textInputProps?: Record<string, unknown>;
  disableComposer?: boolean;
  /** TEMP: testing whether Fabric iOS multiline is what breaks typing. */
  multiline?: boolean;
}, ref: React.Ref<TextInput>) {
  const handleContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => onInputSizeChanged?.(event.nativeEvent.contentSize);

  return (
    <TextInput
      ref={ref}
      // Remount on generation change so a programmatic write takes effect.
      key={generation}
      testID={placeholder}
      accessible
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      multiline={multiline}
      editable={!disableComposer}
      onContentSizeChange={handleContentSizeChange}
      onChangeText={onChangeText}
      // defaultValue, never value — this is the whole point of the component.
      defaultValue={defaultValue}
      enablesReturnKeyAutomatically
      underlineColorAndroid="transparent"
      style={[styles.textInput, textInputStyle, composerHeight ? {height: composerHeight} : null]}
      {...textInputProps}
    />
  );
}

const ChatComposer = React.forwardRef(ChatComposerInner);
export default ChatComposer;

// Mirrors GiftedChat's own Composer styles so swapping the component out does
// not shift the composer's metrics.
const styles = StyleSheet.create({
  textInput: {
    flex: 1,
    marginStart: 10,
    // Matches styles.messageText in ChatScreen: what you type should be set in
    // the same face it will be read in.
    //
    // On Android this line currently does nothing, and that is React Native's
    // to fix, not ours. Measured on RN 0.84.1 with the new architecture: the
    // composer renders in the system face no matter what is asked for here.
    // Changing this to fonts.mono.regular, to a hardcoded 'IBMPlexMono-Regular',
    // or to Android's own built-in 'monospace' all render identically, and
    // moving it to an inline style from ChatScreen does too — while fontSize
    // in this same object takes effect, so the style object is reaching the
    // view. In ReactEditText.kt, applyTextAttributes() sets size and letter
    // spacing directly, whereas setFontFamily() only marks typefaceDirty and
    // leaves the work to maybeUpdateTypeface().
    //
    // It stays because it is correct, it is what iOS uses, and it will start
    // working the day the underlying bug is fixed. Do not spend another
    // afternoon on it without first re-running the fontSize check above: if
    // that stops taking effect too, the problem has moved somewhere else.
    fontFamily: fonts.body.regular,
    fontSize: 16,
    lineHeight: 16,
    marginTop: Platform.select({ios: 6, android: 0}),
    marginBottom: Platform.select({ios: 5, android: 3}),
  },
});
