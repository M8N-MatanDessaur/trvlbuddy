import React from 'react';
import { X, Clock, MapPin, Lightbulb, Navigation, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedActivity } from '../types/TravelData';
import { getCategoryIcon } from '../utils/categoryIcons';

interface Props {
  activity: GeneratedActivity | null;
  isOpen: boolean;
  onClose: () => void;
}

const DynamicActivityModal: React.FC<Props> = ({ activity, isOpen, onClose }) => {
  if (!activity) return null;

  const CategoryIcon = getCategoryIcon(activity.category);
  const locationQuery = encodeURIComponent(activity.location);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-lg overflow-hidden"
            style={{ background: 'var(--surface-container)', borderRadius: '24px 24px 0 0', maxHeight: '88vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--outline)' }} />
            </div>

            {/* Header */}
            <div className="flex items-start gap-3 px-5 pb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] font-extrabold leading-tight tracking-tight mb-2">{activity.name}</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}>
                    <CategoryIcon size={12} /> {activity.category}
                  </span>
                  {activity.difficulty && (
                    <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--text-tertiary)' }}>{activity.difficulty}</span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)', aspectRatio: '1' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: 'calc(88vh - 140px)' }}>
              <div className="space-y-4">

                {/* Key info grid - the important stuff first */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl text-center" style={{ background: 'var(--surface-container-high)' }}>
                    <Clock size={16} className="mx-auto mb-1.5" style={{ color: 'var(--accent)' }} />
                    <div className="text-[13px] font-bold">{activity.duration}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Duration</div>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ background: 'var(--surface-container-high)' }}>
                    <div className="text-[18px] font-extrabold mb-0.5" style={{ color: 'var(--accent)' }}>{activity.estimatedCost.includes('ree') ? 'Free' : activity.estimatedCost}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Cost</div>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ background: 'var(--surface-container-high)' }}>
                    <Clock size={16} className="mx-auto mb-1.5" style={{ color: 'var(--text-tertiary)' }} />
                    <div className="text-[13px] font-bold">{activity.bestTime || 'Anytime'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Best time</div>
                  </div>
                </div>

                {/* Description - concise */}
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {activity.description}
                </p>

                {/* Location - tappable */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${locationQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3.5 rounded-xl no-underline transition-all active:scale-[0.98]"
                  style={{ background: 'var(--surface-container-high)' }}
                >
                  <MapPin size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{activity.location}</div>
                    <div className="text-[11px]" style={{ color: 'var(--accent)' }}>Open in Maps</div>
                  </div>
                </a>

                {/* Tips */}
                {activity.tips && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: 'var(--accent-container)' }}>
                    <Lightbulb size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    <div className="text-[13px] leading-relaxed" style={{ color: 'var(--on-accent-container)' }}>{activity.tips}</div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${locationQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold no-underline transition-all active:scale-[0.98]"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    <Navigation size={16} />
                    Directions
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(activity.name + ' ' + activity.location + ' tickets')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-[14px] font-semibold no-underline transition-all active:scale-[0.98]"
                    style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)' }}
                  >
                    <ExternalLink size={16} />
                    Book
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DynamicActivityModal;
