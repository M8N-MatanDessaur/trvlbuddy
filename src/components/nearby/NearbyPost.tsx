import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Star, Navigation, ChevronUp, ChevronDown } from 'lucide-react';
import { NearbyPlace, formatDistance, priceLevelLabel } from '../../services/nearbyService';
import { useActivityMedia } from '../../hooks/useActivityMedia';
import { useAuth } from '../../contexts/AuthContext';
import ImageCarousel from '../ImageCarousel';
import UploadPhotoButton from '../UploadPhotoButton';
import Avatar from '../Avatar';
import { useToast } from '../../contexts/ToastContext';
import ImageCommentsSheet from './ImageCommentsSheet';

interface Props {
  place: NearbyPlace;
}

const NearbyPost: React.FC<Props> = ({ place }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
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
    vote,
    setVote,
  } = useActivityMedia(activityKey);
  const activeImage = images[activeImageIndex] || images[0] || null;
  const poster = activeImage?.poster ?? null;

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

  const handleVote = async (target: 1 | -1) => {
    if (!user) {
      toast('Sign in to vote', 'info');
      return;
    }
    const next: 0 | 1 | -1 = vote.myVote === target ? 0 : target;
    const result = await setVote(next);
    if (!result.ok && result.error) toast(result.error, 'error');
  };

  const openPosterProfile = () => {
    if (!poster?.id) return;
    navigate(`/profile/${poster.id}`);
  };

  const ratingCount = place.userRatingsTotal
    ? place.userRatingsTotal > 999
      ? `${(place.userRatingsTotal / 1000).toFixed(1)}k`
      : `${place.userRatingsTotal}`
    : null;

  const glassStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: 'white',
  };

  const overlayCircleStyle = (primary?: boolean, active?: boolean): React.CSSProperties => ({
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: active ? 'var(--accent)' : primary ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
    backdropFilter: active || primary ? undefined : 'blur(10px)',
    WebkitBackdropFilter: active || primary ? undefined : 'blur(10px)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    padding: 0,
  });

  const smallOverlayCircleStyle = (active?: boolean): React.CSSProperties => ({
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: active ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
    backdropFilter: active ? undefined : 'blur(10px)',
    WebkitBackdropFilter: active ? undefined : 'blur(10px)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    padding: 0,
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

  const ratingPill = (place.rating != null || price) && (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold self-start"
      style={glassStyle}
    >
      {place.rating != null && (
        <>
          <Star size={10} fill="currentColor" style={{ color: 'var(--accent)' }} />
          <span>{place.rating.toFixed(1)}</span>
          {ratingCount && (
            <span style={{ opacity: 0.75, fontWeight: 500 }}>({ratingCount})</span>
          )}
        </>
      )}
      {price && (
        <>
          {place.rating != null && <span style={{ opacity: 0.45 }}>|</span>}
          <span>{price}</span>
        </>
      )}
    </span>
  );

  const upvoteButton = (
    <button
      onClick={() => handleVote(1)}
      className="transition-all active:scale-90"
      style={{
        ...smallOverlayCircleStyle(vote.myVote === 1),
        flexDirection: 'column',
        gap: '0px',
      }}
      aria-label={vote.myVote === 1 ? 'Remove upvote' : 'Upvote'}
    >
      <ChevronUp size={16} strokeWidth={2.6} />
      <span className="text-[9px] font-extrabold leading-none">{vote.upvotes}</span>
    </button>
  );

  const downvoteButton = (
    <button
      onClick={() => handleVote(-1)}
      className="transition-all active:scale-90"
      style={{
        ...smallOverlayCircleStyle(vote.myVote === -1),
        flexDirection: 'column',
        gap: '0px',
      }}
      aria-label={vote.myVote === -1 ? 'Remove downvote' : 'Downvote'}
    >
      <ChevronDown size={16} strokeWidth={2.6} />
      <span className="text-[9px] font-extrabold leading-none">{vote.downvotes}</span>
    </button>
  );

  // ---------- No-image variant: compact text-first card ----------
  if (images.length === 0) {
    const noImgRatingCount = place.userRatingsTotal
      ? place.userRatingsTotal > 999
        ? `${(place.userRatingsTotal / 1000).toFixed(1)}k`
        : `${place.userRatingsTotal}`
      : null;

    const tinyPlainButtonStyle = (active?: boolean): React.CSSProperties => ({
      width: '36px',
      height: '36px',
      minWidth: '36px',
      minHeight: '36px',
      borderRadius: '9999px',
      background: active ? 'var(--accent)' : 'var(--surface-container-high)',
      color: active ? 'white' : 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      flexShrink: 0,
      padding: 0,
      border: 'none',
    });

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

        {/* Info block */}
        <div className="mb-4">
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
                  <Star size={11} fill="currentColor" style={{ color: 'var(--accent)' }} />
                  <span className="font-bold">{place.rating.toFixed(1)}</span>
                  {noImgRatingCount && (
                    <span className="font-semibold" style={{ opacity: 0.6 }}>
                      ({noImgRatingCount})
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

        {/* Action row: upvote, downvote, plus, maps */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleVote(1)}
            className="transition-all active:scale-90"
            style={tinyPlainButtonStyle(vote.myVote === 1)}
            aria-label={vote.myVote === 1 ? 'Remove upvote' : 'Upvote'}
          >
            <ChevronUp size={15} strokeWidth={2.6} />
            <span className="text-[9px] font-extrabold leading-none">{vote.upvotes}</span>
          </button>
          <button
            onClick={() => handleVote(-1)}
            className="transition-all active:scale-90"
            style={tinyPlainButtonStyle(vote.myVote === -1)}
            aria-label={vote.myVote === -1 ? 'Remove downvote' : 'Downvote'}
          >
            <ChevronDown size={15} strokeWidth={2.6} />
            <span className="text-[9px] font-extrabold leading-none">{vote.downvotes}</span>
          </button>
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

          {/* Top-left column: category, distance, ratings+price */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 max-w-[60%]">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold self-start"
              style={glassStyle}
            >
              <CategoryIcon size={11} />
              {place.categoryLabel}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold self-start"
              style={glassStyle}
            >
              <Navigation size={10} />
              {formatDistance(place.distance)}
            </span>
            {ratingPill}
          </div>

          {/* Top-right column: poster avatar, like, comment */}
          <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-2">
            {poster ? (
              <button
                onClick={openPosterProfile}
                className="transition-transform active:scale-90"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  padding: 0,
                  border: '2px solid rgba(255,255,255,0.85)',
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
                aria-label={`Open ${poster.display_name || 'traveler'} profile`}
              >
                <Avatar profile={poster} size={36} />
              </button>
            ) : (
              <div style={{ width: '40px', height: '40px' }} aria-hidden="true" />
            )}
            <button
              onClick={handleLike}
              className="transition-all active:scale-90 disabled:opacity-50"
              style={{
                ...overlayCircleStyle(activeImage?.likedByViewer),
                flexDirection: 'column',
                gap: '1px',
              }}
              aria-label={activeImage?.likedByViewer ? 'Unlike photo' : 'Like photo'}
              disabled={!activeImage}
            >
              <Heart size={16} fill={activeImage?.likedByViewer ? 'currentColor' : 'none'} />
              <span className="text-[10px] font-extrabold leading-none">
                {activeImage?.likeCount ?? 0}
              </span>
            </button>
            <button
              onClick={() => setCommentsOpen(true)}
              className="transition-all active:scale-90 disabled:opacity-50"
              style={{
                ...overlayCircleStyle(),
                flexDirection: 'column',
                gap: '1px',
              }}
              aria-label="Open photo comments"
              disabled={!activeImage}
            >
              <MessageCircle size={16} />
              <span className="text-[10px] font-extrabold leading-none">
                {activeImage?.commentCount ?? 0}
              </span>
            </button>
          </div>

          {/* Bottom-right cluster: plus on top, then upvote/downvote/maps row */}
          <div className="absolute right-3 bottom-3 z-10 flex flex-col items-end gap-2">
            <UploadPhotoButton
              onFile={upload}
              uploading={uploading}
              style={overlayCircleStyle(true)}
              size={17}
            />
            <div className="flex items-center gap-2">
              {upvoteButton}
              {downvoteButton}
              <a
                href={locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline transition-all active:scale-90"
                style={smallOverlayCircleStyle()}
                aria-label="Open location"
              >
                <Navigation size={15} />
              </a>
            </div>
          </div>
        </div>

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
