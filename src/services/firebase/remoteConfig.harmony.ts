/**
 * Remote Config for HarmonyOS: serves defaults only. See ./README.md.
 *
 * The JS SDK's remote-config module is browser-only (it persists to IndexedDB
 * and fetches through a browser-shaped transport), so there is nothing to
 * forward to.
 *
 * Rather than throwing, this behaves as a fetch that never returns anything:
 * `fetchAndActivate` resolves false, and `getValue` reports whatever
 * ../featureFlags.ts registered in `defaultConfig`. That is the correct reading
 * of "no overrides are available" — every flag falls back to its shipped
 * default, which is exactly what featureFlags already does when a fetch fails.
 */
type Defaults = Record<string, string | number | boolean>;

const state: {defaults: Defaults} = {defaults: {}};

export function getRemoteConfig(_app?: unknown) {
  return {
    // featureFlags.ts assigns to both of these; they are plain properties in
    // RNFB 26 and the JS SDK alike.
    get defaultConfig(): Defaults {
      return state.defaults;
    },
    set defaultConfig(next: Defaults) {
      state.defaults = next ?? {};
    },
    settings: {minimumFetchIntervalMillis: 0, fetchTimeoutMillis: 0},
  };
}

/** No overrides were fetched, so nothing was activated. */
export async function fetchAndActivate(_remoteConfig: unknown): Promise<boolean> {
  return false;
}

export function getValue(_remoteConfig: unknown, key: string) {
  const value = state.defaults[key];
  return {
    asBoolean: () => value === true || value === 'true',
    asString: () => (value === undefined || value === null ? '' : String(value)),
    asNumber: () => (typeof value === 'number' ? value : Number(value) || 0),
    getSource: () => (key in state.defaults ? 'default' : 'static'),
  };
}
