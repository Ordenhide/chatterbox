/**
 * Firestore for HarmonyOS, via the pure-JS Firebase SDK. See ./README.md.
 *
 * The whole reason this directory exists. `firebase/firestore` exposes the same
 * modular API React Native Firebase does — `doc`, `setDoc`, `onSnapshot`,
 * `query`, `where`, `serverTimestamp` and the rest, with matching signatures —
 * so the 32 files that import from the seam need no changes at all. What
 * differs is underneath: no native SDK, just fetch and WebSocket, which is
 * exactly what makes it work on a platform Firebase has never heard of.
 */
import {initializeFirestore, memoryLocalCache, type Firestore} from 'firebase/firestore';
import {app} from './app.harmony';

export * from 'firebase/firestore';

/**
 * Configured once, on first import, then handed to every `getFirestore()` call
 * below.
 *
 * Two departures from the defaults, both forced by the platform:
 *
 * `memoryLocalCache` — the JS SDK's persistent cache is IndexedDB, which does
 * not exist here. Left on the default the SDK attempts it, fails, and falls
 * back anyway; asking for memory explicitly makes the trade visible instead of
 * incidental. The practical cost is that Firestore's own offline cache does not
 * survive a restart. The chat list and messages are separately cached in MMKV
 * (see scheduleMessageCacheWrite in ChatScreen), so cold start still shows
 * content — but anything relying on Firestore's cache alone will re-fetch.
 *
 * `experimentalForceLongPolling` — Firestore's default transport upgrades to a
 * streaming channel that depends on browser XHR behaviour the RN networking
 * stack does not reproduce faithfully. Long polling is the documented remedy
 * for React Native and costs some latency on updates; a listener that silently
 * never fires costs considerably more.
 */
const db: Firestore = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
});

/**
 * Shadows the re-exported `getFirestore` so callers get the instance
 * configured above rather than a default-configured one.
 *
 * Call sites pass nothing (`getFirestore()`), matching React Native Firebase.
 * The parameter is accepted and ignored so the signature stays compatible with
 * the JS SDK's own, which takes an optional app.
 */
export function getFirestore(_app?: unknown): Firestore {
  return db;
}

export type {Firestore};
