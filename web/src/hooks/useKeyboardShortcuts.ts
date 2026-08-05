import {useEffect} from 'react';
import {isTypingTarget, matchShortcut, type ShortcutId} from '../services/shortcuts';

/**
 * Binds the global shortcut set to a handler.
 *
 * Two deliberate choices:
 *
 * 1. **Bubble phase, not capture.** Modals register their own Escape/Tab
 *    handling in the capture phase (see useModal) and stop propagation. Running
 *    here on the bubble means an open dialog consumes Escape first and this
 *    never sees it — so Escape closes the dialog rather than also clearing the
 *    search behind it.
 *
 * 2. **`enabled` gate.** The caller switches this off while a dialog is open,
 *    so Ctrl+K can't yank focus to a search box hidden behind an overlay.
 *
 * preventDefault runs only for a matched shortcut, so every unbound key keeps
 * its browser behaviour untouched.
 */
export function useKeyboardShortcuts(
  onShortcut: (id: ShortcutId) => void,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // An IME composing a character sends keydown events whose keys are part
      // of the composition, not commands — acting on them would break typing
      // in Chinese, Japanese and Korean.
      if (e.isComposing) return;
      const id = matchShortcut(e, {typing: isTypingTarget(e.target)});
      if (!id) return;
      e.preventDefault();
      onShortcut(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onShortcut, enabled]);
}
