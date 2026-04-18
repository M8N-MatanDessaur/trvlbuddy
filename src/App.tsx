import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { TravelProvider, useTravel } from './contexts/TravelContext';
import { ToastProvider } from './contexts/ToastContext';
import { ChatProvider } from './contexts/ChatContext';
import { ContextEngineProvider } from './contexts/ContextEngineContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import SwipeNavigator from './components/SwipeNavigator';
import type { PageDef } from './components/SwipeNavigator';
import ConversationalOnboarding from './components/ConversationalOnboarding';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingScreen from './components/LoadingScreen';
import { MessageCircle, Home, Compass, Languages, Wrench, Phone, Radar } from 'lucide-react';

const ChatPage = lazy(() => import('./components/ChatPage'));
const TripPage = lazy(() => import('./components/DynamicDashboard'));
const NearbyPage = lazy(() => import('./components/nearby/NearbyFeed'));
const ExplorePage = lazy(() => import('./components/DynamicActivitiesPage'));
const LanguagePage = lazy(() => import('./components/DynamicTranslatorPage'));
const UtilitiesPage = lazy(() => import('./components/DynamicUtilitiesPage'));
const EmergencyPage = lazy(() => import('./components/EmergencyPage'));

const tripPages: PageDef[] = [
  { path: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { path: '/', component: TripPage, icon: Home, label: 'Trip' },
  { path: '/nearby', component: NearbyPage, icon: Radar, label: 'Nearby' },
  { path: '/explore', component: ExplorePage, icon: Compass, label: 'Explore' },
  { path: '/language', component: LanguagePage, icon: Languages, label: 'Language' },
  { path: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
  { path: '/utilities', component: UtilitiesPage, icon: Wrench, label: 'Tools' },
];

// Local mode: no trip-scoped tabs. Nearby sits at index 1 so it is the
// fallback when the URL does not match (SwipeNavigator defaults to index 1).
const localPages: PageDef[] = [
  { path: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { path: '/nearby', component: NearbyPage, icon: Radar, label: 'Nearby' },
  { path: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
  { path: '/utilities', component: UtilitiesPage, icon: Wrench, label: 'Tools' },
];

const AppContent: React.FC = () => {
  const { hasCompletedOnboarding, isLoading, appMode } = useTravel();

  if (isLoading) return <LoadingScreen />;

  // Fresh start: no mode chosen AND no onboarding -> show the welcome chooser.
  if (!appMode && !hasCompletedOnboarding) return <WelcomeScreen />;

  // Trip mode but onboarding not yet complete -> run the conversational onboarding.
  if (appMode === 'trip' && !hasCompletedOnboarding) return <ConversationalOnboarding />;

  // Legacy users who completed onboarding before appMode existed: treat as trip mode.
  const effectiveMode = appMode || 'trip';
  const pages = effectiveMode === 'local' ? localPages : tripPages;

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingTop: '3.75rem' }}>
      <Header pages={pages} />

      {/* Hidden routes for redirects */}
      <Routes>
        <Route path="/activities" element={<Navigate to="/explore" replace />} />
        <Route path="/translator" element={<Navigate to="/language" replace />} />
        <Route path="/planner" element={<Navigate to="/explore" replace />} />
        {effectiveMode === 'local' && (
          <>
            <Route path="/" element={<Navigate to="/nearby" replace />} />
            <Route path="/explore" element={<Navigate to="/nearby" replace />} />
            <Route path="/language" element={<Navigate to="/nearby" replace />} />
          </>
        )}
        <Route path="*" element={null} />
      </Routes>

      <ErrorBoundary>
        <SwipeNavigator pages={pages} />
      </ErrorBoundary>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TravelProvider>
          <ContextEngineProvider>
            <ChatProvider>
              <AppContent />
            </ChatProvider>
          </ContextEngineProvider>
        </TravelProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
