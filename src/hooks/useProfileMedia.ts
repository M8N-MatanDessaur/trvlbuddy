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

async function fetchProfileMedia(userId: string): Promise<ProfileMediaSnapshot> {
  const [stats, photos, videos] = await Promise.all([
    getUserSocialStats(userId),
    listUserPhotos(userId),
    listUserVideos(userId),
  ]);
  // Warm the SW image cache for the most relevant URLs so the next grid
  // render hits cache instead of network. Best-effort; never throws.
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
