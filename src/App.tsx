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
import AppChrome from './components/AppChrome';
import DesktopNav from './components/DesktopNav';
import { useIsDesktop } from './hooks/useMediaQuery';
import { pathIn, scopeOf, type Scope } from './hooks/useScope';
import { useTripFromUrl } from './hooks/useTripFromUrl';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { ChromeProvider } from './contexts/ChromeContext';
import SwipeNavigator from './components/SwipeNavigator';
import type { PageDef } from './components/SwipeNavigator';
import WelcomeScreen from './components/WelcomeScreen';
import SignInScreen from './components/SignInScreen';
import LoadingScreen from './components/LoadingScreen';
import AuthSplash from './components/AuthSplash';
import { MessageCircle, Home, Compass, Languages, Phone, Radar, Plus, Wrench } from 'lucide-react';

// Heavy route-only / modal screens. Lazy-loading these drops them out of
// the initial bundle (the main entry was ~817 kB before), they only
// fetch when the user actually navigates to /settings, /account,
// /profile, /notifications, /trip/join/<token>, or hits the new-trip /
// onboarding flow.
const ChatPage = lazy(() => import('./components/ChatPage'));
const TripPage = lazy(() => import('./components/DynamicDashboard'));
const NearbyPage = lazy(() => import('./components/nearby/NearbyFeed'));
const ExplorePage = lazy(() => import('./components/TripExplore'));
const LanguagePage = lazy(() => import('./components/DynamicTranslatorPage'));
const UtilitiesPage = lazy(() => import('./components/DynamicUtilitiesPage'));
const EmergencyPage = lazy(() => import('./components/EmergencyPage'));
const ConversationalOnboarding = lazy(() => import('./components/ConversationalOnboarding'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const AccountPage = lazy(() => import('./components/AccountPage'));
const PasswordResetPage = lazy(() => import('./components/PasswordResetPage'));
const ProfilePage = lazy(() => import('./components/ProfilePage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const NewTripLauncher = lazy(() => import('./components/NewTripLauncher'));
const TripJoinPage = lazy(() => import('./components/TripJoinPage'));
// Map view is parked on feature/trip-map-v2, the data layer (Google
// Places enrichment of activity coordinates at trip generation) stays on
// master so when Map comes back it'll have everything it needs.

// The two sets of tabs, written as sections rather than addresses.
//
// A section like Tools exists in both: at /tools it is about where you are
// standing, and at /trip/<id>/tools it is about that trip. So the tabs are
// defined by their section and the address is built from whichever scope you
// are in, instead of one fixed path pretending to serve both.
interface SectionDef {
  section: string;
  component: PageDef['component'];
  icon: PageDef['icon'];
  label: string;
}

const TRIP_SECTIONS: SectionDef[] = [
  { section: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { section: '', component: TripPage, icon: Home, label: 'Trip' },
  { section: '/explore', component: ExplorePage, icon: Compass, label: 'Explore' },
  // No Nearby tab here on purpose. Nearby is its own place, not part of a
  // trip, reached from the location pill and returned from the same way.
  { section: '/language', component: LanguagePage, icon: Languages, label: 'Language' },
  { section: '/tools', component: UtilitiesPage, icon: Wrench, label: 'Tools' },
  { section: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
];

// What is around you right now. Chat leads here exactly as it does on a trip,
// so the leftmost tab is the same tab everywhere and the bar does not
// reshuffle under your thumb.
const LOCAL_SECTIONS: SectionDef[] = [
  { section: '/chat', component: ChatPage, icon: MessageCircle, label: 'AI' },
  { section: '/nearby', component: NearbyPage, icon: Radar, label: 'Nearby' },
  { section: '/tools', component: UtilitiesPage, icon: Wrench, label: 'Tools' },
  { section: '/emergency', component: EmergencyPage, icon: Phone, label: 'SOS' },
];

/** The plus is how a trip starts, and it belongs to neither scope. */
const NEW_TRIP: SectionDef = {
  section: '/new-trip', component: NewTripLauncher, icon: Plus, label: 'New',
};

function pagesFor(scope: Scope): PageDef[] {
  const sections = scope.kind === 'trip' ? TRIP_SECTIONS : LOCAL_SECTIONS;
  return [...sections, NEW_TRIP].map((s) => ({
    path: s.section === '/new-trip' ? '/new-trip' : pathIn(scope, s.section),
    component: s.component,
    icon: s.icon,
    label: s.label,
  }));
}

const AppContent: React.FC = () => {
  const { hasCompletedOnboarding, isLoading, appMode, currentTripId, currentPlan } = useTravel();
  const { session, profile, isLoading: authLoading, recoveryMode } = useAuth();
  const location = useLocation();
  // The scope is the address: /trip/<id>/tools is the trip's tools, /tools is
  // the tools for where you are standing. Nothing to keep in sync, and a link
  // to either one lands in the right place.
  const isDesktop = useIsDesktop();
  // A trip's sections name their trip in the address, so opening one brings
  // that trip with it rather than showing whichever was loaded last.
  useTripFromUrl(scopeOf(location.pathname));

  // What the tab, the history entry and the bookmark say. Named for the
  // screen, and on a trip, for the trip.
  const titleScope = scopeOf(location.pathname);
  const sectionLabel = [...TRIP_SECTIONS, ...LOCAL_SECTIONS, NEW_TRIP]
    .find((s) => pathIn(titleScope, s.section) === location.pathname)?.label ?? null;
  useDocumentTitle(
    titleScope.kind === 'trip' && currentPlan?.title
      ? (sectionLabel && sectionLabel !== 'Trip'
          ? `${sectionLabel}, ${currentPlan.title}`
          : currentPlan.title)
      : sectionLabel,
  );

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
  // cancel, never route to the main app with a recovery session.
  if (recoveryMode) return wrap(<PasswordResetPage />);
  if (!profile) return <AuthSplash />;

  const joinMatch = location.pathname.match(/^\/trip\/join\/([^/]+)/);
  if (joinMatch) return wrap(<TripJoinPage token={joinMatch[1]} />);

  if (!profile.onboarded_at) return wrap(<Onboarding />);

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

  // Which set of tabs you are in, not which page you are on.
  //
  // Nearby is not a trip tab, but it is not a dead end either: from it, Chat,
  // Tools and SOS are about where you are standing, so they keep Nearby's
  // tabs under them. Only stepping back onto something that only exists as
  // part of a trip returns you to the trip's tabs. Making Nearby a
  // full-screen page of its own instead meant every tab you took from it
  // dropped you back into the trip.
  const scope = scopeOf(location.pathname);
  const pages = pagesFor(scope);
  const currentPage = pages.find((p) => p.path === location.pathname);

  // Nearby carries its own pill inside the feed frame, over the photograph,
  // so the app chrome would be a second header on the same screen. Explore
  // used to as well; it now declares its pill through the chrome like every
  // other screen, which is the whole point of having one.
  const hideHeader = location.pathname === '/nearby';
  const paddingTop = hideHeader
    ? 'env(safe-area-inset-top)'
    // The chrome is 4rem tall (0.75 above the 44px pill, 0.5 below), and the
    // page needs a gap under it rather than starting flush against it --
    // otherwise a screen's own title sits right on the pill.
    : 'calc(4.75rem + env(safe-area-inset-top))';

  // Legacy paths, and the tabs local mode does not have. Rendered by whichever
  // shell is on screen.
  // Old addresses, and the bare trip paths that have no trip id in them.
  //
  // A trip's sections live under /trip/<id>, so /explore on its own has no
  // trip to be about. It is sent to the trip you are on rather than left to
  // render whichever one happened to be loaded.
  const tripHome = currentTripId ? `/trip/${currentTripId}` : '/nearby';
  const redirects = (
    <Routes>
      {/* Tools used to be /utilities, and the trip used to be "/". */}
      <Route path="/utilities" element={<Navigate to="/tools" replace />} />
      <Route path="/planner" element={<Navigate to={`${tripHome}/explore`} replace />} />
      <Route path="/activities" element={<Navigate to={`${tripHome}/explore`} replace />} />
      <Route path="/translator" element={<Navigate to={`${tripHome}/language`} replace />} />
      {effectiveMode === 'local' ? (
        <>
          <Route path="/" element={<Navigate to="/nearby" replace />} />
          <Route path="/trip" element={<Navigate to="/nearby" replace />} />
          <Route path="/explore" element={<Navigate to="/nearby" replace />} />
          <Route path="/language" element={<Navigate to="/nearby" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={<Navigate to={tripHome} replace />} />
          <Route path="/trip" element={<Navigate to={tripHome} replace />} />
          <Route path="/explore" element={<Navigate to={`${tripHome}/explore`} replace />} />
          <Route path="/language" element={<Navigate to={`${tripHome}/language`} replace />} />
        </>
      )}
      <Route path="*" element={null} />
    </Routes>
  );

  // Desktop is a different shape, not the same shape stretched: the chrome
  // stands up into a rail on the left and the tabs come with it, because a
  // row of icons centred at the bottom of a 1500px window is a phone's answer
  // to a question a laptop is not asking. Everything inside a page is
  // unchanged, only where you stand to reach it.
  if (isDesktop) {
    return (
      <div className="flex" style={{ minHeight: '100dvh' }}>
        <AppChrome
          layout="rail"
          fallbackLabel={currentPage?.label}
          context={scope.kind === 'trip' ? 'trip' : 'near'}
        >
          <DesktopNav pages={pages} />
        </AppChrome>
        <main className="flex-1 min-w-0 flex flex-col" style={{ height: '100dvh' }}>
          {redirects}
          <ErrorBoundary>
            <SwipeNavigator pages={pages} showBar={false} />
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        paddingTop,
      }}
    >
      {/* One chrome, every tab. The pill on the left is the only part that
          changes, and the screen on top decides what it says. */}
      {!hideHeader && (
        <AppChrome
          fallbackLabel={currentPage?.label}
          context={scope.kind === 'trip' ? 'trip' : 'near'}
        />
      )}

      {redirects}

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
// The backdrop and centring existed only to float a phone-shaped frame in the
// middle of a desktop window. The frame is gone (see .app-frame in
// index.css); this is now just the app's outermost element.
const DesktopFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="app-frame">{children}</div>
);

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
      // back re-ran every query on screen, fine for a free database read,
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
                  <ChromeProvider>
                    <DesktopFrame>
                      <AppContentWrapped />
                    </DesktopFrame>
                  </ChromeProvider>
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
