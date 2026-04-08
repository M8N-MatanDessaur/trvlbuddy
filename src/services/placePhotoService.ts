const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';
const CACHE_KEY = 'activityPhotoCache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_PHOTOS = 10;

interface PhotoCacheEntry {
  imageUrl: string | null;
  imageUrls: string[];
  placeId: string | null;
  timestamp: number;
}

type PhotoCache = Record<string, PhotoCacheEntry>;

function getCache(): PhotoCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const cache: PhotoCache = JSON.parse(raw);
    const now = Date.now();
    const pruned: PhotoCache = {};
    for (const [key, entry] of Object.entries(cache)) {
      if (now - entry.timestamp < CACHE_TTL) {
        pruned[key] = entry;
      }
    }
    return pruned;
  } catch {
    return {};
  }
}

function saveCache(cache: PhotoCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

function cacheKey(activityName: string, cityName: string): string {
  return `${activityName}::${cityName}`.toLowerCase();
}

function buildPhotoUrl(photoReference: string, maxWidth = 800): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

function buildSearchUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `/api/places/textsearch/json?query=${encodedQuery}&key=${GOOGLE_PLACES_API_KEY}`;
}

export interface PhotoResult {
  imageUrl: string | null;
  imageUrls: string[];
  placeId: string | null;
}

export async function fetchPhotoForActivity(
  activityName: string,
  cityName: string
): Promise<PhotoResult> {
  const empty: PhotoResult = { imageUrl: null, imageUrls: [], placeId: null };
  if (!GOOGLE_PLACES_API_KEY) return empty;

  const key = cacheKey(activityName, cityName);
  const cache = getCache();

  if (cache[key]) {
    return {
      imageUrl: cache[key].imageUrl,
      imageUrls: cache[key].imageUrls || [],
      placeId: cache[key].placeId,
    };
  }

  try {
    const url = buildSearchUrl(`${activityName} ${cityName}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      const place = data.results[0];
      const photos: any[] = place.photos || [];
      const imageUrls = photos
        .slice(0, MAX_PHOTOS)
        .map((p: any) => buildPhotoUrl(p.photo_reference));

      const result: PhotoResult = {
        imageUrl: imageUrls[0] || null,
        imageUrls,
        placeId: place.place_id || null,
      };

      cache[key] = { ...result, timestamp: Date.now() };
      saveCache(cache);
      return result;
    }

    cache[key] = { ...empty, timestamp: Date.now() };
    saveCache(cache);
    return empty;
  } catch (error) {
    console.error('Photo fetch failed for:', activityName, error);
    return empty;
  }
}

/**
 * Fetch full photo set for a place via Place Details API.
 * Called lazily when the user opens a modal, so we only pay the API cost on demand.
 * Returns all photo URLs (up to MAX_PHOTOS), or null if the fetch fails.
 */
export async function fetchDetailedPhotos(placeId: string): Promise<string[] | null> {
  if (!GOOGLE_PLACES_API_KEY || !placeId) return null;

  // Check if we already have detailed photos cached for this placeId
  const detailCacheKey = `details::${placeId}`;
  const cache = getCache();
  if (cache[detailCacheKey]?.imageUrls?.length > 1) {
    return cache[detailCacheKey].imageUrls;
  }

  try {
    const url = `/api/places/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result?.photos?.length > 0) {
      const imageUrls = data.result.photos
        .slice(0, MAX_PHOTOS)
        .map((p: any) => buildPhotoUrl(p.photo_reference));

      // Cache the detailed result
      cache[detailCacheKey] = {
        imageUrl: imageUrls[0],
        imageUrls,
        placeId,
        timestamp: Date.now(),
      };
      saveCache(cache);
      return imageUrls;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchPhotosForActivities(
  activities: Array<{ name: string; cityName: string; index: number }>,
  onUpdate: (index: number, result: PhotoResult) => void,
  concurrency = 3
): Promise<void> {
  const cache = getCache();
  const pending = activities.filter(a => {
    const key = cacheKey(a.name, a.cityName);
    const cached = cache[key];
    if (cached?.imageUrl) {
      onUpdate(a.index, {
        imageUrl: cached.imageUrl,
        imageUrls: cached.imageUrls || [],
        placeId: cached.placeId,
      });
      return false;
    }
    if (cached && !cached.imageUrl) {
      return false;
    }
    return true;
  });

  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (a) => {
        const result = await fetchPhotoForActivity(a.name, a.cityName);
        if (result.imageUrl) {
          onUpdate(a.index, result);
        }
      })
    );

    if (i + concurrency < pending.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}
