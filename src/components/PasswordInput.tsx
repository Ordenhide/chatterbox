import React, {useState} from 'react';
import {StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import type {TextInputProps, TextStyle} from 'react-native';
import {useTranslation} from 'react-i18next';
import Icon from './Icon';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  iconColor?: string;
};

/**
 * Password field with a show/hide toggle. react-native-svg is already a
 * linked dependency (see TabIcon.tsx), so this needs no native font linking
 * like react-native-vector-icons would.
 *
 * Margin/flex from the passed style move to the wrapping View so the extra
 * layer doesn't change how the field sizes/spaces itself in a flex layout.
 */
export default function PasswordInput({style, iconColor, placeholderTextColor, ...rest}: Props) {
  const {t} = useTranslation();
  const [visible, setVisible] = useState(false);
  const flat: TextStyle = StyleSheet.flatten(style) || {};
  const {
    flex,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    ...inputStyle
  } = flat as TextStyle & Record<string, unknown>;

  const color =
    iconColor || (placeholderTextColor as string | undefined) || (inputStyle.color as string | undefined) || '#8A8F98';

  return (
    <View
      style={[
        styles.wrapper,
        {
          flex: flex as number | undefined,
          margin: margin as number | undefined,
          marginTop: marginTop as number | undefined,
          marginBottom: marginBottom as number | undefined,
          marginLeft: marginLeft as number | undefined,
          marginRight: marginRight as number | undefined,
          marginHorizontal: marginHorizontal as number | undefined,
          marginVertical: marginVertical as number | undefined,
        },
      ]}>
      <TextInput
        {...rest}
        placeholderTextColor={placeholderTextColor}
        style={[inputStyle, styles.input]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        onPress={() => setVisible(v => !v)}
        style={styles.toggle}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        accessibilityRole="button"
        accessibilityLabel={visible ? t('common.hidePassword') : t('common.showPassword')}>
        <Icon name={visible ? 'eyeOff' : 'eye'} color={color} size={20} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
  },
  input: {
    paddingRight: 44,
  },
  toggle: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
