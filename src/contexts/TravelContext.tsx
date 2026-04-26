import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { TravelPlan, GeneratedActivity, Translation, EmergencyContact, JournalEntry } from '../types/TravelData';
import { useAuth } from './AuthContext';
import { listMyTrips, loadTrip } from '../services/tripsService';
import { supabase } from '../lib/supabase';

export type AppMode = 'trip' | 'local' | null;

interface TravelContextType {
  currentPlan: TravelPlan | null;
  setCurrentPlan: (plan: TravelPlan | null) => void;
  activities: GeneratedActivity[];
  setActivities: (activities: GeneratedActivity[]) => void;
  translations: Translation[];
  setTranslations: (translations: Translation[]) => void;
  emergencyContacts: EmergencyContact[];
  setEmergencyContacts: (contacts: EmergencyContact[]) => void;
  savedActivities: string[];
  toggleSavedActivity: (name: string) => void;
  journalEntries: JournalEntry[];
  addJournalEntry: (entry: JournalEntry) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  currentTripId: string | null;
  setCurrentTripId: (id: string | null) => void;
}

const TravelContext = createContext<TravelContextType | undefined>(undefined);

export const useTravel = () => {
  const context = useContext(TravelContext);
  if (context === undefined) {
    throw new Error('useTravel must be used within a TravelProvider');
  }
  return context;
};

// Helper function to validate activity objects
const isValidActivity = (activity: any): activity is GeneratedActivity => {
  return activity && 
         typeof activity === 'object' && 
         typeof activity.name === 'string' && 
         activity.name.trim() !== '';
};

export const TravelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPlan, setCurrentPlan] = useState<TravelPlan | null>(() => {
    const saved = localStorage.getItem('currentTravelPlan');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activities, setActivities] = useState<GeneratedActivity[]>(() => {
    const saved = localStorage.getItem('generatedActivities');
    if (saved) {
      try {
        const parsedActivities = JSON.parse(saved);
        // Filter out any invalid activities
        return Array.isArray(parsedActivities) ? parsedActivities.filter(isValidActivity) : [];
      } catch (error) {
        return [];
      }
    }
    return [];
  });
  
  const [translations, setTranslations] = useState<Translation[]>(() => {
    const saved = localStorage.getItem('generatedTranslations');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(() => {
    const saved = localStorage.getItem('emergencyContacts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [savedActivities, setSavedActivities] = useState<string[]>(() => {
    const saved = localStorage.getItem('savedActivities');
    return saved ? JSON.parse(saved) : [];
  });

  const toggleSavedActivity = (name: string) => {
    setSavedActivities(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem('journalEntries');
    return saved ? JSON.parse(saved) : [];
  });

  const addJournalEntry = (entry: JournalEntry) => {
    setJournalEntries(prev => {
      // Replace if entry for same date already exists
      const filtered = prev.filter(e => e.date !== entry.date);
      return [...filtered, entry];
    });
  };

  const [isLoading, setIsLoading] = useState(false);
  
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem('hasCompletedOnboarding') === 'true';
  });

  const [appMode, setAppMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('appMode');
    return saved === 'trip' || saved === 'local' ? saved : null;
  });

  const [currentTripId, setCurrentTripId] = useState<string | null>(() => {
    return localStorage.getItem('currentTripId') || null;
  });

  useEffect(() => {
    if (currentTripId) localStorage.setItem('currentTripId', currentTripId);
    else localStorage.removeItem('currentTripId');
  }, [currentTripId]);

  // Wrapper for setActivities to validate activities before setting
  const setValidatedActivities = (newActivities: GeneratedActivity[]) => {
    const validActivities = Array.isArray(newActivities) ? newActivities.filter(isValidActivity) : [];
    setActivities(validActivities);
  };

  // Save to localStorage when data changes
  useEffect(() => {
    if (currentPlan) {
      localStorage.setItem('currentTravelPlan', JSON.stringify(currentPlan));
    } else {
      localStorage.removeItem('currentTravelPlan');
    }
  }, [currentPlan]);

  useEffect(() => {
    localStorage.setItem('generatedActivities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('generatedTranslations', JSON.stringify(translations));
  }, [translations]);

  useEffect(() => {
    localStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
  }, [emergencyContacts]);

  useEffect(() => {
    localStorage.setItem('hasCompletedOnboarding', hasCompletedOnboarding.toString());
  }, [hasCompletedOnboarding]);

  useEffect(() => {
    if (appMode) localStorage.setItem('appMode', appMode);
    else localStorage.removeItem('appMode');
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem('savedActivities', JSON.stringify(savedActivities));
  }, [savedActivities]);

  useEffect(() => {
    localStorage.setItem('journalEntries', JSON.stringify(journalEntries));
  }, [journalEntries]);

  // Cache-cleared / first-load-on-new-device recovery: when a signed-in user
  // has no local trip state, ask Supabase whether they actually have saved
  // trips and rehydrate the most recent one (or the trip pinned in their
  // profile). Without this the WelcomeScreen takes over as if they were
  // brand new -- losing the trip until they manually open My Trips.
  const { user, profile } = useAuth();
  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (!user?.id) {
      // Reset the gate on sign-out so the next sign-in can restore again.
      restoreAttemptedRef.current = false;
      return;
    }
    if (restoreAttemptedRef.current) return;
    if (currentTripId || currentPlan) {
      // Local state is intact -- nothing to restore.
      restoreAttemptedRef.current = true;
      return;
    }
    restoreAttemptedRef.current = true;

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const trips = await listMyTrips(user.id);
        if (cancelled || trips.length === 0) return;

        const pinnedId = profile?.current_trip_id;
        const targetId = pinnedId && trips.some((t) => t.id === pinnedId)
          ? pinnedId
          : trips[0].id;

        const row = await loadTrip(targetId);
        if (cancelled || !row?.plan?.currentPlan) return;

        const bundle = row.plan;
        setCurrentPlan(bundle.currentPlan);
        setValidatedActivities(bundle.activities || []);
        setTranslations(bundle.translations || []);
        setEmergencyContacts(bundle.emergencyContacts || []);
        setAppMode('trip');
        setHasCompletedOnboarding(true);
        setCurrentTripId(row.id);
      } catch (err) {
        console.error('trip auto-restore failed', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsLoading(false);
    };
    // profile arrives after user; we depend on both so a pinned current_trip_id
    // is honored when it lands. currentPlan/currentTripId are read once via
    // the gate above; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.current_trip_id]);

  // Live trip-plan sync: when any member updates the active trip in
  // Supabase (accommodations, members editing the JSONB plan, etc.) we
  // refetch and overwrite local state. Last-write-wins is acceptable for
  // v1 — granular CRDT-style merging is a Phase 5 problem. Without this
  // hook two members editing the same trip would see stale data until
  // they manually reload. We also surface a "Trip updated" hint via a
  // shared event so listeners (e.g. the dashboard) can toast the user
  // without TravelContext having to know about ToastContext.
  useEffect(() => {
    if (!currentTripId) return;
    let firstUpdate = true;
    const channel = supabase
      .channel(`trip-plan-${currentTripId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${currentTripId}` },
        async () => {
          const row = await loadTrip(currentTripId);
          if (!row?.plan?.currentPlan) return;
          const bundle = row.plan;
          setCurrentPlan(bundle.currentPlan);
          setValidatedActivities(bundle.activities || []);
          setTranslations(bundle.translations || []);
          setEmergencyContacts(bundle.emergencyContacts || []);
          // Skip the first event to avoid toasting on the initial mount;
          // after that, every change is a real co-member edit worth a
          // heads-up.
          if (!firstUpdate && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('trip-plan-remote-update', {
              detail: { tripId: currentTripId },
            }));
          }
          firstUpdate = false;
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTripId]);

  return (
    <TravelContext.Provider value={{
      currentPlan,
      setCurrentPlan,
      activities,
      setActivities: setValidatedActivities,
      savedActivities,
      toggleSavedActivity,
      journalEntries,
      addJournalEntry,
      translations,
      setTranslations,
      emergencyContacts,
      setEmergencyContacts,
      isLoading,
      setIsLoading,
      hasCompletedOnboarding,
      setHasCompletedOnboarding,
      appMode,
      setAppMode,
      currentTripId,
      setCurrentTripId,
    }}>
      {children}
    </TravelContext.Provider>
  );
};