import React, {useState} from 'react';
import {Modal, StyleSheet, Text, TouchableOpacity, useColorScheme, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {getColors} from '../theme/colors';
import {bodyWeight} from '../theme/typography';

interface Step {
  emoji: string;
  title: string;
  body: string;
}

// A first-run walkthrough that mirrors the web tutorial: a full-screen slide
// carousel describing the essentials. Pure React Native + emoji (no native
// modules), so it works identically on iOS, Android and macOS.
const STEP_KEYS: {emoji: string; title: string; body: string}[] = [
  {emoji: '✨', title: 'tutorial.welcomeTitle', body: 'tutorial.welcomeBody'},
  {emoji: '💬', title: 'tutorial.chatsTitle', body: 'tutorial.chatsBody'},
  {emoji: '➕', title: 'tutorial.newChatTitle', body: 'tutorial.newChatBody'},
  {emoji: '📎', title: 'tutorial.composerTitle', body: 'tutorial.composerBody'},
  {emoji: '🧩', title: 'tutorial.spacesTitle', body: 'tutorial.spacesBody'},
  {emoji: '📞', title: 'tutorial.callsTitle', body: 'tutorial.callsBody'},
  {emoji: '🌟', title: 'tutorial.momentsTitle', body: 'tutorial.momentsBody'},
  {emoji: '⚙️', title: 'tutorial.profileTitle', body: 'tutorial.profileBody'},
  {emoji: '✅', title: 'tutorial.doneTitle', body: 'tutorial.doneBody'},
];

export default function TutorialTour({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const {t} = useTranslation();
  const colors = getColors(useColorScheme());
  const [i, setI] = useState(0);
  const last = i === STEP_KEYS.length - 1;
  const step: Step = {
    emoji: STEP_KEYS[i].emoji,
    title: t(STEP_KEYS[i].title),
    body: t(STEP_KEYS[i].body),
  };

  const close = () => {
    setI(0);
    onClose();
  };
  const next = () => (last ? close() : setI(v => v + 1));
  const back = () => setI(v => Math.max(0, v - 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.card, {backgroundColor: colors.surfaceStrong, borderColor: colors.glassBorder}]}>
          <TouchableOpacity style={styles.skip} onPress={close} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={[styles.skipText, {color: colors.textSecondary}]}>{last ? '' : t('tutorial.skip')}</Text>
          </TouchableOpacity>

          <View style={[styles.emojiCircle, {backgroundColor: colors.primaryLight}]}>
            <Text style={styles.emoji}>{step.emoji}</Text>
          </View>
          <Text style={[styles.title, {color: colors.text}]}>{step.title}</Text>
          <Text style={[styles.body, {color: colors.textSecondary}]}>{step.body}</Text>

          <View style={styles.dots}>
            {STEP_KEYS.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {backgroundColor: idx === i ? colors.primary : colors.border, width: idx === i ? 18 : 6},
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            {i > 0 ? (
              <TouchableOpacity style={[styles.back, {borderColor: colors.border}]} onPress={back}>
                <Text style={[styles.backText, {color: colors.text}]}>{t('tutorial.back')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backSpacer} />
            )}
            <TouchableOpacity style={[styles.next, {backgroundColor: colors.primary}]} onPress={next}>
              <Text style={[styles.nextText, {color: colors.textOnPrimary}]}>{last ? t('tutorial.done') : t('tutorial.next')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 2,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  skip: {position: 'absolute', top: 14, end: 16, minWidth: 36, alignItems: 'flex-end'},
  skipText: {fontSize: 14, fontFamily: bodyWeight('600')},
  emojiCircle: {
    width: 72,
    height: 72,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  emoji: {fontSize: 36},
  title: {fontSize: 22, fontFamily: bodyWeight('800'), textAlign: 'center', marginBottom: 10},
  body: {fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 22},
  dots: {flexDirection: 'row', gap: 6, marginBottom: 24},
  dot: {height: 6, borderRadius: 2},
  actions: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12},
  back: {flex: 1, paddingVertical: 13, borderRadius: 2, borderWidth: 1, alignItems: 'center'},
  backText: {fontSize: 15, fontFamily: bodyWeight('700')},
  backSpacer: {flex: 1},
  next: {flex: 1, paddingVertical: 13, borderRadius: 2, alignItems: 'center'},
  nextText: {fontSize: 15, fontFamily: bodyWeight('700'), color: '#fff'},
});
