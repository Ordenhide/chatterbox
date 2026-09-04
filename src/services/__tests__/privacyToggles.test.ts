import fs from 'fs';
import path from 'path';

const store: Record<string, boolean | undefined> = {};
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getBoolean: (k: string) => mockStore[k],
    setBoolean: (k: string, v: boolean) => {
      mockStore[k] = v;
    },
    getNumber: () => undefined,
    setNumber: jest.fn(),
  },
}));
jest.mock('../firebase/firestore', () => ({
  doc: jest.fn(), getDoc: jest.fn(), getFirestore: jest.fn(), setDoc: jest.fn(),
}));
jest.mock('../telemetry', () => ({reportHandled: jest.fn()}));
jest.mock('react-native', () => ({Platform: {OS: 'android'}, NativeModules: {}}));

const mockStore = store;

import {PRIVACY_TOGGLES} from '../privacyToggles';

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('PRIVACY_TOGGLES', () => {
  it('round-trips every switch through the store', () => {
    for (const toggle of PRIVACY_TOGGLES) {
      const before = toggle.read();
      toggle.write(!before);
      expect(toggle.read()).toBe(!before);
      toggle.write(before);
      expect(toggle.read()).toBe(before);
    }
  });

  it('gives every switch a distinct key', () => {
    const keys = PRIVACY_TOGGLES.map(x => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * The property this table exists for.
   *
   * ChatScreen used to show "Screenshot protection active" from a stored flag
   * while the code that sets FLAG_SECURE had no callers — a claim with nothing
   * behind it. privacyGuard still holds watermark, auto-lock and
   * screenshot-alert flags that nothing reads. A switch for one of those would
   * be the same bug in a new place: a control that moves, persists, and
   * changes nothing about the app.
   *
   * So: every switch offered must have its reader called somewhere that is not
   * privacyGuard itself, this table, or a test.
   */
  it('offers no switch whose value nothing reads', () => {
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          if (full.endsWith('privacyGuard.ts') || full.endsWith('privacyToggles.ts')) continue;
          sources.push(fs.readFileSync(full, 'utf8'));
        }
      }
    };
    walk(path.join(__dirname, '..', '..'));

    const unread = PRIVACY_TOGGLES.filter(toggle => {
      const reader = toggle.read.name;
      // The import line alone does not count — ChatScreen imported
      // generateWatermark for a long time and never called it.
      const called = new RegExp(`\\b${reader}\\s*\\(`);
      return !sources.some(src => called.test(src));
    }).map(t => `${t.key} (${t.read.name})`);

    expect(unread).toEqual([]);
  });
});
