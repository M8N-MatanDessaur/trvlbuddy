import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Volume2, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface ShowToLocalPhrase {
  local: string;
  english: string;
  pronunciation?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  phrases: ShowToLocalPhrase[];
  startIndex: number;
  langCode?: string;
}

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 300;

const ShowToLocal: React.FC<Props> = ({ isOpen, onClose, phrases, startIndex, langCode }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [direction, setDirection] = useState(0);

  // Reset index when opening with new startIndex
  React.useEffect(() => {
    if (isOpen) setCurrentIndex(startIndex);
  }, [isOpen, startIndex]);

  const phrase = phrases[currentIndex];

  const speak = () => {
    if (!phrase || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(phrase.local);
    if (langCode) {
      u.lang = langCode;
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
      if (match) u.voice = match;
    }
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  };

  const goNext = () => {
    if (currentIndex < phrases.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
      goNext();
    } else if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
      goPrev();
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0 }),
  };

  if (!phrase) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, margin: 0, background: 'var(--bg-primary)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
            <span className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {currentIndex + 1} / {phrases.length}
            </span>
            <button
              onClick={onClose}
              className="flex items-center justify-center"
              style={{ height: '36px', aspectRatio: '1', borderRadius: '50%', background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Swipeable content */}
          <div className="flex-1 flex items-center justify-center overflow-hidden relative">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 flex flex-col items-center justify-center px-8"
              >
                <div className="text-center max-w-md">
                  <div className="text-[36px] sm:text-[48px] font-bold leading-tight mb-5" style={{ color: 'var(--text-primary)' }}>
                    {phrase.local}
                  </div>
                  {phrase.pronunciation && (
                    <div className="text-[16px] mb-2" style={{ color: 'var(--accent)' }}>
                      {phrase.pronunciation}
                    </div>
                  )}
                  <div className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>
                    {phrase.english}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Nav arrows */}
            {currentIndex > 0 && (
              <button onClick={goPrev} className="absolute left-3 flex items-center justify-center" style={{ height: '40px', aspectRatio: '1', borderRadius: '50%', background: 'var(--surface-container)', color: 'var(--text-tertiary)' }}>
                <ChevronLeft size={20} />
              </button>
            )}
            {currentIndex < phrases.length - 1 && (
              <button onClick={goNext} className="absolute right-3 flex items-center justify-center" style={{ height: '40px', aspectRatio: '1', borderRadius: '50%', background: 'var(--surface-container)', color: 'var(--text-tertiary)' }}>
                <ChevronRight size={20} />
              </button>
            )}
          </div>

          {/* Bottom: speak button + swipe hint */}
          <div className="flex flex-col items-center pb-10 pt-4 flex-shrink-0">
            <button
              onClick={speak}
              className="flex items-center justify-center mb-3 transition-transform active:scale-90"
              style={{ height: '64px', aspectRatio: '1', borderRadius: '50%', background: 'var(--accent)', color: 'white' }}
            >
              <Volume2 size={28} />
            </button>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Swipe or tap arrows to browse
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShowToLocal;
