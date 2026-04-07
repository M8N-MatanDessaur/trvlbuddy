import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTravel } from './TravelContext';
import type { Destination, TripSegment } from '../types/TravelData';
import {
  type UserLocation,
  getCachedLocation,
  startWatchingLocation,
  stopWatchingLocation,
  getLocationContext,
  type NearbyContext,
} from '../utils/geolocation';
import {
  getLocalHour,
  getTimeOfDay,
  type TimeOfDay,
} from '../utils/timezoneHelpers';
import { recordLocationPing } from '../services/locationHistoryService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TripPhase = 'pre-trip' | 'active' | 'post-trip';

export interface TripMoment {
  /** Coarse time bucket in the destination timezone. */
  timeOfDay: TimeOfDay;
  /** 0-23 hour in the destination timezone. */
  localHour: number;
  /** 1-indexed day number within the trip (0 if pre/post trip). */
  dayOfTrip: number;
  /** Whether the trip has started, is ongoing, or is over. */
  tripPhase: TripPhase;
  /** The segment the user is currently in (by date), or null. */
  currentSegment: TripSegment | null;
  /** The destination for the current segment, or the first destination. */
  currentDestination: Destination | null;
  /** Latest known user location, if permission was granted. */
  location: UserLocation | null;
  /** Simple heuristic for what kind of area the user is near. */
  nearbyContext: NearbyContext;
}

interface ContextEngineValue {
  moment: TripMoment;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ContextEngineContext = createContext<ContextEngineValue | undefined>(
  undefined,
);

export function useContextEngine(): ContextEngineValue {
  const ctx = useContext(ContextEngineContext);
  if (!ctx) {
    throw new Error(
      'useContextEngine must be used within a ContextEngineProvider',
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeTripPhase(
  startDate: string | undefined,
  endDate: string | undefined,
): TripPhase {
  if (!startDate || !endDate) return 'pre-trip';
  const today = toDateStr(new Date());
  if (today < startDate) return 'pre-trip';
  if (today > endDate) return 'post-trip';
  return 'active';
}

function computeDayOfTrip(startDate: string | undefined): number {
  if (!startDate) return 0;
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff >= 0 ? diff + 1 : 0;
}

function findCurrentSegment(segments: TripSegment[]): TripSegment | null {
  const today = toDateStr(new Date());
  return (
    segments.find((s) => today >= s.startDate && today <= s.endDate) ?? null
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const ContextEngineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentPlan } = useTravel();
  const [location, setLocation] = useState<UserLocation | null>(
    getCachedLocation,
  );
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh every 60s so time-of-day stays current
  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Watch geolocation while a trip exists, also record pings for location history
  useEffect(() => {
    if (!currentPlan) return;
    startWatchingLocation((loc) => {
      setLocation(loc);
      recordLocationPing(loc);
    });
    return () => stopWatchingLocation();
  }, [currentPlan]);

  const moment = useMemo<TripMoment>(() => {
    const segments = currentPlan?.segments ?? [];
    const segment = findCurrentSegment(segments);
    const destination =
      segment?.destination ??
      currentPlan?.destinations?.[0] ??
      currentPlan?.destination ??
      null;

    const timezone = destination?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localHour = getLocalHour(timezone);
    const timeOfDay = getTimeOfDay(localHour);

    const tripPhase = computeTripPhase(
      currentPlan?.startDate,
      currentPlan?.endDate,
    );
    const dayOfTrip =
      tripPhase === 'active' ? computeDayOfTrip(currentPlan?.startDate) : 0;

    // Gather all accommodation coordinates for nearbyContext detection
    const accCoords = segments
      .flatMap((s) => s.accommodations)
      .filter((a) => a.coordinates)
      .map((a) => a.coordinates!);

    const nearbyContext: NearbyContext =
      location ? getLocationContext(location, accCoords) : 'unknown';

    return {
      timeOfDay,
      localHour,
      dayOfTrip,
      tripPhase,
      currentSegment: segment,
      currentDestination: destination,
      location,
      nearbyContext,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan, location, tick]);

  const value = useMemo(() => ({ moment }), [moment]);

  return (
    <ContextEngineContext.Provider value={value}>
      {children}
    </ContextEngineContext.Provider>
  );
};
