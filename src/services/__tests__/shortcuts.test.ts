import {HANDLED_KEYS, matchShortcut, stepChat, type KeyLike} from '../shortcuts';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({key: k, ...mods});

describe('matchShortcut', () => {
  it('maps the same bindings as the web client', () => {
    expect(matchShortcut(key('k', {metaKey: true}))).toBe('search');
    expect(matchShortcut(key('n', {metaKey: true, shiftKey: true}))).toBe('newChat');
    expect(matchShortcut(key('ArrowUp', {altKey: true}))).toBe('prevChat');
    expect(matchShortcut(key('ArrowDown', {altKey: true}))).toBe('nextChat');
    expect(matchShortcut(key('1', {metaKey: true}))).toBe('tabChats');
    expect(matchShortcut(key('4', {metaKey: true}))).toBe('tabProfile');
    expect(matchShortcut(key('?'))).toBe('help');
    expect(matchShortcut(key('Escape'))).toBe('closeOrClear');
  });

  // Cmd+N opens a window and Cmd+W closes one; claiming them would fight the OS.
  it('leaves system chords to macOS', () => {
    expect(matchShortcut(key('n', {metaKey: true}))).toBeNull();
    expect(matchShortcut(key('w', {metaKey: true}))).toBeNull();
    expect(matchShortcut(key('t', {metaKey: true}))).toBeNull();
    expect(matchShortcut(key('q', {metaKey: true}))).toBeNull();
  });

  it('ignores Ctrl, which is not the Mac app modifier', () => {
    expect(matchShortcut(key('k', {ctrlKey: true}))).toBeNull();
  });

  it('suppresses bare keys while typing, so "?" stays a character', () => {
    expect(matchShortcut(key('?'), {typing: true})).toBeNull();
  });

  it('keeps modifier chords and Escape working while typing', () => {
    expect(matchShortcut(key('k', {metaKey: true}), {typing: true})).toBe('search');
    expect(matchShortcut(key('Escape'), {typing: true})).toBe('closeOrClear');
  });
});

describe('HANDLED_KEYS', () => {
  // A key the native view does not claim is handled by AppKit instead — which
  // for an unbound chord means the system alert beep.
  it('claims every chord matchShortcut recognises', () => {
    for (const k of HANDLED_KEYS) {
      expect(matchShortcut(k)).not.toBeNull();
    }
  });

  it('covers each distinct action exactly once', () => {
    const ids = HANDLED_KEYS.map(k => matchShortcut(k));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('help');
    expect(ids).toContain('closeOrClear');
  });
});

describe('stepChat', () => {
  const ids = ['a', 'b', 'c'];

  it('moves and clamps rather than wrapping', () => {
    expect(stepChat(ids, 'a', 1)).toBe('b');
    expect(stepChat(ids, 'c', 1)).toBe('c');
    expect(stepChat(ids, 'a', -1)).toBe('a');
  });

  it('picks a sensible entry point with nothing selected', () => {
    expect(stepChat(ids, null, 1)).toBe('a');
    expect(stepChat(ids, null, -1)).toBe('c');
  });

  it('survives an empty list', () => {
    expect(stepChat([], 'a', 1)).toBeNull();
  });
});
