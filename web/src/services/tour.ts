// First-run guided tour: persistence + a tiny event bus so any screen (e.g.
// Profile → "Replay tutorial") can (re)launch the tour that MainApp hosts.
const KEY = 'cb_web_tour_v1';
export const TOUR_EVENT = 'cb:start-tour';

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // If storage is unavailable, don't nag — treat as already seen.
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Ask MainApp to (re)open the tour, from anywhere in the tree. */
export function startTour(): void {
  window.dispatchEvent(new Event(TOUR_EVENT));
}
