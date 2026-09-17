/**
 * The landing page, in English. Every other file in this directory is the same
 * shape in another language, and build-site-html.mjs turns each into a page.
 *
 * `{policy}` in any string becomes a link to that language's privacy policy,
 * with `links.policy` as its text. It is the only markup allowed here —
 * everything else is escaped, so a stray `<` in a translation cannot break a
 * page.
 */
export default {
  meta: {
    title: 'Chatterbox — A messenger with nothing to look you up in',
    description:
      'End-to-end encrypted messaging with no user directory, no email address at all, and a privacy policy that says what it cannot do. Web and Android.',
  },

  links: {policy: 'privacy policy', policyShort: 'Read it'},

  nav: {
    different: "What's different",
    features: 'Features',
    limits: 'Limits',
    get: 'Get it',
    language: 'Language',
  },

  hero: {
    eyebrow: 'Web & Android · iOS in progress',
    title: 'Nothing to look you up in.',
    lead: `Chatterbox is an end-to-end encrypted messenger with no user directory. Nobody can search for you, because there is no index to search — the only way into a conversation is a link you hand someone yourself.`,
    primary: 'Get Chatterbox',
    secondary: 'Read the privacy policy',
    badges: ['No user directory', 'Invite-only', '23 languages', 'Free'],
  },

  different: {
    eyebrow: "What's different",
    title: "Seven things most messengers don't do",
    intro: `Each of these is a decision with a mechanism behind it, not a setting you have to find. Where something is a trade-off, it says so.`,
    reasons: [
      {
        title: 'There is no user directory',
        body: [
          `No username search, no phone-number matching, no “people you may know”. The only route into a conversation is an invite link you send someone out of band. Each link works once and expires after 24 hours, and a scheduled job deletes the expired ones rather than leaving a permanent record of who invited whom.`,
        ],
        note: `This is not a privacy setting. There is no directory to opt out of.`,
      },
      {
        title: 'There is no email address to keep',
        body: [
          `Signing up asks for nothing about you. Your account is a 24-word recovery phrase generated on your device, and the credential the server checks is derived from those words — what it stores is a random label under a domain that cannot receive mail. Your profile document holds no email address, no display name and no photo URL, so there is no profile for anyone else to read either.`,
        ],
      },
      {
        title: 'More than the messages is sealed',
        body: [
          `Message text is the easy part. Link previews and live location are encrypted to the conversation the same way — a location share is a stream of coordinates, and it is sealed to the other device's key like everything else. Attachments are encrypted before they are uploaded, so what the server holds is bytes it cannot open.`,
        ],
      },
      {
        title: 'Each message has its own key',
        body: [
          `Most one-to-one and group conversations use a ratchet, so compromising a device does not expose the messages that came before. Conversations where someone's client has not published the newer key material fall back to a single long-lived key, which does not have that property.`,
        ],
        note: `The label under a message tells you which one it actually got. It is not a claim about the app; it is a claim about that message.`,
      },
      {
        title: `No AI reads your conversations`,
        body: [
          `There is no summariser, no translation, no transcription. Nothing in this app decrypts a conversation and sends it to a third party to be processed, because no feature here does that. The reply suggestions are computed on your device from the last few messages, and go nowhere.`,
        ],
        note: `Those features are in the code and switched off for this release; they are meant to come back. Section 6 of the privacy policy still names the three services they would reach and says that nothing reaches them today. When they return, they return with that disclosure and a prompt before the first use.`,
      },
      {
        title: "Looking something up doesn't happen behind your back",
        body: [
          `Tap a name in a message and Chatterbox shows you its Wikipedia article. That request happens on the tap and not otherwise, and nothing about it is written into the conversation.`,
        ],
        note: `An earlier version scanned the last fifteen messages of every thread you opened and queried Wikipedia up to thirty times per open — while displaying nothing, because the cards were behind a flag that was never on. It was removed rather than fixed.`,
      },
      {
        title: 'The privacy policy says what it cannot do',
        body: [
          `It states that the encryption has never been independently audited, that Google can see the metadata of every connection because we rent their servers, and that a key substituted before your first message would look entirely normal. It is the same text in the app and on this site, in 23 languages — not an English original with a softer translation.`,
        ],
        note: `{policyShort} before you decide to trust any of the above.`,
      },
    ],
  },

  features: {
    eyebrow: 'Features',
    title: 'What it actually does',
    intro: `Everything listed here has an interface you can reach. Nothing on this page describes a capability that exists only in the code.`,
    cards: [
      {
        title: 'Messaging',
        body: `Text, photos, video, files and voice notes. Replies, forwarding, reactions, read receipts, pinned messages, bookmarks and scheduled messages.`,
      },
      {
        title: 'Voice & video calls',
        body: `Peer-to-peer calling over WebRTC, which encrypts the media between the two devices by default rather than as an option.`,
      },
      {
        title: `Reply suggestions`,
        body: `A few suggested replies drawn from the last messages in the conversation. They are matched on your device against a phrase list in your language — nothing is sent anywhere to produce them.`,
      },
      {
        title: 'Wikipedia lookup',
        body: `Long-press a message, pick a name in it, and read the article without leaving the chat. One request, on your tap, in your own language.`,
      },
      {
        title: 'Your key, your recovery phrase',
        body: `The private key that decrypts your messages never leaves your device. You can write it down as a recovery phrase; we do not hold it and cannot recover it for you.`,
      },
      {
        title: '23 languages',
        body: `English, both Chinese scripts, Japanese, Korean, Spanish, French, German, Italian, Portuguese, Russian, Turkish, Vietnamese, Arabic, Hindi, Persian, Hebrew, Urdu, Polish, Ukrainian, Indonesian, Bengali and Thai — right-to-left included.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Privacy controls',
    title: 'What you can lock down',
    items: [
      {title: 'App lock', body: `Biometric or PIN, with an auto-lock delay you choose.`},
      {title: 'View once', body: `Photos and videos that close for good after they are opened.`},
      {
        title: 'Disappearing messages',
        body: `Set a conversation to clear itself, from an hour up to thirty days.`,
      },
      {
        title: 'Burn after reading',
        body: `A message that destroys itself once the other person has read it.`,
      },
      {
        title: 'Blocking',
        body: `Block anyone. With no directory, they cannot find their way back.`,
      },
      {
        title: 'Export & delete',
        body: `Take your data out, or delete the account and everything under it.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Limits',
    title: 'What is not protected',
    intro: `A page that only lists strengths is a page you cannot use to make a decision. This is the short version; the {policy} is the long one.`,
    sealed: {
      title: 'Sealed on your device',
      items: [
        'The text of your messages',
        'Photos, video, audio and files you attach',
        'Link previews and live location',
        'Voice transcripts, once they come back to you',
        'Call audio and video, between the two devices',
      ],
    },
    visible: {
      title: 'Visible to us and to Google',
      items: [
        'That a conversation exists, and which accounts are in it',
        'When each account was last active',
        'The metadata of every connection, including your IP address',
        'That a call was placed, to whom and when — not its audio or video',
        'The file name, type and size of every attachment you send',
      ],
    },
    note: `The encryption has never been independently audited. Removing that metadata is harder than encrypting the contents, and that work is not finished.`,
  },

  download: {
    title: 'Get Chatterbox',
    intro: `The web app runs in a browser with nothing to install. On Android, Google Play keeps it updated; the APK on this site is the same build for anyone who would rather not use the store.`,
    introWebOnly: `The web app runs in a browser with nothing to install, on a phone as well as a desktop. The Android build is on its way to Google Play.`,
    web: 'Open the web app',
    play: 'Get it on Google Play',
    playPending: 'Coming to Google Play',
    apk: 'Download the APK',
    playNote: `Google Play is the recommended route on Android: it updates the app in the background and verifies the signature on every install.`,
    androidPendingNote: `Neither Android route is live yet: the Play listing is not published, and there is no download on this site. The web app is the way in until one of them is.`,
    playPendingNote: `The Play listing is not live yet. Until it is, the APK is the Android route — Android will ask you to allow installs from this source the first time, and it does not update itself.`,
    apkNote: `The APK is signed with the same key as the Play build, so it installs over it and keeps your data. It does not update itself.`,
    iosNote: `iOS is not released yet.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. A personal project, honestly described.',
    privacy: 'Privacy Policy',
  },
};
