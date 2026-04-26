import React, { lazy, Suspense } from 'react';
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
import WelcomeScreen from './components/WelcomeScreen';
import SignInScreen from './components/SignInScreen';
import LoadingScreen from './components/LoadingScreen';
import AuthSplash from './components/AuthSplash';
import { MessageCircle, Home, Compass, Languages, Phone, Radar, Plus, Wrench } from 'lucide-react';

// Heavy route-only / modal screens. Lazy-loading these drops them out of
// the initial bundle (the main entry was ~817 kB before) — they only
// fetch when the user actually navigates to /settings, /account,
// /profile, /notifications, /trip/join/<token>, or hits the new-trip /
// onboarding flow.
const ChatPage = lazy(() => import('./components/ChatPage'));
const TripPage = lazy(() => import('./components/DynamicDashboard'));
const NearbyPage = lazy(() => import('./components/nearby/NearbyFeed'));
const ExplorePage = lazy(() => import('./components/DynamicActivitiesPage'));
const LanguagePage = lazy(() => import('./components/DynamicTranslatorPage'));
const UtilitiesPage = lazy(() => import('./components/DynamicUtilitiesPage'));
const EmergencyPage = lazy(() => import('./components/EmergencyPage'));
const ConversationalOnboarding = lazy(() => import('./components/ConversationalOnboarding'));
const ContributorOnboarding = lazy(() => import('./components/ContributorOnboarding'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const AccountPage = lazy(() => import('./components/AccountPage'));
const PasswordResetPage = lazy(() => import('./components/PasswordResetPage'));
const ProfilePage = lazy(() => import('./components/ProfilePage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const NewTripLauncher = lazy(() => import('./components/NewTripLauncher'));
const TripJoinPage = lazy(() => import('./components/TripJoinPage'));
// Map view is parked on feature/trip-map-v2 -- the data layer (Google
// Places enrichment of activity coordinates at trip generation) stays on
// master so when Map comes back it'll have everything it needs.

const tripPages: PageDef[] = [
  { path: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { path: '/', component: TripPage, icon: Home, label: 'Trip' },
  { path: '/explore', component: ExplorePage, icon: Compass, label: 'Explore' },
  { path: '/language', component: LanguagePage, icon: Languages, label: 'Language' },
  { path: '/utilities', component: UtilitiesPage, icon: Wrench, label: 'Tools' },
  { path: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
  { path: '/new-trip', component: NewTripLauncher, icon: Plus, label: 'New' },
];

// Local mode: no trip-scoped tabs. Nearby sits at index 1 so it is the
// fallback when the URL does not match (SwipeNavigator defaults to index 1).
const localPages: PageDef[] = [
  { path: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { path: '/nearby', component: NearbyPage, icon: Radar, label: 'Nearby' },
  { path: '/utilities', component: UtilitiesPage, icon: Wrench, label: 'Tools' },
  { path: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
  { path: '/new-trip', component: NewTripLauncher, icon: Plus, label: 'New' },
];

const AppContent: React.FC = () => {
  const { hasCompletedOnboarding, isLoading, appMode } = useTravel();
  const { session, profile, isLoading: authLoading, recoveryMode } = useAuth();
  const location = useLocation();

  // Suspense fallback for any of the lazy screens below. AuthSplash is
  // already part of the main bundle and handles the brief network gap
  // gracefully without flashing layout.
  const lazyFallback = <AuthSplash />;
  const wrap = (node: React.ReactNode) => (
    <Suspense fallback={lazyFallback}>{node}</Suspense>
  );

  if (authLoading) return <AuthSplash />;
  if (!session) return <SignInScreen />;
  // Password-recovery click lands here with a recovery-scoped session. Hold
  // the user on PasswordResetPage until they either complete the flow or
  // cancel — never route to the main app with a recovery session.
  if (recoveryMode) return wrap(<PasswordResetPage />);
  if (!profile) return <AuthSplash />;

  const joinMatch = location.pathname.match(/^\/trip\/join\/([^/]+)/);
  if (joinMatch) return wrap(<TripJoinPage token={joinMatch[1]} />);

  if (!profile.onboarded_at) return wrap(<ContributorOnboarding />);

  if (location.pathname === '/settings') return wrap(<SettingsPage />);
  if (location.pathname === '/account') return wrap(<AccountPage />);
  if (location.pathname === '/notifications') return wrap(<NotificationsPage />);
  if (location.pathname === '/profile' || location.pathname.startsWith('/profile/')) return wrap(<ProfilePage />);

  // Trip generation / long-running work gets the branded loading screen.
  if (isLoading) return <LoadingScreen />;

  // Legacy fallback for pre-onboarding users: no mode chosen -> chooser.
  if (!appMode && !hasCompletedOnboarding) return <WelcomeScreen />;

  // Trip mode but onboarding not yet complete -> run the conversational onboarding.
  if (appMode === 'trip' && !hasCompletedOnboarding) return wrap(<ConversationalOnboarding />);

  // Legacy users who completed onboarding before appMode existed: treat as trip mode.
  const effectiveMode = appMode || 'trip';
  const pages = effectiveMode === 'local' ? localPages : tripPages;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ paddingTop: 'calc(3.75rem + env(safe-area-inset-top))' }}
    >
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
      minHeight: '100dvh',
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
