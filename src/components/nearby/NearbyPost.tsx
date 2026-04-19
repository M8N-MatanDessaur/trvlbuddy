import React, { useMemo, useState } from 'react';
import { Heart, MessageCircle, Star, Navigation } from 'lucide-react';
import { NearbyPlace, formatDistance, priceLevelLabel } from '../../services/nearbyService';
import { useActivityMedia } from '../../hooks/useActivityMedia';
import ImageCarousel from '../ImageCarousel';
import UploadPhotoButton from '../UploadPhotoButton';
import { useToast } from '../../contexts/ToastContext';
import ImageCommentsSheet from './ImageCommentsSheet';

interface Props {
  place: NearbyPlace;
}

const NearbyPost: React.FC<Props> = ({ place }) => {
  const { toast } = useToast();
  const CategoryIcon = place.categoryIcon;
  const price = priceLevelLabel(place.priceLevel);
  const mapsQuery = encodeURIComponent(`${place.name} ${place.address}`.trim());
  const locationUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const activityKey = useMemo(
    () => ({
      name: place.name,
      address: place.address || null,
      city: null,
      country: null,
      lat: place.location.lat,
      lng: place.location.lng,
      googlePlaceId: place.placeId,
    }),
    [place.placeId, place.name, place.address, place.location.lat, place.location.lng]
  );

  const {
    images,
    imageUrls,
    uploading,
    upload,
    setImageLiked,
    addImageComment,
    removeImageComment,
  } = useActivityMedia(activityKey);
  const activeImage = images[activeImageIndex] || images[0] || null;

  const handleLike = async () => {
    if (!activeImage) return;
    const nextLiked = !activeImage.likedByViewer;
    const result = await setImageLiked(activeImage, nextLiked);
    if (result.ignored) {
      toast('Your own photo does not earn Influence', 'info');
    } else if (!result.ok) {
      toast(result.error || 'Could not update like', 'error');
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const plainButtonStyle = (primary?: boolean): React.CSSProperties => ({
    width: '40px',
    height: '40px',
    minWidth: '40px',
    minHeight: '40px',
    borderRadius: '9999px',
    background: primary ? 'var(--accent)' : 'var(--surface-container-high)',
    color: primary ? 'white' : 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  });

  // ---------- No-image variant: compact text-first card ----------
  if (images.length === 0) {
    const ratingCount = place.userRatingsTotal
      ? place.userRatingsTotal > 999
        ? `${(place.userRatingsTotal / 1000).toFixed(1)}k`
        : `${place.userRatingsTotal}`
      : null;

    return (
      <article
        className="w-full overflow-hidden"
        style={{
          marginBottom: '1rem',
          borderRadius: '22px',
          background: 'var(--surface-container)',
          padding: '1rem',
          border: '0.5px solid var(--outline)',
        }}
      >
        {/* Top row: icon (left) + distance pill (right) */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--accent)',
              color: 'white',
              boxShadow: '0 10px 22px -10px color-mix(in srgb, var(--accent) 70%, transparent)',
            }}
          >
            <CategoryIcon size={22} />
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold flex-shrink-0"
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--text-primary)',
              border: '0.5px solid var(--outline)',
            }}
          >
            <Navigation size={11} style={{ color: 'var(--accent)' }} />
            {formatDistance(place.distance)}
          </span>
        </div>

        {/* Bottom row: info (left) + non-image actions (right) */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.14em] mb-1.5"
              style={{ color: 'var(--accent)' }}
            >
              {place.categoryLabel}
            </p>
            <h2 className="text-[17px] font-extrabold leading-tight tracking-tight truncate">
              {place.name}
            </h2>
            {place.address && (
              <p
                className="text-[12px] leading-snug mt-1 truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                {place.address}
              </p>
            )}
            {(place.rating != null || price) && (
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {place.rating != null && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px]"
                    style={{
                      background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Star
                      size={11}
                      fill="currentColor"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span className="font-bold">{place.rating.toFixed(1)}</span>
                    {ratingCount && (
                      <span className="font-semibold" style={{ opacity: 0.6 }}>
                        ({ratingCount})
                      </span>
                    )}
                  </span>
                )}
                {price && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold"
                    style={{
                      background: 'var(--accent-container)',
                      color: 'var(--accent)',
                    }}
                  >
                    {price}
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            className="flex-shrink-0"
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 40px',
              gridTemplateRows: '40px',
              gap: '10px',
            }}
          >
            <UploadPhotoButton
              onFile={upload}
              uploading={uploading}
              style={plainButtonStyle()}
              size={17}
              ariaLabel="Add the first photo"
            />
            <a
              href={locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline transition-all active:scale-90"
              style={plainButtonStyle(true)}
              aria-label="Open location"
            >
              <Navigation size={17} />
            </a>
          </div>
        </div>
      </article>
    );
  }

  // ---------- Image variant: hero carousel ----------
  return (
    <>
      <article
        className="w-full overflow-hidden"
        style={{
          marginBottom: '1.5rem',
          borderRadius: '24px',
          background: 'var(--surface-container)',
        }}
      >
        <div
          className="relative w-full"
          style={{ aspectRatio: '4 / 5', background: 'var(--surface-container-high)' }}
        >
          <ImageCarousel
            images={imageUrls}
            className="absolute inset-0"
            eagerCount={2}
            onIndexChange={setActiveImageIndex}
          />

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
                    <Star size={10} fill="currentColor" style={{ color: 'var(--accent)' }} />
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

          <div className="absolute top-3 right-3 z-10">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={glassStyle}
            >
              <Navigation size={10} />
              {formatDistance(place.distance)}
            </span>
          </div>

          <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-2">
            <UploadPhotoButton
              onFile={upload}
              uploading={uploading}
              style={circleButtonStyle()}
            />
            <button
              onClick={handleLike}
              className="transition-all active:scale-90 disabled:opacity-50"
              style={{
                ...circleButtonStyle(activeImage?.likedByViewer),
                flexDirection: 'column',
                gap: '1px',
              }}
              aria-label={activeImage ? (activeImage.likedByViewer ? 'Unlike photo' : 'Like photo') : 'Like photo unavailable'}
              disabled={!activeImage}
            >
              <Heart size={17} fill={activeImage?.likedByViewer ? 'currentColor' : 'none'} />
              <span className="text-[10px] font-extrabold leading-none">
                {activeImage?.likeCount ?? 0}
              </span>
            </button>
            <button
              onClick={() => setCommentsOpen(true)}
              className="transition-all active:scale-90 disabled:opacity-50"
              style={{
                ...circleButtonStyle(),
                flexDirection: 'column',
                gap: '1px',
              }}
              aria-label="Open photo comments"
              disabled={!activeImage}
            >
              <MessageCircle size={17} />
              <span className="text-[10px] font-extrabold leading-none">
                {activeImage?.commentCount ?? 0}
              </span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
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
          <a
            href={locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline transition-all active:scale-90 flex-shrink-0"
            style={{
              ...plainButtonStyle(true),
              width: '44px',
              height: '44px',
              minWidth: '44px',
              minHeight: '44px',
            }}
            aria-label="Open location"
          >
            <Navigation size={18} />
          </a>
        </div>
      </article>
      <ImageCommentsSheet
        image={activeImage}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onAddComment={addImageComment}
        onDeleteComment={removeImageComment}
      />
    </>
  );
};

export default NearbyPost;
