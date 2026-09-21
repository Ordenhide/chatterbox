/**
 * Úvodní stránka, v češtině. Tvar, který sdílí každý soubor v této složce, je
 * v en.mjs; `{policy}` se stane odkazem na zásady ochrany osobních údajů v
 * tomto jazyce, s `links.policy` jako textem odkazu.
 */
export default {
  meta: {
    title: 'Chatterbox — Messenger, ve kterém není kde si vás vyhledat',
    description:
      'End-to-end šifrované zprávy bez adresáře uživatelů, úplně bez e-mailové adresy a se zásadami ochrany osobních údajů, které říkají, co nedokážou. Web a Android.',
  },

  links: {policy: 'zásady ochrany osobních údajů', policyShort: 'Přečtěte si je'},

  nav: {
    different: 'Co je jinak',
    features: 'Funkce',
    limits: 'Omezení',
    get: 'Získat',
    language: 'Jazyk',
  },

  hero: {
    eyebrow: 'Web a Android · iOS se připravuje',
    title: 'Není kde si vás vyhledat.',
    lead: `Chatterbox je end-to-end šifrovaný messenger bez adresáře uživatelů. Nikdo vás nemůže vyhledat, protože neexistuje index, ve kterém by se hledalo — jediná cesta do konverzace je odkaz, který někomu dáte sami.`,
    primary: 'Získat Chatterbox',
    secondary: 'Přečtěte si zásady ochrany osobních údajů',
    badges: ['Žádný adresář uživatelů', 'Jen na pozvání', '53 jazyky', 'Zdarma'],
  },

  different: {
    eyebrow: 'Co je jinak',
    title: 'Sedm věcí, které většina messengerů nedělá',
    intro: `Každá z nich je rozhodnutí s mechanismem za sebou, ne nastavení, které musíte najít. Kde je něco kompromis, je to řečeno.`,
    reasons: [
      {
        title: 'Neexistuje žádný adresář uživatelů',
        body: [
          `Žádné hledání podle uživatelského jména, žádné párování telefonních čísel, žádní „lidé, které možná znáte“. Jediná cesta do konverzace je pozvánkový odkaz, který někomu pošlete mimo kanál. Každý odkaz funguje jednou a po 24 hodinách vyprší, a naplánovaná úloha ty prošlé maže, místo aby po sobě nechávala trvalý záznam o tom, kdo koho pozval.`,
        ],
        note: `Toto není nastavení soukromí. Neexistuje adresář, ze kterého by se dalo odhlásit.`,
      },
      {
        title: 'Neexistuje žádná e-mailová adresa, kterou by šlo uchovávat',
        body: [
          `Registrace se vás na nic neptá. Váš účet je obnovovací fráze o 24 slovech vygenerovaná na vašem zařízení, a přihlašovací údaj, který server kontroluje, je z těch slov odvozen — co ukládá, je náhodný štítek pod doménou, která nemůže přijímat poštu. Dokument vašeho profilu neobsahuje žádnou e-mailovou adresu, žádné zobrazované jméno a žádnou URL fotografie, takže neexistuje ani profil, který by si někdo jiný mohl přečíst.`,
        ],
      },
      {
        title: 'Zapečetěno je víc než jen zprávy',
        body: [
          `Text zprávy je ta snadná část. Náhledy odkazů a živá poloha se šifrují do konverzace stejně — sdílení polohy je proud koordinát a je zapečetěný klíčem druhého zařízení jako všechno ostatní. Přílohy se šifrují ještě před odesláním, takže co server drží, jsou bajty, které nemůže otevřít.`,
        ],
      },
      {
        title: 'Každá zpráva má svůj vlastní klíč',
        body: [
          `Většina konverzací jeden na jednoho i skupinových používá ratchet, takže kompromitace zařízení neodhalí zprávy, které přišly dřív. Konverzace, kde klient někoho nezveřejnil novější klíčový materiál, se vracejí k jednomu dlouhodobému klíči, který tuto vlastnost nemá.`,
        ],
        note: `Štítek pod zprávou vám řekne, který skutečně dostala. Není to tvrzení o aplikaci; je to tvrzení o té zprávě.`,
      },
      {
        title: `Vaše konverzace nečte žádná AI`,
        body: [
          `Neexistuje žádné shrnování, žádný překlad, žádný přepis. Nic v této aplikaci nedešifruje konverzaci a neposílá ji třetí straně k zpracování, protože to tady nedělá žádná funkce. Navrhované odpovědi se počítají na vašem zařízení z posledních několika zpráv a nikam nejdou.`,
        ],
        note: `Tyto funkce jsou v kódu a v tomto vydání jsou vypnuté; mají se vrátit. Oddíl 6 zásad ochrany osobních údajů stále jmenuje tři služby, ke kterým by se dostaly, a říká, že dnes se k nim nic nedostane. Když se vrátí, vrátí se s tímto zveřejněním a s výzvou před prvním použitím.`,
      },
      {
        title: 'Vyhledání něčeho se nedělá za vašimi zády',
        body: [
          `Klepněte na jméno ve zprávě a Chatterbox vám zobrazí jeho článek na Wikipedii. Ten požadavek se odešle při klepnutí a jinak ne, a nic o něm se do konverzace nezapisuje.`,
        ],
        note: `Starší verze prohledávala posledních patnáct zpráv každého vlákna, které jste otevřeli, a dotazovala se Wikipedie až třicetkrát při každém otevření — přitom nic nezobrazovala, protože karty byly za přepínačem, který nikdy nebyl zapnutý. Bylo to odstraněno, ne opraveno.`,
      },
      {
        title: 'Zásady ochrany osobních údajů říkají, co nedokážou',
        body: [
          `Uvádějí, že šifrování nikdy neprošlo nezávislým auditem, že Google vidí metadata každého připojení, protože si pronajímáme jeho servery, a že klíč nahrazený před vaší první zprávou by vypadal naprosto normálně. Je to stejný text v aplikaci i na tomto webu, ve 53 jazycích — ne anglický originál s mírnějším překladem.`,
        ],
        note: `{policyShort}, než se rozhodnete čemukoli z výše uvedeného věřit.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funkce',
    title: 'Co aplikace skutečně dělá',
    intro: `Všechno, co je tu uvedeno, má rozhraní, ke kterému se dostanete. Nic na této stránce nepopisuje schopnost, která existuje jen v kódu.`,
    cards: [
      {
        title: 'Zprávy',
        body: `Text, fotky, video, soubory a hlasové zprávy. Odpovědi, přeposílání, reakce, potvrzení o přečtení, připnuté zprávy, záložky a naplánované zprávy.`,
      },
      {
        title: 'Hlasové a video hovory',
        body: `Hovory se propojují přímo mezi oběma zařízeními přes WebRTC, když je to možné, a šifrují zvuk a obraz standardně, nikoli jako volbu. Když nemohou — často kvůli různým sítím — zašifrovaný přenos přenáší hovor, aniž by ho mohl dešifrovat.`,
      },
      {
        title: `Navrhované odpovědi`,
        body: `Několik navržených odpovědí vycházejících z posledních zpráv v konverzaci. Porovnávají se na vašem zařízení se seznamem frází ve vašem jazyce — nic se nikam neposílá, aby vznikly.`,
      },
      {
        title: 'Vyhledávání na Wikipedii',
        body: `Podržte zprávu, vyberte v ní jméno a přečtěte si článek bez opuštění chatu. Jeden požadavek, na vaše klepnutí, ve vašem vlastním jazyce.`,
      },
      {
        title: 'Váš klíč, vaše obnovovací fráze',
        body: `Soukromý klíč, který dešifruje vaše zprávy, nikdy neopustí vaše zařízení. Můžete si ho zapsat jako obnovovací frázi; my ho nedržíme a nemůžeme ho pro vás obnovit.`,
      },
      {
        title: '53 jazyky',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — včetně písma zprava doleva.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Ovládání soukromí',
    title: 'Co si můžete zamknout',
    items: [
      {title: 'Zámek aplikace', body: `Biometrika nebo PIN, s prodlevou automatického zamknutí, kterou si zvolíte.`},
      {title: 'Jedno zobrazení', body: `Fotky a videa, které se po otevření natrvalo zavřou.`},
      {
        title: 'Mizící zprávy',
        body: `Nastavte konverzaci, aby se sama mazala, od jedné hodiny až po třicet dní.`,
      },
      {
        title: 'Zničit po přečtení',
        body: `Zpráva, která se sama zničí, jakmile si ji druhý člověk přečte.`,
      },
      {
        title: 'Blokování',
        body: `Zablokujte kohokoli. Bez adresáře nenajdou cestu zpátky.`,
      },
      {
        title: 'Export a smazání',
        body: `Vezměte si svá data, nebo smažte účet a všechno pod ním.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Omezení',
    title: 'Co chráněno není',
    intro: `Stránka, která uvádí jen silné stránky, je stránka, podle které se nemůžete rozhodnout. Tohle je krátká verze; {policy} je ta dlouhá.`,
    sealed: {
      title: 'Zapečetěno na vašem zařízení',
      items: [
        'Text vašich zpráv',
        'Fotky, video, zvuk a soubory, které přikládáte',
        'Náhledy odkazů a živá poloha',
        'Přepisy hlasu, jakmile se vám vrátí',
        'Zvuk a video hovoru, mezi dvěma zařízeními',
      ],
    },
    visible: {
      title: `Viditelné pro nás, Google a Cloudflare`,
      items: [
        'Že konverzace existuje a které účty jsou v ní',
        'Kdy byl každý účet naposledy aktivní',
        'Metadata každého připojení, včetně vaší IP adresy',
        'Že hovor byl uskutečněn, komu a kdy — ne jeho zvuk nebo video',
        `Obě IP adresy, když je hovor potřeba přeposlat kvůli spojení — nikdy jeho zvuk ani obraz`,
        'Název souboru, typ a velikost každé přílohy, kterou pošlete',
      ],
    },
    note: `Šifrování nikdy neprošlo nezávislým auditem. Odstranit ta metadata je těžší než zašifrovat obsah, a tato práce není hotová.`,
  },

  download: {
    title: 'Získat Chatterbox',
    intro: `Webová aplikace běží v prohlížeči, není co instalovat. Na Androidu ji Google Play udržuje aktualizovanou; APK na tomto webu je stejný build pro toho, kdo obchod radši nepoužije.`,
    introWebOnly: `Webová aplikace běží v prohlížeči, není co instalovat, na telefonu stejně jako na počítači. Build pro Android je na cestě do Google Play.`,
    web: 'Otevřít webovou aplikaci',
    play: 'Získat na Google Play',
    playPending: 'Připravuje se na Google Play',
    apk: 'Stáhnout APK',
    playNote: `Google Play je na Androidu doporučená cesta: aktualizuje aplikaci na pozadí a při každé instalaci ověří podpis.`,
    androidPendingNote: `Ani jedna z cest pro Android zatím není v provozu: záznam na Play není zveřejněný a na tomto webu není co stáhnout. Dokud jedna z nich nebude, je vstupem webová aplikace.`,
    playPendingNote: `Záznam na Play zatím není v provozu. Do té doby je cestou pro Android APK — Android vás při prvním pokusu požádá o povolení instalací z tohoto zdroje a aplikace se sama neaktualizuje.`,
    apkNote: `APK je podepsané stejným klíčem jako build z Play, takže se nainstaluje přes něj a zachová vaše data. Samo se neaktualizuje.`,
    iosNote: `iOS zatím nevyšel.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Osobní projekt, popsaný po pravdě.',
    privacy: 'Zásady ochrany osobních údajů',
  },
};
