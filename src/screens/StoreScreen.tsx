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
import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {getColors} from '../theme/colors';
import GlassView from '../components/GlassView';
import {useAuth} from '../contexts/AuthContext';
import {isProActive, listenEntitlement, type Entitlement} from '../services/entitlement';
import {bodyWeight, fonts} from '../theme/typography';

export default function StoreScreen() {
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const {user} = useAuth();

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenEntitlement(user.uid, setEntitlement);
  }, [user]);

  const isPro = isProActive(entitlement);

  const proStatusText = (() => {
    if (!isPro) return `${t('pro.pitch')} ${t('pro.manageOnWeb')}`;
    if (entitlement?.status === 'past_due') return t('pro.pastDue');
    const date = entitlement ? new Date(entitlement.currentPeriodEnd).toLocaleDateString() : '';
    if (entitlement?.cancelAtPeriodEnd) return t('pro.endsOn', {date});
    return entitlement ? t('pro.renewsOn', {date}) : t('pro.active');
  })();

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
});
