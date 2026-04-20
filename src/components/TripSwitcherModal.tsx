import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Radar, X } from 'lucide-react';
import type { Trip } from '../lib/supabase';
import TripsCarousel from './TripsCarousel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  loading: boolean;
  currentMode: 'trip' | 'local' | null;
  currentTripId: string | null;
  onSelectNearby: () => void;
  onSelectTrip: (trip: Trip) => void;
  busyTripId?: string | null;
}

const TripSwitcherModal: React.FC<Props> = ({
  isOpen,
  onClose,
  trips,
  loading,
  currentMode,
  currentTripId,
  onSelectNearby,
  onSelectTrip,
  busyTripId,
}) => {
  const isLocal = currentMode === 'local';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-end justify-center"
          style={{
            background: 'rgba(0,0,0,0.4)',
            position: 'fixed',
            inset: 0,
            zIndex: 75,
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-lg"
            style={{
              background: 'var(--surface-container)',
              borderRadius: '24px 24px 0 0',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--outline)', flexShrink: 0 }}
            >
              <h3 className="text-[16px] font-extrabold tracking-tight">Switch context</h3>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--surface-container-high)',
                  color: 'var(--text-secondary)',
                  minHeight: 0,
                  minWidth: 0,
                }}
                aria-label="Close switcher"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-3 py-3 space-y-1.5">
              <button
                onClick={onSelectNearby}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors"
                style={{
                  background: isLocal ? 'var(--accent-container)' : 'transparent',
                  minHeight: 0,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <Radar size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-extrabold">Nearby</div>
                  <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    What's open around you right now
                  </div>
                </div>
                {isLocal && <Check size={16} style={{ color: 'var(--accent)' }} />}
              </button>

              <div
                className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] px-3 pt-3 pb-2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                My trips {trips.length > 0 && <span style={{ opacity: 0.7 }}>({trips.length})</span>}
              </div>

              {loading ? (
                <div className="px-1">
                  <div
                    className="activity-card-shimmer rounded-2xl"
                    style={{ height: '120px', background: 'var(--surface-container-high)' }}
                  />
                </div>
              ) : trips.length === 0 ? (
                <div
                  className="rounded-xl px-3 py-4 text-center text-[12.5px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  No saved trips. Plan one from the + tab to switch into it.
                </div>
              ) : (
                <div className="px-1">
                  <TripsCarousel
                    trips={trips}
                    activeTripId={isLocal ? null : currentTripId}
                    onSelect={onSelectTrip}
                    busyTripId={busyTripId ?? null}
                    selectLabel="Switch to this trip"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TripSwitcherModal;
