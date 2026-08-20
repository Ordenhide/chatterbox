import {useEffect, useRef} from 'react';

/**
 * Dismisses a popover when the pointer goes down outside it, or on Escape.
 *
 * Attach the returned ref to an element that wraps **both the trigger and the
 * popover**, not the popover alone. If the trigger sits outside the ref, then
 * clicking it while open runs this handler first (dismiss) and the trigger's
 * own toggle second (re-open), and the menu appears stuck — the classic version
 * of this bug, and the reason the wrapper matters.
 *
 * Listens for `pointerdown` rather than `click`: dismissal should happen the
 * moment a press lands elsewhere, not on release, and a `click` listener also
 * misses presses that end as a drag. The event is not swallowed, so whatever
 * was clicked still receives it — closing the menu and acting in one press is
 * what people expect, and requiring a throwaway click to dismiss is not.
 *
 * Nothing is bound while `open` is false, so a screen full of closed menus
 * costs no listeners.
 */
/**
 * Whether an event that landed on `target` happened outside `container`.
 *
 * Split out from the hook and exported so the rule can be tested against real
 * nodes without mounting a component — in particular the case that makes this
 * whole thing subtle: a trigger button *nested inside* the container is not
 * outside, so pressing it must not dismiss.
 *
 * A missing container answers false. During the frame between opening and the
 * ref attaching there is nothing to measure against, and guessing "outside"
 * there would close the popover the instant it appeared.
 */
export function isOutside(target: EventTarget | null, container: HTMLElement | null): boolean {
  if (!container || !(target instanceof Node)) return false;
  return !container.contains(target);
}

export function useDismissOnOutside<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
) {
  const ref = useRef<T | null>(null);
  // Kept in a ref so an inline arrow passed by the caller does not rebind the
  // listeners on every render.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (isOutside(e.target, ref.current)) dismiss.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss.current();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return ref;
}
