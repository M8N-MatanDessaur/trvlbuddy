import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
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

const ACTION_SIZE = 38;

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
    [place.placeId, place.name, place.address, place.location.lat, place.location.lng],
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
    width: `${ACTION_SIZE}px`,
    height: `${ACTION_SIZE}px`,
    minWidth: `${ACTION_SIZE}px`,
    minHeight: `${ACTION_SIZE}px`,
    borderRadius: '50%',
    background: active || primary ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
    backdropFilter: active || primary ? undefined : 'blur(10px)',
    WebkitBackdropFilter: active || primary ? undefined : 'blur(10px)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    padding: 0,
  });

  const solidCircleStyle = (primary?: boolean): React.CSSProperties => ({
    width: `${ACTION_SIZE}px`,
    height: `${ACTION_SIZE}px`,
    minWidth: `${ACTION_SIZE}px`,
    minHeight: `${ACTION_SIZE}px`,
    borderRadius: '50%',
    background: primary ? 'var(--accent)' : 'var(--surface-container-high)',
    color: primary ? 'white' : 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: 'none',
    padding: 0,
  });

  const pillBaseStyle: React.CSSProperties = {
    height: `${ACTION_SIZE}px`,
    padding: '0 14px',
    borderRadius: '9999px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1,
  };

  const distancePill = (
    <span
      style={{
        ...pillBaseStyle,
        background: 'var(--surface-container-high)',
        color: 'var(--text-primary)',
        border: '0.5px solid var(--outline)',
      }}
    >
      <span style={{ color: 'var(--accent)' }}>{formatDistance(place.distance)}</span>
    </span>
  );

  const categoryPill = (
    <span
      style={{
        ...pillBaseStyle,
        ...glassStyle,
      }}
    >
      <CategoryIcon size={13} />
      {place.categoryLabel}
    </span>
  );

  const ratingPriceText = (place.rating != null || price) && (
    <p className="text-[12.5px] mt-2" style={{ color: 'var(--text-secondary)' }}>
      {place.rating != null && (
        <>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>★ {place.rating.toFixed(1)}</span>
          {ratingCount && <span style={{ opacity: 0.7 }}> ({ratingCount})</span>}
        </>
      )}
      {place.rating != null && price && <span style={{ opacity: 0.45 }}> &nbsp;|&nbsp; </span>}
      {price && <span style={{ fontWeight: 700 }}>{price}</span>}
    </p>
  );

  const openMapsButton = (
    <a
      href={locationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="no-underline transition-all active:scale-90"
      style={solidCircleStyle()}
      aria-label="Open in maps"
    >
      <ExternalLink size={16} />
    </a>
  );

  const votePill = (
    <div
      className="flex items-center"
      style={{
        height: `${ACTION_SIZE}px`,
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
          minHeight: `${ACTION_SIZE}px`,
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
      <span
        aria-hidden="true"
        style={{
          width: '1px',
          height: '60%',
          background: 'var(--outline)',
        }}
      />
      <button
        onClick={() => handleVote(1)}
        className="flex items-center gap-1 transition-all active:scale-[0.94]"
        style={{
          height: '100%',
          minHeight: `${ACTION_SIZE}px`,
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
  );

  // ---------- No-image variant (compact) ----------
  if (images.length === 0) {
    return (
      <article
        className="w-full overflow-hidden"
        style={{
          marginBottom: '0.75rem',
          borderRadius: '20px',
          background: 'var(--surface-container)',
          padding: '0.875rem 1rem',
          border: '0.5px solid var(--outline)',
        }}
      >
        {/* Header row: category + distance left, open-external right */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                width: '34px',
                height: '34px',
                background: 'var(--accent-container)',
                color: 'var(--accent)',
              }}
            >
              <CategoryIcon size={16} />
            </div>
            {distancePill}
          </div>
          {openMapsButton}
        </div>

        {/* Info */}
        <h2 className="text-[15.5px] font-extrabold leading-tight tracking-tight">{place.name}</h2>
        {place.address && (
          <p
            className="text-[12px] leading-snug mt-0.5 truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {place.address}
          </p>
        )}

        {/* Bottom row: ratings|price left, plus + vote pill right */}
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="min-w-0 flex-1">
            {(place.rating != null || price) && (
              <p className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                {place.rating != null && (
                  <>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>★ {place.rating.toFixed(1)}</span>
                    {ratingCount && <span style={{ opacity: 0.7 }}> ({ratingCount})</span>}
                  </>
                )}
                {place.rating != null && price && <span style={{ opacity: 0.45 }}> &nbsp;|&nbsp; </span>}
                {price && <span style={{ fontWeight: 700 }}>{price}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <UploadPhotoButton
              onFile={upload}
              uploading={uploading}
              style={solidCircleStyle(true)}
              size={16}
              ariaLabel="Add the first photo"
            />
            {votePill}
          </div>
        </div>
      </article>
    );
  }

  // ---------- Image variant ----------
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

          {/* Top-left: category */}
          <div className="absolute top-3 left-3 z-10">{categoryPill}</div>

          {/* Top-right: avatar / like / comment */}
          <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-2">
            {poster ? (
              <button
                onClick={openPosterProfile}
                className="transition-transform active:scale-90"
                style={{
                  ...overlayCircleStyle(true),
                  border: '1.5px solid rgba(255,255,255,0.85)',
                  overflow: 'hidden',
                }}
                aria-label={`Open ${poster.display_name || 'traveler'} profile`}
              >
                <Avatar profile={poster} size={ACTION_SIZE - 4} />
              </button>
            ) : (
              <div style={{ width: `${ACTION_SIZE}px`, height: `${ACTION_SIZE}px` }} aria-hidden="true" />
            )}
            <button
              onClick={handleLike}
              className="transition-all active:scale-90 disabled:opacity-50"
              style={{
                ...overlayCircleStyle(false, activeImage?.likedByViewer),
                flexDirection: 'column',
                gap: '1px',
              }}
              aria-label={activeImage?.likedByViewer ? 'Unlike photo' : 'Like photo'}
              disabled={!activeImage}
            >
              <Heart size={15} fill={activeImage?.likedByViewer ? 'currentColor' : 'none'} />
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
              <MessageCircle size={15} />
              <span className="text-[10px] font-extrabold leading-none">
                {activeImage?.commentCount ?? 0}
              </span>
            </button>
          </div>

          {/* Bottom-right: plus */}
          <div className="absolute right-3 bottom-3 z-10">
            <UploadPhotoButton
              onFile={upload}
              uploading={uploading}
              style={overlayCircleStyle()}
              size={16}
            />
          </div>
        </div>

        {/* Second layer */}
        <div className="px-4 pt-3 pb-4">
          {/* Action row: distance pill, vote pill, open-external */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            {distancePill}
            <div className="flex items-center gap-2">
              {votePill}
              {openMapsButton}
            </div>
          </div>

          <h2
            className="text-[17px] font-extrabold leading-tight tracking-tight"
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
              className="text-[12.5px] leading-relaxed mt-1"
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
          {ratingPriceText}
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
