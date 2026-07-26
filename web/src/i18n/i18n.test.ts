import {describe, expect, it} from 'vitest';
import {_dicts} from './index';

describe('i18n dictionaries', () => {
  it('has no orphan Simplified Chinese keys (every zh key exists in en)', () => {
    const enKeys = new Set(Object.keys(_dicts.en));
    const orphans = Object.keys(_dicts.zh).filter(k => !enKeys.has(k));
    expect(orphans).toEqual([]);
  });

  it('translates common navigation keys to Chinese', () => {
    expect(_dicts.zh['nav.chats']).toBe('聊天');
    expect(_dicts.zh['nav.moments']).toBe('动态');
    expect(_dicts.zh['nav.profile']).toBe('我的');
  });

  it('covers the majority of English keys in Chinese', () => {
    const enCount = Object.keys(_dicts.en).length;
    const zhCount = Object.keys(_dicts.zh).length;
    expect(zhCount / enCount).toBeGreaterThan(0.9);
  });
});
