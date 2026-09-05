/**
 * The privacy policy text, per language.
 *
 * It lives here rather than inside the screen because three things need the
 * same words and must not be allowed to disagree: the mobile screen, the web
 * client, and the marketing site's privacy page (which is *generated* from
 * this file — see scripts/build-privacy-html.mjs). A policy that says one
 * thing in the app and another on the website is worse than either version
 * alone, because a reader who notices stops believing both.
 *
 * ## Translation is not decoration here
 *
 * This is the document that decides whether someone trusts the app, and the
 * app ships in English and Simplified Chinese. Leaving it English-only asked
 * every Chinese-speaking user to take the most important claims on faith in a
 * second language.
 *
 * The two versions must say the *same* thing. Not a looser summary in one and
 * the careful version in the other — a translation that softens "we have not
 * been audited" or drops the sentence about Google seeing every connection is
 * a different policy wearing the same title. A test checks the structure
 * (same sections, same numbering, same bullet counts); the wording is on
 * whoever edits it.
 *
 * ## What may go in
 *
 * Only things the code actually does. The authority for the encryption claims
 * is the caveat list at the top of services/e2ee.ts, which is maintained as an
 * honest list; when it changes, this changes. Never describe a capability with
 * no way to reach it — the previous policy promised remote wipe and a dead
 * man's switch, neither of which had an interface.
 */
import type {OfferedLanguage} from './languages';

export const POLICY_LAST_UPDATED = '2026-09-05';
export const POLICY_CONTACT_EMAIL = 'privacy@chatterbox.app';

export type PolicySection = {
  /** Rendered as the section heading, numbering included. */
  title: string;
  /** Paragraphs separated by a blank line; lines starting with • are a list. */
  body: string;
};

/**
 * Keyed by OfferedLanguage, so adding a language to the picker without writing
 * its policy is a type error rather than a silent fallback to English.
 */
export const PRIVACY_POLICY: Record<OfferedLanguage, PolicySection[]> = {
  en: [
    {
      title: '0. In short',
      body: `The text of your messages is encrypted on your device and can only be read by the people you send it to. We cannot read it, and neither can Google, whose servers we rent.

What we can see is that a conversation happened: which accounts are in it, and when they were active. Removing that is harder than encrypting the contents, and we have not finished. This policy says exactly where the line currently is.`,
    },
    {
      title: '1. What is end-to-end encrypted',
      body: `Encrypted on your device, unreadable to us and to Google:

• The text of your messages.
• The contents of files, photos, audio and video you attach.
• Shared lists, saved quotes and link previews.
• Voice and video calls, which use WebRTC's mandatory DTLS-SRTP between the two devices.

Most one-to-one and group messages additionally use a ratchet, meaning each message has its own key, so compromising your device does not expose earlier ones. Conversations where someone's client has not published the newer key material fall back to a single long-lived key, which does not have that property. The label under a message tells you which one it actually got.`,
    },
    {
      title: '2. What is not encrypted, and what we can see',
      body: `Encryption protects contents, not the fact of a conversation. These sit in the clear on our servers:

• Who is in each conversation, and when it was created and last active.
• The timestamp of every message, and how many you have not read.
• An attachment's file name, type and size. The bytes are encrypted; the description of them is not, and the length of the ciphertext bounds the length of the original.
• GIFs, which are public third-party content.
• Your friends and friend requests.
• Call signalling — that a call was placed, to whom, and when. Not its audio or video.

Typing indicators and read receipts are off unless you turn them on, and while off nothing is written.

What is no longer here: your email address and your name. Since September 2026 the account record holds only an account identifier. Your address stays in Firebase Authentication, where we use it to sign you in and where no other user can read it.

Separately: because the app runs on Google Firebase, Google can see the IP address and timing of every connection your device makes to it. That is a property of the hosting, not of the app, and we cannot encrypt it away.`,
    },
    {
      title: '3. How people find you',
      body: `They cannot search for you. There is no directory — no lookup by email, phone number or name — and the server refuses any query that tries.

You reach someone by sending them an invite link out of band, through whatever you already use. A link works once, expires after 24 hours, and can be withdrawn. Whatever you call someone is your own label for them, kept for you; if they introduced themselves, that name reached you encrypted.`,
    },
    {
      title: '4. What we collect',
      body: `• Account data: the email address you register with, held in Firebase Authentication.
• Message and attachment ciphertext, plus the metadata in section 2.
• Usage data: app interaction events via Firebase Analytics — screen views and feature usage, never message contents. Disabled in development builds.
• Crash reports: anonymous crash and error data via Firebase Crashlytics.

Analytics and crash reporting cannot currently be switched off individually inside the app. Write to us if you want yours deleted.`,
    },
    {
      title: '5. Where it is stored',
      body: `On Google Firebase — Firestore, Storage and Authentication — under security rules that decide who may read and write each document.

On your device, cached messages, settings and your app-lock PIN are encrypted with a per-device key held in the platform keystore (iOS Keychain, Android Keystore) rather than in ordinary app storage.

The private key that decrypts your messages never leaves your device, except as the recovery phrase you choose to write down. We do not hold it and cannot recover it for you. Lose it, and the messages sent to that device cannot be read again — by anyone, including us.`,
    },
    {
      title: '6. Who else receives data',
      body: `We do not sell, trade or rent your personal information. Data reaches:

• Google Firebase — our hosting provider, as described above.
• GIPHY — only when you search for a GIF. Your search terms go to GIPHY's API; nothing else about you does.

We may disclose what we hold if the law requires it. What we hold is the list in section 2. We cannot produce message contents, because we cannot read them.`,
    },
    {
      title: '7. Push notifications',
      body: `Firebase Cloud Messaging delivers notifications. Your device token is stored in a private part of your account that only you can read.

Notifications carry no message text. Your device decrypts the message locally and composes what you see; Google delivers the envelope, not the contents.`,
    },
    {
      title: '8. What you can do',
      body: `• Delete your account from the Profile screen. Content that is jointly part of a conversation — a shared list, a call record — stays with the other participant, because it is their record too.
• Export your data from the Profile screen.
• Set messages to expire per chat: 1 hour, 24 hours, 7 days or 30 days.
• Turn typing indicators and read receipts on or off. Both are off by default.
• Lock the app with a PIN or biometrics.
• Withdraw an invite link you have handed out.

If you would rather we deleted something by hand, write to us.`,
    },
    {
      title: '9. Retention',
      body: `We keep your data while your account exists. Deleting the account deletes it, except for the jointly-held content noted above. Per-chat expiry removes messages on the schedule you set.`,
    },
    {
      title: '10. Limits you should know about',
      body: `We would rather tell you these than have you find them.

• Keys are trusted the first time they are seen. If someone substituted a key before you ever exchanged a message, the conversation would be encrypted to the wrong person and would look entirely normal. The app warns you when a key changes afterwards, and shows a safety number you can compare out of band — but nothing forces you to compare it.
• One device per account. Signing in on a new device replaces the key, and the previous device stops being able to read new messages.
• Messages sent before encryption existed stay as they were. Nothing was converted retroactively.
• This app has not been independently security-audited.`,
    },
    {
      title: '11. Children',
      body: `Chatterbox is not intended for children under 13, and we do not knowingly collect their information. If you believe a child has given us personal information, contact us and we will delete it.`,
    },
    {
      title: '12. Changes',
      body: `We may update this policy. Significant changes will be announced in the app, and the date at the top is when it last changed.`,
    },
    {
      title: '13. Contact',
      body: `Questions about this policy: ${POLICY_CONTACT_EMAIL}`,
    },
  ],

  'zh-Hans': [
    {
      title: '0. 一句话',
      body: `你发出的消息正文在你的设备上被加密，只有收信人能读。我们读不了，租给我们服务器的 Google 也读不了。

我们能看到的是：一场对话发生过——里面有哪些账号，什么时候活跃。把这部分也去掉比加密内容难得多，我们还没做完。这份政策会说清楚，界线目前划在哪里。`,
    },
    {
      title: '1. 哪些内容是端到端加密的',
      body: `在你的设备上加密，我们和 Google 都读不了：

• 你的消息正文。
• 你发送的文件、照片、音频、视频的内容。
• 共享清单、收藏的引用、链接预览。
• 语音和视频通话，两台设备之间使用 WebRTC 强制的 DTLS-SRTP。

大多数一对一和群聊消息还额外使用了棘轮（ratchet）：每条消息有自己的密钥，所以即使你的设备被攻破，也读不出更早的消息。如果对方的客户端还没有发布较新的密钥材料，这个会话会回落到一把长期密钥，那种情况下没有上面这个性质。消息下方的标记会告诉你这一条实际走的是哪一种。`,
    },
    {
      title: '2. 哪些没有加密，以及我们能看到什么',
      body: `加密保护的是内容，不是「有过一场对话」这件事本身。下面这些在我们的服务器上是明文：

• 每场对话里有谁，以及它何时创建、何时最后活跃。
• 每条消息的时间戳，以及你有多少条没读。
• 附件的文件名、类型和大小。字节是加密的，对它的描述不是；密文的长度也框定了原文的长度。
• GIF，它本身就是公开的第三方内容。
• 你的好友和好友请求。
• 通话信令——有过一次通话、打给谁、什么时候。不包括音频和视频内容。

「正在输入」和已读回执默认关闭，除非你自己打开；关闭期间不会写入任何东西。

已经不在这里的：你的邮箱地址和你的名字。自 2026 年 9 月起，账号记录里只剩一个账号标识符。你的邮箱留在 Firebase Authentication 里，我们用它给你登录，其他用户读不到。

另外要单独说一句：因为这个应用跑在 Google Firebase 上，Google 能看到你的设备每一次连接的 IP 地址和时间。这是托管方式带来的，不是应用本身的问题，我们没法用加密把它消掉。`,
    },
    {
      title: '3. 别人怎么找到你',
      body: `他们搜不到你。这里没有目录——不能按邮箱、手机号或名字查找——服务器会拒绝任何这样的查询。

你要联系一个人，是通过其他渠道把一条邀请链接发给他，用你本来就在用的任何方式都行。一条链接只能用一次，24 小时后过期，你随时可以撤销。你怎么称呼一个人，是你自己给他的标签，只留给你；如果对方做过自我介绍，那个名字是加密送到你这里的。`,
    },
    {
      title: '4. 我们收集什么',
      body: `• 账号数据：你注册用的邮箱地址，保存在 Firebase Authentication 里。
• 消息和附件的密文，以及第 2 节列出的元数据。
• 使用数据：通过 Firebase Analytics 收集的应用交互事件——页面浏览和功能使用，绝不包括消息内容。开发版本中已禁用。
• 崩溃报告：通过 Firebase Crashlytics 收集的匿名崩溃和错误数据。

目前应用内还不能单独关闭分析和崩溃上报。如果你想删除自己的这部分数据，写信给我们。`,
    },
    {
      title: '5. 数据存在哪里',
      body: `存在 Google Firebase 上——Firestore、Storage 和 Authentication——由安全规则决定谁可以读写每一份文档。

在你的设备上，缓存的消息、设置和应用锁 PIN 用一把「每台设备一把」的密钥加密，这把密钥保存在系统密钥库里（iOS 的 Keychain、Android 的 Keystore），不是放在普通的应用存储里。

解密你消息的私钥永远不会离开你的设备，除非以助记词的形式、由你自己选择抄下来。我们不持有它，也无法替你恢复。一旦丢失，发给那台设备的消息就再也读不出来了——任何人都读不出来，包括我们。`,
    },
    {
      title: '6. 还有谁会拿到数据',
      body: `我们不出售、不交易、不出租你的个人信息。数据会到达：

• Google Firebase——我们的托管服务商，如上所述。
• GIPHY——只在你搜索 GIF 的时候。你的搜索词会发给 GIPHY 的接口；关于你的其他信息不会。

如果法律要求，我们可能披露我们持有的内容。我们持有的就是第 2 节那份清单。我们拿不出消息内容，因为我们读不了。`,
    },
    {
      title: '7. 推送通知',
      body: `通知由 Firebase Cloud Messaging 送达。你的设备令牌存放在账号中一块只有你能读的私有区域里。

通知里不带消息正文。是你的设备在本地解密消息、组装出你看到的那句话；Google 送的是信封，不是里面的内容。`,
    },
    {
      title: '8. 你可以做什么',
      body: `• 在「我的」页面删除账号。属于一场对话共同部分的内容——一份共享清单、一条通话记录——会留给另一位参与者，因为那也是他的记录。
• 在「我的」页面导出你的数据。
• 按会话设置消息过期：1 小时、24 小时、7 天或 30 天。
• 打开或关闭「正在输入」和已读回执。两者默认都是关闭的。
• 用 PIN 或生物识别锁定应用。
• 撤销一条你已经发出去的邀请链接。

如果你希望我们手动删除某些东西，写信给我们。`,
    },
    {
      title: '9. 保留期限',
      body: `你的账号存在期间，我们保留你的数据。删除账号就会删除这些数据，上面提到的共同持有的内容除外。按会话设置的过期时间会按你定的节奏删除消息。`,
    },
    {
      title: '10. 你应该知道的局限',
      body: `这些我们宁可主动告诉你，也不愿你自己发现。

• 公钥在第一次见到时就被信任。如果有人在你们交换第一条消息之前就替换了公钥，这场对话会被加密给错误的人，而且看起来完全正常。之后公钥再变化时应用会警告你，也会显示一个可以线下核对的安全码——但没有任何机制强制你去核对。
• 一个账号只能用一台设备。在新设备上登录会替换掉密钥，原来那台设备就读不到新消息了。
• 加密功能出现之前发的消息保持原样，没有做过追溯转换。
• 这个应用没有经过独立的第三方安全审计。`,
    },
    {
      title: '11. 儿童',
      body: `Chatterbox 不面向 13 岁以下儿童，我们也不会在知情的情况下收集他们的信息。如果你认为有儿童向我们提供了个人信息，请联系我们，我们会删除。`,
    },
    {
      title: '12. 变更',
      body: `我们可能会更新这份政策。重大变更会在应用内公告，顶部的日期就是它最后一次修改的时间。`,
    },
    {
      title: '13. 联系我们',
      body: `关于这份政策的问题，请联系：${POLICY_CONTACT_EMAIL}`,
    },
  ],
};

/**
 * The policy for a language tag, falling back to English.
 *
 * i18next hands back tags like `zh-Hans-CN`, and a fallback that quietly
 * returned English for one of those would be the worst outcome here — a
 * Chinese reader shown an English legal document with no indication why.
 */
export function policyFor(language: string | undefined): PolicySection[] {
  if (!language) return PRIVACY_POLICY.en;
  const exact = PRIVACY_POLICY[language as OfferedLanguage];
  if (exact) return exact;
  const base = Object.keys(PRIVACY_POLICY).find(code => language.startsWith(code));
  return base ? PRIVACY_POLICY[base as OfferedLanguage] : PRIVACY_POLICY.en;
}
