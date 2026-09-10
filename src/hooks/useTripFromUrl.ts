import { useEffect, useRef } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { loadTrip } from '../services/tripsService';
import type { Scope } from './useScope';

/**
 * Load the trip the address names.
 *
 * Now that a trip's sections live at /trip/<id>/..., the id in the address is
 * the thing that decides which trip a screen is about. Opening one of those
 * links, or coming back to one in a new session, has to bring that trip with
 * it, or the screen renders the trip that happened to be loaded last and the
 * address quietly lies about what you are looking at.
 */
export function useTripFromUrl(scope: Scope): void {
  const {
    currentTripId,
    currentPlan,
    setCurrentPlan,
    setActivities,
    setTranslations,
    setEmergencyContacts,
    setAppMode,
    setHasCompletedOnboarding,
    setCurrentTripId,
  } = useTravel();

  // One attempt per id, so a trip that cannot be loaded is not retried on
  // every render. Cleared again if that attempt does not finish, because in
  // development React runs an effect, tears it down and runs it again: the
  // first run was loading the trip while the guard turned the second one
  // away, and the result of the first was then discarded as stale. The trip
  // loaded perfectly and nothing on screen ever saw it.
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    const id = scope.kind === 'trip' ? scope.tripId : null;
    if (!id || attempted.current === id) return;
    // Matching ids are not enough. A session can remember which trip you were
    // on without holding its plan, and then every screen renders as though
    // there were no trip at all.
    if (id === currentTripId && currentPlan) return;
    attempted.current = id;

    let landed = false;
    void (async () => {
      const row = await loadTrip(id);
      if (!row) return;
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
      landed = true;
    })();

    return () => {
      if (!landed) attempted.current = null;
    };
  }, [
    scope.kind,
    scope.tripId,
    currentTripId,
    currentPlan,
    setActivities,
    setAppMode,
    setCurrentPlan,
    setCurrentTripId,
    setEmergencyContacts,
    setHasCompletedOnboarding,
    setTranslations,
  ]);
}

export default useTripFromUrl;
