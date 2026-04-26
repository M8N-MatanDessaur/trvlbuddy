import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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

// Race a task against an AbortController-driven timeout. The task
// receives the signal so it can actually cancel the underlying network
// request instead of letting it run on after the wrapper rejects --
// previously the request kept burning battery / data even though the
// wrapper had given up.
function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try { ctrl.abort(new Error(`${label} timed out after ${ms}ms`)); } catch { ctrl.abort(); }
  }, ms);
  return task(ctrl.signal).finally(() => clearTimeout(timer));
}

const PROFILE_QUERY_TIMEOUT_MS = 12_000;

async function fetchProfileMedia(userId: string, qc: QueryClient): Promise<ProfileMediaSnapshot> {
  // Read whatever we last had for this user. When a sub-query rejects
  // (timeout or network error), we fall back to the prior value
  // instead of fabricating a fake-empty result -- that's the
  // "loads forever then says 0 posts" bug Codex flagged.
  const prior = qc.getQueryData<ProfileMediaSnapshot>(queryKeys.profileMedia(userId));

  const [statsResult, photosResult, videosResult] = await Promise.allSettled([
    withTimeout((signal) => getUserSocialStats(userId, signal), PROFILE_QUERY_TIMEOUT_MS, 'stats'),
    withTimeout((signal) => listUserPhotos(userId, signal), PROFILE_QUERY_TIMEOUT_MS, 'photos'),
    withTimeout((signal) => listUserVideos(userId, signal), PROFILE_QUERY_TIMEOUT_MS, 'videos'),
  ]);

  if (statsResult.status === 'rejected') console.warn('[profile] stats failed', statsResult.reason);
  if (photosResult.status === 'rejected') console.warn('[profile] photos failed', photosResult.reason);
  if (videosResult.status === 'rejected') console.warn('[profile] videos failed', videosResult.reason);

  // Per-bucket fallback: rejected -> prior value (or safe-empty if no
  // prior). This means a transient timeout never blanks out real data
  // the user just saw a moment ago.
  const stats = statsResult.status === 'fulfilled'
    ? statsResult.value
    : prior?.stats ?? { postCount: 0, likesReceived: 0, commentsReceived: 0 };
  const photos = photosResult.status === 'fulfilled'
    ? photosResult.value
    : prior?.photos ?? [];
  const videos = videosResult.status === 'fulfilled'
    ? videosResult.value
    : prior?.videos ?? [];

  // If EVERY query rejected AND we have no prior cache, throw so React
  // Query enters an error state and the next mount retries.
  if (
    statsResult.status === 'rejected' &&
    photosResult.status === 'rejected' &&
    videosResult.status === 'rejected' &&
    !prior
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
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.profileMedia(userId),
    queryFn: () => fetchProfileMedia(userId as string, qc),
    enabled: Boolean(userId),
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
