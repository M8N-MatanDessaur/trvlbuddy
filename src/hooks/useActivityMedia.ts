import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
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
import { queryKeys } from '../lib/queryKeys';

// -------- Public types --------

export type ActivityMediaItem =
  | { kind: 'image'; createdAt: string; data: ActivityImageMedia }
  | { kind: 'video'; createdAt: string; data: ActivityVideoMedia };

interface ActivityMediaSnapshot {
  images: ActivityImageMedia[];
  videos: ActivityVideoMedia[];
  activityId: string | null;
  vote: ActivityVoteState;
}

interface State extends ActivityMediaSnapshot {
  loading: boolean;
  imageUrls: string[];
  mediaItems: ActivityMediaItem[];
  error: string | null;
  uploading: boolean;
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

const EMPTY_SNAPSHOT: ActivityMediaSnapshot = {
  images: [],
  videos: [],
  activityId: null,
  vote: ZERO_VOTE_STATE,
};

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

async function fetchActivityMedia(
  key: ActivityKey,
  viewerId: string | null,
): Promise<ActivityMediaSnapshot> {
  const activity = await ensureActivity(key, viewerId);
  if (!activity) throw new Error('Could not ensure activity');

  const [imagesResult, videosResult, voteResult] = await Promise.allSettled([
    listActivityImages(activity.id, viewerId),
    listActivityVideos(activity.id, viewerId),
    getActivityVoteState(activity.id, viewerId),
  ]);
  const images = imagesResult.status === 'fulfilled' ? imagesResult.value : [];
  const videos = videosResult.status === 'fulfilled' ? videosResult.value : [];
  const vote = voteResult.status === 'fulfilled' ? voteResult.value : ZERO_VOTE_STATE;

  try {
    warmImageCache([
      ...images.map((image) => image.url),
      ...videos.map((video) => video.posterUrl).filter((u): u is string => Boolean(u)),
    ]);
  } catch {
    /* noop */
  }

  return { images, videos, activityId: activity.id, vote };
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

// -------- The hook --------

export function useActivityMedia(key: ActivityKey | null): UseActivityMediaResult {
  const { user, refreshProfile } = useAuth();
  const viewerId = user?.id ?? null;
  const qc = useQueryClient();

  const queryKey = useMemo(
    () => (key ? queryKeys.activityMedia(key, viewerId) : ['activity-media', null, viewerId] as const),
    [key, viewerId],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchActivityMedia(key as ActivityKey, viewerId),
    enabled: Boolean(key),
    placeholderData: (prev) => prev,
  });

  const snapshot = query.data ?? EMPTY_SNAPSHOT;
  const mediaItems = useMemo(
    () => mergeMedia(snapshot.images, snapshot.videos),
    [snapshot.images, snapshot.videos],
  );

  // Helper: read the current snapshot from the cache (used inside
  // mutation handlers so optimistic updates always start from the
  // freshest value, not a stale closure).
  const readSnapshot = useCallback((): ActivityMediaSnapshot => {
    return qc.getQueryData<ActivityMediaSnapshot>(queryKey) ?? EMPTY_SNAPSHOT;
  }, [qc, queryKey]);

  const writeSnapshot = useCallback(
    (next: ActivityMediaSnapshot | ((prev: ActivityMediaSnapshot) => ActivityMediaSnapshot)) => {
      qc.setQueryData<ActivityMediaSnapshot>(queryKey, (prev) => {
        const base = prev ?? EMPTY_SNAPSHOT;
        return typeof next === 'function' ? (next as (p: ActivityMediaSnapshot) => ActivityMediaSnapshot)(base) : next;
      });
    },
    [qc, queryKey],
  );

  // Resolve the activityId, awaiting an in-flight load if needed. This
  // replaces the old "Activity not ready yet" toasts: actions wait on
  // the read query rather than failing immediately.
  const ensureActivityId = useCallback(async (): Promise<string | null> => {
    const cached = readSnapshot();
    if (cached.activityId) return cached.activityId;
    if (!key) return null;
    const fresh = await qc.fetchQuery({
      queryKey,
      queryFn: () => fetchActivityMedia(key, viewerId),
    });
    return fresh.activityId;
  }, [readSnapshot, key, qc, queryKey, viewerId]);

  // ---- Vote mutation ----

  const voteMutation = useMutation({
    mutationFn: async (next: 0 | 1 | -1) => {
      if (!user) throw new Error('Sign in required');
      const activityId = await ensureActivityId();
      if (!activityId) throw new Error('Could not load activity');
      const { error } = await setActivityVote({ activityId, userId: user.id, value: next });
      if (error) throw new Error(error);
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey });
      const previous = readSnapshot();
      writeSnapshot((prev) => ({
        ...prev,
        vote: computeOptimisticVote(prev.vote, next),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) writeSnapshot(ctx.previous);
    },
  });

  const setVote = useCallback<UseActivityMediaResult['setVote']>(
    async (next) => {
      try {
        await voteMutation.mutateAsync(next);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [voteMutation],
  );

  // ---- Image like mutation ----

  const likeMutation = useMutation({
    mutationFn: async ({ image, liked }: { image: ActivityImageMedia; liked: boolean }) => {
      if (!user) throw new Error('Sign in required');
      const { error } = await setActivityImageLiked({ imageId: image.id, userId: user.id, liked });
      if (error) throw new Error(error);
      return { image, liked };
    },
    onMutate: async ({ image, liked }) => {
      await qc.cancelQueries({ queryKey });
      const previous = readSnapshot();
      writeSnapshot((prev) => ({
        ...prev,
        images: prev.images.map((item) => {
          if (item.id !== image.id || item.likedByViewer === liked) return item;
          return {
            ...item,
            likedByViewer: liked,
            likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)),
          };
        }),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) writeSnapshot(ctx.previous);
    },
    onSuccess: () => {
      refreshProfile().catch(() => {});
    },
  });

  const setImageLiked = useCallback<UseActivityMediaResult['setImageLiked']>(
    async (image, liked) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      if (image.uploaded_by === user.id) return { ok: true, ignored: true };
      try {
        await likeMutation.mutateAsync({ image, liked });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [user, likeMutation],
  );

  // ---- Image upload mutation ----

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Sign in required');
      const activityId = await ensureActivityId();
      if (!activityId) throw new Error('Could not load activity');
      const { image, error } = await uploadActivityImage({
        activityId,
        uploaderId: user.id,
        file,
      });
      if (error || !image) throw new Error(error ?? 'Upload failed');
      return image;
    },
    onSuccess: (image) => {
      writeSnapshot((prev) => ({
        ...prev,
        images: [image, ...prev.images],
      }));
      refreshProfile().catch(() => {});
    },
  });

  const upload = useCallback<UseActivityMediaResult['upload']>(
    async (file) => {
      try {
        await uploadMutation.mutateAsync(file);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [uploadMutation],
  );

  // ---- Video upload mutation ----

  const videoUploadMutation = useMutation({
    mutationFn: async ({
      result,
      onProgress,
    }: {
      result: TrimResult;
      onProgress?: (p: number) => void;
    }) => {
      if (!user) throw new Error('Sign in required');
      const activityId = await ensureActivityId();
      if (!activityId) throw new Error('Could not load activity');
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
      if (error || !video) throw new Error(error ?? 'Upload failed');
      return video;
    },
    onSuccess: (video) => {
      writeSnapshot((prev) => ({
        ...prev,
        videos: [video, ...prev.videos],
      }));
      refreshProfile().catch(() => {});
    },
  });

  const uploadVideoFn = useCallback<UseActivityMediaResult['uploadVideo']>(
    async (result, onProgress) => {
      try {
        await videoUploadMutation.mutateAsync({ result, onProgress });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [videoUploadMutation],
  );

  // ---- Comment mutations ----

  const addCommentMutation = useMutation({
    mutationFn: async ({
      image,
      body,
      parentCommentId,
    }: {
      image: ActivityImageMedia;
      body: string;
      parentCommentId?: string | null;
    }) => {
      if (!user) throw new Error('Sign in required');
      const { comment, error } = await addActivityImageComment({
        imageId: image.id,
        userId: user.id,
        body,
        parentCommentId,
      });
      if (error || !comment) throw new Error(error ?? 'Comment failed');
      return image;
    },
    // Optimistic: bump the comment count immediately so the UI feels
    // instant. Cancel any in-flight refetch first so it can't overwrite
    // the optimistic value with a stale server snapshot. Snapshot the
    // previous state so we can roll back on error.
    onMutate: async ({ image }) => {
      await qc.cancelQueries({ queryKey });
      const previous = readSnapshot();
      writeSnapshot((prev) => ({
        ...prev,
        images: prev.images.map((item) =>
          item.id === image.id ? { ...item, commentCount: item.commentCount + 1 } : item,
        ),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) writeSnapshot(ctx.previous);
    },
  });

  const addImageCommentFn = useCallback<UseActivityMediaResult['addImageComment']>(
    async (image, body, parentCommentId) => {
      try {
        await addCommentMutation.mutateAsync({ image, body, parentCommentId });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [addCommentMutation],
  );

  const removeImageCommentFn = useCallback<UseActivityMediaResult['removeImageComment']>(
    (image) => {
      writeSnapshot((prev) => ({
        ...prev,
        images: prev.images.map((item) =>
          item.id === image.id
            ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
            : item,
        ),
      }));
    },
    [writeSnapshot],
  );

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey });
  }, [qc, queryKey]);

  return {
    images: snapshot.images,
    videos: snapshot.videos,
    activityId: snapshot.activityId,
    vote: snapshot.vote,
    imageUrls: snapshot.images.map((image) => image.url),
    mediaItems,
    loading: query.isPending && Boolean(key),
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
    uploading: uploadMutation.isPending || videoUploadMutation.isPending,
    upload,
    uploadVideo: uploadVideoFn,
    setImageLiked,
    addImageComment: addImageCommentFn,
    removeImageComment: removeImageCommentFn,
    setVote,
    refresh,
  };
}
