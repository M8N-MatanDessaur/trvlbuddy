// Geocoding via Photon (komoot.io's open-source OSM geocoder). Photon is free,
// requires no API key, and is friendlier to parallel requests than Nominatim.
// Results + negative results are cached in localStorage so a query is resolved
// at most once per device.

interface CacheEntry {
  lat: number;
  lng: number;
  ts: number;
}

const CACHE_KEY = 'geocode-cache-v2';
const NEGATIVE_CACHE_KEY = 'geocode-negative-v2';
const NEGATIVE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

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
    // out of quota -- ignore
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

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Geocode a free-text query (e.g. "Eiffel Tower, Paris, France").
 * Returns null on no result or network failure.
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

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      negative[key] = Date.now();
      writeNegativeCache(negative);
      return null;
    }
    const data: { features?: Array<{ geometry?: { coordinates?: [number, number] } }> } = await res.json();
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      negative[key] = Date.now();
      writeNegativeCache(negative);
      return null;
    }
    const [lng, lat] = coords;
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

/**
 * Geocode many queries in parallel with a small concurrency cap so we don't
 * blast the public Photon endpoint. Returns results in the same order as the
 * input queries; null entries are misses.
 */
export async function geocodeMany(
  queries: string[],
  options: { concurrency?: number; onProgress?: (resolved: number, total: number) => void } = {},
): Promise<Array<GeocodeResult | null>> {
  const { concurrency = 6, onProgress } = options;
  const results: Array<GeocodeResult | null> = new Array(queries.length).fill(null);
  let nextIndex = 0;
  let resolvedCount = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= queries.length) return;
      results[i] = await geocode(queries[i]);
      resolvedCount += 1;
      onProgress?.(resolvedCount, queries.length);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, queries.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
