/**
 * The privacy policy has to say the same thing in every language it ships in.
 *
 * The risk with a translated legal document is not that it is clumsy — it is
 * that it is *softer*. The English admits the app has never been audited, that
 * a key substituted before first contact would look completely normal, and
 * that Google sees the IP of every connection. A translation that loses any of
 * those is a different policy wearing the same title, and the reader with the
 * weaker one has no way to know.
 *
 * Structure is checked mechanically here. Wording is on whoever edits it — but
 * the admissions below are named individually, because those are the sentences
 * a well-meaning translator is most likely to smooth away.
 */
import {LANGUAGES, type OfferedLanguage} from '../languages';
import {
  POLICY_CONTACT_EMAIL,
  POLICY_LAST_UPDATED,
  PRIVACY_POLICY,
  policyFor,
} from '../privacyPolicy';

const codes = Object.keys(PRIVACY_POLICY) as (keyof typeof PRIVACY_POLICY)[];
const bullets = (body: string) => body.split('\n').filter(l => l.startsWith('•'));
const paragraphs = (body: string) => body.split('\n\n');

describe('the policy exists in every language the app offers', () => {
  it('covers exactly the picker, no more and no less', () => {
    // Offering a language is a claim the app speaks it; showing that user an
    // English legal document breaks the claim at the worst possible moment.
    expect(codes.sort()).toEqual(LANGUAGES.map(l => l.code).sort());
  });

  it('resolves a regional tag to its base language', () => {
    // i18next hands back tags like zh-Hans-CN and pt-BR.
    expect(policyFor('zh-Hans-CN')).toBe(PRIVACY_POLICY['zh-Hans']);
    expect(policyFor('pt-BR')).toBe(PRIVACY_POLICY.pt);
    expect(policyFor('en-GB')).toBe(PRIVACY_POLICY.en);
    expect(policyFor(undefined)).toBe(PRIVACY_POLICY.en);
    // A language with no policy still falls back rather than crashing.
    expect(policyFor('xx')).toBe(PRIVACY_POLICY.en);
  });
});

describe('every language has the same structure', () => {
  const english = PRIVACY_POLICY.en;

  it.each(codes.filter(c => c !== 'en'))('%s has the same sections as English', code => {
    expect(PRIVACY_POLICY[code]).toHaveLength(english.length);
  });

  it.each(codes)('%s numbers its sections 0..n in order', code => {
    const numbers = PRIVACY_POLICY[code].map(s => Number(s.title.match(/^(\d+)\./)?.[1]));
    expect(numbers).toEqual(english.map((_, i) => i));
  });

  it.each(codes.filter(c => c !== 'en'))('%s keeps every bullet and paragraph', code => {
    // A translation that merges two bullets into a sentence has dropped a
    // commitment, and it is invisible in review once the languages differ.
    const mismatched = PRIVACY_POLICY[code]
      .map((section, i) => ({
        section: section.title,
        bullets: [bullets(section.body).length, bullets(english[i].body).length],
        paragraphs: [paragraphs(section.body).length, paragraphs(english[i].body).length],
      }))
      .filter(r => r.bullets[0] !== r.bullets[1] || r.paragraphs[0] !== r.paragraphs[1]);
    expect(mismatched).toEqual([]);
  });

  it.each(codes.filter(c => c !== 'en'))('%s is actually translated', code => {
    // A copy-pasted English section passes every structural check above.
    const untranslated = PRIVACY_POLICY[code]
      .map((section, i) => (section.body === english[i].body ? section.title : null))
      .filter(Boolean);
    expect(untranslated).toEqual([]);
  });
});

/**
 * The admissions. Each is something the app would look better without, which
 * is exactly why each is pinned: a translation is allowed to phrase them
 * differently, not to leave them out.
 */
describe('the uncomfortable parts survive translation', () => {
  /**
   * Typed as a full record over the offered languages, so adding a language to
   * the picker without proving these six sentences survived is a compile
   * error — the same guarantee the policy itself has.
   */
  type Admission = {what: string} & Record<OfferedLanguage, RegExp>;

  const admissions: Admission[] = [
    {
      what: 'never independently audited',
      en: /has not been independently security-audited/,
      'zh-Hans': /没有经过独立的第三方安全审计/,
      'zh-Hant': /沒有經過獨立的第三方安全稽核/,
      es: /nunca ha pasado una auditoría de seguridad independiente/,
      fr: /jamais fait l'objet d'un audit de sécurité indépendant/,
      de: /nie unabhängig sicherheitsgeprüft/,
      it: /mai stata sottoposta a un audit di sicurezza indipendente/,
      pt: /nunca passou por uma auditoria de segurança independente/,
      ru: /никогда не проходило независимый аудит безопасности/,
      tr: /hiçbir zaman bağımsız bir güvenlik denetiminden geçmedi/,
      vi: /chưa từng được kiểm định an ninh độc lập/,
      ja: /独立したセキュリティ監査を受けたことがありません/,
      ko: /독립적인 보안 감사를 받은 적이 없습니다/,
      ar: /لم يخضع هذا التطبيق قط لتدقيق أمني مستقل/,
      hi: /कभी कोई स्वतंत्र सुरक्षा ऑडिट नहीं हुआ/,
      fa: /هرگز به‌طور مستقل ممیزی امنیتی نشده است/,
      he: /מעולם לא עברה ביקורת אבטחה עצמאית/,
      ur: /کبھی آزادانہ سیکیورٹی آڈٹ نہیں ہوا/,
      pl: /nigdy nie przeszła niezależnego audytu bezpieczeństwa/,
      uk: /ніколи не проходив незалежного аудиту безпеки/,
      id: /belum pernah diaudit keamanannya secara independen/,
      bn: /কখনো স্বাধীনভাবে নিরাপত্তা নিরীক্ষা করা হয়নি/,
      th: /ไม่เคยผ่านการตรวจสอบความปลอดภัยโดยอิสระ/,
      fil: /hindi pa nasuri sa seguridad ng independiyenteng partido/,
      ms: /belum diaudit keselamatan secara bebas/,
      my: /လွတ်လပ်သော security audit ပြုလုပ်ရသေးခြင်း မရှိပါ/,
      km: /មិនទាន់ត្រូវបានត្រួតពិនិត្យសុវត្ថិភាពដោយឯករាជ្យទេ/,
      lo: /ຍັງບໍ່ໄດ້ຖືກກວດສອບຄວາມປອດໄພຢ່າງເປັນເອກະລາດ/,
      ta: /சுயாதீனமாக பாதுகாப்பு தணிக்கை செய்யப்படவில்லை/,
      te: /స్వతంత్రంగా భద్రతా ఆడిట్ చేయబడలేదు/,
      mr: /स्वतंत्रपणे सुरक्षा ऑडिट केलेले नाही/,
      pa: /ਸੁਤੰਤਰ ਤੌਰ ਉੱਤੇ ਸੁਰੱਖਿਆ-ਆਡਿਟ ਨਹੀਂ ਕੀਤੀ ਗਈ ਹੈ/,
      ne: /स्वतन्त्र रूपमा सुरक्षा-लेखापरीक्षण गरिएको छैन/,
      si: /ස්වාධීනව ආරක්ෂක-විගණනය කර නොමැත/,
      sw: /haijafanyiwa ukaguzi wa usalama wa kujitegemea/,
      ha: /ba a taɓa yin bincike na tsaro mai zaman kanta ba/,
      am: /በገለልተኛ ወገን የደህንነት ኦዲት አልተደረገለትም/,
      nl: /niet onafhankelijk beveiligingsgeaudit/,
      el: /δεν έχει ελεγχθεί ανεξάρτητα για ασφάλεια/,
      sv: /inte oberoende säkerhetsgranskats/,
      da: /ikke blevet uafhængigt sikkerhedstestet/,
      no: /ikke uavhengig sikkerhetsrevidert/,
      cs: /nebyla nezávisle bezpečnostně auditována/,
      ro: /auditată independent din punct de vedere al securității/,
      hu: /nem auditálta függetlenül biztonsági szempontból/,
      kk: /тәуелсіз қауіпсіздік аудитінен өткен жоқ/,
      uz: /mustaqil xavfsizlik auditidan o'tkazilmagan/,
      ka: /დამოუკიდებელი უსაფრთხოების აუდიტს/,
      hy: /անկախ անվտանգության աուդիտի չի ենթարկվել/,
      bo: /རང་བཙན་གྱི་བདེ་སྲུང་ཞིབ་བཤེར་བྱས་མེད/,
      be: /не праходзіла незалежны аўдыт бяспекі/,
      ti: /ብናጻ ኣካል ናይ ውሕስነት መርመራ ኣይተገብረሉን/,
      mn: /бие даасан аюулгүй байдлын аудитад ороогүй/,
    },
    {
      what: 'Google sees every connection',
      en: /Google can see the IP address and timing of every connection/,
      'zh-Hans': /Google 能看到你的设备每一次连接的 IP 地址和时间/,
      'zh-Hant': /Google 能看到你的裝置每一次連線的 IP 位址和時間/,
      es: /la dirección IP y el momento de cada conexión/,
      fr: /l'adresse IP et l'heure de chaque connexion/,
      de: /IP-Adresse und den Zeitpunkt jeder Verbindung/,
      it: /l'indirizzo IP e l'orario di ogni connessione/,
      pt: /o endereço IP e a hora de cada ligação/,
      ru: /IP-адрес и время каждого соединения/,
      tr: /her bağlantının IP adresini ve zamanını/,
      vi: /địa chỉ IP và thời điểm của mọi kết nối/,
      ja: /IP アドレスと時刻を Google は見られます/,
      ko: /모든 연결의 IP 주소와 시각을 Google이 볼 수 있습니다/,
      ar: /عنوان IP وتوقيت كل اتصال/,
      hi: /IP पता और समय Google देख सकता है/,
      fa: /آدرس IP و زمان هر اتصال/,
      he: /כתובת ה-IP והתזמון של כל חיבור/,
      ur: /ہر کنکشن کا IP ایڈریس اور وقت/,
      pl: /adres IP i czas każdego połączenia/,
      uk: /IP-адресу та час кожного з'єднання/,
      id: /alamat IP dan waktu setiap koneksi/,
      bn: /প্রতিটি সংযোগের IP ঠিকানা এবং সময়/,
      th: /ที่อยู่ IP และเวลาของการเชื่อมต่อทุกครั้ง/,
      fil: /IP address at oras ng bawat koneksyon/,
      ms: /alamat IP dan masa setiap sambungan/,
      my: /IP လိပ်စာနှင့် အချိန်ကို မြင်နိုင်သည်/,
      km: /អាសយដ្ឋាន IP និងពេលវេលានៃការតភ្ជាប់នីមួយៗ/,
      lo: /ທີ່ຢູ່ IP ແລະ ເວລາຂອງທຸກການເຊື່ອມຕໍ່/,
      ta: /IP முகவரி மற்றும் நேரத்தையும் Google பார்க்க முடியும்/,
      te: /IP చిరునామా మరియు సమయాన్ని Google చూడగలదు/,
      mr: /IP पत्ता आणि वेळ Google पाहू शकते/,
      pa: /IP ਪਤਾ ਅਤੇ ਸਮਾਂ ਦੇਖ ਸਕਦਾ ਹੈ/,
      ne: /IP ठेगाना र समय देख्न सक्छ/,
      si: /IP ලිපිනය සහ වේලාව Google ට දැක ගත හැක/,
      sw: /anwani ya IP na muda wa kila muunganisho/,
      ha: /adireshin IP da lokacin kowane haɗi/,
      am: /የIP አድራሻ እና ጊዜ ማየት ይችላል/,
      nl: /het IP-adres en de timing zien van elke verbinding/,
      el: /τη διεύθυνση IP και τη χρονική στιγμή κάθε σύνδεσης/,
      sv: /IP-adressen och tidpunkten för varje anslutning/,
      da: /IP-adressen og tidspunktet for hver forbindelse/,
      no: /IP-adressen og tidspunktet for hver tilkobling/,
      cs: /IP adresu a čas každého připojení/,
      ro: /adresa IP și momentul fiecărei conexiuni/,
      hu: /az IP-címet és minden kapcsolat időzítését/,
      kk: /IP мекенжайы мен уақытын көре алады/,
      uz: /IP manzili va vaqtini ko'ra oladi/,
      ka: /IP მისამართი და თითოეული კავშირის დროულობა/,
      hy: /IP հասցեն և ձեր սարքի կողմից նրան կատարվող յուրաքանչյուր կապի ժամանակացույցը/,
      bo: /འབྲེལ་མཐུད་རེ་རེའི་ IP ཁ་བྱང་དང་དུས་ཚོད་ Google་ལ་མཐོང་ཐུབ/,
      be: /Google можа бачыць IP-адрас і час кожнага злучэння/,
      ti: /Google ናይ IP ኣድራሻን ናይ ነፍስወከፍ ርክብ ናይ መሳርሒኻ ግዜን ክርኢ ይኽእል/,
      mn: /IP хаяг, цаг хугацааг харах боломжтой/,
    },
    {
      what: 'a key substituted before first contact is invisible',
      en: /would look entirely normal/,
      'zh-Hans': /看起来完全正常/,
      'zh-Hant': /看起來完全正常/,
      es: /parecería totalmente normal/,
      fr: /paraîtrait tout à fait normale/,
      de: /sähe völlig normal aus/,
      it: /sembrerebbe del tutto normale/,
      pt: /pareceria perfeitamente normal/,
      ru: /выглядел бы совершенно обычно/,
      tr: /tamamen normal görünürdü/,
      vi: /trông vẫn hoàn toàn bình thường/,
      ja: /見た目はまったく普通です/,
      ko: /완전히 정상으로 보입니다/,
      ar: /لبدت طبيعية تمامًا/,
      hi: /पूरी तरह सामान्य दिखती/,
      fa: /کاملاً عادی به‌نظر می‌رسد/,
      he: /נראית לגמרי רגילה/,
      ur: /بالکل عام لگتی/,
      pl: /wyglądałaby zupełnie normalnie/,
      uk: /виглядала б цілком нормально/,
      id: /tampak sepenuhnya normal/,
      bn: /সম্পূর্ণ স্বাভাবিক দেখাবে/,
      th: /ดูเหมือนปกติทุกประการ/,
      fil: /magiging ganap na normal ang itsura/,
      ms: /akan kelihatan sepenuhnya normal/,
      my: /လုံးဝပုံမှန်ကဲ့သို့ ပေါ်လိမ့်မည်/,
      km: /នឹងមើលទៅធម្មតាទាំងស្រុង/,
      lo: /ຈະເບິ່ງຄືປົກກະຕິທຸກຢ່າງ/,
      ta: /முற்றிலும் இயல்பாகத் தோன்றும்/,
      te: /పూర్తిగా సాధారణంగా కనిపిస్తుంది/,
      mr: /पूर्णपणे सामान्य दिसेल/,
      pa: /ਬਿਲਕੁਲ ਸਧਾਰਨ ਦਿਖਾਈ ਦੇਵੇਗੀ/,
      ne: /पूर्णतया सामान्य देखिनेछ/,
      si: /සම්පූර්ණයෙන්ම සාමාන්‍ය ලෙස පෙනෙනු ඇත/,
      sw: /yangeonekana ya kawaida kabisa/,
      ha: /kama da al'ada gaba ɗaya/,
      am: /ሙሉ በሙሉ የተለመደ ይመስላል/,
      nl: /er volkomen normaal uitzien/,
      el: /θα φαινόταν εντελώς φυσιολογική/,
      sv: /se helt normal ut/,
      da: /se helt normal ud/,
      no: /se helt normal ut/,
      cs: /vypadala by naprosto normálně/,
      ro: /ar arăta complet normal/,
      hu: /teljesen normálisnak tűnne/,
      kk: /мүлдем қалыпты көрінеді/,
      uz: /mutlaqo normal ko'rinadi/,
      ka: /სრულიად ნორმალურად გამოიყურებოდა/,
      hy: /կթվար լիովին նորմալ/,
      bo: /ཡོངས་རྫོགས་ཏག་ཏག་འདྲ/,
      be: /выглядала б цалкам звычайна/,
      ti: /ብምሉኡ ንቡር ምመሰለ/,
      mn: /бүрэн хэвийн харагдана/,
    },
    {
      what: 'losing the recovery phrase is final',
      en: /cannot be read again — by anyone, including us/,
      'zh-Hans': /再也读不出来了——任何人都读不出来，包括我们/,
      'zh-Hant': /再也讀不出來了——任何人都讀不出來，包括我們/,
      es: /por nadie, nosotros incluidos/,
      fr: /par personne, nous compris/,
      de: /von niemandem, uns eingeschlossen/,
      it: /da nessuno, noi compresi/,
      pt: /por ninguém, incluindo nós/,
      ru: /больше никто не прочитает, включая нас/,
      tr: /biz dâhil hiç kimse tarafından/,
      vi: /không ai đọc được, kể cả chúng tôi/,
      ja: /私たちを含め、誰にも読めません/,
      ko: /우리를 포함해 누구도 읽을 수 없습니다/,
      ar: /لا من أحد، بمن فينا نحن/,
      hi: /किसी के द्वारा भी नहीं, हमारे द्वारा भी नहीं/,
      fa: /توسط هیچ‌کس، حتی ما/,
      he: /על ידי אף אחד, כולל אנחנו/,
      ur: /کسی کے ذریعے بھی نہیں، ہمارے سمیت/,
      pl: /przez nikogo, łącznie z nami/,
      uk: /нікому, включно з нами/,
      id: /oleh siapa pun, termasuk kami/,
      bn: /কারো দ্বারাই না, আমাদের সহ/,
      th: /โดยใครก็ตาม รวมถึงเราด้วย/,
      fil: /ninuman, kabilang kami/,
      ms: /oleh sesiapa, termasuk kami/,
      my: /ကျွန်ုပ်တို့အပါအဝင် မည်သူမျှ ထပ်မံဖတ်ရှုနိုင်တော့မည်မဟုတ်ပါ/,
      km: /ដោយនរណាម្នាក់ រួមទាំងយើងផងដែរ/,
      lo: /ໂດຍໃຜກໍ່ຕາມ, ລວມທັງພວກເຮົາ/,
      ta: /யாராலும், எங்களை உட்பட/,
      te: /మమ్మల్ని కలుపుకొని ఎవరూ కూడా/,
      mr: /आम्हासह कोणीही/,
      pa: /ਕਿਸੇ ਦੁਆਰਾ ਵੀ, ਸਾਡੇ ਸਮੇਤ/,
      ne: /हामीलगायत कसैले पनि/,
      si: /අප ඇතුළුව කිසිවෙකුට වත්/,
      sw: /na yeyote, ikiwa ni pamoja na sisi/,
      ha: /ta kowa, har da mu/,
      am: /በማንም፣ እኛን ጨምሮ/,
      nl: /door niemand, ons inbegrepen/,
      el: /από κανέναν, συμπεριλαμβανομένων και εμάς/,
      sv: /av någon, inklusive oss/,
      da: /af nogen, os inkluderet/,
      no: /av noen, oss inkludert/,
      cs: /nikým, včetně nás/,
      ro: /de nimeni, inclusiv de noi/,
      hu: /senki által, minket is beleértve/,
      kk: /ешкім, соның ішінде біз де/,
      uz: /hech kim, shu jumladan biz ham/,
      ka: /არავის მიერ, ჩვენს ჩათვლით/,
      hy: /ոչ ոքի կողմից, ներառյալ մեզ/,
      bo: /སླར་ཀློག་མི་ཐུབ། ང་ཚོ་ཡང་ཚུད་ཟིན་པའི་སུ་ལའང་མིན/,
      be: /больш нельга прачытаць — нікому, уключаючы нас/,
      ti: /ደጊሞም ክንበቡ ኣይክእሉን — ብማንም፡ ንሕና ሓዊስና/,
      mn: /дахин унших боломжгүй болно — бид ч гэсэн хэн ч чадахгүй/,
    },
    {
      what: 'the participant list is in the clear',
      en: /Who is in each conversation/,
      'zh-Hans': /每场对话里有谁/,
      'zh-Hant': /每場對話裡有誰/,
      es: /Quién participa en cada conversación/,
      fr: /Qui participe à chaque conversation/,
      de: /Wer an welchem Gespräch beteiligt ist/,
      it: /Chi partecipa a ogni conversazione/,
      pt: /Quem está em cada conversa/,
      ru: /Кто участвует в каждом разговоре/,
      tr: /Her konuşmada kimlerin bulunduğu/,
      vi: /Ai ở trong mỗi cuộc trò chuyện/,
      ja: /それぞれの会話に誰がいるか/,
      ko: /각 대화에 누가 있는지/,
      ar: /من في كل محادثة/,
      hi: /हर बातचीत में कौन है/,
      fa: /چه کسی در هر گفتگوست/,
      he: /מי נמצא בכל שיחה/,
      ur: /ہر گفتگو میں کون ہے/,
      pl: /Kto jest w każdej rozmowie/,
      uk: /Хто перебуває в кожній розмові/,
      id: /Siapa saja yang ada di setiap percakapan/,
      bn: /প্রতিটি কথোপকথনে কে আছে/,
      th: /ใครอยู่ในการสนทนาแต่ละครั้ง/,
      fil: /Sino ang kasama sa bawat pag-uusap/,
      ms: /Siapa yang terlibat dalam setiap perbualan/,
      my: /စကားပြောဆိုမှုတစ်ခုစီတွင် မည်သူပါဝင်သည်/,
      km: /អ្នកណានៅក្នុងការសន្ទនានីមួយៗ/,
      lo: /ໃຜຢູ່ໃນແຕ່ລະການສົນທະນາ/,
      ta: /ஒவ்வொரு உரையாடலிலும் யார் உள்ளனர்/,
      te: /ప్రతి సంభాషణలో ఎవరు ఉన్నారు/,
      mr: /प्रत्येक संभाषणात कोण आहे/,
      pa: /ਹਰੇਕ ਗੱਲਬਾਤ ਵਿੱਚ ਕੌਣ ਹੈ/,
      ne: /प्रत्येक कुराकानीमा को छ/,
      si: /සෑම සංවාදයකම සිටින්නේ කවුරුන්ද/,
      sw: /Nani yuko katika kila mazungumzo/,
      ha: /Wanda ke cikin kowace tattaunawa/,
      am: /በእያንዳንዱ ውይይት ውስጥ ማን እንዳለ/,
      nl: /Wie in elk gesprek zit/,
      el: /Ποιος συμμετέχει σε κάθε συνομιλία/,
      sv: /Vem som är med i varje konversation/,
      da: /Hvem der er i hver samtale/,
      no: /Hvem som er i hver samtale/,
      cs: /Kdo je v každé konverzaci/,
      ro: /Cine este în fiecare conversație/,
      hu: /Ki van benne minden beszélgetésben/,
      kk: /Әр әңгімеде кім бар/,
      uz: /Har bir suhbatda kim borligi/,
      ka: /ვინ არის თითოეულ საუბარში/,
      hy: /Ով է յուրաքանչյուր խոսակցության մեջ/,
      bo: /ཁ་བརྡ་རེ་རེའི་ནང་སུ་ཡོད་པ/,
      be: /Хто ўдзельнічае ў кожнай размове/,
      ti: /መን ኣብ ነፍስወከፍ ዝርርብ ከምዘሎ/,
      mn: /Харилцаа бүрт хэн байгаа/,
    },
  ];

  it.each(admissions.map(a => [a.what, a] as const))('%s', (_what, admission) => {
    for (const code of codes) {
      const all = PRIVACY_POLICY[code].map(s => s.body).join('\n');
      expect(all).toMatch(admission[code]);
    }
  });
});

/**
 * Section 4 used to end by admitting that analytics and crash reporting could
 * not be switched off individually. That admission was in this file's list
 * until Analytics and Crashlytics were removed outright, at which point it
 * became a confession about something that no longer happens.
 *
 * What replaced it is the opposite kind of claim — "there is none" — and the
 * opposite risk. Nobody softens a favourable sentence, but a translator can
 * easily generalise it into "we collect very little", which is vaguer and
 * unfalsifiable. Naming the two products keeps it specific: they do not
 * translate, so their presence is checkable in a language you cannot read.
 */
describe('section 4 names what was removed, in every language', () => {
  it.each(codes)('%s names both products by name', code => {
    const four = PRIVACY_POLICY[code].find(s => s.title.startsWith('4.'));
    expect(four).toBeDefined();
    expect(four!.body).toContain('Firebase Analytics');
    expect(four!.body).toContain('Firebase Crashlytics');
  });
});

/**
 * keyBackup.ts copies the recovery phrase — the whole account — into the
 * platform backup on every sign-in, with no setting to stop it. Section 5 once
 * said the key never left the device; this keeps the disclosure from being
 * dropped by a translation or a rewrite.
 */
describe('section 5 discloses the platform backup of the phrase, in every language', () => {
  it.each(codes)('%s names both backup services', code => {
    const five = PRIVACY_POLICY[code].find(s => s.title.startsWith('5.'));
    expect(five).toBeDefined();
    expect(five!.body).toContain('Google Block Store');
    expect(five!.body).toContain('iCloud Keychain');
  });
});

describe('the details that must not drift', () => {
  it.each(codes)('%s carries the contact address', code => {
    expect(PRIVACY_POLICY[code].map(s => s.body).join('\n')).toContain(POLICY_CONTACT_EMAIL);
  });

  it('has a plausible last-updated date', () => {
    expect(POLICY_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(codes)('%s has no unresolved template placeholders', code => {
    // A ${...} that survived into the string would render literally.
    for (const section of PRIVACY_POLICY[code]) {
      expect(section.body).not.toMatch(/\$\{/);
      expect(section.title).not.toMatch(/\$\{/);
    }
  });
});

/**
 * The website's pages are generated from this file. Regenerating them is a
 * separate command, so this is the thing that stops someone editing the policy,
 * shipping the app, and leaving a website that contradicts it — which is how
 * the previous version went stale in the first place.
 */
describe('the website pages match the policy', () => {
  it('are up to date', () => {
    const {execFileSync} = require('child_process');
    const path = require('path');
    const script = path.join(__dirname, '..', '..', '..', 'scripts', 'build-privacy-html.mjs');
    // Throws with the script's own message, which names the stale files and
    // the command that fixes them.
    execFileSync('node', [script, '--check'], {stdio: 'pipe'});
  });
});
