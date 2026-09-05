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
import {LANGUAGES} from '../languages';
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
    // i18next hands back tags like zh-Hans-CN.
    expect(policyFor('zh-Hans-CN')).toBe(PRIVACY_POLICY['zh-Hans']);
    expect(policyFor('en-GB')).toBe(PRIVACY_POLICY.en);
    expect(policyFor(undefined)).toBe(PRIVACY_POLICY.en);
    expect(policyFor('de')).toBe(PRIVACY_POLICY.en);
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
  const admissions: {what: string; en: RegExp; 'zh-Hans': RegExp}[] = [
    {
      what: 'never independently audited',
      en: /has not been independently security-audited/,
      'zh-Hans': /没有经过独立的第三方安全审计/,
    },
    {
      what: 'Google sees every connection',
      en: /Google can see the IP address and timing of every connection/,
      'zh-Hans': /Google 能看到你的设备每一次连接的 IP 地址和时间/,
    },
    {
      what: 'a key substituted before first contact is invisible',
      en: /would look entirely normal/,
      'zh-Hans': /看起来完全正常/,
    },
    {
      what: 'losing the recovery phrase is final',
      en: /cannot be read again — by anyone, including us/,
      'zh-Hans': /再也读不出来了——任何人都读不出来，包括我们/,
    },
    {
      what: 'the participant list is in the clear',
      en: /Who is in each conversation/,
      'zh-Hans': /每场对话里有谁/,
    },
    {
      what: 'analytics cannot be switched off',
      en: /cannot currently be switched off individually/,
      'zh-Hans': /还不能单独关闭分析和崩溃上报/,
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
