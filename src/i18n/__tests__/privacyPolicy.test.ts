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
    expect(policyFor('sv')).toBe(PRIVACY_POLICY.en);
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
    },
    {
      what: 'analytics cannot be switched off',
      en: /cannot currently be switched off individually/,
      'zh-Hans': /还不能单独关闭分析和崩溃上报/,
      'zh-Hant': /還不能單獨關閉分析和當機回報/,
      es: /no se pueden desactivar por separado dentro de la app/,
      fr: /ne peuvent pas encore être désactivés séparément/,
      de: /lassen sich derzeit nicht einzeln in der App abschalten/,
      it: /non si possono disattivare singolarmente dentro l'app/,
      pt: /não podem ser desligados separadamente dentro da app/,
      ru: /пока нельзя отключить по отдельности внутри приложения/,
      tr: /şu an uygulama içinde tek tek kapatılamıyor/,
      vi: /chưa thể tắt riêng lẻ trong ứng dụng/,
      ja: /アプリ内で個別にオフにできません/,
      ko: /앱 안에서 개별적으로 끌 수 없습니다/,
      ar: /لا يمكن حاليًا إيقاف التحليلات وتقارير الأعطال كلٌّ على حدة داخل التطبيق/,
      hi: /अलग-अलग बंद नहीं किया जा सकता/,
    },
  ];

  it.each(admissions.map(a => [a.what, a] as const))('%s', (_what, admission) => {
    for (const code of codes) {
      const all = PRIVACY_POLICY[code].map(s => s.body).join('\n');
      expect(all).toMatch(admission[code]);
    }
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
