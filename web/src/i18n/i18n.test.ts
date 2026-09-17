import {describe, expect, it} from 'vitest';
import {_dicts, LANGUAGES} from './index';

const en = _dicts.en;
const enKeys = Object.keys(en);

/**
 * Offering a language in the picker is a claim that the app speaks it.
 * `t()` falls back to English for a missing key, so an incomplete
 * translation never breaks — which is exactly why it can rot unnoticed.
 * Mirrors src/i18n/__tests__/languageCompleteness.test.ts on mobile.
 */
const OFFERED_MIN_COMPLETENESS = 0.9;

describe('i18n dictionaries', () => {
  it('has no orphan keys (every key in every dictionary exists in en)', () => {
    for (const {code} of LANGUAGES) {
      if (code === 'en') continue;
      const orphans = Object.keys(_dicts[code]).filter(k => !enKeys.includes(k));
      expect({code, orphans}).toEqual({code, orphans: []});
    }
  });

  it('translates common navigation keys to Simplified Chinese', () => {
    expect(_dicts['zh-Hans']['nav.chats']).toBe('聊天');
    expect(_dicts['zh-Hans']['nav.profile']).toBe('我的');
  });

  it.each(LANGUAGES.map(l => [l.code, l.nativeLabel] as const))(
    '%s (%s) is complete enough to offer',
    code => {
      const dict = _dicts[code];
      const present = enKeys.filter(k => k in dict).length;
      const ratio = present / enKeys.length;
      expect({
        code,
        completeness: `${(ratio * 100).toFixed(1)}%`,
        missing: enKeys.filter(k => !(k in dict)).length,
      }).toEqual({
        code,
        completeness: expect.stringMatching(/./),
        missing: expect.any(Number),
      });
      expect(ratio).toBeGreaterThanOrEqual(code === 'en' ? 1 : OFFERED_MIN_COMPLETENESS);
    },
  );

  it('offers English, which is the fallback everything else leans on', () => {
    expect(LANGUAGES.map(l => l.code)).toContain('en');
  });

  it('has no duplicate entries', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has a dictionary for every offered language', () => {
    for (const {code} of LANGUAGES) {
      expect(_dicts[code]).toBeDefined();
    }
  });

  /**
   * A translated string that drops a `{placeholder}` renders the literal
   * sentence with a hole in it, and nothing here would otherwise notice —
   * the key is present, so the completeness check above passes.
   */
  it.each(LANGUAGES.filter(l => l.code !== 'en').map(l => [l.code, l.nativeLabel] as const))(
    '%s (%s) keeps every placeholder the English string has',
    code => {
      const dict = _dicts[code];
      const slots = (s: unknown) =>
        typeof s === 'string' ? [...new Set(s.match(/\{\w+\}/g) ?? [])].sort() : [];
      const wrong = enKeys
        .filter(k => k in dict)
        .map(k => ({key: k, en: slots(en[k as keyof typeof en]), translated: slots(dict[k as keyof typeof dict])}))
        .filter(r => r.en.join() !== r.translated.join());
      expect(wrong).toEqual([]);
    },
  );
});
