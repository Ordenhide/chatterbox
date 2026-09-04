/**
 * The Store — one global place to browse everything Chatterbox offers.
 *
 * Deliberately a single screen rather than a per-chat picker: a theme applied
 * here overwrites every conversation, so the app lands on one consistent look
 * instead of each chat drifting to its own.
 *
 * Unlike the web Store, this one does **not** sell. Apple and Google require
 * their own in-app purchase for digital goods sold inside an app, so mobile
 * reports Pro status and points to the web to subscribe. The Pro card here is
 * about the subscription (AI features, gated server-side) — themes
 * themselves are free for everyone and carry no lock of their own.
 *
 * Sections are laid out so adding a category later (sticker packs, chat
 * effects) means adding a section, not restructuring this file.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from 'react-i18next';
import {getColors} from '../theme/colors';
import GlassView from '../components/GlassView';
import {useAuth} from '../contexts/AuthContext';
import {isProActive, listenEntitlement, type Entitlement} from '../services/entitlement';
import {THEME_CATALOG, type StoreTheme} from '../services/themeCatalog';
import {applyStoreTheme, listenStoreTheme} from '../services/storeTheme';
import {bodyWeight, fonts} from '../theme/typography';

export default function StoreScreen() {
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const {user} = useAuth();

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [applied, setApplied] = useState<StoreTheme | undefined>(undefined);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenEntitlement(user.uid, setEntitlement);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return listenStoreTheme(user.uid, setApplied);
  }, [user]);

  const isPro = isProActive(entitlement);

  const proStatusText = (() => {
    if (!isPro) return `${t('pro.pitch')} ${t('pro.manageOnWeb')}`;
    if (entitlement?.status === 'past_due') return t('pro.pastDue');
    const date = entitlement ? new Date(entitlement.currentPeriodEnd).toLocaleDateString() : '';
    if (entitlement?.cancelAtPeriodEnd) return t('pro.endsOn', {date});
    return entitlement ? t('pro.renewsOn', {date}) : t('pro.active');
  })();

  const onApply = useCallback(
    async (theme: StoreTheme) => {
      if (!user) return;
      setApplyingId(theme.id);
      try {
        const count = await applyStoreTheme(user.uid, theme);
        // Separate keys rather than one "{{count}} chats" string: "1 chats"
        // reads as a bug, and a zero-chat account needs a different message
        // entirely — nothing changed yet, but new chats will use it.
        const key = count === 0 ? 'store.appliedNone' : count === 1 ? 'store.appliedOne' : 'store.applied';
        Alert.alert(t('store.title'), t(key, {name: theme.name, count}));
      } catch {
        Alert.alert(t('store.title'), t('common.error'));
      } finally {
        setApplyingId(null);
      }
    },
    [t, user],
  );

  return (
    <ScrollView style={{backgroundColor: colors.background}} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, {color: colors.text}]}>{t('store.title')}</Text>
      <Text style={[styles.pageDesc, {color: colors.textSecondary}]}>{t('store.subtitle')}</Text>

      <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.cardTitle, {color: colors.text}]}>
          {t('pro.title')}
          {isPro ? <Text style={{color: colors.primary}}>{`  ${t('pro.badge')}`}</Text> : null}
        </Text>
        <Text style={[styles.cardDesc, {color: colors.textSecondary}]}>{proStatusText}</Text>
      </GlassView>

      <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('store.themes')}</Text>
      <Text style={[styles.sectionDesc, {color: colors.textSecondary}]}>{t('store.themesDesc')}</Text>

      <View style={styles.grid}>
        {THEME_CATALOG.map(theme => {
          const selected = applied?.id === theme.id;
          const busy = applyingId === theme.id;
          return (
            <TouchableOpacity
              key={theme.id}
              accessibilityRole="button"
              accessibilityLabel={theme.name}
              accessibilityState={{selected, disabled: busy}}
              disabled={busy}
              onPress={() => onApply(theme)}
              style={[
                styles.themeCard,
                {borderColor: selected ? theme.accent : colors.glassBorder},
                selected && styles.themeCardSelected,
              ]}>
              <LinearGradient
                colors={theme.gradientStops}
                style={[styles.swatch, {borderColor: theme.accent}]}>
                {busy ? (
                  <ActivityIndicator color={theme.accent} />
                ) : (
                  <View style={[styles.dot, {backgroundColor: theme.accent}]} />
                )}
              </LinearGradient>
              <Text style={[styles.themeName, {color: colors.text}]}>{theme.name}</Text>
              {selected ? (
                <Text style={[styles.themeTag, {color: colors.primary}]}>{t('store.appliedTag')}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 20, paddingBottom: 48},
  pageTitle: {fontSize: 19, fontFamily: fonts.display.bold, letterSpacing: 2.5, marginBottom: 4},
  pageDesc: {fontSize: 14, marginBottom: 20},
  card: {borderRadius: 2, borderWidth: 1, padding: 18, marginBottom: 26},
  cardTitle: {fontSize: 16, fontFamily: bodyWeight('700'), marginBottom: 6},
  cardDesc: {fontSize: 13.5, lineHeight: 20},
  sectionTitle: {fontSize: 17, fontFamily: bodyWeight('800'), marginBottom: 4},
  sectionDesc: {fontSize: 13.5, marginBottom: 14},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  themeCard: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  themeCardSelected: {borderWidth: 2},
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dot: {width: 14, height: 14, borderRadius: 999},
  themeName: {fontSize: 13, fontFamily: bodyWeight('700')},
  themeTag: {fontSize: 10.5, fontFamily: bodyWeight('800'), letterSpacing: 0.4, marginTop: 2},
});
