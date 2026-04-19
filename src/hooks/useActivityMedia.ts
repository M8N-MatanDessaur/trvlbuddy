import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureActivity,
  listActivityImageUrls,
  uploadActivityImage,
  type ActivityKey,
} from '../services/activityMediaService';

interface State {
  loading: boolean;
  images: string[];
  activityId: string | null;
  error: string | null;
  uploading: boolean;
}

interface UseActivityMediaResult extends State {
  upload: (file: File) => Promise<{ ok: boolean; error?: string | null }>;
  refresh: () => Promise<void>;
}

export function useActivityMedia(key: ActivityKey | null): UseActivityMediaResult {
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<State>({
    loading: false,
    images: [],
    activityId: null,
    error: null,
    uploading: false,
  });
  const resolvedKeyRef = useRef<string>('');

  const load = useCallback(async (k: ActivityKey) => {
    const sig = JSON.stringify(k);
    if (sig === resolvedKeyRef.current) return;
    resolvedKeyRef.current = sig;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const activity = await ensureActivity(k, user?.id ?? null);
      if (!activity) {
        setState({ loading: false, images: [], activityId: null, error: 'Could not ensure activity', uploading: false });
        return;
      }
      const urls = await listActivityImageUrls(activity.id);
      setState({ loading: false, images: urls, activityId: activity.id, error: null, uploading: false });
    } catch (err: unknown) {
      setState({ loading: false, images: [], activityId: null, error: err instanceof Error ? err.message : String(err), uploading: false });
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
      const { url, error } = await uploadActivityImage({
        activityId: state.activityId,
        uploaderId: user.id,
        file,
      });
      if (error || !url) {
        setState((s) => ({ ...s, uploading: false, error }));
        return { ok: false, error };
      }
      setState((s) => ({
        ...s,
        uploading: false,
        images: [url, ...s.images],
      }));
      refreshProfile().catch(() => {});
      return { ok: true };
    },
    [user, state.activityId, refreshProfile]
  );

  const refresh = useCallback(async () => {
    if (!state.activityId) return;
    const urls = await listActivityImageUrls(state.activityId);
    setState((s) => ({ ...s, images: urls }));
  }, [state.activityId]);

  return { ...state, upload, refresh };
}
