/**
 * Offline Cache Manager
 * Task 181: Offline mode for cached dashboards
 */

const CACHE_PREFIX = 'rf-offline-';
const CACHE_VERSION = 'v1';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache API response for offline use
 */
export async function cacheResponse<T>(
  key: string,
  data: T,
  ttlMs: number = 30 * 60 * 1000 // 30 minutes default
): Promise<void> {
  const cacheKey = `${CACHE_PREFIX}${CACHE_VERSION}-${key}`;
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (e) {
    // Storage full - clear old entries
    clearExpiredCache();
    try {
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch {
      console.warn('Failed to cache response:', key);
    }
  }
}

/**
 * Get cached response
 */
export function getCachedResponse<T>(key: string): T | null {
  const cacheKey = `${CACHE_PREFIX}${CACHE_VERSION}-${key}`;

  try {
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Fetch with offline fallback
 */
export async function fetchWithOfflineFallback<T>(
  url: string,
  cacheKey: string,
  options?: RequestInit
): Promise<{ data: T; fromCache: boolean }> {
  // Try network first
  if (isOnline()) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        const data = await response.json();
        // Cache successful response
        await cacheResponse(cacheKey, data);
        return { data, fromCache: false };
      }
    } catch (e) {
      console.warn('Network request failed, trying cache:', e);
    }
  }

  // Fall back to cache
  const cached = getCachedResponse<T>(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  throw new Error('No network connection and no cached data available');
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const entry = JSON.parse(stored);
          if (now > entry.expiresAt) {
            keysToRemove.push(key);
          }
        }
      } catch {
        keysToRemove.push(key!);
      }
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Clear all offline cache
 */
export function clearAllCache(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; sizeBytes: number } {
  let count = 0;
  let sizeBytes = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      count++;
      const value = localStorage.getItem(key);
      if (value) {
        sizeBytes += key.length + value.length;
      }
    }
  }

  return { count, sizeBytes };
}
