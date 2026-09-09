import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { installRealtimeBridge } from './lib/realtimeBridge';
import { ThemeProvider } from './contexts/ThemeContext';
import { TravelProvider, useTravel } from './contexts/TravelContext';
import { ToastProvider } from './contexts/ToastContext';
import { ChatProvider } from './contexts/ChatContext';
import { ContextEngineProvider } from './contexts/ContextEngineContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './components/AppShell';
import SignInScreen from './components/SignInScreen';
import LoadingScreen from './components/LoadingScreen';
import AuthSplash from './components/AuthSplash';

// Heavy route-only / modal screens. Lazy-loading these drops them out of
// the initial bundle (the main entry was ~817 kB before) — they only
// fetch when the user actually navigates to /settings, /account,
// /profile, /notifications, /trip/join/<token>, or hits the new-trip /
// onboarding flow.
const ChatPage = lazy(() => import('./components/ChatPage'));
const TripPage = lazy(() => import('./components/DynamicDashboard'));
const NearbyPage = lazy(() => import('./components/nearby/DiscoveryFeed'));
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

// One set of destinations, whether or not you have a trip. The old build had
// tripPages and localPages and switched between them on appMode, which meant
// anyone with a trip lost Nearby entirely -- the screen the app is for.
//
// Trip is a destination of its own now (/trips), and opening one takes you
// into that trip rather than rearranging the whole app around it.

const AppContent: React.FC = () => {
  const { isLoading } = useTravel();
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

  // No mode chooser. A signed-in person lands on Nearby, because "what should
  // I do today" is answerable without knowing anything about them -- and being
  // asked to declare yourself a traveller or a local before seeing anything is
  // a toll gate in front of the only screen that matters.
  //
  // Planning a trip is a thing you do from the Trips tab when you want to,
  // and the conversational trip onboarding now belongs to that flow rather
  // than standing in front of the whole app.

  // appMode used to choose between two different tab sets here. It no longer
  // decides navigation -- Nearby is always present -- so it only matters for
  // whether trip-shaped onboarding has run.

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          {/* Nearby is the front door: it answers the question the app is for. */}
          <Route path="/nearby" element={<NearbyPage />} />
          <Route path="/trips" element={<TripPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/utilities" element={<UtilitiesPage />} />
          <Route path="/emergency" element={<EmergencyPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/language" element={<LanguagePage />} />
          <Route path="/new-trip" element={<NewTripLauncher />} />
          {/* Trip planning asks its questions here, not in front of the app. */}
          <Route path="/trips/new" element={<ConversationalOnboarding />} />

          {/* Old paths, kept working. */}
          <Route path="/" element={<Navigate to="/nearby" replace />} />
          <Route path="/activities" element={<Navigate to="/explore" replace />} />
          <Route path="/translator" element={<Navigate to="/language" replace />} />
          <Route path="/planner" element={<Navigate to="/explore" replace />} />
          <Route path="*" element={<Navigate to="/nearby" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
};

const AppContentWrapped: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

// The DesktopFrame that used to live here rendered the whole app as a
// 412x915 phone mockup on any screen wider than 760px, complete with rounded
// corners and a drop shadow. AppShell is responsive instead.

// One QueryClient per app instance. Defaults: stale-after-30s so revisits
// to a screen feel instant from cache while a background refetch lands;
// retries off (we surface real errors instead of silently retrying); refetch
// on focus so coming back to the tab pulls anything that changed while we
// were away. Realtime invalidations override the staleTime when relevant.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Five minutes, and no refetch merely because the window regained
      // focus. The old 30s + refetchOnWindowFocus meant every glance away and
      // back re-ran every query on screen -- fine for a free database read,
      // expensive when a screen is backed by a billed API, and the reason the
      // app felt like it was constantly reloading. Realtime invalidations
      // still push genuinely-changed social data through immediately.
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Subscribes to Supabase Realtime once, fires React Query invalidations
// on every relevant table change. Lives inside the QueryClientProvider so
// useQueryClient resolves; no UI of its own.
const RealtimeBridge: React.FC = () => {
  const qc = useQueryClient();
  useEffect(() => installRealtimeBridge(qc), [qc]);
  return null;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <TravelProvider>
              <ContextEngineProvider>
                <ChatProvider>
                  <AppContentWrapped />
                </ChatProvider>
              </ContextEngineProvider>
            </TravelProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
