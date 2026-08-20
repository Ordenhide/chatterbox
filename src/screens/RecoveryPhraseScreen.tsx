import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getColors} from '../theme/colors';
import GlassScreen from '../components/GlassScreen';
import GlassView from '../components/GlassView';
import RecoveryPhraseRevealModal from '../components/RecoveryPhraseRevealModal';
import {useAuth} from '../contexts/AuthContext';
import {hasRevealedRecoveryPhrase, restoreDeviceKeypairFromPhrase} from '../services/e2eeKeys';
import {reportError} from '../services/telemetry';

export default function RecoveryPhraseScreen() {
  const colors = getColors(useColorScheme());
  const {user} = useAuth();
  const [revealed, setRevealed] = useState<boolean | null>(null);
  const [revealModalVisible, setRevealModalVisible] = useState(false);
  // Mirrors the uncontrolled input below purely so the button knows whether
  // there is anything to submit. Never written back into the field.
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restoring, setRestoring] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const canRestore = !!restorePhrase.trim() && !restoring;

  const refreshStatus = useCallback(() => {
    if (!user) return;
    hasRevealedRecoveryPhrase(user.uid)
      .then(setRevealed)
      .catch(() => setRevealed(false));
  }, [user]);

  useFocusEffect(refreshStatus);

  const handleRestore = async (allowKeyMismatch = false) => {
    if (!user || !restorePhrase.trim()) return;
    setRestoring(true);
    try {
      const result = await restoreDeviceKeypairFromPhrase(user.uid, restorePhrase, {
        allowKeyMismatch,
      });
      if (result.success) {
        // clear() rather than setRestorePhrase(''): the field is uncontrolled,
        // so emptying the mirror state alone would leave the phrase sitting
        // on screen after a successful restore.
        inputRef.current?.clear();
        setRestorePhrase('');
        refreshStatus();
        Alert.alert(
          'Recovery phrase restored',
          "Reopen your chats to see any messages that couldn't be decrypted before.",
        );
      } else if (result.reason === 'invalid-phrase') {
        Alert.alert(
          "That doesn't look right",
          'Check that all 24 words are spelled correctly and in order, then try again.',
        );
      } else if (result.reason === 'verification-unavailable') {
        Alert.alert(
          "Couldn't check your phrase",
          "We couldn't reach the server to confirm this phrase belongs to your account, so " +
            'nothing has been changed. Check your connection and try again.',
        );
      } else if (result.reason === 'publish-failed') {
        Alert.alert(
          "Couldn't finish restoring",
          'Your phrase was correct, but we couldn\'t save the change. Nothing has been ' +
            'changed on this device — check your connection and try again.',
        );
      } else {
        // Not an error so much as a fork. The phrase is a valid one; it just
        // isn't the key currently on file. That is precisely what a phrase
        // from an earlier device looks like once a later device republished
        // over it — the situation someone is usually here to fix — and it is
        // also what a phrase from the wrong account looks like. Nothing on
        // this device can tell the two apart, but the person holding the
        // phrase can, so say what each choice means and let them pick.
        Alert.alert(
          "This phrase isn't the key on file",
          'It may be from an older device, in which case restoring it is exactly what you ' +
            'want — it will bring back messages this device cannot read.\n\n' +
            'Your account will go back to using that older key. Anything sealed to the ' +
            'current key since then will stop being readable here, and your other devices ' +
            'will need this same phrase.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Restore anyway', style: 'destructive', onPress: () => handleRestore(true)},
          ],
        );
      }
    } catch (error) {
      reportError(error, 'e2ee_recovery_phrase_restore_failed');
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <GlassScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Your recovery phrase</Text>
          {revealed === null ? (
            <ActivityIndicator color={colors.primary} style={styles.statusLoader} />
          ) : revealed ? (
            <Text style={[styles.sectionBody, {color: colors.textSecondary}]}>
              You've already saved your recovery phrase on this device. For your security it
              won't be shown again — if you still have it, keep it somewhere safe. If you lost
              it, this device keeps working normally; you'll only need it to restore old messages
              on a different device.
            </Text>
          ) : (
            <>
              <Text style={[styles.sectionBody, {color: colors.textSecondary}]}>
                Back up the key that protects your messages. Anyone who sees this phrase can read
                your message history, so only reveal it somewhere private.
              </Text>
              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.primary}]}
                onPress={() => setRevealModalVisible(true)}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                  View recovery phrase
                </Text>
              </TouchableOpacity>
            </>
          )}
        </GlassView>

        <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Restore from a phrase</Text>
          <Text style={[styles.sectionBody, {color: colors.textSecondary}]}>
            Entering a previously saved recovery phrase replaces this device's key, so it can
            decrypt messages sealed to that phrase.
          </Text>
          {/* Uncontrolled: defaultValue, never value.
              A controlled TextInput round-trips each keystroke out to state and
              back, and on Fabric iOS the native field is re-committed with the
              previous value before the update lands — characters are reverted
              as fast as they are typed and the field just stays empty. That is
              the same failure that killed the chat composer (see
              components/ChatComposer.tsx). onChangeText still fires, but only
              to mirror the value outward for the button's enabled state;
              nothing is ever fed back in, so nothing can revert what you
              typed. */}
          <TextInput
            ref={inputRef}
            style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
            defaultValue=""
            onChangeText={setRestorePhrase}
            placeholder="Enter your 24-word recovery phrase"
            placeholderTextColor={colors.textSecondary}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            // A recovery phrase is not a password, but it is the whole key —
            // keep it out of the keyboard's learned-word store.
            autoComplete="off"
            spellCheck={false}
            textContentType="none"
          />
          <TouchableOpacity
            style={[
              styles.button,
              {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder},
              // Without this the button was disabled but looked identical to an
              // enabled one, so tapping it with an empty field did nothing at
              // all and gave no hint why.
              canRestore ? null : styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{disabled: !canRestore}}
            disabled={!canRestore}
            // Wrapped, not passed directly: onPress hands the press event to
            // its first argument, and a truthy event would read as
            // allowKeyMismatch and skip the check on every ordinary restore.
            onPress={() => handleRestore()}>
            {restoring ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.buttonText, {color: colors.text}]}>Restore</Text>
            )}
          </TouchableOpacity>
        </GlassView>
      </ScrollView>

      {user && (
        <RecoveryPhraseRevealModal
          visible={revealModalVisible}
          userId={user.uid}
          onDone={() => {
            setRevealModalVisible(false);
            refreshStatus();
          }}
        />
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  statusLoader: {
    marginVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
