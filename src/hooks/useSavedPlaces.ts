import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  listSavedPlaceIds,
  savePlace,
  unsavePlace,
} from '../services/savedPlacesService';
import type { NearbyPlace } from '../services/nearbyService';

// Module-level cache of the current user's saved place_ids. Lets every
// NearbyPost render the right bookmark state without each one re-querying
// Supabase. Listeners get called on every mutation so cards stay in sync
// across the feed (and across the Saved view) without prop drilling.
let cachedUserId: string | null = null;
let cachedIds: Set<string> | null = null;
let inFlight: Promise<Set<string>> | null = null;
const listeners = new Set<(ids: Set<string>) => void>();

function notify() {
  if (!cachedIds) return;
  const snapshot = new Set(cachedIds);
  listeners.forEach((fn) => fn(snapshot));
}

async function ensureLoaded(userId: string): Promise<Set<string>> {
  if (cachedUserId !== userId) {
    cachedUserId = userId;
    cachedIds = null;
    inFlight = null;
  }
  if (cachedIds) return cachedIds;
  if (!inFlight) {
    inFlight = listSavedPlaceIds(userId).then((ids) => {
      cachedIds = ids;
      inFlight = null;
      notify();
      return ids;
    });
  }
  return inFlight;
}

export function invalidateSavedPlacesCache() {
  cachedIds = null;
  inFlight = null;
}

// Per-place hook: { saved, toggle, busy }. The toggle is optimistic --
// the bookmark flips immediately and reverts on error so the user never
// stares at a spinner waiting for the round-trip.
export function useSavedPlace(place: NearbyPlace | null) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const placeIdRef = useRef<string | null>(null);

  useEffect(() => {
    placeIdRef.current = place?.placeId ?? null;
    if (!user?.id || !place?.placeId) {
      setSaved(false);
      return;
    }
    let cancelled = false;
    ensureLoaded(user.id).then((ids) => {
      if (cancelled) return;
      if (placeIdRef.current !== place.placeId) return;
      setSaved(ids.has(place.placeId));
    });
    const listener = (ids: Set<string>) => {
      if (placeIdRef.current !== place.placeId) return;
      setSaved(ids.has(place.placeId));
    };
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, [user?.id, place?.placeId]);

  const toggle = useCallback(async (): Promise<{ ok: boolean; nextSaved: boolean; error?: string }> => {
    if (!user?.id || !place?.placeId) {
      return { ok: false, nextSaved: saved, error: 'Sign in to save places' };
    }
    const next = !saved;
    setBusy(true);
    setSaved(next);
    if (cachedIds) {
      if (next) cachedIds.add(place.placeId);
      else cachedIds.delete(place.placeId);
      notify();
    }
    const result = next
      ? await savePlace(user.id, place)
      : await unsavePlace(user.id, place.placeId);
    setBusy(false);
    if (!result.ok) {
      // Revert optimistic state on failure.
      setSaved(!next);
      if (cachedIds) {
        if (next) cachedIds.delete(place.placeId);
        else cachedIds.add(place.placeId);
        notify();
      }
      return { ok: false, nextSaved: saved, error: result.error };
    }
    return { ok: true, nextSaved: next };
  }, [user?.id, place, saved]);

  return { saved, toggle, busy };
}
