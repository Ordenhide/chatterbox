import React from 'react';
import {ScrollView, StyleSheet, Text, useColorScheme, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {getColors} from '../theme/colors';
import {POLICY_LAST_UPDATED, policyFor} from '../i18n/privacyPolicy';
import GlassScreen from '../components/GlassScreen';
import {fonts, terminal} from '../theme/typography';

/**
 * The privacy policy, as a screen.
 *
 * The words live in i18n/privacyPolicy.ts — shared with the web client and
 * with the marketing site's page, which is generated from them. This file only
 * renders whichever language the user is reading the rest of the app in.
 */
export default function PrivacyPolicyScreen() {
  const colors = getColors(useColorScheme());
  const {t, i18n} = useTranslation();
  const sections = policyFor(i18n.language);

  return (
    <GlassScreen textureSeed="privacy-policy">
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, {color: colors.text}]}>{t('privacy.title')}</Text>
          <Text style={[styles.meta, {color: colors.textSecondary}]}>
            {t('privacy.lastUpdated', {date: POLICY_LAST_UPDATED})}
          </Text>

          {sections.map(section => (
            <Section key={section.title} title={section.title} colors={colors}>
              {section.body}
            </Section>
          ))}
        </ScrollView>
      </SafeAreaView>
    </GlassScreen>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, {color: colors.text}]}>{title}</Text>
      <Text style={[styles.body, {color: colors.textSecondary}]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  scroll: {flex: 1},
  content: {padding: 20, paddingBottom: 40},
  title: {fontSize: 18, fontFamily: fonts.display.bold, letterSpacing: 2.5, marginBottom: 4},
  meta: {fontSize: 13, marginBottom: 24},
  section: {marginBottom: 24},
  sectionTitle: {...terminal.label, marginBottom: 8},
  body: {fontSize: 14, lineHeight: 22},
});
