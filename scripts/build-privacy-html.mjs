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
 */
const CHROME = {
  en:        {lang: 'en',      dir: 'ltr', title: 'Privacy Policy — Chatterbox',        heading: 'Privacy Policy',        updated: 'Last updated',       back: 'Back to Chatterbox',      features: 'Features',    download: 'Download',     native: 'English'},
  'zh-Hans': {lang: 'zh-Hans', dir: 'ltr', title: '隐私政策 — Chatterbox',              heading: '隐私政策',              updated: '最后更新',           back: '返回 Chatterbox',         features: '功能',        download: '下载',         native: '简体中文'},
  'zh-Hant': {lang: 'zh-Hant', dir: 'ltr', title: '隱私政策 — Chatterbox',              heading: '隱私政策',              updated: '最後更新',           back: '返回 Chatterbox',         features: '功能',        download: '下載',         native: '繁體中文'},
  es:        {lang: 'es',      dir: 'ltr', title: 'Política de privacidad — Chatterbox', heading: 'Política de privacidad', updated: 'Última actualización', back: 'Volver a Chatterbox',  features: 'Funciones',   download: 'Descargar',    native: 'Español'},
  fr:        {lang: 'fr',      dir: 'ltr', title: 'Politique de confidentialité — Chatterbox', heading: 'Politique de confidentialité', updated: 'Dernière mise à jour', back: 'Retour à Chatterbox', features: 'Fonctionnalités', download: 'Télécharger', native: 'Français'},
  de:        {lang: 'de',      dir: 'ltr', title: 'Datenschutzerklärung — Chatterbox',  heading: 'Datenschutzerklärung',  updated: 'Zuletzt aktualisiert', back: 'Zurück zu Chatterbox',  features: 'Funktionen',  download: 'Herunterladen', native: 'Deutsch'},
  it:        {lang: 'it',      dir: 'ltr', title: 'Informativa sulla privacy — Chatterbox', heading: 'Informativa sulla privacy', updated: 'Ultimo aggiornamento', back: 'Torna a Chatterbox', features: 'Funzioni',  download: 'Scarica',      native: 'Italiano'},
  pt:        {lang: 'pt',      dir: 'ltr', title: 'Política de Privacidade — Chatterbox', heading: 'Política de Privacidade', updated: 'Última atualização', back: 'Voltar ao Chatterbox', features: 'Funcionalidades', download: 'Transferir', native: 'Português'},
  ru:        {lang: 'ru',      dir: 'ltr', title: 'Политика конфиденциальности — Chatterbox', heading: 'Политика конфиденциальности', updated: 'Последнее обновление', back: 'Назад в Chatterbox', features: 'Возможности', download: 'Скачать',   native: 'Русский'},
  tr:        {lang: 'tr',      dir: 'ltr', title: 'Gizlilik Politikası — Chatterbox',   heading: 'Gizlilik Politikası',   updated: 'Son güncelleme',     back: "Chatterbox'a dön",        features: 'Özellikler',  download: 'İndir',        native: 'Türkçe'},
  vi:        {lang: 'vi',      dir: 'ltr', title: 'Chính sách quyền riêng tư — Chatterbox', heading: 'Chính sách quyền riêng tư', updated: 'Cập nhật lần cuối', back: 'Quay lại Chatterbox', features: 'Tính năng', download: 'Tải xuống',  native: 'Tiếng Việt'},
  ja:        {lang: 'ja',      dir: 'ltr', title: 'プライバシーポリシー — Chatterbox',   heading: 'プライバシーポリシー',   updated: '最終更新',           back: 'Chatterbox に戻る',       features: '機能',        download: 'ダウンロード', native: '日本語'},
  ko:        {lang: 'ko',      dir: 'ltr', title: '개인정보처리방침 — Chatterbox',        heading: '개인정보처리방침',       updated: '최종 업데이트',      back: 'Chatterbox로 돌아가기',   features: '기능',        download: '다운로드',     native: '한국어'},
  ar:        {lang: 'ar',      dir: 'rtl', title: 'سياسة الخصوصية — Chatterbox',        heading: 'سياسة الخصوصية',        updated: 'آخر تحديث',          back: 'العودة إلى Chatterbox',   features: 'المزايا',     download: 'تنزيل',        native: 'العربية'},
  hi:        {lang: 'hi',      dir: 'ltr', title: 'गोपनीयता नीति — Chatterbox',          heading: 'गोपनीयता नीति',          updated: 'आख़िरी अपडेट',        back: 'Chatterbox पर वापस',      features: 'सुविधाएँ',     download: 'डाउनलोड',      native: 'हिन्दी'},
};

/** `privacy.html` for English, `privacy.<code>.html` for the rest. */
const pageName = code => (code === 'en' ? 'privacy.html' : `privacy.${code}.html`);

export function renderPage(code, sections, updated, allCodes) {
  const c = CHROME[code];
  if (!c) throw new Error(`no page furniture for ${code} — add it to CHROME`);
  const body = sections
    .map(s => `    <section>\n      <h2>${escape(s.title)}</h2>\n      ${bodyToHtml(s.body)}\n    </section>`)
    .join('\n\n');
  // Every language links to every other, so a reader who landed on the wrong
  // one is one click away rather than having to guess a filename.
  const switcher = allCodes
    .filter(other => other !== code)
    .map(other => `<a href="${pageName(other)}" lang="${CHROME[other].lang}">${CHROME[other].native}</a>`)
    .join('\n        ');
  return `<!doctype html>
<html lang="${c.lang}" dir="${c.dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${c.title}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%233478F6'/%3E%3Cpath d='M9 12h14M9 16h10M9 20h7' stroke='white' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="backdrop">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
  </div>

  <nav class="nav">
    <div class="nav-inner">
      <a href="index.html" class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M9 8h6M9 12h4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        Chatterbox
      </a>
      <div class="nav-links">
        <a href="index.html#features">${c.features}</a>
        <a href="index.html#download" class="nav-cta">${c.download}</a>
      </div>
    </div>
  </nav>

  <main class="doc">
    <a class="back-link" href="index.html">← ${c.back}</a>
    <h1>${c.heading}</h1>
    <p class="meta">${c.updated}: ${updated}</p>

${body}

    <nav class="doc-langs" aria-label="${c.heading}">
        ${switcher}
    </nav>
  </main>
</body>
</html>
`;
}

export function generate() {
  const {languages, updated} = parsePolicy(readFileSync(SOURCE, 'utf8'));
  const codes = Object.keys(languages);
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
