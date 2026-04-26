import React, { useEffect, useState } from 'react';
import { Plane, Radar, ArrowRight, Sparkles, Briefcase } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { listMyTrips, loadTrip } from '../services/tripsService';
import type { Trip } from '../lib/supabase';
import TripsCarousel from './TripsCarousel';

const WelcomeScreen: React.FC = () => {
  const {
    setAppMode,
    setCurrentPlan,
    setActivities,
    setTranslations,
    setEmergencyContacts,
    setHasCompletedOnboarding,
    setCurrentTripId,
  } = useTravel();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [openingTripId, setOpeningTripId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setSavedTrips([]);
      return;
    }
    let cancelled = false;
    setTripsLoading(true);
    listMyTrips(user.id)
      .then((trips) => {
        if (!cancelled) setSavedTrips(trips);
      })
      .finally(() => {
        if (!cancelled) setTripsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const chooseTrip = () => {
    setAppMode('trip');
    // hasCompletedOnboarding stays false, so ConversationalOnboarding renders next
  };

  const chooseLocal = () => {
    setAppMode('local');
    navigate('/nearby', { replace: true });
  };

  const openSavedTrip = async (trip: Trip) => {
    setOpeningTripId(trip.id);
    const row = await loadTrip(trip.id);
    setOpeningTripId(null);
    if (!row?.plan?.currentPlan) {
      toast('Could not open trip', 'error');
      return;
    }
    const bundle = row.plan;
    setCurrentPlan(bundle.currentPlan);
    setActivities(bundle.activities || []);
    setTranslations(bundle.translations || []);
    setEmergencyContacts(bundle.emergencyContacts || []);
    setAppMode('trip');
    setHasCompletedOnboarding(true);
    setCurrentTripId(row.id);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-primary)', padding: '2rem 1.5rem' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <Plane size={18} />
        </div>
        <span className="text-[18px] font-extrabold tracking-tight">TrvlBuddy</span>
      </div>

      {/* Intro */}
      <div className="mb-10">
        <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight mb-3">
          How can we help<br />you today?
        </h1>
        <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Pick a starting point. You can switch at any time.
        </p>
      </div>

      {/* Choice cards */}
      <div className="flex flex-col gap-4 flex-1">
        <button
          onClick={chooseTrip}
          className="text-left rounded-3xl p-5 transition-all active:scale-[0.98]"
          style={{
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
            >
              <Plane size={22} />
            </div>
            <ArrowRight size={20} style={{ opacity: 0.85 }} />
          </div>
          <h2 className="text-[20px] font-extrabold mb-1.5">Plan a Trip</h2>
          <p className="text-[13px] leading-relaxed" style={{ opacity: 0.9 }}>
            Tell us where you're headed and we'll build a full travel guide: activities, phrases, emergency info, and more.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold" style={{ opacity: 0.85 }}>
            <Sparkles size={12} />
            <span>AI-guided setup</span>
          </div>
        </button>

        <button
          onClick={chooseLocal}
          className="text-left rounded-3xl p-5 transition-all active:scale-[0.98]"
          style={{
            background: 'var(--surface-container)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
            >
              <Radar size={22} />
            </div>
            <ArrowRight size={20} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <h2 className="text-[20px] font-extrabold mb-1.5">Explore Nearby</h2>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            No trip, no setup. See what's open around you right now and chat with your AI concierge about where you are.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
            <Radar size={12} />
            <span>Uses your location</span>
          </div>
        </button>
      </div>

      {/* Saved trips: lets a returning user jump directly into an existing
          trip instead of being forced through "Plan a Trip" again. Only
          appears when the signed-in user actually has trips on file. */}
      {savedTrips.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Briefcase size={14} style={{ color: 'var(--text-secondary)' }} />
            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
              Continue a saved trip
            </h2>
          </div>
          <TripsCarousel
            trips={savedTrips}
            onSelect={openSavedTrip}
            busyTripId={openingTripId}
            selectLabel="Open"
          />
        </div>
      )}

      {tripsLoading && savedTrips.length === 0 && (
        <div className="mt-6">
          <div
            className="rounded-2xl activity-card-shimmer"
            style={{ height: '110px', background: 'var(--surface-container-high)' }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Footer note */}
      <p
        className="text-[11px] text-center mt-6"
        style={{ color: 'var(--text-tertiary)' }}
      >
        You can switch between modes later from the menu.
      </p>
    </div>
  );
};

export default WelcomeScreen;
