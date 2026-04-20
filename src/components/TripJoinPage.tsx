import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import { useToast } from '../contexts/ToastContext';
import { joinTripByToken, setCurrentTrip } from '../services/tripMembersService';
import { loadTrip } from '../services/tripsService';

interface Props {
  token: string;
}

const TripJoinPage: React.FC<Props> = ({ token }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { setCurrentPlan, setActivities, setTranslations, setEmergencyContacts, setAppMode, setHasCompletedOnboarding, setCurrentTripId } = useTravel();

  const [status, setStatus] = useState<'joining' | 'loaded' | 'missing' | 'error'>('joining');
  const [tripTitle, setTripTitle] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || !user || ran.current) return;
    ran.current = true;

    (async () => {
      const tripId = await joinTripByToken(token);
      if (!tripId) {
        setStatus('missing');
        return;
      }
      const trip = await loadTrip(tripId);
      if (!trip) {
        setStatus('error');
        return;
      }
      setTripTitle(trip.title);
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
      setStatus('loaded');
      setTimeout(() => navigate('/', { replace: true }), 1200);
    })().catch(() => setStatus('error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  useEffect(() => {
    if (status === 'loaded' && tripTitle) {
      toast(`Joined ${tripTitle}`, 'success');
    }
  }, [status, tripTitle, toast]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 text-center"
        style={{
          background: 'var(--surface-container)',
          border: '0.5px solid var(--outline)',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
          style={{
            background: status === 'loaded' ? 'var(--accent)' : 'var(--accent-container)',
            color: status === 'loaded' ? 'white' : 'var(--accent)',
          }}
        >
          {status === 'loaded' ? <Check size={28} /> : <Users size={28} />}
        </motion.div>

        {status === 'joining' && (
          <>
            <h1 className="text-[22px] font-extrabold tracking-tight mb-2">Joining trip...</h1>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              Pulling the itinerary and adding you to the crew.
            </p>
          </>
        )}
        {status === 'loaded' && (
          <>
            <h1 className="text-[22px] font-extrabold tracking-tight mb-2">You're in</h1>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {tripTitle ? `Loaded "${tripTitle}". Taking you there now.` : 'Loading your trip...'}
            </p>
          </>
        )}
        {status === 'missing' && (
          <>
            <h1 className="text-[22px] font-extrabold tracking-tight mb-2">Invite not found</h1>
            <p className="text-[13px] mb-5" style={{ color: 'var(--text-secondary)' }}>
              This invite link is invalid or has been revoked.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-5 py-3 rounded-2xl text-[13px] font-bold"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              Go to app
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-[22px] font-extrabold tracking-tight mb-2">Something went wrong</h1>
            <p className="text-[13px] mb-5" style={{ color: 'var(--text-secondary)' }}>
              We couldn't load this trip. Try again in a moment.
            </p>
            <button
              onClick={() => {
                ran.current = false;
                setStatus('joining');
              }}
              className="px-5 py-3 rounded-2xl text-[13px] font-bold"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TripJoinPage;
