/**
 * Keyboard shortcuts for the macOS client.
 *
 * Mirrors web/src/services/shortcuts.ts — same bindings, same reasoning — so a
 * user moving between the desktop app and the web app doesn't have to learn a
 * second set. Kept as a parallel copy rather than a shared package, matching
 * this repo's existing convention (see e2eeArtifacts.ts, linkPreview.ts).
 *
 * ## Why this is macOS-only
 *
 * iOS and Android have no hardware keyboard to bind to in the common case, and
 * react-native-macos is the only target that exposes `onKeyDown`/`keyDownEvents`
 * on a View. The matcher below is pure, so it is imported and unit-tested on
 * every platform; only the wiring (useKeyboardShortcuts) is gated on macOS.
 *
 * The modifier is always Cmd here — unlike web, which has to detect the
 * platform, this client only ever runs on a Mac.
 */
import {Platform} from 'react-native';

export type ShortcutId =
  | 'help'
  | 'search'
  | 'newChat'
  | 'prevChat'
  | 'nextChat'
  | 'closeOrClear'
  | 'tabChats'
  | 'tabFriends'
  | 'tabStore'
  | 'tabProfile';

/**
 * Matches react-native-macos's `HandledKeyEvent` / `NativeKeyEvent` shape
 * exactly, so events arrive here without translation.
 */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export const isMacOS = (): boolean => Platform.OS === 'macos';

function noModifiers(e: KeyLike): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey;
}

/**
 * Resolves a key event to a shortcut, or null when it isn't one.
 *
 * Identical rules to the web client: Cmd+N/T/W are left to the system, bare
 * keys never fire while typing, and Escape always works so a text field can't
 * become a trap.
 */
export function matchShortcut(e: KeyLike, opts: {typing: boolean} = {typing: false}): ShortcutId | null {
  const mod = !!e.metaKey && !e.ctrlKey;

  if (e.key === 'Escape' && noModifiers(e)) return 'closeOrClear';

  if (mod && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'k') return 'search';
    if (k === 'n' && e.shiftKey) return 'newChat';
    if (!e.shiftKey) {
      if (e.key === '1') return 'tabChats';
      if (e.key === '2') return 'tabFriends';
      if (e.key === '3') return 'tabStore';
      if (e.key === '4') return 'tabProfile';
    }
  }

  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    if (e.key === 'ArrowUp') return 'prevChat';
    if (e.key === 'ArrowDown') return 'nextChat';
  }

  if (opts.typing || !noModifiers(e)) return null;
  if (e.key === '?') return 'help';

  return null;
}

/** Steps through chat ids, clamped at both ends rather than wrapping. */
export function stepChat(
  ids: string[],
  current: string | null | undefined,
  direction: -1 | 1,
): string | null {
  if (ids.length === 0) return null;
  const at = current ? ids.indexOf(current) : -1;
  if (at === -1) return direction === 1 ? ids[0] : ids[ids.length - 1];
  const next = at + direction;
  if (next < 0 || next >= ids.length) return ids[at];
  return ids[next];
}

/**
 * The keys the native view must claim before macOS will deliver them.
 *
 * Without an entry here AppKit handles the key itself — which for an unhandled
 * shortcut means the system alert beep, and for arrows means scrolling. Only
 * the exact chords we bind are listed, so everything else keeps its default
 * behaviour.
 */
export const HANDLED_KEYS: KeyLike[] = [
  {key: 'k', metaKey: true},
  {key: 'n', metaKey: true, shiftKey: true},
  {key: '1', metaKey: true},
  {key: '2', metaKey: true},
  {key: '3', metaKey: true},
  {key: '4', metaKey: true},
  {key: 'ArrowUp', altKey: true},
  {key: 'ArrowDown', altKey: true},
  {key: '?'},
  {key: 'Escape'},
];

/** Rows for the shortcuts help sheet, in display order. */
export const SHORTCUT_HELP: Array<{keys: string[]; i18nKey: string}> = [
  {keys: ['⌘', 'K'], i18nKey: 'shortcuts.search'},
  {keys: ['⌘', '⇧', 'N'], i18nKey: 'shortcuts.newChat'},
  {keys: ['⌥', '↑'], i18nKey: 'shortcuts.prevChat'},
  {keys: ['⌥', '↓'], i18nKey: 'shortcuts.nextChat'},
  {keys: ['⌘', '1'], i18nKey: 'shortcuts.tabChats'},
  {keys: ['⌘', '2'], i18nKey: 'shortcuts.tabFriends'},
  {keys: ['⌘', '3'], i18nKey: 'shortcuts.tabStore'},
  {keys: ['⌘', '4'], i18nKey: 'shortcuts.tabProfile'},
  {keys: ['⏎'], i18nKey: 'shortcuts.send'},
  {keys: ['Esc'], i18nKey: 'shortcuts.escape'},
  {keys: ['?'], i18nKey: 'shortcuts.help'},
];
