import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, UserPlus, Link as LinkIcon, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { joinTripByToken, setCurrentTrip } from '../services/tripMembersService';
import { loadTrip } from '../services/tripsService';

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/trip\/join\/([^/]+)/);
    if (match) return match[1];
  } catch {
    // not a URL; fall through
  }
  if (/^[a-z0-9]{4,32}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

const NewTripLauncher: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    setCurrentPlan,
    setActivities,
    setTranslations,
    setEmergencyContacts,
    setHasCompletedOnboarding,
    setAppMode,
    setCurrentTripId,
  } = useTravel();

  const [mode, setMode] = useState<'choice' | 'join'>('choice');
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    // Bail out of the "+" chooser and return to the Nearby (local) view. The
    // user's saved trips are untouched -- they can always come back via My
    // Trips or the "+" tab again.
    setAppMode('local');
    setHasCompletedOnboarding(true);
    navigate('/nearby', { replace: true });
  };

  const handleCreate = () => {
    setCurrentPlan(null);
    setActivities([]);
    setTranslations([]);
    setEmergencyContacts([]);
    setCurrentTripId(null);
    setHasCompletedOnboarding(false);
    setAppMode('trip');

    try {
      localStorage.removeItem('currentTravelPlan');
      localStorage.removeItem('generatedActivities');
      localStorage.removeItem('generatedTranslations');
      localStorage.removeItem('emergencyContacts');
      localStorage.removeItem('hasCompletedOnboarding');
    } catch {
      // ignore
    }

    if (user) setCurrentTrip(user.id, null).catch(() => {});
    // AppContent will see appMode='trip' + hasCompletedOnboarding=false and
    // render ConversationalOnboarding directly.
    navigate('/', { replace: true });
  };

  const handleJoin = async () => {
    if (!user) return;
    const token = extractToken(code);
    if (!token) {
      setError('That does not look like a valid invite link or code.');
      return;
    }
    setJoining(true);
    setError(null);
    const tripId = await joinTripByToken(token);
    if (!tripId) {
      setJoining(false);
      setError('Invite not found. Double-check the link or code.');
      return;
    }
    const trip = await loadTrip(tripId);
    if (!trip) {
      setJoining(false);
      setError("Couldn't load the trip. Try again.");
      return;
    }
    const bundle = trip.plan;
    if (bundle?.currentPlan) {
      setCurrentPlan(bundle.currentPlan);
      setActivities(bundle.activities || []);
      setTranslations(bundle.translations || []);
      setEmergencyContacts(bundle.emergencyContacts || []);
    }
    setAppMode('trip');
    setHasCompletedOnboarding(true);
    setCurrentTripId(tripId);
    await setCurrentTrip(user.id, tripId);
    toast(`Joined ${trip.title}`, 'success');
    navigate('/', { replace: true });
  };

  return (
    <section className="page flex flex-col">
      <AnimatePresence mode="wait">
        {mode === 'choice' && (
          <motion.div
            key="choice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1"
          >
            <div className="flex justify-center mb-5 mt-2">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
              >
                <Sparkles size={24} />
              </div>
            </div>

            <div className="text-center mb-7 px-2">
              <h1 className="text-[26px] font-extrabold tracking-tight leading-tight mb-2">
                Where to next?
              </h1>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Start a brand new trip with the AI concierge, or hop into one a friend is already
                planning.
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <button
                onClick={handleCreate}
                className="text-left rounded-3xl p-5 transition active:scale-[0.985]"
                style={{
                  background: 'var(--accent)',
                  color: 'white',
                  boxShadow: '0 10px 26px -12px color-mix(in srgb, var(--accent) 70%, transparent)',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
                  >
                    <Plane size={20} />
                  </div>
                </div>
                <div className="text-[17px] font-extrabold mb-0.5">Start a new trip</div>
                <div className="text-[12.5px]" style={{ opacity: 0.9 }}>
                  Chat with the AI to lay down your destinations, dates, activities, and phrases.
                </div>
              </button>

              <button
                onClick={() => setMode('join')}
                className="text-left rounded-3xl p-5 transition active:scale-[0.985]"
                style={{
                  background: 'var(--surface-container)',
                  color: 'var(--text-primary)',
                  border: '0.5px solid var(--outline)',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                  >
                    <UserPlus size={20} />
                  </div>
                </div>
                <div className="text-[17px] font-extrabold mb-0.5">Join a friend's trip</div>
                <div className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                  Paste their invite link or code. You'll both edit the same itinerary live.
                </div>
              </button>
            </div>

            <button
              onClick={handleCancel}
              className="self-center text-[13px] font-semibold px-4 py-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Never mind, back to Nearby
            </button>
          </motion.div>
        )}

        {mode === 'join' && (
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1"
          >
            <button
              onClick={() => {
                setError(null);
                setCode('');
                setMode('choice');
              }}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold mb-4 self-start"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <div className="flex justify-center mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
              >
                <UserPlus size={24} />
              </div>
            </div>

            <div className="text-center mb-6 px-2">
              <h1 className="text-[24px] font-extrabold tracking-tight leading-tight mb-2">
                Paste the invite
              </h1>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Either the full link or just the short code at the end.
              </p>
            </div>

            <label
              className="flex items-center gap-2 rounded-2xl px-4 py-3"
              style={{
                background: 'var(--surface-container)',
                border: '0.5px solid var(--outline)',
              }}
            >
              <LinkIcon size={15} style={{ color: 'var(--text-tertiary)' }} />
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                placeholder="Invite link or code"
                className="flex-1 bg-transparent outline-none text-[14px]"
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>

            {error && (
              <div
                className="rounded-xl px-3.5 py-2.5 text-[12.5px] mt-3"
                style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#b91c1c' }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={joining || !code.trim()}
              className="mt-4 w-full py-3.5 rounded-2xl text-[14.5px] font-bold transition active:scale-[0.985] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              {joining && <Loader2 size={16} className="animate-spin" />}
              {joining ? 'Joining...' : 'Join trip'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default NewTripLauncher;
