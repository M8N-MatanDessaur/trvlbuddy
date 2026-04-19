import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Camera,
  Award,
  Sparkles,
  Compass,
  ArrowRight,
  ArrowLeft,
  Radar,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import { useNavigate } from 'react-router-dom';

interface Step {
  icon: React.ComponentType<{ size?: number }>;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  art: 'travel' | 'share';
}

const PARIS_GIF = '/onboarding/paris-travel.gif';
const PISA_GIF = '/onboarding/pisa-selfie.gif';

const ContributorOnboarding: React.FC = () => {
  const { profile, markOnboarded } = useAuth();
  const { setAppMode, setHasCompletedOnboarding } = useTravel();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState<null | 'trip' | 'local'>(null);

  const firstName = (profile?.display_name || profile?.email || '').split(/[@\s]/)[0] || 'traveler';

  const steps: Step[] = [
    {
      icon: Plane,
      eyebrow: 'Hey ' + firstName,
      title: 'Welcome to TrvlBuddy',
      body: (
        <>
          Your pocket guide for trips in progress and neighborhoods you've never set foot in.
          We'll keep this short.
        </>
      ),
      art: 'travel',
    },
    {
      icon: Sparkles,
      eyebrow: 'What you can do',
      title: 'Plan, explore, translate, survive',
      body: (
        <>
          Build a multi-city itinerary with AI, see what's open around you right now, learn
          local phrases, and keep emergency contacts one tap away. Every tab works on its own.
        </>
      ),
      art: 'travel',
    },
    {
      icon: Camera,
      eyebrow: 'How it works',
      title: 'Photos come from travelers',
      body: (
        <>
          Instead of stock photos, every picture you see is contributed by someone who went.
          Tap the camera button on any card to share what you saw. No image yet? That means
          you could be the first.
        </>
      ),
      art: 'share',
    },
    {
      icon: Award,
      eyebrow: 'Influence',
      title: 'Earn Influence with every photo',
      body: (
        <>
          Upload a photo, get <strong>+1 Influence</strong>. It's our way of recognizing the
          travelers who make TrvlBuddy useful for everyone else. Your total lives in the menu
          and grows as you keep sharing.
        </>
      ),
      art: 'share',
    },
    {
      icon: Compass,
      eyebrow: 'Pick your starting point',
      title: 'Where do you want to begin?',
      body: (
        <>
          You can switch between trip planning and local exploration any time from the menu.
        </>
      ),
      art: 'travel',
    },
  ];

  const isLast = stepIndex === steps.length - 1;
  const current = steps[stepIndex];
  const Icon = current.icon;
  const artSrc = current.art === 'share' ? PISA_GIF : PARIS_GIF;

  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  const finish = async (choice: 'trip' | 'local') => {
    setFinishing(choice);
    await markOnboarded();
    if (choice === 'trip') {
      setAppMode('trip');
      // hasCompletedOnboarding stays false so ConversationalOnboarding runs next.
    } else {
      setAppMode('local');
      setHasCompletedOnboarding(true);
      navigate('/nearby', { replace: true });
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-5 py-10"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background: 'var(--surface-container)',
          borderRadius: '28px',
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.15), 0 10px 30px -10px rgba(0,0,0,0.1)',
          border: '1px solid var(--outline)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-44"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 65%)',
          }}
          aria-hidden="true"
        />

        <div className="relative px-6 pt-8 pb-6 flex flex-col min-h-[540px]">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-7">
            {steps.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === stepIndex ? '22px' : '6px',
                  height: '6px',
                  background:
                    i === stepIndex
                      ? 'var(--accent)'
                      : i < stepIndex
                      ? 'color-mix(in srgb, var(--accent) 50%, transparent)'
                      : 'var(--outline)',
                }}
              />
            ))}
          </div>

          {/* Step art */}
          <div className="flex justify-center mb-5">
            <div
              className="relative w-40 h-40 rounded-3xl overflow-hidden"
              style={{
                background: 'var(--accent-container)',
                boxShadow: '0 12px 28px -14px color-mix(in srgb, var(--accent) 60%, transparent)',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={artSrc}
                  src={artSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                />
              </AnimatePresence>
              <div
                className="absolute bottom-2 right-2 w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'var(--accent)',
                  color: 'white',
                  boxShadow: '0 6px 14px -6px color-mix(in srgb, var(--accent) 70%, transparent)',
                }}
              >
                <Icon size={16} />
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="text-center flex-1"
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2"
                style={{ color: 'var(--accent)' }}
              >
                {current.eyebrow}
              </p>
              <h1 className="text-[26px] font-extrabold tracking-tight leading-tight mb-3">
                {current.title}
              </h1>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {current.body}
              </p>

              {isLast && (
                <div className="mt-7 flex flex-col gap-3">
                  <button
                    onClick={() => finish('trip')}
                    disabled={finishing !== null}
                    className="flex items-center gap-3 rounded-2xl p-4 text-left transition active:scale-[0.985] disabled:opacity-60"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
                    >
                      <Plane size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[15px] font-extrabold">Plan a Trip</div>
                      <div className="text-[12px]" style={{ opacity: 0.9 }}>
                        Full guide for where you're headed.
                      </div>
                    </div>
                    <ArrowRight size={18} style={{ opacity: 0.9 }} />
                  </button>

                  <button
                    onClick={() => finish('local')}
                    disabled={finishing !== null}
                    className="flex items-center gap-3 rounded-2xl p-4 text-left transition active:scale-[0.985] disabled:opacity-60"
                    style={{
                      background: 'var(--surface-container-high)',
                      color: 'var(--text-primary)',
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
                        See what's open around you right now.
                      </div>
                    </div>
                    <ArrowRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {!isLast && (
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={back}
                disabled={stepIndex === 0}
                className="flex items-center gap-1.5 text-[13px] font-semibold disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              <button
                type="button"
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13.5px] font-bold transition active:scale-[0.985]"
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContributorOnboarding;
