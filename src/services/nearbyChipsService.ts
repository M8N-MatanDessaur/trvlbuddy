import { UserLocation } from '../utils/geolocation';
import { reverseGeocodeLocality } from '../utils/geocoding';
import {
  NearbyChipSuggestion,
  suggestNearbyChips,
} from './aiService';
import { CATEGORIES } from './nearbyService';

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

// How long a suggestion set stays fresh. Tied to time-of-day transitions:
// morning vs afternoon vs evening produce different chips, but within a
// 30-minute window the suggestions are stable.
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_KEY_PREFIX = 'nearby-chips:';

interface CacheEntry {
  chips: NearbyChipSuggestion[];
  fetchedAt: number;
}

interface PlacesScanResult {
  place_id: string;
  types?: string[];
}

function hourBucket(date: Date): string {
  const h = date.getHours();
  if (h < 6) return 'late-night';
  if (h < 11) return 'morning';
  if (h < 15) return 'midday';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

function dayOfWeek(date: Date): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    date.getDay()
  ];
}

function timeOfDayLabel(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function cacheKey(city: string | null, bucket: string): string {
  return `${CACHE_KEY_PREFIX}${city || 'unknown'}:${bucket}`;
}

function readCache(key: string): NearbyChipSuggestion[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.chips;
  } catch {
    return null;
  }
}

function writeCache(key: string, chips: NearbyChipSuggestion[]): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { chips, fetchedAt: Date.now() };
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // sessionStorage full or disabled; fine to silently ignore
  }
}

// Single broad Nearby Search call — no type filter — to sample what's actually
// around the user. The returned result types feed a count-per-type map that
// Gemini uses to pick chips grounded in reality instead of pure guessing.
async function scanTypeCounts(
  userLocation: UserLocation,
  radius: number,
): Promise<Record<string, number>> {
  if (!GOOGLE_PLACES_API_KEY) return {};
  try {
    const params = new URLSearchParams({
      location: `${userLocation.lat},${userLocation.lng}`,
      radius: String(radius),
      key: GOOGLE_PLACES_API_KEY,
    });
    const res = await fetch(`/api/places/nearbysearch/json?${params.toString()}`);
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Chip scan non-OK status:', data.status, data.error_message);
      return {};
    }
    const results: PlacesScanResult[] = data.results || [];
    const counts: Record<string, number> = {};
    const allowed = new Set(CATEGORIES.map(c => c.type));
    for (const r of results) {
      for (const t of r.types || []) {
        if (!allowed.has(t)) continue;
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return counts;
  } catch (err) {
    console.error('Chip scan failed:', err);
    return {};
  }
}

export interface FetchDynamicChipsOptions {
  userLocation: UserLocation;
  /** Search radius in meters used for the type-count scan. Tie to transport mode. */
  scanRadius: number;
  /** Optional pre-resolved city name to avoid a second geocode call. */
  city?: string | null;
  /** Force refresh, ignoring cache. */
  force?: boolean;
}

export async function fetchDynamicChips(
  opts: FetchDynamicChipsOptions,
): Promise<NearbyChipSuggestion[]> {
  const { userLocation, scanRadius, force = false } = opts;
  const now = new Date();
  const bucket = hourBucket(now);
  const city =
    opts.city !== undefined
      ? opts.city
      : await reverseGeocodeLocality(userLocation.lat, userLocation.lng);
  const key = cacheKey(city, bucket);

  if (!force) {
    const cached = readCache(key);
    if (cached && cached.length > 0) return cached;
  }

  const typeCounts = await scanTypeCounts(userLocation, scanRadius);
  const chips = await suggestNearbyChips({
    city,
    dayOfWeek: dayOfWeek(now),
    timeOfDay: timeOfDayLabel(now),
    typeCounts,
    allowedTypes: CATEGORIES.map(c => ({ type: c.type, label: c.label })),
  });

  if (chips.length > 0) writeCache(key, chips);
  return chips;
}
