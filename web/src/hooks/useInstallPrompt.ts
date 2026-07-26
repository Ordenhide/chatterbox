import {useEffect, useReducer} from 'react';

// PWA install plumbing. Chromium browsers fire `beforeinstallprompt`, which we
// stash so an in-app button can trigger the native install later. Safari has no
// such event — there we fall back to showing manual "Add to Dock" guidance.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

/** Attach the capture listeners once, as early as possible (from main.tsx). */
export function initInstallCapture(): void {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** True when the app is already running as an installed PWA. */
export function isStandalone(): boolean {
  return (
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
    // iOS Safari uses a non-standard navigator flag.
    (navigator as unknown as {standalone?: boolean}).standalone === true
  );
}

/** Trigger the native install prompt; 'unavailable' when the browser can't. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const {outcome} = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome;
}

/** Reactive install state for components. */
export function useInstallPrompt() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return {
    canInstall: deferred !== null,
    installed: installed || isStandalone(),
    promptInstall,
  };
}
