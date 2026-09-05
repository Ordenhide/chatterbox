/**
 * Invite links, both directions: the one you hand out and the one you were
 * handed.
 *
 * This screen replaces a search box. Typing someone's email used to be enough
 * to reach them, which meant the server had to hold a searchable email for
 * every account — see services/invites.ts for why that had to go. What is left
 * is deliberately more work: you have to already have a way to reach the
 * person, out of band, to send them a link.
 *
 * That cost is the feature. There is no way to find a Chatterbox user you do
 * not already know, which is also to say there is no way for anyone else to.
 */
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import {useAuth} from '../../contexts/AuthContext';
import {createChat, setChatName} from '../../services/firebaseChat';
import {
  acceptInvite,
  createInvite,
  forgetInvite,
  inviteLink,
  inviteState,
  outstandingInvite,
  parseInviteLink,
  rememberInvite,
  revokeInvite,
  type Invite,
  type InviteState,
} from '../../services/invites';
import {reportError} from '../../services/telemetry';
import {getColors} from '../../theme/colors';
import {bodyWeight, terminal} from '../../theme/typography';

/** Whole hours left, rounded up, so "1 hour" never means four minutes. */
function hoursLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (60 * 60 * 1000)));
}

export default function InviteScreen() {
  const {t} = useTranslation();
  const {user} = useAuth();
  const navigation = useNavigation<any>();
  const colors = getColors(useColorScheme());

  const [invite, setInvite] = useState<Invite | null>(null);
  const [state, setState] = useState<InviteState>('pending');
  const [minting, setMinting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [label, setLabel] = useState('');
  const [accepting, setAccepting] = useState(false);

  const refresh = useCallback(() => {
    let cancelled = false;
    outstandingInvite().then(async found => {
      if (cancelled) return;
      setInvite(found);
      if (!found) return;
      // Costs one read on focus, and answers the question the screen is
      // actually being opened to ask: did they use it yet?
      const current = await inviteState(found.token);
      if (!cancelled) setState(current);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(refresh);

  const handleCreate = async () => {
    if (!user || minting) return;
    setMinting(true);
    try {
      const result = await createInvite(user.uid);
      if (!result.ok) {
        Alert.alert(
          t('common.error'),
          result.reason === 'not-enrolled'
            ? t('invite.errors.noKey')
            : t('invite.errors.createFailed'),
        );
        return;
      }
      await rememberInvite(result.invite);
      setInvite(result.invite);
      setState('pending');
    } finally {
      setMinting(false);
    }
  };

  const handleRevoke = () => {
    if (!invite) return;
    Alert.alert(t('invite.revokeTitle'), t('invite.revokeBody'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('invite.revoke'),
        style: 'destructive',
        onPress: async () => {
          await revokeInvite(invite.token);
          await forgetInvite();
          setInvite(null);
        },
      },
    ]);
  };

  const handleAccept = async () => {
    if (!user || accepting) return;
    const token = parseInviteLink(pasted);
    if (!token) {
      Alert.alert(t('common.error'), t('invite.errors.notALink'));
      return;
    }

    setAccepting(true);
    try {
      const result = await acceptInvite(token, user.uid);
      if (!result.ok) {
        Alert.alert(t('common.error'), t(`invite.errors.${result.reason}`));
        return;
      }

      // The name is the accepter's own word for this person, kept in `nameBy`
      // where it stays theirs. The server is never told who the other side is
      // called — that is the whole point of not having looked them up.
      const chosen = label.trim();
      const chatId = await createChat([user.uid, result.inviterUid], t('invite.defaultChatName'));
      if (chosen) await setChatName(chatId, user.uid, chosen);

      setPasted('');
      setLabel('');
      navigation.replace('Chat', {chatId, chatName: chosen || t('invite.defaultChatName')});
    } catch (error) {
      reportError(error, 'invite_accept_chat_failed');
      Alert.alert(t('common.error'), t('invite.errors.failed'));
    } finally {
      setAccepting(false);
    }
  };

  const link = invite ? inviteLink(invite.token) : '';

  return (
    <GlassScreen style={styles.container} textureSeed="invite">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('invite.yoursTitle')}</Text>

          {!invite ? (
            <>
              <Text style={[styles.body, {color: colors.textSecondary}]}>{t('invite.yoursIntro')}</Text>
              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.primary}, minting && styles.disabled]}
                accessibilityRole="button"
                accessibilityState={{disabled: minting}}
                disabled={minting}
                onPress={handleCreate}>
                {minting ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                    {t('invite.create')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Mono and selectable: it is a key, and it is read character by
                  character by anyone checking they copied the right one. */}
              <Text
                selectable
                style={[styles.link, {color: colors.text, borderColor: colors.glassBorder}]}>
                {link}
              </Text>
              <Text style={[styles.meta, {color: state === 'accepted' ? colors.primary : colors.textSecondary}]}>
                {state === 'accepted'
                  ? t('invite.stateAccepted')
                  : state === 'gone'
                    ? t('invite.stateGone')
                    : t('invite.statePending', {hours: hoursLeft(invite.expiresAt)})}
              </Text>

              <TouchableOpacity
                style={[styles.button, {backgroundColor: colors.primary}]}
                accessibilityRole="button"
                onPress={() => {
                  Clipboard.setString(link);
                  Alert.alert(t('invite.copiedTitle'), t('invite.copiedBody'));
                }}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                  {t('invite.copy')}
                </Text>
              </TouchableOpacity>

              {/* Below Copy, not above it. The share sheet hands the token to
                  whatever app the user picks, and some of those scan links;
                  copying and pasting into a conversation they already trust
                  passes it through less. */}
              <TouchableOpacity
                style={[styles.secondaryButton, {borderColor: colors.glassBorder}]}
                accessibilityRole="button"
                onPress={() => {
                  Share.share({message: link}).catch(error =>
                    reportError(error, 'invite_share_failed'),
                  );
                }}>
                <Text style={[styles.buttonText, {color: colors.text}]}>{t('invite.share')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.textButton}
                accessibilityRole="button"
                onPress={handleRevoke}>
                <Text style={[styles.textButtonText, {color: colors.danger}]}>
                  {t('invite.revoke')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </GlassView>

        <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('invite.openTitle')}</Text>
          <Text style={[styles.body, {color: colors.textSecondary}]}>{t('invite.openIntro')}</Text>

          <TextInput
            style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
            value={pasted}
            onChangeText={setPasted}
            placeholder={t('invite.linkPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            multiline
          />
          <TouchableOpacity
            style={[styles.secondaryButton, {borderColor: colors.glassBorder}]}
            accessibilityRole="button"
            onPress={() => Clipboard.getString().then(setPasted)}>
            <Text style={[styles.buttonText, {color: colors.text}]}>{t('invite.paste')}</Text>
          </TouchableOpacity>

          <Text style={[styles.label, {color: colors.textSecondary}]}>{t('invite.nameLabel')}</Text>
          <TextInput
            style={[styles.nameInput, {color: colors.text, borderColor: colors.glassBorder}]}
            value={label}
            onChangeText={setLabel}
            placeholder={t('invite.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={[styles.footnote, {color: colors.textSecondary}]}>
            {t('invite.nameHint')}
          </Text>

          <TouchableOpacity
            style={[
              styles.button,
              {backgroundColor: colors.primary},
              (accepting || !pasted.trim()) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{disabled: accepting || !pasted.trim()}}
            disabled={accepting || !pasted.trim()}
            onPress={handleAccept}>
            {accepting ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                {t('invite.open')}
              </Text>
            )}
          </TouchableOpacity>
        </GlassView>
      </ScrollView>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 16, gap: 16},
  section: {borderWidth: 1, borderRadius: 2, padding: 16},
  sectionTitle: {...terminal.label, marginBottom: 8},
  body: {fontSize: 14, lineHeight: 20, marginBottom: 14},
  link: {
    ...terminal.data,
    borderWidth: 1,
    borderRadius: 2,
    padding: 12,
    marginBottom: 10,
  },
  meta: {...terminal.micro, marginBottom: 14},
  label: {...terminal.label, marginTop: 6, marginBottom: 8},
  input: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 12,
    fontSize: 13,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  footnote: {fontSize: 12, lineHeight: 17, marginBottom: 14},
  button: {padding: 14, borderRadius: 2, alignItems: 'center'},
  secondaryButton: {
    padding: 14,
    borderRadius: 2,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 10,
  },
  textButton: {paddingVertical: 12, alignItems: 'center'},
  textButtonText: {...terminal.label},
  buttonText: {fontFamily: bodyWeight('600'), fontSize: 15},
  disabled: {opacity: 0.4},
});
