/**
 * Keyboard shortcut matching, kept free of React and the DOM event system so
 * the rules are unit-testable rather than only reachable by driving a browser.
 *
 * ## Choosing the bindings
 *
 * Every binding here avoids a combination the browser has already claimed:
 * Ctrl+N opens a window, Ctrl+T a tab, Ctrl+W closes one, and Ctrl+F is find.
 * A shortcut the browser eats first is worse than no shortcut, because it
 * looks broken rather than absent. Ctrl/Cmd+K is the one deliberate override —
 * it's the near-universal "quick switcher" binding (Slack, Linear, GitHub) and
 * calling preventDefault on it is well-established.
 *
 * The modifier follows the platform: Cmd on Apple hardware, Ctrl elsewhere.
 * Accepting both would mean Ctrl+K on a Mac silently shadowing the system's
 * own "delete to end of line" in text fields.
 */

export type ShortcutId =
  | 'help'
  | 'search'
  | 'newChat'
  | 'prevChat'
  | 'nextChat'
  | 'closeOrClear'
  | 'tabChats'
  | 'tabMoments'
  | 'tabStore'
  | 'tabProfile';

/** The subset of KeyboardEvent this module needs — so tests can pass plain objects. */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** True on Apple platforms, where Cmd rather than Ctrl is the app modifier. */
export function isApplePlatform(platform: string = navigator.platform ?? ''): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

/** The platform's primary modifier is held (and only that one). */
function primaryModifier(e: KeyLike, apple: boolean): boolean {
  return apple ? !!e.metaKey && !e.ctrlKey : !!e.ctrlKey && !e.metaKey;
}

function noModifiers(e: KeyLike): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey;
}

/**
 * Whether the event target is somewhere the user is typing. Bare-letter
 * shortcuts must never fire while composing a message — typing "?" into a
 * sentence should produce a "?", not open a help overlay.
 *
 * Modifier-based shortcuts deliberately still work inside inputs, which is what
 * makes Ctrl+K reachable without leaving the composer first.
 */
export function isTypingTarget(target: unknown): boolean {
  const el = target as {tagName?: string; isContentEditable?: boolean} | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/**
 * Resolves an event to a shortcut, or null when it isn't one.
 *
 * `typing` is passed in rather than derived, so callers stay in control of what
 * counts as a text field (the composer forwards its own state).
 */
export function matchShortcut(
  e: KeyLike,
  opts: {typing: boolean; apple?: boolean} = {typing: false},
): ShortcutId | null {
  const apple = opts.apple ?? isApplePlatform();
  const mod = primaryModifier(e, apple);

  // Escape works everywhere, including mid-typing — it's the universal "get me
  // out of this" and blocking it inside the composer would strand the user.
  if (e.key === 'Escape' && noModifiers(e)) return 'closeOrClear';

  if (mod && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'k') return 'search';
    if (k === 'n' && e.shiftKey) return 'newChat';
    if (!e.shiftKey) {
      if (e.key === '1') return 'tabChats';
      if (e.key === '2') return 'tabMoments';
      if (e.key === '3') return 'tabStore';
      if (e.key === '4') return 'tabProfile';
    }
  }

  // Alt+arrows move between conversations. Alt (rather than a bare arrow) so
  // the arrows keep working for scrolling and caret movement.
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    if (e.key === 'ArrowUp') return 'prevChat';
    if (e.key === 'ArrowDown') return 'nextChat';
  }

  // Bare keys only outside text fields.
  if (opts.typing || !noModifiers(e)) return null;
  if (e.key === '?') return 'help';

  return null;
}

/** Steps through a list of chat ids, clamped at both ends rather than wrapping. */
export function stepChat(
  ids: string[],
  current: string | null | undefined,
  direction: -1 | 1,
): string | null {
  if (ids.length === 0) return null;
  const at = current ? ids.indexOf(current) : -1;
  // Nothing selected: Down opens the first chat, Up the last.
  if (at === -1) return direction === 1 ? ids[0] : ids[ids.length - 1];
  const next = at + direction;
  // Clamping, not wrapping: jumping from the last chat back to the first is
  // disorienting when you're holding the key to scan down a list.
  if (next < 0 || next >= ids.length) return ids[at];
  return ids[next];
}

/**
 * Shortcuts that the chats screen owns rather than the app shell — focusing
 * the chat search, opening the new-chat dialog, stepping between conversations.
 *
 * Delivered as a window event, matching how TOUR_EVENT already crosses
 * component boundaries here, so the shell doesn't need to reach into
 * HomeScreen's state (which owns the *filtered, ordered* chat list — the only
 * order that matches what the user sees).
 */
export const SHORTCUT_EVENT = 'cb:shortcut';

export function emitShortcut(id: ShortcutId): void {
  window.dispatchEvent(new CustomEvent(SHORTCUT_EVENT, {detail: id}));
}

/** Human-readable label for the platform's modifier, for the help overlay. */
export function modifierLabel(apple: boolean = isApplePlatform()): string {
  return apple ? '⌘' : 'Ctrl';
}

/** The rows rendered by the shortcuts help overlay, in display order. */
export const SHORTCUT_HELP: Array<{keys: (mod: string) => string[]; i18nKey: string}> = [
  {keys: m => [m, 'K'], i18nKey: 'shortcuts.search'},
  {keys: m => [m, '⇧', 'N'], i18nKey: 'shortcuts.newChat'},
  {keys: () => ['Alt', '↑'], i18nKey: 'shortcuts.prevChat'},
  {keys: () => ['Alt', '↓'], i18nKey: 'shortcuts.nextChat'},
  {keys: m => [m, '1'], i18nKey: 'shortcuts.tabChats'},
  {keys: m => [m, '2'], i18nKey: 'shortcuts.tabMoments'},
  {keys: m => [m, '3'], i18nKey: 'shortcuts.tabStore'},
  {keys: m => [m, '4'], i18nKey: 'shortcuts.tabProfile'},
  {keys: () => ['Enter'], i18nKey: 'shortcuts.send'},
  {keys: () => ['⇧', 'Enter'], i18nKey: 'shortcuts.newline'},
  {keys: () => ['↑'], i18nKey: 'shortcuts.editLast'},
  {keys: () => ['Esc'], i18nKey: 'shortcuts.escape'},
  {keys: () => ['?'], i18nKey: 'shortcuts.help'},
];
