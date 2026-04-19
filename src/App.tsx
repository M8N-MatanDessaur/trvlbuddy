import React, { lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { TravelProvider, useTravel } from './contexts/TravelContext';
import { ToastProvider } from './contexts/ToastContext';
import { ChatProvider } from './contexts/ChatContext';
import { ContextEngineProvider } from './contexts/ContextEngineContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import SwipeNavigator from './components/SwipeNavigator';
import type { PageDef } from './components/SwipeNavigator';
import ConversationalOnboarding from './components/ConversationalOnboarding';
import ContributorOnboarding from './components/ContributorOnboarding';
import WelcomeScreen from './components/WelcomeScreen';
import SignInScreen from './components/SignInScreen';
import LoadingScreen from './components/LoadingScreen';
import AuthSplash from './components/AuthSplash';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
import NewTripLauncher from './components/NewTripLauncher';
import TripJoinPage from './components/TripJoinPage';
import { MessageCircle, Home, Compass, Languages, Phone, Radar, Plus } from 'lucide-react';

const ChatPage = lazy(() => import('./components/ChatPage'));
const TripPage = lazy(() => import('./components/DynamicDashboard'));
const NearbyPage = lazy(() => import('./components/nearby/NearbyFeed'));
const ExplorePage = lazy(() => import('./components/DynamicActivitiesPage'));
const LanguagePage = lazy(() => import('./components/DynamicTranslatorPage'));
const EmergencyPage = lazy(() => import('./components/EmergencyPage'));

const tripPages: PageDef[] = [
  { path: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { path: '/', component: TripPage, icon: Home, label: 'Trip' },
  { path: '/explore', component: ExplorePage, icon: Compass, label: 'Explore' },
  { path: '/language', component: LanguagePage, icon: Languages, label: 'Language' },
  { path: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
  { path: '/new-trip', component: NewTripLauncher, icon: Plus, label: 'New' },
];

// Local mode: no trip-scoped tabs. Nearby sits at index 1 so it is the
// fallback when the URL does not match (SwipeNavigator defaults to index 1).
const localPages: PageDef[] = [
  { path: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { path: '/nearby', component: NearbyPage, icon: Radar, label: 'Nearby' },
  { path: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
  { path: '/new-trip', component: NewTripLauncher, icon: Plus, label: 'New' },
];

const AppContent: React.FC = () => {
  const { hasCompletedOnboarding, isLoading, appMode } = useTravel();
  const { session, profile, isLoading: authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <AuthSplash />;
  if (!session) return <SignInScreen />;
  if (!profile) return <AuthSplash />;

  const joinMatch = location.pathname.match(/^\/trip\/join\/([^/]+)/);
  if (joinMatch) return <TripJoinPage token={joinMatch[1]} />;

  if (!profile.onboarded_at) return <ContributorOnboarding />;

  if (location.pathname === '/settings') return <SettingsPage />;
  if (location.pathname === '/profile' || location.pathname.startsWith('/profile/')) return <ProfilePage />;

  // Trip generation / long-running work gets the branded loading screen.
  if (isLoading) return <LoadingScreen />;

  // Legacy fallback for pre-onboarding users: no mode chosen -> chooser.
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

const AppContentWrapped: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

// On desktop we constrain the app to a phone-sized viewport so it renders
// the way it's designed for (touch, narrow cards, bottom-nav reach). On
// actual phones/tablets the container simply fills the screen.
const DesktopFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="app-frame-backdrop"
    style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div className="app-frame">{children}</div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <TravelProvider>
            <ContextEngineProvider>
              <ChatProvider>
                <DesktopFrame>
                  <AppContentWrapped />
                </DesktopFrame>
              </ChatProvider>
            </ContextEngineProvider>
          </TravelProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
