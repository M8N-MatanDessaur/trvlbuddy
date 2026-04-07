import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  localText: string;
  englishText: string;
  pronunciation?: string;
}

const ShowToLocal: React.FC<Props> = ({ isOpen, onClose, localText, englishText, pronunciation }) => {
  const speak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(localText);
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8"
          style={{ background: 'var(--bg-primary)' }}
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 flex items-center justify-center"
            style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)', width: '40px', height: '40px', minWidth: '40px', borderRadius: '50%' }}
          >
            <X size={20} />
          </button>

          <div className="text-center max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="text-[36px] sm:text-[48px] font-bold leading-tight mb-6" style={{ color: 'var(--text-primary)' }}>
              {localText}
            </div>
            {pronunciation && (
              <div className="text-lg mb-2" style={{ color: 'var(--accent)' }}>
                {pronunciation}
              </div>
            )}
            <div className="text-base mb-8" style={{ color: 'var(--text-secondary)' }}>
              {englishText}
            </div>
            <button
              onClick={speak}
              className="flex items-center justify-center mx-auto transition-transform active:scale-90"
              style={{ background: 'var(--accent)', color: 'white', width: '64px', height: '64px', minWidth: '64px', borderRadius: '50%' }}
            >
              <Volume2 size={28} />
            </button>
            <div className="text-xs mt-4" style={{ color: 'var(--text-tertiary)' }}>
              Tap anywhere to close
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShowToLocal;
