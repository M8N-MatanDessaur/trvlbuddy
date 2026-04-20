import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  setActivityCompleted,
} from '../services/activityMediaService';

interface State {
  loaded: boolean;
  ids: Set<string>;
  slugs: Set<string>;
  // activity_id -> slug, so when we toggle locally we can mirror the change
  // into the slugs set without a refetch.
  slugById: Map<string, string>;
}

interface UseCompletedActivitiesResult {
  loaded: boolean;
  completedIds: Set<string>;
  completedSlugs: Set<string>;
  isCompleted: (activityId: string | null | undefined) => boolean;
  isCompletedSlug: (slug: string | null | undefined) => boolean;
  toggle: (activityId: string, slug?: string | null) => Promise<{ ok: boolean; nextCompleted: boolean }>;
}

/**
 * One source of truth for "I did this" -- shared between the Explore cards,
 * the Trip dashboard's Done section, and the Map's done-overlay.
 */
export function useCompletedActivities(): UseCompletedActivitiesResult {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    loaded: false,
    ids: new Set(),
    slugs: new Set(),
    slugById: new Map(),
  });

  useEffect(() => {
    let alive = true;
    if (!user) {
      setState({ loaded: true, ids: new Set(), slugs: new Set(), slugById: new Map() });
      return;
    }
    // Join activity_completions -> activities so we get the slug too. The
    // dashboard filters by slug (since GeneratedActivity carries the slug
    // before it's been linked to a supabase row id).
    supabase
      .from('activity_completions')
      .select('activity_id, activities(slug)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!alive) return;
        const ids = new Set<string>();
        const slugs = new Set<string>();
        const slugById = new Map<string, string>();
        (data || []).forEach((row) => {
          const id = (row as { activity_id?: string }).activity_id;
          const slug = (row as { activities?: { slug?: string } | { slug?: string }[] | null }).activities;
          if (!id) return;
          ids.add(id);
          // PostgREST returns the embedded relation as a single object when
          // the FK is unique, or an array; handle both.
          const slugStr = Array.isArray(slug) ? slug[0]?.slug : slug?.slug;
          if (slugStr) {
            slugs.add(slugStr);
            slugById.set(id, slugStr);
          }
        });
        setState({ loaded: true, ids, slugs, slugById });
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

  const isCompletedSlug = useCallback(
    (slug: string | null | undefined): boolean => {
      if (!slug) return false;
      return state.slugs.has(slug);
    },
    [state.slugs],
  );

  const toggle = useCallback<UseCompletedActivitiesResult['toggle']>(
    async (activityId, slug) => {
      if (!user || !activityId) return { ok: false, nextCompleted: false };
      const wasCompleted = state.ids.has(activityId);
      const next = !wasCompleted;
      const knownSlug = slug || state.slugById.get(activityId) || null;

      // Optimistic update on both sets.
      setState((prev) => {
        const ids = new Set(prev.ids);
        const slugs = new Set(prev.slugs);
        const slugById = new Map(prev.slugById);
        if (next) {
          ids.add(activityId);
          if (knownSlug) {
            slugs.add(knownSlug);
            slugById.set(activityId, knownSlug);
          }
        } else {
          ids.delete(activityId);
          if (knownSlug) slugs.delete(knownSlug);
        }
        return { ...prev, ids, slugs, slugById };
      });

      const { error } = await setActivityCompleted({ userId: user.id, activityId, completed: next });
      if (error) {
        // Roll back on failure.
        setState((prev) => {
          const ids = new Set(prev.ids);
          const slugs = new Set(prev.slugs);
          if (wasCompleted) {
            ids.add(activityId);
            if (knownSlug) slugs.add(knownSlug);
          } else {
            ids.delete(activityId);
            if (knownSlug) slugs.delete(knownSlug);
          }
          return { ...prev, ids, slugs };
        });
        return { ok: false, nextCompleted: wasCompleted };
      }
      return { ok: true, nextCompleted: next };
    },
    [user, state.ids, state.slugById],
  );

  return {
    loaded: state.loaded,
    completedIds: state.ids,
    completedSlugs: state.slugs,
    isCompleted,
    isCompletedSlug,
    toggle,
  };
}
