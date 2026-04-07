import React, { Suspense, lazy } from 'react';
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
import LoadingScreen from './components/LoadingScreen';
import { MessageCircle, Home, Compass, Languages, Wrench } from 'lucide-react';

const ChatPage = lazy(() => import('./components/ChatPage'));
const TripPage = lazy(() => import('./components/DynamicDashboard'));
const ExplorePage = lazy(() => import('./components/DynamicActivitiesPage'));
const LanguagePage = lazy(() => import('./components/DynamicTranslatorPage'));
const UtilitiesPage = lazy(() => import('./components/DynamicUtilitiesPage'));

const pages: PageDef[] = [
  { path: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { path: '/', component: TripPage, icon: Home, label: 'Trip' },
  { path: '/explore', component: ExplorePage, icon: Compass, label: 'Explore' },
  { path: '/language', component: LanguagePage, icon: Languages, label: 'Language' },
  { path: '/utilities', component: UtilitiesPage, icon: Wrench, label: 'Tools' },
];

const AppContent: React.FC = () => {
  const { hasCompletedOnboarding, isLoading } = useTravel();

  if (isLoading) return <LoadingScreen />;
  if (!hasCompletedOnboarding) return <ConversationalOnboarding />;

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingTop: '3.75rem' }}>
      <Header pages={pages} />

      {/* Hidden routes for redirects */}
      <Routes>
        <Route path="/activities" element={<Navigate to="/explore" replace />} />
        <Route path="/translator" element={<Navigate to="/language" replace />} />
        <Route path="/planner" element={<Navigate to="/explore" replace />} />
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
