import React, { createContext, useContext, useEffect, useState } from 'react';
import { TravelPlan, GeneratedActivity, Translation, EmergencyContact, JournalEntry } from '../types/TravelData';

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