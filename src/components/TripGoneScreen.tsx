import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plane, Radar, AlertCircle } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';

interface Props {
  tripTitle?: string | null;
}

const TripGoneScreen: React.FC<Props> = ({ tripTitle }) => {
  const navigate = useNavigate();
  const { setAppMode, setHasCompletedOnboarding } = useTravel();

  const goLocal = () => {
    setAppMode('local');
    setHasCompletedOnboarding(true);
    navigate('/nearby', { replace: true });
  };

  const goNewTrip = () => {
    navigate('/new-trip');
  };

  return (
    <section className="page">
      <div
        className="rounded-3xl px-6 py-10 text-center mt-6"
        style={{
          background: 'var(--surface-container)',
          border: '0.5px solid var(--outline)',
        }}
      >
        <div
          className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(220, 38, 38, 0.12)',
            color: '#dc2626',
          }}
        >
          <AlertCircle size={26} />
        </div>
        <h1
          className="text-[22px] font-extrabold tracking-tight mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          This trip is no longer available
        </h1>
        <p className="text-[13.5px] leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          {tripTitle ? <><strong>{tripTitle}</strong> was</> : 'It was'} removed by the trip owner.
          Your activities and photos for this trip are gone, but everything else on your
          account is intact.
        </p>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <button
            onClick={goNewTrip}
            className="flex items-center gap-3 rounded-2xl p-4 text-left transition active:scale-[0.985]"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
            >
              <Plane size={20} />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-extrabold">Plan a new trip</div>
              <div className="text-[12px]" style={{ opacity: 0.9 }}>
                Start fresh with a new itinerary.
              </div>
            </div>
            <ArrowRight size={18} style={{ opacity: 0.9 }} />
          </button>

          <button
            onClick={goLocal}
            className="flex items-center gap-3 rounded-2xl p-4 text-left transition active:scale-[0.985]"
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--text-primary)',
              border: 'none',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
            >
              <Radar size={20} />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-extrabold">Explore Nearby</div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                See what's around you right now.
              </div>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TripGoneScreen;
