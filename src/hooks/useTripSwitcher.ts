import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import { useToast } from '../contexts/ToastContext';
import { listMyTrips, loadTrip } from '../services/tripsService';
import type { Trip } from '../lib/supabase';

/**
 * Switching between Nearby and your trips.
 *
 * This was the top-left button in the old per-tab header. The chrome is now
 * one component for the whole app, and this is what its pill does when the
 * screen on top has not asked for something else, so the logic lives here
 * rather than in either of them.
 *
 * Trips load the first time you might need them, not on mount: most sessions
 * never open the switcher, and the list is a round trip.
 */
export interface TripSwitcher {
  trips: Trip[];
  loading: boolean;
  busyTripId: string | null;
  /** Loads the list, for the moment before the switcher is shown. */
  ensureLoaded: () => Promise<void>;
  /** Leave the trip for what is around you right now. */
  toNearby: () => void;
  /** Make this the current trip and go to it. */
  toTrip: (trip: Trip) => Promise<void>;
}

export function useTripSwitcher(onDone?: () => void): TripSwitcher {
  const { user } = useAuth();
  const {
    currentPlan,
    currentTripId,
    appMode,
    setAppMode,
    setCurrentPlan,
    setActivities,
    setTranslations,
    setEmergencyContacts,
    setHasCompletedOnboarding,
    setCurrentTripId,
  } = useTravel();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (!user || loaded || loading) return;
    setLoading(true);
    const rows = await listMyTrips(user.id);
    setTrips(rows);
    setLoading(false);
    setLoaded(true);
  }, [user, loaded, loading]);

  // Anything that changes the trips out from under us invalidates the list.
  useEffect(() => {
    setLoaded(false);
  }, [user?.id, currentTripId, currentPlan?.title]);

  const toNearby = useCallback(() => {
    // Nearby is its own destination and works in either mode, so this no
    // longer flips the app into local mode, doing that quietly ended the
    // user's trip. It just goes there.
    onDone?.();
    navigate('/nearby');
  }, [navigate, onDone]);

  const toTrip = useCallback(
    async (trip: Trip) => {
      if (!user) return;
      if (trip.id === currentTripId && appMode !== 'local') {
        onDone?.();
        navigate(`/trip/${trip.id}`);
        return;
      }
      setBusyTripId(trip.id);
      const row = await loadTrip(trip.id);
      setBusyTripId(null);
      if (!row) {
        toast('Could not load trip', 'error');
        return;
      }
      const bundle = row.plan;
      if (bundle?.currentPlan) {
        setCurrentPlan(bundle.currentPlan);
        setActivities(bundle.activities || []);
        setTranslations(bundle.translations || []);
        setEmergencyContacts(bundle.emergencyContacts || []);
      }
      setAppMode('trip');
      setHasCompletedOnboarding(true);
      setCurrentTripId(row.id);
      onDone?.();
      navigate(`/trip/${row.id}`);
    },
    [
      user,
      currentTripId,
      appMode,
      navigate,
      onDone,
      setActivities,
      setAppMode,
      setCurrentPlan,
      setCurrentTripId,
      setEmergencyContacts,
      setHasCompletedOnboarding,
      setTranslations,
      toast,
    ],
  );

  return { trips, loading, busyTripId, ensureLoaded, toNearby, toTrip };
}

export default useTripSwitcher;
