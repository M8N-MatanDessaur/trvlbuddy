import { useCallback, useEffect, useRef, useState } from 'react';
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

// Unified carousel/grid item. Either an image (from activity_images) or a
// video (from activity_videos). The two tables have distinct shapes; the
// `kind` discriminator lets the UI render each correctly without forcing
// one schema to pretend to be the other.
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
  setImageLiked: (image: ActivityImageMedia, liked: boolean) => Promise<{ ok: boolean; error?: string | null; ignored?: boolean }>;
  addImageComment: (image: ActivityImageMedia, body: string, parentCommentId?: string | null) => Promise<{ ok: boolean; error?: string | null }>;
  removeImageComment: (image: ActivityImageMedia) => void;
  setVote: (next: 0 | 1 | -1) => Promise<{ ok: boolean; error?: string | null }>;
  refresh: () => Promise<void>;
}

export function useActivityMedia(key: ActivityKey | null): UseActivityMediaResult {
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<State>({
    loading: false,
    images: [],
    imageUrls: [],
    videos: [],
    mediaItems: [],
    activityId: null,
    error: null,
    uploading: false,
    vote: ZERO_VOTE_STATE,
  });
  const resolvedKeyRef = useRef<string>('');

  // Merge images + videos into one chronological list so the carousel
  // can render them interleaved by upload time, matching what users
  // expect from a feed.
  const mergeMedia = (
    images: ActivityImageMedia[],
    videos: ActivityVideoMedia[],
  ): ActivityMediaItem[] => {
    const items: ActivityMediaItem[] = [
      ...images.map<ActivityMediaItem>((data) => ({ kind: 'image', createdAt: data.created_at, data })),
      ...videos.map<ActivityMediaItem>((data) => ({ kind: 'video', createdAt: data.created_at, data })),
    ];
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return items;
  };

  const load = useCallback(async (k: ActivityKey) => {
    const sig = JSON.stringify({ key: k, viewerId: user?.id ?? null });
    if (sig === resolvedKeyRef.current) return;
    resolvedKeyRef.current = sig;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const activity = await ensureActivity(k, user?.id ?? null);
      if (!activity) {
        setState({ loading: false, images: [], imageUrls: [], activityId: null, error: 'Could not ensure activity', uploading: false, vote: ZERO_VOTE_STATE });
        return;
      }
      // Run images + videos + vote independently so a single-table miss
      // (e.g. a view that isn't migrated yet) can't wipe the others.
      const [imagesResult, videosResult, voteResult] = await Promise.allSettled([
        listActivityImages(activity.id, user?.id ?? null),
        listActivityVideos(activity.id, user?.id ?? null),
        getActivityVoteState(activity.id, user?.id ?? null),
      ]);
      const images = imagesResult.status === 'fulfilled' ? imagesResult.value : [];
      const videos = videosResult.status === 'fulfilled' ? videosResult.value : [];
      const vote = voteResult.status === 'fulfilled' ? voteResult.value : ZERO_VOTE_STATE;
      warmImageCache([
        ...images.map((image) => image.url),
        ...videos.map((video) => video.posterUrl),
      ]);
      setState({
        loading: false,
        images,
        imageUrls: images.map((image) => image.url),
        videos,
        mediaItems: mergeMedia(images, videos),
        activityId: activity.id,
        error: null,
        uploading: false,
        vote,
      });
    } catch (err: unknown) {
      setState({
        loading: false,
        images: [],
        imageUrls: [],
        videos: [],
        mediaItems: [],
        activityId: null,
        error: err instanceof Error ? err.message : String(err),
        uploading: false,
        vote: ZERO_VOTE_STATE,
      });
    }
  }, [user?.id]);

  const keySig = key ? JSON.stringify(key) : '';
  useEffect(() => {
    if (!key) return;
    load(key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySig, load]);

  const upload = useCallback<UseActivityMediaResult['upload']>(
    async (file) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      if (!state.activityId) return { ok: false, error: 'Activity not ready yet' };
      setState((s) => ({ ...s, uploading: true, error: null }));
      const { image, error } = await uploadActivityImage({
        activityId: state.activityId,
        uploaderId: user.id,
        file,
      });
      if (error || !image) {
        setState((s) => ({ ...s, uploading: false, error }));
        return { ok: false, error };
      }
      setState((s) => ({
        ...s,
        uploading: false,
        images: [image, ...s.images],
        imageUrls: [image.url, ...s.imageUrls],
        mediaItems: mergeMedia([image, ...s.images], s.videos),
      }));
      refreshProfile().catch(() => {});
      return { ok: true };
    },
    [user, state.activityId, refreshProfile]
  );

  const uploadVideoFn = useCallback<UseActivityMediaResult['uploadVideo']>(
    async (result, onProgress) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      if (!state.activityId) return { ok: false, error: 'Activity not ready yet' };
      setState((s) => ({ ...s, uploading: true, error: null }));
      const { video, error } = await uploadActivityVideo({
        activityId: state.activityId,
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
        setState((s) => ({ ...s, uploading: false, error }));
        return { ok: false, error };
      }
      setState((s) => ({
        ...s,
        uploading: false,
        videos: [video, ...s.videos],
        mediaItems: mergeMedia(s.images, [video, ...s.videos]),
      }));
      refreshProfile().catch(() => {});
      return { ok: true };
    },
    [user, state.activityId, refreshProfile],
  );

  const setImageLiked = useCallback<UseActivityMediaResult['setImageLiked']>(
    async (image, liked) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      if (image.uploaded_by === user.id) return { ok: true, ignored: true };

      setState((s) => ({
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
        setState((s) => ({
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
    [user, refreshProfile],
  );

  const addImageComment = useCallback<UseActivityMediaResult['addImageComment']>(
    async (image, body, parentCommentId) => {
      if (!user) return { ok: false, error: 'Sign in required' };

      const { comment, error } = await addActivityImageComment({
        imageId: image.id,
        userId: user.id,
        body,
        parentCommentId,
      });

      if (error || !comment) return { ok: false, error };

      setState((s) => ({
        ...s,
        images: s.images.map((item) => (
          item.id === image.id
            ? { ...item, commentCount: item.commentCount + 1 }
            : item
        )),
      }));

      return { ok: true };
    },
    [user],
  );

  const removeImageComment = useCallback<UseActivityMediaResult['removeImageComment']>(
    (image) => {
      setState((s) => ({
        ...s,
        images: s.images.map((item) => (
          item.id === image.id
            ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
            : item
        )),
      }));
    },
    [],
  );

  const setVote = useCallback<UseActivityMediaResult['setVote']>(
    async (next) => {
      if (!user) return { ok: false, error: 'Sign in required' };
      if (!state.activityId) return { ok: false, error: 'Activity not ready yet' };

      const previous = state.vote;
      const optimistic = computeOptimisticVote(previous, next);
      setState((s) => ({ ...s, vote: optimistic }));

      const { error } = await setActivityVote({
        activityId: state.activityId,
        userId: user.id,
        value: next,
      });

      if (error) {
        setState((s) => ({ ...s, vote: previous, error }));
        return { ok: false, error };
      }
      return { ok: true };
    },
    [user, state.activityId, state.vote],
  );

  const refresh = useCallback(async () => {
    if (!state.activityId) return;
    const [images, videos, vote] = await Promise.all([
      listActivityImages(state.activityId, user?.id ?? null),
      listActivityVideos(state.activityId, user?.id ?? null),
      getActivityVoteState(state.activityId, user?.id ?? null),
    ]);
    warmImageCache([
      ...images.map((image) => image.url),
      ...videos.map((video) => video.posterUrl),
    ]);
    setState((s) => ({
      ...s,
      images,
      imageUrls: images.map((image) => image.url),
      videos,
      mediaItems: mergeMedia(images, videos),
      vote,
    }));
  }, [state.activityId, user?.id]);

  return { ...state, upload, uploadVideo: uploadVideoFn, setImageLiked, addImageComment, removeImageComment, setVote, refresh };
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
