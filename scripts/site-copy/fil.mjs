/**
 * Ang landing page, sa Filipino. Tingnan ang en.mjs para sa anyong ibinabahagi
 * ng bawat file sa direktoryong ito; ang `{policy}` ay nagiging link papunta sa
 * patakaran sa privacy ng wikang ito, na `links.policy` ang teksto ng link.
 */
export default {
  meta: {
    title: 'Chatterbox — Isang messenger na walang mapaghahanapan sa iyo',
    description:
      'End-to-end encrypted na pagmemensahe na walang direktoryo ng user, walang email address, at may patakaran sa privacy na nagsasabi kung ano ang hindi nito kayang gawin. Web at Android.',
  },

  links: {policy: 'patakaran sa privacy', policyShort: 'Basahin ito'},

  nav: {
    different: 'Ano ang kaiba',
    features: 'Mga feature',
    limits: 'Mga limitasyon',
    get: 'Kunin',
    language: 'Wika',
  },

  hero: {
    eyebrow: 'Web at Android · iOS ginagawa pa',
    title: 'Walang mapaghahanapan sa iyo.',
    lead: `Ang Chatterbox ay isang end-to-end encrypted na messenger na walang direktoryo ng user. Walang makakahanap sa iyo sa paghahanap, dahil walang index na hahanapan — ang tanging daan papasok sa isang usapan ay isang link na ikaw mismo ang nagbibigay.`,
    primary: 'Kunin ang Chatterbox',
    secondary: 'Basahin ang patakaran sa privacy',
    badges: ['Walang direktoryo ng user', 'Imbitasyon lang', '53 na wika', 'Libre'],
  },

  different: {
    eyebrow: 'Ano ang kaiba',
    title: 'Pitong bagay na hindi ginagawa ng karamihan ng messenger',
    intro: `Ang bawat isa nito ay desisyon na may mekanismo sa likod, hindi setting na kailangan mo pang hanapin. Kung saan may kapalit ang isang bagay, sinasabi ito.`,
    reasons: [
      {
        title: 'Walang direktoryo ng user',
        body: [
          `Walang paghahanap ng username, walang pagtutugma ng numero ng telepono, walang “mga taong maaaring kilala mo”. Ang tanging ruta papasok sa isang usapan ay isang invite link na ipapadala mo sa isang tao sa labas ng channel. Isang beses gumagana ang bawat link at mag-e-expire pagkatapos ng 24 oras, at may naka-schedule na gawain na bumubura sa mga expired kaysa mag-iwan ng permanenteng talaan ng sino ang nag-imbita kanino.`,
        ],
        note: `Hindi ito setting sa privacy. Walang direktoryong puwede mong tanggihan.`,
      },
      {
        title: 'Walang email address na itatago',
        body: [
          `Walang tinatanong sa iyo ang pag-sign up. Ang account mo ay isang 24-word na recovery phrase na binubuo sa device mo, at ang kredensyal na sinusuri ng server ay hinango sa mga salitang iyon — ang iniimbak nito ay isang random na label sa ilalim ng isang domain na hindi makakatanggap ng mail. Walang email address, walang display name at walang photo URL ang talaan ng profile mo, kaya wala rin namang profile na mababasa ng iba.`,
        ],
      },
      {
        title: 'Higit pa sa mga mensahe ang nakasara',
        body: [
          `Ang teksto ng mensahe ang madaling bahagi. Ang mga preview ng link at live na lokasyon ay ini-encrypt papunta sa usapan sa parehong paraan — ang pag-share ng lokasyon ay isang stream ng mga coordinate, at naka-seal ito sa key ng kabilang device gaya ng lahat ng iba. Ang mga attachment ay ini-encrypt bago i-upload, kaya ang hawak ng server ay mga byte na hindi nito mabubuksan.`,
        ],
      },
      {
        title: 'May sariling key ang bawat mensahe',
        body: [
          `Karamihan sa mga one-to-one at group na usapan ay gumagamit ng ratchet, kaya ang pagkasira ng isang device ay hindi nagbubunyag ng mga mensaheng nauna. Ang mga usapan kung saan hindi pa nailalathala ng kliyente ng isang tao ang mas bagong key material ay bumabalik sa isang mahabang-buhay na key, na walang katangiang iyon.`,
        ],
        note: `Sinasabi sa iyo ng label sa ilalim ng mensahe kung alin ang aktwal na natanggap nito. Hindi ito pahayag tungkol sa app; pahayag ito tungkol sa mensaheng iyon.`,
      },
      {
        title: `Walang AI na nagbabasa ng usapan mo`,
        body: [
          `Walang tagabuod, walang pagsasalin, walang pagsasatitik. Walang anumang bahagi ng app na ito na nagde-decrypt ng usapan at nagpapadala nito sa third party para iproseso, dahil walang feature dito na gumagawa niyan. Ang mga suhestiyong sagot ay kinakalkula sa device mo mula sa huling ilang mensahe, at wala itong pinapadalhan.`,
        ],
        note: `Ang mga feature na iyon ay nasa code at naka-off para sa release na ito; nakatakda silang bumalik. Pinangangalanan pa rin ng Seksyon 6 ng patakaran sa privacy ang tatlong serbisyong aabutin nila at sinasabing wala nang nakakarating sa kanila ngayon. Kapag bumalik sila, babalik sila kasama ang paglalantad na iyon at isang prompt bago ang unang paggamit.`,
      },
      {
        title: 'Hindi nangyayari sa likod mo ang paghahanap ng isang bagay',
        body: [
          `I-tap ang isang pangalan sa mensahe at ipapakita sa iyo ng Chatterbox ang artikulo nito sa Wikipedia. Nangyayari ang request na iyon sa tap at wala nang iba, at walang anumang tungkol dito na naisusulat sa usapan.`,
        ],
        note: `May naunang bersyon na nag-scan sa huling labinlimang mensahe ng bawat thread na binuksan mo at nagtatanong sa Wikipedia nang hanggang tatlumpung beses kada pagbukas — habang wala namang ipinapakita, dahil ang mga card ay nasa likod ng isang flag na hindi kailanman naka-on. Tinanggal ito kaysa ayusin.`,
      },
      {
        title: 'Sinasabi ng patakaran sa privacy kung ano ang hindi nito kaya',
        body: [
          `Nakasaad dito na hindi pa kailanman nasuri nang independiyente ang encryption, na nakikita ng Google ang metadata ng bawat koneksyon dahil inuupahan namin ang mga server nila, at na ang isang key na pinalitan bago ang unang mensahe mo ay magiging ganap na normal ang itsura. Iisang teksto ito sa app at sa site na ito, sa 53 na wika — hindi isang Ingles na orihinal na may mas malambot na salin.`,
        ],
        note: `{policyShort} bago ka magpasyang magtiwala sa alinman sa mga nasa itaas.`,
      },
    ],
  },

  features: {
    eyebrow: 'Mga feature',
    title: 'Ano ang totoong ginagawa nito',
    intro: `Lahat ng nakalista rito ay may interface na maaabot mo. Walang anuman sa pahinang ito na naglalarawan ng kakayahang nasa code lamang.`,
    cards: [
      {
        title: 'Pagmemensahe',
        body: `Teksto, larawan, video, file at voice note. Mga sagot, pagpapasa, reaksyon, read receipt, naka-pin na mensahe, bookmark at naka-schedule na mensahe.`,
      },
      {
        title: 'Voice at video call',
        body: `Peer-to-peer na pagtawag sa WebRTC, na nag-e-encrypt sa media sa pagitan ng dalawang device bilang default at hindi bilang opsyon.`,
      },
      {
        title: `Mga suhestiyong sagot`,
        body: `Ilang suhestiyong sagot na hango sa huling mga mensahe sa usapan. Itinutugma ang mga ito sa device mo sa isang listahan ng parirala sa wika mo — walang ipinapadala saanman para gawin ang mga ito.`,
      },
      {
        title: 'Paghahanap sa Wikipedia',
        body: `Pindutin nang matagal ang isang mensahe, pumili ng pangalan dito, at basahin ang artikulo nang hindi umaalis sa chat. Isang request, sa tap mo, sa sarili mong wika.`,
      },
      {
        title: 'Ang key mo, ang recovery phrase mo',
        body: `Ang pribadong key na nagde-decrypt ng mga mensahe mo ay hindi kailanman umaalis sa device mo. Puwede mo itong isulat bilang recovery phrase; hindi namin ito hawak at hindi namin ito maibabalik para sa iyo.`,
      },
      {
        title: '53 na wika',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — kasama ang pagsulat mula kanan pakaliwa.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Mga kontrol sa privacy',
    title: 'Ano ang puwede mong isara',
    items: [
      {title: 'App lock', body: `Biometrics o PIN, na may auto-lock delay na pinipili mo.`},
      {title: 'View once', body: `Mga larawan at video na tuluyang nagsasara pagkatapos mabuksan.`},
      {
        title: 'Mga naglalahong mensahe',
        body: `Itakda ang isang usapan na maglinis mismo, mula isang oras hanggang tatlumpung araw.`,
      },
      {
        title: 'Sunugin pagkabasa',
        body: `Isang mensaheng sumisira sa sarili nito kapag nabasa na ng kausap.`,
      },
      {
        title: 'Pagharang',
        body: `Harangan ang sinuman. Dahil walang direktoryo, hindi nila mahahanap ang daan pabalik.`,
      },
      {
        title: 'Pag-export at pagbura',
        body: `Ilabas ang data mo, o burahin ang account at lahat ng nasa ilalim nito.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Mga limitasyon',
    title: 'Ano ang hindi protektado',
    intro: `Ang pahinang puro lakas lang ang nakalista ay pahinang hindi mo magagamit sa pagpapasya. Ito ang maikling bersyon; ang {policy} ang mahaba.`,
    sealed: {
      title: 'Nakasara sa device mo',
      items: [
        'Ang teksto ng mga mensahe mo',
        'Mga larawan, video, audio at file na inilalakip mo',
        'Mga preview ng link at live na lokasyon',
        'Mga transcript ng boses, pagbalik nila sa iyo',
        'Audio at video ng tawag, sa pagitan ng dalawang device',
      ],
    },
    visible: {
      title: 'Nakikita namin at ng Google',
      items: [
        'Na may umiiral na usapan, at kung anong mga account ang nasa loob nito',
        'Kung kailan huling naging aktibo ang bawat account',
        'Ang metadata ng bawat koneksyon, kasama ang IP address mo',
        'Na may ginawang tawag, kanino at kailan — hindi ang audio o video nito',
        'Ang pangalan ng file, uri at laki ng bawat attachment na ipapadala mo',
      ],
    },
    note: `Hindi pa kailanman nasuri nang independiyente ang encryption. Mas mahirap alisin ang metadata na iyon kaysa i-encrypt ang laman, at hindi pa tapos ang trabahong iyon.`,
  },

  download: {
    title: 'Kunin ang Chatterbox',
    intro: `Tumatakbo ang web app sa browser nang walang ii-install. Sa Android, pinapanatiling updated ito ng Google Play; ang APK sa site na ito ay parehong build para sa mga hindi gustong gumamit ng store.`,
    introWebOnly: `Tumatakbo ang web app sa browser nang walang ii-install, sa telepono gaya rin sa desktop. Ang Android build ay papunta pa sa Google Play.`,
    web: 'Buksan ang web app',
    play: 'Kunin sa Google Play',
    playPending: 'Malapit nang mapunta sa Google Play',
    apk: 'I-download ang APK',
    playNote: `Ang Google Play ang inirerekomendang ruta sa Android: ina-update nito ang app sa background at bineberipika ang signature sa bawat install.`,
    androidPendingNote: `Wala pang live sa dalawang ruta ng Android: hindi pa nakapublish ang Play listing, at walang download sa site na ito. Ang web app ang daan papasok hangga't wala pang live sa kanila.`,
    playPendingNote: `Hindi pa live ang Play listing. Hangga't hindi pa, ang APK ang ruta sa Android — hihingi ng pahintulot ang Android sa unang beses para payagan ang mga install mula sa pinagmulang ito, at hindi ito nag-a-update sa sarili.`,
    apkNote: `Ang APK ay naka-sign sa parehong key gaya ng Play build, kaya nai-install ito nang nakapatong at napapanatili ang data mo. Hindi ito nag-a-update sa sarili.`,
    iosNote: `Hindi pa nailalabas ang iOS.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Isang personal na proyekto, tapat na inilarawan.',
    privacy: 'Patakaran sa Privacy',
  },
};
