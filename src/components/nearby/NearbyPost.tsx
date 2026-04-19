import React, { useCallback, useRef, useState } from 'react';
import { Star, Navigation, Share2, MapPin, MoreHorizontal, Loader2 } from 'lucide-react';
import CachedImage from '../CachedImage';
import { NearbyPlace, formatDistance, priceLevelLabel } from '../../services/nearbyService';
import { fetchDetailedPhotos } from '../../services/placePhotoService';

interface Props {
  place: NearbyPlace;
}

const NearbyPost: React.FC<Props> = ({ place }) => {
  const [images, setImages] = useState<string[]>(place.imageUrls);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(new Set());
  const [errorSet, setErrorSet] = useState<Set<number>>(new Set());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipingRef = useRef(false);
  // Only fetch detailed photos (a Place Details call + extra Photo fetches)
  // after the user explicitly asks for them via the ellipsis button. Most
  // cards in the feed are scrolled past without interaction, so this cuts
  // the bulk of the Place Details / Places Photo spend.
  const detailsRequestedRef = useRef(false);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [hasExtras, setHasExtras] = useState(false);

  const validImages = images.filter((_, i) => !errorSet.has(i));
  const count = validImages.length;
  const CategoryIcon = place.categoryIcon;
  const price = priceLevelLabel(place.priceLevel);
  const mapsQuery = encodeURIComponent(`${place.name} ${place.address}`.trim());

  const loadCarousel = useCallback(() => {
    if (detailsRequestedRef.current) return;
    detailsRequestedRef.current = true;
    setLoadingExtras(true);
    fetchDetailedPhotos(place.placeId)
      .then(extras => {
        if (!extras || extras.length === 0) return;
        setImages(extras);
        setLoadedSet(new Set());
        setErrorSet(new Set());
        setCurrentIndex(0);
        setHasExtras(true);
      })
      .finally(() => setLoadingExtras(false));
  }, [place.placeId]);

  const goTo = (idx: number) => {
    if (count === 0) return;
    if (idx < 0) idx = count - 1;
    if (idx >= count) idx = 0;
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
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) swipingRef.current = true;
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

  const handleShare = async () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, text: `${place.name} - ${place.address}`, url });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
    }
  };

  const glassStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: 'white',
  };

  const circleButtonStyle = (primary?: boolean): React.CSSProperties => ({
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: primary ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
    backdropFilter: primary ? undefined : 'blur(10px)',
    WebkitBackdropFilter: primary ? undefined : 'blur(10px)',
    color: 'white',
  });

  return (
    <article
      className="w-full overflow-hidden"
      style={{
        marginBottom: '1.5rem',
        borderRadius: '24px',
        background: 'var(--surface-container)',
      }}
    >
      {/* Layer 1: image carousel with overlays */}
      <div
        className="relative w-full"
        style={{ aspectRatio: '4 / 5', background: 'var(--surface-container-high)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {count === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
            <CategoryIcon size={44} />
          </div>
        ) : (
          <>
            {images.map((src, i) => {
              if (errorSet.has(i)) return null;
              const validIdx = validImages.indexOf(src);
              const isActive = validIdx === currentIndex;
              return (
                <CachedImage
                  key={src}
                  src={src}
                  // Stable key per (place, photo-slot) so a new search that
                  // returns the same place with a rotated photo token still
                  // hits the cached blob instead of re-billing Places Photo.
                  cacheKey={`${place.placeId}:${i}`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    opacity: isActive && loadedSet.has(i) ? 1 : 0,
                    transition: 'opacity 0.35s ease',
                  }}
                  onLoad={() => setLoadedSet(prev => new Set(prev).add(i))}
                  onError={() => setErrorSet(prev => new Set(prev).add(i))}
                  loading={i < 2 ? 'eager' : 'lazy'}
                />
              );
            })}

            {!loadedSet.has(0) && (
              <div className="absolute inset-0 activity-card-shimmer" style={{ background: 'var(--surface-container-high)' }} />
            )}
          </>
        )}

        {/* Top-left: category + rating/cost stack */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 max-w-[65%]">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold self-start"
            style={glassStyle}
          >
            <CategoryIcon size={11} />
            {place.categoryLabel}
          </span>
          {(place.rating != null || price) && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold self-start"
              style={glassStyle}
            >
              {place.rating != null && (
                <>
                  <Star size={10} fill="currentColor" style={{ color: '#f5b300' }} />
                  <span>{place.rating.toFixed(1)}</span>
                  {place.userRatingsTotal ? (
                    <span style={{ opacity: 0.75, fontWeight: 500 }}>
                      ({place.userRatingsTotal > 999 ? `${(place.userRatingsTotal / 1000).toFixed(1)}k` : place.userRatingsTotal})
                    </span>
                  ) : null}
                </>
              )}
              {price && (
                <>
                  {place.rating != null && <span style={{ opacity: 0.45 }}>|</span>}
                  <span>{price}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Top-right: distance */}
        <div className="absolute top-3 right-3 z-10">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={glassStyle}
          >
            <Navigation size={10} />
            {formatDistance(place.distance)}
          </span>
        </div>

        {/* Right side: stacked action buttons */}
        <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-2">
          {!hasExtras && (
            <button
              onClick={loadCarousel}
              disabled={loadingExtras}
              className="flex items-center justify-center transition-all active:scale-90"
              style={{ ...circleButtonStyle(), opacity: loadingExtras ? 0.7 : 1 }}
              aria-label="Load more photos"
            >
              {loadingExtras ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <MoreHorizontal size={18} />
              )}
            </button>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center no-underline transition-all active:scale-90"
            style={circleButtonStyle()}
            aria-label="View on map"
          >
            <MapPin size={18} />
          </a>
          <button
            onClick={handleShare}
            className="flex items-center justify-center transition-all active:scale-90"
            style={circleButtonStyle()}
            aria-label="Share"
          >
            <Share2 size={17} />
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center no-underline transition-all active:scale-90"
            style={circleButtonStyle(true)}
            aria-label="Directions"
          >
            <Navigation size={18} />
          </a>
        </div>

        {/* Bottom-left: dot indicators */}
        {count > 1 && (
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1">
            {validImages.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === currentIndex ? '16px' : '5px',
                  height: '5px',
                  background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Layer 2: name + address */}
      <div className="px-4 py-3.5">
        <h2
          className="text-[17px] font-extrabold leading-tight tracking-tight mb-1"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as React.CSSProperties}
        >
          {place.name}
        </h2>
        {place.address && (
          <p
            className="text-[12.5px] leading-relaxed"
            style={{
              color: 'var(--text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {place.address}
          </p>
        )}
      </div>
    </article>
  );
};

export default NearbyPost;
