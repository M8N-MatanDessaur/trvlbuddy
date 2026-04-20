// Free geocoding via OpenStreetMap's Nominatim. Cached to localStorage so a
// given query is only resolved once per device. Requests are queued through a
// 1.2s throttle to respect Nominatim's 1 req/sec usage policy.

interface CacheEntry {
  lat: number;
  lng: number;
  ts: number;
}

const CACHE_KEY = 'geocode-cache-v1';
const NEGATIVE_CACHE_KEY = 'geocode-negative-v1';
const THROTTLE_MS = 1200;
const NEGATIVE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

let lastFetchAt = 0;

function readCache(): Record<string, CacheEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // out of quota — ignore
  }
}

function readNegativeCache(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(NEGATIVE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeNegativeCache(cache: Record<string, number>): void {
  try {
    localStorage.setItem(NEGATIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

function normalizeKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const since = now - lastFetchAt;
  if (since < THROTTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - since));
  }
  lastFetchAt = Date.now();
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Geocode a free-text query (e.g. "Eiffel Tower, Paris, France") via
 * Nominatim. Returns null if no result, or on rate-limit/failure.
 */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const key = normalizeKey(trimmed);
  const cache = readCache();
  if (cache[key]) {
    return { lat: cache[key].lat, lng: cache[key].lng };
  }

  const negative = readNegativeCache();
  if (negative[key] && Date.now() - negative[key] < NEGATIVE_TTL) {
    return null;
  }

  await throttle();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        // Nominatim asks for an identifying user agent in the Accept-Language /
        // referer; in a browser the origin is sent automatically.
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      negative[key] = Date.now();
      writeNegativeCache(negative);
      return null;
    }
    const rows: Array<{ lat: string; lon: string }> = await res.json();
    const first = rows[0];
    if (!first) {
      negative[key] = Date.now();
      writeNegativeCache(negative);
      return null;
    }
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      negative[key] = Date.now();
      writeNegativeCache(negative);
      return null;
    }
    cache[key] = { lat, lng, ts: Date.now() };
    writeCache(cache);
    return { lat, lng };
  } catch {
    negative[key] = Date.now();
    writeNegativeCache(negative);
    return null;
  }
}
