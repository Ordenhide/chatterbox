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
• بنیاد ویکی‌مدیا — یک نام، وقتی روی آن ضربه می‌زنید تا در ویکی‌پدیا جستجویش کنید.
• Google Cloud Speech-to-Text — صدای یک پیام صوتی، وقتی متن پیاده‌شده می‌خواهید.
• Google Cloud Translation — متن یک پیام، وقتی ترجمه می‌خواهید.
• Cloudflare Workers AI — تا ۵۰ پیام آخر یک گفتگو، وقتی خلاصه می‌خواهید یا دربارهٔ آن سؤالی می‌پرسید.

سه مورد آخر در این نسخه خاموش‌اند. هیچ کنترلی در هیچ‌جای برنامه نیست که پیاده‌سازی متن، ترجمه یا خلاصه‌سازی را روشن کند، پس چیزی به این سه سرویس نمی‌رسد. آن‌ها به‌جای حذف‌شدن فهرست شده‌اند چون کد هنوز اینجاست و قرار است این ویژگی‌ها بازگردند — و وقتی بازگردند، همراه با همین افشاگری و درخواستی پیش از نخستین استفاده بازمی‌گردند. آنچه در آن زمان فرستاده شود برای تولید نتیجهٔ شماست، نه برای آموزش چیزی؛ نه متن پیاده‌شده و نه ترجمه روی سرورهای ما ذخیره نمی‌شود.

جستجوی ویکی‌پدیا کلیدی ندارد چون چیز پایداری برای خاموش‌کردن نیست: فقط با همان ضربه اجرا می‌شود و جز آن اجرا نمی‌شود. ویکی‌پدیا همان یک نام و آدرس IP شما را دریافت می‌کند، درست مثل اینکه خودتان در کادر جستجوی آن تایپش کرده باشید — بدون حساب، بدون پیام، بدون گفتگو. آنچه برمی‌گردد فقط نمایش داده می‌شود و ذخیره نمی‌شود، و چیزی از آن در گفتگو نوشته نمی‌شود.

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
• קרן ויקימדיה — שם אחד, כשאתם מקישים עליו כדי לחפש אותו בוויקיפדיה.
• Google Cloud Speech-to-Text — השמע של הודעה קולית אחת, כשאתם מבקשים תמלול.
• Google Cloud Translation — הטקסט של הודעה אחת, כשאתם מבקשים תרגום.
• Cloudflare Workers AI — עד 50 ההודעות האחרונות של שיחה אחת, כשאתם מבקשים סיכום או שואלים עליה שאלה.

שלושת האחרונים כבויים בגרסה זו. אין שום פקד בשום מקום באפליקציה שמפעיל תמלול, תרגום או סיכומים, כך ששום דבר לא מגיע לשלושת השירותים האלה. הם מופיעים ברשימה במקום להימחק כי הקוד עדיין כאן והתכונות אמורות לחזור — וכשהן יחזרו, הן יחזרו עם הגילוי הזה ועם בקשת אישור לפני השימוש הראשון. מה שיישלח אז נשלח כדי לייצר עבורכם תוצאה, לא כדי לאמן דבר; לא תמלול ולא תרגום נשמרים בשרתים שלנו.

לחיפוש בוויקיפדיה אין פקד כי אין מה לכבות באופן קבוע: הוא רץ רק בעת ההקשה ולא אחרת. ויקיפדיה מקבלת את השם הזה בלבד ואת כתובת ה-IP שלכם, בדיוק כאילו הקלדתם אותו בעצמכם בתיבת החיפוש שלה — ללא חשבון, ללא הודעה, ללא שיחה. מה שחוזר מוצג ולא נשמר, ושום דבר ממנו לא נכתב לשיחה.

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
• ویکی میڈیا فاؤنڈیشن — ایک نام، جب آپ اسے ویکیپیڈیا پر تلاش کرنے کے لیے تھپتھپاتے ہیں۔
• Google Cloud Speech-to-Text — ایک صوتی پیغام کی آواز، جب آپ متن میں تبدیلی مانگتے ہیں۔
• Google Cloud Translation — ایک پیغام کا متن، جب آپ ترجمہ مانگتے ہیں۔
• Cloudflare Workers AI — ایک گفتگو کے آخری 50 پیغامات تک، جب آپ خلاصہ مانگتے ہیں یا اس کے بارے میں سوال پوچھتے ہیں۔

آخری تین اس ریلیز میں بند ہیں۔ ایپ میں کہیں بھی کوئی کنٹرول نہیں جو متن میں تبدیلی، ترجمہ یا خلاصے کو آن کرے، اس لیے ان تینوں خدمات تک کچھ نہیں پہنچتا۔ انہیں حذف کرنے کے بجائے فہرست میں رکھا گیا ہے کیونکہ کوڈ ابھی بھی یہاں ہے اور یہ خصوصیات واپس آنے والی ہیں — اور جب وہ واپس آئیں گی، تو وہ اس انکشاف اور پہلے استعمال سے پہلے ایک اشارے کے ساتھ واپس آئیں گی۔ اس وقت جو بھیجا جائے گا وہ آپ کا نتیجہ تیار کرنے کے لیے بھیجا جائے گا، کسی چیز کی تربیت کے لیے نہیں؛ نہ تحریری متن اور نہ ترجمہ ہمارے سرورز پر محفوظ کیا جاتا ہے۔

ویکیپیڈیا کی تلاش کا کوئی سوئچ نہیں ہے کیونکہ بند کرنے کے لیے کوئی مستقل چیز نہیں ہے: یہ صرف تھپتھپاہٹ پر چلتی ہے ورنہ نہیں۔ ویکیپیڈیا صرف وہ ایک نام اور آپ کا IP ایڈریس وصول کرتا ہے، بالکل ویسے ہی جیسے آپ نے خود اسے اس کے سرچ باکس میں ٹائپ کیا ہو — کوئی اکاؤنٹ نہیں، کوئی پیغام نہیں، کوئی گفتگو نہیں۔ جو واپس آتا ہے وہ صرف دکھایا جاتا ہے اور محفوظ نہیں کیا جاتا، اور اس کے بارے میں کچھ بھی گفتگو میں نہیں لکھا جاتا۔

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
• Fundacji Wikimedia — jedno imię, gdy dotkniesz go, aby wyszukać w Wikipedii.
• Google Cloud Speech-to-Text — dźwięk jednej wiadomości głosowej, gdy prosisz o transkrypcję.
• Google Cloud Translation — tekst jednej wiadomości, gdy prosisz o tłumaczenie.
• Cloudflare Workers AI — do 50 ostatnich wiadomości jednej rozmowy, gdy prosisz o podsumowanie lub zadajesz o nią pytanie.

Ostatnie trzy są wyłączone w tej wersji. Nie ma żadnej kontroli w żadnym miejscu aplikacji, która włączałaby transkrypcję, tłumaczenie czy podsumowania, więc nic nie dociera do tych trzech usług. Są wymienione, a nie usunięte, ponieważ kod nadal tu jest, a te funkcje mają wrócić — a kiedy wrócą, wrócą z tym ujawnieniem i z monitem przed pierwszym użyciem. To, co zostanie wtedy wysłane, jest wysyłane, aby wygenerować Twój wynik, a nie by cokolwiek trenować; ani transkrypcja, ani tłumaczenie nie są przechowywane na naszych serwerach.

Wyszukiwanie w Wikipedii nie ma przełącznika, ponieważ nie ma nic trwałego do wyłączenia: działa tylko po dotknięciu i w innym przypadku nie. Wikipedia otrzymuje tylko tę jedną nazwę i Twój adres IP, dokładnie tak, jakbyś sam wpisał ją w polu wyszukiwania — bez konta, bez wiadomości, bez rozmowy. To, co wraca, jest wyświetlane i nie zapisywane, i nic z tego nie jest zapisywane w rozmowie.

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
• Фонду Вікімедіа — одне ім'я, коли ви торкаєтеся його, щоб знайти у Вікіпедії.
• Google Cloud Speech-to-Text — аудіо одного голосового повідомлення, коли ви просите транскрипцію.
• Google Cloud Translation — текст одного повідомлення, коли ви просите переклад.
• Cloudflare Workers AI — до 50 останніх повідомлень однієї розмови, коли ви просите підсумок або ставите про неї запитання.

Останні три вимкнені в цій версії. У жодному місці застосунку немає елемента керування, який би вмикав транскрипцію, переклад чи підсумки, тож нічого не потрапляє до цих трьох служб. Вони перелічені, а не видалені, тому що код усе ще тут, а ці функції мають повернутися — і коли вони повернуться, вони повернуться з цим розкриттям інформації та підказкою перед першим використанням. Те, що буде надіслано тоді, надсилається, щоб створити ваш результат, а не щоб щось навчати; ані транскрипція, ані переклад не зберігаються на наших серверах.

У пошуку Вікіпедії немає перемикача, тому що немає нічого постійного, щоб вимкнути: він виконується лише за дотиком і в іншому разі — ні. Вікіпедія отримує лише те одне ім'я та вашу IP-адресу, точно так, ніби ви самі ввели його в поле пошуку — без облікового запису, без повідомлення, без розмови. Те, що повертається, лише показується й не зберігається, і нічого з цього не записується в розмову.

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
• Wikimedia Foundation — satu nama, ketika Anda mengetuknya untuk mencarinya di Wikipedia.
• Google Cloud Speech-to-Text — audio dari satu pesan suara, ketika Anda meminta transkrip.
• Google Cloud Translation — teks dari satu pesan, ketika Anda meminta terjemahan.
• Cloudflare Workers AI — hingga 50 pesan terakhir dari satu percakapan, ketika Anda meminta ringkasan atau mengajukan pertanyaan tentangnya.

Tiga yang terakhir dimatikan pada rilis ini. Tidak ada kontrol di mana pun dalam aplikasi yang menyalakan transkripsi, terjemahan, atau ringkasan, sehingga tidak ada yang mencapai tiga layanan itu. Layanan itu terdaftar alih-alih dihapus karena kodenya masih ada di sini dan fitur-fitur ini dimaksudkan untuk kembali — dan saat kembali, mereka akan kembali dengan pengungkapan ini dan permintaan sebelum penggunaan pertama. Apa yang akan dikirim saat itu dikirim untuk menghasilkan hasil Anda, bukan untuk melatih apa pun; baik transkrip maupun terjemahan tidak disimpan di server kami.

Pencarian Wikipedia tidak memiliki sakelar karena tidak ada yang bersifat tetap untuk dimatikan: itu hanya berjalan saat diketuk dan tidak dengan cara lain. Wikipedia menerima hanya nama itu dan alamat IP Anda, persis seperti jika Anda sendiri mengetiknya di kotak pencariannya — tanpa akun, tanpa pesan, tanpa percakapan. Apa yang dikembalikan hanya ditampilkan dan tidak disimpan, dan tidak ada apa pun tentangnya yang dituliskan ke percakapan.

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
• উইকিমিডিয়া ফাউন্ডেশন — একটি নাম, যখন আপনি এটি উইকিপিডিয়ায় খুঁজতে ট্যাপ করেন।
• Google Cloud Speech-to-Text — একটি ভয়েস বার্তার অডিও, যখন আপনি প্রতিলিপি অনুরোধ করেন।
• Google Cloud Translation — একটি বার্তার লেখা, যখন আপনি অনুবাদ অনুরোধ করেন।
• Cloudflare Workers AI — একটি কথোপকথনের সর্বশেষ ৫০টি পর্যন্ত বার্তা, যখন আপনি সারাংশ চান বা এটি সম্পর্কে প্রশ্ন করেন।

শেষ তিনটি এই সংস্করণে বন্ধ আছে। অ্যাপের কোথাও এমন কোনো নিয়ন্ত্রণ নেই যা প্রতিলিপি, অনুবাদ বা সারাংশ চালু করে, তাই এই তিনটি পরিষেবার কাছে কিছুই পৌঁছায় না। এগুলো মুছে ফেলার বদলে তালিকাভুক্ত করা আছে কারণ কোডটি এখনো এখানে আছে এবং এই ফিচারগুলো ফিরে আসার কথা — এবং যখন ফিরবে, তারা এই প্রকাশনার সাথে এবং প্রথম ব্যবহারের আগে একটি প্রম্পট সহ ফিরবে। তখন যা পাঠানো হবে তা আপনার ফলাফল তৈরি করার জন্য পাঠানো হয়, কিছু প্রশিক্ষণের জন্য নয়; প্রতিলিপি বা অনুবাদ কোনোটিই আমাদের সার্ভারে সংরক্ষিত হয় না।

উইকিপিডিয়া অনুসন্ধানের কোনো সুইচ নেই কারণ বন্ধ করার মতো স্থায়ী কিছু নেই: এটি শুধু ট্যাপের সময় চলে, অন্যথায় নয়। উইকিপিডিয়া শুধু সেই একটি নাম এবং আপনার IP ঠিকানা পায়, ঠিক যেমন আপনি নিজে এটি তাদের অনুসন্ধান বক্সে টাইপ করলে পেত — কোনো অ্যাকাউন্ট নেই, কোনো বার্তা নেই, কোনো কথোপকথন নেই। যা ফিরে আসে তা শুধু দেখানো হয় এবং সংরক্ষিত হয় না, এবং এ সম্পর্কে কিছুই কথোপকথনে লেখা হয় না।

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
• มูลนิธิวิกิมีเดีย — หนึ่งชื่อ เมื่อคุณแตะเพื่อค้นหาในวิกิพีเดีย
• Google Cloud Speech-to-Text — เสียงของข้อความเสียงหนึ่งข้อความ เมื่อคุณขอการถอดความ
• Google Cloud Translation — ข้อความของข้อความหนึ่งข้อความ เมื่อคุณขอการแปล
• Cloudflare Workers AI — ข้อความสูงสุด 50 ข้อความล่าสุดของการสนทนาหนึ่งครั้ง เมื่อคุณขอสรุปหรือถามคำถามเกี่ยวกับมัน

สามรายการสุดท้ายปิดอยู่ในรุ่นนี้ ไม่มีการควบคุมใดๆ ในแอปที่จะเปิดการถอดความ การแปล หรือการสรุป ดังนั้นจึงไม่มีอะไรไปถึงบริการทั้งสามนี้เลย รายการเหล่านี้ถูกระบุไว้แทนที่จะลบออก เพราะโค้ดยังคงอยู่ที่นี่และฟีเจอร์เหล่านี้ตั้งใจจะกลับมา — และเมื่อกลับมา จะมาพร้อมกับการเปิดเผยนี้และการแจ้งเตือนก่อนการใช้งานครั้งแรก สิ่งที่จะถูกส่งในตอนนั้นถูกส่งเพื่อสร้างผลลัพธ์ของคุณ ไม่ใช่เพื่อฝึกฝนสิ่งใด ทั้งการถอดความและการแปลจะไม่ถูกเก็บไว้บนเซิร์ฟเวอร์ของเรา

การค้นหาวิกิพีเดียไม่มีสวิตช์เพราะไม่มีอะไรถาวรให้ปิด: มันทำงานเฉพาะเมื่อแตะเท่านั้น ไม่ใช่วิธีอื่น วิกิพีเดียได้รับเพียงชื่อนั้นและที่อยู่ IP ของคุณ เหมือนกับที่คุณพิมพ์มันเองในกล่องค้นหาของพวกเขา — ไม่มีบัญชี ไม่มีข้อความ ไม่มีการสนทนา สิ่งที่ส่งกลับมาเพียงแสดงผลและไม่ถูกบันทึก และไม่มีอะไรเกี่ยวกับมันถูกเขียนลงในการสนทนา

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
