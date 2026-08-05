import {describe, expect, it} from 'vitest';
import {
  isTypingTarget,
  matchShortcut,
  modifierLabel,
  stepChat,
  type KeyLike,
} from './shortcuts';

const mac = {typing: false, apple: true};
const pc = {typing: false, apple: false};
const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({key: k, ...mods});

describe('platform modifier', () => {
  it('uses Cmd on Apple and Ctrl elsewhere', () => {
    expect(matchShortcut(key('k', {metaKey: true}), mac)).toBe('search');
    expect(matchShortcut(key('k', {ctrlKey: true}), pc)).toBe('search');
  });

  // Accepting both everywhere would mean Ctrl+K on a Mac shadowing the
  // system's "delete to end of line" inside every text field.
  it('does not accept the other platform’s modifier', () => {
    expect(matchShortcut(key('k', {ctrlKey: true}), mac)).toBeNull();
    expect(matchShortcut(key('k', {metaKey: true}), pc)).toBeNull();
  });

  it('labels the modifier for the help overlay', () => {
    expect(modifierLabel(true)).toBe('⌘');
    expect(modifierLabel(false)).toBe('Ctrl');
  });
});

describe('bindings', () => {
  it('maps the documented set', () => {
    expect(matchShortcut(key('k', {metaKey: true}), mac)).toBe('search');
    expect(matchShortcut(key('n', {metaKey: true, shiftKey: true}), mac)).toBe('newChat');
    expect(matchShortcut(key('ArrowUp', {altKey: true}), mac)).toBe('prevChat');
    expect(matchShortcut(key('ArrowDown', {altKey: true}), mac)).toBe('nextChat');
    expect(matchShortcut(key('1', {metaKey: true}), mac)).toBe('tabChats');
    expect(matchShortcut(key('4', {metaKey: true}), mac)).toBe('tabProfile');
    expect(matchShortcut(key('?'), mac)).toBe('help');
    expect(matchShortcut(key('Escape'), mac)).toBe('closeOrClear');
  });

  // Ctrl+N opens a browser window and Ctrl+T a tab — a shortcut the browser
  // eats first looks broken rather than absent.
  it('does not claim combinations the browser owns', () => {
    expect(matchShortcut(key('n', {metaKey: true}), mac)).toBeNull();
    expect(matchShortcut(key('t', {metaKey: true}), mac)).toBeNull();
    expect(matchShortcut(key('w', {metaKey: true}), mac)).toBeNull();
    expect(matchShortcut(key('f', {metaKey: true}), mac)).toBeNull();
  });

  it('ignores plain keys that are not bound', () => {
    expect(matchShortcut(key('a'), mac)).toBeNull();
    expect(matchShortcut(key('Enter'), mac)).toBeNull();
    expect(matchShortcut(key('ArrowUp'), mac)).toBeNull();
  });
});

describe('typing safety', () => {
  // Typing "?" mid-sentence must produce a "?", not open the help overlay.
  it('suppresses bare-key shortcuts while typing', () => {
    expect(matchShortcut(key('?'), {typing: true, apple: true})).toBeNull();
  });

  it('keeps modifier shortcuts working while typing, so the composer is not a trap', () => {
    expect(matchShortcut(key('k', {metaKey: true}), {typing: true, apple: true})).toBe('search');
    expect(matchShortcut(key('1', {metaKey: true}), {typing: true, apple: true})).toBe('tabChats');
  });

  it('always allows Escape, including mid-typing', () => {
    expect(matchShortcut(key('Escape'), {typing: true, apple: true})).toBe('closeOrClear');
  });

  it('recognises text fields', () => {
    expect(isTypingTarget({tagName: 'INPUT'})).toBe(true);
    expect(isTypingTarget({tagName: 'textarea'})).toBe(true);
    expect(isTypingTarget({tagName: 'SELECT'})).toBe(true);
    expect(isTypingTarget({tagName: 'DIV', isContentEditable: true})).toBe(true);
    expect(isTypingTarget({tagName: 'DIV'})).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });
});

describe('stepChat', () => {
  const ids = ['a', 'b', 'c'];

  it('moves through the list', () => {
    expect(stepChat(ids, 'a', 1)).toBe('b');
    expect(stepChat(ids, 'b', -1)).toBe('a');
  });

  // Wrapping is disorienting when holding the key to scan a list.
  it('clamps at both ends rather than wrapping', () => {
    expect(stepChat(ids, 'c', 1)).toBe('c');
    expect(stepChat(ids, 'a', -1)).toBe('a');
  });

  it('opens a sensible chat when none is selected', () => {
    expect(stepChat(ids, null, 1)).toBe('a');
    expect(stepChat(ids, null, -1)).toBe('c');
  });

  it('handles an unknown current id and an empty list', () => {
    expect(stepChat(ids, 'missing', 1)).toBe('a');
    expect(stepChat([], 'a', 1)).toBeNull();
    expect(stepChat([], null, -1)).toBeNull();
  });
});
