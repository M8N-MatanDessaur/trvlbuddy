import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { TravelProvider, useTravel } from './contexts/TravelContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Navigation from './components/Navigation';
import OnboardingFlow from './components/OnboardingFlow';
import LoadingScreen from './components/LoadingScreen';

const TripPage = lazy(() => import('./components/DynamicDashboard'));
const ExplorePage = lazy(() => import('./components/DynamicActivitiesPage'));
const PlannerPage = lazy(() => import('./components/DynamicPlannerPage'));
const LanguagePage = lazy(() => import('./components/DynamicTranslatorPage'));
const UtilitiesPage = lazy(() => import('./components/DynamicUtilitiesPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="loader" />
  </div>
);

const AppContent: React.FC = () => {
  const { hasCompletedOnboarding, isLoading } = useTravel();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingFlow />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingTop: '3.5rem', paddingBottom: '4.5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
      <Header />

      <main className="max-w-5xl mx-auto flex-1 w-full">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<TripPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/language" element={<LanguagePage />} />
              {/* Legacy redirects */}
              <Route path="/activities" element={<Navigate to="/explore" replace />} />
              <Route path="/translator" element={<Navigate to="/language" replace />} />
              <Route path="/utilities" element={<UtilitiesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Navigation />
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TravelProvider>
          <AppContent />
        </TravelProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
