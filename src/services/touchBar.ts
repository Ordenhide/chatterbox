import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

/**
 * Touch Bar control for the macOS client.
 *
 * The Touch Bar shipped only on MacBook Pro models from 2016–2021, so this is
 * deliberately best-effort: `isSupported()` asks AppKit whether the class even
 * exists rather than matching model identifiers (which would need updating for
 * every new Mac), and every function is a no-op on other platforms. Nothing
 * here is load-bearing — the same actions are always reachable by keyboard and
 * on screen, so a Mac without the strip loses nothing.
 *
 * The native half is macos/chatterbox-macOS/TouchBarModule.mm.
 */

export interface TouchBarItem {
  /** Stable id echoed back when the button is pressed. */
  id: string;
  title: string;
  /** Optional SF Symbol name; falls back to the title if unavailable. */
  systemSymbol?: string;
}

type TouchBarNative = {
  isSupported: () => Promise<boolean>;
  setItems: (items: TouchBarItem[]) => void;
};

const native: TouchBarNative | undefined =
  Platform.OS === 'macos' ? (NativeModules.TouchBar as TouchBarNative | undefined) : undefined;

// Created once and only when the module exists — constructing a
// NativeEventEmitter around a missing module throws on some RN versions.
const emitter = native ? new NativeEventEmitter(NativeModules.TouchBar) : null;

/** True only on a Mac whose AppKit provides NSTouchBar. */
export async function isTouchBarSupported(): Promise<boolean> {
  if (!native?.isSupported) return false;
  try {
    return await native.isSupported();
  } catch {
    // A missing/failed native call is not worth surfacing — the feature is
    // decorative and every action has a keyboard equivalent.
    return false;
  }
}

/** Replaces the Touch Bar contents. An empty array clears it. */
export function setTouchBarItems(items: TouchBarItem[]): void {
  try {
    native?.setItems(items);
  } catch {
    /* no Touch Bar, or the window isn't up yet */
  }
}

/** Subscribes to button presses. Returns an unsubscribe function. */
export function onTouchBarPress(handler: (id: string) => void): () => void {
  if (!emitter) return () => undefined;
  const sub = emitter.addListener('touchBarItemPressed', (e: {id?: string}) => {
    if (e?.id) handler(e.id);
  });
  return () => sub.remove();
}

/**
 * The default strip, mirroring the keyboard shortcuts so the two stay in step.
 * Ids match ShortcutId (see services/shortcuts.ts) so a press and a key press
 * funnel into exactly the same handler.
 */
export const DEFAULT_TOUCH_BAR: TouchBarItem[] = [
  {id: 'newChat', title: 'New Chat', systemSymbol: 'square.and.pencil'},
  {id: 'search', title: 'Search', systemSymbol: 'magnifyingglass'},
  {id: 'prevChat', title: 'Previous', systemSymbol: 'chevron.up'},
  {id: 'nextChat', title: 'Next', systemSymbol: 'chevron.down'},
  {id: 'help', title: 'Shortcuts', systemSymbol: 'keyboard'},
];
