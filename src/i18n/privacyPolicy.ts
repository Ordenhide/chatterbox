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
• Crash reports: crash and error data via Firebase Crashlytics. Both this and the usage data above carry your account identifier, so neither is anonymous: we can see which account an event or a crash came from. Neither carries message contents.

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
• The Wikimedia Foundation — one name, when you tap it to look it up on Wikipedia.
• Google Cloud Speech-to-Text — the audio of one voice message, when you ask for a transcript.
• Google Cloud Translation — the text of one message, when you ask for a translation.
• Cloudflare Workers AI — up to the last 50 messages of one conversation, when you ask for a summary or ask a question about it.

The last three are switched off in this release. There is no control anywhere in the app that turns transcription, translation or summaries on, so nothing reaches those three services. They are listed rather than deleted because the code is still here and the features are meant to return — and when they do, they return with this disclosure and with a prompt before the first use. What would be sent then is sent to produce your result, not to train anything; neither a transcript nor a translation is stored on our servers.

The Wikipedia lookup has no switch because there is nothing standing to switch off: it runs on the tap and not otherwise. Wikipedia receives that one name and your IP address, the same as if you had typed it into their search box — no account, no message, no conversation. What comes back is shown and not saved, and nothing about it is written to the conversation.

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
• 崩溃报告：通过 Firebase Crashlytics 收集的崩溃和错误数据。这一项和上面的使用数据都带着你的账号标识，所以两者都不是匿名的：我们看得出某个事件或某次崩溃来自哪个账号。两者都不包含消息内容。

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
• 维基媒体基金会——当你点击某个名字去维基百科查它时，那一个名字。
• Google Cloud Speech-to-Text——当你请求转写时，一条语音消息的音频。
• Google Cloud Translation——当你请求翻译时，一条消息的文字。
• Cloudflare Workers AI——当你请求摘要或就一段对话提问时，该对话最近至多 50 条消息。

后三者在本次发行中是关闭的。应用里没有任何开关可以打开转写、翻译或摘要，所以没有任何内容会到达这三个服务。之所以列出而不是删掉，是因为代码还在、这些功能还打算回来——它们回来的时候，会连同这段披露和首次使用前的询问一起回来。到那时发出去的东西，是为了产出你要的结果，不用于训练任何模型；转写和翻译都不会保存在我们的服务器上。

维基百科查询没有开关，因为没有什么常驻的东西可关：它只在你点的那一下运行，此外不运行。维基百科收到的是那一个名字和你的 IP 地址，跟你自己在它的搜索框里输入一样——没有账号，没有消息，没有对话。返回的内容只是显示出来，不保存，也不会写进对话里。

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
• Geteilte Listen, gespeicherte Zitate und Linkvorschauen.
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

Was hier nicht mehr steht: deine E-Mail-Adresse und dein Name. Seit September 2026 enthält der Kontodatensatz nur noch eine Kontokennung. Deine Adresse bleibt in Firebase Authentication, wo wir dich damit anmelden und wo kein anderer sie lesen kann.

Und getrennt davon: Weil die App auf Google Firebase läuft, kann Google die IP-Adresse und den Zeitpunkt jeder Verbindung sehen, die dein Gerät dorthin aufbaut. Das ist eine Eigenschaft des Hostings, nicht der App, und wir können es nicht wegverschlüsseln.`,
    },
    {
      title: '3. Wie andere dich finden',
      body: `Sie können nicht nach dir suchen. Es gibt kein Verzeichnis — keine Suche nach E-Mail, Telefonnummer oder Name — und der Server weist jede Abfrage ab, die es versucht.

Du erreichst jemanden, indem du ihm außerhalb der App einen Einladungslink schickst, über was auch immer du ohnehin nutzt. Ein Link funktioniert einmal, läuft nach 24 Stunden ab und kann zurückgezogen werden. Wie du jemanden nennst, ist deine eigene Bezeichnung für ihn, die dir gehört; hat er sich vorgestellt, ist dieser Name verschlüsselt bei dir angekommen.`,
    },
    {
      title: '4. Was wir erheben',
      body: `• Kontodaten: die E-Mail-Adresse, mit der du dich registrierst, gespeichert in Firebase Authentication.
• Chiffrat von Nachrichten und Anhängen sowie die Metadaten aus Abschnitt 2.
• Nutzungsdaten: App-Interaktionsereignisse über Firebase Analytics — Bildschirmaufrufe und Funktionsnutzung, nie Nachrichteninhalte. In Entwicklungs-Builds deaktiviert.
• Absturzberichte: Absturz- und Fehlerdaten über Firebase Crashlytics. Sowohl diese als auch die Nutzungsdaten oben tragen deine Konto-Kennung, keines von beiden ist also anonym: wir sehen, von welchem Konto ein Ereignis oder ein Absturz kam. Nachrichteninhalte enthält keines von beiden.

Analytics und Absturzberichte lassen sich derzeit nicht einzeln in der App abschalten. Schreib uns, wenn du deine gelöscht haben möchtest.`,
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
• Die Wikimedia Foundation — ein einzelner Name, wenn du ihn antippst, um ihn auf Wikipedia nachzuschlagen.
• Google Cloud Speech-to-Text — die Audioaufnahme einer Sprachnachricht, wenn du ein Transkript anforderst.
• Google Cloud Translation — den Text einer Nachricht, wenn du eine Übersetzung anforderst.
• Cloudflare Workers AI — bis zu die letzten 50 Nachrichten eines Gesprächs, wenn du eine Zusammenfassung anforderst oder eine Frage dazu stellst.

Die letzten drei sind in dieser Version abgeschaltet. Es gibt in der App keine Einstellung, die Transkription, Übersetzung oder Zusammenfassungen einschaltet, also erreicht diese drei Dienste nichts. Sie stehen hier, statt gelöscht zu sein, weil der Code noch da ist und die Funktionen zurückkommen sollen — und wenn sie das tun, kommen sie mit dieser Offenlegung und mit einer Nachfrage vor dem ersten Mal zurück. Was dann gesendet würde, wird gesendet, um dein Ergebnis zu erzeugen, nicht um etwas zu trainieren; weder ein Transkript noch eine Übersetzung wird auf unseren Servern gespeichert.

Das Nachschlagen hat keinen Schalter, weil es nichts Dauerhaftes abzuschalten gibt: Es läuft beim Antippen und sonst nicht. Wikipedia erhält diesen Namen und deine IP-Adresse, genau wie wenn du ihn selbst in das Suchfeld getippt hättest — kein Konto, keine Nachricht, kein Gespräch. Was zurückkommt, wird angezeigt und nicht gespeichert, und nichts davon wird in das Gespräch geschrieben.

Wir können offenlegen, was wir haben, wenn das Gesetz es verlangt. Was wir haben, ist die Liste aus Abschnitt 2. Nachrichteninhalte können wir nicht herausgeben, weil wir sie nicht lesen können.`,
    },
    {
      title: '7. Push-Benachrichtigungen',
      body: `Firebase Cloud Messaging stellt Benachrichtigungen zu. Dein Gerätetoken liegt in einem privaten Teil deines Kontos, den nur du lesen kannst.

Benachrichtigungen enthalten keinen Nachrichtentext. Dein Gerät entschlüsselt die Nachricht lokal und setzt zusammen, was du siehst; Google liefert den Umschlag, nicht den Inhalt.`,
    },
    {
      title: '8. Was du tun kannst',
      body: `• Lösche dein Konto im Profil. Inhalte, die gemeinsamer Teil eines Gesprächs sind — eine geteilte Liste, ein Anrufeintrag — bleiben bei der anderen Person, denn es ist auch ihre Aufzeichnung.
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
• Ein Gerät pro Konto. Eine Anmeldung auf einem neuen Gerät ersetzt den Schlüssel, und das vorherige Gerät kann neue Nachrichten nicht mehr lesen.
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
• Las listas compartidas, las citas guardadas y las vistas previas de enlaces.
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

Lo que ya no está aquí: tu dirección de correo y tu nombre. Desde septiembre de 2026, el registro de la cuenta solo contiene un identificador de cuenta. Tu dirección permanece en Firebase Authentication, donde la usamos para iniciar tu sesión y donde ningún otro usuario puede leerla.

Aparte: como la app funciona sobre Google Firebase, Google puede ver la dirección IP y el momento de cada conexión que tu dispositivo hace hacia allí. Eso es una propiedad del alojamiento, no de la app, y no podemos cifrarlo para que desaparezca.`,
    },
    {
      title: '3. Cómo te encuentran',
      body: `No pueden buscarte. No hay directorio —ni búsqueda por correo, teléfono o nombre— y el servidor rechaza cualquier consulta que lo intente.

Llegas a alguien enviándole un enlace de invitación por fuera de la app, a través de lo que ya uses. Un enlace funciona una vez, caduca a las 24 horas y puedes retirarlo. Como llames a alguien es tu propia etiqueta para esa persona, y es tuya; si se presentó, ese nombre te llegó cifrado.`,
    },
    {
      title: '4. Qué recopilamos',
      body: `• Datos de la cuenta: la dirección de correo con la que te registras, guardada en Firebase Authentication.
• El texto cifrado de mensajes y adjuntos, más los metadatos de la sección 2.
• Datos de uso: eventos de interacción con la app vía Firebase Analytics —pantallas vistas y uso de funciones, nunca el contenido de los mensajes. Desactivado en compilaciones de desarrollo.
• Informes de fallos: datos de fallos y errores vía Firebase Crashlytics. Tanto estos como los datos de uso de arriba llevan el identificador de tu cuenta, así que ninguno es anónimo: podemos ver de qué cuenta vino un evento o un fallo. Ninguno lleva el contenido de los mensajes.

Ahora mismo, la analítica y los informes de fallos no se pueden desactivar por separado dentro de la app. Escríbenos si quieres que borremos los tuyos.`,
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
• La Fundación Wikimedia: un solo nombre, cuando lo tocas para buscarlo en Wikipedia.
• Google Cloud Speech-to-Text: el audio de un mensaje de voz, cuando pides una transcripción.
• Google Cloud Translation: el texto de un mensaje, cuando pides una traducción.
• Cloudflare Workers AI: hasta los últimos 50 mensajes de una conversación, cuando pides un resumen o haces una pregunta sobre ella.

Los tres últimos están apagados en esta versión. No hay ningún control en la aplicación que encienda la transcripción, la traducción o los resúmenes, así que nada llega a esos tres servicios. Están en la lista en vez de borrados porque el código sigue aquí y las funciones han de volver: cuando vuelvan, volverán con esta declaración y con una pregunta antes del primer uso. Lo que se enviaría entonces se envía para producir tu resultado, no para entrenar nada; ni una transcripción ni una traducción se guardan en nuestros servidores.

La búsqueda en Wikipedia no tiene interruptor porque no hay nada permanente que apagar: se ejecuta con el toque y no de otro modo. Wikipedia recibe ese nombre y tu dirección IP, igual que si lo hubieras escrito en su buscador; ninguna cuenta, ningún mensaje, ninguna conversación. Lo que vuelve se muestra y no se guarda, y nada de ello se escribe en la conversación.

Podemos revelar lo que tenemos si la ley lo exige. Lo que tenemos es la lista de la sección 2. No podemos entregar el contenido de los mensajes, porque no podemos leerlo.`,
    },
    {
      title: '7. Notificaciones push',
      body: `Firebase Cloud Messaging entrega las notificaciones. El token de tu dispositivo se guarda en una parte privada de tu cuenta que solo tú puedes leer.

Las notificaciones no llevan el texto del mensaje. Tu dispositivo lo descifra localmente y compone lo que ves; Google entrega el sobre, no el contenido.`,
    },
    {
      title: '8. Qué puedes hacer',
      body: `• Eliminar tu cuenta desde la pantalla de Perfil. El contenido que forma parte conjunta de una conversación —una lista compartida, un registro de llamada— se queda con la otra persona, porque también es su registro.
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
• Un dispositivo por cuenta. Iniciar sesión en uno nuevo sustituye la clave, y el anterior deja de poder leer los mensajes nuevos.
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
• Les listes partagées, les citations enregistrées et les aperçus de liens.
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

Ce qui n'y est plus : votre adresse e-mail et votre nom. Depuis septembre 2026, la fiche de compte ne contient qu'un identifiant de compte. Votre adresse reste dans Firebase Authentication, où elle sert à vous connecter et où aucun autre utilisateur ne peut la lire.

Par ailleurs : comme l'application tourne sur Google Firebase, Google peut voir l'adresse IP et l'heure de chaque connexion que votre appareil y établit. C'est une propriété de l'hébergement, pas de l'application, et nous ne pouvons pas la faire disparaître par du chiffrement.`,
    },
    {
      title: '3. Comment on vous trouve',
      body: `On ne peut pas vous rechercher. Il n'existe pas d'annuaire — pas de recherche par e-mail, téléphone ou nom — et le serveur refuse toute requête qui essaie.

Vous joignez quelqu'un en lui envoyant un lien d'invitation en dehors de l'application, par le moyen que vous utilisez déjà. Un lien fonctionne une fois, expire au bout de 24 heures et peut être retiré. Le nom que vous donnez à quelqu'un est votre propre étiquette, conservée pour vous ; s'il s'est présenté, ce nom vous est parvenu chiffré.`,
    },
    {
      title: '4. Ce que nous collectons',
      body: `• Données de compte : l'adresse e-mail avec laquelle vous vous inscrivez, conservée dans Firebase Authentication.
• Le chiffré des messages et des pièces jointes, ainsi que les métadonnées de la section 2.
• Données d'usage : événements d'interaction via Firebase Analytics — écrans consultés et fonctionnalités utilisées, jamais le contenu des messages. Désactivé dans les versions de développement.
• Rapports de plantage : données de plantage et d'erreur via Firebase Crashlytics. Ces données comme celles d'usage ci-dessus portent l'identifiant de votre compte : ni les unes ni les autres ne sont anonymes, nous voyons de quel compte vient un événement ou un plantage. Aucune ne contient le contenu des messages.

L'analytique et les rapports de plantage ne peuvent pas encore être désactivés séparément dans l'application. Écrivez-nous si vous souhaitez la suppression des vôtres.`,
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
• La Fondation Wikimedia — un seul nom, lorsque vous le touchez pour le chercher sur Wikipédia.
• Google Cloud Speech-to-Text — l’audio d’un message vocal, lorsque vous demandez une transcription.
• Google Cloud Translation — le texte d’un message, lorsque vous demandez une traduction.
• Cloudflare Workers AI — jusqu’aux 50 derniers messages d’une conversation, lorsque vous demandez un résumé ou posez une question à son sujet.

Les trois derniers sont désactivés dans cette version. Aucune commande de l’application n’active la transcription, la traduction ou les résumés, donc rien ne parvient à ces trois services. Ils sont listés plutôt que supprimés parce que le code est toujours là et que ces fonctions sont censées revenir — et quand elles reviendront, elles reviendront avec cette déclaration et avec une demande avant la première utilisation. Ce qui serait alors envoyé l’est pour produire votre résultat, pas pour entraîner quoi que ce soit ; ni une transcription ni une traduction ne sont conservées sur nos serveurs.

Cette recherche n’a pas d’interrupteur, parce qu’il n’y a rien de permanent à éteindre : elle s’exécute au moment du geste et pas autrement. Wikipédia reçoit ce nom et votre adresse IP, exactement comme si vous l’aviez tapé dans sa barre de recherche — aucun compte, aucun message, aucune conversation. Ce qui revient est affiché et non conservé, et rien n’en est écrit dans la conversation.

Nous pouvons divulguer ce que nous détenons si la loi l'exige. Ce que nous détenons, c'est la liste de la section 2. Nous ne pouvons pas produire le contenu des messages, puisque nous ne pouvons pas le lire.`,
    },
    {
      title: '7. Notifications push',
      body: `Firebase Cloud Messaging délivre les notifications. Le jeton de votre appareil est stocké dans une partie privée de votre compte, que vous seul pouvez lire.

Les notifications ne contiennent aucun texte de message. Votre appareil déchiffre le message localement et compose ce que vous voyez ; Google livre l'enveloppe, pas le contenu.`,
    },
    {
      title: '8. Ce que vous pouvez faire',
      body: `• Supprimer votre compte depuis l'écran Profil. Le contenu qui appartient conjointement à une conversation — une liste partagée, un enregistrement d'appel — reste chez l'autre personne, car c'est aussi sa trace.
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
• Un appareil par compte. Se connecter sur un nouvel appareil remplace la clé, et le précédent ne peut plus lire les nouveaux messages.
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
• Le liste condivise, le citazioni salvate e le anteprime dei link.
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

Che cosa non c'è più: il tuo indirizzo email e il tuo nome. Da settembre 2026 il record dell'account contiene solo un identificatore. Il tuo indirizzo resta in Firebase Authentication, dove lo usiamo per farti accedere e dove nessun altro utente può leggerlo.

A parte questo: poiché l'app gira su Google Firebase, Google può vedere l'indirizzo IP e l'orario di ogni connessione che il tuo dispositivo apre verso di essa. È una caratteristica dell'hosting, non dell'app, e non possiamo eliminarla con la cifratura.`,
    },
    {
      title: '3. Come ti trovano',
      body: `Non possono cercarti. Non esiste un elenco — nessuna ricerca per email, telefono o nome — e il server rifiuta qualsiasi interrogazione che ci provi.

Raggiungi qualcuno inviandogli un link d'invito fuori dall'app, con qualunque mezzo tu già usi. Un link funziona una volta, scade dopo 24 ore e può essere ritirato. Come chiami qualcuno è la tua etichetta per quella persona, e resta tua; se si è presentata, quel nome ti è arrivato cifrato.`,
    },
    {
      title: '4. Che cosa raccogliamo',
      body: `• Dati dell'account: l'indirizzo email con cui ti registri, conservato in Firebase Authentication.
• Il testo cifrato di messaggi e allegati, più i metadati della sezione 2.
• Dati d'uso: eventi di interazione con l'app tramite Firebase Analytics — schermate viste e funzioni usate, mai il contenuto dei messaggi. Disattivato nelle build di sviluppo.
• Segnalazioni di crash: dati di crash ed errori tramite Firebase Crashlytics. Sia questi sia i dati d’uso qui sopra portano l’identificativo del tuo account, quindi nessuno dei due è anonimo: vediamo da quale account arriva un evento o un crash. Nessuno dei due contiene il contenuto dei messaggi.

Al momento analytics e segnalazioni di crash non si possono disattivare singolarmente dentro l'app. Scrivici se vuoi che cancelliamo i tuoi.`,
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
• La Wikimedia Foundation — un solo nome, quando lo tocchi per cercarlo su Wikipedia.
• Google Cloud Speech-to-Text — l’audio di un messaggio vocale, quando chiedi una trascrizione.
• Google Cloud Translation — il testo di un messaggio, quando chiedi una traduzione.
• Cloudflare Workers AI — fino agli ultimi 50 messaggi di una conversazione, quando chiedi un riassunto o fai una domanda su di essa.

Gli ultimi tre sono spenti in questa versione. Nell'app non c'è alcun comando che accenda trascrizione, traduzione o riassunti, quindi a quei tre servizi non arriva nulla. Sono elencati anziché cancellati perché il codice è ancora qui e le funzioni devono tornare: quando torneranno, torneranno con questa informativa e con una richiesta prima del primo uso. Ciò che verrebbe inviato allora è inviato per produrre il tuo risultato, non per addestrare nulla; né una trascrizione né una traduzione vengono conservate sui nostri server.

Questa ricerca non ha un interruttore perché non c’è nulla di permanente da spegnere: parte con il tocco e non altrimenti. Wikipedia riceve quel nome e il tuo indirizzo IP, esattamente come se lo avessi digitato nella sua casella di ricerca — nessun account, nessun messaggio, nessuna conversazione. Ciò che torna viene mostrato e non salvato, e nulla di tutto questo viene scritto nella conversazione.

Possiamo divulgare ciò che deteniamo se la legge lo impone. Ciò che deteniamo è l'elenco della sezione 2. Non possiamo produrre il contenuto dei messaggi, perché non riusciamo a leggerlo.`,
    },
    {
      title: '7. Notifiche push',
      body: `Le notifiche vengono recapitate da Firebase Cloud Messaging. Il token del tuo dispositivo è conservato in una parte privata del tuo account, leggibile solo da te.

Le notifiche non contengono il testo del messaggio. È il tuo dispositivo a decifrarlo in locale e a comporre ciò che vedi; Google consegna la busta, non il contenuto.`,
    },
    {
      title: '8. Che cosa puoi fare',
      body: `• Eliminare il tuo account dalla schermata Profilo. I contenuti che appartengono in comune a una conversazione — una lista condivisa, un registro di chiamata — restano all'altra persona, perché sono anche il suo archivio.
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
• Un dispositivo per account. Accedere da un dispositivo nuovo sostituisce la chiave, e quello precedente smette di poter leggere i messaggi nuovi.
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
• As listas partilhadas, as citações guardadas e as pré-visualizações de ligações.
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

O que já não está aqui: o teu endereço de email e o teu nome. Desde setembro de 2026, o registo da conta contém apenas um identificador de conta. O teu endereço fica no Firebase Authentication, onde o usamos para iniciares sessão e onde nenhum outro utilizador o consegue ler.

À parte disso: como a app corre sobre a Google Firebase, a Google consegue ver o endereço IP e a hora de cada ligação que o teu dispositivo lhe faz. Isso é uma característica do alojamento, não da app, e não podemos fazê-lo desaparecer com cifra.`,
    },
    {
      title: '3. Como te encontram',
      body: `Não te conseguem procurar. Não existe diretório — nem pesquisa por email, telefone ou nome — e o servidor recusa qualquer consulta que tente.

Chegas a alguém enviando-lhe uma ligação de convite fora da app, por aquilo que já usas. Uma ligação funciona uma vez, expira ao fim de 24 horas e pode ser retirada. Aquilo por que tratas alguém é a tua própria etiqueta para essa pessoa, guardada para ti; se ela se apresentou, esse nome chegou-te cifrado.`,
    },
    {
      title: '4. O que recolhemos',
      body: `• Dados da conta: o endereço de email com que te registas, guardado no Firebase Authentication.
• O texto cifrado de mensagens e anexos, mais os metadados da secção 2.
• Dados de utilização: eventos de interação com a app via Firebase Analytics — ecrãs vistos e funcionalidades usadas, nunca o conteúdo das mensagens. Desativado nas compilações de desenvolvimento.
• Relatórios de falhas: dados de falhas e erros via Firebase Crashlytics. Tanto estes como os dados de utilização acima levam o identificador da tua conta, por isso nenhum é anónimo: vemos de que conta veio um evento ou uma falha. Nenhum leva o conteúdo das mensagens.

De momento, a analítica e os relatórios de falhas não podem ser desligados separadamente dentro da app. Escreve-nos se quiseres que apaguemos os teus.`,
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
• A Wikimedia Foundation — um único nome, quando lhe tocas para o procurar na Wikipédia.
• Google Cloud Speech-to-Text — o áudio de uma mensagem de voz, quando pedes uma transcrição.
• Google Cloud Translation — o texto de uma mensagem, quando pedes uma tradução.
• Cloudflare Workers AI — até às últimas 50 mensagens de uma conversa, quando pedes um resumo ou fazes uma pergunta sobre ela.

Os últimos três estão desligados nesta versão. Não há na aplicação qualquer controlo que ligue a transcrição, a tradução ou os resumos, por isso nada chega a esses três serviços. Estão listados em vez de apagados porque o código continua aqui e as funcionalidades hão de voltar — e quando voltarem, voltam com esta divulgação e com uma pergunta antes da primeira utilização. O que seria enviado então é enviado para produzir o teu resultado, não para treinar nada; nem uma transcrição nem uma tradução ficam guardadas nos nossos servidores.

Esta procura não tem interruptor porque não há nada permanente para desligar: corre no toque e não de outra forma. A Wikipédia recebe esse nome e o teu endereço IP, tal como se o tivesses escrito na caixa de pesquisa dela — nenhuma conta, nenhuma mensagem, nenhuma conversa. O que volta é mostrado e não guardado, e nada disso é escrito na conversa.

Podemos divulgar o que temos se a lei o exigir. O que temos é a lista da secção 2. Não conseguimos entregar o conteúdo das mensagens, porque não o conseguimos ler.`,
    },
    {
      title: '7. Notificações push',
      body: `As notificações são entregues pelo Firebase Cloud Messaging. O token do teu dispositivo fica numa parte privada da tua conta que só tu consegues ler.

As notificações não levam o texto da mensagem. É o teu dispositivo que a decifra localmente e compõe o que vês; a Google entrega o envelope, não o conteúdo.`,
    },
    {
      title: '8. O que podes fazer',
      body: `• Apagar a tua conta no ecrã Perfil. O conteúdo que pertence em conjunto a uma conversa — uma lista partilhada, um registo de chamada — fica com a outra pessoa, porque também é o registo dela.
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
• Um dispositivo por conta. Iniciar sessão num novo substitui a chave, e o anterior deixa de conseguir ler as mensagens novas.
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
• Общие списки, сохранённые цитаты и предпросмотры ссылок.
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

Чего здесь больше нет: вашего адреса электронной почты и вашего имени. С сентября 2026 года запись аккаунта содержит только его идентификатор. Ваш адрес остаётся в Firebase Authentication, где мы используем его для входа и где ни один другой пользователь его не прочитает.

Отдельно: поскольку приложение работает на Google Firebase, Google видит IP-адрес и время каждого соединения, которое ваше устройство к нему открывает. Это свойство хостинга, а не приложения, и зашифровать его мы не можем.`,
    },
    {
      title: '3. Как вас находят',
      body: `Вас нельзя найти поиском. Здесь нет каталога — ни поиска по почте, ни по телефону, ни по имени, — и сервер отклоняет любой запрос, который это пытается сделать.

Чтобы связаться с кем-то, вы отправляете ему ссылку-приглашение по любому каналу, которым уже пользуетесь. Ссылка срабатывает один раз, истекает через 24 часа, и её можно отозвать. То, как вы кого-то называете, — это ваша собственная пометка, и она остаётся у вас; если человек представился, это имя пришло к вам зашифрованным.`,
    },
    {
      title: '4. Что мы собираем',
      body: `• Данные аккаунта: адрес электронной почты, с которым вы регистрируетесь, хранится в Firebase Authentication.
• Шифртекст сообщений и вложений, а также метаданные из раздела 2.
• Данные использования: события взаимодействия с приложением через Firebase Analytics — просмотры экранов и использование функций, но никогда содержимое сообщений. В отладочных сборках отключено.
• Отчёты о сбоях: данные о сбоях и ошибках через Firebase Crashlytics. И они, и данные об использовании выше несут идентификатор вашей учётной записи, так что ни то ни другое не анонимно: мы видим, из какой учётной записи пришло событие или сбой. Содержимого сообщений не несёт ни то ни другое.

Аналитику и отчёты о сбоях пока нельзя отключить по отдельности внутри приложения. Напишите нам, если хотите, чтобы ваши данные удалили.`,
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
• В Фонд Викимедиа — одно имя, когда вы нажимаете на него, чтобы найти его в Википедии.
• В Google Cloud Speech-to-Text — аудио одного голосового сообщения, когда вы просите расшифровку.
• В Google Cloud Translation — текст одного сообщения, когда вы просите перевод.
• В Cloudflare Workers AI — до последних 50 сообщений одной переписки, когда вы просите сводку или задаёте вопрос о ней.

Последние три в этом выпуске выключены. В приложении нет ничего, что включает расшифровку, перевод или пересказ, поэтому в эти три службы ничего не уходит. Они перечислены, а не удалены, потому что код на месте и эти функции должны вернуться — а когда вернутся, вернутся вместе с этим раскрытием и с вопросом перед первым использованием. То, что тогда будет отправлено, отправляется, чтобы получить ваш результат, а не чтобы что-то обучать; ни расшифровка, ни перевод не хранятся на наших серверах.

У этого поиска нет переключателя, потому что нечего постоянно выключать: он срабатывает по нажатию и никак иначе. Википедия получает это имя и ваш IP-адрес — ровно так же, как если бы вы сами набрали его в её строке поиска: ни аккаунта, ни сообщения, ни переписки. То, что возвращается, показывается и не сохраняется, и ничего из этого не записывается в переписку.

Мы можем раскрыть то, чем располагаем, если этого требует закон. Располагаем мы списком из раздела 2. Содержимое сообщений мы предоставить не можем, потому что прочитать его не в состоянии.`,
    },
    {
      title: '7. Push-уведомления',
      body: `Уведомления доставляет Firebase Cloud Messaging. Токен вашего устройства хранится в приватной части аккаунта, которую можете читать только вы.

Уведомления не содержат текста сообщения. Ваше устройство расшифровывает сообщение локально и составляет то, что вы видите; Google доставляет конверт, а не содержимое.`,
    },
    {
      title: '8. Что вы можете сделать',
      body: `• Удалить аккаунт на экране профиля. Содержимое, которое совместно принадлежит разговору — общий список, запись о звонке, — остаётся у другого участника, потому что это и его запись тоже.
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
• Одно устройство на аккаунт. Вход на новом устройстве заменяет ключ, и прежнее перестаёт читать новые сообщения.
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
• Paylaşılan listeler, kaydedilen alıntılar ve bağlantı önizlemeleri.
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

Artık burada olmayanlar: e-posta adresin ve adın. Eylül 2026'dan beri hesap kaydında yalnızca bir hesap tanımlayıcısı bulunur. Adresin, seni oturum açtırmak için kullandığımız ve başka hiçbir kullanıcının okuyamadığı Firebase Authentication içinde kalır.

Ayrıca: uygulama Google Firebase üzerinde çalıştığı için Google, cihazının kurduğu her bağlantının IP adresini ve zamanını görebilir. Bu, uygulamanın değil barındırmanın bir özelliğidir ve şifreleyerek yok edemeyiz.`,
    },
    {
      title: '3. Seni nasıl buluyorlar',
      body: `Seni arayamazlar. Bir rehber yok — e-posta, telefon ya da adla arama yok — ve sunucu bunu deneyen her sorguyu reddeder.

Birine ulaşmak için ona uygulama dışından, zaten kullandığın herhangi bir yolla bir davet bağlantısı gönderirsin. Bağlantı bir kez çalışır, 24 saat sonra sona erer ve geri çekilebilir. Birine ne dediğin senin kendi etiketindir ve sende kalır; kendini tanıttıysa, o ad sana şifreli olarak ulaşmıştır.`,
    },
    {
      title: '4. Neleri topluyoruz',
      body: `• Hesap verisi: kayıt olurken kullandığın e-posta adresi, Firebase Authentication içinde tutulur.
• Mesaj ve eklerin şifreli metni, ayrıca 2. bölümdeki üst veriler.
• Kullanım verisi: Firebase Analytics üzerinden uygulama etkileşim olayları — görüntülenen ekranlar ve kullanılan özellikler; mesaj içeriği asla. Geliştirme sürümlerinde kapalıdır.
• Çökme raporları: Firebase Crashlytics üzerinden çökme ve hata verisi. Hem bunlar hem de yukarıdaki kullanım verisi hesap tanımlayıcını taşır, yani ikisi de anonim değildir: bir olayın ya da çökmenin hangi hesaptan geldiğini görebiliriz. İkisi de mesaj içeriği taşımaz.

Analitik ve çökme raporlaması şu an uygulama içinde tek tek kapatılamıyor. Kendi verinin silinmesini istersen bize yaz.`,
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
• Wikimedia Vakfı — Vikipedi'de aramak için dokunduğun tek bir ad.
• Google Cloud Speech-to-Text — bir yazıya dökme istediğinde, tek bir sesli mesajın ses kaydı.
• Google Cloud Translation — bir çeviri istediğinde, tek bir mesajın metni.
• Cloudflare Workers AI — bir özet istediğinde ya da bir konuşma hakkında soru sorduğunda, o konuşmanın son 50 mesajına kadarı.

Son üçü bu sürümde kapalı. Uygulamada yazıya dökmeyi, çeviriyi ya da özetleri açan hiçbir denetim yok, dolayısıyla bu üç hizmete hiçbir şey ulaşmıyor. Silinmek yerine burada duruyorlar çünkü kod hâlâ burada ve bu özelliklerin geri gelmesi planlanıyor — geri geldiklerinde bu açıklamayla ve ilk kullanımdan önce sorulan soruyla birlikte gelecekler. O zaman gönderilecek olan şey senin sonucunu üretmek içindir, bir şeyi eğitmek için değil; ne bir döküm ne de bir çeviri sunucularımızda saklanır.

Bu aramanın anahtarı yok, çünkü kapatılacak kalıcı bir şey yok: dokunduğun anda çalışır, başka zaman çalışmaz. Vikipedi o adı ve IP adresini alır; tıpkı arama kutusuna kendin yazmış olsaydın olacağı gibi — hesap yok, mesaj yok, konuşma yok. Dönen şey gösterilir, saklanmaz ve hiçbiri konuşmaya yazılmaz.

Yasa gerektirirse elimizdekileri açıklayabiliriz. Elimizdeki, 2. bölümdeki listedir. Mesaj içeriğini veremeyiz, çünkü onu okuyamıyoruz.`,
    },
    {
      title: '7. Anlık bildirimler',
      body: `Bildirimleri Firebase Cloud Messaging iletir. Cihaz belirtecin, hesabının yalnızca senin okuyabildiğin özel bir bölümünde saklanır.

Bildirimler mesaj metni taşımaz. Mesajı yerel olarak cihazın çözer ve gördüğün şeyi o oluşturur; Google zarfı iletir, içindekini değil.`,
    },
    {
      title: '8. Neler yapabilirsin',
      body: `• Profil ekranından hesabını sil. Bir konuşmanın ortak parçası olan içerik — paylaşılan bir liste, bir arama kaydı — karşı tarafta kalır, çünkü o kayıt onun da kaydıdır.
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
• Hesap başına bir cihaz. Yeni bir cihazda oturum açmak anahtarı değiştirir ve önceki cihaz yeni mesajları okuyamaz hâle gelir.
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
• Danh sách chung, trích dẫn đã lưu và bản xem trước liên kết.
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

Những gì không còn ở đây nữa: địa chỉ email và tên của bạn. Từ tháng 9 năm 2026, bản ghi tài khoản chỉ còn một mã định danh tài khoản. Địa chỉ của bạn nằm lại trong Firebase Authentication, nơi chúng tôi dùng nó để đăng nhập cho bạn và không người dùng nào khác đọc được.

Một điều riêng: vì ứng dụng chạy trên Google Firebase, Google thấy được địa chỉ IP và thời điểm của mọi kết nối mà thiết bị của bạn mở tới đó. Đó là đặc tính của hạ tầng lưu trữ, không phải của ứng dụng, và chúng tôi không thể mã hoá để nó biến mất.`,
    },
    {
      title: '3. Người khác tìm bạn bằng cách nào',
      body: `Họ không thể tìm kiếm bạn. Không có danh bạ — không tra theo email, số điện thoại hay tên — và máy chủ từ chối mọi truy vấn cố làm điều đó.

Bạn liên hệ với ai đó bằng cách gửi cho họ một liên kết mời qua kênh bên ngoài, dùng bất cứ thứ gì bạn vốn đã dùng. Liên kết chỉ dùng được một lần, hết hạn sau 24 giờ, và bạn có thể thu hồi. Bạn gọi ai đó là gì thì đó là nhãn riêng của bạn dành cho họ, và nó thuộc về bạn; nếu họ tự giới thiệu, cái tên ấy đã đến với bạn ở dạng mã hoá.`,
    },
    {
      title: '4. Chúng tôi thu thập gì',
      body: `• Dữ liệu tài khoản: địa chỉ email bạn dùng để đăng ký, lưu trong Firebase Authentication.
• Bản mã của tin nhắn và tệp đính kèm, cộng với siêu dữ liệu ở mục 2.
• Dữ liệu sử dụng: các sự kiện tương tác qua Firebase Analytics — màn hình đã xem và tính năng đã dùng, không bao giờ là nội dung tin nhắn. Đã tắt trong bản dựng phát triển.
• Báo cáo sự cố: dữ liệu sự cố và lỗi qua Firebase Crashlytics. Cả mục này lẫn dữ liệu sử dụng ở trên đều mang mã định danh tài khoản của bạn, nên không mục nào là ẩn danh: chúng tôi thấy được một sự kiện hay một sự cố đến từ tài khoản nào. Không mục nào mang nội dung tin nhắn.

Hiện tại phân tích và báo cáo sự cố chưa thể tắt riêng lẻ trong ứng dụng. Hãy viết cho chúng tôi nếu bạn muốn xoá phần của mình.`,
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
• Wikimedia Foundation — một cái tên duy nhất, khi bạn chạm vào nó để tra trên Wikipedia.
• Google Cloud Speech-to-Text — phần âm thanh của một tin nhắn thoại, khi bạn yêu cầu chuyển thành văn bản.
• Google Cloud Translation — phần chữ của một tin nhắn, khi bạn yêu cầu dịch.
• Cloudflare Workers AI — tối đa 50 tin nhắn gần nhất của một cuộc trò chuyện, khi bạn yêu cầu tóm tắt hoặc đặt câu hỏi về nó.

Ba mục cuối đã tắt trong bản này. Trong ứng dụng không có nút nào bật chép lời, dịch hay tóm tắt lên, nên chẳng có gì đến được ba dịch vụ đó. Chúng được liệt kê thay vì xoá đi vì mã nguồn vẫn còn và các tính năng này dự kiến sẽ quay lại — và khi quay lại, chúng quay lại kèm phần công bố này và một lời hỏi trước lần dùng đầu tiên. Thứ sẽ được gửi khi đó là để tạo ra kết quả cho bạn, không phải để huấn luyện bất cứ thứ gì; cả bản chép lời lẫn bản dịch đều không được lưu trên máy chủ của chúng tôi.

Việc tra cứu này không có công tắc, vì không có gì thường trực để tắt: nó chạy đúng lúc bạn chạm và không lúc nào khác. Wikipedia nhận cái tên đó và địa chỉ IP của bạn, giống hệt như khi bạn tự gõ vào ô tìm kiếm của họ — không tài khoản, không tin nhắn, không cuộc trò chuyện. Thứ trả về được hiển thị chứ không lưu, và không có gì trong đó được ghi vào cuộc trò chuyện.

Chúng tôi có thể tiết lộ những gì mình đang giữ nếu pháp luật yêu cầu. Những gì chúng tôi giữ chính là danh sách ở mục 2. Chúng tôi không thể đưa ra nội dung tin nhắn, vì chúng tôi không đọc được.`,
    },
    {
      title: '7. Thông báo đẩy',
      body: `Firebase Cloud Messaging chuyển thông báo. Mã thiết bị của bạn được lưu ở một phần riêng tư trong tài khoản mà chỉ bạn đọc được.

Thông báo không mang theo nội dung tin nhắn. Chính thiết bị của bạn giải mã tin nhắn tại chỗ và dựng nên thứ bạn nhìn thấy; Google chỉ chuyển cái phong bì, không phải thứ bên trong.`,
    },
    {
      title: '8. Bạn có thể làm gì',
      body: `• Xoá tài khoản ở màn hình Hồ sơ. Nội dung thuộc về cuộc trò chuyện của cả hai — một danh sách chung, một bản ghi cuộc gọi — vẫn ở lại với người kia, vì đó cũng là bản ghi của họ.
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
• Mỗi tài khoản một thiết bị. Đăng nhập trên thiết bị mới sẽ thay khoá, và thiết bị cũ hết đọc được tin nhắn mới.
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
• 共有リスト、保存した引用、リンクプレビュー。
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

もうここにないもの: あなたのメールアドレスと名前です。2026 年 9 月以降、アカウントの記録にはアカウント識別子しかありません。アドレスは Firebase Authentication に残り、サインインに使われるだけで、ほかの利用者には読めません。

別の話として: このアプリは Google Firebase 上で動くため、あなたの端末がそこへ行う接続の IP アドレスと時刻を Google は見られます。これはホスティングの性質であってアプリの性質ではなく、暗号化で消すことはできません。`,
    },
    {
      title: '3. 相手があなたを見つける方法',
      body: `検索することはできません。ディレクトリはなく、メールアドレス・電話番号・名前のいずれでも探せませんし、サーバーはそれを試みる問い合わせをすべて拒否します。

誰かに連絡を取るには、招待リンクをアプリの外から、あなたが普段使っている手段で送ります。リンクは 1 回だけ有効で、24 時間で期限切れになり、取り消せます。相手をどう呼ぶかはあなた自身が付けた呼び名で、あなたのものです。相手が自己紹介した場合、その名前は暗号化されてあなたに届いています。`,
    },
    {
      title: '4. 収集するもの',
      body: `• アカウント情報: 登録に使うメールアドレス。Firebase Authentication に保管されます。
• メッセージと添付の暗号文、および第 2 節の関連情報。
• 利用データ: Firebase Analytics によるアプリ操作イベント。画面の表示と機能の利用であり、メッセージの中身は決して含みません。開発ビルドでは無効です。
• クラッシュレポート: Firebase Crashlytics によるクラッシュ・エラー情報。これも上の利用データも、あなたのアカウント識別子を伴います。どちらも匿名ではなく、ある操作やクラッシュがどのアカウントのものかは分かります。どちらもメッセージの内容は含みません。

分析とクラッシュレポートは、今のところアプリ内で個別にオフにできません。ご自身の分を削除したい場合はご連絡ください。`,
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
• ウィキメディア財団 — 名前をタップして Wikipedia で調べたとき、その名前ひとつ。
• Google Cloud Speech-to-Text — 文字起こしを求めたとき、そのボイスメッセージ 1 件の音声。
• Google Cloud Translation — 翻訳を求めたとき、そのメッセージ 1 件の本文。
• Cloudflare Workers AI — 要約や会話への質問を求めたとき、その会話の直近 50 件までのメッセージ。

後ろの 3 つは、本リリースでは無効です。文字起こし・翻訳・要約を有効にする操作はアプリのどこにもないので、この 3 つのサービスには何も届きません。削除せずに残してあるのは、コードがまだあり、これらの機能を戻す予定だからです。戻すときは、この開示と初回前の確認をともなって戻します。そのとき送られるものは、あなたの結果を作るためであって、何かを学習させるためではありません。文字起こしも翻訳も当社のサーバーには保存しません。

この検索にスイッチはありません。切るべき常駐のものが何もないからです。タップしたその一回だけ動き、それ以外では動きません。Wikipedia が受け取るのはその名前とあなたの IP アドレスだけで、検索窓に自分で入力した場合と同じです。アカウントもメッセージも会話も送りません。返ってきたものは表示するだけで保存せず、会話にも何も書き込みません。

法律が要求する場合、保持しているものを開示することがあります。保持しているものは第 2 節の一覧です。メッセージの中身は提出できません。読めないからです。`,
    },
    {
      title: '7. プッシュ通知',
      body: `通知は Firebase Cloud Messaging が配信します。端末トークンは、あなただけが読めるアカウントの非公開領域に保管されます。

通知にメッセージ本文は含まれません。端末が手元でメッセージを復号し、表示内容を組み立てます。Google が運ぶのは封筒であって、中身ではありません。`,
    },
    {
      title: '8. あなたにできること',
      body: `• プロフィール画面からアカウントを削除する。共有リストや通話記録など、会話の共同の一部である内容は相手側に残ります。それは相手の記録でもあるからです。
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
• 1 アカウントにつき 1 台。新しい端末でサインインすると鍵が置き換わり、前の端末は新しいメッセージを読めなくなります。
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
• 공유 목록, 저장한 인용, 링크 미리보기.
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

더 이상 여기에 없는 것: 당신의 이메일 주소와 이름입니다. 2026년 9월부터 계정 기록에는 계정 식별자만 남습니다. 주소는 Firebase Authentication에 남아 로그인에 쓰이며, 다른 사용자는 읽을 수 없습니다.

별개로: 이 앱은 Google Firebase 위에서 돌아가므로, 당신의 기기가 그쪽으로 여는 모든 연결의 IP 주소와 시각을 Google이 볼 수 있습니다. 이는 호스팅의 성질이지 앱의 성질이 아니며, 암호화로 없앨 수 없습니다.`,
    },
    {
      title: '3. 다른 사람이 당신을 찾는 방법',
      body: `검색할 수 없습니다. 디렉터리가 없고 — 이메일, 전화번호, 이름 어느 것으로도 찾을 수 없으며 — 서버는 그런 조회를 모두 거부합니다.

누군가에게 닿으려면 앱 밖에서, 당신이 이미 쓰는 어떤 수단으로든 초대 링크를 보냅니다. 링크는 한 번만 동작하고 24시간 뒤 만료되며, 철회할 수 있습니다. 상대를 뭐라고 부르는지는 당신이 붙인 이름표이고 당신 것입니다. 상대가 자기를 소개했다면, 그 이름은 암호화된 채로 당신에게 왔습니다.`,
    },
    {
      title: '4. 우리가 수집하는 것',
      body: `• 계정 정보: 가입에 쓰는 이메일 주소. Firebase Authentication에 보관됩니다.
• 메시지와 첨부의 암호문, 그리고 2절의 메타데이터.
• 사용 데이터: Firebase Analytics를 통한 앱 상호작용 이벤트 — 화면 조회와 기능 사용이며, 메시지 내용은 절대 아닙니다. 개발 빌드에서는 꺼져 있습니다.
• 오류 보고: Firebase Crashlytics를 통한 충돌 및 오류 데이터. 이것도 위의 사용 데이터도 당신의 계정 식별자를 함께 담고 있어서 둘 다 익명이 아닙니다. 어떤 계정에서 나온 이벤트인지, 어떤 계정이 충돌했는지 우리는 알 수 있습니다. 둘 다 메시지 내용은 담지 않습니다.

분석과 오류 보고는 현재 앱 안에서 개별적으로 끌 수 없습니다. 본인 것을 삭제하고 싶으면 연락해 주세요.`,
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
• 위키미디어 재단 — 이름을 눌러 위키백과에서 찾아볼 때, 그 이름 하나.
• Google Cloud Speech-to-Text — 전사를 요청할 때, 음성 메시지 하나의 오디오.
• Google Cloud Translation — 번역을 요청할 때, 메시지 하나의 텍스트.
• Cloudflare Workers AI — 요약을 요청하거나 대화에 대해 질문할 때, 그 대화의 최근 50개까지의 메시지.

뒤의 셋은 이번 릴리스에서 꺼져 있습니다. 전사·번역·요약을 켜는 설정이 앱 어디에도 없으므로 그 세 서비스에는 아무것도 도달하지 않습니다. 지우지 않고 남겨 둔 것은 코드가 아직 있고 이 기능들을 되돌릴 계획이기 때문입니다. 되돌릴 때는 이 고지와 첫 사용 전 확인을 함께 되돌립니다. 그때 보내지는 것은 당신의 결과를 만들기 위한 것이지 무언가를 학습시키기 위한 것이 아니며, 전사도 번역도 저희 서버에 저장되지 않습니다.

이 찾아보기에는 스위치가 없습니다. 꺼야 할 상시 동작이 없기 때문입니다. 누른 그 순간에만 실행되고 그 외에는 실행되지 않습니다. 위키백과가 받는 것은 그 이름과 당신의 IP 주소뿐이며, 검색창에 직접 입력한 것과 같습니다. 계정도, 메시지도, 대화도 함께 가지 않습니다. 돌아온 내용은 보여줄 뿐 저장하지 않고, 대화에도 아무것도 기록하지 않습니다.

법이 요구하면 우리가 가진 것을 공개할 수 있습니다. 우리가 가진 것은 2절의 목록입니다. 메시지 내용은 내놓을 수 없습니다. 읽을 수 없기 때문입니다.`,
    },
    {
      title: '7. 푸시 알림',
      body: `알림은 Firebase Cloud Messaging이 전달합니다. 기기 토큰은 당신만 읽을 수 있는 계정의 비공개 영역에 저장됩니다.

알림에는 메시지 본문이 담기지 않습니다. 당신의 기기가 메시지를 그 자리에서 복호화해 보이는 내용을 구성합니다. Google이 나르는 것은 봉투이지 내용물이 아닙니다.`,
    },
    {
      title: '8. 당신이 할 수 있는 것',
      body: `• 프로필 화면에서 계정을 삭제합니다. 공유 목록이나 통화 기록처럼 대화에 공동으로 속한 내용은 상대에게 남습니다. 그것은 그 사람의 기록이기도 하기 때문입니다.
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
• 계정당 기기 하나. 새 기기에서 로그인하면 키가 교체되고, 이전 기기는 새 메시지를 읽지 못하게 됩니다.
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
• 共享清單、收藏的引用、連結預覽。
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

已經不在這裡的：你的電子郵件地址和你的名字。自 2026 年 9 月起，帳號記錄裡只剩一個帳號識別碼。你的電子郵件留在 Firebase Authentication 裡，我們用它讓你登入，其他使用者讀不到。

另外要單獨說一句：因為這個應用程式跑在 Google Firebase 上，Google 能看到你的裝置每一次連線的 IP 位址和時間。這是託管方式帶來的，不是應用程式本身的問題，我們沒法用加密把它消掉。`,
    },
    {
      title: '3. 別人怎麼找到你',
      body: `他們搜不到你。這裡沒有目錄——不能按電子郵件、電話號碼或名字查找——伺服器會拒絕任何這樣的查詢。

你要聯絡一個人，是透過其他管道把一條邀請連結傳給他，用你本來就在用的任何方式都行。一條連結只能用一次，24 小時後過期，你隨時可以撤銷。你怎麼稱呼一個人，是你自己給他的標籤，只留給你；如果對方做過自我介紹，那個名字是加密送到你這裡的。`,
    },
    {
      title: '4. 我們收集什麼',
      body: `• 帳號資料：你註冊用的電子郵件地址，保存在 Firebase Authentication 裡。
• 訊息和附件的密文，以及第 2 節列出的相關資料。
• 使用資料：透過 Firebase Analytics 收集的應用程式互動事件——頁面瀏覽和功能使用，絕不包括訊息內容。開發版本中已停用。
• 當機報告：透過 Firebase Crashlytics 收集的當機和錯誤資料。這一項和上面的使用資料都帶著你的帳號識別碼，所以兩者都不是匿名的：我們看得出某個事件或某次當機來自哪個帳號。兩者都不包含訊息內容。

目前應用程式內還不能單獨關閉分析和當機回報。如果你想刪除自己的這部分資料，寫信給我們。`,
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
• 維基媒體基金會——當你點擊某個名字去維基百科查它時，那一個名字。
• Google Cloud Speech-to-Text——當你要求轉寫時，一則語音訊息的音訊。
• Google Cloud Translation——當你要求翻譯時，一則訊息的文字。
• Cloudflare Workers AI——當你要求摘要或就一段對話提問時，該對話最近至多 50 則訊息。

後三者在本次發行中是關閉的。應用程式裡沒有任何開關可以打開轉寫、翻譯或摘要，所以沒有任何內容會到達這三個服務。之所以列出而不是刪掉，是因為程式碼還在、這些功能還打算回來——它們回來的時候，會連同這段揭露和首次使用前的詢問一起回來。到那時送出去的東西，是為了產出你要的結果，不用於訓練任何模型；轉寫和翻譯都不會留在我們的伺服器上。

維基百科查詢沒有開關，因為沒有什麼常駐的東西可關：它只在你點的那一下運作，此外不運作。維基百科收到的是那一個名字和你的 IP 位址，跟你自己在它的搜尋框裡輸入一樣——沒有帳號，沒有訊息，沒有對話。回傳的內容只是顯示出來，不保存，也不會寫進對話裡。

如果法律要求，我們可能揭露我們持有的內容。我們持有的就是第 2 節那份清單。我們拿不出訊息內容，因為我們讀不了。`,
    },
    {
      title: '7. 推播通知',
      body: `通知由 Firebase Cloud Messaging 送達。你的裝置權杖存放在帳號中一塊只有你能讀的私有區域裡。

通知裡不帶訊息正文。是你的裝置在本機解密訊息、組裝出你看到的那句話；Google 送的是信封，不是裡面的內容。`,
    },
    {
      title: '8. 你可以做什麼',
      body: `• 在「我的」頁面刪除帳號。屬於一場對話共同部分的內容——一份共享清單、一筆通話記錄——會留給另一位參與者，因為那也是他的記錄。
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
• 一個帳號只能用一台裝置。在新裝置上登入會替換掉金鑰，原來那台裝置就讀不到新訊息了。
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
• القوائم المشتركة والاقتباسات المحفوظة ومعاينات الروابط.
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

ما لم يعد موجودًا هنا: بريدك الإلكتروني واسمك. منذ سبتمبر 2026 لا يحمل سجل الحساب سوى مُعرّف الحساب. يبقى بريدك في Firebase Authentication، حيث نستخدمه لتسجيل دخولك ولا يستطيع أي مستخدم آخر قراءته.

وبشكل منفصل: لأن التطبيق يعمل على Google Firebase، تستطيع Google رؤية عنوان IP وتوقيت كل اتصال يجريه جهازك بها. هذه خاصية الاستضافة لا التطبيق، ولا يمكننا إزالتها بالتعمية.`,
    },
    {
      title: '3. كيف يجدك الآخرون',
      body: `لا يمكنهم البحث عنك. لا يوجد دليل — لا بحث بالبريد ولا بالهاتف ولا بالاسم — والخادم يرفض أي استعلام يحاول ذلك.

تصل إلى شخص بإرسال رابط دعوة له خارج التطبيق، بأي وسيلة تستخدمها أصلًا. يعمل الرابط مرة واحدة، وينتهي بعد 24 ساعة، ويمكن سحبه. ما تسمّي به شخصًا هو تسميتك أنت له، وتبقى لك؛ وإن كان قد عرّف بنفسه فذلك الاسم وصلك مُعمّى.`,
    },
    {
      title: '4. ما نجمعه',
      body: `• بيانات الحساب: البريد الإلكتروني الذي تسجّل به، محفوظ في Firebase Authentication.
• النص المُعمّى للرسائل والمرفقات، إضافة إلى البيانات الوصفية في القسم 2.
• بيانات الاستخدام: أحداث التفاعل مع التطبيق عبر Firebase Analytics — الشاشات المعروضة والميزات المستخدمة، ولا محتوى الرسائل أبدًا. مُعطّل في نسخ التطوير.
• تقارير الأعطال: بيانات عن الأعطال والأخطاء عبر Firebase Crashlytics. وهذه وبيانات الاستخدام أعلاه تحمل مُعرّف حسابك، فليست أيٌّ منهما مجهولة: نستطيع أن نرى من أي حساب جاء الحدث أو العطل. ولا تحمل أيٌّ منهما محتوى الرسائل.

لا يمكن حاليًا إيقاف التحليلات وتقارير الأعطال كلٌّ على حدة داخل التطبيق. راسلنا إن أردت حذف ما يخصّك.`,
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
• مؤسسة ويكيميديا — اسم واحد، حين تضغط عليه للبحث عنه في ويكيبيديا.
• Google Cloud Speech-to-Text — الصوت الخاص برسالة صوتية واحدة، حين تطلب تفريغها نصًّا.
• Google Cloud Translation — نص رسالة واحدة، حين تطلب ترجمتها.
• Cloudflare Workers AI — حتى آخر 50 رسالة من محادثة واحدة، حين تطلب ملخّصًا أو تسأل سؤالًا عنها.

الثلاثة الأخيرة معطَّلة في هذا الإصدار. لا توجد في التطبيق أي أداة تشغّل التفريغ أو الترجمة أو التلخيص، ومن ثمّ لا يصل إلى تلك الخدمات الثلاث شيء. وهي مذكورة بدل أن تُحذف لأن الشيفرة ما زالت هنا ولأن هذه الميزات يُفترض أن تعود — وحين تعود، تعود مع هذا الإفصاح ومع سؤال قبل الاستخدام الأول. وما سيُرسَل حينها يُرسَل لإنتاج نتيجتك، لا لتدريب أي شيء؛ ولا يُحفَظ على خوادمنا نصّ مفرَّغ ولا ترجمة.

لا يوجد مفتاح لهذا البحث لأنه لا يوجد شيء دائم يُطفأ: فهو يعمل عند الضغط ولا يعمل في غير ذلك. تتلقّى ويكيبيديا ذلك الاسم وعنوان IP الخاص بك، تمامًا كما لو كتبته بنفسك في مربّع البحث لديها — بلا حساب ولا رسالة ولا محادثة. وما يعود يُعرض ولا يُحفظ، ولا يُكتب منه شيء في المحادثة.

قد نُفصح عمّا بحوزتنا إن اقتضى القانون. وما بحوزتنا هو قائمة القسم 2. لا نستطيع تقديم محتوى الرسائل، لأننا لا نستطيع قراءته.`,
    },
    {
      title: '7. الإشعارات الفورية',
      body: `تُسلّم الإشعارات عبر Firebase Cloud Messaging. يُخزَّن رمز جهازك في جزء خاص من حسابك لا يقرؤه سواك.

لا تحمل الإشعارات نص الرسالة. جهازك هو الذي يفكّ تعميتها محليًا ويؤلّف ما تراه؛ أما Google فتوصّل الظرف لا مضمونه.`,
    },
    {
      title: '8. ما يمكنك فعله',
      body: `• احذف حسابك من شاشة الملف الشخصي. المحتوى الذي يخصّ المحادثة معًا — قائمة مشتركة، سجل مكالمة — يبقى مع الطرف الآخر، لأنه سجلّه هو أيضًا.
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
• جهاز واحد لكل حساب. تسجيل الدخول على جهاز جديد يستبدل المفتاح، فيعجز الجهاز السابق عن قراءة الرسائل الجديدة.
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
• साझा सूचियाँ, सहेजे गए उद्धरण और लिंक प्रीव्यू।
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

अब यहाँ क्या नहीं है: आपका ईमेल पता और आपका नाम। सितंबर 2026 से खाते के रिकॉर्ड में सिर्फ़ एक खाता पहचानकर्ता रहता है। आपका पता Firebase Authentication में रहता है, जहाँ हम उससे आपको साइन इन कराते हैं और कोई दूसरा उपयोगकर्ता उसे नहीं पढ़ सकता।

अलग से: चूँकि ऐप Google Firebase पर चलता है, आपका डिवाइस वहाँ जो भी कनेक्शन बनाता है उसका IP पता और समय Google देख सकता है। यह होस्टिंग का गुण है, ऐप का नहीं, और हम इसे एन्क्रिप्ट करके मिटा नहीं सकते।`,
    },
    {
      title: '3. लोग आपको कैसे ढूँढते हैं',
      body: `वे आपको खोज नहीं सकते। कोई निर्देशिका नहीं है — न ईमेल से, न फ़ोन से, न नाम से — और सर्वर ऐसी हर पूछताछ को अस्वीकार कर देता है।

आप किसी तक पहुँचते हैं उसे ऐप के बाहर, जो भी माध्यम आप पहले से इस्तेमाल करते हैं उससे, एक निमंत्रण लिंक भेजकर। लिंक एक बार काम करता है, 24 घंटे में समाप्त हो जाता है, और वापस लिया जा सकता है। आप किसी को जो कहते हैं वह आपका अपना नाम है और आपके पास ही रहता है; अगर उन्होंने अपना परिचय दिया, तो वह नाम आप तक एन्क्रिप्टेड आया।`,
    },
    {
      title: '4. हम क्या इकट्ठा करते हैं',
      body: `• खाता डेटा: जिस ईमेल पते से आप पंजीकरण करते हैं, वह Firebase Authentication में रखा जाता है।
• संदेशों और अनुलग्नकों का सिफरटेक्स्ट, साथ ही खंड 2 का मेटाडेटा।
• उपयोग डेटा: Firebase Analytics के ज़रिए ऐप इंटरैक्शन की घटनाएँ — कौन-सी स्क्रीन देखी और कौन-सी सुविधा इस्तेमाल की; संदेशों की सामग्री कभी नहीं। डेवलपमेंट बिल्ड में बंद।
• क्रैश रिपोर्ट: Firebase Crashlytics के ज़रिए क्रैश और त्रुटि डेटा। यह भी और ऊपर का उपयोग डेटा भी आपके खाते का पहचानकर्ता साथ लेकर जाता है, इसलिए दोनों में से कोई गुमनाम नहीं है: हमें दिखता है कि कोई घटना या कोई क्रैश किस खाते से आया। दोनों में से कोई संदेश की सामग्री नहीं ले जाता।

फ़िलहाल एनालिटिक्स और क्रैश रिपोर्टिंग को ऐप के भीतर अलग-अलग बंद नहीं किया जा सकता। अपना डेटा हटवाना चाहें तो हमें लिखें।`,
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
• विकिमीडिया फ़ाउंडेशन — एक नाम, जब आप उसे विकिपीडिया पर देखने के लिए दबाते हैं।
• Google Cloud Speech-to-Text — जब आप लिप्यंतरण माँगते हैं, तो एक वॉइस संदेश का ऑडियो।
• Google Cloud Translation — जब आप अनुवाद माँगते हैं, तो एक संदेश का पाठ।
• Cloudflare Workers AI — जब आप सारांश माँगते हैं या किसी बातचीत के बारे में सवाल पूछते हैं, तो उस बातचीत के पिछले 50 तक संदेश।

आख़िरी तीन इस रिलीज़ में बंद हैं। ऐप में कहीं भी ऐसा कोई नियंत्रण नहीं है जो लिप्यंतरण, अनुवाद या सारांश चालू करे, इसलिए उन तीन सेवाओं तक कुछ भी नहीं पहुँचता। इन्हें हटाने के बजाय सूचीबद्ध रखा गया है क्योंकि कोड अब भी यहीं है और ये सुविधाएँ लौटनी हैं — और जब लौटेंगी, तो इसी घोषणा और पहली बार से पहले पूछे जाने वाले सवाल के साथ लौटेंगी। तब जो भेजा जाएगा वह आपका नतीजा बनाने के लिए भेजा जाएगा, किसी चीज़ को प्रशिक्षित करने के लिए नहीं; न लिप्यंतरण हमारे सर्वरों पर रखा जाता है और न अनुवाद।

इस खोज के लिए कोई स्विच नहीं है, क्योंकि बंद करने लायक कुछ स्थायी है ही नहीं: यह उसी दबाने पर चलती है, और कभी नहीं। विकिपीडिया को वह नाम और आपका IP पता मिलता है — ठीक वैसे ही जैसे आपने उसके खोज बॉक्स में स्वयं लिखा हो; न कोई खाता, न कोई संदेश, न कोई बातचीत। जो लौटता है वह दिखाया जाता है, सहेजा नहीं जाता, और उसमें से कुछ भी बातचीत में नहीं लिखा जाता।

क़ानून की माँग पर हम जो हमारे पास है उसे बता सकते हैं। हमारे पास खंड 2 की सूची है। संदेशों की सामग्री हम पेश नहीं कर सकते, क्योंकि हम उसे पढ़ नहीं सकते।`,
    },
    {
      title: '7. पुश सूचनाएँ',
      body: `सूचनाएँ Firebase Cloud Messaging पहुँचाता है। आपका डिवाइस टोकन आपके खाते के एक निजी हिस्से में रखा जाता है जिसे सिर्फ़ आप पढ़ सकते हैं।

सूचनाओं में संदेश का पाठ नहीं होता। आपका डिवाइस संदेश को स्थानीय रूप से डिक्रिप्ट करता है और जो आप देखते हैं वह बनाता है; Google लिफ़ाफ़ा पहुँचाता है, उसके भीतर की चीज़ नहीं।`,
    },
    {
      title: '8. आप क्या कर सकते हैं',
      body: `• प्रोफ़ाइल स्क्रीन से अपना खाता मिटाएँ। जो सामग्री बातचीत का साझा हिस्सा है — कोई साझा सूची, कोई कॉल रिकॉर्ड — वह दूसरे व्यक्ति के पास रहती है, क्योंकि वह उनका भी रिकॉर्ड है।
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
• हर खाते पर एक डिवाइस। नए डिवाइस पर साइन इन करने से कुंजी बदल जाती है, और पुराना डिवाइस नए संदेश पढ़ नहीं पाता।
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
