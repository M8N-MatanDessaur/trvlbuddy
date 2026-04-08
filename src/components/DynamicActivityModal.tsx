import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Lightbulb, Navigation, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedActivity } from '../types/TravelData';
import { getCategoryIcon } from '../utils/categoryIcons';
import CachedImage from './CachedImage';
import { fetchDetailedPhotos } from '../services/placePhotoService';
import { prefetchImages } from '../services/imageCacheService';

interface Props {
  activity: GeneratedActivity | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Swipeable image carousel for the modal hero */
const ImageCarousel: React.FC<{ images: string[] }> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(new Set());
  const [errorSet, setErrorSet] = useState<Set<number>>(new Set());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipingRef = useRef(false);

  const validImages = images.filter((_, i) => !errorSet.has(i));
  const validCount = validImages.length;

  useEffect(() => {
    setCurrentIndex(0);
    setLoadedSet(new Set());
    setErrorSet(new Set());
  }, [images]);

  const goTo = (idx: number) => {
    if (idx < 0) idx = validCount - 1;
    if (idx >= validCount) idx = 0;
    setCurrentIndex(idx);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // If horizontal movement is dominant, prevent vertical scroll
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      swipingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !swipingRef.current) {
      touchStartRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    if (Math.abs(dx) > 40) {
      if (dx < 0) goTo(currentIndex + 1);
      else goTo(currentIndex - 1);
    }
    touchStartRef.current = null;
    swipingRef.current = false;
  };

  if (validCount === 0) return null;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((src, i) => {
        if (errorSet.has(i)) return null;
        const validIdx = validImages.indexOf(src);
        const isActive = validIdx === currentIndex;
        return (
          <CachedImage
            key={i}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: isActive && loadedSet.has(i) ? 1 : 0,
              transition: 'opacity 0.5s ease',
            }}
            onLoad={() => setLoadedSet(prev => new Set(prev).add(i))}
            onError={() => setErrorSet(prev => new Set(prev).add(i))}
            loading={i < 3 ? 'eager' : 'lazy'}
          />
        );
      })}

      {/* Shimmer while first image loads */}
      {!loadedSet.has(0) && (
        <div className="absolute inset-0 activity-card-shimmer" style={{ background: 'var(--surface-container-high)' }} />
      )}

      {/* Dot indicators - bottom right */}
      {validCount > 1 && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-10">
          {validImages.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentIndex ? '14px' : '5px',
                height: '5px',
                background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DynamicActivityModal: React.FC<Props> = ({ activity, isOpen, onClose }) => {
  const [detailedPhotos, setDetailedPhotos] = useState<string[] | null>(null);
  const lastFetchedRef = useRef<string | null>(null);

  // Fetch full photo set from Place Details when modal opens
  useEffect(() => {
    if (!isOpen || !activity?.placeId) {
      setDetailedPhotos(null);
      lastFetchedRef.current = null;
      return;
    }

    // Only fetch once per activity
    if (lastFetchedRef.current === activity.placeId) return;
    lastFetchedRef.current = activity.placeId;

    fetchDetailedPhotos(activity.placeId).then(photos => {
      if (photos && photos.length > 1) {
        setDetailedPhotos(photos);
        // Prefetch all into IndexedDB
        prefetchImages(photos, 2);
      }
    });
  }, [isOpen, activity?.placeId]);

  if (!activity) return null;

  const CategoryIcon = getCategoryIcon(activity.category);
  const locationQuery = encodeURIComponent(activity.location);

  // Use detailed photos if available, fall back to what we have
  const carouselImages = detailedPhotos
    || (activity.imageUrls?.length ? activity.imageUrls : (activity.imageUrl ? [activity.imageUrl] : []));
  const hasImages = carouselImages.length > 0;

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
            {/* Hero carousel or plain header */}
            {hasImages ? (
              <div className="relative" style={{ height: '220px' }}>
                <ImageCarousel images={carouselImages} />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, var(--surface-container) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}
                />

                {/* Handle bar */}
                <div className="absolute top-2.5 left-0 right-0 flex justify-center z-10">
                  <div className="w-8 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
                </div>

                {/* Close button */}
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

                {/* Category badge */}
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

            {/* Title (image variant) */}
            {hasImages && (
              <div className="px-5 pt-2 pb-3">
                <h2 className="text-[20px] font-extrabold leading-tight tracking-tight">{activity.name}</h2>
              </div>
            )}

            {/* Content */}
            <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: hasImages ? 'calc(92vh - 300px)' : 'calc(88vh - 140px)' }}>
              <div className="space-y-4">

                {/* Key info grid */}
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

                {/* Description */}
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {activity.description}
                </p>

                {/* Location */}
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
