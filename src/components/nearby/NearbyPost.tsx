import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Bookmark,
} from 'lucide-react';
import { NearbyPlace, formatDistance, priceLevelLabel } from '../../services/nearbyService';
import { listActivityImageComments } from '../../services/activityMediaService';
import { useActivityMedia } from '../../hooks/useActivityMedia';
import { useAuth } from '../../contexts/AuthContext';
import { useSavedPlace } from '../../hooks/useSavedPlaces';
import MediaCarousel, { type MediaSlide } from '../MediaCarousel';
import UploadMediaButton from '../UploadMediaButton';
import Avatar from '../Avatar';
import { useToast } from '../../contexts/ToastContext';
import ImageCommentsSheet from './ImageCommentsSheet';
import { posterFor } from './poster';
import ActivityPageShell from './ActivityPageShell';
import PlaceDetailSheet from './PlaceDetailSheet';
import PlacePulseLine from './PlacePulseLine';
import type { PlacePulse } from '../../services/placePulse';

interface Props {
  place: NearbyPlace;
  /** Who has been here and what they left, when anyone has. */
  pulse?: PlacePulse | null;
  /**
   * A free photograph of the place, when one exists, for the variant nobody
   * has uploaded to yet. A row with a picture is worth reading; a row of text
   * among twenty others is not.
   */
  heroImage?: string | null;
  /**
   * 'card' is the row in the scrolling feed. 'page' is one activity filling
   * the screen in the pager, where the next one is a swipe away. Both run the
   * same hooks and the same handlers, so votes, comments, likes, saves and
   * uploads behave identically whichever way you are looking at a place.
   */
  variant?: 'card' | 'page';
  /**
   * What kind of answer this is in the merged feed, "Open now", "Near you".
   * Shown on the page variant, where a full-bleed frame otherwise gives no
   * clue whether you are looking at a bar, a landmark or tonight's festival.
   */
  tag?: string;
}

const ACTION_SIZE = 38;

const NearbyPost: React.FC<Props> = ({ place, heroImage, variant = 'card', tag, pulse }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const CategoryIcon = place.categoryIcon;
  const price = priceLevelLabel(place.priceLevel);
  const mapsQuery = encodeURIComponent(`${place.name} ${place.address}`.trim());
  const locationUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  // Comments across every photo of this place, for the More sheet. Loaded
  // only when that sheet is opened, and only for photos that have any: the
  // feed itself has no use for comment bodies, so fetching them up front
  // would be a query per photo per card for nothing.
  const [allComments, setAllComments] = useState<
    Array<{
      id: string;
      body: string;
      created_at: string;
      author: { id?: string; display_name?: string | null; avatar_url?: string | null } | null;
    }>
  >([]);

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
    activityId,
    mediaItems,
    uploading,
    upload,
    uploadVideo,
    setImageLiked,
    addImageComment,
    removeImageComment,
    vote,
    setVote,
  } = useActivityMedia(activityKey);

  // The carousel mixes images + videos. activeImageIndex maps into
  // mediaItems; only image slides expose like + comment affordances
  // (videos own their own viewer-only flow inside the player).
  const slides: MediaSlide[] = useMemo(
    () =>
      mediaItems.map((item) => (
        item.kind === 'image'
          ? {
              kind: 'image' as const,
              src: item.data.url,
              thumbhash: item.data.thumbhash ?? null,
            }
          : {
              kind: 'video' as const,
              src: item.data.url,
              posterUrl: item.data.posterUrl,
              thumbhash: item.data.thumbhash ?? null,
              startMs: item.data.start_ms,
              durationMs: item.data.duration_ms,
            }
      )),
    [mediaItems],
  );
  const activeMediaItem = mediaItems[activeImageIndex] || mediaItems[0] || null;
  const activeImage =
    activeMediaItem && activeMediaItem.kind === 'image'
      ? activeMediaItem.data
      : null;
  // Poster (uploader avatar) sticks to whichever uploader's media is on
  // screen so the avatar matches the slide. Falls back to the first
  // image's poster when a video slide doesn't carry one.
  const poster = activeImage?.poster ?? images[0]?.poster ?? null;

  useEffect(() => {
    if (!detailOpen) return;
    const withComments = images.filter((image) => (image.commentCount ?? 0) > 0);
    if (withComments.length === 0) {
      setAllComments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const lists = await Promise.all(
        withComments.map((image) =>
          listActivityImageComments(image.id)
            .then((comments) => comments.map((comment) => ({
              id: comment.id,
              body: comment.body,
              created_at: comment.created_at,
              // The uploader is the only profile the feed already holds; a
              // commenter's own profile is not loaded here.
              author: comment.user_id === image.poster?.id ? image.poster : null,
            })))
            .catch(() => []),
        ),
      );
      if (cancelled) return;
      setAllComments(
        lists.flat().sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
    })();
    return () => { cancelled = true; };
  }, [detailOpen, images]);

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

  const { saved, toggle: toggleSaved, busy: savingBusy } = useSavedPlace(place);
  const handleToggleSaved = async () => {
    if (!user) {
      toast('Sign in to save places', 'info');
      return;
    }
    const result = await toggleSaved();
    if (!result.ok) {
      toast(result.error || 'Could not update saved places', 'error');
      return;
    }
    toast(result.nextSaved ? 'Saved to your places' : 'Removed from saved', 'success');
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

  const savedButton = (
    <button
      onClick={handleToggleSaved}
      className="flex items-center justify-center transition-all active:scale-90 disabled:opacity-60"
      style={{
        ...solidCircleStyle(saved),
      }}
      disabled={savingBusy}
      aria-label={saved ? 'Unsave place' : 'Save place'}
      aria-pressed={saved}
    >
      <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );

  const savedOverlayButton = (
    <button
      onClick={handleToggleSaved}
      className="flex items-center justify-center transition-all active:scale-90 disabled:opacity-60"
      style={overlayCircleStyle(false, saved)}
      disabled={savingBusy}
      aria-label={saved ? 'Unsave place' : 'Save place'}
      aria-pressed={saved}
    >
      <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );

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

  // Each fact is one unwrappable unit, and the row wraps between them.
  // Previously this was inline text, so a narrow card broke it mid-item and
  // pushed "$$" onto a line of its own next to the action buttons.
  const ratingPriceText = (place.rating != null || price) && (
    <p
      className="text-[12.5px] mt-2 flex items-center flex-wrap"
      style={{ color: 'var(--text-secondary)', gap: '2px 8px' }}
    >
      {place.rating != null && (
        <span style={{ whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>★ {place.rating.toFixed(1)}</span>
          {ratingCount && <span style={{ opacity: 0.7 }}> ({ratingCount})</span>}
        </span>
      )}
      {price && <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{price}</span>}
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
          color: vote.myVote === -1 ? 'var(--on-accent)' : 'var(--text-primary)',
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
  // ---------- Page variant (one activity, filling the screen) ----------
  if (variant === 'page') {
    // Whatever there is to look at, in order of how much it is worth looking
    // at: what people have posted, then a free photograph of the place, then
    // a poster. There is always something, so a page is never blank.
    const hasMedia = mediaItems.length > 0;
    const bare = !hasMedia && !heroImage;
    const empty = posterFor(place.placeId || place.name, place.categoryLabel);

    const uploadPill = (
      <UploadMediaButton
        onPhotoFile={upload}
        onVideoResult={uploadVideo}
        uploading={uploading}
        className="flex items-center gap-2 transition-transform active:scale-[0.97]"
        style={{ ...pillBaseStyle, background: '#fff', color: '#111', border: 'none' }}
        size={15}
        cta="Add a photo"
        ariaLabel="Add the first photo or video"
      />
    );

    return (
      <>
        <ActivityPageShell
          media={
            hasMedia ? (
              <MediaCarousel
                items={slides}
                className="absolute inset-0"
                eagerCount={2}
                onIndexChange={setActiveImageIndex}
                // What people posted here, one after another, without being
                // asked. A place with six photographs should look like a place
                // six people went to, and it cannot do that a photo at a time.
                autoAdvanceMs={4200}
              />
            ) : heroImage ? (
              <img
                src={heroImage}
                alt=""
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <>
                {/* Nobody has photographed this yet. That is the normal case
                    for an independent place, so it gets a poster of its own,
                    and it varies per location. */}
                <div
                  className="absolute inset-0 tb-poster"
                  style={{ background: empty.background, animationDuration: `${empty.driftSeconds}s` }}
                />
                {empty.blobs.map((blob, b) => (
                  <div
                    key={b}
                    className="tb-poster-blob"
                    style={{
                      top: blob.top,
                      left: blob.left,
                      width: blob.size,
                      aspectRatio: '1 / 1',
                      background: blob.color,
                      animationDelay: blob.delay,
                    }}
                    aria-hidden="true"
                  />
                ))}
                <div className="tb-poster-sheen" aria-hidden="true" />
                <div
                  className="absolute"
                  style={{
                    top: empty.mark.top,
                    right: empty.mark.right,
                    left: empty.mark.left,
                    transform: `rotate(${empty.mark.rotate}deg)`,
                  }}
                  aria-hidden="true"
                >
                  <CategoryIcon
                    size={empty.mark.size}
                    strokeWidth={0.9}
                    className="tb-poster-mark"
                    style={{ color: '#fff', opacity: 0.16 }}
                  />
                </div>
              </>
            )
          }
          hasImage={!bare}
          // The invitation, not the name, the name is already along the
          // bottom, and saying it twice on one screen reads as a mistake.
          emptyTitle={empty.cta}
          emptyBlurb={
            place.categoryLabel
              ? `${place.categoryLabel} - ${formatDistance(place.distance)} away. No photos here yet.`
              : 'No photos here yet.'
          }
          emptyAction={uploadPill}
          // Just the tag above the name; the facts read better under it.
          context={
            tag ? (
              <span
                className="px-2.5 py-[4px] rounded-full text-[11px]"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {tag}
              </span>
            ) : null
          }
          name={place.name}
          facts={
            <>
              {place.categoryLabel && <span style={{ opacity: 0.85 }}>{place.categoryLabel}</span>}
              <span>{formatDistance(place.distance)}</span>
              {place.rating != null && (
                <span>
                  {'★'} {place.rating.toFixed(1)}
                  {ratingCount && <span style={{ opacity: 0.75 }}> ({ratingCount})</span>}
                </span>
              )}
              {price && <span>{price}</span>}
            </>
          }
          address={place.address}
          pulse={<PlacePulseLine pulse={pulse} onMedia />}
          visitUrl={null}
          directionsUrl={locationUrl}
          vote={votePill}
          onMore={() => setDetailOpen(true)}
          mediaOverlay={
            hasMedia ? (
              // Like, comment and post, down the right edge where a thumb
              // already is. Only over real media: there is nothing to like
              // about a poster.
              <div className="absolute right-4 z-20 flex flex-col items-center gap-2.5" style={{ bottom: '34%' }}>
                {poster && (
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
                )}
                <button
                  onClick={handleLike}
                  className="transition-all active:scale-90 disabled:opacity-40"
                  style={{ ...overlayCircleStyle(false, activeImage?.likedByViewer), flexDirection: 'column', gap: '1px' }}
                  aria-label={activeImage?.likedByViewer ? 'Unlike photo' : 'Like photo'}
                  disabled={!activeImage}
                >
                  <Heart size={15} fill={activeImage?.likedByViewer ? 'currentColor' : 'none'} />
                  <span className="text-[10px] font-extrabold leading-none">{activeImage?.likeCount ?? 0}</span>
                </button>
                <button
                  onClick={() => setCommentsOpen(true)}
                  className="transition-all active:scale-90 disabled:opacity-40"
                  style={{ ...overlayCircleStyle(), flexDirection: 'column', gap: '1px' }}
                  aria-label="Open photo comments"
                  disabled={!activeImage}
                >
                  <MessageCircle size={15} />
                  <span className="text-[10px] font-extrabold leading-none">{activeImage?.commentCount ?? 0}</span>
                </button>
                <UploadMediaButton
                  onPhotoFile={upload}
                  onVideoResult={uploadVideo}
                  uploading={uploading}
                  style={overlayCircleStyle()}
                  size={16}
                  ariaLabel="Add a photo or video"
                />
              </div>
            ) : null
          }
        />

        <PlaceDetailSheet
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          activityId={activityId}
          name={place.name}
          address={place.address}
          rating={place.rating}
          ratingCount={ratingCount}
          images={images}
          fallbackImage={heroImage}
          comments={allComments}
          onOpenImage={(image) => {
            const index = mediaItems.findIndex(
              (item) => item.kind === 'image' && item.data.id === image.id,
            );
            if (index >= 0) setActiveImageIndex(index);
            setDetailOpen(false);
            setCommentsOpen(true);
          }}
          emptyAction={uploadPill}
        />

        <ImageCommentsSheet
          image={activeImage}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          onAddComment={addImageComment}
          onDeleteComment={removeImageComment}
        />
      </>
    );
  }

  // ---------- No-image variant (compact) ----------
  if (mediaItems.length === 0) {
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
        {/* A picture, the name, and the facts as pills. The picture is the
            point: a column of these reads as places to go, where a column of
            text rows reads as a directory listing. */}
        <div className="flex items-start gap-3">
          <div
            className="relative overflow-hidden flex-shrink-0"
            style={{
              width: '92px',
              height: '92px',
              borderRadius: '16px',
              background: 'var(--surface-container-high)',
            }}
          >
            {heroImage ? (
              <img
                src={heroImage}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                {/* Nothing photographed here yet, so the category stands in.
                    Still a picture-shaped thing, so the row keeps its rhythm
                    whether or not a photograph was found. */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(150deg, var(--accent-container) 0%, var(--surface-container-high) 100%)',
                  }}
                />
                <CategoryIcon
                  size={46}
                  strokeWidth={1.25}
                  className="absolute"
                  style={{
                    color: 'var(--accent)',
                    opacity: 0.5,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                  aria-hidden="true"
                />
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2
                className="text-[16px] font-extrabold leading-[1.2] tracking-tight"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties}
              >
                {place.name}
              </h2>
              <div className="flex-shrink-0">{openMapsButton}</div>
            </div>

            {/* Category, distance, rating and price as outlined pills, so the
                facts scan at a glance instead of running together in a line
                of grey text. */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10.5px] font-semibold"
                style={{ border: '1px solid var(--outline-light)', color: 'var(--accent)' }}
              >
                <CategoryIcon size={10} />
                {place.categoryLabel}
              </span>
              {distancePill}
              {place.rating != null && (
                <span
                  className="inline-flex items-center px-2 py-[3px] rounded-full text-[10.5px] font-semibold"
                  style={{ border: '1px solid var(--outline-light)', color: 'var(--text-secondary)' }}
                >
                  ★ {place.rating.toFixed(1)}
                  {ratingCount && <span style={{ opacity: 0.7 }}>&nbsp;({ratingCount})</span>}
                </span>
              )}
              {price && (
                <span
                  className="inline-flex items-center px-2 py-[3px] rounded-full text-[10.5px] font-semibold"
                  style={{ border: '1px solid var(--outline-light)', color: 'var(--text-secondary)' }}
                >
                  {price}
                </span>
              )}
            </div>

            {place.address && (
              <p
                className="text-[11.5px] leading-snug mt-1.5 truncate"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {place.address}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-2.5">
          <UploadMediaButton
            onPhotoFile={upload}
            onVideoResult={uploadVideo}
            uploading={uploading}
            style={solidCircleStyle(true)}
            size={16}
            ariaLabel="Add the first photo or video"
          />
          {savedButton}
          {votePill}
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
          <MediaCarousel
            items={slides}
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

          {/* Bottom-right: save + plus */}
          <div className="absolute right-3 bottom-3 z-10 flex items-center gap-2">
            {savedOverlayButton}
            <UploadMediaButton
              onPhotoFile={upload}
              onVideoResult={uploadVideo}
              uploading={uploading}
              style={overlayCircleStyle()}
              size={16}
            />
          </div>
        </div>

        {/* Second layer */}
        <div className="px-4 pt-3 pb-4">
          {/* Action row: distance pill, vote + save pill, open-external */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            {distancePill}
            <div className="flex items-center gap-2">
              {savedButton}
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
