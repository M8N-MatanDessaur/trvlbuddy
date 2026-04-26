import { useEffect, useState } from 'react';
import { listMyTrips } from '../services/tripsService';
import type { Trip } from '../lib/supabase';

// SWR cache for the signed-in user's trips list. Same shape as
// useProfileMedia: instant render on revisit, background refresh when the
// entry is stale. Used by ProfilePage, WelcomeScreen, MyTripsModal — all
// three previously re-fetched the list on every mount, which made
// returning to the WelcomeScreen carousel feel sluggish.
const STALE_AFTER_MS = 30_000;

interface Snapshot {
  trips: Trip[];
  fetchedAt: number;
}

const cache = new Map<string, Snapshot>();
const inFlight = new Map<string, Promise<Snapshot>>();
const listeners = new Map<string, Set<(snap: Snapshot) => void>>();

function emit(userId: string, snap: Snapshot): void {
  const set = listeners.get(userId);
  if (!set) return;
  set.forEach((fn) => fn(snap));
}

async function fetchTrips(userId: string): Promise<Snapshot> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const promise = listMyTrips(userId)
    .then((trips) => {
      const snap: Snapshot = { trips, fetchedAt: Date.now() };
      cache.set(userId, snap);
      emit(userId, snap);
      return snap;
    })
    .finally(() => {
      inFlight.delete(userId);
    });
  inFlight.set(userId, promise);
  return promise;
}

export function invalidateMyTrips(userId: string): void {
  cache.delete(userId);
  inFlight.delete(userId);
  fetchTrips(userId).catch(() => { /* swallowed */ });
}

export interface MyTripsState {
  trips: Trip[];
  loading: boolean;
}

export function useMyTrips(userId: string | null): MyTripsState {
  const [snap, setSnap] = useState<Snapshot | null>(() =>
    userId ? cache.get(userId) ?? null : null,
  );

  useEffect(() => {
    if (!userId) {
      setSnap(null);
      return;
    }

    let listenerSet = listeners.get(userId);
    if (!listenerSet) {
      listenerSet = new Set();
      listeners.set(userId, listenerSet);
    }
    const listener = (next: Snapshot) => setSnap(next);
    listenerSet.add(listener);

    const cached = cache.get(userId);
    setSnap(cached ?? null);

    const isStale = !cached || Date.now() - cached.fetchedAt > STALE_AFTER_MS;
    if (isStale) {
      fetchTrips(userId).catch(() => { /* swallowed */ });
    }

    return () => {
      listenerSet?.delete(listener);
      if (listenerSet && listenerSet.size === 0) {
        listeners.delete(userId);
      }
    };
  }, [userId]);

  if (!snap) {
    return { trips: [], loading: Boolean(userId) };
  }
  return { trips: snap.trips, loading: false };
}
