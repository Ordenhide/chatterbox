/**
 * De landingspagina, in het Nederlands. Zie en.mjs voor de vorm die elk bestand
 * in deze map deelt; `{policy}` wordt een link naar het privacybeleid van deze
 * taal, met `links.policy` als linktekst.
 */
export default {
  meta: {
    title: 'Chatterbox — Een messenger zonder iets om je in op te zoeken',
    description:
      'End-to-end versleutelde berichten zonder gebruikersmap, zonder e-mailadres, en met een privacybeleid dat zegt wat het niet kan. Web en Android.',
  },

  links: {policy: 'privacybeleid', policyShort: 'Lees het'},

  nav: {
    different: 'Wat anders is',
    features: 'Functies',
    limits: 'Grenzen',
    get: 'Downloaden',
    language: 'Taal',
  },

  hero: {
    eyebrow: 'Web & Android · iOS in de maak',
    title: 'Niets om je in op te zoeken.',
    lead: `Chatterbox is een end-to-end versleutelde messenger zonder gebruikersmap. Niemand kan naar je zoeken, omdat er geen index is om in te zoeken — de enige weg naar een gesprek is een link die je iemand zelf geeft.`,
    primary: 'Chatterbox downloaden',
    secondary: 'Lees het privacybeleid',
    badges: ['Geen gebruikersmap', 'Alleen op uitnodiging', '53 talen', 'Gratis'],
  },

  different: {
    eyebrow: 'Wat anders is',
    title: 'Zeven dingen die de meeste messengers niet doen',
    intro: `Elk hiervan is een beslissing met een mechanisme erachter, niet een instelling die je moet vinden. Waar iets een afweging is, staat dat er.`,
    reasons: [
      {
        title: 'Er is geen gebruikersmap',
        body: [
          `Geen zoeken op gebruikersnaam, geen matchen op telefoonnummer, geen “mensen die je misschien kent”. De enige route naar een gesprek is een uitnodigingslink die je iemand buiten het kanaal om stuurt. Elke link werkt één keer en verloopt na 24 uur, en een geplande taak verwijdert de verlopen links in plaats van een permanent overzicht achter te laten van wie wie heeft uitgenodigd.`,
        ],
        note: `Dit is geen privacyinstelling. Er is geen map om je voor af te melden.`,
      },
      {
        title: 'Er is geen e-mailadres om te bewaren',
        body: [
          `Aanmelden vraagt niets over jou. Je account is een herstelzin van 24 woorden die op je apparaat wordt gegenereerd, en de credential die de server controleert is daarvan afgeleid — wat hij opslaat is een willekeurig label onder een domein dat geen post kan ontvangen. Je profieldocument bevat geen e-mailadres, geen weergavenaam en geen foto-URL, dus er is ook geen profiel dat iemand anders kan lezen.`,
        ],
      },
      {
        title: 'Meer dan de berichten is verzegeld',
        body: [
          `Berichttekst is het makkelijke deel. Linkvoorvertoningen en live locatie worden op dezelfde manier naar het gesprek versleuteld — een locatiedeling is een stroom coördinaten, en die is net als al het andere verzegeld met de sleutel van het andere apparaat. Bijlagen worden versleuteld voordat ze worden geüpload, dus wat de server bewaart zijn bytes die hij niet kan openen.`,
        ],
      },
      {
        title: 'Elk bericht heeft zijn eigen sleutel',
        body: [
          `De meeste één-op-één- en groepsgesprekken gebruiken een ratchet, zodat het compromitteren van een apparaat de berichten die eraan voorafgingen niet blootlegt. Gesprekken waarbij iemands client het nieuwere sleutelmateriaal niet heeft gepubliceerd vallen terug op één langlevende sleutel, die die eigenschap niet heeft.`,
        ],
        note: `Het label onder een bericht vertelt je welke het daadwerkelijk kreeg. Het is geen bewering over de app; het is een bewering over dat bericht.`,
      },
      {
        title: `Geen AI leest je gesprekken`,
        body: [
          `Er is geen samenvatter, geen vertaling, geen transcriptie. Niets in deze app ontsleutelt een gesprek en stuurt het naar een derde partij om te laten verwerken, omdat geen enkele functie hier dat doet. De antwoordsuggesties worden op je apparaat berekend uit de laatste paar berichten, en gaan nergens heen.`,
        ],
        note: `Die functies zitten in de code en staan uit voor deze release; ze zijn bedoeld om terug te komen. Sectie 6 van het privacybeleid noemt nog steeds de drie diensten die ze zouden bereiken en zegt dat er vandaag niets bij ze aankomt. Wanneer ze terugkeren, doen ze dat met die openbaarmaking en een prompt vóór het eerste gebruik.`,
      },
      {
        title: 'Iets opzoeken gebeurt niet achter je rug',
        body: [
          `Tik op een naam in een bericht en Chatterbox laat je het Wikipedia-artikel zien. Dat verzoek gebeurt bij de tik en niet anders, en er wordt niets erover in het gesprek geschreven.`,
        ],
        note: `Een eerdere versie scande de laatste vijftien berichten van elk gesprek dat je opende en deed tot dertig Wikipedia-verzoeken per keer — terwijl er niets werd weergegeven, omdat de kaarten achter een vlag zaten die nooit aan stond. Het is verwijderd in plaats van gerepareerd.`,
      },
      {
        title: 'Het privacybeleid zegt wat het niet kan',
        body: [
          `Het stelt dat de encryptie nooit onafhankelijk is geaudit, dat Google de metadata van elke verbinding kan zien omdat we hun servers huren, en dat een sleutel die vóór je eerste bericht werd vervangen er volkomen normaal uit zou zien. Het is dezelfde tekst in de app en op deze site, in 53 talen — geen Engels origineel met een zachtere vertaling.`,
        ],
        note: `{policyShort} voordat je besluit iets van het bovenstaande te vertrouwen.`,
      },
    ],
  },

  features: {
    eyebrow: 'Functies',
    title: 'Wat het daadwerkelijk doet',
    intro: `Alles wat hier staat heeft een interface die je kunt bereiken. Niets op deze pagina beschrijft een mogelijkheid die alleen in de code bestaat.`,
    cards: [
      {
        title: 'Berichten',
        body: `Tekst, foto's, video, bestanden en spraakberichten. Antwoorden, doorsturen, reacties, leesbevestigingen, vastgezette berichten, bladwijzers en geplande berichten.`,
      },
      {
        title: 'Spraak- en video-oproepen',
        body: `Peer-to-peer bellen via WebRTC, dat de media tussen de twee apparaten standaard versleutelt in plaats van als optie.`,
      },
      {
        title: `Antwoordsuggesties`,
        body: `Een paar voorgestelde antwoorden, getrokken uit de laatste berichten in het gesprek. Ze worden op je apparaat gematcht tegen een lijst met zinnen in je taal — er wordt niets verstuurd om ze te maken.`,
      },
      {
        title: 'Wikipedia opzoeken',
        body: `Houd een bericht ingedrukt, kies er een naam in, en lees het artikel zonder de chat te verlaten. Eén verzoek, op jouw tik, in je eigen taal.`,
      },
      {
        title: 'Jouw sleutel, jouw herstelzin',
        body: `De privésleutel die je berichten ontsleutelt verlaat je apparaat nooit. Je kunt hem opschrijven als herstelzin; wij bewaren hem niet en kunnen hem niet voor je herstellen.`,
      },
      {
        title: '53 talen',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — rechts-naar-links inbegrepen.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Privacyinstellingen',
    title: 'Wat je kunt dichtzetten',
    items: [
      {title: 'App-vergrendeling', body: `Biometrie of pincode, met een automatische vergrendeltijd die je zelf kiest.`},
      {title: 'Eén keer bekijken', body: `Foto's en video's die definitief sluiten nadat ze zijn geopend.`},
      {
        title: 'Verdwijnende berichten',
        body: `Stel een gesprek in om zichzelf te wissen, van een uur tot dertig dagen.`,
      },
      {
        title: 'Vernietigen na lezen',
        body: `Een bericht dat zichzelf vernietigt zodra de ander het heeft gelezen.`,
      },
      {
        title: 'Blokkeren',
        body: `Blokkeer wie je wilt. Zonder map kunnen ze de weg terug niet vinden.`,
      },
      {
        title: 'Exporteren en verwijderen',
        body: `Haal je data eruit, of verwijder het account en alles eronder.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Grenzen',
    title: 'Wat niet beschermd is',
    intro: `Een pagina die alleen sterke punten opsomt is een pagina waarmee je geen beslissing kunt nemen. Dit is de korte versie; het {policy} is de lange.`,
    sealed: {
      title: 'Verzegeld op je apparaat',
      items: [
        'De tekst van je berichten',
        "Foto's, video, audio en bestanden die je bijvoegt",
        'Linkvoorvertoningen en live locatie',
        'Spraaktranscripties, zodra ze bij je terugkomen',
        'Audio en video van oproepen, tussen de twee apparaten',
      ],
    },
    visible: {
      title: 'Zichtbaar voor ons en voor Google',
      items: [
        'Dat een gesprek bestaat, en welke accounts erin zitten',
        'Wanneer elk account het laatst actief was',
        'De metadata van elke verbinding, inclusief je IP-adres',
        'Dat een oproep is geplaatst, aan wie en wanneer — niet de audio of video',
        'De bestandsnaam, het type en de grootte van elke bijlage die je verstuurt',
      ],
    },
    note: `De encryptie is nooit onafhankelijk geaudit. Die metadata verwijderen is moeilijker dan de inhoud versleutelen, en dat werk is niet klaar.`,
  },

  download: {
    title: 'Chatterbox downloaden',
    intro: `De web-app draait in een browser zonder dat je iets installeert. Op Android houdt Google Play hem bijgewerkt; de APK op deze site is dezelfde build voor wie liever niet de store gebruikt.`,
    introWebOnly: `De web-app draait in een browser zonder dat je iets installeert, op een telefoon net zo goed als op een desktop. De Android-build is op weg naar Google Play.`,
    web: 'Open de web-app',
    play: 'Download in Google Play',
    playPending: 'Binnenkort in Google Play',
    apk: 'Download de APK',
    playNote: `Google Play is de aanbevolen route op Android: hij werkt de app op de achtergrond bij en controleert de signatuur bij elke installatie.`,
    androidPendingNote: `Geen van beide Android-routes is al live: de Play-vermelding is niet gepubliceerd, en er staat geen download op deze site. De web-app is de ingang tot een van de twee dat wel is.`,
    playPendingNote: `De Play-vermelding is nog niet live. Tot die tijd is de APK de Android-route — Android vraagt je de eerste keer om installaties uit deze bron toe te staan, en hij werkt zichzelf niet bij.`,
    apkNote: `De APK is met dezelfde sleutel ondertekend als de Play-build, dus hij installeert eroverheen en houdt je data. Hij werkt zichzelf niet bij.`,
    iosNote: `iOS is nog niet uitgebracht.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Een persoonlijk project, eerlijk beschreven.',
    privacy: 'Privacybeleid',
  },
};
