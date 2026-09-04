import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {getColors} from '../theme/colors';
import {useColorScheme} from 'react-native';
import {getRecoveryPhrase, markRecoveryPhraseRevealed} from '../services/e2eeKeys';
import {reportError} from '../services/telemetry';

type Props = {
  visible: boolean;
  userId: string;
  /** Called once the user has confirmed they saved the phrase. */
  onDone: () => void;
};

/**
 * One-time reveal of the device's E2EE recovery phrase. There is no "close
 * without saving" — see the module doc on markRecoveryPhraseRevealed in
 * e2eeKeys.ts: once this closes, the app never volunteers to show the phrase
 * again, so the only exit is the explicit "I've saved it" acknowledgement.
 */
export default function RecoveryPhraseRevealModal({visible, userId, onDone}: Props) {
  const colors = getColors(useColorScheme());
  const [phrase, setPhrase] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setFailed(false);
    getRecoveryPhrase(userId)
      .then(value => {
        if (active) setPhrase(value);
      })
      .catch(error => {
        reportError(error, 'e2ee_recovery_phrase_generate_failed');
        // Without this the modal sits on its spinner forever with both
        // buttons disabled and no close affordance — and it is opened
        // automatically over the chat list, so that would trap the user.
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [visible, userId]);

  const handleDone = async () => {
    setConfirming(true);
    try {
      await markRecoveryPhraseRevealed(userId);
      onDone();
    } catch (error) {
      reportError(error, 'e2ee_recovery_phrase_mark_revealed_failed');
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => {}}>
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <Text style={[styles.title, {color: colors.text}]}>Save your recovery phrase</Text>
        {failed ? (
          <>
            <Text style={[styles.body, {color: colors.textSecondary}]}>
              We couldn't prepare your recovery phrase just now. Your messages are unaffected —
              you can try again any time from Settings.
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.primary}]}
                onPress={onDone}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>Close</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.body, {color: colors.textSecondary}]}>
              This phrase can restore your encrypted message history if you ever reinstall the app
              or switch devices. Anyone who has it can read your messages, so write it down and
              keep it somewhere private — it will not be shown again.
            </Text>
            {phrase ? (
              <TextInput
                style={[styles.phraseBox, {color: colors.text, borderColor: colors.glassBorder}]}
                value={phrase}
                multiline
                editable={false}
              />
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.surface}]}
                disabled={!phrase}
                onPress={() => {
                  Clipboard.setString(phrase as string);
                  Alert.alert('Copied', 'Recovery phrase copied to clipboard.');
                }}>
                <Text style={[styles.buttonText, {color: colors.text}]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.primary}]}
                disabled={!phrase || confirming}
                onPress={handleDone}>
                {confirming ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                    I've saved it
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  phraseBox: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 16,
    fontSize: 16,
    lineHeight: 26,
    textAlignVertical: 'top',
    minHeight: 140,
  },
  loading: {
    minHeight: 140,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 2,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
