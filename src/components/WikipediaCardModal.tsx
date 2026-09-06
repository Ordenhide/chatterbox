import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {getColors} from '../theme/colors';
import {bodyWeight} from '../theme/typography';
import {wikipediaSearchUrl} from '../services/wikipediaLookup';
import {
  WIKIPEDIA_USER_AGENT,
  fetchWikipediaSummary,
  type WikipediaSummary,
} from '../services/wikipediaSummary';

type State =
  | {phase: 'loading'}
  | {phase: 'found'; summary: WikipediaSummary}
  | {phase: 'missing'}
  | {phase: 'failed'};

/**
 * The card for one name the reader asked about.
 *
 * The request happens here, on mount, because this is the first moment anyone
 * asked for it. Its ancestor — context cards — fetched on its own initiative
 * for every thread that opened, and rendered nothing at all, because the card
 * markup sat behind a parity flag that has never been `true`. All of the
 * disclosure, none of the feature.
 *
 * Closing aborts: a reader who has moved on is not waiting for this.
 *
 * URLs go out through the caller's `onOpenUrl` rather than `Linking` here, so
 * that they pass the same `safeExternalUrl` guard as every other link the chat
 * screen opens.
 */
export default function WikipediaCardModal({
  phrase,
  language,
  onOpenUrl,
  onClose,
}: {
  phrase: string;
  language: string;
  onOpenUrl: (url: string) => void;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const colors = getColors(useColorScheme());
  const [state, setState] = useState<State>({phase: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({phase: 'loading'});
    setImageBroken(false);
    fetchWikipediaSummary(phrase, language, ctrl.signal).then(
      summary => {
        if (ctrl.signal.aborted) return;
        setState(summary ? {phase: 'found', summary} : {phase: 'missing'});
      },
      () => {
        // Kept apart from `missing` deliberately: telling someone their word
        // does not exist because the network is down is a lie.
        if (!ctrl.signal.aborted) setState({phase: 'failed'});
      },
    );
    return () => ctrl.abort();
  }, [phrase, language, attempt]);

  const summary = state.phase === 'found' ? state.summary : null;
  const primary = (label: string, onPress: () => void) => (
    <TouchableOpacity
      style={[styles.action, {backgroundColor: colors.primary}]}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          {state.phase === 'loading' && (
            <View style={styles.centred}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.status, {color: colors.textSecondary}]}>
                {t('chat.lookUpLoading')}
              </Text>
            </View>
          )}

          {state.phase === 'missing' && (
            <>
              <Text style={[styles.status, {color: colors.textSecondary}]}>
                {t('chat.lookUpNotFound', {name: phrase})}
              </Text>
              {primary(t('chat.lookUpSearch'), () =>
                onOpenUrl(wikipediaSearchUrl(phrase, language)),
              )}
            </>
          )}

          {state.phase === 'failed' && (
            <>
              <Text style={[styles.status, {color: colors.textSecondary}]}>
                {t('chat.lookUpFailed')}
              </Text>
              {primary(t('chat.lookUpRetry'), () => setAttempt(n => n + 1))}
            </>
          )}

          {summary && (
            <>
              <View style={styles.head}>
                {!summary.ambiguous && !!summary.image && !imageBroken && (
                  // The header is required here as well: the thumbnail is
                  // served by the same infrastructure, and <Image> brings its
                  // own HTTP stack. Hidden on failure rather than left as an
                  // empty square holding the title out of place.
                  <Image
                    source={{uri: summary.image, headers: {'User-Agent': WIKIPEDIA_USER_AGENT}}}
                    style={styles.thumb}
                    onError={() => setImageBroken(true)}
                  />
                )}
                <View style={styles.headText}>
                  <Text style={[styles.title, {color: colors.text}]} numberOfLines={2}>
                    {summary.title}
                  </Text>
                </View>
              </View>
              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                <Text style={[styles.extract, {color: colors.textSecondary}]}>
                  {summary.ambiguous ? t('chat.lookUpAmbiguous') : summary.extract}
                </Text>
              </ScrollView>
              <Text style={[styles.attribution, {color: colors.textSecondary}]}>
                {t('chat.lookUpAttribution')}
              </Text>
              {primary(t('chat.lookUpOpen'), () => onOpenUrl(summary.mobileUrl || summary.url))}
            </>
          )}

          <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button">
            <Text style={[styles.closeText, {color: colors.primary}]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,15,30,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {width: '100%', maxWidth: 400, borderRadius: 14, borderWidth: 1, padding: 20},
  centred: {alignItems: 'center', paddingVertical: 12, gap: 10},
  head: {flexDirection: 'row', gap: 14, alignItems: 'flex-start'},
  thumb: {width: 72, height: 72, borderRadius: 8},
  headText: {flex: 1},
  title: {fontSize: 18, fontFamily: bodyWeight('700'), lineHeight: 24},
  body: {maxHeight: 190, marginTop: 12},
  bodyContent: {paddingBottom: 2},
  extract: {fontSize: 14.5, lineHeight: 21, fontFamily: bodyWeight()},
  status: {fontSize: 15, lineHeight: 22, fontFamily: bodyWeight(), textAlign: 'center'},
  attribution: {fontSize: 11.5, marginTop: 14, opacity: 0.75, fontFamily: bodyWeight()},
  action: {marginTop: 14, paddingVertical: 13, borderRadius: 10, alignItems: 'center'},
  actionText: {color: '#fff', fontSize: 15, fontFamily: bodyWeight('600')},
  close: {marginTop: 10, paddingVertical: 10, alignItems: 'center'},
  closeText: {fontSize: 15, fontFamily: bodyWeight('600')},
});
