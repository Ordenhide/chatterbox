import {GifResult} from '../types';
import {getStringFlag} from './featureFlags';

const TENOR_BASE = 'https://tenor.googleapis.com/v2';
const LIMIT = 30;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

let _resolvedKey: string | null = null;

async function getTenorApiKey(): Promise<string> {
  if (_resolvedKey) return _resolvedKey;
  // Key is stored in Firebase Remote Config as "tenor_api_key".
  // Set it there via the Firebase console so it never lives in the bundle.
  const key = await getStringFlag('tenor_api_key', '');
  if (key) {
    _resolvedKey = key;
    return key;
  }
  throw new Error('GIF search is unavailable: tenor_api_key not configured in Remote Config.');
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

async function tenorFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  const apiKey = await getTenorApiKey();
  const qs = new URLSearchParams({key: apiKey, client_key: 'chatterbox', ...params});
  const response = await fetch(`${TENOR_BASE}/${endpoint}?${qs.toString()}`);
  if (!response.ok) {
    throw new Error(`Tenor API error: ${response.status}`);
  }
  return response.json();
}

function mapResults(results: any[]): GifResult[] {
  return (results || []).map(item => {
    const gif = item.media_formats?.gif || item.media_formats?.mediumgif || {};
    const preview = item.media_formats?.tinygif || item.media_formats?.nanogif || gif;
    const mp4 = item.media_formats?.mp4 || {};
    const mp4Preview = item.media_formats?.tinymp4 || item.media_formats?.nanomp4 || mp4;
    return {
      id: item.id,
      url: gif.url || '',
      previewUrl: preview.url || gif.url || '',
      mp4Url: mp4.url || '',
      mp4PreviewUrl: mp4Preview.url || mp4.url || '',
      width: gif.dims?.[0] || 220,
      height: gif.dims?.[1] || 220,
      title: item.content_description || '',
    };
  }).filter(g => g.url);
}

export async function searchGifs(queryText: string): Promise<GifResult[]> {
  const key = `search:${queryText.toLowerCase().trim()}`;
  const cached = getCached(key);
  if (cached) return cached;

  const data = await tenorFetch('search', {
    q: queryText,
    limit: String(LIMIT),
    media_filter: 'gif,tinygif,mp4,tinymp4',
  });
  const results = mapResults(data.results);
  setCache(key, results);
  return results;
}

export async function getTrendingGifs(): Promise<GifResult[]> {
  const key = 'trending';
  const cached = getCached(key);
  if (cached) return cached;

  const data = await tenorFetch('featured', {
    limit: String(LIMIT),
    media_filter: 'gif,tinygif,mp4,tinymp4',
  });
  const results = mapResults(data.results);
  setCache(key, results);
  return results;
}
