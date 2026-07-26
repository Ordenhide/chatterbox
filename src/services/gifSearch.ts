import {GifResult} from '../types';
import {getStringFlag} from './featureFlags';

// Google shut down the public Tenor API on 2026-06-30, so GIF search moved to
// GIPHY. The key lives in Firebase Remote Config as "giphy_api_key" (set it via
// the Firebase console so it never lives in the bundle).
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const LIMIT = 30;
// A chat app shouldn't surface explicit GIFs by default; cap at PG-13.
const RATING = 'pg-13';
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

let _resolvedKey: string | null = null;

async function getGiphyApiKey(): Promise<string> {
  if (_resolvedKey) return _resolvedKey;
  const key = await getStringFlag('giphy_api_key', '');
  if (key) {
    _resolvedKey = key;
    return key;
  }
  throw new Error('GIF search is unavailable: giphy_api_key not configured in Remote Config.');
}

const cache = new Map<string, {data: GifResult[]; ts: number}>();

function setCache(key: string, data: GifResult[]) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, {data, ts: Date.now()});
}

function getCached(key: string): GifResult[] | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

async function giphyFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  const apiKey = await getGiphyApiKey();
  const qs = new URLSearchParams({api_key: apiKey, rating: RATING, ...params});
  const response = await fetch(`${GIPHY_BASE}/${endpoint}?${qs.toString()}`);
  if (!response.ok) {
    throw new Error(`GIPHY API error: ${response.status}`);
  }
  return response.json();
}

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
        width: Number(full.width) || 220,
        height: Number(full.height) || 220,
        title: item.title || '',
      };
    })
    .filter(g => g.url);
}

export async function searchGifs(queryText: string): Promise<GifResult[]> {
  const key = `search:${queryText.toLowerCase().trim()}`;
  const cached = getCached(key);
  if (cached) return cached;

  const data = await giphyFetch('search', {
    q: queryText,
    limit: String(LIMIT),
  });
  const results = mapResults(data.data);
  setCache(key, results);
  return results;
}

export async function getTrendingGifs(): Promise<GifResult[]> {
  const key = 'trending';
  const cached = getCached(key);
  if (cached) return cached;

  const data = await giphyFetch('trending', {
    limit: String(LIMIT),
  });
  const results = mapResults(data.data);
  setCache(key, results);
  return results;
}
