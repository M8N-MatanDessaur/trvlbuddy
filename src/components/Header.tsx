import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import { useToast } from '../contexts/ToastContext';
import { listMyTrips, loadTrip } from '../services/tripsService';
import type { Trip } from '../lib/supabase';
import Avatar from './Avatar';
import TripSwitcherModal from './TripSwitcherModal';
import type { PageDef } from './SwipeNavigator';

interface Props {
  pages?: PageDef[];
}

const Header: React.FC<Props> = ({ pages }) => {
  const { profile, user } = useAuth();
  const {
    appMode,
    currentPlan,
    currentTripId,
    setAppMode,
    setCurrentPlan,
    setActivities,
    setTranslations,
    setEmergencyContacts,
    setHasCompletedOnboarding,
    setCurrentTripId,
  } = useTravel();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);

  const isLocal = appMode === 'local';
  // Headline label: trip title in trip mode, "Nearby" in local mode, page label otherwise.
  const currentPage = pages?.find((p) => p.path === location.pathname) || pages?.[0];
  const label = useMemo(() => {
    if (isLocal) return 'Nearby';
    if (currentPlan?.title) return currentPlan.title;
    return currentPage?.label || 'TrvlBuddy';
  }, [isLocal, currentPlan?.title, currentPage?.label]);

  // Lazy-load trips the first time the user might need to switch.
  const ensureTripsLoaded = useCallback(async () => {
    if (!user || tripsLoaded || tripsLoading) return;
    setTripsLoading(true);
    const rows = await listMyTrips(user.id);
    setTrips(rows);
    setTripsLoading(false);
    setTripsLoaded(true);
  }, [user, tripsLoaded, tripsLoading]);

  // Refresh trips on auth or when the user touches a trip outside this header.
  useEffect(() => {
    setTripsLoaded(false);
  }, [user?.id, currentTripId, currentPlan?.title]);

  const switchToNearby = useCallback(() => {
    setAppMode('local');
    setSwitcherOpen(false);
    navigate('/nearby');
  }, [setAppMode, navigate]);

  const switchToTrip = useCallback(
    async (trip: Trip) => {
      if (!user) return;
      if (trip.id === currentTripId && !isLocal) {
        setSwitcherOpen(false);
        navigate('/');
        return;
      }
      setBusyTripId(trip.id);
      const row = await loadTrip(trip.id);
      setBusyTripId(null);
      if (!row) {
        toast('Could not load trip', 'error');
        return;
      }
      const bundle = row.plan;
      if (bundle?.currentPlan) {
        setCurrentPlan(bundle.currentPlan);
        setActivities(bundle.activities || []);
        setTranslations(bundle.translations || []);
        setEmergencyContacts(bundle.emergencyContacts || []);
      }
      setAppMode('trip');
      setHasCompletedOnboarding(true);
      setCurrentTripId(row.id);
      setSwitcherOpen(false);
      navigate('/');
    },
    [
      user,
      currentTripId,
      isLocal,
      navigate,
      setActivities,
      setAppMode,
      setCurrentPlan,
      setCurrentTripId,
      setEmergencyContacts,
      setHasCompletedOnboarding,
      setTranslations,
      toast,
    ],
  );

  const openSwitcher = () => {
    void ensureTripsLoaded();
    setSwitcherOpen(true);
  };

  // Swipe on the label cycles through [Nearby, ...trips].
  // We resolve the current index off appMode + currentTripId at the time of
  // the swipe so the user always sees the right neighbour.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const cycleBy = useCallback(
    async (delta: 1 | -1) => {
      await ensureTripsLoaded();
      const order: Array<{ kind: 'nearby' } | { kind: 'trip'; trip: Trip }> = [
        { kind: 'nearby' as const },
        ...trips.map((trip) => ({ kind: 'trip' as const, trip })),
      ];
      if (order.length <= 1) return;
      const currentIndex = isLocal
        ? 0
        : Math.max(0, order.findIndex((entry) => entry.kind === 'trip' && entry.trip.id === currentTripId));
      const nextIndex = (currentIndex + delta + order.length) % order.length;
      const target = order[nextIndex];
      if (target.kind === 'nearby') switchToNearby();
      else switchToTrip(target.trip);
    },
    [trips, isLocal, currentTripId, ensureTripsLoaded, switchToNearby, switchToTrip],
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) swiping.current = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const wasSwipe = swiping.current && Math.abs(dx) > 40;
    touchStart.current = null;
    swiping.current = false;
    if (wasSwipe) {
      // Suppress the synthetic click that would otherwise fire after the
      // swipe and double-trigger openSwitcher.
      e.preventDefault();
      void cycleBy(dx < 0 ? 1 : -1);
    }
    // Plain taps fall through to onClick -> openSwitcher (single source of
    // truth so we don't open the modal twice on touch devices).
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5"
        style={{
          height: 'calc(3.25rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: 'var(--bg-primary)',
          borderBottom: '0.33px solid var(--outline)',
        }}
      >
        <button
          onClick={openSwitcher}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="flex items-center gap-2.5 transition-transform active:scale-[0.97]"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 10px 6px 0',
            color: 'var(--text-primary)',
            minHeight: 0,
            minWidth: 0,
            maxWidth: '70%',
          }}
          aria-label="Switch trip or Nearby"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <Plane size={13} />
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-extrabold tracking-tight truncate"
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="flex items-center justify-center rounded-full transition-transform active:scale-95"
          style={{
            padding: 0,
            border: '1.5px solid var(--outline)',
            background: 'transparent',
            minHeight: 0,
            minWidth: 0,
          }}
          aria-label="Open profile"
        >
          <Avatar profile={profile} size={30} />
        </button>
      </header>

      <TripSwitcherModal
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        trips={trips}
        loading={tripsLoading}
        currentMode={appMode}
        currentTripId={currentTripId}
        onSelectNearby={switchToNearby}
        onSelectTrip={switchToTrip}
        busyTripId={busyTripId}
      />
    </>
  );
};

export default Header;
