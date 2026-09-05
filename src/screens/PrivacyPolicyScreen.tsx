import React from 'react';
import {ScrollView, StyleSheet, Text, useColorScheme, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {getColors} from '../theme/colors';
import GlassScreen from '../components/GlassScreen';
import {bodyWeight, fonts, terminal} from '../theme/typography';

/**
 * The privacy policy, as a screen.
 *
 * Rewritten on 2026-09-05 because it had drifted badly from the app. It said
 * messages "are stored in Firebase Firestore and Firebase Storage" and never
 * once mentioned end-to-end encryption — the single claim the app is built on
 * — so it read as though everything sat in the clear on Google's servers. It
 * also promised two features with no interface (remote wipe, dead man's
 * switch), described account deletion as an email request when the app does it
 * itself, and listed profile fields that no longer exist.
 *
 * **Every sentence here is checked against the code, and must stay that way.**
 * This is the first document a privacy-conscious user opens, and a policy that
 * understates the app is as damaging as one that overstates it — both mean the
 * author did not know. The authority for what is and is not encrypted is the
 * caveat list at the top of services/e2ee.ts: when that list changes, this
 * changes. Never describe a capability that has no way to reach it.
 */
const LAST_UPDATED = '2026-09-05';
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

          <Section title="0. In short" colors={colors}>
            {`The text of your messages is encrypted on your device and can only be read by the people you send it to. We cannot read it, and neither can Google, whose servers we rent.\n\nWhat we can see is that a conversation happened: which accounts are in it, and when they were active. Removing that is harder than encrypting the contents, and we have not finished. This policy says exactly where the line currently is.`}
          </Section>

          <Section title="1. What is end-to-end encrypted" colors={colors}>
            {`Encrypted on your device, unreadable to us and to Google:\n\n• The text of your messages.\n• The contents of files, photos, audio and video you attach.\n• Shared lists, saved quotes and link previews.\n• Voice and video calls, which use WebRTC's mandatory DTLS-SRTP between the two devices.\n\nMost one-to-one and group messages additionally use a ratchet, meaning each message has its own key, so compromising your device does not expose earlier ones. Conversations where someone's client has not published the newer key material fall back to a single long-lived key, which does not have that property. The label under a message tells you which one it actually got.`}
          </Section>

          <Section title="2. What is not encrypted, and what we can see" colors={colors}>
            {`Encryption protects contents, not the fact of a conversation. These sit in the clear on our servers:\n\n• Who is in each conversation, and when it was created and last active.\n• The timestamp of every message, and how many you have not read.\n• An attachment's file name, type and size. The bytes are encrypted; the description of them is not, and the length of the ciphertext bounds the length of the original.\n• GIFs, which are public third-party content.\n• Your friends and friend requests.\n• Call signalling — that a call was placed, to whom, and when. Not its audio or video.\n\nTyping indicators and read receipts are off unless you turn them on, and while off nothing is written.\n\nWhat is no longer here: your email address and your name. Since September 2026 the account record holds only an account identifier. Your address stays in Firebase Authentication, where we use it to sign you in and where no other user can read it.\n\nSeparately: because the app runs on Google Firebase, Google can see the IP address and timing of every connection your device makes to it. That is a property of the hosting, not of the app, and we cannot encrypt it away.`}
          </Section>

          <Section title="3. How people find you" colors={colors}>
            {`They cannot search for you. There is no directory — no lookup by email, phone number or name — and the server refuses any query that tries.\n\nYou reach someone by sending them an invite link out of band, through whatever you already use. A link works once, expires after 24 hours, and can be withdrawn. Whatever you call someone is your own label for them, kept for you; if they introduced themselves, that name reached you encrypted.`}
          </Section>

          <Section title="4. What we collect" colors={colors}>
            {`• Account data: the email address you register with, held in Firebase Authentication.\n• Message and attachment ciphertext, plus the metadata in section 2.\n• Usage data: app interaction events via Firebase Analytics — screen views and feature usage, never message contents. Disabled in development builds.\n• Crash reports: anonymous crash and error data via Firebase Crashlytics.\n\nAnalytics and crash reporting cannot currently be switched off individually inside the app. Write to us if you want yours deleted.`}
          </Section>

          <Section title="5. Where it is stored" colors={colors}>
            {`On Google Firebase — Firestore, Storage and Authentication — under security rules that decide who may read and write each document.\n\nOn your device, cached messages, settings and your app-lock PIN are encrypted with a per-device key held in the platform keystore (iOS Keychain, Android Keystore) rather than in ordinary app storage.\n\nThe private key that decrypts your messages never leaves your device, except as the recovery phrase you choose to write down. We do not hold it and cannot recover it for you. Lose it, and the messages sent to that device cannot be read again — by anyone, including us.`}
          </Section>

          <Section title="6. Who else receives data" colors={colors}>
            {`We do not sell, trade or rent your personal information. Data reaches:\n\n• Google Firebase — our hosting provider, as described above.\n• GIPHY — only when you search for a GIF. Your search terms go to GIPHY's API; nothing else about you does.\n\nWe may disclose what we hold if the law requires it. What we hold is the list in section 2. We cannot produce message contents, because we cannot read them.`}
          </Section>

          <Section title="7. Push notifications" colors={colors}>
            {`Firebase Cloud Messaging delivers notifications. Your device token is stored in a private part of your account that only you can read.\n\nNotifications carry no message text. Your device decrypts the message locally and composes what you see; Google delivers the envelope, not the contents.`}
          </Section>

          <Section title="8. What you can do" colors={colors}>
            {`• Delete your account from the Profile screen. Content that is jointly part of a conversation — a shared list, a call record — stays with the other participant, because it is their record too.\n• Export your data from the Profile screen.\n• Set messages to expire per chat: 1 hour, 24 hours, 7 days or 30 days.\n• Turn typing indicators and read receipts on or off. Both are off by default.\n• Lock the app with a PIN or biometrics.\n• Withdraw an invite link you have handed out.\n\nIf you would rather we deleted something by hand, write to us.`}
          </Section>

          <Section title="9. Retention" colors={colors}>
            {`We keep your data while your account exists. Deleting the account deletes it, except for the jointly-held content noted above. Per-chat expiry removes messages on the schedule you set.`}
          </Section>

          <Section title="10. Limits you should know about" colors={colors}>
            {`We would rather tell you these than have you find them.\n\n• Keys are trusted the first time they are seen. If someone substituted a key before you ever exchanged a message, the conversation would be encrypted to the wrong person and would look entirely normal. The app warns you when a key changes afterwards, and shows a safety number you can compare out of band — but nothing forces you to compare it.\n• One device per account. Signing in on a new device replaces the key, and the previous device stops being able to read new messages.\n• Messages sent before encryption existed stay as they were. Nothing was converted retroactively.\n• This app has not been independently security-audited.`}
          </Section>

          <Section title="11. Children" colors={colors}>
            {`Chatterbox is not intended for children under 13, and we do not knowingly collect their information. If you believe a child has given us personal information, contact us and we will delete it.`}
          </Section>

          <Section title="12. Changes" colors={colors}>
            {`We may update this policy. Significant changes will be announced in the app, and the date at the top is when it last changed.`}
          </Section>

          <Section title="13. Contact" colors={colors}>
            {`Questions about this policy: ${CONTACT_EMAIL}`}
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
