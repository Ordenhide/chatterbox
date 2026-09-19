/**
 * Landingssiden, på dansk. Se en.mjs for den form, hver fil i denne mappe
 * deler; `{policy}` bliver et link til dette sprogs privatlivspolitik, med
 * `links.policy` som linktekst.
 */
export default {
  meta: {
    title: 'Chatterbox — En messenger uden noget at slå dig op i',
    description:
      'End-to-end-krypterede beskeder uden brugerfortegnelse, uden e-mailadresse overhovedet, og med en privatlivspolitik, der siger, hvad den ikke kan. Web og Android.',
  },

  links: {policy: 'privatlivspolitikken', policyShort: 'Læs den'},

  nav: {
    different: 'Hvad der er anderledes',
    features: 'Funktioner',
    limits: 'Grænser',
    get: 'Hent den',
    language: 'Sprog',
  },

  hero: {
    eyebrow: 'Web & Android · iOS på vej',
    title: 'Intet at slå dig op i.',
    lead: `Chatterbox er en end-to-end-krypteret messenger uden brugerfortegnelse. Ingen kan søge efter dig, for der er intet indeks at søge i — den eneste vej ind i en samtale er et link, du selv giver nogen.`,
    primary: 'Hent Chatterbox',
    secondary: 'Læs privatlivspolitikken',
    badges: ['Ingen brugerfortegnelse', 'Kun med invitation', '53 sprog', 'Gratis'],
  },

  different: {
    eyebrow: 'Hvad der er anderledes',
    title: 'Syv ting de fleste messengere ikke gør',
    intro: `Hver af disse er en beslutning med en mekanisme bag, ikke en indstilling du skal finde. Hvor noget er en afvejning, står det.`,
    reasons: [
      {
        title: 'Der er ingen brugerfortegnelse',
        body: [
          `Ingen søgning på brugernavn, ingen matchning på telefonnummer, ingen “personer du måske kender”. Den eneste vej ind i en samtale er et invitationslink, du sender nogen uden for kanalen. Hvert link virker én gang og udløber efter 24 timer, og et planlagt job sletter de udløbne i stedet for at efterlade en permanent oversigt over, hvem der har inviteret hvem.`,
        ],
        note: `Dette er ikke en privatlivsindstilling. Der er ingen fortegnelse at fravælge.`,
      },
      {
        title: 'Der er ingen e-mailadresse at gemme',
        body: [
          `Tilmeldingen spørger ikke om noget om dig. Din konto er en gendannelsessætning på 24 ord, der genereres på din enhed, og legitimationsoplysningen, serveren kontrollerer, er afledt af de ord — hvad den gemmer, er en tilfældig etiket under et domæne, der ikke kan modtage post. Dit profildokument indeholder ingen e-mailadresse, intet visningsnavn og ingen billed-URL, så der er heller ingen profil, andre kan læse.`,
        ],
      },
      {
        title: 'Mere end beskederne er forseglet',
        body: [
          `Beskedtekst er den nemme del. Linkforhåndsvisninger og live placering krypteres til samtalen på samme måde — en placeringsdeling er en strøm af koordinater, og den forsegles til den anden enheds nøgle som alt andet. Vedhæftede filer krypteres, før de uploades, så hvad serveren har, er bytes den ikke kan åbne.`,
        ],
      },
      {
        title: 'Hver besked har sin egen nøgle',
        body: [
          `De fleste en-til-en- og gruppesamtaler bruger en ratchet, så en kompromitteret enhed ikke afslører de beskeder, der kom før. Samtaler, hvor en persons klient ikke har offentliggjort det nyere nøglemateriale, falder tilbage til en enkelt langlivet nøgle, som ikke har den egenskab.`,
        ],
        note: `Etiketten under en besked fortæller dig, hvilken den faktisk fik. Det er ikke en påstand om appen; det er en påstand om den besked.`,
      },
      {
        title: `Ingen AI læser dine samtaler`,
        body: [
          `Der er ingen opsummering, ingen oversættelse, ingen transskription. Intet i denne app dekrypterer en samtale og sender den til en tredjepart til behandling, for ingen funktion her gør det. Svarforslagene beregnes på din enhed ud fra de seneste beskeder og går ingen steder.`,
        ],
        note: `De funktioner findes i koden og er slået fra i denne udgivelse; de er ment at vende tilbage. Afsnit 6 i privatlivspolitikken navngiver stadig de tre tjenester, de ville nå, og siger, at intet når dem i dag. Når de vender tilbage, gør de det med den oplysning og en prompt før første brug.`,
      },
      {
        title: 'At slå noget op sker ikke bag din ryg',
        body: [
          `Tryk på et navn i en besked, og Chatterbox viser dig dets Wikipedia-artikel. Den forespørgsel sker ved trykket og ikke ellers, og intet om den skrives ind i samtalen.`,
        ],
        note: `En tidligere version scannede de sidste femten beskeder i hver tråd, du åbnede, og forespurgte Wikipedia op til tredive gange pr. åbning — mens den viste ingenting, fordi kortene lå bag et flag, der aldrig var slået til. Det blev fjernet i stedet for rettet.`,
      },
      {
        title: 'Privatlivspolitikken siger, hvad den ikke kan',
        body: [
          `Den fastslår, at krypteringen aldrig er blevet uafhængigt revideret, at Google kan se metadata for hver forbindelse, fordi vi lejer deres servere, og at en nøgle, der blev udskiftet før din første besked, ville se helt normal ud. Det er den samme tekst i appen og på dette site, på 53 sprog — ikke en engelsk original med en blødere oversættelse.`,
        ],
        note: `{policyShort}, før du beslutter dig for at stole på noget af ovenstående.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funktioner',
    title: 'Hvad den faktisk gør',
    intro: `Alt, der er nævnt her, har en flade, du kan nå. Intet på denne side beskriver en evne, der kun findes i koden.`,
    cards: [
      {
        title: 'Beskeder',
        body: `Tekst, fotos, video, filer og talebeskeder. Svar, videresendelse, reaktioner, læsekvitteringer, fastgjorte beskeder, bogmærker og planlagte beskeder.`,
      },
      {
        title: 'Tale- og videoopkald',
        body: `Peer-to-peer-opkald over WebRTC, som krypterer medierne mellem de to enheder som standard frem for som en mulighed.`,
      },
      {
        title: `Svarforslag`,
        body: `Et par foreslåede svar hentet fra de seneste beskeder i samtalen. De matches på din enhed mod en fraseliste på dit sprog — intet sendes nogen steder for at lave dem.`,
      },
      {
        title: 'Wikipedia-opslag',
        body: `Hold en besked nede, vælg et navn i den, og læs artiklen uden at forlade chatten. Én forespørgsel, ved dit tryk, på dit eget sprog.`,
      },
      {
        title: 'Din nøgle, din gendannelsessætning',
        body: `Den private nøgle, der dekrypterer dine beskeder, forlader aldrig din enhed. Du kan skrive den ned som en gendannelsessætning; vi opbevarer den ikke og kan ikke gendanne den for dig.`,
      },
      {
        title: '53 sprog',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — højre-til-venstre inkluderet.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Privatlivsindstillinger',
    title: 'Hvad du kan lukke ned',
    items: [
      {title: 'Applås', body: `Biometri eller PIN-kode, med en automatisk låseforsinkelse du selv vælger.`},
      {title: 'Vis én gang', body: `Fotos og videoer, der lukker for altid, efter de er åbnet.`},
      {
        title: 'Forsvindende beskeder',
        body: `Sæt en samtale til at rydde sig selv, fra en time op til tredive dage.`,
      },
      {
        title: 'Slet efter læsning',
        body: `En besked, der ødelægger sig selv, når den anden person har læst den.`,
      },
      {
        title: 'Blokering',
        body: `Bloker hvem som helst. Uden fortegnelse kan de ikke finde vejen tilbage.`,
      },
      {
        title: 'Eksportér og slet',
        body: `Tag dine data ud, eller slet kontoen og alt under den.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Grænser',
    title: 'Hvad der ikke er beskyttet',
    intro: `En side, der kun lister styrker, er en side, du ikke kan træffe en beslutning ud fra. Dette er den korte version; {policy} er den lange.`,
    sealed: {
      title: 'Forseglet på din enhed',
      items: [
        'Teksten i dine beskeder',
        'Fotos, video, lyd og filer du vedhæfter',
        'Linkforhåndsvisninger og live placering',
        'Taletransskriptioner, når de kommer tilbage til dig',
        'Opkaldslyd og video, mellem de to enheder',
      ],
    },
    visible: {
      title: 'Synligt for os og for Google',
      items: [
        'At en samtale findes, og hvilke konti der er i den',
        'Hvornår hver konto sidst var aktiv',
        'Metadata for hver forbindelse, inklusive din IP-adresse',
        'At et opkald blev foretaget, til hvem og hvornår — ikke dets lyd eller video',
        'Filnavn, type og størrelse på hver vedhæftet fil du sender',
      ],
    },
    note: `Krypteringen er aldrig blevet uafhængigt revideret. At fjerne de metadata er sværere end at kryptere indholdet, og det arbejde er ikke færdigt.`,
  },

  download: {
    title: 'Hent Chatterbox',
    intro: `Webappen kører i en browser, uden at noget skal installeres. På Android holder Google Play den opdateret; APK-filen på dette site er den samme build for dem, der helst undgår butikken.`,
    introWebOnly: `Webappen kører i en browser, uden at noget skal installeres, på en telefon lige så godt som på en computer. Android-builden er på vej til Google Play.`,
    web: 'Åbn webappen',
    play: 'Hent den på Google Play',
    playPending: 'Kommer til Google Play',
    apk: 'Download APK-filen',
    playNote: `Google Play er den anbefalede vej på Android: den opdaterer appen i baggrunden og verificerer signaturen ved hver installation.`,
    androidPendingNote: `Ingen af Android-vejene er live endnu: Play-visningen er ikke offentliggjort, og der er ingen download på dette site. Webappen er vejen ind, indtil en af dem er.`,
    playPendingNote: `Play-visningen er ikke live endnu. Indtil da er APK-filen Android-vejen — Android beder dig tillade installationer fra denne kilde første gang, og den opdaterer ikke sig selv.`,
    apkNote: `APK-filen er underskrevet med samme nøgle som Play-builden, så den installeres oven på den og bevarer dine data. Den opdaterer ikke sig selv.`,
    iosNote: `iOS er ikke udgivet endnu.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Et personligt projekt, ærligt beskrevet.',
    privacy: 'Privatlivspolitik',
  },
};
