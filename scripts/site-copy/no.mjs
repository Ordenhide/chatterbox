/**
 * Landingssiden, på norsk. Se en.mjs for formen hver fil i denne mappen deler;
 * `{policy}` blir en lenke til dette språkets personvernerklæring, med
 * `links.policy` som lenketekst.
 */
export default {
  meta: {
    title: 'Chatterbox — En meldingsapp uten noe å slå deg opp i',
    description:
      'Ende-til-ende-krypterte meldinger uten brukerkatalog, uten e-postadresse i det hele tatt, og med en personvernerklæring som sier hva den ikke kan. Web og Android.',
  },

  links: {policy: 'personvernerklæringen', policyShort: 'Les den'},

  nav: {
    different: 'Hva som er annerledes',
    features: 'Funksjoner',
    limits: 'Grenser',
    get: 'Hent den',
    language: 'Språk',
  },

  hero: {
    eyebrow: 'Web & Android · iOS underveis',
    title: 'Ingenting å slå deg opp i.',
    lead: `Chatterbox er en ende-til-ende-kryptert meldingsapp uten brukerkatalog. Ingen kan søke etter deg, fordi det ikke finnes noen indeks å søke i — den eneste veien inn i en samtale er en lenke du selv gir noen.`,
    primary: 'Hent Chatterbox',
    secondary: 'Les personvernerklæringen',
    badges: ['Ingen brukerkatalog', 'Bare med invitasjon', '53 språk', 'Gratis'],
  },

  different: {
    eyebrow: 'Hva som er annerledes',
    title: 'Sju ting de fleste meldingsapper ikke gjør',
    intro: `Hver av disse er en beslutning med en mekanisme bak, ikke en innstilling du må finne. Der noe er en avveining, står det.`,
    reasons: [
      {
        title: 'Det finnes ingen brukerkatalog',
        body: [
          `Ingen søk på brukernavn, ingen matching på telefonnummer, ingen «personer du kanskje kjenner». Den eneste ruten inn i en samtale er en invitasjonslenke du sender noen utenfor kanalen. Hver lenke virker én gang og utløper etter 24 timer, og en planlagt jobb sletter de utløpte i stedet for å etterlate en permanent oversikt over hvem som inviterte hvem.`,
        ],
        note: `Dette er ikke en personverninnstilling. Det finnes ingen katalog å melde seg ut av.`,
      },
      {
        title: 'Det finnes ingen e-postadresse å beholde',
        body: [
          `Registreringen spør ikke om noe om deg. Kontoen din er en gjenopprettingsfrase på 24 ord som genereres på enheten din, og legitimasjonen serveren sjekker er utledet fra de ordene — det den lagrer er en tilfeldig etikett under et domene som ikke kan motta post. Profildokumentet ditt inneholder ingen e-postadresse, ingen visningsnavn og ingen bilde-URL, så det finnes heller ingen profil for andre å lese.`,
        ],
      },
      {
        title: 'Mer enn meldingene er forseglet',
        body: [
          `Meldingstekst er den enkle delen. Lenkeforhåndsvisninger og live posisjon krypteres til samtalen på samme måte — en posisjonsdeling er en strøm av koordinater, og den forsegles til den andre enhetens nøkkel som alt annet. Vedlegg krypteres før de lastes opp, så det serveren har er byte den ikke kan åpne.`,
        ],
      },
      {
        title: 'Hver melding har sin egen nøkkel',
        body: [
          `De fleste en-til-en- og gruppesamtaler bruker en ratchet, slik at kompromittering av en enhet ikke avslører meldingene som kom før. Samtaler der noens klient ikke har publisert det nyere nøkkelmaterialet, faller tilbake til en enkelt langlivet nøkkel, som ikke har den egenskapen.`,
        ],
        note: `Etiketten under en melding forteller deg hvilken den faktisk fikk. Det er ikke en påstand om appen; det er en påstand om den meldingen.`,
      },
      {
        title: `Ingen AI leser samtalene dine`,
        body: [
          `Det finnes ingen oppsummerer, ingen oversettelse, ingen transkripsjon. Ingenting i denne appen dekrypterer en samtale og sender den til en tredjepart for behandling, fordi ingen funksjon her gjør det. Svarforslagene beregnes på enheten din ut fra de siste meldingene, og går ingen steder.`,
        ],
        note: `Disse funksjonene ligger i koden og er slått av for denne utgivelsen; de er ment å komme tilbake. Del 6 av personvernerklæringen navngir fortsatt de tre tjenestene de ville nådd, og sier at ingenting når dem i dag. Når de kommer tilbake, gjør de det med den opplysningen og en melding før første bruk.`,
      },
      {
        title: 'Å slå opp noe skjer ikke bak ryggen din',
        body: [
          `Trykk på et navn i en melding, og Chatterbox viser deg Wikipedia-artikkelen. Den forespørselen skjer ved trykket og ikke ellers, og ingenting om den skrives inn i samtalen.`,
        ],
        note: `En tidligere versjon skannet de siste femten meldingene i hver tråd du åpnet og spurte Wikipedia opptil tretti ganger per åpning — samtidig som den viste ingenting, fordi kortene lå bak et flagg som aldri var på. Det ble fjernet i stedet for reparert.`,
      },
      {
        title: 'Personvernerklæringen sier hva den ikke kan',
        body: [
          `Den fastslår at krypteringen aldri har vært uavhengig revidert, at Google kan se metadataene for hver tilkobling fordi vi leier serverne deres, og at en nøkkel som ble byttet ut før din første melding ville se helt normal ut. Det er den samme teksten i appen og på dette nettstedet, på 53 språk — ikke en engelsk original med en mykere oversettelse.`,
        ],
        note: `{policyShort} før du bestemmer deg for å stole på noe av det over.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funksjoner',
    title: 'Hva den faktisk gjør',
    intro: `Alt som er listet her har et grensesnitt du kan nå. Ingenting på denne siden beskriver en evne som bare finnes i koden.`,
    cards: [
      {
        title: 'Meldinger',
        body: `Tekst, bilder, video, filer og talemeldinger. Svar, videresending, reaksjoner, lesekvitteringer, festede meldinger, bokmerker og planlagte meldinger.`,
      },
      {
        title: 'Tale- og videosamtaler',
        body: `Samtaler kobler seg direkte mellom de to enhetene via WebRTC når det er mulig, og krypterer lyd og video som standard i stedet for som et alternativ. Når de ikke kan — ofte på grunn av ulike nettverk — bærer en kryptert relé samtalen uten å kunne dekryptere den.`,
      },
      {
        title: `Svarforslag`,
        body: `Noen foreslåtte svar hentet fra de siste meldingene i samtalen. De matches på enheten din mot en fraseliste på ditt språk — ingenting sendes noe sted for å lage dem.`,
      },
      {
        title: 'Wikipedia-oppslag',
        body: `Hold inne en melding, velg et navn i den, og les artikkelen uten å forlate chatten. Én forespørsel, ved ditt trykk, på ditt eget språk.`,
      },
      {
        title: 'Din nøkkel, din gjenopprettingsfrase',
        body: `Den private nøkkelen som dekrypterer meldingene dine forlater aldri enheten din. Du kan skrive den ned som en gjenopprettingsfrase; vi holder den ikke og kan ikke gjenopprette den for deg.`,
      },
      {
        title: '53 språk',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — høyre-til-venstre inkludert.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Personvernkontroller',
    title: 'Hva du kan låse ned',
    items: [
      {title: 'Applås', body: `Biometri eller PIN. Låses igjen hver gang du forlater appen.`},
      {title: 'Vis én gang', body: `Bilder og videoer som lukkes for godt etter at de er åpnet.`},
      {
        title: 'Forsvinnende meldinger',
        body: `Sett en samtale til å tømme seg selv, fra én time opp til tretti dager.`,
      },
      {
        title: 'Slett etter lesing',
        body: `En melding som ødelegger seg selv når den andre personen har lest den.`,
      },
      {
        title: 'Blokkering',
        body: `Blokker hvem som helst. Uten katalog finner de ikke veien tilbake.`,
      },
      {
        title: 'Eksporter og slett',
        body: `Ta ut dataene dine, eller slett kontoen og alt under den.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Grenser',
    title: 'Hva som ikke er beskyttet',
    intro: `En side som bare lister styrker er en side du ikke kan ta en beslutning ut fra. Dette er den korte versjonen; {policy} er den lange.`,
    sealed: {
      title: 'Forseglet på enheten din',
      items: [
        'Teksten i meldingene dine',
        'Bilder, video, lyd og filer du legger ved',
        'Lenkeforhåndsvisninger og live posisjon',
        'Taletranskripsjoner, når de kommer tilbake til deg',
        'Samtalelyd og video, mellom de to enhetene',
      ],
    },
    visible: {
      title: `Synlig for oss, Google og Cloudflare`,
      items: [
        'At en samtale finnes, og hvilke kontoer som er i den',
        'Når hver konto sist var aktiv',
        'Metadataene for hver tilkobling, inkludert IP-adressen din',
        'At en samtale ble ringt, til hvem og når — ikke lyden eller videoen',
        `Begge IP-adressene, når en samtale må videresendes for å koble til — aldri lyden eller videoen`,
        'Filnavn, type og størrelse på hvert vedlegg du sender',
      ],
    },
    note: `Krypteringen har aldri vært uavhengig revidert. Å fjerne de metadataene er vanskeligere enn å kryptere innholdet, og det arbeidet er ikke ferdig.`,
  },

  download: {
    title: 'Hent Chatterbox',
    intro: `Web-appen kjører i en nettleser uten at noe installeres. På Android holder Google Play den oppdatert; APK-filen på dette nettstedet er samme build for den som helst slipper butikken.`,
    introWebOnly: `Web-appen kjører i en nettleser uten at noe installeres, på en telefon like godt som på en datamaskin. Android-builden er på vei til Google Play.`,
    web: 'Åpne web-appen',
    play: 'Få den på Google Play',
    playPending: 'Kommer til Google Play',
    apk: 'Last ned APK-filen',
    playNote: `Google Play er den anbefalte veien på Android: den oppdaterer appen i bakgrunnen og verifiserer signaturen ved hver installasjon.`,
    androidPendingNote: `Ingen av Android-veiene er live ennå: Play-oppføringen er ikke publisert, og det finnes ingen nedlasting på dette nettstedet. Web-appen er veien inn til én av dem er det.`,
    playPendingNote: `Play-oppføringen er ikke live ennå. Til den er det, er APK-filen Android-veien — Android ber deg tillate installasjoner fra denne kilden første gang, og den oppdaterer ikke seg selv.`,
    apkNote: `APK-filen er signert med samme nøkkel som Play-builden, så den installeres over den og beholder dataene dine. Den oppdaterer ikke seg selv.`,
    iosNote: `iOS er ikke utgitt ennå.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Et personlig prosjekt, ærlig beskrevet.',
    privacy: 'Personvernerklæring',
  },
};
