import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useTranslation} from 'react-i18next';
import {getColors} from '../theme/colors';
import {useColorScheme} from 'react-native';
import {getRecoveryPhrase, markRecoveryPhraseRevealed} from '../services/e2eeKeys';
import {reportError} from '../services/errorLog';
import {bodyWeight} from '../theme/typography';

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
  const {t} = useTranslation();
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
      Alert.alert(t('errors.genericTitle'), t('errors.genericBody'));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => {}}>
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <Text style={[styles.title, {color: colors.text}]}>{t('recovery.saveTitle')}</Text>
        {failed ? (
          <>
            <Text style={[styles.body, {color: colors.textSecondary}]}>
              {t('recovery.prepareFailed')}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.primary}]}
                onPress={onDone}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.body, {color: colors.textSecondary}]}>
              {t('recovery.whatItDoes')}
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
                  Alert.alert(t('profile.alerts.copiedTitle'), t('recovery.copiedBody'));
                }}>
                <Text style={[styles.buttonText, {color: colors.text}]}>{t('common.copy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.primary}]}
                disabled={!phrase || confirming}
                onPress={handleDone}>
                {confirming ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                    {t('recovery.savedIt')}
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
    fontFamily: bodyWeight('700'),
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
    fontFamily: bodyWeight('600'),
    fontSize: 15,
  },
});
