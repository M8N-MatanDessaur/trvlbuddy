import type { LucideIcon } from 'lucide-react';
import {
  NearbyCursorSnapshot,
  NearbyPlace,
  TransportMode,
  iconForPrimaryType,
} from './nearbyService';
import { haversineMeters } from '../utils/geolocation';

// Bump this when the shape of the cached value changes.
const CACHE_KEY_PREFIX = 'nearby-feed-cache-v2';

// Twelve hours, not thirty minutes.
//
// The old half-hour TTL, combined with a 500m location tolerance, meant the
// feed refetched if you switched tabs and came back, or walked down the
// street, or simply opened the app twice in a morning. Every refetch is six
// category searches against a billed API. That is the "it loads again and
// again and again" problem, and it is what a previous version of this app
// spent real money on.
//
// A restaurant does not stop existing over lunch, so there is no reason to
// pay to re-discover the same places. The server-side cache would now absorb
// most of these anyway, but not asking at all is faster and free.
const TTL_MS = 12 * 60 * 60 * 1000;

// How far the user can move before the cache is considered stale. Loosened
// deliberately: the sweep radius is far larger than these numbers, so a place
// found from a point 1km away is still nearby. Tight tolerances here just buy
// repeat charges for nearly identical results.
const LOCATION_TOLERANCE_BY_MODE: Record<TransportMode, number> = {
  foot: 1200,
  car: 8000,
};

export interface FeedCacheContext {
  location: { lat: number; lng: number };
  transportMode: TransportMode;
  selectedTypes: string[];
  aiKeyword?: string;
}

// NearbyPlace with categoryIcon stripped, Lucide components aren't
// JSON-serializable, but we can re-resolve them from `category` on hydrate.
type SerializedPlace = Omit<NearbyPlace, 'categoryIcon'>;

interface CachedFeed {
  places: SerializedPlace[];
  location: { lat: number; lng: number };
  transportMode: TransportMode;
  selectedTypes: string[];
  aiKeyword?: string;
  fetchedAt: number;
  cursor: NearbyCursorSnapshot;
}

export interface HydratedFeedCache {
  places: NearbyPlace[];
  cursor: NearbyCursorSnapshot;
  fetchedAt: number;
}

function normalizeKeyword(k?: string): string {
  return (k || '').trim().toLowerCase();
}

function normalizeTypes(types: string[]): string {
  return [...types].map(t => t.trim()).filter(Boolean).sort().join(',');
}

function contextKey(ctx: FeedCacheContext): string {
  return [
    CACHE_KEY_PREFIX,
    ctx.transportMode,
    normalizeTypes(ctx.selectedTypes),
    normalizeKeyword(ctx.aiKeyword),
  ].join(':');
}

function dehydratePlace(p: NearbyPlace): SerializedPlace {
  const { categoryIcon: _ignored, ...rest } = p;
  return rest;
}

function hydratePlace(p: SerializedPlace): NearbyPlace {
  const icon: LucideIcon = iconForPrimaryType(p.category, []);
  return { ...p, categoryIcon: icon };
}

export function readFeedCache(ctx: FeedCacheContext): HydratedFeedCache | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(contextKey(ctx));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedFeed;

    if (Date.now() - cached.fetchedAt > TTL_MS) return null;

    const tolerance = LOCATION_TOLERANCE_BY_MODE[ctx.transportMode];
    const dist = haversineMeters(ctx.location, cached.location);
    if (dist > tolerance) return null;

    return {
      places: cached.places.map(hydratePlace),
      cursor: cached.cursor,
      fetchedAt: cached.fetchedAt,
    };
  } catch {
    return null;
  }
}

export function writeFeedCache(
  ctx: FeedCacheContext,
  places: NearbyPlace[],
  cursor: NearbyCursorSnapshot,
): void {
  if (typeof localStorage === 'undefined') return;
  // Don't pollute storage with empty feeds, nothing to rehydrate anyway.
  if (places.length === 0) return;
  try {
    const payload: CachedFeed = {
      places: places.map(dehydratePlace),
      location: ctx.location,
      transportMode: ctx.transportMode,
      selectedTypes: ctx.selectedTypes,
      aiKeyword: ctx.aiKeyword,
      fetchedAt: Date.now(),
      cursor,
    };
    localStorage.setItem(contextKey(ctx), JSON.stringify(payload));
  } catch {
    // Quota or serialization failure, drop the entry so we don't leave a
    // corrupted one behind.
    try {
      localStorage.removeItem(contextKey(ctx));
    } catch {
      // ignore
    }
  }
}

export function clearFeedCache(ctx?: FeedCacheContext): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (ctx) {
      localStorage.removeItem(contextKey(ctx));
      return;
    }
    // No context, wipe every cached context for this feed.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${CACHE_KEY_PREFIX}:`)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
