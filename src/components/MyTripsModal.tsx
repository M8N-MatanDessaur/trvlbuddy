import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cloud, Trash2, Download, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import { useToast } from '../contexts/ToastContext';
import { listMyTrips, loadTrip, deleteTrip } from '../services/tripsService';
import type { Trip } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MyTripsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setCurrentPlan, setActivities, setTranslations, setEmergencyContacts, setHasCompletedOnboarding, setAppMode, setCurrentTripId } = useTravel();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    listMyTrips(user.id)
      .then(setTrips)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id]);

  const handleLoad = async (tripId: string) => {
    setWorking(tripId);
    const row = await loadTrip(tripId);
    setWorking(null);
    if (!row) {
      toast('Could not load trip', 'error');
      return;
    }
    const bundle = row.plan;
    if (!bundle?.currentPlan) {
      toast('Trip has no saved plan', 'error');
      return;
    }
    setCurrentPlan(bundle.currentPlan);
    setActivities(bundle.activities || []);
    setTranslations(bundle.translations || []);
    setEmergencyContacts(bundle.emergencyContacts || []);
    setAppMode('trip');
    setHasCompletedOnboarding(true);
    setCurrentTripId(row.id);
    toast(`Loaded ${row.title}`, 'success');
    onClose();
  };

  const handleDelete = async (tripId: string) => {
    if (!user) return;
    setWorking(tripId);
    const { error } = await deleteTrip(tripId, user.id);
    setWorking(null);
    if (error) {
      toast(error, 'error');
      return;
    }
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    toast('Trip deleted', 'success');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-lg"
            style={{ background: 'var(--surface-container)', borderRadius: '24px 24px 0 0', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--outline)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                  <Cloud size={16} />
                </div>
                <h3 className="text-[17px] font-extrabold tracking-tight">My Trips</h3>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(80vh - 70px)' }}>
              {loading && (
                <div className="text-center text-[13px] py-8" style={{ color: 'var(--text-tertiary)' }}>
                  Loading...
                </div>
              )}
              {!loading && trips.length === 0 && (
                <div className="text-center py-10" style={{ color: 'var(--text-tertiary)' }}>
                  <Cloud size={28} className="mx-auto mb-3 opacity-50" />
                  <p className="text-[13px]">No saved trips yet.</p>
                  <p className="text-[12px] mt-1">Save your current trip from the menu.</p>
                </div>
              )}
              {!loading && trips.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {trips.map((trip) => (
                    <li
                      key={trip.id}
                      className="rounded-2xl p-4"
                      style={{ background: 'var(--surface-container-high)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[15px] font-bold truncate">{trip.title}</h4>
                          <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {(trip.start_date || trip.end_date) && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={11} />
                                {trip.start_date || '?'}{trip.end_date ? ' - ' + trip.end_date : ''}
                              </span>
                            )}
                            {trip.cities && trip.cities.length > 0 && (
                              <span className="truncate">{trip.cities.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleLoad(trip.id)}
                            disabled={working === trip.id}
                            className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50"
                            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                            aria-label="Load trip"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(trip.id)}
                            disabled={working === trip.id}
                            className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50"
                            style={{ background: 'var(--surface-container)', color: 'var(--error)' }}
                            aria-label="Delete trip"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MyTripsModal;
