import React, { useState, useEffect, useLayoutEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { TravelProvider, useTravel } from './contexts/TravelContext';
import Header from './components/Header';
import Navigation, { PageType } from './components/Navigation';
import DynamicDashboard from './components/DynamicDashboard';
import DynamicActivitiesPage from './components/DynamicActivitiesPage';
import PlannerPage from './components/DynamicPlannerPage';
import TranslatorPage from './components/DynamicTranslatorPage';
import UtilitiesPage from './components/DynamicUtilitiesPage';
import OnboardingFlow from './components/OnboardingFlow';
import LoadingScreen from './components/LoadingScreen';

const AppContent: React.FC = () => {
  const { hasCompletedOnboarding, isLoading } = useTravel();
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');

  // Handle URL parameters for deep linking
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page') as PageType;
    if (page && ['dashboard', 'activities', 'planner', 'translator', 'utilities'].includes(page)) {
      setCurrentPage(page);
    }
  }, []);

  // Update URL when page changes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (currentPage === 'dashboard') {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', currentPage);
    }
    window.history.replaceState({}, '', url.toString());
  }, [currentPage]);

  // Scroll to top when page changes
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentPage]);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'activities':
        return <DynamicActivitiesPage />;
      case 'planner':
        return <PlannerPage />;
      case 'translator':
        return <TranslatorPage />;
      case 'utilities':
        return <UtilitiesPage />;
      case 'dashboard':
      default:
        return <DynamicDashboard onPlannerClick={() => setCurrentPage('planner')} />;
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingFlow />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingTop: '5rem', paddingBottom: '7rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
      <Header />
      
      <main className="max-w-7xl mx-auto flex-1">
        {renderCurrentPage()}
      </main>

      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <TravelProvider>
        <AppContent />
      </TravelProvider>
    </ThemeProvider>
  );
}

export default App;