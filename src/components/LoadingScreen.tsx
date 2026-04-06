import React, { useState, useEffect } from 'react';
import { Plane, MapPin, Languages, Compass, Lightbulb } from 'lucide-react';

const loadingSteps = [
  { icon: MapPin, text: 'Analyzing your destinations...' },
  { icon: Compass, text: 'Finding the best activities...' },
  { icon: Languages, text: 'Learning local phrases...' },
  { icon: Plane, text: 'Personalizing your experience...' },
];

const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev >= 95 ? prev : prev + Math.random() * 12));
    }, 800);

    const stepInterval = setInterval(() => {
      setActiveStep(prev => Math.min(prev + 1, loadingSteps.length - 1));
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-center max-w-sm mx-auto px-6 animate-[fadeIn_0.5s_ease]">
        {/* Icon */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-container)] flex items-center justify-center mx-auto">
            <Plane size={28} className="text-[var(--accent)]" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold mb-2">Setting up your trip</h2>
        <p className="text-sm text-text-secondary mb-8">AI is generating personalized content for you</p>

        {/* Progress steps */}
        <div className="space-y-3 mb-8 text-left">
          {loadingSteps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === activeStep;
            const isDone = i < activeStep;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive ? 'glass-card' : isDone ? 'opacity-50' : 'opacity-30'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  isActive ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface-container-high)] text-text-secondary'
                }`}>
                  <Icon size={16} />
                </div>
                <span className={`text-sm ${isActive ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                  {step.text}
                </span>
                {isActive && (
                  <div className="ml-auto">
                    <div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="bg-[var(--surface-container-high)] rounded-full h-1.5 mb-3 overflow-hidden">
          <div
            className="progress-bar h-1.5 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(progress, 95)}%` }}
          />
        </div>
        <p className="text-xs text-text-tertiary">
          {Math.round(Math.min(progress, 95))}% complete
        </p>

        {/* Tip */}
        <div className="mt-8 p-3 rounded-xl" style={{ backgroundColor: 'var(--accent-container)' }}>
          <p className="text-xs flex items-start gap-2" style={{ color: 'var(--on-accent-container)' }}>
            <Lightbulb size={14} className="flex-shrink-0 mt-0.5" />
            <span>This takes a moment as we generate activities, translations, and emergency info tailored to your trip.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
