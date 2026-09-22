/**
 * Pagina de prezentare, în română. Forma pe care o împarte fiecare fișier din
 * acest director este în en.mjs; `{policy}` devine un link către politica de
 * confidențialitate a acestei limbi, cu `links.policy` drept text al linkului.
 */
export default {
  meta: {
    title: 'Chatterbox — Un messenger în care nu ai unde să fii căutat',
    description:
      'Mesaje criptate integral, fără director de utilizatori, fără nicio adresă de e-mail și cu o politică de confidențialitate care spune ce nu poate face. Web și Android.',
  },

  links: {policy: 'politica de confidențialitate', policyShort: 'Citește-o'},

  nav: {
    different: 'Ce e diferit',
    features: 'Funcții',
    limits: 'Limitări',
    get: 'Descarcă',
    language: 'Limbă',
  },

  hero: {
    eyebrow: 'Web și Android · iOS în lucru',
    title: 'Nu ai unde să fii căutat.',
    lead: `Chatterbox este un messenger criptat integral, fără director de utilizatori. Nimeni nu te poate căuta, pentru că nu există niciun index în care să caute — singura cale într-o conversație este un link pe care îl dai tu cuiva.`,
    primary: 'Descarcă Chatterbox',
    secondary: 'Citește politica de confidențialitate',
    badges: ['Fără director de utilizatori', 'Doar prin invitație', '53 de limbi', 'Gratuit'],
  },

  different: {
    eyebrow: 'Ce e diferit',
    title: 'Șapte lucruri pe care majoritatea messengerelor nu le fac',
    intro: `Fiecare dintre acestea este o decizie cu un mecanism în spate, nu o setare pe care trebuie să o găsești. Unde ceva este un compromis, scrie.`,
    reasons: [
      {
        title: 'Nu există niciun director de utilizatori',
        body: [
          `Nicio căutare după nume de utilizator, nicio potrivire după număr de telefon, niciun „persoane pe care poate le cunoști”. Singura rută într-o conversație este un link de invitație pe care îl trimiți cuiva în afara canalului. Fiecare link funcționează o singură dată și expiră după 24 de ore, iar o sarcină programată șterge cele expirate în loc să lase o evidență permanentă a cine a invitat pe cine.`,
        ],
        note: `Aceasta nu este o setare de confidențialitate. Nu există niciun director din care să te dezabonezi.`,
      },
      {
        title: 'Nu există nicio adresă de e-mail de păstrat',
        body: [
          `Înregistrarea nu îți cere nimic. Contul tău este o frază de recuperare din 24 de cuvinte generată pe dispozitivul tău, iar acreditarea pe care serverul o verifică este derivată din acele cuvinte — ce stochează el este o etichetă aleatorie sub un domeniu care nu poate primi poștă. Documentul profilului tău nu conține nicio adresă de e-mail, niciun nume afișat și nicio adresă de fotografie, deci nu există nici profil pe care altcineva să îl citească.`,
        ],
      },
      {
        title: 'Mai mult decât mesajele este sigilat',
        body: [
          `Textul mesajelor este partea ușoară. Previzualizările linkurilor și locația în timp real sunt criptate către conversație în același fel — o partajare de locație este un flux de coordonate, iar el este sigilat cu cheia celuilalt dispozitiv, ca orice altceva. Atașamentele sunt criptate înainte de a fi încărcate, deci ce deține serverul sunt octeți pe care nu îi poate deschide.`,
        ],
      },
      {
        title: 'Fiecare mesaj are propria cheie',
        body: [
          `Majoritatea conversațiilor unu-la-unu și de grup folosesc un mecanism de tip ratchet, astfel încât compromiterea unui dispozitiv nu expune mesajele care au venit înainte. Conversațiile în care clientul cuiva nu a publicat materialul de cheie mai nou revin la o singură cheie de lungă durată, care nu are această proprietate.`,
        ],
        note: `Eticheta de sub un mesaj îți spune pe care a primit-o de fapt. Nu este o afirmație despre aplicație; este o afirmație despre acel mesaj.`,
      },
      {
        title: `Nicio IA nu îți citește conversațiile`,
        body: [
          `Nu există niciun instrument de rezumare, nicio traducere, nicio transcriere. Nimic din această aplicație nu decriptează o conversație și nu o trimite unei terțe părți pentru procesare, pentru că nicio funcție de aici nu face asta. Sugestiile de răspuns sunt calculate pe dispozitivul tău din ultimele câteva mesaje și nu ajung nicăieri.`,
        ],
        note: `Acele funcții sunt în cod și sunt dezactivate pentru această versiune; sunt menite să revină. Secțiunea 6 a politicii de confidențialitate numește în continuare cele trei servicii pe care le-ar atinge și spune că astăzi nu ajunge nimic la ele. Când vor reveni, vor reveni cu acea dezvăluire și cu o solicitare înainte de prima utilizare.`,
      },
      {
        title: 'Căutarea unui lucru nu se întâmplă pe la spatele tău',
        body: [
          `Apasă pe un nume dintr-un mesaj și Chatterbox îți arată articolul său de pe Wikipedia. Cererea aceea se face la apăsare și altfel deloc, iar nimic despre ea nu se scrie în conversație.`,
        ],
        note: `O versiune anterioară scana ultimele cincisprezece mesaje ale fiecărei discuții pe care o deschideai și interoga Wikipedia de până la treizeci de ori la fiecare deschidere — fără să afișeze nimic, pentru că fișele erau în spatele unui comutator care nu a fost niciodată activat. A fost eliminată, nu reparată.`,
      },
      {
        title: 'Politica de confidențialitate spune ce nu poate face',
        body: [
          `Ea precizează că criptarea nu a fost niciodată auditată independent, că Google poate vedea metadatele fiecărei conexiuni pentru că închiriem serverele lor și că o cheie substituită înainte de primul tău mesaj ar arăta complet normal. Este același text în aplicație și pe acest site, în 53 de limbi — nu un original în engleză cu o traducere mai blândă.`,
        ],
        note: `{policyShort} înainte să decizi să ai încredere în ceva din cele de mai sus.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funcții',
    title: 'Ce face de fapt',
    intro: `Tot ce este listat aici are o interfață la care poți ajunge. Nimic de pe această pagină nu descrie o capacitate care există doar în cod.`,
    cards: [
      {
        title: 'Mesagerie',
        body: `Text, fotografii, video, fișiere și mesaje vocale. Răspunsuri, redirecționare, reacții, confirmări de citire, mesaje fixate, semne de carte și mesaje programate.`,
      },
      {
        title: 'Apeluri vocale și video',
        body: `Apelurile se conectează direct între cele două dispozitive prin WebRTC atunci când este posibil, criptând sunetul și imaginea în mod implicit, nu ca opțiune. Când nu pot — adesea din cauza rețelelor diferite — un releu criptat transportă apelul fără a-l putea decripta.`,
      },
      {
        title: `Sugestii de răspuns`,
        body: `Câteva răspunsuri sugerate, extrase din ultimele mesaje ale conversației. Sunt potrivite pe dispozitivul tău cu o listă de expresii în limba ta — nu se trimite nimic nicăieri pentru a le produce.`,
      },
      {
        title: 'Căutare pe Wikipedia',
        body: `Apasă lung pe un mesaj, alege un nume din el și citește articolul fără să părăsești conversația. O singură cerere, la apăsarea ta, în propria ta limbă.`,
      },
      {
        title: 'Cheia ta, fraza ta de recuperare',
        body: `Cheia privată care decriptează mesajele tale nu părăsește niciodată dispozitivul tău. Poți să o notezi ca frază de recuperare; noi nu o deținem și nu o putem recupera pentru tine.`,
      },
      {
        title: '53 de limbi',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — inclusiv scrierea de la dreapta la stânga.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Controale de confidențialitate',
    title: 'Ce poți restricționa',
    items: [
      {title: 'Blocarea aplicației', body: `Biometrie sau PIN. Se blochează din nou de fiecare dată când ieși din aplicație.`},
      {title: 'Vizualizare unică', body: `Fotografii și videoclipuri care se închid definitiv după ce au fost deschise.`},
      {
        title: 'Mesaje care dispar',
        body: `Setează o conversație să se șteargă singură, de la o oră până la treizeci de zile.`,
      },
      {
        title: 'Distruge după citire',
        body: `Un mesaj care se distruge singur odată ce cealaltă persoană l-a citit.`,
      },
      {
        title: 'Blocare',
        body: `Blochează pe oricine. Fără director, nu pot găsi drumul înapoi.`,
      },
      {
        title: 'Export și ștergere',
        body: `Scoate-ți datele sau șterge contul și tot ce ține de el.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Limitări',
    title: 'Ce nu este protejat',
    intro: `O pagină care listează doar punctele forte este o pagină pe baza căreia nu poți lua o decizie. Aceasta este versiunea scurtă; {policy} este cea lungă.`,
    sealed: {
      title: 'Sigilat pe dispozitivul tău',
      items: [
        'Textul mesajelor tale',
        'Fotografiile, videoclipurile, audio și fișierele pe care le atașezi',
        'Previzualizările linkurilor și locația în timp real',
        'Transcrierile vocale, odată ce se întorc la tine',
        'Audio și video al apelurilor, între cele două dispozitive',
      ],
    },
    visible: {
      title: `Vizibil pentru noi, Google și Cloudflare`,
      items: [
        'Că o conversație există și ce conturi sunt în ea',
        'Când a fost activ ultima dată fiecare cont',
        'Metadatele fiecărei conexiuni, inclusiv adresa ta IP',
        'Că un apel a fost efectuat, către cine și când — nu audio sau video-ul său',
        `Ambele adrese IP, atunci când un apel trebuie redirecționat pentru a se conecta — niciodată sunetul sau imaginea acestuia`,
        'Numele fișierului, tipul și dimensiunea fiecărui atașament pe care îl trimiți',
      ],
    },
    note: `Criptarea nu a fost niciodată auditată independent. Eliminarea acelor metadate este mai grea decât criptarea conținutului, iar acea muncă nu este încheiată.`,
  },

  download: {
    title: 'Descarcă Chatterbox',
    intro: `Aplicația web rulează în browser, fără nimic de instalat. Pe Android, Google Play o menține actualizată; APK-ul de pe acest site este același build, pentru cine preferă să nu folosească magazinul.`,
    introWebOnly: `Aplicația web rulează în browser, fără nimic de instalat, pe telefon la fel de bine ca pe desktop. Build-ul pentru Android este pe drum spre Google Play.`,
    web: 'Deschide aplicația web',
    play: 'Obține din Google Play',
    playPending: 'În curând pe Google Play',
    apk: 'Descarcă APK-ul',
    playNote: `Google Play este ruta recomandată pe Android: actualizează aplicația în fundal și verifică semnătura la fiecare instalare.`,
    androidPendingNote: `Niciuna dintre rutele Android nu este încă activă: listarea pe Play nu este publicată, iar pe acest site nu există nicio descărcare. Aplicația web este calea de intrare până când una dintre ele va fi.`,
    playPendingNote: `Listarea pe Play nu este încă activă. Până atunci, APK-ul este ruta Android — Android îți va cere prima dată să permiți instalări din această sursă, iar el nu se actualizează singur.`,
    apkNote: `APK-ul este semnat cu aceeași cheie ca build-ul din Play, așa că se instalează peste el și îți păstrează datele. Nu se actualizează singur.`,
    iosNote: `iOS nu a fost încă lansat.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Un proiect personal, descris cinstit.',
    privacy: 'Politica de confidențialitate',
  },
};
