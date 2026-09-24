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

export const POLICY_LAST_UPDATED = '2026-09-07';
export const POLICY_CONTACT_EMAIL = 'privacy@chatterbox.fans';

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
• Link previews.
• Voice and video calls, which use WebRTC's mandatory DTLS-SRTP between the two devices.

Most one-to-one and group messages additionally use a ratchet, meaning each message has its own key, so compromising your device does not expose earlier ones. Conversations where someone's client has not published the newer key material fall back to a single long-lived key, which does not have that property. The label under a message tells you which one it actually got.

One thing crosses this line, and only when you ask it to: looking a name up on Wikipedia sends that one name, not the message it came from. Section 6 says who receives it, and the lookup runs on the tap and not otherwise, so there is nothing standing to turn off. Summarising, translating and transcribing would cross it too — they are switched off in this release, with no control anywhere in the app that turns them on.`,
    },
    {
      title: '2. What is not encrypted, and what we can see',
      body: `Encryption protects contents, not the fact of a conversation. These sit in the clear on our servers:

• Who is in each conversation, and when it was created and last active.
• The timestamp of every message, and how many you have not read.
• An attachment's file name, type and size. The bytes are encrypted; the description of them is not, and the length of the ciphertext bounds the length of the original.
• Your friends and friend requests.
• Call signalling — that a call was placed, to whom, and when. Not its audio or video.

Typing indicators and read receipts are off unless you turn them on, and while off nothing is written.

What is no longer here: your email address and your name. Since September 2026 the account record holds only an account identifier — and since then there has been no address to hold anywhere. Signing up asks nothing about you: your account is a 24-word recovery phrase, and the credential Firebase Authentication checks is derived from it. What it stores is a random label under a domain that cannot receive mail.

Separately: because the app runs on Google Firebase, Google can see the IP address and timing of every connection your device makes to it. That is a property of the hosting, not of the app, and we cannot encrypt it away.`,
    },
    {
      title: '3. How people find you',
      body: `They cannot search for you. There is no directory — no lookup by email, phone number or name — and the server refuses any query that tries.

You reach someone by sending them an invite link out of band, through whatever you already use. A link works once, expires after 24 hours, and can be withdrawn. Whatever you call someone is your own label for them, kept for you; if they introduced themselves, that name reached you encrypted.`,
    },
    {
      title: '4. What we collect',
      body: `• Account data: an account identifier, and a credential derived from your recovery phrase, held in Firebase Authentication. No email address, no phone number, no name — sign-up asks for none of them.
• Message and attachment ciphertext, plus the metadata in section 2.

That is the whole list. There is no analytics and no crash reporting. The app used to send screen views to Firebase Analytics and crash reports to Firebase Crashlytics, both carrying your account identifier, so neither was anonymous; both are gone, along with the libraries that sent them. Errors are printed on a developer's own machine during development and go nowhere else.`,
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
• Cloudflare Realtime — the audio and video of a call, when your device and the other person's cannot reach each other directly.
• The Wikimedia Foundation — one name, when you tap it to look it up on Wikipedia.
• Google Cloud Speech-to-Text — the audio of one voice message, when you ask for a transcript.
• Google Cloud Translation — the text of one message, when you ask for a translation.
• Cloudflare Workers AI — up to the last 50 messages of one conversation, when you ask for a summary or ask a question about it.

The last three are switched off in this release. There is no control anywhere in the app that turns transcription, translation or summaries on, so nothing reaches those three services. They are listed rather than deleted because the code is still here and the features are meant to return — and when they do, they return with this disclosure and with a prompt before the first use. What would be sent then is sent to produce your result, not to train anything; neither a transcript nor a translation is stored on our servers.

The Wikipedia lookup has no switch because there is nothing standing to switch off: it runs on the tap and not otherwise. Wikipedia receives that one name and your IP address, the same as if you had typed it into their search box — no account, no message, no conversation. What comes back is shown and not saved, and nothing about it is written to the conversation.

Cloudflare Realtime has no switch either. Most calls do not need it: two devices that can reach each other directly — most calls on the same network — connect without it, and nothing is relayed. When they cannot, commonly because the two of you are on different mobile networks, the already-encrypted call is relayed rather than left unable to connect. What Cloudflare sees is both IP addresses, the call's timing, and roughly how much data moved; the audio and video stay under the same DTLS-SRTP encryption described in section 2, so relaying does not decrypt them.

We may disclose what we hold if the law requires it. What we hold is the list in section 2. We cannot produce message contents, because we cannot read them.`,
    },
    {
      title: '7. Push notifications',
      body: `Firebase Cloud Messaging delivers notifications. Your device token is stored in a private part of your account that only you can read.

Notifications carry no message text. Your device decrypts the message locally and composes what you see; Google delivers the envelope, not the contents.`,
    },
    {
      title: '8. What you can do',
      body: `• Delete your account from the Profile screen. Content that is jointly part of a conversation — a call record, for instance — stays with the other participant, because it is their record too.
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
• One device at a time. Your recovery phrase restores the key that opens your history, so signing in on a new device does not lose what you already received. Forward-secret conversations use a second key that never leaves the device that created it: whichever device signed in last is the one they reach, and anything sealed to the other one in the meantime cannot be moved across.
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
    {
      title: '14. Checking for a newer app version',
      body: `Google Play is not the way this app reaches your Android phone. It is downloaded from chatterbox.fans instead, and a store that isn't in the loop cannot check for updates on your behalf — so this app can, if you ask it to.

Tapping "Check now" sends one request to chatterbox.fans asking which version is current. That request carries your IP address and nothing else — no account, no device identifier, no message. What comes back is a version number, compared on your phone against the version you're running; nothing is downloaded automatically, and nothing about the check is written to the conversation.

This has no switch because there is nothing standing to switch off: it runs on the tap and not otherwise.

If you install the update, it replaces the app in place using the same signing key, the same way an update from Google Play would.`,
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
• 链接预览。
• 语音和视频通话，两台设备之间使用 WebRTC 强制的 DTLS-SRTP。

大多数一对一和群聊消息还额外使用了棘轮（ratchet）：每条消息有自己的密钥，所以即使你的设备被攻破，也读不出更早的消息。如果对方的客户端还没有发布较新的密钥材料，这个会话会回落到一把长期密钥，那种情况下没有上面这个性质。消息下方的标记会告诉你这一条实际走的是哪一种。

只有一件事会越过这条线，而且只在你主动要求时：在维基百科查一个名字，发出去的是那一个名字，而不是它所在的消息。发给谁写在第 6 节；查询只在你点的那一下发生，除此之外不发生，所以没有什么需要关掉。摘要、翻译和转写同样会越过这条线——它们在本次发行中是关闭的，应用里没有任何开关可以打开它们。`,
    },
    {
      title: '2. 哪些没有加密，以及我们能看到什么',
      body: `加密保护的是内容，不是「有过一场对话」这件事本身。下面这些在我们的服务器上是明文：

• 每场对话里有谁，以及它何时创建、何时最后活跃。
• 每条消息的时间戳，以及你有多少条没读。
• 附件的文件名、类型和大小。字节是加密的，对它的描述不是；密文的长度也框定了原文的长度。
• 你的好友和好友请求。
• 通话信令——有过一次通话、打给谁、什么时候。不包括音频和视频内容。

「正在输入」和已读回执默认关闭，除非你自己打开；关闭期间不会写入任何东西。

已经不在这里的：你的邮箱地址和你的名字。自 2026 年 9 月起，账号记录里只剩一个账号标识符——而且从那时起，任何地方都不再有邮箱可留。注册不会问你任何关于你的事：你的账号就是 24 个助记词，Firebase Authentication 校验的凭证由它推导而来；它保存的只是一个随机标签，域名根本收不到邮件。

另外要单独说一句：因为这个应用跑在 Google Firebase 上，Google 能看到你的设备每一次连接的 IP 地址和时间。这是托管方式带来的，不是应用本身的问题，我们没法用加密把它消掉。`,
    },
    {
      title: '3. 别人怎么找到你',
      body: `他们搜不到你。这里没有目录——不能按邮箱、手机号或名字查找——服务器会拒绝任何这样的查询。

你要联系一个人，是通过其他渠道把一条邀请链接发给他，用你本来就在用的任何方式都行。一条链接只能用一次，24 小时后过期，你随时可以撤销。你怎么称呼一个人，是你自己给他的标签，只留给你；如果对方做过自我介绍，那个名字是加密送到你这里的。`,
    },
    {
      title: '4. 我们收集什么',
      body: `• 账号数据：一个账号标识符，以及从你的助记词推导出的凭证，保存在 Firebase Authentication 里。没有邮箱地址，没有电话号码，没有名字——注册时一样都不问。
• 消息和附件的密文，以及第 2 节里的元数据。

这就是全部。没有分析统计，也没有崩溃上报。这个应用过去会把屏幕浏览发给 Firebase Analytics、把崩溃报告发给 Firebase Crashlytics，两者都带着你的账号标识，所以都不是匿名的；现在它们都被删掉了，连同发送它们的那两个库。错误只在开发阶段打印在开发者自己的机器上，不去任何别的地方。`,
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
• Cloudflare Realtime——当你的设备和对方的设备无法直接互联时，用于中继通话的音视频。
• 维基媒体基金会——当你点击某个名字去维基百科查它时，那一个名字。
• Google Cloud Speech-to-Text——当你请求转写时，一条语音消息的音频。
• Google Cloud Translation——当你请求翻译时，一条消息的文字。
• Cloudflare Workers AI——当你请求摘要或就一段对话提问时，该对话最近至多 50 条消息。

后三者在本次发行中是关闭的。应用里没有任何开关可以打开转写、翻译或摘要，所以没有任何内容会到达这三个服务。之所以列出而不是删掉，是因为代码还在、这些功能还打算回来——它们回来的时候，会连同这段披露和首次使用前的询问一起回来。到那时发出去的东西，是为了产出你要的结果，不用于训练任何模型；转写和翻译都不会保存在我们的服务器上。

维基百科查询没有开关，因为没有什么常驻的东西可关：它只在你点的那一下运行，此外不运行。维基百科收到的是那一个名字和你的 IP 地址，跟你自己在它的搜索框里输入一样——没有账号，没有消息，没有对话。返回的内容只是显示出来，不保存，也不会写进对话里。

Cloudflare Realtime 同样没有开关。大多数通话不需要它：两台能够直接互联的设备——同一网络下的大多数通话——不经过它就能连上，不会被中继。当无法直连时——常见于双方处于不同的移动网络——已经加密的通话会被中继，而不是直接连不上。Cloudflare 能看到的是双方的 IP 地址、通话的时间，以及大致的数据量；音视频内容仍然受第2节所述的同一套 DTLS-SRTP 加密保护，中继并不会解密它们。

如果法律要求，我们可能披露我们持有的内容。我们持有的就是第 2 节那份清单。我们拿不出消息内容，因为我们读不了。`,
    },
    {
      title: '7. 推送通知',
      body: `通知由 Firebase Cloud Messaging 送达。你的设备令牌存放在账号中一块只有你能读的私有区域里。

通知里不带消息正文。是你的设备在本地解密消息、组装出你看到的那句话；Google 送的是信封，不是里面的内容。`,
    },
    {
      title: '8. 你可以做什么',
      body: `• 在「我的」页面删除账号。属于一场对话共同部分的内容——比如一条通话记录——会留给另一位参与者，因为那也是他的记录。
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
• 同一时间只能用一台设备。你的助记词能恢复打开历史消息的密钥，所以在新设备上登录不会丢掉你已经收到的内容。但前向保密的会话用的是第二把密钥，它从不离开生成它的那台设备：最后登录的那台才是这类消息送达的地方，期间封给另一台的内容无法搬过来。
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
    {
      title: '14. 检查新版本',
      body: `Google Play 并不是这个应用到达你安卓手机的途径,它是从 chatterbox.fans 下载的——而一个不在循环里的应用商店没法替你检查更新,所以这个应用可以自己检查,只要你让它这么做。

点击"立即检查"会向 chatterbox.fans 发送一次请求,询问当前的版本号。这次请求只携带你的 IP 地址,没有别的——没有账号、没有设备标识符、没有消息内容。返回的是一个版本号,在你的手机上与当前运行的版本比对;不会自动下载任何东西,这次检查也不会写入到对话记录里。

这个功能没有开关,因为没有什么可以关闭的:它只在你点击时运行,除此之外不会运行。

如果你安装了更新,它会用同一个签名密钥原地替换应用,和 Google Play 推送更新的方式一样。`,
    },
  ],
  'de': [
    {
      title: '0. Kurz gesagt',
      body: `Der Text deiner Nachrichten wird auf deinem Gerät verschlüsselt und kann nur von den Menschen gelesen werden, denen du ihn schickst. Wir können ihn nicht lesen, und Google, dessen Server wir mieten, auch nicht.

Was wir sehen können, ist, dass ein Gespräch stattgefunden hat: welche Konten daran beteiligt sind und wann sie aktiv waren. Das zu entfernen ist schwerer, als die Inhalte zu verschlüsseln, und wir sind damit nicht fertig. Diese Richtlinie sagt genau, wo die Grenze derzeit verläuft.`,
    },
    {
      title: '1. Was Ende-zu-Ende-verschlüsselt ist',
      body: `Auf deinem Gerät verschlüsselt, für uns und für Google unlesbar:

• Der Text deiner Nachrichten.
• Die Inhalte von Dateien, Fotos, Audio und Video, die du anhängst.
• Linkvorschauen.
• Sprach- und Videoanrufe, die zwischen den beiden Geräten das verpflichtende DTLS-SRTP von WebRTC nutzen.

Die meisten Einzel- und Gruppennachrichten nutzen zusätzlich eine Ratsche: Jede Nachricht hat ihren eigenen Schlüssel, sodass ein kompromittiertes Gerät frühere Nachrichten nicht preisgibt. Gespräche, in denen jemandes Client das neuere Schlüsselmaterial nicht veröffentlicht hat, fallen auf einen einzelnen langlebigen Schlüssel zurück, der diese Eigenschaft nicht hat. Die Kennzeichnung unter einer Nachricht sagt dir, welchen Weg sie tatsächlich genommen hat.

Nur eines überschreitet diese Linie, und nur, wenn du darum bittest: einen Namen auf Wikipedia nachzuschlagen sendet diesen einen Namen, nicht die Nachricht, aus der er stammt. Abschnitt 6 sagt, wer ihn erhält, und die Abfrage geschieht beim Tippen und sonst nicht, es gibt also nichts abzuschalten. Zusammenfassen, Übersetzen und Transkribieren würden sie ebenfalls überschreiten — sie sind in dieser Version abgeschaltet, und es gibt in der App keine Einstellung, die sie einschaltet.`,
    },
    {
      title: '2. Was nicht verschlüsselt ist, und was wir sehen können',
      body: `Verschlüsselung schützt Inhalte, nicht die Tatsache eines Gesprächs. Folgendes liegt im Klartext auf unseren Servern:

• Wer an welchem Gespräch beteiligt ist und wann es erstellt wurde und zuletzt aktiv war.
• Der Zeitstempel jeder Nachricht und wie viele du nicht gelesen hast.
• Dateiname, Typ und Größe eines Anhangs. Die Bytes sind verschlüsselt, ihre Beschreibung nicht, und die Länge des Chiffrats begrenzt die Länge des Originals.
• Deine Freunde und Freundschaftsanfragen.
• Anrufsignalisierung — dass ein Anruf geführt wurde, mit wem und wann. Nicht dessen Ton oder Bild.

Schreibanzeige und Lesebestätigungen sind aus, solange du sie nicht einschaltest, und während sie aus sind, wird nichts geschrieben.

Was hier nicht mehr steht: deine E-Mail-Adresse und dein Name. Seit September 2026 enthält der Kontodatensatz nur noch eine Kontokennung — und seitdem gibt es nirgends mehr eine Adresse, die dort stehen könnte. Die Registrierung fragt nichts über dich: dein Konto ist eine 24-Wort-Wiederherstellungsphrase, und die Anmeldedaten, die Firebase Authentication prüft, werden daraus abgeleitet. Gespeichert wird dort eine zufällige Kennung unter einer Domain, die keine Post empfangen kann.

Und getrennt davon: Weil die App auf Google Firebase läuft, kann Google die IP-Adresse und den Zeitpunkt jeder Verbindung sehen, die dein Gerät dorthin aufbaut. Das ist eine Eigenschaft des Hostings, nicht der App, und wir können es nicht wegverschlüsseln.`,
    },
    {
      title: '3. Wie andere dich finden',
      body: `Sie können nicht nach dir suchen. Es gibt kein Verzeichnis — keine Suche nach E-Mail, Telefonnummer oder Name — und der Server weist jede Abfrage ab, die es versucht.

Du erreichst jemanden, indem du ihm außerhalb der App einen Einladungslink schickst, über was auch immer du ohnehin nutzt. Ein Link funktioniert einmal, läuft nach 24 Stunden ab und kann zurückgezogen werden. Wie du jemanden nennst, ist deine eigene Bezeichnung für ihn, die dir gehört; hat er sich vorgestellt, ist dieser Name verschlüsselt bei dir angekommen.`,
    },
    {
      title: '4. Was wir erheben',
      body: `• Kontodaten: eine Kontokennung und ein aus deiner Wiederherstellungsphrase abgeleitetes Anmeldegeheimnis, gehalten in Firebase Authentication. Keine E-Mail-Adresse, keine Telefonnummer, kein Name — die Registrierung fragt nach keinem davon.
• Der Chiffretext von Nachrichten und Anhängen, dazu die Metadaten aus Abschnitt 2.

Das ist die ganze Liste. Es gibt keine Analyse und keine Absturzberichte. Die App schickte früher Bildschirmaufrufe an Firebase Analytics und Abstürze an Firebase Crashlytics, beides mit deiner Kontokennung, also war keines davon anonym; beides ist weg, samt der Bibliotheken, die es gesendet haben. Fehler werden während der Entwicklung auf dem Rechner der entwickelnden Person ausgegeben und gehen nirgendwo sonst hin.`,
    },
    {
      title: '5. Wo es gespeichert wird',
      body: `Auf Google Firebase — Firestore, Storage und Authentication — unter Sicherheitsregeln, die festlegen, wer welches Dokument lesen und schreiben darf.

Auf deinem Gerät werden zwischengespeicherte Nachrichten, Einstellungen und deine App-Sperr-PIN mit einem gerätespezifischen Schlüssel verschlüsselt, der im Schlüsselspeicher der Plattform liegt (iOS Keychain, Android Keystore) und nicht im gewöhnlichen App-Speicher.

Der private Schlüssel, der deine Nachrichten entschlüsselt, verlässt dein Gerät nie — außer als die Wiederherstellungsphrase, die du dir selbst notierst. Wir haben ihn nicht und können ihn nicht für dich wiederherstellen. Geht er verloren, sind die an dieses Gerät gesendeten Nachrichten nie wieder lesbar — von niemandem, uns eingeschlossen.`,
    },
    {
      title: '6. Wer sonst Daten erhält',
      body: `Wir verkaufen, tauschen oder vermieten deine personenbezogenen Daten nicht. Daten erreichen:

• Google Firebase — unseren Hosting-Anbieter, wie oben beschrieben.
• Cloudflare Realtime — Audio und Video eines Anrufs, wenn dein Gerät und das der anderen Person sich nicht direkt erreichen können.
• Die Wikimedia Foundation — ein einzelner Name, wenn du ihn antippst, um ihn auf Wikipedia nachzuschlagen.
• Google Cloud Speech-to-Text — die Audioaufnahme einer Sprachnachricht, wenn du ein Transkript anforderst.
• Google Cloud Translation — den Text einer Nachricht, wenn du eine Übersetzung anforderst.
• Cloudflare Workers AI — bis zu die letzten 50 Nachrichten eines Gesprächs, wenn du eine Zusammenfassung anforderst oder eine Frage dazu stellst.

Die letzten drei sind in dieser Version abgeschaltet. Es gibt in der App keine Einstellung, die Transkription, Übersetzung oder Zusammenfassungen einschaltet, also erreicht diese drei Dienste nichts. Sie stehen hier, statt gelöscht zu sein, weil der Code noch da ist und die Funktionen zurückkommen sollen — und wenn sie das tun, kommen sie mit dieser Offenlegung und mit einer Nachfrage vor dem ersten Mal zurück. Was dann gesendet würde, wird gesendet, um dein Ergebnis zu erzeugen, nicht um etwas zu trainieren; weder ein Transkript noch eine Übersetzung wird auf unseren Servern gespeichert.

Das Nachschlagen hat keinen Schalter, weil es nichts Dauerhaftes abzuschalten gibt: Es läuft beim Antippen und sonst nicht. Wikipedia erhält diesen Namen und deine IP-Adresse, genau wie wenn du ihn selbst in das Suchfeld getippt hättest — kein Konto, keine Nachricht, kein Gespräch. Was zurückkommt, wird angezeigt und nicht gespeichert, und nichts davon wird in das Gespräch geschrieben.

Cloudflare Realtime hat ebenfalls keinen Schalter. Die meisten Anrufe brauchen es nicht: Zwei Geräte, die sich direkt erreichen können — die meisten Anrufe im selben Netzwerk —, verbinden sich ohne es, und nichts wird weitergeleitet. Wenn das nicht möglich ist, häufig weil ihr in unterschiedlichen Mobilfunknetzen seid, wird der bereits verschlüsselte Anruf weitergeleitet, statt gar keine Verbindung zuzulassen. Was Cloudflare sieht, sind beide IP-Adressen, der Zeitpunkt des Anrufs und ungefähr, wie viele Daten übertragen wurden; Audio und Video bleiben unter derselben in Abschnitt 2 beschriebenen DTLS-SRTP-Verschlüsselung, sodass die Weiterleitung sie nicht entschlüsselt.

Wir können offenlegen, was wir haben, wenn das Gesetz es verlangt. Was wir haben, ist die Liste aus Abschnitt 2. Nachrichteninhalte können wir nicht herausgeben, weil wir sie nicht lesen können.`,
    },
    {
      title: '7. Push-Benachrichtigungen',
      body: `Firebase Cloud Messaging stellt Benachrichtigungen zu. Dein Gerätetoken liegt in einem privaten Teil deines Kontos, den nur du lesen kannst.

Benachrichtigungen enthalten keinen Nachrichtentext. Dein Gerät entschlüsselt die Nachricht lokal und setzt zusammen, was du siehst; Google liefert den Umschlag, nicht den Inhalt.`,
    },
    {
      title: '8. Was du tun kannst',
      body: `• Lösche dein Konto im Profil. Inhalte, die gemeinsamer Teil eines Gesprächs sind — ein Anrufeintrag etwa — bleiben beim anderen Teilnehmer, denn es ist auch dessen Aufzeichnung.
• Exportiere deine Daten im Profil.
• Lass Nachrichten pro Chat ablaufen: 1 Stunde, 24 Stunden, 7 Tage oder 30 Tage.
• Schalte Schreibanzeige und Lesebestätigungen ein oder aus. Beide sind standardmäßig aus.
• Sperre die App mit PIN oder Biometrie.
• Zieh einen Einladungslink zurück, den du weitergegeben hast.

Wenn dir lieber ist, dass wir etwas von Hand löschen, schreib uns.`,
    },
    {
      title: '9. Aufbewahrung',
      body: `Wir bewahren deine Daten auf, solange dein Konto besteht. Das Löschen des Kontos löscht sie, bis auf die oben genannten gemeinsam gehaltenen Inhalte. Der Ablauf pro Chat entfernt Nachrichten nach dem Zeitplan, den du festlegst.`,
    },
    {
      title: '10. Grenzen, die du kennen solltest',
      body: `Wir sagen dir das lieber, als dass du es selbst herausfindest.

• Schlüsseln wird beim ersten Sehen vertraut. Hätte jemand einen Schlüssel ausgetauscht, bevor ihr je eine Nachricht gewechselt habt, wäre das Gespräch an die falsche Person verschlüsselt und sähe völlig normal aus. Die App warnt dich, wenn sich ein Schlüssel danach ändert, und zeigt eine Sicherheitsnummer, die ihr außerhalb der App vergleichen könnt — nichts zwingt dich jedoch dazu.
• Ein Gerät zur Zeit. Deine Wiederherstellungsphrase stellt den Schlüssel wieder her, der deinen Verlauf öffnet, also geht beim Anmelden auf einem neuen Gerät nichts von dem verloren, was du bereits empfangen hast. Vorwärtsgeheime Gespräche nutzen einen zweiten Schlüssel, der das Gerät, das ihn erzeugt hat, nie verlässt: erreicht wird immer das zuletzt angemeldete Gerät, und was in der Zwischenzeit an das andere versiegelt wurde, lässt sich nicht hinübertragen.
• Nachrichten, die vor Einführung der Verschlüsselung gesendet wurden, bleiben, wie sie waren. Nichts wurde nachträglich umgewandelt.
• Diese App wurde nie unabhängig sicherheitsgeprüft.`,
    },
    {
      title: '11. Kinder',
      body: `Chatterbox ist nicht für Kinder unter 13 Jahren gedacht, und wir erheben wissentlich keine Daten von ihnen. Wenn du glaubst, dass ein Kind uns personenbezogene Daten gegeben hat, wende dich an uns, und wir löschen sie.`,
    },
    {
      title: '12. Änderungen',
      body: `Wir können diese Richtlinie aktualisieren. Wesentliche Änderungen kündigen wir in der App an, und das Datum oben ist der Zeitpunkt der letzten Änderung.`,
    },
    {
      title: '13. Kontakt',
      body: `Fragen zu dieser Richtlinie: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Nach einer neueren App-Version suchen',
      body: `Google Play ist nicht der Weg, wie diese App auf dein Android-Handy gelangt. Sie wird stattdessen von chatterbox.fans heruntergeladen, und ein Store, der nicht eingebunden ist, kann nicht in deinem Namen nach Updates suchen — also kann die App das selbst, wenn du sie darum bittest.

Ein Tippen auf „Jetzt prüfen" sendet eine einzige Anfrage an chatterbox.fans, welche Version aktuell ist. Diese Anfrage enthält deine IP-Adresse und sonst nichts — kein Konto, keine Gerätekennung, keine Nachricht. Zurück kommt eine Versionsnummer, die auf deinem Handy mit der laufenden Version verglichen wird; nichts wird automatisch heruntergeladen, und nichts von der Prüfung wird in die Unterhaltung geschrieben.

Dafür gibt es keinen Schalter, weil es nichts abzuschalten gibt: Es läuft nur beim Antippen und sonst nicht.

Installierst du das Update, ersetzt es die App an Ort und Stelle mit demselben Signaturschlüssel — genauso, wie es ein Update von Google Play tun würde.`,
    },
  ],
  'es': [
    {
      title: '0. En resumen',
      body: `El texto de tus mensajes se cifra en tu dispositivo y solo pueden leerlo las personas a quienes se lo envías. Nosotros no podemos leerlo, y Google, cuyos servidores alquilamos, tampoco.

Lo que sí podemos ver es que hubo una conversación: qué cuentas participan y cuándo estuvieron activas. Quitar eso es más difícil que cifrar el contenido, y no hemos terminado. Esta política dice exactamente dónde está la línea ahora mismo.`,
    },
    {
      title: '1. Qué está cifrado de extremo a extremo',
      body: `Cifrado en tu dispositivo, ilegible para nosotros y para Google:

• El texto de tus mensajes.
• El contenido de los archivos, fotos, audios y vídeos que adjuntas.
• Las vistas previas de enlaces.
• Las llamadas de voz y vídeo, que usan el DTLS-SRTP obligatorio de WebRTC entre los dos dispositivos.

La mayoría de los mensajes individuales y de grupo usan además un trinquete: cada mensaje tiene su propia clave, así que comprometer tu dispositivo no expone los anteriores. Las conversaciones en las que el cliente de alguien no ha publicado el material de clave más reciente recurren a una única clave de larga duración, que no tiene esa propiedad. La etiqueta bajo un mensaje te dice cuál le tocó realmente.

Una sola cosa cruza esta línea, y solo cuando tú lo pides: buscar un nombre en Wikipedia envía ese nombre, no el mensaje del que salió. La sección 6 dice quién lo recibe, y la consulta ocurre con el toque y no en otro momento, así que no hay nada que apagar. Resumir, traducir y transcribir también la cruzarían: están apagados en esta versión, y no hay ningún control en la aplicación que los encienda.`,
    },
    {
      title: '2. Qué no está cifrado, y qué podemos ver',
      body: `El cifrado protege el contenido, no el hecho de que exista una conversación. Esto está en claro en nuestros servidores:

• Quién participa en cada conversación, y cuándo se creó y estuvo activa por última vez.
• La marca de tiempo de cada mensaje y cuántos no has leído.
• El nombre, el tipo y el tamaño de un archivo adjunto. Los bytes están cifrados; su descripción no, y la longitud del texto cifrado acota la del original.
• Tus amistades y solicitudes de amistad.
• La señalización de llamadas: que se hizo una llamada, a quién y cuándo. No su audio ni su vídeo.

El indicador de escritura y las confirmaciones de lectura están desactivados salvo que los actives, y mientras están desactivados no se escribe nada.

Lo que ya no está aquí: tu dirección de correo y tu nombre. Desde septiembre de 2026, el registro de la cuenta solo contiene un identificador de cuenta, y desde entonces no hay dirección alguna en ninguna parte. Registrarse no pregunta nada sobre ti: tu cuenta es una frase de recuperación de 24 palabras, y la credencial que comprueba Firebase Authentication se deriva de ella. Lo que allí se guarda es una etiqueta aleatoria bajo un dominio que no puede recibir correo.

Aparte: como la app funciona sobre Google Firebase, Google puede ver la dirección IP y el momento de cada conexión que tu dispositivo hace hacia allí. Eso es una propiedad del alojamiento, no de la app, y no podemos cifrarlo para que desaparezca.`,
    },
    {
      title: '3. Cómo te encuentran',
      body: `No pueden buscarte. No hay directorio —ni búsqueda por correo, teléfono o nombre— y el servidor rechaza cualquier consulta que lo intente.

Llegas a alguien enviándole un enlace de invitación por fuera de la app, a través de lo que ya uses. Un enlace funciona una vez, caduca a las 24 horas y puedes retirarlo. Como llames a alguien es tu propia etiqueta para esa persona, y es tuya; si se presentó, ese nombre te llegó cifrado.`,
    },
    {
      title: '4. Qué recopilamos',
      body: `• Datos de la cuenta: un identificador de cuenta y una credencial derivada de tu frase de recuperación, guardada en Firebase Authentication. Sin dirección de correo, sin número de teléfono y sin nombre: el registro no pide ninguno.
• El texto cifrado de los mensajes y los adjuntos, más los metadatos de la sección 2.

Esa es la lista completa. No hay analítica ni informes de fallos. La aplicación enviaba vistas de pantalla a Firebase Analytics e informes de fallos a Firebase Crashlytics, ambos con tu identificador de cuenta, así que ninguno era anónimo; los dos han desaparecido, junto con las bibliotecas que los enviaban. Los errores se imprimen en la máquina de quien desarrolla, durante el desarrollo, y no van a ninguna otra parte.`,
    },
    {
      title: '5. Dónde se guarda',
      body: `En Google Firebase —Firestore, Storage y Authentication— bajo reglas de seguridad que deciden quién puede leer y escribir cada documento.

En tu dispositivo, los mensajes en caché, los ajustes y tu PIN de bloqueo se cifran con una clave propia del dispositivo guardada en el almacén de claves del sistema (Keychain en iOS, Keystore en Android), no en el almacenamiento normal de la app.

La clave privada que descifra tus mensajes nunca sale de tu dispositivo, salvo como la frase de recuperación que decidas anotar. No la tenemos y no podemos recuperarla por ti. Si la pierdes, los mensajes enviados a ese dispositivo no se podrán volver a leer, por nadie, nosotros incluidos.`,
    },
    {
      title: '6. Quién más recibe datos',
      body: `No vendemos, intercambiamos ni alquilamos tu información personal. Los datos llegan a:

• Google Firebase, nuestro proveedor de alojamiento, como se describe arriba.
• Cloudflare Realtime — el audio y el vídeo de una llamada, cuando tu dispositivo y el de la otra persona no pueden conectarse directamente.
• La Fundación Wikimedia: un solo nombre, cuando lo tocas para buscarlo en Wikipedia.
• Google Cloud Speech-to-Text: el audio de un mensaje de voz, cuando pides una transcripción.
• Google Cloud Translation: el texto de un mensaje, cuando pides una traducción.
• Cloudflare Workers AI: hasta los últimos 50 mensajes de una conversación, cuando pides un resumen o haces una pregunta sobre ella.

Los tres últimos están apagados en esta versión. No hay ningún control en la aplicación que encienda la transcripción, la traducción o los resúmenes, así que nada llega a esos tres servicios. Están en la lista en vez de borrados porque el código sigue aquí y las funciones han de volver: cuando vuelvan, volverán con esta declaración y con una pregunta antes del primer uso. Lo que se enviaría entonces se envía para producir tu resultado, no para entrenar nada; ni una transcripción ni una traducción se guardan en nuestros servidores.

La búsqueda en Wikipedia no tiene interruptor porque no hay nada permanente que apagar: se ejecuta con el toque y no de otro modo. Wikipedia recibe ese nombre y tu dirección IP, igual que si lo hubieras escrito en su buscador; ninguna cuenta, ningún mensaje, ninguna conversación. Lo que vuelve se muestra y no se guarda, y nada de ello se escribe en la conversación.

Cloudflare Realtime tampoco tiene interruptor. La mayoría de las llamadas no lo necesitan: dos dispositivos que pueden conectarse directamente —la mayoría de las llamadas en la misma red— se conectan sin él, y nada se retransmite. Cuando no pueden, normalmente porque estáis en redes móviles distintas, la llamada ya cifrada se retransmite en lugar de quedar sin poder conectar. Lo que ve Cloudflare son ambas direcciones IP, el momento de la llamada y aproximadamente cuántos datos se movieron; el audio y el vídeo permanecen bajo el mismo cifrado DTLS-SRTP descrito en la sección 2, así que la retransmisión no los descifra.

Podemos revelar lo que tenemos si la ley lo exige. Lo que tenemos es la lista de la sección 2. No podemos entregar el contenido de los mensajes, porque no podemos leerlo.`,
    },
    {
      title: '7. Notificaciones push',
      body: `Firebase Cloud Messaging entrega las notificaciones. El token de tu dispositivo se guarda en una parte privada de tu cuenta que solo tú puedes leer.

Las notificaciones no llevan el texto del mensaje. Tu dispositivo lo descifra localmente y compone lo que ves; Google entrega el sobre, no el contenido.`,
    },
    {
      title: '8. Qué puedes hacer',
      body: `• Eliminar tu cuenta desde la pantalla de Perfil. El contenido que forma parte conjunta de una conversación —un registro de llamada, por ejemplo— permanece con la otra persona, porque también es su registro.
• Exportar tus datos desde la pantalla de Perfil.
• Hacer que los mensajes caduquen por chat: 1 hora, 24 horas, 7 días o 30 días.
• Activar o desactivar el indicador de escritura y las confirmaciones de lectura. Ambos vienen desactivados.
• Bloquear la app con un PIN o con biometría.
• Retirar un enlace de invitación que ya hayas repartido.

Si prefieres que borremos algo a mano, escríbenos.`,
    },
    {
      title: '9. Conservación',
      body: `Conservamos tus datos mientras exista tu cuenta. Eliminarla los borra, salvo el contenido compartido indicado arriba. La caducidad por chat elimina los mensajes según el plazo que fijes.`,
    },
    {
      title: '10. Límites que deberías conocer',
      body: `Preferimos contártelos a que los descubras tú.

• Las claves se confían la primera vez que se ven. Si alguien sustituyó una clave antes de que llegarais a intercambiar un mensaje, la conversación estaría cifrada hacia la persona equivocada y parecería totalmente normal. La app te avisa cuando una clave cambia después, y muestra un número de seguridad que podéis comparar por otro canal, pero nada te obliga a compararlo.
• Un dispositivo a la vez. Tu frase de recuperación restaura la clave que abre tu historial, así que iniciar sesión en un dispositivo nuevo no pierde lo que ya recibiste. Las conversaciones con secreto hacia adelante usan una segunda clave que nunca sale del dispositivo que la creó: llegan al que inició sesión más recientemente, y lo que se selló para el otro mientras tanto no se puede trasladar.
• Los mensajes enviados antes de que existiera el cifrado siguen tal cual. No se convirtió nada de forma retroactiva.
• Esta app nunca ha pasado una auditoría de seguridad independiente.`,
    },
    {
      title: '11. Menores',
      body: `Chatterbox no está pensada para menores de 13 años, y no recopilamos conscientemente su información. Si crees que un menor nos ha facilitado datos personales, ponte en contacto con nosotros y los eliminaremos.`,
    },
    {
      title: '12. Cambios',
      body: `Podemos actualizar esta política. Los cambios importantes se anunciarán en la app, y la fecha de arriba es la de la última modificación.`,
    },
    {
      title: '13. Contacto',
      body: `Dudas sobre esta política: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Buscar una versión más reciente de la app',
      body: `Google Play no es la forma en que esta app llega a tu teléfono Android. Se descarga desde chatterbox.fans, y una tienda que no está en el bucle no puede buscar actualizaciones en tu nombre — así que esta app puede hacerlo, si se lo pides.

Tocar "Buscar ahora" envía una única solicitud a chatterbox.fans preguntando cuál es la versión actual. Esa solicitud lleva tu dirección IP y nada más — sin cuenta, sin identificador de dispositivo, sin mensaje. Lo que vuelve es un número de versión, comparado en tu teléfono con la versión que tienes instalada; no se descarga nada automáticamente, y nada de la comprobación se escribe en la conversación.

Esto no tiene interruptor porque no hay nada que apagar: se ejecuta al tocar y no de otra forma.

Si instalas la actualización, reemplaza la app en el mismo lugar usando la misma clave de firma, igual que lo haría una actualización de Google Play.`,
    },
  ],
  'fr': [
    {
      title: '0. En bref',
      body: `Le texte de vos messages est chiffré sur votre appareil et ne peut être lu que par les personnes à qui vous l'envoyez. Nous ne pouvons pas le lire, et Google, dont nous louons les serveurs, non plus.

Ce que nous pouvons voir, c'est qu'une conversation a eu lieu : quels comptes y participent, et quand ils ont été actifs. Supprimer cela est plus difficile que chiffrer les contenus, et nous n'avons pas terminé. Cette politique dit exactement où passe la limite aujourd'hui.`,
    },
    {
      title: '1. Ce qui est chiffré de bout en bout',
      body: `Chiffré sur votre appareil, illisible pour nous comme pour Google :

• Le texte de vos messages.
• Le contenu des fichiers, photos, audios et vidéos que vous joignez.
• Les aperçus de liens.
• Les appels audio et vidéo, qui utilisent le DTLS-SRTP obligatoire de WebRTC entre les deux appareils.

La plupart des messages individuels et de groupe utilisent en plus un cliquet : chaque message a sa propre clé, si bien qu'un appareil compromis n'expose pas les messages précédents. Les conversations où le client de quelqu'un n'a pas publié le matériel de clé plus récent retombent sur une seule clé de longue durée, qui n'a pas cette propriété. La mention sous un message vous dit lequel il a réellement emprunté.

Une seule chose franchit cette ligne, et uniquement lorsque vous le demandez : chercher un nom sur Wikipédia envoie ce nom, pas le message dont il vient. La section 6 dit qui le reçoit, et la requête a lieu au moment où vous touchez et pas autrement, il n’y a donc rien à désactiver. Résumer, traduire et transcrire la franchiraient aussi : ces fonctions sont désactivées dans cette version, et aucune commande de l’application ne les active.`,
    },
    {
      title: '2. Ce qui n\'est pas chiffré, et ce que nous voyons',
      body: `Le chiffrement protège les contenus, pas le fait qu'une conversation existe. Ceci figure en clair sur nos serveurs :

• Qui participe à chaque conversation, quand elle a été créée et quand elle a été active pour la dernière fois.
• L'horodatage de chaque message et le nombre de messages non lus.
• Le nom, le type et la taille d'une pièce jointe. Les octets sont chiffrés ; leur description ne l'est pas, et la longueur du chiffré borne celle de l'original.
• Vos amis et vos demandes d'ami.
• La signalisation des appels — qu'un appel a eu lieu, avec qui et quand. Ni son audio ni sa vidéo.

Les indicateurs de saisie et les accusés de lecture sont désactivés tant que vous ne les activez pas, et tant qu'ils le sont, rien n'est écrit.

Ce qui n’y est plus : votre adresse e-mail et votre nom. Depuis septembre 2026, la fiche de compte ne contient qu’un identifiant de compte — et depuis, il n’y a plus d’adresse nulle part. L’inscription ne demande rien sur vous : votre compte est une phrase de récupération de 24 mots, et l’identifiant que vérifie Firebase Authentication en est dérivé. Ce qui y est conservé est une étiquette aléatoire sous un domaine incapable de recevoir du courrier.

Par ailleurs : comme l'application tourne sur Google Firebase, Google peut voir l'adresse IP et l'heure de chaque connexion que votre appareil y établit. C'est une propriété de l'hébergement, pas de l'application, et nous ne pouvons pas la faire disparaître par du chiffrement.`,
    },
    {
      title: '3. Comment on vous trouve',
      body: `On ne peut pas vous rechercher. Il n'existe pas d'annuaire — pas de recherche par e-mail, téléphone ou nom — et le serveur refuse toute requête qui essaie.

Vous joignez quelqu'un en lui envoyant un lien d'invitation en dehors de l'application, par le moyen que vous utilisez déjà. Un lien fonctionne une fois, expire au bout de 24 heures et peut être retiré. Le nom que vous donnez à quelqu'un est votre propre étiquette, conservée pour vous ; s'il s'est présenté, ce nom vous est parvenu chiffré.`,
    },
    {
      title: '4. Ce que nous collectons',
      body: `• Données de compte : un identifiant de compte et un secret dérivé de votre phrase de récupération, conservés dans Firebase Authentication. Pas d’adresse e-mail, pas de numéro de téléphone, pas de nom — l’inscription n’en demande aucun.
• Le chiffré des messages et des pièces jointes, plus les métadonnées de la section 2.

C’est toute la liste. Il n’y a ni analytique ni rapports de plantage. L’application envoyait les vues d’écran à Firebase Analytics et les plantages à Firebase Crashlytics, les deux portant votre identifiant de compte, donc aucun n’était anonyme ; les deux ont disparu, avec les bibliothèques qui les envoyaient. Les erreurs s’affichent sur la machine du développeur pendant le développement et ne vont nulle part ailleurs.`,
    },
    {
      title: '5. Où c\'est stocké',
      body: `Sur Google Firebase — Firestore, Storage et Authentication — sous des règles de sécurité qui décident qui peut lire et écrire chaque document.

Sur votre appareil, les messages en cache, les réglages et votre code de verrouillage sont chiffrés avec une clé propre à l'appareil, conservée dans le trousseau de la plateforme (Keychain sur iOS, Keystore sur Android) plutôt que dans le stockage ordinaire de l'application.

La clé privée qui déchiffre vos messages ne quitte jamais votre appareil, sauf sous la forme de la phrase de récupération que vous choisissez de noter. Nous ne la détenons pas et ne pouvons pas la récupérer pour vous. Si vous la perdez, les messages envoyés à cet appareil ne seront plus jamais lisibles — par personne, nous compris.`,
    },
    {
      title: '6. Qui d\'autre reçoit des données',
      body: `Nous ne vendons, n'échangeons ni ne louons vos informations personnelles. Des données parviennent à :

• Google Firebase — notre hébergeur, comme décrit ci-dessus.
• Cloudflare Realtime — l'audio et la vidéo d'un appel, lorsque votre appareil et celui de l'autre personne ne peuvent pas se joindre directement.
• La Fondation Wikimedia — un seul nom, lorsque vous le touchez pour le chercher sur Wikipédia.
• Google Cloud Speech-to-Text — l’audio d’un message vocal, lorsque vous demandez une transcription.
• Google Cloud Translation — le texte d’un message, lorsque vous demandez une traduction.
• Cloudflare Workers AI — jusqu’aux 50 derniers messages d’une conversation, lorsque vous demandez un résumé ou posez une question à son sujet.

Les trois derniers sont désactivés dans cette version. Aucune commande de l’application n’active la transcription, la traduction ou les résumés, donc rien ne parvient à ces trois services. Ils sont listés plutôt que supprimés parce que le code est toujours là et que ces fonctions sont censées revenir — et quand elles reviendront, elles reviendront avec cette déclaration et avec une demande avant la première utilisation. Ce qui serait alors envoyé l’est pour produire votre résultat, pas pour entraîner quoi que ce soit ; ni une transcription ni une traduction ne sont conservées sur nos serveurs.

Cette recherche n’a pas d’interrupteur, parce qu’il n’y a rien de permanent à éteindre : elle s’exécute au moment du geste et pas autrement. Wikipédia reçoit ce nom et votre adresse IP, exactement comme si vous l’aviez tapé dans sa barre de recherche — aucun compte, aucun message, aucune conversation. Ce qui revient est affiché et non conservé, et rien n’en est écrit dans la conversation.

Cloudflare Realtime n'a pas d'interrupteur non plus. La plupart des appels n'en ont pas besoin : deux appareils qui peuvent se joindre directement — la plupart des appels sur le même réseau — se connectent sans lui, et rien n'est relayé. Lorsque ce n'est pas possible, souvent parce que vous êtes sur des réseaux mobiles différents, l'appel déjà chiffré est relayé plutôt que de rester sans connexion. Ce que Cloudflare voit, ce sont les deux adresses IP, l'heure de l'appel et approximativement la quantité de données échangées ; l'audio et la vidéo restent sous le même chiffrement DTLS-SRTP décrit à la section 2, donc le relais ne les déchiffre pas.

Nous pouvons divulguer ce que nous détenons si la loi l'exige. Ce que nous détenons, c'est la liste de la section 2. Nous ne pouvons pas produire le contenu des messages, puisque nous ne pouvons pas le lire.`,
    },
    {
      title: '7. Notifications push',
      body: `Firebase Cloud Messaging délivre les notifications. Le jeton de votre appareil est stocké dans une partie privée de votre compte, que vous seul pouvez lire.

Les notifications ne contiennent aucun texte de message. Votre appareil déchiffre le message localement et compose ce que vous voyez ; Google livre l'enveloppe, pas le contenu.`,
    },
    {
      title: '8. Ce que vous pouvez faire',
      body: `• Supprimer votre compte depuis l'écran Profil. Le contenu qui appartient conjointement à une conversation — un enregistrement d'appel, par exemple — reste chez l'autre participant, car c'est aussi son historique.
• Exporter vos données depuis l'écran Profil.
• Faire expirer les messages par conversation : 1 heure, 24 heures, 7 jours ou 30 jours.
• Activer ou désactiver les indicateurs de saisie et les accusés de lecture. Les deux sont désactivés par défaut.
• Verrouiller l'application par code ou biométrie.
• Retirer un lien d'invitation que vous avez distribué.

Si vous préférez que nous supprimions quelque chose à la main, écrivez-nous.`,
    },
    {
      title: '9. Conservation',
      body: `Nous conservons vos données tant que votre compte existe. Le supprimer les supprime, à l'exception du contenu détenu conjointement mentionné plus haut. L'expiration par conversation supprime les messages selon le délai que vous fixez.`,
    },
    {
      title: '10. Limites à connaître',
      body: `Nous préférons vous les dire plutôt que vous les laisser découvrir.

• Les clés sont approuvées à la première rencontre. Si quelqu'un avait substitué une clé avant que vous n'échangiez le moindre message, la conversation serait chiffrée vers la mauvaise personne et paraîtrait tout à fait normale. L'application vous prévient lorsqu'une clé change ensuite, et affiche un numéro de sécurité que vous pouvez comparer hors ligne — mais rien ne vous oblige à le comparer.
• Un appareil à la fois. Votre phrase de récupération restaure la clé qui ouvre votre historique : se connecter sur un nouvel appareil ne perd donc rien de ce que vous avez déjà reçu. Les conversations à confidentialité persistante utilisent une seconde clé qui ne quitte jamais l'appareil qui l'a créée : c'est le dernier appareil connecté qu'elles atteignent, et ce qui a été scellé pour l'autre entre-temps ne peut pas être transféré.
• Les messages envoyés avant l'existence du chiffrement restent tels quels. Rien n'a été converti rétroactivement.
• Cette application n'a jamais fait l'objet d'un audit de sécurité indépendant.`,
    },
    {
      title: '11. Enfants',
      body: `Chatterbox n'est pas destinée aux enfants de moins de 13 ans, et nous ne collectons pas sciemment leurs informations. Si vous pensez qu'un enfant nous a fourni des données personnelles, contactez-nous et nous les supprimerons.`,
    },
    {
      title: '12. Modifications',
      body: `Nous pouvons mettre à jour cette politique. Les changements importants seront annoncés dans l'application, et la date en haut est celle de la dernière modification.`,
    },
    {
      title: '13. Contact',
      body: `Questions sur cette politique : ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Rechercher une version plus récente de l\'application',
      body: `Google Play n'est pas le moyen par lequel cette application arrive sur votre téléphone Android. Elle est téléchargée depuis chatterbox.fans à la place, et un magasin qui n'est pas dans la boucle ne peut pas rechercher les mises à jour en votre nom — donc cette application le peut, si vous le lui demandez.

Toucher « Rechercher maintenant » envoie une seule requête à chatterbox.fans pour demander quelle est la version actuelle. Cette requête transporte votre adresse IP et rien d'autre — pas de compte, pas d'identifiant d'appareil, pas de message. Ce qui revient est un numéro de version, comparé sur votre téléphone à la version que vous utilisez ; rien n'est téléchargé automatiquement, et rien de cette vérification n'est écrit dans la conversation.

Cela n'a pas d'interrupteur car il n'y a rien à désactiver : cela ne s'exécute qu'au toucher, et pas autrement.

Si vous installez la mise à jour, elle remplace l'application sur place avec la même clé de signature, de la même façon qu'une mise à jour depuis Google Play le ferait.`,
    },
  ],
  'it': [
    {
      title: '0. In breve',
      body: `Il testo dei tuoi messaggi viene cifrato sul tuo dispositivo e può essere letto solo dalle persone a cui lo invii. Noi non possiamo leggerlo, e nemmeno Google, di cui affittiamo i server.

Quello che possiamo vedere è che una conversazione è avvenuta: quali account ne fanno parte e quando sono stati attivi. Togliere anche questo è più difficile che cifrare i contenuti, e non abbiamo finito. Questa informativa dice esattamente dove passa oggi il confine.`,
    },
    {
      title: '1. Che cosa è cifrato end-to-end',
      body: `Cifrato sul tuo dispositivo, illeggibile per noi e per Google:

• Il testo dei tuoi messaggi.
• Il contenuto di file, foto, audio e video che alleghi.
• Le anteprime dei link.
• Le chiamate vocali e video, che tra i due dispositivi usano il DTLS-SRTP obbligatorio di WebRTC.

La maggior parte dei messaggi individuali e di gruppo usa inoltre un ratchet: ogni messaggio ha la propria chiave, quindi compromettere il tuo dispositivo non espone quelli precedenti. Le conversazioni in cui il client di qualcuno non ha pubblicato il materiale di chiave più recente ricadono su un'unica chiave di lunga durata, che non ha questa proprietà. L'etichetta sotto un messaggio ti dice quale percorso ha davvero seguito.

Una cosa sola attraversa questa linea, e solo quando lo chiedi tu: cercare un nome su Wikipedia invia quel nome, non il messaggio da cui viene. La sezione 6 dice chi lo riceve, e la richiesta avviene al tocco e non altrimenti, quindi non c'è nulla da spegnere. Anche riassumere, tradurre e trascrivere la attraverserebbero: in questa versione sono spenti, e nell'app non c'è alcun comando che li accenda.`,
    },
    {
      title: '2. Che cosa non è cifrato, e che cosa vediamo',
      body: `La cifratura protegge i contenuti, non il fatto che ci sia una conversazione. Questi dati stanno in chiaro sui nostri server:

• Chi partecipa a ogni conversazione, e quando è stata creata e usata l'ultima volta.
• L'orario di ogni messaggio e quanti non ne hai letti.
• Nome, tipo e dimensione di un allegato. I byte sono cifrati, la loro descrizione no, e la lunghezza del cifrato delimita quella dell'originale.
• I tuoi amici e le richieste di amicizia.
• La segnalazione delle chiamate: che una chiamata c'è stata, con chi e quando. Non il suo audio né il video.

Gli indicatori di scrittura e le conferme di lettura sono disattivati finché non li accendi, e mentre sono spenti non viene scritto nulla.

Che cosa non c'è più: il tuo indirizzo email e il tuo nome. Da settembre 2026 il record dell'account contiene solo un identificatore — e da allora non c'è più alcun indirizzo, da nessuna parte. La registrazione non chiede nulla su di te: il tuo account è una frase di recupero di 24 parole, e la credenziale che Firebase Authentication verifica ne deriva. Lì viene conservata un'etichetta casuale sotto un dominio che non può ricevere posta.

A parte questo: poiché l'app gira su Google Firebase, Google può vedere l'indirizzo IP e l'orario di ogni connessione che il tuo dispositivo apre verso di essa. È una caratteristica dell'hosting, non dell'app, e non possiamo eliminarla con la cifratura.`,
    },
    {
      title: '3. Come ti trovano',
      body: `Non possono cercarti. Non esiste un elenco — nessuna ricerca per email, telefono o nome — e il server rifiuta qualsiasi interrogazione che ci provi.

Raggiungi qualcuno inviandogli un link d'invito fuori dall'app, con qualunque mezzo tu già usi. Un link funziona una volta, scade dopo 24 ore e può essere ritirato. Come chiami qualcuno è la tua etichetta per quella persona, e resta tua; se si è presentata, quel nome ti è arrivato cifrato.`,
    },
    {
      title: '4. Che cosa raccogliamo',
      body: `• Dati dell'account: un identificatore dell'account e una credenziale derivata dalla tua frase di recupero, conservata in Firebase Authentication. Nessun indirizzo email, nessun numero di telefono, nessun nome: la registrazione non ne chiede alcuno.
• Il testo cifrato di messaggi e allegati, più i metadati della sezione 2.

Questa è tutta la lista. Non c'è analisi d'uso né segnalazione di crash. L'app mandava le visualizzazioni di schermata a Firebase Analytics e i crash a Firebase Crashlytics, entrambi con il tuo identificativo di account, quindi nessuno dei due era anonimo; sono spariti entrambi, insieme alle librerie che li mandavano. Gli errori vengono stampati sulla macchina di chi sviluppa, durante lo sviluppo, e non vanno da nessun'altra parte.`,
    },
    {
      title: '5. Dove viene conservato',
      body: `Su Google Firebase — Firestore, Storage e Authentication — con regole di sicurezza che decidono chi può leggere e scrivere ogni documento.

Sul tuo dispositivo, i messaggi in cache, le impostazioni e il PIN di blocco sono cifrati con una chiave specifica del dispositivo custodita nel portachiavi della piattaforma (Keychain su iOS, Keystore su Android) e non nella normale memoria dell'app.

La chiave privata che decifra i tuoi messaggi non lascia mai il tuo dispositivo, se non come la frase di recupero che decidi di annotare. Non la possediamo e non possiamo recuperarla per te. Se la perdi, i messaggi inviati a quel dispositivo non saranno più leggibili — da nessuno, noi compresi.`,
    },
    {
      title: '6. Chi altro riceve dati',
      body: `Non vendiamo, scambiamo né noleggiamo le tue informazioni personali. I dati arrivano a:

• Google Firebase — il nostro fornitore di hosting, come descritto sopra.
• Cloudflare Realtime — l'audio e il video di una chiamata, quando il tuo dispositivo e quello dell'altra persona non riescono a raggiungersi direttamente.
• La Wikimedia Foundation — un solo nome, quando lo tocchi per cercarlo su Wikipedia.
• Google Cloud Speech-to-Text — l’audio di un messaggio vocale, quando chiedi una trascrizione.
• Google Cloud Translation — il testo di un messaggio, quando chiedi una traduzione.
• Cloudflare Workers AI — fino agli ultimi 50 messaggi di una conversazione, quando chiedi un riassunto o fai una domanda su di essa.

Gli ultimi tre sono spenti in questa versione. Nell'app non c'è alcun comando che accenda trascrizione, traduzione o riassunti, quindi a quei tre servizi non arriva nulla. Sono elencati anziché cancellati perché il codice è ancora qui e le funzioni devono tornare: quando torneranno, torneranno con questa informativa e con una richiesta prima del primo uso. Ciò che verrebbe inviato allora è inviato per produrre il tuo risultato, non per addestrare nulla; né una trascrizione né una traduzione vengono conservate sui nostri server.

Questa ricerca non ha un interruttore perché non c’è nulla di permanente da spegnere: parte con il tocco e non altrimenti. Wikipedia riceve quel nome e il tuo indirizzo IP, esattamente come se lo avessi digitato nella sua casella di ricerca — nessun account, nessun messaggio, nessuna conversazione. Ciò che torna viene mostrato e non salvato, e nulla di tutto questo viene scritto nella conversazione.

Anche Cloudflare Realtime non ha un interruttore. La maggior parte delle chiamate non ne ha bisogno: due dispositivi che possono raggiungersi direttamente — la maggior parte delle chiamate sulla stessa rete — si collegano senza di esso, e nulla viene inoltrato. Quando non possono, spesso perché siete su reti mobili diverse, la chiamata già cifrata viene inoltrata invece di restare senza connessione. Ciò che Cloudflare vede sono entrambi gli indirizzi IP, l'orario della chiamata e approssimativamente quanti dati sono stati trasferiti; l'audio e il video restano sotto la stessa cifratura DTLS-SRTP descritta nella sezione 2, quindi l'inoltro non li decifra.

Possiamo divulgare ciò che deteniamo se la legge lo impone. Ciò che deteniamo è l'elenco della sezione 2. Non possiamo produrre il contenuto dei messaggi, perché non riusciamo a leggerlo.`,
    },
    {
      title: '7. Notifiche push',
      body: `Le notifiche vengono recapitate da Firebase Cloud Messaging. Il token del tuo dispositivo è conservato in una parte privata del tuo account, leggibile solo da te.

Le notifiche non contengono il testo del messaggio. È il tuo dispositivo a decifrarlo in locale e a comporre ciò che vedi; Google consegna la busta, non il contenuto.`,
    },
    {
      title: '8. Che cosa puoi fare',
      body: `• Eliminare il tuo account dalla schermata Profilo. I contenuti che appartengono in comune a una conversazione — un registro di chiamata, per esempio — restano all'altro partecipante, perché sono anche il suo archivio.
• Esportare i tuoi dati dalla schermata Profilo.
• Far scadere i messaggi per singola chat: 1 ora, 24 ore, 7 giorni o 30 giorni.
• Attivare o disattivare indicatori di scrittura e conferme di lettura. Entrambi sono disattivati di default.
• Bloccare l'app con un PIN o con la biometria.
• Ritirare un link d'invito che hai già distribuito.

Se preferisci che cancelliamo qualcosa a mano, scrivici.`,
    },
    {
      title: '9. Conservazione',
      body: `Conserviamo i tuoi dati finché il tuo account esiste. Eliminarlo li cancella, tranne i contenuti condivisi indicati sopra. La scadenza per chat rimuove i messaggi secondo i tempi che imposti.`,
    },
    {
      title: '10. Limiti che dovresti conoscere',
      body: `Preferiamo dirteli noi piuttosto che fartene accorgere.

• Le chiavi vengono considerate attendibili la prima volta che si vedono. Se qualcuno avesse sostituito una chiave prima che vi scambiaste anche un solo messaggio, la conversazione sarebbe cifrata verso la persona sbagliata e sembrerebbe del tutto normale. L'app ti avvisa quando una chiave cambia in seguito e mostra un numero di sicurezza che potete confrontare per altre vie — ma nulla ti obbliga a confrontarlo.
• Un dispositivo alla volta. La tua frase di recupero ripristina la chiave che apre la cronologia, quindi accedere da un nuovo dispositivo non perde ciò che hai già ricevuto. Le conversazioni con segretezza in avanti usano una seconda chiave che non lascia mai il dispositivo che l'ha creata: arrivano all'ultimo dispositivo che ha effettuato l'accesso, e ciò che nel frattempo è stato sigillato per l'altro non può essere spostato.
• I messaggi inviati prima che esistesse la cifratura restano com'erano. Nulla è stato convertito retroattivamente.
• Questa app non è mai stata sottoposta a un audit di sicurezza indipendente.`,
    },
    {
      title: '11. Minori',
      body: `Chatterbox non è destinata a minori di 13 anni e non raccogliamo consapevolmente le loro informazioni. Se ritieni che un minore ci abbia fornito dati personali, contattaci e li cancelleremo.`,
    },
    {
      title: '12. Modifiche',
      body: `Potremmo aggiornare questa informativa. Le modifiche rilevanti verranno annunciate nell'app, e la data in alto indica l'ultima volta che è cambiata.`,
    },
    {
      title: '13. Contatti',
      body: `Domande su questa informativa: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Verificare una versione più recente dell\'app',
      body: `Google Play non è il modo in cui questa app arriva sul tuo telefono Android. Viene invece scaricata da chatterbox.fans, e uno store che non è coinvolto non può verificare gli aggiornamenti per tuo conto — quindi questa app può farlo, se glielo chiedi.

Toccando "Verifica ora" viene inviata un'unica richiesta a chatterbox.fans per sapere qual è la versione attuale. Quella richiesta porta con sé il tuo indirizzo IP e nient'altro — nessun account, nessun identificativo del dispositivo, nessun messaggio. Quello che torna è un numero di versione, confrontato sul tuo telefono con la versione che stai usando; nulla viene scaricato automaticamente, e nulla della verifica viene scritto nella conversazione.

Questo non ha un interruttore perché non c'è nulla da disattivare: si esegue solo al tocco e non altrimenti.

Se installi l'aggiornamento, sostituisce l'app al suo posto usando la stessa chiave di firma, allo stesso modo in cui lo farebbe un aggiornamento da Google Play.`,
    },
  ],
  'pt': [
    {
      title: '0. Em resumo',
      body: `O texto das tuas mensagens é cifrado no teu dispositivo e só pode ser lido pelas pessoas a quem o envias. Nós não conseguimos lê-lo, e a Google, cujos servidores alugamos, também não.

O que conseguimos ver é que houve uma conversa: que contas fazem parte dela e quando estiveram ativas. Retirar isso é mais difícil do que cifrar os conteúdos, e ainda não terminámos. Esta política diz exatamente onde está a linha neste momento.`,
    },
    {
      title: '1. O que está cifrado ponto a ponto',
      body: `Cifrado no teu dispositivo, ilegível para nós e para a Google:

• O texto das tuas mensagens.
• O conteúdo de ficheiros, fotos, áudio e vídeo que anexas.
• As pré-visualizações de ligações.
• As chamadas de voz e vídeo, que usam o DTLS-SRTP obrigatório do WebRTC entre os dois dispositivos.

A maioria das mensagens individuais e de grupo usa ainda um roquete: cada mensagem tem a sua própria chave, por isso comprometer o teu dispositivo não expõe as anteriores. As conversas em que o cliente de alguém não publicou o material de chave mais recente recaem numa única chave de longa duração, que não tem essa propriedade. A etiqueta por baixo de uma mensagem diz-te qual delas ela realmente seguiu.

Só uma coisa atravessa esta linha, e apenas quando a pedes: procurar um nome na Wikipédia envia esse nome, não a mensagem de onde ele veio. A secção 6 diz quem o recebe, e o pedido acontece no toque e não de outra forma, por isso não há nada para desligar. Resumir, traduzir e transcrever também a atravessariam: estão desligados nesta versão, e não há na aplicação qualquer controlo que os ligue.`,
    },
    {
      title: '2. O que não está cifrado, e o que conseguimos ver',
      body: `A cifra protege conteúdos, não o facto de existir uma conversa. Isto fica em claro nos nossos servidores:

• Quem está em cada conversa, e quando foi criada e usada pela última vez.
• A data e hora de cada mensagem e quantas não leste.
• O nome, o tipo e o tamanho de um anexo. Os bytes estão cifrados; a descrição deles não, e o comprimento do cifrado limita o do original.
• Os teus amigos e pedidos de amizade.
• A sinalização de chamadas — que houve uma chamada, com quem e quando. Não o áudio nem o vídeo.

Os indicadores de escrita e as confirmações de leitura estão desligados a não ser que os ligues, e enquanto estão desligados nada é escrito.

O que já não está aqui: o teu endereço de email e o teu nome. Desde setembro de 2026, o registo da conta contém apenas um identificador de conta — e desde então não há endereço nenhum em lado nenhum. Criar conta não pergunta nada sobre ti: a tua conta é uma frase de recuperação de 24 palavras, e a credencial que o Firebase Authentication verifica é derivada dela. O que fica lá guardado é uma etiqueta aleatória num domínio que não consegue receber correio.

À parte disso: como a app corre sobre a Google Firebase, a Google consegue ver o endereço IP e a hora de cada ligação que o teu dispositivo lhe faz. Isso é uma característica do alojamento, não da app, e não podemos fazê-lo desaparecer com cifra.`,
    },
    {
      title: '3. Como te encontram',
      body: `Não te conseguem procurar. Não existe diretório — nem pesquisa por email, telefone ou nome — e o servidor recusa qualquer consulta que tente.

Chegas a alguém enviando-lhe uma ligação de convite fora da app, por aquilo que já usas. Uma ligação funciona uma vez, expira ao fim de 24 horas e pode ser retirada. Aquilo por que tratas alguém é a tua própria etiqueta para essa pessoa, guardada para ti; se ela se apresentou, esse nome chegou-te cifrado.`,
    },
    {
      title: '4. O que recolhemos',
      body: `• Dados da conta: um identificador de conta e uma credencial derivada da tua frase de recuperação, guardada no Firebase Authentication. Sem endereço de email, sem número de telefone e sem nome — a criação de conta não pede nenhum deles.
• O texto cifrado das mensagens e dos anexos, mais os metadados da secção 2.

É esta a lista toda. Não há análise de utilização nem relatórios de falhas. A aplicação enviava visualizações de ecrã para o Firebase Analytics e falhas para o Firebase Crashlytics, ambos com o teu identificador de conta, por isso nenhum era anónimo; os dois desapareceram, juntamente com as bibliotecas que os enviavam. Os erros são impressos na máquina de quem desenvolve, durante o desenvolvimento, e não vão para mais lado nenhum.`,
    },
    {
      title: '5. Onde fica guardado',
      body: `Na Google Firebase — Firestore, Storage e Authentication — sob regras de segurança que decidem quem pode ler e escrever cada documento.

No teu dispositivo, as mensagens em cache, as definições e o PIN de bloqueio são cifrados com uma chave própria do dispositivo guardada no cofre de chaves do sistema (Keychain no iOS, Keystore no Android) e não no armazenamento normal da app.

A chave privada que decifra as tuas mensagens nunca sai do teu dispositivo, exceto na forma da frase de recuperação que decidires anotar. Não a temos e não a podemos recuperar por ti. Se a perderes, as mensagens enviadas para esse dispositivo não voltam a ser legíveis — por ninguém, incluindo nós.`,
    },
    {
      title: '6. Quem mais recebe dados',
      body: `Não vendemos, trocamos nem alugamos as tuas informações pessoais. Os dados chegam a:

• Google Firebase — o nosso fornecedor de alojamento, como descrito acima.
• Cloudflare Realtime — o áudio e o vídeo de uma chamada, quando o teu dispositivo e o da outra pessoa não conseguem alcançar-se diretamente.
• A Wikimedia Foundation — um único nome, quando lhe tocas para o procurar na Wikipédia.
• Google Cloud Speech-to-Text — o áudio de uma mensagem de voz, quando pedes uma transcrição.
• Google Cloud Translation — o texto de uma mensagem, quando pedes uma tradução.
• Cloudflare Workers AI — até às últimas 50 mensagens de uma conversa, quando pedes um resumo ou fazes uma pergunta sobre ela.

Os últimos três estão desligados nesta versão. Não há na aplicação qualquer controlo que ligue a transcrição, a tradução ou os resumos, por isso nada chega a esses três serviços. Estão listados em vez de apagados porque o código continua aqui e as funcionalidades hão de voltar — e quando voltarem, voltam com esta divulgação e com uma pergunta antes da primeira utilização. O que seria enviado então é enviado para produzir o teu resultado, não para treinar nada; nem uma transcrição nem uma tradução ficam guardadas nos nossos servidores.

Esta procura não tem interruptor porque não há nada permanente para desligar: corre no toque e não de outra forma. A Wikipédia recebe esse nome e o teu endereço IP, tal como se o tivesses escrito na caixa de pesquisa dela — nenhuma conta, nenhuma mensagem, nenhuma conversa. O que volta é mostrado e não guardado, e nada disso é escrito na conversa.

A Cloudflare Realtime também não tem interruptor. A maioria das chamadas não precisa dela: dois dispositivos que conseguem alcançar-se diretamente — a maioria das chamadas na mesma rede — ligam-se sem ela, e nada é retransmitido. Quando não conseguem, normalmente porque estão em redes móveis diferentes, a chamada já cifrada é retransmitida em vez de ficar sem ligação. O que a Cloudflare vê são os dois endereços IP, o momento da chamada e aproximadamente quantos dados foram movidos; o áudio e o vídeo permanecem sob a mesma cifra DTLS-SRTP descrita na secção 2, pelo que a retransmissão não os decifra.

Podemos divulgar o que temos se a lei o exigir. O que temos é a lista da secção 2. Não conseguimos entregar o conteúdo das mensagens, porque não o conseguimos ler.`,
    },
    {
      title: '7. Notificações push',
      body: `As notificações são entregues pelo Firebase Cloud Messaging. O token do teu dispositivo fica numa parte privada da tua conta que só tu consegues ler.

As notificações não levam o texto da mensagem. É o teu dispositivo que a decifra localmente e compõe o que vês; a Google entrega o envelope, não o conteúdo.`,
    },
    {
      title: '8. O que podes fazer',
      body: `• Apagar a tua conta no ecrã Perfil. O conteúdo que pertence em conjunto a uma conversa — um registo de chamada, por exemplo — fica com o outro participante, porque também é o registo dele.
• Exportar os teus dados no ecrã Perfil.
• Fazer as mensagens expirar por conversa: 1 hora, 24 horas, 7 dias ou 30 dias.
• Ligar ou desligar os indicadores de escrita e as confirmações de leitura. Ambos vêm desligados.
• Bloquear a app com PIN ou biometria.
• Retirar uma ligação de convite que já tenhas distribuído.

Se preferires que apaguemos algo à mão, escreve-nos.`,
    },
    {
      title: '9. Retenção',
      body: `Guardamos os teus dados enquanto a tua conta existir. Apagá-la apaga-os, exceto o conteúdo partilhado indicado acima. A expiração por conversa remove as mensagens no prazo que definires.`,
    },
    {
      title: '10. Limites que deves conhecer',
      body: `Preferimos dizer-tos a que os descubras sozinho.

• As chaves são confiadas na primeira vez que são vistas. Se alguém tivesse substituído uma chave antes de vocês trocarem sequer uma mensagem, a conversa ficaria cifrada para a pessoa errada e pareceria perfeitamente normal. A app avisa-te quando uma chave muda depois disso e mostra um número de segurança que podem comparar por outro meio — mas nada te obriga a compará-lo.
• Um dispositivo de cada vez. A tua frase de recuperação restaura a chave que abre o teu histórico, por isso iniciar sessão num dispositivo novo não perde o que já recebeste. As conversas com sigilo persistente usam uma segunda chave que nunca sai do dispositivo que a criou: chegam ao último dispositivo onde iniciaste sessão, e o que entretanto foi selado para o outro não pode ser transferido.
• As mensagens enviadas antes de existir cifra ficam como estavam. Nada foi convertido retroativamente.
• Esta app nunca passou por uma auditoria de segurança independente.`,
    },
    {
      title: '11. Crianças',
      body: `O Chatterbox não se destina a crianças com menos de 13 anos, e não recolhemos conscientemente as suas informações. Se achas que uma criança nos deu dados pessoais, contacta-nos e apagá-los-emos.`,
    },
    {
      title: '12. Alterações',
      body: `Podemos atualizar esta política. As alterações significativas serão anunciadas na app, e a data no topo é a da última alteração.`,
    },
    {
      title: '13. Contacto',
      body: `Questões sobre esta política: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Verificar se há uma versão mais recente da app',
      body: `A Google Play não é a forma como esta app chega ao teu telemóvel Android. É descarregada a partir do chatterbox.fans, e uma loja que não está a par não consegue verificar atualizações em teu nome — por isso esta app pode fazê-lo, se lho pedires.

Tocar em "Verificar agora" envia um único pedido ao chatterbox.fans a perguntar qual é a versão atual. Esse pedido transporta o teu endereço IP e nada mais — sem conta, sem identificador do dispositivo, sem mensagem. O que volta é um número de versão, comparado no teu telemóvel com a versão que tens instalada; nada é descarregado automaticamente, e nada desta verificação é escrito na conversa.

Isto não tem interruptor porque não há nada para desligar: só corre quando tocas e não de outra forma.

Se instalares a atualização, esta substitui a app no mesmo lugar usando a mesma chave de assinatura, tal como uma atualização da Google Play faria.`,
    },
  ],
  'ru': [
    {
      title: '0. Коротко',
      body: `Текст ваших сообщений шифруется на вашем устройстве, и прочитать его могут только те, кому вы его отправили. Мы его прочитать не можем, и Google, чьи серверы мы арендуем, тоже.

Что мы видим — это что разговор состоялся: какие аккаунты в нём участвуют и когда они были активны. Убрать и это сложнее, чем зашифровать содержимое, и мы ещё не закончили. Эта политика говорит точно, где сейчас проходит граница.`,
    },
    {
      title: '1. Что зашифровано сквозным шифрованием',
      body: `Зашифровано на вашем устройстве и нечитаемо ни для нас, ни для Google:

• Текст ваших сообщений.
• Содержимое файлов, фотографий, аудио и видео, которые вы прикрепляете.
• Предпросмотры ссылок.
• Голосовые и видеозвонки — между двумя устройствами используется обязательный в WebRTC протокол DTLS-SRTP.

Большинство личных и групповых сообщений дополнительно используют храповик: у каждого сообщения свой ключ, поэтому компрометация устройства не раскрывает более ранние. Разговоры, где чей-то клиент не опубликовал более новый ключевой материал, откатываются на один долгоживущий ключ, у которого этого свойства нет. Отметка под сообщением говорит, каким путём оно пошло на самом деле.

Эту линию пересекает одно, и только когда вы сами просите: поиск имени в Википедии отправляет это имя, а не сообщение, из которого оно взято. Кто его получает, сказано в разделе 6; запрос происходит по нажатию и никак иначе, так что выключать нечего. Пересказ, перевод и расшифровка пересекали бы её тоже — в этом выпуске они выключены, и в приложении нет ничего, что их включает.`,
    },
    {
      title: '2. Что не зашифровано и что мы видим',
      body: `Шифрование защищает содержимое, а не сам факт разговора. Вот что лежит в открытом виде на наших серверах:

• Кто участвует в каждом разговоре, когда он создан и когда был активен в последний раз.
• Время каждого сообщения и сколько вы не прочитали.
• Имя файла, тип и размер вложения. Байты зашифрованы, а их описание — нет, и длина шифртекста ограничивает длину оригинала.
• Ваши друзья и заявки в друзья.
• Сигнализация звонков — что звонок был, кому и когда. Не его звук и не видео.

Индикатор набора и отчёты о прочтении выключены, пока вы их не включите, и пока они выключены, ничего не записывается.

Чего здесь больше нет: вашего адреса электронной почты и вашего имени. С сентября 2026 года запись аккаунта содержит только его идентификатор — и с тех пор адреса нет вообще нигде. Регистрация не спрашивает о вас ничего: ваш аккаунт — это фраза восстановления из 24 слов, и учётные данные, которые проверяет Firebase Authentication, выведены из неё. Там хранится случайная метка в домене, который не способен принимать почту.

Отдельно: поскольку приложение работает на Google Firebase, Google видит IP-адрес и время каждого соединения, которое ваше устройство к нему открывает. Это свойство хостинга, а не приложения, и зашифровать его мы не можем.`,
    },
    {
      title: '3. Как вас находят',
      body: `Вас нельзя найти поиском. Здесь нет каталога — ни поиска по почте, ни по телефону, ни по имени, — и сервер отклоняет любой запрос, который это пытается сделать.

Чтобы связаться с кем-то, вы отправляете ему ссылку-приглашение по любому каналу, которым уже пользуетесь. Ссылка срабатывает один раз, истекает через 24 часа, и её можно отозвать. То, как вы кого-то называете, — это ваша собственная пометка, и она остаётся у вас; если человек представился, это имя пришло к вам зашифрованным.`,
    },
    {
      title: '4. Что мы собираем',
      body: `• Данные аккаунта: идентификатор аккаунта и выведенные из вашей фразы восстановления учётные данные, хранящиеся в Firebase Authentication. Ни адреса почты, ни номера телефона, ни имени — при регистрации ничего из этого не спрашивают.
• Шифротекст сообщений и вложений плюс метаданные из раздела 2.

Это весь список. Никакой аналитики и никаких отчётов о сбоях. Раньше приложение отправляло просмотры экранов в Firebase Analytics, а сбои — в Firebase Crashlytics, и то и другое с идентификатором вашего аккаунта, так что анонимными они не были; и то и другое убрано вместе с библиотеками, которые это отправляли. Ошибки печатаются на машине разработчика во время разработки и больше никуда не идут.`,
    },
    {
      title: '5. Где это хранится',
      body: `На Google Firebase — Firestore, Storage и Authentication — под правилами безопасности, которые решают, кто может читать и записывать каждый документ.

На вашем устройстве закэшированные сообщения, настройки и PIN-код блокировки шифруются ключом, привязанным к устройству и хранящимся в системном хранилище ключей (Keychain в iOS, Keystore в Android), а не в обычном хранилище приложения.

Закрытый ключ, который расшифровывает ваши сообщения, никогда не покидает устройство — кроме как в виде фразы восстановления, которую вы решите записать. У нас его нет, и восстановить его за вас мы не можем. Потеряете — сообщения, отправленные на это устройство, больше никто не прочитает, включая нас.`,
    },
    {
      title: '6. Кто ещё получает данные',
      body: `Мы не продаём, не обмениваем и не сдаём в аренду вашу личную информацию. Данные попадают:

• В Google Firebase — нашему хостинг-провайдеру, как описано выше.
• Cloudflare Realtime — аудио и видео звонка, когда ваше устройство и устройство собеседника не могут связаться напрямую.
• В Фонд Викимедиа — одно имя, когда вы нажимаете на него, чтобы найти его в Википедии.
• В Google Cloud Speech-to-Text — аудио одного голосового сообщения, когда вы просите расшифровку.
• В Google Cloud Translation — текст одного сообщения, когда вы просите перевод.
• В Cloudflare Workers AI — до последних 50 сообщений одной переписки, когда вы просите сводку или задаёте вопрос о ней.

Последние три в этом выпуске выключены. В приложении нет ничего, что включает расшифровку, перевод или пересказ, поэтому в эти три службы ничего не уходит. Они перечислены, а не удалены, потому что код на месте и эти функции должны вернуться — а когда вернутся, вернутся вместе с этим раскрытием и с вопросом перед первым использованием. То, что тогда будет отправлено, отправляется, чтобы получить ваш результат, а не чтобы что-то обучать; ни расшифровка, ни перевод не хранятся на наших серверах.

У этого поиска нет переключателя, потому что нечего постоянно выключать: он срабатывает по нажатию и никак иначе. Википедия получает это имя и ваш IP-адрес — ровно так же, как если бы вы сами набрали его в её строке поиска: ни аккаунта, ни сообщения, ни переписки. То, что возвращается, показывается и не сохраняется, и ничего из этого не записывается в переписку.

У Cloudflare Realtime тоже нет переключателя. Большинству звонков он не нужен: два устройства, которые могут связаться напрямую — большинство звонков в одной сети, — соединяются без него, и ничего не ретранслируется. Когда напрямую связаться не удаётся — обычно потому что вы находитесь в разных мобильных сетях, — уже зашифрованный звонок ретранслируется, а не остаётся без соединения. Cloudflare видит оба IP-адреса, время звонка и приблизительный объём переданных данных; аудио и видео остаются под тем же шифрованием DTLS-SRTP, описанным в разделе 2, поэтому ретрансляция их не расшифровывает.

Мы можем раскрыть то, чем располагаем, если этого требует закон. Располагаем мы списком из раздела 2. Содержимое сообщений мы предоставить не можем, потому что прочитать его не в состоянии.`,
    },
    {
      title: '7. Push-уведомления',
      body: `Уведомления доставляет Firebase Cloud Messaging. Токен вашего устройства хранится в приватной части аккаунта, которую можете читать только вы.

Уведомления не содержат текста сообщения. Ваше устройство расшифровывает сообщение локально и составляет то, что вы видите; Google доставляет конверт, а не содержимое.`,
    },
    {
      title: '8. Что вы можете сделать',
      body: `• Удалить аккаунт на экране профиля. Содержимое, которое совместно принадлежит разговору — например, запись о звонке — остаётся у собеседника, потому что это и его запись тоже.
• Экспортировать свои данные на экране профиля.
• Задать срок жизни сообщений для каждого чата: 1 час, 24 часа, 7 дней или 30 дней.
• Включить или выключить индикатор набора и отчёты о прочтении. Оба по умолчанию выключены.
• Закрыть приложение PIN-кодом или биометрией.
• Отозвать ссылку-приглашение, которую вы уже раздали.

Если вам удобнее, чтобы мы удалили что-то вручную, напишите нам.`,
    },
    {
      title: '9. Хранение',
      body: `Мы храним ваши данные, пока существует аккаунт. Его удаление удаляет и их, кроме совместно принадлежащего содержимого, о котором сказано выше. Срок жизни сообщений в чате удаляет их по заданному вами расписанию.`,
    },
    {
      title: '10. Ограничения, о которых стоит знать',
      body: `Мы предпочитаем рассказать о них сами, чем чтобы вы наткнулись на них.

• Ключам доверяют при первой встрече. Если бы кто-то подменил ключ до того, как вы обменялись хотя бы одним сообщением, разговор оказался бы зашифрован не тому человеку и выглядел бы совершенно обычно. Приложение предупреждает, когда ключ меняется после этого, и показывает код безопасности, который можно сверить по другому каналу, — но ничто не заставляет вас его сверять.
• По одному устройству за раз. Фраза восстановления возвращает ключ, открывающий вашу историю, так что вход на новом устройстве не теряет то, что вы уже получили. Переписки с прямой секретностью используют второй ключ, который никогда не покидает создавшее его устройство: они приходят на устройство, вошедшее последним, а то, что тем временем было запечатано для другого, перенести нельзя.
• Сообщения, отправленные до появления шифрования, остаются как были. Ничего не переводилось задним числом.
• Это приложение никогда не проходило независимый аудит безопасности.`,
    },
    {
      title: '11. Дети',
      body: `Chatterbox не предназначен для детей младше 13 лет, и мы сознательно не собираем их данные. Если вы считаете, что ребёнок передал нам личную информацию, свяжитесь с нами, и мы её удалим.`,
    },
    {
      title: '12. Изменения',
      body: `Мы можем обновлять эту политику. О значимых изменениях сообщим в приложении, а дата вверху — это дата последнего изменения.`,
    },
    {
      title: '13. Контакты',
      body: `Вопросы по этой политике: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Проверка новой версии приложения',
      body: `Google Play — не тот способ, которым это приложение попадает на ваш Android-телефон. Оно скачивается с chatterbox.fans, а магазин, который не в курсе, не может проверять обновления от вашего имени — поэтому это может делать само приложение, если вы его об этом попросите.

Нажатие «Проверить сейчас» отправляет один запрос на chatterbox.fans с вопросом, какая версия актуальна. Этот запрос содержит только ваш IP-адрес и ничего больше — ни аккаунта, ни идентификатора устройства, ни сообщения. В ответ приходит номер версии, который сравнивается на вашем телефоне с установленной версией; ничего не скачивается автоматически, и ничего об этой проверке не записывается в переписку.

У этого нет переключателя, потому что нечего отключать: это выполняется только по нажатию и никак иначе.

Если вы установите обновление, оно заменит приложение на месте с использованием того же ключа подписи — так же, как это сделало бы обновление из Google Play.`,
    },
  ],
  'tr': [
    {
      title: '0. Kısaca',
      body: `Mesajlarının metni cihazında şifrelenir ve yalnızca gönderdiğin kişiler okuyabilir. Biz okuyamayız; sunucularını kiraladığımız Google da okuyamaz.

Görebildiğimiz şey, bir konuşmanın gerçekleştiği: içinde hangi hesapların olduğu ve ne zaman etkin olduklarıdır. Bunu da ortadan kaldırmak, içeriği şifrelemekten daha zor ve henüz bitirmedik. Bu politika, sınırın şu anda tam olarak nerede olduğunu söylüyor.`,
    },
    {
      title: '1. Uçtan uca şifreli olanlar',
      body: `Cihazında şifrelenir; ne biz ne de Google okuyabilir:

• Mesajlarının metni.
• Eklediğin dosyaların, fotoğrafların, seslerin ve videoların içeriği.
• Bağlantı önizlemeleri.
• Sesli ve görüntülü aramalar; iki cihaz arasında WebRTC'nin zorunlu kıldığı DTLS-SRTP kullanılır.

Birebir ve grup mesajlarının çoğu ayrıca bir cırcır mekanizması kullanır: her mesajın kendi anahtarı vardır, bu yüzden cihazının ele geçirilmesi önceki mesajları açığa çıkarmaz. Birinin istemcisinin daha yeni anahtar malzemesini yayımlamadığı konuşmalar, bu özelliği taşımayan tek bir uzun ömürlü anahtara geri düşer. Mesajın altındaki etiket, o mesajın gerçekte hangisini kullandığını söyler.

Bu çizgiyi tek bir şey aşar, o da yalnızca sen istediğinde: Vikipedi'de bir isim aramak o ismi gönderir, geldiği mesajı değil. Kimin aldığı 6. bölümde yazıyor; sorgu yalnızca dokunduğun anda yapılır, başka zaman değil, dolayısıyla kapatılacak bir şey yok. Özetleme, çeviri ve yazıya dökme de bu çizgiyi aşardı — bu sürümde kapalılar ve uygulamada onları açan hiçbir denetim yok.`,
    },
    {
      title: '2. Şifreli olmayanlar ve bizim görebildiklerimiz',
      body: `Şifreleme içeriği korur, bir konuşmanın var olduğu gerçeğini değil. Şunlar sunucularımızda açık hâlde durur:

• Her konuşmada kimlerin bulunduğu, ne zaman oluşturulduğu ve en son ne zaman etkin olduğu.
• Her mesajın zaman damgası ve kaç tanesini okumadığın.
• Bir ekin dosya adı, türü ve boyutu. Baytlar şifrelidir; onların tarifi değildir ve şifreli metnin uzunluğu aslının uzunluğunu sınırlar.
• Arkadaşların ve arkadaşlık istekleri.
• Arama sinyalleşmesi — bir aramanın yapıldığı, kiminle ve ne zaman. Sesi ya da görüntüsü değil.

Yazıyor göstergesi ve okundu bilgisi sen açmadıkça kapalıdır ve kapalıyken hiçbir şey yazılmaz.

Artık burada olmayanlar: e-posta adresin ve adın. Eylül 2026'dan beri hesap kaydında yalnızca bir hesap tanımlayıcısı bulunur — ve o tarihten beri hiçbir yerde tutulacak bir adres yok. Kayıt sırasında sana dair hiçbir şey sorulmaz: hesabın 24 kelimelik bir kurtarma ifadesidir ve Firebase Authentication'ın doğruladığı kimlik bilgisi ondan türetilir. Orada tutulan şey, posta alamayan bir alan adı altındaki rastgele bir etikettir.

Ayrıca: uygulama Google Firebase üzerinde çalıştığı için Google, cihazının kurduğu her bağlantının IP adresini ve zamanını görebilir. Bu, uygulamanın değil barındırmanın bir özelliğidir ve şifreleyerek yok edemeyiz.`,
    },
    {
      title: '3. Seni nasıl buluyorlar',
      body: `Seni arayamazlar. Bir rehber yok — e-posta, telefon ya da adla arama yok — ve sunucu bunu deneyen her sorguyu reddeder.

Birine ulaşmak için ona uygulama dışından, zaten kullandığın herhangi bir yolla bir davet bağlantısı gönderirsin. Bağlantı bir kez çalışır, 24 saat sonra sona erer ve geri çekilebilir. Birine ne dediğin senin kendi etiketindir ve sende kalır; kendini tanıttıysa, o ad sana şifreli olarak ulaşmıştır.`,
    },
    {
      title: '4. Neleri topluyoruz',
      body: `• Hesap verisi: bir hesap tanımlayıcısı ve kurtarma ifadenden türetilen bir kimlik bilgisi, Firebase Authentication'da tutulur. E-posta adresi yok, telefon numarası yok, ad yok — kayıt bunların hiçbirini istemez.
• Mesajların ve eklerin şifreli hâli, ayrıca 2. bölümdeki üst veri.

Listenin tamamı bu. Ne kullanım analizi var ne de çökme raporu. Uygulama eskiden ekran görüntülemelerini Firebase Analytics'e, çökmeleri Firebase Crashlytics'e gönderiyordu; ikisi de hesap kimliğini taşıdığı için hiçbiri anonim değildi. İkisi de, onları gönderen kütüphanelerle birlikte kaldırıldı. Hatalar geliştirme sırasında geliştiricinin kendi makinesine yazılır ve başka hiçbir yere gitmez.`,
    },
    {
      title: '5. Nerede saklanıyor',
      body: `Google Firebase'de — Firestore, Storage ve Authentication — her belgeyi kimin okuyup yazabileceğine karar veren güvenlik kurallarıyla.

Cihazında, önbellekteki mesajlar, ayarlar ve uygulama kilidi PIN'in, sıradan uygulama deposunda değil, platformun anahtar deposunda (iOS Keychain, Android Keystore) tutulan cihaza özel bir anahtarla şifrelenir.

Mesajlarını çözen özel anahtar cihazından hiç çıkmaz; tek istisna, yazmayı seçtiğin kurtarma ifadesidir. O anahtar bizde değildir ve senin için geri getiremeyiz. Kaybedersen, o cihaza gönderilen mesajlar bir daha okunamaz — biz dâhil hiç kimse tarafından.`,
    },
    {
      title: '6. Veriyi başka kim alıyor',
      body: `Kişisel bilgilerini satmayız, takas etmeyiz, kiralamayız. Veri şuralara ulaşır:

• Google Firebase — yukarıda anlatıldığı gibi barındırma sağlayıcımız.
• Cloudflare Realtime — cihazın ve karşındaki kişinin cihazı birbirine doğrudan ulaşamadığında, aramanın sesini ve görüntüsünü aktarır.
• Wikimedia Vakfı — Vikipedi'de aramak için dokunduğun tek bir ad.
• Google Cloud Speech-to-Text — bir yazıya dökme istediğinde, tek bir sesli mesajın ses kaydı.
• Google Cloud Translation — bir çeviri istediğinde, tek bir mesajın metni.
• Cloudflare Workers AI — bir özet istediğinde ya da bir konuşma hakkında soru sorduğunda, o konuşmanın son 50 mesajına kadarı.

Son üçü bu sürümde kapalı. Uygulamada yazıya dökmeyi, çeviriyi ya da özetleri açan hiçbir denetim yok, dolayısıyla bu üç hizmete hiçbir şey ulaşmıyor. Silinmek yerine burada duruyorlar çünkü kod hâlâ burada ve bu özelliklerin geri gelmesi planlanıyor — geri geldiklerinde bu açıklamayla ve ilk kullanımdan önce sorulan soruyla birlikte gelecekler. O zaman gönderilecek olan şey senin sonucunu üretmek içindir, bir şeyi eğitmek için değil; ne bir döküm ne de bir çeviri sunucularımızda saklanır.

Bu aramanın anahtarı yok, çünkü kapatılacak kalıcı bir şey yok: dokunduğun anda çalışır, başka zaman çalışmaz. Vikipedi o adı ve IP adresini alır; tıpkı arama kutusuna kendin yazmış olsaydın olacağı gibi — hesap yok, mesaj yok, konuşma yok. Dönen şey gösterilir, saklanmaz ve hiçbiri konuşmaya yazılmaz.

Cloudflare Realtime'ın da bir anahtarı yok. Aramaların çoğunun buna ihtiyacı yok: birbirine doğrudan ulaşabilen iki cihaz — aynı ağdaki çoğu arama — onsuz bağlanır ve hiçbir şey aktarılmaz. Bağlanamadıklarında, genellikle farklı mobil ağlarda olduğunuz için, zaten şifrelenmiş olan arama, bağlantısız kalmak yerine aktarılır. Cloudflare'ın gördüğü şey her iki IP adresi, aramanın zamanı ve yaklaşık ne kadar veri taşındığıdır; ses ve görüntü, 2. bölümde açıklanan aynı DTLS-SRTP şifrelemesi altında kalır, bu yüzden aktarma onları çözmez.

Yasa gerektirirse elimizdekileri açıklayabiliriz. Elimizdeki, 2. bölümdeki listedir. Mesaj içeriğini veremeyiz, çünkü onu okuyamıyoruz.`,
    },
    {
      title: '7. Anlık bildirimler',
      body: `Bildirimleri Firebase Cloud Messaging iletir. Cihaz belirtecin, hesabının yalnızca senin okuyabildiğin özel bir bölümünde saklanır.

Bildirimler mesaj metni taşımaz. Mesajı yerel olarak cihazın çözer ve gördüğün şeyi o oluşturur; Google zarfı iletir, içindekini değil.`,
    },
    {
      title: '8. Neler yapabilirsin',
      body: `• Profil ekranından hesabını sil. Bir konuşmanın ortak parçası olan içerik — örneğin bir arama kaydı — karşı tarafta kalır, çünkü o kayıt onun da kaydıdır.
• Profil ekranından verilerini dışa aktar.
• Mesajların sohbet başına süresini ayarla: 1 saat, 24 saat, 7 gün veya 30 gün.
• Yazıyor göstergesini ve okundu bilgisini aç ya da kapat. İkisi de varsayılan olarak kapalıdır.
• Uygulamayı PIN veya biyometriyle kilitle.
• Dağıttığın bir davet bağlantısını geri çek.

Bir şeyi elle silmemizi tercih edersen bize yaz.`,
    },
    {
      title: '9. Saklama',
      body: `Hesabın var olduğu sürece verilerini saklarız. Hesabı silmek onları da siler; yukarıda belirtilen ortak içerik hariç. Sohbet başına süre, mesajları belirlediğin takvime göre kaldırır.`,
    },
    {
      title: '10. Bilmen gereken sınırlar',
      body: `Bunları kendin keşfetmen yerine sana söylemeyi tercih ederiz.

• Anahtarlara ilk görüldüklerinde güvenilir. Biri, siz daha tek bir mesaj alışverişi yapmadan önce bir anahtarı değiştirmiş olsaydı, konuşma yanlış kişiye şifrelenir ve tamamen normal görünürdü. Uygulama, sonrasında bir anahtar değiştiğinde seni uyarır ve başka bir kanaldan karşılaştırabileceğin bir güvenlik numarası gösterir — ama karşılaştırman için seni zorlayan bir şey yoktur.
• Aynı anda tek cihaz. Kurtarma ifaden geçmişini açan anahtarı geri getirir, dolayısıyla yeni bir cihazda giriş yapmak zaten aldıklarını kaybettirmez. İleri gizlilikli konuşmalar, kendisini üreten cihazdan hiç ayrılmayan ikinci bir anahtar kullanır: bunlar en son giriş yapılan cihaza ulaşır ve bu arada diğerine mühürlenmiş olanlar taşınamaz.
• Şifreleme var olmadan önce gönderilen mesajlar olduğu gibi kalır. Geriye dönük hiçbir dönüştürme yapılmadı.
• Bu uygulama hiçbir zaman bağımsız bir güvenlik denetiminden geçmedi.`,
    },
    {
      title: '11. Çocuklar',
      body: `Chatterbox 13 yaşından küçük çocuklar için tasarlanmamıştır ve bilerek onların bilgilerini toplamayız. Bir çocuğun bize kişisel bilgi verdiğini düşünüyorsan bizimle iletişime geç, sileriz.`,
    },
    {
      title: '12. Değişiklikler',
      body: `Bu politikayı güncelleyebiliriz. Önemli değişiklikler uygulama içinde duyurulur ve yukarıdaki tarih, en son ne zaman değiştiğini gösterir.`,
    },
    {
      title: '13. İletişim',
      body: `Bu politikayla ilgili sorular: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Uygulamanın daha yeni bir sürümünü kontrol etme',
      body: `Google Play, bu uygulamanın Android telefonuna ulaşma yolu değildir. Bunun yerine chatterbox.fans'tan indirilir ve sürece dahil olmayan bir mağaza senin adına güncellemeleri kontrol edemez — bu yüzden istersen uygulama bunu kendisi yapabilir.

"Şimdi kontrol et"e dokunmak chatterbox.fans'a hangi sürümün güncel olduğunu soran tek bir istek gönderir. Bu istek yalnızca IP adresini taşır, başka hiçbir şey taşımaz — hesap yok, cihaz kimliği yok, mesaj yok. Geri gelen şey bir sürüm numarasıdır, telefonunda kullandığın sürümle karşılaştırılır; hiçbir şey otomatik olarak indirilmez ve kontrolle ilgili hiçbir şey sohbete yazılmaz.

Bunun bir anahtarı yoktur, çünkü kapatılacak bir şey yoktur: yalnızca dokunulduğunda çalışır, başka türlü çalışmaz.

Güncellemeyi kurarsan, aynı imzalama anahtarını kullanarak uygulamayı yerinde değiştirir — tıpkı Google Play'den gelecek bir güncelleme gibi.`,
    },
  ],
  'vi': [
    {
      title: '0. Nói ngắn gọn',
      body: `Nội dung tin nhắn của bạn được mã hoá ngay trên thiết bị và chỉ những người bạn gửi tới mới đọc được. Chúng tôi không đọc được, và Google — bên cho chúng tôi thuê máy chủ — cũng vậy.

Thứ chúng tôi thấy được là đã có một cuộc trò chuyện: những tài khoản nào tham gia và họ hoạt động khi nào. Bỏ luôn phần đó khó hơn nhiều so với mã hoá nội dung, và chúng tôi chưa làm xong. Chính sách này nói rõ ranh giới hiện đang nằm ở đâu.`,
    },
    {
      title: '1. Những gì được mã hoá đầu cuối',
      body: `Được mã hoá trên thiết bị của bạn, chúng tôi và Google đều không đọc được:

• Nội dung tin nhắn của bạn.
• Nội dung các tệp, ảnh, âm thanh và video bạn đính kèm.
• Bản xem trước liên kết.
• Cuộc gọi thoại và video, dùng DTLS-SRTP bắt buộc của WebRTC giữa hai thiết bị.

Phần lớn tin nhắn một-một và nhóm còn dùng thêm cơ chế ratchet: mỗi tin nhắn có khoá riêng, nên thiết bị bị xâm nhập cũng không làm lộ những tin nhắn trước đó. Những cuộc trò chuyện mà máy của ai đó chưa công bố vật liệu khoá mới hơn sẽ quay về dùng một khoá dài hạn duy nhất, vốn không có tính chất đó. Nhãn dưới mỗi tin nhắn cho bạn biết nó thực sự đi theo đường nào.

Chỉ một thứ vượt qua ranh giới này, và chỉ khi bạn yêu cầu: tra một cái tên trên Wikipedia sẽ gửi đi cái tên đó, không phải tin nhắn chứa nó. Mục 6 nói ai nhận nó; yêu cầu xảy ra đúng lúc bạn chạm, không lúc nào khác, nên chẳng có gì để tắt. Tóm tắt, dịch và chép lại cũng sẽ vượt qua ranh giới ấy — trong bản này chúng đã tắt, và trong ứng dụng không có nút nào bật chúng lên.`,
    },
    {
      title: '2. Những gì không được mã hoá, và chúng tôi thấy gì',
      body: `Mã hoá bảo vệ nội dung, không bảo vệ việc một cuộc trò chuyện có tồn tại. Những thứ sau nằm ở dạng rõ trên máy chủ của chúng tôi:

• Ai ở trong mỗi cuộc trò chuyện, nó được tạo khi nào và hoạt động lần cuối khi nào.
• Dấu thời gian của từng tin nhắn và số tin bạn chưa đọc.
• Tên tệp, loại và kích thước của tệp đính kèm. Các byte thì được mã hoá; phần mô tả về chúng thì không, và độ dài bản mã cũng giới hạn độ dài bản gốc.
• Bạn bè và lời mời kết bạn của bạn.
• Tín hiệu cuộc gọi — rằng đã có một cuộc gọi, với ai và khi nào. Không phải âm thanh hay hình ảnh của nó.

Báo đang nhập và báo đã đọc đều tắt trừ khi bạn bật, và khi tắt thì không có gì được ghi lại.

Những gì không còn ở đây nữa: địa chỉ email và tên của bạn. Từ tháng 9 năm 2026, bản ghi tài khoản chỉ còn một mã định danh tài khoản — và từ đó tới nay không còn địa chỉ nào ở bất cứ đâu. Việc đăng ký không hỏi gì về bạn: tài khoản của bạn là một cụm từ khôi phục gồm 24 từ, và thông tin đăng nhập mà Firebase Authentication kiểm tra được suy ra từ nó. Thứ được lưu ở đó là một nhãn ngẫu nhiên dưới một tên miền không thể nhận thư.

Một điều riêng: vì ứng dụng chạy trên Google Firebase, Google thấy được địa chỉ IP và thời điểm của mọi kết nối mà thiết bị của bạn mở tới đó. Đó là đặc tính của hạ tầng lưu trữ, không phải của ứng dụng, và chúng tôi không thể mã hoá để nó biến mất.`,
    },
    {
      title: '3. Người khác tìm bạn bằng cách nào',
      body: `Họ không thể tìm kiếm bạn. Không có danh bạ — không tra theo email, số điện thoại hay tên — và máy chủ từ chối mọi truy vấn cố làm điều đó.

Bạn liên hệ với ai đó bằng cách gửi cho họ một liên kết mời qua kênh bên ngoài, dùng bất cứ thứ gì bạn vốn đã dùng. Liên kết chỉ dùng được một lần, hết hạn sau 24 giờ, và bạn có thể thu hồi. Bạn gọi ai đó là gì thì đó là nhãn riêng của bạn dành cho họ, và nó thuộc về bạn; nếu họ tự giới thiệu, cái tên ấy đã đến với bạn ở dạng mã hoá.`,
    },
    {
      title: '4. Chúng tôi thu thập gì',
      body: `• Dữ liệu tài khoản: một mã định danh tài khoản và một thông tin đăng nhập suy ra từ cụm từ khôi phục của bạn, giữ trong Firebase Authentication. Không địa chỉ email, không số điện thoại, không tên — khi đăng ký không hỏi bất kỳ thứ nào.
• Bản mã của tin nhắn và tệp đính kèm, cộng với siêu dữ liệu ở mục 2.

Danh sách chỉ có vậy. Không có phân tích sử dụng và không có báo cáo sự cố. Trước đây ứng dụng gửi lượt xem màn hình tới Firebase Analytics và báo cáo sự cố tới Firebase Crashlytics, cả hai đều mang định danh tài khoản của bạn nên không cái nào ẩn danh; cả hai đã bị gỡ bỏ, cùng với những thư viện gửi chúng. Lỗi chỉ được in ra trên máy của người phát triển trong lúc phát triển, và không đi đâu khác.`,
    },
    {
      title: '5. Dữ liệu được lưu ở đâu',
      body: `Trên Google Firebase — Firestore, Storage và Authentication — dưới các quy tắc bảo mật quyết định ai được đọc và ghi từng tài liệu.

Trên thiết bị của bạn, tin nhắn trong bộ nhớ đệm, các thiết lập và mã PIN khoá ứng dụng được mã hoá bằng một khoá riêng của thiết bị, giữ trong kho khoá của hệ điều hành (Keychain trên iOS, Keystore trên Android) chứ không phải trong bộ nhớ thông thường của ứng dụng.

Khoá riêng dùng để giải mã tin nhắn của bạn không bao giờ rời khỏi thiết bị, trừ khi ở dạng cụm từ khôi phục mà bạn tự chọn ghi lại. Chúng tôi không giữ nó và không thể khôi phục thay bạn. Mất nó thì những tin nhắn đã gửi tới thiết bị đó sẽ không bao giờ đọc được nữa — không ai đọc được, kể cả chúng tôi.`,
    },
    {
      title: '6. Còn ai nhận được dữ liệu',
      body: `Chúng tôi không bán, trao đổi hay cho thuê thông tin cá nhân của bạn. Dữ liệu đi tới:

• Google Firebase — nhà cung cấp hạ tầng của chúng tôi, như mô tả ở trên.
• Cloudflare Realtime — âm thanh và video của cuộc gọi, khi thiết bị của bạn và của người kia không thể kết nối trực tiếp với nhau.
• Wikimedia Foundation — một cái tên duy nhất, khi bạn chạm vào nó để tra trên Wikipedia.
• Google Cloud Speech-to-Text — phần âm thanh của một tin nhắn thoại, khi bạn yêu cầu chuyển thành văn bản.
• Google Cloud Translation — phần chữ của một tin nhắn, khi bạn yêu cầu dịch.
• Cloudflare Workers AI — tối đa 50 tin nhắn gần nhất của một cuộc trò chuyện, khi bạn yêu cầu tóm tắt hoặc đặt câu hỏi về nó.

Ba mục cuối đã tắt trong bản này. Trong ứng dụng không có nút nào bật chép lời, dịch hay tóm tắt lên, nên chẳng có gì đến được ba dịch vụ đó. Chúng được liệt kê thay vì xoá đi vì mã nguồn vẫn còn và các tính năng này dự kiến sẽ quay lại — và khi quay lại, chúng quay lại kèm phần công bố này và một lời hỏi trước lần dùng đầu tiên. Thứ sẽ được gửi khi đó là để tạo ra kết quả cho bạn, không phải để huấn luyện bất cứ thứ gì; cả bản chép lời lẫn bản dịch đều không được lưu trên máy chủ của chúng tôi.

Việc tra cứu này không có công tắc, vì không có gì thường trực để tắt: nó chạy đúng lúc bạn chạm và không lúc nào khác. Wikipedia nhận cái tên đó và địa chỉ IP của bạn, giống hệt như khi bạn tự gõ vào ô tìm kiếm của họ — không tài khoản, không tin nhắn, không cuộc trò chuyện. Thứ trả về được hiển thị chứ không lưu, và không có gì trong đó được ghi vào cuộc trò chuyện.

Cloudflare Realtime cũng không có công tắc. Hầu hết các cuộc gọi không cần đến nó: hai thiết bị có thể kết nối trực tiếp — hầu hết các cuộc gọi trong cùng mạng — kết nối mà không cần nó, và không có gì được chuyển tiếp. Khi không thể kết nối trực tiếp, thường là vì hai bạn đang ở các mạng di động khác nhau, cuộc gọi đã được mã hóa sẽ được chuyển tiếp thay vì không thể kết nối. Những gì Cloudflare thấy là địa chỉ IP của cả hai bên, thời gian cuộc gọi, và ước tính lượng dữ liệu đã truyền; âm thanh và video vẫn nằm dưới cùng lớp mã hóa DTLS-SRTP được mô tả ở mục 2, vì vậy việc chuyển tiếp không giải mã chúng.

Chúng tôi có thể tiết lộ những gì mình đang giữ nếu pháp luật yêu cầu. Những gì chúng tôi giữ chính là danh sách ở mục 2. Chúng tôi không thể đưa ra nội dung tin nhắn, vì chúng tôi không đọc được.`,
    },
    {
      title: '7. Thông báo đẩy',
      body: `Firebase Cloud Messaging chuyển thông báo. Mã thiết bị của bạn được lưu ở một phần riêng tư trong tài khoản mà chỉ bạn đọc được.

Thông báo không mang theo nội dung tin nhắn. Chính thiết bị của bạn giải mã tin nhắn tại chỗ và dựng nên thứ bạn nhìn thấy; Google chỉ chuyển cái phong bì, không phải thứ bên trong.`,
    },
    {
      title: '8. Bạn có thể làm gì',
      body: `• Xoá tài khoản ở màn hình Hồ sơ. Nội dung thuộc về cuộc trò chuyện của cả hai — chẳng hạn một bản ghi cuộc gọi — vẫn ở lại với người kia, vì đó cũng là bản ghi của họ.
• Xuất dữ liệu của bạn ở màn hình Hồ sơ.
• Đặt thời hạn tin nhắn theo từng cuộc trò chuyện: 1 giờ, 24 giờ, 7 ngày hoặc 30 ngày.
• Bật hoặc tắt báo đang nhập và báo đã đọc. Cả hai đều mặc định tắt.
• Khoá ứng dụng bằng mã PIN hoặc sinh trắc học.
• Thu hồi một liên kết mời mà bạn đã gửi đi.

Nếu bạn muốn chúng tôi xoá thứ gì đó thủ công, hãy viết cho chúng tôi.`,
    },
    {
      title: '9. Thời gian lưu giữ',
      body: `Chúng tôi giữ dữ liệu của bạn trong thời gian tài khoản còn tồn tại. Xoá tài khoản sẽ xoá dữ liệu, trừ phần nội dung chung nêu ở trên. Thời hạn theo từng cuộc trò chuyện sẽ xoá tin nhắn theo lịch bạn đặt.`,
    },
    {
      title: '10. Những giới hạn bạn nên biết',
      body: `Chúng tôi thà nói ra còn hơn để bạn tự phát hiện.

• Khoá được tin cậy ngay lần đầu nhìn thấy. Nếu ai đó tráo khoá trước khi hai bên kịp trao đổi một tin nhắn nào, cuộc trò chuyện sẽ được mã hoá cho nhầm người mà trông vẫn hoàn toàn bình thường. Ứng dụng có cảnh báo khi khoá thay đổi sau đó, và hiện một mã an toàn để hai bên đối chiếu qua kênh khác — nhưng không có gì bắt buộc bạn phải đối chiếu.
• Mỗi lần một máy. Cụm từ khôi phục của bạn khôi phục chiếc khoá mở lịch sử, nên đăng nhập trên máy mới không làm mất những gì bạn đã nhận. Các cuộc trò chuyện có bí mật chuyển tiếp dùng chiếc khoá thứ hai không bao giờ rời khỏi máy đã tạo ra nó: chúng đến máy đăng nhập gần nhất, còn những gì đã niêm phong cho máy kia trong lúc đó thì không chuyển sang được.
• Những tin nhắn gửi trước khi có mã hoá vẫn giữ nguyên như cũ. Không có gì được chuyển đổi hồi tố.
• Ứng dụng này chưa từng được kiểm định an ninh độc lập.`,
    },
    {
      title: '11. Trẻ em',
      body: `Chatterbox không dành cho trẻ dưới 13 tuổi, và chúng tôi không cố ý thu thập thông tin của các em. Nếu bạn cho rằng một trẻ em đã cung cấp thông tin cá nhân cho chúng tôi, hãy liên hệ và chúng tôi sẽ xoá.`,
    },
    {
      title: '12. Thay đổi',
      body: `Chúng tôi có thể cập nhật chính sách này. Những thay đổi đáng kể sẽ được thông báo trong ứng dụng, và ngày ở đầu trang là lần sửa gần nhất.`,
    },
    {
      title: '13. Liên hệ',
      body: `Thắc mắc về chính sách này: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Kiểm tra phiên bản ứng dụng mới hơn',
      body: `Google Play không phải là cách ứng dụng này đến được điện thoại Android của bạn. Nó được tải xuống từ chatterbox.fans, và một cửa hàng không tham gia vào quá trình này thì không thể kiểm tra cập nhật thay bạn — vì vậy ứng dụng này có thể tự làm điều đó, nếu bạn yêu cầu.

Chạm vào "Kiểm tra ngay" sẽ gửi một yêu cầu duy nhất đến chatterbox.fans để hỏi phiên bản hiện tại là gì. Yêu cầu đó mang theo địa chỉ IP của bạn và không gì khác — không tài khoản, không mã định danh thiết bị, không tin nhắn. Những gì trả về là một số phiên bản, được so sánh trên điện thoại của bạn với phiên bản bạn đang chạy; không có gì được tự động tải xuống, và không có gì về việc kiểm tra này được ghi vào cuộc trò chuyện.

Điều này không có công tắc vì không có gì để tắt: nó chỉ chạy khi được chạm vào và không chạy theo cách nào khác.

Nếu bạn cài đặt bản cập nhật, nó sẽ thay thế ứng dụng tại chỗ bằng cùng một khóa ký, giống như cách một bản cập nhật từ Google Play sẽ làm.`,
    },
  ],
  'ja': [
    {
      title: '0. ひとことで言うと',
      body: `あなたのメッセージ本文は端末上で暗号化され、送った相手だけが読めます。私たちには読めませんし、サーバーを借りている Google にも読めません。

私たちに見えるのは、会話があったという事実です。どのアカウントが参加していて、いつ活動していたか。これを取り除くのは中身を暗号化するより難しく、まだ終わっていません。このポリシーは、その線が今どこにあるのかを正確に述べます。`,
    },
    {
      title: '1. エンドツーエンドで暗号化されるもの',
      body: `端末上で暗号化され、私たちにも Google にも読めません:

• メッセージの本文。
• 添付したファイル・写真・音声・動画の中身。
• リンクプレビュー。
• 音声通話とビデオ通話。2 台の端末間で WebRTC が必須とする DTLS-SRTP を使います。

1 対 1 とグループのメッセージの多くは、さらにラチェットを使います。メッセージごとに鍵が違うため、端末が侵害されても過去のメッセージまでは読まれません。相手のクライアントが新しい鍵素材を公開していない会話では、単一の長期鍵に戻り、その性質はありません。メッセージの下の表示が、そのメッセージが実際にどちらを通ったかを教えます。

この線を越えるものはひとつだけで、それもあなたが求めたときに限ります。Wikipedia で名前を調べるときに送るのはその名前ひとつで、元のメッセージではありません。誰が受け取るかは第 6 節に書いてあります。この通信はあなたが押したそのときにだけ起き、それ以外では起きないので、止めるべきものもありません。要約・翻訳・文字起こしも同じくこの線を越えるものですが、本リリースでは無効で、アプリのどこにもそれを有効にする操作はありません。`,
    },
    {
      title: '2. 暗号化されないもの、私たちに見えるもの',
      body: `暗号化が守るのは中身であって、会話があったという事実ではありません。次のものは私たちのサーバー上に平文で置かれます:

• それぞれの会話に誰がいるか、いつ作られ、最後にいつ動いたか。
• すべてのメッセージのタイムスタンプと、未読の件数。
• 添付ファイルの名前・種類・サイズ。バイト列は暗号化されますが、その説明は暗号化されず、暗号文の長さは元の長さの上限を示します。
• あなたの友だちと友だちリクエスト。
• 通話のシグナリング。通話があったこと、相手、時刻。音声や映像は含みません。

入力中の表示と既読は、あなたがオンにしない限りオフで、オフの間は何も記録されません。

もうここにないもの: あなたのメールアドレスと名前です。2026 年 9 月以降、アカウントの記録にはアカウント識別子しかなく、それ以降はどこにも保管すべきアドレスがありません。登録時にあなたについて尋ねることは何もありません。アカウントとは 24 語の復元フレーズであり、Firebase Authentication が確認する資格情報はそこから導出されます。そこに保管されるのは、メールを受け取れないドメインの下のランダムなラベルだけです。

別の話として: このアプリは Google Firebase 上で動くため、あなたの端末がそこへ行う接続の IP アドレスと時刻を Google は見られます。これはホスティングの性質であってアプリの性質ではなく、暗号化で消すことはできません。`,
    },
    {
      title: '3. 相手があなたを見つける方法',
      body: `検索することはできません。ディレクトリはなく、メールアドレス・電話番号・名前のいずれでも探せませんし、サーバーはそれを試みる問い合わせをすべて拒否します。

誰かに連絡を取るには、招待リンクをアプリの外から、あなたが普段使っている手段で送ります。リンクは 1 回だけ有効で、24 時間で期限切れになり、取り消せます。相手をどう呼ぶかはあなた自身が付けた呼び名で、あなたのものです。相手が自己紹介した場合、その名前は暗号化されてあなたに届いています。`,
    },
    {
      title: '4. 収集するもの',
      body: `• アカウント情報：アカウント識別子と、あなたの復元フレーズから導出された資格情報。Firebase Authentication に保管されます。メールアドレスも電話番号も名前もありません——登録時にどれも尋ねません。
• メッセージと添付ファイルの暗号文、および第 2 節のメタデータ。

以上がすべてです。利用状況の分析もクラッシュレポートもありません。以前は画面表示を Firebase Analytics に、クラッシュを Firebase Crashlytics に送っており、いずれもアカウント識別子を伴っていたため匿名ではありませんでした。どちらも、送信していたライブラリごと削除しました。エラーは開発中に開発者自身のマシンに出力されるだけで、ほかのどこにも行きません。`,
    },
    {
      title: '5. 保管場所',
      body: `Google Firebase 上（Firestore、Storage、Authentication）で、どの文書を誰が読み書きできるかを決めるセキュリティルールのもとに置かれます。

あなたの端末では、キャッシュされたメッセージ・設定・アプリロックの PIN が、端末ごとの鍵で暗号化されます。その鍵は通常のアプリ領域ではなく、プラットフォームの鍵保管庫（iOS の Keychain、Android の Keystore）にあります。

メッセージを復号する秘密鍵が端末を離れることはありません。例外は、あなた自身が書き留めることを選んだリカバリーフレーズだけです。私たちはそれを保持しておらず、代わりに復元することもできません。失えば、その端末宛てに送られたメッセージは二度と読めません。私たちを含め、誰にも読めません。`,
    },
    {
      title: '6. ほかに情報を受け取る先',
      body: `あなたの個人情報を販売・交換・貸与することはありません。情報が届く先は:

• Google Firebase — 上記のとおり、当社のホスティング事業者。
• Cloudflare Realtime——あなたの端末と相手の端末が直接接続できない場合に、通話の音声と映像を中継します。
• ウィキメディア財団 — 名前をタップして Wikipedia で調べたとき、その名前ひとつ。
• Google Cloud Speech-to-Text — 文字起こしを求めたとき、そのボイスメッセージ 1 件の音声。
• Google Cloud Translation — 翻訳を求めたとき、そのメッセージ 1 件の本文。
• Cloudflare Workers AI — 要約や会話への質問を求めたとき、その会話の直近 50 件までのメッセージ。

後ろの 3 つは、本リリースでは無効です。文字起こし・翻訳・要約を有効にする操作はアプリのどこにもないので、この 3 つのサービスには何も届きません。削除せずに残してあるのは、コードがまだあり、これらの機能を戻す予定だからです。戻すときは、この開示と初回前の確認をともなって戻します。そのとき送られるものは、あなたの結果を作るためであって、何かを学習させるためではありません。文字起こしも翻訳も当社のサーバーには保存しません。

この検索にスイッチはありません。切るべき常駐のものが何もないからです。タップしたその一回だけ動き、それ以外では動きません。Wikipedia が受け取るのはその名前とあなたの IP アドレスだけで、検索窓に自分で入力した場合と同じです。アカウントもメッセージも会話も送りません。返ってきたものは表示するだけで保存せず、会話にも何も書き込みません。

Cloudflare Realtimeにもオン・オフの切り替えはありません。ほとんどの通話ではこれは不要です。直接接続できる2台の端末——同じネットワーク上のほとんどの通話——はこれを使わずに接続され、何も中継されません。直接接続できない場合（多くは双方が異なるモバイルネットワークにいるとき）、すでに暗号化されている通話は、接続できないままにするのではなく中継されます。Cloudflareが見るのは両者のIPアドレス、通話の時刻、およそのデータ量であり、音声と映像は第2節で説明したものと同じDTLS-SRTP暗号化のままなので、中継によって復号されることはありません。

法律が要求する場合、保持しているものを開示することがあります。保持しているものは第 2 節の一覧です。メッセージの中身は提出できません。読めないからです。`,
    },
    {
      title: '7. プッシュ通知',
      body: `通知は Firebase Cloud Messaging が配信します。端末トークンは、あなただけが読めるアカウントの非公開領域に保管されます。

通知にメッセージ本文は含まれません。端末が手元でメッセージを復号し、表示内容を組み立てます。Google が運ぶのは封筒であって、中身ではありません。`,
    },
    {
      title: '8. あなたにできること',
      body: `• プロフィール画面からアカウントを削除する。通話記録など、会話の共同の一部である内容は相手側に残ります。それは相手の記録でもあるからです。
• プロフィール画面からデータを書き出す。
• チャットごとにメッセージの有効期限を設定する: 1 時間、24 時間、7 日、30 日。
• 入力中の表示と既読をオンまたはオフにする。どちらも初期状態はオフです。
• PIN または生体認証でアプリをロックする。
• 配った招待リンクを取り消す。

手作業での削除をご希望であれば、ご連絡ください。`,
    },
    {
      title: '9. 保存期間',
      body: `アカウントが存在する間、データを保持します。アカウントを削除すればデータも削除されますが、上記の共同保有の内容は除きます。チャットごとの有効期限は、あなたが設定した期間でメッセージを削除します。`,
    },
    {
      title: '10. 知っておくべき限界',
      body: `ご自身で気づくより、こちらからお伝えしたいことです。

• 鍵は最初に見たときに信頼されます。もし誰かが、あなたたちが一度もメッセージを交わす前に鍵をすり替えていたら、その会話は別人宛てに暗号化され、しかも見た目はまったく普通です。その後に鍵が変わった場合はアプリが警告し、別経路で照合できる安全番号も表示しますが、照合を強制する仕組みはありません。
• 同時に使えるのは 1 台だけです。復元フレーズは履歴を開く鍵を復元するので、新しい端末でサインインしても受け取り済みの内容は失われません。前方秘匿性のある会話は、それを作った端末から決して出ない 2 つ目の鍵を使います。届くのは最後にサインインした端末で、その間にもう一方へ封じられたものは移せません。
• 暗号化が存在する前に送られたメッセージはそのままです。遡って変換したものはありません。
• このアプリは第三者による独立したセキュリティ監査を受けたことがありません。`,
    },
    {
      title: '11. 子どもについて',
      body: `Chatterbox は 13 歳未満のお子さま向けではなく、その情報を意図的に収集することはありません。お子さまが個人情報を提供したと思われる場合はご連絡ください。削除します。`,
    },
    {
      title: '12. 変更について',
      body: `このポリシーは更新することがあります。重要な変更はアプリ内でお知らせし、上部の日付が最後に変更した日です。`,
    },
    {
      title: '13. お問い合わせ',
      body: `このポリシーに関するお問い合わせ: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. 新しいバージョンの確認',
      body: `Google Playは、このアプリがあなたのAndroid端末に届く経路ではありません。代わりにchatterbox.fansからダウンロードされます。輪の外にあるストアはあなたに代わって更新を確認することができないため、このアプリ自身が、あなたが求めたときに確認できるようになっています。

「今すぐ確認」をタップすると、現在のバージョンを尋ねる1回だけのリクエストがchatterbox.fansに送られます。このリクエストにはあなたのIPアドレスだけが含まれ、それ以外は何も含まれません——アカウントも、端末識別子も、メッセージも含まれません。返ってくるのはバージョン番号だけで、あなたの端末上で実行中のバージョンと比較されます。何も自動でダウンロードされることはなく、この確認について会話に書き込まれることもありません。

これにはスイッチがありません。オフにするべきものが何もないからです。タップしたときにだけ実行され、それ以外では実行されません。

アップデートをインストールすると、Google Playからの更新と同じように、同じ署名鍵を使ってその場でアプリが置き換えられます。`,
    },
  ],
  'ko': [
    {
      title: '0. 요약',
      body: `메시지 본문은 당신의 기기에서 암호화되며, 당신이 보낸 사람만 읽을 수 있습니다. 우리도 읽을 수 없고, 서버를 빌려 쓰는 Google도 읽을 수 없습니다.

우리가 볼 수 있는 것은 대화가 있었다는 사실입니다. 어떤 계정이 참여했고 언제 활동했는지입니다. 그것까지 없애는 일은 내용을 암호화하는 것보다 어렵고, 아직 끝내지 못했습니다. 이 방침은 그 경계가 지금 어디에 있는지를 정확히 말합니다.`,
    },
    {
      title: '1. 종단 간 암호화되는 것',
      body: `당신의 기기에서 암호화되어 우리도 Google도 읽을 수 없습니다:

• 메시지 본문.
• 첨부한 파일, 사진, 오디오, 동영상의 내용.
• 링크 미리보기.
• 음성·영상 통화. 두 기기 사이에서 WebRTC가 의무화한 DTLS-SRTP를 사용합니다.

대부분의 1:1 및 그룹 메시지는 여기에 더해 래칫을 씁니다. 메시지마다 키가 달라서, 기기가 뚫려도 이전 메시지까지 드러나지는 않습니다. 상대의 클라이언트가 새 키 자료를 게시하지 않은 대화는 단일 장기 키로 되돌아가며, 그 키에는 이 성질이 없습니다. 메시지 아래 표시가 그 메시지가 실제로 어느 쪽을 거쳤는지 알려 줍니다.

이 선을 넘는 것은 하나뿐이며, 그것도 당신이 요청할 때만 일어납니다. 위키백과에서 이름을 찾아볼 때 보내는 것은 그 이름 하나이고, 그것이 들어 있던 메시지가 아닙니다. 누가 받는지는 6절에 있습니다. 이 요청은 누른 그 순간에만 일어나고 그 외에는 일어나지 않으므로 끌 것도 없습니다. 요약·번역·전사도 이 선을 넘는 일이지만, 이번 릴리스에서는 꺼져 있고 앱 어디에도 그것을 켜는 설정이 없습니다.`,
    },
    {
      title: '2. 암호화되지 않는 것과 우리가 볼 수 있는 것',
      body: `암호화는 내용을 보호하지, 대화가 있었다는 사실을 보호하지 않습니다. 다음은 우리 서버에 평문으로 남습니다:

• 각 대화에 누가 있는지, 언제 만들어졌고 마지막으로 언제 활동했는지.
• 모든 메시지의 시각과 읽지 않은 개수.
• 첨부의 파일 이름, 형식, 크기. 바이트는 암호화되지만 그에 대한 설명은 그렇지 않으며, 암호문의 길이가 원본 길이의 한계를 드러냅니다.
• 당신의 친구와 친구 요청.
• 통화 시그널링 — 통화가 있었다는 것, 상대, 시각. 음성이나 영상은 아닙니다.

입력 중 표시와 읽음 표시는 켜기 전까지 꺼져 있고, 꺼져 있는 동안에는 아무것도 기록되지 않습니다.

더 이상 여기에 없는 것: 당신의 이메일 주소와 이름입니다. 2026년 9월부터 계정 기록에는 계정 식별자만 남으며, 그때부터는 어디에도 보관할 주소 자체가 없습니다. 가입할 때 당신에 관해 묻는 것은 없습니다. 계정은 24단어 복구 문구이고, Firebase Authentication이 확인하는 자격 증명은 거기서 파생됩니다. 그곳에 저장되는 것은 메일을 받을 수 없는 도메인 아래의 무작위 라벨뿐입니다.

별개로: 이 앱은 Google Firebase 위에서 돌아가므로, 당신의 기기가 그쪽으로 여는 모든 연결의 IP 주소와 시각을 Google이 볼 수 있습니다. 이는 호스팅의 성질이지 앱의 성질이 아니며, 암호화로 없앨 수 없습니다.`,
    },
    {
      title: '3. 다른 사람이 당신을 찾는 방법',
      body: `검색할 수 없습니다. 디렉터리가 없고 — 이메일, 전화번호, 이름 어느 것으로도 찾을 수 없으며 — 서버는 그런 조회를 모두 거부합니다.

누군가에게 닿으려면 앱 밖에서, 당신이 이미 쓰는 어떤 수단으로든 초대 링크를 보냅니다. 링크는 한 번만 동작하고 24시간 뒤 만료되며, 철회할 수 있습니다. 상대를 뭐라고 부르는지는 당신이 붙인 이름표이고 당신 것입니다. 상대가 자기를 소개했다면, 그 이름은 암호화된 채로 당신에게 왔습니다.`,
    },
    {
      title: '4. 우리가 수집하는 것',
      body: `• 계정 데이터: 계정 식별자와 복구 문구에서 파생된 자격 증명. Firebase Authentication에 보관됩니다. 이메일 주소도, 전화번호도, 이름도 없습니다 — 가입 때 어느 것도 묻지 않습니다.
• 메시지와 첨부 파일의 암호문, 그리고 2절의 메타데이터.

목록은 이것이 전부입니다. 사용 분석도 없고 오류 보고도 없습니다. 예전에는 화면 조회를 Firebase Analytics로, 오류를 Firebase Crashlytics로 보냈고 둘 다 계정 식별자를 달고 있어 익명이 아니었습니다. 둘 다, 그것을 보내던 라이브러리와 함께 제거했습니다. 오류는 개발 중에 개발자 자신의 기기에 출력될 뿐 다른 어디로도 가지 않습니다.`,
    },
    {
      title: '5. 어디에 저장되는가',
      body: `Google Firebase — Firestore, Storage, Authentication — 에 저장되며, 각 문서를 누가 읽고 쓸 수 있는지는 보안 규칙이 정합니다.

당신의 기기에서는 캐시된 메시지, 설정, 앱 잠금 PIN이 기기별 키로 암호화됩니다. 그 키는 일반 앱 저장소가 아니라 플랫폼 키 저장소(iOS Keychain, Android Keystore)에 있습니다.

메시지를 복호화하는 개인 키는 기기를 떠나지 않습니다. 예외는 당신이 적어 두기로 한 복구 문구뿐입니다. 우리는 그것을 갖고 있지 않고 대신 복구해 줄 수도 없습니다. 잃어버리면 그 기기로 보낸 메시지는 다시는 읽을 수 없습니다 — 우리를 포함해 누구도 읽을 수 없습니다.`,
    },
    {
      title: '6. 그 밖에 데이터를 받는 곳',
      body: `우리는 당신의 개인정보를 팔거나 교환하거나 대여하지 않습니다. 데이터가 가는 곳은:

• Google Firebase — 위에서 설명한 우리의 호스팅 제공자.
• Cloudflare Realtime——당신의 기기와 상대방의 기기가 직접 연결될 수 없을 때 통화의 음성과 영상을 중계합니다.
• 위키미디어 재단 — 이름을 눌러 위키백과에서 찾아볼 때, 그 이름 하나.
• Google Cloud Speech-to-Text — 전사를 요청할 때, 음성 메시지 하나의 오디오.
• Google Cloud Translation — 번역을 요청할 때, 메시지 하나의 텍스트.
• Cloudflare Workers AI — 요약을 요청하거나 대화에 대해 질문할 때, 그 대화의 최근 50개까지의 메시지.

뒤의 셋은 이번 릴리스에서 꺼져 있습니다. 전사·번역·요약을 켜는 설정이 앱 어디에도 없으므로 그 세 서비스에는 아무것도 도달하지 않습니다. 지우지 않고 남겨 둔 것은 코드가 아직 있고 이 기능들을 되돌릴 계획이기 때문입니다. 되돌릴 때는 이 고지와 첫 사용 전 확인을 함께 되돌립니다. 그때 보내지는 것은 당신의 결과를 만들기 위한 것이지 무언가를 학습시키기 위한 것이 아니며, 전사도 번역도 저희 서버에 저장되지 않습니다.

이 찾아보기에는 스위치가 없습니다. 꺼야 할 상시 동작이 없기 때문입니다. 누른 그 순간에만 실행되고 그 외에는 실행되지 않습니다. 위키백과가 받는 것은 그 이름과 당신의 IP 주소뿐이며, 검색창에 직접 입력한 것과 같습니다. 계정도, 메시지도, 대화도 함께 가지 않습니다. 돌아온 내용은 보여줄 뿐 저장하지 않고, 대화에도 아무것도 기록하지 않습니다.

Cloudflare Realtime에도 스위치가 없습니다. 대부분의 통화는 이것이 필요하지 않습니다. 직접 연결할 수 있는 두 기기—같은 네트워크에서의 대부분의 통화—는 이것 없이 연결되며, 아무것도 중계되지 않습니다. 직접 연결할 수 없을 때—흔히 서로 다른 모바일 네트워크에 있을 때—이미 암호화된 통화가 연결 불가 상태로 남는 대신 중계됩니다. Cloudflare가 보는 것은 양쪽의 IP 주소, 통화 시각, 대략적인 데이터 이동량이며, 음성과 영상은 2절에서 설명한 것과 동일한 DTLS-SRTP 암호화 상태를 유지하므로 중계한다고 해서 복호화되지 않습니다.

법이 요구하면 우리가 가진 것을 공개할 수 있습니다. 우리가 가진 것은 2절의 목록입니다. 메시지 내용은 내놓을 수 없습니다. 읽을 수 없기 때문입니다.`,
    },
    {
      title: '7. 푸시 알림',
      body: `알림은 Firebase Cloud Messaging이 전달합니다. 기기 토큰은 당신만 읽을 수 있는 계정의 비공개 영역에 저장됩니다.

알림에는 메시지 본문이 담기지 않습니다. 당신의 기기가 메시지를 그 자리에서 복호화해 보이는 내용을 구성합니다. Google이 나르는 것은 봉투이지 내용물이 아닙니다.`,
    },
    {
      title: '8. 당신이 할 수 있는 것',
      body: `• 프로필 화면에서 계정을 삭제합니다. 통화 기록처럼 대화에 공동으로 속한 내용은 상대에게 남습니다. 그것은 그 사람의 기록이기도 하기 때문입니다.
• 프로필 화면에서 데이터를 내보냅니다.
• 대화별로 메시지 만료를 설정합니다: 1시간, 24시간, 7일, 30일.
• 입력 중 표시와 읽음 표시를 켜거나 끕니다. 둘 다 기본값은 꺼짐입니다.
• PIN이나 생체 인식으로 앱을 잠급니다.
• 이미 건넨 초대 링크를 철회합니다.

직접 손으로 지워 주기를 원하면 연락해 주세요.`,
    },
    {
      title: '9. 보관',
      body: `계정이 존재하는 동안 데이터를 보관합니다. 계정을 삭제하면 데이터도 삭제되지만, 위에서 말한 공동 보유 내용은 제외됩니다. 대화별 만료는 당신이 정한 일정에 따라 메시지를 지웁니다.`,
    },
    {
      title: '10. 알아 두어야 할 한계',
      body: `직접 알아차리게 두기보다 먼저 말씀드립니다.

• 키는 처음 볼 때 신뢰됩니다. 누군가 두 사람이 메시지를 한 번도 주고받기 전에 키를 바꿔치기했다면, 그 대화는 엉뚱한 사람에게 암호화되면서도 완전히 정상으로 보입니다. 그 뒤에 키가 바뀌면 앱이 경고하고, 다른 경로로 대조할 수 있는 안전 번호를 보여 줍니다 — 그러나 대조를 강제하는 장치는 없습니다.
• 한 번에 한 기기만. 복구 문구는 기록을 여는 열쇠를 되살리므로, 새 기기에서 로그인해도 이미 받은 내용은 잃지 않습니다. 순방향 비밀성이 적용된 대화는 그것을 만든 기기를 결코 벗어나지 않는 두 번째 열쇠를 씁니다. 이런 메시지는 마지막으로 로그인한 기기에 도착하며, 그 사이 다른 기기로 봉인된 것은 옮길 수 없습니다.
• 암호화가 생기기 전에 보낸 메시지는 그대로입니다. 소급해서 변환한 것은 없습니다.
• 이 앱은 독립적인 보안 감사를 받은 적이 없습니다.`,
    },
    {
      title: '11. 아동',
      body: `Chatterbox는 13세 미만 아동을 위한 앱이 아니며, 그들의 정보를 알면서 수집하지 않습니다. 아동이 개인정보를 제공했다고 생각되면 연락해 주세요. 삭제하겠습니다.`,
    },
    {
      title: '12. 변경',
      body: `이 방침은 갱신될 수 있습니다. 중요한 변경은 앱에서 알리며, 위의 날짜가 마지막으로 바뀐 시점입니다.`,
    },
    {
      title: '13. 문의',
      body: `이 방침에 대한 문의: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. 새 버전 확인하기',
      body: `Google Play는 이 앱이 안드로이드 휴대전화에 도달하는 방법이 아닙니다. 대신 chatterbox.fans에서 다운로드되며, 그 과정에 참여하지 않는 스토어는 사용자를 대신해 업데이트를 확인할 수 없습니다 — 그래서 요청하면 이 앱이 직접 확인할 수 있습니다.

"지금 확인"을 탭하면 현재 버전이 무엇인지 묻는 요청 하나가 chatterbox.fans로 전송됩니다. 이 요청에는 IP 주소만 포함되며 그 외에는 아무것도 포함되지 않습니다 — 계정도, 기기 식별자도, 메시지도 없습니다. 돌아오는 것은 버전 번호이며, 휴대전화에서 현재 실행 중인 버전과 비교됩니다. 아무것도 자동으로 다운로드되지 않으며, 이 확인에 대한 어떤 것도 대화에 기록되지 않습니다.

이 기능에는 스위치가 없습니다. 끌 것이 아무것도 없기 때문입니다: 탭했을 때만 실행되며 그 외에는 실행되지 않습니다.

업데이트를 설치하면 Google Play의 업데이트와 마찬가지로 동일한 서명 키를 사용하여 앱이 제자리에서 교체됩니다.`,
    },
  ],
  'zh-Hant': [
    {
      title: '0. 一句話',
      body: `你發出的訊息正文在你的裝置上被加密，只有收訊人能讀。我們讀不了，租給我們伺服器的 Google 也讀不了。

我們能看到的是：一場對話發生過——裡面有哪些帳號，什麼時候活躍。把這部分也去掉比加密內容難得多，我們還沒做完。這份政策會說清楚，界線目前劃在哪裡。`,
    },
    {
      title: '1. 哪些內容是端對端加密的',
      body: `在你的裝置上加密，我們和 Google 都讀不了：

• 你的訊息正文。
• 你傳送的檔案、照片、音訊、影片的內容。
• 連結預覽。
• 語音和視訊通話，兩台裝置之間使用 WebRTC 強制的 DTLS-SRTP。

大多數一對一和群組訊息還額外使用了棘輪（ratchet）：每則訊息有自己的金鑰，所以即使你的裝置被攻破，也讀不出更早的訊息。如果對方的用戶端還沒有發布較新的金鑰材料，這個對話會回落到一把長期金鑰，那種情況下沒有上面這個性質。訊息下方的標記會告訴你這一則實際走的是哪一種。

只有一件事會越過這條線，而且只在你主動要求時：在維基百科查一個名字，送出去的是那一個名字，而不是它所在的訊息。送給誰寫在第 6 節；查詢只在你點的那一下發生，除此之外不發生，所以沒有什麼需要關掉。摘要、翻譯和轉寫同樣會越過這條線——它們在本次發行中是關閉的，應用程式裡沒有任何開關可以打開它們。`,
    },
    {
      title: '2. 哪些沒有加密，以及我們能看到什麼',
      body: `加密保護的是內容，不是「有過一場對話」這件事本身。下面這些在我們的伺服器上是明文：

• 每場對話裡有誰，以及它何時建立、何時最後活躍。
• 每則訊息的時間戳記，以及你有多少則沒讀。
• 附件的檔名、類型和大小。位元組是加密的，對它的描述不是；密文的長度也框定了原文的長度。
• 你的好友和好友邀請。
• 通話信令——有過一次通話、打給誰、什麼時候。不包括音訊和視訊內容。

「輸入中」和已讀回條預設關閉，除非你自己開啟；關閉期間不會寫入任何東西。

已經不在這裡的：你的電子郵件地址和你的名字。自 2026 年 9 月起，帳號記錄裡只剩一個帳號識別碼——而且從那時起，任何地方都不再有電子郵件可留。註冊不會問你任何關於你的事：你的帳號就是 24 個助記詞，Firebase Authentication 驗證的憑證由它推導而來；它保存的只是一個隨機標籤，網域根本收不到郵件。

另外要單獨說一句：因為這個應用程式跑在 Google Firebase 上，Google 能看到你的裝置每一次連線的 IP 位址和時間。這是託管方式帶來的，不是應用程式本身的問題，我們沒法用加密把它消掉。`,
    },
    {
      title: '3. 別人怎麼找到你',
      body: `他們搜不到你。這裡沒有目錄——不能按電子郵件、電話號碼或名字查找——伺服器會拒絕任何這樣的查詢。

你要聯絡一個人，是透過其他管道把一條邀請連結傳給他，用你本來就在用的任何方式都行。一條連結只能用一次，24 小時後過期，你隨時可以撤銷。你怎麼稱呼一個人，是你自己給他的標籤，只留給你；如果對方做過自我介紹，那個名字是加密送到你這裡的。`,
    },
    {
      title: '4. 我們收集什麼',
      body: `• 帳號資料：一個帳號識別碼，以及從你的助記詞推導出的憑證，保存在 Firebase Authentication 裡。沒有電子郵件地址，沒有電話號碼，沒有名字——註冊時一樣都不問。
• 訊息和附件的密文，以及第 2 節裡的中繼資料。

這就是全部。沒有分析統計，也沒有當機回報。這個應用程式過去會把畫面瀏覽送給 Firebase Analytics、把當機報告送給 Firebase Crashlytics，兩者都帶著你的帳號識別碼，所以都不是匿名的；現在它們都被刪掉了，連同送出它們的那兩個函式庫。錯誤只在開發階段印在開發者自己的機器上，不去任何別的地方。`,
    },
    {
      title: '5. 資料存在哪裡',
      body: `存在 Google Firebase 上——Firestore、Storage 和 Authentication——由安全規則決定誰可以讀寫每一份文件。

在你的裝置上，快取的訊息、設定和應用程式鎖 PIN 用一把「每台裝置一把」的金鑰加密，這把金鑰保存在系統金鑰庫裡（iOS 的 Keychain、Android 的 Keystore），不是放在普通的應用程式儲存空間裡。

解密你訊息的私鑰永遠不會離開你的裝置，除非以助記詞的形式、由你自己選擇抄下來。我們不持有它，也無法替你復原。一旦遺失，傳給那台裝置的訊息就再也讀不出來了——任何人都讀不出來，包括我們。`,
    },
    {
      title: '6. 還有誰會拿到資料',
      body: `我們不出售、不交易、不出租你的個人資訊。資料會到達：

• Google Firebase——我們的託管服務商，如上所述。
• Cloudflare Realtime——當你的裝置和對方的裝置無法直接互聯時，用於中繼通話的音訊和視訊。
• 維基媒體基金會——當你點擊某個名字去維基百科查它時，那一個名字。
• Google Cloud Speech-to-Text——當你要求轉寫時，一則語音訊息的音訊。
• Google Cloud Translation——當你要求翻譯時，一則訊息的文字。
• Cloudflare Workers AI——當你要求摘要或就一段對話提問時，該對話最近至多 50 則訊息。

後三者在本次發行中是關閉的。應用程式裡沒有任何開關可以打開轉寫、翻譯或摘要，所以沒有任何內容會到達這三個服務。之所以列出而不是刪掉，是因為程式碼還在、這些功能還打算回來——它們回來的時候，會連同這段揭露和首次使用前的詢問一起回來。到那時送出去的東西，是為了產出你要的結果，不用於訓練任何模型；轉寫和翻譯都不會留在我們的伺服器上。

維基百科查詢沒有開關，因為沒有什麼常駐的東西可關：它只在你點的那一下運作，此外不運作。維基百科收到的是那一個名字和你的 IP 位址，跟你自己在它的搜尋框裡輸入一樣——沒有帳號，沒有訊息，沒有對話。回傳的內容只是顯示出來，不保存，也不會寫進對話裡。

Cloudflare Realtime 同樣沒有開關。大多數通話不需要它：兩台能夠直接互聯的裝置——同一網路下的大多數通話——不經過它就能連上，不會被中繼。當無法直連時——常見於雙方處於不同的行動網路——已經加密的通話會被中繼，而不是直接連不上。Cloudflare 能看到的是雙方的 IP 位址、通話的時間，以及大致的資料量；音訊和視訊內容仍然受第2節所述的同一套 DTLS-SRTP 加密保護，中繼並不會解密它們。

如果法律要求，我們可能揭露我們持有的內容。我們持有的就是第 2 節那份清單。我們拿不出訊息內容，因為我們讀不了。`,
    },
    {
      title: '7. 推播通知',
      body: `通知由 Firebase Cloud Messaging 送達。你的裝置權杖存放在帳號中一塊只有你能讀的私有區域裡。

通知裡不帶訊息正文。是你的裝置在本機解密訊息、組裝出你看到的那句話；Google 送的是信封，不是裡面的內容。`,
    },
    {
      title: '8. 你可以做什麼',
      body: `• 在「我的」頁面刪除帳號。屬於一場對話共同部分的內容——例如一筆通話記錄——會留給另一位參與者，因為那也是他的記錄。
• 在「我的」頁面匯出你的資料。
• 按對話設定訊息過期：1 小時、24 小時、7 天或 30 天。
• 開啟或關閉「輸入中」和已讀回條。兩者預設都是關閉的。
• 用 PIN 或生物辨識鎖定應用程式。
• 撤銷一條你已經發出去的邀請連結。

如果你希望我們手動刪除某些東西，寫信給我們。`,
    },
    {
      title: '9. 保留期限',
      body: `你的帳號存在期間，我們保留你的資料。刪除帳號就會刪除這些資料，上面提到的共同持有的內容除外。按對話設定的過期時間會按你定的節奏刪除訊息。`,
    },
    {
      title: '10. 你應該知道的限制',
      body: `這些我們寧可主動告訴你，也不願你自己發現。

• 公鑰在第一次見到時就被信任。如果有人在你們交換第一則訊息之前就替換了公鑰，這場對話會被加密給錯誤的人，而且看起來完全正常。之後公鑰再變化時應用程式會警告你，也會顯示一個可以線下核對的安全碼——但沒有任何機制強制你去核對。
• 同一時間只能用一台裝置。你的助記詞能還原開啟歷史訊息的金鑰，所以在新裝置上登入不會失去你已經收到的內容。但前向保密的對話用的是第二把金鑰，它從不離開產生它的那台裝置：最後登入的那台才是這類訊息送達的地方，期間封給另一台的內容無法搬過去。
• 加密功能出現之前傳的訊息保持原樣，沒有做過追溯轉換。
• 這個應用程式沒有經過獨立的第三方安全稽核。`,
    },
    {
      title: '11. 兒童',
      body: `Chatterbox 不面向 13 歲以下兒童，我們也不會在知情的情況下收集他們的資訊。如果你認為有兒童向我們提供了個人資訊，請聯絡我們，我們會刪除。`,
    },
    {
      title: '12. 變更',
      body: `我們可能會更新這份政策。重大變更會在應用程式內公告，頂部的日期就是它最後一次修改的時間。`,
    },
    {
      title: '13. 聯絡我們',
      body: `關於這份政策的問題，請聯絡：${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. 檢查較新的應用程式版本',
      body: `Google Play 並不是這個應用程式到達你 Android 手機的途徑,它是從 chatterbox.fans 下載的——而一個不在循環中的商店沒辦法替你檢查更新,所以只要你要求,這個應用程式可以自己檢查。

點一下「立即檢查」會向 chatterbox.fans 發送一次請求,詢問目前的版本。這次請求只帶有你的 IP 位址,沒有其他東西——沒有帳號、沒有裝置識別碼、沒有訊息。回傳的是一個版本號,會在你的手機上與目前執行的版本比對;不會自動下載任何東西,這次檢查的任何內容也不會寫入對話中。

這個功能沒有開關,因為沒有什麼可以關閉的:它只在你點按時執行,除此之外不會執行。

如果你安裝更新,它會使用相同的簽署金鑰原地取代應用程式,就跟 Google Play 推送的更新一樣。`,
    },
  ],
  'ar': [
    {
      title: '0. باختصار',
      body: `نص رسائلك يُعمّى على جهازك، ولا يقرؤه إلا من ترسلها إليهم. نحن لا نستطيع قراءته، ولا تستطيع Google التي نستأجر خوادمها.

ما نراه هو أن محادثة قد جرت: أي الحسابات فيها، ومتى كانت نشطة. إزالة ذلك أصعب من تعمية المحتوى، ولم ننتهِ بعد. هذه السياسة تقول بالضبط أين يقع الحدّ حاليًا.`,
    },
    {
      title: '1. ما هو مُعمّى من طرف إلى طرف',
      body: `مُعمّى على جهازك، وغير مقروء لنا ولا لـ Google:

• نص رسائلك.
• محتوى الملفات والصور والمقاطع الصوتية والمرئية التي ترفقها.
• معاينات الروابط.
• المكالمات الصوتية والمرئية، وهي تستخدم بين الجهازين بروتوكول DTLS-SRTP الإلزامي في WebRTC.

معظم الرسائل الثنائية والجماعية تستخدم إضافةً إلى ذلك آلية سقّاطة: لكل رسالة مفتاحها الخاص، فاختراق جهازك لا يكشف الرسائل الأسبق. أما المحادثات التي لم ينشر فيها تطبيق أحدهم مادة المفاتيح الأحدث فترتدّ إلى مفتاح واحد طويل الأمد لا يتمتع بهذه الخاصية. العلامة أسفل الرسالة تخبرك أيّ المسارين سلكته فعلًا.

شيء واحد يتجاوز هذا الخط، ولا يحدث ذلك إلا حين تطلبه أنت: البحث عن اسم في ويكيبيديا يرسل ذلك الاسم وحده، لا الرسالة التي ورد فيها. والقسم 6 يذكر من يتلقاه، والطلب يقع عند اللمسة ولا يقع في غيرها، فليس هناك ما يُطفأ. أما التلخيص والترجمة والتفريغ فكانت تتجاوزه أيضًا؛ وهي معطَّلة في هذا الإصدار، وليس في التطبيق أي أداة تشغّلها.`,
    },
    {
      title: '2. ما ليس مُعمّى، وما نستطيع رؤيته',
      body: `التعمية تحمي المحتوى، لا واقعة وجود المحادثة. وهذه الأمور مكشوفة على خوادمنا:

• من في كل محادثة، ومتى أُنشئت، ومتى كانت نشطة آخر مرة.
• الطابع الزمني لكل رسالة، وكم رسالة لم تقرأها.
• اسم الملف المرفق ونوعه وحجمه. البايتات مُعمّاة، أما وصفها فلا، وطول النص المُعمّى يحدّ طول الأصل.
• أصدقاؤك وطلبات الصداقة.
• إشارات المكالمات — أن مكالمة جرت، ومع من، ومتى. لا صوتها ولا صورتها.

مؤشّر الكتابة وإشعارات القراءة مُوقفان ما لم تفعّلهما، وما داما مُوقفين فلا يُكتب شيء.

ما لم يعد موجودًا هنا: بريدك الإلكتروني واسمك. منذ سبتمبر 2026 لا يحمل سجل الحساب سوى مُعرّف الحساب — ومنذ ذلك الحين لم يعد هناك بريد يُحفَظ في أي مكان. لا يسألك التسجيل عن أي شيء يخصك: حسابك هو عبارة استرداد من 24 كلمة، وبيانات الاعتماد التي يتحقق منها Firebase Authentication مشتقّة منها. وما يُحفَظ هناك هو مُعرّف عشوائي تحت نطاق لا يمكنه استقبال البريد.

وبشكل منفصل: لأن التطبيق يعمل على Google Firebase، تستطيع Google رؤية عنوان IP وتوقيت كل اتصال يجريه جهازك بها. هذه خاصية الاستضافة لا التطبيق، ولا يمكننا إزالتها بالتعمية.`,
    },
    {
      title: '3. كيف يجدك الآخرون',
      body: `لا يمكنهم البحث عنك. لا يوجد دليل — لا بحث بالبريد ولا بالهاتف ولا بالاسم — والخادم يرفض أي استعلام يحاول ذلك.

تصل إلى شخص بإرسال رابط دعوة له خارج التطبيق، بأي وسيلة تستخدمها أصلًا. يعمل الرابط مرة واحدة، وينتهي بعد 24 ساعة، ويمكن سحبه. ما تسمّي به شخصًا هو تسميتك أنت له، وتبقى لك؛ وإن كان قد عرّف بنفسه فذلك الاسم وصلك مُعمّى.`,
    },
    {
      title: '4. ما نجمعه',
      body: `• بيانات الحساب: مُعرّف حساب، وبيانات اعتماد مشتقّة من عبارة الاسترداد الخاصة بك، محفوظة في Firebase Authentication. لا بريد إلكتروني ولا رقم هاتف ولا اسم — لا يطلب التسجيل أيًا منها.
• النص المشفَّر للرسائل والمرفقات، إضافة إلى البيانات الوصفية في القسم 2.

هذه هي القائمة كاملة. لا تحليلات ولا تقارير أعطال. كان التطبيق يرسل مشاهدات الشاشات إلى Firebase Analytics والأعطال إلى Firebase Crashlytics، وكلاهما يحمل معرّف حسابك فلم يكن أيٌّ منهما مجهولًا؛ وقد أُزيلا معًا، ومعهما المكتبتان اللتان كانتا ترسلانهما. أما الأخطاء فتُطبَع على جهاز المطوّر أثناء التطوير ولا تذهب إلى أي مكان آخر.`,
    },
    {
      title: '5. أين تُخزَّن',
      body: `على Google Firebase — Firestore وStorage وAuthentication — وفق قواعد أمان تحدّد من يقرأ ويكتب كل مستند.

على جهازك، تُعمّى الرسائل المخزّنة مؤقتًا والإعدادات ورمز قفل التطبيق بمفتاح خاص بالجهاز محفوظ في مخزن مفاتيح النظام (Keychain في iOS، وKeystore في Android) لا في تخزين التطبيق العادي.

المفتاح الخاص الذي يفكّ تعمية رسائلك لا يغادر جهازك أبدًا، إلا في صورة عبارة الاسترجاع التي تختار تدوينها. نحن لا نملكه ولا نستطيع استرجاعه نيابةً عنك. إن فقدته، فلن تُقرأ الرسائل المُرسلة إلى ذلك الجهاز مرة أخرى — لا من أحد، بمن فينا نحن.`,
    },
    {
      title: '6. من غيرنا يتلقّى بيانات',
      body: `لا نبيع معلوماتك الشخصية ولا نقايضها ولا نؤجّرها. تصل البيانات إلى:

• Google Firebase — مزوّد الاستضافة لدينا، كما ورد أعلاه.
• Cloudflare Realtime — صوت وفيديو المكالمة، عندما لا يستطيع جهازك وجهاز الشخص الآخر الوصول إلى بعضهما مباشرة.
• مؤسسة ويكيميديا — اسم واحد، حين تضغط عليه للبحث عنه في ويكيبيديا.
• Google Cloud Speech-to-Text — الصوت الخاص برسالة صوتية واحدة، حين تطلب تفريغها نصًّا.
• Google Cloud Translation — نص رسالة واحدة، حين تطلب ترجمتها.
• Cloudflare Workers AI — حتى آخر 50 رسالة من محادثة واحدة، حين تطلب ملخّصًا أو تسأل سؤالًا عنها.

الثلاثة الأخيرة معطَّلة في هذا الإصدار. لا توجد في التطبيق أي أداة تشغّل التفريغ أو الترجمة أو التلخيص، ومن ثمّ لا يصل إلى تلك الخدمات الثلاث شيء. وهي مذكورة بدل أن تُحذف لأن الشيفرة ما زالت هنا ولأن هذه الميزات يُفترض أن تعود — وحين تعود، تعود مع هذا الإفصاح ومع سؤال قبل الاستخدام الأول. وما سيُرسَل حينها يُرسَل لإنتاج نتيجتك، لا لتدريب أي شيء؛ ولا يُحفَظ على خوادمنا نصّ مفرَّغ ولا ترجمة.

لا يوجد مفتاح لهذا البحث لأنه لا يوجد شيء دائم يُطفأ: فهو يعمل عند الضغط ولا يعمل في غير ذلك. تتلقّى ويكيبيديا ذلك الاسم وعنوان IP الخاص بك، تمامًا كما لو كتبته بنفسك في مربّع البحث لديها — بلا حساب ولا رسالة ولا محادثة. وما يعود يُعرض ولا يُحفظ، ولا يُكتب منه شيء في المحادثة.

لا يوجد لدى Cloudflare Realtime مفتاح تشغيل أيضًا. معظم المكالمات لا تحتاج إليه: جهازان يمكنهما الوصول إلى بعضهما مباشرة — معظم المكالمات على نفس الشبكة — يتصلان بدونه، ولا يُعاد توجيه أي شيء. عندما لا يستطيعان ذلك — غالبًا لأنكما على شبكتي هاتف مختلفتين — تُعاد المكالمة المشفرة بالفعل عبر تتابع بدلاً من أن تبقى غير قادرة على الاتصال. ما تراه Cloudflare هو عنوانا IP لكليكما، وتوقيت المكالمة، وكمية البيانات المنقولة تقريبًا؛ يبقى الصوت والفيديو تحت نفس تشفير DTLS-SRTP الموضح في القسم 2، لذا فإن إعادة التوجيه لا تفك تشفيرهما.

قد نُفصح عمّا بحوزتنا إن اقتضى القانون. وما بحوزتنا هو قائمة القسم 2. لا نستطيع تقديم محتوى الرسائل، لأننا لا نستطيع قراءته.`,
    },
    {
      title: '7. الإشعارات الفورية',
      body: `تُسلّم الإشعارات عبر Firebase Cloud Messaging. يُخزَّن رمز جهازك في جزء خاص من حسابك لا يقرؤه سواك.

لا تحمل الإشعارات نص الرسالة. جهازك هو الذي يفكّ تعميتها محليًا ويؤلّف ما تراه؛ أما Google فتوصّل الظرف لا مضمونه.`,
    },
    {
      title: '8. ما يمكنك فعله',
      body: `• احذف حسابك من شاشة الملف الشخصي. المحتوى الذي يخصّ المحادثة معًا — سجل مكالمة مثلًا — يبقى مع الطرف الآخر، لأنه سجلّه هو أيضًا.
• صدّر بياناتك من شاشة الملف الشخصي.
• اجعل الرسائل تنتهي لكل محادثة: ساعة، أو 24 ساعة، أو 7 أيام، أو 30 يومًا.
• فعّل أو أوقف مؤشّر الكتابة وإشعارات القراءة. كلاهما مُوقف افتراضيًا.
• اقفل التطبيق برمز أو ببصمة.
• اسحب رابط دعوة سبق أن وزّعته.

وإن كنت تفضّل أن نحذف شيئًا يدويًا، فراسلنا.`,
    },
    {
      title: '9. مدة الاحتفاظ',
      body: `نحتفظ ببياناتك ما دام حسابك قائمًا. حذف الحساب يحذفها، باستثناء المحتوى المشترك المذكور أعلاه. وانتهاء الصلاحية لكل محادثة يزيل الرسائل وفق الجدول الذي تحدّده.`,
    },
    {
      title: '10. حدود ينبغي أن تعرفها',
      body: `نفضّل أن نخبرك بها على أن تكتشفها بنفسك.

• يُوثَق بالمفاتيح أول مرة تُرى فيها. لو أن أحدًا استبدل مفتاحًا قبل أن تتبادلا أي رسالة، لكانت المحادثة مُعمّاة إلى الشخص الخطأ ولبدت طبيعية تمامًا. ينبّهك التطبيق حين يتغيّر المفتاح بعد ذلك، ويعرض رقم أمان يمكنكما مقارنته عبر قناة أخرى — لكن لا شيء يُجبرك على المقارنة.
• جهاز واحد في كل مرة. تستعيد عبارة الاسترداد المفتاح الذي يفتح سجلّك، فتسجيل الدخول على جهاز جديد لا يفقدك ما استلمته من قبل. أما المحادثات ذات السرية الأمامية فتستخدم مفتاحًا ثانيًا لا يغادر الجهاز الذي أنشأه: تصل إلى آخر جهاز سجّلت الدخول منه، وما خُتم للجهاز الآخر في تلك الأثناء لا يمكن نقله.
• الرسائل المُرسلة قبل وجود التعمية تبقى كما كانت. لم يُحوَّل شيء بأثر رجعي.
• لم يخضع هذا التطبيق قط لتدقيق أمني مستقل.`,
    },
    {
      title: '11. الأطفال',
      body: `Chatterbox غير موجّه للأطفال دون 13 عامًا، ولا نجمع معلوماتهم عن علم. إن كنت تعتقد أن طفلًا قدّم لنا معلومات شخصية، فتواصل معنا وسنحذفها.`,
    },
    {
      title: '12. التغييرات',
      body: `قد نُحدّث هذه السياسة. سنعلن التغييرات المهمة داخل التطبيق، والتاريخ في الأعلى هو تاريخ آخر تعديل.`,
    },
    {
      title: '13. التواصل',
      body: `أسئلة حول هذه السياسة: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. التحقق من وجود إصدار أحدث للتطبيق',
      body: `Google Play ليست الطريقة التي يصل بها هذا التطبيق إلى هاتفك الذي يعمل بنظام أندرويد. بل يُنزَّل من chatterbox.fans بدلاً من ذلك، ومتجر ليس جزءًا من هذه العملية لا يستطيع التحقق من التحديثات نيابةً عنك — لذا يستطيع هذا التطبيق فعل ذلك، إن طلبت منه.

يؤدي النقر على "تحقق الآن" إلى إرسال طلب واحد إلى chatterbox.fans للسؤال عن الإصدار الحالي. يحمل هذا الطلب عنوان IP الخاص بك فقط ولا شيء غيره — لا حساب، ولا معرّف جهاز، ولا رسالة. ما يعود هو رقم إصدار، تتم مقارنته على هاتفك بالإصدار الذي تستخدمه؛ لا يُنزَّل شيء تلقائيًا، ولا يُكتب أي شيء عن هذا التحقق في المحادثة.

لا يوجد مفتاح تشغيل لهذا لأنه لا يوجد ما يُطفأ: يعمل فقط عند النقر ولا يعمل بطريقة أخرى.

إذا ثبّت التحديث، فإنه يستبدل التطبيق في مكانه باستخدام نفس مفتاح التوقيع، بنفس الطريقة التي سيفعلها تحديث من Google Play.`,
    },
  ],
  'hi': [
    {
      title: '0. संक्षेप में',
      body: `आपके संदेशों का पाठ आपके ही डिवाइस पर एन्क्रिप्ट होता है और उसे सिर्फ़ वही लोग पढ़ सकते हैं जिन्हें आप भेजते हैं। हम उसे नहीं पढ़ सकते, और जिसके सर्वर हम किराए पर लेते हैं वह Google भी नहीं।

हमें जो दिखता है वह यह है कि एक बातचीत हुई: उसमें कौन से खाते हैं और वे कब सक्रिय थे। उसे भी हटाना सामग्री एन्क्रिप्ट करने से कठिन है, और हमने वह काम पूरा नहीं किया है। यह नीति ठीक-ठीक बताती है कि रेखा इस समय कहाँ है।`,
    },
    {
      title: '1. क्या एंड-टू-एंड एन्क्रिप्टेड है',
      body: `आपके डिवाइस पर एन्क्रिप्टेड, हमारे और Google दोनों के लिए अपठनीय:

• आपके संदेशों का पाठ।
• आपके संलग्न किए फ़ाइलों, तस्वीरों, ऑडियो और वीडियो की सामग्री।
• लिंक प्रीव्यू।
• वॉइस और वीडियो कॉल, जो दोनों डिवाइसों के बीच WebRTC के अनिवार्य DTLS-SRTP का उपयोग करती हैं।

अधिकतर आमने-सामने और समूह संदेश इसके अलावा एक रैचेट भी इस्तेमाल करते हैं: हर संदेश की अपनी कुंजी होती है, इसलिए आपका डिवाइस हाथ लग जाने पर भी पहले के संदेश उजागर नहीं होते। जिन बातचीतों में किसी के क्लाइंट ने नई कुंजी सामग्री प्रकाशित नहीं की, वे एक ही दीर्घकालिक कुंजी पर लौट आती हैं, जिसमें यह गुण नहीं होता। संदेश के नीचे का चिह्न बताता है कि उसे असल में कौन-सा रास्ता मिला।

इस रेखा को एक ही चीज़ पार करती है, और वह भी तभी जब आप कहें: विकिपीडिया पर कोई नाम खोजने से वही एक नाम जाता है, वह संदेश नहीं जिसमें वह था। कौन उसे पाता है, यह खंड 6 में लिखा है; अनुरोध आपके टैप पर होता है और उसके बाहर कभी नहीं, इसलिए बंद करने को कुछ है ही नहीं। सारांश, अनुवाद और लिप्यंतरण भी इसे पार करते — वे इस रिलीज़ में बंद हैं, और ऐप में कहीं भी कोई नियंत्रण नहीं है जो उन्हें चालू करे।`,
    },
    {
      title: '2. क्या एन्क्रिप्टेड नहीं है, और हम क्या देख सकते हैं',
      body: `एन्क्रिप्शन सामग्री की रक्षा करता है, इस तथ्य की नहीं कि बातचीत हुई। ये चीज़ें हमारे सर्वरों पर खुली रहती हैं:

• हर बातचीत में कौन है, वह कब बनी और आख़िरी बार कब सक्रिय थी।
• हर संदेश का समय, और आपने कितने नहीं पढ़े।
• अनुलग्नक का फ़ाइल नाम, प्रकार और आकार। बाइट एन्क्रिप्टेड हैं; उनका विवरण नहीं, और सिफरटेक्स्ट की लंबाई मूल की लंबाई की सीमा बता देती है।
• आपके दोस्त और मित्रता अनुरोध।
• कॉल सिग्नलिंग — कि कॉल हुई, किससे और कब। उसका ऑडियो या वीडियो नहीं।

टाइपिंग संकेत और पढ़े जाने की रसीदें तब तक बंद रहती हैं जब तक आप उन्हें चालू न करें, और बंद रहने के दौरान कुछ भी दर्ज नहीं होता।

अब यहाँ क्या नहीं है: आपका ईमेल पता और आपका नाम। सितंबर 2026 से खाते के रिकॉर्ड में सिर्फ़ एक खाता पहचानकर्ता रहता है — और तब से कहीं भी रखने के लिए कोई पता बचा ही नहीं है। पंजीकरण आपके बारे में कुछ नहीं पूछता: आपका खाता 24 शब्दों का रिकवरी वाक्यांश है, और Firebase Authentication जिस क्रेडेंशियल की जाँच करता है वह उसी से निकाला जाता है। वहाँ जो रखा जाता है वह एक ऐसे डोमेन के नीचे का यादृच्छिक लेबल है जो मेल ले ही नहीं सकता।

अलग से: चूँकि ऐप Google Firebase पर चलता है, आपका डिवाइस वहाँ जो भी कनेक्शन बनाता है उसका IP पता और समय Google देख सकता है। यह होस्टिंग का गुण है, ऐप का नहीं, और हम इसे एन्क्रिप्ट करके मिटा नहीं सकते।`,
    },
    {
      title: '3. लोग आपको कैसे ढूँढते हैं',
      body: `वे आपको खोज नहीं सकते। कोई निर्देशिका नहीं है — न ईमेल से, न फ़ोन से, न नाम से — और सर्वर ऐसी हर पूछताछ को अस्वीकार कर देता है।

आप किसी तक पहुँचते हैं उसे ऐप के बाहर, जो भी माध्यम आप पहले से इस्तेमाल करते हैं उससे, एक निमंत्रण लिंक भेजकर। लिंक एक बार काम करता है, 24 घंटे में समाप्त हो जाता है, और वापस लिया जा सकता है। आप किसी को जो कहते हैं वह आपका अपना नाम है और आपके पास ही रहता है; अगर उन्होंने अपना परिचय दिया, तो वह नाम आप तक एन्क्रिप्टेड आया।`,
    },
    {
      title: '4. हम क्या इकट्ठा करते हैं',
      body: `• खाता डेटा: एक खाता पहचानकर्ता, और आपके रिकवरी वाक्यांश से निकाला गया क्रेडेंशियल, जो Firebase Authentication में रखा जाता है। न ईमेल पता, न फ़ोन नंबर, न नाम — पंजीकरण इनमें से कुछ भी नहीं माँगता।
• संदेशों और अनुलग्नकों का सिफरटेक्स्ट, साथ ही खंड 2 का मेटाडेटा।

पूरी सूची इतनी ही है। न कोई उपयोग-विश्लेषण है, न क्रैश रिपोर्टिंग। पहले यह ऐप स्क्रीन-व्यू Firebase Analytics को और क्रैश Firebase Crashlytics को भेजता था, और दोनों में आपका खाता पहचानकर्ता होता था, इसलिए दोनों में से कोई अनाम नहीं था; अब दोनों हटा दिए गए हैं, उन्हें भेजने वाली लाइब्रेरियों समेत। त्रुटियाँ विकास के दौरान डेवलपर की अपनी मशीन पर छपती हैं और कहीं और नहीं जातीं।`,
    },
    {
      title: '5. यह कहाँ रखा जाता है',
      body: `Google Firebase पर — Firestore, Storage और Authentication — ऐसे सुरक्षा नियमों के तहत जो तय करते हैं कि हर दस्तावेज़ को कौन पढ़ और लिख सकता है।

आपके डिवाइस पर, कैश किए संदेश, सेटिंग्स और ऐप-लॉक PIN एक डिवाइस-विशिष्ट कुंजी से एन्क्रिप्ट होते हैं, जो सामान्य ऐप स्टोरेज में नहीं बल्कि प्लेटफ़ॉर्म के कुंजी भंडार (iOS Keychain, Android Keystore) में रहती है।

जो निजी कुंजी आपके संदेश डिक्रिप्ट करती है वह आपका डिवाइस कभी नहीं छोड़ती, सिवाय उस रिकवरी वाक्यांश के रूप में जिसे आप ख़ुद लिख लेने का फ़ैसला करते हैं। वह हमारे पास नहीं है और हम उसे आपके लिए वापस नहीं ला सकते। खो गई, तो उस डिवाइस को भेजे गए संदेश फिर कभी नहीं पढ़े जा सकेंगे — किसी के द्वारा भी नहीं, हमारे द्वारा भी नहीं।`,
    },
    {
      title: '6. डेटा और किसे मिलता है',
      body: `हम आपकी निजी जानकारी न बेचते हैं, न उसका व्यापार करते हैं, न किराए पर देते हैं। डेटा यहाँ पहुँचता है:

• Google Firebase — हमारा होस्टिंग प्रदाता, जैसा ऊपर बताया गया।
• Cloudflare Realtime — कॉल की ऑडियो और वीडियो, जब आपका डिवाइस और दूसरे व्यक्ति का डिवाइस सीधे एक-दूसरे तक नहीं पहुँच पाते।
• विकिमीडिया फ़ाउंडेशन — एक नाम, जब आप उसे विकिपीडिया पर देखने के लिए दबाते हैं।
• Google Cloud Speech-to-Text — जब आप लिप्यंतरण माँगते हैं, तो एक वॉइस संदेश का ऑडियो।
• Google Cloud Translation — जब आप अनुवाद माँगते हैं, तो एक संदेश का पाठ।
• Cloudflare Workers AI — जब आप सारांश माँगते हैं या किसी बातचीत के बारे में सवाल पूछते हैं, तो उस बातचीत के पिछले 50 तक संदेश।

आख़िरी तीन इस रिलीज़ में बंद हैं। ऐप में कहीं भी ऐसा कोई नियंत्रण नहीं है जो लिप्यंतरण, अनुवाद या सारांश चालू करे, इसलिए उन तीन सेवाओं तक कुछ भी नहीं पहुँचता। इन्हें हटाने के बजाय सूचीबद्ध रखा गया है क्योंकि कोड अब भी यहीं है और ये सुविधाएँ लौटनी हैं — और जब लौटेंगी, तो इसी घोषणा और पहली बार से पहले पूछे जाने वाले सवाल के साथ लौटेंगी। तब जो भेजा जाएगा वह आपका नतीजा बनाने के लिए भेजा जाएगा, किसी चीज़ को प्रशिक्षित करने के लिए नहीं; न लिप्यंतरण हमारे सर्वरों पर रखा जाता है और न अनुवाद।

इस खोज के लिए कोई स्विच नहीं है, क्योंकि बंद करने लायक कुछ स्थायी है ही नहीं: यह उसी दबाने पर चलती है, और कभी नहीं। विकिपीडिया को वह नाम और आपका IP पता मिलता है — ठीक वैसे ही जैसे आपने उसके खोज बॉक्स में स्वयं लिखा हो; न कोई खाता, न कोई संदेश, न कोई बातचीत। जो लौटता है वह दिखाया जाता है, सहेजा नहीं जाता, और उसमें से कुछ भी बातचीत में नहीं लिखा जाता।

Cloudflare Realtime का भी कोई स्विच नहीं है। ज़्यादातर कॉल को इसकी ज़रूरत नहीं होती: दो डिवाइस जो सीधे एक-दूसरे तक पहुँच सकते हैं — एक ही नेटवर्क पर ज़्यादातर कॉल — इसके बिना ही जुड़ जाते हैं, और कुछ भी रिले नहीं होता। जब वे नहीं पहुँच पाते — आमतौर पर इसलिए क्योंकि आप दोनों अलग-अलग मोबाइल नेटवर्क पर हैं — पहले से एन्क्रिप्टेड कॉल को कनेक्ट न हो पाने देने के बजाय रिले किया जाता है। Cloudflare जो देखता है वह है दोनों के IP पते, कॉल का समय, और लगभग कितना डेटा स्थानांतरित हुआ; ऑडियो और वीडियो सेक्शन 2 में बताई गई उसी DTLS-SRTP एन्क्रिप्शन के अंदर ही रहते हैं, इसलिए रिले करने से वे डिक्रिप्ट नहीं होते।

क़ानून की माँग पर हम जो हमारे पास है उसे बता सकते हैं। हमारे पास खंड 2 की सूची है। संदेशों की सामग्री हम पेश नहीं कर सकते, क्योंकि हम उसे पढ़ नहीं सकते।`,
    },
    {
      title: '7. पुश सूचनाएँ',
      body: `सूचनाएँ Firebase Cloud Messaging पहुँचाता है। आपका डिवाइस टोकन आपके खाते के एक निजी हिस्से में रखा जाता है जिसे सिर्फ़ आप पढ़ सकते हैं।

सूचनाओं में संदेश का पाठ नहीं होता। आपका डिवाइस संदेश को स्थानीय रूप से डिक्रिप्ट करता है और जो आप देखते हैं वह बनाता है; Google लिफ़ाफ़ा पहुँचाता है, उसके भीतर की चीज़ नहीं।`,
    },
    {
      title: '8. आप क्या कर सकते हैं',
      body: `• प्रोफ़ाइल स्क्रीन से अपना खाता मिटाएँ। जो सामग्री बातचीत का साझा हिस्सा है — जैसे कोई कॉल रिकॉर्ड — वह दूसरे प्रतिभागी के पास रहती है, क्योंकि वह उनका रिकॉर्ड भी है।
• प्रोफ़ाइल स्क्रीन से अपना डेटा निर्यात करें।
• हर चैट के लिए संदेशों की अवधि तय करें: 1 घंटा, 24 घंटे, 7 दिन या 30 दिन।
• टाइपिंग संकेत और पढ़े जाने की रसीदें चालू या बंद करें। दोनों डिफ़ॉल्ट रूप से बंद हैं।
• ऐप को PIN या बायोमेट्रिक से लॉक करें।
• जो निमंत्रण लिंक आपने बाँटा है उसे वापस लें।

अगर आप चाहें कि हम कुछ हाथ से हटाएँ, तो हमें लिखें।`,
    },
    {
      title: '9. डेटा कब तक रखा जाता है',
      body: `जब तक आपका खाता है, हम आपका डेटा रखते हैं। खाता मिटाने पर वह भी मिट जाता है, ऊपर बताई साझा सामग्री को छोड़कर। हर चैट की समय-सीमा आपके तय किए कार्यक्रम के अनुसार संदेश हटा देती है।`,
    },
    {
      title: '10. वे सीमाएँ जो आपको जाननी चाहिए',
      body: `हम चाहेंगे कि ये आपसे हम कहें, बजाय इसके कि आप ख़ुद इन तक पहुँचें।

• कुंजियों पर पहली बार देखने पर ही भरोसा कर लिया जाता है। अगर किसी ने आपके पहले संदेश के आदान-प्रदान से भी पहले कोई कुंजी बदल दी होती, तो बातचीत ग़लत व्यक्ति के लिए एन्क्रिप्ट होती और पूरी तरह सामान्य दिखती। उसके बाद कुंजी बदलने पर ऐप आपको चेतावनी देता है और एक सुरक्षा संख्या दिखाता है जिसे आप किसी दूसरे रास्ते से मिला सकते हैं — पर मिलाने के लिए कोई बाध्यता नहीं है।
• एक समय में एक ही डिवाइस। आपका रिकवरी वाक्यांश वह कुंजी लौटा देता है जो आपका इतिहास खोलती है, इसलिए नए डिवाइस पर साइन इन करने से जो आपको पहले मिल चुका है वह नहीं खोता। फ़ॉरवर्ड-सीक्रेसी वाली बातचीत दूसरी कुंजी इस्तेमाल करती है जो उसे बनाने वाले डिवाइस से कभी बाहर नहीं जाती: ये संदेश उसी डिवाइस पर पहुँचते हैं जिस पर सबसे बाद में साइन इन हुआ, और इस बीच दूसरे के लिए सील किया गया कुछ भी वहाँ नहीं ले जाया जा सकता।
• एन्क्रिप्शन आने से पहले भेजे गए संदेश जैसे थे वैसे ही रहते हैं। पिछली तारीख़ से कुछ भी बदला नहीं गया।
• इस ऐप का कभी कोई स्वतंत्र सुरक्षा ऑडिट नहीं हुआ है।`,
    },
    {
      title: '11. बच्चे',
      body: `Chatterbox 13 साल से कम उम्र के बच्चों के लिए नहीं है, और हम जान-बूझकर उनकी जानकारी नहीं जुटाते। अगर आपको लगता है कि किसी बच्चे ने हमें निजी जानकारी दी है, तो हमसे संपर्क करें, हम उसे मिटा देंगे।`,
    },
    {
      title: '12. बदलाव',
      body: `हम यह नीति अपडेट कर सकते हैं। बड़े बदलावों की घोषणा ऐप में की जाएगी, और ऊपर दी गई तारीख़ वही है जब इसे आख़िरी बार बदला गया।`,
    },
    {
      title: '13. संपर्क',
      body: `इस नीति से जुड़े सवाल: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. ऐप के नए वर्शन की जाँच करना',
      body: `Google Play वह तरीका नहीं है जिससे यह ऐप आपके Android फ़ोन तक पहुँचता है। इसे इसके बजाय chatterbox.fans से डाउनलोड किया जाता है, और जो स्टोर इस प्रक्रिया में शामिल नहीं है वह आपकी ओर से अपडेट की जाँच नहीं कर सकता — इसलिए अगर आप कहें तो यह ऐप खुद ऐसा कर सकता है।

"अभी जाँच करें" पर टैप करने से chatterbox.fans को एक अनुरोध भेजा जाता है, यह पूछते हुए कि मौजूदा वर्शन क्या है। उस अनुरोध में सिर्फ़ आपका IP पता होता है, और कुछ नहीं — न कोई खाता, न डिवाइस पहचानकर्ता, न कोई संदेश। जो वापस आता है वह एक वर्शन नंबर है, जिसकी तुलना आपके फ़ोन पर आपके चल रहे वर्शन से की जाती है; कुछ भी अपने आप डाउनलोड नहीं होता, और इस जाँच के बारे में कुछ भी बातचीत में नहीं लिखा जाता।

इसका कोई स्विच नहीं है क्योंकि बंद करने के लिए कुछ है ही नहीं: यह केवल टैप करने पर चलता है, अन्यथा नहीं।

अगर आप अपडेट इंस्टॉल करते हैं, तो यह उसी साइनिंग की का उपयोग करके ऐप को उसी जगह बदल देता है, ठीक वैसे ही जैसे Google Play से आया अपडेट करता।`,
    },
  ],

  fa: [
    {
      title: '0. خلاصه',
      body: `متن پیام‌های شما روی دستگاه خودتان رمزنگاری می‌شود و فقط کسانی که برایشان می‌فرستید می‌توانند آن را بخوانند. ما نمی‌توانیم آن را بخوانیم، و Google هم که سرورهایش را اجاره می‌کنیم نمی‌تواند.

آنچه ما می‌توانیم ببینیم این است که گفتگویی رخ داده: چه حساب‌هایی در آن هستند و چه زمانی فعال بوده‌اند. حذف این بخش هم از رمزنگاری محتوا سخت‌تر است و ما هنوز تمامش نکرده‌ایم. این سیاست دقیقاً می‌گوید خط فعلاً کجا کشیده شده است.`,
    },
    {
      title: '1. چه چیزی سرتاسری رمزنگاری‌شده است',
      body: `روی دستگاه شما رمزنگاری می‌شود و برای ما و Google خواندنی نیست:

• متن پیام‌های شما.
• محتوای فایل‌ها، عکس‌ها، صداها و ویدیوهایی که پیوست می‌کنید.
• پیش‌نمایش لینک‌ها.
• تماس‌های صوتی و ویدیویی، که از DTLS-SRTP اجباریِ WebRTC میان دو دستگاه استفاده می‌کنند.

بیشتر پیام‌های دونفره و گروهی، افزون بر این، از یک چرخ‌دنده (ratchet) استفاده می‌کنند، یعنی هر پیام کلید خودش را دارد، پس به‌خطر افتادن دستگاه شما پیام‌های قدیمی‌تر را افشا نمی‌کند. گفتگوهایی که کلاینت طرف مقابل هنوز مادهٔ کلید تازه‌تر را منتشر نکرده، به یک کلید دیرپای واحد برمی‌گردند که این ویژگی را ندارد. برچسب زیر یک پیام به شما می‌گوید آن پیام واقعاً کدام‌یک را دریافت کرده است.

فقط یک چیز از این خط عبور می‌کند، و فقط وقتی خودتان بخواهید: جستجوی نامی در ویکی‌پدیا فقط همان یک نام را می‌فرستد، نه پیامی که از آن آمده. بخش ۶ می‌گوید چه کسی آن را دریافت می‌کند، و جستجو فقط با همان ضربه اجرا می‌شود و در غیر آن اجرا نمی‌شود، پس چیزی برای خاموش کردن نیست. خلاصه‌سازی، ترجمه و پیاده‌سازی متن هم از این خط عبور می‌کنند — آن‌ها در این نسخه خاموش‌اند، و هیچ کنترلی در برنامه نیست که روشنشان کند.`,
    },
    {
      title: '2. چه چیزی رمزنگاری‌نشده است، و ما چه می‌بینیم',
      body: `رمزنگاری از محتوا محافظت می‌کند، نه از اصل وجود یک گفتگو. این‌ها روی سرورهای ما به‌صورت خوانا هستند:

• چه کسی در هر گفتگوست، و کِی ساخته شده و آخرین‌بار کِی فعال بوده.
• زمان هر پیام، و اینکه چند تای آن‌ها را نخوانده‌اید.
• نام، نوع و اندازهٔ فایل یک پیوست. بایت‌ها رمزنگاری شده‌اند؛ توصیف آن‌ها نه، و طول متن رمزشده هم طول اصل فایل را کران‌دار می‌کند.
• دوستان و درخواست‌های دوستی شما.
• سیگنالینگ تماس — اینکه تماسی گرفته شده، با چه کسی، و چه زمانی. نه صدا یا تصویر آن.

نشانگر تایپ و رسید خواندن مگر خودتان روشن‌شان کنید خاموش‌اند، و تا وقتی خاموش‌اند چیزی نوشته نمی‌شود.

چیزی که دیگر اینجا نیست: آدرس ایمیل و نام شما. از سپتامبر ۲۰۲۶، رکورد حساب فقط یک شناسهٔ حساب دارد — و از آن زمان هیچ آدرسی جایی نگهداری نمی‌شود. ثبت‌نام هیچ چیزی دربارهٔ شما نمی‌پرسد: حساب شما همان عبارت ۲۴ کلمه‌ای است، و مدرکی که Firebase Authentication بررسی می‌کند از همان مشتق می‌شود. چیزی که ذخیره می‌شود فقط یک برچسب تصادفی زیر دامنه‌ای است که هیچ ایمیلی نمی‌تواند دریافت کند.

جدا از این: چون برنامه روی Google Firebase اجرا می‌شود، Google می‌تواند آدرس IP و زمان هر اتصال دستگاه شما به آن را ببیند. این ویژگی میزبانی است، نه ویژگی برنامه، و ما نمی‌توانیم آن را با رمزنگاری از بین ببریم.`,
    },
    {
      title: '3. دیگران چطور شما را پیدا می‌کنند',
      body: `آن‌ها نمی‌توانند شما را جستجو کنند. اینجا هیچ فهرستی نیست — نه جستجو با ایمیل، شماره تلفن یا نام — و سرور هر چنین درخواستی را رد می‌کند.

شما با فرستادن یک لینک دعوت از کانالی جدا، از طریق هرچه از قبل استفاده می‌کنید، به کسی می‌رسید. یک لینک یک‌بار کار می‌کند، پس از ۲۴ ساعت منقضی می‌شود، و می‌توان لغوش کرد. اسمی که برای کسی می‌گذارید برچسب خود شماست برای او، فقط نزد شما نگه‌داشته‌شده؛ اگر او خودش را معرفی کرده باشد، آن نام رمزنگاری‌شده به شما رسیده است.`,
    },
    {
      title: '4. ما چه چیزی جمع‌آوری می‌کنیم',
      body: `• داده‌های حساب: یک شناسهٔ حساب، و مدرکی که از عبارت بازیابی شما مشتق شده، در Firebase Authentication نگهداری می‌شود. نه آدرس ایمیل، نه شماره تلفن، نه نام — ثبت‌نام هیچ‌کدام را نمی‌پرسد.
• متن رمزشدهٔ پیام‌ها و پیوست‌ها، به‌همراه ابرداده‌های بخش ۲.

همین است، تمام فهرست. نه آماری هست و نه گزارش خرابی. این برنامه قبلاً بازدید صفحه‌ها را به Firebase Analytics و گزارش‌های خرابی را به Firebase Crashlytics می‌فرستاد، هر دو همراه با شناسهٔ حساب شما، پس هیچ‌کدام ناشناس نبودند؛ حالا هر دو، همراه با کتابخانه‌هایی که آن‌ها را می‌فرستادند، حذف شده‌اند. خطاها فقط روی دستگاه خود توسعه‌دهنده در زمان توسعه چاپ می‌شوند و جای دیگری نمی‌روند.`,
    },
    {
      title: '5. کجا نگهداری می‌شود',
      body: `روی Google Firebase — Firestore، Storage و Authentication — زیر قوانین امنیتی‌ای که تعیین می‌کنند چه کسی می‌تواند هر سند را بخواند یا در آن بنویسد.

روی دستگاه شما، پیام‌های ذخیره‌شده، تنظیمات و پین قفل برنامه با کلیدی مخصوص همان دستگاه رمزنگاری می‌شوند که در گاوصندوق کلید پلتفرم (کیچین iOS، کیستور اندروید) نگهداری می‌شود، نه در حافظهٔ معمولی برنامه.

کلید خصوصی‌ای که پیام‌های شما را رمزگشایی می‌کند هرگز دستگاه شما را ترک نمی‌کند، مگر به‌شکل عبارت بازیابی‌ای که خودتان تصمیم می‌گیرید یادداشتش کنید. ما آن را نگه نمی‌داریم و نمی‌توانیم برایتان بازیابی‌اش کنیم. اگر آن را گم کنید، پیام‌های فرستاده‌شده به آن دستگاه دیگر خوانده نمی‌شوند — توسط هیچ‌کس، حتی ما.`,
    },
    {
      title: '6. چه کس دیگری داده را دریافت می‌کند',
      body: `ما اطلاعات شخصی شما را نمی‌فروشیم، معامله نمی‌کنیم و اجاره نمی‌دهیم. داده به این‌ها می‌رسد:

• Google Firebase — ارائه‌دهندهٔ میزبانی ما، همان‌طور که بالا گفته شد.
• Cloudflare Realtime — صدا و تصویر یک تماس، وقتی دستگاه شما و دستگاه طرف مقابل نتوانند مستقیماً به هم برسند.
• بنیاد ویکی‌مدیا — یک نام، وقتی روی آن ضربه می‌زنید تا در ویکی‌پدیا جستجویش کنید.
• Google Cloud Speech-to-Text — صدای یک پیام صوتی، وقتی متن پیاده‌شده می‌خواهید.
• Google Cloud Translation — متن یک پیام، وقتی ترجمه می‌خواهید.
• Cloudflare Workers AI — تا ۵۰ پیام آخر یک گفتگو، وقتی خلاصه می‌خواهید یا دربارهٔ آن سؤالی می‌پرسید.

سه مورد آخر در این نسخه خاموش‌اند. هیچ کنترلی در هیچ‌جای برنامه نیست که پیاده‌سازی متن، ترجمه یا خلاصه‌سازی را روشن کند، پس چیزی به این سه سرویس نمی‌رسد. آن‌ها به‌جای حذف‌شدن فهرست شده‌اند چون کد هنوز اینجاست و قرار است این ویژگی‌ها بازگردند — و وقتی بازگردند، همراه با همین افشاگری و درخواستی پیش از نخستین استفاده بازمی‌گردند. آنچه در آن زمان فرستاده شود برای تولید نتیجهٔ شماست، نه برای آموزش چیزی؛ نه متن پیاده‌شده و نه ترجمه روی سرورهای ما ذخیره نمی‌شود.

جستجوی ویکی‌پدیا کلیدی ندارد چون چیز پایداری برای خاموش‌کردن نیست: فقط با همان ضربه اجرا می‌شود و جز آن اجرا نمی‌شود. ویکی‌پدیا همان یک نام و آدرس IP شما را دریافت می‌کند، درست مثل اینکه خودتان در کادر جستجوی آن تایپش کرده باشید — بدون حساب، بدون پیام، بدون گفتگو. آنچه برمی‌گردد فقط نمایش داده می‌شود و ذخیره نمی‌شود، و چیزی از آن در گفتگو نوشته نمی‌شود.

Cloudflare Realtime هم کلیدی ندارد. بیشتر تماس‌ها به آن نیاز ندارند: دو دستگاهی که می‌توانند مستقیماً به هم برسند — بیشتر تماس‌ها در یک شبکه — بدون آن متصل می‌شوند و چیزی رله نمی‌شود. وقتی نتوانند — معمولاً به این دلیل که هرکدام در یک شبکهٔ موبایل متفاوت هستید — تماسی که از قبل رمزگذاری شده، به‌جای باقی ماندن بدون اتصال، رله می‌شود. آنچه Cloudflare می‌بیند هر دو آدرس IP، زمان تماس، و تقریباً میزان داده‌ی جابه‌جاشده است؛ صدا و تصویر همچنان تحت همان رمزگذاری DTLS-SRTP توضیح داده‌شده در بخش ۲ باقی می‌مانند، پس رله کردن آن‌ها را رمزگشایی نمی‌کند.

اگر قانون ایجاب کند، ممکن است آنچه را داریم افشا کنیم. آنچه داریم همان فهرست بخش ۲ است. ما نمی‌توانیم محتوای پیام‌ها را ارائه کنیم، چون نمی‌توانیم آن‌ها را بخوانیم.`,
    },
    {
      title: '7. اعلان‌های فشاری',
      body: `Firebase Cloud Messaging اعلان‌ها را تحویل می‌دهد. توکن دستگاه شما در بخشی خصوصی از حساب شما نگهداری می‌شود که فقط خودتان می‌توانید آن را بخوانید.

اعلان‌ها هیچ متن پیامی حمل نمی‌کنند. دستگاه شما پیام را محلی رمزگشایی می‌کند و آنچه می‌بینید را می‌سازد؛ Google پاکت را تحویل می‌دهد، نه محتوایش را.`,
    },
    {
      title: '8. شما چه می‌توانید بکنید',
      body: `• حساب خود را از صفحهٔ پروفایل حذف کنید. محتوایی که مشترکاً بخشی از یک گفتگوست — برای مثال یک رکورد تماس — نزد طرف دیگر می‌ماند، چون رکورد او هم هست.
• داده‌های خود را از صفحهٔ پروفایل خروجی بگیرید.
• انقضای پیام‌ها را برای هر گفتگو تنظیم کنید: ۱ ساعت، ۲۴ ساعت، ۷ روز یا ۳۰ روز.
• نشانگر تایپ و رسید خواندن را روشن یا خاموش کنید. هر دو به‌طور پیش‌فرض خاموش‌اند.
• برنامه را با پین یا بیومتریک قفل کنید.
• لینک دعوتی را که داده‌اید لغو کنید.

اگر ترجیح می‌دهید ما چیزی را دستی حذف کنیم، برایمان بنویسید.`,
    },
    {
      title: '9. نگهداری',
      body: `ما داده‌های شما را تا زمانی که حسابتان وجود دارد نگه می‌داریم. حذف حساب آن را حذف می‌کند، به‌جز محتوای مشترک ذکرشده در بالا. انقضای هر گفتگو پیام‌ها را طبق زمان‌بندی‌ای که تعیین کرده‌اید حذف می‌کند.`,
    },
    {
      title: '10. محدودیت‌هایی که باید بدانید',
      body: `ترجیح می‌دهیم این‌ها را به شما بگوییم تا اینکه خودتان پیدایشان کنید.

• کلیدها بار اول که دیده می‌شوند مورد اعتماد قرار می‌گیرند. اگر کسی پیش از آنکه هرگز پیامی رد و بدل کنید کلیدی را جایگزین کرده باشد، گفتگو برای شخص اشتباهی رمزنگاری می‌شود و کاملاً عادی به‌نظر می‌رسد. برنامه وقتی کلیدی بعداً تغییر کند به شما هشدار می‌دهد و شمارهٔ امنیتی‌ای نشان می‌دهد که می‌توانید از کانالی جدا مقایسه کنید — اما چیزی شما را مجبور به مقایسه‌اش نمی‌کند.
• یک دستگاه در هر زمان. عبارت بازیابی شما کلیدی را برمی‌گرداند که تاریخچهٔ شما را باز می‌کند، پس ورود روی دستگاه تازه چیزی از آنچه قبلاً دریافت کرده‌اید را از دست نمی‌دهد. گفتگوهای دارای محرمانگی پیش‌رونده از کلید دومی استفاده می‌کنند که هرگز دستگاهی را که ساخته‌اش ترک نمی‌کند: هر دستگاهی که آخرین‌بار وارد شده همان است که به آن‌ها می‌رسند، و هرچه در این میان برای دستگاه دیگر مهروموم شده قابل انتقال نیست.
• پیام‌های فرستاده‌شده پیش از وجود رمزنگاری همان‌طور که بودند می‌مانند. چیزی به‌عقب تبدیل نشده است.
• این برنامه هرگز به‌طور مستقل ممیزی امنیتی نشده است.`,
    },
    {
      title: '11. کودکان',
      body: `Chatterbox برای کودکان زیر ۱۳ سال در نظر گرفته نشده، و ما آگاهانه اطلاعات آن‌ها را جمع‌آوری نمی‌کنیم. اگر باور دارید کودکی اطلاعات شخصی به ما داده، با ما تماس بگیرید و آن را حذف خواهیم کرد.`,
    },
    {
      title: '12. تغییرات',
      body: `ممکن است این سیاست را به‌روزرسانی کنیم. تغییرات مهم در برنامه اعلام خواهند شد، و تاریخ بالای صفحه زمان آخرین تغییر است.`,
    },
    {
      title: '13. تماس',
      body: `سؤالات دربارهٔ این سیاست: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. بررسی نسخهٔ جدیدتر برنامه',
      body: `Google Play راهی نیست که این برنامه از طریق آن به گوشی اندرویدی شما می‌رسد. این برنامه در عوض از chatterbox.fans دانلود می‌شود، و فروشگاهی که در این چرخه نیست نمی‌تواند از طرف شما به‌روزرسانی‌ها را بررسی کند — پس این برنامه می‌تواند این کار را انجام دهد، اگر از آن بخواهید.

ضربه زدن روی «اکنون بررسی کن» یک درخواست به chatterbox.fans می‌فرستد که می‌پرسد نسخهٔ فعلی چیست. آن درخواست فقط آدرس IP شما را حمل می‌کند و چیز دیگری نه — نه حساب کاربری، نه شناسهٔ دستگاه، نه پیام. آنچه برمی‌گردد یک شمارهٔ نسخه است که روی گوشی شما با نسخه‌ای که در حال اجراست مقایسه می‌شود؛ هیچ‌چیز به‌طور خودکار دانلود نمی‌شود و هیچ‌چیز دربارهٔ این بررسی در گفتگو نوشته نمی‌شود.

این کار کلیدی ندارد، چون چیزی برای خاموش کردن وجود ندارد: فقط با ضربه زدن اجرا می‌شود و نه به شکل دیگری.

اگر به‌روزرسانی را نصب کنید، برنامه را در جای خود با همان کلید امضا جایگزین می‌کند، درست همان‌طور که یک به‌روزرسانی از Google Play این کار را می‌کرد.`,
    },
  ],

  he: [
    {
      title: '0. בקצרה',
      body: `טקסט ההודעות שלכם מוצפן במכשיר שלכם וניתן לקריאה רק על ידי מי ששלחתם לו אותן. אנחנו לא יכולים לקרוא אותו, וגם לא Google, שאת השרתים שלה אנחנו שוכרים.

מה שכן אנחנו יכולים לראות הוא ששיחה התקיימה: אילו חשבונות נמצאים בה, ומתי היו פעילים. הסרת זה קשה יותר מהצפנת התוכן, ועדיין לא סיימנו. מדיניות זו אומרת בדיוק היכן עובר הקו כרגע.`,
    },
    {
      title: '1. מה מוצפן מקצה לקצה',
      body: `מוצפן במכשיר שלכם, בלתי קריא לנו ול-Google:

• הטקסט של ההודעות שלכם.
• התוכן של קבצים, תמונות, שמע ווידאו שאתם מצרפים.
• תצוגות מקדימות של קישורים.
• שיחות קוליות ווידאו, המשתמשות ב-DTLS-SRTP המחייב של WebRTC בין שני המכשירים.

רוב ההודעות האישיות והקבוצתיות משתמשות בנוסף במנגנון רכטה (ratchet), כלומר לכל הודעה יש מפתח משלה, כך שפריצה למכשיר שלכם אינה חושפת הודעות קודמות. שיחות שבהן הלקוח של מישהו עדיין לא פרסם את חומר המפתח החדש יותר חוזרות למפתח יחיד ארוך טווח, שאין לו את התכונה הזו. התווית מתחת להודעה אומרת לכם איזה מהם היא בפועל קיבלה.

דבר אחד חוצה את הקו הזה, ורק כשאתם מבקשים זאת: חיפוש שם בוויקיפדיה שולח את השם הזה בלבד, לא את ההודעה שממנה הוא הגיע. סעיף 6 אומר מי מקבל אותו, והחיפוש רץ רק בעת ההקשה ולא אחרת, כך שאין מה לכבות. סיכום, תרגום ותמלול היו חוצים את הקו הזה גם הם — הם כבויים בגרסה זו, ואין שום פקד באפליקציה שמפעיל אותם.`,
    },
    {
      title: '2. מה לא מוצפן, ומה אנחנו יכולים לראות',
      body: `הצפנה מגנה על תוכן, לא על עצם קיומה של שיחה. אלה נמצאים בגלוי בשרתים שלנו:

• מי נמצא בכל שיחה, ומתי היא נוצרה ומתי הייתה פעילה לאחרונה.
• חותמת הזמן של כל הודעה, וכמה הודעות לא קראתם.
• שם הקובץ, הסוג והגודל של קובץ מצורף. הבייטים מוצפנים; התיאור שלהם לא, ואורך הצופן גם מגביל את אורך המקור.
• החברים ובקשות החברות שלכם.
• איתות שיחה — שהתבצעה שיחה, למי, ומתי. לא השמע או הווידאו שלה.

חיווי הקלדה ואישורי קריאה כבויים אלא אם תפעילו אותם, וכל עוד הם כבויים שום דבר לא נכתב.

מה שכבר לא כאן: כתובת האימייל והשם שלכם. מאז ספטמבר 2026 רשומת החשבון מכילה רק מזהה חשבון — ומאז אין כתובת לשמור בשום מקום. ההרשמה לא שואלת עליכם שום דבר: החשבון שלכם הוא ביטוי שחזור בן 24 מילים, וההרשאה שאותה בודקת Firebase Authentication נגזרת ממנו. מה שהיא שומרת הוא רק תווית אקראית תחת דומיין שלא יכול לקבל דואר.

בנפרד: מכיוון שהאפליקציה פועלת על Google Firebase, Google יכולה לראות את כתובת ה-IP והתזמון של כל חיבור שהמכשיר שלכם יוצר אליה. זו תכונה של האחסון, לא של האפליקציה, ואנחנו לא יכולים להצפין אותה משם.`,
    },
    {
      title: '3. איך אנשים מוצאים אתכם',
      body: `הם לא יכולים לחפש אתכם. אין כאן ספרייה — אין חיפוש לפי אימייל, מספר טלפון או שם — והשרת דוחה כל שאילתה שמנסה זאת.

אתם מגיעים למישהו על ידי שליחת קישור הזמנה בערוץ נפרד, דרך כל דבר שאתם כבר משתמשים בו. קישור עובד פעם אחת, פג לאחר 24 שעות, וניתן לבטלו. איך שאתם קוראים למישהו הוא התווית שלכם עבורו, נשמרת רק אצלכם; אם הוא הציג את עצמו, השם הזה הגיע אליכם מוצפן.`,
    },
    {
      title: '4. מה אנחנו אוספים',
      body: `• נתוני חשבון: מזהה חשבון, והרשאה שנגזרת מביטוי השחזור שלכם, נשמרים ב-Firebase Authentication. ללא כתובת אימייל, ללא מספר טלפון, ללא שם — ההרשמה לא שואלת אף אחד מהם.
• צופן ההודעות והקבצים המצורפים, בתוספת המטא-דאטה שבסעיף 2.

זו הרשימה כולה. אין אנליטיקה ואין דיווח על קריסות. האפליקציה נהגה לשלוח צפיות במסך ל-Firebase Analytics ודוחות קריסה ל-Firebase Crashlytics, שניהם נשאו את מזהה החשבון שלכם, כך שאף אחד מהם לא היה אנונימי; שניהם נעלמו, יחד עם הספריות ששלחו אותם. שגיאות מודפסות רק על המחשב של המפתח עצמו בזמן פיתוח ולא הולכות לשום מקום אחר.`,
    },
    {
      title: '5. איפה זה נשמר',
      body: `ב-Google Firebase — Firestore, Storage ו-Authentication — תחת כללי אבטחה שקובעים מי רשאי לקרוא ולכתוב כל מסמך.

במכשיר שלכם, הודעות במטמון, הגדרות וקוד ה-PIN של נעילת האפליקציה מוצפנים במפתח ייחודי למכשיר הנשמר במחסן המפתחות של הפלטפורמה (Keychain באייפון, Keystore באנדרואיד) ולא באחסון אפליקציה רגיל.

המפתח הפרטי המפענח את ההודעות שלכם לעולם לא עוזב את המכשיר שלכם, מלבד כביטוי השחזור שאתם בוחרים לרשום. אנחנו לא מחזיקים אותו ולא יכולים לשחזר אותו עבורכם. אם תאבדו אותו, ההודעות שנשלחו לאותו מכשיר לא ניתנות עוד לקריאה — על ידי אף אחד, כולל אנחנו.`,
    },
    {
      title: '6. מי עוד מקבל נתונים',
      body: `אנחנו לא מוכרים, סוחרים או משכירים את המידע האישי שלכם. נתונים מגיעים אל:

• Google Firebase — ספק האחסון שלנו, כמתואר לעיל.
• Cloudflare Realtime — השמע והווידאו של שיחה, כאשר המכשיר שלכם והמכשיר של הצד השני אינם יכולים להגיע זה לזה ישירות.
• קרן ויקימדיה — שם אחד, כשאתם מקישים עליו כדי לחפש אותו בוויקיפדיה.
• Google Cloud Speech-to-Text — השמע של הודעה קולית אחת, כשאתם מבקשים תמלול.
• Google Cloud Translation — הטקסט של הודעה אחת, כשאתם מבקשים תרגום.
• Cloudflare Workers AI — עד 50 ההודעות האחרונות של שיחה אחת, כשאתם מבקשים סיכום או שואלים עליה שאלה.

שלושת האחרונים כבויים בגרסה זו. אין שום פקד בשום מקום באפליקציה שמפעיל תמלול, תרגום או סיכומים, כך ששום דבר לא מגיע לשלושת השירותים האלה. הם מופיעים ברשימה במקום להימחק כי הקוד עדיין כאן והתכונות אמורות לחזור — וכשהן יחזרו, הן יחזרו עם הגילוי הזה ועם בקשת אישור לפני השימוש הראשון. מה שיישלח אז נשלח כדי לייצר עבורכם תוצאה, לא כדי לאמן דבר; לא תמלול ולא תרגום נשמרים בשרתים שלנו.

לחיפוש בוויקיפדיה אין פקד כי אין מה לכבות באופן קבוע: הוא רץ רק בעת ההקשה ולא אחרת. ויקיפדיה מקבלת את השם הזה בלבד ואת כתובת ה-IP שלכם, בדיוק כאילו הקלדתם אותו בעצמכם בתיבת החיפוש שלה — ללא חשבון, ללא הודעה, ללא שיחה. מה שחוזר מוצג ולא נשמר, ושום דבר ממנו לא נכתב לשיחה.

גם ל-Cloudflare Realtime אין מתג. רוב השיחות לא זקוקות לו: שני מכשירים שיכולים להגיע זה לזה ישירות — רוב השיחות באותה רשת — מתחברים בלעדיו, ושום דבר לא ממותב. כשהם לא יכולים — לרוב כי שניכם ברשתות סלולריות שונות — השיחה המוצפנת כבר עוברת ניתוב במקום להישאר ללא חיבור. מה ש-Cloudflare רואה הן שתי כתובות ה-IP, עיתוי השיחה, וכמות הנתונים שעברו בקירוב; השמע והווידאו נשארים תחת אותה הצפנת DTLS-SRTP המתוארת בסעיף 2, כך שהניתוב לא מפענח אותם.

אנו עשויים לחשוף את מה שאנחנו מחזיקים אם החוק מחייב זאת. מה שאנחנו מחזיקים הוא הרשימה שבסעיף 2. אנחנו לא יכולים למסור תוכן הודעות, כי אנחנו לא יכולים לקרוא אותן.`,
    },
    {
      title: '7. התראות דחיפה',
      body: `Firebase Cloud Messaging מספקת התראות. אסימון המכשיר שלכם נשמר בחלק פרטי של החשבון שלכם שרק אתם יכולים לקרוא.

התראות לא נושאות טקסט הודעה כלשהו. המכשיר שלכם מפענח את ההודעה מקומית ומרכיב את מה שאתם רואים; Google מספקת את המעטפה, לא את התוכן.`,
    },
    {
      title: '8. מה אתם יכולים לעשות',
      body: `• מחקו את החשבון שלכם ממסך הפרופיל. תוכן שהוא חלק משותף משיחה — רשומת שיחה, למשל — נשאר אצל המשתתף האחר, כי זו גם הרשומה שלו.
• ייצאו את הנתונים שלכם ממסך הפרופיל.
• הגדירו הודעות לפוג לפי צ'אט: שעה, 24 שעות, 7 ימים או 30 יום.
• הפעילו או כבו חיווי הקלדה ואישורי קריאה. שניהם כבויים כברירת מחדל.
• נעלו את האפליקציה עם קוד PIN או זיהוי ביומטרי.
• בטלו קישור הזמנה שכבר חילקתם.

אם תעדיפו שנמחק משהו ידנית, כתבו לנו.`,
    },
    {
      title: '9. שמירת נתונים',
      body: `אנחנו שומרים את הנתונים שלכם כל עוד החשבון שלכם קיים. מחיקת החשבון מוחקת אותם, מלבד התוכן המשותף שצוין לעיל. תפוגה לפי צ'אט מסירה הודעות בלוח הזמנים שקבעתם.`,
    },
    {
      title: '10. מגבלות שכדאי לכם לדעת',
      body: `היינו מעדיפים לספר לכם על אלה מאשר שתגלו אותן בעצמכם.

• מפתחות זוכים לאמון בפעם הראשונה שהם נראים. אם מישהו החליף מפתח לפני שאי פעם החלפתם הודעה, השיחה הייתה מוצפנת לאדם הלא נכון והייתה נראית לגמרי רגילה. האפליקציה מזהירה אתכם כשמפתח משתנה לאחר מכן, ומציגה מספר בטיחות שאתם יכולים להשוות בערוץ נפרד — אך שום דבר לא מכריח אתכם להשוות אותו.
• מכשיר אחד בכל פעם. ביטוי השחזור שלכם משחזר את המפתח שפותח את ההיסטוריה שלכם, כך שהתחברות במכשיר חדש לא מאבדת את מה שכבר קיבלתם. שיחות עם סודיות קדימה משתמשות במפתח שני שלעולם לא עוזב את המכשיר שיצר אותו: המכשיר שהתחבר אחרון הוא זה שאליו הן מגיעות, וכל מה שנחתם לאחר עבור המכשיר האחר לא ניתן להעביר בינתיים.
• הודעות שנשלחו לפני שהייתה הצפנה נשארות כפי שהיו. שום דבר לא הומר רטרואקטיבית.
• אפליקציה זו מעולם לא עברה ביקורת אבטחה עצמאית.`,
    },
    {
      title: '11. ילדים',
      body: `Chatterbox אינה מיועדת לילדים מתחת לגיל 13, ואנחנו לא אוספים ביודעין את המידע שלהם. אם אתם סבורים שילד מסר לנו מידע אישי, צרו איתנו קשר ואנחנו נמחק אותו.`,
    },
    {
      title: '12. שינויים',
      body: `אנחנו עשויים לעדכן מדיניות זו. שינויים משמעותיים יפורסמו באפליקציה, והתאריך למעלה הוא מתי שהיא השתנתה לאחרונה.`,
    },
    {
      title: '13. יצירת קשר',
      body: `שאלות על מדיניות זו: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. בדיקת גרסה חדשה יותר של האפליקציה',
      body: `Google Play אינו הדרך שבה האפליקציה הזו מגיעה לטלפון האנדרואיד שלכם. היא מורדת במקום זאת מ-chatterbox.fans, וחנות שאינה שותפה לתהליך אינה יכולה לבדוק עדכונים בשמכם — ולכן האפליקציה יכולה לעשות זאת בעצמה, אם תבקשו זאת.

הקשה על "בדקו עכשיו" שולחת בקשה אחת ל-chatterbox.fans ושואלת מהי הגרסה הנוכחית. הבקשה הזו נושאת רק את כתובת ה-IP שלכם ולא כלום מעבר לכך — לא חשבון, לא מזהה מכשיר, לא הודעה. מה שחוזר הוא מספר גרסה, שמושווה בטלפון שלכם לגרסה שבה אתם משתמשים; שום דבר לא מורד אוטומטית, ושום דבר על הבדיקה הזו לא נכתב לשיחה.

לפעולה הזו אין מתג, כי אין מה לכבות: היא פועלת רק בהקשה ולא בדרך אחרת.

אם תתקינו את העדכון, הוא יחליף את האפליקציה במקומה באמצעות אותו מפתח חתימה, בדיוק כפי שהיה עושה עדכון מ-Google Play.`,
    },
  ],

  ur: [
    {
      title: '0. مختصراً',
      body: `آپ کے پیغامات کا متن آپ کی ڈیوائس پر خفیہ کیا جاتا ہے اور صرف وہی لوگ اسے پڑھ سکتے ہیں جنہیں آپ بھیجتے ہیں۔ نہ ہم اسے پڑھ سکتے ہیں، اور نہ Google، جس کے سرور ہم کرائے پر لیتے ہیں۔

جو ہم دیکھ سکتے ہیں وہ یہ ہے کہ ایک گفتگو ہوئی: اس میں کون سے اکاؤنٹس شامل ہیں، اور وہ کب فعال تھے۔ اسے ہٹانا مواد کو خفیہ کرنے سے زیادہ مشکل ہے، اور ہم نے ابھی یہ کام مکمل نہیں کیا۔ یہ پالیسی بالکل بتاتی ہے کہ فی الحال حد کہاں کھینچی گئی ہے۔`,
    },
    {
      title: '1. کیا چیز اینڈ ٹو اینڈ خفیہ کردہ ہے',
      body: `آپ کی ڈیوائس پر خفیہ کردہ، ہمارے اور Google کے لیے ناقابل مطالعہ:

• آپ کے پیغامات کا متن۔
• آپ کے منسلک کردہ فائلوں، تصاویر، آڈیو اور ویڈیو کا مواد۔
• لنک پیش نظارے۔
• صوتی اور ویڈیو کالز، جو دونوں ڈیوائسز کے درمیان WebRTC کے لازمی DTLS-SRTP کا استعمال کرتی ہیں۔

زیادہ تر ون ٹو ون اور گروپ پیغامات مزید ایک ریچٹ (ratchet) استعمال کرتے ہیں، یعنی ہر پیغام کی اپنی کنجی ہوتی ہے، اس لیے آپ کی ڈیوائس سے سمجھوتہ پہلے کے پیغامات کو ظاہر نہیں کرتا۔ وہ گفتگوئیں جہاں کسی کے کلائنٹ نے ابھی نئی کنجی کا مواد شائع نہیں کیا، ایک واحد دیرپا کنجی پر واپس چلی جاتی ہیں، جس میں یہ خاصیت نہیں ہے۔ پیغام کے نیچے کا لیبل آپ کو بتاتا ہے کہ اسے دراصل کون سی کنجی ملی۔

صرف ایک چیز اس حد کو عبور کرتی ہے، اور صرف تب جب آپ خود کہیں: ویکیپیڈیا پر کسی نام کو تلاش کرنا صرف وہی ایک نام بھیجتا ہے، وہ پیغام نہیں جہاں سے یہ آیا۔ سیکشن 6 بتاتا ہے کہ اسے کون وصول کرتا ہے، اور تلاش صرف تھپتھپاہٹ پر چلتی ہے ورنہ نہیں، اس لیے بند کرنے کے لیے کچھ نہیں ہے۔ خلاصہ کرنا، ترجمہ کرنا اور متن میں تبدیل کرنا بھی اس حد کو عبور کریں گے — وہ اس ریلیز میں بند ہیں، اور ایپ میں کہیں بھی کوئی کنٹرول نہیں جو انہیں آن کرے۔`,
    },
    {
      title: '2. کیا چیز خفیہ کردہ نہیں ہے، اور ہم کیا دیکھ سکتے ہیں',
      body: `خفیہ کاری مواد کی حفاظت کرتی ہے، گفتگو کے حقیقت میں ہونے کی نہیں۔ یہ ہمارے سرورز پر واضح طور پر موجود ہیں:

• ہر گفتگو میں کون ہے، اور یہ کب بنائی گئی اور آخری بار کب فعال تھی۔
• ہر پیغام کی ٹائم اسٹیمپ، اور آپ نے کتنے نہیں پڑھے۔
• کسی منسلکہ کا فائل نام، قسم اور سائز۔ بائٹس خفیہ ہیں؛ ان کی تفصیل نہیں، اور خفیہ متن کی لمبائی اصل کی لمبائی کو بھی محدود کرتی ہے۔
• آپ کے دوست اور دوستی کی درخواستیں۔
• کال سگنلنگ — کہ کوئی کال کی گئی، کسے، اور کب۔ اس کی آواز یا ویڈیو نہیں۔

ٹائپنگ اشارے اور پڑھنے کی رسیدیں اس وقت تک بند رہتی ہیں جب تک آپ انہیں آن نہ کریں، اور بند رہنے کے دوران کچھ نہیں لکھا جاتا۔

جو اب یہاں نہیں ہے: آپ کا ای میل ایڈریس اور آپ کا نام۔ ستمبر 2026 سے، اکاؤنٹ ریکارڈ میں صرف ایک اکاؤنٹ شناخت کنندہ ہے — اور تب سے کہیں بھی رکھنے کے لیے کوئی پتہ نہیں ہے۔ سائن اپ آپ کے بارے میں کچھ نہیں پوچھتا: آپ کا اکاؤنٹ ایک 24 لفظی ریکوری فقرہ ہے، اور جو کریڈینشل Firebase Authentication چیک کرتا ہے وہ اسی سے ماخوذ ہے۔ یہ جو محفوظ کرتا ہے وہ صرف ایک تصادفی لیبل ہے ایسے ڈومین کے تحت جو کوئی میل حاصل نہیں کر سکتا۔

الگ سے: چونکہ ایپ Google Firebase پر چلتی ہے، Google آپ کی ڈیوائس کے اس سے ہونے والے ہر کنکشن کا IP ایڈریس اور وقت دیکھ سکتا ہے۔ یہ ہوسٹنگ کی خاصیت ہے، ایپ کی نہیں، اور ہم اسے خفیہ کاری سے ختم نہیں کر سکتے۔`,
    },
    {
      title: '3. لوگ آپ کو کیسے تلاش کرتے ہیں',
      body: `وہ آپ کو تلاش نہیں کر سکتے۔ یہاں کوئی ڈائریکٹری نہیں ہے — ای میل، فون نمبر یا نام سے تلاش نہیں — اور سرور ایسی کوئی بھی درخواست مسترد کر دیتا ہے۔

آپ کسی تک ایک دعوتی لنک الگ ذریعے سے بھیج کر پہنچتے ہیں، جو کچھ بھی آپ پہلے سے استعمال کرتے ہیں اس کے ذریعے۔ ایک لنک ایک بار کام کرتا ہے، 24 گھنٹے بعد ختم ہو جاتا ہے، اور واپس لیا جا سکتا ہے۔ آپ کسی کو جو بھی کہتے ہیں وہ آپ کا اپنا لیبل ہے اس کے لیے، صرف آپ کے پاس محفوظ؛ اگر انہوں نے اپنا تعارف کرایا، تو وہ نام آپ تک خفیہ کردہ پہنچا۔`,
    },
    {
      title: '4. ہم کیا جمع کرتے ہیں',
      body: `• اکاؤنٹ کا ڈیٹا: ایک اکاؤنٹ شناخت کنندہ، اور آپ کے ریکوری فقرے سے ماخوذ ایک کریڈینشل، جو Firebase Authentication میں رکھا جاتا ہے۔ نہ ای میل ایڈریس، نہ فون نمبر، نہ نام — سائن اپ ان میں سے کوئی نہیں پوچھتا۔
• پیغامات اور منسلکات کا خفیہ متن، اور سیکشن 2 میں بیان کردہ میٹا ڈیٹا۔

یہی پوری فہرست ہے۔ کوئی تجزیات نہیں ہیں اور کوئی کریش رپورٹنگ نہیں ہے۔ یہ ایپ پہلے اسکرین ویوز Firebase Analytics کو اور کریش رپورٹس Firebase Crashlytics کو بھیجتی تھی، دونوں آپ کے اکاؤنٹ شناخت کنندہ کے ساتھ، اس لیے کوئی بھی گمنام نہیں تھا؛ اب دونوں، ان لائبریریوں کے ساتھ جو انہیں بھیجتی تھیں، ختم کر دیے گئے ہیں۔ خرابیاں صرف ترقی کے دوران ایک ڈویلپر کی اپنی مشین پر پرنٹ ہوتی ہیں اور کہیں اور نہیں جاتیں۔`,
    },
    {
      title: '5. یہ کہاں محفوظ ہے',
      body: `Google Firebase پر — Firestore، Storage اور Authentication — ایسے سیکیورٹی اصولوں کے تحت جو طے کرتے ہیں کہ ہر دستاویز کو کون پڑھ اور لکھ سکتا ہے۔

آپ کی ڈیوائس پر، کیش شدہ پیغامات، ترتیبات اور ایپ لاک پن کو ایک فی ڈیوائس کنجی سے خفیہ کیا جاتا ہے جو پلیٹ فارم کی کی اسٹور (iOS Keychain، Android Keystore) میں رکھی جاتی ہے، نہ کہ عام ایپ اسٹوریج میں۔

نجی کنجی جو آپ کے پیغامات کو ڈی کرپٹ کرتی ہے کبھی آپ کی ڈیوائس نہیں چھوڑتی، سوائے ریکوری فقرے کی صورت میں جسے آپ خود لکھنے کا انتخاب کرتے ہیں۔ ہم اسے نہیں رکھتے اور آپ کے لیے اسے بحال نہیں کر سکتے۔ اگر آپ اسے کھو دیں، تو اس ڈیوائس کو بھیجے گئے پیغامات دوبارہ نہیں پڑھے جا سکتے — کسی کے ذریعے بھی نہیں، ہمارے سمیت۔`,
    },
    {
      title: '6. اور کون ڈیٹا حاصل کرتا ہے',
      body: `ہم آپ کی ذاتی معلومات فروخت، تجارت یا کرائے پر نہیں دیتے۔ ڈیٹا ان تک پہنچتا ہے:

• Google Firebase — ہمارا ہوسٹنگ فراہم کنندہ، جیسا کہ اوپر بیان کیا گیا۔
• Cloudflare Realtime — کال کی آواز اور ویڈیو، جب آپ کا ڈیوائس اور دوسرے شخص کا ڈیوائس براہ راست ایک دوسرے تک نہ پہنچ سکیں۔
• ویکی میڈیا فاؤنڈیشن — ایک نام، جب آپ اسے ویکیپیڈیا پر تلاش کرنے کے لیے تھپتھپاتے ہیں۔
• Google Cloud Speech-to-Text — ایک صوتی پیغام کی آواز، جب آپ متن میں تبدیلی مانگتے ہیں۔
• Google Cloud Translation — ایک پیغام کا متن، جب آپ ترجمہ مانگتے ہیں۔
• Cloudflare Workers AI — ایک گفتگو کے آخری 50 پیغامات تک، جب آپ خلاصہ مانگتے ہیں یا اس کے بارے میں سوال پوچھتے ہیں۔

آخری تین اس ریلیز میں بند ہیں۔ ایپ میں کہیں بھی کوئی کنٹرول نہیں جو متن میں تبدیلی، ترجمہ یا خلاصے کو آن کرے، اس لیے ان تینوں خدمات تک کچھ نہیں پہنچتا۔ انہیں حذف کرنے کے بجائے فہرست میں رکھا گیا ہے کیونکہ کوڈ ابھی بھی یہاں ہے اور یہ خصوصیات واپس آنے والی ہیں — اور جب وہ واپس آئیں گی، تو وہ اس انکشاف اور پہلے استعمال سے پہلے ایک اشارے کے ساتھ واپس آئیں گی۔ اس وقت جو بھیجا جائے گا وہ آپ کا نتیجہ تیار کرنے کے لیے بھیجا جائے گا، کسی چیز کی تربیت کے لیے نہیں؛ نہ تحریری متن اور نہ ترجمہ ہمارے سرورز پر محفوظ کیا جاتا ہے۔

ویکیپیڈیا کی تلاش کا کوئی سوئچ نہیں ہے کیونکہ بند کرنے کے لیے کوئی مستقل چیز نہیں ہے: یہ صرف تھپتھپاہٹ پر چلتی ہے ورنہ نہیں۔ ویکیپیڈیا صرف وہ ایک نام اور آپ کا IP ایڈریس وصول کرتا ہے، بالکل ویسے ہی جیسے آپ نے خود اسے اس کے سرچ باکس میں ٹائپ کیا ہو — کوئی اکاؤنٹ نہیں، کوئی پیغام نہیں، کوئی گفتگو نہیں۔ جو واپس آتا ہے وہ صرف دکھایا جاتا ہے اور محفوظ نہیں کیا جاتا، اور اس کے بارے میں کچھ بھی گفتگو میں نہیں لکھا جاتا۔

Cloudflare Realtime کا بھی کوئی سوئچ نہیں ہے۔ زیادہ تر کالز کو اس کی ضرورت نہیں ہوتی: دو ڈیوائسز جو براہ راست ایک دوسرے تک پہنچ سکتے ہیں — ایک ہی نیٹ ورک پر زیادہ تر کالز — اس کے بغیر جڑ جاتی ہیں، اور کچھ بھی ری لے نہیں ہوتا۔ جب وہ نہیں پہنچ سکتے — عام طور پر اس لیے کہ آپ دونوں مختلف موبائل نیٹ ورکس پر ہیں — پہلے سے مرموز کال کو رابطہ نہ ہونے کے بجائے ری لے کیا جاتا ہے۔ Cloudflare جو دیکھتا ہے وہ دونوں کے IP پتے، کال کا وقت، اور تقریباً کتنا ڈیٹا منتقل ہوا ہے؛ آواز اور ویڈیو سیکشن 2 میں بیان کردہ اسی DTLS-SRTP خفیہ کاری کے تحت رہتے ہیں، اس لیے ری لے کرنے سے وہ ڈی کرپٹ نہیں ہوتے۔

اگر قانون تقاضا کرے تو ہم اپنے پاس موجود چیز ظاہر کر سکتے ہیں۔ ہمارے پاس جو ہے وہ سیکشن 2 کی فہرست ہے۔ ہم پیغام کا مواد پیش نہیں کر سکتے، کیونکہ ہم انہیں پڑھ نہیں سکتے۔`,
    },
    {
      title: '7. پش اطلاعات',
      body: `Firebase Cloud Messaging اطلاعات پہنچاتا ہے۔ آپ کی ڈیوائس کا ٹوکن آپ کے اکاؤنٹ کے ایک نجی حصے میں محفوظ ہے جسے صرف آپ پڑھ سکتے ہیں۔

اطلاعات میں کوئی پیغام کا متن نہیں ہوتا۔ آپ کی ڈیوائس مقامی طور پر پیغام کو ڈی کرپٹ کرتی ہے اور جو آپ دیکھتے ہیں اسے بناتی ہے؛ Google لفافہ پہنچاتا ہے، مواد نہیں۔`,
    },
    {
      title: '8. آپ کیا کر سکتے ہیں',
      body: `• پروفائل اسکرین سے اپنا اکاؤنٹ حذف کریں۔ ایسا مواد جو گفتگو کا مشترکہ حصہ ہو — مثلاً ایک کال ریکارڈ — دوسرے شریک کے پاس رہتا ہے، کیونکہ یہ ان کا بھی ریکارڈ ہے۔
• پروفائل اسکرین سے اپنا ڈیٹا ایکسپورٹ کریں۔
• فی چیٹ پیغامات کی میعاد سیٹ کریں: 1 گھنٹہ، 24 گھنٹے، 7 دن یا 30 دن۔
• ٹائپنگ اشارے اور پڑھنے کی رسیدیں آن یا بند کریں۔ دونوں پہلے سے طے شدہ طور پر بند ہیں۔
• ایپ کو پن یا بایومیٹرکس سے لاک کریں۔
• آپ کا دیا گیا کوئی دعوتی لنک واپس لیں۔

اگر آپ چاہیں کہ ہم کچھ ہاتھ سے حذف کریں، تو ہمیں لکھیں۔`,
    },
    {
      title: '9. ڈیٹا کی برقراری',
      body: `جب تک آپ کا اکاؤنٹ موجود ہے ہم آپ کا ڈیٹا رکھتے ہیں۔ اکاؤنٹ حذف کرنا اسے حذف کر دیتا ہے، سوائے اوپر بیان کردہ مشترکہ مواد کے۔ فی چیٹ میعاد آپ کے مقرر کردہ شیڈول پر پیغامات ہٹا دیتی ہے۔`,
    },
    {
      title: '10. حدود جو آپ کو جاننی چاہئیں',
      body: `ہم یہ چاہیں گے کہ ہم آپ کو یہ بتائیں، بجائے اس کے کہ آپ خود انہیں تلاش کریں۔

• کنجیوں پر پہلی بار دیکھے جانے پر اعتماد کیا جاتا ہے۔ اگر کسی نے کبھی آپ کے پیغام کے تبادلے سے پہلے کوئی کنجی بدل دی ہوتی، تو گفتگو غلط شخص کے لیے خفیہ ہوتی اور بالکل عام لگتی۔ ایپ آپ کو خبردار کرتی ہے جب بعد میں کوئی کنجی بدلتی ہے، اور ایک سیفٹی نمبر دکھاتی ہے جسے آپ الگ ذریعے سے موازنہ کر سکتے ہیں — لیکن کچھ بھی آپ کو اس کا موازنہ کرنے پر مجبور نہیں کرتا۔
• ایک وقت میں ایک ڈیوائس۔ آپ کا ریکوری فقرہ وہ کنجی بحال کرتا ہے جو آپ کی تاریخ کھولتی ہے، اس لیے نئی ڈیوائس پر سائن اِن کرنے سے وہ نہیں کھوتا جو آپ کو پہلے ہی مل چکا ہے۔ فارورڈ سیکریسی والی گفتگوئیں دوسری کنجی استعمال کرتی ہیں جو اسے بنانے والی ڈیوائس کو کبھی نہیں چھوڑتی: جو بھی ڈیوائس آخری بار سائن اِن ہوئی وہی وہ ہے جس تک وہ پہنچتی ہیں، اور اس دوران دوسری ڈیوائس کے لیے سیل کیا گیا کچھ بھی وہاں منتقل نہیں کیا جا سکتا۔
• خفیہ کاری موجود ہونے سے پہلے بھیجے گئے پیغامات ویسے ہی رہتے ہیں جیسے وہ تھے۔ کچھ بھی پیچھے جا کر تبدیل نہیں کیا گیا۔
• اس ایپ کا کبھی آزادانہ سیکیورٹی آڈٹ نہیں ہوا ہے۔`,
    },
    {
      title: '11. بچے',
      body: `Chatterbox 13 سال سے کم عمر بچوں کے لیے نہیں ہے، اور ہم جان بوجھ کر ان کی معلومات جمع نہیں کرتے۔ اگر آپ کو یقین ہے کہ کسی بچے نے ہمیں ذاتی معلومات دی ہیں، تو ہم سے رابطہ کریں اور ہم اسے حذف کر دیں گے۔`,
    },
    {
      title: '12. تبدیلیاں',
      body: `ہم اس پالیسی کو اپ ڈیٹ کر سکتے ہیں۔ اہم تبدیلیوں کا اعلان ایپ میں کیا جائے گا، اور اوپر دی گئی تاریخ وہ ہے جب اسے آخری بار تبدیل کیا گیا۔`,
    },
    {
      title: '13. رابطہ',
      body: `اس پالیسی کے بارے میں سوالات: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. ایپ کے نئے ورژن کی جانچ کرنا',
      body: `Google Play وہ طریقہ نہیں ہے جس سے یہ ایپ آپ کے اینڈرائیڈ فون تک پہنچتی ہے۔ یہ اس کے بجائے chatterbox.fans سے ڈاؤن لوڈ کی جاتی ہے، اور جو اسٹور اس عمل کا حصہ نہیں ہے وہ آپ کی جانب سے اپ ڈیٹس چیک نہیں کر سکتا — اس لیے اگر آپ کہیں تو یہ ایپ خود ایسا کر سکتی ہے۔

"ابھی چیک کریں" پر ٹیپ کرنے سے chatterbox.fans کو ایک درخواست بھیجی جاتی ہے جو پوچھتی ہے کہ موجودہ ورژن کیا ہے۔ اس درخواست میں صرف آپ کا IP ایڈریس ہوتا ہے اور کچھ نہیں — نہ اکاؤنٹ، نہ ڈیوائس شناخت کنندہ، نہ پیغام۔ جو واپس آتا ہے وہ ایک ورژن نمبر ہے، جس کا موازنہ آپ کے فون پر چل رہے ورژن سے کیا جاتا ہے؛ کچھ بھی خودکار طور پر ڈاؤن لوڈ نہیں ہوتا، اور اس جانچ کے بارے میں کچھ بھی گفتگو میں نہیں لکھا جاتا۔

اس کا کوئی سوئچ نہیں ہے کیونکہ بند کرنے کے لیے کچھ ہے ہی نہیں: یہ صرف ٹیپ کرنے پر چلتا ہے اور کسی اور طرح نہیں۔

اگر آپ اپ ڈیٹ انسٹال کرتے ہیں، تو یہ اسی سائننگ کی کا استعمال کرتے ہوئے ایپ کو اسی جگہ تبدیل کر دیتا ہے، بالکل ویسے ہی جیسے Google Play کا اپ ڈیٹ کرتا۔`,
    },
  ],

  pl: [
    {
      title: '0. W skrócie',
      body: `Tekst Twoich wiadomości jest szyfrowany na Twoim urządzeniu i mogą go odczytać tylko osoby, do których go wysyłasz. My nie możemy go odczytać, podobnie jak Google, którego serwery wynajmujemy.

To, co możemy zobaczyć, to fakt, że rozmowa się odbyła: które konta w niej uczestniczą i kiedy były aktywne. Usunięcie tego jest trudniejsze niż zaszyfrowanie treści, i jeszcze tego nie skończyliśmy. Ta polityka mówi dokładnie, gdzie obecnie przebiega granica.`,
    },
    {
      title: '1. Co jest zaszyfrowane end-to-end',
      body: `Zaszyfrowane na Twoim urządzeniu, nieczytelne dla nas i dla Google:

• Tekst Twoich wiadomości.
• Zawartość plików, zdjęć, audio i wideo, które załączasz.
• Podglądy linków.
• Połączenia głosowe i wideo, które korzystają z obowiązkowego DTLS-SRTP protokołu WebRTC między dwoma urządzeniami.

Większość wiadomości jeden na jeden i grupowych dodatkowo korzysta z mechanizmu ratchet, co oznacza, że każda wiadomość ma własny klucz, więc naruszenie Twojego urządzenia nie ujawnia wcześniejszych wiadomości. Rozmowy, w których klient kogoś jeszcze nie opublikował nowszego materiału kluczowego, wracają do jednego, długotrwałego klucza, który nie ma tej właściwości. Etykieta pod wiadomością mówi Ci, którą z nich faktycznie otrzymała.

Jedna rzecz przekracza tę granicę, i tylko wtedy, gdy o to poprosisz: wyszukanie nazwy w Wikipedii wysyła tylko tę jedną nazwę, a nie wiadomość, z której pochodzi. Sekcja 6 mówi, kto ją otrzymuje, a wyszukiwanie działa tylko po dotknięciu i w innym przypadku nie, więc nie ma czego wyłączać. Podsumowywanie, tłumaczenie i transkrypcja również przekroczyłyby tę granicę — są wyłączone w tej wersji i nie ma żadnej kontroli w aplikacji, która by je włączyła.`,
    },
    {
      title: '2. Co nie jest zaszyfrowane i co możemy zobaczyć',
      body: `Szyfrowanie chroni treść, a nie sam fakt istnienia rozmowy. Poniższe znajdują się jawnie na naszych serwerach:

• Kto jest w każdej rozmowie oraz kiedy została utworzona i kiedy była ostatnio aktywna.
• Znacznik czasu każdej wiadomości i ile z nich nie przeczytałeś.
• Nazwa, typ i rozmiar pliku załącznika. Bajty są zaszyfrowane; ich opis nie, a długość szyfrogramu ogranicza również długość oryginału.
• Twoi znajomi i prośby o znajomość.
• Sygnalizacja połączenia — że połączenie zostało nawiązane, do kogo i kiedy. Nie jego dźwięk ani obraz.

Wskaźniki pisania i potwierdzenia odczytu są wyłączone, chyba że je włączysz, a dopóki są wyłączone, nic nie jest zapisywane.

Czego już tu nie ma: Twój adres e-mail i Twoje imię. Od września 2026 roku rekord konta zawiera tylko identyfikator konta — i od tego czasu nigdzie nie ma adresu do przechowywania. Rejestracja nie pyta o nic na Twój temat: Twoje konto to 24-wyrazowa fraza odzyskiwania, a poświadczenie, które sprawdza Firebase Authentication, jest z niej wyprowadzone. To, co przechowuje, to tylko losowa etykieta pod domeną, która nie może odbierać poczty.

Osobno: ponieważ aplikacja działa na Google Firebase, Google może zobaczyć adres IP i czas każdego połączenia, jakie Twoje urządzenie z nim nawiązuje. To cecha hostingu, a nie aplikacji, i nie możemy jej zaszyfrować.`,
    },
    {
      title: '3. Jak ludzie Cię znajdują',
      body: `Nie mogą Cię wyszukać. Nie ma tu katalogu — brak wyszukiwania po e-mailu, numerze telefonu czy nazwie — a serwer odrzuca każde takie zapytanie.

Docierasz do kogoś, wysyłając link z zaproszeniem poza aplikacją, dowolnym kanałem, którego już używasz. Link działa raz, wygasa po 24 godzinach i można go wycofać. To, jak kogoś nazywasz, jest Twoją własną etykietą dla tej osoby, przechowywaną tylko u Ciebie; jeśli ta osoba się przedstawiła, to imię dotarło do Ciebie zaszyfrowane.`,
    },
    {
      title: '4. Co zbieramy',
      body: `• Dane konta: identyfikator konta oraz poświadczenie wyprowadzone z Twojej frazy odzyskiwania, przechowywane w Firebase Authentication. Bez adresu e-mail, bez numeru telefonu, bez imienia — rejestracja nie pyta o żadne z nich.
• Szyfrogram wiadomości i załączników, plus metadane z sekcji 2.

To cała lista. Nie ma analityki ani raportowania awarii. Ta aplikacja wysyłała kiedyś widoki ekranu do Firebase Analytics i raporty o awariach do Firebase Crashlytics, oba niosące Twój identyfikator konta, więc żadne z nich nie było anonimowe; oba zniknęły, wraz z bibliotekami, które je wysyłały. Błędy są drukowane tylko na własnym komputerze programisty podczas rozwoju i nigdzie indziej nie trafiają.`,
    },
    {
      title: '5. Gdzie jest przechowywane',
      body: `W Google Firebase — Firestore, Storage i Authentication — zgodnie z regułami bezpieczeństwa, które decydują, kto może odczytywać i zapisywać każdy dokument.

Na Twoim urządzeniu wiadomości w pamięci podręcznej, ustawienia i PIN blokady aplikacji są szyfrowane kluczem unikalnym dla urządzenia, przechowywanym w magazynie kluczy platformy (Keychain w iOS, Keystore w Androidzie), a nie w zwykłej pamięci aplikacji.

Klucz prywatny, który odszyfrowuje Twoje wiadomości, nigdy nie opuszcza Twojego urządzenia, z wyjątkiem frazy odzyskiwania, którą decydujesz się zapisać. My go nie przechowujemy i nie możemy go dla Ciebie odzyskać. Jeśli go zgubisz, wiadomości wysłane do tego urządzenia nie będą już mogły zostać odczytane — przez nikogo, łącznie z nami.`,
    },
    {
      title: '6. Kto jeszcze otrzymuje dane',
      body: `Nie sprzedajemy, nie wymieniamy ani nie wynajmujemy Twoich danych osobowych. Dane docierają do:

• Google Firebase — naszego dostawcy hostingu, jak opisano powyżej.
• Cloudflare Realtime — dźwięk i obraz rozmowy, gdy Twoje urządzenie i urządzenie drugiej osoby nie mogą połączyć się bezpośrednio.
• Fundacji Wikimedia — jedno imię, gdy dotkniesz go, aby wyszukać w Wikipedii.
• Google Cloud Speech-to-Text — dźwięk jednej wiadomości głosowej, gdy prosisz o transkrypcję.
• Google Cloud Translation — tekst jednej wiadomości, gdy prosisz o tłumaczenie.
• Cloudflare Workers AI — do 50 ostatnich wiadomości jednej rozmowy, gdy prosisz o podsumowanie lub zadajesz o nią pytanie.

Ostatnie trzy są wyłączone w tej wersji. Nie ma żadnej kontroli w żadnym miejscu aplikacji, która włączałaby transkrypcję, tłumaczenie czy podsumowania, więc nic nie dociera do tych trzech usług. Są wymienione, a nie usunięte, ponieważ kod nadal tu jest, a te funkcje mają wrócić — a kiedy wrócą, wrócą z tym ujawnieniem i z monitem przed pierwszym użyciem. To, co zostanie wtedy wysłane, jest wysyłane, aby wygenerować Twój wynik, a nie by cokolwiek trenować; ani transkrypcja, ani tłumaczenie nie są przechowywane na naszych serwerach.

Wyszukiwanie w Wikipedii nie ma przełącznika, ponieważ nie ma nic trwałego do wyłączenia: działa tylko po dotknięciu i w innym przypadku nie. Wikipedia otrzymuje tylko tę jedną nazwę i Twój adres IP, dokładnie tak, jakbyś sam wpisał ją w polu wyszukiwania — bez konta, bez wiadomości, bez rozmowy. To, co wraca, jest wyświetlane i nie zapisywane, i nic z tego nie jest zapisywane w rozmowie.

Cloudflare Realtime również nie ma przełącznika. Większość połączeń go nie potrzebuje: dwa urządzenia, które mogą połączyć się bezpośrednio — większość połączeń w tej samej sieci — łączą się bez niego, i nic nie jest przekazywane. Gdy nie mogą — zwykle dlatego, że oboje jesteście w różnych sieciach komórkowych — już zaszyfrowana rozmowa jest przekazywana zamiast pozostać bez połączenia. To, co widzi Cloudflare, to oba adresy IP, czas rozmowy i w przybliżeniu ilość przesłanych danych; dźwięk i obraz pozostają pod tym samym szyfrowaniem DTLS-SRTP opisanym w sekcji 2, więc przekazywanie ich nie odszyfrowuje.

Możemy ujawnić to, co przechowujemy, jeśli wymaga tego prawo. To, co przechowujemy, to lista z sekcji 2. Nie możemy udostępnić treści wiadomości, ponieważ nie możemy ich odczytać.`,
    },
    {
      title: '7. Powiadomienia push',
      body: `Firebase Cloud Messaging dostarcza powiadomienia. Token Twojego urządzenia jest przechowywany w prywatnej części Twojego konta, którą tylko Ty możesz odczytać.

Powiadomienia nie niosą żadnego tekstu wiadomości. Twoje urządzenie odszyfrowuje wiadomość lokalnie i tworzy to, co widzisz; Google dostarcza kopertę, a nie treść.`,
    },
    {
      title: '8. Co możesz zrobić',
      body: `• Usuń swoje konto z ekranu Profilu. Treść, która jest wspólną częścią rozmowy — na przykład zapis połączenia — pozostaje u drugiego uczestnika, ponieważ to również jego zapis.
• Wyeksportuj swoje dane z ekranu Profilu.
• Ustaw wygasanie wiadomości dla każdego czatu: 1 godzina, 24 godziny, 7 dni lub 30 dni.
• Włącz lub wyłącz wskaźniki pisania i potwierdzenia odczytu. Oba są domyślnie wyłączone.
• Zablokuj aplikację PIN-em lub biometrią.
• Wycofaj wydany przez siebie link z zaproszeniem.

Jeśli wolisz, abyśmy coś usunęli ręcznie, napisz do nas.`,
    },
    {
      title: '9. Przechowywanie danych',
      body: `Przechowujemy Twoje dane tak długo, jak istnieje Twoje konto. Usunięcie konta je usuwa, z wyjątkiem wspólnie posiadanej treści wymienionej powyżej. Wygasanie dla każdego czatu usuwa wiadomości zgodnie z ustawionym przez Ciebie harmonogramem.`,
    },
    {
      title: '10. Ograniczenia, które powinieneś znać',
      body: `Wolelibyśmy Ci o nich powiedzieć, niż żebyś sam je odkrył.

• Kluczom ufa się przy pierwszym ich zobaczeniu. Gdyby ktoś podmienił klucz, zanim kiedykolwiek wymieniliście wiadomość, rozmowa byłaby zaszyfrowana dla niewłaściwej osoby i wyglądałaby zupełnie normalnie. Aplikacja ostrzega Cię, gdy klucz zmienia się później, i pokazuje numer bezpieczeństwa, który możesz porównać poza aplikacją — ale nic nie zmusza Cię do jego porównania.
• Jedno urządzenie naraz. Twoja fraza odzyskiwania przywraca klucz, który otwiera Twoją historię, więc zalogowanie się na nowym urządzeniu nie traci tego, co już otrzymałeś. Rozmowy z poufnością z wyprzedzeniem korzystają z drugiego klucza, który nigdy nie opuszcza urządzenia, które go utworzyło: docierają do niego na tym urządzeniu, które zalogowało się ostatnio, a wszystko zapieczętowane w międzyczasie dla innego urządzenia nie może zostać tam przeniesione.
• Wiadomości wysłane, zanim istniało szyfrowanie, pozostają takie, jakie były. Nic nie zostało przekonwertowane wstecznie.
• Ta aplikacja nigdy nie przeszła niezależnego audytu bezpieczeństwa.`,
    },
    {
      title: '11. Dzieci',
      body: `Chatterbox nie jest przeznaczony dla dzieci poniżej 13 roku życia, i świadomie nie zbieramy ich informacji. Jeśli uważasz, że dziecko przekazało nam dane osobowe, skontaktuj się z nami, a je usuniemy.`,
    },
    {
      title: '12. Zmiany',
      body: `Możemy aktualizować tę politykę. Istotne zmiany zostaną ogłoszone w aplikacji, a data na górze to moment jej ostatniej zmiany.`,
    },
    {
      title: '13. Kontakt',
      body: `Pytania dotyczące tej polityki: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Sprawdzanie nowszej wersji aplikacji',
      body: `Google Play nie jest sposobem, w jaki ta aplikacja trafia na Twój telefon z Androidem. Zamiast tego jest pobierana z chatterbox.fans, a sklep, który nie jest częścią tego procesu, nie może sprawdzać aktualizacji w Twoim imieniu — więc ta aplikacja może to zrobić sama, jeśli o to poprosisz.

Dotknięcie „Sprawdź teraz" wysyła jedno zapytanie do chatterbox.fans z pytaniem, jaka wersja jest aktualna. To zapytanie niesie tylko Twój adres IP i nic więcej — żadnego konta, żadnego identyfikatora urządzenia, żadnej wiadomości. To, co wraca, to numer wersji, porównywany na Twoim telefonie z wersją, której używasz; nic nie jest pobierane automatycznie, a nic z tego sprawdzenia nie jest zapisywane w rozmowie.

To nie ma przełącznika, bo nie ma czego wyłączać: działa tylko po dotknięciu i w żaden inny sposób.

Jeśli zainstalujesz aktualizację, zastąpi ona aplikację w tym samym miejscu, używając tego samego klucza podpisu — tak samo, jak zrobiłaby to aktualizacja z Google Play.`,
    },
  ],

  uk: [
    {
      title: '0. Коротко',
      body: `Текст ваших повідомлень шифрується на вашому пристрої, і прочитати його можуть лише ті, кому ви його надсилаєте. Ми не можемо його прочитати, як і Google, чиї сервери ми орендуємо.

Що ми можемо бачити, так це те, що розмова відбулася: які облікові записи в ній беруть участь і коли вони були активні. Прибрати це складніше, ніж зашифрувати вміст, і ми ще не закінчили. Ця політика точно каже, де зараз проходить межа.`,
    },
    {
      title: '1. Що зашифровано наскрізно',
      body: `Зашифровано на вашому пристрої, недоступне для читання нам і Google:

• Текст ваших повідомлень.
• Вміст файлів, фото, аудіо та відео, які ви додаєте.
• Попередній перегляд посилань.
• Голосові та відеодзвінки, які використовують обов'язковий DTLS-SRTP протоколу WebRTC між двома пристроями.

Більшість особистих і групових повідомлень додатково використовують механізм ratchet, тобто кожне повідомлення має власний ключ, тож компрометація вашого пристрою не розкриває попередні повідомлення. Розмови, у яких клієнт співрозмовника ще не опублікував новіший ключовий матеріал, повертаються до єдиного довготривалого ключа, який не має цієї властивості. Позначка під повідомленням каже вам, яке саме воно фактично отримало.

Лише одна річ перетинає цю межу, і лише тоді, коли ви самі про це просите: пошук імені у Вікіпедії надсилає лише це одне ім'я, а не повідомлення, з якого воно взяте. Розділ 6 каже, хто його отримує, а пошук виконується лише за дотиком і в іншому разі — ні, тож немає чого вимикати. Підсумовування, переклад і транскрипція також перетнули б цю межу — вони вимкнені в цій версії, і в застосунку немає жодного елемента керування, який би їх увімкнув.`,
    },
    {
      title: '2. Що не зашифровано і що ми можемо бачити',
      body: `Шифрування захищає вміст, а не сам факт існування розмови. Наступне зберігається у відкритому вигляді на наших серверах:

• Хто перебуває в кожній розмові та коли її створено й коли вона востаннє була активна.
• Часова мітка кожного повідомлення та скільки з них ви не прочитали.
• Ім'я файлу, тип і розмір вкладення. Байти зашифровані; їхній опис — ні, а довжина шифротексту також обмежує довжину оригіналу.
• Ваші друзі та запити на дружбу.
• Сигналізація дзвінка — те, що дзвінок було здійснено, кому і коли. Не його аудіо чи відео.

Індикатори набору тексту й підтвердження прочитання вимкнені, доки ви їх не увімкнете, і поки вони вимкнені, нічого не записується.

Чого тут більше немає: вашої електронної пошти та вашого імені. З вересня 2026 року запис облікового запису містить лише ідентифікатор облікового запису — і відтоді ніде немає адреси для зберігання. Реєстрація не запитує про вас нічого: ваш обліковий запис — це 24-слівна фраза відновлення, а облікові дані, які перевіряє Firebase Authentication, походять із неї. Те, що вона зберігає, — це лише випадкова мітка під доменом, який не може отримувати пошту.

Окремо: оскільки застосунок працює на Google Firebase, Google може бачити IP-адресу та час кожного з'єднання, яке ваш пристрій із ним встановлює. Це властивість хостингу, а не застосунку, і ми не можемо зашифрувати це геть.`,
    },
    {
      title: '3. Як люди вас знаходять',
      body: `Вони не можуть вас шукати. Тут немає каталогу — жодного пошуку за електронною поштою, номером телефону чи ім'ям — і сервер відхиляє будь-який такий запит.

Ви досягаєте когось, надсилаючи посилання-запрошення поза застосунком, будь-яким каналом, яким уже користуєтеся. Посилання працює один раз, закінчується через 24 години, і його можна відкликати. Те, як ви когось називаєте, — це ваша власна мітка для нього, збережена лише у вас; якщо він представився сам, це ім'я дійшло до вас зашифрованим.`,
    },
    {
      title: '4. Що ми збираємо',
      body: `• Дані облікового запису: ідентифікатор облікового запису та облікові дані, отримані з вашої фрази відновлення, що зберігаються у Firebase Authentication. Жодної електронної пошти, жодного номера телефону, жодного імені — реєстрація не запитує жодного з них.
• Шифротекст повідомлень і вкладень, а також метадані з розділу 2.

Це весь список. Немає ні аналітики, ні звітів про збої. Цей застосунок раніше надсилав перегляди екранів до Firebase Analytics і звіти про збої до Firebase Crashlytics, обидва з вашим ідентифікатором облікового запису, тож жоден із них не був анонімним; тепер обидва зникли разом із бібліотеками, які їх надсилали. Помилки друкуються лише на власному комп'ютері розробника під час розробки й нікуди більше не потрапляють.`,
    },
    {
      title: '5. Де це зберігається',
      body: `На Google Firebase — Firestore, Storage та Authentication — за правилами безпеки, які визначають, хто може читати й записувати кожен документ.

На вашому пристрої кешовані повідомлення, налаштування та PIN-код блокування застосунку зашифровані ключем, унікальним для пристрою, який зберігається в сховищі ключів платформи (Keychain на iOS, Keystore на Android), а не у звичайному сховищі застосунку.

Приватний ключ, який розшифровує ваші повідомлення, ніколи не залишає ваш пристрій, окрім як у вигляді фрази відновлення, яку ви вирішуєте записати. Ми його не зберігаємо і не можемо відновити для вас. Якщо ви його втратите, повідомлення, надіслані на той пристрій, більше не можна буде прочитати — нікому, включно з нами.`,
    },
    {
      title: '6. Хто ще отримує дані',
      body: `Ми не продаємо, не обмінюємо й не здаємо в оренду вашу особисту інформацію. Дані потрапляють до:

• Google Firebase — нашого постачальника хостингу, як описано вище.
• Cloudflare Realtime — аудіо та відео дзвінка, коли ваш пристрій і пристрій співрозмовника не можуть з'єднатися напряму.
• Фонду Вікімедіа — одне ім'я, коли ви торкаєтеся його, щоб знайти у Вікіпедії.
• Google Cloud Speech-to-Text — аудіо одного голосового повідомлення, коли ви просите транскрипцію.
• Google Cloud Translation — текст одного повідомлення, коли ви просите переклад.
• Cloudflare Workers AI — до 50 останніх повідомлень однієї розмови, коли ви просите підсумок або ставите про неї запитання.

Останні три вимкнені в цій версії. У жодному місці застосунку немає елемента керування, який би вмикав транскрипцію, переклад чи підсумки, тож нічого не потрапляє до цих трьох служб. Вони перелічені, а не видалені, тому що код усе ще тут, а ці функції мають повернутися — і коли вони повернуться, вони повернуться з цим розкриттям інформації та підказкою перед першим використанням. Те, що буде надіслано тоді, надсилається, щоб створити ваш результат, а не щоб щось навчати; ані транскрипція, ані переклад не зберігаються на наших серверах.

У пошуку Вікіпедії немає перемикача, тому що немає нічого постійного, щоб вимкнути: він виконується лише за дотиком і в іншому разі — ні. Вікіпедія отримує лише те одне ім'я та вашу IP-адресу, точно так, ніби ви самі ввели його в поле пошуку — без облікового запису, без повідомлення, без розмови. Те, що повертається, лише показується й не зберігається, і нічого з цього не записується в розмову.

У Cloudflare Realtime також немає перемикача. Більшості дзвінків він не потрібен: два пристрої, які можуть з'єднатися напряму — більшість дзвінків в одній мережі — з'єднуються без нього, і нічого не ретранслюється. Коли це неможливо — зазвичай тому, що ви перебуваєте в різних мобільних мережах — уже зашифрований дзвінок ретранслюється, а не залишається без з'єднання. Cloudflare бачить обидві IP-адреси, час дзвінка та приблизний обсяг переданих даних; аудіо та відео залишаються під тим самим шифруванням DTLS-SRTP, описаним у розділі 2, тож ретрансляція їх не розшифровує.

Ми можемо розкрити те, що ми зберігаємо, якщо цього вимагає закон. Те, що ми зберігаємо, — це список із розділу 2. Ми не можемо надати вміст повідомлень, тому що ми не можемо їх прочитати.`,
    },
    {
      title: '7. Push-сповіщення',
      body: `Firebase Cloud Messaging доставляє сповіщення. Токен вашого пристрою зберігається в приватній частині вашого облікового запису, яку можете прочитати лише ви.

Сповіщення не містять жодного тексту повідомлення. Ваш пристрій розшифровує повідомлення локально й складає те, що ви бачите; Google доставляє конверт, а не вміст.`,
    },
    {
      title: '8. Що ви можете зробити',
      body: `• Видалити свій обліковий запис з екрана Профілю. Вміст, який є спільною частиною розмови — наприклад, запис дзвінка — залишається в іншого учасника, оскільки це також і його запис.
• Експортувати свої дані з екрана Профілю.
• Встановити термін дії повідомлень для кожного чату: 1 годину, 24 години, 7 днів або 30 днів.
• Увімкнути або вимкнути індикатори набору тексту й підтвердження прочитання. Обидва вимкнені за замовчуванням.
• Заблокувати застосунок PIN-кодом або біометрією.
• Відкликати видане вами посилання-запрошення.

Якщо ви хочете, щоб ми видалили щось вручну, напишіть нам.`,
    },
    {
      title: '9. Зберігання даних',
      body: `Ми зберігаємо ваші дані, поки існує ваш обліковий запис. Видалення облікового запису видаляє їх, окрім спільно збереженого вмісту, зазначеного вище. Термін дії для кожного чату видаляє повідомлення за встановленим вами графіком.`,
    },
    {
      title: '10. Обмеження, про які варто знати',
      body: `Ми б краще розповіли вам про них, ніж дозволили вам їх виявити самостійно.

• Ключам довіряють, коли їх бачать вперше. Якби хтось підмінив ключ до того, як ви коли-небудь обмінялися повідомленням, розмова була б зашифрована не для тієї людини і виглядала б цілком нормально. Застосунок попереджає вас, коли ключ пізніше змінюється, і показує номер безпеки, який можна порівняти поза застосунком — але ніщо не змушує вас його порівнювати.
• Один пристрій за раз. Ваша фраза відновлення повертає ключ, який відкриває вашу історію, тож вхід на новому пристрої не втрачає те, що ви вже отримали. Розмови з випереджувальною таємністю використовують другий ключ, який ніколи не залишає пристрій, що його створив: до нього доходить той пристрій, який увійшов останнім, а все, що тим часом запечатане для іншого пристрою, не може бути туди перенесено.
• Повідомлення, надіслані до появи шифрування, залишаються такими, якими були. Нічого не було перетворено заднім числом.
• Цей застосунок ніколи не проходив незалежного аудиту безпеки.`,
    },
    {
      title: '11. Діти',
      body: `Chatterbox не призначений для дітей віком до 13 років, і ми свідомо не збираємо їхню інформацію. Якщо ви вважаєте, що дитина надала нам особисту інформацію, зв'яжіться з нами, і ми її видалимо.`,
    },
    {
      title: '12. Зміни',
      body: `Ми можемо оновлювати цю політику. Про суттєві зміни буде оголошено в застосунку, а дата вгорі — це коли вона востаннє змінювалася.`,
    },
    {
      title: '13. Контакти',
      body: `Питання щодо цієї політики: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Перевірка новішої версії застосунку',
      body: `Google Play — це не той спосіб, яким цей застосунок потрапляє на ваш телефон Android. Натомість він завантажується з chatterbox.fans, а магазин, який не бере участі в цьому процесі, не може перевіряти оновлення від вашого імені — тож це може робити сам застосунок, якщо ви попросите.

Натискання «Перевірити зараз» надсилає один запит до chatterbox.fans із запитанням, яка версія є актуальною. Цей запит містить лише вашу IP-адресу і більше нічого — жодного облікового запису, жодного ідентифікатора пристрою, жодного повідомлення. У відповідь приходить номер версії, який порівнюється на вашому телефоні з версією, яку ви використовуєте; нічого не завантажується автоматично, і нічого про цю перевірку не записується в розмову.

У цього немає перемикача, бо нічого вимикати: це виконується лише при натисканні і ніяк інакше.

Якщо ви встановите оновлення, воно замінить застосунок на місці, використовуючи той самий ключ підпису — так само, як це зробило б оновлення з Google Play.`,
    },
  ],

  id: [
    {
      title: '0. Singkatnya',
      body: `Teks pesan Anda dienkripsi di perangkat Anda dan hanya dapat dibaca oleh orang yang Anda kirimi. Kami tidak dapat membacanya, begitu pula Google, yang servernya kami sewa.

Yang dapat kami lihat adalah bahwa sebuah percakapan terjadi: akun mana saja yang terlibat, dan kapan mereka aktif. Menghilangkan ini lebih sulit daripada mengenkripsi isinya, dan kami belum menyelesaikannya. Kebijakan ini menyatakan dengan tepat di mana batasnya saat ini.`,
    },
    {
      title: '1. Apa yang dienkripsi ujung ke ujung',
      body: `Dienkripsi di perangkat Anda, tidak dapat dibaca oleh kami dan Google:

• Teks pesan Anda.
• Isi file, foto, audio, dan video yang Anda lampirkan.
• Pratinjau tautan.
• Panggilan suara dan video, yang menggunakan DTLS-SRTP wajib dari WebRTC antara kedua perangkat.

Sebagian besar pesan satu-satu dan grup juga menggunakan ratchet, artinya setiap pesan memiliki kuncinya sendiri, sehingga kompromi pada perangkat Anda tidak mengungkap pesan-pesan sebelumnya. Percakapan di mana klien seseorang belum menerbitkan materi kunci yang lebih baru kembali ke satu kunci yang berumur panjang, yang tidak memiliki sifat itu. Label di bawah pesan memberi tahu Anda mana yang sebenarnya diterima.

Hanya satu hal yang melintasi batas ini, dan hanya ketika Anda memintanya: mencari nama di Wikipedia hanya mengirimkan nama tersebut, bukan pesan asalnya. Bagian 6 menjelaskan siapa yang menerimanya, dan pencarian hanya berjalan saat diketuk dan tidak dengan cara lain, jadi tidak ada yang perlu dimatikan. Meringkas, menerjemahkan, dan mentranskrip juga akan melintasi batas ini — fitur-fitur itu dimatikan pada rilis ini, dan tidak ada kontrol di mana pun dalam aplikasi yang menyalakannya.`,
    },
    {
      title: '2. Apa yang tidak dienkripsi, dan apa yang dapat kami lihat',
      body: `Enkripsi melindungi isi, bukan fakta bahwa percakapan itu terjadi. Berikut ini tersimpan secara terbuka di server kami:

• Siapa saja yang ada di setiap percakapan, dan kapan itu dibuat serta terakhir aktif.
• Stempel waktu setiap pesan, dan berapa banyak yang belum Anda baca.
• Nama file, jenis, dan ukuran lampiran. Bytenya dienkripsi; deskripsinya tidak, dan panjang teks sandi juga membatasi panjang aslinya.
• Teman dan permintaan pertemanan Anda.
• Sinyal panggilan — bahwa panggilan telah dilakukan, kepada siapa, dan kapan. Bukan audio atau videonya.

Indikator mengetik dan tanda terima baca nonaktif kecuali Anda mengaktifkannya, dan selama nonaktif tidak ada yang dicatat.

Yang sudah tidak ada lagi di sini: alamat email dan nama Anda. Sejak September 2026, catatan akun hanya menyimpan pengenal akun — dan sejak itu tidak ada lagi alamat untuk disimpan di mana pun. Pendaftaran tidak menanyakan apa pun tentang Anda: akun Anda adalah frasa pemulihan 24 kata, dan kredensial yang diperiksa Firebase Authentication berasal dari itu. Yang disimpannya hanyalah label acak di bawah domain yang tidak dapat menerima surat.

Secara terpisah: karena aplikasi berjalan di Google Firebase, Google dapat melihat alamat IP dan waktu setiap koneksi yang dibuat perangkat Anda kepadanya. Itu adalah sifat dari hosting, bukan aplikasi, dan kami tidak dapat mengenkripsinya.`,
    },
    {
      title: '3. Bagaimana orang menemukan Anda',
      body: `Mereka tidak dapat mencari Anda. Tidak ada direktori di sini — tidak ada pencarian berdasarkan email, nomor telepon, atau nama — dan server menolak permintaan semacam itu.

Anda menjangkau seseorang dengan mengirimkan tautan undangan di luar jalur, melalui apa pun yang sudah Anda gunakan. Tautan berfungsi sekali, kedaluwarsa setelah 24 jam, dan dapat ditarik. Apa pun sebutan Anda untuk seseorang adalah label Anda sendiri untuk mereka, disimpan hanya untuk Anda; jika mereka memperkenalkan diri, nama itu sampai kepada Anda dalam keadaan terenkripsi.`,
    },
    {
      title: '4. Apa yang kami kumpulkan',
      body: `• Data akun: pengenal akun, dan kredensial yang berasal dari frasa pemulihan Anda, disimpan di Firebase Authentication. Tidak ada alamat email, tidak ada nomor telepon, tidak ada nama — pendaftaran tidak menanyakan salah satunya.
• Teks sandi pesan dan lampiran, ditambah metadata pada bagian 2.

Itulah seluruh daftarnya. Tidak ada analitik dan tidak ada pelaporan crash. Aplikasi ini dulunya mengirim tampilan layar ke Firebase Analytics dan laporan crash ke Firebase Crashlytics, keduanya membawa pengenal akun Anda, sehingga tidak ada yang anonim; keduanya sudah hilang, bersama pustaka yang mengirimkannya. Kesalahan dicetak hanya di komputer pengembang sendiri selama pengembangan dan tidak pergi ke mana pun.`,
    },
    {
      title: '5. Di mana ini disimpan',
      body: `Di Google Firebase — Firestore, Storage, dan Authentication — di bawah aturan keamanan yang menentukan siapa yang boleh membaca dan menulis setiap dokumen.

Di perangkat Anda, pesan yang di-cache, pengaturan, dan PIN kunci aplikasi dienkripsi dengan kunci khusus per perangkat yang disimpan di penyimpanan kunci platform (Keychain di iOS, Keystore di Android) daripada di penyimpanan aplikasi biasa.

Kunci privat yang mendekripsi pesan Anda tidak pernah meninggalkan perangkat Anda, kecuali sebagai frasa pemulihan yang Anda pilih untuk dituliskan. Kami tidak menyimpannya dan tidak dapat memulihkannya untuk Anda. Jika hilang, pesan yang dikirim ke perangkat itu tidak dapat dibaca lagi — oleh siapa pun, termasuk kami.`,
    },
    {
      title: '6. Siapa lagi yang menerima data',
      body: `Kami tidak menjual, memperdagangkan, atau menyewakan informasi pribadi Anda. Data mencapai:

• Google Firebase — penyedia hosting kami, seperti dijelaskan di atas.
• Cloudflare Realtime — audio dan video panggilan, ketika perangkat Anda dan perangkat orang lain tidak dapat saling menjangkau secara langsung.
• Wikimedia Foundation — satu nama, ketika Anda mengetuknya untuk mencarinya di Wikipedia.
• Google Cloud Speech-to-Text — audio dari satu pesan suara, ketika Anda meminta transkrip.
• Google Cloud Translation — teks dari satu pesan, ketika Anda meminta terjemahan.
• Cloudflare Workers AI — hingga 50 pesan terakhir dari satu percakapan, ketika Anda meminta ringkasan atau mengajukan pertanyaan tentangnya.

Tiga yang terakhir dimatikan pada rilis ini. Tidak ada kontrol di mana pun dalam aplikasi yang menyalakan transkripsi, terjemahan, atau ringkasan, sehingga tidak ada yang mencapai tiga layanan itu. Layanan itu terdaftar alih-alih dihapus karena kodenya masih ada di sini dan fitur-fitur ini dimaksudkan untuk kembali — dan saat kembali, mereka akan kembali dengan pengungkapan ini dan permintaan sebelum penggunaan pertama. Apa yang akan dikirim saat itu dikirim untuk menghasilkan hasil Anda, bukan untuk melatih apa pun; baik transkrip maupun terjemahan tidak disimpan di server kami.

Pencarian Wikipedia tidak memiliki sakelar karena tidak ada yang bersifat tetap untuk dimatikan: itu hanya berjalan saat diketuk dan tidak dengan cara lain. Wikipedia menerima hanya nama itu dan alamat IP Anda, persis seperti jika Anda sendiri mengetiknya di kotak pencariannya — tanpa akun, tanpa pesan, tanpa percakapan. Apa yang dikembalikan hanya ditampilkan dan tidak disimpan, dan tidak ada apa pun tentangnya yang dituliskan ke percakapan.

Cloudflare Realtime juga tidak memiliki sakelar. Sebagian besar panggilan tidak memerlukannya: dua perangkat yang dapat saling menjangkau secara langsung — sebagian besar panggilan di jaringan yang sama — terhubung tanpanya, dan tidak ada yang diteruskan. Ketika tidak bisa — biasanya karena Anda berdua berada di jaringan seluler yang berbeda — panggilan yang sudah terenkripsi diteruskan alih-alih dibiarkan tidak dapat terhubung. Yang dilihat Cloudflare adalah kedua alamat IP, waktu panggilan, dan perkiraan jumlah data yang berpindah; audio dan video tetap berada dalam enkripsi DTLS-SRTP yang sama seperti dijelaskan di bagian 2, jadi penerusan tidak mendekripsinya.

Kami dapat mengungkapkan apa yang kami simpan jika hukum mengharuskannya. Apa yang kami simpan adalah daftar pada bagian 2. Kami tidak dapat memberikan isi pesan, karena kami tidak dapat membacanya.`,
    },
    {
      title: '7. Notifikasi push',
      body: `Firebase Cloud Messaging mengirimkan notifikasi. Token perangkat Anda disimpan di bagian pribadi akun Anda yang hanya dapat Anda baca.

Notifikasi tidak membawa teks pesan apa pun. Perangkat Anda mendekripsi pesan secara lokal dan menyusun apa yang Anda lihat; Google mengirimkan amplopnya, bukan isinya.`,
    },
    {
      title: '8. Apa yang dapat Anda lakukan',
      body: `• Hapus akun Anda dari layar Profil. Konten yang menjadi bagian bersama dari sebuah percakapan — misalnya catatan panggilan — tetap ada pada peserta lain, karena itu juga catatan mereka.
• Ekspor data Anda dari layar Profil.
• Atur kedaluwarsa pesan per obrolan: 1 jam, 24 jam, 7 hari, atau 30 hari.
• Aktifkan atau nonaktifkan indikator mengetik dan tanda terima baca. Keduanya nonaktif secara default.
• Kunci aplikasi dengan PIN atau biometrik.
• Tarik tautan undangan yang telah Anda bagikan.

Jika Anda lebih suka kami menghapus sesuatu secara manual, tulis kepada kami.`,
    },
    {
      title: '9. Retensi',
      body: `Kami menyimpan data Anda selama akun Anda ada. Menghapus akun akan menghapusnya, kecuali konten yang dimiliki bersama yang disebutkan di atas. Kedaluwarsa per obrolan menghapus pesan sesuai jadwal yang Anda atur.`,
    },
    {
      title: '10. Batasan yang perlu Anda ketahui',
      body: `Kami lebih suka memberi tahu Anda tentang ini daripada membiarkan Anda menemukannya sendiri.

• Kunci dipercaya pada pertama kali dilihat. Jika seseorang mengganti kunci sebelum Anda pernah bertukar pesan, percakapan akan dienkripsi ke orang yang salah dan akan tampak sepenuhnya normal. Aplikasi memperingatkan Anda saat kunci berubah setelahnya, dan menampilkan nomor keamanan yang dapat Anda bandingkan di luar jalur — tetapi tidak ada yang memaksa Anda untuk membandingkannya.
• Satu perangkat pada satu waktu. Frasa pemulihan Anda memulihkan kunci yang membuka riwayat Anda, sehingga masuk di perangkat baru tidak menghilangkan apa yang sudah Anda terima. Percakapan dengan kerahasiaan maju menggunakan kunci kedua yang tidak pernah meninggalkan perangkat yang membuatnya: perangkat mana pun yang terakhir masuk adalah yang dijangkau oleh pesan-pesan itu, dan apa pun yang disegel untuk perangkat lain sementara itu tidak dapat dipindahkan ke sana.
• Pesan yang dikirim sebelum enkripsi ada tetap seperti semula. Tidak ada yang dikonversi secara retroaktif.
• Aplikasi ini belum pernah diaudit keamanannya secara independen.`,
    },
    {
      title: '11. Anak-anak',
      body: `Chatterbox tidak ditujukan untuk anak-anak di bawah usia 13 tahun, dan kami tidak secara sengaja mengumpulkan informasi mereka. Jika Anda yakin seorang anak telah memberi kami informasi pribadi, hubungi kami dan kami akan menghapusnya.`,
    },
    {
      title: '12. Perubahan',
      body: `Kami dapat memperbarui kebijakan ini. Perubahan signifikan akan diumumkan di aplikasi, dan tanggal di bagian atas adalah kapan kebijakan ini terakhir diubah.`,
    },
    {
      title: '13. Kontak',
      body: `Pertanyaan tentang kebijakan ini: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Memeriksa versi aplikasi yang lebih baru',
      body: `Google Play bukan cara aplikasi ini sampai ke ponsel Android Anda. Aplikasi ini diunduh dari chatterbox.fans, dan toko yang tidak dilibatkan tidak dapat memeriksa pembaruan atas nama Anda — jadi aplikasi ini bisa melakukannya sendiri, jika Anda memintanya.

Mengetuk "Periksa sekarang" mengirim satu permintaan ke chatterbox.fans yang menanyakan versi mana yang terbaru. Permintaan itu hanya membawa alamat IP Anda dan tidak ada yang lain — tanpa akun, tanpa pengenal perangkat, tanpa pesan. Yang kembali adalah nomor versi, dibandingkan di ponsel Anda dengan versi yang sedang Anda jalankan; tidak ada yang diunduh secara otomatis, dan tidak ada apa pun tentang pemeriksaan ini yang ditulis ke percakapan.

Ini tidak memiliki sakelar karena tidak ada yang perlu dimatikan: ini hanya berjalan saat diketuk dan tidak dengan cara lain.

Jika Anda menginstal pembaruan, itu akan mengganti aplikasi di tempatnya menggunakan kunci penandatanganan yang sama, sama seperti yang akan dilakukan pembaruan dari Google Play.`,
    },
  ],

  bn: [
    {
      title: '0. সংক্ষেপে',
      body: `আপনার বার্তার লেখা আপনার ডিভাইসে এনক্রিপ্ট করা হয় এবং শুধু আপনি যাদের পাঠান তারাই এটি পড়তে পারে। আমরা এটি পড়তে পারি না, এবং আমরা যাদের সার্ভার ভাড়া নিই সেই Google-ও পারে না।

আমরা যা দেখতে পাই তা হলো একটি কথোপকথন হয়েছে: এতে কোন অ্যাকাউন্টগুলো আছে, এবং তারা কখন সক্রিয় ছিল। বিষয়বস্তু এনক্রিপ্ট করার চেয়ে এটি সরানো অনেক কঠিন, এবং আমরা এখনো তা শেষ করিনি। এই নীতিটি ঠিক বলে দেয় বর্তমানে সীমারেখা কোথায় টানা আছে।`,
    },
    {
      title: '1. কী এন্ড-টু-এন্ড এনক্রিপ্টেড',
      body: `আপনার ডিভাইসে এনক্রিপ্ট করা, আমাদের ও Google-এর জন্য পড়া অসম্ভব:

• আপনার বার্তার লেখা।
• আপনার সংযুক্ত করা ফাইল, ছবি, অডিও এবং ভিডিওর বিষয়বস্তু।
• লিঙ্ক প্রিভিউ।
• ভয়েস ও ভিডিও কল, যা দুটি ডিভাইসের মধ্যে WebRTC-এর বাধ্যতামূলক DTLS-SRTP ব্যবহার করে।

বেশিরভাগ একের সাথে এক ও গ্রুপ বার্তা অতিরিক্তভাবে একটি র‍্যাচেট ব্যবহার করে, অর্থাৎ প্রতিটি বার্তার নিজস্ব চাবি থাকে, তাই আপনার ডিভাইস আপোস হলেও আগের বার্তাগুলো প্রকাশ পায় না। যেসব কথোপকথনে কারো ক্লায়েন্ট এখনো নতুন চাবির উপাদান প্রকাশ করেনি, সেগুলো একটি একক দীর্ঘস্থায়ী চাবিতে ফিরে যায়, যার এই বৈশিষ্ট্য নেই। বার্তার নিচের লেবেলটি আপনাকে বলে এটি আসলে কোনটি পেয়েছে।

শুধু একটি জিনিসই এই সীমারেখা অতিক্রম করে, এবং শুধু তখনই যখন আপনি নিজে অনুরোধ করেন: উইকিপিডিয়ায় একটি নাম খোঁজা শুধু সেই একটি নাম পাঠায়, যে বার্তা থেকে এটি এসেছে তা নয়। ধারা ৬ বলে কে এটি পায়, এবং অনুসন্ধান শুধু ট্যাপের সময় চলে, অন্যথায় নয়, তাই বন্ধ করার মতো কিছু নেই। সারসংক্ষেপ, অনুবাদ এবং প্রতিলিপি তৈরিও এই সীমারেখা অতিক্রম করত — এই সংস্করণে এগুলো বন্ধ আছে, এবং অ্যাপের কোথাও এমন কোনো নিয়ন্ত্রণ নেই যা এগুলো চালু করে।`,
    },
    {
      title: '2. কী এনক্রিপ্ট করা নয়, এবং আমরা কী দেখতে পাই',
      body: `এনক্রিপশন বিষয়বস্তু রক্ষা করে, কথোপকথনটি ঘটেছে এই সত্যটি নয়। নিচেরগুলো আমাদের সার্ভারে স্পষ্টভাবে থাকে:

• প্রতিটি কথোপকথনে কে আছে, এবং এটি কখন তৈরি হয়েছিল ও সর্বশেষ কখন সক্রিয় ছিল।
• প্রতিটি বার্তার সময়ছাপ, এবং আপনি কতগুলো পড়েননি।
• একটি সংযুক্তির ফাইলের নাম, ধরন এবং আকার। বাইটগুলো এনক্রিপ্টেড; তাদের বর্ণনা নয়, এবং সাইফারটেক্সটের দৈর্ঘ্য মূল ফাইলের দৈর্ঘ্যকেও সীমাবদ্ধ করে।
• আপনার বন্ধু এবং বন্ধুত্বের অনুরোধ।
• কল সিগন্যালিং — একটি কল করা হয়েছিল, কাকে, এবং কখন। এর অডিও বা ভিডিও নয়।

টাইপিং সূচক এবং রিড রিসিট আপনি চালু না করা পর্যন্ত বন্ধ থাকে, এবং বন্ধ থাকা অবস্থায় কিছুই লেখা হয় না।

যা আর এখানে নেই: আপনার ইমেইল ঠিকানা এবং আপনার নাম। ২০২৬ সালের সেপ্টেম্বর থেকে, অ্যাকাউন্ট রেকর্ডে শুধু একটি অ্যাকাউন্ট শনাক্তকারী আছে — এবং তখন থেকে কোথাও রাখার মতো কোনো ঠিকানা নেই। সাইন আপ আপনার সম্পর্কে কিছুই জিজ্ঞাসা করে না: আপনার অ্যাকাউন্ট একটি ২৪-শব্দের পুনরুদ্ধার বাক্যাংশ, এবং Firebase Authentication যা যাচাই করে তা এটি থেকেই উদ্ভূত। এটি যা সংরক্ষণ করে তা শুধু এমন একটি ডোমেইনের অধীনে একটি এলোমেলো লেবেল যা কোনো মেইল গ্রহণ করতে পারে না।

আলাদাভাবে: যেহেতু অ্যাপটি Google Firebase-এ চলে, Google আপনার ডিভাইস এর সাথে করা প্রতিটি সংযোগের IP ঠিকানা এবং সময় দেখতে পারে। এটি হোস্টিংয়ের একটি বৈশিষ্ট্য, অ্যাপের নয়, এবং আমরা এটি এনক্রিপ্ট করে সরাতে পারি না।`,
    },
    {
      title: '3. মানুষ আপনাকে কীভাবে খুঁজে পায়',
      body: `তারা আপনাকে খুঁজতে পারে না। এখানে কোনো ডিরেক্টরি নেই — ইমেইল, ফোন নম্বর বা নাম দিয়ে কোনো অনুসন্ধান নেই — এবং সার্ভার এমন যেকোনো অনুরোধ প্রত্যাখ্যান করে।

আপনি কারো কাছে পৌঁছান একটি আমন্ত্রণ লিঙ্ক অন্য মাধ্যমে পাঠিয়ে, আপনি ইতিমধ্যে ব্যবহার করেন এমন যেকোনো কিছুর মাধ্যমে। একটি লিঙ্ক একবার কাজ করে, ২৪ ঘণ্টা পর মেয়াদ শেষ হয়, এবং প্রত্যাহার করা যায়। আপনি কাউকে যা বলে ডাকেন তা তাদের জন্য আপনার নিজস্ব লেবেল, শুধু আপনার জন্য রাখা; যদি তারা নিজের পরিচয় দিয়ে থাকে, সেই নামটি আপনার কাছে এনক্রিপ্টেড অবস্থায় পৌঁছেছে।`,
    },
    {
      title: '4. আমরা কী সংগ্রহ করি',
      body: `• অ্যাকাউন্টের তথ্য: একটি অ্যাকাউন্ট শনাক্তকারী, এবং আপনার পুনরুদ্ধার বাক্যাংশ থেকে উদ্ভূত একটি শংসাপত্র, Firebase Authentication-এ সংরক্ষিত। কোনো ইমেইল ঠিকানা নেই, কোনো ফোন নম্বর নেই, কোনো নাম নেই — সাইন আপ এর কোনোটিই জিজ্ঞাসা করে না।
• বার্তা ও সংযুক্তির সাইফারটেক্সট, প্লাস ধারা ২-এ বর্ণিত মেটাডেটা।

এটাই সম্পূর্ণ তালিকা। কোনো অ্যানালিটিক্স নেই এবং কোনো ক্র্যাশ রিপোর্টিং নেই। এই অ্যাপটি আগে স্ক্রিন ভিউ Firebase Analytics-এ এবং ক্র্যাশ রিপোর্ট Firebase Crashlytics-এ পাঠাত, উভয়ই আপনার অ্যাকাউন্ট শনাক্তকারী বহন করত, তাই কোনোটিই নামহীন ছিল না; এখন উভয়ই, তাদের পাঠানো লাইব্রেরিগুলোসহ, বাদ দেওয়া হয়েছে। ত্রুটিগুলো শুধু ডেভেলপমেন্টের সময় একজন ডেভেলপারের নিজের কম্পিউটারে প্রিন্ট হয় এবং অন্য কোথাও যায় না।`,
    },
    {
      title: '5. এটি কোথায় সংরক্ষিত থাকে',
      body: `Google Firebase-এ — Firestore, Storage এবং Authentication — এমন নিরাপত্তা নিয়মের অধীনে যা নির্ধারণ করে কে প্রতিটি ডকুমেন্ট পড়তে ও লিখতে পারে।

আপনার ডিভাইসে, ক্যাশে করা বার্তা, সেটিংস এবং অ্যাপ-লক পিন সাধারণ অ্যাপ স্টোরেজের বদলে প্ল্যাটফর্মের কি-স্টোরে (iOS Keychain, Android Keystore) রাখা একটি প্রতি-ডিভাইস চাবি দিয়ে এনক্রিপ্ট করা হয়।

আপনার বার্তা ডিক্রিপ্ট করার প্রাইভেট চাবিটি কখনো আপনার ডিভাইস ছেড়ে যায় না, শুধু আপনি লিখে রাখতে বেছে নেওয়া পুনরুদ্ধার বাক্যাংশ হিসেবে ছাড়া। আমরা এটি ধরে রাখি না এবং আপনার জন্য এটি পুনরুদ্ধার করতে পারি না। এটি হারালে, সেই ডিভাইসে পাঠানো বার্তাগুলো আর পড়া যাবে না — কারো দ্বারাই না, আমাদের সহ।`,
    },
    {
      title: '6. আর কে তথ্য পায়',
      body: `আমরা আপনার ব্যক্তিগত তথ্য বিক্রি, বিনিময় বা ভাড়া দিই না। তথ্য পৌঁছায়:

• Google Firebase — উপরে বর্ণিত আমাদের হোস্টিং প্রদানকারী।
• Cloudflare Realtime — কলের অডিও এবং ভিডিও, যখন আপনার ডিভাইস এবং অন্য ব্যক্তির ডিভাইস সরাসরি একে অপরের কাছে পৌঁছাতে পারে না।
• উইকিমিডিয়া ফাউন্ডেশন — একটি নাম, যখন আপনি এটি উইকিপিডিয়ায় খুঁজতে ট্যাপ করেন।
• Google Cloud Speech-to-Text — একটি ভয়েস বার্তার অডিও, যখন আপনি প্রতিলিপি অনুরোধ করেন।
• Google Cloud Translation — একটি বার্তার লেখা, যখন আপনি অনুবাদ অনুরোধ করেন।
• Cloudflare Workers AI — একটি কথোপকথনের সর্বশেষ ৫০টি পর্যন্ত বার্তা, যখন আপনি সারাংশ চান বা এটি সম্পর্কে প্রশ্ন করেন।

শেষ তিনটি এই সংস্করণে বন্ধ আছে। অ্যাপের কোথাও এমন কোনো নিয়ন্ত্রণ নেই যা প্রতিলিপি, অনুবাদ বা সারাংশ চালু করে, তাই এই তিনটি পরিষেবার কাছে কিছুই পৌঁছায় না। এগুলো মুছে ফেলার বদলে তালিকাভুক্ত করা আছে কারণ কোডটি এখনো এখানে আছে এবং এই ফিচারগুলো ফিরে আসার কথা — এবং যখন ফিরবে, তারা এই প্রকাশনার সাথে এবং প্রথম ব্যবহারের আগে একটি প্রম্পট সহ ফিরবে। তখন যা পাঠানো হবে তা আপনার ফলাফল তৈরি করার জন্য পাঠানো হয়, কিছু প্রশিক্ষণের জন্য নয়; প্রতিলিপি বা অনুবাদ কোনোটিই আমাদের সার্ভারে সংরক্ষিত হয় না।

উইকিপিডিয়া অনুসন্ধানের কোনো সুইচ নেই কারণ বন্ধ করার মতো স্থায়ী কিছু নেই: এটি শুধু ট্যাপের সময় চলে, অন্যথায় নয়। উইকিপিডিয়া শুধু সেই একটি নাম এবং আপনার IP ঠিকানা পায়, ঠিক যেমন আপনি নিজে এটি তাদের অনুসন্ধান বক্সে টাইপ করলে পেত — কোনো অ্যাকাউন্ট নেই, কোনো বার্তা নেই, কোনো কথোপকথন নেই। যা ফিরে আসে তা শুধু দেখানো হয় এবং সংরক্ষিত হয় না, এবং এ সম্পর্কে কিছুই কথোপকথনে লেখা হয় না।

Cloudflare Realtime-এরও কোনো সুইচ নেই। বেশিরভাগ কলের এটির প্রয়োজন হয় না: দুটি ডিভাইস যারা সরাসরি একে অপরের কাছে পৌঁছাতে পারে — একই নেটওয়ার্কে বেশিরভাগ কল — এটি ছাড়াই সংযুক্ত হয়, এবং কিছুই রিলে হয় না। যখন তারা পারে না — সাধারণত কারণ আপনারা দুজন ভিন্ন ভিন্ন মোবাইল নেটওয়ার্কে আছেন — ইতিমধ্যে এনক্রিপ্ট করা কলটি সংযোগবিহীন থাকার পরিবর্তে রিলে করা হয়। Cloudflare যা দেখে তা হলো উভয়ের IP ঠিকানা, কলের সময়, এবং আনুমানিক কত ডেটা স্থানান্তরিত হয়েছে; অডিও এবং ভিডিও বিভাগ ২-এ বর্ণিত একই DTLS-SRTP এনক্রিপশনের অধীনে থাকে, তাই রিলে করা সেগুলি ডিক্রিপ্ট করে না।

আইন প্রয়োজন হলে আমরা আমাদের কাছে থাকা তথ্য প্রকাশ করতে পারি। আমাদের কাছে যা আছে তা ধারা ২-এর তালিকা। আমরা বার্তার বিষয়বস্তু দিতে পারি না, কারণ আমরা সেগুলো পড়তে পারি না।`,
    },
    {
      title: '7. পুশ নোটিফিকেশন',
      body: `Firebase Cloud Messaging নোটিফিকেশন সরবরাহ করে। আপনার ডিভাইস টোকেন আপনার অ্যাকাউন্টের একটি ব্যক্তিগত অংশে সংরক্ষিত থাকে যা শুধু আপনিই পড়তে পারেন।

নোটিফিকেশনে কোনো বার্তার লেখা থাকে না। আপনার ডিভাইস স্থানীয়ভাবে বার্তাটি ডিক্রিপ্ট করে এবং আপনি যা দেখেন তা তৈরি করে; Google খামটি পৌঁছে দেয়, বিষয়বস্তু নয়।`,
    },
    {
      title: '8. আপনি কী করতে পারেন',
      body: `• প্রোফাইল স্ক্রিন থেকে আপনার অ্যাকাউন্ট মুছুন। একটি কথোপকথনের যৌথ অংশ এমন বিষয়বস্তু — যেমন একটি কল রেকর্ড — অন্য অংশগ্রহণকারীর কাছে থেকে যায়, কারণ এটি তাদেরও রেকর্ড।
• প্রোফাইল স্ক্রিন থেকে আপনার তথ্য এক্সপোর্ট করুন।
• প্রতি চ্যাটে বার্তার মেয়াদ সেট করুন: ১ ঘণ্টা, ২৪ ঘণ্টা, ৭ দিন বা ৩০ দিন।
• টাইপিং সূচক ও রিড রিসিট চালু বা বন্ধ করুন। উভয়ই ডিফল্টভাবে বন্ধ থাকে।
• পিন বা বায়োমেট্রিক দিয়ে অ্যাপ লক করুন।
• আপনার দেওয়া একটি আমন্ত্রণ লিঙ্ক প্রত্যাহার করুন।

যদি আপনি চান আমরা কিছু হাতে করে মুছে দিই, আমাদের লিখুন।`,
    },
    {
      title: '9. তথ্য ধরে রাখা',
      body: `আপনার অ্যাকাউন্ট থাকা পর্যন্ত আমরা আপনার তথ্য রাখি। অ্যাকাউন্ট মুছে ফেলা এটি মুছে দেয়, উপরে উল্লেখিত যৌথভাবে ধারণকৃত বিষয়বস্তু ছাড়া। প্রতি চ্যাটের মেয়াদ আপনার নির্ধারিত সময়সূচি অনুযায়ী বার্তা সরিয়ে দেয়।`,
    },
    {
      title: '10. সীমাবদ্ধতা যা আপনার জানা উচিত',
      body: `আপনি নিজে এগুলো খুঁজে পাওয়ার চেয়ে আমরা আপনাকে এগুলো বলতে পছন্দ করব।

• প্রথমবার দেখার সময় চাবিগুলোকে বিশ্বাস করা হয়। আপনারা কখনো বার্তা বিনিময় করার আগে যদি কেউ একটি চাবি প্রতিস্থাপন করে থাকে, তাহলে কথোপকথনটি ভুল ব্যক্তির জন্য এনক্রিপ্ট করা হবে এবং সম্পূর্ণ স্বাভাবিক দেখাবে। পরে চাবি পরিবর্তিত হলে অ্যাপ আপনাকে সতর্ক করে, এবং একটি নিরাপত্তা নম্বর দেখায় যা আপনি অন্য মাধ্যমে মিলিয়ে দেখতে পারেন — কিন্তু কিছুই আপনাকে এটি মিলিয়ে দেখতে বাধ্য করে না।
• একবারে একটি ডিভাইস। আপনার পুনরুদ্ধার বাক্যাংশ সেই চাবি ফিরিয়ে আনে যা আপনার ইতিহাস খোলে, তাই নতুন ডিভাইসে সাইন ইন করলে আপনি ইতিমধ্যে যা পেয়েছেন তা হারায় না। ফরওয়ার্ড-সিক্রেসিযুক্ত কথোপকথন একটি দ্বিতীয় চাবি ব্যবহার করে যা এটি তৈরিকারী ডিভাইস কখনো ছেড়ে যায় না: যে ডিভাইস সবশেষে সাইন ইন করেছে সেটিই সেগুলো পৌঁছায়, এবং এর মধ্যে অন্য ডিভাইসের জন্য সিল করা যেকোনো কিছু সেখানে সরানো যায় না।
• এনক্রিপশন থাকার আগে পাঠানো বার্তাগুলো যেমন ছিল তেমনই থাকে। পূর্ববর্তীভাবে কিছুই রূপান্তরিত হয়নি।
• এই অ্যাপটি কখনো স্বাধীনভাবে নিরাপত্তা নিরীক্ষা করা হয়নি।`,
    },
    {
      title: '11. শিশুরা',
      body: `Chatterbox ১৩ বছরের কম বয়সী শিশুদের জন্য উদ্দিষ্ট নয়, এবং আমরা জেনেশুনে তাদের তথ্য সংগ্রহ করি না। আপনি যদি বিশ্বাস করেন কোনো শিশু আমাদের ব্যক্তিগত তথ্য দিয়েছে, আমাদের সাথে যোগাযোগ করুন এবং আমরা এটি মুছে ফেলব।`,
    },
    {
      title: '12. পরিবর্তনসমূহ',
      body: `আমরা এই নীতিটি আপডেট করতে পারি। উল্লেখযোগ্য পরিবর্তনগুলো অ্যাপে ঘোষণা করা হবে, এবং উপরের তারিখটি এটি সর্বশেষ কখন পরিবর্তিত হয়েছে তা নির্দেশ করে।`,
    },
    {
      title: '13. যোগাযোগ',
      body: `এই নীতি সম্পর্কে প্রশ্ন: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. অ্যাপের নতুন সংস্করণ পরীক্ষা করা',
      body: `Google Play এই অ্যাপটি আপনার Android ফোনে পৌঁছানোর উপায় নয়। এটি পরিবর্তে chatterbox.fans থেকে ডাউনলোড করা হয়, এবং যে স্টোর এই প্রক্রিয়ার অংশ নয় তা আপনার পক্ষ থেকে আপডেট পরীক্ষা করতে পারে না — তাই আপনি চাইলে এই অ্যাপ নিজেই এটি করতে পারে।

"এখনই পরীক্ষা করুন"-এ ট্যাপ করলে chatterbox.fans-এ একটি অনুরোধ পাঠানো হয়, যা জিজ্ঞাসা করে বর্তমান সংস্করণ কোনটি। সেই অনুরোধে শুধু আপনার IP ঠিকানা থাকে, আর কিছু নয় — কোনো অ্যাকাউন্ট নয়, ডিভাইস শনাক্তকারী নয়, বার্তা নয়। যা ফিরে আসে তা একটি সংস্করণ নম্বর, যা আপনার ফোনে চলমান সংস্করণের সাথে তুলনা করা হয়; কিছুই স্বয়ংক্রিয়ভাবে ডাউনলোড হয় না, এবং এই পরীক্ষা সম্পর্কে কিছুই কথোপকথনে লেখা হয় না।

এর কোনো সুইচ নেই কারণ বন্ধ করার মতো কিছু নেই: এটি শুধুমাত্র ট্যাপ করলেই চলে, অন্যথায় নয়।

আপনি যদি আপডেট ইনস্টল করেন, তাহলে এটি একই সাইনিং কী ব্যবহার করে অ্যাপটিকে তার জায়গায় প্রতিস্থাপন করে, ঠিক যেমনটি Google Play থেকে একটি আপডেট করত।`,
    },
  ],

  th: [
    {
      title: '0. โดยสรุป',
      body: `ข้อความของคุณถูกเข้ารหัสบนอุปกรณ์ของคุณและสามารถอ่านได้เฉพาะคนที่คุณส่งถึงเท่านั้น เราไม่สามารถอ่านได้ และ Google ซึ่งเราเช่าเซิร์ฟเวอร์มาก็ไม่สามารถอ่านได้เช่นกัน

สิ่งที่เราเห็นได้คือมีการสนทนาเกิดขึ้น: บัญชีใดอยู่ในการสนทนานั้น และพวกเขาใช้งานเมื่อใด การเอาสิ่งนี้ออกไปนั้นยากกว่าการเข้ารหัสเนื้อหา และเรายังทำไม่เสร็จ นโยบายนี้บอกอย่างชัดเจนว่าขอบเขตอยู่ที่ไหนในขณะนี้`,
    },
    {
      title: '1. อะไรบ้างที่เข้ารหัสแบบต้นทางถึงปลายทาง',
      body: `เข้ารหัสบนอุปกรณ์ของคุณ อ่านไม่ได้สำหรับเราและ Google:

• ข้อความของคุณ
• เนื้อหาของไฟล์ รูปภาพ เสียง และวิดีโอที่คุณแนบมา
• ตัวอย่างลิงก์
• การโทรด้วยเสียงและวิดีโอ ซึ่งใช้ DTLS-SRTP ที่บังคับของ WebRTC ระหว่างสองอุปกรณ์

ข้อความแบบตัวต่อตัวและกลุ่มส่วนใหญ่ยังใช้ระบบแรทเชต (ratchet) เพิ่มเติม หมายความว่าแต่ละข้อความมีกุญแจของตัวเอง ดังนั้นการที่อุปกรณ์ของคุณถูกบุกรุกจะไม่เปิดเผยข้อความก่อนหน้านี้ การสนทนาที่ไคลเอนต์ของอีกฝ่ายยังไม่ได้เผยแพร่วัสดุกุญแจที่ใหม่กว่าจะกลับไปใช้กุญแจเดียวที่มีอายุยาวนาน ซึ่งไม่มีคุณสมบัตินั้น ป้ายกำกับใต้ข้อความจะบอกคุณว่าข้อความนั้นได้รับแบบไหนจริงๆ

มีเพียงสิ่งเดียวที่ข้ามขอบเขตนี้ และเฉพาะเมื่อคุณร้องขอเท่านั้น: การค้นหาชื่อในวิกิพีเดียจะส่งเฉพาะชื่อนั้นเท่านั้น ไม่ใช่ข้อความที่มันมาจาก ส่วนที่ 6 บอกว่าใครเป็นผู้รับข้อมูลนี้ และการค้นหาจะทำงานเฉพาะเมื่อแตะเท่านั้น ไม่ใช่วิธีอื่น จึงไม่มีอะไรให้ปิด การสรุป การแปล และการถอดความก็จะข้ามขอบเขตนี้เช่นกัน — ฟีเจอร์เหล่านี้ถูกปิดในรุ่นนี้ และไม่มีการควบคุมใดๆ ในแอปที่จะเปิดใช้งานได้`,
    },
    {
      title: '2. อะไรบ้างที่ไม่ได้เข้ารหัส และเราเห็นอะไรได้บ้าง',
      body: `การเข้ารหัสปกป้องเนื้อหา ไม่ใช่ข้อเท็จจริงที่ว่าการสนทนาเกิดขึ้น สิ่งต่อไปนี้อยู่อย่างเปิดเผยบนเซิร์ฟเวอร์ของเรา:

• ใครอยู่ในการสนทนาแต่ละครั้ง และสร้างขึ้นเมื่อใดและใช้งานล่าสุดเมื่อใด
• การประทับเวลาของทุกข้อความ และคุณยังไม่ได้อ่านกี่ข้อความ
• ชื่อไฟล์ ประเภท และขนาดของไฟล์แนบ ไบต์ถูกเข้ารหัส แต่คำอธิบายไม่ได้ถูกเข้ารหัส และความยาวของข้อความเข้ารหัสยังจำกัดความยาวของต้นฉบับด้วย
• เพื่อนและคำขอเป็นเพื่อนของคุณ
• สัญญาณการโทร — ว่ามีการโทรเกิดขึ้น โทรถึงใคร และเมื่อใด ไม่ใช่เสียงหรือวิดีโอของการโทรนั้น

ตัวบ่งชี้การพิมพ์และใบเสร็จการอ่านปิดอยู่จนกว่าคุณจะเปิด และในขณะที่ปิดอยู่จะไม่มีการบันทึกใดๆ

สิ่งที่ไม่มีอยู่ที่นี่อีกต่อไป: ที่อยู่อีเมลและชื่อของคุณ ตั้งแต่เดือนกันยายน 2026 บันทึกบัญชีมีเพียงตัวระบุบัญชีเท่านั้น — และตั้งแต่นั้นมาก็ไม่มีที่อยู่ให้เก็บไว้ที่ใดเลย การสมัครสมาชิกไม่ได้ถามอะไรเกี่ยวกับคุณเลย: บัญชีของคุณคือวลีกู้คืน 24 คำ และข้อมูลรับรองที่ Firebase Authentication ตรวจสอบนั้นมาจากวลีนั้น สิ่งที่มันเก็บไว้เป็นเพียงป้ายกำกับแบบสุ่มภายใต้โดเมนที่ไม่สามารถรับอีเมลได้

แยกต่างหาก: เนื่องจากแอปทำงานบน Google Firebase, Google สามารถเห็นที่อยู่ IP และเวลาของการเชื่อมต่อทุกครั้งที่อุปกรณ์ของคุณทำกับมัน นี่คือคุณสมบัติของโฮสติ้ง ไม่ใช่ของแอป และเราไม่สามารถเข้ารหัสมันออกไปได้`,
    },
    {
      title: '3. คนอื่นค้นหาคุณได้อย่างไร',
      body: `พวกเขาไม่สามารถค้นหาคุณได้ ที่นี่ไม่มีไดเรกทอรี — ไม่มีการค้นหาด้วยอีเมล หมายเลขโทรศัพท์ หรือชื่อ — และเซิร์ฟเวอร์จะปฏิเสธคำขอใดๆ ที่พยายามทำเช่นนั้น

คุณเข้าถึงใครสักคนโดยการส่งลิงก์คำเชิญนอกช่องทาง ผ่านสิ่งที่คุณใช้อยู่แล้ว ลิงก์ใช้ได้ครั้งเดียว หมดอายุหลังจาก 24 ชั่วโมง และสามารถเพิกถอนได้ สิ่งที่คุณเรียกใครสักคนคือป้ายกำกับของคุณเองสำหรับพวกเขา เก็บไว้เฉพาะสำหรับคุณ หากพวกเขาแนะนำตัวเอง ชื่อนั้นมาถึงคุณแบบเข้ารหัส`,
    },
    {
      title: '4. เราเก็บรวบรวมอะไรบ้าง',
      body: `• ข้อมูลบัญชี: ตัวระบุบัญชีและข้อมูลรับรองที่มาจากวลีกู้คืนของคุณ เก็บไว้ใน Firebase Authentication ไม่มีที่อยู่อีเมล ไม่มีหมายเลขโทรศัพท์ ไม่มีชื่อ — การสมัครสมาชิกไม่ได้ถามข้อมูลใดๆ เหล่านี้เลย
• ข้อความเข้ารหัสของข้อความและไฟล์แนบ บวกกับข้อมูลเมตาในส่วนที่ 2

นั่นคือรายการทั้งหมด ไม่มีการวิเคราะห์และไม่มีการรายงานข้อขัดข้อง แอปนี้เคยส่งการดูหน้าจอไปยัง Firebase Analytics และรายงานข้อขัดข้องไปยัง Firebase Crashlytics ทั้งสองอย่างมีตัวระบุบัญชีของคุณติดไปด้วย จึงไม่มีอย่างใดที่ไม่ระบุตัวตน ตอนนี้ทั้งสองอย่างถูกลบออกแล้ว พร้อมกับไลบรารีที่ส่งข้อมูลเหล่านั้น ข้อผิดพลาดจะถูกพิมพ์เฉพาะบนคอมพิวเตอร์ของนักพัฒนาเองในระหว่างการพัฒนาเท่านั้น และไม่ไปที่อื่นเลย`,
    },
    {
      title: '5. ข้อมูลถูกเก็บไว้ที่ไหน',
      body: `บน Google Firebase — Firestore, Storage และ Authentication — ภายใต้กฎความปลอดภัยที่กำหนดว่าใครสามารถอ่านและเขียนเอกสารแต่ละฉบับได้

บนอุปกรณ์ของคุณ ข้อความที่แคชไว้ การตั้งค่า และ PIN ล็อกแอปถูกเข้ารหัสด้วยกุญแจเฉพาะต่ออุปกรณ์ที่เก็บไว้ในที่เก็บกุญแจของแพลตฟอร์ม (Keychain บน iOS, Keystore บน Android) แทนที่จะเป็นพื้นที่จัดเก็บแอปทั่วไป

กุญแจส่วนตัวที่ถอดรหัสข้อความของคุณจะไม่ออกจากอุปกรณ์ของคุณเลย ยกเว้นในรูปแบบวลีกู้คืนที่คุณเลือกที่จะจดไว้ เราไม่ได้เก็บมันไว้และไม่สามารถกู้คืนให้คุณได้ หากทำหาย ข้อความที่ส่งไปยังอุปกรณ์นั้นจะไม่สามารถอ่านได้อีก — โดยใครก็ตาม รวมถึงเราด้วย`,
    },
    {
      title: '6. ใครอีกบ้างที่ได้รับข้อมูล',
      body: `เราไม่ขาย แลกเปลี่ยน หรือให้เช่าข้อมูลส่วนบุคคลของคุณ ข้อมูลไปถึง:

• Google Firebase — ผู้ให้บริการโฮสติ้งของเรา ตามที่อธิบายไว้ข้างต้น
• Cloudflare Realtime — เสียงและวิดีโอของการโทร เมื่ออุปกรณ์ของคุณและอุปกรณ์ของอีกฝ่ายไม่สามารถเชื่อมต่อถึงกันโดยตรงได้
• มูลนิธิวิกิมีเดีย — หนึ่งชื่อ เมื่อคุณแตะเพื่อค้นหาในวิกิพีเดีย
• Google Cloud Speech-to-Text — เสียงของข้อความเสียงหนึ่งข้อความ เมื่อคุณขอการถอดความ
• Google Cloud Translation — ข้อความของข้อความหนึ่งข้อความ เมื่อคุณขอการแปล
• Cloudflare Workers AI — ข้อความสูงสุด 50 ข้อความล่าสุดของการสนทนาหนึ่งครั้ง เมื่อคุณขอสรุปหรือถามคำถามเกี่ยวกับมัน

สามรายการสุดท้ายปิดอยู่ในรุ่นนี้ ไม่มีการควบคุมใดๆ ในแอปที่จะเปิดการถอดความ การแปล หรือการสรุป ดังนั้นจึงไม่มีอะไรไปถึงบริการทั้งสามนี้เลย รายการเหล่านี้ถูกระบุไว้แทนที่จะลบออก เพราะโค้ดยังคงอยู่ที่นี่และฟีเจอร์เหล่านี้ตั้งใจจะกลับมา — และเมื่อกลับมา จะมาพร้อมกับการเปิดเผยนี้และการแจ้งเตือนก่อนการใช้งานครั้งแรก สิ่งที่จะถูกส่งในตอนนั้นถูกส่งเพื่อสร้างผลลัพธ์ของคุณ ไม่ใช่เพื่อฝึกฝนสิ่งใด ทั้งการถอดความและการแปลจะไม่ถูกเก็บไว้บนเซิร์ฟเวอร์ของเรา

การค้นหาวิกิพีเดียไม่มีสวิตช์เพราะไม่มีอะไรถาวรให้ปิด: มันทำงานเฉพาะเมื่อแตะเท่านั้น ไม่ใช่วิธีอื่น วิกิพีเดียได้รับเพียงชื่อนั้นและที่อยู่ IP ของคุณ เหมือนกับที่คุณพิมพ์มันเองในกล่องค้นหาของพวกเขา — ไม่มีบัญชี ไม่มีข้อความ ไม่มีการสนทนา สิ่งที่ส่งกลับมาเพียงแสดงผลและไม่ถูกบันทึก และไม่มีอะไรเกี่ยวกับมันถูกเขียนลงในการสนทนา

Cloudflare Realtime ก็ไม่มีสวิตช์เช่นกัน การโทรส่วนใหญ่ไม่ต้องการมัน อุปกรณ์สองเครื่องที่สามารถเชื่อมต่อถึงกันโดยตรง — การโทรส่วนใหญ่ในเครือข่ายเดียวกัน — จะเชื่อมต่อกันโดยไม่ต้องใช้มัน และไม่มีอะไรถูกส่งต่อ เมื่อเชื่อมต่อโดยตรงไม่ได้ — โดยทั่วไปเพราะทั้งสองฝ่ายอยู่คนละเครือข่ายมือถือ — การโทรที่เข้ารหัสไว้แล้วจะถูกส่งต่อแทนที่จะเชื่อมต่อไม่ได้ สิ่งที่ Cloudflare เห็นคือที่อยู่ IP ของทั้งสองฝ่าย เวลาของการโทร และปริมาณข้อมูลโดยประมาณที่ถูกส่ง เสียงและวิดีโอยังคงอยู่ภายใต้การเข้ารหัส DTLS-SRTP แบบเดียวกับที่อธิบายไว้ในหมวด 2 ดังนั้นการส่งต่อจึงไม่ได้ถอดรหัสมัน

เราอาจเปิดเผยสิ่งที่เราเก็บไว้หากกฎหมายกำหนด สิ่งที่เราเก็บไว้คือรายการในส่วนที่ 2 เราไม่สามารถให้เนื้อหาข้อความได้ เพราะเราไม่สามารถอ่านได้`,
    },
    {
      title: '7. การแจ้งเตือนแบบพุช',
      body: `Firebase Cloud Messaging ส่งการแจ้งเตือน โทเค็นอุปกรณ์ของคุณถูกเก็บไว้ในส่วนส่วนตัวของบัญชีคุณที่เฉพาะคุณเท่านั้นที่สามารถอ่านได้

การแจ้งเตือนไม่มีข้อความใดๆ ติดไปด้วย อุปกรณ์ของคุณถอดรหัสข้อความในเครื่องและประกอบสิ่งที่คุณเห็น Google ส่งเพียงซองจดหมาย ไม่ใช่เนื้อหาข้างใน`,
    },
    {
      title: '8. คุณสามารถทำอะไรได้บ้าง',
      body: `• ลบบัญชีของคุณจากหน้าจอโปรไฟล์ เนื้อหาที่เป็นส่วนร่วมของการสนทนา — เช่น บันทึกการโทร — จะยังคงอยู่กับผู้เข้าร่วมอีกฝ่าย เพราะมันเป็นบันทึกของพวกเขาด้วย
• ส่งออกข้อมูลของคุณจากหน้าจอโปรไฟล์
• ตั้งค่าให้ข้อความหมดอายุตามแชท: 1 ชั่วโมง, 24 ชั่วโมง, 7 วัน หรือ 30 วัน
• เปิดหรือปิดตัวบ่งชี้การพิมพ์และใบเสร็จการอ่าน ทั้งสองอย่างปิดอยู่โดยค่าเริ่มต้น
• ล็อกแอปด้วย PIN หรือไบโอเมตริก
• เพิกถอนลิงก์คำเชิญที่คุณได้แจกไปแล้ว

หากคุณต้องการให้เราลบบางสิ่งด้วยตนเอง โปรดเขียนถึงเรา`,
    },
    {
      title: '9. การเก็บรักษาข้อมูล',
      body: `เราเก็บข้อมูลของคุณไว้ตราบใดที่บัญชีของคุณยังคงอยู่ การลบบัญชีจะลบข้อมูลเหล่านั้น ยกเว้นเนื้อหาที่ถือครองร่วมกันที่กล่าวถึงข้างต้น การหมดอายุตามแชทจะลบข้อความตามกำหนดการที่คุณตั้งไว้`,
    },
    {
      title: '10. ข้อจำกัดที่คุณควรทราบ',
      body: `เราอยากจะบอกคุณเกี่ยวกับสิ่งเหล่านี้มากกว่าที่จะให้คุณมาพบเจอเอง

• กุญแจจะได้รับความไว้วางใจในครั้งแรกที่พบเห็น หากมีคนแทนที่กุญแจก่อนที่คุณจะเคยแลกเปลี่ยนข้อความกันเลย การสนทนาจะถูกเข้ารหัสไปยังคนผิด และจะดูเหมือนปกติทุกประการ แอปจะเตือนคุณเมื่อกุญแจเปลี่ยนแปลงในภายหลัง และแสดงหมายเลขความปลอดภัยที่คุณสามารถเปรียบเทียบนอกช่องทางได้ — แต่ไม่มีอะไรบังคับให้คุณเปรียบเทียบมัน
• หนึ่งอุปกรณ์ในแต่ละครั้ง วลีกู้คืนของคุณจะกู้คืนกุญแจที่เปิดประวัติของคุณ ดังนั้นการเข้าสู่ระบบบนอุปกรณ์ใหม่จะไม่สูญเสียสิ่งที่คุณได้รับไปแล้ว การสนทนาที่มีการรักษาความลับล่วงหน้าใช้กุญแจที่สองซึ่งจะไม่ออกจากอุปกรณ์ที่สร้างมันขึ้นมาเลย: อุปกรณ์ใดก็ตามที่เข้าสู่ระบบล่าสุดคืออุปกรณ์ที่ข้อความเหล่านั้นจะไปถึง และสิ่งใดก็ตามที่ปิดผนึกสำหรับอุปกรณ์อื่นในระหว่างนั้นจะไม่สามารถย้ายไปที่นั่นได้
• ข้อความที่ส่งก่อนที่จะมีการเข้ารหัสยังคงเป็นเหมือนเดิม ไม่มีอะไรถูกแปลงย้อนหลัง
• แอปนี้ไม่เคยผ่านการตรวจสอบความปลอดภัยโดยอิสระ`,
    },
    {
      title: '11. เด็ก',
      body: `Chatterbox ไม่ได้มีไว้สำหรับเด็กอายุต่ำกว่า 13 ปี และเราไม่ได้เก็บรวบรวมข้อมูลของพวกเขาโดยเจตนา หากคุณเชื่อว่าเด็กได้ให้ข้อมูลส่วนบุคคลแก่เรา โปรดติดต่อเราและเราจะลบข้อมูลนั้น`,
    },
    {
      title: '12. การเปลี่ยนแปลง',
      body: `เราอาจอัปเดตนโยบายนี้ การเปลี่ยนแปลงที่สำคัญจะประกาศในแอป และวันที่ด้านบนคือเวลาที่นโยบายนี้เปลี่ยนแปลงล่าสุด`,
    },
    {
      title: '13. ติดต่อ',
      body: `คำถามเกี่ยวกับนโยบายนี้: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. การตรวจสอบเวอร์ชันแอปใหม่กว่า',
      body: `Google Play ไม่ใช่วิธีที่แอปนี้เข้าถึงโทรศัพท์ Android ของคุณ แต่ดาวน์โหลดจาก chatterbox.fans แทน และร้านค้าที่ไม่ได้อยู่ในวงจรนี้ไม่สามารถตรวจสอบการอัปเดตแทนคุณได้ — ดังนั้นแอปนี้จึงทำได้เอง หากคุณขอให้ทำ

การแตะ "ตรวจสอบตอนนี้" จะส่งคำขอหนึ่งครั้งไปยัง chatterbox.fans เพื่อถามว่าเวอร์ชันปัจจุบันคืออะไร คำขอนั้นมีเพียงที่อยู่ IP ของคุณเท่านั้น ไม่มีอะไรอื่น — ไม่มีบัญชี ไม่มีตัวระบุอุปกรณ์ ไม่มีข้อความ สิ่งที่ส่งกลับมาคือหมายเลขเวอร์ชัน ซึ่งจะถูกเปรียบเทียบบนโทรศัพท์ของคุณกับเวอร์ชันที่คุณกำลังใช้งานอยู่ ไม่มีอะไรถูกดาวน์โหลดโดยอัตโนมัติ และไม่มีสิ่งใดเกี่ยวกับการตรวจสอบนี้ถูกเขียนลงในบทสนทนา

สิ่งนี้ไม่มีสวิตช์เพราะไม่มีอะไรให้ปิด: มันทำงานเมื่อแตะเท่านั้น ไม่ใช่วิธีอื่น

หากคุณติดตั้งการอัปเดต มันจะแทนที่แอปในตำแหน่งเดิมโดยใช้คีย์การลงนามเดียวกัน เช่นเดียวกับที่การอัปเดตจาก Google Play จะทำ`,
    },
  ],

  fil: [
    {
      title: '0. Sa madaling salita',
      body: `Ang teksto ng iyong mga mensahe ay naka-encrypt sa iyong device at mababasa lamang ng mga taong ipinadalhan mo. Hindi namin ito mababasa, at gayundin ang Google, na inuupahan naming mga server.

Ang nakikita namin ay may nangyaring pag-uusap: kung sinong mga account ang kasama, at kung kailan sila naging aktibo. Mas mahirap alisin iyon kaysa i-encrypt ang laman, at hindi pa namin ito natatapos. Sinasabi ng patakarang ito kung saan eksaktong nakatayo ang linya ngayon.`,
    },
    {
      title: '1. Ano ang end-to-end encrypted',
      body: `Naka-encrypt sa iyong device, hindi mababasa ng amin at ng Google:

• Ang teksto ng iyong mga mensahe.
• Ang laman ng mga file, larawan, audio at video na iyong inilalakip.
• Mga preview ng link.
• Voice at video call, na gumagamit ng ipinag-uutos na DTLS-SRTP ng WebRTC sa pagitan ng dalawang device.

Karamihan sa one-to-one at group na mensahe ay gumagamit din ng ratchet, ibig sabihin ang bawat mensahe ay may sariling key, kaya ang pagkasira ng iyong device ay hindi nagbubunyag ng mga naunang mensahe. Ang mga pag-uusap kung saan hindi pa nailalathala ng kliyente ng ibang tao ang mas bagong key material ay bumabalik sa isang mahabang-buhay na key, na walang katangiang iyon. Sinasabi sa iyo ng label sa ilalim ng isang mensahe kung alin ang aktwal na natanggap nito.

Isang bagay ang lumalampas sa linyang ito, at tanging kapag hiniling mo lamang: ang paghahanap ng pangalan sa Wikipedia ay nagpapadala ng isang pangalang iyon, hindi ang mensaheng pinagmulan nito. Sinasabi ng Seksyon 6 kung sino ang tatanggap nito, at ang paghahanap ay tumatakbo sa tap at wala nang iba, kaya walang anumang kailangang i-off. Ang pagbubuod, pagsasalin, at pagsasatitik ay lalampas din dito — pinapatay ang mga ito sa release na ito, na walang kontrol kahit saan sa app na magbubukas sa mga ito.`,
    },
    {
      title: '2. Ano ang hindi naka-encrypt, at ano ang aming nakikita',
      body: `Pinoprotektahan ng encryption ang laman, hindi ang katotohanan ng isang pag-uusap. Nananatili ang mga ito nang malinaw sa aming mga server:

• Sino ang kasama sa bawat pag-uusap, at kailan ito nilikha at huling naging aktibo.
• Ang timestamp ng bawat mensahe, at ilan ang hindi mo pa nababasa.
• Ang pangalan, uri, at laki ng file ng isang attachment. Ang mga byte ay naka-encrypt; ang deskripsyon ng mga ito ay hindi, at ang haba ng ciphertext ay naglilimita sa haba ng orihinal.
• Ang iyong mga kaibigan at mga kahilingan sa pagkakaibigan.
• Signaling ng tawag — na may tawag na ginawa, kanino, at kailan. Hindi ang audio o video nito.

Ang mga typing indicator at read receipt ay naka-off maliban kung i-on mo, at habang naka-off ay walang naisusulat.

Ano na ang wala na rito: ang iyong email address at pangalan. Simula Setyembre 2026, ang talaan ng account ay may lamang identifier ng account — at mula noon, walang address na itinatago kahit saan. Walang tinatanong ang pag-sign up tungkol sa iyo: ang iyong account ay isang 24-word na recovery phrase, at ang kredensyal na sinusuri ng Firebase Authentication ay hinango mula rito. Ang iniimbak nito ay isang random na label sa ilalim ng isang domain na hindi maaaring tumanggap ng mail.

Hiwalay: dahil ang app ay tumatakbo sa Google Firebase, makikita ng Google ang IP address at oras ng bawat koneksyon na ginagawa ng iyong device dito. Isa itong katangian ng hosting, hindi ng app, at hindi namin ito maaaring i-encrypt palayo.`,
    },
    {
      title: '3. Paano ka nahahanap ng mga tao',
      body: `Hindi ka nila mahahanap sa paghahanap. Walang direktoryo — walang paghahanap gamit ang email, numero ng telepono, o pangalan — at tinatanggihan ng server ang anumang query na sumusubok nito.

Nakakarating ka sa isang tao sa pagpapadala sa kanila ng invite link nang labas sa channel, sa anumang ginagamit mo na. Isang beses gumagana ang link, mag-e-expire pagkatapos ng 24 oras, at maaaring bawiin. Anumang itawag mo sa isang tao ay ang sarili mong label para sa kanila, itinatago para sa iyo; kung nagpakilala sila sa kanilang sarili, ang pangalang iyon ay dumating sa iyo nang naka-encrypt.`,
    },
    {
      title: '4. Ano ang kinokolekta namin',
      body: `• Data ng account: isang identifier ng account, at isang kredensyal na hinango mula sa iyong recovery phrase, na itinatago sa Firebase Authentication. Walang email address, walang numero ng telepono, walang pangalan — walang hinihinging alinman sa mga ito ang pag-sign up.
• Ciphertext ng mensahe at attachment, kasama ang metadata sa seksyon 2.

Iyon ang buong listahan. Walang analytics at walang crash reporting. Dati ay nagpapadala ang app ng screen view sa Firebase Analytics at crash report sa Firebase Crashlytics, na parehong may dalang identifier ng iyong account, kaya wala sa mga ito ang anonymous; wala na ang dalawa, kasama ang mga library na nagpadala ng mga ito. Ang mga error ay naka-print lamang sa sariling makina ng developer habang sa development at wala nang ibang pupuntahan.`,
    },
    {
      title: '5. Saan ito iniimbak',
      body: `Sa Google Firebase — Firestore, Storage, at Authentication — sa ilalim ng mga panuntunan sa seguridad na nagpapasya kung sino ang maaaring magbasa at magsulat ng bawat dokumento.

Sa iyong device, ang mga na-cache na mensahe, setting, at iyong app-lock PIN ay naka-encrypt gamit ang isang per-device key na itinatago sa platform keystore (iOS Keychain, Android Keystore) sa halip na sa karaniwang imbakan ng app.

Ang pribadong key na nagde-decrypt ng iyong mga mensahe ay hindi kailanman umaalis sa iyong device, maliban bilang recovery phrase na piniling isulat mo. Hindi namin ito hawak at hindi namin ito maaaring bawiin para sa iyo. Kung mawala ito, ang mga mensaheng ipinadala sa device na iyon ay hindi na mababasang muli — ninuman, kabilang kami.`,
    },
    {
      title: '6. Sino pa ang tumatanggap ng data',
      body: `Hindi namin ibinebenta, ipinagpapalit, o inuupahan ang iyong personal na impormasyon. Ang data ay nakakarating sa:

• Google Firebase — ang aming provider ng hosting, gaya ng inilarawan sa itaas.
• Cloudflare Realtime — ang audio at video ng isang tawag, kapag hindi direktang maaabot ng iyong device at ng device ng ibang tao ang isa't isa.
• Wikimedia Foundation — isang pangalan, kapag na-tap mo ito para hanapin sa Wikipedia.
• Google Cloud Speech-to-Text — ang audio ng isang voice message, kapag humihiling ka ng transcript.
• Google Cloud Translation — ang teksto ng isang mensahe, kapag humihiling ka ng pagsasalin.
• Cloudflare Workers AI — hanggang sa huling 50 mensahe ng isang pag-uusap, kapag humihiling ka ng buod o nagtatanong tungkol dito.

Ang huling tatlo ay naka-off sa release na ito. Walang kontrol kahit saan sa app na magbubukas sa transcription, translation, o mga buod, kaya walang nakakarating sa tatlong serbisyong iyon. Nakalista ang mga ito sa halip na tanggalin dahil narito pa rin ang code at ang mga feature ay nilalayong bumalik — at kapag bumalik ang mga ito, babalik ito kasama ang paglalantad na ito at isang prompt bago ang unang paggamit. Anumang ipapadala sa oras na iyon ay ipapadala upang makagawa ng iyong resulta, hindi upang magsanay ng anuman; walang transcript o pagsasalin na naiimbak sa aming mga server.

Ang paghahanap sa Wikipedia ay walang switch dahil walang anumang kailangang i-off: tumatakbo lang ito sa tap at wala nang iba. Ang Wikipedia ay tumatanggap ng isang pangalang iyon at ng iyong IP address, kapareho ng kung na-type mo ito sa kanilang search box — walang account, walang mensahe, walang pag-uusap. Ang ibinabalik ay ipinapakita at hindi naiimbak, at walang anumang tungkol dito ang naisusulat sa pag-uusap.

Wala ring switch ang Cloudflare Realtime. Karamihan sa mga tawag ay hindi ito kailangan: dalawang device na maaaring direktang maabot ang isa't isa — karamihan sa mga tawag sa parehong network — ay kumokonekta nang wala ito, at walang ni-relay. Kapag hindi nila kaya — kadalasan dahil kayong dalawa ay nasa magkaibang mobile network — ang naka-encrypt na nang tawag ay ni-relay sa halip na iwang hindi makakonekta. Ang nakikita ng Cloudflare ay ang parehong IP address, ang oras ng tawag, at humigit-kumulang kung gaano karaming data ang gumalaw; ang audio at video ay nananatili sa ilalim ng parehong DTLS-SRTP encryption na inilarawan sa seksyon 2, kaya hindi ito ma-decrypt ng pag-relay.

Maaari naming ilantad ang aming hawak kung ito ay hinihiling ng batas. Ang aming hawak ay ang listahan sa seksyon 2. Hindi namin maibibigay ang laman ng mensahe, dahil hindi namin ito mababasa.`,
    },
    {
      title: '7. Push notification',
      body: `Ang Firebase Cloud Messaging ang naghahatid ng mga notification. Ang token ng iyong device ay naka-imbak sa isang pribadong bahagi ng iyong account na ikaw lamang ang makakabasa.

Ang mga notification ay walang dalang teksto ng mensahe. Ang iyong device ang nagde-decrypt ng mensahe nang lokal at bumubuo ng nakikita mo; ang Google ang naghahatid ng sobre, hindi ng laman.`,
    },
    {
      title: '8. Ano ang magagawa mo',
      body: `• Burahin ang iyong account mula sa Profile screen. Ang nilalamang magkasamang bahagi ng isang pag-uusap — halimbawa, isang tala ng tawag — ay mananatili sa ibang kalahok, dahil ito ay tala rin nila.
• I-export ang iyong data mula sa Profile screen.
• Itakda ang mga mensahe na mag-expire kada chat: 1 oras, 24 oras, 7 araw, o 30 araw.
• I-on o i-off ang typing indicator at read receipt. Naka-off ang pareho bilang default.
• I-lock ang app gamit ang PIN o biometrics.
• Bawiin ang isang invite link na ipinamahagi mo na.

Kung mas gugustuhin mong burahin namin nang manu-mano ang isang bagay, sumulat sa amin.`,
    },
    {
      title: '9. Pagpapanatili',
      body: `Iniingatan namin ang iyong data habang umiiral ang iyong account. Ang pagbura ng account ay bumubura nito, maliban sa nilalamang magkasamang hawak na nabanggit sa itaas. Ang per-chat na expiry ay nag-aalis ng mga mensahe sa iskedyul na itinakda mo.`,
    },
    {
      title: '10. Mga limitasyong dapat mong malaman',
      body: `Mas gugustuhin naming sabihin sa iyo ang mga ito kaysa hayaan kang makita mo ang mga ito.

• Ang mga key ay pinagkakatiwalaan sa unang pagkakataong makita. Kung may nagpalit ng key bago ka kailanman nakipagpalitan ng mensahe, ang pag-uusap ay maie-encrypt sa maling tao at magiging ganap na normal ang itsura. Binabalaan ka ng app kapag nagbago ang key pagkatapos, at ipinapakita ang isang safety number na maaari mong ihambing sa labas ng channel — pero walang pumipilit sa iyong ihambing ito.
• Isang device sa isang pagkakataon. Ang iyong recovery phrase ay nagbabalik ng key na nagbubukas sa iyong history, kaya ang pag-sign in sa isang bagong device ay hindi nawawalan ng natanggap mo na. Ang mga pag-uusap na forward-secret ay gumagamit ng pangalawang key na hindi kailanman umaalis sa device na lumikha nito: alinmang device ang pinakahuling nag-sign in ang siyang naaabot nila, at anumang naka-seal sa ibang device sa pagitan ay hindi maililipat.
• Ang mga mensaheng ipinadala bago magkaroon ng encryption ay nananatiling gaya ng dati. Walang na-convert nang retroactive.
• Ang app na ito ay hindi pa nasuri sa seguridad ng independiyenteng partido.`,
    },
    {
      title: '11. Mga bata',
      body: `Ang Chatterbox ay hindi inilaan para sa mga batang wala pang 13 taong gulang, at hindi namin sinasadyang kinokolekta ang kanilang impormasyon. Kung naniniwala kang nagbigay sa amin ng personal na impormasyon ang isang bata, makipag-ugnayan sa amin at ito ay aming buburahin.`,
    },
    {
      title: '12. Mga pagbabago',
      body: `Maaari naming i-update ang patakarang ito. Ianunsyo ang mga makabuluhang pagbabago sa app, at ang petsa sa itaas ay kung kailan huling nagbago ito.`,
    },
    {
      title: '13. Contact',
      body: `Mga tanong tungkol sa patakarang ito: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Pagtingin kung may mas bagong bersyon ng app',
      body: `Hindi Google Play ang paraan kung paano nakakarating ang app na ito sa iyong Android phone. Dini-download ito mula sa chatterbox.fans sa halip, at ang isang store na wala sa loop ay hindi makakapag-check ng mga update para sa iyo — kaya kaya itong gawin mismo ng app na ito, kung hihilingin mo.

Ang pag-tap sa "Tingnan ngayon" ay nagpapadala ng isang kahilingan sa chatterbox.fans na nagtatanong kung ano ang kasalukuyang bersyon. Ang kahilingang iyon ay may dalang IP address mo lamang at wala nang iba — walang account, walang device identifier, walang mensahe. Ang bumabalik ay isang numero ng bersyon, na inihahambing sa iyong telepono sa bersyong pinapatakbo mo; walang awtomatikong dina-download, at walang anuman tungkol sa pagsusuring ito ang isinusulat sa usapan.

Walang switch dito dahil walang dapat i-off: tumatakbo lamang ito kapag na-tap, at hindi sa ibang paraan.

Kapag na-install mo ang update, papalitan nito ang app sa kasalukuyang lugar gamit ang parehong signing key, kagaya ng gagawin ng update mula sa Google Play.`,
    },
  ],

  ms: [
    {
      title: '0. Secara ringkas',
      body: `Teks mesej anda disulitkan pada peranti anda dan hanya boleh dibaca oleh orang yang anda hantar mesej itu. Kami tidak dapat membacanya, begitu juga Google, yang pelayannya kami sewa.

Apa yang kami dapat lihat ialah perbualan telah berlaku: akaun mana yang terlibat, dan bila mereka aktif. Menghapuskan itu lebih sukar daripada menyulitkan kandungan, dan kami belum selesai. Dasar ini menyatakan dengan tepat di mana garis itu berada sekarang.`,
    },
    {
      title: '1. Apa yang disulitkan hujung ke hujung',
      body: `Disulitkan pada peranti anda, tidak boleh dibaca oleh kami dan Google:

• Teks mesej anda.
• Kandungan fail, foto, audio dan video yang anda lampirkan.
• Pratonton pautan.
• Panggilan suara dan video, yang menggunakan DTLS-SRTP wajib WebRTC antara dua peranti.

Kebanyakan mesej satu-lawan-satu dan kumpulan juga menggunakan ratchet, bermakna setiap mesej mempunyai kuncinya sendiri, jadi kompromi peranti anda tidak mendedahkan mesej sebelumnya. Perbualan di mana klien seseorang belum menerbitkan bahan kunci yang lebih baharu kembali menggunakan satu kunci berjangka hayat panjang, yang tidak mempunyai ciri itu. Label di bawah mesej memberitahu anda yang mana sebenarnya diterima.

Satu perkara melintasi garis ini, dan hanya apabila anda memintanya: mencari nama di Wikipedia menghantar nama itu sahaja, bukan mesej asalnya. Bahagian 6 menyatakan siapa yang menerimanya, dan carian dijalankan hanya semasa ketikan dan tidak sebaliknya, jadi tiada apa untuk dimatikan. Meringkaskan, menterjemah dan mentranskripsi juga akan melintasi ini — ia dimatikan dalam keluaran ini, tanpa kawalan di mana-mana dalam apl untuk menghidupkannya.`,
    },
    {
      title: '2. Apa yang tidak disulitkan, dan apa yang kami boleh lihat',
      body: `Penyulitan melindungi kandungan, bukan fakta perbualan. Perkara ini berada dalam bentuk jelas pada pelayan kami:

• Siapa yang terlibat dalam setiap perbualan, dan bila ia dicipta dan terakhir aktif.
• Cap masa setiap mesej, dan berapa banyak yang belum anda baca.
• Nama fail, jenis dan saiz lampiran. Bait disulitkan; keterangannya tidak, dan panjang teks sifer mengehadkan panjang asal.
• Rakan dan permintaan rakan anda.
• Isyarat panggilan — bahawa panggilan telah dibuat, kepada siapa, dan bila. Bukan audio atau videonya.

Penunjuk menaip dan resit bacaan dimatikan melainkan anda menghidupkannya, dan semasa dimatikan tiada apa yang ditulis.

Apa yang tiada lagi di sini: alamat e-mel dan nama anda. Sejak September 2026 rekod akaun hanya menyimpan pengecam akaun — dan sejak itu tiada alamat untuk disimpan di mana-mana. Pendaftaran tidak bertanya apa-apa tentang anda: akaun anda ialah frasa pemulihan 24 perkataan, dan bukti kelayakan yang diperiksa oleh Firebase Authentication diperoleh daripadanya. Apa yang disimpannya ialah label rawak di bawah domain yang tidak boleh menerima mel.

Berasingan: kerana apl berjalan pada Google Firebase, Google boleh melihat alamat IP dan masa setiap sambungan yang dibuat peranti anda kepadanya. Itu ciri pengehosan, bukan apl, dan kami tidak boleh menyulitkannya.`,
    },
    {
      title: '3. Bagaimana orang mencari anda',
      body: `Mereka tidak boleh mencari anda. Tiada direktori — tiada carian mengikut e-mel, nombor telefon atau nama — dan pelayan menolak sebarang pertanyaan yang cuba berbuat demikian.

Anda menghubungi seseorang dengan menghantar pautan jemputan di luar talian, melalui apa sahaja yang anda sudah gunakan. Pautan berfungsi sekali, tamat tempoh selepas 24 jam, dan boleh ditarik balik. Apa sahaja yang anda panggil seseorang ialah label anda sendiri untuk mereka, disimpan untuk anda; jika mereka memperkenalkan diri, nama itu sampai kepada anda dalam bentuk disulitkan.`,
    },
    {
      title: '4. Apa yang kami kumpulkan',
      body: `• Data akaun: pengecam akaun, dan bukti kelayakan yang diperoleh daripada frasa pemulihan anda, disimpan dalam Firebase Authentication. Tiada alamat e-mel, tiada nombor telefon, tiada nama — pendaftaran tidak meminta mana-mana daripadanya.
• Teks sifer mesej dan lampiran, ditambah metadata dalam bahagian 2.

Itulah keseluruhan senarai. Tiada analitik dan tiada laporan ranap. Apl dahulu menghantar paparan skrin ke Firebase Analytics dan laporan ranap ke Firebase Crashlytics, kedua-duanya membawa pengecam akaun anda, jadi tiada satu pun tanpa nama; kedua-duanya kini hilang, bersama pustaka yang menghantarnya. Ralat dicetak pada mesin pembangun sendiri semasa pembangunan dan tidak pergi ke mana-mana lagi.`,
    },
    {
      title: '5. Di mana ia disimpan',
      body: `Pada Google Firebase — Firestore, Storage dan Authentication — di bawah peraturan keselamatan yang menentukan siapa boleh membaca dan menulis setiap dokumen.

Pada peranti anda, mesej yang dicache, tetapan dan PIN kunci apl anda disulitkan dengan kunci setiap peranti yang disimpan dalam keystore platform (iOS Keychain, Android Keystore) berbanding storan apl biasa.

Kunci peribadi yang menyahsulit mesej anda tidak pernah meninggalkan peranti anda, kecuali sebagai frasa pemulihan yang anda pilih untuk ditulis. Kami tidak menyimpannya dan tidak boleh memulihkannya untuk anda. Kehilangannya bermakna mesej yang dihantar ke peranti itu tidak boleh dibaca semula — oleh sesiapa, termasuk kami.`,
    },
    {
      title: '6. Siapa lagi yang menerima data',
      body: `Kami tidak menjual, berdagang atau menyewakan maklumat peribadi anda. Data sampai kepada:

• Google Firebase — pembekal pengehosan kami, seperti yang diterangkan di atas.
• Cloudflare Realtime — audio dan video panggilan, apabila peranti anda dan peranti orang lain tidak dapat menghubungi satu sama lain secara langsung.
• Wikimedia Foundation — satu nama, apabila anda mengetik untuk mencarinya di Wikipedia.
• Google Cloud Speech-to-Text — audio satu mesej suara, apabila anda meminta transkrip.
• Google Cloud Translation — teks satu mesej, apabila anda meminta terjemahan.
• Cloudflare Workers AI — sehingga 50 mesej terakhir satu perbualan, apabila anda meminta ringkasan atau bertanya soalan mengenainya.

Tiga yang terakhir dimatikan dalam keluaran ini. Tiada kawalan di mana-mana dalam apl untuk menghidupkan transkripsi, terjemahan atau ringkasan, jadi tiada apa sampai ke tiga perkhidmatan itu. Ia disenaraikan berbanding dipadam kerana kod masih ada di sini dan ciri-ciri itu dimaksudkan untuk kembali — dan apabila ia kembali, ia kembali dengan pendedahan ini dan gesaan sebelum penggunaan pertama. Apa yang akan dihantar pada masa itu dihantar untuk menghasilkan keputusan anda, bukan untuk melatih apa-apa; tiada transkrip atau terjemahan yang disimpan pada pelayan kami.

Carian Wikipedia tiada suis kerana tiada apa untuk dimatikan: ia berjalan hanya semasa ketikan dan tidak sebaliknya. Wikipedia menerima nama itu sahaja dan alamat IP anda, sama seperti jika anda menaipnya sendiri dalam kotak carian mereka — tiada akaun, tiada mesej, tiada perbualan. Apa yang dikembalikan dipaparkan dan tidak disimpan, dan tiada apa mengenainya ditulis ke dalam perbualan.

Cloudflare Realtime juga tiada suis. Kebanyakan panggilan tidak memerlukannya: dua peranti yang boleh menghubungi satu sama lain secara langsung — kebanyakan panggilan pada rangkaian yang sama — menyambung tanpanya, dan tiada apa yang direlai. Apabila mereka tidak boleh — biasanya kerana anda berdua berada pada rangkaian mudah alih yang berbeza — panggilan yang sudah disulitkan itu direlai berbanding dibiarkan tidak dapat menyambung. Apa yang Cloudflare lihat ialah kedua-dua alamat IP, masa panggilan, dan anggaran berapa banyak data yang dipindahkan; audio dan video kekal di bawah penyulitan DTLS-SRTP yang sama seperti yang diterangkan dalam seksyen 2, jadi merelai tidak menyahsulitkannya.

Kami mungkin mendedahkan apa yang kami pegang jika undang-undang memerlukannya. Apa yang kami pegang ialah senarai dalam bahagian 2. Kami tidak boleh menghasilkan kandungan mesej, kerana kami tidak boleh membacanya.`,
    },
    {
      title: '7. Pemberitahuan tolak',
      body: `Firebase Cloud Messaging menyampaikan pemberitahuan. Token peranti anda disimpan dalam bahagian peribadi akaun anda yang hanya anda boleh baca.

Pemberitahuan tidak membawa teks mesej. Peranti anda menyahsulit mesej secara tempatan dan menyusun apa yang anda lihat; Google menyampaikan sampul, bukan kandungan.`,
    },
    {
      title: '8. Apa yang anda boleh lakukan',
      body: `• Padam akaun anda daripada skrin Profil. Kandungan yang menjadi sebahagian bersama perbualan — rekod panggilan, contohnya — kekal bersama peserta lain, kerana ia juga rekod mereka.
• Eksport data anda daripada skrin Profil.
• Tetapkan mesej untuk tamat tempoh setiap sembang: 1 jam, 24 jam, 7 hari atau 30 hari.
• Hidup atau matikan penunjuk menaip dan resit bacaan. Kedua-duanya dimatikan secara lalai.
• Kunci apl dengan PIN atau biometrik.
• Tarik balik pautan jemputan yang telah anda berikan.

Jika anda lebih suka kami memadamkan sesuatu secara manual, tulis kepada kami.`,
    },
    {
      title: '9. Pengekalan',
      body: `Kami menyimpan data anda selagi akaun anda wujud. Memadam akaun memadamkannya, kecuali kandungan yang dipegang bersama yang dinyatakan di atas. Tamat tempoh setiap sembang mengeluarkan mesej mengikut jadual yang anda tetapkan.`,
    },
    {
      title: '10. Had yang perlu anda ketahui',
      body: `Kami lebih suka memberitahu anda perkara ini berbanding anda menemuinya sendiri.

• Kunci dipercayai kali pertama ia dilihat. Jika seseorang menggantikan kunci sebelum anda pernah bertukar mesej, perbualan itu akan disulitkan kepada orang yang salah dan akan kelihatan sepenuhnya normal. Apl memberi amaran apabila kunci berubah selepas itu, dan menunjukkan nombor keselamatan yang boleh anda bandingkan di luar talian — tetapi tiada apa yang memaksa anda membandingkannya.
• Satu peranti pada satu masa. Frasa pemulihan anda memulihkan kunci yang membuka sejarah anda, jadi mendaftar masuk pada peranti baharu tidak kehilangan apa yang telah anda terima. Perbualan rahsia-hadapan menggunakan kunci kedua yang tidak pernah meninggalkan peranti yang menciptanya: peranti mana sahaja yang mendaftar masuk terakhir adalah yang dicapai, dan apa sahaja yang dimeterai kepada peranti lain sementara itu tidak boleh dipindahkan.
• Mesej yang dihantar sebelum penyulitan wujud kekal seperti sedia ada. Tiada apa yang ditukar secara retroaktif.
• Apl ini belum diaudit keselamatan secara bebas.`,
    },
    {
      title: '11. Kanak-kanak',
      body: `Chatterbox tidak ditujukan untuk kanak-kanak di bawah 13 tahun, dan kami tidak mengumpul maklumat mereka secara sedar. Jika anda percaya seorang kanak-kanak telah memberikan kami maklumat peribadi, hubungi kami dan kami akan memadamkannya.`,
    },
    {
      title: '12. Perubahan',
      body: `Kami mungkin mengemas kini dasar ini. Perubahan ketara akan diumumkan dalam apl, dan tarikh di bahagian atas ialah bila ia terakhir berubah.`,
    },
    {
      title: '13. Hubungi',
      body: `Soalan mengenai dasar ini: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Menyemak versi aplikasi yang lebih baharu',
      body: `Google Play bukanlah cara aplikasi ini sampai ke telefon Android anda. Sebaliknya ia dimuat turun daripada chatterbox.fans, dan kedai yang tidak terlibat dalam proses ini tidak dapat menyemak kemas kini bagi pihak anda — jadi aplikasi ini boleh melakukannya sendiri, jika anda memintanya.

Mengetik "Semak sekarang" menghantar satu permintaan ke chatterbox.fans untuk bertanya versi mana yang terkini. Permintaan itu hanya membawa alamat IP anda dan tiada apa-apa lagi — tiada akaun, tiada pengecam peranti, tiada mesej. Yang kembali ialah nombor versi, dibandingkan pada telefon anda dengan versi yang sedang anda gunakan; tiada apa-apa dimuat turun secara automatik, dan tiada apa-apa mengenai semakan ini ditulis ke dalam perbualan.

Ini tiada suis kerana tiada apa-apa untuk dimatikan: ia hanya berjalan apabila diketik dan tidak dengan cara lain.

Jika anda memasang kemas kini itu, ia akan menggantikan aplikasi di tempatnya menggunakan kunci tandatangan yang sama, sama seperti kemas kini daripada Google Play akan lakukan.`,
    },
  ],

  my: [
    {
      title: '0. အကျဉ်းချုပ်',
      body: `သင့်စာသားများကို သင့်စက်ပေါ်တွင် လျှို့ဝှက်ကုဒ်ဖြင့်ပြောင်းထားပြီး သင်ပို့သည့်သူများသာ ဖတ်နိုင်သည်။ ကျွန်ုပ်တို့ မဖတ်နိုင်ပါ၊ ကျွန်ုပ်တို့ ငှားရမ်းအသုံးပြုနေသော ဆာဗာများပိုင်ရှင် Google ကလည်း မဖတ်နိုင်ပါ။

ကျွန်ုပ်တို့မြင်နိုင်သည်မှာ စကားပြောဆိုမှု တစ်ခုဖြစ်ပျက်ခဲ့သည်ဆိုသည့်အချက်ဖြစ်သည်— မည်သည့်အကောင့်များပါဝင်သည်၊ မည်သည့်အချိန်တွင် အသုံးပြုခဲ့သည်။ ၎င်းကိုဖယ်ရှားခြင်းသည် အကြောင်းအရာများကို ကုဒ်ဝှက်ခြင်းထက် ပိုမိုခက်ခဲပြီး ကျွန်ုပ်တို့ လက်ရှိအထိ မပြီးမြောက်သေးပါ။ ဤမူဝါဒသည် ယခုအချိန်တွင် မျဉ်းသည်အတိအကျ မည်သို့ရှိနေသည်ကို ဖော်ပြထားသည်။`,
    },
    {
      title: '1. End-to-end encryption ဖြင့်ကာကွယ်ထားသည့်အရာများ',
      body: `သင့်စက်ပေါ်တွင် ကုဒ်ဝှက်ထားပြီး၊ ကျွန်ုပ်တို့နှင့် Google မဖတ်နိုင်သည်များ—

• သင့်စာသားများ။
• သင်ပူးတွဲပို့သည့် ဖိုင်၊ ဓာတ်ပုံ၊ အသံနှင့် ဗီဒီယိုများ၏ အကြောင်းအရာ။
• လင့်ခ်အစမ်းကြည့်ရှုမှုများ။
• WebRTC ၏မဖြစ်မနေလိုအပ်သည့် DTLS-SRTP ကိုအသုံးပြုသော အသံနှင့်ဗီဒီယိုခေါ်ဆိုမှုများ၊ စက်နှစ်ခုကြား။

one-to-one နှင့် group စာများအများစုသည် ratchet ကိုပါအသုံးပြုပြီး၊ ၎င်းသည် စာတိုင်းတွင် သီးခြား key ရှိသည်ဟုဆိုလိုသဖြင့် သင့်စက်ကို ထိပါးခံရလျှင်ပင် ယခင်စာများကို မဖော်ထုတ်နိုင်ပါ။ တစ်ဖက်၏ client မှ ပိုသစ်သော key material ကို မထုတ်ပြန်ရသေးသည့် စကားပြောဆိုမှုများသည် သီးခြားဂုဏ်သတ္တိမရှိသော long-lived key တစ်ခုတည်းအားပြန်လည် အသုံးပြုသည်။ စာတစ်စောင်၏အောက်ရှိ label က ၎င်းအမှန်တကယ်ရရှိသည့်အမျိုးအစားကို ပြောပြပါသည်။

ဤမျဉ်းကို ဖြတ်ကျော်သွားသော တစ်ခုတည်းသောအရာမှာ သင်တောင်းဆိုမှသာဖြစ်ပြီး၊ Wikipedia တွင်အမည်တစ်ခုရှာခြင်းသည် ၎င်းစာလာသည့် စာကို မဟုတ်ဘဲ အမည်တစ်ခုတည်းကိုသာ ပို့သည်။ အပိုင်း ၆ တွင် မည်သူရရှိသည်ကို ဖော်ပြထားပြီး၊ ရှာဖွေမှုသည် တို့ထိမှသာ အလုပ်လုပ်ပြီး အခြားနည်းလမ်းမရှိသဖြင့် ပိတ်ရန်မလိုအပ်ပါ။ အနှစ်ချုပ်ခြင်း၊ ဘာသာပြန်ခြင်းနှင့် စာသားပြောင်းခြင်းများသည်လည်း ဤမျဉ်းကို ဖြတ်ကျော်မည်ဖြစ်သည် — ၎င်းတို့ကို ဤဗားရှင်းတွင် ပိတ်ထားပြီး၊ အက်ပ်တွင် ဖွင့်ရန်ထိန်းချုပ်မှု မရှိပါ။`,
    },
    {
      title: '2. ကုဒ်ဝှက်မထားသည့်အရာများနှင့် ကျွန်ုပ်တို့မြင်နိုင်သည့်အရာများ',
      body: `ကုဒ်ဝှက်ခြင်းသည် အကြောင်းအရာကို ကာကွယ်ပေးသော်လည်း၊ စကားပြောဆိုမှုတစ်ခု ဖြစ်ပျက်ခဲ့သည်ဆိုသည့်အချက်ကို မကာကွယ်ပါ။ ဤအရာများသည် ကျွန်ုပ်တို့ ဆာဗာများပေါ်တွင် ရှင်းလင်းစွာရှိနေသည်—

• စကားပြောဆိုမှုတစ်ခုစီတွင် မည်သူပါဝင်သည်၊ မည်သည့်အချိန်တွင် ဖန်တီးခဲ့ပြီး နောက်ဆုံးအသုံးပြုခဲ့သည်။
• စာတိုင်း၏ အချိန်တံဆိပ်နှင့် သင်မဖတ်ရသေးသောစာအရေအတွက်။
• ပူးတွဲဖိုင်၏ ဖိုင်အမည်၊ အမျိုးအစားနှင့် အရွယ်အစား။ ဘိုက်များကို ကုဒ်ဝှက်ထားသော်လည်း ၎င်းတို့၏ ဖော်ပြချက်ကို ကုဒ်ဝှက်မထားပါ၊ ciphertext ၏အရှည်သည် မူရင်း၏အရှည်ကို ကန့်သတ်ပေးသည်။
• သင့်မိတ်ဆွေများနှင့် မိတ်ဆွေတောင်းဆိုမှုများ။
• ခေါ်ဆိုမှု signaling — ခေါ်ဆိုမှုတစ်ခု ပြုလုပ်ခဲ့သည်၊ မည်သူထံ၊ မည်သည့်အချိန်တွင်။ ၎င်း၏ အသံ (သို့) ဗီဒီယိုကိုမဟုတ်ပါ။

Typing indicators နှင့် read receipts များသည် သင်ဖွင့်မှသာ အလုပ်လုပ်ပြီး ပိတ်ထားစဉ် မည်သည့်အရာမျှ မမှတ်တမ်းတင်ပါ။

ယခုမရှိတော့သည့်အရာများ— သင့်အီးမေးလ်လိပ်စာနှင့် အမည်။ ၂၀၂၆ စက်တင်ဘာလမှစတင်၍ အကောင့်မှတ်တမ်းတွင် account identifier တစ်ခုသာရှိပြီး၊ ထိုအချိန်မှစ၍ မည်သည့်နေရာတွင်မျှ လိပ်စာမရှိတော့ပါ။ အကောင့်ဖွင့်ခြင်းသည် သင့်အကြောင်း မည်သည့်အရာမျှ မမေးပါ— သင့်အကောင့်သည် စကားလုံး ၂၄ လုံးပါ recovery phrase တစ်ခုဖြစ်ပြီး Firebase Authentication စစ်ဆေးသည့် credential ကို ၎င်းမှ ဆင်းသက်ထုတ်ယူသည်။ ၎င်းကသိမ်းဆည်းထားသည်မှာ မေးလ်လက်ခံနိုင်သည့် domain မဟုတ်သော domain တစ်ခုအောက်ရှိ ကျပန်း label တစ်ခုသာဖြစ်သည်။

သီးခြားစွာ— အက်ပ်သည် Google Firebase ပေါ်တွင် လည်ပတ်နေသောကြောင့်၊ Google သည် သင့်စက်၏ ၎င်းသို့ ချိတ်ဆက်မှုတိုင်း၏ IP လိပ်စာနှင့် အချိန်ကို မြင်နိုင်သည်။ ၎င်းသည် hosting ၏ဂုဏ်သတ္တိတစ်ခုဖြစ်ပြီး၊ အက်ပ်၏ဂုဏ်သတ္တိမဟုတ်ဘဲ ကျွန်ုပ်တို့ ကုဒ်ဝှက်၍ ဖယ်ရှားလို့မရပါ။`,
    },
    {
      title: '3. လူများသည် သင့်ကိုမည်သို့ ရှာဖွေတွေ့ရှိနိုင်သနည်း',
      body: `၎င်းတို့သည် သင့်ကို ရှာဖွေ၍မရနိုင်ပါ။ directory မရှိပါ — email၊ ဖုန်းနံပါတ် သို့မဟုတ် အမည်ဖြင့် ရှာဖွေခြင်းမရှိပါ — ထိုသို့ကြိုးစားသော query ကို ဆာဗာက ငြင်းပယ်ပါသည်။

သင်သည် လူတစ်ဦးထံ invite link ကို channel ပြင်ပမှတစ်ဆင့် သင်အသုံးပြုနေရင်းဖြင့် ပေးပို့ခြင်းဖြင့် ဆက်သွယ်နိုင်သည်။ link တစ်ခုသည် တစ်ကြိမ်သာ အသုံးပြု၍ရပြီး ၂၄ နာရီအကြာတွင် သက်တမ်းကုန်ဆုံးကာ ရုပ်သိမ်းနိုင်သည်။ သင်လူတစ်ဦးအား မည်သို့ခေါ်သည်ဆိုသည်မှာ သင့်အတွက်သိမ်းဆည်းထားသော သင်ကိုယ်တိုင်၏ label ဖြစ်ပြီး၊ ၎င်းတို့ကိုယ်တိုင်မိတ်ဆက်ခဲ့ပါက ထိုအမည်သည် ကုဒ်ဝှက်ထားသောပုံစံဖြင့် သင့်ထံရောက်ရှိလာသည်။`,
    },
    {
      title: '4. ကျွန်ုပ်တို့ စုဆောင်းသည့်အရာများ',
      body: `• အကောင့်ဒေတာ— account identifier တစ်ခုနှင့် Firebase Authentication တွင်သိမ်းဆည်းထားသော သင့် recovery phrase မှ ဆင်းသက်ထုတ်ယူသော credential တစ်ခု။ email လိပ်စာ၊ ဖုန်းနံပါတ်၊ အမည် မရှိပါ — အကောင့်ဖွင့်ခြင်းသည် ၎င်းတို့မှ မည်သည့်အရာမျှ မတောင်းဆိုပါ။
• စာနှင့် ပူးတွဲဖိုင်များ၏ ciphertext၊ အပိုင်း ၂ ရှိ metadata နှင့်အတူ။

ထိုစာရင်းသည် အားလုံးပင်ဖြစ်သည်။ analytics နှင့် crash reporting မရှိပါ။ အက်ပ်သည် ယခင်က screen views များကို Firebase Analytics သို့နှင့် crash reports များကို Firebase Crashlytics သို့ ပို့ခဲ့ပြီး၊ ၎င်းနှစ်ခုစလုံးသည် သင့်အကောင့် identifier ကို ပါဝင်စေခဲ့သဖြင့် မည်သည့်တစ်ခုမျှ အမည်ဝှက်မဟုတ်ခဲ့ပါ; ၎င်းနှစ်ခုစလုံးကို ၎င်းတို့ပို့ခဲ့သော library များနှင့်အတူ ဖယ်ရှားလိုက်ပါသည်။ Error များကို developer ၏ကိုယ်ပိုင်စက်ပေါ်တွင် development လုပ်နေစဉ်သာ print ထုတ်ပြီး အခြားနေရာသို့ မသွားပါ။`,
    },
    {
      title: '5. မည်သည့်နေရာတွင် သိမ်းဆည်းထားသနည်း',
      body: `Google Firebase — Firestore, Storage နှင့် Authentication — တွင် documnet တစ်ခုစီကို မည်သူဖတ်နိုင်ရေးနိုင်သည်ကို ဆုံးဖြတ်သည့် security rules များအောက်တွင်။

သင့်စက်ပေါ်တွင်၊ cache လုပ်ထားသော စာများ၊ settings နှင့် သင့် app-lock PIN ကို ပုံမှန် app storage အစား platform keystore (iOS Keychain, Android Keystore) တွင် သိမ်းဆည်းထားသော per-device key ဖြင့် ကုဒ်ဝှက်ထားသည်။

သင့်စာများကို decrypt ပြုလုပ်သည့် private key သည် သင်ရေးမှတ်ရန်ရွေးချယ်သော recovery phrase မှလွဲ၍ သင့်စက်မှ တစ်ခါမျှ ထွက်မသွားပါ။ ကျွန်ုပ်တို့ ၎င်းကိုမကိုင်ဆောင်ပါ၊ သင့်အတွက်ပြန်လည်ရယူပေးလည်း မရနိုင်ပါ။ ၎င်းကိုဆုံးရှုံးပါက ထိုစက်သို့ပို့ထားသောစာများကို ကျွန်ုပ်တို့အပါအဝင် မည်သူမျှ ထပ်မံဖတ်ရှုနိုင်တော့မည်မဟုတ်ပါ။`,
    },
    {
      title: '6. အခြားမည်သူများက ဒေတာရရှိသနည်း',
      body: `ကျွန်ုပ်တို့သည် သင့်ကိုယ်ရေးအချက်အလက်ကို မရောင်း၊ မလဲလှယ်၊ မငှားရမ်းပါ။ ဒေတာ ရောက်ရှိသည့်နေရာများ—

• Google Firebase — အထက်တွင်ဖော်ပြထားသည့်အတိုင်း ကျွန်ုပ်တို့၏ hosting provider။
• Cloudflare Realtime — သင့်စက်နှင့် အခြားသူ၏စက်တို့ တိုက်ရိုက်ချိတ်ဆက်၍မရသောအခါ ခေါ်ဆိုမှု၏အသံနှင့်ဗီဒီယိုကို ပို့ဆောင်ပေးသည်။
• Wikimedia Foundation — Wikipedia တွင်ရှာဖွေရန် တို့နှိပ်သောအခါ အမည်တစ်ခု။
• Google Cloud Speech-to-Text — transcript တောင်းဆိုသောအခါ voice message တစ်ခု၏ အသံ။
• Google Cloud Translation — ဘာသာပြန်ဆိုမှုတောင်းဆိုသောအခါ စာတစ်စောင်၏ စာသား။
• Cloudflare Workers AI — အနှစ်ချုပ်တောင်းဆိုသည့်အခါ (သို့) ၎င်းအကြောင်း မေးမြန်းသည့်အခါ စကားပြောဆိုမှုတစ်ခု၏ နောက်ဆုံးစာ ၅၀ အထိ။

နောက်ဆုံးသုံးခုကို ဤဗားရှင်းတွင် ပိတ်ထားသည်။ transcription၊ translation (သို့) summaries များကို ဖွင့်ရန် app တွင် ထိန်းချုပ်မှုမရှိသဖြင့် ထိုဝန်ဆောင်မှုသုံးခုသို့ မည်သည့်အရာမျှ မရောက်ရှိပါ။ code သည် ယခုတိုင်ရှိနေဆဲဖြစ်ပြီး feature များ ပြန်လာရန်ရည်ရွယ်ထားသောကြောင့် ၎င်းတို့ကို ဖျက်မည့်အစား စာရင်းသွင်းထားခြင်းဖြစ်သည် — ၎င်းတို့ပြန်လာသောအခါ ဤဖော်ပြချက်နှင့်အတူ ပထမဆုံးအသုံးပြုမီ prompt တစ်ခုနှင့်အတူ ပြန်လာမည်ဖြစ်သည်။ ထိုအချိန်တွင် ပို့မည့်အရာသည် သင့်ရလဒ်ထုတ်လုပ်ရန်အတွက်သာဖြစ်ပြီး မည်သည့်အရာမျှ လေ့ကျင့်ရန်မဟုတ်ပါ; transcript (သို့) translation မည်သည့်တစ်ခုမျှ ကျွန်ုပ်တို့ ဆာဗာများတွင် သိမ်းဆည်းမထားပါ။

Wikipedia ရှာဖွေမှုတွင် switch မရှိပါ၊ အကြောင်းမှာ ပိတ်ရန် မည်သည့်အရာမျှ မရှိသောကြောင့်ဖြစ်သည်— ၎င်းသည် tap ချိန်တွင်သာ အလုပ်လုပ်ပြီး အခြားနည်းဖြင့် မဟုတ်ပါ။ Wikipedia သည် ထိုအမည်တစ်ခုတည်းနှင့် သင့် IP လိပ်စာကို ရရှိသည်၊ ၎င်းတို့၏ ရှာဖွေရေးဘောက်စ်တွင် သင်ကိုယ်တိုင်ရိုက်ထည့်သကဲ့သို့ပင် — account, message, conversation မရှိပါ။ ပြန်ရလာသည်များကို ပြသပြီး သိမ်းမထားပါ၊ ၎င်းနှင့်ပတ်သက်၍ မည်သည့်အရာမျှ စကားဝိုင်းထဲသို့ ရေးမထားပါ။

Cloudflare Realtime တွင်လည်း ခလုတ်မရှိပါ။ ခေါ်ဆိုမှုအများစုတွင် ၎င်းမလိုအပ်ပါ— တစ်ခုနှင့်တစ်ခု တိုက်ရိုက်ချိတ်ဆက်နိုင်သော စက်နှစ်ခု၊ တူညီသောကွန်ရက်ပေါ်ရှိ ခေါ်ဆိုမှုအများစု၊ သည် ၎င်းမပါဘဲ ချိတ်ဆက်ပြီး မည်သည့်အရာမျှ ပို့ဆောင်ခြင်းမရှိပါ။ တိုက်ရိုက်ချိတ်ဆက်၍မရသောအခါ—များသောအားဖြင့် နှစ်ဦးစလုံး မတူညီသော မိုဘိုင်းကွန်ရက်များပေါ်တွင်ရှိနေသောကြောင့်—ရှိပြီးသား စာဝှက်ထားသော ခေါ်ဆိုမှုကို ချိတ်ဆက်၍မရအောင် ထားမည့်အစား ပို့ဆောင်ပေးသည်။ Cloudflare မြင်ရသည်မှာ နှစ်ဦးစလုံး၏ IP လိပ်စာများ၊ ခေါ်ဆိုမှု၏အချိန်၊ နှင့် ဒေတာမည်မျှ ရွှေ့ပြောင်းခဲ့သည်ကို ခန့်မှန်းခြင်းတို့သာဖြစ်ပြီး၊ အသံနှင့်ဗီဒီယိုသည် အပိုင်း ၂ တွင်ဖော်ပြထားသော DTLS-SRTP စာဝှက်စနစ်အောက်တွင်ပင် ဆက်လက်ရှိနေသောကြောင့် ပို့ဆောင်ခြင်းက ၎င်းတို့ကို စာဝှက်ဖြည်ခြင်းမပြုနိုင်ပါ။

ဥပဒေကတောင်းဆိုပါက ကျွန်ုပ်တို့ကိုင်ဆောင်ထားသည်များကို ဖော်ပြပေးနိုင်ပါသည်။ ကျွန်ုပ်တို့ကိုင်ဆောင်ထားသည်မှာ အပိုင်း ၂ ရှိစာရင်းဖြစ်သည်။ ကျွန်ုပ်တို့သည် message contents များကို မဖတ်နိုင်သောကြောင့် ၎င်းတို့ကို ထုတ်ပေးနိုင်မည်မဟုတ်ပါ။`,
    },
    {
      title: '7. Push notifications',
      body: `Firebase Cloud Messaging က notification များကို ပေးပို့ပါသည်။ သင့်စက်၏ token ကို သင်သာဖတ်နိုင်သော သင့်အကောင့်၏ private အပိုင်းတွင် သိမ်းဆည်းထားသည်။

Notifications များတွင် message စာသား မပါဝင်ပါ။ သင့်စက်သည် message ကို local တွင် decrypt လုပ်ပြီး သင်မြင်ရသည်များကို ဖန်တီးသည်; Google က content မဟုတ်ဘဲ envelope ကိုသာ ပေးပို့သည်။`,
    },
    {
      title: '8. သင်ပြုလုပ်နိုင်သည့်အရာများ',
      body: `• Profile screen မှသင့်အကောင့်ကို ဖျက်ပါ။ စကားပြောဆိုမှု၏ ဖက်နှစ်ဖက်ပိုင်အကြောင်းအရာ — ဥပမာ ခေါ်ဆိုမှုမှတ်တမ်း — သည် အခြားပါဝင်သူထံတွင် ကျန်ရှိနေမည်ဖြစ်သည်၊ အကြောင်းမှာ ၎င်းသည် သူတို့၏မှတ်တမ်းလည်းဖြစ်သောကြောင့်ဖြစ်သည်။
• Profile screen မှ သင့်ဒေတာကို export ပါ။
• chat တစ်ခုစီအလိုက် message expire ရန်သတ်မှတ်ပါ— ၁ နာရီ၊ ၂၄ နာရီ၊ ၇ ရက် (သို့) ၃၀ ရက်။
• Typing indicators နှင့် read receipts ကို ဖွင့်/ပိတ်ပါ။ နှစ်ခုစလုံးကို default အနေဖြင့် ပိတ်ထားသည်။
• PIN (သို့) biometrics ဖြင့် app ကိုသော့ခတ်ပါ။
• သင်ပေးထားသော invite link ကို ရုပ်သိမ်းပါ။

တစ်စုံတစ်ခုကို ကျွန်ုပ်တို့ကိုယ်တိုင် ဖျက်စေလိုပါက ကျွန်ုပ်တို့ထံစာရေးပါ။`,
    },
    {
      title: '9. ထိန်းသိမ်းမှု',
      body: `သင့်အကောင့်တည်ရှိနေသရွေ့ ကျွန်ုပ်တို့သည် သင့်ဒေတာကို ထိန်းသိမ်းထားပါသည်။ အကောင့်ဖျက်ခြင်းသည် အထက်တွင်ဖော်ပြထားသော ဖက်နှစ်ဖက်ပိုင်အကြောင်းအရာမှလွဲ၍ ၎င်းကို ဖျက်ပစ်ပါသည်။ chat အလိုက်ကာလကုန်ဆုံးမှုသည် သင်သတ်မှတ်ထားသော အချိန်ဇယားအတိုင်း message များကို ဖယ်ရှားပါသည်။`,
    },
    {
      title: '10. သင်သိထားသင့်သော ကန့်သတ်ချက်များ',
      body: `ကျွန်ုပ်တို့သည် သင့်အား ၎င်းတို့ကိုမတွေ့ရမီ ပြောပြလိုပါသည်။

• Key များကို ပထမဆုံးတွေ့ချိန်တွင် ယုံကြည်ကိုးစားထားသည်။ တစ်စုံတစ်ဦးက သင်စာမပြောင်းလဲဆက်ဆံမီ key ကိုအစားထိုးထားပါက စကားပြောဆိုမှုသည် လူမှားသို့ encrypt လုပ်ပြီး လုံးဝပုံမှန်ကဲ့သို့ ပေါ်လိမ့်မည်။ Key ပြောင်းလဲသွားပါက app က သင့်ကိုသတိပေးပြီး channel ပြင်ပတွင်နှိုင်းယှဉ်နိုင်သော safety number ကို ပြသပါသည် — သို့သော် ၎င်းကိုနှိုင်းယှဉ်ရန် မည်သည့်အရာမျှ မတွန်းအားပေးပါ။
• တစ်ကြိမ်တွင် စက်တစ်ခုသာ။ သင့် recovery phrase သည် သင့်history ကိုဖွင့်သော key ကို ပြန်လည်ရယူပေးသည်၊ ထို့ကြောင့် စက်အသစ်တွင် sign in ခြင်းသည် သင်ရရှိပြီးသားများကို မဆုံးရှုံးစေပါ။ Forward-secret စကားပြောဆိုမှုများသည် ၎င်းကို ဖန်တီးသောစက်မှ တစ်ခါမျှ မထွက်သည့် ဒုတိယ key ကို အသုံးပြုသည်— နောက်ဆုံး sign in ဝင်သောစက်ကသာ ၎င်းသို့ ရောက်ရှိနိုင်ပြီး ထိုအတောအတွင်း အခြားစက်သို့ ပိတ်ထားသောအရာများကို ကူးပြောင်း၍မရနိုင်ပါ။
• Encryption မတည်ရှိမီ ပို့ထားသော message များသည် ယခင်အတိုင်း ရှိနေပါသည်။ Retroactive အနေဖြင့် ပြောင်းလဲမှု မရှိပါ။
• ဤ app ကို လွတ်လပ်သော security audit ပြုလုပ်ရသေးခြင်း မရှိပါ။`,
    },
    {
      title: '11. ကလေးများ',
      body: `Chatterbox ကို အသက် ၁၃ နှစ်အောက် ကလေးများအတွက် ရည်ရွယ်ထားခြင်း မဟုတ်ပါ၊ ၎င်းတို့၏အချက်အလက်ကို ကျွန်ုပ်တို့ သိလျက်နှင့် မစုဆောင်းပါ။ ကလေးတစ်ဦးက ကျွန်ုပ်တို့ကို ကိုယ်ရေးအချက်အလက်ပေးထားသည်ဟု သင်ယုံကြည်ပါက ကျွန်ုပ်တို့ထံဆက်သွယ်ပါ၊ ကျွန်ုပ်တို့ ၎င်းကိုဖျက်ပေးပါမည်။`,
    },
    {
      title: '12. ပြောင်းလဲမှုများ',
      body: `ကျွန်ုပ်တို့သည် ဤမူဝါဒကို update လုပ်နိုင်ပါသည်။ သိသာထင်ရှားသော ပြောင်းလဲမှုများကို app တွင်ကြေညာမည်ဖြစ်ပြီး၊ ထိပ်ဆုံးရှိရက်စွဲသည် ၎င်း နောက်ဆုံးပြောင်းလဲခဲ့သည့်အချိန်ဖြစ်သည်။`,
    },
    {
      title: '13. ဆက်သွယ်ရန်',
      body: `ဤမူဝါဒနှင့်ပတ်သက်သည့် မေးခွန်းများ— ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. ပိုမိုအသစ်သော အက်ပ်ဗားရှင်းကို စစ်ဆေးခြင်း',
      body: `Google Play သည် ဤအက်ပ်ကို သင့် Android ဖုန်းသို့ ရောက်ရှိစေသည့် နည်းလမ်းမဟုတ်ပါ။ ၎င်းကို chatterbox.fans မှ ဒေါင်းလုဒ်လုပ်ရသည်၊ ထို့ပြင် ဤလုပ်ငန်းစဉ်တွင် မပါဝင်သော စတိုးသည် သင့်ကိုယ်စား အပ်ဒိတ်များကို စစ်ဆေးပေးနိုင်မည်မဟုတ်ပါ — ထို့ကြောင့် သင်တောင်းဆိုပါက ဤအက်ပ်ကိုယ်တိုင် ၎င်းကို လုပ်ဆောင်နိုင်ပါသည်။

"ယခုစစ်ဆေးရန်" ကို တို့ခြင်းက လက်ရှိဗားရှင်းမှာ မည်သည်ဖြစ်သည်ကို မေးမြန်းသည့် တောင်းဆိုချက်တစ်ခုကို chatterbox.fans သို့ ပေးပို့ပါသည်။ ထိုတောင်းဆိုချက်တွင် သင့် IP လိပ်စာသာ ပါဝင်ပြီး အခြားမည်သည့်အရာမျှ မပါဝင်ပါ — အကောင့်မရှိ၊ စက်ပစ္စည်းအမှတ်အသားမရှိ၊ မက်ဆေ့ခ်ျမရှိပါ။ ပြန်လာသည်မှာ ဗားရှင်းနံပါတ်တစ်ခုဖြစ်ပြီး သင့်ဖုန်းပေါ်တွင် လက်ရှိအသုံးပြုနေသောဗားရှင်းနှင့် နှိုင်းယှဉ်ပါသည်၊ မည်သည့်အရာမျှ အလိုအလျောက် ဒေါင်းလုဒ်မလုပ်ပါ၊ ထို့ပြင် ဤစစ်ဆေးမှုနှင့်ပတ်သက်၍ မည်သည့်အရာမျှ စကားဝိုင်းထဲသို့ မရေးမှတ်ပါ။

ဤအရာတွင် ခလုတ်မရှိပါ၊ အဘယ်ကြောင့်ဆိုသော် ပိတ်ရန် မည်သည့်အရာမျှ မရှိသောကြောင့်ဖြစ်သည်— ၎င်းသည် တို့သောအခါတွင်သာ လုပ်ဆောင်ပြီး အခြားနည်းဖြင့် မလုပ်ဆောင်ပါ။

အပ်ဒိတ်ကို သွင်းပါက ၎င်းသည် တူညီသောလက်မှတ်ရေးထိုးသောသော့ကို အသုံးပြု၍ အက်ပ်ကို ၎င်း၏နေရာတွင် အစားထိုးလိမ့်မည်၊ Google Play မှ အပ်ဒိတ်တစ်ခုကဲ့သို့ပင်ဖြစ်သည်။`,
    },
  ],

  km: [
    {
      title: '0. សង្ខេប',
      body: `អត្ថបទសាររបស់អ្នកត្រូវបានអ៊ិនគ្រីបនៅលើឧបករណ៍របស់អ្នក ហើយអាចអានបានតែដោយអ្នកដែលអ្នកផ្ញើសារនោះទៅឱ្យប៉ុណ្ណោះ។ យើងមិនអាចអានវាបានទេ ហើយ Google ដែលយើងជួលម៉ាស៊ីនមេក៏មិនអាចអានវាបានដែរ។

អ្វីដែលយើងអាចមើលឃើញគឺមានការសន្ទនាបានកើតឡើង៖ គណនីណាខ្លះនៅក្នុងនោះ និងពេលណាដែលពួកគេសកម្ម។ ការលុបបំបាត់រឿងនោះពិបាកជាងការអ៊ិនគ្រីបមាតិកា ហើយយើងនៅមិនទាន់បញ្ចប់នៅឡើយទេ។ គោលការណ៍នេះប្រាប់យ៉ាងច្បាស់ថាព្រំដែននោះនៅត្រង់ណាឥឡូវនេះ។`,
    },
    {
      title: '1. អ្វីដែលអ៊ិនគ្រីបពីចុងដល់ចុង',
      body: `អ៊ិនគ្រីបនៅលើឧបករណ៍របស់អ្នក មិនអាចអានបានទាំងយើងនិង Google៖

• អត្ថបទសាររបស់អ្នក។
• មាតិកានៃឯកសារ រូបថត អូឌីយ៉ូ និងវីដេអូដែលអ្នកភ្ជាប់មកជាមួយ។
• ការមើលជាមុននៃតំណភ្ជាប់។
• ការហៅសំឡេង និងវីដេអូ ដែលប្រើ DTLS-SRTP ដែលចាំបាច់របស់ WebRTC រវាងឧបករណ៍ទាំងពីរ។

សារភាគច្រើនរវាងមនុស្សពីរនាក់ និងក្រុមក៏ប្រើប្រព័ន្ធ ratchet ផងដែរ មានន័យថាសារនីមួយៗមានកូនសោផ្ទាល់ខ្លួន ដូច្នេះការសម្របសម្រួលឧបករណ៍របស់អ្នកមិនបង្ហាញសារមុនៗឡើយ។ ការសន្ទនាដែលកម្មវិធីរបស់អ្នកណាម្នាក់មិនទាន់បានផ្សព្វផ្សាយសម្ភារៈកូនសោថ្មីជាងនេះ ត្រឡប់ទៅប្រើកូនសោមួយដែលមានអាយុកាលវែងជំនួសវិញ ដែលមិនមានលក្ខណៈពិសេសនោះទេ។ ស្លាកនៅក្រោមសារនីមួយៗប្រាប់អ្នកថាតើវាទទួលបានប្រភេទណាជាក់ស្តែង។

មានតែរឿងតែមួយប៉ុណ្ណោះដែលឆ្លងកាត់បន្ទាត់នេះ ហើយតែពេលអ្នកស្នើសុំប៉ុណ្ណោះ៖ ការស្វែងរកឈ្មោះនៅលើវិគីភីឌាផ្ញើឈ្មោះនោះតែមួយ មិនមែនសារដែលវាមកពីនោះទេ។ ផ្នែកទី ៦ ប្រាប់ថាអ្នកណាទទួលបានវា ហើយការស្វែងរកដំណើរការតែពេលចុចប៉ុណ្ណោះ មិនមែនតាមវិធីផ្សេង ដូច្នេះមិនមានអ្វីត្រូវបិទឡើយ។ ការសង្ខេប ការបកប្រែ និងការសរសេរតាមសំឡេងក៏នឹងឆ្លងកាត់វាដែរ — ពួកវាត្រូវបានបិទក្នុងកំណែនេះ ដោយគ្មានការគ្រប់គ្រងណាមួយក្នុងកម្មវិធីដែលបើកពួកវាឡើយ។`,
    },
    {
      title: '2. អ្វីដែលមិនអ៊ិនគ្រីប និងអ្វីដែលយើងអាចមើលឃើញ',
      body: `ការអ៊ិនគ្រីបការពារមាតិកា មិនមែនការពិតនៃការសន្ទនាទេ។ ទាំងនេះស្ថិតនៅច្បាស់លាស់នៅលើម៉ាស៊ីនមេរបស់យើង៖

• អ្នកណានៅក្នុងការសន្ទនានីមួយៗ និងពេលណាដែលវាត្រូវបានបង្កើត និងសកម្មចុងក្រោយ។
• ត្រាពេលវេលារបស់សារនីមួយៗ និងចំនួនប៉ុន្មានដែលអ្នកមិនទាន់អាន។
• ឈ្មោះឯកសារ ប្រភេទ និងទំហំរបស់ឯកសារភ្ជាប់។ ប៊ៃត្រូវបានអ៊ិនគ្រីប ការពិពណ៌នារបស់វាមិនមែនទេ ហើយប្រវែងនៃអត្ថបទសម្ងាត់កំណត់ព្រំដែនប្រវែងដើម។
• មិត្តភក្តិ និងសំណើមិត្តភក្តិរបស់អ្នក។
• សញ្ញាហៅ — ការហៅត្រូវបានធ្វើឡើង ទៅកាន់អ្នកណា និងពេលណា។ មិនមែនអូឌីយ៉ូ ឬវីដេអូរបស់វាទេ។

ការបង្ហាញការវាយអក្សរ និងបង្កាន់ដៃការអានត្រូវបានបិទ លុះត្រាតែអ្នកបើកវា ហើយខណៈពេលដែលបិទគ្មានអ្វីត្រូវបានសរសេរឡើយ។

អ្វីដែលលែងមាននៅទីនេះទៀត៖ អាសយដ្ឋានអ៊ីមែល និងឈ្មោះរបស់អ្នក។ ចាប់តាំងពីខែកញ្ញា ២០២៦ កំណត់ត្រាគណនីមានតែអត្តសញ្ញាណគណនីប៉ុណ្ណោះ — ហើយចាប់តាំងពីពេលនោះមក គ្មានអាសយដ្ឋានត្រូវរក្សាទុកនៅកន្លែងណាមួយឡើយ។ ការចុះឈ្មោះមិនសួរអ្វីអំពីអ្នកទេ៖ គណនីរបស់អ្នកគឺជាឃ្លាសង្គ្រោះ ២៤ ពាក្យ ហើយលិខិតបញ្ជាក់ដែល Firebase Authentication ពិនិត្យត្រូវបានទាញយកពីវា។ អ្វីដែលវារក្សាទុកគឺជាស្លាកចៃដន្យក្រោមដែនដែលមិនអាចទទួលសំបុត្របាន។

ដាច់ដោយឡែក៖ ដោយសារកម្មវិធីដំណើរការនៅលើ Google Firebase, Google អាចមើលឃើញអាសយដ្ឋាន IP និងពេលវេលានៃការតភ្ជាប់នីមួយៗដែលឧបករណ៍របស់អ្នកធ្វើទៅកាន់វា។ នោះជាលក្ខណៈពិសេសនៃការបង្ហោះ មិនមែនកម្មវិធីទេ ហើយយើងមិនអាចអ៊ិនគ្រីបវាចេញបានឡើយ។`,
    },
    {
      title: '3. របៀបដែលមនុស្សរកឃើញអ្នក',
      body: `ពួកគេមិនអាចស្វែងរកអ្នកបានទេ។ គ្មានបញ្ជីឈ្មោះ — គ្មានការស្វែងរកតាមអ៊ីមែល លេខទូរស័ព្ទ ឬឈ្មោះ — ហើយម៉ាស៊ីនមេបដិសេធសំណើណាមួយដែលព្យាយាមធ្វើដូច្នេះ។

អ្នកទាក់ទងនរណាម្នាក់ដោយផ្ញើតំណភ្ជាប់អញ្ជើញទៅឱ្យគាត់ក្រៅបណ្តាញ តាមរយៈអ្វីដែលអ្នកកំពុងប្រើប្រាស់រួចហើយ។ តំណភ្ជាប់ដំណើរការតែម្តង ផុតកំណត់បន្ទាប់ពី ២៤ ម៉ោង ហើយអាចដកហូតវិញបាន។ អ្វីដែលអ្នកហៅនរណាម្នាក់គឺជាស្លាកផ្ទាល់ខ្លួនរបស់អ្នកសម្រាប់ពួកគេ រក្សាទុកសម្រាប់អ្នក; ប្រសិនបើពួកគេណែនាំខ្លួនឯង ឈ្មោះនោះបានមកដល់អ្នកតាមរបៀបអ៊ិនគ្រីប។`,
    },
    {
      title: '4. អ្វីដែលយើងប្រមូល',
      body: `• ទិន្នន័យគណនី៖ អត្តសញ្ញាណគណនី និងលិខិតបញ្ជាក់ដែលទាញយកពីឃ្លាសង្គ្រោះរបស់អ្នក រក្សាទុកនៅក្នុង Firebase Authentication។ គ្មានអាសយដ្ឋានអ៊ីមែល គ្មានលេខទូរស័ព្ទ គ្មានឈ្មោះ — ការចុះឈ្មោះមិនសួររឿងណាមួយក្នុងចំណោមទាំងនេះទេ។
• អត្ថបទសម្ងាត់នៃសារ និងឯកសារភ្ជាប់ បូកនឹងទិន្នន័យមេតានៅផ្នែកទី ២។

នោះជាបញ្ជីទាំងអស់។ គ្មានការវិភាគ និងគ្មានការរាយការណ៍ការគាំង។ កម្មវិធីធ្លាប់ផ្ញើទិដ្ឋភាពអេក្រង់ទៅ Firebase Analytics និងរបាយការណ៍ការគាំងទៅ Firebase Crashlytics ទាំងពីរនាំយកអត្តសញ្ញាណគណនីរបស់អ្នក ដូច្នេះទាំងពីរមិនអនាមិកទេ; ទាំងពីរបានបាត់ទៅហើយ ជាមួយបណ្ណាល័យដែលបានផ្ញើពួកវា។ កំហុសត្រូវបានបោះពុម្ពនៅលើម៉ាស៊ីនផ្ទាល់របស់អ្នកអភិវឌ្ឍកំឡុងពេលអភិវឌ្ឍ ហើយមិនទៅកន្លែងផ្សេងទៀតឡើយ។`,
    },
    {
      title: '5. កន្លែងដែលវារក្សាទុក',
      body: `នៅលើ Google Firebase — Firestore, Storage និង Authentication — ក្រោមច្បាប់សុវត្ថិភាពដែលសម្រេចថាអ្នកណាអាចអាន និងសរសេរឯកសារនីមួយៗ។

នៅលើឧបករណ៍របស់អ្នក សារដែលបានផ្ទុកសម្រាប់ការចូលប្រើលឿន ការកំណត់ និង PIN ចាក់សោកម្មវិធីរបស់អ្នកត្រូវបានអ៊ិនគ្រីបជាមួយកូនសោក្នុងឧបករណ៍នីមួយៗដែលរក្សាទុកនៅក្នុងឃ្លាំងគ្រាប់ចុចវេទិកា (iOS Keychain, Android Keystore) ជំនួសឱ្យផ្ទុកកម្មវិធីធម្មតា។

កូនសោឯកជនដែលឌិគ្រីបសាររបស់អ្នកមិនចេញពីឧបករណ៍របស់អ្នកឡើយ លើកលែងតែជាឃ្លាសង្គ្រោះដែលអ្នកជ្រើសរើសសរសេរចុះ។ យើងមិនកាន់កាប់វា ហើយមិនអាចយកវាមកវិញឱ្យអ្នកបានទេ។ បើបាត់វា សារដែលបានផ្ញើទៅឧបករណ៍នោះមិនអាចអានឡើងវិញបានទេ — ដោយនរណាម្នាក់ រួមទាំងយើងផងដែរ។`,
    },
    {
      title: '6. អ្នកណាផ្សេងទៀតទទួលបានទិន្នន័យ',
      body: `យើងមិនលក់ ដោះដូរ ឬឱ្យជួលព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នកឡើយ។ ទិន្នន័យទៅដល់៖

• Google Firebase — អ្នកផ្តល់សេវាបង្ហោះរបស់យើង ដូចបានពិពណ៌នាខាងលើ។
• Cloudflare Realtime — សំឡេង និងវីដេអូនៃការហៅទូរស័ព្ទ នៅពេលឧបករណ៍របស់អ្នក និងឧបករណ៍របស់អ្នកម្នាក់ទៀត មិនអាចទាក់ទងគ្នាដោយផ្ទាល់បាន។
• មូលនិធិវិគីមេឌា — ឈ្មោះមួយ នៅពេលអ្នកចុចដើម្បីស្វែងរកនៅលើវិគីភីឌា។
• Google Cloud Speech-to-Text — សំឡេងនៃសារសំឡេងមួយ នៅពេលអ្នកស្នើសុំអត្ថបទចម្លង។
• Google Cloud Translation — អត្ថបទនៃសារមួយ នៅពេលអ្នកស្នើសុំការបកប្រែ។
• Cloudflare Workers AI — រហូតដល់សារ ៥០ ចុងក្រោយនៃការសន្ទនាមួយ នៅពេលអ្នកស្នើសុំសេចក្តីសង្ខេប ឬសួរសំណួរអំពីវា។

បីចុងក្រោយត្រូវបានបិទក្នុងកំណែនេះ។ គ្មានការគ្រប់គ្រងណាមួយក្នុងកម្មវិធីដែលបើកការសរសេរតាមសំឡេង ការបកប្រែ ឬសេចក្តីសង្ខេប ដូច្នេះគ្មានអ្វីទៅដល់សេវាទាំងបីនោះទេ។ ពួកវាត្រូវបានរាយបញ្ជីជំនួសឱ្យលុប ពីព្រោះកូដនៅតែមាននៅទីនេះ ហើយលក្ខណៈពិសេសទាំងនោះមានបំណងនឹងត្រឡប់មកវិញ — ហើយនៅពេលពួកវាត្រឡប់មកវិញ ពួកវានឹងត្រឡប់មកជាមួយការបង្ហាញនេះ និងសារជូនដំណឹងមុនពេលប្រើប្រាស់លើកដំបូង។ អ្វីដែលនឹងត្រូវផ្ញើនៅពេលនោះត្រូវបានផ្ញើដើម្បីបង្កើតលទ្ធផលរបស់អ្នក មិនមែនដើម្បីបណ្តុះបណ្តាលអ្វីទេ; គ្មានអត្ថបទចម្លង ឬការបកប្រែណាមួយត្រូវបានរក្សាទុកនៅលើម៉ាស៊ីនមេរបស់យើងឡើយ។

ការស្វែងរកលើវិគីភីឌាគ្មានកុងតាក់ទេ ពីព្រោះគ្មានអ្វីត្រូវបិទឡើយ៖ វាដំណើរការតែពេលចុចប៉ុណ្ណោះ មិនមែនតាមវិធីផ្សេង។ វិគីភីឌាទទួលបានឈ្មោះនោះតែមួយ និងអាសយដ្ឋាន IP របស់អ្នក ដូចជាអ្នកបានវាយវាចូលក្នុងប្រអប់ស្វែងរករបស់ពួកគេផ្ទាល់ — គ្មានគណនី គ្មានសារ គ្មានការសន្ទនា។ អ្វីដែលត្រឡប់មកវិញត្រូវបានបង្ហាញ ហើយមិនត្រូវបានរក្សាទុក ហើយគ្មានអ្វីអំពីវាត្រូវបានសរសេរទៅក្នុងការសន្ទនាឡើយ។

Cloudflare Realtime ក៏មិនមានកុងតាក់ដែរ។ ការហៅទូរស័ព្ទភាគច្រើនមិនត្រូវការវាទេ៖ ឧបករណ៍ពីរដែលអាចទាក់ទងគ្នាដោយផ្ទាល់—ការហៅទូរស័ព្ទភាគច្រើននៅលើបណ្តាញតែមួយ—ភ្ជាប់គ្នាដោយមិនចាំបាច់ប្រើវា ហើយគ្មានអ្វីត្រូវបានបញ្ជូនបន្តទេ។ នៅពេលពួកគេមិនអាចធ្វើបាន—ជាទូទៅដោយសារអ្នកទាំងពីរនៅលើបណ្តាញទូរស័ព្ទចល័តខុសគ្នា—ការហៅទូរស័ព្ទដែលបានអ៊ិនគ្រីបរួចហើយនឹងត្រូវបានបញ្ជូនបន្ត ជំនួសឱ្យការទុកឱ្យវានៅតែមិនអាចភ្ជាប់បាន។ អ្វីដែល Cloudflare ឃើញគឺអាសយដ្ឋាន IP ទាំងពីរ ពេលវេលានៃការហៅទូរស័ព្ទ និងបរិមាណទិន្នន័យប្រហែលដែលបានផ្លាស់ទី។ សំឡេង និងវីដេអូនៅតែស្ថិតនៅក្រោមការអ៊ិនគ្រីប DTLS-SRTP ដូចគ្នានឹងបានពិពណ៌នានៅផ្នែកទី ២ ដូច្នេះការបញ្ជូនបន្តមិនឌិគ្រីបពួកវាឡើយ។

យើងអាចបង្ហាញអ្វីដែលយើងកាន់កាប់ប្រសិនបើច្បាប់តម្រូវ។ អ្វីដែលយើងកាន់កាប់គឺជាបញ្ជីនៅផ្នែកទី ២។ យើងមិនអាចផលិតមាតិកាសារបានទេ ពីព្រោះយើងមិនអាចអានវាបាន។`,
    },
    {
      title: '7. ការជូនដំណឹងរុញច្រាន',
      body: `Firebase Cloud Messaging ដឹកជញ្ជូនការជូនដំណឹង។ សញ្ញាសម្គាល់ឧបករណ៍របស់អ្នកត្រូវបានរក្សាទុកនៅក្នុងផ្នែកឯកជននៃគណនីរបស់អ្នកដែលមានតែអ្នកទេអាចអាន។

ការជូនដំណឹងមិននាំយកអត្ថបទសារឡើយ។ ឧបករណ៍របស់អ្នកឌិគ្រីបសារនៅមូលដ្ឋាន ហើយចងក្រងអ្វីដែលអ្នកឃើញ; Google ដឹកជញ្ជូនស្រោមសំបុត្រ មិនមែនមាតិកាទេ។`,
    },
    {
      title: '8. អ្វីដែលអ្នកអាចធ្វើបាន',
      body: `• លុបគណនីរបស់អ្នកចេញពីអេក្រង់ប្រវត្តិរូប។ មាតិកាដែលជាផ្នែកមួយរួមនៃការសន្ទនា — កំណត់ត្រាការហៅឧទាហរណ៍ — នៅតែស្ថិតនៅជាមួយអ្នកចូលរួមផ្សេងទៀត ពីព្រោះវាជាកំណត់ត្រារបស់ពួកគេផងដែរ។
• នាំចេញទិន្នន័យរបស់អ្នកពីអេក្រង់ប្រវត្តិរូប។
• កំណត់សារឱ្យផុតកំណត់តាមការជជែកនីមួយៗ៖ ១ ម៉ោង ២៤ ម៉ោង ៧ ថ្ងៃ ឬ ៣០ ថ្ងៃ។
• បើក ឬបិទការបង្ហាញការវាយអក្សរ និងបង្កាន់ដៃការអាន។ ទាំងពីរត្រូវបានបិទតាមលំនាំដើម។
• ចាក់សោកម្មវិធីជាមួយ PIN ឬជីវមាត្រ។
• ដកហូតតំណភ្ជាប់អញ្ជើញដែលអ្នកបានប្រគល់ឱ្យ។

ប្រសិនបើអ្នកចង់ឱ្យយើងលុបអ្វីមួយដោយដៃ សូមសរសេរមកយើង។`,
    },
    {
      title: '9. ការរក្សាទុក',
      body: `យើងរក្សាទុកទិន្នន័យរបស់អ្នកខណៈពេលដែលគណនីរបស់អ្នកមាន។ ការលុបគណនីនឹងលុបវាចេញ លើកលែងតែមាតិកាដែលកាន់កាប់រួមគ្នាដែលបានកត់សម្គាល់ខាងលើ។ ការផុតកំណត់តាមការជជែកនីមួយៗលុបសារតាមកាលវិភាគដែលអ្នកបានកំណត់។`,
    },
    {
      title: '10. ដែនកំណត់ដែលអ្នកគួរដឹង',
      body: `យើងចង់ប្រាប់អ្នកអំពីរឿងទាំងនេះជាជាងឱ្យអ្នករកឃើញវាដោយខ្លួនឯង។

• កូនសោត្រូវបានទុកចិត្តលើកដំបូងដែលវាត្រូវបានឃើញ។ ប្រសិនបើនរណាម្នាក់បានជំនួសកូនសោមុនពេលអ្នកធ្លាប់ផ្លាស់ប្តូរសារ ការសន្ទនានឹងត្រូវអ៊ិនគ្រីបទៅមនុស្សខុស ហើយនឹងមើលទៅធម្មតាទាំងស្រុង។ កម្មវិធីព្រមានអ្នកនៅពេលកូនសោផ្លាស់ប្តូរនៅពេលក្រោយ ហើយបង្ហាញលេខសុវត្ថិភាពដែលអ្នកអាចប្រៀបធៀបក្រៅបណ្តាញ — ប៉ុន្តែគ្មានអ្វីបង្ខំអ្នកឱ្យប្រៀបធៀបវាឡើយ។
• ឧបករណ៍តែមួយក្នុងពេលតែមួយ។ ឃ្លាសង្គ្រោះរបស់អ្នកស្តារកូនសោដែលបើកប្រវត្តិរបស់អ្នក ដូច្នេះការចូលនៅឧបករណ៍ថ្មីមិនបាត់អ្វីដែលអ្នកបានទទួលរួចហើយឡើយ។ ការសន្ទនាការពារជាមុនប្រើកូនសោទីពីរដែលមិនចេញពីឧបករណ៍ដែលបានបង្កើតវាឡើយ៖ ឧបករណ៍ណាដែលចូលចុងក្រោយគឺជាឧបករណ៍ដែលពួកគេទៅដល់ ហើយអ្វីដែលបានបិទសោទៅឧបករណ៍ផ្សេងកំឡុងពេលនោះមិនអាចផ្លាស់ប្តូរបានទេ។
• សារដែលបានផ្ញើមុនពេលមានការអ៊ិនគ្រីបនៅតែដដែល។ គ្មានអ្វីត្រូវបានបំប្លែងតាមក្រោយឡើយ។
• កម្មវិធីនេះមិនទាន់ត្រូវបានត្រួតពិនិត្យសុវត្ថិភាពដោយឯករាជ្យទេ។`,
    },
    {
      title: '11. កុមារ',
      body: `Chatterbox មិនត្រូវបានបម្រុងទុកសម្រាប់កុមារអាយុក្រោម ១៣ ឆ្នាំទេ ហើយយើងមិនចេតនាប្រមូលព័ត៌មានរបស់ពួកគេឡើយ។ ប្រសិនបើអ្នកជឿថាកុមារម្នាក់បានផ្តល់ព័ត៌មានផ្ទាល់ខ្លួនដល់យើង សូមទាក់ទងយើង ហើយយើងនឹងលុបវាចេញ។`,
    },
    {
      title: '12. ការផ្លាស់ប្តូរ',
      body: `យើងអាចធ្វើបច្ចុប្បន្នភាពគោលការណ៍នេះ។ ការផ្លាស់ប្តូរសំខាន់ៗនឹងត្រូវប្រកាសក្នុងកម្មវិធី ហើយកាលបរិច្ឆេទនៅខាងលើគឺជាពេលដែលវាបានផ្លាស់ប្តូរចុងក្រោយ។`,
    },
    {
      title: '13. ទំនាក់ទំនង',
      body: `សំណួរអំពីគោលការណ៍នេះ៖ ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. ការពិនិត្យរកកំណែកម្មវិធីថ្មីជាង',
      body: `Google Play មិនមែនជាមធ្យោបាយដែលកម្មវិធីនេះមកដល់ទូរស័ព្ទ Android របស់អ្នកទេ។ វាត្រូវបានទាញយកពី chatterbox.fans ជំនួសវិញ ហើយហាងដែលមិនបានចូលរួមក្នុងដំណើរការនេះមិនអាចពិនិត្យរកកំណែថ្មីជំនួសអ្នកបានទេ — ដូច្នេះកម្មវិធីនេះអាចធ្វើវាដោយខ្លួនឯង ប្រសិនបើអ្នកស្នើសុំ។

ការចុច "ពិនិត្យឥឡូវនេះ" នឹងផ្ញើសំណើមួយទៅ chatterbox.fans សួរថាតើកំណែបច្ចុប្បន្នគឺជាអ្វី។ សំណើនោះមានតែអាសយដ្ឋាន IP របស់អ្នកប៉ុណ្ណោះ និងគ្មានអ្វីផ្សេងទៀត — គ្មានគណនី គ្មានលេខសម្គាល់ឧបករណ៍ គ្មានសារ។ អ្វីដែលត្រឡប់មកវិញគឺជាលេខកំណែមួយ ដែលត្រូវបានប្រៀបធៀបនៅលើទូរស័ព្ទរបស់អ្នកជាមួយនឹងកំណែដែលអ្នកកំពុងដំណើរការ។ គ្មានអ្វីត្រូវបានទាញយកដោយស្វ័យប្រវត្តិទេ ហើយគ្មានអ្វីអំពីការពិនិត្យនេះត្រូវបានសរសេរទៅក្នុងការសន្ទនាទេ។

លក្ខណៈនេះមិនមានកុងតាក់ទេ ព្រោះគ្មានអ្វីត្រូវបិទ៖ វាដំណើរការតែពេលចុចប៉ុណ្ណោះ មិនមែនតាមមធ្យោបាយផ្សេងទេ។

ប្រសិនបើអ្នកដំឡើងកំណែថ្មី វានឹងជំនួសកម្មវិធីនៅកន្លែងដដែលដោយប្រើសោហត្ថលេខាដូចគ្នា ដូចជាការធ្វើបច្ចុប្បន្នភាពពី Google Play ដែរ។`,
    },
  ],

  lo: [
    {
      title: '0. ໂດຍຫຍໍ້',
      body: `ຂໍ້ຄວາມຂອງທ່ານຖືກເຂົ້າລະຫັດຢູ່ໃນອຸປະກອນຂອງທ່ານ ແລະ ສາມາດອ່ານໄດ້ໂດຍຄົນທີ່ທ່ານສົ່ງໃຫ້ເທົ່ານັ້ນ. ພວກເຮົາບໍ່ສາມາດອ່ານມັນໄດ້, ແລະ Google, ຜູ້ທີ່ພວກເຮົາເຊົ່າເຊີບເວີກໍ່ບໍ່ສາມາດອ່ານໄດ້ຄືກັນ.

ສິ່ງທີ່ພວກເຮົາເຫັນໄດ້ແມ່ນມີການສົນທະນາເກີດຂຶ້ນ: ບັນຊີໃດແດ່ຢູ່ໃນນັ້ນ, ແລະ ເມື່ອໃດພວກເຂົາໃຊ້ງານຢູ່. ການເອົາອັນນັ້ນອອກຍາກກວ່າການເຂົ້າລະຫັດເນື້ອຫາ, ແລະ ພວກເຮົາຍັງເຮັດບໍ່ສຳເລັດ. ນະໂຍບາຍນີ້ບອກຢ່າງແນ່ນອນວ່າເສັ້ນແບ່ງຢູ່ໃສໃນປັດຈຸບັນ.`,
    },
    {
      title: '1. ຫຍັງແດ່ທີ່ຖືກເຂົ້າລະຫັດແບບຕົ້ນທາງເຖິງປາຍທາງ',
      body: `ເຂົ້າລະຫັດຢູ່ໃນອຸປະກອນຂອງທ່ານ, ບໍ່ສາມາດອ່ານໄດ້ໂດຍພວກເຮົາ ແລະ Google:

• ຂໍ້ຄວາມຂອງທ່ານ.
• ເນື້ອຫາຂອງໄຟລ໌, ຮູບພາບ, ສຽງ ແລະ ວິດີໂອທີ່ທ່ານແນບມາ.
• ຕົວຢ່າງລິ້ງ.
• ການໂທດ້ວຍສຽງ ແລະ ວິດີໂອ, ເຊິ່ງໃຊ້ DTLS-SRTP ທີ່ບັງຄັບຂອງ WebRTC ລະຫວ່າງສອງອຸປະກອນ.

ຂໍ້ຄວາມແບບໜຶ່ງຕໍ່ໜຶ່ງ ແລະ ກຸ່ມສ່ວນຫຼາຍຍັງໃຊ້ ratchet ນຳ, ໝາຍຄວາມວ່າແຕ່ລະຂໍ້ຄວາມມີກະແຈຂອງຕົນເອງ, ດັ່ງນັ້ນການຖືກບຸກລຸກອຸປະກອນຂອງທ່ານຈະບໍ່ເປີດເຜີຍຂໍ້ຄວາມກ່ອນໜ້ານັ້ນ. ການສົນທະນາທີ່ລູກຄ້າຂອງຄົນອື່ນຍັງບໍ່ໄດ້ເຜີຍແຜ່ວັດສະດຸກະແຈໃໝ່ຈະກັບໄປໃຊ້ກະແຈຄົງທີ່ອາຍຸຍາວອັນດຽວ, ເຊິ່ງບໍ່ມີຄຸນສົມບັດນັ້ນ. ປ້າຍກຳກັບຢູ່ໃຕ້ຂໍ້ຄວາມບອກທ່ານວ່າມັນໄດ້ຮັບແບບໃດແທ້ຈິງ.

ມີພຽງແຕ່ຢ່າງດຽວທີ່ຂ້າມເສັ້ນນີ້, ແລະ ສະເພາະເມື່ອທ່ານຮ້ອງຂໍເທົ່ານັ້ນ: ການຄົ້ນຫາຊື່ໃນວິກິພີເດຍສົ່ງຊື່ອັນນັ້ນເທົ່ານັ້ນ, ບໍ່ແມ່ນຂໍ້ຄວາມທີ່ມັນມາຈາກ. ພາກທີ 6 ບອກວ່າໃຜເປັນຜູ້ຮັບມັນ, ແລະ ການຄົ້ນຫາເຮັດວຽກເມື່ອແຕະເທົ່ານັ້ນ ບໍ່ແມ່ນວິທີອື່ນ, ດັ່ງນັ້ນຈຶ່ງບໍ່ມີຫຍັງໃຫ້ປິດ. ການສະຫຼຸບ, ການແປ ແລະ ການຖອດຂໍ້ຄວາມກໍ່ຈະຂ້າມເສັ້ນນີ້ຄືກັນ — ພວກມັນຖືກປິດຢູ່ໃນລຸ້ນນີ້, ໂດຍບໍ່ມີການຄວບຄຸມໃດໆໃນແອັບທີ່ຈະເປີດພວກມັນ.`,
    },
    {
      title: '2. ຫຍັງແດ່ທີ່ບໍ່ໄດ້ເຂົ້າລະຫັດ, ແລະ ຫຍັງແດ່ທີ່ພວກເຮົາເຫັນໄດ້',
      body: `ການເຂົ້າລະຫັດປົກປ້ອງເນື້ອຫາ, ບໍ່ແມ່ນຄວາມຈິງທີ່ວ່າມີການສົນທະນາ. ສິ່ງເຫຼົ່ານີ້ຢູ່ຢ່າງເປີດເຜີຍຢູ່ໃນເຊີບເວີຂອງພວກເຮົາ:

• ໃຜຢູ່ໃນແຕ່ລະການສົນທະນາ, ແລະ ມັນຖືກສ້າງຂຶ້ນເມື່ອໃດ ແລະ ໃຊ້ງານຫຼ້າສຸດເມື່ອໃດ.
• ໂຕປະທັບເວລາຂອງທຸກຂໍ້ຄວາມ, ແລະ ຈຳນວນທີ່ທ່ານຍັງບໍ່ໄດ້ອ່ານ.
• ຊື່ໄຟລ໌, ປະເພດ ແລະ ຂະໜາດຂອງໄຟລ໌ແນບ. ໄບຕ໌ຖືກເຂົ້າລະຫັດ; ຄຳອະທິບາຍຂອງພວກມັນບໍ່ຖືກເຂົ້າລະຫັດ, ແລະ ຄວາມຍາວຂອງ ciphertext ຈຳກັດຄວາມຍາວຂອງຕົ້ນສະບັບ.
• ໝູ່ ແລະ ຄຳຂໍເປັນໝູ່ຂອງທ່ານ.
• ສັນຍານການໂທ — ວ່າມີການໂທເກີດຂຶ້ນ, ໂທຫາໃຜ, ແລະ ເມື່ອໃດ. ບໍ່ແມ່ນສຽງ ຫຼືວິດີໂອຂອງມັນ.

ຕົວບົ່ງບອກການພິມ ແລະ ໃບຮັບອ່ານປິດຢູ່ ເວັ້ນເສຍແຕ່ທ່ານເປີດມັນ, ແລະ ໃນຂະນະທີ່ປິດຢູ່ບໍ່ມີຫຍັງຖືກຂຽນ.

ຫຍັງແດ່ທີ່ບໍ່ຢູ່ນີ້ອີກຕໍ່ໄປ: ທີ່ຢູ່ອີເມວ ແລະ ຊື່ຂອງທ່ານ. ນັບຕັ້ງແຕ່ເດືອນກັນຍາ 2026 ບັນທຶກບັນຊີມີພຽງແຕ່ຕົວລະບຸບັນຊີເທົ່ານັ້ນ — ແລະ ນັບຕັ້ງແຕ່ນັ້ນມາບໍ່ມີທີ່ຢູ່ໃຫ້ຖືໄວ້ຢູ່ໃສເລີຍ. ການສະໝັກສະມາຊິກບໍ່ຖາມຫຍັງກ່ຽວກັບທ່ານ: ບັນຊີຂອງທ່ານແມ່ນວະລີກູ້ຄືນ 24 ຄຳ, ແລະ ຂໍ້ມູນຢັ້ງຢືນທີ່ Firebase Authentication ກວດສອບແມ່ນມາຈາກມັນ. ສິ່ງທີ່ມັນເກັບໄວ້ແມ່ນປ້າຍກຳກັບແບບສຸ່ມພາຍໃຕ້ໂດເມນທີ່ບໍ່ສາມາດຮັບເມວໄດ້.

ແຍກຕ່າງຫາກ: ເນື່ອງຈາກແອັບເຮັດວຽກຢູ່ເທິງ Google Firebase, Google ສາມາດເຫັນທີ່ຢູ່ IP ແລະ ເວລາຂອງທຸກການເຊື່ອມຕໍ່ທີ່ອຸປະກອນຂອງທ່ານເຮັດຫາມັນ. ນັ້ນແມ່ນຄຸນສົມບັດຂອງໂຮດສະຕິງ, ບໍ່ແມ່ນຂອງແອັບ, ແລະ ພວກເຮົາບໍ່ສາມາດເຂົ້າລະຫັດມັນອອກໄດ້.`,
    },
    {
      title: '3. ຄົນອື່ນຊອກຫາທ່ານແນວໃດ',
      body: `ພວກເຂົາບໍ່ສາມາດຄົ້ນຫາທ່ານໄດ້. ບໍ່ມີໄດເລກທໍລີ — ບໍ່ມີການຄົ້ນຫາດ້ວຍອີເມວ, ເບີໂທລະສັບ ຫຼືຊື່ — ແລະ ເຊີບເວີປະຕິເສດຄຳຮ້ອງຂໍໃດໆທີ່ພະຍາຍາມນັ້ນ.

ທ່ານເຂົ້າຫາໃຜຄົນໜຶ່ງໂດຍການສົ່ງລິ້ງເຊີນໃຫ້ເຂົາອອກນອກຊ່ອງທາງ, ຜ່ານສິ່ງທີ່ທ່ານໃຊ້ຢູ່ແລ້ວ. ລິ້ງໜຶ່ງໃຊ້ໄດ້ຄັ້ງດຽວ, ໝົດອາຍຸຫຼັງຈາກ 24 ຊົ່ວໂມງ, ແລະ ສາມາດຖອນອອກໄດ້. ສິ່ງທີ່ທ່ານເອີ້ນໃຜຄົນໜຶ່ງແມ່ນປ້າຍກຳກັບຂອງທ່ານເອງສຳລັບເຂົາ, ເກັບໄວ້ສຳລັບທ່ານ; ຖ້າເຂົາແນະນຳຕົນເອງ, ຊື່ນັ້ນມາຮອດທ່ານແບບເຂົ້າລະຫັດ.`,
    },
    {
      title: '4. ຫຍັງແດ່ທີ່ພວກເຮົາເກັບກຳ',
      body: `• ຂໍ້ມູນບັນຊີ: ຕົວລະບຸບັນຊີ, ແລະ ຂໍ້ມູນຢັ້ງຢືນທີ່ມາຈາກວະລີກູ້ຄືນຂອງທ່ານ, ເກັບໄວ້ໃນ Firebase Authentication. ບໍ່ມີທີ່ຢູ່ອີເມວ, ບໍ່ມີເບີໂທລະສັບ, ບໍ່ມີຊື່ — ການສະໝັກສະມາຊິກບໍ່ຖາມສິ່ງໃດເຫຼົ່ານີ້ເລີຍ.
• Ciphertext ຂອງຂໍ້ຄວາມ ແລະ ໄຟລ໌ແນບ, ບວກກັບຂໍ້ມູນເມຕາໃນພາກທີ 2.

ນັ້ນແມ່ນລາຍການທັງໝົດ. ບໍ່ມີການວິເຄາະ ແລະ ບໍ່ມີການລາຍງານຄວາມຜິດພາດ. ແອັບເຄີຍສົ່ງມຸມມອງໜ້າຈໍໄປຫາ Firebase Analytics ແລະ ລາຍງານຄວາມຜິດພາດໄປຫາ Firebase Crashlytics, ທັງສອງພາເອົາຕົວລະບຸບັນຊີຂອງທ່ານໄປນຳ, ດັ່ງນັ້ນອັນໃດອັນໜຶ່ງກໍ່ບໍ່ນິລະນາມ; ທັງສອງອັນຫາຍໄປແລ້ວ, ພ້ອມກັບຫ້ອງສະໝຸດທີ່ສົ່ງພວກມັນ. ຂໍ້ຜິດພາດຖືກພິມອອກເທິງເຄື່ອງຂອງນັກພັດທະນາເອງໃນລະຫວ່າງການພັດທະນາ ແລະ ບໍ່ໄປໃສອີກ.`,
    },
    {
      title: '5. ຂໍ້ມູນຖືກເກັບໄວ້ໃສ',
      body: `ຢູ່ Google Firebase — Firestore, Storage ແລະ Authentication — ພາຍໃຕ້ກົດລະບຽບຄວາມປອດໄພທີ່ຕັດສິນວ່າໃຜສາມາດອ່ານ ແລະ ຂຽນເອກະສານແຕ່ລະສະບັບ.

ຢູ່ອຸປະກອນຂອງທ່ານ, ຂໍ້ຄວາມທີ່ບັນທຶກໄວ້ຊົ່ວຄາວ, ການຕັ້ງຄ່າ ແລະ PIN ລັອກແອັບຂອງທ່ານຖືກເຂົ້າລະຫັດດ້ວຍກະແຈສະເພາະອຸປະກອນທີ່ເກັບໄວ້ໃນບ່ອນເກັບກະແຈຂອງແພລດຟອມ (iOS Keychain, Android Keystore) ແທນທີ່ຈະເປັນບ່ອນເກັບຂໍ້ມູນແອັບທຳມະດາ.

ກະແຈສ່ວນຕົວທີ່ຖອດລະຫັດຂໍ້ຄວາມຂອງທ່ານບໍ່ເຄີຍອອກຈາກອຸປະກອນຂອງທ່ານເລີຍ, ຍົກເວັ້ນເປັນວະລີກູ້ຄືນທີ່ທ່ານເລືອກທີ່ຈະຂຽນລົງໄວ້. ພວກເຮົາບໍ່ຖືມັນໄວ້ ແລະ ບໍ່ສາມາດກູ້ຄືນມັນໃຫ້ທ່ານໄດ້. ຖ້າເສຍມັນໄປ, ຂໍ້ຄວາມທີ່ສົ່ງໄປຫາອຸປະກອນນັ້ນຈະບໍ່ສາມາດອ່ານໄດ້ອີກ — ໂດຍໃຜກໍ່ຕາມ, ລວມທັງພວກເຮົາ.`,
    },
    {
      title: '6. ໃຜອີກແດ່ທີ່ໄດ້ຮັບຂໍ້ມູນ',
      body: `ພວກເຮົາບໍ່ຂາຍ, ແລກປ່ຽນ ຫຼືໃຫ້ເຊົ່າຂໍ້ມູນສ່ວນຕົວຂອງທ່ານ. ຂໍ້ມູນໄປຮອດ:

• Google Firebase — ຜູ້ໃຫ້ບໍລິການໂຮດສະຕິງຂອງພວກເຮົາ, ຕາມທີ່ອະທິບາຍຂ້າງເທິງ.
• Cloudflare Realtime — ສຽງ ແລະ ວິດີໂອຂອງການໂທ, ເມື່ອອຸປະກອນຂອງທ່ານ ແລະ ອຸປະກອນຂອງອີກຝ່າຍບໍ່ສາມາດເຊື່ອມຕໍ່ກັນໂດຍກົງໄດ້.
• ມູນນິທິວິກິມີເດຍ — ຊື່ໜຶ່ງ, ເມື່ອທ່ານແຕະເພື່ອຄົ້ນຫາໃນວິກິພີເດຍ.
• Google Cloud Speech-to-Text — ສຽງຂອງຂໍ້ຄວາມສຽງໜຶ່ງ, ເມື່ອທ່ານຂໍການຖອດຂໍ້ຄວາມ.
• Google Cloud Translation — ຂໍ້ຄວາມຂອງຂໍ້ຄວາມໜຶ່ງ, ເມື່ອທ່ານຂໍການແປ.
• Cloudflare Workers AI — ຮອດ 50 ຂໍ້ຄວາມຫຼ້າສຸດຂອງການສົນທະນາໜຶ່ງ, ເມື່ອທ່ານຂໍສະຫຼຸບ ຫຼືຖາມຄຳຖາມກ່ຽວກັບມັນ.

ສາມອັນສຸດທ້າຍປິດຢູ່ໃນລຸ້ນນີ້. ບໍ່ມີການຄວບຄຸມໃດໆໃນແອັບທີ່ຈະເປີດການຖອດຂໍ້ຄວາມ, ການແປ ຫຼືການສະຫຼຸບ, ດັ່ງນັ້ນຈຶ່ງບໍ່ມີຫຍັງໄປຮອດສາມບໍລິການນັ້ນ. ພວກມັນຖືກລະບຸໄວ້ແທນທີ່ຈະຖືກລຶບ ເພາະໂຄ້ດຍັງຢູ່ທີ່ນີ້ ແລະ ຄຸນສົມບັດເຫຼົ່ານັ້ນຕັ້ງໃຈຈະກັບຄືນມາ — ແລະ ເມື່ອພວກມັນກັບຄືນມາ, ພວກມັນຈະກັບຄືນມາພ້ອມກັບການເປີດເຜີຍນີ້ ແລະ ຄຳເຕືອນກ່ອນການໃຊ້ງານຄັ້ງທຳອິດ. ສິ່ງທີ່ຈະຖືກສົ່ງໃນຕອນນັ້ນຖືກສົ່ງເພື່ອສ້າງຜົນລັບຂອງທ່ານ, ບໍ່ແມ່ນເພື່ອຝຶກຝົນສິ່ງໃດ; ບໍ່ມີການຖອດຂໍ້ຄວາມ ຫຼືການແປໃດຖືກເກັບໄວ້ໃນເຊີບເວີຂອງພວກເຮົາ.

ການຄົ້ນຫາວິກິພີເດຍບໍ່ມີສະວິດ ເພາະບໍ່ມີຫຍັງໃຫ້ປິດ: ມັນເຮັດວຽກເມື່ອແຕະເທົ່ານັ້ນ ບໍ່ແມ່ນວິທີອື່ນ. ວິກິພີເດຍໄດ້ຮັບຊື່ນັ້ນອັນດຽວ ແລະ ທີ່ຢູ່ IP ຂອງທ່ານ, ຄືກັນກັບວ່າທ່ານໄດ້ພິມມັນເອງໃສ່ກ່ອງຄົ້ນຫາຂອງພວກເຂົາ — ບໍ່ມີບັນຊີ, ບໍ່ມີຂໍ້ຄວາມ, ບໍ່ມີການສົນທະນາ. ສິ່ງທີ່ກັບຄືນມາຖືກສະແດງ ແລະ ບໍ່ຖືກບັນທຶກ, ແລະ ບໍ່ມີຫຍັງກ່ຽວກັບມັນຖືກຂຽນລົງໃນການສົນທະນາ.

Cloudflare Realtime ກໍ່ບໍ່ມີສະວິດເຊັ່ນກັນ. ການໂທສ່ວນໃຫຍ່ບໍ່ຕ້ອງການມັນ: ອຸປະກອນສອງເຄື່ອງທີ່ສາມາດເຊື່ອມຕໍ່ກັນໂດຍກົງ — ການໂທສ່ວນໃຫຍ່ໃນເຄືອຂ່າຍດຽວກັນ — ເຊື່ອມຕໍ່ກັນໂດຍບໍ່ຕ້ອງໃຊ້ມັນ, ແລະ ບໍ່ມີຫຍັງຖືກສົ່ງຕໍ່. ເມື່ອບໍ່ສາມາດເຊື່ອມຕໍ່ໄດ້ — ໂດຍທົ່ວໄປແມ່ນຍ້ອນທັງສອງຄົນຢູ່ຄົນລະເຄືອຂ່າຍມືຖື — ການໂທທີ່ຖືກເຂົ້າລະຫັດແລ້ວຈະຖືກສົ່ງຕໍ່ແທນທີ່ຈະປະໄວ້ໂດຍບໍ່ສາມາດເຊື່ອມຕໍ່ໄດ້. ສິ່ງທີ່ Cloudflare ເຫັນແມ່ນທີ່ຢູ່ IP ຂອງທັງສອງຝ່າຍ, ເວລາຂອງການໂທ, ແລະ ປະລິມານຂໍ້ມູນໂດຍປະມານທີ່ຖືກສົ່ງ; ສຽງ ແລະ ວິດີໂອຍັງຄົງຢູ່ພາຍໃຕ້ການເຂົ້າລະຫັດ DTLS-SRTP ດຽວກັນທີ່ອະທິບາຍໄວ້ໃນພາກທີ 2, ສະນັ້ນການສົ່ງຕໍ່ຈຶ່ງບໍ່ໄດ້ຖອດລະຫັດພວກມັນ.

ພວກເຮົາອາດເປີດເຜີຍສິ່ງທີ່ພວກເຮົາຖືໄວ້ຖ້າກົດໝາຍຮຽກຮ້ອງ. ສິ່ງທີ່ພວກເຮົາຖືໄວ້ແມ່ນລາຍການໃນພາກທີ 2. ພວກເຮົາບໍ່ສາມາດຜະລິດເນື້ອຫາຂໍ້ຄວາມໄດ້, ເພາະພວກເຮົາບໍ່ສາມາດອ່ານມັນໄດ້.`,
    },
    {
      title: '7. ການແຈ້ງເຕືອນແບບພຸດຊ໌',
      body: `Firebase Cloud Messaging ສົ່ງການແຈ້ງເຕືອນ. ໂທເຄັນອຸປະກອນຂອງທ່ານຖືກເກັບໄວ້ໃນສ່ວນສ່ວນຕົວຂອງບັນຊີຂອງທ່ານທີ່ມີແຕ່ທ່ານເທົ່ານັ້ນທີ່ອ່ານໄດ້.

ການແຈ້ງເຕືອນບໍ່ມີຂໍ້ຄວາມຂອງຂໍ້ຄວາມນຳໄປ. ອຸປະກອນຂອງທ່ານຖອດລະຫັດຂໍ້ຄວາມຢູ່ໃນເຄື່ອງ ແລະ ປະກອບສິ່ງທີ່ທ່ານເຫັນ; Google ສົ່ງພຽງແຕ່ຊອງ, ບໍ່ແມ່ນເນື້ອຫາ.`,
    },
    {
      title: '8. ສິ່ງທີ່ທ່ານສາມາດເຮັດໄດ້',
      body: `• ລຶບບັນຊີຂອງທ່ານຈາກໜ້າຈໍໂປຣໄຟລ໌. ເນື້ອຫາທີ່ເປັນສ່ວນຮ່ວມຂອງການສົນທະນາ — ບັນທຶກການໂທ, ຕົວຢ່າງ — ຍັງຄົງຢູ່ກັບຜູ້ເຂົ້າຮ່ວມອື່ນ, ເພາະມັນເປັນບັນທຶກຂອງເຂົາຄືກັນ.
• ສົ່ງອອກຂໍ້ມູນຂອງທ່ານຈາກໜ້າຈໍໂປຣໄຟລ໌.
• ຕັ້ງຄ່າໃຫ້ຂໍ້ຄວາມໝົດອາຍຸຕໍ່ແຊັດ: 1 ຊົ່ວໂມງ, 24 ຊົ່ວໂມງ, 7 ວັນ ຫຼື 30 ວັນ.
• ເປີດ ຫຼືປິດຕົວບົ່ງບອກການພິມ ແລະ ໃບຮັບອ່ານ. ທັງສອງປິດຢູ່ໂດຍຄ່າເລີ່ມຕົ້ນ.
• ລັອກແອັບດ້ວຍ PIN ຫຼືໄບໂອເມັດຣິກ.
• ຖອນລິ້ງເຊີນທີ່ທ່ານໄດ້ແຈກໄປແລ້ວ.

ຖ້າທ່ານຢາກໃຫ້ພວກເຮົາລຶບບາງສິ່ງດ້ວຍມື, ຂຽນມາຫາພວກເຮົາ.`,
    },
    {
      title: '9. ການເກັບຮັກສາ',
      body: `ພວກເຮົາເກັບຂໍ້ມູນຂອງທ່ານໄວ້ໃນຂະນະທີ່ບັນຊີຂອງທ່ານຍັງມີຢູ່. ການລຶບບັນຊີຈະລຶບມັນ, ຍົກເວັ້ນເນື້ອຫາທີ່ຖືຮ່ວມກັນທີ່ໄດ້ກ່າວມາຂ້າງເທິງ. ການໝົດອາຍຸຕໍ່ແຊັດຈະເອົາຂໍ້ຄວາມອອກຕາມກຳນົດເວລາທີ່ທ່ານຕັ້ງໄວ້.`,
    },
    {
      title: '10. ຂໍ້ຈຳກັດທີ່ທ່ານຄວນຮູ້',
      body: `ພວກເຮົາຢາກບອກທ່ານກ່ຽວກັບສິ່ງເຫຼົ່ານີ້ຫຼາຍກວ່າໃຫ້ທ່ານມາພົບເຫັນມັນເອງ.

• ກະແຈຖືກໄວ້ວາງໃຈຄັ້ງທຳອິດທີ່ເຫັນມັນ. ຖ້າໃຜຄົນໜຶ່ງແທນທີ່ກະແຈກ່ອນທີ່ທ່ານຈະເຄີຍແລກປ່ຽນຂໍ້ຄວາມກັນ, ການສົນທະນາຈະຖືກເຂົ້າລະຫັດຫາຄົນຜິດ ແລະ ຈະເບິ່ງຄືປົກກະຕິທຸກຢ່າງ. ແອັບເຕືອນທ່ານເມື່ອກະແຈປ່ຽນແປງພາຍຫຼັງ, ແລະ ສະແດງເລກຄວາມປອດໄພທີ່ທ່ານສາມາດປຽບທຽບນອກຊ່ອງທາງໄດ້ — ແຕ່ບໍ່ມີຫຍັງບັງຄັບໃຫ້ທ່ານປຽບທຽບມັນ.
• ອຸປະກອນດຽວໃນເວລາໃດໜຶ່ງ. ວະລີກູ້ຄືນຂອງທ່ານກູ້ຄືນກະແຈທີ່ເປີດປະຫວັດຂອງທ່ານ, ດັ່ງນັ້ນການເຂົ້າສູ່ລະບົບຢູ່ອຸປະກອນໃໝ່ຈະບໍ່ເສຍສິ່ງທີ່ທ່ານໄດ້ຮັບແລ້ວ. ການສົນທະນາທີ່ມີການປົກປ້ອງລ່ວງໜ້າໃຊ້ກະແຈທີສອງທີ່ບໍ່ເຄີຍອອກຈາກອຸປະກອນທີ່ສ້າງມັນຂຶ້ນມາ: ອຸປະກອນໃດກໍ່ຕາມທີ່ເຂົ້າສູ່ລະບົບຫຼ້າສຸດແມ່ນອຸປະກອນທີ່ພວກມັນໄປຮອດ, ແລະ ສິ່ງໃດກໍ່ຕາມທີ່ຖືກປິດຜະນຶກໄວ້ໃຫ້ອຸປະກອນອື່ນໃນລະຫວ່າງນັ້ນບໍ່ສາມາດຍ້າຍໄປໄດ້.
• ຂໍ້ຄວາມທີ່ສົ່ງກ່ອນທີ່ຈະມີການເຂົ້າລະຫັດຍັງຄົງເປັນຄືເກົ່າ. ບໍ່ມີຫຍັງຖືກປ່ຽນແປງຍ້ອນຫຼັງ.
• ແອັບນີ້ຍັງບໍ່ໄດ້ຖືກກວດສອບຄວາມປອດໄພຢ່າງເປັນເອກະລາດ.`,
    },
    {
      title: '11. ເດັກນ້ອຍ',
      body: `Chatterbox ບໍ່ໄດ້ມີຈຸດປະສົງສຳລັບເດັກນ້ອຍອາຍຸຕ່ຳກວ່າ 13 ປີ, ແລະ ພວກເຮົາບໍ່ໄດ້ເກັບກຳຂໍ້ມູນຂອງເຂົາຢ່າງຮູ້ເຫັນ. ຖ້າທ່ານເຊື່ອວ່າເດັກນ້ອຍໄດ້ໃຫ້ຂໍ້ມູນສ່ວນຕົວແກ່ພວກເຮົາ, ຕິດຕໍ່ພວກເຮົາ ແລະ ພວກເຮົາຈະລຶບມັນອອກ.`,
    },
    {
      title: '12. ການປ່ຽນແປງ',
      body: `ພວກເຮົາອາດອັບເດດນະໂຍບາຍນີ້. ການປ່ຽນແປງທີ່ສຳຄັນຈະຖືກປະກາດຢູ່ໃນແອັບ, ແລະ ວັນທີຢູ່ເທິງສຸດແມ່ນເວລາທີ່ມັນປ່ຽນແປງຫຼ້າສຸດ.`,
    },
    {
      title: '13. ຕິດຕໍ່',
      body: `ຄຳຖາມກ່ຽວກັບນະໂຍບາຍນີ້: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. ກວດສອບເວີຊັນແອັບໃໝ່ກວ່າ',
      body: `Google Play ບໍ່ແມ່ນວິທີທີ່ແອັບນີ້ມາເຖິງໂທລະສັບ Android ຂອງທ່ານ. ມັນຖືກດາວໂຫຼດຈາກ chatterbox.fans ແທນ, ແລະຮ້ານຄ້າທີ່ບໍ່ໄດ້ຢູ່ໃນຂະບວນການນີ້ບໍ່ສາມາດກວດສອບການອັບເດດແທນທ່ານໄດ້ — ສະນັ້ນແອັບນີ້ຈຶ່ງສາມາດເຮັດແນວນັ້ນເອງໄດ້, ຖ້າທ່ານຂໍໃຫ້ມັນເຮັດ.

ການແຕະ "ກວດສອບດຽວນີ້" ຈະສົ່ງຄຳຮ້ອງຂໍໜຶ່ງໄປຫາ chatterbox.fans ເພື່ອຖາມວ່າເວີຊັນປັດຈຸບັນແມ່ນຫຍັງ. ຄຳຮ້ອງຂໍນັ້ນມີພຽງທີ່ຢູ່ IP ຂອງທ່ານເທົ່ານັ້ນ ແລະບໍ່ມີຫຍັງອື່ນອີກ — ບໍ່ມີບັນຊີ, ບໍ່ມີຕົວລະບຸອຸປະກອນ, ບໍ່ມີຂໍ້ຄວາມ. ສິ່ງທີ່ກັບຄືນມາແມ່ນເລກເວີຊັນ, ຖືກປຽບທຽບຢູ່ໃນໂທລະສັບຂອງທ່ານກັບເວີຊັນທີ່ທ່ານກຳລັງໃຊ້ຢູ່; ບໍ່ມີຫຍັງຖືກດາວໂຫຼດອັດຕະໂນມັດ, ແລະບໍ່ມີຫຍັງກ່ຽວກັບການກວດສອບນີ້ຖືກຂຽນລົງໃນການສົນທະນາ.

ນີ້ບໍ່ມີສະວິດ ເພາະບໍ່ມີຫຍັງໃຫ້ປິດ: ມັນເຮັດວຽກສະເພາະເມື່ອແຕະເທົ່ານັ້ນ ແລະບໍ່ແມ່ນວິທີອື່ນ.

ຖ້າທ່ານຕິດຕັ້ງການອັບເດດ, ມັນຈະແທນທີ່ແອັບຢູ່ບ່ອນເກົ່າໂດຍໃຊ້ກະແຈລາຍເຊັນດຽວກັນ, ຄືກັນກັບການອັບເດດຈາກ Google Play ຈະເຮັດ.`,
    },
  ],

  ta: [
    {
      title: '0. சுருக்கமாக',
      body: `உங்கள் செய்திகளின் உரை உங்கள் சாதனத்தில் குறியாக்கம் செய்யப்பட்டு, நீங்கள் அதை அனுப்பும் நபர்களால் மட்டுமே படிக்க முடியும். எங்களால் அதைப் படிக்க முடியாது, நாங்கள் வாடகைக்கு எடுத்திருக்கும் சர்வர்களைச் சொந்தமாக்கிய Google-ஆலும் படிக்க முடியாது.

நாங்கள் காணக்கூடியது ஒரு உரையாடல் நடந்தது என்பதே: எந்த கணக்குகள் அதில் உள்ளன, எப்போது அவை செயலிலிருந்தன. உள்ளடக்கத்தை குறியாக்கம் செய்வதை விட அதை அகற்றுவது கடினம், மேலும் நாங்கள் அதை முடிக்கவில்லை. இந்தக் கொள்கை தற்போது அந்த எல்லை எங்கு உள்ளது என்பதை சரியாகக் கூறுகிறது.`,
    },
    {
      title: '1. முனையிலிருந்து முனைவரை குறியாக்கம் செய்யப்பட்டது என்ன',
      body: `உங்கள் சாதனத்தில் குறியாக்கம் செய்யப்பட்டு, எங்களாலும் Google-ஆலும் படிக்க முடியாதவை:

• உங்கள் செய்திகளின் உரை.
• நீங்கள் இணைக்கும் கோப்புகள், புகைப்படங்கள், ஆடியோ மற்றும் வீடியோவின் உள்ளடக்கம்.
• இணைப்பு முன்னோட்டங்கள்.
• குரல் மற்றும் வீடியோ அழைப்புகள், இரண்டு சாதனங்களுக்கு இடையே WebRTC-இன் கட்டாய DTLS-SRTP ஐப் பயன்படுத்துகின்றன.

பெரும்பாலான ஒன்றுக்கொன்று மற்றும் குழு செய்திகள் கூடுதலாக ஒரு ratchet ஐப் பயன்படுத்துகின்றன, அதாவது ஒவ்வொரு செய்திக்கும் அதன் சொந்த திறவுகோல் உள்ளது, எனவே உங்கள் சாதனத்தை சமரசம் செய்வது முந்தையவற்றை வெளிப்படுத்தாது. ஒருவரின் கிளையன்ட் புதிய திறவுகோல் பொருளை வெளியிடாத உரையாடல்கள் அந்தப் பண்பு இல்லாத ஒற்றை நீண்டகால திறவுகோலுக்குத் திரும்புகின்றன. ஒரு செய்திக்குக் கீழே உள்ள லேபிள் அது உண்மையில் எதைப் பெற்றது என்பதை உங்களுக்குச் சொல்கிறது.

இந்த எல்லையைத் தாண்டும் ஒரே விஷயம், நீங்கள் கேட்கும்போது மட்டுமே: விக்கிபீடியாவில் ஒரு பெயரைத் தேடுவது அந்த ஒரு பெயரை மட்டுமே அனுப்புகிறது, அது வந்த செய்தியை அல்ல. பிரிவு 6 அதை யார் பெறுகிறார்கள் என்பதைக் கூறுகிறது, மேலும் தேடல் தட்டும்போது மட்டுமே இயங்குகிறது வேறு வழியில் அல்ல, எனவே அணைக்க எதுவும் நிற்கவில்லை. சுருக்கம், மொழிபெயர்ப்பு மற்றும் படியெடுத்தல் ஆகியவையும் இதைத் தாண்டும் — அவை இந்த வெளியீட்டில் அணைக்கப்பட்டுள்ளன, அவற்றை இயக்கும் எந்த கட்டுப்பாடும் ஆப்பில் எங்கும் இல்லை.`,
    },
    {
      title: '2. என்ன குறியாக்கம் செய்யப்படவில்லை, மேலும் நாங்கள் என்ன பார்க்க முடியும்',
      body: `குறியாக்கம் உள்ளடக்கத்தைப் பாதுகாக்கிறது, உரையாடலின் உண்மையை அல்ல. இவை எங்கள் சர்வர்களில் தெளிவாக உள்ளன:

• ஒவ்வொரு உரையாடலிலும் யார் உள்ளனர், அது எப்போது உருவாக்கப்பட்டது மற்றும் கடைசியாக எப்போது செயலில் இருந்தது.
• ஒவ்வொரு செய்தியின் நேர முத்திரை, மற்றும் நீங்கள் படிக்காதவை எத்தனை.
• ஒரு இணைப்பின் கோப்பு பெயர், வகை மற்றும் அளவு. பைட்டுகள் குறியாக்கம் செய்யப்பட்டுள்ளன; அவற்றின் விளக்கம் இல்லை, மேலும் மறைகுறியாக்கப்பட்ட உரையின் நீளம் அசலின் நீளத்தை வரம்பிடுகிறது.
• உங்கள் நண்பர்கள் மற்றும் நட்பு கோரிக்கைகள்.
• அழைப்பு சிக்னலிங் — ஒரு அழைப்பு வைக்கப்பட்டது, யாருக்கு, எப்போது என்பது. அதன் ஆடியோ அல்லது வீடியோ அல்ல.

நீங்கள் அவற்றை இயக்கும் வரை தட்டச்சு குறிகாட்டிகள் மற்றும் படித்த ரசீதுகள் அணைக்கப்பட்டுள்ளன, அணைந்திருக்கும் போது எதுவும் எழுதப்படாது.

இங்கு இனி இல்லாதது: உங்கள் மின்னஞ்சல் முகவரி மற்றும் பெயர். செப்டம்பர் 2026 முதல் கணக்கு பதிவு ஒரு கணக்கு அடையாளங்காட்டியை மட்டுமே கொண்டுள்ளது — அதன் பின்னர் எங்கும் வைத்திருக்க முகவரி இல்லை. பதிவு செய்வது உங்களைப் பற்றி எதுவும் கேட்காது: உங்கள் கணக்கு 24-சொல் மீட்பு சொற்றொடர், Firebase Authentication சரிபார்க்கும் நற்சான்றிதழ் அதிலிருந்து பெறப்படுகிறது. அது சேமிப்பது அஞ்சல் பெற முடியாத ஒரு டொமைனின் கீழ் ஒரு சீரற்ற லேபிள் மட்டுமே.

தனியாக: ஆப் Google Firebase இல் இயங்குவதால், உங்கள் சாதனம் அதற்கு செய்யும் ஒவ்வொரு இணைப்பின் IP முகவரி மற்றும் நேரத்தையும் Google பார்க்க முடியும். இது ஹோஸ்டிங்கின் பண்பு, ஆப்பினுடையது அல்ல, மேலும் அதை நாங்கள் குறியாக்கம் செய்து அகற்ற முடியாது.`,
    },
    {
      title: '3. மக்கள் உங்களை எப்படி கண்டுபிடிக்கிறார்கள்',
      body: `அவர்களால் உங்களைத் தேட முடியாது. அடைவு இல்லை — மின்னஞ்சல், தொலைபேசி எண் அல்லது பெயர் மூலம் தேடல் இல்லை — அதற்கு முயற்சிக்கும் எந்த வினவலையும் சர்வர் நிராகரிக்கிறது.

நீங்கள் ஏற்கனவே பயன்படுத்தும் எதன் மூலமாகவும், சேனலுக்கு வெளியே ஒருவருக்கு அழைப்பு இணைப்பை அனுப்புவதன் மூலம் நீங்கள் ஒருவரை அடைகிறீர்கள். ஒரு இணைப்பு ஒருமுறை வேலை செய்கிறது, 24 மணி நேரத்திற்குப் பிறகு காலாவதியாகும், மேலும் திரும்பப் பெறலாம். நீங்கள் ஒருவரை எப்படி அழைக்கிறீர்களோ அது அவர்களுக்கான உங்கள் சொந்த லேபிள், உங்களுக்காக வைக்கப்பட்டுள்ளது; அவர்கள் தங்களை அறிமுகப்படுத்திக் கொண்டிருந்தால், அந்த பெயர் குறியாக்கப்பட்ட வடிவில் உங்களை அடைந்தது.`,
    },
    {
      title: '4. நாங்கள் எதை சேகரிக்கிறோம்',
      body: `• கணக்கு தரவு: ஒரு கணக்கு அடையாளங்காட்டி, மற்றும் Firebase Authentication இல் வைக்கப்பட்டுள்ள உங்கள் மீட்பு சொற்றொடரிலிருந்து பெறப்பட்ட ஒரு நற்சான்றிதழ். மின்னஞ்சல் முகவரி இல்லை, தொலைபேசி எண் இல்லை, பெயர் இல்லை — பதிவு செய்வது இவற்றில் எதையும் கேட்காது.
• செய்தி மற்றும் இணைப்பு மறைகுறியாக்கப்பட்ட உரை, பிரிவு 2 இல் உள்ள மெட்டாடேட்டாவுடன்.

அதுவே முழு பட்டியல். பகுப்பாய்வு இல்லை, செயலிழப்பு அறிக்கை இல்லை. ஆப் முன்பு திரை காட்சிகளை Firebase Analytics-க்கும் செயலிழப்பு அறிக்கைகளை Firebase Crashlytics-க்கும் அனுப்பியது, இரண்டும் உங்கள் கணக்கு அடையாளங்காட்டியை சுமந்து சென்றன, எனவே எதுவும் அநாமதேயமாக இல்லை; இரண்டும் இப்போது அவற்றை அனுப்பிய நூலகங்களுடன் போய்விட்டன. டெவலப்பரின் சொந்த இயந்திரத்தில் மேம்பாட்டின் போது மட்டுமே பிழைகள் அச்சிடப்படுகின்றன, வேறு எங்கும் செல்லாது.`,
    },
    {
      title: '5. இது எங்கு சேமிக்கப்படுகிறது',
      body: `Google Firebase இல் — Firestore, Storage மற்றும் Authentication — ஒவ்வொரு ஆவணத்தையும் யார் படிக்கலாம் எழுதலாம் என்பதை தீர்மானிக்கும் பாதுகாப்பு விதிகளின் கீழ்.

உங்கள் சாதனத்தில், கேச் செய்யப்பட்ட செய்திகள், அமைப்புகள் மற்றும் உங்கள் ஆப்-லாக் பின் சாதாரண ஆப் சேமிப்பிற்கு பதிலாக பிளாட்ஃபார்ம் கீஸ்டோரில் (iOS Keychain, Android Keystore) வைக்கப்பட்டுள்ள ஒரு சாதன-வாரியான திறவுகோலுடன் குறியாக்கம் செய்யப்பட்டுள்ளது.

உங்கள் செய்திகளை மறைகுறியாக்கம் நீக்கும் தனிப்பட்ட திறவுகோல் உங்கள் சாதனத்தை விட்டு ஒருபோதும் வெளியேறாது, நீங்கள் எழுத தேர்ந்தெடுக்கும் மீட்பு சொற்றொடராக தவிர. நாங்கள் அதை வைத்திருக்கவில்லை, உங்களுக்காக அதை மீட்டெடுக்கவும் முடியாது. அதை இழந்தால், அந்த சாதனத்திற்கு அனுப்பப்பட்ட செய்திகளை மீண்டும் படிக்க முடியாது — யாராலும், எங்களை உட்பட.`,
    },
    {
      title: '6. வேறு யார் தரவைப் பெறுகிறார்கள்',
      body: `நாங்கள் உங்கள் தனிப்பட்ட தகவலை விற்கவோ, மாற்றவோ, வாடகைக்கு விடவோ மாட்டோம். தரவு அடைகிறது:

• Google Firebase — மேலே விவரிக்கப்பட்டுள்ளபடி, எங்கள் ஹோஸ்டிங் வழங்குநர்.
• Cloudflare Realtime — உங்கள் சாதனமும் மற்றவரின் சாதனமும் நேரடியாக ஒன்றையொன்று அடைய முடியாதபோது, அழைப்பின் ஒலி மற்றும் வீடியோ.
• விக்கிமீடியா அறக்கட்டளை — விக்கிபீடியாவில் தேட நீங்கள் தட்டும்போது ஒரு பெயர்.
• Google Cloud Speech-to-Text — நீங்கள் ஒரு டிரான்ஸ்கிரிப்ட் கேட்கும்போது ஒரு குரல் செய்தியின் ஆடியோ.
• Google Cloud Translation — நீங்கள் ஒரு மொழிபெயர்ப்பு கேட்கும்போது ஒரு செய்தியின் உரை.
• Cloudflare Workers AI — நீங்கள் சுருக்கம் கேட்கும்போது அல்லது அதைப் பற்றி ஒரு கேள்வி கேட்கும்போது ஒரு உரையாடலின் கடைசி 50 செய்திகள் வரை.

கடைசி மூன்றும் இந்த வெளியீட்டில் அணைக்கப்பட்டுள்ளன. படியெடுத்தல், மொழிபெயர்ப்பு அல்லது சுருக்கங்களை இயக்கும் எந்த கட்டுப்பாடும் ஆப்பில் எங்கும் இல்லை, எனவே அந்த மூன்று சேவைகளுக்கும் எதுவும் அடையாது. அவை நீக்கப்படுவதற்கு பதிலாக பட்டியலிடப்பட்டுள்ளன, ஏனெனில் குறியீடு இன்னும் இங்கே உள்ளது மற்றும் அம்சங்கள் திரும்ப வர வேண்டும் என்று உத்தேசிக்கப்பட்டுள்ளது — அவை திரும்பும்போது, அவை இந்த வெளிப்படுத்தலுடனும் முதல் பயன்பாட்டிற்கு முன் ஒரு அறிவிப்புடனும் திரும்பும். அப்போது அனுப்பப்படுவது உங்கள் முடிவை உருவாக்க அனுப்பப்படுகிறது, எதையும் பயிற்றுவிக்க அல்ல; எங்கள் சர்வர்களில் டிரான்ஸ்கிரிப்ட் அல்லது மொழிபெயர்ப்பு சேமிக்கப்படவில்லை.

விக்கிபீடியா தேடலுக்கு சுவிட்ச் இல்லை, ஏனெனில் அணைக்க எதுவும் நிற்கவில்லை: அது தட்டும்போது மட்டுமே இயங்குகிறது வேறு வழியில் அல்ல. விக்கிபீடியா அந்த ஒரு பெயரையும் உங்கள் IP முகவரியையும் பெறுகிறது, அவர்களின் தேடல் பெட்டியில் நீங்கள் அதை தட்டச்சு செய்ததைப் போல — கணக்கு இல்லை, செய்தி இல்லை, உரையாடல் இல்லை. திரும்பி வருவது காட்டப்பட்டு சேமிக்கப்படவில்லை, அதைப் பற்றி எதுவும் உரையாடலில் எழுதப்படவில்லை.

Cloudflare Realtime-க்கும் சுவிட்ச் இல்லை. பெரும்பாலான அழைப்புகளுக்கு இது தேவையில்லை: நேரடியாக ஒன்றையொன்று அடையக்கூடிய இரண்டு சாதனங்கள்—ஒரே நெட்வொர்க்கில் உள்ள பெரும்பாலான அழைப்புகள்—இது இல்லாமலேயே இணைகின்றன, எதுவும் அனுப்பப்படுவதில்லை. அவற்றால் முடியாதபோது—பொதுவாக நீங்கள் இருவரும் வெவ்வேறு மொபைல் நெட்வொர்க்குகளில் இருப்பதால்—ஏற்கனவே குறியாக்கம் செய்யப்பட்ட அழைப்பு, இணைக்க முடியாமல் இருப்பதற்குப் பதிலாக அனுப்பப்படுகிறது. Cloudflare பார்ப்பது இரு தரப்பினரின் IP முகவரிகள், அழைப்பின் நேரம், மற்றும் தோராயமாக எவ்வளவு தரவு நகர்ந்தது என்பதே; ஒலியும் வீடியோவும் பிரிவு 2-இல் விவரிக்கப்பட்ட அதே DTLS-SRTP குறியாக்கத்தின் கீழேயே இருக்கும், எனவே அனுப்புவது அவற்றை மறைகுறியாக்கம் நீக்காது.

சட்டம் தேவைப்பட்டால் நாங்கள் வைத்திருப்பதை வெளிப்படுத்தலாம். நாங்கள் வைத்திருப்பது பிரிவு 2 இல் உள்ள பட்டியல். எங்களால் செய்தி உள்ளடக்கத்தை உருவாக்க முடியாது, ஏனெனில் எங்களால் அதைப் படிக்க முடியாது.`,
    },
    {
      title: '7. புஷ் அறிவிப்புகள்',
      body: `Firebase Cloud Messaging அறிவிப்புகளை வழங்குகிறது. உங்கள் சாதன டோக்கன் நீங்கள் மட்டுமே படிக்கக்கூடிய உங்கள் கணக்கின் தனிப்பட்ட பகுதியில் சேமிக்கப்பட்டுள்ளது.

அறிவிப்புகள் செய்தி உரையை சுமக்காது. உங்கள் சாதனம் உள்நாட்டில் செய்தியை மறைகுறியாக்கம் நீக்கி நீங்கள் பார்ப்பதை உருவாக்குகிறது; Google உள்ளடக்கத்தை அல்ல, உறையை வழங்குகிறது.`,
    },
    {
      title: '8. நீங்கள் என்ன செய்யலாம்',
      body: `• பைல் திரையிலிருந்து உங்கள் கணக்கை நீக்கவும். ஒரு உரையாடலின் கூட்டு பகுதியாக இருக்கும் உள்ளடக்கம் — உதாரணமாக, ஒரு அழைப்பு பதிவு — மற்ற பங்கேற்பாளருடன் இருக்கும், ஏனெனில் இது அவர்களின் பதிவும் கூட.
• பைல் திரையிலிருந்து உங்கள் தரவை ஏற்றுமதி செய்யவும்.
• ஒவ்வொரு அரட்டைக்கும் செய்திகள் காலாவதியாக அமைக்கவும்: 1 மணி நேரம், 24 மணி நேரம், 7 நாட்கள் அல்லது 30 நாட்கள்.
• தட்டச்சு குறிகாட்டிகள் மற்றும் படித்த ரசீதுகளை இயக்கவும் அல்லது அணைக்கவும். இரண்டும் இயல்பாக அணைக்கப்பட்டுள்ளன.
• பின் அல்லது பயோமெட்ரிக்ஸ் மூலம் ஆப்பை பூட்டவும்.
• நீங்கள் கொடுத்த ஒரு அழைப்பு இணைப்பை திரும்பப் பெறவும்.

நாங்கள் ஏதாவது கையால் நீக்க வேண்டும் என்று நீங்கள் விரும்பினால், எங்களுக்கு எழுதுங்கள்.`,
    },
    {
      title: '9. தக்கவைப்பு',
      body: `உங்கள் கணக்கு இருக்கும் வரை உங்கள் தரவை நாங்கள் வைத்திருக்கிறோம். கணக்கை நீக்குவது அதை நீக்குகிறது, மேலே குறிப்பிட்ட கூட்டாக வைக்கப்பட்ட உள்ளடக்கத்தைத் தவிர. ஒவ்வொரு அரட்டைக்கும் காலாவதி நீங்கள் அமைத்த அட்டவணையில் செய்திகளை அகற்றுகிறது.`,
    },
    {
      title: '10. நீங்கள் தெரிந்து கொள்ள வேண்டிய வரம்புகள்',
      body: `நீங்கள் அவற்றைக் கண்டுபிடிப்பதை விட, நாங்கள் இவற்றை உங்களிடம் சொல்ல விரும்புகிறோம்.

• முதல் முறையாகப் பார்க்கும்போது திறவுகோல்கள் நம்பப்படுகின்றன. நீங்கள் எப்போதும் ஒரு செய்தியைப் பரிமாறிக்கொள்வதற்கு முன் யாராவது ஒரு திறவுகோலை மாற்றியிருந்தால், உரையாடல் தவறான நபருக்கு குறியாக்கம் செய்யப்படும் மற்றும் முற்றிலும் இயல்பாகத் தோன்றும். திறவுகோல் பின்னர் மாறும்போது ஆப் உங்களை எச்சரிக்கிறது, மேலும் நீங்கள் சேனலுக்கு வெளியே ஒப்பிடக்கூடிய பாதுகாப்பு எண்ணைக் காட்டுகிறது — ஆனால் அதை ஒப்பிட உங்களை எதுவும் கட்டாயப்படுத்தாது.
• ஒரு நேரத்தில் ஒரு சாதனம். உங்கள் மீட்பு சொற்றொடர் உங்கள் வரலாற்றைத் திறக்கும் திறவுகோலை மீட்டெடுக்கிறது, எனவே ஒரு புதிய சாதனத்தில் உள்நுழைவது நீங்கள் ஏற்கனவே பெற்றதை இழக்காது. முன்னோக்கி-ரகசிய உரையாடல்கள் அதை உருவாக்கிய சாதனத்தை ஒருபோதும் விட்டு வெளியேறாத இரண்டாவது திறவுகோலைப் பயன்படுத்துகின்றன: கடைசியாக உள்நுழைந்த சாதனம் எதுவாக இருந்தாலும் அவை அடையும் ஒன்று, அந்த நேரத்தில் மற்றொன்றுக்கு முத்திரையிடப்பட்ட எதுவும் அதற்கு நகர்த்த முடியாது.
• குறியாக்கம் இருப்பதற்கு முன் அனுப்பப்பட்ட செய்திகள் அவ்வாறே இருக்கும். எதுவும் பின்னோக்கி மாற்றப்படவில்லை.
• இந்த ஆப் சுயாதீனமாக பாதுகாப்பு தணிக்கை செய்யப்படவில்லை.`,
    },
    {
      title: '11. குழந்தைகள்',
      body: `Chatterbox 13 வயதுக்குட்பட்ட குழந்தைகளுக்கு நோக்கம் கொண்டது அல்ல, மேலும் அவர்களின் தகவலை நாங்கள் அறிந்தே சேகரிக்க மாட்டோம். ஒரு குழந்தை எங்களுக்கு தனிப்பட்ட தகவலை வழங்கியிருக்கிறது என்று நீங்கள் நம்பினால், எங்களைத் தொடர்பு கொள்ளுங்கள், நாங்கள் அதை நீக்குவோம்.`,
    },
    {
      title: '12. மாற்றங்கள்',
      body: `நாங்கள் இந்தக் கொள்கையைப் புதுப்பிக்கலாம். குறிப்பிடத்தக்க மாற்றங்கள் ஆப்பில் அறிவிக்கப்படும், மேலும் மேலே உள்ள தேதி அது கடைசியாக மாறிய நேரம்.`,
    },
    {
      title: '13. தொடர்பு',
      body: `இந்தக் கொள்கை பற்றிய கேள்விகள்: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. புதிய ஆப் பதிப்பைச் சரிபார்த்தல்',
      body: `இந்த ஆப் உங்கள் Android தொலைபேசியை அடையும் வழி Google Play அல்ல. அதற்குப் பதிலாக இது chatterbox.fans இலிருந்து பதிவிறக்கம் செய்யப்படுகிறது, மேலும் இந்த செயல்முறையில் இல்லாத ஒரு கடை உங்களுக்காக புதுப்பிப்புகளை சரிபார்க்க முடியாது — எனவே நீங்கள் கேட்டால் இந்த ஆப் தானாகவே அதைச் செய்யலாம்.

"இப்போது சரிபார்" என்பதைத் தட்டுவது தற்போதைய பதிப்பு என்ன என்று கேட்டு chatterbox.fans-க்கு ஒரு கோரிக்கையை அனுப்புகிறது. அந்த கோரிக்கை உங்கள் IP முகவரியை மட்டுமே கொண்டுள்ளது, வேறு எதுவும் இல்லை — கணக்கு இல்லை, சாதன அடையாளங்காட்டி இல்லை, செய்தி இல்லை. திரும்பி வருவது ஒரு பதிப்பு எண், இது உங்கள் தொலைபேசியில் நீங்கள் இயக்கும் பதிப்புடன் ஒப்பிடப்படுகிறது; எதுவும் தானாக பதிவிறக்கம் செய்யப்படாது, மேலும் இந்த சரிபார்ப்பு பற்றி எதுவும் உரையாடலில் எழுதப்படாது.

இதற்கு ஸ்விட்ச் இல்லை, ஏனெனில் அணைக்க எதுவும் இல்லை: இது தட்டும்போது மட்டுமே இயங்குகிறது, வேறு வழியில் அல்ல.

நீங்கள் புதுப்பிப்பை நிறுவினால், அது அதே கையொப்பம் விசையைப் பயன்படுத்தி ஆப்பை அதன் இடத்திலேயே மாற்றுகிறது, Google Play இலிருந்து வரும் புதுப்பிப்பு செய்வதைப் போலவே.`,
    },
  ],

  te: [
    {
      title: '0. క్లుప్తంగా',
      body: `మీ సందేశాల వచనం మీ పరికరంలో గుప్తీకరించబడి, మీరు పంపే వ్యక్తులు మాత్రమే దాన్ని చదవగలరు. మేము దాన్ని చదవలేము, మేము అద్దెకు తీసుకున్న సర్వర్లను కలిగి ఉన్న Google కూడా చదవలేదు.

మేము చూడగలిగేది ఒక సంభాషణ జరిగిందని: ఏ ఖాతాలు అందులో ఉన్నాయి, అవి ఎప్పుడు క్రియాశీలంగా ఉన్నాయి. దాన్ని తొలగించడం విషయాలను గుప్తీకరించడం కంటే కష్టం, మరియు మేము ఇంకా పూర్తి చేయలేదు. ఈ విధానం ప్రస్తుతం ఆ గీత ఎక్కడ ఉందో ఖచ్చితంగా చెబుతుంది.`,
    },
    {
      title: '1. ఎండ్-టు-ఎండ్ గుప్తీకరించబడినది ఏమిటి',
      body: `మీ పరికరంలో గుప్తీకరించబడి, మాకు మరియు Googleకు చదవలేనిది:

• మీ సందేశాల వచనం.
• మీరు జోడించే ఫైళ్లు, ఫోటోలు, ఆడియో మరియు వీడియో యొక్క కంటెంట్‌లు.
• లింక్ ప్రివ్యూలు.
• రెండు పరికరాల మధ్య WebRTC యొక్క తప్పనిసరి DTLS-SRTP ఉపయోగించే వాయిస్ మరియు వీడియో కాల్‌లు.

చాలా వన్-టు-వన్ మరియు గ్రూప్ సందేశాలు అదనంగా ratchet ను ఉపయోగిస్తాయి, అంటే ప్రతి సందేశానికి దాని స్వంత కీ ఉంటుంది, కాబట్టి మీ పరికరం రాజీపడటం మునుపటివాటిని బహిర్గతం చేయదు. ఎవరి క్లయింట్ కొత్త కీ మెటీరియల్‌ను ప్రచురించని సంభాషణలు ఆ లక్షణం లేని ఒకే దీర్ఘకాలిక కీకి తిరిగి వస్తాయి. సందేశం క్రింద ఉన్న లేబుల్ అది వాస్తవానికి ఏది పొందిందో మీకు చెబుతుంది.

ఈ గీతను దాటే ఒకే విషయం, మీరు అడిగినప్పుడు మాత్రమే: వికీపీడియాలో ఒక పేరును వెతకడం ఆ ఒక్క పేరును మాత్రమే పంపుతుంది, అది వచ్చిన సందేశాన్ని కాదు. విభాగం 6 దాన్ని ఎవరు స్వీకరిస్తారో చెబుతుంది, మరియు వెతుకులాట టాప్‌లో మాత్రమే నడుస్తుంది కాకుండా కాదు, కాబట్టి ఆఫ్ చేయడానికి ఏమీ నిలబడి లేదు. సారాంశం, అనువాదం మరియు లిప్యంతరీకరణ కూడా దీన్ని దాటేవి — అవి ఈ విడుదలలో ఆఫ్ చేయబడ్డాయి, వాటిని ఆన్ చేసే నియంత్రణ యాప్‌లో ఎక్కడా లేదు.`,
    },
    {
      title: '2. ఏది గుప్తీకరించబడలేదు, మరియు మేము ఏమి చూడగలము',
      body: `గుప్తీకరణ కంటెంట్‌ను రక్షిస్తుంది, సంభాషణ వాస్తవాన్ని కాదు. ఇవి మా సర్వర్లలో స్పష్టంగా ఉంటాయి:

• ప్రతి సంభాషణలో ఎవరు ఉన్నారు, మరియు అది ఎప్పుడు సృష్టించబడింది మరియు చివరిగా క్రియాశీలంగా ఉంది.
• ప్రతి సందేశం యొక్క టైమ్‌స్టాంప్, మరియు మీరు చదవని వాటి సంఖ్య.
• జోడింపు యొక్క ఫైల్ పేరు, రకం మరియు పరిమాణం. బైట్‌లు గుప్తీకరించబడ్డాయి; వాటి వివరణ కాదు, మరియు సైఫర్‌టెక్స్ట్ పొడవు అసలు పొడవును పరిమితం చేస్తుంది.
• మీ స్నేహితులు మరియు స్నేహిత అభ్యర్థనలు.
• కాల్ సిగ్నలింగ్ — ఒక కాల్ చేయబడింది, ఎవరికి, మరియు ఎప్పుడు. దాని ఆడియో లేదా వీడియో కాదు.

మీరు ఆన్ చేయనంత వరకు టైపింగ్ సూచికలు మరియు చదివిన రసీదులు ఆఫ్‌లో ఉంటాయి, ఆఫ్‌లో ఉన్నప్పుడు ఏమీ వ్రాయబడదు.

ఇక్కడ ఇకపై లేనిది: మీ ఇమెయిల్ చిరునామా మరియు పేరు. సెప్టెంబర్ 2026 నుండి ఖాతా రికార్డు ఒక ఖాతా గుర్తింపును మాత్రమే కలిగి ఉంటుంది — మరియు అప్పటి నుండి ఎక్కడా ఉంచడానికి చిరునామా లేదు. సైన్ అప్ మీ గురించి ఏమీ అడగదు: మీ ఖాతా 24-పద పునరుద్ధరణ పదబంధం, మరియు Firebase Authentication తనిఖీ చేసే క్రెడెన్షియల్ దాని నుండి తీసుకోబడింది. అది నిల్వ చేసేది మెయిల్ స్వీకరించలేని డొమైన్ కింద యాదృచ్ఛిక లేబుల్ మాత్రమే.

విడిగా: యాప్ Google Firebaseలో నడుస్తున్నందున, మీ పరికరం దానికి చేసే ప్రతి కనెక్షన్ యొక్క IP చిరునామా మరియు సమయాన్ని Google చూడగలదు. అది హోస్టింగ్ యొక్క లక్షణం, యాప్‌ది కాదు, మరియు మేము దానిని గుప్తీకరించి తొలగించలేము.`,
    },
    {
      title: '3. వ్యక్తులు మిమ్మల్ని ఎలా కనుగొంటారు',
      body: `వారు మిమ్మల్ని వెతకలేరు. డైరెక్టరీ లేదు — ఇమెయిల్, ఫోన్ నంబర్ లేదా పేరు ద్వారా శోధన లేదు — మరియు అలా ప్రయత్నించే ఏ ప్రశ్నను అయినా సర్వర్ తిరస్కరిస్తుంది.

మీరు ఇప్పటికే ఉపయోగిస్తున్న దేనితోనైనా, ఛానెల్ వెలుపల ఆహ్వాన లింక్‌ను పంపడం ద్వారా మీరు ఎవరినైనా చేరుకుంటారు. ఒక లింక్ ఒకసారి పనిచేస్తుంది, 24 గంటల తర్వాత గడువు ముగుస్తుంది, మరియు ఉపసంహరించుకోవచ్చు. మీరు ఎవరినైనా ఏమని పిలుస్తారో అది వారి కోసం మీ స్వంత లేబుల్, మీ కోసం ఉంచబడింది; వారు తమను తాము పరిచయం చేసుకుంటే, ఆ పేరు గుప్తీకరించిన రూపంలో మీకు చేరింది.`,
    },
    {
      title: '4. మేము ఏమి సేకరిస్తాము',
      body: `• ఖాతా డేటా: ఖాతా గుర్తింపు, మరియు Firebase Authenticationలో ఉంచబడిన మీ పునరుద్ధరణ పదబంధం నుండి తీసుకోబడిన క్రెడెన్షియల్. ఇమెయిల్ చిరునామా లేదు, ఫోన్ నంబర్ లేదు, పేరు లేదు — సైన్ అప్ వీటిలో దేనినీ అడగదు.
• సందేశం మరియు జోడింపు సైఫర్‌టెక్స్ట్, విభాగం 2లోని మెటాడేటాతో పాటు.

అదే మొత్తం జాబితా. విశ్లేషణ లేదు మరియు క్రాష్ రిపోర్టింగ్ లేదు. యాప్ గతంలో స్క్రీన్ వీక్షణలను Firebase Analyticsకు మరియు క్రాష్ నివేదికలను Firebase Crashlyticsకు పంపేది, రెండూ మీ ఖాతా గుర్తింపును కలిగి ఉన్నాయి, కాబట్టి రెండూ అనామకమైనవి కావు; రెండూ ఇప్పుడు వాటిని పంపిన లైబ్రరీలతో పాటు పోయాయి. డెవలపర్ యొక్క స్వంత మెషీన్‌లో అభివృద్ధి సమయంలో మాత్రమే లోపాలు ముద్రించబడతాయి మరియు మరెక్కడికీ వెళ్లవు.`,
    },
    {
      title: '5. ఇది ఎక్కడ నిల్వ చేయబడింది',
      body: `Google Firebaseలో — Firestore, Storage మరియు Authentication — ప్రతి పత్రాన్ని ఎవరు చదవవచ్చు మరియు వ్రాయవచ్చు అని నిర్ణయించే భద్రతా నియమాల కింద.

మీ పరికరంలో, కాష్ చేయబడిన సందేశాలు, సెట్టింగ్‌లు మరియు మీ యాప్-లాక్ PIN సాధారణ యాప్ నిల్వకు బదులుగా ప్లాట్‌ఫారమ్ కీస్టోర్‌లో (iOS Keychain, Android Keystore) ఉంచబడిన పర్-డివైస్ కీతో గుప్తీకరించబడతాయి.

మీ సందేశాలను డిక్రిప్ట్ చేసే ప్రైవేట్ కీ మీరు వ్రాయాలని ఎంచుకున్న పునరుద్ధరణ పదబంధం తప్ప మీ పరికరాన్ని ఎప్పుడూ వదిలిపెట్టదు. మేము దానిని కలిగి ఉండము మరియు మీ కోసం దానిని తిరిగి పొందలేము. దాన్ని కోల్పోతే, ఆ పరికరానికి పంపిన సందేశాలను మళ్లీ చదవలేరు — మమ్మల్ని కలుపుకొని ఎవరూ కూడా.`,
    },
    {
      title: '6. మరెవరు డేటాను స్వీకరిస్తారు',
      body: `మేము మీ వ్యక్తిగత సమాచారాన్ని విక్రయించము, వర్తకం చేయము లేదా అద్దెకు ఇవ్వము. డేటా చేరేది:

• Google Firebase — పైన వివరించినట్లు, మా హోస్టింగ్ ప్రొవైడర్.
• Cloudflare Realtime — మీ పరికరం మరియు మరొక వ్యక్తి పరికరం నేరుగా ఒకదానికొకటి చేరుకోలేనప్పుడు, కాల్ యొక్క ఆడియో మరియు వీడియో.
• వికీమీడియా ఫౌండేషన్ — వికీపీడియాలో వెతకడానికి మీరు నొక్కినప్పుడు ఒక పేరు.
• Google Cloud Speech-to-Text — మీరు ట్రాన్స్క్రిప్ట్ కోసం అడిగినప్పుడు ఒక వాయిస్ మెసేజ్ యొక్క ఆడియో.
• Google Cloud Translation — మీరు అనువాదం కోసం అడిగినప్పుడు ఒక సందేశం యొక్క వచనం.
• Cloudflare Workers AI — మీరు సారాంశం కోసం అడిగినప్పుడు లేదా దాని గురించి ప్రశ్న అడిగినప్పుడు ఒక సంభాషణ యొక్క చివరి 50 సందేశాల వరకు.

చివరి మూడు ఈ విడుదలలో ఆఫ్ చేయబడ్డాయి. లిప్యంతరీకరణ, అనువాదం లేదా సారాంశాలను ఆన్ చేసే నియంత్రణ యాప్‌లో ఎక్కడా లేదు, కాబట్టి ఆ మూడు సేవలకు ఏమీ చేరదు. కోడ్ ఇప్పటికీ ఇక్కడ ఉన్నందున మరియు ఆ ఫీచర్లు తిరిగి రావాలని ఉద్దేశించినందున అవి తొలగించబడటానికి బదులుగా జాబితా చేయబడ్డాయి — అవి తిరిగి వచ్చినప్పుడు, అవి ఈ బహిర్గతంతో మరియు మొదటి ఉపయోగానికి ముందు ప్రాంప్ట్‌తో తిరిగి వస్తాయి. అప్పుడు పంపేది మీ ఫలితాన్ని ఉత్పత్తి చేయడానికి పంపబడుతుంది, దేనినైనా శిక్షణ ఇవ్వడానికి కాదు; మా సర్వర్లలో ట్రాన్స్క్రిప్ట్ లేదా అనువాదం నిల్వ చేయబడదు.

వికీపీడియా శోధనకు స్విచ్ లేదు ఎందుకంటే ఆఫ్ చేయడానికి ఏమీ నిలబడి లేదు: ఇది టాప్‌లో మాత్రమే నడుస్తుంది కాకుండా కాదు. వికీపీడియా ఆ ఒక్క పేరును మరియు మీ IP చిరునామాను స్వీకరిస్తుంది, మీరు దానిని వారి శోధన పెట్టెలో టైప్ చేసినట్లే — ఖాతా లేదు, సందేశం లేదు, సంభాషణ లేదు. తిరిగి వచ్చేది చూపబడుతుంది మరియు సేవ్ చేయబడదు, మరియు దాని గురించి ఏదీ సంభాషణలో వ్రాయబడదు.

Cloudflare Realtime‌కు కూడా స్విచ్ లేదు. చాలా కాల్‌లకు ఇది అవసరం లేదు: నేరుగా ఒకదానికొకటి చేరుకోగల రెండు పరికరాలు—ఒకే నెట్‌వర్క్‌లో చాలా కాల్‌లు—దీని లేకుండానే కనెక్ట్ అవుతాయి, మరియు ఏదీ రిలే చేయబడదు. అవి చేరుకోలేనప్పుడు—సాధారణంగా మీరిద్దరూ వేర్వేరు మొబైల్ నెట్‌వర్క్‌లలో ఉన్నందున—ఇప్పటికే గుప్తీకరించిన కాల్ కనెక్ట్ కాకుండా ఉండటానికి బదులుగా రిలే చేయబడుతుంది. Cloudflare చూసేది రెండు IP చిరునామాలు, కాల్ సమయం, మరియు సుమారుగా ఎంత డేటా తరలింది అనేదే; ఆడియో మరియు వీడియో సెక్షన్ 2లో వివరించిన అదే DTLS-SRTP గుప్తీకరణలోనే ఉంటాయి, కాబట్టి రిలే చేయడం వాటిని డిక్రిప్ట్ చేయదు.

చట్టం అవసరమైతే మేము కలిగి ఉన్నదాన్ని బహిర్గతం చేయవచ్చు. మేము కలిగి ఉన్నది విభాగం 2లోని జాబితా. మేము సందేశ కంటెంట్‌లను ఉత్పత్తి చేయలేము, ఎందుకంటే మేము వాటిని చదవలేము.`,
    },
    {
      title: '7. పుష్ నోటిఫికేషన్‌లు',
      body: `Firebase Cloud Messaging నోటిఫికేషన్‌లను అందిస్తుంది. మీ పరికర టోకెన్ మీరు మాత్రమే చదవగలిగే మీ ఖాతా యొక్క ప్రైవేట్ భాగంలో నిల్వ చేయబడుతుంది.

నోటిఫికేషన్‌లు సందేశ వచనాన్ని కలిగి ఉండవు. మీ పరికరం స్థానికంగా సందేశాన్ని డిక్రిప్ట్ చేసి మీరు చూసేదాన్ని కంపోజ్ చేస్తుంది; Google కంటెంట్‌ను కాదు, కవరును బట్వాడా చేస్తుంది.`,
    },
    {
      title: '8. మీరు ఏమి చేయవచ్చు',
      body: `• ప్రొఫైల్ స్క్రీన్ నుండి మీ ఖాతాను తొలగించండి. సంభాషణలో సంయుక్తంగా భాగమైన కంటెంట్ — ఉదాహరణకు, ఒక కాల్ రికార్డు — ఇతర పాల్గొనేవారితో ఉంటుంది, ఎందుకంటే ఇది వారి రికార్డు కూడా.
• ప్రొఫైల్ స్క్రీన్ నుండి మీ డేటాను ఎగుమతి చేయండి.
• ప్రతి చాట్‌కు సందేశాలు గడువు ముగియడానికి సెట్ చేయండి: 1 గంట, 24 గంటలు, 7 రోజులు లేదా 30 రోజులు.
• టైపింగ్ సూచికలు మరియు చదివిన రసీదులను ఆన్ లేదా ఆఫ్ చేయండి. రెండూ డిఫాల్ట్‌గా ఆఫ్‌లో ఉన్నాయి.
• PIN లేదా బయోమెట్రిక్స్‌తో యాప్‌ను లాక్ చేయండి.
• మీరు ఇచ్చిన ఆహ్వాన లింక్‌ను ఉపసంహరించుకోండి.

మీరు ఏదైనా చేతితో తొలగించాలని కోరుకుంటే, మాకు వ్రాయండి.`,
    },
    {
      title: '9. నిలుపుదల',
      body: `మీ ఖాతా ఉన్నంత వరకు మేము మీ డేటాను ఉంచుతాము. ఖాతాను తొలగించడం దానిని తొలగిస్తుంది, పైన పేర్కొన్న సంయుక్తంగా ఉంచబడిన కంటెంట్ మినహా. ప్రతి చాట్ గడువు ముగింపు మీరు సెట్ చేసిన షెడ్యూల్‌లో సందేశాలను తొలగిస్తుంది.`,
    },
    {
      title: '10. మీరు తెలుసుకోవలసిన పరిమితులు',
      body: `మీరు వాటిని కనుగొనడం కంటే మేము మీకు ఇవి చెప్పడానికి ఇష్టపడతాము.

• కీలు మొదటిసారి చూసినప్పుడు విశ్వసించబడతాయి. మీరు ఎప్పుడైనా సందేశాన్ని మార్పిడి చేసుకోకముందే ఎవరైనా కీని భర్తీ చేస్తే, సంభాషణ తప్పు వ్యక్తికి గుప్తీకరించబడుతుంది మరియు పూర్తిగా సాధారణంగా కనిపిస్తుంది. కీ తర్వాత మారినప్పుడు యాప్ మిమ్మల్ని హెచ్చరిస్తుంది మరియు మీరు ఛానెల్ వెలుపల పోల్చగలిగే భద్రతా సంఖ్యను చూపిస్తుంది — కానీ దానిని పోల్చమని మిమ్మల్ని ఏదీ బలవంతం చేయదు.
• ఒక సమయంలో ఒక పరికరం. మీ పునరుద్ధరణ పదబంధం మీ చరిత్రను తెరిచే కీని పునరుద్ధరిస్తుంది, కాబట్టి కొత్త పరికరంలో సైన్ ఇన్ చేయడం మీరు ఇప్పటికే స్వీకరించినదాన్ని కోల్పోదు. ఫార్వర్డ్-సీక్రెట్ సంభాషణలు దానిని సృష్టించిన పరికరాన్ని ఎప్పుడూ వదిలిపెట్టని రెండవ కీని ఉపయోగిస్తాయి: ఏ పరికరం చివరిగా సైన్ ఇన్ చేసిందో అదే అవి చేరుకునేది, మరియు ఆ సమయంలో మరొక దానికి మూసివేయబడిన ఏదీ దానికి తరలించబడదు.
• గుప్తీకరణ ఉనికిలో ఉండటానికి ముందు పంపిన సందేశాలు అలాగే ఉంటాయి. ఏదీ పునరాలోచనగా మార్చబడలేదు.
• ఈ యాప్ స్వతంత్రంగా భద్రతా ఆడిట్ చేయబడలేదు.`,
    },
    {
      title: '11. పిల్లలు',
      body: `Chatterbox 13 సంవత్సరాల కంటే తక్కువ వయస్సు ఉన్న పిల్లల కోసం ఉద్దేశించబడలేదు, మరియు మేము తెలిసి వారి సమాచారాన్ని సేకరించము. ఒక పిల్లవాడు మాకు వ్యక్తిగత సమాచారాన్ని ఇచ్చాడని మీరు నమ్మితే, మమ్మల్ని సంప్రదించండి మరియు మేము దానిని తొలగిస్తాము.`,
    },
    {
      title: '12. మార్పులు',
      body: `మేము ఈ విధానాన్ని అప్‌డేట్ చేయవచ్చు. ముఖ్యమైన మార్పులు యాప్‌లో ప్రకటించబడతాయి, మరియు పైన ఉన్న తేదీ అది చివరిగా ఎప్పుడు మారిందో.`,
    },
    {
      title: '13. సంప్రదించండి',
      body: `ఈ విధానం గురించి ప్రశ్నలు: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. కొత్త యాప్ వెర్షన్ కోసం తనిఖీ చేయడం',
      body: `ఈ యాప్ మీ Android ఫోన్‌కు చేరుకునే మార్గం Google Play కాదు. బదులుగా ఇది chatterbox.fans నుండి డౌన్‌లోడ్ చేయబడుతుంది, మరియు ఈ ప్రక్రియలో లేని స్టోర్ మీ తరపున అప్‌డేట్‌లను తనిఖీ చేయలేదు — కాబట్టి మీరు అడిగితే ఈ యాప్ దానంతట అదే చేయగలదు.

"ఇప్పుడు తనిఖీ చేయండి"ని నొక్కడం ప్రస్తుత వెర్షన్ ఏమిటో అడుగుతూ chatterbox.fansకి ఒకే అభ్యర్థనను పంపుతుంది. ఆ అభ్యర్థన మీ IP చిరునామాను మాత్రమే కలిగి ఉంటుంది, మరేమీ లేదు — ఖాతా లేదు, పరికర గుర్తింపు లేదు, సందేశం లేదు. తిరిగి వచ్చేది ఒక వెర్షన్ నంబర్, ఇది మీ ఫోన్‌లో మీరు నడుపుతున్న వెర్షన్‌తో పోల్చబడుతుంది; ఏదీ స్వయంచాలకంగా డౌన్‌లోడ్ కాదు, మరియు ఈ తనిఖీ గురించి ఏదీ సంభాషణలో వ్రాయబడదు.

దీనికి స్విచ్ లేదు ఎందుకంటే ఆఫ్ చేయడానికి ఏమీ లేదు: ఇది నొక్కినప్పుడు మాత్రమే నడుస్తుంది, మరే విధంగానూ కాదు.

మీరు అప్‌డేట్‌ను ఇన్‌స్టాల్ చేస్తే, అది అదే సంతకం కీని ఉపయోగించి యాప్‌ను దాని స్థానంలో భర్తీ చేస్తుంది, Google Play నుండి వచ్చే అప్‌డేట్ చేసినట్లుగానే.`,
    },
  ],

  mr: [
    {
      title: '0. थोडक्यात',
      body: `तुमच्या संदेशांचा मजकूर तुमच्या डिव्हाइसवर एन्क्रिप्ट केलेला असतो आणि तुम्ही ज्यांना पाठवता त्यांनाच तो वाचता येतो. आम्ही तो वाचू शकत नाही, आणि आम्ही ज्यांचे सर्व्हर भाड्याने घेतले आहेत ते Google देखील वाचू शकत नाही.

आम्हाला जे दिसू शकते ते म्हणजे संभाषण झाले: कोणती खाती त्यात आहेत, आणि ते कधी सक्रिय होते. ते काढून टाकणे सामग्री एन्क्रिप्ट करण्यापेक्षा कठीण आहे, आणि आम्ही अद्याप पूर्ण केलेले नाही. हे धोरण नेमके सांगते की सध्या ती रेषा कुठे आहे.`,
    },
    {
      title: '1. एंड-टू-एंड एन्क्रिप्टेड काय आहे',
      body: `तुमच्या डिव्हाइसवर एन्क्रिप्ट केलेले, आम्हाला आणि Google ला न वाचता येणारे:

• तुमच्या संदेशांचा मजकूर.
• तुम्ही जोडलेल्या फाइल्स, फोटो, ऑडिओ आणि व्हिडिओची सामग्री.
• लिंक प्रीव्ह्यू.
• व्हॉइस आणि व्हिडिओ कॉल, जे दोन डिव्हाइसमध्ये WebRTC च्या अनिवार्य DTLS-SRTP चा वापर करतात.

बहुतेक एक-ते-एक आणि गट संदेश अतिरिक्त ratchet वापरतात, म्हणजे प्रत्येक संदेशाची स्वतःची की असते, त्यामुळे तुमचे डिव्हाइस धोक्यात आल्यास आधीचे संदेश उघड होत नाहीत. ज्या संभाषणांमध्ये एखाद्याच्या क्लायंटने नवीन की मटेरियल प्रकाशित केलेले नाही ती एकाच दीर्घायुषी कीकडे परत जातात, ज्यात ते वैशिष्ट्य नाही. संदेशाखालील लेबल तुम्हाला सांगते की त्याला प्रत्यक्षात कोणते मिळाले.

ही रेषा ओलांडणारी एकच गोष्ट, आणि फक्त जेव्हा तुम्ही विचाराल तेव्हाच: Wikipedia वर नाव शोधणे फक्त तेच एक नाव पाठवते, तो संदेश नाही ज्यातून ते आले. विभाग 6 सांगतो की ते कोणाला मिळते, आणि शोध फक्त टॅपवर चालतो अन्यथा नाही, त्यामुळे बंद करण्यासाठी काहीही उभे नाही. सारांश, भाषांतर आणि लिप्यंतरण देखील हे ओलांडतील — ते या रिलीजमध्ये बंद केलेले आहेत, अॅपमध्ये कोठेही ते चालू करणारे नियंत्रण नाही.`,
    },
    {
      title: '2. काय एन्क्रिप्ट केलेले नाही, आणि आम्हाला काय दिसू शकते',
      body: `एन्क्रिप्शन सामग्रीचे संरक्षण करते, संभाषण झाल्याच्या वस्तुस्थितीचे नाही. हे आमच्या सर्व्हरवर स्पष्टपणे राहते:

• प्रत्येक संभाषणात कोण आहे, आणि ते कधी तयार झाले आणि शेवटचे सक्रिय होते.
• प्रत्येक संदेशाचा टाइमस्टॅम्प, आणि तुम्ही किती वाचलेले नाहीत.
• संलग्नकाचे फाइल नाव, प्रकार आणि आकार. बाइट्स एन्क्रिप्ट केलेले आहेत; त्यांचे वर्णन नाही, आणि सायफरटेक्स्टची लांबी मूळची लांबी मर्यादित करते.
• तुमचे मित्र आणि मैत्री विनंत्या.
• कॉल सिग्नलिंग — की कॉल केला गेला, कोणाला, आणि कधी. त्याचा ऑडिओ किंवा व्हिडिओ नाही.

तुम्ही ते चालू करेपर्यंत टायपिंग इंडिकेटर आणि वाचन पावत्या बंद असतात, आणि बंद असताना काहीही लिहिले जात नाही.

येथे यापुढे काय नाही: तुमचा ईमेल पत्ता आणि नाव. सप्टेंबर 2026 पासून खाते रेकॉर्डमध्ये फक्त एक खाते ओळखकर्ता आहे — आणि तेव्हापासून कुठेही ठेवण्यासाठी पत्ता नाही. साइन अप तुमच्याबद्दल काहीही विचारत नाही: तुमचे खाते 24-शब्द पुनर्प्राप्ती वाक्यांश आहे, आणि Firebase Authentication तपासते ते क्रेडेन्शियल त्यातून घेतले जाते. ते साठवते ते मेल प्राप्त करू न शकणाऱ्या डोमेनखालील एक यादृच्छिक लेबल आहे.

वेगळे: कारण अॅप Google Firebase वर चालते, तुमच्या डिव्हाइसने त्याच्याशी केलेल्या प्रत्येक कनेक्शनचा IP पत्ता आणि वेळ Google पाहू शकते. हे होस्टिंगचे वैशिष्ट्य आहे, अॅपचे नाही, आणि आम्ही ते एन्क्रिप्ट करून काढून टाकू शकत नाही.`,
    },
    {
      title: '3. लोक तुम्हाला कसे शोधतात',
      body: `ते तुम्हाला शोधू शकत नाहीत. कोणतीही डिरेक्टरी नाही — ईमेल, फोन नंबर किंवा नावाने शोध नाही — आणि सर्व्हर असा प्रयत्न करणारी कोणतीही क्वेरी नाकारतो.

तुम्ही आधीच वापरत असलेल्या कशाहीद्वारे, चॅनेलच्या बाहेर आमंत्रण लिंक पाठवून एखाद्यापर्यंत पोहोचता. लिंक एकदा काम करते, 24 तासांनंतर कालबाह्य होते, आणि मागे घेतली जाऊ शकते. तुम्ही एखाद्याला जे काही म्हणता ते त्यांच्यासाठी तुमचे स्वतःचे लेबल आहे, तुमच्यासाठी ठेवलेले; जर त्यांनी स्वतःची ओळख करून दिली, तर ते नाव एन्क्रिप्टेड स्वरूपात तुमच्यापर्यंत पोहोचले.`,
    },
    {
      title: '4. आम्ही काय गोळा करतो',
      body: `• खाते डेटा: एक खाते ओळखकर्ता, आणि तुमच्या पुनर्प्राप्ती वाक्यांशातून घेतलेले क्रेडेन्शियल, Firebase Authentication मध्ये ठेवलेले. ईमेल पत्ता नाही, फोन नंबर नाही, नाव नाही — साइन अप यापैकी कशाचीही विचारणा करत नाही.
• संदेश आणि संलग्नक सायफरटेक्स्ट, तसेच विभाग 2 मधील मेटाडेटा.

तीच संपूर्ण यादी आहे. विश्लेषण नाही आणि क्रॅश रिपोर्टिंग नाही. अॅप पूर्वी Firebase Analytics ला स्क्रीन व्ह्यूज आणि Firebase Crashlytics ला क्रॅश रिपोर्ट्स पाठवत असे, दोन्ही तुमच्या खाते ओळखकर्त्यासह, त्यामुळे कोणतेही निनावी नव्हते; दोन्ही आता ते पाठवणाऱ्या लायब्ररींसह गेले आहेत. विकासादरम्यान विकासकाच्या स्वतःच्या मशीनवर त्रुटी छापल्या जातात आणि अन्यत्र जात नाहीत.`,
    },
    {
      title: '5. ते कुठे साठवले जाते',
      body: `Google Firebase वर — Firestore, Storage आणि Authentication — सुरक्षा नियमांखाली जे ठरवतात की प्रत्येक दस्तऐवज कोण वाचू आणि लिहू शकतो.

तुमच्या डिव्हाइसवर, कॅश केलेले संदेश, सेटिंग्ज, आणि तुमचा अॅप-लॉक पिन सामान्य अॅप स्टोरेजऐवजी प्लॅटफॉर्म कीस्टोअरमध्ये (iOS Keychain, Android Keystore) ठेवलेल्या प्रति-डिव्हाइस कीने एन्क्रिप्ट केलेले आहेत.

तुमचे संदेश डिक्रिप्ट करणारी खाजगी की तुम्ही लिहून ठेवण्याचे निवडलेल्या पुनर्प्राप्ती वाक्यांशाशिवाय तुमचे डिव्हाइस कधीही सोडत नाही. आम्ही ती ठेवत नाही आणि तुमच्यासाठी ती पुनर्प्राप्त करू शकत नाही. ती हरवल्यास, त्या डिव्हाइसला पाठवलेले संदेश पुन्हा वाचता येणार नाहीत — आम्हासह कोणीही.`,
    },
    {
      title: '6. इतर कोण डेटा प्राप्त करतो',
      body: `आम्ही तुमची वैयक्तिक माहिती विकत नाही, व्यापार करत नाही, किंवा भाड्याने देत नाही. डेटा येथे पोहोचतो:

• Google Firebase — वर वर्णन केल्याप्रमाणे, आमचा होस्टिंग प्रदाता.
• Cloudflare Realtime — तुमचे डिव्हाइस आणि दुसऱ्या व्यक्तीचे डिव्हाइस थेट एकमेकांपर्यंत पोहोचू शकत नाहीत तेव्हा कॉलचा ऑडिओ आणि व्हिडिओ.
• विकिमीडिया फाउंडेशन — जेव्हा तुम्ही Wikipedia वर शोधण्यासाठी टॅप करता तेव्हा एक नाव.
• Google Cloud Speech-to-Text — जेव्हा तुम्ही ट्रान्सक्रिप्टची विनंती करता तेव्हा एका व्हॉइस मेसेजचा ऑडिओ.
• Google Cloud Translation — जेव्हा तुम्ही भाषांतराची विनंती करता तेव्हा एका संदेशाचा मजकूर.
• Cloudflare Workers AI — जेव्हा तुम्ही सारांशाची विनंती करता किंवा त्याबद्दल प्रश्न विचारता तेव्हा एका संभाषणाचे शेवटचे 50 संदेश.

शेवटचे तीन या रिलीजमध्ये बंद केलेले आहेत. लिप्यंतरण, भाषांतर किंवा सारांश चालू करणारे कोणतेही नियंत्रण अॅपमध्ये कोठेही नाही, त्यामुळे त्या तीन सेवांपर्यंत काहीही पोहोचत नाही. ते काढून टाकण्याऐवजी सूचीबद्ध केले आहेत कारण कोड अजूनही येथे आहे आणि ती वैशिष्ट्ये परत येण्याचा हेतू आहे — आणि जेव्हा ती परत येतात, तेव्हा ती या प्रकटीकरणासह आणि पहिल्या वापरापूर्वी प्रॉम्प्टसह परत येतात. तेव्हा जे पाठवले जाईल ते तुमचा निकाल तयार करण्यासाठी पाठवले जाईल, काहीही प्रशिक्षित करण्यासाठी नाही; आमच्या सर्व्हरवर कोणताही ट्रान्सक्रिप्ट किंवा भाषांतर साठवले जात नाही.

Wikipedia शोधासाठी स्विच नाही कारण बंद करण्यासाठी काहीही उभे नाही: ते फक्त टॅपवर चालते अन्यथा नाही. Wikipedia ला फक्त ते एक नाव आणि तुमचा IP पत्ता मिळतो, जणू तुम्ही तो त्यांच्या शोध बॉक्समध्ये स्वतः टाइप केला आहे — खाते नाही, संदेश नाही, संभाषण नाही. जे परत येते ते दाखवले जाते आणि जतन केले जात नाही, आणि त्याबद्दल काहीही संभाषणात लिहिले जात नाही.

Cloudflare Realtime लाही स्विच नाही. बहुतेक कॉल्सना याची गरज नसते: थेट एकमेकांपर्यंत पोहोचू शकणारी दोन डिव्हाइसेस—एकाच नेटवर्कवरील बहुतेक कॉल्स—याशिवायच कनेक्ट होतात, आणि काहीही रिले होत नाही. जेव्हा ते पोहोचू शकत नाहीत—सहसा तुम्ही दोघे वेगवेगळ्या मोबाइल नेटवर्कवर असल्यामुळे—आधीच एन्क्रिप्ट केलेला कॉल कनेक्ट न होता राहण्याऐवजी रिले केला जातो. Cloudflare जे पाहते ते म्हणजे दोघांचे IP पत्ते, कॉलची वेळ, आणि साधारण किती डेटा हलला; ऑडिओ आणि व्हिडिओ विभाग २ मध्ये वर्णन केलेल्या त्याच DTLS-SRTP एन्क्रिप्शनखालीच राहतात, त्यामुळे रिले केल्याने ते डिक्रिप्ट होत नाहीत.

कायद्याने आवश्यक असल्यास आम्ही आमच्याकडे असलेले उघड करू शकतो. आमच्याकडे जे आहे ते विभाग 2 मधील यादी आहे. आम्ही संदेश सामग्री देऊ शकत नाही, कारण आम्ही ती वाचू शकत नाही.`,
    },
    {
      title: '7. पुश सूचना',
      body: `Firebase Cloud Messaging सूचना वितरीत करते. तुमचा डिव्हाइस टोकन तुमच्या खात्याच्या खाजगी भागात साठवला जातो जो फक्त तुम्हीच वाचू शकता.

सूचनांमध्ये संदेश मजकूर नसतो. तुमचे डिव्हाइस स्थानिक पातळीवर संदेश डिक्रिप्ट करते आणि तुम्ही जे पाहता ते तयार करते; Google सामग्री नाही, लिफाफा वितरीत करते.`,
    },
    {
      title: '8. तुम्ही काय करू शकता',
      body: `• प्रोफाइल स्क्रीनवरून तुमचे खाते हटवा. संभाषणाचा संयुक्तपणे भाग असलेली सामग्री — उदाहरणार्थ, कॉल रेकॉर्ड — इतर सहभागीकडे राहते, कारण ते त्यांचेही रेकॉर्ड आहे.
• प्रोफाइल स्क्रीनवरून तुमचा डेटा निर्यात करा.
• प्रत्येक चॅटसाठी संदेश कालबाह्य होण्यासाठी सेट करा: 1 तास, 24 तास, 7 दिवस किंवा 30 दिवस.
• टायपिंग इंडिकेटर आणि वाचन पावत्या चालू किंवा बंद करा. दोन्ही डीफॉल्टनुसार बंद आहेत.
• पिन किंवा बायोमेट्रिक्ससह अॅप लॉक करा.
• तुम्ही दिलेली आमंत्रण लिंक मागे घ्या.

जर तुम्हाला आम्ही काहीतरी हाताने हटवावे असे वाटत असेल, तर आम्हाला लिहा.`,
    },
    {
      title: '9. धारणा',
      body: `तुमचे खाते अस्तित्वात असेपर्यंत आम्ही तुमचा डेटा ठेवतो. खाते हटवल्याने ते हटते, वर नमूद केलेल्या संयुक्तपणे धारण केलेल्या सामग्रीशिवाय. प्रति-चॅट कालबाह्यता तुम्ही सेट केलेल्या वेळापत्रकानुसार संदेश काढून टाकते.`,
    },
    {
      title: '10. तुम्हाला माहित असाव्या अशा मर्यादा',
      body: `तुम्हाला त्या सापडण्यापेक्षा आम्ही तुम्हाला या सांगण्यास प्राधान्य देतो.

• की पहिल्यांदा पाहिल्यावर विश्वासार्ह मानल्या जातात. जर तुम्ही कधीही संदेशाची देवाणघेवाण करण्यापूर्वी कोणीतरी की बदलली असेल, तर संभाषण चुकीच्या व्यक्तीला एन्क्रिप्ट केले जाईल आणि पूर्णपणे सामान्य दिसेल. की नंतर बदलल्यास अॅप तुम्हाला चेतावणी देते, आणि तुम्ही चॅनेलबाहेर तुलना करू शकता असा सुरक्षा क्रमांक दाखवते — पण त्याची तुलना करण्यास कोणीही तुम्हाला भाग पाडत नाही.
• एका वेळी एक डिव्हाइस. तुमचा पुनर्प्राप्ती वाक्यांश तुमचा इतिहास उघडणारी की पुनर्संचयित करतो, त्यामुळे नवीन डिव्हाइसवर साइन इन केल्याने तुम्ही आधीच मिळवलेले गमावत नाही. फॉरवर्ड-सिक्रेट संभाषणे दुसरी की वापरतात जी ती तयार करणारे डिव्हाइस कधीही सोडत नाही: जे डिव्हाइस शेवटचे साइन इन झाले तेच ते पोहोचते, आणि त्या दरम्यान दुसऱ्याला सील केलेले काहीही हलवता येत नाही.
• एन्क्रिप्शन अस्तित्वात येण्यापूर्वी पाठवलेले संदेश जसे होते तसेच राहतात. काहीही पूर्वलक्षीपणे रूपांतरित केले गेले नाही.
• या अॅपचे स्वतंत्रपणे सुरक्षा ऑडिट केलेले नाही.`,
    },
    {
      title: '11. मुले',
      body: `Chatterbox 13 वर्षांखालील मुलांसाठी नाही, आणि आम्ही जाणूनबुजून त्यांची माहिती गोळा करत नाही. जर तुम्हाला वाटत असेल की एखाद्या मुलाने आम्हाला वैयक्तिक माहिती दिली आहे, तर आमच्याशी संपर्क साधा आणि आम्ही ती हटवू.`,
    },
    {
      title: '12. बदल',
      body: `आम्ही हे धोरण अद्यतनित करू शकतो. महत्त्वपूर्ण बदल अॅपमध्ये जाहीर केले जातील, आणि वरची तारीख ती शेवटची कधी बदलली हे आहे.`,
    },
    {
      title: '13. संपर्क',
      body: `या धोरणाबद्दल प्रश्न: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. अ‍ॅपची नवीन आवृत्ती तपासणे',
      body: `हे अ‍ॅप तुमच्या Android फोनपर्यंत पोहोचण्याचा मार्ग Google Play नाही. त्याऐवजी ते chatterbox.fans वरून डाउनलोड केले जाते, आणि या प्रक्रियेत सामील नसलेले स्टोअर तुमच्या वतीने अद्यतने तपासू शकत नाही — म्हणून जर तुम्ही विचारले तर हे अ‍ॅप स्वतः हे करू शकते.

"आता तपासा" वर टॅप केल्याने सध्याची आवृत्ती कोणती आहे हे विचारणारी एक विनंती chatterbox.fans ला पाठवली जाते. त्या विनंतीमध्ये फक्त तुमचा IP पत्ता असतो, आणखी काहीही नाही — खाते नाही, डिव्हाइस ओळखकर्ता नाही, संदेश नाही. जे परत येते ते एक आवृत्ती क्रमांक आहे, जो तुमच्या फोनवर तुम्ही वापरत असलेल्या आवृत्तीशी तुलना केला जातो; काहीही आपोआप डाउनलोड होत नाही, आणि या तपासणीबद्दल काहीही संभाषणात लिहिले जात नाही.

याला स्विच नाही कारण बंद करण्यासारखे काहीही नाही: हे फक्त टॅप केल्यावरच चालते, अन्यथा नाही.

तुम्ही अद्यतन इंस्टॉल केल्यास, ते त्याच स्वाक्षरी कीचा वापर करून अ‍ॅपला त्याच जागी बदलते, जसे Google Play वरून येणारे अद्यतन करेल त्याचप्रमाणे.`,
    },
  ],

  pa: [
    {
      title: '0. ਸੰਖੇਪ ਵਿੱਚ',
      body: `ਤੁਹਾਡੇ ਸੁਨੇਹਿਆਂ ਦਾ ਟੈਕਸਟ ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਉੱਤੇ ਇਨਕ੍ਰਿਪਟ ਕੀਤਾ ਜਾਂਦਾ ਹੈ ਅਤੇ ਸਿਰਫ਼ ਉਹੀ ਲੋਕ ਇਸਨੂੰ ਪੜ੍ਹ ਸਕਦੇ ਹਨ ਜਿਨ੍ਹਾਂ ਨੂੰ ਤੁਸੀਂ ਭੇਜਦੇ ਹੋ। ਅਸੀਂ ਇਸਨੂੰ ਪੜ੍ਹ ਨਹੀਂ ਸਕਦੇ, ਅਤੇ ਨਾ ਹੀ Google, ਜਿਸਦੇ ਸਰਵਰ ਅਸੀਂ ਕਿਰਾਏ ਉੱਤੇ ਲੈਂਦੇ ਹਾਂ।

ਜੋ ਅਸੀਂ ਦੇਖ ਸਕਦੇ ਹਾਂ ਉਹ ਇਹ ਹੈ ਕਿ ਇੱਕ ਗੱਲਬਾਤ ਹੋਈ: ਕਿਹੜੇ ਖਾਤੇ ਇਸ ਵਿੱਚ ਹਨ, ਅਤੇ ਉਹ ਕਦੋਂ ਸਰਗਰਮ ਸਨ। ਇਸਨੂੰ ਹਟਾਉਣਾ ਸਮੱਗਰੀ ਨੂੰ ਇਨਕ੍ਰਿਪਟ ਕਰਨ ਨਾਲੋਂ ਔਖਾ ਹੈ, ਅਤੇ ਅਸੀਂ ਪੂਰਾ ਨਹੀਂ ਕੀਤਾ। ਇਹ ਨੀਤੀ ਬਿਲਕੁਲ ਦੱਸਦੀ ਹੈ ਕਿ ਲਾਈਨ ਹੁਣ ਕਿੱਥੇ ਹੈ।`,
    },
    {
      title: '1. ਐਂਡ-ਟੂ-ਐਂਡ ਕੀ ਇਨਕ੍ਰਿਪਟ ਹੈ',
      body: `ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਉੱਤੇ ਇਨਕ੍ਰਿਪਟ ਕੀਤਾ ਗਿਆ, ਸਾਡੇ ਅਤੇ Google ਲਈ ਨਾ-ਪੜ੍ਹਨਯੋਗ:

• ਤੁਹਾਡੇ ਸੁਨੇਹਿਆਂ ਦਾ ਟੈਕਸਟ।
• ਫਾਈਲਾਂ, ਫੋਟੋਆਂ, ਆਡੀਓ ਅਤੇ ਵੀਡੀਓ ਦੀ ਸਮੱਗਰੀ ਜੋ ਤੁਸੀਂ ਨੱਥੀ ਕਰਦੇ ਹੋ।
• ਲਿੰਕ ਪੂਰਵਦਰਸ਼ਨ।
• ਆਵਾਜ਼ ਅਤੇ ਵੀਡੀਓ ਕਾਲਾਂ, ਜੋ ਦੋ ਡਿਵਾਈਸਾਂ ਵਿਚਕਾਰ WebRTC ਦੇ ਲਾਜ਼ਮੀ DTLS-SRTP ਦੀ ਵਰਤੋਂ ਕਰਦੀਆਂ ਹਨ।

ਜ਼ਿਆਦਾਤਰ ਇੱਕ-ਤੋਂ-ਇੱਕ ਅਤੇ ਗਰੁੱਪ ਸੁਨੇਹੇ ਵਾਧੂ ਤੌਰ ਉੱਤੇ ਇੱਕ ratchet ਵਰਤਦੇ ਹਨ, ਭਾਵ ਹਰੇਕ ਸੁਨੇਹੇ ਦੀ ਆਪਣੀ ਕੁੰਜੀ ਹੁੰਦੀ ਹੈ, ਇਸ ਲਈ ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਨਾਲ ਸਮਝੌਤਾ ਪਹਿਲਾਂ ਵਾਲੇ ਸੁਨੇਹਿਆਂ ਨੂੰ ਬੇਪਰਦ ਨਹੀਂ ਕਰਦਾ। ਜਿੱਥੇ ਕਿਸੇ ਦੇ ਕਲਾਇੰਟ ਨੇ ਨਵੀਂ ਕੁੰਜੀ ਸਮੱਗਰੀ ਪ੍ਰਕਾਸ਼ਿਤ ਨਹੀਂ ਕੀਤੀ, ਉਹ ਗੱਲਬਾਤਾਂ ਇੱਕ ਲੰਬੇ ਸਮੇਂ ਵਾਲੀ ਕੁੰਜੀ ਵੱਲ ਵਾਪਸ ਚਲੀਆਂ ਜਾਂਦੀਆਂ ਹਨ, ਜਿਸ ਵਿੱਚ ਇਹ ਗੁਣ ਨਹੀਂ ਹੈ। ਸੁਨੇਹੇ ਹੇਠਾਂ ਦਾ ਲੇਬਲ ਤੁਹਾਨੂੰ ਦੱਸਦਾ ਹੈ ਕਿ ਇਸਨੂੰ ਅਸਲ ਵਿੱਚ ਕਿਹੜਾ ਮਿਲਿਆ।

ਸਿਰਫ਼ ਇੱਕ ਚੀਜ਼ ਇਸ ਲਾਈਨ ਨੂੰ ਪਾਰ ਕਰਦੀ ਹੈ, ਅਤੇ ਸਿਰਫ਼ ਉਦੋਂ ਜਦੋਂ ਤੁਸੀਂ ਇਸਨੂੰ ਪੁੱਛਦੇ ਹੋ: ਵਿਕੀਪੀਡੀਆ ਉੱਤੇ ਨਾਮ ਲੱਭਣਾ ਉਹ ਇੱਕ ਨਾਮ ਭੇਜਦਾ ਹੈ, ਉਹ ਸੁਨੇਹਾ ਨਹੀਂ ਜਿਸ ਤੋਂ ਇਹ ਆਇਆ। ਭਾਗ 6 ਦੱਸਦਾ ਹੈ ਕਿ ਇਸਨੂੰ ਕੌਣ ਪ੍ਰਾਪਤ ਕਰਦਾ ਹੈ, ਅਤੇ ਖੋਜ ਟੈਪ ਉੱਤੇ ਹੀ ਚੱਲਦੀ ਹੈ ਨਹੀਂ ਤਾਂ ਨਹੀਂ, ਇਸ ਲਈ ਬੰਦ ਕਰਨ ਲਈ ਕੁਝ ਵੀ ਖੜ੍ਹਾ ਨਹੀਂ ਹੈ। ਸੰਖੇਪ, ਅਨੁਵਾਦ ਅਤੇ ਲਿਪੀਅੰਤਰਨ ਵੀ ਇਸਨੂੰ ਪਾਰ ਕਰਨਗੇ — ਇਹ ਇਸ ਰੀਲੀਜ਼ ਵਿੱਚ ਬੰਦ ਹਨ, ਐਪ ਵਿੱਚ ਕਿਤੇ ਵੀ ਕੋਈ ਕੰਟਰੋਲ ਨਹੀਂ ਜੋ ਇਹਨਾਂ ਨੂੰ ਚਾਲੂ ਕਰੇ।`,
    },
    {
      title: '2. ਕੀ ਇਨਕ੍ਰਿਪਟ ਨਹੀਂ ਹੈ, ਅਤੇ ਅਸੀਂ ਕੀ ਦੇਖ ਸਕਦੇ ਹਾਂ',
      body: `ਇਨਕ੍ਰਿਪਸ਼ਨ ਸਮੱਗਰੀ ਦੀ ਰੱਖਿਆ ਕਰਦੀ ਹੈ, ਗੱਲਬਾਤ ਦੇ ਤੱਥ ਦੀ ਨਹੀਂ। ਇਹ ਸਾਡੇ ਸਰਵਰਾਂ ਉੱਤੇ ਸਾਫ਼ ਬੈਠਦੇ ਹਨ:

• ਹਰੇਕ ਗੱਲਬਾਤ ਵਿੱਚ ਕੌਣ ਹੈ, ਅਤੇ ਇਹ ਕਦੋਂ ਬਣਾਈ ਗਈ ਅਤੇ ਆਖਰੀ ਵਾਰ ਸਰਗਰਮ ਹੋਈ।
• ਹਰੇਕ ਸੁਨੇਹੇ ਦਾ ਟਾਈਮਸਟੈਂਪ, ਅਤੇ ਤੁਸੀਂ ਕਿੰਨੇ ਨਹੀਂ ਪੜ੍ਹੇ।
• ਅਟੈਚਮੈਂਟ ਦਾ ਫਾਈਲ ਨਾਮ, ਕਿਸਮ ਅਤੇ ਆਕਾਰ। ਬਾਈਟ ਇਨਕ੍ਰਿਪਟ ਹਨ; ਉਹਨਾਂ ਦਾ ਵੇਰਵਾ ਨਹੀਂ ਹੈ, ਅਤੇ ਸਿਫਰਟੈਕਸਟ ਦੀ ਲੰਬਾਈ ਅਸਲ ਦੀ ਲੰਬਾਈ ਨੂੰ ਸੀਮਤ ਕਰਦੀ ਹੈ।
• ਤੁਹਾਡੇ ਦੋਸਤ ਅਤੇ ਦੋਸਤੀ ਬੇਨਤੀਆਂ।
• ਕਾਲ ਸਿਗਨਲਿੰਗ — ਕਿ ਇੱਕ ਕਾਲ ਕੀਤੀ ਗਈ ਸੀ, ਕਿਸਨੂੰ, ਅਤੇ ਕਦੋਂ। ਇਸਦਾ ਆਡੀਓ ਜਾਂ ਵੀਡੀਓ ਨਹੀਂ।

ਟਾਈਪਿੰਗ ਸੂਚਕ ਅਤੇ ਪੜ੍ਹਨ ਦੀਆਂ ਰਸੀਦਾਂ ਬੰਦ ਹਨ ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ਇਹਨਾਂ ਨੂੰ ਚਾਲੂ ਨਹੀਂ ਕਰਦੇ, ਅਤੇ ਬੰਦ ਹੋਣ ਦੌਰਾਨ ਕੁਝ ਵੀ ਨਹੀਂ ਲਿਖਿਆ ਜਾਂਦਾ।

ਹੁਣ ਇੱਥੇ ਕੀ ਨਹੀਂ ਹੈ: ਤੁਹਾਡਾ ਈਮੇਲ ਪਤਾ ਅਤੇ ਨਾਮ। ਸਤੰਬਰ 2026 ਤੋਂ ਖਾਤਾ ਰਿਕਾਰਡ ਸਿਰਫ਼ ਇੱਕ ਖਾਤਾ ਪਛਾਣਕਰਤਾ ਰੱਖਦਾ ਹੈ — ਅਤੇ ਉਦੋਂ ਤੋਂ ਕਿਤੇ ਵੀ ਰੱਖਣ ਲਈ ਕੋਈ ਪਤਾ ਨਹੀਂ ਹੈ। ਸਾਈਨ ਅੱਪ ਤੁਹਾਡੇ ਬਾਰੇ ਕੁਝ ਨਹੀਂ ਪੁੱਛਦਾ: ਤੁਹਾਡਾ ਖਾਤਾ ਇੱਕ 24-ਸ਼ਬਦ ਰਿਕਵਰੀ ਵਾਕੰਸ਼ ਹੈ, ਅਤੇ Firebase Authentication ਜਿਸ ਪ੍ਰਮਾਣ ਦੀ ਜਾਂਚ ਕਰਦਾ ਹੈ ਉਹ ਇਸ ਤੋਂ ਲਿਆ ਗਿਆ ਹੈ। ਇਹ ਜੋ ਸਟੋਰ ਕਰਦਾ ਹੈ ਉਹ ਇੱਕ ਡੋਮੇਨ ਹੇਠ ਇੱਕ ਬੇਤਰਤੀਬ ਲੇਬਲ ਹੈ ਜੋ ਮੇਲ ਪ੍ਰਾਪਤ ਨਹੀਂ ਕਰ ਸਕਦਾ।

ਵੱਖਰੇ ਤੌਰ ਉੱਤੇ: ਕਿਉਂਕਿ ਐਪ Google Firebase ਉੱਤੇ ਚੱਲਦੀ ਹੈ, Google ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਦੁਆਰਾ ਇਸ ਨਾਲ ਕੀਤੇ ਹਰੇਕ ਕਨੈਕਸ਼ਨ ਦਾ IP ਪਤਾ ਅਤੇ ਸਮਾਂ ਦੇਖ ਸਕਦਾ ਹੈ। ਇਹ ਹੋਸਟਿੰਗ ਦੀ ਵਿਸ਼ੇਸ਼ਤਾ ਹੈ, ਐਪ ਦੀ ਨਹੀਂ, ਅਤੇ ਅਸੀਂ ਇਸਨੂੰ ਇਨਕ੍ਰਿਪਟ ਕਰਕੇ ਦੂਰ ਨਹੀਂ ਕਰ ਸਕਦੇ।`,
    },
    {
      title: '3. ਲੋਕ ਤੁਹਾਨੂੰ ਕਿਵੇਂ ਲੱਭਦੇ ਹਨ',
      body: `ਉਹ ਤੁਹਾਨੂੰ ਖੋਜ ਨਹੀਂ ਸਕਦੇ। ਕੋਈ ਡਾਇਰੈਕਟਰੀ ਨਹੀਂ ਹੈ — ਈਮੇਲ, ਫ਼ੋਨ ਨੰਬਰ ਜਾਂ ਨਾਮ ਦੁਆਰਾ ਕੋਈ ਖੋਜ ਨਹੀਂ — ਅਤੇ ਸਰਵਰ ਕਿਸੇ ਵੀ ਪੁੱਛਗਿੱਛ ਨੂੰ ਰੱਦ ਕਰਦਾ ਹੈ ਜੋ ਇਸਦੀ ਕੋਸ਼ਿਸ਼ ਕਰਦੀ ਹੈ।

ਤੁਸੀਂ ਪਹਿਲਾਂ ਤੋਂ ਵਰਤੀ ਜਾ ਰਹੀ ਕਿਸੇ ਵੀ ਚੀਜ਼ ਰਾਹੀਂ, ਚੈਨਲ ਤੋਂ ਬਾਹਰ ਸੱਦਾ ਲਿੰਕ ਭੇਜ ਕੇ ਕਿਸੇ ਤੱਕ ਪਹੁੰਚਦੇ ਹੋ। ਇੱਕ ਲਿੰਕ ਇੱਕ ਵਾਰ ਕੰਮ ਕਰਦਾ ਹੈ, 24 ਘੰਟਿਆਂ ਬਾਅਦ ਸਮਾਪਤ ਹੁੰਦਾ ਹੈ, ਅਤੇ ਵਾਪਸ ਲਿਆ ਜਾ ਸਕਦਾ ਹੈ। ਤੁਸੀਂ ਕਿਸੇ ਨੂੰ ਜੋ ਵੀ ਕਹਿੰਦੇ ਹੋ ਉਹ ਉਹਨਾਂ ਲਈ ਤੁਹਾਡਾ ਆਪਣਾ ਲੇਬਲ ਹੈ, ਤੁਹਾਡੇ ਲਈ ਰੱਖਿਆ; ਜੇ ਉਹਨਾਂ ਨੇ ਆਪਣੀ ਜਾਣ-ਪਛਾਣ ਕਰਵਾਈ, ਤਾਂ ਉਹ ਨਾਮ ਤੁਹਾਡੇ ਤੱਕ ਇਨਕ੍ਰਿਪਟਿਡ ਪਹੁੰਚਿਆ।`,
    },
    {
      title: '4. ਅਸੀਂ ਕੀ ਇਕੱਠਾ ਕਰਦੇ ਹਾਂ',
      body: `• ਖਾਤਾ ਡਾਟਾ: ਇੱਕ ਖਾਤਾ ਪਛਾਣਕਰਤਾ, ਅਤੇ ਤੁਹਾਡੇ ਰਿਕਵਰੀ ਵਾਕੰਸ਼ ਤੋਂ ਲਿਆ ਗਿਆ ਪ੍ਰਮਾਣ, Firebase Authentication ਵਿੱਚ ਰੱਖਿਆ ਗਿਆ। ਕੋਈ ਈਮੇਲ ਪਤਾ ਨਹੀਂ, ਕੋਈ ਫ਼ੋਨ ਨੰਬਰ ਨਹੀਂ, ਕੋਈ ਨਾਮ ਨਹੀਂ — ਸਾਈਨ ਅੱਪ ਇਹਨਾਂ ਵਿੱਚੋਂ ਕੋਈ ਵੀ ਨਹੀਂ ਪੁੱਛਦਾ।
• ਸੁਨੇਹਾ ਅਤੇ ਅਟੈਚਮੈਂਟ ਸਿਫਰਟੈਕਸਟ, ਭਾਗ 2 ਵਿੱਚ ਮੈਟਾਡੇਟਾ ਦੇ ਨਾਲ।

ਇਹੀ ਪੂਰੀ ਸੂਚੀ ਹੈ। ਕੋਈ ਵਿਸ਼ਲੇਸ਼ਣ ਨਹੀਂ ਅਤੇ ਕੋਈ ਕਰੈਸ਼ ਰਿਪੋਰਟਿੰਗ ਨਹੀਂ। ਐਪ ਪਹਿਲਾਂ Firebase Analytics ਨੂੰ ਸਕ੍ਰੀਨ ਵਿਊਜ਼ ਅਤੇ Firebase Crashlytics ਨੂੰ ਕਰੈਸ਼ ਰਿਪੋਰਟਾਂ ਭੇਜਦੀ ਸੀ, ਦੋਵੇਂ ਤੁਹਾਡੇ ਖਾਤਾ ਪਛਾਣਕਰਤਾ ਨੂੰ ਲੈ ਕੇ ਜਾਂਦੇ ਸਨ, ਇਸ ਲਈ ਕੋਈ ਵੀ ਗੁਮਨਾਮ ਨਹੀਂ ਸੀ; ਦੋਵੇਂ ਹੁਣ ਉਹਨਾਂ ਲਾਇਬ੍ਰੇਰੀਆਂ ਦੇ ਨਾਲ ਚਲੇ ਗਏ ਹਨ ਜਿਨ੍ਹਾਂ ਨੇ ਉਹਨਾਂ ਨੂੰ ਭੇਜਿਆ। ਗਲਤੀਆਂ ਵਿਕਾਸ ਦੌਰਾਨ ਡਿਵੈਲਪਰ ਦੀ ਆਪਣੀ ਮਸ਼ੀਨ ਉੱਤੇ ਪ੍ਰਿੰਟ ਹੁੰਦੀਆਂ ਹਨ ਅਤੇ ਕਿਤੇ ਹੋਰ ਨਹੀਂ ਜਾਂਦੀਆਂ।`,
    },
    {
      title: '5. ਇਹ ਕਿੱਥੇ ਸਟੋਰ ਹੈ',
      body: `Google Firebase ਉੱਤੇ — Firestore, Storage ਅਤੇ Authentication — ਸੁਰੱਖਿਆ ਨਿਯਮਾਂ ਹੇਠ ਜੋ ਫੈਸਲਾ ਕਰਦੇ ਹਨ ਕਿ ਹਰੇਕ ਦਸਤਾਵੇਜ਼ ਨੂੰ ਕੌਣ ਪੜ੍ਹ ਅਤੇ ਲਿਖ ਸਕਦਾ ਹੈ।

ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਉੱਤੇ, ਕੈਸ਼ ਕੀਤੇ ਸੁਨੇਹੇ, ਸੈਟਿੰਗਾਂ, ਅਤੇ ਤੁਹਾਡਾ ਐਪ-ਲਾਕ PIN ਸਧਾਰਨ ਐਪ ਸਟੋਰੇਜ ਦੀ ਬਜਾਏ ਪਲੇਟਫਾਰਮ ਕੀਸਟੋਰ (iOS Keychain, Android Keystore) ਵਿੱਚ ਰੱਖੀ ਗਈ ਪ੍ਰਤੀ-ਡਿਵਾਈਸ ਕੁੰਜੀ ਨਾਲ ਇਨਕ੍ਰਿਪਟ ਕੀਤੇ ਗਏ ਹਨ।

ਪ੍ਰਾਈਵੇਟ ਕੁੰਜੀ ਜੋ ਤੁਹਾਡੇ ਸੁਨੇਹਿਆਂ ਨੂੰ ਡੀਕ੍ਰਿਪਟ ਕਰਦੀ ਹੈ ਕਦੇ ਵੀ ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਨੂੰ ਨਹੀਂ ਛੱਡਦੀ, ਸਿਵਾਏ ਰਿਕਵਰੀ ਵਾਕੰਸ਼ ਵਜੋਂ ਜੋ ਤੁਸੀਂ ਲਿਖਣਾ ਚੁਣਦੇ ਹੋ। ਅਸੀਂ ਇਸਨੂੰ ਨਹੀਂ ਰੱਖਦੇ ਅਤੇ ਤੁਹਾਡੇ ਲਈ ਇਸਨੂੰ ਮੁੜ ਪ੍ਰਾਪਤ ਨਹੀਂ ਕਰ ਸਕਦੇ। ਇਸਨੂੰ ਗੁਆਉਣ ਉੱਤੇ, ਉਸ ਡਿਵਾਈਸ ਨੂੰ ਭੇਜੇ ਸੁਨੇਹੇ ਦੁਬਾਰਾ ਨਹੀਂ ਪੜ੍ਹੇ ਜਾ ਸਕਦੇ — ਕਿਸੇ ਦੁਆਰਾ ਵੀ, ਸਾਡੇ ਸਮੇਤ।`,
    },
    {
      title: '6. ਹੋਰ ਕੌਣ ਡਾਟਾ ਪ੍ਰਾਪਤ ਕਰਦਾ ਹੈ',
      body: `ਅਸੀਂ ਤੁਹਾਡੀ ਨਿੱਜੀ ਜਾਣਕਾਰੀ ਵੇਚਦੇ, ਵਪਾਰ ਕਰਦੇ ਜਾਂ ਕਿਰਾਏ ਉੱਤੇ ਨਹੀਂ ਦਿੰਦੇ। ਡਾਟਾ ਇੱਥੇ ਪਹੁੰਚਦਾ ਹੈ:

• Google Firebase — ਉੱਪਰ ਦੱਸੇ ਅਨੁਸਾਰ, ਸਾਡਾ ਹੋਸਟਿੰਗ ਪ੍ਰਦਾਤਾ।
• Cloudflare Realtime — ਕਾਲ ਦੀ ਆਡੀਓ ਅਤੇ ਵੀਡੀਓ, ਜਦੋਂ ਤੁਹਾਡਾ ਡਿਵਾਈਸ ਅਤੇ ਦੂਜੇ ਵਿਅਕਤੀ ਦਾ ਡਿਵਾਈਸ ਸਿੱਧੇ ਇੱਕ ਦੂਜੇ ਤੱਕ ਨਹੀਂ ਪਹੁੰਚ ਸਕਦੇ।
• ਵਿਕੀਮੀਡੀਆ ਫਾਊਂਡੇਸ਼ਨ — ਇੱਕ ਨਾਮ, ਜਦੋਂ ਤੁਸੀਂ ਵਿਕੀਪੀਡੀਆ ਉੱਤੇ ਲੱਭਣ ਲਈ ਟੈਪ ਕਰਦੇ ਹੋ।
• Google Cloud Speech-to-Text — ਇੱਕ ਆਵਾਜ਼ ਸੁਨੇਹੇ ਦਾ ਆਡੀਓ, ਜਦੋਂ ਤੁਸੀਂ ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ ਦੀ ਬੇਨਤੀ ਕਰਦੇ ਹੋ।
• Google Cloud Translation — ਇੱਕ ਸੁਨੇਹੇ ਦਾ ਟੈਕਸਟ, ਜਦੋਂ ਤੁਸੀਂ ਅਨੁਵਾਦ ਦੀ ਬੇਨਤੀ ਕਰਦੇ ਹੋ।
• Cloudflare Workers AI — ਜਦੋਂ ਤੁਸੀਂ ਸੰਖੇਪ ਦੀ ਬੇਨਤੀ ਕਰਦੇ ਹੋ ਜਾਂ ਇਸ ਬਾਰੇ ਸਵਾਲ ਪੁੱਛਦੇ ਹੋ ਤਾਂ ਇੱਕ ਗੱਲਬਾਤ ਦੇ ਆਖਰੀ 50 ਸੁਨੇਹਿਆਂ ਤੱਕ।

ਆਖਰੀ ਤਿੰਨ ਇਸ ਰੀਲੀਜ਼ ਵਿੱਚ ਬੰਦ ਹਨ। ਟ੍ਰਾਂਸਕ੍ਰਿਪਸ਼ਨ, ਅਨੁਵਾਦ ਜਾਂ ਸੰਖੇਪਾਂ ਨੂੰ ਚਾਲੂ ਕਰਨ ਵਾਲਾ ਐਪ ਵਿੱਚ ਕਿਤੇ ਵੀ ਕੋਈ ਕੰਟਰੋਲ ਨਹੀਂ ਹੈ, ਇਸ ਲਈ ਉਹਨਾਂ ਤਿੰਨ ਸੇਵਾਵਾਂ ਤੱਕ ਕੁਝ ਵੀ ਨਹੀਂ ਪਹੁੰਚਦਾ। ਇਹ ਹਟਾਏ ਜਾਣ ਦੀ ਬਜਾਏ ਸੂਚੀਬੱਧ ਹਨ ਕਿਉਂਕਿ ਕੋਡ ਅਜੇ ਵੀ ਇੱਥੇ ਹੈ ਅਤੇ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਵਾਪਸ ਆਉਣ ਦਾ ਇਰਾਦਾ ਹੈ — ਅਤੇ ਜਦੋਂ ਇਹ ਵਾਪਸ ਆਉਣਗੀਆਂ, ਇਹ ਇਸ ਖੁਲਾਸੇ ਅਤੇ ਪਹਿਲੀ ਵਰਤੋਂ ਤੋਂ ਪਹਿਲਾਂ ਇੱਕ ਪ੍ਰੋਂਪਟ ਨਾਲ ਵਾਪਸ ਆਉਣਗੀਆਂ। ਜੋ ਉਸ ਵੇਲੇ ਭੇਜਿਆ ਜਾਵੇਗਾ ਉਹ ਤੁਹਾਡਾ ਨਤੀਜਾ ਪੈਦਾ ਕਰਨ ਲਈ ਭੇਜਿਆ ਜਾਂਦਾ ਹੈ, ਕਿਸੇ ਚੀਜ਼ ਨੂੰ ਸਿਖਲਾਈ ਦੇਣ ਲਈ ਨਹੀਂ; ਸਾਡੇ ਸਰਵਰਾਂ ਉੱਤੇ ਕੋਈ ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ ਜਾਂ ਅਨੁਵਾਦ ਸਟੋਰ ਨਹੀਂ ਹੁੰਦਾ।

ਵਿਕੀਪੀਡੀਆ ਖੋਜ ਦਾ ਕੋਈ ਸਵਿੱਚ ਨਹੀਂ ਹੈ ਕਿਉਂਕਿ ਬੰਦ ਕਰਨ ਲਈ ਕੁਝ ਵੀ ਖੜ੍ਹਾ ਨਹੀਂ ਹੈ: ਇਹ ਟੈਪ ਉੱਤੇ ਹੀ ਚੱਲਦਾ ਹੈ ਨਹੀਂ ਤਾਂ ਨਹੀਂ। ਵਿਕੀਪੀਡੀਆ ਉਹ ਇੱਕ ਨਾਮ ਅਤੇ ਤੁਹਾਡਾ IP ਪਤਾ ਪ੍ਰਾਪਤ ਕਰਦਾ ਹੈ, ਜਿਵੇਂ ਤੁਸੀਂ ਇਸਨੂੰ ਆਪਣੇ ਖੋਜ ਬਾਕਸ ਵਿੱਚ ਟਾਈਪ ਕੀਤਾ ਹੋਵੇ — ਕੋਈ ਖਾਤਾ ਨਹੀਂ, ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ, ਕੋਈ ਗੱਲਬਾਤ ਨਹੀਂ। ਜੋ ਵਾਪਸ ਆਉਂਦਾ ਹੈ ਉਹ ਦਿਖਾਇਆ ਜਾਂਦਾ ਹੈ ਅਤੇ ਸੁਰੱਖਿਅਤ ਨਹੀਂ ਕੀਤਾ ਜਾਂਦਾ, ਅਤੇ ਇਸ ਬਾਰੇ ਕੁਝ ਵੀ ਗੱਲਬਾਤ ਵਿੱਚ ਨਹੀਂ ਲਿਖਿਆ ਜਾਂਦਾ।

Cloudflare Realtime ਦਾ ਵੀ ਕੋਈ ਸਵਿੱਚ ਨਹੀਂ ਹੈ। ਜ਼ਿਆਦਾਤਰ ਕਾਲਾਂ ਨੂੰ ਇਸਦੀ ਲੋੜ ਨਹੀਂ ਹੁੰਦੀ: ਦੋ ਡਿਵਾਈਸ ਜੋ ਸਿੱਧੇ ਇੱਕ ਦੂਜੇ ਤੱਕ ਪਹੁੰਚ ਸਕਦੇ ਹਨ — ਇੱਕੋ ਨੈੱਟਵਰਕ 'ਤੇ ਜ਼ਿਆਦਾਤਰ ਕਾਲਾਂ — ਇਸ ਤੋਂ ਬਿਨਾਂ ਹੀ ਜੁੜ ਜਾਂਦੇ ਹਨ, ਅਤੇ ਕੁਝ ਵੀ ਰੀਲੇ ਨਹੀਂ ਹੁੰਦਾ। ਜਦੋਂ ਉਹ ਨਹੀਂ ਪਹੁੰਚ ਸਕਦੇ — ਆਮ ਤੌਰ 'ਤੇ ਕਿਉਂਕਿ ਤੁਸੀਂ ਦੋਵੇਂ ਵੱਖ-ਵੱਖ ਮੋਬਾਈਲ ਨੈੱਟਵਰਕਾਂ 'ਤੇ ਹੋ — ਪਹਿਲਾਂ ਤੋਂ ਹੀ ਇਨਕ੍ਰਿਪਟ ਕੀਤੀ ਕਾਲ ਨੂੰ ਜੁੜਨ ਤੋਂ ਅਸਮਰੱਥ ਰਹਿਣ ਦੀ ਬਜਾਏ ਰੀਲੇ ਕੀਤਾ ਜਾਂਦਾ ਹੈ। Cloudflare ਜੋ ਦੇਖਦਾ ਹੈ ਉਹ ਹਨ ਦੋਵਾਂ ਦੇ IP ਪਤੇ, ਕਾਲ ਦਾ ਸਮਾਂ, ਅਤੇ ਲਗਭਗ ਕਿੰਨਾ ਡਾਟਾ ਹਿੱਲਿਆ; ਆਡੀਓ ਅਤੇ ਵੀਡੀਓ ਸੈਕਸ਼ਨ 2 ਵਿੱਚ ਦੱਸੇ ਗਏ ਉਸੇ DTLS-SRTP ਇਨਕ੍ਰਿਪਸ਼ਨ ਅਧੀਨ ਹੀ ਰਹਿੰਦੇ ਹਨ, ਇਸ ਲਈ ਰੀਲੇ ਕਰਨ ਨਾਲ ਉਹ ਡੀਕ੍ਰਿਪਟ ਨਹੀਂ ਹੁੰਦੇ।

ਅਸੀਂ ਜੋ ਰੱਖਦੇ ਹਾਂ ਉਸਨੂੰ ਪ੍ਰਗਟ ਕਰ ਸਕਦੇ ਹਾਂ ਜੇ ਕਾਨੂੰਨ ਇਸਦੀ ਲੋੜ ਹੈ। ਜੋ ਅਸੀਂ ਰੱਖਦੇ ਹਾਂ ਉਹ ਭਾਗ 2 ਵਿੱਚ ਸੂਚੀ ਹੈ। ਅਸੀਂ ਸੁਨੇਹਾ ਸਮੱਗਰੀ ਪੈਦਾ ਨਹੀਂ ਕਰ ਸਕਦੇ, ਕਿਉਂਕਿ ਅਸੀਂ ਇਸਨੂੰ ਪੜ੍ਹ ਨਹੀਂ ਸਕਦੇ।`,
    },
    {
      title: '7. ਪੁਸ਼ ਸੂਚਨਾਵਾਂ',
      body: `Firebase Cloud Messaging ਸੂਚਨਾਵਾਂ ਪ੍ਰਦਾਨ ਕਰਦਾ ਹੈ। ਤੁਹਾਡਾ ਡਿਵਾਈਸ ਟੋਕਨ ਤੁਹਾਡੇ ਖਾਤੇ ਦੇ ਇੱਕ ਪ੍ਰਾਈਵੇਟ ਹਿੱਸੇ ਵਿੱਚ ਸਟੋਰ ਕੀਤਾ ਜਾਂਦਾ ਹੈ ਜਿਸਨੂੰ ਸਿਰਫ਼ ਤੁਸੀਂ ਹੀ ਪੜ੍ਹ ਸਕਦੇ ਹੋ।

ਸੂਚਨਾਵਾਂ ਵਿੱਚ ਕੋਈ ਸੁਨੇਹਾ ਟੈਕਸਟ ਨਹੀਂ ਹੁੰਦਾ। ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਸਥਾਨਕ ਤੌਰ ਉੱਤੇ ਸੁਨੇਹੇ ਨੂੰ ਡੀਕ੍ਰਿਪਟ ਕਰਦੀ ਹੈ ਅਤੇ ਜੋ ਤੁਸੀਂ ਦੇਖਦੇ ਹੋ ਉਸਨੂੰ ਰਚਦੀ ਹੈ; Google ਲਿਫਾਫਾ ਪ੍ਰਦਾਨ ਕਰਦਾ ਹੈ, ਸਮੱਗਰੀ ਨਹੀਂ।`,
    },
    {
      title: '8. ਤੁਸੀਂ ਕੀ ਕਰ ਸਕਦੇ ਹੋ',
      body: `• ਪ੍ਰੋਫਾਈਲ ਸਕ੍ਰੀਨ ਤੋਂ ਆਪਣਾ ਖਾਤਾ ਮਿਟਾਓ। ਗੱਲਬਾਤ ਦਾ ਸਾਂਝਾ ਹਿੱਸਾ ਸਮੱਗਰੀ — ਉਦਾਹਰਨ ਲਈ, ਇੱਕ ਕਾਲ ਰਿਕਾਰਡ — ਦੂਜੇ ਭਾਗੀਦਾਰ ਨਾਲ ਰਹਿੰਦੀ ਹੈ, ਕਿਉਂਕਿ ਇਹ ਉਹਨਾਂ ਦਾ ਰਿਕਾਰਡ ਵੀ ਹੈ।
• ਪ੍ਰੋਫਾਈਲ ਸਕ੍ਰੀਨ ਤੋਂ ਆਪਣਾ ਡਾਟਾ ਐਕਸਪੋਰਟ ਕਰੋ।
• ਹਰੇਕ ਚੈਟ ਲਈ ਸੁਨੇਹੇ ਸਮਾਪਤ ਹੋਣ ਲਈ ਸੈੱਟ ਕਰੋ: 1 ਘੰਟਾ, 24 ਘੰਟੇ, 7 ਦਿਨ ਜਾਂ 30 ਦਿਨ।
• ਟਾਈਪਿੰਗ ਸੂਚਕ ਅਤੇ ਪੜ੍ਹਨ ਦੀਆਂ ਰਸੀਦਾਂ ਚਾਲੂ ਜਾਂ ਬੰਦ ਕਰੋ। ਦੋਵੇਂ ਡਿਫਾਲਟ ਰੂਪ ਵਿੱਚ ਬੰਦ ਹਨ।
• PIN ਜਾਂ ਬਾਇਓਮੈਟ੍ਰਿਕਸ ਨਾਲ ਐਪ ਨੂੰ ਲਾਕ ਕਰੋ।
• ਸੱਦਾ ਲਿੰਕ ਵਾਪਸ ਲਓ ਜੋ ਤੁਸੀਂ ਦਿੱਤਾ ਹੈ।

ਜੇ ਤੁਸੀਂ ਚਾਹੁੰਦੇ ਹੋ ਕਿ ਅਸੀਂ ਹੱਥੀਂ ਕੁਝ ਮਿਟਾਈਏ, ਸਾਨੂੰ ਲਿਖੋ।`,
    },
    {
      title: '9. ਧਾਰਨ',
      body: `ਅਸੀਂ ਤੁਹਾਡਾ ਡਾਟਾ ਉਦੋਂ ਤੱਕ ਰੱਖਦੇ ਹਾਂ ਜਦੋਂ ਤੱਕ ਤੁਹਾਡਾ ਖਾਤਾ ਮੌਜੂਦ ਹੈ। ਖਾਤਾ ਮਿਟਾਉਣਾ ਇਸਨੂੰ ਮਿਟਾ ਦਿੰਦਾ ਹੈ, ਉੱਪਰ ਦੱਸੀ ਸਾਂਝੇ ਤੌਰ ਉੱਤੇ ਰੱਖੀ ਸਮੱਗਰੀ ਨੂੰ ਛੱਡ ਕੇ। ਪ੍ਰਤੀ-ਚੈਟ ਸਮਾਪਤੀ ਤੁਹਾਡੇ ਸੈੱਟ ਕੀਤੇ ਸਮਾਂ-ਸਾਰਣੀ ਉੱਤੇ ਸੁਨੇਹੇ ਹਟਾਉਂਦੀ ਹੈ।`,
    },
    {
      title: '10. ਸੀਮਾਵਾਂ ਜੋ ਤੁਹਾਨੂੰ ਪਤਾ ਹੋਣੀਆਂ ਚਾਹੀਦੀਆਂ ਹਨ',
      body: `ਅਸੀਂ ਤੁਹਾਨੂੰ ਇਹ ਦੱਸਣਾ ਪਸੰਦ ਕਰਾਂਗੇ ਇਸ ਤੋਂ ਪਹਿਲਾਂ ਕਿ ਤੁਸੀਂ ਇਹਨਾਂ ਨੂੰ ਲੱਭੋ।

• ਕੁੰਜੀਆਂ ਉੱਤੇ ਪਹਿਲੀ ਵਾਰ ਦੇਖੇ ਜਾਣ ਉੱਤੇ ਭਰੋਸਾ ਕੀਤਾ ਜਾਂਦਾ ਹੈ। ਜੇ ਕਿਸੇ ਨੇ ਤੁਹਾਡੇ ਕਦੇ ਸੁਨੇਹਾ ਵਟਾਂਦਰਾ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਕੁੰਜੀ ਬਦਲ ਦਿੱਤੀ, ਗੱਲਬਾਤ ਗਲਤ ਵਿਅਕਤੀ ਨੂੰ ਇਨਕ੍ਰਿਪਟ ਹੋ ਜਾਵੇਗੀ ਅਤੇ ਬਿਲਕੁਲ ਸਧਾਰਨ ਦਿਖਾਈ ਦੇਵੇਗੀ। ਐਪ ਤੁਹਾਨੂੰ ਚੇਤਾਵਨੀ ਦਿੰਦੀ ਹੈ ਜਦੋਂ ਕੁੰਜੀ ਬਾਅਦ ਵਿੱਚ ਬਦਲਦੀ ਹੈ, ਅਤੇ ਇੱਕ ਸੁਰੱਖਿਆ ਨੰਬਰ ਦਿਖਾਉਂਦੀ ਹੈ ਜਿਸਦੀ ਤੁਸੀਂ ਚੈਨਲ ਤੋਂ ਬਾਹਰ ਤੁਲਨਾ ਕਰ ਸਕਦੇ ਹੋ — ਪਰ ਕੁਝ ਵੀ ਤੁਹਾਨੂੰ ਇਸਦੀ ਤੁਲਨਾ ਕਰਨ ਲਈ ਮਜਬੂਰ ਨਹੀਂ ਕਰਦਾ।
• ਇੱਕ ਸਮੇਂ ਵਿੱਚ ਇੱਕ ਡਿਵਾਈਸ। ਤੁਹਾਡਾ ਰਿਕਵਰੀ ਵਾਕੰਸ਼ ਉਹ ਕੁੰਜੀ ਮੁੜ ਪ੍ਰਾਪਤ ਕਰਦਾ ਹੈ ਜੋ ਤੁਹਾਡਾ ਇਤਿਹਾਸ ਖੋਲ੍ਹਦੀ ਹੈ, ਇਸ ਲਈ ਨਵੀਂ ਡਿਵਾਈਸ ਉੱਤੇ ਸਾਈਨ ਇਨ ਕਰਨਾ ਉਹ ਨਹੀਂ ਗੁਆਉਂਦਾ ਜੋ ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਪ੍ਰਾਪਤ ਕਰ ਚੁੱਕੇ ਹੋ। ਫਾਰਵਰਡ-ਸੀਕਰੇਟ ਗੱਲਬਾਤਾਂ ਇੱਕ ਦੂਜੀ ਕੁੰਜੀ ਵਰਤਦੀਆਂ ਹਨ ਜੋ ਕਦੇ ਵੀ ਉਸ ਡਿਵਾਈਸ ਨੂੰ ਨਹੀਂ ਛੱਡਦੀ ਜਿਸਨੇ ਇਸਨੂੰ ਬਣਾਇਆ: ਜੋ ਵੀ ਡਿਵਾਈਸ ਆਖਰੀ ਵਾਰ ਸਾਈਨ ਇਨ ਹੋਈ ਉਹ ਹੈ ਜਿਸ ਤੱਕ ਉਹ ਪਹੁੰਚਦੀਆਂ ਹਨ, ਅਤੇ ਇਸ ਦੌਰਾਨ ਦੂਜੀ ਲਈ ਸੀਲ ਕੀਤੀ ਕੋਈ ਵੀ ਚੀਜ਼ ਤਬਦੀਲ ਨਹੀਂ ਕੀਤੀ ਜਾ ਸਕਦੀ।
• ਇਨਕ੍ਰਿਪਸ਼ਨ ਮੌਜੂਦ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਭੇਜੇ ਸੁਨੇਹੇ ਉਵੇਂ ਹੀ ਰਹਿੰਦੇ ਹਨ। ਪਿਛਾਖੜੀ ਤੌਰ ਉੱਤੇ ਕੁਝ ਵੀ ਤਬਦੀਲ ਨਹੀਂ ਕੀਤਾ ਗਿਆ।
• ਇਸ ਐਪ ਦੀ ਸੁਤੰਤਰ ਤੌਰ ਉੱਤੇ ਸੁਰੱਖਿਆ-ਆਡਿਟ ਨਹੀਂ ਕੀਤੀ ਗਈ ਹੈ।`,
    },
    {
      title: '11. ਬੱਚੇ',
      body: `Chatterbox 13 ਸਾਲ ਤੋਂ ਘੱਟ ਉਮਰ ਦੇ ਬੱਚਿਆਂ ਲਈ ਨਹੀਂ ਹੈ, ਅਤੇ ਅਸੀਂ ਜਾਣਬੁੱਝ ਕੇ ਉਹਨਾਂ ਦੀ ਜਾਣਕਾਰੀ ਇਕੱਠੀ ਨਹੀਂ ਕਰਦੇ। ਜੇ ਤੁਹਾਨੂੰ ਵਿਸ਼ਵਾਸ ਹੈ ਕਿ ਇੱਕ ਬੱਚੇ ਨੇ ਸਾਨੂੰ ਨਿੱਜੀ ਜਾਣਕਾਰੀ ਦਿੱਤੀ ਹੈ, ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ ਅਤੇ ਅਸੀਂ ਇਸਨੂੰ ਮਿਟਾ ਦੇਵਾਂਗੇ।`,
    },
    {
      title: '12. ਬਦਲਾਅ',
      body: `ਅਸੀਂ ਇਸ ਨੀਤੀ ਨੂੰ ਅਪਡੇਟ ਕਰ ਸਕਦੇ ਹਾਂ। ਮਹੱਤਵਪੂਰਨ ਬਦਲਾਅ ਐਪ ਵਿੱਚ ਐਲਾਨੇ ਜਾਣਗੇ, ਅਤੇ ਉੱਪਰ ਦੀ ਤਾਰੀਖ ਹੈ ਜਦੋਂ ਇਹ ਆਖਰੀ ਵਾਰ ਬਦਲੀ ਗਈ।`,
    },
    {
      title: '13. ਸੰਪਰਕ',
      body: `ਇਸ ਨੀਤੀ ਬਾਰੇ ਸਵਾਲ: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. ਐਪ ਦੇ ਨਵੇਂ ਵਰਜਨ ਦੀ ਜਾਂਚ ਕਰਨਾ',
      body: `Google Play ਉਹ ਤਰੀਕਾ ਨਹੀਂ ਹੈ ਜਿਸ ਨਾਲ ਇਹ ਐਪ ਤੁਹਾਡੇ Android ਫੋਨ ਤੱਕ ਪਹੁੰਚਦੀ ਹੈ। ਇਹ ਇਸ ਦੀ ਬਜਾਏ chatterbox.fans ਤੋਂ ਡਾਊਨਲੋਡ ਕੀਤੀ ਜਾਂਦੀ ਹੈ, ਅਤੇ ਜੋ ਸਟੋਰ ਇਸ ਪ੍ਰਕਿਰਿਆ ਵਿੱਚ ਸ਼ਾਮਲ ਨਹੀਂ ਹੈ ਉਹ ਤੁਹਾਡੀ ਤਰਫ਼ੋਂ ਅੱਪਡੇਟਾਂ ਦੀ ਜਾਂਚ ਨਹੀਂ ਕਰ ਸਕਦਾ — ਇਸ ਲਈ ਜੇ ਤੁਸੀਂ ਕਹੋ ਤਾਂ ਇਹ ਐਪ ਖੁਦ ਇਹ ਕਰ ਸਕਦੀ ਹੈ।

"ਹੁਣੇ ਜਾਂਚ ਕਰੋ" 'ਤੇ ਟੈਪ ਕਰਨ ਨਾਲ chatterbox.fans ਨੂੰ ਇੱਕ ਬੇਨਤੀ ਭੇਜੀ ਜਾਂਦੀ ਹੈ ਜੋ ਪੁੱਛਦੀ ਹੈ ਕਿ ਮੌਜੂਦਾ ਵਰਜਨ ਕੀ ਹੈ। ਉਸ ਬੇਨਤੀ ਵਿੱਚ ਸਿਰਫ਼ ਤੁਹਾਡਾ IP ਪਤਾ ਹੁੰਦਾ ਹੈ, ਹੋਰ ਕੁਝ ਨਹੀਂ — ਨਾ ਖਾਤਾ, ਨਾ ਡਿਵਾਈਸ ਪਛਾਣਕਰਤਾ, ਨਾ ਸੁਨੇਹਾ। ਜੋ ਵਾਪਸ ਆਉਂਦਾ ਹੈ ਉਹ ਇੱਕ ਵਰਜਨ ਨੰਬਰ ਹੈ, ਜਿਸਦੀ ਤੁਹਾਡੇ ਫੋਨ 'ਤੇ ਤੁਹਾਡੇ ਚੱਲ ਰਹੇ ਵਰਜਨ ਨਾਲ ਤੁਲਨਾ ਕੀਤੀ ਜਾਂਦੀ ਹੈ; ਕੁਝ ਵੀ ਆਪਣੇ ਆਪ ਡਾਊਨਲੋਡ ਨਹੀਂ ਹੁੰਦਾ, ਅਤੇ ਇਸ ਜਾਂਚ ਬਾਰੇ ਕੁਝ ਵੀ ਗੱਲਬਾਤ ਵਿੱਚ ਨਹੀਂ ਲਿਖਿਆ ਜਾਂਦਾ।

ਇਸਦਾ ਕੋਈ ਸਵਿੱਚ ਨਹੀਂ ਹੈ ਕਿਉਂਕਿ ਬੰਦ ਕਰਨ ਲਈ ਕੁਝ ਹੈ ਹੀ ਨਹੀਂ: ਇਹ ਸਿਰਫ਼ ਟੈਪ ਕਰਨ 'ਤੇ ਚੱਲਦਾ ਹੈ, ਹੋਰ ਕਿਸੇ ਤਰੀਕੇ ਨਾਲ ਨਹੀਂ।

ਜੇ ਤੁਸੀਂ ਅੱਪਡੇਟ ਇੰਸਟਾਲ ਕਰਦੇ ਹੋ, ਤਾਂ ਇਹ ਉਸੇ ਸਾਈਨਿੰਗ ਕੁੰਜੀ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਐਪ ਨੂੰ ਉਸੇ ਥਾਂ 'ਤੇ ਬਦਲ ਦਿੰਦਾ ਹੈ, ਬਿਲਕੁਲ ਜਿਵੇਂ Google Play ਤੋਂ ਆਇਆ ਅੱਪਡੇਟ ਕਰੇਗਾ।`,
    },
  ],

  ne: [
    {
      title: '0. छोटकरीमा',
      body: `तपाईंको सन्देशहरूको पाठ तपाईंको यन्त्रमा इन्क्रिप्ट गरिएको छ र तपाईंले पठाउनुभएका मानिसहरूले मात्र यसलाई पढ्न सक्छन्। हामी यसलाई पढ्न सक्दैनौं, र हामीले भाडामा लिएका सर्भरहरूका मालिक Google ले पनि पढ्न सक्दैन।

हामीले देख्न सक्ने कुरा भनेको कुराकानी भएको हो: कुन खाताहरू त्यसमा छन्, र तिनीहरू कहिले सक्रिय थिए। त्यो हटाउनु सामग्री इन्क्रिप्ट गर्नुभन्दा गाह्रो छ, र हामीले अझै पूरा गरेका छैनौं। यो नीतिले हाल रेखा ठ्याक्कै कहाँ छ भनेर बताउँछ।`,
    },
    {
      title: '1. एन्ड-टु-एन्ड इन्क्रिप्टेड के हो',
      body: `तपाईंको यन्त्रमा इन्क्रिप्ट गरिएको, हामी र Google ले पढ्न नसक्ने:

• तपाईंको सन्देशहरूको पाठ।
• तपाईंले संलग्न गर्नुभएका फाइल, फोटो, अडियो र भिडियोको सामग्री।
• लिङ्क पूर्वावलोकनहरू।
• आवाज र भिडियो कलहरू, जसले दुई यन्त्रहरू बीच WebRTC को अनिवार्य DTLS-SRTP प्रयोग गर्छ।

धेरैजसो एक-देखि-एक र समूह सन्देशहरूले थप ratchet पनि प्रयोग गर्छन्, अर्थात् प्रत्येक सन्देशको आफ्नै कुञ्जी हुन्छ, त्यसैले तपाईंको यन्त्र सम्झौता हुनुले पहिलेका सन्देशहरू उजागर गर्दैन। कसैको क्लाइन्टले नयाँ कुञ्जी सामग्री प्रकाशित नगरेको कुराकानीहरू त्यो विशेषता नभएको एकल दीर्घकालीन कुञ्जीमा फर्किन्छन्। सन्देश मुनिको लेबलले तपाईंलाई यसले वास्तवमा के पायो भन्ने बताउँछ।

यो रेखा पार गर्ने एउटै कुरा, र तपाईंले सोध्दा मात्र: विकिपिडियामा नाम खोज्नुले त्यो सन्देश होइन जुन यो आयो, त्यो एउटा नाम मात्र पठाउँछ। खण्ड ६ ले यसलाई को प्राप्त गर्छ भनेर बताउँछ, र खोज ट्यापमा मात्र चल्छ अन्यथा होइन, त्यसैले बन्द गर्न केही उभिएको छैन। सारांश, अनुवाद र ट्रान्सक्रिप्सनले पनि यसलाई पार गर्नेछ — तिनीहरू यो संस्करणमा बन्द छन्, एपमा कतै तिनीहरूलाई खोल्ने नियन्त्रण छैन।`,
    },
    {
      title: '2. के इन्क्रिप्ट गरिएको छैन, र हामी के देख्न सक्छौं',
      body: `इन्क्रिप्सनले सामग्रीको सुरक्षा गर्छ, कुराकानी भएको तथ्यको होइन। यी हाम्रो सर्भरहरूमा स्पष्ट रूपमा बस्छन्:

• प्रत्येक कुराकानीमा को छ, र यो कहिले सिर्जना गरियो र अन्तिम पटक सक्रिय थियो।
• प्रत्येक सन्देशको टाइमस्ट्याम्प, र तपाईंले कति पढ्नुभएको छैन।
• संलग्नकको फाइल नाम, प्रकार र आकार। बाइटहरू इन्क्रिप्ट गरिएका छन्; तिनीहरूको विवरण छैन, र सिफरटेक्स्टको लम्बाइले मूलको लम्बाइलाई सीमित गर्छ।
• तपाईंका साथीहरू र मित्रता अनुरोधहरू।
• कल सिग्नलिङ — कल गरिएको थियो, कसलाई, र कहिले। यसको अडियो वा भिडियो होइन।

तपाईंले तिनीहरूलाई खोल्नुभएसम्म टाइपिङ सूचकहरू र पढेको रसिदहरू बन्द छन्, र बन्द हुँदा केही लेखिँदैन।

अब यहाँ के छैन: तपाईंको इमेल ठेगाना र नाम। सेप्टेम्बर २०२६ देखि खाता रेकर्डमा खाता पहिचायक मात्र छ — र त्यसदेखि जहाँ पनि राख्नको लागि ठेगाना छैन। साइन अपले तपाईंको बारेमा केही सोध्दैन: तपाईंको खाता २४-शब्द पुनःप्राप्ति वाक्यांश हो, र Firebase Authentication ले जाँच गर्ने प्रमाणपत्र यसबाट लिइएको हो। यसले भण्डारण गर्ने कुरा मेल प्राप्त गर्न नसक्ने डोमेन अन्तर्गत एउटा अनियमित लेबल मात्र हो।

अलग रूपमा: किनभने एप Google Firebase मा चल्छ, Google ले तपाईंको यन्त्रले यसमा गरेको प्रत्येक जडानको IP ठेगाना र समय देख्न सक्छ। त्यो होस्टिङको विशेषता हो, एपको होइन, र हामी यसलाई इन्क्रिप्ट गरेर हटाउन सक्दैनौं।`,
    },
    {
      title: '3. मानिसहरूले तपाईंलाई कसरी भेट्टाउँछन्',
      body: `तिनीहरूले तपाईंलाई खोज्न सक्दैनन्। कुनै डाइरेक्टरी छैन — इमेल, फोन नम्बर वा नामद्वारा खोज छैन — र सर्भरले त्यसो गर्न खोज्ने कुनै पनि प्रश्नलाई अस्वीकार गर्छ।

तपाईं पहिले नै प्रयोग गरिरहेको जुनसुकै माध्यमबाट च्यानल बाहिर आमन्त्रण लिङ्क पठाएर कसैसम्म पुग्नुहुन्छ। एउटा लिङ्क एकपटक काम गर्छ, २४ घण्टापछि म्याद सकिन्छ, र फिर्ता लिन सकिन्छ। तपाईंले कसैलाई जे भन्नुहुन्छ त्यो उनीहरूका लागि तपाईंको आफ्नै लेबल हो, तपाईंको लागि राखिएको; यदि उनीहरूले आफूलाई परिचय गराए भने, त्यो नाम तपाईंसम्म इन्क्रिप्टेड रूपमा पुग्यो।`,
    },
    {
      title: '4. हामी के सङ्कलन गर्छौं',
      body: `• खाता डेटा: एउटा खाता पहिचायक, र तपाईंको पुनःप्राप्ति वाक्यांशबाट लिइएको प्रमाणपत्र, Firebase Authentication मा राखिएको। कुनै इमेल ठेगाना छैन, कुनै फोन नम्बर छैन, कुनै नाम छैन — साइन अपले यीमध्ये कुनै पनि सोध्दैन।
• सन्देश र संलग्नक सिफरटेक्स्ट, खण्ड २ मा भएको मेटाडेटासहित।

त्यो नै पूरा सूची हो। कुनै विश्लेषण छैन र कुनै क्र्यास रिपोर्टिङ छैन। एपले पहिले Firebase Analytics लाई स्क्रिन दृश्यहरू र Firebase Crashlytics लाई क्र्यास रिपोर्टहरू पठाउँथ्यो, दुवैले तपाईंको खाता पहिचायक बोकेको थियो, त्यसैले कुनै पनि गुमनाम थिएन; दुवै अब तिनीहरूलाई पठाएका लाइब्रेरीहरूसँगै गइसकेका छन्। त्रुटिहरू विकासको क्रममा डेभलपरको आफ्नै मेसिनमा मात्र छापिन्छन् र अरू कतै जाँदैनन्।`,
    },
    {
      title: '5. यो कहाँ भण्डारण गरिएको छ',
      body: `Google Firebase मा — Firestore, Storage र Authentication — सुरक्षा नियमहरू अन्तर्गत जसले प्रत्येक कागजात कसले पढ्न र लेख्न सक्छ भनेर निर्णय गर्छ।

तपाईंको यन्त्रमा, क्यास गरिएका सन्देशहरू, सेटिङहरू, र तपाईंको एप-लक PIN सामान्य एप भण्डारणको सट्टा प्लेटफर्म किस्टोर (iOS Keychain, Android Keystore) मा राखिएको प्रति-यन्त्र कुञ्जीले इन्क्रिप्ट गरिएका छन्।

तपाईंको सन्देशहरू डिक्रिप्ट गर्ने निजी कुञ्जी तपाईंले लेख्न रोज्नुभएको पुनःप्राप्ति वाक्यांशको रूपमा बाहेक तपाईंको यन्त्रबाट कहिल्यै बाहिर जाँदैन। हामी यसलाई राख्दैनौं र तपाईंको लागि यसलाई फिर्ता ल्याउन सक्दैनौं। यो हराएमा, त्यो यन्त्रमा पठाइएका सन्देशहरू फेरि पढ्न सकिँदैन — हामीलगायत कसैले पनि।`,
    },
    {
      title: '6. अरू कसले डेटा प्राप्त गर्छ',
      body: `हामी तपाईंको व्यक्तिगत जानकारी बेच्दैनौं, व्यापार गर्दैनौं, वा भाडामा दिँदैनौं। डेटा यहाँ पुग्छ:

• Google Firebase — माथि वर्णन गरिए अनुसार, हाम्रो होस्टिङ प्रदायक।
• Cloudflare Realtime — कलको अडियो र भिडियो, जब तपाईंको डिभाइस र अर्को व्यक्तिको डिभाइस सिधै एकअर्कासम्म पुग्न सक्दैनन्।
• विकिमिडिया प्रतिष्ठान — विकिपिडियामा खोज्न ट्याप गर्दा एउटा नाम।
• Google Cloud Speech-to-Text — तपाईंले ट्रान्सक्रिप्ट अनुरोध गर्दा एउटा आवाज सन्देशको अडियो।
• Google Cloud Translation — तपाईंले अनुवाद अनुरोध गर्दा एउटा सन्देशको पाठ।
• Cloudflare Workers AI — तपाईंले सारांश अनुरोध गर्दा वा यसको बारेमा प्रश्न सोध्दा एउटा कुराकानीको अन्तिम ५० सन्देशसम्म।

अन्तिम तीन यो संस्करणमा बन्द छन्। ट्रान्सक्रिप्सन, अनुवाद वा सारांशहरू खोल्ने एपमा कतै कुनै नियन्त्रण छैन, त्यसैले ती तीन सेवाहरूमा केही पुग्दैन। तिनीहरू हटाइनुको सट्टा सूचीबद्ध गरिएका छन् किनभने कोड अझै यहाँ छ र सुविधाहरू फर्कने उद्देश्य छ — र जब तिनीहरू फर्कन्छन्, तिनीहरू यो खुलासा र पहिलो प्रयोग अघि सूचनासहित फर्कन्छन्। त्यतिबेला के पठाइनेछ त्यो तपाईंको नतिजा उत्पादन गर्न पठाइन्छ, केही तालिम दिन होइन; हाम्रो सर्भरमा कुनै ट्रान्सक्रिप्ट वा अनुवाद भण्डारण गरिँदैन।

विकिपिडिया खोजमा स्विच छैन किनभने बन्द गर्न केही उभिएको छैन: यो ट्यापमा मात्र चल्छ अन्यथा होइन। विकिपिडियाले त्यो एउटा नाम र तपाईंको IP ठेगाना पाउँछ, जस्तै तपाईंले यसलाई आफैं तिनीहरूको खोज बक्समा टाइप गर्नुभएको भए — कुनै खाता छैन, कुनै सन्देश छैन, कुनै कुराकानी छैन। फर्केर आउने कुरा देखाइन्छ र भण्डारण गरिँदैन, र यसको बारेमा केही पनि कुराकानीमा लेखिँदैन।

Cloudflare Realtime को पनि कुनै स्विच छैन। धेरैजसो कलहरूलाई यो आवश्यक पर्दैन: सिधै एकअर्कासम्म पुग्न सक्ने दुई डिभाइस—एउटै नेटवर्कमा भएका धेरैजसो कलहरू—यो बिना नै जोडिन्छन्, र केही पनि रिले हुँदैन। जब तिनीहरू पुग्न सक्दैनन्—प्रायः तपाईं दुवै फरक-फरक मोबाइल नेटवर्कमा हुनुहुन्छ भन्दा—पहिले नै एन्क्रिप्ट गरिएको कल जडान हुन नसकी रहनुको सट्टा रिले गरिन्छ। Cloudflare ले देख्ने कुरा दुवैको IP ठेगाना, कलको समय, र लगभग कति डेटा सारियो भन्ने हो; अडियो र भिडियो खण्ड २ मा वर्णन गरिएको उही DTLS-SRTP एन्क्रिप्सनमुनि नै रहन्छन्, त्यसैले रिले गर्नाले तिनीहरूलाई डिक्रिप्ट गर्दैन।

कानूनले आवश्यक भएमा हामीले राखेको कुरा प्रकट गर्न सक्छौं। हामीले राखेको कुरा खण्ड २ मा भएको सूची हो। हामी सन्देश सामग्री उत्पादन गर्न सक्दैनौं, किनभने हामी यसलाई पढ्न सक्दैनौं।`,
    },
    {
      title: '7. पुश सूचनाहरू',
      body: `Firebase Cloud Messaging ले सूचनाहरू डेलिभर गर्छ। तपाईंको यन्त्र टोकन तपाईंको खाताको निजी भागमा भण्डारण गरिन्छ जुन तपाईंले मात्र पढ्न सक्नुहुन्छ।

सूचनाहरूमा सन्देशको पाठ हुँदैन। तपाईंको यन्त्रले स्थानीय रूपमा सन्देश डिक्रिप्ट गर्छ र तपाईंले देख्नुहुने कुरा बनाउँछ; Google ले सामग्री होइन, खाम डेलिभर गर्छ।`,
    },
    {
      title: '8. तपाईं के गर्न सक्नुहुन्छ',
      body: `• प्रोफाइल स्क्रिनबाट तपाईंको खाता मेटाउनुहोस्। कुराकानीको संयुक्त भाग भएको सामग्री — उदाहरणका लागि, कल रेकर्ड — अर्को सहभागीसँग रहन्छ, किनभने यो उनीहरूको पनि रेकर्ड हो।
• प्रोफाइल स्क्रिनबाट तपाईंको डेटा निर्यात गर्नुहोस्।
• प्रति च्याट सन्देशहरू म्याद सकिने सेट गर्नुहोस्: १ घण्टा, २४ घण्टा, ७ दिन वा ३० दिन।
• टाइपिङ सूचकहरू र पढेको रसिदहरू अन र बन्द गर्नुहोस्। दुवै पूर्वनिर्धारित रूपमा बन्द छन्।
• PIN वा बायोमेट्रिक्ससँग एप लक गर्नुहोस्।
• तपाईंले दिनुभएको आमन्त्रण लिङ्क फिर्ता लिनुहोस्।

यदि तपाईं चाहनुहुन्छ कि हामीले हातैले केही मेटाउनुपर्छ भने, हामीलाई लेख्नुहोस्।`,
    },
    {
      title: '9. प्रतिधारण',
      body: `तपाईंको खाता अस्तित्वमा रहेसम्म हामी तपाईंको डेटा राख्छौं। खाता मेटाउनुले माथि उल्लेख गरिएको संयुक्त रूपमा राखिएको सामग्री बाहेक यसलाई मेटाउँछ। प्रति-च्याट म्याद समाप्तिले तपाईंले सेट गर्नुभएको तालिकामा सन्देशहरू हटाउँछ।`,
    },
    {
      title: '10. तपाईंले जान्नुपर्ने सीमाहरू',
      body: `हामी तपाईंलाई यी कुराहरू फेला पार्नुभन्दा बताउन रुचाउँछौं।

• कुञ्जीहरू पहिलो पटक देखिँदा विश्वास गरिन्छ। यदि तपाईंले कहिल्यै सन्देश आदानप्रदान गर्नुअघि कसैले कुञ्जी प्रतिस्थापन गरेको थियो भने, कुराकानी गलत व्यक्तिलाई इन्क्रिप्ट हुनेछ र पूर्णतया सामान्य देखिनेछ। एपले कुञ्जी पछि परिवर्तन हुँदा तपाईंलाई चेतावनी दिन्छ, र तपाईंले च्यानल बाहिर तुलना गर्न सक्ने सुरक्षा नम्बर देखाउँछ — तर केहीले पनि तपाईंलाई यसलाई तुलना गर्न बाध्य पार्दैन।
• एक पटकमा एउटा यन्त्र। तपाईंको पुनःप्राप्ति वाक्यांशले तपाईंको इतिहास खोल्ने कुञ्जी पुनःस्थापित गर्छ, त्यसैले नयाँ यन्त्रमा साइन इन गर्नुले तपाईंले पहिले नै प्राप्त गर्नुभएको कुरा गुमाउँदैन। फर्वार्ड-सिक्रेट कुराकानीहरूले दोस्रो कुञ्जी प्रयोग गर्छन् जुन यसलाई सिर्जना गर्ने यन्त्रबाट कहिल्यै बाहिर जाँदैन: जुनसुकै यन्त्र अन्तिम पटक साइन इन भयो त्यो नै तिनीहरूले पुग्ने हो, र त्यस बीचमा अर्कोमा सील गरिएको कुनै पनि कुरा त्यहाँ सार्न सकिँदैन।
• इन्क्रिप्सन अस्तित्वमा आउनुअघि पठाइएका सन्देशहरू उस्तै रहन्छन्। कुनै पनि कुरा पूर्वव्यापी रूपमा रूपान्तरण गरिएको छैन।
• यो एप स्वतन्त्र रूपमा सुरक्षा-लेखापरीक्षण गरिएको छैन।`,
    },
    {
      title: '11. बालबालिका',
      body: `Chatterbox १३ वर्षभन्दा कम उमेरका बालबालिकाका लागि होइन, र हामी जानाजानी तिनीहरूको जानकारी सङ्कलन गर्दैनौं। यदि तपाईंलाई विश्वास छ कि कुनै बालकले हामीलाई व्यक्तिगत जानकारी दिएको छ भने, हामीलाई सम्पर्क गर्नुहोस् र हामी यसलाई मेटाउनेछौं।`,
    },
    {
      title: '12. परिवर्तनहरू',
      body: `हामी यो नीति अद्यावधिक गर्न सक्छौं। महत्त्वपूर्ण परिवर्तनहरू एपमा घोषणा गरिनेछ, र माथिको मिति यो अन्तिम पटक कहिले परिवर्तन भयो भन्ने हो।`,
    },
    {
      title: '13. सम्पर्क',
      body: `यो नीतिको बारेमा प्रश्नहरू: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. नयाँ एप संस्करण जाँच गर्दै',
      body: `Google Play यो एप तपाईंको Android फोनमा आइपुग्ने तरिका होइन। यो सट्टामा chatterbox.fans बाट डाउनलोड गरिन्छ, र यस प्रक्रियामा सामेल नभएको पसलले तपाईंको तर्फबाट अद्यावधिकहरू जाँच गर्न सक्दैन — त्यसैले तपाईंले सोध्नुभयो भने यो एपले आफैं यो गर्न सक्छ।

"अहिले जाँच गर्नुहोस्" मा ट्याप गर्दा हालको संस्करण के हो भनेर सोध्दै chatterbox.fans मा एउटा अनुरोध पठाइन्छ। त्यो अनुरोधमा तपाईंको IP ठेगाना मात्र हुन्छ, अरू केही होइन — कुनै खाता होइन, कुनै उपकरण पहिचायक होइन, कुनै सन्देश होइन। फर्कने कुरा एउटा संस्करण नम्बर हो, जुन तपाईंको फोनमा तपाईंले चलाइरहनुभएको संस्करणसँग तुलना गरिन्छ; केही पनि स्वचालित रूपमा डाउनलोड हुँदैन, र यस जाँचको बारेमा केही पनि कुराकानीमा लेखिँदैन।

यसको कुनै स्विच छैन किनभने बन्द गर्नको लागि केही छैन: यो ट्याप गर्दा मात्र चल्छ, अरू कुनै तरिकाले होइन।

तपाईंले अद्यावधिक स्थापना गर्नुभयो भने, यसले उही साइनिङ कुञ्जी प्रयोग गरेर एपलाई त्यसको ठाउँमा बदल्छ, ठ्याक्कै Google Play बाटको अद्यावधिकले गर्ने गरे जस्तै।`,
    },
  ],

  si: [
    {
      title: '0. සැකෙවින්',
      body: `ඔබේ පණිවිඩවල පෙළ ඔබේ උපාංගයේ සංකේතාංකනය කර ඇති අතර, ඔබ එය යවන පුද්ගලයන්ට පමණක් එය කියවිය හැක. අපට එය කියවිය නොහැක, අප සේවාදායක කුලියට ගන්නා Google ට ද එසේම ය.

අපට දැකිය හැක්කේ සංවාදයක් සිදු වූ බවයි: ඒ තුළ ඇති ගිණුම් මොනවාද, ඒවා ක්‍රියාකාරී වූයේ කවදාද යන්නයි. එය ඉවත් කිරීම අන්තර්ගතය සංකේතාංකනය කිරීමට වඩා අපහසුය, අප තවම එය අවසන් කර නොමැත. මෙම ප්‍රතිපත්තිය දැන් එම මායිම ඇත්තේ කොතැනද යන්න හරියටම කියයි.`,
    },
    {
      title: '1. අන්තයේ සිට අන්තය දක්වා සංකේතාංකනය කර ඇත්තේ කුමක්ද',
      body: `ඔබේ උපාංගයේ සංකේතාංකනය කර ඇති, අපටත් Google ටත් කියවිය නොහැකි:

• ඔබේ පණිවිඩවල පෙළ.
• ඔබ අමුණන ගොනු, ඡායාරූප, ශ්‍රව්‍ය සහ වීඩියෝවල අන්තර්ගතය.
• සබැඳි පෙරදසුන්.
• උපාංග දෙක අතර WebRTC හි අනිවාර්ය DTLS-SRTP භාවිතා කරන හඬ සහ වීඩියෝ ඇමතුම්.

බොහෝ එකින් එක සහ සමූහ පණිවිඩ අමතරව ratchet එකක් ද භාවිතා කරයි, එනම් සෑම පණිවිඩයකටම එහිම යතුරක් ඇති අතර, එබැවින් ඔබේ උපාංගය හානියට පත් වීම පෙර පණිවිඩ හෙළි නොකරයි. කෙනෙකුගේ සේවාදායකයා නව යතුරු ද්‍රව්‍ය ප්‍රකාශයට පත් නොකළ සංවාද එම ගුණාංගය නොමැති තනි දිගු කාලීන යතුරකට ආපසු යයි. පණිවිඩයක් යටතේ ඇති ලේබලය එය ලද්දේ කුමක්දැයි ඔබට කියයි.

මෙම මායිම තරණය කරන එකම දෙය, ඔබ එය ඉල්ලා සිටින විට පමණි: විකිපීඩියාවේ නමක් සෙවීම එම නම පමණක් යවයි, එය පැමිණි පණිවිඩය නොවේ. කොටස 6 එය ලබන්නේ කවුරුන්දැයි කියයි, සෙවීම ක්‍රියාත්මක වන්නේ තට්ටු කිරීමේදී පමණි වෙනත් ආකාරයකින් නොවේ, එබැවින් අක්‍රිය කිරීමට කිසිවක් නොපවතී. සාරාංශ කිරීම, පරිවර්තනය කිරීම සහ පිටපත් කිරීම ද මෙය තරණය කරනු ඇත — ඒවා මෙම නිකුතුවේ අක්‍රිය කර ඇති අතර, ඒවා සක්‍රිය කරන පාලනයක් යෙදුමේ කොහේවත් නොමැත.`,
    },
    {
      title: '2. සංකේතාංකනය කර නොමැත්තේ කුමක්ද, සහ අපට දැකිය හැක්කේ කුමක්ද',
      body: `සංකේතාංකනය අන්තර්ගතය ආරක්ෂා කරයි, සංවාදයක් සිදු වූ බව නොවේ. මේවා අපගේ සේවාදායකවල පැහැදිලිව පවතී:

• සෑම සංවාදයකම සිටින්නේ කවුරුන්ද, එය නිර්මාණය කළේ කවදාද අවසන් වරට ක්‍රියාකාරී වූයේ කවදාද.
• සෑම පණිවිඩයකම කාල මුද්‍රාව, ඔබ නොකියවූ ප්‍රමාණය.
• ඇමුණුමක ගොනු නාමය, වර්ගය සහ ප්‍රමාණය. බයිට් සංකේතාංකනය කර ඇත; ඒවායේ විස්තරය එසේ නොවේ, සයිෆර්ටෙක්ස්ට් හි දිග මුල් පිටපතේ දිග සීමා කරයි.
• ඔබේ මිතුරන් සහ මිත්‍ර ඉල්ලීම්.
• ඇමතුම් සංඥා කිරීම — ඇමතුමක් ලබා දුන් බව, කාට, සහ කවදාද. එහි ශ්‍රව්‍ය හෝ වීඩියෝව නොවේ.

ඔබ ඒවා සක්‍රිය කරන තෙක් ටයිප් කිරීමේ දර්ශක සහ කියවීම් රිසිට්පත් අක්‍රිය ය, අක්‍රිය කර ඇති අතරතුර කිසිවක් ලියනු නොලැබේ.

මින් ඉදිරියට මෙහි නොමැත්තේ: ඔබේ විද්‍යුත් තැපැල් ලිපිනය සහ නම. 2026 සැප්තැම්බර් සිට ගිණුම් වාර්තාවේ ඇත්තේ ගිණුම් හඳුනාගැනීමක් පමණි — එතැන් සිට කොතැනකවත් තබා ගැනීමට ලිපිනයක් නොමැත. ලියාපදිංචි වීම ඔබ ගැන කිසිවක් අසන්නේ නැත: ඔබේ ගිණුම වචන 24ක නැවත ලබාගැනීමේ වාක්‍ය ඛණ්ඩයකි, Firebase Authentication පරීක්ෂා කරන අක්තපත්‍රය ඉන් ලබාගනු ලැබේ. එය ගබඩා කරන්නේ තැපැල් ලබාගත නොහැකි වසමක් යටතේ අහඹු ලේබලයකි.

වෙන වශයෙන්: යෙදුම Google Firebase මත ක්‍රියාත්මක වන බැවින්, ඔබේ උපාංගය එයට කරන සෑම සම්බන්ධතාවයකම IP ලිපිනය සහ වේලාව Google ට දැක ගත හැක. එය සත්කාරකත්වයේ ගුණාංගයකි, යෙදුමේ නොවේ, අපට එය සංකේතාංකනය කර ඉවත් කළ නොහැක.`,
    },
    {
      title: '3. මිනිසුන් ඔබව සොයා ගන්නේ කෙසේද',
      body: `ඔවුන්ට ඔබව සෙවිය නොහැක. නාමාවලියක් නොමැත — විද්‍යුත් තැපෑල, දුරකථන අංකය හෝ නම මගින් සෙවීමක් නොමැත — එසේ උත්සාහ කරන ඕනෑම විමසුමක් සේවාදායකය ප්‍රතික්ෂේප කරයි.

ඔබ දැනටමත් භාවිතා කරන ඕනෑම දෙයක් හරහා නාලිකාවෙන් පිටත ආරාධනා සබැඳියක් යැවීමෙන් ඔබ කෙනෙකුට ළඟා වේ. සබැඳියක් වරක් ක්‍රියා කරයි, පැය 24කට පසු කල් ඉකුත් වේ, ආපසු ගත හැක. ඔබ කෙනෙකුට කුමක් ලෙස හඳුන්වයිද එය ඔවුන් සඳහා ඔබේම ලේබලය වන අතර, ඔබ වෙනුවෙන් තබා ඇත; ඔවුන් තමන්ව හඳුන්වා දුන්නේ නම්, එම නම සංකේතාංකනය කළ ආකාරයෙන් ඔබට ළඟා විය.`,
    },
    {
      title: '4. අප එකතු කරන්නේ කුමක්ද',
      body: `• ගිණුම් දත්ත: ගිණුම් හඳුනාගැනීමක්, සහ Firebase Authentication හි තබා ඇති ඔබේ නැවත ලබාගැනීමේ වාක්‍ය ඛණ්ඩයෙන් ලබාගත් අක්තපත්‍රයක්. විද්‍යුත් තැපැල් ලිපිනයක් නැත, දුරකථන අංකයක් නැත, නමක් නැත — ලියාපදිංචි වීම ඉන් කිසිවක් නොඅසයි.
• පණිවිඩ සහ ඇමුණුම් සයිෆර්ටෙක්ස්ට්, කොටස 2 හි ඇති පශ්චාත් දත්ත සමඟ.

එය සම්පූර්ණ ලැයිස්තුවයි. විශ්ලේෂණයක් නොමැත සහ බිඳවැටීම් වාර්තා කිරීමක් නොමැත. යෙදුම කලින් තිර දර්ශන Firebase Analytics වෙතත් බිඳවැටීම් වාර්තා Firebase Crashlytics වෙතත් යවා ඇති අතර, දෙකම ඔබේ ගිණුම් හඳුනාගැනීම රැගෙන ගිය බැවින්, කිසිවක් නිර්නාමික නොවීය; දෙකම දැන් ඒවා යැවූ පුස්තකාල සමඟ ගොස් ඇත. දෝෂ සංවර්ධකයාගේම යන්ත්‍රයේ සංවර්ධන කාලය තුළ පමණක් මුද්‍රණය වන අතර වෙනත් තැනකට නොයයි.`,
    },
    {
      title: '5. එය ගබඩා කර ඇත්තේ කොහේද',
      body: `Google Firebase මත — Firestore, Storage සහ Authentication — සෑම ලේඛනයක්ම කියවීමට හා ලිවීමට හැක්කේ කාටද යන්න තීරණය කරන ආරක්ෂක නීති යටතේ.

ඔබේ උපාංගයේ, කෑෂ් කළ පණිවිඩ, සැකසුම් සහ ඔබේ යෙදුම් අගුළු PIN සාමාන්‍ය යෙදුම් ගබඩාවට වඩා වේදිකා යතුරු ගබඩාවක (iOS Keychain, Android Keystore) තබා ඇති උපාංග-විශේෂිත යතුරකින් සංකේතාංකනය කර ඇත.

ඔබේ පණිවිඩ විකේතනය කරන පුද්ගලික යතුර ඔබ ලියා තැබීමට තෝරාගන්නා නැවත ලබාගැනීමේ වාක්‍ය ඛණ්ඩය හැර ඔබේ උපාංගය කිසි විටෙකත් හැර නොයයි. අප එය තබා නොගනිමු, ඔබ වෙනුවෙන් එය නැවත ලබා ගත නොහැක. එය නැති වුවහොත්, එම උපාංගයට යවන ලද පණිවිඩ නැවත කියවිය නොහැක — අප ඇතුළුව කිසිවෙකුට වත්.`,
    },
    {
      title: '6. වෙනත් කවුරුන් දත්ත ලබන්නේද',
      body: `අප ඔබේ පුද්ගලික තොරතුරු විකුණන්නේ, හුවමාරු කරන්නේ හෝ කුලියට දෙන්නේ නැත. දත්ත ළඟා වන්නේ:

• Google Firebase — ඉහත විස්තර කර ඇති පරිදි, අපගේ සත්කාරක සපයන්නා.
• Cloudflare Realtime — ඔබේ උපාංගයට සහ අනෙක් පුද්ගලයාගේ උපාංගයට කෙලින්ම එකිනෙකා වෙත ළඟාවිය නොහැකි විට, ඇමතුමේ ශබ්දය සහ දෘශ්‍යය.
• විකිමීඩියා පදනම — ඔබ විකිපීඩියාවේ සෙවීමට තට්ටු කරන විට එක් නමක්.
• Google Cloud Speech-to-Text — ඔබ ලේඛනයක් ඉල්ලා සිටින විට එක් හඬ පණිවිඩයක ශ්‍රව්‍යය.
• Google Cloud Translation — ඔබ පරිවර්තනයක් ඉල්ලා සිටින විට එක් පණිවිඩයක පෙළ.
• Cloudflare Workers AI — ඔබ සාරාංශයක් ඉල්ලා සිටින විට හෝ ඒ ගැන ප්‍රශ්නයක් අසන විට එක් සංවාදයක අවසාන පණිවිඩ 50 දක්වා.

අවසාන තුන මෙම නිකුතුවේ අක්‍රිය කර ඇත. පිටපත් කිරීම, පරිවර්තනය හෝ සාරාංශ සක්‍රිය කරන පාලනයක් යෙදුමේ කොහේවත් නොමැති බැවින්, එම සේවා තුනට කිසිවක් ළඟා නොවේ. කේතය තවමත් මෙහි ඇති අතර ලක්ෂණ ආපසු පැමිණීමට අදහස් කර ඇති බැවින් ඒවා මකා දැමීමට වඩා ලැයිස්තුගත කර ඇත — ඒවා ආපසු පැමිණෙන විට, ඒවා මෙම හෙළිදරව්ව සමඟත් පළමු භාවිතයට පෙර ඉඟියක් සමඟත් ආපසු පැමිණේ. එවිට යවනු ලබන දේ ඔබේ ප්‍රතිඵලය නිෂ්පාදනය කිරීමට යවනු ලැබේ, කිසිවක් පුහුණු කිරීමට නොවේ; ලේඛනයක් හෝ පරිවර්තනයක් අපගේ සේවාදායකවල ගබඩා කර නොමැත.

විකිපීඩියා සෙවීමට ස්විචයක් නොමැත්තේ අක්‍රිය කිරීමට කිසිවක් නොපවතින බැවිනි: එය තට්ටු කිරීමේදී පමණක් ක්‍රියාත්මක වේ වෙනත් ආකාරයකින් නොවේ. විකිපීඩියාව එම එක් නම සහ ඔබේ IP ලිපිනය ලබා ගනී, ඔබ එය ඔවුන්ගේ සෙවුම් පෙට්ටියේ ටයිප් කළාක් මෙනි — ගිණුමක් නැත, පණිවිඩයක් නැත, සංවාදයක් නැත. ආපසු පැමිණෙන දේ පෙන්වන අතර ගබඩා කර නොමැත, එය ගැන කිසිවක් සංවාදයට ලියා නොමැත.

Cloudflare Realtime හටද ස්විචයක් නැත. බොහෝ ඇමතුම්වලට එය අවශ්‍ය නොවේ: කෙලින්ම එකිනෙකා වෙත ළඟාවිය හැකි උපාංග දෙකක්—එකම ජාලයක ඇති බොහෝ ඇමතුම්—එය නොමැතිවම සම්බන්ධ වන අතර, කිසිවක් රිලේ නොවේ. ඔවුන්ට ළඟාවිය නොහැකි විට—සාමාන්‍යයෙන් ඔබ දෙදෙනාම වෙනස් ජංගම ජාල මත සිටින බැවින්—දැනටමත් සංකේතනය කර ඇති ඇමතුම සම්බන්ධ විය නොහැකිව තැබීම වෙනුවට රිලේ කරනු ලැබේ. Cloudflare දකින්නේ දෙපාර්ශ්වයේම IP ලිපින, ඇමතුමේ කාලය, සහ දළ වශයෙන් චලනය වූ දත්ත ප්‍රමාණයයි; ශබ්දය සහ දෘශ්‍යය කොටස 2 හි විස්තර කර ඇති එකම DTLS-SRTP සංකේතනය යටතේම පවතින බැවින්, රිලේ කිරීම ඒවා විසංකේතනය නොකරයි.

නීතිය අවශ්‍ය කරන්නේ නම් අප තබාගෙන ඇති දේ අප හෙළි කළ හැක. අප තබාගෙන ඇත්තේ කොටස 2 හි ලැයිස්තුවයි. අපට පණිවිඩ අන්තර්ගතය නිෂ්පාදනය කළ නොහැක, මන්ද අපට එය කියවිය නොහැකි බැවිනි.`,
    },
    {
      title: '7. තල්ලු දැනුම්දීම්',
      body: `Firebase Cloud Messaging මගින් දැනුම්දීම් ලබා දේ. ඔබේ උපාංග ටෝකනය ඔබට පමණක් කියවිය හැකි ඔබේ ගිණුමේ පුද්ගලික කොටසක ගබඩා කර ඇත.

දැනුම්දීම්වල පණිවිඩ පෙළ නොමැත. ඔබේ උපාංගය දේශීයව පණිවිඩය විකේතනය කර ඔබ දකින දේ සම්පාදනය කරයි; Google අන්තර්ගතය නොව, කවරය ලබා දෙයි.`,
    },
    {
      title: '8. ඔබට කළ හැක්කේ කුමක්ද',
      body: `• පැතිකඩ තිරයෙන් ඔබේ ගිණුම මකන්න. සංවාදයක ඒකාබද්ධ කොටසක් වන අන්තර්ගතය — උදාහරණයක් ලෙස, ඇමතුම් වාර්තාවක් — වෙනත් සහභාගිකයා සමඟ පවතී, මන්ද එය ඔවුන්ගේද වාර්තාවක් වන බැවිනි.
• පැතිකඩ තිරයෙන් ඔබේ දත්ත අපනයනය කරන්න.
• එක් එක් කතාබසය සඳහා පණිවිඩ කල් ඉකුත් වීමට සකසන්න: පැය 1, පැය 24, දින 7 හෝ දින 30.
• ටයිප් කිරීමේ දර්ශක සහ කියවීම් රිසිට්පත් සක්‍රිය හෝ අක්‍රිය කරන්න. දෙකම පෙරනිමියෙන් අක්‍රියයි.
• PIN එකකින් හෝ ජෛවමිතික මගින් යෙදුම අගුළු දමන්න.
• ඔබ දී ඇති ආරාධනා සබැඳියක් ආපසු ගන්න.

ඔබට යමක් අතින් මකා දැමීමට අවශ්‍ය නම්, අපට ලියන්න.`,
    },
    {
      title: '9. රඳවා තබා ගැනීම',
      body: `ඔබේ ගිණුම පවතින තාක් කල් අප ඔබේ දත්ත තබා ගනිමු. ගිණුම මකා දැමීම, ඉහත සඳහන් කළ ඒකාබද්ධව තබාගෙන ඇති අන්තර්ගතය හැර, එය මකා දමයි. එක් එක් කතාබසයකට කල් ඉකුත්වීම ඔබ සකසන කාලසටහන අනුව පණිවිඩ ඉවත් කරයි.`,
    },
    {
      title: '10. ඔබ දැනගත යුතු සීමාවන්',
      body: `ඔබ ඒවා සොයා ගැනීමට වඩා අප ඔබට මේවා පැවසීමට කැමැත්තෙමු.

• යතුරු පළමු වරට දකින විට විශ්වාස කරනු ලැබේ. ඔබ කිසි විටෙකත් පණිවිඩයක් හුවමාරු කර නොගත් විට කවුරුන් හෝ යතුරක් ප්‍රතිස්ථාපනය කර ඇත්නම්, සංවාදය වැරදි පුද්ගලයාට සංකේතාංකනය වන අතර සම්පූර්ණයෙන්ම සාමාන්‍ය ලෙස පෙනෙනු ඇත. යතුර පසුව වෙනස් වන විට යෙදුම ඔබට අනතුරු අඟවන අතර, ඔබට නාලිකාවෙන් පිටත සංසන්දනය කළ හැකි ආරක්ෂක අංකයක් පෙන්වයි — නමුත් එය සංසන්දනය කිරීමට කිසිවක් ඔබට බල නොකරයි.
• එක් වේලාවක එක් උපාංගයක්. ඔබේ නැවත ලබාගැනීමේ වාක්‍ය ඛණ්ඩය ඔබේ ඉතිහාසය විවෘත කරන යතුර ප්‍රතිසාධනය කරයි, එබැවින් නව උපාංගයක පුරනය වීම ඔබ දැනටමත් ලැබූ දේ අහිමි නොකරයි. ඉදිරි-රහස්‍යභාවී සංවාද එය නිර්මාණය කළ උපාංගය කිසි විටෙකත් හැර නොයන දෙවන යතුරක් භාවිතා කරයි: අවසන් වරට පුරනය වූ උපාංගය කුමක් වුවත් ඒවා ළඟා වන්නේ එයටයි, එම කාලය තුළ අනෙකට මුද්‍රා තැබූ ඕනෑම දෙයක් එයට මාරු කළ නොහැක.
• සංකේතාංකනය පැවතීමට පෙර යවන ලද පණිවිඩ එසේම පවතී. කිසිවක් පසුබැවින් පරිවර්තනය කර නොමැත.
• මෙම යෙදුම ස්වාධීනව ආරක්ෂක-විගණනය කර නොමැත.`,
    },
    {
      title: '11. ළමයින්',
      body: `Chatterbox වයස අවුරුදු 13ට අඩු ළමයින් සඳහා අදහස් කර නොමැත, අප දැනුවත්වම ඔවුන්ගේ තොරතුරු එකතු නොකරමු. දරුවෙකු අපට පුද්ගලික තොරතුරු ලබා දී ඇති බව ඔබ විශ්වාස කරන්නේ නම්, අප හා සම්බන්ධ වන්න, අප එය මකා දමන්නෙමු.`,
    },
    {
      title: '12. වෙනස්කම්',
      body: `අප මෙම ප්‍රතිපත්තිය යාවත්කාලීන කළ හැක. සැලකිය යුතු වෙනස්කම් යෙදුමේ නිවේදනය කරනු ලබන අතර, ඉහත දිනය එය අවසන් වරට වෙනස් වූ අවස්ථාවයි.`,
    },
    {
      title: '13. සම්බන්ධතාවය',
      body: `මෙම ප්‍රතිපත්තිය පිළිබඳ ප්‍රශ්න: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. නවතර යෙදුම් අනුවාදයක් සඳහා පරීක්ෂා කිරීම',
      body: `මෙම යෙදුම ඔබේ Android දුරකථනයට ළඟා වන ක්‍රමය Google Play නොවේ. ඒ වෙනුවට එය chatterbox.fans වෙතින් බාගත කෙරේ, තවද මෙම ක්‍රියාවලියට සම්බන්ධ නොවන වෙළඳසැලකට ඔබ වෙනුවෙන් යාවත්කාලීන පරීක්ෂා කළ නොහැක — එබැවින් ඔබ ඉල්ලා සිටියහොත් මෙම යෙදුමට එය තනිවම කළ හැකිය.

"දැන් පරීක්ෂා කරන්න" ස්පර්ශ කිරීමෙන් වත්මන් අනුවාදය කුමක්දැයි විමසමින් chatterbox.fans වෙත එක් ඉල්ලීමක් යවනු ලැබේ. එම ඉල්ලීමේ ඇත්තේ ඔබේ IP ලිපිනය පමණි, වෙන කිසිවක් නැත — ගිණුමක් නැත, උපාංග හඳුනාගැනීමක් නැත, පණිවිඩයක් නැත. ආපසු එන්නේ අනුවාද අංකයකි, එය ඔබේ දුරකථනයේ ඔබ ධාවනය කරන අනුවාදය සමඟ සංසන්දනය කෙරේ; කිසිවක් ස්වයංක්‍රීයව බාගත නොවේ, තවද මෙම පරීක්ෂාව ගැන කිසිවක් සංවාදයට ලියනු නොලැබේ.

මෙයට ස්විචයක් නැත්තේ අක්‍රිය කිරීමට කිසිවක් නොමැති බැවිනි: එය ස්පර්ශ කළ විට පමණක් ක්‍රියාත්මක වන අතර වෙනත් ආකාරයකින් නොවේ.

ඔබ යාවත්කාලීනය ස්ථාපනය කළහොත්, එය එම අත්සන් යතුර භාවිතයෙන් යෙදුම එහි ස්ථානයේම ප්‍රතිස්ථාපනය කරයි, Google Play වෙතින් එන යාවත්කාලීනයක් කරන ආකාරයටම.`,
    },
  ],

  sw: [
    {
      title: '0. Kwa muhtasari',
      body: `Maandishi ya ujumbe wako yamesimbwa kwenye kifaa chako na yanaweza kusomwa tu na watu unaowatumia. Hatuwezi kuyasoma, wala Google, ambaye tunakodisha seva zake, hawezi.

Kile tunachoweza kuona ni kwamba mazungumzo yalifanyika: akaunti zipi ziko humo, na walikuwa hai lini. Kuondoa hilo ni ngumu zaidi kuliko kusimba maudhui, na hatujamaliza bado. Sera hii inasema kwa usahihi mstari huo uko wapi sasa.`,
    },
    {
      title: '1. Ni nini kilichosimbwa mwanzo hadi mwisho',
      body: `Kimesimbwa kwenye kifaa chako, hakiwezi kusomwa na sisi na Google:

• Maandishi ya ujumbe wako.
• Maudhui ya faili, picha, sauti na video unazoambatanisha.
• Muhtasari wa viungo.
• Simu za sauti na video, zinazotumia DTLS-SRTP ya lazima ya WebRTC kati ya vifaa viwili.

Ujumbe mwingi wa mtu-kwa-mtu na wa kikundi pia hutumia ratchet, ikimaanisha kila ujumbe una ufunguo wake mwenyewe, hivyo kuathiriwa kwa kifaa chako hakufichui ujumbe wa awali. Mazungumzo ambapo kifaa cha mtu hakijachapisha nyenzo mpya za ufunguo hurudi kwenye ufunguo mmoja wa muda mrefu, ambao hauna sifa hiyo. Lebo iliyo chini ya ujumbe inakuambia ni ipi hasa iliyopokea.

Jambo moja tu linalovuka mstari huu, na tu unapouliza: kutafuta jina kwenye Wikipedia hutuma jina hilo moja tu, si ujumbe ulikotoka. Sehemu ya 6 inasema ni nani anayelipokea, na utafutaji unaendesha wakati wa kugusa tu si vinginevyo, hivyo hakuna kitu kinachosimama kuzimwa. Kufupisha, kutafsiri na kuandika kwa maneno pia kungevuka hili — vimezimwa katika toleo hili, bila udhibiti wowote popote katika programu unaoviwasha.`,
    },
    {
      title: '2. Ni nini hakijasimbwa, na tunachoweza kuona',
      body: `Usimbaji hulinda maudhui, si ukweli wa mazungumzo. Haya yapo wazi kwenye seva zetu:

• Nani yuko katika kila mazungumzo, na yaliundwa lini na yalikuwa hai mara ya mwisho lini.
• Muhuri wa muda wa kila ujumbe, na ni mingapi ambayo hujaisoma.
• Jina la faili la kiambatisho, aina na ukubwa. Baiti zimesimbwa; maelezo yake hayajasimbwa, na urefu wa maandishi yaliyosimbwa unaweka kikomo cha urefu wa asili.
• Marafiki zako na maombi ya urafiki.
• Ishara za simu — kwamba simu ilipigwa, kwa nani, na lini. Si sauti au video yake.

Viashiria vya kuandika na risiti za kusoma vimezimwa isipokuwa uviwashe, na wakati vimezimwa hakuna kinachoandikwa.

Kisichopo hapa tena: anwani yako ya barua pepe na jina. Tangu Septemba 2026 rekodi ya akaunti ina kitambulisho cha akaunti pekee — na tangu wakati huo hakuna anwani ya kushikilia mahali popote. Kujisajili hakuulizi chochote kukuhusu: akaunti yako ni kifungu cha kurejesha cha maneno 24, na kitambulisho ambacho Firebase Authentication huangalia kinatokana na hicho. Kinachohifadhiwa ni lebo ya nasibu chini ya kikoa kisichoweza kupokea barua pepe.

Kwa kando: kwa sababu programu inaendesha kwenye Google Firebase, Google inaweza kuona anwani ya IP na muda wa kila muunganisho ambao kifaa chako kinafanya nayo. Hiyo ni sifa ya uwekaji mwenyeji, si ya programu, na hatuwezi kuisimba na kuiondoa.`,
    },
    {
      title: '3. Watu wanakupataje',
      body: `Hawawezi kukutafuta. Hakuna orodha — hakuna utafutaji kwa barua pepe, nambari ya simu au jina — na seva inakataa ombi lolote linalojaribu hilo.

Unamfikia mtu kwa kumtumia kiungo cha mwaliko nje ya njia, kupitia chochote unachotumia tayari. Kiungo hufanya kazi mara moja, kinaisha muda baada ya masaa 24, na kinaweza kuondolewa. Chochote unachomwita mtu ni lebo yako mwenyewe kwa ajili yake, iliyowekwa kwa ajili yako; kama alijitambulisha, jina hilo lilikufikia likiwa limesimbwa.`,
    },
    {
      title: '4. Tunachokusanya',
      body: `• Data ya akaunti: kitambulisho cha akaunti, na kitambulisho kinachotokana na kifungu chako cha kurejesha, kilichowekwa katika Firebase Authentication. Hakuna anwani ya barua pepe, hakuna nambari ya simu, hakuna jina — kujisajili hakuulizi chochote kati ya hivyo.
• Maandishi yaliyosimbwa ya ujumbe na kiambatisho, pamoja na metadata katika sehemu ya 2.

Hiyo ndiyo orodha nzima. Hakuna uchambuzi na hakuna kuripoti hitilafu. Programu zamani ilikuwa ikituma mionekano ya skrini kwa Firebase Analytics na ripoti za hitilafu kwa Firebase Crashlytics, zote mbili zikiwa na kitambulisho chako cha akaunti, hivyo hakuna iliyokuwa bila jina; zote mbili sasa zimeondoka, pamoja na maktaba zilizozituma. Makosa yanachapishwa kwenye kompyuta ya mwandaaji programu mwenyewe wakati wa uundaji na hayaendi mahali pengine.`,
    },
    {
      title: '5. Inahifadhiwa wapi',
      body: `Kwenye Google Firebase — Firestore, Storage na Authentication — chini ya kanuni za usalama zinazoamua ni nani anaweza kusoma na kuandika kila hati.

Kwenye kifaa chako, ujumbe uliohifadhiwa kwa muda, mipangilio, na PIN yako ya kufunga programu vimesimbwa kwa ufunguo wa kila kifaa uliowekwa katika hifadhi ya funguo za jukwaa (iOS Keychain, Android Keystore) badala ya hifadhi ya kawaida ya programu.

Ufunguo wa faragha unaofungua ujumbe wako haondoki kamwe kwenye kifaa chako, isipokuwa kama kifungu cha kurejesha unachochagua kuandika. Hatukishikilii na hatuwezi kukirejesha kwa ajili yako. Ukipotea, ujumbe uliotumwa kwa kifaa hicho hauwezi kusomwa tena — na yeyote, ikiwa ni pamoja na sisi.`,
    },
    {
      title: '6. Nani mwingine anapokea data',
      body: `Hatuuzi, kubadilishana au kukodisha taarifa zako binafsi. Data inafikia:

• Google Firebase — mtoa huduma wetu wa uwekaji mwenyeji, kama ilivyoelezwa hapo juu.
• Cloudflare Realtime — sauti na video ya simu, wakati kifaa chako na kifaa cha mtu mwingine haviwezi kufikiana moja kwa moja.
• Wikimedia Foundation — jina moja, unapogusa kutafuta kwenye Wikipedia.
• Google Cloud Speech-to-Text — sauti ya ujumbe mmoja wa sauti, unapoomba nakala ya maandishi.
• Google Cloud Translation — maandishi ya ujumbe mmoja, unapoomba tafsiri.
• Cloudflare Workers AI — hadi ujumbe 50 wa mwisho wa mazungumzo moja, unapoomba muhtasari au kuuliza swali kuhusu hayo.

Tatu za mwisho zimezimwa katika toleo hili. Hakuna udhibiti wowote popote katika programu unaowasha uandishi, tafsiri au muhtasari, hivyo hakuna kinachofika huduma hizo tatu. Zimeorodheshwa badala ya kufutwa kwa sababu msimbo bado uko hapa na vipengele hivyo vinakusudiwa kurudi — na vinaporudi, vinarudi na ufunuo huu na ujumbe kabla ya matumizi ya kwanza. Kitakachotumwa wakati huo kinatumwa kutoa matokeo yako, si kufundisha chochote; hakuna nakala ya maandishi wala tafsiri inayohifadhiwa kwenye seva zetu.

Utafutaji wa Wikipedia hauna swichi kwa sababu hakuna kinachosimama kuzimwa: unaendesha wakati wa kugusa tu si vinginevyo. Wikipedia inapokea jina hilo moja na anwani yako ya IP, sawa na ungeliandika mwenyewe kwenye kisanduku chao cha utafutaji — hakuna akaunti, hakuna ujumbe, hakuna mazungumzo. Kinachorudi kinaonyeshwa na hakihifadhiwi, na hakuna chochote kuhusu hicho kinachoandikwa kwenye mazungumzo.

Cloudflare Realtime pia haina swichi. Simu nyingi hazihitaji: vifaa viwili vinavyoweza kufikiana moja kwa moja — simu nyingi kwenye mtandao ule ule — huunganishwa bila hicho, na hakuna kinachopitishwa. Vinaposhindwa kufikiana — mara nyingi kwa sababu ninyi wawili mko kwenye mitandao tofauti ya simu — mazungumzo yaliyosimbwa tayari yanapitishwa badala ya kubaki bila kuunganika. Kile Cloudflare kinachokiona ni anwani za IP za pande zote mbili, muda wa simu, na kiasi cha data kilichohamishwa; sauti na video hubaki chini ya usimbaji uleule wa DTLS-SRTP ulioelezwa katika sehemu ya 2, hivyo kupitisha hakuvunji usimbaji wake.

Tunaweza kufichua tunachoshikilia iwapo sheria inahitaji. Tunachoshikilia ni orodha katika sehemu ya 2. Hatuwezi kutoa maudhui ya ujumbe, kwa sababu hatuwezi kuyasoma.`,
    },
    {
      title: '7. Arifa za kusukuma',
      body: `Firebase Cloud Messaging hupeleka arifa. Tokeni ya kifaa chako imehifadhiwa katika sehemu ya faragha ya akaunti yako ambayo wewe pekee unaweza kusoma.

Arifa hazibebi maandishi ya ujumbe. Kifaa chako hufungua ujumbe mahali hapo na kutunga unachokiona; Google inapeleka bahasha, si maudhui.`,
    },
    {
      title: '8. Unachoweza kufanya',
      body: `• Futa akaunti yako kutoka skrini ya Wasifu. Maudhui yaliyo sehemu ya pamoja ya mazungumzo — rekodi ya simu, kwa mfano — inabaki na mshiriki mwingine, kwa sababu ni rekodi yake pia.
• Hamisha data yako kutoka skrini ya Wasifu.
• Weka ujumbe uishe muda kwa kila mazungumzo: saa 1, saa 24, siku 7 au siku 30.
• Washa au zima viashiria vya kuandika na risiti za kusoma. Vyote viwili vimezimwa kwa chaguo-msingi.
• Funga programu kwa PIN au biometriki.
• Ondoa kiungo cha mwaliko ulichokwisha kutoa.

Ikiwa ungependa tufute kitu kwa mkono, tuandikie.`,
    },
    {
      title: '9. Uhifadhi',
      body: `Tunahifadhi data yako wakati akaunti yako ipo. Kufuta akaunti kunaifuta, isipokuwa maudhui yaliyoshikiliwa kwa pamoja yaliyotajwa hapo juu. Kuisha muda kwa kila mazungumzo huondoa ujumbe kulingana na ratiba uliyoweka.`,
    },
    {
      title: '10. Vikwazo unavyopaswa kujua',
      body: `Tungependelea kukuambia haya kuliko wewe kuvigundua.

• Funguo zinaaminiwa mara ya kwanza zinapoonekana. Kama mtu alibadilisha ufunguo kabla haujawahi kubadilishana ujumbe, mazungumzo yangesimbwa kwa mtu asiye sahihi na yangeonekana ya kawaida kabisa. Programu inakuonya ufunguo unapobadilika baadaye, na kuonyesha nambari ya usalama unayoweza kulinganisha nje ya njia — lakini hakuna kinachokulazimisha kuilinganisha.
• Kifaa kimoja kwa wakati mmoja. Kifungu chako cha kurejesha kinarejesha ufunguo unaofungua historia yako, hivyo kuingia kwenye kifaa kipya hakupotezi ulichokwisha pokea. Mazungumzo yenye usiri wa mbele hutumia ufunguo wa pili ambao haondoki kamwe kwenye kifaa kilichouunda: chochote kifaa kilichoingia mwisho ndicho kinachofikiwa, na chochote kilichofungwa kwa kingine wakati huo hakiwezi kuhamishwa.
• Ujumbe uliotumwa kabla ya usimbaji kuwepo unabaki kama ulivyokuwa. Hakuna kilichobadilishwa kwa nyuma.
• Programu hii haijafanyiwa ukaguzi wa usalama wa kujitegemea.`,
    },
    {
      title: '11. Watoto',
      body: `Chatterbox haikusudiwa kwa watoto walio chini ya umri wa miaka 13, na hatukusanyi taarifa zao kwa makusudi. Ukiamini kwamba mtoto alitupatia taarifa binafsi, wasiliana nasi na tutazifuta.`,
    },
    {
      title: '12. Mabadiliko',
      body: `Tunaweza kusasisha sera hii. Mabadiliko makubwa yatatangazwa kwenye programu, na tarehe iliyo juu ndiyo ilipobadilika mwisho.`,
    },
    {
      title: '13. Mawasiliano',
      body: `Maswali kuhusu sera hii: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Kuangalia toleo jipya zaidi la programu',
      body: `Google Play si njia ambayo programu hii inafikia simu yako ya Android. Badala yake inapakuliwa kutoka chatterbox.fans, na duka ambalo halihusiki katika mchakato huu haliwezi kuangalia masasisho kwa niaba yako — hivyo programu hii inaweza kufanya hivyo yenyewe, ukiiomba.

Kugusa "Angalia sasa" hutuma ombi moja kwa chatterbox.fans kuuliza ni toleo lipi la sasa. Ombi hilo linabeba tu anwani yako ya IP na hakuna kingine — hakuna akaunti, hakuna kitambulisho cha kifaa, hakuna ujumbe. Kinachorudi ni nambari ya toleo, inayolinganishwa kwenye simu yako na toleo unalotumia; hakuna kinachopakuliwa kiotomatiki, na hakuna kinachohusiana na uangalizi huu kinachoandikwa kwenye mazungumzo.

Hii haina swichi kwa sababu hakuna kitu cha kuzima: inafanya kazi tu unapogusa, na si kwa njia nyingine.

Ukisakinisha sasisho, litabadilisha programu mahali pake kwa kutumia funguo ile ile ya sahihi, kama vile sasisho kutoka Google Play lingefanya.`,
    },
  ],

  ha: [
    {
      title: '0. A taƙaice',
      body: `An sanya wa rubutun saƙonninka lambar sirri a na'urarka kuma mutanen da ka aika wa ne kaɗai za su iya karanta shi. Ba za mu iya karanta shi ba, kuma haka Google, wanda muke hayan sabar dinsa, ba zai iya ba.

Abin da za mu iya gani shi ne cewa an yi tattaunawa: waɗanne asusu ke ciki, da lokacin da suke aiki. Cire wannan ya fi wahala fiye da sanya lambar sirri ga abin ciki, kuma ba mu gama ba tukuna. Wannan manufa ta faɗi daidai inda layin yake a yanzu.`,
    },
    {
      title: '1. Menene aka sanya lambar sirri daga ƙarshe zuwa ƙarshe',
      body: `An sanya wa lambar sirri a na'urarka, ba za mu iya karantawa ba mu da Google:

• Rubutun saƙonninka.
• Abin cikin fayiloli, hotuna, sauti da bidiyo da kake haɗawa.
• Gwajin hanyar haɗi.
• Kirayen murya da bidiyo, waɗanda ke amfani da DTLS-SRTP na tilas na WebRTC tsakanin na'urori biyu.

Yawancin saƙonnin mutum-da-mutum da na rukuni suna kuma amfani da ratchet, ma'ana kowane saƙo yana da nasa mabudin, don haka satar na'urarka ba ya bayyana saƙonnin baya. Tattaunawar da abokin ciniki na wani bai buga sabon abin mabudi ba yana komawa zuwa mabudi guda ɗaya na dogon lokaci, wanda ba shi da wannan sifa. Alamar da ke ƙarƙashin saƙo tana gaya maka wanda ya samu na gaske.

Abu ɗaya kaɗai ke ƙetare wannan layi, kuma sai lokacin da ka nema kaɗai: neman suna a Wikipedia yana aika sunan ɗaya kawai, ba saƙon da ya fito daga shi ba. Sashe na 6 ya faɗi wanda ke karɓarsa, kuma bincike yana aiki ne kawai a lokacin danna kuma ba wata hanya ba, don haka babu abin da ya tsaya don kashewa. Taƙaitawa, fassara da rubuta magana kuma za su ƙetare wannan — an kashe su a wannan sakin, ba tare da wani sarrafawa a ko'ina a cikin manhajar da zai kunna su ba.`,
    },
    {
      title: '2. Menene ba a sanya lambar sirri ba, da abin da za mu iya gani',
      body: `Sanya lambar sirri yana kāre abin ciki, ba hujjar cewa an yi tattaunawa ba. Waɗannan suna zaune a fili a kan sabobinmu:

• Wanda ke cikin kowace tattaunawa, da lokacin da aka ƙirƙira ta kuma lokacin ƙarshe da take aiki.
• Alamar lokaci na kowane saƙo, da yawan da ba ka karanta ba.
• Sunan fayil, nau'i da girman abin da aka haɗa. An sanya wa bytes lambar sirri; bayanin su ba haka ba, kuma tsawon rubutun sirrin yana iyakance tsawon na asali.
• Abokanka da buƙatun abokantaka.
• Sigina na kira — cewa an yi kira, ga wanene, da lokacin. Ba sauti ko bidiyon sa ba.

Alamun rubutu da rasit na karantawa an kashe su sai ka kunna su, kuma yayin da aka kashe babu abin da ake rubutawa.

Abin da ba ya nan yanzu: adireshin imel ɗinka da suna. Tun daga Satumba 2026 rikodin asusun yana da alamar asusu kaɗai — kuma tun daga lokacin babu adireshin da za a riƙe a ko'ina. Yin rijista ba ya tambayar komai game da kai: asusunka jimla ce ta dawo da kalmomi 24, kuma sirrin da Firebase Authentication ke duba an samo shi daga wannan. Abin da yake ajiyewa alama ce ta bazuwar ƙarƙashin yanki wanda ba zai iya karɓar wasiƙa ba.

Daban: saboda manhajar tana aiki a kan Google Firebase, Google na iya ganin adireshin IP da lokacin kowane haɗi da na'urarka take yi da shi. Wannan siffa ce ta karɓar baƙunci, ba ta manhajar ba, kuma ba za mu iya sanya masa lambar sirri mu kawar da shi ba.`,
    },
    {
      title: '3. Yadda mutane ke samun ka',
      body: `Ba za su iya neman ka ba. Babu jerin sunaye — babu bincike ta imel, lambar waya ko suna — kuma sabar tana ƙin kowace tambaya da ke ƙoƙarin haka.

Kana kaiwa wani ta hanyar aika masa hanyar haɗin gayyata a wajen tashar, ta kowace hanya da kake amfani da ita tuni. Hanyar haɗi tana aiki sau ɗaya, tana ƙarewa bayan sa'o'i 24, ana kuma iya janye ta. Duk abin da kake kiran wani shi ne alamar ka don su, an ajiye don kai; idan sun gabatar da kansu, sunan ya isar maka a sanya masa lambar sirri.`,
    },
    {
      title: '4. Abin da muke tattarawa',
      body: `• Bayanan asusu: alamar asusu, da sirrin da aka samo daga jimlar dawowarka, aka ajiye a Firebase Authentication. Babu adireshin imel, babu lambar waya, babu suna — yin rijista ba ya tambayar kowanne daga cikinsu.
• Rubutun sirrin saƙo da abin haɗawa, tare da bayanan da ke sashe na 2.

Wannan ita ce jerin gaba ɗaya. Babu bincike da babu rahoton fadowa. Manhajar da can tana aika ganin allo zuwa Firebase Analytics da rahoton fadowa zuwa Firebase Crashlytics, dukansu suna ɗauke da alamar asusunka, don haka babu wanda ba a san shi ba; dukansu yanzu sun tafi, tare da laburaren da suka aika su. Ana buga kurakurai a kan injin mai haɓakawa kansa yayin haɓakawa kawai kuma ba ya zuwa wani wuri.`,
    },
    {
      title: '5. Inda ake ajiyewa',
      body: `A kan Google Firebase — Firestore, Storage da Authentication — a ƙarƙashin ƙa'idojin tsaro waɗanda ke tantance wanda zai iya karantawa da rubuta kowane takarda.

A na'urarka, saƙonnin da aka ɓoye, saitunan, da PIN ɗin kulle manhajar an sanya musu lambar sirri da mabudin kowace na'ura da aka ajiye a keystore na dandali (iOS Keychain, Android Keystore) maimakon ajiyar manhaja ta yau da kullun.

Mabudin sirri da ke buɗe saƙonninka ba ya taɓa barin na'urarka, sai dai a matsayin jimlar dawowa da ka zaɓi rubutawa. Ba mu riƙe shi ba kuma ba za mu iya dawo maka da shi ba. Idan ka rasa shi, saƙonnin da aka aika zuwa wannan na'ura ba za a iya sake karantawa ba — ta kowa, har da mu.`,
    },
    {
      title: '6. Su waye kuma ke karɓar bayanai',
      body: `Ba ma sayar, canzawa, ko yin hayar bayananka na sirri. Bayanai suna kaiwa:

• Google Firebase — mai bayar da mu na karɓar baƙunci, kamar yadda aka bayyana a sama.
• Cloudflare Realtime — sauti da bidiyon kira, lokacin da na'urarka da ta wancan mutumin ba za su iya kaiwa juna kai tsaye ba.
• Gidauniyar Wikimedia — suna ɗaya, lokacin da ka danna don nema a Wikipedia.
• Google Cloud Speech-to-Text — sautin saƙon murya ɗaya, lokacin da ka nemi rubutu.
• Google Cloud Translation — rubutun saƙo ɗaya, lokacin da ka nemi fassara.
• Cloudflare Workers AI — har zuwa saƙonni 50 na ƙarshe na tattaunawa ɗaya, lokacin da ka nemi taƙaitawa ko ka yi tambaya game da shi.

Ukun na ƙarshe an kashe su a wannan sakin. Babu wani sarrafawa a ko'ina a cikin manhaja da zai kunna rubutun magana, fassara ko taƙaitawa, don haka babu abin da ke kaiwa waɗannan sabis guda uku. An lissafta su maimakon a share su domin lambar tana nan har yanzu kuma an nufi fasalulluka su dawo — kuma lokacin da suka dawo, za su dawo tare da wannan bayyanawa da tambaya kafin amfani na farko. Abin da za a aika a lokacin ana aika shi ne don samar da sakamakonka, ba don horar da wani abu ba; ba a ajiye rubutu ko fassara a sabobinmu.

Neman Wikipedia ba shi da maɓalli saboda babu abin da ya tsaya don kashewa: yana aiki ne kawai a lokacin danna kuma ba wata hanya ba. Wikipedia na karɓar sunan ɗaya kawai da adireshin IP ɗinka, kamar dai ka buga shi da kanka a cikin akwatin binciken su — babu asusu, babu saƙo, babu tattaunawa. Abin da ya dawo ana nuna shi kuma ba a ajiye shi ba, kuma babu abin da ke game da shi da aka rubuta a cikin tattaunawar.

Cloudflare Realtime ma ba shi da sauyawa. Yawancin kiraye-kiraye ba sa bukatarsa: na'urori biyu da za su iya kaiwa juna kai tsaye — yawancin kiraye-kiraye a hanyar sadarwa iri ɗaya — suna haɗuwa ba tare da shi ba, kuma babu wani abu da ake tantancewa. Idan ba za su iya ba — yawanci saboda ku biyu kuna kan hanyoyin sadarwar waya daban-daban — ana tantance kiran da aka riga aka sa masa ɓoyayyiya maimakon a bar shi ba tare da haɗi ba. Abin da Cloudflare ke gani shi ne adireshin IP na ku biyu, lokacin kiran, da kimanin adadin bayanan da aka motsa; sauti da bidiyo suna ci gaba da kasancewa a ƙarƙashin ɓoyayyiyar DTLS-SRTP iri ɗaya da aka bayyana a sashe na 2, don haka tantancewa ba ya buɗe ɓoyayyiyarsu.

Za mu iya bayyana abin da muke riƙe idan doka ta buƙaci. Abin da muke riƙe shi ne jerin da ke sashe na 2. Ba za mu iya samar da abin cikin saƙo ba, domin ba za mu iya karanta shi ba.`,
    },
    {
      title: '7. Sanarwar tura',
      body: `Firebase Cloud Messaging tana isar da sanarwa. An ajiye alamar na'urarka a wani sashi na sirri na asusunka wanda kai kaɗai za ka iya karantawa.

Sanarwa ba sa ɗauke da rubutun saƙo. Na'urarka tana buɗe saƙon a gida kuma tana tsara abin da kake gani; Google tana isar da ambulaf, ba abin ciki ba.`,
    },
    {
      title: '8. Abin da za ka iya yi',
      body: `• Share asusunka daga allon Bayani. Abin cikin da ke sashi na tare na tattaunawa — rikodin kira, alal misali — yana zama tare da sauran mahalarta, domin rikodin su ne shi ma.
• Fitar da bayananka daga allon Bayani.
• Saita saƙonni su ƙare kowace hira: sa'a 1, sa'o'i 24, kwana 7 ko kwana 30.
• Kunna ko kashe alamun rubutu da rasit na karantawa. Dukansu an kashe su ta tsohuwa.
• Kulle manhajar da PIN ko biometrics.
• Janye hanyar haɗin gayyata da ka riga ka bayar.

Idan kana son mu share wani abu da hannu, rubuto mana.`,
    },
    {
      title: '9. Ajiyewa',
      body: `Muna riƙe bayananka yayin da asusunka ke wanzuwa. Share asusun yana share shi, sai dai abin cikin da aka riƙe tare da aka ambata a sama. Ƙarewar kowace hira tana cire saƙonni bisa jadawalin da ka saita.`,
    },
    {
      title: '10. Iyakoki da ya kamata ka sani',
      body: `Mun fi son gaya maka waɗannan fiye da ka same su da kanka.

• Ana amincewa da mabudai a karo na farko da aka gan su. Idan wani ya maye gurbin mabudi kafin ka taɓa musanya saƙo, tattaunawar za a sanya mata lambar sirri zuwa mutumin da ba daidai ba kuma za ta yi kama da al'ada gaba ɗaya. Manhajar tana gargaɗe ka lokacin da mabudi ya canza daga baya, kuma tana nuna lambar tsaro da za ka iya kwatanta a wajen tashar — amma babu abin da zai tilasta maka kwatanta ta.
• Na'ura ɗaya a lokaci ɗaya. Jimlar dawowarka tana dawo da mabudin da ke buɗe tarihinka, don haka shiga a sabuwar na'ura ba ya rasa abin da ka riga ka samu. Tattaunawar sirrin gaba suna amfani da mabudi na biyu wanda ba ya taɓa barin na'urar da ta ƙirƙira shi: duk wace na'ura ta shiga na ƙarshe ita ce wadda za su kaiwa, kuma duk abin da aka rufe wa wata na'ura a wannan lokacin ba za a iya matsar da shi zuwa can ba.
• Saƙonnin da aka aika kafin sanya lambar sirri ta wanzu suna zama kamar yadda suke. Ba a canza komai baya ba.
• Wannan manhaja ba a taɓa yin bincike na tsaro mai zaman kanta ba a kanta.`,
    },
    {
      title: '11. Yara',
      body: `Chatterbox ba don yara 'yan ƙasa da shekaru 13 ba ne, kuma ba mu tattara bayanansu da sani ba. Idan ka gaskata cewa yaro ya bayar mana da bayanan sirri, tuntuɓe mu kuma za mu share su.`,
    },
    {
      title: '12. Canje-canje',
      body: `Za mu iya sabunta wannan manufa. Za a sanar da manyan canje-canje a cikin manhaja, kuma ranar da ke sama ita ce lokacin ƙarshe da ta canza.`,
    },
    {
      title: '13. Tuntuɓi',
      body: `Tambayoyi game da wannan manufa: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Duba sabon sigar app',
      body: `Google Play ba shine hanyar da wannan app ke isa wayarka ta Android ba. Ana sauke shi daga chatterbox.fans maimakon haka, kuma kantin da ba ya cikin wannan tsari ba zai iya duba sabuntawa a madadinka ba — don haka wannan app zai iya yin hakan da kansa, idan ka nema.

Danna "Duba yanzu" yana aika buƙata ɗaya zuwa chatterbox.fans yana tambaya wanne sigar ne na yanzu. Wannan buƙatar tana ɗauke da adireshin IP naka kawai, babu wani abu — babu asusu, babu ID na na'ura, babu saƙo. Abin da ke dawowa shine lambar sigar, wanda ake kwatanta a wayarka da sigar da kake amfani da ita; babu abin da ake saukewa ta atomatik, kuma babu wani abu game da wannan dubawa da ake rubutawa a tattaunawar.

Wannan ba shi da sauyawa domin babu abin da za a kashe: yana aiki ne kawai lokacin da aka danna, ba wata hanya ba.

Idan ka shigar da sabuntawar, zai maye gurbin app a wurinsa ta amfani da maɓallin sa hannu iri ɗaya, kamar yadda sabuntawa daga Google Play zai yi.`,
    },
  ],

  am: [
    {
      title: '0. በአጭሩ',
      body: `የመልዕክቶችዎ ጽሑፍ በመሣሪያዎ ላይ ተመስጥሮ የሚላክላቸው ሰዎች ብቻ ሊያነቡት ይችላሉ። እኛ ልናነበው አንችልም፣ አገልጋዮቻቸውን የምንከራይበት Google ም አይችልም።

እኛ ልናይ የምንችለው ውይይት መደረጉን ነው፦ የትኞቹ መለያዎች በውስጡ እንዳሉ፣ እና መቼ ንቁ እንደነበሩ። ያንን ማስወገድ ይዘቱን ከማመስጠር የበለጠ ከባድ ነው፣ እኛም ገና አልጨረስንም። ይህ ፖሊሲ አሁን መስመሩ በትክክል የት እንዳለ ይናገራል።`,
    },
    {
      title: '1. ከጫፍ እስከ ጫፍ የተመሰጠረው ምንድን ነው',
      body: `በመሣሪያዎ ላይ ተመስጥሮ፣ ለእኛም ለGoogle ም የማይነበብ፦

• የመልዕክቶችዎ ጽሑፍ።
• የሚያያይዟቸው ፋይሎች፣ ፎቶዎች፣ ኦዲዮ እና ቪዲዮ ይዘት።
• የአገናኝ ቅድመ እይታዎች።
• በሁለት መሣሪያዎች መካከል የWebRTC አስገዳጅ DTLS-SRTP የሚጠቀሙ የድምጽ እና የቪዲዮ ጥሪዎች።

አብዛኞቹ አንድ ለአንድ እና የቡድን መልዕክቶች በተጨማሪ ራትሼት ይጠቀማሉ፣ ይህም ማለት እያንዳንዱ መልዕክት የራሱ ቁልፍ አለው ማለት ነው፣ ስለዚህ መሣሪያዎ መደፍረስ ቀደም ያሉትን አያጋልጥም። የአንድ ሰው ደንበኛ አዲሱን የቁልፍ ቁሳቁስ ያላወጣባቸው ውይይቶች ያ ባህሪ ወደሌለው ወደ አንድ ረጅም ዕድሜ ያለው ቁልፍ ይመለሳሉ። ከመልዕክት በታች ያለው መለያ በትክክል የትኛውን እንዳገኘ ይነግርዎታል።

ይህን መስመር የሚያቋርጠው አንድ ነገር ብቻ ነው፣ እርስዎ ሲጠይቁት ብቻ፦ በዊኪፔዲያ ላይ ስም መፈለግ ያንን አንድ ስም ብቻ ይልካል፣ ከየትኛው መልዕክት እንደመጣ አይደለም። ክፍል 6 ማን እንደሚቀበለው ይናገራል፣ እና ፍለጋው የሚሠራው በንኪያ ጊዜ ብቻ ነው ካልሆነ በስተቀር፣ ስለዚህ ለማጥፋት የቆመ ምንም ነገር የለም። ማጠቃለል፣ መተርጎም እና ግልባጭ ማድረግም ይህን ያቋርጣሉ — በዚህ ስሪት ውስጥ ጠፍተዋል፣ በመተግበሪያው ውስጥ የትም የሚያበራ ቁጥጥር የለም።`,
    },
    {
      title: '2. ያልተመሰጠረው ምንድን ነው፣ እና እኛ ልናይ የምንችለው ምንድን ነው',
      body: `ምስጠራ ይዘትን ይጠብቃል፣ ውይይት መደረጉን አይደለም። እነዚህ በአገልጋዮቻችን ላይ ግልጽ ሆነው ይቀመጣሉ፦

• በእያንዳንዱ ውይይት ውስጥ ማን እንዳለ፣ እና መቼ እንደተፈጠረ እና መጨረሻ መቼ ንቁ እንደነበረ።
• የእያንዳንዱ መልዕክት የጊዜ ማህተም፣ እና ስንት እንዳላነበቡ።
• የአባሪ ፋይል ስም፣ ዓይነት እና መጠን። ባይቶች ተመስጥረዋል፤ መግለጫቸው ግን አይደለም፣ እና የተመሰጠረው ጽሑፍ ርዝመት የመጀመሪያውን ርዝመት ይገድባል።
• የእርስዎ ጓደኞች እና የጓደኝነት ጥያቄዎች።
• የጥሪ ምልክት — ጥሪ መደረጉን፣ ለማን፣ እና መቼ። ድምጹን ወይም ቪዲዮውን አይደለም።

የመተየብ አመልካቾች እና የንባብ ደረሰኞች እርስዎ እስኪያበሩዋቸው ድረስ ጠፍተዋል፣ ጠፍተው ባሉበት ጊዜ ምንም አይመዘገብም።

ከዚህ በኋላ እዚህ የሌለው፦ የኢሜይል አድራሻዎ እና ስምዎ። ከመስከረም 2026 ጀምሮ የመለያ መዝገብ የያዘው የመለያ መለያ ብቻ ነው — እናም ከዚያ ጊዜ ጀምሮ የትም የሚቀመጥ አድራሻ የለም። መመዝገብ ስለ እርስዎ ምንም አይጠይቅም፦ መለያዎ የ24-ቃል መልሶ ማግኛ ሐረግ ነው፣ Firebase Authentication የሚያረጋግጠው ማረጋገጫ ከዚያ የተገኘ ነው። የሚያከማቸው ደብዳቤ መቀበል በማይችል ጎራ ስር ያለ የዘፈቀደ መለያ ብቻ ነው።

ለየብቻ፦ መተግበሪያው በGoogle Firebase ላይ ስለሚሠራ፣ Google መሣሪያዎ ወደ እሱ የሚያደርገውን እያንዳንዱን ግንኙነት የIP አድራሻ እና ጊዜ ማየት ይችላል። ያ የማስተናገጃው ባህሪ ነው፣ የመተግበሪያው አይደለም፣ እኛም አመስጥረን ልናስወግደው አንችልም።`,
    },
    {
      title: '3. ሰዎች እርስዎን እንዴት ያገኙዎታል',
      body: `እርስዎን መፈለግ አይችሉም። ማውጫ የለም — በኢሜይል፣ በስልክ ቁጥር ወይም በስም ፍለጋ የለም — እና አገልጋዩ ይህን የሚሞክር ማንኛውንም ጥያቄ ውድቅ ያደርጋል።

አስቀድመው በሚጠቀሙት በማንኛውም ነገር በኩል ከቻናል ውጭ የግብዣ አገናኝ በመላክ አንድን ሰው ያገኛሉ። አንድ አገናኝ አንድ ጊዜ ይሠራል፣ ከ24 ሰዓታት በኋላ ጊዜው ያልፍበታል፣ እና ሊሰረዝ ይችላል። አንድን ሰው የሚጠሩት ማንኛውም ነገር ለእነሱ የራስዎ መለያ ነው፣ ለእርስዎ ተይዞ; እነሱ ራሳቸውን ካስተዋወቁ፣ ያ ስም ተመስጥሮ ደርሶዎታል።`,
    },
    {
      title: '4. እኛ የምንሰበስበው ምንድን ነው',
      body: `• የመለያ ውሂብ፦ የመለያ መለያ፣ እና ከመልሶ ማግኛ ሐረግዎ የተገኘ ማረጋገጫ፣ በFirebase Authentication ውስጥ የተያዘ። የኢሜይል አድራሻ የለም፣ የስልክ ቁጥር የለም፣ ስም የለም — መመዝገብ ከእነዚህ ውስጥ አንዳቸውንም አይጠይቅም።
• የመልዕክት እና የአባሪ የተመሰጠረ ጽሑፍ፣ ከክፍል 2 ውስጥ ካለው ሜታዳታ ጋር።

ያ ሙሉው ዝርዝር ነው። ትንታኔ የለም እና የብልሽት ሪፖርት ማድረግ የለም። መተግበሪያው ቀደም ሲል የማያ ገጽ እይታዎችን ወደ Firebase Analytics እና የብልሽት ሪፖርቶችን ወደ Firebase Crashlytics ይልክ ነበር፣ ሁለቱም የመለያ መለያዎን ይዘው ስለሚሄዱ፣ ስለዚህ አንዳቸውም ስም-አልባ አልነበሩም፤ ሁለቱም አሁን ከላኳቸው ቤተ-መጻሕፍት ጋር ጠፍተዋል። ስህተቶች የሚታተሙት በገንቢው የራሱ ማሽን ላይ በልማት ጊዜ ብቻ ነው እና ወደ ሌላ ቦታ አይሄዱም።`,
    },
    {
      title: '5. የት ነው የተከማቸው',
      body: `በGoogle Firebase ላይ — Firestore, Storage እና Authentication — እያንዳንዱን ሰነድ ማን ማንበብ እና መጻፍ እንደሚችል በሚወስኑ የደህንነት ደንቦች ስር።

በመሣሪያዎ ላይ፣ የተሸጎጡ መልዕክቶች፣ ቅንብሮች፣ እና የመተግበሪያ ቁልፍ PIN ከመደበኛው የመተግበሪያ ማከማቻ ይልቅ በመድረክ ቁልፍ ማከማቻ (iOS Keychain, Android Keystore) ውስጥ በተያዘ በእያንዳንዱ መሣሪያ ቁልፍ ተመስጥረዋል።

መልዕክቶችዎን የሚፈታው የግል ቁልፍ ለመጻፍ በሚመርጡት መልሶ ማግኛ ሐረግ ካልሆነ በስተቀር መሣሪያዎን በጭራሽ አይለቅም። እኛ አንይዘውም ለእርስዎም ልንመልሰው አንችልም። ካጡት፣ ወደዚያ መሣሪያ የተላኩ መልዕክቶች እንደገና ሊነበቡ አይችሉም — በማንም፣ እኛን ጨምሮ።`,
    },
    {
      title: '6. ሌላ ማን ውሂብ ይቀበላል',
      body: `የግል መረጃዎን አንሸጥም፣ አንለዋወጥም ወይም አናከራይም። ውሂብ የሚደርሰው፦

• Google Firebase — ከላይ እንደተገለጸው፣ የእኛ የማስተናገጃ አቅራቢ።
• Cloudflare Realtime — የእርስዎ መሣሪያ እና የሌላው ሰው መሣሪያ በቀጥታ ወደ አንዱ ሌላው መድረስ ሳይችሉ ሲቀሩ የጥሪው ድምጽ እና ቪዲዮ።
• የዊኪሚዲያ ፋውንዴሽን — በዊኪፔዲያ ላይ ለመፈለግ ሲነኩ አንድ ስም።
• Google Cloud Speech-to-Text — ግልባጭ ሲጠይቁ የአንድ የድምጽ መልዕክት ድምጽ።
• Google Cloud Translation — ትርጉም ሲጠይቁ የአንድ መልዕክት ጽሑፍ።
• Cloudflare Workers AI — ማጠቃለያ ሲጠይቁ ወይም ስለእሱ ጥያቄ ሲጠይቁ የአንድ ውይይት እስከ መጨረሻ 50 መልዕክቶች።

የመጨረሻዎቹ ሦስቱ በዚህ ስሪት ውስጥ ጠፍተዋል። ግልባጭ ማድረግን፣ ትርጉምን ወይም ማጠቃለያዎችን የሚያበራ ቁጥጥር በመተግበሪያው ውስጥ የትም የለም፣ ስለዚህ ለእነዚያ ሦስት አገልግሎቶች ምንም አይደርስም። ኮዱ አሁንም እዚህ ስላለ እና ባህሪያቱ እንዲመለሱ ስለታሰቡ ከመሰረዝ ይልቅ ተዘርዝረዋል — እና ሲመለሱ፣ በዚህ ይፋ ማድረግ እና ከመጀመሪያው አጠቃቀም በፊት በሚደረግ ማሳሰቢያ ይመለሳሉ። በዚያ ጊዜ የሚላከው ውጤትዎን ለማምረት ነው የሚላከው፣ ምንም ነገር ለማሰልጠን አይደለም፤ ግልባጭም ሆነ ትርጉም በአገልጋዮቻችን ላይ አይቀመጥም።

የዊኪፔዲያ ፍለጋ መቀየሪያ የለውም ምክንያቱም ለማጥፋት የቆመ ምንም ነገር የለም፦ የሚሠራው በንኪያ ጊዜ ብቻ ነው ካልሆነ በስተቀር። ዊኪፔዲያ ያንን አንድ ስም እና የIP አድራሻዎን ይቀበላል፣ እርስዎ በራሳቸው የፍለጋ ሳጥን ውስጥ እንደተየቡት ያህል — መለያ የለም፣ መልዕክት የለም፣ ውይይት የለም። የሚመለሰው ይታያል እና አይቀመጥም፣ እና ስለእሱ ምንም ነገር ወደ ውይይቱ አይጻፍም።

Cloudflare Realtime እንዲሁ መቀየሪያ የለውም። አብዛኞቹ ጥሪዎች አያስፈልጉትም፦ በቀጥታ ወደ አንዱ ሌላው መድረስ የሚችሉ ሁለት መሣሪያዎች—በአንድ አውታረ መረብ ላይ ያሉ አብዛኞቹ ጥሪዎች—ያለ እሱ ይገናኛሉ፣ ምንም ነገርም አይተላለፍም። መድረስ ሳይችሉ ሲቀሩ—ብዙውን ጊዜ ሁለታችሁም በተለያዩ የሞባይል አውታረ መረቦች ስለምትገኙ—ቀድሞውኑ የተመሰጠረው ጥሪ ሳይገናኝ ከመቅረት ይልቅ ይተላለፋል። Cloudflare የሚያየው የሁለቱንም IP አድራሻ፣ የጥሪውን ጊዜ፣ እና በግምት ምን ያህል ውሂብ እንደተንቀሳቀሰ ብቻ ነው፤ ድምጽ እና ቪዲዮ በክፍል 2 ውስጥ በተገለጸው ተመሳሳይ DTLS-SRTP ምስጠራ ስር ስለሚቆዩ፣ ማስተላለፍ አይፈታውም።

ህግ የሚጠይቅ ከሆነ የያዝነውን ልናጋልጥ እንችላለን። የያዝነው በክፍል 2 ውስጥ ያለው ዝርዝር ነው። የመልዕክት ይዘቶችን ልናቀርብ አንችልም፣ ምክንያቱም ልናነባቸው ስለማንችል።`,
    },
    {
      title: '7. የግፊት ማሳወቂያዎች',
      body: `Firebase Cloud Messaging ማሳወቂያዎችን ያደርሳል። የመሣሪያዎ ቶከን እርስዎ ብቻ ማንበብ በሚችሉት የመለያዎ የግል ክፍል ውስጥ ተቀምጧል።

ማሳወቂያዎች የመልዕክት ጽሑፍ አይይዙም። መሣሪያዎ በአካባቢው መልዕክቱን ይፈታል እና የሚያዩትን ያዘጋጃል፤ Google ይዘቱን ሳይሆን ፖስታውን ያደርሳል።`,
    },
    {
      title: '8. እርስዎ ማድረግ የሚችሉት',
      body: `• መለያዎን ከመገለጫ ማያ ገጽ ይሰርዙ። በጋራ የውይይት አካል የሆነ ይዘት — ለምሳሌ የጥሪ መዝገብ — ከሌላው ተሳታፊ ጋር ይቀራል፣ ምክንያቱም የእነሱም መዝገብ ስለሆነ።
• ውሂብዎን ከመገለጫ ማያ ገጽ ይላኩ።
• መልዕክቶች በእያንዳንዱ ውይይት እንዲያልፉ ያዘጋጁ፦ 1 ሰዓት፣ 24 ሰዓታት፣ 7 ቀናት ወይም 30 ቀናት።
• የመተየብ አመልካቾችን እና የንባብ ደረሰኞችን ያብሩ ወይም ያጥፉ። ሁለቱም በነባሪነት ጠፍተዋል።
• መተግበሪያውን በPIN ወይም ባዮሜትሪክስ ይቆልፉ።
• የሰጡትን የግብዣ አገናኝ ይሰርዙ።

የሆነ ነገር በእጅ እንድንሰርዝ ከፈለጉ፣ ይጻፉልን።`,
    },
    {
      title: '9. ማቆየት',
      body: `መለያዎ እስካለ ድረስ ውሂብዎን እንይዛለን። መለያን መሰረዝ ከላይ ከተጠቀሰው በጋራ ከተያዘው ይዘት በስተቀር ይሰርዘዋል። በእያንዳንዱ ውይይት ማብቂያ እርስዎ ባዘጋጁት መርሃ ግብር መሠረት መልዕክቶችን ያስወግዳል።`,
    },
    {
      title: '10. እርስዎ ሊያውቋቸው የሚገቡ ገደቦች',
      body: `እርስዎ እነሱን ከማግኘት ይልቅ እኛ እነዚህን ልንነግርዎት እንመርጣለን።

• ቁልፎች ለመጀመሪያ ጊዜ ሲታዩ ይታመናሉ። እርስዎ በጭራሽ መልዕክት ከመለዋወጥዎ በፊት አንድ ሰው ቁልፍን ተክቶ ከሆነ፣ ውይይቱ ወደ ስህተተኛው ሰው ይመሰጠራል እና ሙሉ በሙሉ የተለመደ ይመስላል። መተግበሪያው ቁልፉ በኋላ ሲቀየር ያስጠነቅቅዎታል፣ እና ከቻናል ውጭ ማወዳደር የሚችሉትን የደህንነት ቁጥር ያሳያል — ነገር ግን እንዲያወዳድሩት የሚያስገድድ ምንም ነገር የለም።
• በአንድ ጊዜ አንድ መሣሪያ። የመልሶ ማግኛ ሐረግዎ ታሪክዎን የሚከፍተውን ቁልፍ ይመልሳል፣ ስለዚህ በአዲስ መሣሪያ ላይ መግባት ቀደም ሲል ያገኙትን አያጣም። ወደፊት-ምስጢርነት ያላቸው ውይይቶች የፈጠረውን መሣሪያ በጭራሽ የማይለቅ ሁለተኛ ቁልፍ ይጠቀማሉ፦ የትኛውም መሣሪያ በመጨረሻ ቢገባ እነሱ የሚደርሱበት ያ ነው፣ እና በዚያ ጊዜ ውስጥ ለሌላው የታሸገ ማንኛውም ነገር ወደዚያ ሊዛወር አይችልም።
• ምስጠራ ከመኖሩ በፊት የተላኩ መልዕክቶች እንደነበሩ ይቆያሉ። ወደኋላ ተመልሶ የተለወጠ ምንም ነገር የለም።
• ይህ መተግበሪያ በገለልተኛ ወገን የደህንነት ኦዲት አልተደረገለትም።`,
    },
    {
      title: '11. ልጆች',
      body: `Chatterbox ከ13 ዓመት በታች ለሆኑ ልጆች የታሰበ አይደለም፣ እናም እኛ እያወቅን መረጃቸውን አንሰበስብም። አንድ ልጅ ለእኛ የግል መረጃ ሰጥቶናል ብለው የሚያምኑ ከሆነ፣ ያግኙን እኛም እንሰርዘዋለን።`,
    },
    {
      title: '12. ለውጦች',
      body: `ይህን ፖሊሲ ልናዘምን እንችላለን። ጉልህ ለውጦች በመተግበሪያው ውስጥ ይገለጻሉ፣ እና ከላይ ያለው ቀን መጨረሻ የተቀየረበት ጊዜ ነው።`,
    },
    {
      title: '13. አግኙን',
      body: `ስለዚህ ፖሊሲ ጥያቄዎች፦ ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. አዲስ የመተግበሪያ ስሪት መፈተሽ',
      body: `Google Play ይህ መተግበሪያ ወደ Android ስልክዎ የሚደርስበት መንገድ አይደለም። ይልቁንም ከ chatterbox.fans ይወርዳል፣ እናም በዚህ ሂደት ውስጥ ያልተካተተ መደብር ስለ እርስዎ ዝማኔዎችን ሊፈትሽ አይችልም — ስለዚህ ከጠየቁት ይህ መተግበሪያ ራሱ ይህን ማድረግ ይችላል።

"አሁን ይፈትሹ" የሚለውን መንካት አሁን ያለው ስሪት ምን እንደሆነ የሚጠይቅ አንድ ጥያቄ ወደ chatterbox.fans ይልካል። ያ ጥያቄ የያዘው የእርስዎን IP አድራሻ ብቻ ነው፣ ሌላ ምንም — መለያ የለም፣ የመሣሪያ መለያ የለም፣ መልእክት የለም። የሚመለሰው የስሪት ቁጥር ነው፣ በስልክዎ ላይ እያሄዱት ካለው ስሪት ጋር ይነጻጸራል፤ ምንም በራስ-ሰር አይወርድም፣ እናም ስለዚህ ፍተሻ ምንም ነገር ወደ ውይይቱ አይጻፍም።

ለዚህ መቀየሪያ የለውም ምክንያቱም የሚጠፋ ምንም ነገር የለም፦ የሚሠራው ሲነካ ብቻ ነው፣ በሌላ መንገድ አይደለም።

ዝማኔውን ከጫኑ፣ ተመሳሳይ የፊርማ ቁልፍ በመጠቀም መተግበሪያውን በቦታው ይተካዋል፣ ልክ ከ Google Play የሚመጣ ዝማኔ እንደሚያደርገው።`,
    },
  ],

  nl: [
    {
      title: '0. In het kort',
      body: `De tekst van je berichten wordt op je apparaat versleuteld en kan alleen worden gelezen door de mensen aan wie je het stuurt. Wij kunnen het niet lezen, en Google, van wie we servers huren, ook niet.

Wat we wel kunnen zien is dat er een gesprek heeft plaatsgevonden: welke accounts erbij betrokken zijn en wanneer ze actief waren. Dat verwijderen is moeilijker dan de inhoud versleutelen, en we zijn nog niet klaar. Dit beleid vertelt precies waar de grens op dit moment ligt.`,
    },
    {
      title: '1. Wat is end-to-end versleuteld',
      body: `Versleuteld op je apparaat, onleesbaar voor ons en voor Google:

• De tekst van je berichten.
• De inhoud van bestanden, foto's, audio en video die je bijvoegt.
• Linkvoorvertoningen.
• Spraak- en video-oproepen, die de verplichte DTLS-SRTP van WebRTC gebruiken tussen de twee apparaten.

De meeste één-op-één- en groepsberichten gebruiken bovendien een ratchet, wat betekent dat elk bericht zijn eigen sleutel heeft, zodat het compromitteren van je apparaat eerdere berichten niet blootlegt. Gesprekken waarbij iemands client het nieuwere sleutelmateriaal nog niet heeft gepubliceerd, vallen terug op één langlevende sleutel, die deze eigenschap niet heeft. Het label onder een bericht vertelt je welke het daadwerkelijk kreeg.

Eén ding overschrijdt deze grens, en alleen wanneer je erom vraagt: het opzoeken van een naam op Wikipedia stuurt die ene naam, niet het bericht waar het vandaan kwam. Sectie 6 vertelt wie het ontvangt, en de opzoeking loopt alleen bij de tik en niet anders, dus er is niets dat uitgeschakeld kan worden. Samenvatten, vertalen en transcriberen zouden dit ook overschrijden — ze zijn in deze release uitgeschakeld, zonder enige bediening ergens in de app die ze inschakelt.`,
    },
    {
      title: '2. Wat is niet versleuteld, en wat wij kunnen zien',
      body: `Versleuteling beschermt inhoud, niet het feit van een gesprek. Deze staan onversleuteld op onze servers:

• Wie in elk gesprek zit, en wanneer het is aangemaakt en voor het laatst actief was.
• De tijdstempel van elk bericht, en hoeveel je er niet hebt gelezen.
• De bestandsnaam, het type en de grootte van een bijlage. De bytes zijn versleuteld; de beschrijving ervan niet, en de lengte van de cijfertekst begrenst de lengte van het origineel.
• Je vrienden en vriendschapsverzoeken.
• Belsignalering — dat er een oproep is geplaatst, aan wie, en wanneer. Niet de audio of video ervan.

Typindicatoren en leesbevestigingen staan uit tenzij je ze inschakelt, en terwijl ze uit staan wordt er niets geschreven.

Wat hier niet meer is: je e-mailadres en naam. Sinds september 2026 bevat het accountrecord alleen een accountidentificatie — en sindsdien is er nergens een adres om te bewaren. Aanmelden vraagt niets over jou: je account is een herstelzin van 24 woorden, en de credential die Firebase Authentication controleert, is daarvan afgeleid. Wat het opslaat is een willekeurig label onder een domein dat geen post kan ontvangen.

Apart: omdat de app draait op Google Firebase, kan Google het IP-adres en de timing zien van elke verbinding die je apparaat ermee maakt. Dat is een eigenschap van de hosting, niet van de app, en we kunnen dat niet wegversleutelen.`,
    },
    {
      title: '3. Hoe mensen je vinden',
      body: `Ze kunnen je niet opzoeken. Er is geen adresboek — geen opzoeken op e-mail, telefoonnummer of naam — en de server weigert elke query die dat probeert.

Je bereikt iemand door hen buiten het kanaal om een uitnodigingslink te sturen, via wat je al gebruikt. Een link werkt eenmaal, verloopt na 24 uur, en kan worden ingetrokken. Hoe je iemand ook noemt, dat is jouw eigen label voor hen, voor jou bewaard; als ze zichzelf voorstelden, bereikte die naam je versleuteld.`,
    },
    {
      title: '4. Wat we verzamelen',
      body: `• Accountgegevens: een accountidentificatie, en een credential afgeleid van je herstelzin, bewaard in Firebase Authentication. Geen e-mailadres, geen telefoonnummer, geen naam — bij aanmelden wordt naar geen van deze gevraagd.
• Bericht- en bijlagecijfertekst, plus de metadata uit sectie 2.

Dat is de hele lijst. Er is geen analytics en geen crashrapportage. De app stuurde vroeger schermweergaven naar Firebase Analytics en crashrapporten naar Firebase Crashlytics, beide met je accountidentificatie, dus geen van beide was anoniem; beide zijn nu weg, samen met de bibliotheken die ze verstuurden. Fouten worden alleen tijdens ontwikkeling op de eigen machine van een ontwikkelaar afgedrukt en gaan verder nergens heen.`,
    },
    {
      title: '5. Waar het wordt opgeslagen',
      body: `Op Google Firebase — Firestore, Storage en Authentication — onder beveiligingsregels die bepalen wie elk document mag lezen en schrijven.

Op je apparaat worden gecachete berichten, instellingen en je app-vergrendelings-pincode versleuteld met een per-apparaat-sleutel die wordt bewaard in de platformsleutelopslag (iOS Keychain, Android Keystore) in plaats van in gewone app-opslag.

De privésleutel die je berichten ontsleutelt, verlaat je apparaat nooit, behalve als de herstelzin die je ervoor kiest om op te schrijven. Wij bewaren die niet en kunnen die niet voor je herstellen. Verlies je die, dan kunnen de berichten die naar dat apparaat zijn gestuurd nooit meer worden gelezen — door niemand, ons inbegrepen.`,
    },
    {
      title: '6. Wie nog meer gegevens ontvangt',
      body: `We verkopen, verhandelen of verhuren je persoonlijke informatie niet. Gegevens bereiken:

• Google Firebase — onze hostingprovider, zoals hierboven beschreven.
• Cloudflare Realtime — de audio en video van een gesprek, wanneer jouw apparaat en dat van de ander elkaar niet rechtstreeks kunnen bereiken.
• De Wikimedia Foundation — één naam, wanneer je erop tikt om op Wikipedia op te zoeken.
• Google Cloud Speech-to-Text — het audio van één spraakbericht, wanneer je om een transcript vraagt.
• Google Cloud Translation — de tekst van één bericht, wanneer je om een vertaling vraagt.
• Cloudflare Workers AI — tot de laatste 50 berichten van één gesprek, wanneer je om een samenvatting vraagt of er een vraag over stelt.

De laatste drie zijn in deze release uitgeschakeld. Er is nergens in de app een bediening die transcriptie, vertaling of samenvattingen inschakelt, dus er bereikt niets die drie diensten. Ze staan vermeld in plaats van verwijderd omdat de code hier nog is en de functies bedoeld zijn om terug te keren — en wanneer ze terugkeren, doen ze dat met deze openbaarmaking en een prompt vóór het eerste gebruik. Wat dan wordt verzonden, wordt verzonden om je resultaat te produceren, niet om iets te trainen; geen transcript of vertaling wordt op onze servers opgeslagen.

De Wikipedia-opzoeking heeft geen schakelaar omdat er niets is om uit te schakelen: het loopt alleen bij de tik en niet anders. Wikipedia ontvangt die ene naam en je IP-adres, net zoals wanneer je het zelf in hun zoekvak had getypt — geen account, geen bericht, geen gesprek. Wat terugkomt wordt getoond en niet opgeslagen, en niets erover wordt in het gesprek geschreven.

Cloudflare Realtime heeft ook geen schakelaar. De meeste gesprekken hebben het niet nodig: twee apparaten die elkaar rechtstreeks kunnen bereiken — de meeste gesprekken op hetzelfde netwerk — verbinden zonder het, en er wordt niets doorgestuurd. Wanneer dat niet lukt — meestal omdat jullie op verschillende mobiele netwerken zitten — wordt het al versleutelde gesprek doorgestuurd in plaats van geen verbinding te kunnen maken. Wat Cloudflare ziet zijn beide IP-adressen, het tijdstip van het gesprek, en ongeveer hoeveel data er is verplaatst; audio en video blijven onder dezelfde DTLS-SRTP-versleuteling die in sectie 2 wordt beschreven, dus het doorsturen ontsleutelt ze niet.

We kunnen onthullen wat we bewaren als de wet dat vereist. Wat we bewaren is de lijst in sectie 2. We kunnen geen berichtinhoud produceren, omdat we die niet kunnen lezen.`,
    },
    {
      title: '7. Pushmeldingen',
      body: `Firebase Cloud Messaging levert meldingen af. Je apparaattoken wordt bewaard in een privédeel van je account dat alleen jij kunt lezen.

Meldingen bevatten geen berichttekst. Je apparaat ontsleutelt het bericht lokaal en stelt samen wat je ziet; Google levert de envelop af, niet de inhoud.`,
    },
    {
      title: '8. Wat je kunt doen',
      body: `• Verwijder je account vanuit het Profielscherm. Inhoud die gezamenlijk deel uitmaakt van een gesprek — bijvoorbeeld een gespreksregistratie — blijft bij de andere deelnemer, omdat het ook hun registratie is.
• Exporteer je gegevens vanuit het Profielscherm.
• Stel berichten in om per chat te verlopen: 1 uur, 24 uur, 7 dagen of 30 dagen.
• Zet typindicatoren en leesbevestigingen aan of uit. Beide staan standaard uit.
• Vergrendel de app met een pincode of biometrie.
• Trek een uitnodigingslink in die je hebt uitgedeeld.

Als je liever hebt dat we iets handmatig verwijderen, schrijf ons dan.`,
    },
    {
      title: '9. Bewaring',
      body: `We bewaren je gegevens zolang je account bestaat. Het verwijderen van het account verwijdert deze, met uitzondering van de hierboven genoemde gezamenlijk gehouden inhoud. Per-chat vervaltijd verwijdert berichten volgens het schema dat je instelt.`,
    },
    {
      title: '10. Beperkingen die je moet kennen',
      body: `We vertellen je dit liever dan dat je het zelf ontdekt.

• Sleutels worden vertrouwd de eerste keer dat ze worden gezien. Als iemand een sleutel had vervangen voordat je ooit een bericht had uitgewisseld, zou het gesprek versleuteld worden naar de verkeerde persoon en er volkomen normaal uitzien. De app waarschuwt je wanneer een sleutel achteraf verandert, en toont een veiligheidsnummer dat je buiten het kanaal om kunt vergelijken — maar niets dwingt je om het te vergelijken.
• Eén apparaat tegelijk. Je herstelzin herstelt de sleutel die je geschiedenis opent, dus inloggen op een nieuw apparaat verliest niet wat je al hebt ontvangen. Forward-secret gesprekken gebruiken een tweede sleutel die het apparaat dat hem heeft aangemaakt nooit verlaat: welk apparaat het laatst is ingelogd, is het apparaat dat ze bereiken, en alles wat ondertussen aan het andere is verzegeld, kan er niet naartoe worden verplaatst.
• Berichten die zijn verzonden voordat encryptie bestond, blijven zoals ze waren. Niets is met terugwerkende kracht geconverteerd.
• Deze app is niet onafhankelijk beveiligingsgeaudit.`,
    },
    {
      title: '11. Kinderen',
      body: `Chatterbox is niet bedoeld voor kinderen onder de 13 jaar, en we verzamelen niet bewust hun informatie. Als je gelooft dat een kind ons persoonlijke informatie heeft gegeven, neem dan contact met ons op en we zullen het verwijderen.`,
    },
    {
      title: '12. Wijzigingen',
      body: `We kunnen dit beleid bijwerken. Significante wijzigingen worden in de app aangekondigd, en de datum bovenaan is wanneer het voor het laatst is veranderd.`,
    },
    {
      title: '13. Contact',
      body: `Vragen over dit beleid: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Controleren op een nieuwere app-versie',
      body: `Google Play is niet de manier waarop deze app op je Android-telefoon terechtkomt. Hij wordt in plaats daarvan gedownload van chatterbox.fans, en een store die niet in dat proces zit, kan geen updates namens jou controleren — dus deze app kan dat zelf, als je erom vraagt.

Tikken op "Nu controleren" stuurt één verzoek naar chatterbox.fans om te vragen welke versie actueel is. Dat verzoek bevat alleen je IP-adres en verder niets — geen account, geen apparaat-ID, geen bericht. Wat terugkomt is een versienummer, dat op je telefoon wordt vergeleken met de versie die je gebruikt; er wordt niets automatisch gedownload, en er wordt niets over deze controle in het gesprek geschreven.

Hier zit geen schakelaar op omdat er niets is om uit te zetten: het draait alleen bij het tikken en niet anders.

Als je de update installeert, vervangt die de app ter plekke met dezelfde ondertekeningssleutel, op dezelfde manier als een update van Google Play zou doen.`,
    },
  ],

  el: [
    {
      title: '0. Εν συντομία',
      body: `Το κείμενο των μηνυμάτων σας κρυπτογραφείται στη συσκευή σας και μπορεί να διαβαστεί μόνο από τα άτομα στα οποία το στέλνετε. Εμείς δεν μπορούμε να το διαβάσουμε, ούτε η Google, από την οποία νοικιάζουμε διακομιστές.

Αυτό που μπορούμε να δούμε είναι ότι έγινε μια συνομιλία: ποιοι λογαριασμοί συμμετέχουν, και πότε ήταν ενεργοί. Η αφαίρεση αυτού είναι πιο δύσκολη από την κρυπτογράφηση του περιεχομένου, και δεν έχουμε τελειώσει ακόμα. Αυτή η πολιτική λέει ακριβώς πού βρίσκεται τώρα αυτή η γραμμή.`,
    },
    {
      title: '1. Τι είναι κρυπτογραφημένο από άκρο σε άκρο',
      body: `Κρυπτογραφημένο στη συσκευή σας, μη αναγνώσιμο από εμάς και τη Google:

• Το κείμενο των μηνυμάτων σας.
• Το περιεχόμενο αρχείων, φωτογραφιών, ήχου και βίντεο που επισυνάπτετε.
• Προεπισκοπήσεις συνδέσμων.
• Φωνητικές κλήσεις και βιντεοκλήσεις, που χρησιμοποιούν το υποχρεωτικό DTLS-SRTP του WebRTC μεταξύ των δύο συσκευών.

Τα περισσότερα μηνύματα ένας-προς-έναν και ομάδας χρησιμοποιούν επιπλέον ένα ratchet, που σημαίνει ότι κάθε μήνυμα έχει το δικό του κλειδί, οπότε η παραβίαση της συσκευής σας δεν αποκαλύπτει προηγούμενα μηνύματα. Οι συνομιλίες όπου ο πελάτης κάποιου δεν έχει δημοσιεύσει το νεότερο υλικό κλειδιού επιστρέφουν σε ένα ενιαίο μακρόβιο κλειδί, το οποίο δεν έχει αυτή την ιδιότητα. Η ετικέτα κάτω από ένα μήνυμα σας λέει ποιο πράγματι έλαβε.

Ένα πράγμα διασχίζει αυτή τη γραμμή, και μόνο όταν το ζητήσετε: η αναζήτηση ενός ονόματος στη Wikipedia στέλνει μόνο εκείνο το όνομα, όχι το μήνυμα από το οποίο προήλθε. Η ενότητα 6 λέει ποιος το λαμβάνει, και η αναζήτηση εκτελείται με το πάτημα και όχι διαφορετικά, οπότε δεν υπάρχει τίποτα να απενεργοποιηθεί. Η σύνοψη, η μετάφραση και η απομαγνητοφώνηση θα διέσχιζαν επίσης αυτό — είναι απενεργοποιημένα σε αυτή την έκδοση, χωρίς κανένα χειριστήριο πουθενά στην εφαρμογή που να τα ενεργοποιεί.`,
    },
    {
      title: '2. Τι δεν είναι κρυπτογραφημένο, και τι μπορούμε να δούμε',
      body: `Η κρυπτογράφηση προστατεύει το περιεχόμενο, όχι το γεγονός μιας συνομιλίας. Αυτά βρίσκονται ξεκάθαρα στους διακομιστές μας:

• Ποιος συμμετέχει σε κάθε συνομιλία, και πότε δημιουργήθηκε και ήταν τελευταία ενεργή.
• Η χρονοσφραγίδα κάθε μηνύματος, και πόσα δεν έχετε διαβάσει.
• Το όνομα, ο τύπος και το μέγεθος ενός συνημμένου αρχείου. Τα bytes είναι κρυπτογραφημένα· η περιγραφή τους όχι, και το μήκος του κρυπτοκειμένου οριοθετεί το μήκος του πρωτοτύπου.
• Οι φίλοι σας και τα αιτήματα φιλίας.
• Σηματοδότηση κλήσης — ότι έγινε μια κλήση, σε ποιον, και πότε. Όχι ο ήχος ή το βίντεό της.

Οι ενδείξεις πληκτρολόγησης και οι αποδείξεις ανάγνωσης είναι απενεργοποιημένες εκτός αν τις ενεργοποιήσετε, και όσο είναι απενεργοποιημένες τίποτα δεν γράφεται.

Τι δεν υπάρχει πλέον εδώ: η διεύθυνση email και το όνομά σας. Από τον Σεπτέμβριο του 2026 η εγγραφή λογαριασμού διατηρεί μόνο ένα αναγνωριστικό λογαριασμού — και από τότε δεν υπάρχει διεύθυνση να διατηρηθεί πουθενά. Η εγγραφή δεν ρωτά τίποτα για εσάς: ο λογαριασμός σας είναι μια φράση ανάκτησης 24 λέξεων, και το διαπιστευτήριο που ελέγχει το Firebase Authentication προέρχεται από αυτήν. Αυτό που αποθηκεύει είναι μια τυχαία ετικέτα κάτω από έναν τομέα που δεν μπορεί να λάβει αλληλογραφία.

Ξεχωριστά: επειδή η εφαρμογή τρέχει στο Google Firebase, η Google μπορεί να δει τη διεύθυνση IP και τη χρονική στιγμή κάθε σύνδεσης που κάνει η συσκευή σας με αυτήν. Αυτό είναι ιδιότητα της φιλοξενίας, όχι της εφαρμογής, και δεν μπορούμε να το κρυπτογραφήσουμε.`,
    },
    {
      title: '3. Πώς σας βρίσκουν οι άνθρωποι',
      body: `Δεν μπορούν να σας αναζητήσουν. Δεν υπάρχει κατάλογος — καμία αναζήτηση με email, αριθμό τηλεφώνου ή όνομα — και ο διακομιστής απορρίπτει οποιοδήποτε ερώτημα που το προσπαθεί.

Φτάνετε σε κάποιον στέλνοντάς του έναν σύνδεσμο πρόσκλησης εκτός καναλιού, μέσω οτιδήποτε ήδη χρησιμοποιείτε. Ένας σύνδεσμος λειτουργεί μία φορά, λήγει μετά από 24 ώρες, και μπορεί να ανακληθεί. Ό,τι κι αν αποκαλείτε κάποιον είναι η δική σας ετικέτα για αυτόν, διατηρημένη για εσάς· αν συστήθηκαν οι ίδιοι, αυτό το όνομα σας έφτασε κρυπτογραφημένο.`,
    },
    {
      title: '4. Τι συλλέγουμε',
      body: `• Δεδομένα λογαριασμού: ένα αναγνωριστικό λογαριασμού, και ένα διαπιστευτήριο που προέρχεται από τη φράση ανάκτησής σας, που διατηρείται στο Firebase Authentication. Καμία διεύθυνση email, κανένας αριθμός τηλεφώνου, κανένα όνομα — η εγγραφή δεν ζητά τίποτα από αυτά.
• Κρυπτοκείμενο μηνυμάτων και συνημμένων, συν τα μεταδεδομένα στην ενότητα 2.

Αυτή είναι όλη η λίστα. Δεν υπάρχει ανάλυση και καμία αναφορά σφαλμάτων. Η εφαρμογή παλαιότερα έστελνε προβολές οθόνης στο Firebase Analytics και αναφορές σφαλμάτων στο Firebase Crashlytics, και τα δύο φέροντας το αναγνωριστικό του λογαριασμού σας, οπότε κανένα δεν ήταν ανώνυμο· και τα δύο έχουν φύγει τώρα, μαζί με τις βιβλιοθήκες που τα έστελναν. Τα σφάλματα εκτυπώνονται μόνο στο δικό του μηχάνημα του προγραμματιστή κατά τη διάρκεια της ανάπτυξης και δεν πηγαίνουν πουθενά αλλού.`,
    },
    {
      title: '5. Πού αποθηκεύεται',
      body: `Στο Google Firebase — Firestore, Storage και Authentication — υπό κανόνες ασφαλείας που αποφασίζουν ποιος μπορεί να διαβάσει και να γράψει κάθε έγγραφο.

Στη συσκευή σας, τα προσωρινά αποθηκευμένα μηνύματα, οι ρυθμίσεις και το PIN κλειδώματος εφαρμογής σας είναι κρυπτογραφημένα με ένα κλειδί ανά συσκευή που διατηρείται στο keystore της πλατφόρμας (iOS Keychain, Android Keystore) αντί για τον συνηθισμένο αποθηκευτικό χώρο εφαρμογών.

Το ιδιωτικό κλειδί που αποκρυπτογραφεί τα μηνύματά σας δεν φεύγει ποτέ από τη συσκευή σας, εκτός ως η φράση ανάκτησης που επιλέγετε να σημειώσετε. Δεν το κρατάμε και δεν μπορούμε να το ανακτήσουμε για εσάς. Αν το χάσετε, τα μηνύματα που στάλθηκαν σε αυτή τη συσκευή δεν μπορούν να διαβαστούν ξανά — από κανέναν, συμπεριλαμβανομένων και εμάς.`,
    },
    {
      title: '6. Ποιος άλλος λαμβάνει δεδομένα',
      body: `Δεν πουλάμε, ανταλλάσσουμε ή ενοικιάζουμε τις προσωπικές σας πληροφορίες. Τα δεδομένα φτάνουν σε:

• Google Firebase — ο πάροχος φιλοξενίας μας, όπως περιγράφηκε παραπάνω.
• Cloudflare Realtime — ο ήχος και το βίντεο μιας κλήσης, όταν η συσκευή σας και η συσκευή του άλλου ατόμου δεν μπορούν να επικοινωνήσουν απευθείας.
• Wikimedia Foundation — ένα όνομα, όταν το πατάτε για να το αναζητήσετε στη Wikipedia.
• Google Cloud Speech-to-Text — ο ήχος ενός φωνητικού μηνύματος, όταν ζητάτε απομαγνητοφώνηση.
• Google Cloud Translation — το κείμενο ενός μηνύματος, όταν ζητάτε μετάφραση.
• Cloudflare Workers AI — έως τα τελευταία 50 μηνύματα μιας συνομιλίας, όταν ζητάτε σύνοψη ή κάνετε μια ερώτηση σχετικά με αυτήν.

Οι τρεις τελευταίες είναι απενεργοποιημένες σε αυτή την έκδοση. Δεν υπάρχει πουθενά στην εφαρμογή χειριστήριο που να ενεργοποιεί την απομαγνητοφώνηση, τη μετάφραση ή τις συνόψεις, οπότε τίποτα δεν φτάνει σε αυτές τις τρεις υπηρεσίες. Αναφέρονται αντί να διαγραφούν επειδή ο κώδικας εξακολουθεί να είναι εδώ και οι λειτουργίες προορίζονται να επιστρέψουν — και όταν επιστρέψουν, επιστρέφουν με αυτή τη γνωστοποίηση και μια προτροπή πριν από την πρώτη χρήση. Ό,τι θα σταλεί τότε στέλνεται για να παράγει το αποτέλεσμά σας, όχι για να εκπαιδεύσει οτιδήποτε· καμία απομαγνητοφώνηση ή μετάφραση δεν αποθηκεύεται στους διακομιστές μας.

Η αναζήτηση στη Wikipedia δεν έχει διακόπτη επειδή δεν υπάρχει τίποτα να απενεργοποιηθεί: εκτελείται μόνο με το πάτημα και όχι διαφορετικά. Η Wikipedia λαμβάνει εκείνο το ένα όνομα και τη διεύθυνση IP σας, ακριβώς όπως αν το είχατε πληκτρολογήσει εσείς στο πλαίσιο αναζήτησής τους — κανένας λογαριασμός, κανένα μήνυμα, καμία συνομιλία. Ό,τι επιστρέφει εμφανίζεται και δεν αποθηκεύεται, και τίποτα σχετικά με αυτό δεν γράφεται στη συνομιλία.

Το Cloudflare Realtime δεν έχει επίσης διακόπτη. Οι περισσότερες κλήσεις δεν το χρειάζονται: δύο συσκευές που μπορούν να επικοινωνήσουν απευθείας — οι περισσότερες κλήσεις στο ίδιο δίκτυο — συνδέονται χωρίς αυτό, και τίποτα δεν αναμεταδίδεται. Όταν δεν μπορούν — συνήθως επειδή βρίσκεστε και οι δύο σε διαφορετικά δίκτυα κινητής τηλεφωνίας — η ήδη κρυπτογραφημένη κλήση αναμεταδίδεται αντί να παραμείνει χωρίς σύνδεση. Αυτό που βλέπει η Cloudflare είναι και οι δύο διευθύνσεις IP, η ώρα της κλήσης, και κατά προσέγγιση πόσα δεδομένα μετακινήθηκαν· ο ήχος και το βίντεο παραμένουν υπό την ίδια κρυπτογράφηση DTLS-SRTP που περιγράφεται στην ενότητα 2, οπότε η αναμετάδοση δεν τα αποκρυπτογραφεί.

Μπορεί να αποκαλύψουμε αυτό που κατέχουμε αν το απαιτεί ο νόμος. Αυτό που κατέχουμε είναι η λίστα στην ενότητα 2. Δεν μπορούμε να παράγουμε το περιεχόμενο μηνυμάτων, επειδή δεν μπορούμε να το διαβάσουμε.`,
    },
    {
      title: '7. Ειδοποιήσεις push',
      body: `Το Firebase Cloud Messaging παραδίδει ειδοποιήσεις. Το token της συσκευής σας αποθηκεύεται σε ένα ιδιωτικό μέρος του λογαριασμού σας που μόνο εσείς μπορείτε να διαβάσετε.

Οι ειδοποιήσεις δεν φέρουν κείμενο μηνύματος. Η συσκευή σας αποκρυπτογραφεί το μήνυμα τοπικά και συνθέτει αυτό που βλέπετε· η Google παραδίδει τον φάκελο, όχι το περιεχόμενο.`,
    },
    {
      title: '8. Τι μπορείτε να κάνετε',
      body: `• Διαγράψτε τον λογαριασμό σας από την οθόνη Προφίλ. Το περιεχόμενο που αποτελεί κοινό μέρος μιας συνομιλίας — ένα αρχείο κλήσης, για παράδειγμα — παραμένει με τον άλλο συμμετέχοντα, επειδή είναι και δικό του αρχείο.
• Εξαγάγετε τα δεδομένα σας από την οθόνη Προφίλ.
• Ρυθμίστε τα μηνύματα να λήγουν ανά συνομιλία: 1 ώρα, 24 ώρες, 7 ημέρες ή 30 ημέρες.
• Ενεργοποιήστε ή απενεργοποιήστε τις ενδείξεις πληκτρολόγησης και τις αποδείξεις ανάγνωσης. Και οι δύο είναι απενεργοποιημένες από προεπιλογή.
• Κλειδώστε την εφαρμογή με PIN ή βιομετρικά.
• Ανακαλέστε έναν σύνδεσμο πρόσκλησης που έχετε δώσει.

Αν προτιμάτε να διαγράψουμε κάτι με το χέρι, γράψτε μας.`,
    },
    {
      title: '9. Διατήρηση',
      body: `Διατηρούμε τα δεδομένα σας όσο υπάρχει ο λογαριασμός σας. Η διαγραφή του λογαριασμού τα διαγράφει, εκτός από το κοινά διατηρούμενο περιεχόμενο που σημειώθηκε παραπάνω. Η λήξη ανά συνομιλία αφαιρεί μηνύματα σύμφωνα με το πρόγραμμα που ορίζετε.`,
    },
    {
      title: '10. Περιορισμοί που πρέπει να γνωρίζετε',
      body: `Θα προτιμούσαμε να σας τα πούμε αυτά παρά να τα ανακαλύψετε μόνοι σας.

• Τα κλειδιά είναι έμπιστα την πρώτη φορά που εμφανίζονται. Αν κάποιος είχε αντικαταστήσει ένα κλειδί προτού ανταλλάξετε ποτέ ένα μήνυμα, η συνομιλία θα κρυπτογραφούνταν στο λάθος άτομο και θα φαινόταν εντελώς φυσιολογική. Η εφαρμογή σας προειδοποιεί όταν ένα κλειδί αλλάζει στη συνέχεια, και εμφανίζει έναν αριθμό ασφαλείας που μπορείτε να συγκρίνετε εκτός καναλιού — αλλά τίποτα δεν σας αναγκάζει να τον συγκρίνετε.
• Μία συσκευή τη φορά. Η φράση ανάκτησής σας επαναφέρει το κλειδί που ανοίγει το ιστορικό σας, οπότε η σύνδεση σε μια νέα συσκευή δεν χάνει αυτό που έχετε ήδη λάβει. Οι συνομιλίες με forward secrecy χρησιμοποιούν ένα δεύτερο κλειδί που δεν φεύγει ποτέ από τη συσκευή που το δημιούργησε: όποια συσκευή συνδέθηκε τελευταία είναι αυτή που φτάνουν, και οτιδήποτε σφραγισμένο στην άλλη στο μεταξύ δεν μπορεί να μεταφερθεί εκεί.
• Τα μηνύματα που στάλθηκαν πριν υπάρξει κρυπτογράφηση παραμένουν όπως ήταν. Τίποτα δεν μετατράπηκε αναδρομικά.
• Αυτή η εφαρμογή δεν έχει ελεγχθεί ανεξάρτητα για ασφάλεια.`,
    },
    {
      title: '11. Παιδιά',
      body: `Το Chatterbox δεν προορίζεται για παιδιά κάτω των 13 ετών, και δεν συλλέγουμε εν γνώσει μας τις πληροφορίες τους. Αν πιστεύετε ότι ένα παιδί μας έχει δώσει προσωπικές πληροφορίες, επικοινωνήστε μαζί μας και θα τις διαγράψουμε.`,
    },
    {
      title: '12. Αλλαγές',
      body: `Μπορεί να ενημερώσουμε αυτή την πολιτική. Σημαντικές αλλαγές θα ανακοινώνονται στην εφαρμογή, και η ημερομηνία στην κορυφή είναι πότε άλλαξε τελευταία φορά.`,
    },
    {
      title: '13. Επικοινωνία',
      body: `Ερωτήσεις σχετικά με αυτή την πολιτική: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Έλεγχος για νεότερη έκδοση της εφαρμογής',
      body: `Το Google Play δεν είναι ο τρόπος με τον οποίο αυτή η εφαρμογή φτάνει στο Android τηλέφωνό σας. Αντίθετα, κατεβαίνει από το chatterbox.fans, και ένα κατάστημα που δεν συμμετέχει σε αυτή τη διαδικασία δεν μπορεί να ελέγξει για ενημερώσεις εκ μέρους σας — έτσι αυτή η εφαρμογή μπορεί να το κάνει η ίδια, αν της το ζητήσετε.

Πατώντας «Έλεγχος τώρα» στέλνεται ένα αίτημα στο chatterbox.fans ρωτώντας ποια είναι η τρέχουσα έκδοση. Αυτό το αίτημα μεταφέρει μόνο τη διεύθυνση IP σας και τίποτα άλλο — χωρίς λογαριασμό, χωρίς αναγνωριστικό συσκευής, χωρίς μήνυμα. Αυτό που επιστρέφει είναι ένας αριθμός έκδοσης, ο οποίος συγκρίνεται στο τηλέφωνό σας με την έκδοση που εκτελείτε· τίποτα δεν κατεβαίνει αυτόματα, και τίποτα σχετικό με αυτόν τον έλεγχο δεν γράφεται στη συνομιλία.

Αυτό δεν έχει διακόπτη επειδή δεν υπάρχει τίποτα να απενεργοποιηθεί: εκτελείται μόνο όταν πατηθεί και όχι διαφορετικά.

Αν εγκαταστήσετε την ενημέρωση, αντικαθιστά την εφαρμογή επί τόπου χρησιμοποιώντας το ίδιο κλειδί υπογραφής, όπως ακριβώς θα έκανε μια ενημέρωση από το Google Play.`,
    },
  ],

  sv: [
    {
      title: '0. I korthet',
      body: `Texten i dina meddelanden krypteras på din enhet och kan bara läsas av personerna du skickar den till. Vi kan inte läsa den, och det kan inte heller Google, vars servrar vi hyr.

Det vi kan se är att en konversation ägde rum: vilka konton som är inblandade, och när de var aktiva. Att ta bort det är svårare än att kryptera innehållet, och vi är inte klara än. Denna policy säger exakt var gränsen ligger just nu.`,
    },
    {
      title: '1. Vad som är totalsträckskrypterat',
      body: `Krypterat på din enhet, oläsligt för oss och Google:

• Texten i dina meddelanden.
• Innehållet i filer, foton, ljud och video du bifogar.
• Länkförhandsvisningar.
• Röst- och videosamtal, som använder WebRTC:s obligatoriska DTLS-SRTP mellan de två enheterna.

De flesta en-till-en- och gruppmeddelanden använder dessutom en ratchet, vilket innebär att varje meddelande har sin egen nyckel, så att komprometterande av din enhet inte exponerar tidigare meddelanden. Konversationer där någons klient inte har publicerat det nyare nyckelmaterialet faller tillbaka på en enda långlivad nyckel, som inte har den egenskapen. Etiketten under ett meddelande talar om vilken det faktiskt fick.

En sak korsar denna gräns, och bara när du ber om det: att slå upp ett namn på Wikipedia skickar bara det namnet, inte meddelandet det kom från. Avsnitt 6 säger vem som tar emot det, och uppslagningen körs vid tryckningen och inte annars, så det finns inget att stänga av. Att sammanfatta, översätta och transkribera skulle också korsa detta — de är avstängda i denna version, utan någon kontroll någonstans i appen som slår på dem.`,
    },
    {
      title: '2. Vad som inte är krypterat, och vad vi kan se',
      body: `Kryptering skyddar innehåll, inte faktumet att en konversation ägde rum. Dessa ligger öppet på våra servrar:

• Vem som är med i varje konversation, och när den skapades och senast var aktiv.
• Tidsstämpeln för varje meddelande, och hur många du inte har läst.
• En bilagas filnamn, typ och storlek. Bytena är krypterade; beskrivningen av dem är det inte, och längden på chiffertexten begränsar längden på originalet.
• Dina vänner och vänförfrågningar.
• Samtalssignalering — att ett samtal ringdes, till vem, och när. Inte dess ljud eller video.

Skrivindikatorer och läskvitton är avstängda om du inte slår på dem, och medan de är avstängda skrivs ingenting.

Vad som inte längre finns här: din e-postadress och ditt namn. Sedan september 2026 innehåller kontoposten endast en kontoidentifierare — och sedan dess finns det ingen adress att hålla någonstans. Registrering frågar ingenting om dig: ditt konto är en återställningsfras på 24 ord, och autentiseringsuppgiften som Firebase Authentication kontrollerar är härledd från den. Vad den lagrar är en slumpmässig etikett under en domän som inte kan ta emot post.

Separat: eftersom appen körs på Google Firebase kan Google se IP-adressen och tidpunkten för varje anslutning din enhet gör till den. Det är en egenskap hos hostingen, inte appen, och vi kan inte kryptera bort det.`,
    },
    {
      title: '3. Hur folk hittar dig',
      body: `De kan inte söka efter dig. Det finns ingen katalog — ingen sökning på e-post, telefonnummer eller namn — och servern avvisar alla förfrågningar som försöker det.

Du når någon genom att skicka dem en inbjudningslänk utanför kanalen, via vad du redan använder. En länk fungerar en gång, upphör efter 24 timmar, och kan återkallas. Vad du än kallar någon är din egen etikett för dem, sparad för dig; om de presenterade sig själva, nådde det namnet dig krypterat.`,
    },
    {
      title: '4. Vad vi samlar in',
      body: `• Kontodata: en kontoidentifierare, och en autentiseringsuppgift härledd från din återställningsfras, som hålls i Firebase Authentication. Ingen e-postadress, inget telefonnummer, inget namn — registrering frågar efter inget av detta.
• Meddelande- och bilagechiffertext, plus metadata i avsnitt 2.

Det är hela listan. Det finns ingen analys och ingen kraschrapportering. Appen brukade skicka skärmvisningar till Firebase Analytics och kraschrapporter till Firebase Crashlytics, båda bärande din kontoidentifierare, så ingen av dem var anonym; båda är nu borta, tillsammans med biblioteken som skickade dem. Fel skrivs bara ut på en utvecklares egen maskin under utveckling och går ingen annanstans.`,
    },
    {
      title: '5. Var det lagras',
      body: `På Google Firebase — Firestore, Storage och Authentication — under säkerhetsregler som avgör vem som får läsa och skriva varje dokument.

På din enhet är cachade meddelanden, inställningar och din app-låskod krypterade med en nyckel per enhet som hålls i plattformens nyckelringen (iOS Keychain, Android Keystore) snarare än i vanlig applagring.

Den privata nyckeln som dekrypterar dina meddelanden lämnar aldrig din enhet, förutom som återställningsfrasen du väljer att skriva ner. Vi håller den inte och kan inte återställa den åt dig. Förlorar du den kan meddelanden som skickats till den enheten inte läsas igen — av någon, inklusive oss.`,
    },
    {
      title: '6. Vem mer tar emot data',
      body: `Vi säljer, byter eller hyr inte ut din personliga information. Data når:

• Google Firebase — vår värdleverantör, som beskrivits ovan.
• Cloudflare Realtime — ljudet och videon i ett samtal, när din enhet och den andra personens enhet inte kan nå varandra direkt.
• Wikimedia Foundation — ett namn, när du trycker för att slå upp det på Wikipedia.
• Google Cloud Speech-to-Text — ljudet av ett röstmeddelande, när du ber om en transkription.
• Google Cloud Translation — texten i ett meddelande, när du ber om en översättning.
• Cloudflare Workers AI — upp till de senaste 50 meddelandena i en konversation, när du ber om en sammanfattning eller ställer en fråga om den.

De sista tre är avstängda i denna version. Det finns ingen kontroll någonstans i appen som slår på transkribering, översättning eller sammanfattningar, så inget når dessa tre tjänster. De listas snarare än raderas eftersom koden fortfarande finns här och funktionerna är avsedda att återkomma — och när de gör det, återkommer de med detta avslöjande och en uppmaning före första användning. Vad som då skulle skickas skickas för att producera ditt resultat, inte för att träna något; varken en transkription eller översättning lagras på våra servrar.

Wikipedia-uppslagningen har ingen brytare eftersom det inte finns något att stänga av: den körs vid tryckningen och inte annars. Wikipedia tar emot det ena namnet och din IP-adress, precis som om du hade skrivit in det i deras sökruta — inget konto, inget meddelande, ingen konversation. Det som kommer tillbaka visas och sparas inte, och inget om det skrivs in i konversationen.

Cloudflare Realtime har inte heller någon brytare. De flesta samtal behöver det inte: två enheter som kan nå varandra direkt — de flesta samtal på samma nätverk — ansluter utan det, och inget reläas. När de inte kan — vanligtvis för att ni befinner er på olika mobilnät — reläas det redan krypterade samtalet i stället för att lämnas utan anslutning. Det Cloudflare ser är båda IP-adresserna, samtalets tidpunkt och ungefär hur mycket data som flyttades; ljud och video förblir under samma DTLS-SRTP-kryptering som beskrivs i avsnitt 2, så reläning dekrypterar dem inte.

Vi kan avslöja vad vi håller om lagen kräver det. Vad vi håller är listan i avsnitt 2. Vi kan inte lämna ut meddelandeinnehåll, eftersom vi inte kan läsa det.`,
    },
    {
      title: '7. Push-aviseringar',
      body: `Firebase Cloud Messaging levererar aviseringar. Din enhets token lagras i en privat del av ditt konto som bara du kan läsa.

Aviseringar bär ingen meddelandetext. Din enhet dekrypterar meddelandet lokalt och komponerar det du ser; Google levererar kuvertet, inte innehållet.`,
    },
    {
      title: '8. Vad du kan göra',
      body: `• Radera ditt konto från profilskärmen. Innehåll som är en gemensam del av en konversation — en samtalspost, till exempel — stannar hos den andra deltagaren, eftersom det också är deras post.
• Exportera dina data från profilskärmen.
• Ställ in meddelanden att förfalla per chatt: 1 timme, 24 timmar, 7 dagar eller 30 dagar.
• Slå på eller av skrivindikatorer och läskvitton. Båda är avstängda som standard.
• Lås appen med en pinkod eller biometri.
• Återkalla en inbjudningslänk du delat ut.

Om du hellre vill att vi raderar något för hand, skriv till oss.`,
    },
    {
      title: '9. Bevarande',
      body: `Vi behåller dina data så länge ditt konto finns. Att radera kontot raderar dem, förutom det gemensamt hållna innehållet som noterats ovan. Per-chatt-förfall tar bort meddelanden enligt det schema du ställer in.`,
    },
    {
      title: '10. Begränsningar du bör känna till',
      body: `Vi vill hellre berätta detta för dig än att du hittar dem själv.

• Nycklar litas på första gången de ses. Om någon hade ersatt en nyckel innan du någonsin utbytte ett meddelande, skulle konversationen krypteras till fel person och se helt normal ut. Appen varnar dig när en nyckel ändras efteråt, och visar ett säkerhetsnummer du kan jämföra utanför kanalen — men inget tvingar dig att jämföra det.
• En enhet i taget. Din återställningsfras återställer nyckeln som öppnar din historik, så att logga in på en ny enhet förlorar inte det du redan tagit emot. Forward secret-konversationer använder en andra nyckel som aldrig lämnar enheten som skapade den: vilken enhet som senast loggade in är den de når, och allt som förseglats till den andra under tiden kan inte flyttas dit.
• Meddelanden som skickats innan kryptering fanns förblir som de var. Inget konverterades retroaktivt.
• Denna app har inte oberoende säkerhetsgranskats.`,
    },
    {
      title: '11. Barn',
      body: `Chatterbox är inte avsedd för barn under 13 år, och vi samlar inte medvetet in deras information. Om du tror att ett barn har gett oss personlig information, kontakta oss så tar vi bort den.`,
    },
    {
      title: '12. Ändringar',
      body: `Vi kan uppdatera denna policy. Betydande ändringar kommer att tillkännages i appen, och datumet högst upp är när den senast ändrades.`,
    },
    {
      title: '13. Kontakt',
      body: `Frågor om denna policy: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Söka efter en nyare appversion',
      body: `Google Play är inte det sätt som den här appen når din Android-telefon på. Den laddas i stället ner från chatterbox.fans, och en butik som inte är inblandad i processen kan inte söka efter uppdateringar åt dig — så den här appen kan göra det själv, om du ber den.

Att trycka på "Sök nu" skickar en enda förfrågan till chatterbox.fans och frågar vilken version som är aktuell. Den förfrågan bär bara med sig din IP-adress och inget annat — inget konto, ingen enhetsidentifierare, inget meddelande. Det som kommer tillbaka är ett versionsnummer, som jämförs på din telefon med versionen du kör; inget laddas ner automatiskt, och inget om denna sökning skrivs till konversationen.

Det här har ingen brytare eftersom det inte finns något att stänga av: det körs bara vid tryck och inte annars.

Om du installerar uppdateringen ersätter den appen på plats med samma signeringsnyckel, precis som en uppdatering från Google Play skulle göra.`,
    },
  ],

  da: [
    {
      title: '0. Kort sagt',
      body: `Teksten i dine beskeder krypteres på din enhed og kan kun læses af de personer, du sender den til. Vi kan ikke læse den, og det kan Google, hvis servere vi lejer, heller ikke.

Det, vi kan se, er, at en samtale fandt sted: hvilke konti der indgår, og hvornår de var aktive. At fjerne det er sværere end at kryptere indholdet, og vi er ikke færdige endnu. Denne politik siger præcis, hvor grænsen ligger lige nu.`,
    },
    {
      title: '1. Hvad er end-to-end-krypteret',
      body: `Krypteret på din enhed, ulæseligt for os og Google:

• Teksten i dine beskeder.
• Indholdet af filer, fotos, lyd og video, du vedhæfter.
• Linkforhåndsvisninger.
• Tale- og videoopkald, som bruger WebRTC's obligatoriske DTLS-SRTP mellem de to enheder.

De fleste en-til-en- og gruppebeskeder bruger desuden en ratchet, hvilket betyder, at hver besked har sin egen nøgle, så en kompromitteret enhed ikke afslører tidligere beskeder. Samtaler, hvor en persons klient ikke har offentliggjort det nyere nøglemateriale, falder tilbage til en enkelt langlivet nøgle, som ikke har den egenskab. Etiketten under en besked fortæller dig, hvilken den faktisk fik.

Én ting krydser denne linje, og kun når du beder om det: at slå et navn op på Wikipedia sender kun det ene navn, ikke beskeden, det kom fra. Afsnit 6 siger, hvem der modtager det, og opslaget kører kun ved tryk og ikke ellers, så der er intet at slå fra. At opsummere, oversætte og transskribere ville også krydse dette — de er slået fra i denne udgivelse, uden nogen kontrol nogen steder i appen, der tænder dem.`,
    },
    {
      title: '2. Hvad er ikke krypteret, og hvad vi kan se',
      body: `Kryptering beskytter indhold, ikke det faktum, at en samtale fandt sted. Disse ligger klart på vores servere:

• Hvem der er i hver samtale, og hvornår den blev oprettet og sidst var aktiv.
• Tidsstemplet for hver besked, og hvor mange du ikke har læst.
• Filnavn, type og størrelse på en vedhæftet fil. Bytes er krypteret; beskrivelsen af dem er ikke, og ciffertekstens længde begrænser originalens længde.
• Dine venner og venneanmodninger.
• Opkaldssignalering — at et opkald blev foretaget, til hvem, og hvornår. Ikke dets lyd eller video.

Skriveindikatorer og læsekvitteringer er slået fra, medmindre du slår dem til, og mens de er slået fra, skrives der intet.

Hvad der ikke længere er her: din e-mailadresse og dit navn. Siden september 2026 indeholder kontoposten kun en kontoidentifikator — og siden da har der ikke været nogen adresse at opbevare nogen steder. Tilmelding spørger ikke om noget om dig: din konto er en gendannelsessætning på 24 ord, og legitimationsoplysningen, som Firebase Authentication kontrollerer, er afledt af den. Det, den gemmer, er en tilfældig etiket under et domæne, der ikke kan modtage post.

Separat: fordi appen kører på Google Firebase, kan Google se IP-adressen og tidspunktet for hver forbindelse, din enhed laver til den. Det er en egenskab ved hostingen, ikke appen, og vi kan ikke kryptere det væk.`,
    },
    {
      title: '3. Sådan finder folk dig',
      body: `De kan ikke søge efter dig. Der er ingen adressebog — ingen søgning efter e-mail, telefonnummer eller navn — og serveren afviser enhver forespørgsel, der forsøger det.

Du når nogen ved at sende dem et invitationslink uden for kanalen, via hvad du allerede bruger. Et link virker én gang, udløber efter 24 timer, og kan trækkes tilbage. Hvad du end kalder nogen, er din egen etiket for dem, gemt til dig; hvis de introducerede sig selv, nåede det navn dig krypteret.`,
    },
    {
      title: '4. Hvad vi indsamler',
      body: `• Kontodata: en kontoidentifikator, og en legitimationsoplysning afledt af din gendannelsessætning, opbevaret i Firebase Authentication. Ingen e-mailadresse, intet telefonnummer, intet navn — tilmelding spørger om ingen af disse.
• Besked- og vedhæftningsciffertekst, plus metadata i afsnit 2.

Det er hele listen. Der er ingen analyse og ingen crashrapportering. Appen sendte tidligere skærmvisninger til Firebase Analytics og crashrapporter til Firebase Crashlytics, begge bærende din kontoidentifikator, så ingen af dem var anonym; begge er nu væk, sammen med de biblioteker, der sendte dem. Fejl udskrives kun på en udviklers egen maskine under udvikling og går ikke andre steder hen.`,
    },
    {
      title: '5. Hvor det gemmes',
      body: `På Google Firebase — Firestore, Storage og Authentication — under sikkerhedsregler, der afgør, hvem der må læse og skrive hvert dokument.

På din enhed er cachede beskeder, indstillinger og din app-lås-PIN krypteret med en per-enhed-nøgle, der opbevares i platformens nøglelager (iOS Keychain, Android Keystore) frem for i almindelig applagring.

Den private nøgle, der dekrypterer dine beskeder, forlader aldrig din enhed, undtagen som den gendannelsessætning, du vælger at skrive ned. Vi opbevarer den ikke og kan ikke gendanne den for dig. Mister du den, kan beskeder sendt til den enhed ikke læses igen — af nogen, os inkluderet.`,
    },
    {
      title: '6. Hvem ellers modtager data',
      body: `Vi sælger, handler eller udlejer ikke dine personlige oplysninger. Data når:

• Google Firebase — vores hostingudbyder, som beskrevet ovenfor.
• Cloudflare Realtime — lyden og videoen fra et opkald, når din enhed og den anden persons enhed ikke kan nå hinanden direkte.
• Wikimedia Foundation — ét navn, når du trykker for at slå det op på Wikipedia.
• Google Cloud Speech-to-Text — lyden af én talebesked, når du beder om en transskription.
• Google Cloud Translation — teksten i én besked, når du beder om en oversættelse.
• Cloudflare Workers AI — op til de sidste 50 beskeder i én samtale, når du beder om et resumé eller stiller et spørgsmål om det.

De sidste tre er slået fra i denne udgivelse. Der er ingen kontrol nogen steder i appen, der slår transskription, oversættelse eller resuméer til, så intet når disse tre tjenester. De er listet i stedet for slettet, fordi koden stadig er her, og funktionerne er beregnet til at vende tilbage — og når de gør, vender de tilbage med denne oplysning og en prompt før første brug. Det, der så ville blive sendt, sendes for at producere dit resultat, ikke for at træne noget; hverken en transskription eller oversættelse gemmes på vores servere.

Wikipedia-opslaget har ingen kontakt, fordi der intet er at slå fra: det kører kun ved tryk og ikke ellers. Wikipedia modtager det ene navn og din IP-adresse, ligesom hvis du selv havde skrevet det i deres søgefelt — ingen konto, ingen besked, ingen samtale. Det, der kommer tilbage, vises og gemmes ikke, og intet om det skrives ind i samtalen.

Cloudflare Realtime har heller ingen kontakt. De fleste opkald har ikke brug for det: to enheder, der kan nå hinanden direkte — de fleste opkald på samme netværk — forbindes uden det, og intet videresendes. Når de ikke kan — typisk fordi I begge er på forskellige mobilnetværk — bliver det allerede krypterede opkald videresendt i stedet for at blive ude af stand til at forbinde. Det, Cloudflare ser, er begge IP-adresser, opkaldets tidspunkt og cirka hvor meget data der blev flyttet; lyd og video forbliver under den samme DTLS-SRTP-kryptering, der er beskrevet i afsnit 2, så videresendelse dekrypterer dem ikke.

Vi kan afsløre, hvad vi opbevarer, hvis loven kræver det. Hvad vi opbevarer, er listen i afsnit 2. Vi kan ikke fremskaffe beskedindhold, fordi vi ikke kan læse det.`,
    },
    {
      title: '7. Push-notifikationer',
      body: `Firebase Cloud Messaging leverer notifikationer. Din enheds token opbevares i en privat del af din konto, som kun du kan læse.

Notifikationer bærer ingen beskedtekst. Din enhed dekrypterer beskeden lokalt og sammensætter det, du ser; Google leverer konvolutten, ikke indholdet.`,
    },
    {
      title: '8. Hvad du kan gøre',
      body: `• Slet din konto fra profilskærmen. Indhold, der er en fælles del af en samtale — en opkaldsregistrering, for eksempel — bliver hos den anden deltager, fordi det også er deres registrering.
• Eksportér dine data fra profilskærmen.
• Indstil beskeder til at udløbe pr. chat: 1 time, 24 timer, 7 dage eller 30 dage.
• Slå skriveindikatorer og læsekvitteringer til eller fra. Begge er slået fra som standard.
• Lås appen med en PIN-kode eller biometri.
• Tilbagekald et invitationslink, du har udleveret.

Hvis du hellere vil have, at vi sletter noget manuelt, så skriv til os.`,
    },
    {
      title: '9. Opbevaring',
      body: `Vi opbevarer dine data, så længe din konto eksisterer. Sletning af kontoen sletter dem, bortset fra det fælles indhold nævnt ovenfor. Per-chat-udløb fjerner beskeder efter den tidsplan, du indstiller.`,
    },
    {
      title: '10. Begrænsninger, du bør kende',
      body: `Vi vil hellere fortælle dig dette, end at du finder det selv.

• Nøgler betros første gang, de ses. Hvis nogen havde erstattet en nøgle, før du nogensinde udvekslede en besked, ville samtalen blive krypteret til den forkerte person og se helt normal ud. Appen advarer dig, når en nøgle ændrer sig bagefter, og viser et sikkerhedsnummer, du kan sammenligne uden for kanalen — men intet tvinger dig til at sammenligne det.
• Én enhed ad gangen. Din gendannelsessætning gendanner nøglen, der åbner din historik, så login på en ny enhed mister ikke det, du allerede har modtaget. Forward secret-samtaler bruger en anden nøgle, der aldrig forlader den enhed, der oprettede den: hvilken enhed der sidst loggede ind, er den, de når, og alt, der er forseglet til den anden i mellemtiden, kan ikke flyttes derhen.
• Beskeder sendt før kryptering fandtes, forbliver som de var. Intet blev konverteret med tilbagevirkende kraft.
• Denne app er ikke blevet uafhængigt sikkerhedstestet.`,
    },
    {
      title: '11. Børn',
      body: `Chatterbox er ikke beregnet til børn under 13 år, og vi indsamler ikke bevidst deres oplysninger. Hvis du tror, at et barn har givet os personlige oplysninger, bedes du kontakte os, så sletter vi dem.`,
    },
    {
      title: '12. Ændringer',
      body: `Vi kan opdatere denne politik. Væsentlige ændringer annonceres i appen, og datoen øverst er, hvornår den sidst blev ændret.`,
    },
    {
      title: '13. Kontakt',
      body: `Spørgsmål om denne politik: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Søgning efter en nyere app-version',
      body: `Google Play er ikke den måde, denne app når din Android-telefon på. Den downloades i stedet fra chatterbox.fans, og en butik, der ikke er en del af den proces, kan ikke tjekke for opdateringer på dine vegne — så det kan denne app selv gøre, hvis du beder den om det.

Et tryk på "Tjek nu" sender én forespørgsel til chatterbox.fans om, hvilken version der er aktuel. Den forespørgsel bærer kun din IP-adresse og intet andet — ingen konto, intet enheds-id, ingen besked. Det, der kommer tilbage, er et versionsnummer, som sammenlignes på din telefon med den version, du kører; intet downloades automatisk, og intet om dette tjek skrives ind i samtalen.

Dette har ingen kontakt, fordi der ikke er noget at slukke for: det kører kun, når der trykkes, og ikke ellers.

Hvis du installerer opdateringen, erstatter den appen på stedet med samme signeringsnøgle, ligesom en opdatering fra Google Play ville gøre.`,
    },
  ],

  no: [
    {
      title: '0. Kort sagt',
      body: `Teksten i meldingene dine krypteres på enheten din og kan bare leses av personene du sender den til. Vi kan ikke lese den, og det kan heller ikke Google, som vi leier servere fra.

Det vi kan se, er at en samtale fant sted: hvilke kontoer som er involvert, og når de var aktive. Å fjerne det er vanskeligere enn å kryptere innholdet, og vi er ikke ferdige ennå. Denne policyen sier nøyaktig hvor grensen ligger akkurat nå.`,
    },
    {
      title: '1. Hva som er ende-til-ende-kryptert',
      body: `Kryptert på enheten din, ikke lesbart for oss og Google:

• Teksten i meldingene dine.
• Innholdet i filer, bilder, lyd og video du legger ved.
• Lenkeforhåndsvisninger.
• Tale- og videosamtaler, som bruker WebRTCs obligatoriske DTLS-SRTP mellom de to enhetene.

De fleste en-til-en- og gruppemeldinger bruker i tillegg en ratchet, som betyr at hver melding har sin egen nøkkel, slik at kompromittering av enheten din ikke avslører tidligere meldinger. Samtaler der noens klient ikke har publisert det nyere nøkkelmaterialet, faller tilbake til en enkelt langlivet nøkkel, som ikke har den egenskapen. Etiketten under en melding forteller deg hvilken den faktisk fikk.

Én ting krysser denne grensen, og bare når du ber om det: å slå opp et navn på Wikipedia sender bare det ene navnet, ikke meldingen det kom fra. Del 6 sier hvem som mottar det, og oppslaget kjører bare ved trykk og ikke ellers, så det er ingenting å slå av. Å oppsummere, oversette og transkribere ville også krysse dette — de er slått av i denne utgivelsen, uten noen kontroll noe sted i appen som slår dem på.`,
    },
    {
      title: '2. Hva som ikke er kryptert, og hva vi kan se',
      body: `Kryptering beskytter innhold, ikke det faktum at en samtale fant sted. Disse ligger åpent på våre servere:

• Hvem som er i hver samtale, og når den ble opprettet og sist var aktiv.
• Tidsstempelet for hver melding, og hvor mange du ikke har lest.
• Filnavn, type og størrelse på et vedlegg. Bytene er kryptert; beskrivelsen av dem er det ikke, og lengden på chifferteksten begrenser lengden på originalen.
• Vennene dine og venneforespørsler.
• Samtalesignalering — at en samtale ble ringt, til hvem, og når. Ikke lyden eller videoen.

Skriveindikatorer og lesekvitteringer er slått av med mindre du slår dem på, og mens de er slått av skrives ingenting.

Hva som ikke lenger er her: e-postadressen og navnet ditt. Siden september 2026 inneholder kontoposten bare en kontoidentifikator — og siden da har det ikke vært noen adresse å oppbevare noe sted. Registrering spør ikke om noe om deg: kontoen din er en gjenopprettingsfrase på 24 ord, og legitimasjonen som Firebase Authentication sjekker, er utledet fra den. Det den lagrer, er en tilfeldig etikett under et domene som ikke kan motta post.

Separat: fordi appen kjører på Google Firebase, kan Google se IP-adressen og tidspunktet for hver tilkobling enheten din gjør til den. Det er en egenskap ved hostingen, ikke appen, og vi kan ikke kryptere det bort.`,
    },
    {
      title: '3. Hvordan folk finner deg',
      body: `De kan ikke søke etter deg. Det finnes ingen katalog — ingen søk på e-post, telefonnummer eller navn — og serveren avviser enhver forespørsel som prøver dette.

Du når noen ved å sende dem en invitasjonslenke utenfor kanalen, via noe du allerede bruker. En lenke fungerer én gang, utløper etter 24 timer, og kan tilbakekalles. Hva du enn kaller noen, er din egen etikett for dem, lagret for deg; hvis de presenterte seg selv, nådde det navnet deg kryptert.`,
    },
    {
      title: '4. Hva vi samler inn',
      body: `• Kontodata: en kontoidentifikator, og en legitimasjon utledet fra gjenopprettingsfrasen din, holdt i Firebase Authentication. Ingen e-postadresse, ingen telefonnummer, ingen navn — registrering spør om ingen av disse.
• Melding- og vedleggschiffertekst, pluss metadataene i del 2.

Det er hele listen. Det finnes ingen analyse og ingen krasjrapportering. Appen pleide å sende skjermvisninger til Firebase Analytics og krasjrapporter til Firebase Crashlytics, begge med kontoidentifikatoren din, så ingen av dem var anonym; begge er nå borte, sammen med bibliotekene som sendte dem. Feil skrives bare ut på en utviklers egen maskin under utvikling og går ingen andre steder.`,
    },
    {
      title: '5. Hvor det lagres',
      body: `På Google Firebase — Firestore, Storage og Authentication — under sikkerhetsregler som avgjør hvem som kan lese og skrive hvert dokument.

På enheten din er bufrede meldinger, innstillinger og app-lås-PIN-koden din kryptert med en per-enhet-nøkkel som holdes i plattformens nøkkellager (iOS Keychain, Android Keystore) i stedet for i vanlig applagring.

Den private nøkkelen som dekrypterer meldingene dine, forlater aldri enheten din, bortsett fra som gjenopprettingsfrasen du velger å skrive ned. Vi holder den ikke og kan ikke gjenopprette den for deg. Mister du den, kan meldinger sendt til den enheten ikke leses igjen — av noen, oss inkludert.`,
    },
    {
      title: '6. Hvem andre mottar data',
      body: `Vi selger, bytter eller leier ikke ut din personlige informasjon. Data når:

• Google Firebase — vår hostingleverandør, som beskrevet ovenfor.
• Cloudflare Realtime — lyden og videoen i en samtale, når enheten din og den andre personens enhet ikke kan nå hverandre direkte.
• Wikimedia Foundation — ett navn, når du trykker for å slå det opp på Wikipedia.
• Google Cloud Speech-to-Text — lyden av én talemelding, når du ber om en transkripsjon.
• Google Cloud Translation — teksten i én melding, når du ber om en oversettelse.
• Cloudflare Workers AI — opptil de siste 50 meldingene i én samtale, når du ber om et sammendrag eller stiller et spørsmål om det.

De siste tre er slått av i denne utgivelsen. Det finnes ingen kontroll noe sted i appen som slår på transkripsjon, oversettelse eller sammendrag, så ingenting når disse tre tjenestene. De er listet opp i stedet for slettet fordi koden fortsatt er her og funksjonene er ment å komme tilbake — og når de gjør det, kommer de tilbake med denne opplysningen og en melding før første bruk. Det som da ville bli sendt, sendes for å produsere resultatet ditt, ikke for å trene noe; verken en transkripsjon eller oversettelse lagres på våre servere.

Wikipedia-oppslaget har ingen bryter fordi det ikke finnes noe å slå av: det kjører bare ved trykk og ikke ellers. Wikipedia mottar det ene navnet og IP-adressen din, akkurat som om du hadde skrevet det selv i søkeboksen deres — ingen konto, ingen melding, ingen samtale. Det som kommer tilbake vises og lagres ikke, og ingenting om det skrives inn i samtalen.

Cloudflare Realtime har heller ingen bryter. De fleste samtaler trenger det ikke: to enheter som kan nå hverandre direkte — de fleste samtaler på samme nettverk — kobler til uten det, og ingenting videresendes. Når de ikke kan — vanligvis fordi dere begge er på forskjellige mobilnett — blir den allerede krypterte samtalen videresendt i stedet for å bli stående uten forbindelse. Det Cloudflare ser er begge IP-adressene, tidspunktet for samtalen, og omtrent hvor mye data som ble flyttet; lyd og video forblir under den samme DTLS-SRTP-krypteringen som beskrevet i avsnitt 2, så videresending dekrypterer dem ikke.

Vi kan avsløre hva vi oppbevarer hvis loven krever det. Hva vi oppbevarer er listen i del 2. Vi kan ikke fremskaffe meldingsinnhold, fordi vi ikke kan lese det.`,
    },
    {
      title: '7. Push-varsler',
      body: `Firebase Cloud Messaging leverer varsler. Enhetstokenet ditt lagres i en privat del av kontoen din som bare du kan lese.

Varsler bærer ingen meldingstekst. Enheten din dekrypterer meldingen lokalt og setter sammen det du ser; Google leverer konvolutten, ikke innholdet.`,
    },
    {
      title: '8. Hva du kan gjøre',
      body: `• Slett kontoen din fra profilskjermen. Innhold som er en felles del av en samtale — en samtaleregistrering, for eksempel — blir hos den andre deltakeren, fordi det også er deres registrering.
• Eksporter dataene dine fra profilskjermen.
• Sett meldinger til å utløpe per samtale: 1 time, 24 timer, 7 dager eller 30 dager.
• Slå skriveindikatorer og lesekvitteringer på eller av. Begge er slått av som standard.
• Lås appen med en PIN-kode eller biometri.
• Tilbakekall en invitasjonslenke du har delt ut.

Hvis du heller vil at vi sletter noe manuelt, skriv til oss.`,
    },
    {
      title: '9. Oppbevaring',
      body: `Vi beholder dataene dine så lenge kontoen din eksisterer. Å slette kontoen sletter dem, bortsett fra det felles innholdet nevnt ovenfor. Per-samtale-utløp fjerner meldinger etter tidsplanen du angir.`,
    },
    {
      title: '10. Begrensninger du bør kjenne til',
      body: `Vi vil heller fortelle deg dette enn at du oppdager det selv.

• Nøkler stoles på første gang de sees. Hvis noen hadde erstattet en nøkkel før du noensinne utvekslet en melding, ville samtalen bli kryptert til feil person og se helt normal ut. Appen advarer deg når en nøkkel endrer seg etterpå, og viser et sikkerhetsnummer du kan sammenligne utenfor kanalen — men ingenting tvinger deg til å sammenligne det.
• Én enhet om gangen. Gjenopprettingsfrasen din gjenoppretter nøkkelen som åpner historikken din, så innlogging på en ny enhet mister ikke det du allerede har mottatt. Forward secret-samtaler bruker en andre nøkkel som aldri forlater enheten som opprettet den: hvilken enhet som sist logget inn, er den de når, og alt som er forseglet til den andre i mellomtiden, kan ikke flyttes dit.
• Meldinger sendt før kryptering fantes, forblir som de var. Ingenting ble konvertert retroaktivt.
• Denne appen er ikke uavhengig sikkerhetsrevidert.`,
    },
    {
      title: '11. Barn',
      body: `Chatterbox er ikke ment for barn under 13 år, og vi samler ikke bevisst inn informasjonen deres. Hvis du tror at et barn har gitt oss personlig informasjon, kontakt oss, så sletter vi den.`,
    },
    {
      title: '12. Endringer',
      body: `Vi kan oppdatere denne policyen. Betydelige endringer vil bli kunngjort i appen, og datoen øverst er når den sist ble endret.`,
    },
    {
      title: '13. Kontakt',
      body: `Spørsmål om denne policyen: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Se etter en nyere appversjon',
      body: `Google Play er ikke måten denne appen når Android-telefonen din på. Den lastes i stedet ned fra chatterbox.fans, og en butikk som ikke er en del av den prosessen, kan ikke se etter oppdateringer på dine vegne — så denne appen kan gjøre det selv, hvis du ber den om det.

Å trykke på "Sjekk nå" sender én forespørsel til chatterbox.fans om hvilken versjon som er aktuell. Den forespørselen inneholder bare IP-adressen din og ingenting annet — ingen konto, ingen enhets-ID, ingen melding. Det som kommer tilbake er et versjonsnummer, som sammenlignes på telefonen din med versjonen du kjører; ingenting lastes ned automatisk, og ingenting om denne sjekken skrives inn i samtalen.

Dette har ingen bryter fordi det ikke er noe å slå av: det kjører bare ved trykk og ikke ellers.

Hvis du installerer oppdateringen, erstatter den appen på stedet med samme signeringsnøkkel, akkurat slik en oppdatering fra Google Play ville gjort.`,
    },
  ],

  cs: [
    {
      title: '0. Ve zkratce',
      body: `Text vašich zpráv je šifrován na vašem zařízení a mohou ho číst pouze lidé, kterým ho posíláte. My ho číst nemůžeme, a nemůže ani Google, jehož servery si pronajímáme.

Co vidíme, je, že proběhla konverzace: které účty jsou v ní zapojeny a kdy byly aktivní. Odstranění toho je těžší než šifrování obsahu, a ještě jsme to nedokončili. Tyto zásady přesně říkají, kde tato hranice v současnosti leží.`,
    },
    {
      title: '1. Co je šifrováno end-to-end',
      body: `Šifrováno na vašem zařízení, nečitelné pro nás a pro Google:

• Text vašich zpráv.
• Obsah souborů, fotografií, zvuku a videa, které přikládáte.
• Náhledy odkazů.
• Hlasové a video hovory, které používají povinné DTLS-SRTP WebRTC mezi dvěma zařízeními.

Většina zpráv jeden na jednoho a skupinových zpráv navíc používá ratchet, což znamená, že každá zpráva má svůj vlastní klíč, takže kompromitace vašeho zařízení neodhalí dřívější zprávy. Konverzace, kde klient někoho nezveřejnil novější klíčový materiál, se vrací k jednomu dlouhodobému klíči, který tuto vlastnost nemá. Štítek pod zprávou vám řekne, který skutečně dostala.

Jedna věc tuto hranici překračuje, a to jen když o to požádáte: vyhledání jména na Wikipedii odešle pouze toto jméno, ne zprávu, ze které pochází. Oddíl 6 říká, kdo to dostane, a vyhledávání běží pouze při klepnutí a jinak ne, takže není co vypnout. Shrnutí, překlad a přepis by tuto hranici také překročily — v tomto vydání jsou vypnuty, bez jakéhokoli ovládání kdekoli v aplikaci, které by je zapnulo.`,
    },
    {
      title: '2. Co není šifrováno, a co vidíme',
      body: `Šifrování chrání obsah, ne skutečnost, že konverzace proběhla. Tyto věci leží jasně na našich serverech:

• Kdo je v každé konverzaci a kdy byla vytvořena a naposledy aktivní.
• Časové razítko každé zprávy a kolik jich nemáte přečteno.
• Název souboru přílohy, typ a velikost. Bajty jsou šifrovány; jejich popis ne, a délka šifrovaného textu omezuje délku originálu.
• Vaši přátelé a žádosti o přátelství.
• Signalizace hovoru — že hovor byl uskutečněn, komu a kdy. Ne jeho zvuk nebo video.

Indikátory psaní a potvrzení o přečtení jsou vypnuté, dokud je nezapnete, a dokud jsou vypnuté, nic se nezapisuje.

Co už tady není: vaše e-mailová adresa a jméno. Od září 2026 obsahuje záznam účtu pouze identifikátor účtu — a od té doby neexistuje adresa, kterou by bylo kde uchovávat. Registrace se vás na nic neptá: váš účet je obnovovací fráze o 24 slovech, a přihlašovací údaj, který Firebase Authentication kontroluje, je z ní odvozen. Co ukládá, je náhodný štítek pod doménou, která nemůže přijímat poštu.

Odděleně: protože aplikace běží na Google Firebase, Google vidí IP adresu a čas každého připojení, které vaše zařízení k němu vytvoří. To je vlastnost hostingu, ne aplikace, a nemůžeme to zašifrovat pryč.`,
    },
    {
      title: '3. Jak vás lidé najdou',
      body: `Nemohou vás vyhledat. Neexistuje adresář — žádné vyhledávání podle e-mailu, telefonního čísla nebo jména — a server odmítá jakýkoli dotaz, který se o to pokusí.

Někoho oslovíte tak, že mu mimo kanál pošlete pozvánkový odkaz, prostřednictvím čehokoli, co již používáte. Odkaz funguje jednou, po 24 hodinách vyprší platnost a lze ho odvolat. Jakkoli někoho nazýváte, je to váš vlastní štítek pro něj, uchovávaný pro vás; pokud se představili sami, dostalo se k vám toto jméno zašifrované.`,
    },
    {
      title: '4. Co shromažďujeme',
      body: `• Údaje o účtu: identifikátor účtu a přihlašovací údaj odvozený z vaší obnovovací fráze, uchovávaný ve Firebase Authentication. Žádná e-mailová adresa, žádné telefonní číslo, žádné jméno — registrace se na nic z toho neptá.
• Šifrovaný text zprávy a přílohy, plus metadata v oddílu 2.

To je celý seznam. Neexistuje žádná analytika ani hlášení chyb. Aplikace dříve posílala zobrazení obrazovky do Firebase Analytics a hlášení chyb do Firebase Crashlytics, obě nesla identifikátor vašeho účtu, takže žádné z nich nebylo anonymní; obě jsou nyní pryč, spolu s knihovnami, které je odesílaly. Chyby se vytisknou pouze na vlastním počítači vývojáře během vývoje a nikam jinam nejdou.`,
    },
    {
      title: '5. Kde je to uloženo',
      body: `Na Google Firebase — Firestore, Storage a Authentication — pod bezpečnostními pravidly, která rozhodují, kdo může každý dokument číst a zapisovat.

Na vašem zařízení jsou zprávy uložené v mezipaměti, nastavení a váš PIN zámku aplikace šifrovány klíčem pro jednotlivé zařízení, uchovávaným v úložišti klíčů platformy (iOS Keychain, Android Keystore) namísto v běžném úložišti aplikace.

Soukromý klíč, který dešifruje vaše zprávy, nikdy neopustí vaše zařízení, kromě jako obnovovací fráze, kterou se rozhodnete si zapsat. My ho nedržíme a nemůžeme ho pro vás obnovit. Ztratíte-li ho, zprávy odeslané na toto zařízení již nelze znovu přečíst — nikým, včetně nás.`,
    },
    {
      title: '6. Kdo další dostává data',
      body: `Vaše osobní údaje neprodáváme, neobchodujeme s nimi ani je nepronajímáme. Data se dostávají k:

• Google Firebase — náš poskytovatel hostingu, jak je popsáno výše.
• Cloudflare Realtime — zvuk a obraz hovoru, když se vaše zařízení a zařízení druhé osoby nemohou spojit přímo.
• Wikimedia Foundation — jedno jméno, když na něj klepnete pro vyhledání na Wikipedii.
• Google Cloud Speech-to-Text — zvuk jedné hlasové zprávy, když požádáte o přepis.
• Google Cloud Translation — text jedné zprávy, když požádáte o překlad.
• Cloudflare Workers AI — až posledních 50 zpráv jedné konverzace, když požádáte o shrnutí nebo se na ni zeptáte.

Poslední tři jsou v tomto vydání vypnuty. Nikde v aplikaci není žádné ovládání, které by zapínalo přepis, překlad nebo shrnutí, takže k těmto třem službám nic nedosáhne. Jsou uvedeny místo smazány, protože kód je stále zde a funkce mají v úmyslu se vrátit — a když se vrátí, vrátí se s tímto zveřejněním a výzvou před prvním použitím. Co by se tehdy odesílalo, je odesíláno k vytvoření vašeho výsledku, ne k trénování čehokoli; na našich serverech se neukládá ani přepis, ani překlad.

Vyhledávání na Wikipedii nemá přepínač, protože není co vypnout: běží pouze při klepnutí a jinak ne. Wikipedie dostane pouze toto jedno jméno a vaši IP adresu, stejně jako kdybyste ho sami napsali do jejich vyhledávacího pole — žádný účet, žádná zpráva, žádná konverzace. Co se vrátí, je zobrazeno a neuloženo, a nic o tom se nezapíše do konverzace.

Cloudflare Realtime také nemá přepínač. Většina hovorů to nepotřebuje: dvě zařízení, která se mohou spojit přímo — většina hovorů ve stejné síti — se připojí bez toho a nic se nepřeposílá. Když nemohou — obvykle proto, že jste oba v různých mobilních sítích — již zašifrovaný hovor je přeposlán, místo aby zůstal bez spojení. Co Cloudflare vidí, jsou obě IP adresy, čas hovoru a přibližně kolik dat se přesunulo; zvuk a obraz zůstávají pod stejným šifrováním DTLS-SRTP popsaným v části 2, takže přeposílání je nedešifruje.

Můžeme odhalit, co držíme, pokud to vyžaduje zákon. Co držíme, je seznam v oddílu 2. Nemůžeme poskytnout obsah zpráv, protože ho nemůžeme přečíst.`,
    },
    {
      title: '7. Push oznámení',
      body: `Firebase Cloud Messaging doručuje oznámení. Token vašeho zařízení je uložen v soukromé části vašeho účtu, kterou můžete číst pouze vy.

Oznámení nenesou žádný text zprávy. Vaše zařízení dešifruje zprávu lokálně a sestaví, co vidíte; Google doručuje obálku, ne obsah.`,
    },
    {
      title: '8. Co můžete dělat',
      body: `• Smazat svůj účet z obrazovky Profil. Obsah, který je společnou součástí konverzace — například záznam hovoru — zůstává u druhého účastníka, protože je to i jeho záznam.
• Exportovat svá data z obrazovky Profil.
• Nastavit vypršení zpráv podle konverzace: 1 hodina, 24 hodin, 7 dní nebo 30 dní.
• Zapnout nebo vypnout indikátory psaní a potvrzení o přečtení. Obě jsou ve výchozím nastavení vypnuté.
• Uzamknout aplikaci PINem nebo biometrikou.
• Odvolat pozvánkový odkaz, který jste rozdali.

Pokud byste raději, abychom něco smazali ručně, napište nám.`,
    },
    {
      title: '9. Uchovávání',
      body: `Vaše data uchováváme, dokud váš účet existuje. Smazání účtu je smaže, kromě společně drženého obsahu uvedeného výše. Vypršení podle konverzace odstraňuje zprávy podle harmonogramu, který nastavíte.`,
    },
    {
      title: '10. Omezení, o kterých byste měli vědět',
      body: `Raději bychom vám to řekli, než abyste to zjistili sami.

• Klíčům se důvěřuje při prvním zobrazení. Pokud by někdo nahradil klíč dříve, než jste si kdy vyměnili zprávu, konverzace by se šifrovala nesprávné osobě a vypadala by naprosto normálně. Aplikace vás upozorní, když se klíč později změní, a zobrazí bezpečnostní číslo, které můžete porovnat mimo kanál — ale nic vás nenutí ho porovnávat.
• Jedno zařízení najednou. Vaše obnovovací fráze obnoví klíč, který otevírá vaši historii, takže přihlášení na novém zařízení neztratí to, co jste již obdrželi. Konverzace s forward secrecy používají druhý klíč, který nikdy neopustí zařízení, které ho vytvořilo: ať už se naposledy přihlásilo jakékoli zařízení, je to to, které dosáhnou, a cokoli mezitím zapečetěné pro to druhé tam nelze přesunout.
• Zprávy odeslané před existencí šifrování zůstávají tak, jak byly. Nic nebylo zpětně převedeno.
• Tato aplikace nebyla nezávisle bezpečnostně auditována.`,
    },
    {
      title: '11. Děti',
      body: `Chatterbox není určen pro děti mladší 13 let, a jejich informace vědomě neshromažďujeme. Pokud se domníváte, že nám dítě poskytlo osobní údaje, kontaktujte nás a my je smažeme.`,
    },
    {
      title: '12. Změny',
      body: `Tyto zásady můžeme aktualizovat. Významné změny budou oznámeny v aplikaci a datum nahoře je, kdy se naposledy změnily.`,
    },
    {
      title: '13. Kontakt',
      body: `Dotazy ohledně těchto zásad: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Kontrola novější verze aplikace',
      body: `Google Play není způsob, jakým se tato aplikace dostává do vašeho telefonu s Androidem. Místo toho se stahuje z chatterbox.fans, a obchod, který není součástí tohoto procesu, nemůže kontrolovat aktualizace vaším jménem — takže to může udělat sama tato aplikace, pokud ji o to požádáte.

Klepnutím na „Zkontrolovat nyní" se odešle jeden požadavek na chatterbox.fans s dotazem, jaká verze je aktuální. Tento požadavek nese pouze vaši IP adresu a nic jiného — žádný účet, žádný identifikátor zařízení, žádnou zprávu. To, co se vrátí, je číslo verze, které se na vašem telefonu porovná s verzí, kterou používáte; nic se automaticky nestahuje a nic o této kontrole se nezapisuje do konverzace.

Toto nemá přepínač, protože není co vypínat: spouští se pouze klepnutím, a jinak ne.

Pokud aktualizaci nainstalujete, nahradí aplikaci na místě pomocí stejného podpisového klíče, stejně jako by to udělala aktualizace z Google Play.`,
    },
  ],
  ro: [
    {
      title: '0. Pe scurt',
      body: `Textul mesajelor tale este criptat pe dispozitivul tău și poate fi citit doar de persoanele cărora le trimiți. Noi nu îl putem citi, și nici Google, ale cărui servere le închiriem.

Ce putem vedea este că a avut loc o conversație: ce conturi sunt implicate și când au fost active. Eliminarea acestui lucru este mai dificilă decât criptarea conținutului, și încă nu am terminat. Această politică spune exact unde se află linia în prezent.`,
    },
    {
      title: '1. Ce este criptat integral (end-to-end)',
      body: `Criptat pe dispozitivul tău, ilizibil pentru noi și pentru Google:

• Textul mesajelor tale.
• Conținutul fișierelor, fotografiilor, audio și video pe care le atașezi.
• Previzualizările linkurilor.
• Apelurile audio și video, care folosesc DTLS-SRTP WebRTC obligatoriu între dispozitive.

Majoritatea mesajelor unu-la-unu și de grup folosesc suplimentar un mecanism de tip ratchet, ceea ce înseamnă că fiecare mesaj are propria cheie, astfel încât compromiterea dispozitivului tău nu expune mesajele anterioare. Conversațiile în care un client nu a publicat material de cheie mai nou pentru cineva revin la o singură cheie de lungă durată, care nu are această proprietate. Eticheta de sub un mesaj îți spune pe care a primit-o de fapt.

Un singur lucru traversează această linie, și doar atunci când o ceri: căutarea unui nume pe Wikipedia trimite doar acel nume, nu mesajul din care provine. Secțiunea 6 spune cine primește asta, iar căutarea rulează doar la apăsare și altfel deloc, deci nu este nimic de dezactivat. Rezumarea, traducerea și transcrierea ar traversa de asemenea această linie — sunt dezactivate în această versiune, fără niciun control nicăieri în aplicație care să le activeze.`,
    },
    {
      title: '2. Ce nu este criptat, și ce putem vedea',
      body: `Criptarea protejează conținutul, nu faptul că a avut loc o conversație. Aceste lucruri stau în clar pe serverele noastre:

• Cine este în fiecare conversație, și când a fost creată și activă ultima dată.
• Marcajul temporal al fiecărui mesaj, și câte ai necitite.
• Numele fișierului atașat, tipul și dimensiunea. Octeții sunt criptați; descrierea lor nu, iar lungimea textului cifrat limitează lungimea originalului.
• Prietenii tăi și cererile de prietenie.
• Semnalizarea apelurilor — că a avut loc un apel, cu cine și când. Nu audio sau video-ul său.

Indicatorii de scriere și confirmările de citire sunt dezactivate până le activezi, și cât timp sunt dezactivate, nu se scrie nimic.

Ce nu mai este aici: adresa ta de e-mail și numele. Începând din septembrie 2026, înregistrarea contului conține doar un identificator de cont — și de atunci nu mai există nicio adresă pe care să o dețină. Înregistrarea nu îți cere așa ceva: contul tău este o frază de recuperare din 24 de cuvinte, iar acreditarea pe care Firebase Authentication o verifică este derivată din aceasta. Ce stochează este o etichetă aleatorie sub un domeniu care nu poate primi poștă.

Separat: deoarece aplicația rulează pe Google Firebase, Google poate vedea adresa IP și momentul fiecărei conexiuni pe care dispozitivul tău o face către acesta. Aceasta este o proprietate a găzduirii, nu a aplicației, și nu o putem cripta.`,
    },
    {
      title: '3. Cum te găsesc oamenii',
      body: `Nu te pot căuta. Nu există niciun director — nicio căutare după e-mail, număr de telefon sau nume — iar serverul respinge orice interogare care încearcă asta.

Ajungi la cineva trimițându-i un link de invitație în afara canalului, prin orice folosești deja. Linkul funcționează o singură dată, expiră după 24 de ore și poate fi revocat. Oricum îi spui cuiva este propria ta etichetă pentru el, păstrată pentru tine; dacă s-a prezentat singur, acel nume a ajuns la tine criptat.`,
    },
    {
      title: '4. Ce colectăm',
      body: `• Date de cont: un identificator de cont și o acreditare derivată din fraza ta de recuperare, păstrate în Firebase Authentication. Nicio adresă de e-mail, niciun număr de telefon, niciun nume — înregistrarea nu cere nimic din toate acestea.
• Textul cifrat al mesajelor și atașamentelor, plus metadatele din secțiunea 2.

Aceasta este lista completă. Nu există analiză (analytics) și nicio raportare a erorilor. Aplicația obișnuia să trimită vizualizări de ecran către Firebase Analytics și rapoarte de erori către Firebase Crashlytics, ambele purtând identificatorul contului tău, deci niciuna nu era anonimă; ambele au dispărut acum, împreună cu bibliotecile care le trimiteau. Erorile se afișează doar pe mașina proprie a dezvoltatorului în timpul dezvoltării și nu ajung nicăieri altundeva.`,
    },
    {
      title: '5. Unde este stocat',
      body: `Pe Google Firebase — Firestore, Storage și Authentication — sub reguli de securitate care decid cine poate citi și scrie fiecare document.

Pe dispozitivul tău, mesajele stocate în cache, setările și codul PIN de blocare a aplicației sunt criptate cu o cheie specifică dispozitivului, păstrată în keystore-ul platformei (iOS Keychain, Android Keystore) în loc de stocarea obișnuită a aplicației.

Cheia privată care decriptează mesajele tale nu părăsește niciodată dispozitivul tău, cu excepția frazei de recuperare pe care alegi să o notezi. Noi nu o deținem și nu o putem recupera pentru tine. Dacă o pierzi, mesajele trimise către acel dispozitiv nu mai pot fi citite — de nimeni, inclusiv de noi.`,
    },
    {
      title: '6. Cine altcineva primește date',
      body: `Nu vindem, nu comercializăm și nu închiriem informațiile tale personale. Datele ajung la:

• Google Firebase — furnizorul nostru de găzduire, așa cum este descris mai sus.
• Cloudflare Realtime — sunetul și imaginea unui apel, atunci când dispozitivul dvs. și cel al celeilalte persoane nu se pot conecta direct.
• Wikimedia Foundation — un singur nume, când apeși pentru a-l căuta pe Wikipedia.
• Google Cloud Speech-to-Text — audio-ul unui singur mesaj vocal, când soliciți o transcriere.
• Google Cloud Translation — textul unui singur mesaj, când soliciți o traducere.
• Cloudflare Workers AI — până la ultimele 50 de mesaje ale unei conversații, când soliciți un rezumat sau îi pui o întrebare.

Ultimele trei sunt dezactivate în această versiune. Nu există niciun control nicăieri în aplicație care să activeze transcrierea, traducerea sau rezumarea, deci nimic nu ajunge la aceste trei servicii. Sunt listate în loc de șterse pentru că respectivul cod este încă aici și funcțiile sunt menite să revină — și când o vor face, vor reveni cu această dezvăluire și o solicitare înainte de prima utilizare. Ce s-ar trimite atunci este trimis pentru a produce rezultatul tău, nu pentru a antrena ceva; nici transcrierea, nici traducerea nu sunt stocate pe serverele noastre.

Căutarea pe Wikipedia nu are un comutator, pentru că nu este nimic de dezactivat: rulează doar la apăsare și altfel deloc. Wikipedia primește doar acel nume și adresa ta IP, exact ca și cum l-ai fi tastat tu însuți în propriul lor câmp de căutare — niciun cont, niciun mesaj, nicio conversație. Ce se întoarce este afișat și nu stocat, și nimic despre asta nu este scris în conversație.

Nici Cloudflare Realtime nu are un întrerupător. Majoritatea apelurilor nu au nevoie de el: două dispozitive care se pot conecta direct — majoritatea apelurilor pe aceeași rețea — se conectează fără el, și nimic nu este redirecționat. Când nu pot — de obicei pentru că amândoi sunteți pe rețele mobile diferite — apelul deja criptat este redirecționat în loc să rămână neconectat. Ceea ce vede Cloudflare sunt ambele adrese IP, momentul apelului și aproximativ cât de multe date au fost transferate; sunetul și imaginea rămân sub aceeași criptare DTLS-SRTP descrisă în secțiunea 2, deci redirecționarea nu le decriptează.

Putem dezvălui ce deținem dacă legea o cere. Ce deținem este lista din secțiunea 2. Nu putem produce conținutul mesajelor, pentru că nu îl putem citi.`,
    },
    {
      title: '7. Notificări push',
      body: `Firebase Cloud Messaging livrează notificările. Tokenul dispozitivului tău este stocat într-o parte privată a contului tău pe care doar tu o poți citi.

Notificările nu conțin niciun text de mesaj. Dispozitivul tău decriptează mesajul local și construiește ce vezi; Google livrează plicul, nu conținutul.`,
    },
    {
      title: '8. Ce poți face',
      body: `• Șterge-ți contul din ecranul Profil. Conținutul care face parte comună dintr-o conversație — cum ar fi o înregistrare a unui apel — rămâne la celălalt participant, pentru că este și înregistrarea lui.
• Exportă-ți datele din ecranul Profil.
• Setează expirarea mesajelor per conversație: 1 oră, 24 de ore, 7 zile sau 30 de zile.
• Activează sau dezactivează indicatorii de scriere și confirmările de citire. Ambele sunt dezactivate implicit.
• Blochează aplicația cu un PIN sau biometrie.
• Retrage un link de invitație pe care l-ai distribuit.

Dacă preferi să ștergem noi ceva manual, scrie-ne.`,
    },
    {
      title: '9. Păstrarea datelor',
      body: `Îți păstrăm datele cât timp contul tău există. Ștergerea contului tău le elimină, cu excepția conținutului deținut în comun ca mai sus. Expirarea per conversație elimină mesajele conform programului pe care îl stabilești.`,
    },
    {
      title: '10. Limitări pe care ar trebui să le cunoști',
      body: `Preferăm să-ți spunem noi decât să descoperi singur.

• Cheile sunt de încredere la prima vedere. Dacă cineva a substituit o cheie înainte să faceți vreodată schimb de mesaje, conversația s-ar cripta către persoana greșită și ar arăta complet normal. Aplicația te avertizează când o cheie se schimbă ulterior și afișează un număr de siguranță pe care îl poți compara în afara canalului — dar nimic nu te obligă să-l compari.
• Un singur dispozitiv la un moment dat. Fraza ta de recuperare restaurează cheia care deblochează istoricul tău, deci autentificarea pe un dispozitiv nou nu pierde ce ai primit deja. Conversațiile cu forward secrecy folosesc o a doua cheie care nu părăsește niciodată dispozitivul care a creat-o: oricare dispozitiv s-a autentificat cel mai recent este cel pe care îl ating, iar orice sigilat pentru celălalt între timp nu se poate muta acolo.
• Mesajele trimise înainte ca criptarea să existe rămân așa cum au fost. Nimic nu a fost convertit retroactiv.
• Această aplicație nu a fost auditată independent din punct de vedere al securității.`,
    },
    {
      title: '11. Copii',
      body: `Chatterbox nu este destinat copiilor sub 13 ani, și nu colectăm cu bună știință informațiile lor. Dacă crezi că un copil ne-a furnizat informații personale, contactează-ne și le vom șterge.`,
    },
    {
      title: '12. Modificări',
      body: `Putem actualiza această politică. Modificările semnificative vor fi anunțate în aplicație, iar data de sus este momentul ultimei modificări.`,
    },
    {
      title: '13. Contact',
      body: `Întrebări despre această politică: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Verificarea unei versiuni mai noi a aplicației',
      body: `Google Play nu este modul în care această aplicație ajunge pe telefonul dvs. Android. Este descărcată în schimb de pe chatterbox.fans, iar un magazin care nu face parte din acest proces nu poate verifica actualizările în numele dvs. — deci această aplicație o poate face singură, dacă îi cereți.

Atingerea „Verificați acum" trimite o singură cerere către chatterbox.fans, întrebând care este versiunea actuală. Acea cerere conține doar adresa dvs. IP și nimic altceva — fără cont, fără identificator de dispozitiv, fără mesaj. Ce se întoarce este un număr de versiune, comparat pe telefonul dvs. cu versiunea pe care o rulați; nimic nu este descărcat automat și nimic despre această verificare nu este scris în conversație.

Acest lucru nu are un întrerupător deoarece nu este nimic de oprit: se execută doar la atingere și nu altfel.

Dacă instalați actualizarea, aceasta înlocuiește aplicația pe loc folosind aceeași cheie de semnare, la fel cum ar face-o o actualizare de pe Google Play.`,
    },
  ],
  hu: [
    {
      title: '0. Röviden',
      body: `Üzeneteid szövege a készülékeden titkosított, és csak azok olvashatják, akiknek küldöd. Mi nem tudjuk elolvasni, és a Google sem, akiktől a szervereket béreljük.

Amit látunk, az az, hogy egy beszélgetés megtörtént: mely fiókok vesznek részt benne, és mikor voltak aktívak. Ennek eltávolítása nehezebb, mint a tartalom titkosítása, és még nem fejeztük be. Ez a szabályzat pontosan megmondja, hol húzódik jelenleg a határ.`,
    },
    {
      title: '1. Mi van végpontok között titkosítva',
      body: `A készülékeden titkosított, számunkra és a Google számára olvashatatlan:

• Üzeneteid szövege.
• A csatolt fájlok, fotók, hang- és videótartalmak.
• A hivatkozás-előnézetek.
• A hang- és videóhívások, amelyek kötelező, eszközök közötti DTLS-SRTP WebRTC-t használnak.

A legtöbb egy-az-egyhez és csoportos üzenet emellett egy úgynevezett ratchet mechanizmust is használ, ami azt jelenti, hogy minden üzenetnek saját kulcsa van, így a készüléked feltörése nem fedi fel a korábbi üzeneteket. Azok a beszélgetések, ahol egy kliens nem tett közzé újabb kulcsanyagot valakinek, egyetlen hosszú élettartamú kulcsra esnek vissza, amelynek nincs ez a tulajdonsága. Az üzenet alatti jelvény megmondja, melyiket kapta valójában.

Egyetlen dolog lépi át ezt a határt, és csak akkor, ha kéred: egy név Wikipédián való keresése csak azt a nevet küldi el, nem az üzenetet, amelyből származik. A 6. szakasz elmondja, ki kapja ezt meg, és a keresés csak koppintásra fut, egyébként nem, így nincs mit kikapcsolni. Az összefoglalás, fordítás és átirat készítése szintén átlépné ezt a határt — ebben a kiadásban ki vannak kapcsolva, és az alkalmazásban sehol nincs olyan vezérlő, amely bekapcsolná őket.`,
    },
    {
      title: '2. Mi nincs titkosítva, és mit láthatunk',
      body: `A titkosítás a tartalmat védi, nem azt a tényt, hogy egy beszélgetés megtörtént. Ezek a dolgok nyíltan állnak a szervereinken:

• Ki van benne minden beszélgetésben, és mikor jött létre, illetve mikor volt utoljára aktív.
• Minden üzenet időbélyege, és hogy hány olvasatlan van.
• A melléklet fájlneve, típusa és mérete. A bájtok titkosítottak; a leírásuk nem, és a titkosított szöveg hossza korlátozza az eredeti hosszát.
• A barátaid és a barátkérelmek.
• A hívás jelzése — hogy egy hívás megtörtént, kivel és mikor. Nem annak hangja vagy videója.

A gépelésjelzők és az olvasási visszaigazolások ki vannak kapcsolva, amíg be nem kapcsolod őket, és amíg ki vannak kapcsolva, semmi nem kerül rögzítésre.

Ami már nincs itt: az e-mail-címed és a neved. 2026 szeptemberétől a fiók bejegyzése csak egy fiókazonosítót tartalmaz — és azóta nincs is cím, amit tárolni lehetne. A regisztráció nem kér ilyet: a fiókod egy 24 szavas helyreállítási mondat, és a Firebase Authentication által ellenőrzött hitelesítő adat ebből származik. Amit tárol, az egy véletlenszerű címke egy olyan domain alatt, amely nem tud postát fogadni.

Külön: mivel az alkalmazás a Google Firebase-en fut, a Google láthatja az IP-címet és minden kapcsolat időzítését, amelyet a készüléked hozzá létesít. Ez a hosztolás tulajdonsága, nem az alkalmazásé, és ezt nem tudjuk titkosítással eltüntetni.`,
    },
    {
      title: '3. Hogyan találnak meg téged az emberek',
      body: `Nem kereshetnek rád. Nincs névjegyzék — nincs keresés e-mail, telefonszám vagy név alapján —, és a szerver elutasít minden erre irányuló lekérdezést.

Valakit úgy érsz el, hogy egy meghívólinket küldesz neki a csatornán kívül, bármin keresztül, amit már használsz. A link egyszer működik, 24 óra után lejár, és visszavonható. Bárhogy is nevezel valakit, az a saját címkéd rá, neked megőrizve; ha ő mutatkozott be, az a név titkosítva érkezett hozzád.`,
    },
    {
      title: '4. Mit gyűjtünk',
      body: `• Fiókadatok: egy fiókazonosító és egy, a helyreállítási mondatodból származó hitelesítő adat, a Firebase Authentication-ben tárolva. Nincs e-mail-cím, nincs telefonszám, nincs név — a regisztráció ezek egyikét sem kéri.
• Az üzenetek és mellékletek titkosított szövege, plusz a 2. szakaszban leírt metaadatok.

Ez a teljes lista. Nincs elemzés (analytics) és nincs hibajelentés. Az alkalmazás korábban képernyőnézeteket küldött a Firebase Analyticsnek és hibajelentéseket a Firebase Crashlyticsnek, mindkettő a fiókazonosítódat hordozta, így egyik sem volt anonim; mindkettő megszűnt már, az őket küldő könyvtárakkal együtt. A hibák csak a fejlesztő saját gépén jelennek meg fejlesztés közben, és sehova máshova nem jutnak el.`,
    },
    {
      title: '5. Hol van tárolva',
      body: `A Google Firebase-en — Firestore, Storage és Authentication —, olyan biztonsági szabályok alatt, amelyek eldöntik, ki olvashatja és írhatja az egyes dokumentumokat.

A készülékeden a gyorsítótárazott üzenetek, a beállítások és az alkalmazászár PIN-kódod egy eszközönkénti kulccsal vannak titkosítva, amelyet a platform kulcstárolójában (iOS Keychain, Android Keystore) tartunk, nem a szokásos alkalmazástárolóban.

A magánkulcs, amely dekódolja üzeneteidet, soha nem hagyja el a készülékedet, kivéve a helyreállítási mondat formájában, amelyet leírhatsz. Mi nem tartjuk meg, és nem tudjuk helyreállítani neked. Ha elveszíted, az arra a készülékre küldött üzenetek többé nem olvashatók el — senki által, minket is beleértve.`,
    },
    {
      title: '6. Ki más kap adatot',
      body: `Nem adjuk el, nem cseréljük és nem béreljük ki a személyes adataidat. Az adatok eljutnak:

• A Google Firebase-hez — a fent leírt hosztolási szolgáltatónkhoz.
• Cloudflare Realtime — egy hívás hangja és videója, amikor a te eszközöd és a másik személy eszköze nem tudja közvetlenül elérni egymást.
• A Wikimedia Foundationhöz — egyetlen névhez, amikor rákoppintasz a Wikipédián való kereséshez.
• A Google Cloud Speech-to-Texthez — egyetlen hangüzenet hangjához, amikor átiratot kérsz.
• A Google Cloud Translationhöz — egyetlen üzenet szövegéhez, amikor fordítást kérsz.
• A Cloudflare Workers AI-hoz — egy beszélgetés utolsó legfeljebb 50 üzenetéhez, amikor összefoglalást kérsz, vagy kérdezel tőle.

Az utolsó három ebben a kiadásban ki van kapcsolva. Az alkalmazásban sehol nincs olyan vezérlő, amely bekapcsolná az átiratkészítést, a fordítást vagy az összefoglalást, így semmi nem jut el ehhez a három szolgáltatáshoz. Azért vannak felsorolva, nem törölve, mert a kód még mindig itt van, és a funkciók célja a visszatérés — és amikor visszatérnek, ezzel a nyilatkozattal és egy, az első használat előtti felszólítással térnek vissza. Amit akkor küldenénk, azt az eredményed előállítására küldenénk, nem bármi betanítására; sem az átirat, sem a fordítás nincs tárolva a szervereinken.

A Wikipédia-keresésnek nincs kapcsolója, mert nincs mit kikapcsolni: csak koppintásra fut, egyébként nem. A Wikipédia csak azt az egy nevet és az IP-címedet kapja meg, pontosan úgy, mintha te magad gépelted volna be a saját keresőmezőjükbe — nincs fiók, nincs üzenet, nincs beszélgetés. Ami visszajön, az megjelenik és nincs tárolva, és semmi nem kerül belőle a beszélgetésbe.

A Cloudflare Realtime-nak sincs kapcsolója. A legtöbb hívásnak nincs is rá szüksége: két eszköz, amely közvetlenül eléri egymást — a legtöbb hívás ugyanazon a hálózaton — enélkül is kapcsolódik, és semmi sem kerül továbbításra. Amikor nem tudják — jellemzően azért, mert mindketten különböző mobilhálózaton vagytok —, a már titkosított hívás továbbításra kerül ahelyett, hogy kapcsolat nélkül maradna. Amit a Cloudflare lát, az mindkét fél IP-címe, a hívás időpontja, és hozzávetőlegesen mennyi adat mozgott; a hang és a videó ugyanazon, a 2. szakaszban leírt DTLS-SRTP titkosítás alatt marad, így a továbbítás nem fejti vissza őket.

Felfedhetjük, amit tartunk, ha a törvény ezt megköveteli. Amit tartunk, az a 2. szakaszban lévő lista. Az üzenetek tartalmát nem tudjuk kiadni, mert nem tudjuk elolvasni.`,
    },
    {
      title: '7. Push-értesítések',
      body: `A Firebase Cloud Messaging kézbesíti az értesítéseket. A készülékazonosítód a fiókod egy privát részében van tárolva, amelyet csak te olvashatsz.

Az értesítések nem tartalmaznak üzenetszöveget. A készüléked helyben dekódolja az üzenetet, és felépíti, amit látsz; a Google a borítékot kézbesíti, nem a tartalmat.`,
    },
    {
      title: '8. Mit tehetsz',
      body: `• Töröld a fiókodat a Profil képernyőről. A beszélgetés közös részét képező tartalom — például egy híváslejegyzés — a másik résztvevőnél marad, mert az az ő feljegyzése is.
• Exportáld az adataidat a Profil képernyőről.
• Állítsd be az üzenetek lejáratát beszélgetésenként: 1 óra, 24 óra, 7 nap vagy 30 nap.
• Kapcsold be vagy ki a gépelésjelzőket és az olvasási visszaigazolásokat. Mindkettő alapértelmezetten ki van kapcsolva.
• Zárold az alkalmazást PIN-kóddal vagy biometrikus azonosítással.
• Vonj vissza egy általad kiadott meghívólinket.

Ha inkább azt szeretnéd, hogy kézzel töröljünk valamit, írj nekünk.`,
    },
    {
      title: '9. Megőrzés',
      body: `Az adataidat addig őrizzük meg, amíg a fiókod létezik. A fiókod törlése eltávolítja azokat, kivéve a fent említett közösen tartott tartalmat. A beszélgetésenkénti lejárat az általad beállított ütemezés szerint távolítja el az üzeneteket.`,
    },
    {
      title: '10. Korlátok, amelyekről tudnod kell',
      body: `Inkább elmondjuk neked, minthogy magadtól fedezd fel.

• A kulcsok az első látásra megbízhatók. Ha valaki egy kulcsot kicserélt volna, mielőtt valaha üzenetet váltottatok volna, a beszélgetés a rossz személyhez titkosítana, és teljesen normálisnak tűnne. Az alkalmazás figyelmeztet, ha egy kulcs később megváltozik, és megjelenít egy biztonsági számot, amelyet a csatornán kívül összehasonlíthatsz — de semmi nem kényszerít arra, hogy összehasonlítsd.
• Egyszerre egy készülék. A helyreállítási mondatod visszaállítja azt a kulcsot, amely megnyitja az előzményeidet, így az új készüléken való bejelentkezés nem veszíti el, amit már megkaptál. A forward secrecy-vel rendelkező beszélgetések egy második kulcsot használnak, amely soha nem hagyja el az azt létrehozó készüléket: amelyik készülék legutóbb jelentkezett be, az az, amelyiket elérik, és bármi, ami közben a másiknak lett lezárva, oda nem tud átkerülni.
• A titkosítás létezése előtt küldött üzenetek olyanok maradnak, amilyenek voltak. Semmi nem lett visszamenőlegesen konvertálva.
• Ezt az alkalmazást nem auditálta függetlenül biztonsági szempontból.`,
    },
    {
      title: '11. Gyermekek',
      body: `A Chatterbox nem 13 év alatti gyermekeknek készült, és tudatosan nem gyűjtjük az adataikat. Ha úgy gondolod, hogy egy gyermek személyes adatokat adott meg nekünk, lépj kapcsolatba velünk, és töröljük azokat.`,
    },
    {
      title: '12. Változások',
      body: `Frissíthetjük ezt a szabályzatot. A jelentős változásokról az alkalmazásban tájékoztatunk, és a tetején lévő dátum mutatja, mikor változott utoljára.`,
    },
    {
      title: '13. Kapcsolat',
      body: `Kérdések ezzel a szabályzattal kapcsolatban: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Újabb alkalmazásverzió keresése',
      body: `A Google Play nem az a mód, ahogyan ez az alkalmazás eljut az Android telefonodra. Ehelyett a chatterbox.fans oldalról töltődik le, és egy áruház, amely nem vesz részt ebben a folyamatban, nem tud a nevedben frissítéseket keresni — így ezt maga az alkalmazás is megteheti, ha megkéred rá.

A "Ellenőrzés most" megérintése egyetlen kérést küld a chatterbox.fans-nak, megkérdezve, melyik verzió az aktuális. Ez a kérés csak az IP-címedet hordozza, semmi mást — nincs fiók, nincs eszközazonosító, nincs üzenet. Ami visszaérkezik, az egy verziószám, amelyet a telefonodon összehasonlítanak a futtatott verzióval; semmi sem töltődik le automatikusan, és semmi nem kerül be a beszélgetésbe erről az ellenőrzésről.

Ennek nincs kapcsolója, mert nincs mit kikapcsolni: csak érintésre fut, máskor nem.

Ha telepíted a frissítést, az ugyanazzal az aláírási kulccsal cseréli le az alkalmazást a helyén, ugyanúgy, ahogy egy Google Play-es frissítés is tenné.`,
    },
  ],
  kk: [
    {
      title: '0. Қысқаша',
      body: `Хабарламаларыңыздың мәтіні құрылғыңызда шифрланған және оны тек сіз жіберген адамдар ғана оқи алады. Біз оны оқи алмаймыз, серверлерін жалдап отырған Google та оқи алмайды.

Біз көре алатыны — әңгіме болғаны: онда қандай аккаунттар бар және олар қашан белсенді болғаны. Мұны алып тастау мазмұнды шифрлаудан қиынырақ, және біз әлі бітірген жоқпыз. Бұл саясат сызықтың дәл қазір қай жерде екенін айтады.`,
    },
    {
      title: '1. Соңынан соңына дейін не шифрланған',
      body: `Құрылғыңызда шифрланған, біз үшін де, Google үшін де оқылмайды:

• Хабарламаларыңыздың мәтіні.
• Тіркейтін файлдардың, фотосуреттердің, аудио мен бейненің мазмұны.
• Сілтеме алдын ала қарау көріністері.
• Дауыстық және бейне қоңыраулар, олар құрылғылар арасында міндетті DTLS-SRTP WebRTC пайдаланады.

Көптеген бір-біреуге және топтық хабарламалар қосымша ратчет механизмін пайдаланады, яғни әр хабарламаның өз кілті бар, сондықтан құрылғыңыздың бұзылуы бұрынғы хабарламаларды ашпайды. Клиент біреу үшін жаңа кілт материалын жарияламаған әңгімелер осы қасиеті жоқ жалғыз ұзақ мерзімді кілтке оралады. Хабарламаның астындағы белгі оның нақты қайсысын алғанын айтады.

Тек бір нәрсе осы сызықтан өтеді, тек сіз сұрағанда ғана: Википедиядан атты іздеу тек сол атты жібереді, ол шыққан хабарламаны емес. 6-бөлім оны кім алатынын айтады, ал іздеу тек түртілгенде іске қосылады және басқаша жоқ, сондықтан өшіретін ештеңе жоқ. Қысқаша мазмұндау, аудару және мәтінге түсіру де осы сызықтан өтер еді — олар осы шығарылымда өшірулі, қолданбада оларды қосатын ешбір басқару элементі жоқ.`,
    },
    {
      title: '2. Не шифрланбаған және біз не көре аламыз',
      body: `Шифрлау мазмұнды қорғайды, әңгіме болған фактіні емес. Мына нәрселер біздің серверлерімізде ашық жатыр:

• Әр әңгімеде кім бар, ол қашан құрылған және соңғы рет қашан белсенді болған.
• Әр хабарламаның уақыт белгісі, және сізде қанша оқылмағаны бар.
• Тіркеменің файл аты, түрі және өлшемі. Байттар шифрланған; олардың сипаттамасы жоқ, және шифрланған мәтіннің ұзындығы түпнұсқаның ұзындығын шектейді.
• Достарыңыз бен достық сұраулары.
• Қоңырау сигналдары — қоңырау болғаны, кіммен және қашан. Оның аудиосы немесе бейнесі емес.

Теру көрсеткіштері мен оқылғаны туралы растаулар сіз оларды қоспағанша өшірулі, және олар өшірулі кезде ештеңе жазылмайды.

Енді мұнда жоғы: электрондық пошта мекенжайыңыз бен атыңыз. 2026 жылдың қыркүйегінен бастап аккаунт жазбасында тек аккаунт идентификаторы ғана бар — және содан бері оның ұстайтын мекенжайы жоқ. Тіркелу сізден мұны сұрамайды: аккаунтыңыз 24 сөзден тұратын қалпына келтіру фразасы, ал Firebase Authentication тексеретін тіркелгі деректері одан алынады. Ол сақтайтыны — пошта қабылдай алмайтын домен астындағы кездейсоқ белгі.

Бөлек: қолданба Google Firebase-де жұмыс істейтіндіктен, Google құрылғыңыз оған жасайтын әрбір қосылымның IP мекенжайы мен уақытын көре алады. Бұл хостингтің қасиеті, қолданбаныкі емес, және біз оны шифрлап жасыра алмаймыз.`,
    },
    {
      title: '3. Адамдар сізді қалай табады',
      body: `Олар сізді іздей алмайды. Каталог жоқ — электрондық пошта, телефон нөмірі немесе аты бойынша іздеу жоқ — және сервер мұны көздейтін кез келген сұрауды қабылдамайды.

Сіз біреуге арна сыртында, қазірдің өзінде пайдаланатын кез келген нәрсе арқылы шақыру сілтемесін жіберу арқылы жетесіз. Сілтеме бір рет жұмыс істейді, 24 сағаттан кейін мерзімі бітеді және қайтарып алуға болады. Біреуді қалай атасаңыз да, бұл сіз үшін сақталған сіздің өз белгіңіз; егер ол өзін таныстырса, бұл ат сізге шифрланған түрде жетті.`,
    },
    {
      title: '4. Біз нені жинаймыз',
      body: `• Аккаунт деректері: аккаунт идентификаторы және қалпына келтіру фразаңыздан алынған, Firebase Authentication-де сақталатын тіркелгі деректері. Электрондық пошта мекенжайы жоқ, телефон нөмірі жоқ, ат жоқ — тіркелу мұның бірде-бірін сұрамайды.
• Хабарламалар мен тіркемелердің шифрланған мәтіні, оған қоса 2-бөлімдегі метадеректер.

Бұл толық тізім. Аналитика да, ақаулар туралы есеп беру де жоқ. Қолданба бұрын экран көріністерін Firebase Analytics-ке және ақаулар туралы есептерді Firebase Crashlytics-ке жіберетін, екеуі де аккаунт идентификаторыңызды алып жүретін, сондықтан ешқайсысы анонимді болмады; екеуі де енді жоқ, оларды жіберген кітапханалармен бірге. Қателер тек әзірлеу кезінде әзірлеушінің өз машинасында басылады және басқа ешжерге бармайды.`,
    },
    {
      title: '5. Ол қайда сақталады',
      body: `Google Firebase-де — Firestore, Storage және Authentication — әр құжатты кім оқи және жаза алатынын шешетін қауіпсіздік ережелерінің астында.

Құрылғыңызда кэштелген хабарламалар, параметрлер және қолданба құлпыңыздың PIN коды әдеттегі қолданба сақтауының орнына платформаның кілт қоймасында (iOS Keychain, Android Keystore) сақталатын құрылғыға тән кілтпен шифрланған.

Хабарламаларыңызды шешетін жеке кілт сіз жазып алуды таңдаған қалпына келтіру фразасынан басқа ешқашан құрылғыңыздан шықпайды. Біз оны ұстамаймыз және сіз үшін қалпына келтіре алмаймыз. Егер оны жоғалтсаңыз, сол құрылғыға жіберілген хабарламаларды ешкім, соның ішінде біз де, қайта оқи алмайды.`,
    },
    {
      title: '6. Тағы кім деректер алады',
      body: `Біз сіздің жеке ақпаратыңызды сатпаймыз, саудаламаймыз және жалдамаймыз. Деректер мыналарға жетеді:

• Google Firebase — жоғарыда сипатталғандай біздің хостинг провайдеріміз.
• Cloudflare Realtime — құрылғыңыз бен әңгімелесушінің құрылғысы бір-біріне тікелей жете алмаған кездегі қоңыраудың аудио және видеосы.
• Wikimedia Foundation — Википедиядан іздеу үшін түрткенде бір ат.
• Google Cloud Speech-to-Text — мәтінге түсіруді сұрағанда бір дауыстық хабарламаның аудиосы.
• Google Cloud Translation — аударманы сұрағанда бір хабарламаның мәтіні.
• Cloudflare Workers AI — қысқаша мазмұндауды сұрағанда немесе одан сұрақ қойғанда бір әңгіменің соңғы 50 хабарламасына дейін.

Соңғы үшеуі осы шығарылымда өшірулі. Қолданбада мәтінге түсіруді, аударманы немесе қысқаша мазмұндауды қосатын ешбір басқару элементі жоқ, сондықтан осы үш қызметке ештеңе жетпейді. Олар жойылған емес, тізімделген, себебі код әлі осында және мүмкіндіктер қайта оралуға тиіс — және олар қайтқанда, осы ашумен және алғаш пайдаланар алдында сұраумен қайтады. Сол кезде жіберілетін нәрсе кез келгенді үйрету үшін емес, нәтижеңізді шығару үшін жіберіледі; не транскрипт, не аударма біздің серверлерімізде сақталмайды.

Википедия іздеуінің қосқышы жоқ, себебі өшіретін ештеңе жоқ: ол тек түртілгенде іске қосылады және басқаша жоқ. Википедия тек сол бір атты және сіздің IP мекенжайыңызды алады, дәл сіз оны олардың өз іздеу өрісіне өзіңіз теріп жазғандай — аккаунт жоқ, хабарлама жоқ, әңгіме жоқ. Қайтарылған нәрсе көрсетіледі және сақталмайды, және ол туралы ештеңе әңгімеге жазылмайды.

Cloudflare Realtime-де де ауыстырып-қосқыш жоқ. Қоңыраулардың көпшілігіне бұл қажет емес: бір-біріне тікелей жете алатын екі құрылғы — бір желідегі қоңыраулардың көпшілігі — онсыз қосылады, және ешнәрсе ретрансляцияланбайды. Олар жете алмаған кезде — әдетте екеуіңіз де әртүрлі мобильді желіде болғандықтан — қазірдің өзінде шифрланған қоңырау байланыссыз қалудың орнына ретрансляцияланады. Cloudflare көретіні — екі жақтың да IP мекенжайлары, қоңырау уақыты және шамамен қанша дерек жылжығаны; аудио мен видео 2-бөлімде сипатталған сол DTLS-SRTP шифрлауының астында қалады, сондықтан ретрансляциялау оларды дешифрламайды.

Заң талап етсе, біз ұстап тұрған нәрсені аша аламыз. Біз ұстап тұрғаны — 2-бөлімдегі тізім. Хабарлама мазмұнын бере алмаймыз, себебі оны оқи алмаймыз.`,
    },
    {
      title: '7. Push хабарландырулары',
      body: `Firebase Cloud Messaging хабарландыруларды жеткізеді. Құрылғы токеніңіз тек өзіңіз оқи алатын аккаунтыңыздың жеке бөлігінде сақталады.

Хабарландырулар ешбір хабарлама мәтінін алып жүрмейді. Құрылғыңыз хабарламаны жергілікті түрде шешеді және сіз көретінді құрастырады; Google хатты жеткізеді, мазмұнды емес.`,
    },
    {
      title: '8. Сіз не істей аласыз',
      body: `• Профиль экранынан аккаунтыңызды жойыңыз. Әңгіменің ортақ бөлігі болып табылатын мазмұн — мысалы, қоңырау жазбасы — екінші қатысушыда қалады, себебі бұл оның да жазбасы.
• Профиль экранынан деректеріңізді экспорттаңыз.
• Хабарлама мерзімін әр әңгіме бойынша орнатыңыз: 1 сағат, 24 сағат, 7 күн немесе 30 күн.
• Теру көрсеткіштері мен оқылғаны туралы растауларды қосыңыз немесе өшіріңіз. Екеуі де әдепкі бойынша өшірулі.
• Қолданбаны PIN кодымен немесе биометриямен құлыптаңыз.
• Сіз таратқан шақыру сілтемесін қайтарып алыңыз.

Егер бір нәрсені қолмен жойғанымызды қаласаңыз, бізге жазыңыз.`,
    },
    {
      title: '9. Сақтау мерзімі',
      body: `Аккаунтыңыз бар кезде деректеріңізді сақтаймыз. Аккаунтыңызды жою жоғарыдағыдай бірлесіп ұсталатын мазмұннан басқасын жояды. Әр әңгіме бойынша мерзім хабарламаларды сіз орнатқан кесте бойынша жояды.`,
    },
    {
      title: '10. Білуіңіз керек шектеулер',
      body: `Сізге өзіңіз біліп алғаннан гөрі, өзіміз айтқанды жөн көреміз.

• Кілттер алғаш көргенде сенімді деп есептеледі. Егер біреу сіз ешқашан хабарласпай тұрып кілтті ауыстырса, әңгіме дұрыс емес адамға шифрланады және мүлдем қалыпты көрінеді. Қолданба кілт кейін өзгергенде сізді ескертеді және арнадан тыс салыстыруға болатын қауіпсіздік нөмірін көрсетеді — бірақ ештеңе сізді оны салыстыруға мәжбүрлемейді.
• Бір уақытта бір құрылғы. Қалпына келтіру фразаңыз тарихыңызды ашатын кілтті қалпына келтіреді, сондықтан жаңа құрылғыда кіру сіз бұрын алғанды жоғалтпайды. Тікелей құпиялылығы бар әңгімелер оны жасаған құрылғыдан ешқашан шықпайтын екінші кілтті пайдаланады: соңғы рет кірген қай құрылғы болса, олар соған жетеді, ал аралықта екіншісіне мөрленген кез келген нәрсе оған көше алмайды.
• Шифрлау болмай тұрып жіберілген хабарламалар бұрынғыдай қалады. Ештеңе кейін өзгертілмеді.
• Бұл қолданба тәуелсіз қауіпсіздік аудитінен өткен жоқ.`,
    },
    {
      title: '11. Балалар',
      body: `Chatterbox 13 жасқа толмаған балаларға арналмаған, және біз олардың ақпаратын білместен жинамаймыз. Егер бала бізге жеке ақпарат бергенін білсеңіз, бізбен байланысыңыз, біз оны жоямыз.`,
    },
    {
      title: '12. Өзгерістер',
      body: `Біз бұл саясатты жаңарта аламыз. Маңызды өзгерістер қолданбада хабарланады, ал жоғарыдағы күн оның соңғы рет қашан өзгергенін көрсетеді.`,
    },
    {
      title: '13. Байланыс',
      body: `Осы саясат туралы сұрақтар: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Қолданбаның жаңа нұсқасын тексеру',
      body: `Google Play — бұл қолданбаның Android телефоныңызға жету жолы емес. Ол оның орнына chatterbox.fans сайтынан жүктеледі, ал бұл процеске қатыспайтын дүкен сіздің атыңыздан жаңартуларды тексере алмайды — сондықтан сіз сұрасаңыз, бұл қолданба мұны өзі жасай алады.

«Қазір тексеру» түймесін басу chatterbox.fans сайтына ағымдағы нұсқа қандай екенін сұрайтын бір ғана сұрау жібереді. Бұл сұрауда тек сіздің IP мекенжайыңыз бар, басқа ештеңе жоқ — есептік жазба жоқ, құрылғы идентификаторы жоқ, хабарлама жоқ. Қайтарылатыны — телефоныңызда қазір іске қосылған нұсқамен салыстырылатын нұсқа нөмірі; ештеңе автоматты түрде жүктелмейді және осы тексеру туралы ештеңе әңгімеге жазылмайды.

Мұның ауыстырып-қосқышы жоқ, себебі өшіретін ештеңе жоқ: ол тек басқан кезде іске қосылады, басқаша емес.

Егер жаңартуды орнатсаңыз, ол қолданбаны сол жерде дәл сол қол қою кілтін пайдаланып ауыстырады, Google Play-ден келетін жаңарту сияқты дәл солай.`,
    },
  ],
  uz: [
    {
      title: '0. Qisqacha',
      body: `Xabarlaringiz matni qurilmangizda shifrlangan va uni faqat siz yuborgan kishilar o'qiy oladi. Biz uni o'qiy olmaymiz, serverlarini ijaraga olayotgan Google ham o'qiy olmaydi.

Biz ko'ra oladigan narsa — suhbat bo'lganligi: unda qaysi akkauntlar borligi va ular qachon faol bo'lgani. Buni olib tashlash mazmunni shifrlashdan qiyinroq, va biz hali tugatganimiz yo'q. Ushbu siyosat chegara hozir aynan qayerda ekanini aytadi.`,
    },
    {
      title: "1. Uchidan uchigacha nima shifrlangan",
      body: `Qurilmangizda shifrlangan, biz uchun ham, Google uchun ham o'qib bo'lmaydi:

• Xabarlaringiz matni.
• Biriktirgan fayllar, fotosuratlar, audio va videoning mazmuni.
• Havola oldindan ko'rishlari.
• Qurilmalar orasida majburiy DTLS-SRTP WebRTC ishlatadigan ovozli va video qo'ng'iroqlar.

Ko'pgina bir-birov va guruh xabarlari qo'shimcha ravishda ratchet mexanizmini ishlatadi, ya'ni har bir xabarning o'z kaliti bor, shuning uchun qurilmangizning buzilishi oldingi xabarlarni ochib bermaydi. Klient kimdir uchun yangiroq kalit materialini e'lon qilmagan suhbatlar bu xususiyatga ega bo'lmagan yagona uzoq muddatli kalitga qaytadi. Xabar ostidagi belgi u aslida qaysi birini olganini aytadi.

Faqat bitta narsa shu chegaradan o'tadi, faqat siz so'raganda: Vikipediyadan ismni qidirish faqat o'sha ismni yuboradi, u kelib chiqqan xabarni emas. 6-bo'lim buni kim olishini aytadi, va qidiruv faqat bosilganda ishlaydi va boshqacha yo'q, shuning uchun o'chiradigan hech narsa yo'q. Qisqacha bayon qilish, tarjima qilish va matnga aylantirish ham shu chegaradan o'tar edi — ular ushbu versiyada o'chirilgan, ilovada ularni yoqadigan hech qanday boshqaruv yo'q.`,
    },
    {
      title: '2. Nima shifrlanmagan va biz nimani ko\'ra olamiz',
      body: `Shifrlash mazmunni himoya qiladi, suhbat bo'lgan faktni emas. Quyidagi narsalar serverlarimizda ochiq holda yotadi:

• Har bir suhbatda kim borligi va u qachon yaratilgani hamda oxirgi marta qachon faol bo'lgani.
• Har bir xabarning vaqt belgisi va sizda nechta o'qilmagan borligi.
• Biriktirmaning fayl nomi, turi va hajmi. Baytlar shifrlangan; ularning tavsifi shifrlanmagan, va shifrlangan matnning uzunligi asl nusxaning uzunligini cheklaydi.
• Do'stlaringiz va do'stlik so'rovlari.
• Qo'ng'iroq signalizatsiyasi — qo'ng'iroq bo'lgani, kim bilan va qachon. Uning ovozi yoki videosi emas.

Yozayotganlik ko'rsatkichlari va o'qilganlik tasdiqlari siz ularni yoqmaguningizcha o'chirilgan, va ular o'chirilgan paytda hech narsa yozilmaydi.

Endi bu yerda yo'q narsa: elektron pochta manzilingiz va ismingiz. 2026-yil sentyabridan boshlab akkaunt yozuvida faqat akkaunt identifikatori bor — va o'shandan beri uning saqlaydigan manzili yo'q. Ro'yxatdan o'tish sizdan buni so'ramaydi: akkauntingiz 24 so'zdan iborat tiklash iborasi, va Firebase Authentication tekshiradigan hisob ma'lumoti undan olinadi. U saqlaydigan narsa — pochta qabul qila olmaydigan domen ostidagi tasodifiy yorliq.

Alohida: ilova Google Firebase'da ishlagani uchun, Google qurilmangiz unga qiladigan har bir ulanishning IP manzili va vaqtini ko'ra oladi. Bu xosting xususiyati, ilovaniki emas, va biz buni shifrlash bilan yo'qota olmaymiz.`,
    },
    {
      title: '3. Odamlar sizni qanday topadi',
      body: `Ular sizni qidira olmaydi. Katalog yo'q — elektron pochta, telefon raqami yoki ism bo'yicha qidiruv yo'q — va server buni sinaydigan har qanday so'rovni rad etadi.

Siz kimgadir kanaldan tashqarida, allaqachon ishlatayotgan har qanday narsa orqali taklif havolasini yuborish orqali murojaat qilasiz. Havola bir marta ishlaydi, 24 soatdan keyin muddati tugaydi va bekor qilinishi mumkin. Kimnidir qanday nomlashingizdan qat'iy nazar, bu siz uchun saqlanadigan sizning o'z yorlig'ingiz; agar u o'zini tanishtirgan bo'lsa, bu ism sizga shifrlangan holda yetib kelgan.`,
    },
    {
      title: '4. Biz nimalarni to\'playmiz',
      body: `• Akkaunt ma'lumotlari: akkaunt identifikatori va tiklash iborangizdan olingan, Firebase Authentication'da saqlanadigan hisob ma'lumoti. Elektron pochta manzili yo'q, telefon raqami yo'q, ism yo'q — ro'yxatdan o'tish bularning birortasini ham so'ramaydi.
• Xabarlar va biriktirmalarning shifrlangan matni, hamda 2-bo'limdagi metama'lumotlar.

Bu to'liq ro'yxat. Analitika ham, xatoliklar haqida hisobot ham yo'q. Ilova ilgari ekran ko'rinishlarini Firebase Analytics'ga va xatolik hisobotlarini Firebase Crashlytics'ga yuborar edi, ikkalasi ham akkaunt identifikatoringizni olib yurar edi, shuning uchun ularning hech biri anonim emas edi; ikkalasi ham endi yo'q, ularni yuborgan kutubxonalar bilan birga. Xatolar faqat ishlab chiqish paytida dasturchining o'z kompyuterida chop etiladi va boshqa hech qayerga bormaydi.`,
    },
    {
      title: '5. U qayerda saqlanadi',
      body: `Google Firebase'da — Firestore, Storage va Authentication — har bir hujjatni kim o'qiy va yoza olishini hal qiladigan xavfsizlik qoidalari ostida.

Qurilmangizda keshlangan xabarlar, sozlamalar va ilova qulfingizning PIN kodi odatiy ilova xotirasi o'rniga platforma kalit ombori (iOS Keychain, Android Keystore) da saqlanadigan qurilmaga xos kalit bilan shifrlangan.

Xabarlaringizni shifrdan chiqaradigan shaxsiy kalit siz yozib qo'yishni tanlagan tiklash iborasidan boshqa hech qachon qurilmangizdan chiqmaydi. Biz uni saqlamaymiz va siz uchun tiklay olmaymiz. Agar uni yo'qotsangiz, o'sha qurilmaga yuborilgan xabarlarni hech kim, shu jumladan biz ham, qayta o'qiy olmaydi.`,
    },
    {
      title: '6. Yana kim ma\'lumot oladi',
      body: `Biz shaxsiy ma'lumotlaringizni sotmaymiz, savdo qilmaymiz va ijaraga bermaymiz. Ma'lumotlar quyidagilarga yetib boradi:

• Google Firebase — yuqorida tavsiflangan bizning xosting provayderimiz.
• Cloudflare Realtime — qurilmangiz va suhbatdoshingiz qurilmasi bir-biriga to'g'ridan-to'g'ri ulana olmaganda, qo'ng'iroqning audio va videosi.
• Wikimedia Foundation — Vikipediyada qidirish uchun bosganingizda bitta ism.
• Google Cloud Speech-to-Text — matnga aylantirishni so'raganingizda bitta ovozli xabarning audiosi.
• Google Cloud Translation — tarjima so'raganingizda bitta xabarning matni.
• Cloudflare Workers AI — qisqacha bayonni so'raganingizda yoki undan savol so'raganingizda bitta suhbatning oxirgi 50 tagacha xabari.

Oxirgi uchtasi ushbu versiyada o'chirilgan. Ilovada matnga aylantirish, tarjima yoki qisqacha bayon qilishni yoqadigan hech qanday boshqaruv yo'q, shuning uchun bu uchta xizmatga hech narsa yetib bormaydi. Ular o'chirilmagan, ro'yxatga kiritilgan, chunki kod hali ham shu yerda va funksiyalar qaytishi kerak — va ular qaytganda, ushbu oshkoralik va birinchi foydalanishdan oldingi so'rov bilan qaytadi. O'shanda yuboriladigan narsa har qanday narsani o'rgatish uchun emas, natijangizni yaratish uchun yuboriladi; na transkript, na tarjima serverlarimizda saqlanmaydi.

Vikipediya qidiruvining kalit-o'chirgichi yo'q, chunki o'chiradigan hech narsa yo'q: u faqat bosilganda ishlaydi va boshqacha yo'q. Vikipediya faqat o'sha bitta ismni va IP manzilingizni oladi, xuddi siz uni ularning o'z qidiruv maydoniga o'zingiz kiritgandek — akkaunt yo'q, xabar yo'q, suhbat yo'q. Qaytib kelgan narsa ko'rsatiladi va saqlanmaydi, va u haqida hech narsa suhbatga yozilmaydi.

Cloudflare Realtime'da ham kalitcha yo'q. Qo'ng'iroqlarning aksariyati bunga muhtoj emas: bir-biriga to'g'ridan-to'g'ri ulana oladigan ikkita qurilma — bir xil tarmoqdagi aksariyat qo'ng'iroqlar — usiz ulanadi va hech narsa uzatilmaydi. Ular ulana olmaganda — odatda ikkalangiz turli mobil tarmoqlarda bo'lganingiz uchun — allaqachon shifrlangan qo'ng'iroq ulanmay qolish o'rniga uzatiladi. Cloudflare ko'radigan narsa — ikkala IP manzil, qo'ng'iroq vaqti va taxminan qancha ma'lumot ko'chganligi; audio va video 2-bo'limda tasvirlangan xuddi shu DTLS-SRTP shifrlashi ostida qoladi, shuning uchun uzatish ularni deshifrlamaydi.

Qonun talab qilsa, biz saqlayotgan narsani oshkor qila olamiz. Biz saqlayotgan narsa — 2-bo'limdagi ro'yxat. Xabar mazmunini taqdim eta olmaymiz, chunki uni o'qiy olmaymiz.`,
    },
    {
      title: '7. Push bildirishnomalari',
      body: `Firebase Cloud Messaging bildirishnomalarni yetkazadi. Qurilma tokeningiz faqat siz o'qiy oladigan akkauntingizning shaxsiy qismida saqlanadi.

Bildirishnomalar hech qanday xabar matnini olib yurmaydi. Qurilmangiz xabarni mahalliy ravishda shifrdan chiqaradi va siz ko'radigan narsani quradi; Google konvertni yetkazadi, mazmunni emas.`,
    },
    {
      title: '8. Siz nima qila olasiz',
      body: `• Profil ekranidan akkauntingizni o'chiring. Suhbatning umumiy qismi bo'lgan mazmun — masalan, qo'ng'iroq yozuvi — boshqa ishtirokchida qoladi, chunki bu uning ham yozuvi.
• Profil ekranidan ma'lumotlaringizni eksport qiling.
• Har bir suhbat uchun xabar muddatini belgilang: 1 soat, 24 soat, 7 kun yoki 30 kun.
• Yozayotganlik ko'rsatkichlari va o'qilganlik tasdiqlarini yoqing yoki o'chiring. Ikkalasi ham sukut bo'yicha o'chirilgan.
• Ilovani PIN kod yoki biometriya bilan qulflang.
• Siz tarqatgan taklif havolasini bekor qiling.

Agar biror narsani qo'lda o'chirishimizni afzal ko'rsangiz, bizga yozing.`,
    },
    {
      title: '9. Saqlash muddati',
      body: `Akkauntingiz mavjud bo'lgan vaqtda ma'lumotlaringizni saqlaymiz. Akkauntingizni o'chirish yuqorida aytilgan birgalikda saqlanadigan mazmundan boshqasini olib tashlaydi. Har bir suhbat bo'yicha muddat xabarlarni siz belgilagan jadval bo'yicha olib tashlaydi.`,
    },
    {
      title: '10. Bilishingiz kerak bo\'lgan cheklovlar',
      body: `Buni o'zingiz bilib olishingizdan ko'ra, biz aytib qo'yishni afzal ko'ramiz.

• Kalitlar birinchi ko'rishda ishonchli deb hisoblanadi. Agar kimdir siz hech qachon xabar almashmasdan oldin kalitni almashtirgan bo'lsa, suhbat noto'g'ri odamga shifrlanadi va mutlaqo normal ko'rinadi. Ilova kalit keyinroq o'zgarganda sizni ogohlantiradi va kanaldan tashqarida solishtirishingiz mumkin bo'lgan xavfsizlik raqamini ko'rsatadi — ammo hech narsa sizni uni solishtirishga majburlamaydi.
• Bir vaqtning o'zida bitta qurilma. Tiklash iborangiz tarixingizni ochadigan kalitni tiklaydi, shuning uchun yangi qurilmada tizimga kirish siz allaqachon olgan narsani yo'qotmaydi. Forward secrecy'ga ega suhbatlar uni yaratgan qurilmadan hech qachon chiqmaydigan ikkinchi kalitdan foydalanadi: eng oxirgi tizimga kirgan qurilma qaysi bo'lsa, ular o'shanga yetadi, va bu orada ikkinchisiga muhrlangan har qanday narsa u yerga ko'chib o'ta olmaydi.
• Shifrlash mavjud bo'lmasdan oldin yuborilgan xabarlar o'zgarishsiz qoladi. Hech narsa orqaga qarab o'zgartirilmagan.
• Ushbu ilova mustaqil xavfsizlik auditidan o'tkazilmagan.`,
    },
    {
      title: '11. Bolalar',
      body: `Chatterbox 13 yoshgacha bo'lgan bolalar uchun mo'ljallanmagan, va biz ularning ma'lumotlarini bilib-bila turib to'plamaymiz. Agar bola bizga shaxsiy ma'lumot bergan deb hisoblasangiz, biz bilan bog'laning, biz uni o'chirib tashlaymiz.`,
    },
    {
      title: '12. O\'zgarishlar',
      body: `Biz ushbu siyosatni yangilashimiz mumkin. Muhim o'zgarishlar ilovada e'lon qilinadi, va yuqoridagi sana uning oxirgi marta qachon o'zgarganini bildiradi.`,
    },
    {
      title: '13. Aloqa',
      body: `Ushbu siyosat haqida savollar: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Yangiroq ilova versiyasini tekshirish',
      body: `Google Play — bu ilovaning Android telefoningizga yetib borish usuli emas. U buning o'rniga chatterbox.fans'dan yuklab olinadi, va bu jarayonda qatnashmaydigan do'kon sizning nomingizdan yangilanishlarni tekshira olmaydi — shuning uchun agar so'rasangiz, bu ilova buni o'zi qila oladi.

"Hozir tekshirish"ga bosish joriy versiya qaysi ekanligini so'rab chatterbox.fans'ga bitta so'rov yuboradi. Bu so'rov faqat sizning IP manzilingizni olib boradi, boshqa hech narsa emas — hisob yo'q, qurilma identifikatori yo'q, xabar yo'q. Qaytib keladigan narsa versiya raqami bo'lib, u telefoningizda ishlatayotgan versiyangiz bilan solishtiriladi; hech narsa avtomatik ravishda yuklanmaydi va bu tekshiruv haqida hech narsa suhbatga yozilmaydi.

Bunda kalitcha yo'q, chunki o'chiradigan hech narsa yo'q: u faqat bosilganda ishlaydi va boshqacha emas.

Agar yangilanishni o'rnatsangiz, u xuddi shu imzolash kalitidan foydalanib ilovani o'z o'rnida almashtiradi, xuddi Google Play'dan kelgan yangilanish qiladigandek.`,
    },
  ],
  ka: [
    {
      title: '0. მოკლედ',
      body: `თქვენი შეტყობინებების ტექსტი დაშიფრულია თქვენს მოწყობილობაზე და მისი წაკითხვა შეუძლიათ მხოლოდ იმ ადამიანებს, ვისაც უგზავნით. ჩვენ ვერ ვკითხულობთ მას და ვერც Google, რომლის სერვერებსაც ვქირაობთ.

რასაც ჩვენ ვხედავთ, არის ის, რომ საუბარი შედგა: რომელი ანგარიშები მონაწილეობენ და როდის იყვნენ აქტიურები. ამის მოცილება უფრო რთულია, ვიდრე შინაარსის დაშიფვრა, და ჩვენ ჯერ არ დაგვისრულებია. ეს პოლიტიკა ზუსტად ამბობს, სად გადის ეს ზღვარი ამჟამად.`,
    },
    {
      title: '1. რა არის ბოლოდან ბოლომდე დაშიფრული',
      body: `დაშიფრულია თქვენს მოწყობილობაზე, წაუკითხავია ჩვენთვისაც და Google-სთვისაც:

• თქვენი შეტყობინებების ტექსტი.
• ფაილების, ფოტოების, აუდიოსა და ვიდეოს შინაარსი, რომელსაც ურთავთ.
• ბმულის წინასწარი გადახედვები.
• ხმოვანი და ვიდეო ზარები, რომლებიც იყენებენ სავალდებულო DTLS-SRTP WebRTC-ს მოწყობილობებს შორის.

ერთ-ერთზე და ჯგუფური შეტყობინებების უმეტესობა დამატებით იყენებს რეჩეტ მექანიზმს, რაც ნიშნავს, რომ თითოეულ შეტყობინებას აქვს საკუთარი გასაღები, ასე რომ თქვენი მოწყობილობის კომპრომეტირება წინა შეტყობინებებს არ ააშკარავებს. საუბრები, სადაც კლიენტმა ვინმესთვის უახლესი გასაღების მასალა არ გამოაქვეყნა, უბრუნდება ერთ ხანგრძლივვადიან გასაღებს, რომელსაც ეს თვისება არ აქვს. შეტყობინების ქვეშ ნიშანი გეუბნებათ, რომელი მიიღო ფაქტობრივად.

მხოლოდ ერთი რამ კვეთს ამ ზღვარს, და მხოლოდ მაშინ, როცა ამას ითხოვთ: ვიკიპედიაზე სახელის ძიება აგზავნის მხოლოდ ამ სახელს და არა შეტყობინებას, საიდანაც ის მოვიდა. მე-6 ნაწილი ამბობს, ვინ იღებს ამას, და ძიება მუშაობს მხოლოდ შეხებისას და სხვაგვარად არა, ასე რომ არაფერია გამორთვის საჭირო. შეჯამება, თარგმნა და ტრანსკრიფცია ასევე გადაკვეთდნენ ამ ზღვარს — ისინი გამორთულია ამ ვერსიაში, აპლიკაციაში არსად არსებობს მართვის საშუალება, რომელიც მათ ჩართავდა.`,
    },
    {
      title: '2. რა არ არის დაშიფრული და რა შეგვიძლია დავინახოთ',
      body: `დაშიფვრა იცავს შინაარსს და არა იმ ფაქტს, რომ საუბარი შედგა. ეს ნივთები ღიად დევს ჩვენს სერვერებზე:

• ვინ არის თითოეულ საუბარში და როდის შეიქმნა და ბოლოს როდის იყო აქტიური.
• თითოეული შეტყობინების დროის ნიშანი და რამდენი გაქვთ წაუკითხავი.
• დანართის ფაილის სახელი, ტიპი და ზომა. ბაიტები დაშიფრულია; მათი აღწერა არა, და დაშიფრული ტექსტის სიგრძე ზღუდავს ორიგინალის სიგრძეს.
• თქვენი მეგობრები და მეგობრობის მოთხოვნები.
• ზარის სიგნალიზაცია — რომ ზარი შედგა, ვისთან და როდის. არა მისი აუდიო ან ვიდეო.

აკრეფის ინდიკატორები და წაკითხვის დადასტურებები გამორთულია, სანამ არ ჩართავთ, და სანამ გამორთულია, არაფერი იწერება.

რაც აღარ არის აქ: თქვენი ელფოსტის მისამართი და სახელი. 2026 წლის სექტემბრიდან ანგარიშის ჩანაწერი შეიცავს მხოლოდ ანგარიშის იდენტიფიკატორს — და მას შემდეგ არ არსებობს მისამართი, რომლის შენახვაც შეეძლო. რეგისტრაცია არ გთხოვთ ამას: თქვენი ანგარიში არის 24-სიტყვიანი აღდგენის ფრაზა, და Firebase Authentication-ის მიერ შემოწმებული სავალდებულო მონაცემი მისგან არის მიღებული. რასაც ის ინახავს, არის შემთხვევითი ნიშანი დომენის ქვეშ, რომელსაც ფოსტის მიღება არ შეუძლია.

ცალკე: რადგან აპლიკაცია მუშაობს Google Firebase-ზე, Google-ს შეუძლია დაინახოს IP მისამართი და თითოეული კავშირის დროულობა, რომელსაც თქვენი მოწყობილობა მასთან ამყარებს. ეს არის ჰოსტინგის თვისება და არა აპლიკაციის, და ჩვენ ვერ დავშიფრავთ მას.`,
    },
    {
      title: '3. როგორ გპოულობენ ხალხი',
      body: `მათ არ შეუძლიათ თქვენი მოძებნა. არ არსებობს დირექტორია — არ არსებობს ძიება ელფოსტის, ტელეფონის ნომრის ან სახელის მიხედვით — და სერვერი უარყოფს ნებისმიერ მოთხოვნას, რომელიც ამას ცდილობს.

ვინმეს მისწვდებით მისთვის მოსაწვევი ბმულის გაგზავნით არხის გარეთ, რაც არ უნდა უკვე იყენებდეთ. ბმული მუშაობს ერთხელ, იწურება 24 საათის შემდეგ და შეიძლება გაუქმდეს. როგორც არ უნდა უწოდოთ ვინმეს, ეს არის თქვენი საკუთარი ნიშანი მისთვის, თქვენთვის შენახული; თუ მან თავად წარმოადგინა თავი, ეს სახელი დაშიფრული მოვიდა თქვენთან.`,
    },
    {
      title: '4. რას ვაგროვებთ',
      body: `• ანგარიშის მონაცემები: ანგარიშის იდენტიფიკატორი და თქვენი აღდგენის ფრაზისგან მიღებული სავალდებულო მონაცემი, შენახული Firebase Authentication-ში. ელფოსტის მისამართი არ არის, ტელეფონის ნომერი არ არის, სახელი არ არის — რეგისტრაცია არცერთს არ ითხოვს.
• შეტყობინებებისა და დანართების დაშიფრული ტექსტი, პლუს მე-2 ნაწილში მოცემული მეტამონაცემები.

ეს არის სრული სია. არ არსებობს ანალიტიკა და არ არსებობს ავარიების შესახებ ანგარიშგება. აპლიკაცია ადრე უგზავნიდა ეკრანის ხედვებს Firebase Analytics-ს და ავარიების ანგარიშებს Firebase Crashlytics-ს, ორივე ატარებდა თქვენი ანგარიშის იდენტიფიკატორს, ასე რომ არცერთი მათგანი არ იყო ანონიმური; ორივე ახლა აღარ არსებობს, მათი გამგზავნი ბიბლიოთეკებთან ერთად. შეცდომები იბეჭდება მხოლოდ დეველოპერის საკუთარ მანქანაზე შემუშავების დროს და არსად სხვაგან არ მიდის.`,
    },
    {
      title: '5. სად ინახება ეს',
      body: `Google Firebase-ზე — Firestore, Storage და Authentication — უსაფრთხოების წესების ქვეშ, რომლებიც წყვეტენ, ვის შეუძლია თითოეული დოკუმენტის წაკითხვა და ჩაწერა.

თქვენს მოწყობილობაზე, ქეშირებული შეტყობინებები, პარამეტრები და თქვენი აპლიკაციის დაბლოკვის PIN კოდი დაშიფრულია მოწყობილობის ცალკეული გასაღებით, რომელიც ინახება პლატფორმის გასაღების საცავში (iOS Keychain, Android Keystore) ჩვეულებრივი აპლიკაციის საცავის ნაცვლად.

პირადი გასაღები, რომელიც შიფრავს თქვენს შეტყობინებებს, არასდროს ტოვებს თქვენს მოწყობილობას, გარდა აღდგენის ფრაზისა, რომლის ჩაწერასაც აირჩევთ. ჩვენ არ ვინახავთ მას და ვერ აღვადგენთ თქვენთვის. თუ დაკარგავთ მას, იმ მოწყობილობაზე გაგზავნილი შეტყობინებები ვეღარ წაიკითხება — არავის მიერ, ჩვენს ჩათვლით.`,
    },
    {
      title: '6. ვინ სხვა იღებს მონაცემებს',
      body: `ჩვენ არ ვყიდით, არ ვვაჭრობთ და არ ვქირავებთ თქვენს პირად ინფორმაციას. მონაცემები აღწევს:

• Google Firebase-ს — ჩვენს ჰოსტინგ პროვაიდერს, როგორც ზემოთ არის აღწერილი.
• Cloudflare Realtime — ზარის აუდიო და ვიდეო, როდესაც თქვენი მოწყობილობა და მეორე პირის მოწყობილობა ვერ უკავშირდებიან ერთმანეთს პირდაპირ.
• Wikimedia Foundation-ს — ერთი სახელი, როცა შეხებთ ვიკიპედიაზე მის საძებნელად.
• Google Cloud Speech-to-Text-ს — ერთი ხმოვანი შეტყობინების აუდიო, როცა ტრანსკრიფციას ითხოვთ.
• Google Cloud Translation-ს — ერთი შეტყობინების ტექსტი, როცა თარგმანს ითხოვთ.
• Cloudflare Workers AI-ს — ერთი საუბრის ბოლო 50 შეტყობინებამდე, როცა შეჯამებას ითხოვთ ან კითხვას უსვამთ.

ბოლო სამი გამორთულია ამ ვერსიაში. აპლიკაციაში არსად არსებობს მართვის საშუალება, რომელიც ჩართავდა ტრანსკრიფციას, თარგმანს ან შეჯამებას, ასე რომ ამ სამ სერვისს არაფერი აღწევს. ისინი ჩამოთვლილია და არა წაშლილი, რადგან კოდი ჯერ კიდევ აქ არის და ფუნქციები უნდა დაბრუნდნენ — და როცა დაბრუნდებიან, დაბრუნდებიან ამ გამჟღავნებით და მოთხოვნით პირველი გამოყენების წინ. რაც მაშინ გაიგზავნებოდა, იგზავნება თქვენი შედეგის შესაქმნელად და არა რაიმეს გასაწვრთნელად; არც ტრანსკრიფცია და არც თარგმანი არ ინახება ჩვენს სერვერებზე.

ვიკიპედიის ძიებას არ აქვს გადამრთველი, რადგან არაფერია გამორთვის საჭირო: ის მუშაობს მხოლოდ შეხებისას და სხვაგვარად არა. ვიკიპედია იღებს მხოლოდ ერთ ამ სახელს და თქვენს IP მისამართს, ზუსტად ისე, თითქოს თავად აკრიფეთ ის მათივე საძებნელ ველში — არანაირი ანგარიში, არანაირი შეტყობინება, არანაირი საუბარი. რაც უკან მოდის, ნაჩვენებია და არ ინახება, და მის შესახებ არაფერი იწერება საუბარში.

Cloudflare Realtime-საც არ აქვს გადამრთველი. ზარების უმეტესობას ეს არ სჭირდება: ორი მოწყობილობა, რომლებსაც შეუძლიათ ერთმანეთთან პირდაპირი კავშირი — ზარების უმეტესობა ერთსა და იმავე ქსელში — უკავშირდება ამის გარეშეც, და არაფერი გადაიცემა გადამცემით. როცა ვერ ახერხებენ — ჩვეულებრივ, ორივენი სხვადასხვა მობილურ ქსელში ხართ — უკვე დაშიფრული ზარი გადაიცემა გადამცემით, ნაცვლად იმისა, რომ დარჩეს დაუკავშირებელი. რასაც Cloudflare ხედავს, არის ორივე მხარის IP მისამართები, ზარის დრო და დაახლოებით რამდენი მონაცემი გადაადგილდა; აუდიო და ვიდეო რჩება იმავე DTLS-SRTP დაშიფვრის ქვეშ, რომელიც აღწერილია მე-2 ნაწილში, ამიტომ გადაცემა მათ არ ხსნის.

ჩვენ შეგვიძლია გავამჟღავნოთ, რასაც ვინახავთ, თუ კანონი მოითხოვს. რასაც ვინახავთ, არის მე-2 ნაწილში მოცემული სია. ჩვენ ვერ წარმოვადგენთ შეტყობინებების შინაარსს, რადგან ვერ ვკითხულობთ მას.`,
    },
    {
      title: '7. პუშ შეტყობინებები',
      body: `Firebase Cloud Messaging აწვდის შეტყობინებებს. თქვენი მოწყობილობის ტოკენი ინახება თქვენი ანგარიშის კერძო ნაწილში, რომლის წაკითხვაც მხოლოდ თქვენ შეგიძლიათ.

შეტყობინებები არ ატარებენ არავითარ შეტყობინების ტექსტს. თქვენი მოწყობილობა შიფრავს შეტყობინებას ლოკალურად და აწყობს იმას, რასაც ხედავთ; Google აწვდის კონვერტს და არა შინაარსს.`,
    },
    {
      title: '8. რისი გაკეთება შეგიძლიათ',
      body: `• წაშალეთ თქვენი ანგარიში პროფილის ეკრანიდან. შინაარსი, რომელიც საუბრის საერთო ნაწილია — მაგალითად, ზარის ჩანაწერი — რჩება მეორე მონაწილესთან, რადგან ეს მისი ჩანაწერიც არის.
• გაიტანეთ თქვენი მონაცემები პროფილის ეკრანიდან.
• დააყენეთ შეტყობინების ვადა თითოეული საუბრისთვის: 1 საათი, 24 საათი, 7 დღე ან 30 დღე.
• ჩართეთ ან გამორთეთ აკრეფის ინდიკატორები და წაკითხვის დადასტურებები. ორივე ნაგულისხმევად გამორთულია.
• დაბლოკეთ აპლიკაცია PIN კოდით ან ბიომეტრიით.
• გააუქმეთ მოსაწვევი ბმული, რომელიც გასცით.

თუ გირჩევნიათ, რომ ჩვენ ხელით წავშალოთ რაღაც, მოგვწერეთ.`,
    },
    {
      title: '9. შენახვა',
      body: `ჩვენ ვინახავთ თქვენს მონაცემებს, სანამ თქვენი ანგარიში არსებობს. ანგარიშის წაშლა შლის მათ, ზემოთ მითითებული ერთობლივად შენახული შინაარსის გარდა. თითოეული საუბრის ვადა შლის შეტყობინებებს თქვენ მიერ დაყენებული განრიგის მიხედვით.`,
    },
    {
      title: '10. შეზღუდვები, რომლებიც უნდა იცოდეთ',
      body: `გვირჩევნია გითხრათ, ვიდრე თავად აღმოაჩინოთ.

• გასაღებებს ენდობიან პირველივე ნახვისას. თუ ვინმემ შეცვალა გასაღები, სანამ ოდესმე შეტყობინება გაცვალეთ, საუბარი დაშიფრდებოდა არასწორ ადამიანთან და სრულიად ნორმალურად გამოიყურებოდა. აპლიკაცია გაფრთხილებთ, როცა გასაღები მოგვიანებით იცვლება, და აჩვენებს უსაფრთხოების ნომერს, რომლის შედარებაც შეგიძლიათ არხის გარეთ — მაგრამ არაფერი გაიძულებთ მის შედარებას.
• ერთდროულად ერთი მოწყობილობა. თქვენი აღდგენის ფრაზა აღადგენს გასაღებს, რომელიც ხსნის თქვენს ისტორიას, ასე რომ ახალ მოწყობილობაზე შესვლა არ კარგავს იმას, რაც უკვე მიიღეთ. საუბრები წინსვლის საიდუმლოებით იყენებენ მეორე გასაღებს, რომელიც არასდროს ტოვებს მის შემქმნელ მოწყობილობას: რომელი მოწყობილობაც ბოლოს შევიდა, ის არის ის, რასაც ისინი აღწევენ, და ნებისმიერი რამ, რაც ამასობაში მეორისთვის დაილუქა, იქ ვერ გადავა.
• შეტყობინებები, გაგზავნილი დაშიფვრის არსებობამდე, რჩება ისეთივე, როგორიც იყო. არაფერი გარდაქმნილა უკუღმა.
• ეს აპლიკაცია არ გაუვლია დამოუკიდებელი უსაფრთხოების აუდიტს.`,
    },
    {
      title: '11. ბავშვები',
      body: `Chatterbox არ არის განკუთვნილი 13 წლამდე ბავშვებისთვის, და ჩვენ შეგნებულად არ ვაგროვებთ მათ ინფორმაციას. თუ გგონიათ, რომ ბავშვმა მოგვაწოდა პირადი ინფორმაცია, დაგვიკავშირდით და ჩვენ წავშლით მას.`,
    },
    {
      title: '12. ცვლილებები',
      body: `ჩვენ შეიძლება განვაახლოთ ეს პოლიტიკა. მნიშვნელოვანი ცვლილებები გამოცხადდება აპლიკაციაში, და თარიღი ზემოთ არის მაშინ, როცა ბოლოს შეიცვალა.`,
    },
    {
      title: '13. კონტაქტი',
      body: `კითხვები ამ პოლიტიკის შესახებ: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. აპლიკაციის ახალი ვერსიის შემოწმება',
      body: `Google Play არ არის გზა, რომლითაც ეს აპლიკაცია თქვენს Android ტელეფონამდე აღწევს. ის ნაცვლად ამისა ჩამოიტვირთება chatterbox.fans-დან, და მაღაზია, რომელიც ამ პროცესში არ მონაწილეობს, ვერ შეამოწმებს განახლებებს თქვენი სახელით — ასე რომ, ეს აპლიკაცია თავად შეძლებს ამის გაკეთებას, თუ თხოვთ.

„შემოწმება ახლავე"-ზე შეხებით იგზავნება ერთი მოთხოვნა chatterbox.fans-ზე, რომელიც ეკითხება, რომელი ვერსიაა მიმდინარე. ეს მოთხოვნა შეიცავს მხოლოდ თქვენს IP მისამართს და არაფერს სხვას — არც ანგარიშს, არც მოწყობილობის იდენტიფიკატორს, არც შეტყობინებას. რაც ბრუნდება, არის ვერსიის ნომერი, რომელიც შედარებულია თქვენს ტელეფონზე გაშვებულ ვერსიასთან; ავტომატურად არაფერი ჩამოიტვირთება და ამ შემოწმების შესახებ არაფერი იწერება საუბარში.

ამას გადამრთველი არ აქვს, რადგან გამორთვის რაიმე არ არსებობს: ის მუშაობს მხოლოდ შეხებისას და არა სხვაგვარად.

თუ განახლებას დააინსტალირებთ, ის შეცვლის აპლიკაციას იმავე ადგილას იმავე ხელმოწერის გასაღების გამოყენებით, ისევე როგორც Google Play-დან მოსული განახლება გააკეთებდა.`,
    },
  ],
  hy: [
    {
      title: '0. Համառոտ',
      body: `Ձեր հաղորդագրությունների տեքստը գաղտնագրված է ձեր սարքում և կարող են կարդալ միայն այն մարդիկ, ում ուղարկում եք։ Մենք չենք կարող կարդալ այն, և չի կարող նաև Google-ը, որի սերվերները վարձակալում ենք։

Ինչ մենք կարող ենք տեսնել, այն է, որ խոսակցություն է տեղի ունեցել՝ որ հաշիվներն են դրանում, և երբ են եղել ակտիվ։ Դա հեռացնելը ավելի դժվար է, քան բովանդակությունը գաղտնագրելը, և մենք դեռ չենք ավարտել։ Այս քաղաքականությունը ճշգրիտ ասում է, թե որտեղ է գիծն այժմ։`,
    },
    {
      title: '1. Ինչն է ծայրից ծայր գաղտնագրված',
      body: `Գաղտնագրված է ձեր սարքում, անընթեռնելի է մեզ և Google-ի համար.

• Ձեր հաղորդագրությունների տեքստը։
• Ձեր կցած ֆայլերի, լուսանկարների, աուդիոյի և տեսանյութի բովանդակությունը։
• Հղումների նախադիտումները։
• Ձայնային և տեսազանգերը, որոնք օգտագործում են սարքերի միջև պարտադիր DTLS-SRTP WebRTC։

Մեկ առ մեկ և խմբային հաղորդագրությունների մեծ մասը լրացուցիչ օգտագործում է ratchet մեխանիզմ, ինչը նշանակում է, որ յուրաքանչյուր հաղորդագրություն ունի իր սեփական բանալին, ուստի ձեր սարքի վտանգված լինելը չի բացահայտում ավելի վաղ հաղորդագրությունները։ Խոսակցությունները, որտեղ հաճախորդը ինչ-որ մեկի համար չի հրապարակել ավելի նոր բանալի նյութ, վերադառնում են մեկ երկարաժամկետ բանալու, որն այս հատկությունը չունի։ Հաղորդագրության տակի նշանը ասում է, թե որն է իրականում ստացվել։

Միայն մեկ բան է հատում այս գիծը, և միայն երբ դուք դա խնդրում եք. Վիքիպեդիայում անվան որոնումն ուղարկում է միայն այդ անունը, ոչ թե այն հաղորդագրությունը, որտեղից այն եկել է։ Բաժին 6-ը ասում է, թե ով է դա ստանում, և որոնումն աշխատում է միայն հպման ժամանակ և այլապես ոչ, ուստի ոչինչ չկա անջատելու։ Ամփոփումը, թարգմանությունը և տառադարձումը նույնպես կհատեին այս գիծը — դրանք անջատված են այս թողարկման մեջ, հավելվածում ոչ մի կառավարման միջոց չկա, որը դրանք կմիացներ։`,
    },
    {
      title: '2. Ինչը գաղտնագրված չէ, և ինչ կարող ենք տեսնել',
      body: `Գաղտնագրումը պաշտպանում է բովանդակությունը, ոչ թե այն փաստը, որ խոսակցություն է տեղի ունեցել։ Այս բաները բացահայտորեն ընկած են մեր սերվերների վրա.

• Ով է յուրաքանչյուր խոսակցության մեջ, և երբ է ստեղծվել ու վերջին անգամ եղել ակտիվ։
• Յուրաքանչյուր հաղորդագրության ժամանակի կնիքը, և քանիսն ունեք չկարդացած։
• Կցորդի ֆայլի անունը, տեսակը և չափը։ Բայթերը գաղտնագրված են; դրանց նկարագրությունը՝ ոչ, և գաղտնագրված տեքստի երկարությունը սահմանափակում է բնօրինակի երկարությունը։
• Ձեր ընկերները և ընկերության հայցերը։
• Զանգի ազդանշանավորումը — որ զանգ է եղել, ում հետ և երբ։ Ոչ դրա աուդիոն կամ տեսանյութը։

Մուտքագրման ցուցիչները և ընթերցման հաստատումները անջատված են, մինչև դրանք միացնեք, և քանի դեռ անջատված են, ոչինչ չի գրանցվում։

Ինչն այլևս այստեղ չէ. ձեր էլ. փոստի հասցեն և անունը։ 2026 թվականի սեպտեմբերից հաշվի գրառումը պարունակում է միայն հաշվի նույնացուցիչ — և այդ ժամանակից ի վեր չկա հասցե, որը կարող էր պահվել։ Գրանցումը դա ձեզանից չի հարցնում. ձեր հաշիվը 24 բառից բաղկացած վերականգնման արտահայտություն է, և Firebase Authentication-ի ստուգած հավատարմագիրը ստացվում է դրանից։ Ինչ այն պահում է, պատահական պիտակ է մի տիրույթի տակ, որը չի կարող փոստ ստանալ։

Առանձին. քանի որ հավելվածն աշխատում է Google Firebase-ի վրա, Google-ը կարող է տեսնել IP հասցեն և ձեր սարքի կողմից նրան կատարվող յուրաքանչյուր կապի ժամանակացույցը։ Սա հոսթինգի հատկություն է, ոչ թե հավելվածի, և մենք չենք կարող այն գաղտնագրելով վերացնել։`,
    },
    {
      title: '3. Ինչպես են մարդիկ գտնում ձեզ',
      body: `Նրանք չեն կարող փնտրել ձեզ։ Չկա գրացուցակ — չկա որոնում ըստ էլ. փոստի, հեռախոսահամարի կամ անվան — և սերվերը մերժում է ցանկացած հարցում, որը փորձում է դա։

Դուք հասնում եք որևէ մեկին՝ ուղարկելով նրան հրավերի հղում ալիքից դուրս, ինչ էլ որ արդեն օգտագործում եք։ Հղումն աշխատում է մեկ անգամ, լրանում է 24 ժամից հետո և կարող է չեղարկվել։ Ինչպես էլ որևէ մեկին անվանեք, դա ձեր սեփական պիտակն է նրա համար, պահված ձեզ համար; եթե նա ինքն է իրեն ներկայացրել, այդ անունը ձեզ հասել է գաղտնագրված։`,
    },
    {
      title: '4. Ինչ ենք հավաքում',
      body: `• Հաշվի տվյալներ. հաշվի նույնացուցիչ և ձեր վերականգնման արտահայտությունից ստացված հավատարմագիր, պահված Firebase Authentication-ում։ Ոչ մի էլ. փոստի հասցե, ոչ մի հեռախոսահամար, ոչ մի անուն — գրանցումը դրանցից ոչ մեկը չի հարցնում։
• Հաղորդագրությունների և կցորդների գաղտնագրված տեքստը, գումարած բաժին 2-ում նշված մետատվյալները։

Սա ամբողջական ցանկն է։ Չկա վերլուծություն և չկա վթարների զեկուցում։ Հավելվածն ավելի վաղ ուղարկում էր էկրանի դիտումներ Firebase Analytics և վթարների զեկույցներ Firebase Crashlytics, երկուսն էլ կրում էին ձեր հաշվի նույնացուցիչը, ուստի դրանցից ոչ մեկը անանուն չէր; երկուսն էլ այժմ վերացված են, դրանք ուղարկող գրադարանների հետ միասին։ Սխալները տպագրվում են միայն մշակողի սեփական մեքենայի վրա մշակման ընթացքում և այլուր չեն գնում։`,
    },
    {
      title: '5. Որտեղ է այն պահվում',
      body: `Google Firebase-ի վրա — Firestore, Storage և Authentication — անվտանգության կանոնների ներքո, որոնք որոշում են, թե ով կարող է կարդալ և գրել յուրաքանչյուր փաստաթուղթ։

Ձեր սարքում, քեշավորված հաղորդագրությունները, կարգավորումները և ձեր հավելվածի կողպման PIN կոդը գաղտնագրված են սարքին հատուկ բանալիով, պահված հարթակի բանալիների պահեստում (iOS Keychain, Android Keystore) սովորական հավելվածի պահեստի փոխարեն։

Գաղտնի բանալին, որը վերծանում է ձեր հաղորդագրությունները, երբեք չի լքում ձեր սարքը, բացառությամբ որպես վերականգնման արտահայտություն, որը դուք ընտրում եք գրանցել։ Մենք չենք պահում այն և չենք կարող այն վերականգնել ձեզ համար։ Եթե կորցնեք այն, այդ սարքին ուղարկված հաղորդագրությունները այլևս չեն կարող կարդացվել — ոչ ոքի կողմից, ներառյալ մեզ։`,
    },
    {
      title: '6. Ով ուրիշ է ստանում տվյալներ',
      body: `Մենք չենք վաճառում, չենք առևտրում և չենք վարձակալում ձեր անձնական տեղեկությունները։ Տվյալները հասնում են.

• Google Firebase — մեր հոսթինգի մատակարարը, ինչպես նկարագրված է վերևում։
• Cloudflare Realtime — զանգի ձայնն ու տեսանյութը, երբ ձեր սարքը և մյուս անձի սարքը չեն կարող ուղղակիորեն կապվել միմյանց հետ։
• Wikimedia Foundation — մեկ անուն, երբ դուք հպում եք այն Վիքիպեդիայում փնտրելու համար։
• Google Cloud Speech-to-Text — մեկ ձայնային հաղորդագրության աուդիո, երբ դուք խնդրում եք տառադարձություն։
• Google Cloud Translation — մեկ հաղորդագրության տեքստ, երբ դուք խնդրում եք թարգմանություն։
• Cloudflare Workers AI — մինչև մեկ խոսակցության վերջին 50 հաղորդագրությունը, երբ դուք խնդրում եք ամփոփում կամ հարց եք տալիս դրան։

Վերջին երեքն անջատված են այս թողարկման մեջ։ Հավելվածում ոչ մի կառավարման միջոց չկա, որը կմիացներ տառադարձումը, թարգմանությունը կամ ամփոփումը, ուստի այս երեք ծառայություններին ոչինչ չի հասնում։ Դրանք թվարկված են, ոչ թե ջնջված, քանի որ կոդը դեռ այստեղ է, և հատկանիշները նախատեսված են վերադառնալու — և երբ վերադառնան, կվերադառնան այս բացահայտմամբ և հուշումով նախքան առաջին օգտագործումը։ Ինչ կուղարկվեր այդ ժամանակ, ուղարկվում է ձեր արդյունքը ստեղծելու համար, ոչ թե որևէ բան մարզելու; ոչ տառադարձությունը, ոչ թարգմանությունը չեն պահվում մեր սերվերներում։

Վիքիպեդիայի որոնումն անջատիչ չունի, քանի որ ոչինչ չկա անջատելու. այն աշխատում է միայն հպման ժամանակ և այլապես ոչ։ Վիքիպեդիան ստանում է միայն այդ մեկ անունը և ձեր IP հասցեն, ճիշտ այնպես, կարծես դուք ինքներդ մուտքագրած լինեիք այն նրանց սեփական որոնման դաշտում — ոչ մի հաշիվ, ոչ մի հաղորդագրություն, ոչ մի խոսակցություն։ Ինչ վերադառնում է, ցուցադրվում է և չի պահվում, և դրա մասին ոչինչ չի գրվում խոսակցության մեջ։

Cloudflare Realtime-ն էլ անջատիչ չունի։ Զանգերի մեծ մասին դա պետք չէ. երկու սարք, որոնք կարող են ուղղակիորեն կապվել միմյանց հետ՝ նույն ցանցում գտնվող զանգերի մեծամասնությունը, միանում են առանց դրա, և ոչինչ չի փոխանցվում։ Երբ չեն կարողանում՝ սովորաբար քանի որ դուք երկուսդ գտնվում եք տարբեր բջջային ցանցերում, արդեն գաղտնագրված զանգը փոխանցվում է՝ չկապակցված մնալու փոխարեն։ Ինչ Cloudflare-ը տեսնում է, երկուսի IP հասցեներն են, զանգի ժամանակը և մոտավորապես որքան տվյալ է տեղափոխվել. ձայնն ու տեսանյութը մնում են 2-րդ բաժնում նկարագրված նույն DTLS-SRTP գաղտնագրման ներքո, ուստի փոխանցումը դրանք չի ապագաղտնագրում։

Մենք կարող ենք բացահայտել այն, ինչ ունենք, եթե օրենքը դա պահանջում է։ Ինչ ունենք, բաժին 2-ում նշված ցանկն է։ Մենք չենք կարող տրամադրել հաղորդագրությունների բովանդակությունը, քանի որ չենք կարող կարդալ այն։`,
    },
    {
      title: '7. Push ծանուցումներ',
      body: `Firebase Cloud Messaging-ը հասցնում է ծանուցումները։ Ձեր սարքի նշանը պահվում է ձեր հաշվի մասնավոր մասում, որը կարող եք կարդալ միայն դուք։

Ծանուցումները չեն կրում որևէ հաղորդագրության տեքստ։ Ձեր սարքը տեղում վերծանում է հաղորդագրությունը և կառուցում այն, ինչ տեսնում եք; Google-ը հասցնում է ծրարը, ոչ թե բովանդակությունը։`,
    },
    {
      title: '8. Ինչ կարող եք անել',
      body: `• Ջնջեք ձեր հաշիվը Պրոֆիլ էկրանից։ Բովանդակությունը, որը խոսակցության համատեղ մասն է — օրինակ՝ զանգի գրառումը — մնում է մյուս մասնակցի մոտ, քանի որ դա նաև նրա գրառումն է։
• Արտահանեք ձեր տվյալները Պրոֆիլ էկրանից։
• Սահմանեք հաղորդագրության ժամկետը ըստ խոսակցության. 1 ժամ, 24 ժամ, 7 օր կամ 30 օր։
• Միացրեք կամ անջատեք մուտքագրման ցուցիչները և ընթերցման հաստատումները։ Երկուսն էլ լռելյայն անջատված են։
• Կողպեք հավելվածը PIN կոդով կամ բիոմետրիկայով։
• Չեղարկեք հրավերի հղումը, որը դուք տվել եք։

Եթե նախընտրում եք, որ մենք ինչ-որ բան ձեռքով ջնջենք, գրեք մեզ։`,
    },
    {
      title: '9. Պահպանում',
      body: `Մենք պահում ենք ձեր տվյալները, քանի դեռ ձեր հաշիվը գոյություն ունի։ Ձեր հաշվի ջնջումը հեռացնում է դրանք, բացառությամբ վերևում նշված համատեղ պահվող բովանդակության։ Ըստ խոսակցության ժամկետը հեռացնում է հաղորդագրությունները ձեր սահմանած ժամանակացույցով։`,
    },
    {
      title: '10. Սահմանափակումներ, որոնց մասին պետք է իմանաք',
      body: `Մենք նախընտրում ենք ասել ձեզ, քան դուք ինքներդ հայտնաբերեք։

• Բանալիներին վստահում են առաջին տեսքից։ Եթե ինչ-որ մեկը փոխարիներ բանալին, նախքան դուք երբևէ հաղորդագրություն փոխանակեիք, խոսակցությունը կգաղտնագրվեր սխալ մարդու համար և կթվար լիովին նորմալ։ Հավելվածը զգուշացնում է ձեզ, երբ բանալին փոխվում է ավելի ուշ, և ցույց է տալիս անվտանգության համար, որը կարող եք համեմատել ալիքից դուրս — բայց ոչինչ ձեզ չի ստիպում այն համեմատել։
• Մեկ սարք միաժամանակ։ Ձեր վերականգնման արտահայտությունը վերականգնում է բանալին, որը բացում է ձեր պատմությունը, ուստի նոր սարքի վրա մուտք գործելը չի կորցնում այն, ինչ արդեն ստացել եք։ Առաջընթաց գաղտնիությամբ խոսակցություններն օգտագործում են երկրորդ բանալի, որը երբեք չի լքում այն ստեղծած սարքը. որ սարքն էլ վերջին անգամ մուտք է գործել, հենց այն է, որին նրանք հասնում են, և ինչ էլ միջանկյալ ժամանակ կնքված լինի մյուսի համար, չի կարող տեղափոխվել այնտեղ։
• Հաղորդագրությունները, որոնք ուղարկվել են գաղտնագրման գոյությունից առաջ, մնում են այնպիսին, ինչպիսին եղել են։ Ոչինչ հետադարձորեն չի փոխարկվել։
• Այս հավելվածը անկախ անվտանգության աուդիտի չի ենթարկվել։`,
    },
    {
      title: '11. Երեխաներ',
      body: `Chatterbox-ը նախատեսված չէ 13 տարեկանից փոքր երեխաների համար, և մենք գիտակցաբար չենք հավաքում նրանց տեղեկությունները։ Եթե կարծում եք, որ երեխան մեզ տրամադրել է անձնական տեղեկություններ, կապվեք մեզ հետ, և մենք կջնջենք դրանք։`,
    },
    {
      title: '12. Փոփոխություններ',
      body: `Մենք կարող ենք թարմացնել այս քաղաքականությունը։ Էական փոփոխությունները կհայտարարվեն հավելվածում, և վերևի ամսաթիվը ցույց է տալիս, թե երբ է այն վերջին անգամ փոխվել։`,
    },
    {
      title: '13. Կապ',
      body: `Հարցեր այս քաղաքականության մասին. ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Հավելվածի նոր տարբերակի ստուգում',
      body: `Google Play-ը այն ձևը չէ, որով այս հավելվածը հասնում է ձեր Android հեռախոսին։ Այն փոխարենը ներբեռնվում է chatterbox.fans-ից, և խանութը, որը մասնակից չէ այս գործընթացին, չի կարող ձեր փոխարեն ստուգել թարմացումները — ուստի այս հավելվածն ինքն է կարող դա անել, եթե խնդրեք։

«Ստուգել հիմա»-ի հպումն ուղարկում է մեկ հարցում chatterbox.fans՝ հարցնելով, թե որն է ընթացիկ տարբերակը։ Այդ հարցումը կրում է միայն ձեր IP հասցեն և ուրիշ ոչինչ՝ ոչ հաշիվ, ոչ սարքի նույնացուցիչ, ոչ հաղորդագրություն։ Ինչ վերադառնում է, տարբերակի համար է, որը համեմատվում է ձեր հեռախոսում աշխատող տարբերակի հետ. ոչինչ ինքնաբերաբար չի ներբեռնվում, և այս ստուգման մասին ոչինչ չի գրվում խոսակցության մեջ։

Սա անջատիչ չունի, քանի որ անջատելու ոչինչ չկա՝ այն աշխատում է միայն հպման ժամանակ և այլ կերպ ոչ։

Եթե տեղադրեք թարմացումը, այն կփոխարինի հավելվածն իր տեղում՝ օգտագործելով նույն ստորագրման բանալին, ճիշտ այնպես, ինչպես Google Play-ից եկած թարմացումը կանի։`,
    },
  ],
  be: [
    {
      title: '0. Коратка',
      body: `Тэкст вашых паведамленняў зашыфраваны на вашай прыладзе, і прачытаць яго могуць толькі тыя, каму вы яго дасылаеце. Мы не можам яго прачытаць, і Google, чые серверы мы арандуем, таксама не можа.

Тое, што мы можам бачыць, — гэта факт, што адбылася размова: якія акаунты ў ёй удзельнічалі і калі яны былі актыўныя. Прыбраць гэта складаней, чым зашыфраваць змест, і мы яшчэ не скончылі. Гэтая палітыка дакладна кажа, дзе зараз праходзіць гэтая мяжа.`,
    },
    {
      title: '1. Што зашыфравана скразным шыфраваннем',
      body: `Зашыфравана на вашай прыладзе, нечытэльна для нас і для Google:

• Тэкст вашых паведамленняў.
• Змест файлаў, фота, аудыё і відэа, якія вы прымацоўваеце.
• Папярэднія прагляды спасылак.
• Галасавыя і відэазванкі, якія выкарыстоўваюць абавязковы DTLS-SRTP пратакол WebRTC паміж дзвюма прыладамі.

Большасць паведамленняў адзін-на-адзін і групавых дадаткова выкарыстоўваюць механізм ratchet, што азначае, што кожнае паведамленне мае свой уласны ключ, таму кампраметацыя вашай прылады не раскрывае больш раннія паведамленні. Размовы, дзе кліент кагосьці яшчэ не апублікаваў новы ключавы матэрыял, вяртаюцца да аднаго доўгачасовага ключа, які не мае гэтай уласцівасці. Метка пад паведамленнем кажа, які з іх яно сапраўды атрымала.

Адна рэч перасякае гэтую мяжу, і толькі калі вы гэтага просіце: пошук імя ў Вікіпедыі дасылае толькі гэтае адно імя, а не паведамленне, з якога яно ўзята. Раздзел 6 кажа, хто яго атрымлівае, а пошук працуе толькі пры націску і больш ніколі, таму няма чаго выключаць. Рэзюмаванне, пераклад і расшыфроўка голасу таксама перасеклі б гэтую мяжу — яны выключаны ў гэтай версіі, і ў праграме няма ніякага пераключальніка, які б іх уключыў.`,
    },
    {
      title: '2. Што не зашыфравана, і што мы можам бачыць',
      body: `Шыфраванне абараняе змест, а не сам факт размовы. Гэта адкрыта ляжыць на нашых серверах:

• Хто ўдзельнічае ў кожнай размове, і калі яна была створана і апошні раз актыўная.
• Адзнака часу кожнага паведамлення, і колькі паведамленняў вы не прачыталі.
• Назва, тып і памер файла ўкладання. Байты зашыфраваны; іх апісанне — не, а даўжыня зашыфраванага тэксту абмяжоўвае даўжыню арыгінала.
• Вашы сябры і запыты на дружбу.
• Сігналізацыя званкоў — што званок быў зроблены, каму і калі. Не яго аудыё або відэа.

Індыкатары набору тэксту і пацвярджэнні прачытання выключаны, пакуль вы іх не ўключыце, і пакуль яны выключаны, нічога не запісваецца.

Чаго тут больш няма: вашага адраса электроннай пошты і вашага імя. З верасня 2026 года запіс акаунта захоўвае толькі ідэнтыфікатар акаунта — і з таго часу няма адраса, які можна было б дзе-небудзь захоўваць. Рэгістрацыя нічога пра вас не пытае: ваш акаунт — гэта фраза аднаўлення з 24 слоў, а іменныя даныя, якія правярае Firebase Authentication, атрыманы з яе. Тое, што яна захоўвае, — гэта выпадковая метка пад даменам, які не можа атрымліваць пошту.

Асобна: паколькі праграма працуе на Google Firebase, Google можа бачыць IP-адрас і час кожнага злучэння, якое ваша прылада да яго робіць. Гэта ўласцівасць хостынгу, а не праграмы, і мы не можам зашыфраваць гэта.`,
    },
    {
      title: '3. Як людзі знаходзяць вас',
      body: `Яны не могуць шукаць вас. Тут няма даведніка — няма пошуку па электроннай пошце, нумары тэлефона ці імені — і сервер адхіляе любы запыт, які спрабуе гэта зрабіць.

Вы дасягаеце кагосьці, дасылаючы яму спасылку-запрашэнне па-за гэтым каналам, праз тое, чым вы ўжо карыстаецеся. Спасылка працуе адзін раз, дзейнічае 24 гадзіны і можа быць адклікана. Як бы вы кагосьці ні назвалі, гэта ваша ўласная метка для яго, захаваная толькі для вас; калі ён сам сябе прадставіў, гэтае імя дайшло да вас зашыфраваным.`,
    },
    {
      title: '4. Што мы збіраем',
      body: `• Даныя акаунта: ідэнтыфікатар акаунта і іменныя даныя, атрыманыя з вашай фразы аднаўлення, захаваныя ў Firebase Authentication. Ніякага адраса электроннай пошты, ніякага нумара тэлефона, ніякага імя — рэгістрацыя не пытае нічога з гэтага.
• Зашыфраваны тэкст паведамленняў і ўкладанняў, плюс метаданыя з раздзела 2.

Гэта поўны спіс. Няма аналітыкі і няма справаздач пра збоі. Раней праграма дасылала прагляды экрана ў Firebase Analytics і справаздачы пра збоі ў Firebase Crashlytics, абодва з якіх неслі ідэнтыфікатар вашага акаунта, таму ніводнае з іх не было ананімным; абодва цяпер прыбраны разам з бібліятэкамі, якія іх дасылалі. Памылкі друкуюцца толькі на ўласнай машыне распрацоўшчыка падчас распрацоўкі і больш нікуды не ідуць.`,
    },
    {
      title: '5. Дзе гэта захоўваецца',
      body: `На Google Firebase — Firestore, Storage і Authentication — паводле правілаў бяспекі, якія вызначаюць, хто можа чытаць і пісаць у кожны дакумент.

На вашай прыладзе кэшаваныя паведамленні, налады і PIN-код блакіроўкі праграмы зашыфраваны ключом, унікальным для гэтай прылады, захаваным у сховішчы ключоў платформы (iOS Keychain, Android Keystore), а не ў звычайным сховішчы праграмы.

Прыватны ключ, які расшыфроўвае вашы паведамленні, ніколі не пакідае вашу прыладу, за выключэннем як фраза аднаўлення, якую вы вырашаеце запісаць. Мы не захоўваем яго і не можам аднавіць яго для вас. Страціце яго — і паведамленні, дасланыя на тую прыладу, больш нельга прачытаць — нікому, уключаючы нас.`,
    },
    {
      title: '6. Хто яшчэ атрымлівае даныя',
      body: `Мы не прадаём, не абменьваем і не здаём у арэнду вашу асабістую інфармацыю. Даныя дасягаюць:

• Google Firebase — нашага пастаўшчыка хостынгу, як апісана вышэй.
• Cloudflare Realtime — аўдыя і відэа выкліку, калі ваша прылада і прылада іншага чалавека не могуць звязацца напрамую.
• Wikimedia Foundation — адно імя, калі вы націскаеце на яго, каб знайсці ў Вікіпедыі.
• Google Cloud Speech-to-Text — аудыё аднаго галасавога паведамлення, калі вы просіце расшыфроўку.
• Google Cloud Translation — тэкст аднаго паведамлення, калі вы просіце пераклад.
• Cloudflare Workers AI — да апошніх 50 паведамленняў адной размовы, калі вы просіце рэзюмэ або задаяце пытанне пра яе.

Апошнія тры выключаны ў гэтай версіі. У праграме няма ніякага пераключальніка, які б уключыў расшыфроўку, пераклад або рэзюмаванне, таму да гэтых трох сэрвісаў нічога не дасягае. Яны пералічаны, а не выдалены, бо код усё яшчэ тут, і гэтыя функцыі павінны вярнуцца — і калі яны вернуцца, яны вернуцца з гэтым раскрыццём і з запытам перад першым выкарыстаннем. Тое, што было б адпраўлена тады, дасылаецца, каб атрымаць ваш вынік, а не для навучання чагосьці; ні расшыфроўка, ні пераклад не захоўваюцца на нашых серверах.

У пошуку Вікіпедыі няма пераключальніка, бо няма чаго выключаць: ён працуе толькі пры націску і больш ніколі. Вікіпедыя атрымлівае толькі гэтае адно імя і ваш IP-адрас, гэтак жа, як калі б вы самі ўвялі яго ў іх уласнае поле пошуку — ніякага акаунта, ніякага паведамлення, ніякай размовы. Тое, што вяртаецца, паказваецца і не захоўваецца, і нічога пра гэта не запісваецца ў размову.

У Cloudflare Realtime таксама няма пераключальніка. Большасці выклікаў гэта не патрэбна: дзве прылады, якія могуць звязацца напрамую — большасць выклікаў у адной сетцы — злучаюцца без гэтага, і нічога не рэтранслюецца. Калі яны не могуць — звычайна таму, што вы абодва знаходзіцеся ў розных мабільных сетках — ужо зашыфраваны выклік рэтранслюецца, а не застаецца без злучэння. Тое, што бачыць Cloudflare, — гэта абодва IP-адрасы, час выкліку і прыблізна колькі дадзеных перамясцілася; аўдыя і відэа застаюцца пад тым жа шыфраваннем DTLS-SRTP, апісаным у раздзеле 2, так што рэтрансляцыя іх не расшыфроўвае.

Мы можам раскрыць тое, што маем, калі гэтага патрабуе закон. Тое, што мы маем, — гэта спіс з раздзела 2. Мы не можам прадаставіць змест паведамленняў, бо не можам яго прачытаць.`,
    },
    {
      title: '7. Push-апавяшчэнні',
      body: `Firebase Cloud Messaging дастаўляе апавяшчэнні. Токен вашай прылады захоўваецца ў прыватнай частцы вашага акаунта, якую можаце прачытаць толькі вы.

Апавяшчэнні не нясуць тэкст паведамлення. Ваша прылада расшыфроўвае паведамленне лакальна і складае тое, што вы бачыце; Google дастаўляе канверт, а не змест.`,
    },
    {
      title: '8. Што вы можаце зрабіць',
      body: `• Выдаліце свой акаунт з экрана Профіль. Змест, які з'яўляецца сумеснай часткай размовы — напрыклад, запіс званка — застаецца ў іншага ўдзельніка, бо гэта таксама яго запіс.
• Экспартуйце свае даныя з экрана Профіль.
• Задайце тэрмін дзеяння паведамленняў для кожнага чата: 1 гадзіна, 24 гадзіны, 7 дзён або 30 дзён.
• Уключыце або выключыце індыкатары набору тэксту і пацвярджэнні прачытання. Абодва па змаўчанні выключаны.
• Заблакіруйце праграму PIN-кодам або біяметрыяй.
• Адклічце спасылку-запрашэнне, якую вы раздалі.

Калі вы аддаеце перавагу, каб мы выдалілі нешта ўручную, напішыце нам.`,
    },
    {
      title: '9. Захаванне',
      body: `Мы захоўваем вашы даныя, пакуль існуе ваш акаунт. Выдаленне акаунта выдаляе іх, за выключэннем сумесна захоўванага зместу, згаданага вышэй. Тэрмін дзеяння для кожнага чата выдаляе паведамленні паводле раскладу, які вы задалі.`,
    },
    {
      title: '10. Абмежаванні, пра якія вам варта ведаць',
      body: `Мы аддаем перавагу расказаць вам пра гэта, а не каб вы самі гэта знайшлі.

• Ключам давяраюць з першага разу, калі іх бачаць. Калі б хтосьці замяніў ключ да таго, як вы калі-небудзь абмяняліся паведамленнем, размова была б зашыфравана не таму чалавеку і выглядала б цалкам звычайна. Праграма папярэджвае вас, калі ключ мяняецца пазней, і паказвае нумар бяспекі, які вы можаце параўнаць па-за каналам — але нішто не прымушае вас яго параўноўваць.
• Адна прылада ў кожны момант. Ваша фраза аднаўлення аднаўляе ключ, які адкрывае вашу гісторыю, таму ўваход на новай прыладзе не губляе тое, што вы ўжо атрымалі. Размовы з прамой сакрэтнасцю выкарыстоўваюць другі ключ, які ніколі не пакідае прыладу, якая яго стварыла: якая б прылада ні ўвайшла апошняй, менавіта яна атрымлівае паведамленні, а ўсё, што ў гэты час было запячатана для другой, не можа быць перанесена туды.
• Паведамленні, дасланыя да з'яўлення шыфравання, застаюцца такімі, якімі яны былі. Нічога не было пераўтворана заднім лікам.
• Гэтая праграма не праходзіла незалежны аўдыт бяспекі.`,
    },
    {
      title: '11. Дзеці',
      body: `Chatterbox не прызначаны для дзяцей да 13 гадоў, і мы наўмысна не збіраем іх інфармацыю. Калі вы лічыце, што дзіця дало нам асабістую інфармацыю, звярніцеся да нас, і мы яе выдалім.`,
    },
    {
      title: '12. Змены',
      body: `Мы можам абнаўляць гэтую палітыку. Значныя змены будуць абвешчаны ў праграме, а дата ўверсе паказвае, калі яна змянялася апошні раз.`,
    },
    {
      title: '13. Кантакт',
      body: `Пытанні пра гэтую палітыку: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Праверка навейшай версіі праграмы',
      body: `Google Play — гэта не той спосаб, якім гэтая праграма трапляе на ваш тэлефон Android. Замест гэтага яна спампоўваецца з chatterbox.fans, а крама, якая не ўдзельнічае ў гэтым працэсе, не можа правяраць абнаўленні ад вашага імя — таму гэтая праграма можа рабіць гэта сама, калі вы яе папросіце.

Націск на «Праверыць зараз» адпраўляе адзін запыт на chatterbox.fans з пытаннем, якая версія актуальная. Гэты запыт нясе толькі ваш IP-адрас і больш нічога — ні акаўнта, ні ідэнтыфікатара прылады, ні паведамлення. Тое, што вяртаецца, — гэта нумар версіі, які параўноўваецца на вашым тэлефоне з версіяй, якую вы выкарыстоўваеце; нічога не спампоўваецца аўтаматычна, і нічога пра гэту праверку не запісваецца ў размову.

У гэтага няма пераключальніка, бо няма чаго выключаць: гэта працуе толькі пры націску і ніяк інакш.

Калі вы ўсталюеце абнаўленне, яно заменіць праграму на месцы з выкарыстаннем таго ж ключа подпісу — гэтак жа, як гэта зрабіла б абнаўленне з Google Play.`,
    },
  ],
  ti: [
    {
      title: '0. ብሓጺሩ',
      body: `ጽሑፍ መልእኽትታትካ ኣብ መሳርሒኻ ተመስጢሩ ኣሎ፡ ንዝሰደድካሎም ሰባት ጥራይ ክንበብ ይኽእል። ንሕና ክንርድኦ ኣይንኽእልን፡ ሰርቨርታቱ እንኻረየሉ Google እውን ክርድኦ ኣይክእልን።

ክንርኢ እንኽእል ዝርርብ ከምዝተኻየደ እዩ፦ ኣየኖት ሕሳባት ከምዝሓቖፈን መዓስ ንጡፋት ከምዝነበራን። ንዝገበሮ ምድምሳስ ካብ ትሕዝቶ ምምስጣር ዝኸበደ እዩ፡ ጌና ኣይወዳእናዮን። እዚ ፖሊሲ ሕጂ እታ መስመር ኣበይ ከምዘላ ብትኽክል ይነግር።`,
    },
    {
      title: '1. እንታይ እዩ ካብ ወገን ናብ ወገን ተመስጢሩ',
      body: `ኣብ መሳርሒኻ ተመስጢሩ፡ ንዓናን ንGoogleን ክንበብ ዘይክእል፦

• ጽሑፍ መልእኽትታትካ።
• ትሕዝቶ ዘተሓሓዝካዮም ፋይላት፡ ስእልታት፡ ድምጽን ቪድዮን።
• ቅድመ-ርእይቶ ሊንክ።
• ኣብ መንጎ ክልቲኡ መሳርሒ ግድነታዊ ናይ WebRTC DTLS-SRTP ዝጥቀም ናይ ድምጽን ቪድዮን ጻውዒት።

መብዛሕትኦም ሓደ-ንሓደን ናይ ጉጅለ መልእኽትታትን ተወሳኺ ratchet ዝበሃል ኣገባብ ይጥቀሙ፡ እዚ ማለት ነፍስወከፍ መልእኽቲ ናታ ልዩ መፍትሕ ኣለዋ፡ ስለዚ መሳርሒኻ ምጥላፍ ንቐደም ዝነበሩ መልእኽትታት ኣየቃልዖምን። ናይ ካልኦት ክላይንት ሓድሽ መፍትሕ ገና ዘይተዘርግሐሉ ዝርርባት ናብ ሓደ ነዊሕ ዝጸንሕ መፍትሕ ይምለሱ፡ እዚ ድማ እዚ ጠባይ የብሉን። ኣብ ትሕቲ መልእኽቲ ዘሎ ምልክት ብሓቂ ኣየናይ ከምዝረኸበ ይነግረካ።

ሓንቲ ነገር ጥራይ ንዛ መስመር ትሰግር፡ ንስኻ ክትገብሮ ምስ እትሓትት ጥራይ፦ ኣብ ዊኪፐዲያ ስም ምድላይ ነቲ ሓደ ስም ጥራይ ይሰዲ፡ ካብቲ ዝመጸሉ መልእኽቲ ኣይኰነን። ክፍሊ 6 መን ከምዝቕበሎ ይነግር፡ እቲ ምድላይ ድማ ኣብ ግዜ ምንካፍ ጥራይ ይሰርሕ፡ ካልእ ግዜ ኣይሰርሕን፡ ስለዚ ዝጠፍእ ነገር የለን። ምጽማቕ፡ ምትርጓምን ናብ ጽሑፍ ምቕያርን እውን ነዚ መስመር ምሰገሩ ነይሮም — ኣብዚ ሕታም ጠፊኦም ኣለዉ፡ ኣብ መተግበሪ ውሽጢ ንዝኾነ ቦታ ዘርኣዮም መቆጻጸሪ የለን።`,
    },
    {
      title: '2. እንታይ ኣይተመስጠረን፡ እንታይከ ክንርኢ ንኽእል',
      body: `ምስጢር ትሕዝቶ ይከላኸል፡ ንባዕሉ ናይ ዝርርብ ህላወ ኣይኰነን። እዚኦም ብንጹር ኣብ ሰርቨርታትና ኣለዉ፦

• መን ኣብ ነፍስወከፍ ዝርርብ ከምዘሎ፡ መዓስ ከምዝተፈጥረን ናይ መወዳእታ ግዜ ንጡፍ ከምዝነበረን።
• ግዜ ምልክት ናይ ነፍስወከፍ መልእኽቲ፡ ክንደይ ዘይተነበቡ ከምዘለዉኻ።
• ስም፡ ዓይነትን መጠንን ናይ ተወሳኺ ፋይል። ባይትታት ተመስጢሮም ኣለዉ፣ መግለጺኦም ግና ኣይኰነን፡ ንውሓት ናይቲ ዝተመስጠረ ጽሑፍ ንውሓት እቲ በዅሪ ይድርት።
• ኣዕሩኽትኻን ናይ ዕርክነት ሕቶታትካን።
• ናይ ጻውዒት ምልክት ምሃብ — ጻውዒት ከምዝተገብረ፡ ናብ መንን መዓስን። ናይ ድምጹ ወይ ቪድዩ ግና ኣይኰነን።

ናይ ምጽሓፍ ምልክትን ናይ ንባብ መረጋገጺን ክሳብ ዘይከፈትካዮም ጠፊኦም ይነብሩ፡ ኣብ ዝጠፍኡሉ ግዜ ዝኾነ ነገር ኣይምዝገብን።

ኣብዚ ጌና ዘየለ፦ ናይ ኢመይል ኣድራሻካን ስምካን። ካብ መስከረም 2026 ጀሚሩ ናይ ሕሳብ መዝገብ ናይ ሕሳብ መለለዪ ጥራይ ይሓዝ — ካብቲ ግዜ እቲ ጀሚሩ ኣብ ዝኾነ ቦታ ክዕቀብ ዝኽእል ኣድራሻ የለን። ምዝገባ ብዛዕባኻ ዝኾነ ነገር ኣይሓትትን፦ ሕሳብካ ናይ 24 ቃላት ናይ ምምላስ ሓረግ እዩ፡ Firebase Authentication ዘረጋግጾ ምስክር ወረቐት ድማ ካብኡ ዝርከብ እዩ። ትሕዝቶ ናይቲ ዝዕቀብ ብዘይሕሳብ ዝተመርጸ ምልክት ኮይኑ፡ ኢመይል ክቕበል ዘይክእል ዶመይን ኣብ ትሕቲ ይርከብ።

ብተወሳኺ፦ እዚ መተግበሪ ኣብ Google Firebase ስለዝሰርሕ፡ Google ናይ IP ኣድራሻን ናይ ነፍስወከፍ ርክብ ናይ መሳርሒኻ ግዜን ክርኢ ይኽእል። እዚ ናይ ኣተኣንግዳ ጠባይ እዩ፡ ናይ መተግበሪ ኣይኰነን፡ ብምምስጣር ክንድምስሶ ኣይንኽእልን።`,
    },
    {
      title: '3. ሰባት ብኸመይ ይረኽቡኻ',
      body: `ብምድላይ ክረኽቡኻ ኣይክእሉን። ኣብዚ ዶክተር የለን — ብኢመይል፡ ቁጽሪ ተሌፎን ወይ ስም ምድላይ የለን — ሰርቨር ድማ ንዝኾነ ከምኡ ዝፍትን ሕቶ ይኣቢ።

ንሓደ ሰብ ትረኽቦ ናይ ዕድመ ሊንክ ብኻልእ መስመር ብምስዳድ፡ ብዝኾነ ድሮ እትጥቀመሉ ኣገባብ እዩ። ሊንክ ሓደ ግዜ ይሰርሕ፡ ድሕሪ 24 ሰዓት ይውዳእ፡ ክምለስ እውን ይኽእል። ንሓደ ሰብ ብዝኾነ ትጽውዖ ስም ናትካ ጥራይ ናይ ግል ምልክት ኮይኑ ንዓኻ ተዓቂቡ ይነብር፣ ንሱ ባዕሉ ንርእሱ እንተኣላሊዩ፡ እቲ ስም ናባኻ ተመስጢሩ ተበጺሑ እዩ።`,
    },
    {
      title: '4. እንታይ ንእክብ',
      body: `• ናይ ሕሳብ ሓበሬታ፦ ናይ ሕሳብ መለለዪን ካብ ናይ ምምላስ ሓረግካ ዝርከብ ምስክር ወረቐትን፡ ኣብ Firebase Authentication ተዓቂቡ። ናይ ኢመይል ኣድራሻ የለን፡ ናይ ተሌፎን ቁጽሪ የለን፡ ስም የለን — ምዝገባ ካብዚኦም ዝኾነ ኣይሓትትን።
• ናይ መልእኽትን ተወሳኺን ዝተመስጠረ ጽሑፍ፡ ብተወሳኺ ኣብ ክፍሊ 2 ተጠቒሱ ዘሎ ሓበሬታ።

እዚ ምሉእ ዝርዝር እዩ። ትንተናን ናይ ብልሽት ጸብጻብን የለን። ቅድም እዚ መተግበሪ ናይ ስክሪን ርእይቶ ናብ Firebase Analytics ናይ ብልሽት ጸብጻብ ድማ ናብ Firebase Crashlytics ይሰድድ ነይሩ፡ ክልቲኦም ናይ ሕሳብካ መለለዪ ዝሓዙ፡ ስለዚ ክልቲኦም ስም-ኣልቦ ኣይነበሩን፣ ክልቲኦም ምስቶም ዝሰድድዎም ቤተ-ንባባትን ሓቢሮም ጠፊኦም ኣለዉ። ጌጋታት ኣብ ግዜ ምምዕባል ኣብ ናይ ገንባሪ ዋሕስ ማሽን ጥራይ ይሕተሙ፡ ካልእ ቦታ ኣይኸዱን።`,
    },
    {
      title: '5. ኣበይ ተዓቂቡ',
      body: `ኣብ Google Firebase — Firestore, Storage ንAuthentication — ኣብ ትሕቲ ናይ ውሕስነት ሕግታት፡ መን ናብ ነፍስወከፍ ሰነድ ክንብብን ክጽሕፍን ከምዝኽእል ዝውስን።

ኣብ መሳርሒኻ፡ ዝተዓቀቡ መልእኽትታት፡ ቅንብራትን ናይ መተግበሪ መቕለቢ PIN ኮድካን ብናይ መሳርሒ-ፍሉይ መፍትሕ ኣብ ናይ መድረኽ ናይ መፍትሕ መዕቆቢ (iOS Keychain, Android Keystore) ተመስጢሮም ኣለዉ፡ ኣብ ልሙድ ናይ መተግበሪ መዕቆቢ ኣይኰነን።

ናይ ምስጢር መፍትሕ ንመልእኽትታትካ ዝፈትሕ ካብ መሳርሒኻ ፈጺሙ ኣይወጽእን፡ ብዘይ ንክትጽሕፎ እትመርጾ ናይ ምምላስ ሓረግ። ንሕና ኣይንሕዞን ንዓኻ ኽንመልሶ ኣይንኽእልን። እንተጥፊኡካ፡ ናብ ብእቲ መሳርሒ ዝተላእኩ መልእኽትታት ደጊሞም ክንበቡ ኣይክእሉን — ብማንም፡ ንሕና ሓዊስና።`,
    },
    {
      title: '6. ካልእ መን ሓበሬታ ይቕበል',
      body: `ናይ ውልቅኻ ሓበሬታ ኣይንሸይጦን፡ ኣይንልውጦን ኣይነካርን። ሓበሬታ ናብዞም ይበጽሕ፦

• Google Firebase — ልዕል ኢሉ ከምዝተገልጸ፡ ናትና ናይ ኣተኣንግዳ ኣቕራቢ።
• Cloudflare Realtime — መሳርያኻን መሳርያ እቲ ካልእ ሰብን ብቐጥታ ክራኸቡ ዘይክእሉሉ እዋን፣ ድምጽን ቪድዮን እቲ ጻውዒት።
• Wikimedia Foundation — ኣብ ዊኪፐዲያ ንምድላዩ ምስ እትጠውቖ ሓደ ስም ጥራይ።
• Google Cloud Speech-to-Text — ናብ ጽሑፍ ምቕያር ምስ እትሓትት ናይ ሓደ ናይ ድምጺ መልእኽቲ ድምጺ።
• Google Cloud Translation — ትርጉም ምስ እትሓትት ናይ ሓደ መልእኽቲ ጽሑፍ።
• Cloudflare Workers AI — ጽማቝ ወይ ሕቶ ምስ እትሓትት ክሳብ ናይ ሓደ ዝርርብ ናይ ዳሕረዋይ 50 መልእኽትታት።

ዳሕረወት ሰለስተ ኣብዚ ሕታም ጠፊኦም ኣለዉ። ኣብ መተግበሪ ናብ ጽሑፍ ምቕያር፡ ትርጉም ወይ ጽማቝ ዝኸፍት ዝኾነ መቆጻጸሪ የለን፡ ስለዚ ናብዞም ሰለስተ ኣገልግሎት ዝኾነ ነገር ኣይበጽሕን። ኮድ ጌና ኣብዚ ስለዘሎን እዞም ባህርያት ክምለሱ ስለዝድለዩን ተዘርዚሮም ኣለዉ፡ ኣይተደምሰሱን — ክምለሱ ከለዉ ድማ ምስዚ ምግላጽን ቅድሚ ቀዳማይ ጥቕም ምስ ዝቐርብ ሕቶን ክምለሱ እዮም። ኣብቲ ግዜ እቲ ዝኽለኣኽ ንውጽኢትካ ንምፍራይ ጥራይ ክለኣኽ እዩ፡ ንምስልጣን ዝኾነ ነገር ኣይኰነን፣ ኣብ ሰርቨርታትና ናብ ጽሑፍ ዝተቐየረ ወይ ትርጉም ኣይዕቀብን።

ኣብ ናይ ዊኪፐዲያ ምድላይ መቆጻጸሪ የለን፡ ዝጠፍእ ነገር ስለዘየለ፦ ኣብ ግዜ ምንካፍ ጥራይ ይሰርሕ፡ ካልእ ግዜ ኣይሰርሕን። ዊኪፐዲያ እቲ ሓደ ስምን ናትካ IP ኣድራሻን ጥራይ ይቕበል፡ ልክዕ ብናትካ ኣብ ናቶም ናይ ምድላይ ሳጹን እንተኣቲኻዮ ዝመስል — ሕሳብ የለን፡ መልእኽቲ የለን፡ ዝርርብ የለን። ዝምለስ ነገር ይረአ እሞ ኣይዕቀብን፡ ብዛዕባኡ ዝኾነ ነገር ናብቲ ዝርርብ ኣይጽሓፍን።

Cloudflare Realtime እውን መቐየሪ የብሉን። መብዛሕትኦም ጻውዒታት ኣየድልዮምን እዩ፦ ክልተ መሳርሒታት ብቐጥታ ክራኸቡ ዝኽእሉ—መብዛሕትኡ ጻውዒት ኣብ ሓደ ኔትወርክ—ብዘይዚ ይራኸቡ፣ ዋላ ሓንቲ ኣይመሓላለፍን። ክራኸቡ ዘይክእሉ እንተኾይኖም—መብዛሕትኡ ግዜ ክልቴኹም ኣብ ዝተፈላለየ ሞባይል ኔትወርክ ስለ ዘለኹም—እቲ ኣቐዲሙ ዝተመስጠረ ጻውዒት ከይተራኸበ ካብ ዝተርፍ ይመሓላለፍ። Cloudflare ዝርእዮ ናይ ክልቲኦም IP ኣድራሻ፣ ግዜ እቲ ጻውዒት፣ ከምኡውን ግምታዊ ክንደይ ዳታ ከም እተጓዕዘ እዩ፤ ድምጽን ቪድዮን ኣብቲ ብክፍሊ 2 እተገልጸ ተመሳሳሊ DTLS-SRTP ምስጢራዊነት ይነብር፣ ስለዚ ምምሕልላፍ ኣይፈትሖን።

ሕጊ እንተሓቲቱ ንዘሎና ክንገልጽ ንኽእል። ንሕና ንሓዝ ናይ ክፍሊ 2 ዝርዝር እዩ። ትሕዝቶ መልእኽትታት ከነቕርብ ኣይንኽእልን፡ ክንርድኦ ስለዘይንኽእል።`,
    },
    {
      title: '7. ናይ ደፍኢት ምልክታታት',
      body: `Firebase Cloud Messaging ምልክታታት የብጽሕ። ናይ መሳርሒኻ ቶከን ኣብ ናይ ሕሳብካ ብሕታዊ ክፋል ተዓቂቡ፡ ንስኻ ጥራይ ከተንብቦ ትኽእል።

ምልክታታት ዝኾነ ናይ መልእኽቲ ጽሑፍ ኣይሓዙን። መሳርሒኻ ብቦታ መልእኽቲ ይፈትሕ እሞ ንዝርእዮ ይሃንጽ፣ Google ፖስጣ ይበጽሕ፡ ትሕዝቶ ኣይኰነን።`,
    },
    {
      title: '8. እንታይ ክትገብር ትኽእል',
      body: `• ካብ መግለጺ ገጽ ሕሳብካ ደምስስ። ናይ ሓባር ክፋል ናይ ዝርርብ ዝኾነ ትሕዝቶ — ንኣብነት፡ ናይ ጻውዒት መዝገብ — ምስቲ ካልእ ተሳታፊ ይጸንሕ፡ ናቱ እውን መዝገብ ስለዝኾነ።
• ካብ መግለጺ ገጽ ሓበሬታኻ ኣውጽእ።
• ንነፍስወከፍ ዝርርብ ናይ መልእኽቲ ግዜ ወሰን ኣዘጋጅ፦ 1 ሰዓት፡ 24 ሰዓት፡ 7 መዓልቲ ወይ 30 መዓልቲ።
• ናይ ምጽሓፍ ምልክትን ናይ ንባብ መረጋገጺን ክፈት ወይ ኣጥፍእ። ክልቲኦም ብቀደም ጠፊኦም ኣለዉ።
• መተግበሪ ብPIN ወይ ባዮሜትሪክስ ዕጾ።
• ዝሃብካዮ ናይ ዕድመ ሊንክ ኣውጽእ።

ንሕና ብኢድ ገለ ነገር ክንድምስስ እንተመሪጽካ፡ ጽሓፈልና።`,
    },
    {
      title: '9. ምዕቃብ',
      body: `ሕሳብካ ክሳብ ዘሎ ሓበሬታኻ ንዕቅብ። ሕሳብ ምድምሳስ ካብ ላዕሊ ተጠቒሱ ካብ ዘሎ ናይ ሓባር ትሕዝቶ ወጻኢ ይድምስሶ። ንነፍስወከፍ ዝርርብ ግዜ ወሰን ንዝገበርካዮ መደብ መልእኽትታት ይድምስስ።`,
    },
    {
      title: '10. ክትፈልጦም ዝግብኦም ደረታት',
      body: `ባዕልኻ ካብ እትረኽቦም ንሕና ክንነግረካ ንመርጽ።

• መፍትሕታት ኣብ ቀዳማይ ግዜ ምስ ተራእዩ ይእመኑ። ሓደ ሰብ ቅድሚ ዝኾነ መልእኽቲ ምልውዋጥካ መፍትሕ እንተተኪኡ፡ እቲ ዝርርብ ንግጉይ ሰብ ምተመስጠረ ነይሩ፡ ብምሉኡ ንቡር ምመሰለ። መተግበሪ መፍትሕ ደሓር ምስ ተቐየረ የፍልጠካ፡ ብኻልእ መስመር ክተወዳድሮ እትኽእል ናይ ውሕስነት ቁጽሪ ድማ የርኢ — ግን ከተወዳድሮ ዘገድድ ነገር የለን።
• ሓደ መሳርሒ ብሓደ ግዜ። ናይ ምምላስ ሓረግካ ንታሪኽካ ዝኸፍት መፍትሕ ይመልስ፡ ስለዚ ኣብ ሓድሽ መሳርሒ ምእታው ድሮ ዝረኸብካዮ ኣየጥፍኦን። ናይ ቅድሚት ምስጢራውነት ዘለዎም ዝርርባት ካብ ዝፈጠሮ መሳርሒ ፈጺሙ ዘይወጽእ ካልኣይ መፍትሕ ይጥቀሙ፦ ኣየናይ መሳርሒ ኣብ መወዳእታ እተኣተወ፡ ንሱ እዩ ዝበጽሕዎ፡ ኣብቲ ግዜ እቲ ንካልኦት ተመስጢሩ ዝጸንሐ ድማ ናብኡ ክግዕዝ ኣይክእልን።
• ቅድሚ ምስጢራውነት ምህላዉ ዝተላእኩ መልእኽትታት ከምዝነበሩ ይነብሩ። ናብ ድሕሪት ተመሊሱ ዝተቐየረ ነገር የለን።
• እዚ መተግበሪ ብናጻ ኣካል ናይ ውሕስነት መርመራ ኣይተገብረሉን።`,
    },
    {
      title: '11. ቆልዑ',
      body: `Chatterbox ንትሕቲ 13 ዓመት ቆልዑ ኣይተዳለወን፡ ንሕና ድማ ብፍላጥ ሓበሬታኦም ኣይንእክብን። ሓደ ቖልዓ ናይ ውልቁ ሓበሬታ ከምዝሃበና እንተኣሚንካ፡ ርኸበና፡ ንሕና ክንድምስሶ ኢና።`,
    },
    {
      title: '12. ለውጥታት',
      body: `ንዚ ፖሊሲ ከነሐድስ ንኽእል። ኣገደስቲ ለውጥታት ኣብ መተግበሪ ክግለጹ እዮም፡ ኣብ ላዕሊ ዘሎ ዕለት ድማ ናይ መወዳእታ ግዜ ምስ ተቐየረ የርኢ።`,
    },
    {
      title: '13. ርክብ',
      body: `ብዛዕባ እዚ ፖሊሲ ሕቶታት፦ ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. ሓድሽ ስሪት መተግበሪ ምፍታሽ',
      body: `Google Play እዚ መተግበሪ ናብ ተሌፎንካ Android ዝበጽሓሉ መንገዲ ኣይኮነን። ኣብ ክንድኡ ካብ chatterbox.fans ይንረድ፣ ከምኡ'ውን ኣብዚ መስርሕ ዘይሳተፈ ድኳን ብወገንካ ዝማናውነት ክፍትሽ ኣይክእልን እዩ — ስለዚ እዚ መተግበሪ እንተ ሓቲትካዮ ባዕሉ ክገብሮ ይኽእል።

"ሕጂ ፈትሽ" ምንካፍ ሓደ ጠለብ ናብ chatterbox.fans ይሰዶ፣ እቲ ህሉው ስሪት እንታይ ምዃኑ ይሓትት። እቲ ጠለብ ናይ IP ኣድራሻኻ ጥራይ ኢዩ ዝሓዘ፣ ካልእ ዋላ ሓንቲ የለን — ሕሳብ የለን፣ መለለዪ መሳርሒ የለን፣ መልእኽቲ የለን። ዝምለስ ቁጽሪ ስሪት ኢዩ፣ ኣብ ተሌፎንካ ምስቲ ትጥቀመሉ ዘለኻ ስሪት ይነጻጸር፤ ዋላ ሓንቲ ብቐጥታ ኣይንረድን፣ ብዛዕባ እዚ ምፍታሽ እውን ዋላ ሓንቲ ኣብ ዝርርብ ኣይጽሓፍን።

እዚ መቀየሪ የብሉን ምኽንያቱ ክጠፍእ ዝኽእል ነገር የለን፦ ብምንካፍ ጥራይ ኢዩ ዝሰርሕ፣ ብኻልእ ኣገባብ ኣይኮነን።

እቲ ዝማናውነት እንተ ጌርካዮ፣ ብተመሳሳሊ ፊርማ መፍትሕ ተጠቒሙ ነቲ መተግበሪ ኣብ ቦታኡ ይትክኦ፣ ልክዕ ከምቲ ካብ Google Play ዝመጽእ ዝማናውነት ዝገብሮ።`,
    },
  ],
  bo: [
    {
      title: '0. མདོར་བསྡུས།',
      body: `ཁྱེད་ཀྱི་འཕྲིན་ཡིག་གི་ཡིག་གེ་ཁྱེད་ཀྱི་ཆས་གྲལ་ཐོག་གསང་སྦས་ཡོད་ལ། ཁྱེད་ཀྱིས་བསྐུར་བའི་མི་ཚོས་ཁོ་ནས་ཀློག་ཐུབ། ང་ཚོས་དེ་ཀློག་མི་ཐུབ། ང་ཚོའི་ཡར་སྐད་གླ་རྔན་སྤྲོད་པའི་ Google་ཡིས་ཀྱང་ཀློག་མི་ཐུབ།

ང་ཚོས་མཐོང་ཐུབ་པ་ནི། ཁ་བརྡ་ཞིག་བྱུང་བའི་གནས་ཚུལ་ཡིན། སུ་དང་སུ་ཡི་ཞིབ་ཡིག་དེའི་ནང་ཡོད་པ་དང་། ནམ་ནང་ནུས་ལྡན་ཡིན་པ། དེ་འདོན་པ་ནི་ནང་དོན་གསང་སྦས་བྱེད་པ་ལས་ཁག་པོ་ཡིན་ལ། ང་ཚོས་ད་དུང་མཇུག་མ་སྒྲིལ། ད་ལྟ་ཚུད་མཚམས་གང་ཡིན་པ་སྲིད་བྱུས་འདིས་ཏག་ཏག་བཤད་ཀྱི་ཡོད།`,
    },
    {
      title: '1. ཅི་ཞིག་མཐའ་མཇུག་གསང་སྦས་ཡིན།',
      body: `ཁྱེད་ཀྱི་ཆས་གྲལ་ཐོག་གསང་སྦས་ཡོད་ལ། ང་ཚོ་དང་ Google ལ་ཀློག་མི་ཐུབ་པ།

• ཁྱེད་ཀྱི་འཕྲིན་ཡིག་གི་ཡིག་གེ།
• ཁྱེད་ཀྱིས་སྦྲེལ་བའི་ཡིག་ཆ། པར། སྐད་སྒྲ་དང་བརྙན་ཡིག་གི་ནང་དོན།
• འབྲེལ་མཐུད་ཀྱི་སྔོན་ལྟ།
• ཆས་གྲལ་གཉིས་བར་གྱི་གལ་ཆེའི་ WebRTC DTLS-SRTP བེད་སྤྱོད་བྱེད་པའི་སྐད་སྒྲ་དང་བརྙན་ཡིག་ཁ་པར།

མི་གཉིས་བར་དང་ཚོགས་པའི་འཕྲིན་ཡིག་མང་ཆེ་བས་ ratchet ཟེར་བའི་ལག་ཆ་ཡང་བེད་སྤྱོད་བྱེད་ཀྱིས། འདིའི་དོན་ནི་འཕྲིན་ཡིག་རེ་རེ་ལ་རང་གི་ལྡེ་མིག་ཡོད་པ་ཡིན་ལ། ཁྱེད་ཀྱི་ཆས་གྲལ་གནོད་སྐྱོན་བྱུང་ཡང་སྔོན་གྱི་འཕྲིན་ཡིག་མི་ཐོན། སུ་ཞིག་གི་ཆས་གྲལ་གྱིས་ལྡེ་མིག་གསར་པ་མ་སྤེལ་བའི་ཁ་བརྡ་རྣམས་ཡུན་རིང་ལྡེ་མིག་གཅིག་ལ་སླར་ལོག་ཡོང་། དེར་ཁྱད་ཆོས་འདི་མེད། འཕྲིན་ཡིག་འོག་གི་བརྡ་མཚོན་གྱིས་གང་ཐོབ་པ་ངོས་བཟུང་བཤད།

གཅིག་པུ་ཞིག་ཚུད་མཚམས་འདི་སྒྲོལ་ཐུབ། ཁྱེད་ཀྱིས་ཞུས་པའི་སྐབས་ཁོ་ན། Wikipedia ཐོག་མིང་འཚོལ་བས་མིང་དེ་ཁོ་ན་བསྐུར། གང་ནས་ཐོན་པའི་འཕྲིན་ཡིག་མིན། ཡན་ལག་ ༦ ནང་སུས་ཐོབ་པ་བཤད། འཚོལ་ཞིབ་དེ་ནོན་སྐབས་ཁོ་ན་ལས་སྦྱོར་ཡིན་ལ། གཞན་དུ་མིན་པས་སྒོ་རྒྱག་རྒྱུའི་ཅི་ཡང་མེད། བསྡུས་དོན་བཟོ་བ། སྐད་སྒྱུར་དང་ཡིག་སྒྱུར་ཡང་མཚམས་འདི་སྒྲོལ་ངེས་ཡིན་ལ། པར་ལེན་འདིའི་ནང་སྒོ་བརྒྱབ་ཡོད་ལ། མེའུ་ཆུང་ཐོག་ཕྱེ་ཐུབ་པའི་སྒྲིག་ཆས་གང་ཡང་མེད།`,
    },
    {
      title: '2. ཅི་ཞིག་གསང་སྦས་མིན་ཞིང་ང་ཚོས་ཅི་མཐོང་ཐུབ།',
      body: `གསང་སྦས་ཀྱིས་ནང་དོན་སྲུང་སྐྱོབ་བྱེད་ཀྱི་ཡོད་ལ། ཁ་བརྡ་བྱུང་བའི་གནས་ཚུལ་ཉིད་མིན། འདི་དག་ང་ཚོའི་སར་བར་ཐོག་གསལ་པོར་ཡོད།

• ཁ་བརྡ་རེ་རེའི་ནང་སུ་ཡོད་པ་དང་ནམ་བཟོས་ཤིང་མཐའ་མའི་ནང་ནུས་ལྡན་ཡིན་པ།
• འཕྲིན་ཡིག་རེ་རེའི་དུས་ཚོད་བརྡ་མཚོན་དང་ཁྱེད་ཀློགས་མེད་པའི་གྲངས་ཀ།
• སྦྲེལ་ཡིག་གི་ཡིག་ཆའི་མིང་། རིགས་དང་ཆེ་ཆུང་། ཡིག་གྲངས་ཚང་མ་གསང་སྦས་ཡོད། ངོ་སྤྲོད་གསང་སྦས་མིན། གསང་སྦས་ཡིག་གེའི་རིང་ཚད་ཀྱིས་གཞི་མའི་རིང་ཚད་ཚད་གཞི་བཟོ།
• ཁྱེད་ཀྱི་གྲོགས་པོ་དང་གྲོགས་པོའི་ཞུ་བ།
• ཁ་པར་བརྡ་མཚོན་སྤེལ་བ། ཁ་པར་ཞིག་བཏང་བ། སུ་ལ་དང་ནམ། དེའི་སྐད་སྒྲའམ་བརྙན་ཡིག་མིན།

ཡིག་འབྲིའི་བརྡ་མཚོན་དང་ཀློག་པའི་གཏན་འཁེལ་ཁྱེད་ཀྱིས་མ་ཕྱེ་བར་སྒོ་བརྒྱབ་ཡོད། སྒོ་བརྒྱག་བཞིན་པའི་སྐབས་ཅི་ཡང་མི་འབྲི།

ད་དུང་ཡོད་མེད་པ། ཁྱེད་ཀྱི་གློག་འཕྲིན་ཁ་བྱང་དང་མིང་། ༢༠༢༦ ལོའི་ཟླ་ ༩ ནས་བཟུང་ཞིབ་ཡིག་ཐོ་གཞུང་གིས་ཞིབ་ཡིག་ངོ་རྟགས་ཁོ་ན་འཛིན། དེ་ནས་བཟུང་ག་ནའང་ཉར་ཐུབ་པའི་ཁ་བྱང་མེད། ཐོ་འགོད་བྱེད་སྐབས་ཁྱེད་སྐོར་ཅི་ཡང་མི་འདྲི། ཁྱེད་ཀྱི་ཞིབ་ཡིག་ནི་ཚིག་ ༢༤ ཡི་ཡང་བསྐྱར་ཐབས་ཀྱི་ཚིག་སྡེབ་ཡིན་ལ། Firebase Authentication ཞིབ་བཤེར་བྱེད་པའི་ཡིད་ཆེས་ཡིག་ཆ་དེ་ནས་ཐོན། ཉར་ཚགས་བྱེད་པ་ནི་གློག་འཕྲིན་ལེན་མི་ཐུབ་པའི་ཁྱབ་ཁོངས་འོག་གི་གང་བྱུང་བརྡ་མཚོན་ཞིག་ཡིན།

སོ་སོར། མེཊགྷེར་ Chatterbox Google Firebase ཐོག་ལས་སྦྱོར་བྱེད་པས། ཁྱེད་ཀྱི་ཆས་གྲལ་གྱིས་དེར་བྱེད་པའི་འབྲེལ་མཐུད་རེ་རེའི་ IP ཁ་བྱང་དང་དུས་ཚོད་ Google་ལ་མཐོང་ཐུབ། འདི་ཨེན་ཊར་ནེཊ་འཛིན་སྐྱོང་གི་ཁྱད་ཆོས་ཡིན་ལ། མེའུ་ཆུང་གི་མིན། གསང་སྦས་ཐོག་འདི་འདོན་ཐབས་ང་ཚོར་མེད།`,
    },
    {
      title: '3. མི་ཚོས་ཁྱེད་ག་འདྲ་ཞིག་རྙེད་པ།',
      body: `ཁོང་ཚོས་ཁྱེད་འཚོལ་མི་ཐུབ། འདིར་ཐོ་གཞུང་མེད། གློག་འཕྲིན། ཁ་པར་ཨང་གྲངས་སམ་མིང་ཐོག་འཚོལ་ཞིབ་མེད། སར་བར་གྱིས་དེ་ལྟར་ཚོད་ལྟ་བྱེད་པའི་འདྲི་བ་གང་ཡང་ངོ་རྒོལ་བྱེད།

ཁྱེད་ཀྱིས་མི་ཞིག་ལ་ད་ལྟ་བེད་སྤྱོད་བྱེད་བཞིན་པའི་གང་ཐོག་གནས་ཚུལ་ལམ་གཞན་ནས་བོས་འགུགས་འབྲེལ་མཐུད་བསྐུར་ནས་བཅར་ཐུབ། འབྲེལ་མཐུད་ལན་གཅིག་ལས་ཀ་བྱེད་ལ། ཆུ་ཚོད་ ༢༤ ནང་དུས་ཚོད་ཚང་ལ་ཕྱིར་འཐེན་ཐུབ། ཁྱེད་ཀྱིས་མི་ཞིག་ག་འདྲ་ཞིག་བོས་ཀྱང་། དེ་ཁྱེད་རང་གི་བརྡ་མཚོན་ཁོ་ན་ཡིན་ལ་ཁྱེད་ཆེད་ཉར་ཡོད། ཁོང་གིས་རང་ཉིད་ངོ་སྤྲོད་བྱས་ན་མིང་དེ་ཁྱེད་ལ་གསང་སྦས་ཐོག་སླེབས།`,
    },
    {
      title: '4. ང་ཚོས་ཅི་ཞིག་བསྡུ་ལེན་བྱེད།',
      body: `• ཞིབ་ཡིག་གནས་ཚུལ། ཞིབ་ཡིག་ངོ་རྟགས་དང་ཁྱེད་ཀྱི་ཡང་བསྐྱར་ཐབས་ཀྱི་ཚིག་སྡེབ་ནས་ཐོན་པའི་ཡིད་ཆེས་ཡིག་ཆ། Firebase Authentication ནང་ཉར་ཡོད། གློག་འཕྲིན་ཁ་བྱང་མེད། ཁ་པར་ཨང་གྲངས་མེད། མིང་མེད། ཐོ་འགོད་བྱེད་སྐབས་འདི་དག་ནས་གང་ཡང་མི་འདྲི།
• འཕྲིན་ཡིག་དང་སྦྲེལ་ཡིག་གི་གསང་སྦས་ཡིག་གེ། ཡན་ལག་ ༢ ནང་བཤད་པའི་ལོ་རྒྱུས་གནས་ཚུལ་ཡང་།

འདི་ཐོ་ཡོངས་རྫོགས་ཡིན། ཞིབ་འཇུག་དང་གནོད་སྐྱོན་སྙན་ཞུ་མེད། སྔོན་ལ་མེའུ་ཆུང་གིས་བརྙན་ཤོག་མཐོང་ཚུལ་ Firebase Analytics ལ་དང་གནོད་སྐྱོན་སྙན་ཞུ་ Firebase Crashlytics ལ་བསྐུར་ཞིང་། གཉིས་ཀར་ཁྱེད་ཀྱི་ཞིབ་ཡིག་ངོ་རྟགས་འཁྱེར་བས་གཉིས་ཀ་མིང་མེད་མིན་ཡིན། གཉིས་ཀ་ད་ལྟ་དེ་དག་བསྐུར་བའི་སྤྱོད་ཆས་དང་མཉམ་དུ་ཕྱིར་འདོན་ཟིན། ནོར་འཁྲུལ་ནི་སྐད་སྒྱུར་མཁན་གྱི་རང་ཉིད་ཀྱི་མེའུ་ཆུང་ཐོག་བཟོ་བའི་སྐབས་གཞིར་ལས་གང་ཡང་ཕར་མི་འགྲོ།`,
    },
    {
      title: '5. ག་ཏེར་ཉར་ཡོད།',
      body: `Google Firebase ཐོག — Firestore, Storage དང་ Authentication — ཡིག་ཆ་རེ་རེར་སུས་ཀློག་བྲིས་ཐུབ་པ་ཐག་གཅོད་བྱེད་པའི་བདེ་སྲུང་སྒྲིག་གཞིའི་འོག་ཏུ།

ཁྱེད་ཀྱི་ཆས་གྲལ་ཐོག་ཉར་ཚགས་བྱས་པའི་འཕྲིན་ཡིག ་སྒྲིག་འགོད་དང་ཁྱེད་ཀྱི་ཆས་གྲལ་སྒོ་རྒྱག་ PIN་ཨང་ཡིག་ཆས་གྲལ་སོ་སོའི་ལྡེ་མིག་ཐོག་གནས་སྟངས་ལྡེ་མིག་མཛོད་ (iOS Keychain, Android Keystore) ནང་གསང་སྦས་ཡོད། ཐུན་མོང་མའི་ཆས་གྲལ་མཛོད་ནང་མིན།

ཁྱེད་ཀྱི་འཕྲིན་ཡིག་གསང་སྒྲོལ་བྱེད་པའི་གསང་བའི་ལྡེ་མིག་ཁྱེད་ཀྱིས་བྲིས་ཐོག་ཉར་བར་གདམ་ག་བྱེད་པའི་ཡང་བསྐྱར་ཐབས་ཀྱི་ཚིག་སྡེབ་ལས་ཁྱེད་ཀྱི་ཆས་གྲལ་ནས་ནམ་ཡང་མི་འཐོན། ང་ཚོས་མི་འཛིན་ལ་ཁྱེད་ཆེད་སླར་གསོ་མི་ཐུབ། བརླག་ན། ཆས་གྲལ་དེར་བསྐུར་བའི་འཕྲིན་ཡིག་སླར་ཀློག་མི་ཐུབ། ང་ཚོ་ཡང་ཚུད་ཟིན་པའི་སུ་ལའང་མིན།`,
    },
    {
      title: '6. ཁྱེད་ཀྱི་གནས་ཚུལ་སུས་ཐོབ།',
      body: `ཁྱེད་ཀྱི་སྒེར་གྱི་གནས་ཚུལ་ང་ཚོས་མི་འཚོང་། མི་བརྗེ། མི་གཡར། གནས་ཚུལ་འདིར་སླེབས།

• Google Firebase — སྟེང་དུ་བཤད་པ་བཞིན། ང་ཚོའི་ཆས་གྲལ་སྤེལ་མཁན།
• Cloudflare Realtime — ཁྱེད་ཀྱི་སྒྲིག་ཆས་དང་མི་གཞན་གྱི་སྒྲིག་ཆས་གཉིས་ཀ་གཅིག་གིས་གཅིག་ཐད་ཀར་འབྲེལ་མཐུད་བྱེད་མི་ཐུབ་པའི་སྐབས་སུ་ཁ་པར་གྱི་སྒྲ་དང་བརྙན་པར།
• Wikimedia Foundation — Wikipedia ཐོག་འཚོལ་ཆེད་ནོན་སྐབས་མིང་གཅིག
• Google Cloud Speech-to-Text — ཁྱེད་ཡིག་སྒྱུར་ཞུས་སྐབས་སྐད་སྒྲའི་འཕྲིན་ཡིག་གཅིག་གི་སྐད་སྒྲ།
• Google Cloud Translation — ཁྱེད་སྐད་སྒྱུར་ཞུས་སྐབས་འཕྲིན་ཡིག་གཅིག་གི་ཡིག་གེ།
• Cloudflare Workers AI — ཁྱེད་བསྡུས་དོན་ཞུས་སམ་དྲིས་སྐབས་ཁ་བརྡ་གཅིག་གི་མཐའ་མའི་འཕྲིན་ཡིག་ ༥༠ བར།

མཐའ་མའི་གསུམ་འདི་ཐོན་འདིར་སྒོ་བརྒྱབ་ཡོད། ཆས་གྲལ་ནང་ཡིག་སྒྱུར། སྐད་སྒྱུར་ཡང་ན་བསྡུས་དོན་ཕྱེ་ཐུབ་པའི་སྒྲིག་ཆས་གང་ཡང་མེད་པས། ཞབས་ཞུ་གསུམ་པོ་འདིར་ཅི་ཡང་མི་སླེབས། ཨང་ཀི་ད་དུང་འདིར་ཡོད་ཅིང་ཁྱད་ཆོས་སླར་ཡོང་དགོས་པས་ཐོ་བཀོད་ཡོད། སུབ་མེད། སླར་ཡོང་སྐབས་འདིའི་གསལ་སྟོན་དང་ཐོག་མའི་བེད་སྤྱོད་སྔོན་ཞུ་གནང་མཁན་ཐོག་སླར་ཡོང་ངེས། དེའི་སྐབས་བསྐུར་བར་གྱུར་བ་ཁྱེད་ཀྱི་གྲུབ་འབྲས་ཐོན་ཆེད་ཡིན་ལ། ཅི་ཞིག་སྦྱོང་བརྡར་བྱེད་ཆེད་མིན། ཡིག་སྒྱུར་རམ་སྐད་སྒྱུར་ང་ཚོའི་སར་བར་ཐོག་མི་ཉར།

Wikipedia འཚོལ་ཞིབ་ལ་སྒྲིག་ཆས་མེད། སྒོ་རྒྱག་རྒྱུའི་ཅི་ཡང་མེད་པས། ནོན་སྐབས་ཁོ་ན་ལས་སྦྱོར་ཡིན། Wikipedia ཡིས་མིང་གཅིག་དེ་དང་ཁྱེད་ཀྱི་ IP ཁ་བྱང་ཁོ་ན་ཐོབ། ཁོང་ཚོའི་རང་ཉིད་ཀྱི་འཚོལ་ཞིབ་ཁང་ནང་ཁྱེད་རང་ཉིད་ཀྱིས་བཙུགས་པ་བཞིན། ཞིབ་ཡིག་མེད། འཕྲིན་ཡིག་མེད། ཁ་བརྡ་མེད། སླར་ཡོང་བ་སྟོན་ལ་མི་ཉར། དེའི་སྐོར་ཅི་ཡང་ཁ་བརྡར་མི་འབྲི།

Cloudflare Realtime ལའང་ལྡེ་མིག་མེད། ཁ་པར་ཕལ་ཆེར་ལ་འདི་དགོས་མེད། སྒྲིག་ཆས་གཉིས་གཅིག་གིས་གཅིག་ཐད་ཀར་འབྲེལ་མཐུད་བྱེད་ཐུབ་མཁན—ཚང་མ་ནི་ཐོག་མའི་ནེཊི་ཝརཀ་གཅིག་གི་ཐོག་གི་ཁ་པར་ཕལ་ཆེར་ཡིན—དེ་མེད་པར་འབྲེལ་མཐུད་བྱེད་ཐུབ་ལ། གང་ཡང་བརྒྱུད་འགྲེམ་བྱེད་ཀྱི་མེད། ཁོང་ཚོས་འབྲེལ་མཐུད་བྱེད་མི་ཐུབ་པའི་སྐབས—གཙོ་བོ་ཁྱེད་གཉིས་ཀ་ཐོག་མའི་ནེཊི་ཝརཀ་མི་འདྲ་བའི་ཐོག་ཡོད་པའི་རྐྱེན་གྱིས—ད་ལྟ་ཡང་གསང་སྒྲིག་ཟིན་པའི་ཁ་པར་དེ་འབྲེལ་མཐུད་མེད་པར་ལུས་པའི་ཚབ་ཏུ་བརྒྱུད་འགྲེམ་བྱེད་ཀྱི་རེད། Cloudflare གིས་མཐོང་བ་ནི་གཉིས་ཀའི་ IP ཁ་བྱང་། ཁ་པར་གྱི་དུས་ཚོད། དེ་བཞིན་གྲངས་ཀ་ཙམ་གྱི་གནས་ཚུལ་ཚད་གང་འགྱུར་བ་བྱུང་མིན་ཡིན། སྒྲ་དང་བརྙན་པར་ནི་ཡིག་ཆ་ ༢ ནང་བཤད་པའི་ DTLS-SRTP གསང་སྒྲིག་གཅིག་མཚུངས་ཀྱི་འོག་ཏུ་ལུས་ཀྱི་ཡོད་སྟབས། བརྒྱུད་འགྲེམ་བྱེད་པས་དེ་ཚོ་གསང་སྒྲིག་ཕྱེ་ཀྱི་མེད།

ཁྲིམས་ཀྱིས་དགོས་ན་ང་ཚོར་ཡོད་པ་སྟོན་ཐུབ། ང་ཚོར་ཡོད་པ་ཡན་ལག་ ༢ ཡི་ཐོ་ཡིན། འཕྲིན་ཡིག་གི་ནང་དོན་སྟོན་མི་ཐུབ། ང་ཚོས་ཀློག་མི་ཐུབ་པའི་ཕྱིར།`,
    },
    {
      title: '7. Push་བརྡ་ལན།',
      body: `Firebase Cloud Messaging གིས་བརྡ་ལན་འབྲེལ་མཐུད་བྱེད། ཁྱེད་ཀྱི་ཆས་གྲལ་ཏོ་ཀེན་ཁྱེད་ཀྱི་ཞིབ་ཡིག་གི་སྒེར་གྱི་ཆ་ཤས་ཐོག་ཉར་ཡོད། ཁྱེད་རང་ཁོ་ནས་ཀློག་ཐུབ།

བརྡ་ལན་གྱིས་འཕྲིན་ཡིག་གི་ཡིག་གེ་ག་ནའང་མི་འཁྱེར། ཁྱེད་ཀྱི་ཆས་གྲལ་ས་ཐོག་གསང་སྒྲོལ་བྱས་ནས་ཁྱེད་མཐོང་བ་བཟོ། Google་གིས་ཡིག་ཟམ་སྤེལ། ནང་དོན་མིན།`,
    },
    {
      title: '8. ཁྱེད་ཀྱིས་ཅི་ཞིག་བྱེད་ཐུབ།',
      body: `• ངོ་སྤྲོད་ཤོག་ངོས་ནས་ཁྱེད་ཀྱི་ཞིབ་ཡིག་སུབ། ཁ་བརྡའི་མཉམ་ཆ་ཤས་ཡིན་པའི་ནང་དོན — དཔེར་ན་ཁ་པར་གྱི་ཟིན་ཐོ — ཞུགས་མཁན་གཞན་དེར་ལུས། ཁོང་གི་ཟིན་ཐོ་ཡང་ཡིན་པས།
• ངོ་སྤྲོད་ཤོག་ངོས་ནས་ཁྱེད་ཀྱི་གནས་ཚུལ་ཕྱིར་འདོན།
• ཁ་བརྡ་རེ་རེར་འཕྲིན་ཡིག་གི་དུས་ཚོད་ཚང་ཚུལ་སྒྲིག༔ ཆུ་ཚོད་ ༡། ཆུ་ཚོད་ ༢༤། ཉིན་ ༧ འམ་ཉིན་ ༣༠།
• ཡིག་འབྲིའི་བརྡ་མཚོན་དང་ཀློག་པའི་གཏན་འཁེལ་ཕྱེ་འམ་སྒོ་རྒྱག ཁོང་ཚོའི་ཆ་གཉིས་ཀ་སྔར་སྒྲིག་སྒོ་བརྒྱབ་ཡོད།
• PIN་འམ་ལུས་མཚན་ཐོག་ཆས་གྲལ་སྒོ་རྒྱག
• ཁྱེད་ཀྱིས་སྤྲད་ཟིན་པའི་བོས་འགུགས་འབྲེལ་མཐུད་ཕྱིར་འཐེན།

ང་ཚོས་ལག་ཐོག་གང་ཞིག་སུབ་བར་ཁྱེད་འདོད་ན། ང་ཚོར་ཡིག་བྲིས།`,
    },
    {
      title: '9. ཉར་ཚགས་རིང་ཚད།',
      body: `ཁྱེད་ཀྱི་ཞིབ་ཡིག་ཡོད་བར་ང་ཚོས་ཁྱེད་ཀྱི་གནས་ཚུལ་ཉར། ཞིབ་ཡིག་སུབ་པས་སྟེང་དུ་བཤད་པའི་མཉམ་ཆ་ཤས་མ་གཏོགས་གཞན་སུབ། ཁ་བརྡ་རེ་རེའི་དུས་ཚོད་ཚང་ཚུལ་གྱིས་ཁྱེད་ཀྱིས་སྒྲིག་པའི་དུས་ཚོད་ཐོག་འཕྲིན་ཡིག་འདོན།`,
    },
    {
      title: '10. ཁྱེད་ཤེས་དགོས་པའི་ཚད་བཀག',
      body: `ཁྱེད་རང་ཉིད་ཀྱིས་རྙེད་པའི་ཚབ་ཏུ་ང་ཚོས་ཁྱེད་ལ་བཤད་པར་དགའ།

• ལྡེ་མིག་ཐོག་མར་མཐོང་བའི་སྐབས་ཡིད་ཆེས་བྱེད། ཁྱེད་ཀྱིས་འཕྲིན་ཡིག་གང་ཡང་མ་བརྗེ་བའི་སྔོན་ལ་སུ་ཞིག་གིས་ལྡེ་མིག་ཚབ་བརྗེས་ན། ཁ་བརྡ་དེ་མི་ནོར་བའི་མི་ཞིག་ལ་གསང་སྦས་ཡིན་ལ་བལྟས་ན་ཡོངས་རྫོགས་ཏག་ཏག་འདྲ། ལྡེ་མིག་ཕྱིས་སུ་བརྗེས་ན་མེའུ་ཆུང་གིས་ཁྱེད་ལ་ཐོ་འགོད་བྱེད་ལ། ཕྱིའི་ལམ་ཐོག་བསྡུར་ཐུབ་པའི་བདེ་སྲུང་ཨང་གྲངས་སྟོན། ཡིན་ནའང་བསྡུར་ཐབས་ཁྱེད་ལ་བཙན་གྱིས་བཀལ་བ་གང་ཡང་མེད།
• དུས་ཚོད་གཅིག་ལ་ཆས་གྲལ་གཅིག་པུ། ཁྱེད་ཀྱི་ཡང་བསྐྱར་ཐབས་ཀྱི་ཚིག་སྡེབ་ཀྱིས་ཁྱེད་ཀྱི་ལོ་རྒྱུས་ཕྱེ་བའི་ལྡེ་མིག་སླར་གསོ་བྱེད་པས། ཆས་གྲལ་གསར་པར་ནང་འཛུལ་བྱེད་པས་ཁྱེད་ཀྱིས་ད་ལྟ་ཐོབ་ཟིན་པ་མི་བརླག ་མདུན་ཕྱོགས་གསང་བ་ཡོད་པའི་ཁ་བརྡ་རྣམས་ཀྱིས་བཟོ་མཁན་ཆས་གྲལ་ནས་ནམ་ཡང་མི་འཐོན་པའི་ལྡེ་མིག་གཉིས་པ་བེད་སྤྱོད་བྱེད། ཆས་གྲལ་གང་ཞིག་མཐའ་མར་ནང་འཛུལ་བྱས་ཀྱང་ཐད་ཀར་དེར་སླེབས་ལ། དེའི་བར་སྐབས་ཆས་གྲལ་གཞན་དེར་གསང་སྦས་བྱས་པ་གང་ཡང་དེར་སྤོ་མི་ཐུབ།
• གསང་སྦས་ཡོད་མེད་སྔོན་ལ་བསྐུར་བའི་འཕྲིན་ཡིག་སྔར་ཇི་བཞིན་ལུས། ཕྱིར་ལོག་ནས་བརྗེས་པ་གང་ཡང་མེད།
• ཆས་གྲལ་འདིར་རང་བཙན་གྱི་བདེ་སྲུང་ཞིབ་བཤེར་བྱས་མེད།`,
    },
    {
      title: '11. བྱིས་པ།',
      body: `Chatterbox ལོ་ ༡༣ མན་ཆད་ཀྱི་བྱིས་པ་ཆེད་བཟོས་མེད་ལ། ང་ཚོས་ཤེས་བཞིན་དུ་ཁོང་ཚོའི་གནས་ཚུལ་མི་བསྡུ། བྱིས་པ་ཞིག་གིས་ང་ཚོར་སྒེར་གྱི་གནས་ཚུལ་སྤྲད་ཡོད་པར་ཁྱེད་ཀྱིས་ཡིད་ཆེས་ན། ང་ཚོར་འབྲེལ་བ་གནང་། ང་ཚོས་དེ་སུབ་ངེས།`,
    },
    {
      title: '12. བརྗེ་བ།',
      body: `ང་ཚོས་སྲིད་བྱུས་འདི་གསར་སྒྱུར་ཐུབ། གལ་ཆེའི་བརྗེ་བ་ཆས་གྲལ་ནང་བསྒྲགས་ངེས་ལ། སྟེང་གི་ཚེས་གྲངས་ནི་མཐའ་མའི་བརྗེས་དུས་ཡིན།`,
    },
    {
      title: '13. འབྲེལ་བ།',
      body: `སྲིད་བྱུས་འདིའི་སྐོར་དྲི་བ། ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. སྤྱོད་ཆས་ཀྱི་པར་གཞི་གསར་པ་ཞིབ་བཤེར།',
      body: `Google Play ནི་སྤྱོད་ཆས་འདི་ཁྱེད་ཀྱི་ Android ཁ་པར་དུ་སླེབས་པའི་ལམ་མིན། དེའི་ཚབ་ཏུ་ chatterbox.fans ནས་ཕབ་ལེན་བྱེད་ཀྱི་ཡོད་ལ། འདི་ལྟ་བུའི་བྱ་རིམ་ནང་མ་ཞུགས་པའི་ཚོང་ཁང་ཞིག་གིས་ཁྱེད་ཀྱི་ཚབ་བྱས་ནས་གསར་སྒྱུར་ཞིབ་བཤེར་བྱེད་མི་ཐུབ། དེར་བརྟེན་ཁྱེད་ཀྱིས་བཀའ་འདྲི་ཞུས་ན་སྤྱོད་ཆས་འདི་རང་ཉིད་ཀྱིས་དེ་བྱེད་ཐུབ།

"ད་ལྟ་ཞིབ་བཤེར།" ལ་མནན་ན་ད་ལྟའི་པར་གཞི་གང་ཡིན་ཞེས་འདྲི་བའི་གནང་བ་ཞིག་ chatterbox.fans ལ་བཏང་གི་ཡོད། གནང་བ་དེའི་ནང་ཁྱེད་ཀྱི་ IP ཁ་བྱང་གཅིག་པུ་ཡོད་ལ་གཞན་གང་ཡང་མེད། —རྩིས་ཐོ་མེད། སྒྲིག་ཆས་ངོས་འཛིན་མེད། འཕྲིན་ཡིག་མེད། ལོག་སླེབས་བྱུང་བ་ནི་པར་གཞིའི་ཨང་གྲངས་ཤིག་ཡིན་ལ། ཁྱེད་ཀྱི་ཁ་པར་ནང་ད་ལྟ་སྤྱོད་བཞིན་པའི་པར་གཞི་དང་བསྡུར་ཞིབ་བྱེད་ཀྱི་ཡོད། གང་ཡང་རང་འགུལ་གྱིས་ཕབ་ལེན་བྱེད་ཀྱི་མེད་ལ། ཞིབ་བཤེར་འདིའི་སྐོར་གང་ཡང་གླེང་མོལ་ནང་འབྲི་ཀྱི་མེད།

འདིར་ལྡེ་མིག་མེད་དེ་ག་རེ་ཡིན་ཟེར་ན་ཆེད་བརྗོད་བྱེད་རྒྱུའི་གནས་ཚུལ་གང་ཡང་མེད། འདི་ནི་མནན་སྐབས་གཅིག་པུར་ལས་ཀ་བྱེད་ཀྱི་ཡོད་ལ་ལམ་ལུགས་གཞན་གྱིས་མིན།

ཁྱེད་ཀྱིས་གསར་སྒྱུར་སྒྲིག་སྦྱོར་བྱས་ན། དེས་མིང་རྟགས་ལྡེ་མིག་གཅིག་མཚུངས་བེད་སྤྱོད་བྱས་ནས་སྤྱོད་ཆས་དེ་ཉིད་ས་ཆ་གང་ཡིན་སར་ཚབ་བརྗེ་བྱེད་ཀྱི་ཡིན། Google Play ནས་འོང་བའི་གསར་སྒྱུར་ཞིག་གིས་བྱེད་སྟངས་དང་གཅིག་མཚུངས་རེད།`,
    },
  ],

  mn: [
    {
      title: '0. Товчхондоо',
      body: `Таны зурвасын текст таны төхөөрөмж дээр шифрлэгддэг бөгөөд зөвхөн таны илгээсэн хүмүүс уншиж чадна. Бид үүнийг унших боломжгүй, мөн бидний сервер түрээслэдэг Google ч бас чадахгүй.

Бидний харж чадах зүйл бол харилцаа өрнөсөн явдал — ямар данснууд оролцсон, хэзээ идэвхтэй байсан. Үүнийг арилгах нь агуулгыг шифрлэхээс илүү хэцүү бөгөөд бид энэ ажлыг хараахан дуусгаагүй байна. Энэхүү бодлого нь одоогийн байдлаар хил хаана байгааг яг таг хэлж өгнө.`,
    },
    {
      title: '1. Юу нь төгсгөл-төгсгөлийн шифрлэгдсэн бэ',
      body: `Таны төхөөрөмж дээр шифрлэгдэж, бид болон Google унших боломжгүй:

• Таны зурвасын текст.
• Таны хавсаргасан файл, зураг, дуу, видеоны агуулга.
• Холбоосын урьдчилан харах.
• Дуут ба видео дуудлага — эдгээр нь хоёр төхөөрөмжийн хооронд WebRTC-ийн заавал шаардсан DTLS-SRTP-г ашигладаг.

Ихэнх хоёулхны болон бүлгийн зурвасууд нэмэлтээр ratchet ашигладаг тул зурвас бүр өөрийн гэсэн түлхүүртэй бөгөөд таны төхөөрөмж эвдэрсэн ч өмнөх зурвасууд ил гарахгүй. Хэн нэгний клиент шинэ түлхүүрийн материалыг хараахан нийтлээгүй харилцаанууд нэг л удаан хугацааны түлхүүр рүү буцдаг бөгөөд энэ нь дээрх шинж чанаргүй. Зурвасын доорх тэмдэглэгээ тухайн зурвас яг алийг нь авсныг хэлж өгнө.

Ганцхан зүйл энэ хилийг давдаг бөгөөд зөвхөн та үүнийг хүсэх үед: Википедиагаас нэр хайх нь тэр зурвас биш зөвхөн тэр нэрийг илгээдэг. Хэсэг 6-д хэн үүнийг хүлээн авдгийг хэлсэн бөгөөд хайлт нь товшсон үед л ажилладаг тул унтраах юм байхгүй. Хураангуйлах, орчуулах, текст болгон хувиргах ажиллагаа ч бас энэ хилийг давах байсан — эдгээр нь энэ хувилбарт унтраалттай бөгөөд аппын ямар ч газар үүнийг асаах хяналт байхгүй.`,
    },
    {
      title: '2. Юу нь шифрлэгдээгүй бэ, бид юу харж чадах вэ',
      body: `Шифрлэлт нь агуулгыг хамгаалдаг, харин харилцаа өрнөсөн баримтыг хамгаалдаггүй. Дараах зүйлс манай серверт нээлттэй хэвээр байна:

• Харилцаа бүрт хэн байгаа, хэзээ үүсгэгдсэн, хамгийн сүүлд хэзээ идэвхтэй байсан.
• Зурвас бүрийн цаг хугацааны тэмдэглэгээ, мөн та хэдийг уншаагүй.
• Хавсралтын файлын нэр, төрөл, хэмжээ. Байт нь шифрлэгдсэн; түүний тайлбар шифрлэгдээгүй бөгөөд шифрлэгдсэн текстийн урт нь эх зурвасын уртыг хязгаарладаг.
• Таны найзууд болон найзын хүсэлтүүд.
• Дуудлагын дохио — дуудлага хийгдсэн, хэнд, хэзээ гэдэг. Түүний дуу, видео биш.

Бичиж буйг харуулах, уншсан баталгаа нь та тэдгээрийг асаахгүй л бол унтраалттай бөгөөд унтраалттай байх зуур юу ч бичигдэхгүй.

Одоо энд байхгүй болсон зүйл: таны и-мэйл хаяг, таны нэр. 2026 оны 9 сараас хойш дансны бичлэгт зөвхөн дансны танигч л байдаг — тэр цагаас хойш ямар ч газар хадгалах хаяг байхгүй болсон. Бүртгүүлэх нь таны тухай юу ч асуудаггүй: таны данс бол 24 үгтэй сэргээх хэллэг бөгөөд Firebase Authentication шалгадаг итгэмжлэл түүнээс гаргаж авагддаг. Энэ нь захидал хүлээн авах боломжгүй домэйн доорх санамсаргүй шошгыг л хадгалдаг.

Тусад нь хэлэхэд: энэ апп Google Firebase дээр ажилладаг тул Google таны төхөөрөмжийн серверт хийсэн холболт бүрийн IP хаяг, цаг хугацааг харах боломжтой. Энэ нь аппын биш зочилуулгын шинж чанар бөгөөд бид үүнийг шифрлэж арилгах боломжгүй.`,
    },
    {
      title: '3. Хүмүүс таныг хэрхэн олдог вэ',
      body: `Тэд таныг хайж олох боломжгүй. Энд лавлах алга — и-мэйл, утасны дугаар, нэрээр хайх боломжгүй — сервер ийм асуулга бүрийг татгалзана.

Та хэн нэгэнтэй холбогдохын тулд аль хэдийн ашигладаг сувгаараа урилгын холбоосыг гадуур илгээдэг. Холбоос нэг удаа ажиллаж, 24 цагийн дараа хугацаа дуусаж, цуцлагдах боломжтой. Та хэн нэгнийг юу гэж дуудах нь зөвхөн тантай үлддэг таны өөрийн шошго; хэрэв тэд өөрсдийгөө танилцуулсан бол тэр нэр танд шифрлэгдсэн байдалтай ирсэн.`,
    },
    {
      title: '4. Бид юу цуглуулдаг вэ',
      body: `• Дансны мэдээлэл: дансны танигч, мөн сэргээх хэллэгээс гаргаж авсан итгэмжлэл, Firebase Authentication-д хадгалагдана. И-мэйл хаяг, утасны дугаар, нэр байхгүй — бүртгүүлэхэд эдгээрийн алийг нь ч асуудаггүй.
• Зурвас, хавсралтын шифрлэгдсэн текст, мөн 2-р хэсгийн метадата.

Энэ бол бүх жагсаалт. Аналитик, эвдрэлийн тайлан гэж байхгүй. Апп өмнө нь дэлгэцийн үзэлтийг Firebase Analytics-д, эвдрэлийн тайланг Firebase Crashlytics-д илгээдэг байсан бөгөөд хоёулаа таны дансны танигчийг агуулж байсан тул нэрэнд нь ч тодорхойгүй байгаагүй; одоо тэдгээрийг илгээж байсан сангуудын хамт хоёуланг нь устгасан. Алдаа зөвхөн хөгжүүлэгчийн өөрийнх нь машин дээр хөгжүүлэлтийн үед хэвлэгдэж, өөр хаана ч очдоггүй.`,
    },
    {
      title: '5. Хаана хадгалагддаг вэ',
      body: `Google Firebase дээр — Firestore, Storage, Authentication — баримт бичиг бүрийг хэн унших, бичих боломжтойг шийддэг аюулгүй байдлын дүрмийн дор.

Таны төхөөрөмж дээр кэшлэгдсэн зурвас, тохиргоо, аппын түгжээний PIN код нь энгийн аппын хадгалалт биш платформын түлхүүр сан (iOS Keychain, Android Keystore) дахь төхөөрөмж тус бүрийн түлхүүрээр шифрлэгддэг.

Таны зурвасыг тайлдаг хувийн түлхүүр таны бичиж авахаар сонгосон сэргээх хэллэгээс бусад тохиолдолд таны төхөөрөмжөөс хэзээ ч гардаггүй. Бид үүнийг хадгалдаггүй бөгөөд танд зориулж сэргээх боломжгүй. Үүнийг алдвал тэр төхөөрөмж рүү илгээгдсэн зурвасыг дахин унших боломжгүй болно — бид ч гэсэн хэн ч чадахгүй.`,
    },
    {
      title: '6. Өөр хэн мэдээлэл хүлээн авдаг вэ',
      body: `Бид таны хувийн мэдээллийг зардаггүй, худалддаггүй, түрээслүүлдэггүй. Мэдээлэл дараах газарт очно:

• Google Firebase — дээр дурдсанчлан манай зочилуулгын үйлчилгээ үзүүлэгч.
• Cloudflare Realtime — таны төхөөрөмж болон нөгөө хүний төхөөрөмж хоорондоо шууд холбогдож чадахгүй үед дуудлагын дуу болон видеог дамжуулна.
• Wikimedia Foundation — Википедиагаас хайхын тулд товшсон нэг нэр.
• Google Cloud Speech-to-Text — текст хөрвүүлэлт хүссэн үед нэг дуут зурвасын дуу.
• Google Cloud Translation — орчуулга хүссэн үед нэг зурвасын текст.
• Cloudflare Workers AI — хураангуй хүссэн эсвэл харилцааны талаар асуух үед нэг харилцааны сүүлийн 50 хүртэлх зурвас.

Сүүлийн гурав нь энэ хувилбарт унтраалттай. Аппын ямар ч газар текст болгох, орчуулах, эсвэл хураангуйлахыг асаах хяналт байхгүй тул эдгээр гурван үйлчилгээнд юу ч хүрдэггүй. Тэдгээрийг устгаагүй, харин жагсаасан шалтгаан нь код нь одоо ч энд байгаа бөгөөд онцлогууд буцаж ирэх зорилготой — тэдгээр буцаж ирэхэд энэ мэдэгдэл болон анх ашиглахын өмнөх зөвшөөрлийн асуултын хамт буцаж ирнэ. Тэр үед илгээгдэх зүйл нь таны үр дүнг гаргахад зориулагдах бөгөөд юу ч сургахад ашиглагдахгүй; текст хөрвүүлэлт ч, орчуулга ч манай серверт хадгалагддаггүй.

Википедиагаас хайх ажиллагаанд унтраах товч байхгүй, учир нь унтраах ямар ч байнгын зүйл байхгүй: энэ нь товшсон үед л ажиллаж, өөр цагт ажилладаггүй. Википедиа тэр нэг нэр болон таны IP хаягийг хүлээн авдаг — та өөрөө тэдний хайлтын хайрцаг руу бичсэнтэй адил — данс, зурвас, харилцаа хамаагүй. Буцаж ирсэн зүйл харагдаад хадгалагдахгүй, харилцаанд юу ч бичигдэхгүй.

Cloudflare Realtime-д ч мөн унтраах товч байхгүй. Ихэнх дуудлагад энэ хэрэггүй: шууд хоорондоо холбогдож чаддаг хоёр төхөөрөмж — ижил сүлжээн дэх ихэнх дуудлага — үүнгүйгээр холбогддог бөгөөд юу ч дамжуулагддаггүй. Тэд холбогдож чадахгүй үед — ихэвчлэн та хоёулаа өөр өөр гар утасны сүлжээнд байгаа тул — аль хэдийн шифрлэгдсэн дуудлагыг холбогдож чадахгүй байлгахын оронд дамжуулдаг. Cloudflare харж байгаа зүйл бол хоёр талын IP хаяг, дуудлагын хугацаа, мөн ойролцоогоор хэр их дата шилжсэн явдал юм; дуу болон видео нь 2-р хэсэгт дурдсан ижил DTLS-SRTP шифрлэлтийн дор хэвээр байдаг тул дамжуулах нь тэдгээрийг тайлдаггүй.

Хуулиар шаардвал бид эзэмшдэг зүйлээ илчилж болно. Бидний эзэмшдэг зүйл бол 2-р хэсэгт байгаа жагсаалт. Бид зурвасын агуулгыг гаргаж чадахгүй, учир нь бид үүнийг унших боломжгүй.`,
    },
    {
      title: '7. Түлхэлт мэдэгдэл',
      body: `Firebase Cloud Messaging мэдэгдлийг хүргэдэг. Таны төхөөрөмжийн токен зөвхөн та л уншиж чадах дансны хувийн хэсэгт хадгалагддаг.

Мэдэгдэл зурвасын текст агуулдаггүй. Таны төхөөрөмж зурвасыг орон нутагт тайлж, таны хардаг зүйлийг бүрдүүлдэг; Google дугтуй хүргэдэг, агуулгыг биш.`,
    },
    {
      title: '8. Та юу хийж чадах вэ',
      body: `• Профайл дэлгэцээс дансаа устгах. Дуудлагын бичлэг гэх мэт харилцааны хамтын хэсэг байх агуулга нь бусад оролцогчид үлдэнэ, учир нь энэ бас тэдний бичлэг юм.
• Профайл дэлгэцээс мэдээллээ экспортлох.
• Чат тус бүрээр зурвасын хугацаа дуусахыг тохируулах: 1 цаг, 24 цаг, 7 хоног эсвэл 30 хоног.
• Бичиж буйг харуулах, уншсан баталгааг асаах эсвэл унтраах. Хоёулаа анхдагчаар унтраалттай.
• Аппаа PIN код эсвэл биометрикээр түгжих.
• Гаргаж өгсөн урилгын холбоосоо цуцлах.

Хэрэв та бидэнд ямар нэг зүйлийг гараар устгуулахыг хүсвэл бидэнд бичнэ үү.`,
    },
    {
      title: '9. Хадгалалтын хугацаа',
      body: `Таны данс байх хугацаанд бид таны мэдээллийг хадгалдаг. Дансыг устгах нь дээр дурдсан хамтын эзэмшлийн агуулгаас бусад бүх зүйлийг устгадаг. Чат тус бүрийн хугацаа дуусах тохиргоо таны тохируулсан хуваарийн дагуу зурвасыг устгадаг.`,
    },
    {
      title: '10. Мэдэх ёстой хязгаарлалтууд',
      body: `Бид эдгээрийг таны өөрөө олж мэдэхээс илүү өөрсдөө хэлж өгөхийг илүүд үздэг.

• Түлхүүрүүд анх удаа харагдахдаа итгэмжлэгддэг. Хэрэв хэн нэгэн та нар зурвас солилцохоос өмнө түлхүүрийг сольсон бол харилцаа буруу хүнд шифрлэгдэх бөгөөд бүрэн хэвийн харагдана. Дараа нь түлхүүр өөрчлөгдвөл апп танд анхааруулж, гадуур харьцуулах боломжтой аюулгүйн дугаар харуулна — гэвч үүнийг харьцуулахыг хэн ч танд албаддаггүй.
• Нэг удаад нэг л төхөөрөмж. Таны сэргээх хэллэг таны түүхийг нээдэг түлхүүрийг сэргээдэг тул шинэ төхөөрөмж дээр нэвтрэх нь та аль хэдийн хүлээн авсан зүйлээ алдахгүй. Урагшилсан нууцлалтай харилцаанууд нь үүсгэсэн төхөөрөмжөөс хэзээ ч гардаггүй хоёр дахь түлхүүрийг ашигладаг: хамгийн сүүлд нэвтэрсэн төхөөрөмж л тэдгээрийг хүлээн авдаг бөгөөд энэ хооронд нөгөө төхөөрөмжид битүүмжлэгдсэн зүйлийг шилжүүлэх боломжгүй.
• Шифрлэлт үүсэхээс өмнө илгээсэн зурвасууд хуучин хэвээрээ үлддэг. Юу ч ухарч хувиргагдаагүй.
• Энэ апп бие даасан аюулгүй байдлын аудитад ороогүй байна.`,
    },
    {
      title: '11. Хүүхэд',
      body: `Chatterbox нь 13-аас доош насны хүүхдэд зориулагдаагүй бөгөөд бид тэдний мэдээллийг мэдэж байж цуглуулдаггүй. Хэрэв хүүхэд бидэнд хувийн мэдээлэл өгсөн гэж та бодож байвал бидэнтэй холбогдоно уу, бид үүнийг устгах болно.`,
    },
    {
      title: '12. Өөрчлөлт',
      body: `Бид энэ бодлогыг шинэчилж болно. Чухал өөрчлөлтийг апп дотор зарлах бөгөөд дээд талын огноо нь хамгийн сүүлд өөрчлөгдсөн он сар өдөр юм.`,
    },
    {
      title: '13. Холбоо барих',
      body: `Энэ бодлогын талаарх асуулт: ${POLICY_CONTACT_EMAIL}`,
    },
    {
      title: '14. Апп-ын шинэ хувилбарыг шалгах',
      body: `Google Play бол энэ апп таны Android утсанд хүрч ирдэг арга зам биш юм. Үүний оронд chatterbox.fans-аас татаж авдаг бөгөөд энэ үйл явцад оролцдоггүй дэлгүүр таны нэрийн өмнөөс шинэчлэлтийг шалгаж чадахгүй — тиймээс хэрэв та хүсвэл энэ апп үүнийг өөрөө хийж чадна.

"Одоо шалгах"-ыг товших нь одоогийн хувилбар аль нь болохыг асуусан нэг хүсэлтийг chatterbox.fans-руу илгээдэг. Тэр хүсэлт зөвхөн таны IP хаягийг агуулж, өөр юу ч байхгүй — данс байхгүй, төхөөрөмжийн танигч байхгүй, мессеж байхгүй. Буцаж ирдэг зүйл бол хувилбарын дугаар бөгөөд таны утсан дээр ажиллаж байгаа хувилбартай харьцуулагддаг; юу ч автоматаар татагдахгүй, энэ шалгалтын тухай юу ч харилцан ярианы дотор бичигдэхгүй.

Үүнд унтраах товч байхгүй, учир нь унтраах ямар ч зүйл байхгүй: энэ нь зөвхөн товшсон үед л ажилладаг бөгөөд өөр ямар ч байдлаар биш.

Хэрэв та шинэчлэлтийг суулгавал, энэ нь ижил гарын үсэг зурах түлхүүрийг ашиглан аппыг яг тэр байрандаа солино, яг л Google Play-ээс ирсэн шинэчлэлт хийдэг шиг.`,
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
