import React from 'react';
import {ScrollView, StyleSheet, Text, useColorScheme, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {getColors} from '../theme/colors';
import GlassScreen from '../components/GlassScreen';
import {bodyWeight, fonts, terminal} from '../theme/typography';

const LAST_UPDATED = '2026-04-30';
const CONTACT_EMAIL = 'privacy@chatterbox.app';

export default function PrivacyPolicyScreen() {
  const colors = getColors(useColorScheme());

  return (
    <GlassScreen textureSeed="privacy-policy">
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, {color: colors.text}]}>Privacy Policy</Text>
          <Text style={[styles.meta, {color: colors.textSecondary}]}>
            Last updated: {LAST_UPDATED}
          </Text>

          <Section title="1. Information We Collect" colors={colors}>
            {`We collect information you provide directly:\n\n• Account data: email address and display name when you register.\n• Messages and media: text, images, audio, video, and files you send through the app. These are stored in Firebase Firestore and Firebase Storage.\n• Profile data: optional profile photo and voice status.\n• Usage data: app interaction events collected via Firebase Analytics (e.g. screen views, feature usage). Analytics is disabled in development builds.\n• Crash reports: anonymous crash and error data via Firebase Crashlytics.`}
          </Section>

          <Section title="2. How We Use Your Information" colors={colors}>
            {`We use the information collected to:\n\n• Provide, operate, and maintain the Chatterbox service.\n• Deliver messages and notifications to you and your contacts.\n• Authenticate your identity and enforce single-device session security.\n• Improve app reliability and performance using aggregated analytics and crash data.\n• Respond to support requests.`}
          </Section>

          <Section title="3. Data Storage and Security" colors={colors}>
            {`Your data is stored on Google Firebase infrastructure (Firebase Firestore, Firebase Storage, Firebase Authentication). Access is controlled by Firestore and Storage security rules that prevent unauthorised reads or writes.\n\nLocal data (messages cached on your device, app settings, and app-lock PIN) is encrypted using a randomly generated per-device key stored in your device's local storage.`}
          </Section>

          <Section title="4. Data Sharing" colors={colors}>
            {`We do not sell, trade, or rent your personal information to third parties. We may share data with:\n\n• Google Firebase — as our backend infrastructure provider.\n• GIPHY — to provide GIF search. Search queries are sent to the GIPHY API.\n\nWe may disclose information if required by law or to protect the rights and safety of our users.`}
          </Section>

          <Section title="5. Push Notifications" colors={colors}>
            {`We use Firebase Cloud Messaging (FCM) to deliver push notifications. Your device token is stored in your user profile and used only to send you notifications for new messages and calls. You can disable notifications at any time in your device settings.`}
          </Section>

          <Section title="6. Your Rights and Choices" colors={colors}>
            {`You may:\n\n• Delete your account — contact us at ${CONTACT_EMAIL} to request deletion of your account and all associated data.\n• Export your data — use the Export feature in the Profile screen to download your chat history.\n• Disable analytics — crash reporting and analytics only run in production builds and cannot be individually toggled, but you can contact us to request deletion of your analytics data.\n• App Lock — enable a biometric or PIN lock in the Privacy & Security screen to protect your messages on-device.`}
          </Section>

          <Section title="7. Data Retention" colors={colors}>
            {`We retain your data for as long as your account is active. You can configure per-chat message expiry (1 hour to 30 days) in chat settings. The remote wipe and dead man's switch features allow you to delete all local data at any time.`}
          </Section>

          <Section title="8. Children's Privacy" colors={colors}>
            {`Chatterbox is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can delete it.`}
          </Section>

          <Section title="9. Changes to This Policy" colors={colors}>
            {`We may update this Privacy Policy from time to time. We will notify you of significant changes via an in-app notice. Continued use of the app after changes constitutes acceptance of the updated policy.`}
          </Section>

          <Section title="10. Contact Us" colors={colors}>
            {`If you have any questions or concerns about this Privacy Policy, please contact us at:\n\n${CONTACT_EMAIL}`}
          </Section>
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
