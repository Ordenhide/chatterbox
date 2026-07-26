// GIPHY GIF search, mapped into a provider-agnostic GifResult so a GIF sent from
// either client renders the same. Google shut down the public Tenor API on
// 2026-06-30, so both clients migrated to GIPHY. The API key comes from
// VITE_GIPHY_API_KEY (or Firebase Remote Config `giphy_api_key`, which is where
// the mobile app keeps it).
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const LIMIT = 24;
// A chat app shouldn't surface explicit GIFs by default; cap at PG-13.
const RATING = 'pg-13';

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  mp4Url: string;
  mp4PreviewUrl: string;
  width?: number;
  height?: number;
}

let resolvedKey: string | null | undefined;

async function getKey(): Promise<string> {
  if (resolvedKey !== undefined) {
    if (resolvedKey) return resolvedKey;
    throw new Error('GIF search unavailable: no GIPHY API key configured.');
  }
  const envKey = import.meta.env.VITE_GIPHY_API_KEY;
  if (envKey) {
    resolvedKey = envKey;
    return envKey;
  }
  // Fall back to Firebase Remote Config (where the mobile app stores the key).
  try {
    const {getRemoteConfig, fetchAndActivate, getString} = await import('firebase/remote-config');
    const {app} = await import('../firebase');
    const rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = 3600_000;
    await fetchAndActivate(rc);
    const key = getString(rc, 'giphy_api_key');
    resolvedKey = key || null;
    if (key) return key;
  } catch {
    resolvedKey = null;
  }
  throw new Error('GIF search unavailable: no GIPHY API key configured.');
}

export function gifConfigured(): boolean {
  return !!import.meta.env.VITE_GIPHY_API_KEY || resolvedKey != null;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// GIPHY nests renditions under `images`; pick a full gif, a lightweight preview
// gif for the grid, and the matching mp4s. Dimensions come back as strings.
function mapResults(results: any[]): GifResult[] {
  return (results || [])
    .map(item => {
      const img = item.images || {};
      const full = img.original || img.downsized || {};
      const preview = img.fixed_width || img.preview_gif || img.fixed_width_small || full;
      const mp4Preview = img.preview || img.fixed_width_small || img.fixed_width || full;
      return {
        id: item.id,
        url: full.url || preview.url || '',
        previewUrl: preview.url || full.url || '',
        mp4Url: full.mp4 || preview.mp4 || '',
        mp4PreviewUrl: mp4Preview.mp4 || full.mp4 || '',
        width: num(full.width),
        height: num(full.height),
      };
    })
    .filter(g => g.url);
}

async function giphy(endpoint: string, params: Record<string, string>): Promise<GifResult[]> {
  const key = await getKey();
  const qs = new URLSearchParams({api_key: key, limit: String(LIMIT), rating: RATING, ...params});
  const res = await fetch(`${GIPHY_BASE}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`GIPHY error ${res.status}`);
  const json = await res.json();
  return mapResults(json.data);
}

export function trendingGifs(): Promise<GifResult[]> {
  return giphy('trending', {});
}

export function searchGifs(q: string): Promise<GifResult[]> {
  const query = q.trim();
  return query ? giphy('search', {q: query}) : trendingGifs();
}
