/**
 * Generates website/privacy.html and website/privacy.zh.html from the app's
 * own policy text (src/i18n/privacyPolicy.ts).
 *
 * The website used to carry its own hand-maintained copy, and it went stale:
 * for months it described a messenger that stored messages in the clear, long
 * after the app had stopped saying that. Two copies of a legal document is one
 * copy plus a liability, so there is now one source and this turns it into
 * pages.
 *
 * Run after editing the policy:  node scripts/build-privacy-html.mjs
 * A test (src/i18n/__tests__/... plus website check) fails if the pages are
 * out of date, so a forgotten run does not ship.
 *
 * Reads the .ts file as text rather than importing it, so this needs no build
 * step and no dependency — the file is plain data.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {SITE_LANGUAGE_CODES, languageMeta} from './site-copy/languages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'src/i18n/privacyPolicy.ts');

const escape = s =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Pulls `title`/`body` pairs out of each language block in the TS source. */
export function parsePolicy(source) {
  const email = source.match(/POLICY_CONTACT_EMAIL = '([^']+)'/)[1];
  const updated = source.match(/POLICY_LAST_UPDATED = '([^']+)'/)[1];
  const table = source.slice(source.indexOf('export const PRIVACY_POLICY'));

  const languages = {};
  const langRe = /^ {2}'?([A-Za-z-]+)'?: \[$/gm;
  let match;
  const starts = [];
  while ((match = langRe.exec(table))) starts.push({code: match[1], at: match.index});
  starts.forEach(({code, at}, i) => {
    const block = table.slice(at, i + 1 < starts.length ? starts[i + 1].at : table.length);
    const sections = [];
    const entryRe = /title: '((?:[^'\\]|\\.)*)',\s*\n\s*body: `([\s\S]*?)`,\s*\n\s*\}/g;
    let entry;
    while ((entry = entryRe.exec(block))) {
      sections.push({
        title: entry[1].replace(/\\'/g, "'"),
        body: entry[2].replace(/\$\{POLICY_CONTACT_EMAIL\}/g, email),
      });
    }
    languages[code] = sections;
  });
  return {languages, updated, email};
}

/** One section's body as HTML: bullet runs become <ul>, the rest <p>. */
function bodyToHtml(body) {
  return body
    .split('\n\n')
    .map(para => {
      const lines = para.split('\n').filter(Boolean);
      if (lines.every(l => l.startsWith('•'))) {
        return `<ul>${lines.map(l => `<li>${escape(l.slice(1).trim())}</li>`).join('')}</ul>`;
      }
      return `<p>${escape(lines.join(' '))}</p>`;
    })
    .join('\n      ');
}

/**
 * The page furniture, per language. Everything else on the page comes from the
 * policy itself, so this is the whole of what has to be written by hand when a
 * language is added — and the generator throws if a language has a policy but
 * no entry here, rather than emitting an English page under a Spanish name.
 *
 * Writing direction and each language's own name are not here: they are facts
 * about the language rather than about this page, and the landing-page
 * generator needs them too, so they live in site-copy/languages.mjs.
 */
const CHROME = {
  en:        {title: 'Privacy Policy — Chatterbox',        heading: 'Privacy Policy',        updated: 'Last updated',       back: 'Back to Chatterbox',      features: 'Features',    download: 'Download'},
  'zh-Hans': {title: '隐私政策 — Chatterbox',              heading: '隐私政策',              updated: '最后更新',           back: '返回 Chatterbox',         features: '功能',        download: '下载'},
  'zh-Hant': {title: '隱私政策 — Chatterbox',              heading: '隱私政策',              updated: '最後更新',           back: '返回 Chatterbox',         features: '功能',        download: '下載'},
  es:        {title: 'Política de privacidad — Chatterbox', heading: 'Política de privacidad', updated: 'Última actualización', back: 'Volver a Chatterbox',  features: 'Funciones',   download: 'Descargar'},
  fr:        {title: 'Politique de confidentialité — Chatterbox', heading: 'Politique de confidentialité', updated: 'Dernière mise à jour', back: 'Retour à Chatterbox', features: 'Fonctionnalités', download: 'Télécharger'},
  de:        {title: 'Datenschutzerklärung — Chatterbox',  heading: 'Datenschutzerklärung',  updated: 'Zuletzt aktualisiert', back: 'Zurück zu Chatterbox',  features: 'Funktionen',  download: 'Herunterladen'},
  it:        {title: 'Informativa sulla privacy — Chatterbox', heading: 'Informativa sulla privacy', updated: 'Ultimo aggiornamento', back: 'Torna a Chatterbox', features: 'Funzioni',  download: 'Scarica'},
  pt:        {title: 'Política de Privacidade — Chatterbox', heading: 'Política de Privacidade', updated: 'Última atualização', back: 'Voltar ao Chatterbox', features: 'Funcionalidades', download: 'Transferir'},
  ru:        {title: 'Политика конфиденциальности — Chatterbox', heading: 'Политика конфиденциальности', updated: 'Последнее обновление', back: 'Назад в Chatterbox', features: 'Возможности', download: 'Скачать'},
  tr:        {title: 'Gizlilik Politikası — Chatterbox',   heading: 'Gizlilik Politikası',   updated: 'Son güncelleme',     back: "Chatterbox'a dön",        features: 'Özellikler',  download: 'İndir'},
  vi:        {title: 'Chính sách quyền riêng tư — Chatterbox', heading: 'Chính sách quyền riêng tư', updated: 'Cập nhật lần cuối', back: 'Quay lại Chatterbox', features: 'Tính năng', download: 'Tải xuống'},
  ja:        {title: 'プライバシーポリシー — Chatterbox',   heading: 'プライバシーポリシー',   updated: '最終更新',           back: 'Chatterbox に戻る',       features: '機能',        download: 'ダウンロード'},
  ko:        {title: '개인정보처리방침 — Chatterbox',        heading: '개인정보처리방침',       updated: '최종 업데이트',      back: 'Chatterbox로 돌아가기',   features: '기능',        download: '다운로드'},
  ar:        {title: 'سياسة الخصوصية — Chatterbox',        heading: 'سياسة الخصوصية',        updated: 'آخر تحديث',          back: 'العودة إلى Chatterbox',   features: 'المزايا',     download: 'تنزيل'},
  hi:        {title: 'गोपनीयता नीति — Chatterbox',          heading: 'गोपनीयता नीति',          updated: 'आख़िरी अपडेट',        back: 'Chatterbox पर वापस',      features: 'सुविधाएँ',     download: 'डाउनलोड'},
  fa:        {title: 'سیاست حریم خصوصی — Chatterbox',       heading: 'سیاست حریم خصوصی',       updated: 'آخرین به‌روزرسانی',   back: 'بازگشت به Chatterbox',    features: 'ویژگی‌ها',    download: 'دریافت'},
  he:        {title: 'מדיניות הפרטיות — Chatterbox',        heading: 'מדיניות הפרטיות',        updated: 'עודכן לאחרונה',       back: 'חזרה ל-Chatterbox',       features: 'תכונות',      download: 'הורדה'},
  ur:        {title: 'پرائیویسی پالیسی — Chatterbox',       heading: 'پرائیویسی پالیسی',       updated: 'آخری بار اپ ڈیٹ کیا گیا', back: 'Chatterbox پر واپس',  features: 'خصوصیات',    download: 'ڈاؤن لوڈ'},
  pl:        {title: 'Polityka prywatności — Chatterbox',   heading: 'Polityka prywatności',   updated: 'Ostatnia aktualizacja', back: 'Powrót do Chatterbox', features: 'Funkcje',    download: 'Pobierz'},
  uk:        {title: 'Політика конфіденційності — Chatterbox', heading: 'Політика конфіденційності', updated: 'Востаннє оновлено', back: 'Повернутися до Chatterbox', features: 'Функції', download: 'Завантажити'},
  id:        {title: 'Kebijakan Privasi — Chatterbox',      heading: 'Kebijakan Privasi',      updated: 'Terakhir diperbarui', back: 'Kembali ke Chatterbox',  features: 'Fitur',       download: 'Unduh'},
  bn:        {title: 'গোপনীয়তা নীতি — Chatterbox',          heading: 'গোপনীয়তা নীতি',          updated: 'সর্বশেষ আপডেট',       back: 'Chatterbox-এ ফিরে যান',   features: 'ফিচার',      download: 'ডাউনলোড'},
  th:        {title: 'นโยบายความเป็นส่วนตัว — Chatterbox',   heading: 'นโยบายความเป็นส่วนตัว',   updated: 'อัปเดตล่าสุด',        back: 'กลับไปที่ Chatterbox',    features: 'ฟีเจอร์',     download: 'ดาวน์โหลด'},
  fil:       {title: 'Patakaran sa Privacy — Chatterbox', heading: 'Patakaran sa Privacy', updated: 'Huling na-update', back: 'Bumalik sa Chatterbox', features: 'Mga Feature', download: 'I-download'},
  ms:        {title: 'Dasar Privasi — Chatterbox',        heading: 'Dasar Privasi',        updated: 'Terakhir dikemas kini', back: 'Kembali ke Chatterbox', features: 'Ciri-ciri', download: 'Muat turun'},
  my:        {title: 'ကိုယ်ရေးကိုယ်တာမူဝါဒ — Chatterbox', heading: 'ကိုယ်ရေးကိုယ်တာမူဝါဒ', updated: 'နောက်ဆုံးအပ်ဒိတ်လုပ်ခဲ့သည်', back: 'Chatterbox သို့ ပြန်သွားရန်', features: 'အင်္ဂါရပ်များ', download: 'ဒေါင်းလုဒ်'},
  km:        {title: 'គោលការណ៍ភាពឯកជន — Chatterbox',      heading: 'គោលការណ៍ភាពឯកជន',      updated: 'ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ', back: 'ត្រឡប់ទៅ Chatterbox', features: 'លក្ខណៈពិសេស', download: 'ទាញយក'},
  lo:        {title: 'ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ — Chatterbox', heading: 'ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ', updated: 'ອັບເດດຫຼ້າສຸດ', back: 'ກັບໄປ Chatterbox', features: 'ຄຸນສົມບັດ', download: 'ດາວໂຫຼດ'},
  ta:        {title: 'தனியுரிமைக் கொள்கை — Chatterbox',    heading: 'தனியுரிமைக் கொள்கை',    updated: 'கடைசியாக புதுப்பிக்கப்பட்டது', back: 'Chatterbox-க்குத் திரும்பு', features: 'அம்சங்கள்', download: 'பதிவிறக்கு'},
  te:        {title: 'గోప్యతా విధానం — Chatterbox',        heading: 'గోప్యతా విధానం',        updated: 'చివరిగా నవీకరించబడింది', back: 'Chatterbox‌కు తిరిగి వెళ్ళండి', features: 'ఫీచర్లు', download: 'డౌన్‌లోడ్'},
  mr:        {title: 'गोपनीयता धोरण — Chatterbox',          heading: 'गोपनीयता धोरण',          updated: 'शेवटचे अद्यतनित', back: 'Chatterbox वर परत जा', features: 'वैशिष्ट्ये', download: 'डाउनलोड करा'},
  pa:        {title: 'ਪਰਦੇਦਾਰੀ ਨੀਤੀ — Chatterbox',          heading: 'ਪਰਦੇਦਾਰੀ ਨੀਤੀ',          updated: 'ਆਖਰੀ ਵਾਰ ਅੱਪਡੇਟ ਕੀਤਾ', back: "Chatterbox 'ਤੇ ਵਾਪਸ ਜਾਓ", features: 'ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ', download: 'ਡਾਊਨਲੋਡ'},
  ne:        {title: 'गोपनीयता नीति — Chatterbox',          heading: 'गोपनीयता नीति',          updated: 'पछिल्लो अपडेट', back: 'Chatterbox मा फर्कनुहोस्', features: 'सुविधाहरू', download: 'डाउनलोड'},
  si:        {title: 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය — Chatterbox', heading: 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය', updated: 'අවසන් වරට යාවත්කාලීන කළේ', back: 'Chatterbox වෙත ආපසු', features: 'විශේෂාංග', download: 'බාගන්න'},
  sw:        {title: 'Sera ya Faragha — Chatterbox',       heading: 'Sera ya Faragha',       updated: 'Ilisasishwa mwisho', back: 'Rudi kwa Chatterbox', features: 'Vipengele', download: 'Pakua'},
  ha:        {title: 'Manufar Sirri — Chatterbox',         heading: 'Manufar Sirri',         updated: 'An sabunta na ƙarshe', back: 'Koma zuwa Chatterbox', features: 'Fasaloli', download: 'Sauke'},
  am:        {title: 'የግላዊነት ፖሊሲ — Chatterbox',            heading: 'የግላዊነት ፖሊሲ',            updated: 'መጨረሻ የተዘመነው', back: 'ወደ Chatterbox ተመለስ', features: 'ባህሪያት', download: 'አውርድ'},
  nl:        {title: 'Privacybeleid — Chatterbox',         heading: 'Privacybeleid',         updated: 'Laatst bijgewerkt', back: 'Terug naar Chatterbox', features: 'Functies', download: 'Downloaden'},
  el:        {title: 'Πολιτική Απορρήτου — Chatterbox',    heading: 'Πολιτική Απορρήτου',    updated: 'Τελευταία ενημέρωση', back: 'Επιστροφή στο Chatterbox', features: 'Δυνατότητες', download: 'Λήψη'},
  sv:        {title: 'Integritetspolicy — Chatterbox',     heading: 'Integritetspolicy',     updated: 'Senast uppdaterad', back: 'Tillbaka till Chatterbox', features: 'Funktioner', download: 'Ladda ner'},
  da:        {title: 'Privatlivspolitik — Chatterbox',     heading: 'Privatlivspolitik',     updated: 'Sidst opdateret', back: 'Tilbage til Chatterbox', features: 'Funktioner', download: 'Download'},
  no:        {title: 'Personvernerklæring — Chatterbox',   heading: 'Personvernerklæring',   updated: 'Sist oppdatert', back: 'Tilbake til Chatterbox', features: 'Funksjoner', download: 'Last ned'},
  cs:        {title: 'Zásady ochrany osobních údajů — Chatterbox', heading: 'Zásady ochrany osobních údajů', updated: 'Naposledy aktualizováno', back: 'Zpět na Chatterbox', features: 'Funkce', download: 'Stáhnout'},
  ro:        {title: 'Politica de confidențialitate — Chatterbox', heading: 'Politica de confidențialitate', updated: 'Ultima actualizare', back: 'Înapoi la Chatterbox', features: 'Funcții', download: 'Descarcă'},
  hu:        {title: 'Adatvédelmi irányelvek — Chatterbox', heading: 'Adatvédelmi irányelvek', updated: 'Utoljára frissítve', back: 'Vissza a Chatterboxhoz', features: 'Funkciók', download: 'Letöltés'},
  kk:        {title: 'Құпиялық саясаты — Chatterbox',       heading: 'Құпиялық саясаты',       updated: 'Соңғы жаңарту', back: 'Chatterbox-қа оралу', features: 'Мүмкіндіктер', download: 'Жүктеп алу'},
  uz:        {title: 'Maxfiylik siyosati — Chatterbox',     heading: 'Maxfiylik siyosati',     updated: 'Oxirgi yangilanish', back: 'Chatterbox-ga qaytish', features: 'Xususiyatlar', download: 'Yuklab olish'},
  ka:        {title: 'კონფიდენციალურობის პოლიტიკა — Chatterbox', heading: 'კონფიდენციალურობის პოლიტიკა', updated: 'ბოლოს განახლდა', back: 'დაბრუნება Chatterbox-ზე', features: 'ფუნქციები', download: 'ჩამოტვირთვა'},
  hy:        {title: 'Գաղտնիության քաղաքականություն — Chatterbox', heading: 'Գաղտնիության քաղաքականություն', updated: 'Վերջին անգամ թարմացվել է', back: 'Վերադառնալ Chatterbox', features: 'Հնարավորություններ', download: 'Ներբեռնել'},
  bo:        {title: 'སྒེར་གྱི་གནས་ཚུལ་སྲིད་བྱུས། — Chatterbox', heading: 'སྒེར་གྱི་གནས་ཚུལ་སྲིད་བྱུས།', updated: 'མཐའ་མའི་གསར་སྒྱུར།', back: 'Chatterbox ལ་ཕྱིར་ལོག', features: 'ཁྱད་ཆོས།', download: 'ཕབ་ལེན།'},
  be:        {title: 'Палітыка прыватнасці — Chatterbox', heading: 'Палітыка прыватнасці', updated: 'Апошняе абнаўленне', back: 'Назад да Chatterbox', features: 'Функцыі', download: 'Спампаваць'},
  ti:        {title: 'ፖሊሲ ውልቃውነት — Chatterbox', heading: 'ፖሊሲ ውልቃውነት', updated: 'ናይ መወዳእታ ዝተሓደሰሉ', back: 'ናብ Chatterbox ተመለስ', features: 'ባህርያት', download: 'ኣውርድ'},
  mn:        {title: 'Нууцлалын бодлого — Chatterbox', heading: 'Нууцлалын бодлого', updated: 'Сүүлд шинэчилсэн', back: 'Chatterbox руу буцах', features: 'Онцлогууд', download: 'Татах'},
};

/** `privacy.html` for English, `privacy.<code>.html` for the rest. */
const pageName = code => (code === 'en' ? 'privacy.html' : `privacy.${code}.html`);

/** `index.html` for English, `index.<code>.html` for the rest. */
const homeName = code => (code === 'en' ? 'index.html' : `index.${code}.html`);

/**
 * What a link points at, as opposed to what the file is called — Firebase
 * Hosting runs with `cleanUrls: true`, so the `.html` form 301s to this one.
 * See the same pair in build-site-html.mjs.
 */
const pageHref = code => (code === 'en' ? 'privacy' : `privacy.${code}`);
const homeHref = code => (code === 'en' ? './' : `index.${code}`);

export function renderPage(code, sections, updated, allCodes) {
  const c = CHROME[code];
  if (!c) throw new Error(`no page furniture for ${code} — add it to CHROME`);
  const meta = languageMeta(code);
  const body = sections
    .map(s => `    <section>\n      <h2>${escape(s.title)}</h2>\n      ${bodyToHtml(s.body)}\n    </section>`)
    .join('\n\n');
  // Every language is listed and the current one is marked rather than
  // missing, so the row does not reflow as you move between languages.
  const switcher = allCodes
    .map(other =>
      other === code
        ? `<span aria-current="true" lang="${languageMeta(other).lang}">${languageMeta(other).native}</span>`
        : `<a href="${pageHref(other)}" lang="${languageMeta(other).lang}" hreflang="${languageMeta(other).lang}">${languageMeta(other).native}</a>`,
    )
    .join('\n        ');
  // Search engines need to be told these are the same document; readers need
  // the nav to keep them in the language they arrived in.
  const alternates = allCodes
    .map(
      other =>
        `  <link rel="alternate" hreflang="${languageMeta(other).lang}" href="${pageHref(other)}" />`,
    )
    .concat('  <link rel="alternate" hreflang="x-default" href="privacy" />')
    .join('\n');

  return `<!doctype html>
<html lang="${meta.lang}" dir="${meta.dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${c.title}</title>
  <link rel="icon" type="image/svg+xml" href="assets/icon.svg" />
${alternates}
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="backdrop">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
  </div>

  <nav class="nav">
    <div class="nav-inner">
      <a href="${homeHref(code)}" class="brand">
        <img class="brand-mark" src="assets/icon.svg" alt="" width="28" height="28" />
        Chatterbox
      </a>
      <div class="nav-links">
        <a href="${homeHref(code)}#features">${c.features}</a>
        <a href="${homeHref(code)}#download" class="nav-cta">${c.download}</a>
      </div>
    </div>
  </nav>

  <main class="doc">
    <a class="back-link" href="${homeHref(code)}">← ${c.back}</a>
    <h1>${c.heading}</h1>
    <p class="meta">${c.updated}: ${updated}</p>

${body}

    <nav class="site-langs" aria-label="${c.heading}">
        ${switcher}
    </nav>
  </main>
</body>
</html>
`;
}

export function generate() {
  const {languages, updated} = parsePolicy(readFileSync(SOURCE, 'utf8'));
  // Ordered by the shared list rather than by where they sit in the TS file,
  // so the switcher reads the same here as on the landing pages.
  const codes = SITE_LANGUAGE_CODES.filter(code => languages[code]);
  const missing = Object.keys(languages).filter(code => !codes.includes(code));
  if (missing.length) {
    throw new Error(
      `policy languages missing from site-copy/languages.mjs: ${missing.join(', ')}`,
    );
  }
  const pages = {};
  for (const code of codes) {
    pages[`website/${pageName(code)}`] = renderPage(code, languages[code], updated, codes);
  }
  return pages;
}

if (process.argv[1] && process.argv[1].endsWith('build-privacy-html.mjs')) {
  const pages = generate();
  // `--check` verifies without writing, so a forgotten run fails a test rather
  // than shipping a website that contradicts the app.
  if (process.argv.includes('--check')) {
    const stale = Object.entries(pages).filter(([path, html]) => {
      try {
        return readFileSync(join(ROOT, path), 'utf8') !== html;
      } catch {
        return true;
      }
    });
    if (stale.length) {
      console.error(
        'website privacy pages are out of date with src/i18n/privacyPolicy.ts:\n  ' +
          stale.map(([p]) => p).join('\n  ') +
          '\nRun: node scripts/build-privacy-html.mjs',
      );
      process.exit(1);
    }
    console.log('website privacy pages are up to date');
  } else {
    for (const [path, html] of Object.entries(pages)) {
      writeFileSync(join(ROOT, path), html);
      console.log(`wrote ${path}`);
    }
  }
}
