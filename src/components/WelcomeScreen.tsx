import React from 'react';
import { Plane, Radar, ArrowRight, Sparkles } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useNavigate } from 'react-router-dom';

const WelcomeScreen: React.FC = () => {
  const { setAppMode } = useTravel();
  const navigate = useNavigate();

  const chooseTrip = () => {
    setAppMode('trip');
    // hasCompletedOnboarding stays false, so ConversationalOnboarding renders next
  };

  const chooseLocal = () => {
    setAppMode('local');
    navigate('/nearby', { replace: true });
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
