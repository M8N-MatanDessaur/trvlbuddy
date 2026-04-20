import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  listMyCompletedActivityIds,
  setActivityCompleted,
} from '../services/activityMediaService';

interface State {
  loaded: boolean;
  ids: Set<string>;
}

interface UseCompletedActivitiesResult {
  loaded: boolean;
  completedIds: Set<string>;
  isCompleted: (activityId: string | null | undefined) => boolean;
  toggle: (activityId: string) => Promise<{ ok: boolean; nextCompleted: boolean }>;
}

/**
 * One source of truth for "I did this" -- shared between the Explore cards,
 * the Trip dashboard's Done section, and the Map's done-overlay.
 */
export function useCompletedActivities(): UseCompletedActivitiesResult {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ loaded: false, ids: new Set() });

  useEffect(() => {
    let alive = true;
    if (!user) {
      setState({ loaded: true, ids: new Set() });
      return;
    }
    listMyCompletedActivityIds(user.id).then((ids) => {
      if (!alive) return;
      setState({ loaded: true, ids });
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const isCompleted = useCallback(
    (activityId: string | null | undefined): boolean => {
      if (!activityId) return false;
      return state.ids.has(activityId);
    },
    [state.ids],
  );

  const toggle = useCallback<UseCompletedActivitiesResult['toggle']>(
    async (activityId) => {
      if (!user || !activityId) return { ok: false, nextCompleted: false };
      const wasCompleted = state.ids.has(activityId);
      const next = !wasCompleted;
      // Optimistic update.
      setState((prev) => {
        const ids = new Set(prev.ids);
        if (next) ids.add(activityId);
        else ids.delete(activityId);
        return { ...prev, ids };
      });
      const { error } = await setActivityCompleted({ userId: user.id, activityId, completed: next });
      if (error) {
        // Roll back on failure.
        setState((prev) => {
          const ids = new Set(prev.ids);
          if (wasCompleted) ids.add(activityId);
          else ids.delete(activityId);
          return { ...prev, ids };
        });
        return { ok: false, nextCompleted: wasCompleted };
      }
      return { ok: true, nextCompleted: next };
    },
    [user, state.ids],
  );

  return { loaded: state.loaded, completedIds: state.ids, isCompleted, toggle };
}
