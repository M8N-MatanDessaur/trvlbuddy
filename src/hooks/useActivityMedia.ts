import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureActivity,
  addActivityImageComment,
  listActivityImages,
  setActivityImageLiked,
  uploadActivityImage,
  type ActivityKey,
  type ActivityImageMedia,
} from '../services/activityMediaService';

interface State {
  loading: boolean;
  images: ActivityImageMedia[];
  imageUrls: string[];
  activityId: string | null;
  error: string | null;
  uploading: boolean;
}

interface UseActivityMediaResult extends State {
  upload: (file: File) => Promise<{ ok: boolean; error?: string | null }>;
  setImageLiked: (image: ActivityImageMedia, liked: boolean) => Promise<{ ok: boolean; error?: string | null; ignored?: boolean }>;
  addImageComment: (image: ActivityImageMedia, body: string, parentCommentId?: string | null) => Promise<{ ok: boolean; error?: string | null }>;
  removeImageComment: (image: ActivityImageMedia) => void;
  refresh: () => Promise<void>;
}

export function useActivityMedia(key: ActivityKey | null): UseActivityMediaResult {
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<State>({
    loading: false,
    images: [],
    imageUrls: [],
    activityId: null,
    error: null,
    uploading: false,
  });
  const resolvedKeyRef = useRef<string>('');

  const load = useCallback(async (k: ActivityKey) => {
    const sig = JSON.stringify({ key: k, viewerId: user?.id ?? null });
    if (sig === resolvedKeyRef.current) return;
    resolvedKeyRef.current = sig;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const activity = await ensureActivity(k, user?.id ?? null);
      if (!activity) {
        setState({ loading: false, images: [], imageUrls: [], activityId: null, error: 'Could not ensure activity', uploading: false });
        return;
      }
      const images = await listActivityImages(activity.id, user?.id ?? null);
      setState({ loading: false, images, imageUrls: images.map((image) => image.url), activityId: activity.id, error: null, uploading: false });
    } catch (err: unknown) {
      setState({ loading: false, images: [], imageUrls: [], activityId: null, error: err instanceof Error ? err.message : String(err), uploading: false });
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
      }));
      refreshProfile().catch(() => {});
      return { ok: true };
    },
    [user, state.activityId, refreshProfile]
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

  const refresh = useCallback(async () => {
    if (!state.activityId) return;
    const images = await listActivityImages(state.activityId, user?.id ?? null);
    setState((s) => ({ ...s, images, imageUrls: images.map((image) => image.url) }));
  }, [state.activityId, user?.id]);

  return { ...state, upload, setImageLiked, addImageComment, removeImageComment, refresh };
}
