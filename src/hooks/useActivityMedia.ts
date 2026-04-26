import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ensureActivity,
  addActivityImageComment,
  listActivityImages,
  setActivityImageLiked,
  uploadActivityImage,
  getActivityVoteState,
  setActivityVote,
  ZERO_VOTE_STATE,
  type ActivityKey,
  type ActivityImageMedia,
  type ActivityVoteState,
} from '../services/activityMediaService';
import { warmImageCache } from '../lib/imagePrefetch';
import {
  uploadActivityVideo,
  listActivityVideos,
  type ActivityVideoMedia,
} from '../services/activityVideoService';
import type { TrimResult } from '../lib/videoProcess';

// -------- Public types --------

export type ActivityMediaItem =
  | { kind: 'image'; createdAt: string; data: ActivityImageMedia }
  | { kind: 'video'; createdAt: string; data: ActivityVideoMedia };

interface State {
  loading: boolean;
  images: ActivityImageMedia[];
  imageUrls: string[];
  videos: ActivityVideoMedia[];
  mediaItems: ActivityMediaItem[];
  activityId: string | null;
  error: string | null;
  uploading: boolean;
  vote: ActivityVoteState;
}

interface UseActivityMediaResult extends State {
  upload: (file: File) => Promise<{ ok: boolean; error?: string | null }>;
  uploadVideo: (
    result: TrimResult,
    onProgress?: (progress: number) => void,
  ) => Promise<{ ok: boolean; error?: string | null }>;
  setImageLiked: (
    image: ActivityImageMedia,
    liked: boolean,
  ) => Promise<{ ok: boolean; error?: string | null; ignored?: boolean }>;
  addImageComment: (
    image: ActivityImageMedia,
    body: string,
    parentCommentId?: string | null,
  ) => Promise<{ ok: boolean; error?: string | null }>;
  removeImageComment: (image: ActivityImageMedia) => void;
  setVote: (next: 0 | 1 | -1) => Promise<{ ok: boolean; error?: string | null }>;
  refresh: () => Promise<void>;
}

const EMPTY_STATE: State = {
  loading: false,
  images: [],
  imageUrls: [],
  videos: [],
  mediaItems: [],
  activityId: null,
  error: null,
  uploading: false,
  vote: ZERO_VOTE_STATE,
};

// -------- Module-level shared cache + Realtime fan-out --------
//
// Why: every <ExploreActivityCard>, <DynamicActivityModal>, and <NearbyPost>
// for the same place is its own React subtree, but they all want the same
// live data (counts, vote, media). Per-mount useState meant a vote made
// in the modal didn't show on the explore card until you scrolled away
// and back; navigating away and back re-fetched everything from scratch
// and made a slow Supabase round-trip block all the cards.
//
// Cache contract:
//   - Keyed by JSON({key, viewerId}) so different viewers see their own
//     vote / likedByViewer state without leaking across users.
//   - Realtime channel per activityId, refcounted across consumers.
//   - On any postgres_changes event for that activityId we refetch and
//     emit a new snapshot to every subscribed React component.
//   - Mutations (vote / like / comment / upload) update the cache + emit
//     immediately so the user sees their action without waiting for the
//     realtime echo to come back.

const STALE_AFTER_MS = 30_000;

interface CachedEntry {
  state: State;
  fetchedAt: number;
}

const cache = new Map<string, CachedEntry>();
const inFlight = new Map<string, Promise<State>>();
const listeners = new Map<string, Set<(state: State) => void>>();

// Realtime channel + refcount per activityId. We also track which cache
// keys are interested in each activityId so a single postgres_changes
// event fans out to every (key, viewer) pair using that activity.
interface RealtimeBinding {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
}
const realtime = new Map<string, RealtimeBinding>();
const cacheKeysByActivityId = new Map<string, Set<string>>();
// Reverse index so cleanup knows which activity to drop a listener from
// when a cache key unsubscribes.
const activityIdByCacheKey = new Map<string, string>();

function emit(cacheKey: string, state: State): void {
  const set = listeners.get(cacheKey);
  if (!set) return;
  set.forEach((fn) => fn(state));
}

function setCache(cacheKey: string, state: State): void {
  cache.set(cacheKey, { state, fetchedAt: Date.now() });
  emit(cacheKey, state);
}

function patchCache(cacheKey: string, patch: (s: State) => State): State | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  const next = patch(entry.state);
  cache.set(cacheKey, { state: next, fetchedAt: entry.fetchedAt });
  emit(cacheKey, next);
  return next;
}

function mergeMedia(
  images: ActivityImageMedia[],
  videos: ActivityVideoMedia[],
): ActivityMediaItem[] {
  const items: ActivityMediaItem[] = [
    ...images.map<ActivityMediaItem>((data) => ({ kind: 'image', createdAt: data.created_at, data })),
    ...videos.map<ActivityMediaItem>((data) => ({ kind: 'video', createdAt: data.created_at, data })),
  ];
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}

async function loadFresh(key: ActivityKey, viewerId: string | null): Promise<State> {
  const activity = await ensureActivity(key, viewerId);
  if (!activity) {
    return {
      ...EMPTY_STATE,
      error: 'Could not ensure activity',
    };
  }
  const [imagesResult, videosResult, voteResult] = await Promise.allSettled([
    listActivityImages(activity.id, viewerId),
    listActivityVideos(activity.id, viewerId),
    getActivityVoteState(activity.id, viewerId),
  ]);
  const images = imagesResult.status === 'fulfilled' ? imagesResult.value : [];
  const videos = videosResult.status === 'fulfilled' ? videosResult.value : [];
  const vote = voteResult.status === 'fulfilled' ? voteResult.value : ZERO_VOTE_STATE;
  warmImageCache([
    ...images.map((image) => image.url),
    ...videos.map((video) => video.posterUrl).filter((u): u is string => Boolean(u)),
  ]);
  return {
    loading: false,
    images,
    imageUrls: images.map((image) => image.url),
    videos,
    mediaItems: mergeMedia(images, videos),
    activityId: activity.id,
    error: null,
    uploading: false,
    vote,
  };
}

async function fetchAndCache(
  cacheKey: string,
  key: ActivityKey,
  viewerId: string | null,
): Promise<State> {
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;
  // Same timeout guard as useProfileMedia — protect every shared cache
  // entry against a hung Supabase query so cards never stay on shimmer
  // forever. 8s is generous; real responses are typically <500ms.
  const TIMEOUT_MS = 8_000;
  const promise = Promise.race([
    loadFresh(key, viewerId),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('activity fetch timeout')), TIMEOUT_MS),
    ),
  ])
    .then((state) => {
      setCache(cacheKey, state);
      if (state.activityId) {
        bindCacheKeyToActivity(cacheKey, state.activityId);
      }
      return state;
    })
    .catch((err) => {
      console.warn('[useActivityMedia] fetch failed', err);
      const cached = cache.get(cacheKey);
      if (cached) {
        // Keep showing what we had instead of wiping to shimmer.
        return cached.state;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const state: State = { ...EMPTY_STATE, error: msg };
      setCache(cacheKey, state);
      return state;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });
  inFlight.set(cacheKey, promise);
  return promise;
}

function bindCacheKeyToActivity(cacheKey: string, activityId: string): void {
  if (activityIdByCacheKey.get(cacheKey) === activityId) return;
  // If this cache key was previously bound to a different activityId
  // (rare, but happens on key changes that resolve differently),
  // unbind first.
  unbindCacheKeyFromActivity(cacheKey);
  let set = cacheKeysByActivityId.get(activityId);
  if (!set) {
    set = new Set();
    cacheKeysByActivityId.set(activityId, set);
  }
  set.add(cacheKey);
  activityIdByCacheKey.set(cacheKey, activityId);
  acquireRealtime(activityId);
}

function unbindCacheKeyFromActivity(cacheKey: string): void {
  const activityId = activityIdByCacheKey.get(cacheKey);
  if (!activityId) return;
  activityIdByCacheKey.delete(cacheKey);
  const set = cacheKeysByActivityId.get(activityId);
  if (set) {
    set.delete(cacheKey);
    if (set.size === 0) cacheKeysByActivityId.delete(activityId);
  }
  releaseRealtime(activityId);
}

function acquireRealtime(activityId: string): void {
  const existing = realtime.get(activityId);
  if (existing) {
    existing.refCount += 1;
    return;
  }
  const channel = supabase.channel(`activity-${activityId}`);
  // Listen broadly across the activity-scoped tables. Server-side
  // filters narrow to this activityId where the table has a column
  // for it; for like/comment tables the join goes via image_id, so we
  // listen to all likes/comments and gate inside the handler by
  // checking whether the affected image_id is one of ours.
  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_votes', filter: `activity_id=eq.${activityId}` },
      () => onActivityChanged(activityId),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_images', filter: `activity_id=eq.${activityId}` },
      () => onActivityChanged(activityId),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_videos', filter: `activity_id=eq.${activityId}` },
      () => onActivityChanged(activityId),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_image_likes' },
      (payload) => {
        const imageId =
          (payload.new as { image_id?: string } | undefined)?.image_id ??
          (payload.old as { image_id?: string } | undefined)?.image_id;
        if (imageId && imageBelongsToActivity(activityId, imageId)) {
          onActivityChanged(activityId);
        }
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_image_comments' },
      (payload) => {
        const imageId =
          (payload.new as { image_id?: string } | undefined)?.image_id ??
          (payload.old as { image_id?: string } | undefined)?.image_id;
        if (imageId && imageBelongsToActivity(activityId, imageId)) {
          onActivityChanged(activityId);
        }
      },
    )
    .subscribe();
  realtime.set(activityId, { channel, refCount: 1 });
}

function releaseRealtime(activityId: string): void {
  const existing = realtime.get(activityId);
  if (!existing) return;
  existing.refCount -= 1;
  if (existing.refCount <= 0) {
    supabase.removeChannel(existing.channel);
    realtime.delete(activityId);
  }
}

function imageBelongsToActivity(activityId: string, imageId: string): boolean {
  const set = cacheKeysByActivityId.get(activityId);
  if (!set) return false;
  for (const cacheKey of set) {
    const entry = cache.get(cacheKey);
    if (entry?.state.images.some((img) => img.id === imageId)) return true;
  }
  return false;
}

function onActivityChanged(activityId: string): void {
  const cacheKeys = cacheKeysByActivityId.get(activityId);
  if (!cacheKeys || cacheKeys.size === 0) return;
  // Refetch every (key, viewer) cache entry tied to this activity. Each
  // entry parses its own key so per-viewer state (myVote, likedByViewer)
  // stays correct.
  for (const cacheKey of cacheKeys) {
    const parsed = parseCacheKey(cacheKey);
    if (!parsed) continue;
    fetchAndCache(cacheKey, parsed.key, parsed.viewerId).catch(() => {
      /* error already captured into cache */
    });
  }
}

function makeCacheKey(key: ActivityKey, viewerId: string | null): string {
  return JSON.stringify({ key, viewerId });
}

function parseCacheKey(cacheKey: string): { key: ActivityKey; viewerId: string | null } | null {
  try {
    return JSON.parse(cacheKey);
  } catch {
    return null;
  }
}

// External invalidation hook for callers that just mutated server state
// outside this module (e.g. trip-content moves an activity_image row).
export function invalidateActivityMedia(key: ActivityKey, viewerId: string | null): void {
  const cacheKey = makeCacheKey(key, viewerId);
  fetchAndCache(cacheKey, key, viewerId).catch(() => { /* swallowed */ });
}

// -------- The hook --------

export function useActivityMedia(key: ActivityKey | null): UseActivityMediaResult {
  const { user, refreshProfile } = useAuth();
  const viewerId = user?.id ?? null;
  const cacheKey = useMemo(
    () => (key ? makeCacheKey(key, viewerId) : null),
    [key, viewerId],
  );

  const [state, setState] = useState<State>(() => {
    if (!cacheKey) return EMPTY_STATE;
    const cached = cache.get(cacheKey);
    if (cached) return cached.state;
    return { ...EMPTY_STATE, loading: true };
  });

  useEffect(() => {
    if (!cacheKey || !key) {
      setState(EMPTY_STATE);
      return;
    }

    let listenerSet = listeners.get(cacheKey);
    if (!listenerSet) {
      listenerSet = new Set();
      listeners.set(cacheKey, listenerSet);
    }
    const onChange = (s: State) => setState(s);
    listenerSet.add(onChange);

    const cached = cache.get(cacheKey);
    if (cached) {
      setState(cached.state);
      // Re-bind realtime in case the activity was previously known but
      // the channel was released between mounts.
      if (cached.state.activityId) {
        bindCacheKeyToActivity(cacheKey, cached.state.activityId);
      }
      const isStale = Date.now() - (cache.get(cacheKey)?.fetchedAt ?? 0) > STALE_AFTER_MS;
      if (isStale) {
        fetchAndCache(cacheKey, key, viewerId).catch(() => { /* swallowed */ });
      }
    } else {
      setState({ ...EMPTY_STATE, loading: true });
      fetchAndCache(cacheKey, key, viewerId).catch(() => { /* swallowed */ });
    }

    return () => {
      listenerSet?.delete(onChange);
      if (listenerSet && listenerSet.size === 0) {
        listeners.delete(cacheKey);
        // Last consumer for this cache key — release the realtime tie.
        unbindCacheKeyFromActivity(cacheKey);
      }
    };
  }, [cacheKey, key, viewerId]);

  // Resolves to the current activityId, awaiting the in-flight load when
  // the cache is mid-fetch. Fixes "Activity not ready yet" toasts that
  // appeared whenever a user clicked vote / upload during the first
  // ~200ms of a card mount.
  const ensureActivityId = useCallback(async (): Promise<string | null> => {
    if (!cacheKey || !key) return null;
    const cached = cache.get(cacheKey);
    if (cached?.state.activityId) return cached.state.activityId;
    const fresh = await fetchAndCache(cacheKey, key, viewerId);
    return fresh.activityId;
  }, [cacheKey, key, viewerId]);

  const upload = useCallback<UseActivityMediaResult['upload']>(
    async (file) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      const activityId = await ensureActivityId();
      if (!activityId) return { ok: false, error: 'Could not load activity' };
      patchCache(cacheKey!, (s) => ({ ...s, uploading: true, error: null }));
      const { image, error } = await uploadActivityImage({
        activityId,
        uploaderId: user.id,
        file,
      });
      if (error || !image) {
        patchCache(cacheKey!, (s) => ({ ...s, uploading: false, error }));
        return { ok: false, error };
      }
      patchCache(cacheKey!, (s) => ({
        ...s,
        uploading: false,
        images: [image, ...s.images],
        imageUrls: [image.url, ...s.imageUrls],
        mediaItems: mergeMedia([image, ...s.images], s.videos),
      }));
      refreshProfile().catch(() => {});
      return { ok: true };
    },
    [user, cacheKey, ensureActivityId, refreshProfile],
  );

  const uploadVideoFn = useCallback<UseActivityMediaResult['uploadVideo']>(
    async (result, onProgress) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      const activityId = await ensureActivityId();
      if (!activityId) return { ok: false, error: 'Could not load activity' };
      patchCache(cacheKey!, (s) => ({ ...s, uploading: true, error: null }));
      const { video, error } = await uploadActivityVideo({
        activityId,
        uploaderId: user.id,
        video: result.video,
        poster: result.poster,
        durationMs: result.durationMs,
        startMs: result.startMs,
        width: result.width,
        height: result.height,
        onProgress,
      });
      if (error || !video) {
        patchCache(cacheKey!, (s) => ({ ...s, uploading: false, error }));
        return { ok: false, error };
      }
      patchCache(cacheKey!, (s) => ({
        ...s,
        uploading: false,
        videos: [video, ...s.videos],
        mediaItems: mergeMedia(s.images, [video, ...s.videos]),
      }));
      refreshProfile().catch(() => {});
      return { ok: true };
    },
    [user, cacheKey, ensureActivityId, refreshProfile],
  );

  const setImageLiked = useCallback<UseActivityMediaResult['setImageLiked']>(
    async (image, liked) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      if (image.uploaded_by === user.id) return { ok: true, ignored: true };

      patchCache(cacheKey!, (s) => ({
        ...s,
        images: s.images.map((item) => {
          if (item.id !== image.id || item.likedByViewer === liked) return item;
          return {
            ...item,
            likedByViewer: liked,
            likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)),
          };
        }),
      }));

      const { error } = await setActivityImageLiked({
        imageId: image.id,
        userId: user.id,
        liked,
      });

      if (error) {
        // Revert.
        patchCache(cacheKey!, (s) => ({
          ...s,
          error,
          images: s.images.map((item) => {
            if (item.id !== image.id || item.likedByViewer === !liked) return item;
            return {
              ...item,
              likedByViewer: !liked,
              likeCount: Math.max(0, item.likeCount + (liked ? -1 : 1)),
            };
          }),
        }));
        return { ok: false, error };
      }

      refreshProfile().catch(() => {});
      return { ok: true };
    },
    [user, cacheKey, refreshProfile],
  );

  const addImageCommentFn = useCallback<UseActivityMediaResult['addImageComment']>(
    async (image, body, parentCommentId) => {
      if (!user) return { ok: false, error: 'Sign in required' };

      const { comment, error } = await addActivityImageComment({
        imageId: image.id,
        userId: user.id,
        body,
        parentCommentId,
      });

      if (error || !comment) return { ok: false, error };

      patchCache(cacheKey!, (s) => ({
        ...s,
        images: s.images.map((item) => (
          item.id === image.id
            ? { ...item, commentCount: item.commentCount + 1 }
            : item
        )),
      }));

      return { ok: true };
    },
    [user, cacheKey],
  );

  const removeImageCommentFn = useCallback<UseActivityMediaResult['removeImageComment']>(
    (image) => {
      patchCache(cacheKey!, (s) => ({
        ...s,
        images: s.images.map((item) => (
          item.id === image.id
            ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
            : item
        )),
      }));
    },
    [cacheKey],
  );

  const setVoteFn = useCallback<UseActivityMediaResult['setVote']>(
    async (next) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      const activityId = await ensureActivityId();
      if (!activityId) return { ok: false, error: 'Could not load activity' };

      const previous = cache.get(cacheKey!)?.state.vote ?? ZERO_VOTE_STATE;
      const optimistic = computeOptimisticVote(previous, next);
      patchCache(cacheKey!, (s) => ({ ...s, vote: optimistic }));

      const { error } = await setActivityVote({
        activityId,
        userId: user.id,
        value: next,
      });

      if (error) {
        patchCache(cacheKey!, (s) => ({ ...s, vote: previous, error }));
        return { ok: false, error };
      }
      return { ok: true };
    },
    [user, cacheKey, ensureActivityId],
  );

  const refresh = useCallback(async () => {
    if (!cacheKey || !key) return;
    await fetchAndCache(cacheKey, key, viewerId);
  }, [cacheKey, key, viewerId]);

  return {
    ...state,
    upload,
    uploadVideo: uploadVideoFn,
    setImageLiked,
    addImageComment: addImageCommentFn,
    removeImageComment: removeImageCommentFn,
    setVote: setVoteFn,
    refresh,
  };
}

function computeOptimisticVote(prev: ActivityVoteState, next: 0 | 1 | -1): ActivityVoteState {
  const upDelta = (next === 1 ? 1 : 0) - (prev.myVote === 1 ? 1 : 0);
  const downDelta = (next === -1 ? 1 : 0) - (prev.myVote === -1 ? 1 : 0);
  return {
    score: prev.score - prev.myVote + next,
    upvotes: Math.max(0, prev.upvotes + upDelta),
    downvotes: Math.max(0, prev.downvotes + downDelta),
    myVote: next,
  };
}
