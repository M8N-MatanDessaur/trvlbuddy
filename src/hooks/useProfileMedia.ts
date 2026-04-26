import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUserSocialStats,
  listUserPhotos,
  type UserPhoto,
  type UserSocialStats,
} from '../services/activityMediaService';
import { listUserVideos, type UserVideo } from '../services/activityVideoService';
import { warmImageCache } from '../lib/imagePrefetch';
import { queryKeys } from '../lib/queryKeys';

export interface ProfileMediaState {
  stats: UserSocialStats;
  photos: UserPhoto[];
  videos: UserVideo[];
  loading: boolean;
}

const EMPTY_STATS: UserSocialStats = {
  postCount: 0,
  likesReceived: 0,
  commentsReceived: 0,
};

interface ProfileMediaSnapshot {
  stats: UserSocialStats;
  photos: UserPhoto[];
  videos: UserVideo[];
}

// Wrap a promise with a timeout that REJECTS if the promise doesn't
// settle. allSettled only helps if each underlying promise eventually
// resolves OR rejects -- a hung Supabase query will sit forever on a
// flaky phone connection. With this guard, each sub-query has at most
// 12s to respond, then it counts as a rejection and the rest of the
// data still renders.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(t); resolve(value); },
      (err) => { clearTimeout(t); reject(err); },
    );
  });
}

const PROFILE_QUERY_TIMEOUT_MS = 12_000;

async function fetchProfileMedia(userId: string): Promise<ProfileMediaSnapshot> {
  // Each sub-query is independently timeout-guarded. If photos hangs,
  // after 12s it counts as rejected; stats + videos still come through.
  // The grid renders whatever resolved; the user never sits on shimmer
  // forever.
  const [statsResult, photosResult, videosResult] = await Promise.allSettled([
    withTimeout(getUserSocialStats(userId), PROFILE_QUERY_TIMEOUT_MS, 'stats'),
    withTimeout(listUserPhotos(userId), PROFILE_QUERY_TIMEOUT_MS, 'photos'),
    withTimeout(listUserVideos(userId), PROFILE_QUERY_TIMEOUT_MS, 'videos'),
  ]);

  if (statsResult.status === 'rejected') console.warn('[profile] stats failed', statsResult.reason);
  if (photosResult.status === 'rejected') console.warn('[profile] photos failed', photosResult.reason);
  if (videosResult.status === 'rejected') console.warn('[profile] videos failed', videosResult.reason);

  const stats = statsResult.status === 'fulfilled'
    ? statsResult.value
    : { postCount: 0, likesReceived: 0, commentsReceived: 0 };
  const photos = photosResult.status === 'fulfilled' ? photosResult.value : [];
  const videos = videosResult.status === 'fulfilled' ? videosResult.value : [];

  // If EVERY query rejected, throw so React Query enters an error state
  // and the next mount retries instead of silently caching empty data.
  if (
    statsResult.status === 'rejected' &&
    photosResult.status === 'rejected' &&
    videosResult.status === 'rejected'
  ) {
    throw statsResult.reason instanceof Error
      ? statsResult.reason
      : new Error('Profile media fetch failed');
  }

  try {
    warmImageCache([
      ...photos.map((p) => p.url),
      ...videos.map((v) => v.posterUrl).filter(Boolean) as string[],
    ]);
  } catch {
    /* noop */
  }
  return { stats, photos, videos };
}

// Profile media (counts + photos + videos) for a given user. Backed by
// React Query so revisits are instant from cache, in-flight requests
// dedupe across components, and external code can invalidate via
// queryKeys.profileMedia(userId).
export function useProfileMedia(userId: string | null): ProfileMediaState {
  const query = useQuery({
    queryKey: queryKeys.profileMedia(userId),
    queryFn: () => fetchProfileMedia(userId as string),
    enabled: Boolean(userId),
    // Empty arrays kept as the placeholder so consumers always have a
    // safe shape to render against, even before the first response.
    placeholderData: (prev) => prev,
  });

  const data = query.data;
  return {
    stats: data?.stats ?? EMPTY_STATS,
    photos: data?.photos ?? [],
    videos: data?.videos ?? [],
    // Only show loading on the very first fetch; cached revisits return
    // data immediately and `loading: false` so the UI never re-flashes
    // shimmer when the user lands back on the screen.
    loading: query.isPending && Boolean(userId),
  };
}

// Imperative invalidation for callers outside the hook (e.g. immediately
// after an upload / delete from useActivityMedia). Re-exported here so
// the call site doesn't have to know the key shape.
export function useInvalidateProfileMedia() {
  const qc = useQueryClient();
  return (userId: string) => qc.invalidateQueries({ queryKey: queryKeys.profileMedia(userId) });
}
