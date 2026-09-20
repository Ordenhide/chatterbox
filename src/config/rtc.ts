import {getFunctions, httpsCallable} from '../services/firebase/functions';

/**
 * ICE servers for WebRTC.
 *
 * STUN alone only works when at least one peer is reachable once its address
 * is discovered. Between two symmetric NATs — two phones on separate mobile
 * networks, which is the common case for this app — neither side can be
 * reached directly and the call fails with no obvious cause. TURN relays the
 * media in that situation, so it is what makes calling work off a shared
 * network rather than an optimisation.
 *
 * The TURN entry comes from the `getTurnCredentials` Cloud Function rather
 * than a bundled constant or Remote Config: Cloudflare Realtime (the
 * provider, see CALLING.md) doesn't issue a static username/password to
 * paste into config at all — it issues a long-term key that mints a
 * short-lived, per-connection credential on request. Minting it server-side
 * keeps that long-term key off every device; the client only ever holds a
 * credential that expires on its own.
 *
 * Set CLOUDFLARE_TURN_KEY_ID / CLOUDFLARE_TURN_API_TOKEN in functions/.env —
 * see functions/.env.example. With neither set, the function answers
 * `failed-precondition` and this returns STUN only, same as before TURN
 * existed at all.
 */

/** Shape only — react-native-webrtc declares RTCIceServer internally without
 * exporting it, and this project's tsconfig has no DOM lib to borrow it from. */
type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export const STUN_SERVERS: IceServer[] = [
  {urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']},
];

const functions = getFunctions();

/**
 * The ICE server list for a new peer connection.
 *
 * Never rejects. A call that falls back to STUN may fail to connect across
 * NATs, but one that throws here fails to start at all.
 */
export async function getIceServers(): Promise<IceServer[]> {
  return (await describeIceServers()).servers;
}

/**
 * What TURN configuration this call will actually use.
 *
 * Exists because the failure this module was written to prevent is silent
 * from every angle: with no TURN entry, two phones on separate mobile
 * networks simply fail to connect, and the call reports a generic timeout.
 * Nothing distinguishes "TURN is misconfigured" from "the other person has
 * bad signal", so the project can sit unprovisioned indefinitely with calls
 * that work in the office and fail everywhere else.
 *
 * `status` names the state so a caller can say so — see the diagnostics
 * surface in CALLING.md. Reporting it is the caller's job; this stays pure so
 * that starting a call never depends on error reporting succeeding.
 */
export type IceStatus =
  /** A short-lived TURN credential, minted for this call. */
  | 'turn'
  /** No TURN at all. Calls across two symmetric NATs will not connect. */
  | 'stun-only';

export type IceDescription = {servers: IceServer[]; status: IceStatus};

export async function describeIceServers(): Promise<IceDescription> {
  try {
    const callable = httpsCallable(functions, 'getTurnCredentials');
    const result = await callable();
    const servers = (result.data as {iceServers: IceServer[]}).iceServers;
    if (!Array.isArray(servers) || servers.length === 0) {
      return {servers: STUN_SERVERS, status: 'stun-only'};
    }
    return {servers, status: 'turn'};
  } catch {
    // Covers both an unconfigured server (failed-precondition) and a real
    // failure (network, auth) — either way, STUN-only is the same safe
    // fallback the app shipped with before TURN existed.
    return {servers: STUN_SERVERS, status: 'stun-only'};
  }
}
