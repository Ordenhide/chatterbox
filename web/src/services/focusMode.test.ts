import {describe, expect, it} from 'vitest';
import {isFocusActive} from './focusMode';

const NOW = 1_700_000_000_000;

describe('isFocusActive', () => {
  it('is off when there is no focusMode block at all', () => {
    expect(isFocusActive(undefined, NOW)).toBe(false);
    expect(isFocusActive(null, NOW)).toBe(false);
  });

  it('is off when explicitly disabled', () => {
    expect(isFocusActive({enabled: false, until: NOW + 60_000}, NOW)).toBe(false);
  });

  it('is on before the deadline', () => {
    expect(isFocusActive({enabled: true, until: NOW + 60_000}, NOW)).toBe(true);
  });

  // The server only clears `enabled` when a message arrives, so a document can
  // sit reading enabled:true long past its deadline. Trusting the flag alone
  // would show "focus mode on" for hours after it actually ended.
  it('is off past the deadline even though the stored flag still says enabled', () => {
    expect(isFocusActive({enabled: true, until: NOW - 1}, NOW)).toBe(false);
  });

  it('treats a missing deadline as indefinite rather than expired', () => {
    expect(isFocusActive({enabled: true}, NOW)).toBe(true);
  });
});
