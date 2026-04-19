import React, { useMemo } from 'react';
import { X, MapPin, Lightbulb, Navigation, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedActivity } from '../types/TravelData';
import { getCategoryIcon } from '../utils/categoryIcons';
import ImageCarousel from './ImageCarousel';
import UploadPhotoButton from './UploadPhotoButton';
import { useActivityMedia } from '../hooks/useActivityMedia';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Props {
  activity: GeneratedActivity | null;
  isOpen: boolean;
  onClose: () => void;
}

const DynamicActivityModal: React.FC<Props> = ({ activity, isOpen, onClose }) => {
  const activityKey = useMemo(
    () =>
      activity
        ? {
            name: activity.name,
            city: activity.location || null,
            address: null,
            googlePlaceId: activity.placeId || null,
          }
        : null,
    [activity?.name, activity?.location, activity?.placeId]
  );

  const { imageUrls, uploading, upload, vote, setVote } = useActivityMedia(isOpen ? activityKey : null);
  const { user } = useAuth();
  const { toast } = useToast();

  if (!activity) return null;

  const CategoryIcon = getCategoryIcon(activity.category);
  const locationQuery = encodeURIComponent(activity.location);
  const hasImages = imageUrls.length > 0;

  const handleVote = async (target: 1 | -1) => {
    if (!user) {
      toast('Sign in to vote', 'info');
      return;
    }
    const next: 0 | 1 | -1 = vote.myVote === target ? 0 : target;
    const result = await setVote(next);
    if (!result.ok && result.error) toast(result.error, 'error');
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
          style={{ background: 'rgba(0,0,0,0.4)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, margin: 0, padding: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-lg overflow-hidden"
            style={{ background: 'var(--surface-container)', borderRadius: '24px 24px 0 0', maxHeight: hasImages ? '92vh' : '88vh' }}
            onClick={e => e.stopPropagation()}
          >
            {hasImages ? (
              <div className="relative" style={{ height: '220px' }}>
                <ImageCarousel images={imageUrls} className="absolute inset-0" eagerCount={2} />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, var(--surface-container) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}
                />

                <div className="absolute top-2.5 left-0 right-0 flex justify-center z-10">
                  <div className="w-8 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
                </div>

                <button
                  onClick={onClose}
                  className="absolute top-3 right-4 flex items-center justify-center z-10"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'white',
                    height: '36px',
                    aspectRatio: '1',
                    borderRadius: '50%',
                  }}
                >
                  <X size={18} />
                </button>

                <UploadPhotoButton
                  onFile={upload}
                  uploading={uploading}
                  className="absolute top-3 left-4 z-10 transition-all active:scale-90 flex items-center justify-center"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'white',
                    height: '36px',
                    aspectRatio: '1',
                    borderRadius: '50%',
                  }}
                />

                <div className="absolute bottom-7 left-5 flex items-center gap-3 z-10">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      color: 'white',
                    }}
                  >
                    <CategoryIcon size={12} /> {activity.category}
                  </span>
                  {activity.difficulty && (
                    <span className="text-[11px] font-semibold capitalize" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {activity.difficulty}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-center pt-2.5 pb-2">
                  <div className="w-8 h-1 rounded-full" style={{ background: 'var(--outline)' }} />
                </div>
                <div className="flex items-start gap-3 px-5 pb-3">
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
                  <UploadPhotoButton
                    onFile={upload}
                    uploading={uploading}
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--surface-container-high)', color: 'var(--accent)', height: '36px', aspectRatio: '1', borderRadius: '50%' }}
                    ariaLabel="Add a photo"
                  />
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)', height: '36px', aspectRatio: '1', borderRadius: '50%' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </>
            )}

            {hasImages && (
              <div className="px-5 pt-2 pb-3">
                <h2 className="text-[20px] font-extrabold leading-tight tracking-tight">{activity.name}</h2>
              </div>
            )}

            <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: hasImages ? 'calc(92vh - 300px)' : 'calc(88vh - 140px)' }}>
              <div className="space-y-4">
                {/* Vote pill (community signal for this activity) */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-tertiary)' }}>
                    Worth a stop?
                  </span>
                  <div
                    className="flex items-center"
                    style={{
                      height: '38px',
                      borderRadius: '9999px',
                      background: 'var(--surface-container-high)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => handleVote(-1)}
                      className="flex items-center gap-1 transition-all active:scale-[0.94]"
                      style={{
                        height: '100%',
                        minHeight: '38px',
                        minWidth: 0,
                        padding: '0 14px',
                        background: vote.myVote === -1 ? 'var(--accent)' : 'transparent',
                        color: vote.myVote === -1 ? 'white' : 'var(--text-primary)',
                        border: 'none',
                      }}
                      aria-label={vote.myVote === -1 ? 'Remove downvote' : 'Downvote'}
                    >
                      <ChevronDown size={16} strokeWidth={2.6} />
                      <span className="text-[12px] font-extrabold leading-none">{vote.downvotes}</span>
                    </button>
                    <span aria-hidden="true" style={{ width: '1px', height: '60%', background: 'var(--outline)' }} />
                    <button
                      onClick={() => handleVote(1)}
                      className="flex items-center gap-1 transition-all active:scale-[0.94]"
                      style={{
                        height: '100%',
                        minHeight: '38px',
                        minWidth: 0,
                        padding: '0 14px',
                        background: vote.myVote === 1 ? 'var(--accent)' : 'transparent',
                        color: vote.myVote === 1 ? 'white' : 'var(--text-primary)',
                        border: 'none',
                      }}
                      aria-label={vote.myVote === 1 ? 'Remove upvote' : 'Upvote'}
                    >
                      <ChevronUp size={16} strokeWidth={2.6} />
                      <span className="text-[12px] font-extrabold leading-none">{vote.upvotes}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3.5 rounded-xl" style={{ background: 'var(--surface-container-high)' }}>
                    <div className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration</div>
                    <div className="text-[15px] font-bold">{activity.duration}</div>
                  </div>
                  <div className="p-3.5 rounded-xl" style={{ background: 'var(--surface-container-high)' }}>
                    <div className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Cost</div>
                    <div className="text-[15px] font-bold" style={{ color: 'var(--accent)' }}>{activity.estimatedCost.includes('ree') ? 'Free' : activity.estimatedCost}</div>
                  </div>
                  <div className="p-3.5 rounded-xl" style={{ background: 'var(--surface-container-high)' }}>
                    <div className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Best time</div>
                    <div className="text-[15px] font-bold">{activity.bestTime || 'Anytime'}</div>
                  </div>
                </div>

                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {activity.description}
                </p>

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

                {activity.tips && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: 'var(--accent-container)' }}>
                    <Lightbulb size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    <div className="text-[13px] leading-relaxed" style={{ color: 'var(--on-accent-container)' }}>{activity.tips}</div>
                  </div>
                )}

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
