import {getStringFlag} from '../services/featureFlags';

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
 * The TURN entry is read from Firebase Remote Config rather than hardcoded
 * here, for the reason the previous version of this file gave in a comment
 * and then didn't act on: TURN credentials are typically short-lived and
 * rotated, and a value baked into the bundle can only change with a store
 * release. Remote Config is already initialised at app start
 * (services/featureFlags.ts), so this adds no new infrastructure.
 *
 * Set these three keys in the Firebase console (Remote Config):
 *   turn_url         — comma-separated, e.g.
 *                      "turn:host:3478?transport=udp,turns:host:5349?transport=tcp"
 *   turn_username
 *   turn_credential
 *
 * With none of them set, this returns STUN only — the previous behaviour,
 * so an unconfigured project degrades exactly as it did before rather than
 * failing to start a call.
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

/**
 * The ICE server list for a new peer connection.
 *
 * Deliberately not cached in this module: Remote Config does its own caching
 * (see minimumFetchIntervalMillis in featureFlags), and a module-level cache
 * on top of it would pin whatever credentials were current at first call for
 * the rest of the process — outliving short-lived TURN credentials, which is
 * the exact failure this indirection exists to avoid.
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
 * that starting a call never depends on telemetry succeeding.
 */
export type IceStatus =
  /** A TURN server with credentials. The configuration calls work best on. */
  | 'turn'
  /**
   * A TURN URL with no credentials. Valid only for a server that does not
   * require auth, which almost none do — far more often a half-finished
   * setup where the URL was added and the credentials were not.
   */
  | 'turn-anonymous'
  /** No TURN at all. Calls across two symmetric NATs will not connect. */
  | 'stun-only';

export type IceDescription = {servers: IceServer[]; status: IceStatus};

export async function describeIceServers(): Promise<IceDescription> {
  try {
    const [url, username, credential] = await Promise.all([
      getStringFlag('turn_url'),
      getStringFlag('turn_username'),
      getStringFlag('turn_credential'),
    ]);
    const urls = url
      .split(',')
      .map(u => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return {servers: STUN_SERVERS, status: 'stun-only'};
    // Username/credential are omitted rather than sent empty: a TURN server
    // rejects blank credentials, and an entry that always fails auth is worse
    // than no entry, since ICE spends time on it before giving up.
    const authenticated = !!username && !!credential;
    const turn: IceServer = authenticated ? {urls, username, credential} : {urls};
    return {
      servers: [...STUN_SERVERS, turn],
      status: authenticated ? 'turn' : 'turn-anonymous',
    };
  } catch {
    return {servers: STUN_SERVERS, status: 'stun-only'};
  }
}
