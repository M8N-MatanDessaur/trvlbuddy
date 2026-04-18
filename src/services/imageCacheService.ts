const DB_NAME = 'trvlbuddy-images';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;
const MAX_AGE = 14 * 24 * 60 * 60 * 1000; // 14 days

// The `url` field on the cache entry is actually the logical cache key —
// either the full image URL, or a stable identifier like `${placeId}:${i}`.
// Keying by place-id-plus-index lets us reuse the same blob even when
// Google rotates the photo_reference / photoName token between searches.
interface CacheEntry {
  url: string;
  blob: Blob;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** Get a cached blob URL, or null if not cached */
export async function getCachedImage(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (entry && Date.now() - entry.timestamp < MAX_AGE) {
          resolve(URL.createObjectURL(entry.blob));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Fetch an image from `url`, cache the blob under `key`, return a blob URL. */
export async function cacheImage(url: string, key: string = url): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ url: key, blob, timestamp: Date.now() } as CacheEntry);

    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Get from cache or fetch and cache. Returns blob URL or original URL as fallback.
 *
 * Pass `cacheKey` to use a stable identifier (e.g. `${placeId}:${index}`) that
 * survives Google rotating the photo token in the URL. Without `cacheKey` the
 * full URL is the key (back-compat behaviour).
 */
export async function getOrCacheImage(url: string, cacheKey?: string): Promise<string> {
  const key = cacheKey || url;
  const cached = await getCachedImage(key);
  if (cached) return cached;

  const blobUrl = await cacheImage(url, key);
  return blobUrl || url;
}

/** Prefetch a batch of image URLs into the cache without blocking */
export async function prefetchImages(urls: string[], concurrency = 2): Promise<void> {
  // Filter to only urls not already cached
  const uncached: string[] = [];
  for (const url of urls) {
    const cached = await getCachedImage(url);
    if (cached) {
      URL.revokeObjectURL(cached); // Clean up the blob URL we won't use
    } else {
      uncached.push(url);
    }
  }

  for (let i = 0; i < uncached.length; i += concurrency) {
    const batch = uncached.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(url => cacheImage(url)));
  }
}

/** Remove expired entries to free up space */
export async function pruneExpiredCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    const now = Date.now();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const entry = cursor.value as CacheEntry;
      if (now - entry.timestamp > MAX_AGE) {
        cursor.delete();
      }
      cursor.continue();
    };
  } catch {
    // Ignore pruning errors
  }
}
