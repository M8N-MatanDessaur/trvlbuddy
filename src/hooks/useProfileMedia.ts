import { useEffect, useState } from 'react';
import {
  getUserSocialStats,
  listUserPhotos,
  type UserPhoto,
  type UserSocialStats,
} from '../services/activityMediaService';
import { listUserVideos, type UserVideo } from '../services/activityVideoService';
import { warmImageCache } from '../lib/imagePrefetch';

// Module-level SWR cache for profile media. Going Profile -> Post -> Profile
// (or Profile -> Settings -> Profile) used to fire three fresh fetches per
// visit, so the grid flashed shimmer and re-decoded every image. With this
// cache: the cached snapshot renders instantly, a background revalidation
// fires only if the entry is stale, and a fresh entry replaces the snapshot
// when the network returns. Mirrors how Instagram's profile feels — the
// data is already there the second time you visit.
//
// TTL is short enough that a like / new post lands quickly when revisiting,
// but long enough that the typical "tap into a post then back" flow stays
// pure-cache-hit (no network, no shimmer).
const STALE_AFTER_MS = 30_000;

interface ProfileMediaSnapshot {
  stats: UserSocialStats;
  photos: UserPhoto[];
  videos: UserVideo[];
  fetchedAt: number;
}

const cache = new Map<string, ProfileMediaSnapshot>();
const inFlight = new Map<string, Promise<ProfileMediaSnapshot>>();
const listeners = new Map<string, Set<(snap: ProfileMediaSnapshot) => void>>();

function emit(userId: string, snap: ProfileMediaSnapshot): void {
  const set = listeners.get(userId);
  if (!set) return;
  set.forEach((fn) => fn(snap));
}

async function fetchSnapshot(userId: string): Promise<ProfileMediaSnapshot> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const promise = Promise.all([
    getUserSocialStats(userId),
    listUserPhotos(userId),
    listUserVideos(userId),
  ])
    .then(([stats, photos, videos]) => {
      const snap: ProfileMediaSnapshot = {
        stats,
        photos,
        videos,
        fetchedAt: Date.now(),
      };
      cache.set(userId, snap);
      emit(userId, snap);
      // Warm the SW image cache for the most relevant URLs so the next
      // grid render hits cache instead of network.
      try {
        warmImageCache([
          ...photos.map((p) => p.url),
          ...videos.map((v) => v.posterUrl).filter(Boolean) as string[],
        ]);
      } catch {
        // imagePrefetch is best-effort.
      }
      return snap;
    })
    .finally(() => {
      inFlight.delete(userId);
    });
  inFlight.set(userId, promise);
  return promise;
}

// Drop a user's cache entry — used after upload / delete so the next visit
// sees the change immediately instead of waiting for the TTL.
export function invalidateProfileMedia(userId: string): void {
  cache.delete(userId);
  inFlight.delete(userId);
  fetchSnapshot(userId).catch(() => { /* swallowed */ });
}

export interface ProfileMediaState {
  stats: UserSocialStats;
  photos: UserPhoto[];
  videos: UserVideo[];
  // True only on the very first render before any cached snapshot exists,
  // so callers can show a shimmer just once per user-id.
  loading: boolean;
}

export function useProfileMedia(userId: string | null): ProfileMediaState {
  const [snap, setSnap] = useState<ProfileMediaSnapshot | null>(() =>
    userId ? cache.get(userId) ?? null : null,
  );

  useEffect(() => {
    if (!userId) {
      setSnap(null);
      return;
    }

    // Subscribe so future cache writes (from background revalidation,
    // invalidations, or other mounts) update this consumer too.
    let listenerSet = listeners.get(userId);
    if (!listenerSet) {
      listenerSet = new Set();
      listeners.set(userId, listenerSet);
    }
    const listener = (next: ProfileMediaSnapshot) => setSnap(next);
    listenerSet.add(listener);

    const cached = cache.get(userId);
    setSnap(cached ?? null);

    // Revalidate on mount when the cache is missing or stale. Fresh
    // mounts within TTL skip the network entirely — that's the whole
    // point of the cache.
    const isStale = !cached || Date.now() - cached.fetchedAt > STALE_AFTER_MS;
    if (isStale) {
      fetchSnapshot(userId).catch(() => { /* errors are swallowed by service callers */ });
    }

    return () => {
      listenerSet?.delete(listener);
      if (listenerSet && listenerSet.size === 0) {
        listeners.delete(userId);
      }
    };
  }, [userId]);

  if (!snap) {
    return {
      stats: { postCount: 0, likesReceived: 0, commentsReceived: 0 },
      photos: [],
      videos: [],
      loading: Boolean(userId),
    };
  }

  return {
    stats: snap.stats,
    photos: snap.photos,
    videos: snap.videos,
    loading: false,
  };
}

// Optional: warm the cache for a user before navigation so the destination
// renders with data already populated. Call from hover/intent handlers
// on profile links.
export function prefetchProfileMedia(userId: string): void {
  const cached = cache.get(userId);
  const isStale = !cached || Date.now() - cached.fetchedAt > STALE_AFTER_MS;
  if (!isStale) return;
  fetchSnapshot(userId).catch(() => { /* swallowed */ });
}
