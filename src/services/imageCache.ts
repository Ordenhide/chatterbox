/**
 * Image Caching Utilities
 * Provides image caching and prefetching for better performance
 */

import {Image} from 'react-native';
import mmkvStorage from './storageMMKV';

const IMAGE_CACHE_KEY = '@chatterbox:imageCache';
const MAX_CACHE_SIZE = 100; // Max number of cached image URLs

type CachedImage = {
  uri: string;
  cachedAt: number;
  size?: number;
};

/**
 * Prefetch images for better UX
 */
export async function prefetchImages(uris: string[]): Promise<void> {
  const validUris = uris.filter(uri => uri && typeof uri === 'string');
  
  // Prefetch in batches of 5 to avoid overwhelming the network
  const batchSize = 5;
  for (let i = 0; i < validUris.length; i += batchSize) {
    const batch = validUris.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(uri =>
        Image.prefetch(uri).catch(error => {
          if (__DEV__) {
            console.warn(`[ImageCache] Failed to prefetch ${uri}:`, error);
          }
        }),
      ),
    );
  }
}

/**
 * Get cached image info
 */
async function getCachedImages(): Promise<Map<string, CachedImage>> {
  const raw = await mmkvStorage.getItem(IMAGE_CACHE_KEY);
  if (!raw) return new Map();
  
  try {
    const parsed = JSON.parse(raw);
    const map = new Map<string, CachedImage>();
    Object.entries(parsed).forEach(([uri, data]) => {
      map.set(uri, data as CachedImage);
    });
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Cache image URI
 */
export async function cacheImage(uri: string): Promise<void> {
  if (!uri || typeof uri !== 'string') return;
  
  const cached = await getCachedImages();
  
  // Remove oldest entries if cache is full
  if (cached.size >= MAX_CACHE_SIZE) {
    const sorted = Array.from(cached.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toRemove = sorted.slice(0, sorted.length - MAX_CACHE_SIZE + 1);
    toRemove.forEach(([uri]) => cached.delete(uri));
  }
  
  cached.set(uri, {
    uri,
    cachedAt: Date.now(),
  });
  
  const serialized = Object.fromEntries(cached);
  await mmkvStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(serialized));
}

/**
 * Prefetch images from messages (for upcoming messages)
 */
export function prefetchMessageImages(messages: Array<{image?: string; video?: string}>): void {
  const imageUris: string[] = [];
  messages.forEach(msg => {
    if (msg.image) imageUris.push(msg.image);
    if (msg.video) imageUris.push(msg.video);
  });
  
  if (imageUris.length > 0) {
    prefetchImages(imageUris).catch(() => {
      // Silently fail prefetching
    });
  }
}

/**
 * Clear old cached images (older than 7 days)
 */
export async function clearOldImageCache(): Promise<void> {
  const cached = await getCachedImages();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  let hasChanges = false;
  cached.forEach((data, uri) => {
    if (data.cachedAt < sevenDaysAgo) {
      cached.delete(uri);
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    const serialized = Object.fromEntries(cached);
    await mmkvStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(serialized));
  }
}

