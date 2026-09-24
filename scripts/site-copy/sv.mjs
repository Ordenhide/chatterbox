/**
 * Landningssidan, på svenska. Se en.mjs för formen som varje fil i den här
 * mappen delar; `{policy}` blir en länk till det här språkets
 * integritetspolicy, med `links.policy` som länktext.
 */
export default {
  meta: {
    title: 'Chatterbox — En messenger utan något att slå upp dig i',
    description:
      'Totalsträckskrypterade meddelanden utan användarkatalog, utan e-postadress alls, och med en integritetspolicy som säger vad den inte kan. Web och Android.',
  },

  links: {policy: 'integritetspolicyn', policyShort: 'Läs den'},

  nav: {
    different: 'Vad som skiljer',
    features: 'Funktioner',
    limits: 'Gränser',
    get: 'Hämta',
    language: 'Språk',
  },

  hero: {
    eyebrow: 'Web & Android · iOS på väg',
    title: 'Inget att slå upp dig i.',
    lead: `Chatterbox är en totalsträckskrypterad messenger utan användarkatalog. Ingen kan söka efter dig, eftersom det inte finns något index att söka i — den enda vägen in i en konversation är en länk du själv ger någon.`,
    primary: 'Hämta Chatterbox',
    secondary: 'Läs integritetspolicyn',
    badges: ['Ingen användarkatalog', 'Bara via inbjudan', '53 språk', 'Gratis'],
  },

  different: {
    eyebrow: 'Vad som skiljer',
    title: 'Sju saker de flesta messengrar inte gör',
    intro: `Var och en av dessa är ett beslut med en mekanism bakom sig, inte en inställning du måste hitta. Där något är en avvägning står det så.`,
    reasons: [
      {
        title: 'Det finns ingen användarkatalog',
        body: [
          `Ingen sökning på användarnamn, ingen matchning på telefonnummer, inga ”personer du kanske känner”. Den enda vägen in i en konversation är en inbjudningslänk du skickar någon utanför kanalen. Varje länk fungerar en gång och upphör efter 24 timmar, och ett schemalagt jobb raderar de utgångna i stället för att lämna kvar en permanent förteckning över vem som bjudit in vem.`,
        ],
        note: `Det här är inte en integritetsinställning. Det finns ingen katalog att avregistrera sig från.`,
      },
      {
        title: 'Det finns ingen e-postadress att behålla',
        body: [
          `Registreringen frågar ingenting om dig. Ditt konto är en återställningsfras på 24 ord som genereras på din enhet, och autentiseringsuppgiften som servern kontrollerar härleds från dessa ord — vad den lagrar är en slumpmässig etikett under en domän som inte kan ta emot post. Ditt profildokument innehåller ingen e-postadress, inget visningsnamn och ingen bild-URL, så det finns heller ingen profil för någon annan att läsa.`,
        ],
      },
      {
        title: 'Mer än meddelandena är förseglat',
        body: [
          `Meddelandetext är den enkla delen. Länkförhandsvisningar och livposition krypteras till konversationen på samma sätt — en positionsdelning är en ström av koordinater, och den förseglas till den andra enhetens nyckel som allt annat. Bilagor krypteras innan de laddas upp, så vad servern håller är byte den inte kan öppna.`,
        ],
      },
      {
        title: 'Varje meddelande har sin egen nyckel',
        body: [
          `De flesta en-till-en- och gruppkonversationer använder en ratchet, så att komprometterandet av en enhet inte exponerar de meddelanden som kom före. Konversationer där någons klient inte har publicerat det nyare nyckelmaterialet faller tillbaka på en enda långlivad nyckel, som inte har den egenskapen.`,
        ],
        note: `Etiketten under ett meddelande talar om vilken det faktiskt fick. Det är inte ett påstående om appen; det är ett påstående om det meddelandet.`,
      },
      {
        title: `Ingen AI läser dina konversationer`,
        body: [
          `Det finns ingen sammanfattare, ingen översättning, ingen transkribering. Inget i den här appen dekrypterar en konversation och skickar den till en tredje part för behandling, eftersom ingen funktion här gör det. Svarsförslagen beräknas på din enhet utifrån de senaste meddelandena, och går ingenstans.`,
        ],
        note: `Dessa funktioner finns i koden och är avstängda för den här versionen; de är avsedda att komma tillbaka. Avsnitt 6 i integritetspolicyn namnger fortfarande de tre tjänster de skulle nå och säger att inget når dem i dag. När de återvänder gör de det med det avslöjandet och en uppmaning före första användningen.`,
      },
      {
        title: 'Att slå upp något sker inte bakom din rygg',
        body: [
          `Tryck på ett namn i ett meddelande och Chatterbox visar dig dess Wikipedia-artikel. Den förfrågan sker vid tryckningen och inte annars, och inget om den skrivs in i konversationen.`,
        ],
        note: `En tidigare version skannade de senaste femton meddelandena i varje tråd du öppnade och frågade Wikipedia upp till trettio gånger per öppning — medan den visade ingenting, eftersom korten låg bakom en flagga som aldrig var på. Det togs bort i stället för att lagas.`,
      },
      {
        title: 'Integritetspolicyn säger vad den inte kan',
        body: [
          `Den anger att krypteringen aldrig har granskats oberoende, att Google kan se metadata för varje anslutning eftersom vi hyr deras servrar, och att en nyckel som byttes ut före ditt första meddelande skulle se helt normal ut. Det är samma text i appen och på den här sidan, på 53 språk — inte ett engelskt original med en mjukare översättning.`,
        ],
        note: `{policyShort} innan du bestämmer dig för att lita på något av ovanstående.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funktioner',
    title: 'Vad den faktiskt gör',
    intro: `Allt som listas här har ett gränssnitt du kan nå. Inget på den här sidan beskriver en förmåga som bara finns i koden.`,
    cards: [
      {
        title: 'Meddelanden',
        body: `Text, foton, video, filer och röstmeddelanden. Svar, vidarebefordran, reaktioner, läskvitton, fästa meddelanden, bokmärken och schemalagda meddelanden.`,
      },
      {
        title: 'Röst- och videosamtal',
        body: `Samtal ansluter direkt mellan de två enheterna via WebRTC när det är möjligt, och krypterar ljud och video som standard snarare än som ett alternativ. När de inte kan — ofta på grund av olika nätverk — bär en krypterad relä samtalet utan att kunna dekryptera det.`,
      },
      {
        title: `Svarsförslag`,
        body: `Några föreslagna svar hämtade ur de senaste meddelandena i konversationen. De matchas på din enhet mot en fraslista på ditt språk — inget skickas någonstans för att skapa dem.`,
      },
      {
        title: 'Wikipedia-uppslagning',
        body: `Håll in ett meddelande, välj ett namn i det, och läs artikeln utan att lämna chatten. En förfrågan, vid din tryckning, på ditt eget språk.`,
      },
      {
        title: 'Din nyckel, din återställningsfras',
        body: `Den privata nyckeln som dekrypterar dina meddelanden lämnar aldrig din enhet. Du kan skriva ner den som en återställningsfras; vi håller den inte och kan inte återställa den åt dig.`,
      },
      {
        title: '53 språk',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — höger-till-vänster inkluderat.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Integritetskontroller',
    title: 'Vad du kan låsa ner',
    items: [
      {title: 'Applås', body: `Biometri eller PIN. Låses igen varje gång du lämnar appen.`},
      {title: 'Visa en gång', body: `Foton och videor som stängs för gott efter att de öppnats.`},
      {
        title: 'Försvinnande meddelanden',
        body: `Ställ in en konversation att rensa sig själv, från en timme upp till trettio dagar.`,
      },
      {
        title: 'Radera efter läsning',
        body: `Ett meddelande som förstör sig självt när den andra personen har läst det.`,
      },
      {
        title: 'Blockering',
        body: `Blockera vem som helst. Utan katalog kan de inte hitta vägen tillbaka.`,
      },
      {
        title: 'Exportera och radera',
        body: `Ta ut dina data, eller radera kontot och allt under det.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Gränser',
    title: 'Vad som inte är skyddat',
    intro: `En sida som bara listar styrkor är en sida du inte kan fatta ett beslut utifrån. Det här är den korta versionen; {policy} är den långa.`,
    sealed: {
      title: 'Förseglat på din enhet',
      items: [
        'Texten i dina meddelanden',
        'Foton, video, ljud och filer du bifogar',
        'Länkförhandsvisningar och livposition',
        'Rösttranskriptioner, när de kommer tillbaka till dig',
        'Samtalsljud och video, mellan de två enheterna',
      ],
    },
    visible: {
      title: `Synligt för oss, Google och Cloudflare`,
      items: [
        'Att en konversation finns, och vilka konton som är med i den',
        'När varje konto senast var aktivt',
        'Metadata för varje anslutning, inklusive din IP-adress',
        'Att ett samtal ringdes, till vem och när — inte dess ljud eller video',
        `Båda IP-adresserna, när ett samtal behöver reläas för att ansluta — aldrig dess ljud eller video`,
        'Filnamn, typ och storlek på varje bilaga du skickar',
      ],
    },
    note: `Krypteringen har aldrig granskats oberoende. Att ta bort de metadata är svårare än att kryptera innehållet, och det arbetet är inte klart.`,
  },

  download: {
    title: 'Hämta Chatterbox',
    intro: `Webbappen körs i en webbläsare utan att något installeras. På Android håller Google Play den uppdaterad; APK-filen på den här sidan är samma build för den som helst slipper butiken.`,
    introWebOnly: `Webbappen körs i en webbläsare utan att något installeras, på en telefon likaväl som på en dator. Android-builden är på väg till Google Play.`,
    web: 'Öppna webbappen',
    play: 'Hämta på Google Play',
    playPending: 'Kommer till Google Play',
    apk: 'Ladda ner APK:n',
    playNote: `Google Play är den rekommenderade vägen på Android: den uppdaterar appen i bakgrunden och verifierar signaturen vid varje installation.`,
    androidPendingNote: `Ingen av Android-vägarna är live än: Play-listningen är inte publicerad, och det finns ingen nedladdning på den här sidan. Webbappen är vägen in tills en av dem är det.`,
    playPendingNote: `Play-listningen är inte live än. Till dess är APK:n Android-vägen — Android ber dig tillåta installationer från den här källan första gången, och den uppdaterar inte sig själv.`,
    apkNote: `APK:n är signerad med samma nyckel som Play-builden, så den installeras över den och behåller dina data. Den uppdaterar inte sig själv.`,
    iosNote: `iOS är inte släppt än.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Ett personligt projekt, ärligt beskrivet.',
    privacy: 'Integritetspolicy',
  },
};
