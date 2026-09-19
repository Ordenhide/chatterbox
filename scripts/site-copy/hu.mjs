/**
 * A kezdőlap, magyarul. A formát, amelyet a mappa minden fájlja követ, lásd az
 * en.mjs-ben; a `{policy}` ennek a nyelvnek az adatvédelmi irányelveire mutató
 * link lesz, `links.policy` a link szövege.
 */
export default {
  meta: {
    title: 'Chatterbox — Egy messenger, amiben nincs hol rákeresni rád',
    description:
      'Végpontok között titkosított üzenetküldés felhasználói névjegyzék nélkül, e-mail-cím nélkül, és adatvédelmi irányelvekkel, amelyek kimondják, mire nem képesek. Web és Android.',
  },

  links: {policy: 'adatvédelmi irányelveket', policyShort: 'Olvasd el'},

  nav: {
    different: 'Mi más',
    features: 'Funkciók',
    limits: 'Korlátok',
    get: 'Letöltés',
    language: 'Nyelv',
  },

  hero: {
    eyebrow: 'Web és Android · iOS készül',
    title: 'Nincs hol rákeresni rád.',
    lead: `A Chatterbox egy végpontok között titkosított messenger felhasználói névjegyzék nélkül. Senki nem tud rákeresni rád, mert nincs index, amiben keresni lehetne — az egyetlen út egy beszélgetésbe egy link, amit te magad adsz valakinek.`,
    primary: 'Chatterbox letöltése',
    secondary: 'Olvasd el az adatvédelmi irányelveket',
    badges: ['Nincs névjegyzék', 'Csak meghívóval', '53 nyelv', 'Ingyenes'],
  },

  different: {
    eyebrow: 'Mi más',
    title: 'Hét dolog, amit a legtöbb messenger nem tesz meg',
    intro: `Mindegyik egy döntés, mögötte egy mechanizmussal, nem egy beállítás, amit meg kell találnod. Ahol valami kompromisszum, ott ez ki is van írva.`,
    reasons: [
      {
        title: 'Nincs felhasználói névjegyzék',
        body: [
          `Nincs keresés felhasználónévre, nincs telefonszám-egyeztetés, nincsenek „ismerősnek javasolt” emberek. Az egyetlen út egy beszélgetésbe egy meghívólink, amit a csatornán kívül küldesz el valakinek. Minden link egyszer működik, 24 óra után lejár, és egy időzített feladat törli a lejártakat, ahelyett hogy állandó nyilvántartást hagyna arról, ki kit hívott meg.`,
        ],
        note: `Ez nem adatvédelmi beállítás. Nincs névjegyzék, amiből ki lehetne lépni.`,
      },
      {
        title: 'Nincs e-mail-cím, amit meg lehetne tartani',
        body: [
          `A regisztráció semmit sem kérdez rólad. A fiókod egy 24 szavas helyreállítási mondat, amely a te készülékeden jön létre, és a hitelesítő adat, amit a szerver ellenőriz, ezekből a szavakból származik — amit tárol, az egy véletlenszerű címke egy olyan domain alatt, amely nem tud postát fogadni. A profilod dokumentuma nem tartalmaz e-mail-címet, megjelenítendő nevet és képhivatkozást, így nincs olyan profil sem, amit bárki más elolvashatna.`,
        ],
      },
      {
        title: 'Nem csak az üzenetek vannak lezárva',
        body: [
          `Az üzenet szövege a könnyebb rész. A hivatkozás-előnézetek és az élő helymegosztás ugyanúgy a beszélgetéshez titkosítva vannak — egy helymegosztás koordináták folyama, és a másik készülék kulcsával van lezárva, mint minden más. A mellékletek feltöltés előtt titkosítódnak, így amit a szerver tárol, olyan bájtok, amelyeket nem tud kinyitni.`,
        ],
      },
      {
        title: 'Minden üzenetnek saját kulcsa van',
        body: [
          `A legtöbb egy-az-egyhez és csoportos beszélgetés ratchet mechanizmust használ, így egy készülék feltörése nem fedi fel a korábban érkezett üzeneteket. Azok a beszélgetések, ahol valakinek a kliense nem tette közzé az újabb kulcsanyagot, egyetlen hosszú élettartamú kulcsra esnek vissza, amelynek nincs ez a tulajdonsága.`,
        ],
        note: `Az üzenet alatti jelvény megmondja, melyiket kapta valójában. Ez nem az alkalmazásról szóló állítás; ez arról az üzenetről szóló állítás.`,
      },
      {
        title: `Semmilyen MI nem olvassa a beszélgetéseidet`,
        body: [
          `Nincs összefoglaló, nincs fordítás, nincs átirat. Ebben az alkalmazásban semmi sem fejt vissza egy beszélgetést, hogy elküldje feldolgozásra egy harmadik félnek, mert itt egyetlen funkció sem tesz ilyet. A válaszjavaslatokat a készüléked számítja ki az utolsó néhány üzenetből, és nem mennek sehova.`,
        ],
        note: `Ezek a funkciók benne vannak a kódban, és ehhez a kiadáshoz ki vannak kapcsolva; a szándék az, hogy visszatérjenek. Az adatvédelmi irányelvek 6. szakasza továbbra is megnevezi azt a három szolgáltatást, amelyet elérnének, és kimondja, hogy ma semmi nem jut el hozzájuk. Amikor visszatérnek, ezzel a közléssel és az első használat előtti megerősítéssel térnek vissza.`,
      },
      {
        title: 'Egy név megkeresése nem a hátad mögött történik',
        body: [
          `Koppints egy névre egy üzenetben, és a Chatterbox megmutatja a Wikipédia-szócikkét. Az a kérés a koppintáskor indul, egyébként nem, és semmi nem kerül róla a beszélgetésbe.`,
        ],
        note: `Egy korábbi verzió minden megnyitott beszélgetés utolsó tizenöt üzenetét átvizsgálta, és megnyitásonként akár harminc Wikipédia-kérést is küldött — miközben semmit sem jelenített meg, mert a kártyák egy sosem bekapcsolt jelző mögött voltak. Nem javítottuk, hanem eltávolítottuk.`,
      },
      {
        title: 'Az adatvédelmi irányelvek kimondják, mire nem képesek',
        body: [
          `Kimondja, hogy a titkosítást soha nem auditálta független fél, hogy a Google látja minden kapcsolat metaadatait, mert az ő szervereit bérleljük, és hogy egy kulcs, amelyet az első üzenetedet megelőzően cseréltek le, teljesen normálisnak tűnne. Ugyanez a szöveg van az alkalmazásban és ezen az oldalon, 53 nyelven — nem egy angol eredeti egy lágyabb fordítással.`,
        ],
        note: `{policyShort}, mielőtt eldöntöd, hogy bármit is elhiszel a fentiekből.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funkciók',
    title: 'Mit tud valójában',
    intro: `Minden, ami itt szerepel, elérhető felülettel rendelkezik. Ezen az oldalon semmi nem ír le olyan képességet, amely csak a kódban létezik.`,
    cards: [
      {
        title: 'Üzenetküldés',
        body: `Szöveg, fotók, videó, fájlok és hangüzenetek. Válaszok, továbbítás, reakciók, olvasási visszaigazolások, kitűzött üzenetek, könyvjelzők és időzített üzenetek.`,
      },
      {
        title: 'Hang- és videohívások',
        body: `Peer-to-peer hívás WebRTC-n keresztül, amely alapból — és nem opcionálisan — titkosítja a médiát a két készülék között.`,
      },
      {
        title: `Válaszjavaslatok`,
        body: `Néhány javasolt válasz a beszélgetés utolsó üzeneteiből. A készülékeden egyeztetjük őket egy, a te nyelveden készült kifejezéslistával — a létrehozásukhoz semmit sem küldünk el.`,
      },
      {
        title: 'Wikipédia-keresés',
        body: `Tartsd lenyomva egy üzenetet, válassz ki benne egy nevet, és olvasd el a szócikket a beszélgetés elhagyása nélkül. Egy kérés, a te koppintásodra, a saját nyelveden.`,
      },
      {
        title: 'A te kulcsod, a te helyreállítási mondatod',
        body: `A magánkulcs, amely visszafejti az üzeneteidet, soha nem hagyja el a készülékedet. Leírhatod helyreállítási mondatként; mi nem tároljuk, és nem tudjuk helyreállítani neked.`,
      },
      {
        title: '53 nyelv',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — a jobbról balra írást is beleértve.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Adatvédelmi beállítások',
    title: 'Mit zárhatsz le',
    items: [
      {title: 'Alkalmazászár', body: `Biometria vagy PIN-kód, általad választott automatikus zárolási késleltetéssel.`},
      {title: 'Egyszeri megtekintés', body: `Fotók és videók, amelyek megnyitás után véglegesen bezárulnak.`},
      {
        title: 'Eltűnő üzenetek',
        body: `Állítsd be, hogy egy beszélgetés törölje magát, egy órától harminc napig.`,
      },
      {
        title: 'Megsemmisítés olvasás után',
        body: `Egy üzenet, amely megsemmisíti magát, amint a másik elolvasta.`,
      },
      {
        title: 'Letiltás',
        body: `Tiltsd le bárkit. Névjegyzék nélkül nem találnak vissza.`,
      },
      {
        title: 'Exportálás és törlés',
        body: `Vidd ki az adataidat, vagy töröld a fiókot és mindent, ami alatta van.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Korlátok',
    title: 'Ami nincs védve',
    intro: `Egy oldal, amely csak az erősségeket listázza, olyan oldal, amely alapján nem tudsz döntést hozni. Ez a rövid változat; a hosszú az {policy}.`,
    sealed: {
      title: 'Lezárva a készülékeden',
      items: [
        'Az üzeneteid szövege',
        'A csatolt fotók, videó, hang és fájlok',
        'A hivatkozás-előnézetek és az élő helymegosztás',
        'A hangátiratok, amint visszaérnek hozzád',
        'A hívások hangja és videója, a két készülék között',
      ],
    },
    visible: {
      title: 'Számunkra és a Google számára látható',
      items: [
        'Hogy egy beszélgetés létezik, és mely fiókok vannak benne',
        'Mikor volt utoljára aktív az egyes fiókok',
        'Minden kapcsolat metaadatai, beleértve az IP-címedet',
        'Hogy hívás történt, kivel és mikor — nem annak hangja vagy videója',
        'Minden elküldött melléklet fájlneve, típusa és mérete',
      ],
    },
    note: `A titkosítást soha nem auditálta független fél. Azoknak a metaadatoknak az eltávolítása nehezebb, mint a tartalom titkosítása, és ez a munka nincs befejezve.`,
  },

  download: {
    title: 'Chatterbox letöltése',
    intro: `A webalkalmazás böngészőben fut, nincs mit telepíteni. Androidon a Google Play tartja frissen; az itt található APK ugyanaz a build annak, aki inkább nem használná az áruházat.`,
    introWebOnly: `A webalkalmazás böngészőben fut, nincs mit telepíteni, telefonon ugyanúgy, mint számítógépen. Az Android-build útban van a Google Play felé.`,
    web: 'Webalkalmazás megnyitása',
    play: 'Letöltés a Google Play áruházból',
    playPending: 'Hamarosan a Google Play áruházban',
    apk: 'APK letöltése',
    playNote: `A Google Play az ajánlott út Androidon: a háttérben frissíti az alkalmazást, és minden telepítésnél ellenőrzi az aláírást.`,
    androidPendingNote: `Egyik Android-út sem él még: a Play-listázás nincs közzétéve, és ezen az oldalon nincs letöltés. Amíg valamelyik nem lesz, a webalkalmazás a belépő.`,
    playPendingNote: `A Play-listázás még nem él. Addig az APK az Android-út — az Android először engedélyt kér, hogy telepíthess ebből a forrásból, és az APK nem frissíti magát.`,
    apkNote: `Az APK ugyanazzal a kulccsal van aláírva, mint a Play-build, így fölé telepszik és megtartja az adataidat. Nem frissíti magát.`,
    iosNote: `Az iOS még nem jelent meg.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Egy személyes projekt, becsületesen leírva.',
    privacy: 'Adatvédelmi irányelvek',
  },
};
