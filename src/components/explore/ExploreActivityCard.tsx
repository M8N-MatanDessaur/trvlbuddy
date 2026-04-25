import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Clock,
  Check,
  Loader2,
} from 'lucide-react';
import { GeneratedActivity } from '../../types/TravelData';
import { useActivityMedia } from '../../hooks/useActivityMedia';
import { useCompletedActivities } from '../../hooks/useCompletedActivities';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getCategoryIcon } from '../../utils/categoryIcons';
import ImageCarousel from '../ImageCarousel';
import UploadMediaButton from '../UploadMediaButton';
import Avatar from '../Avatar';
import ImageCommentsSheet from '../nearby/ImageCommentsSheet';

interface Props {
  activity: GeneratedActivity;
  cityName: string | null;
  country: string | null;
  onOpenDetails: (activity: GeneratedActivity) => void;
}

const ACTION_SIZE = 38;

function priceLabel(cost: string): string | null {
  if (!cost) return null;
  const c = cost.toLowerCase();
  if (c.includes('free') || c === '0' || c.includes('$0')) return 'Free';
  const nums = cost.match(/\d+/g);
  if (!nums) return cost;
  const max = Math.max(...nums.map((n) => parseInt(n, 10)));
  if (max <= 15) return '$';
  if (max <= 35) return '$$';
  if (max <= 60) return '$$$';
  return '$$$$';
}

const ExploreActivityCard: React.FC<Props> = ({ activity, cityName, country, onOpenDetails }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCompleted, toggle: toggleCompleted } = useCompletedActivities();
  const { toast } = useToast();
  const CategoryIcon = getCategoryIcon(activity.category);
  const price = priceLabel(activity.estimatedCost);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const activityKey = useMemo(
    () => ({
      name: activity.name,
      city: cityName,
      country,
      address: activity.location || null,
      googlePlaceId: activity.placeId || null,
    }),
    [activity.name, activity.location, activity.placeId, cityName, country],
  );

  const {
    images,
    imageUrls,
    uploading,
    upload,
    uploadVideo,
    setImageLiked,
    addImageComment,
    removeImageComment,
    vote,
    setVote,
    activityId: dbActivityId,
  } = useActivityMedia(activityKey);
  const isDone = isCompleted(dbActivityId);

  // Fall back to the AI-fetched image when there are no user uploads yet so
  // the card never looks empty.
  const carouselUrls = images.length > 0
    ? imageUrls
    : (activity.imageUrls?.length ? activity.imageUrls : (activity.imageUrl ? [activity.imageUrl] : []));
  const hasCarousel = carouselUrls.length > 0;
  const activeImage = images[activeImageIndex] || images[0] || null;
  const poster = activeImage?.poster ?? null;

  const handleLike = async () => {
    if (!activeImage) {
      toast('Be the first to share a photo here', 'info');
      return;
    }
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

  const mapsUrl = activity.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.name)}&query_place_id=${activity.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activity.name} ${activity.location || ''}`.trim())}`;

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
    color: active || primary ? 'var(--on-accent)' : 'white',
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
    color: primary ? 'var(--on-accent)' : 'var(--text-primary)',
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

  const durationPill = activity.duration ? (
    <span
      style={{
        ...pillBaseStyle,
        background: 'var(--surface-container-high)',
        color: 'var(--text-primary)',
        border: '0.5px solid var(--outline)',
      }}
    >
      <Clock size={12} style={{ color: 'var(--accent)' }} />
      {activity.duration}
    </span>
  ) : null;

  const categoryPill = (
    <span style={{ ...pillBaseStyle, ...glassStyle }}>
      <CategoryIcon size={13} />
      {activity.category}
    </span>
  );

  const ratingPriceText = (price || activity.difficulty) && (
    <p className="text-[12.5px] mt-2" style={{ color: 'var(--text-secondary)' }}>
      {price && <span style={{ fontWeight: 700 }}>{price}</span>}
      {price && activity.difficulty && <span style={{ opacity: 0.45 }}> &nbsp;|&nbsp; </span>}
      {activity.difficulty && (
        <span className="capitalize" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {activity.difficulty}
        </span>
      )}
    </p>
  );

  const openMapsButton = (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="no-underline transition-all active:scale-90"
      style={solidCircleStyle()}
      aria-label="Open in maps"
    >
      <ExternalLink size={16} />
    </a>
  );

  const [doneSaving, setDoneSaving] = useState(false);
  const handleToggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast("Sign in to track what you've done", 'info');
      return;
    }
    if (!dbActivityId) {
      toast('Activity not ready yet', 'info');
      return;
    }
    setDoneSaving(true);
    const result = await toggleCompleted(dbActivityId);
    setDoneSaving(false);
    if (!result.ok) toast('Could not update', 'error');
    // Success is silent -- the green check (or its removal) is the feedback.
  };

  // While the supabase round-trip is in flight, show a neutral loader pill so
  // the user knows the change isn't committed yet. Only flip to the green
  // confirmed state after the call resolves.
  const showDoneConfirmed = isDone && !doneSaving;
  const doneButton = (
    <button
      onClick={handleToggleDone}
      disabled={doneSaving}
      className="transition-all active:scale-90 disabled:opacity-90"
      style={{
        ...solidCircleStyle(showDoneConfirmed),
        background: showDoneConfirmed ? '#16a34a' : 'var(--surface-container-high)',
        color: showDoneConfirmed ? '#ffffff' : 'var(--text-primary)',
      }}
      aria-label={isDone ? 'Unmark as done' : 'Mark as done'}
      aria-pressed={isDone}
      aria-busy={doneSaving}
      title={doneSaving ? 'Saving...' : isDone ? 'Done' : 'Mark as done'}
    >
      {doneSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
    </button>
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
        onClick={(e) => {
          e.stopPropagation();
          handleVote(-1);
        }}
        className="flex items-center gap-1 transition-all active:scale-[0.94]"
        style={{
          height: '100%',
          minHeight: `${ACTION_SIZE}px`,
          minWidth: 0,
          padding: '0 14px',
          background: vote.myVote === -1 ? 'var(--accent)' : 'transparent',
          color: vote.myVote === -1 ? 'var(--on-accent)' : 'var(--text-primary)',
          border: 'none',
        }}
        aria-label={vote.myVote === -1 ? 'Remove downvote' : 'Downvote'}
      >
        <ChevronDown size={16} strokeWidth={2.6} />
        <span className="text-[12px] font-extrabold leading-none">{vote.downvotes}</span>
      </button>
      <span aria-hidden="true" style={{ width: '1px', height: '60%', background: 'var(--outline)' }} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleVote(1);
        }}
        className="flex items-center gap-1 transition-all active:scale-[0.94]"
        style={{
          height: '100%',
          minHeight: `${ACTION_SIZE}px`,
          minWidth: 0,
          padding: '0 14px',
          background: vote.myVote === 1 ? 'var(--accent)' : 'transparent',
          color: vote.myVote === 1 ? 'var(--on-accent)' : 'var(--text-primary)',
          border: 'none',
        }}
        aria-label={vote.myVote === 1 ? 'Remove upvote' : 'Upvote'}
      >
        <ChevronUp size={16} strokeWidth={2.6} />
        <span className="text-[12px] font-extrabold leading-none">{vote.upvotes}</span>
      </button>
    </div>
  );

  const handleCardClick = () => onOpenDetails(activity);

  // ---------- No-image variant (compact) ----------
  if (!hasCarousel) {
    return (
      <article
        onClick={handleCardClick}
        className="w-full overflow-hidden cursor-pointer transition-all active:scale-[0.99]"
        style={{
          borderRadius: '20px',
          background: 'var(--surface-container)',
          padding: '0.875rem 1rem',
          border: '0.5px solid var(--outline)',
        }}
      >
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
            {durationPill}
          </div>
          {openMapsButton}
        </div>

        <h2 className="text-[15.5px] font-extrabold leading-tight tracking-tight">{activity.name}</h2>
        {activity.location && (
          <p className="text-[12px] leading-snug mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
            {activity.location}
          </p>
        )}
        {ratingPriceText}

        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-2">
            {doneButton}
            <UploadMediaButton
              onPhotoFile={upload}
              onVideoResult={uploadVideo}
              uploading={uploading}
              style={solidCircleStyle(true)}
              size={16}
              ariaLabel="Add the first photo or video"
            />
          </div>
          {votePill}
        </div>
      </article>
    );
  }

  // ---------- Image variant ----------
  return (
    <>
      <article
        onClick={handleCardClick}
        className="w-full overflow-hidden cursor-pointer"
        style={{
          borderRadius: '24px',
          background: 'var(--surface-container)',
        }}
      >
        <div
          className="relative w-full"
          style={{ aspectRatio: '4 / 5', background: 'var(--surface-container-high)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <ImageCarousel
            images={carouselUrls}
            className="absolute inset-0"
            eagerCount={2}
            onIndexChange={setActiveImageIndex}
          />

          <div className="absolute top-3 left-3 z-10">{categoryPill}</div>

          <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-2">
            {poster ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openPosterProfile();
                }}
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
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
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
              <span className="text-[10px] font-extrabold leading-none">{activeImage?.likeCount ?? 0}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCommentsOpen(true);
              }}
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
              <span className="text-[10px] font-extrabold leading-none">{activeImage?.commentCount ?? 0}</span>
            </button>
          </div>

          <div className="absolute right-3 bottom-3 z-10">
            <UploadMediaButton
              onPhotoFile={upload}
              onVideoResult={uploadVideo}
              uploading={uploading}
              style={overlayCircleStyle()}
              size={16}
            />
          </div>
        </div>

        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            {durationPill || <span />}
            <div className="flex items-center gap-2">
              {doneButton}
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
            {activity.name}
          </h2>
          {activity.location && (
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
              {activity.location}
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

export default ExploreActivityCard;
