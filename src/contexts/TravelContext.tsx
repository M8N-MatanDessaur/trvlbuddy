import React, { createContext, useContext, useEffect, useState } from 'react';
import { TravelPlan, GeneratedActivity, Translation, EmergencyContact } from '../types/TravelData';

interface TravelContextType {
  currentPlan: TravelPlan | null;
  setCurrentPlan: (plan: TravelPlan | null) => void;
  activities: GeneratedActivity[];
  setActivities: (activities: GeneratedActivity[]) => void;
  translations: Translation[];
  setTranslations: (translations: Translation[]) => void;
  emergencyContacts: EmergencyContact[];
  setEmergencyContacts: (contacts: EmergencyContact[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;
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
        console.error('Error parsing saved activities:', error);
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
  
  const [isLoading, setIsLoading] = useState(false);
  
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem('hasCompletedOnboarding') === 'true';
  });

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

  return (
    <TravelContext.Provider value={{
      currentPlan,
      setCurrentPlan,
      activities,
      setActivities: setValidatedActivities,
      translations,
      setTranslations,
      emergencyContacts,
      setEmergencyContacts,
      isLoading,
      setIsLoading,
      hasCompletedOnboarding,
      setHasCompletedOnboarding
    }}>
      {children}
    </TravelContext.Provider>
  );
};