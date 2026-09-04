import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getColors} from '../theme/colors';
import {SPRING, useReduceMotion} from '../utils/motion';
import {bodyWeight} from '../theme/typography';

export type SheetAction = {
  label: string;
  onPress: () => void;
  /** Rendered in the danger colour. Deletion and nothing else. */
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
};

/**
 * A bottom sheet of actions, for Android.
 *
 * Exists because `Alert.alert` cannot express this menu. Android's AlertDialog
 * has exactly three button slots — positive, negative, neutral — and React
 * Native's Android Alert maps `buttons[0..2]` onto them and **silently drops
 * everything after**. The chat message menu passes fourteen. Reply, Select and
 * Delete were reachable; Pin, Remind Me, Translate, Bookmark, Quote Wall,
 * Transcribe, More Reactions, all three quick reactions and Reaction Story
 * were not, on any Android build, with no error anywhere to say so. Two nested
 * menus were losing options the same way — "Remind Me" (four) and "Reaction
 * Story" (seven).
 *
 * iOS keeps ActionSheetIOS: it is the platform-native control, scrolls happily
 * past a dozen options, and has no such cap.
 *
 * The list scrolls rather than sizes to content, capped at 60% of the window,
 * so a long menu cannot push its own last item — or the cancel button — off the
 * bottom of the screen.
 */
export default function ActionSheet({visible, title, message, actions, onClose}: Props) {
  const colors = getColors(useColorScheme());
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const reduced = useReduceMotion();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Reset rather than animate out: Modal unmounts its content immediately
      // on visible={false}, so an exit animation would never be seen and would
      // only leave the value stranded mid-travel for the next open.
      slide.setValue(0);
      return;
    }
    if (reduced) {
      slide.setValue(1);
      return;
    }
    Animated.spring(slide, {toValue: 1, ...SPRING}).start();
  }, [visible, reduced, slide]);

  const translateY = slide.interpolate({inputRange: [0, 1], outputRange: [320, 0]});

  /**
   * Close first, then act.
   *
   * Several of these actions open a second sheet or an Alert of their own, and
   * on Android presenting a dialog from underneath one that is still dismissing
   * gets the new one dropped. Closing first also means the menu is already gone
   * by the time the reply bar or the reaction arc appears.
   */
  const run = (action: SheetAction) => {
    onClose();
    action.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Dismiss menu"
        onPress={onClose}>
        {/* Stops a tap on the sheet itself from reaching the scrim behind it. */}
        <Pressable onPress={() => {}}>
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + 8,
                transform: [{translateY}],
              },
            ]}>
            <View style={[styles.grabber, {backgroundColor: colors.border}]} />
            {title ? <Text style={[styles.title, {color: colors.text}]}>{title}</Text> : null}
            {message ? (
              <Text style={[styles.message, {color: colors.textSecondary}]}>{message}</Text>
            ) : null}
            <ScrollView
              style={{maxHeight: height * 0.6}}
              bounces={false}
              showsVerticalScrollIndicator={false}>
              {actions.map((action, index) => (
                <Pressable
                  key={`${action.label}-${index}`}
                  accessibilityRole="button"
                  style={({pressed}) => [
                    styles.row,
                    {borderTopColor: colors.border},
                    index === 0 && styles.firstRow,
                    pressed && {backgroundColor: colors.surface},
                  ]}
                  onPress={() => run(action)}>
                  <Text
                    style={[
                      styles.rowText,
                      {color: action.destructive ? colors.danger : colors.text},
                    ]}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              style={({pressed}) => [
                styles.cancel,
                {backgroundColor: pressed ? colors.border : colors.surface},
              ]}
              onPress={onClose}>
              <Text style={[styles.cancelText, {color: colors.text}]}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: bodyWeight('700'),
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  row: {
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  rowText: {
    fontSize: 16,
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 15,
    borderRadius: 2,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontFamily: bodyWeight('600'),
  },
});
