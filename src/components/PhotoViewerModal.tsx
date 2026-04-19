import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  SendHorizontal,
  X,
} from 'lucide-react';
import {
  addActivityImageComment,
  isImageLikedByViewer,
  listActivityImageComments,
  setActivityImageLiked,
  type ActivityImageComment,
  type UserPhoto,
} from '../services/activityMediaService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Props {
  photos: UserPhoto[];
  initialIndex: number | null;
  uploaderId: string | null;
  onClose: () => void;
  onLikeChange?: (photoId: string, delta: number, liked: boolean) => void;
  onCommentAdded?: (photoId: string) => void;
}

function formatCommentTime(value: string): string {
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(value).toLocaleDateString();
}

const PhotoViewerModal: React.FC<Props> = ({
  photos,
  initialIndex,
  uploaderId,
  onClose,
  onLikeChange,
  onCommentAdded,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [index, setIndex] = useState<number>(initialIndex ?? 0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<ActivityImageComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const open = initialIndex !== null && photos.length > 0;
  const photo = open ? photos[Math.max(0, Math.min(index, photos.length - 1))] : null;

  const ownPhoto = !!user && !!uploaderId && uploaderId === user.id;

  // Reset internal index whenever the modal opens with a new starting point.
  useEffect(() => {
    if (initialIndex !== null) setIndex(initialIndex);
  }, [initialIndex]);

  // When the visible photo changes, reload its like + comments state.
  useEffect(() => {
    if (!photo) return;
    setLikeCount(photo.likeCount);
    setLiked(false);
    setBody('');
    setComments([]);
    setLoadingComments(true);

    let alive = true;
    Promise.all([
      user ? isImageLikedByViewer(photo.id, user.id) : Promise.resolve(false),
      listActivityImageComments(photo.id),
    ]).then(([isLiked, rows]) => {
      if (!alive) return;
      setLiked(isLiked);
      setComments(rows);
      setLoadingComments(false);
    });

    return () => {
      alive = false;
    };
  }, [photo?.id, user?.id]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photos.length, index]);

  // Touch-swipe handling for the image area.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(photos.length - 1, i + 1));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) swiping.current = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || !swiping.current) {
      touchStart.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    if (Math.abs(dx) > 40) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStart.current = null;
    swiping.current = false;
  };

  if (!photo) return null;

  const visibleComments = comments.filter((c) => !c.deleted_at);
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const handleLike = async () => {
    if (!user) {
      toast('Sign in to like photos', 'info');
      return;
    }
    if (ownPhoto) {
      toast('Your own photo does not earn Influence', 'info');
      return;
    }
    const next = !liked;
    setLikeBusy(true);
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));

    const { error } = await setActivityImageLiked({ imageId: photo.id, userId: user.id, liked: next });
    setLikeBusy(false);
    if (error) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast(error, 'error');
      return;
    }
    onLikeChange?.(photo.id, next ? 1 : -1, next);
  };

  const submitComment = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (!user) {
      toast('Sign in to comment', 'info');
      return;
    }
    setSubmitting(true);
    const { comment, error } = await addActivityImageComment({
      imageId: photo.id,
      userId: user.id,
      body: trimmed,
    });
    setSubmitting(false);
    if (error || !comment) {
      toast(error || 'Could not add comment', 'error');
      return;
    }
    setComments((rows) => [...rows, comment]);
    setBody('');
    onCommentAdded?.(photo.id);
  };

  const mapsUrl = photo.google_maps_url
    || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${photo.activity_name} ${photo.activity_address || ''}`.trim())}`;

  const navButtonStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    padding: 0,
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full h-full mx-auto"
        style={{ maxWidth: '480px', background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className="flex items-center gap-2 px-3"
          style={{
            height: '3.25rem',
            background: 'var(--bg-primary)',
            borderBottom: '0.33px solid var(--outline)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Close photo"
          >
            <X size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-extrabold tracking-tight truncate">
              {photo.activity_name}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="truncate">{photo.activity_address || 'Activity'}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span className="flex-shrink-0 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                {index + 1} / {photos.length}
              </span>
            </div>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Open in Maps"
          >
            <ExternalLink size={18} />
          </a>
        </header>

        {/* Square image with swipe + chevrons */}
        <div
          className="relative w-full flex items-center justify-center select-none"
          style={{
            aspectRatio: '1 / 1',
            background: 'black',
            flexShrink: 0,
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <img
            key={photo.id}
            src={photo.url}
            alt={photo.activity_name}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
          {hasPrev && (
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 transition-transform active:scale-90"
              style={navButtonStyle}
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {hasNext && (
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 transition-transform active:scale-90"
              style={navButtonStyle}
              aria-label="Next photo"
            >
              <ChevronRight size={20} />
            </button>
          )}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === index ? '14px' : '5px',
                    height: '5px',
                    background: i === index ? 'white' : 'rgba(255,255,255,0.55)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action row */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '0.33px solid var(--outline)', flexShrink: 0 }}
        >
          <button
            onClick={handleLike}
            disabled={likeBusy}
            className="flex items-center gap-1.5 transition-transform active:scale-90 disabled:opacity-60"
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              background: liked ? 'var(--accent)' : 'var(--surface-container-high)',
              color: liked ? 'white' : 'var(--text-primary)',
              border: 'none',
            }}
            aria-label={liked ? 'Unlike photo' : 'Like photo'}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-[13px] font-bold">{likeCount}</span>
          </button>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)' }}
          >
            <MessageCircle size={16} />
            <span className="text-[13px] font-bold">{visibleComments.length}</span>
          </div>
        </div>

        {/* Comments scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loadingComments ? (
            <div className="flex items-center justify-center py-8" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : visibleComments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] font-bold">No comments yet.</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                Be the first to say something.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleComments.map((comment) => {
                const isOwn = comment.user_id === user?.id;
                return (
                  <div key={comment.id} className="flex gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
                      style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                    >
                      {(isOwn ? 'You' : 'T').slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold">{isOwn ? 'You' : 'Traveler'}</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {formatCommentTime(comment.created_at)}
                        </span>
                      </div>
                      <p
                        className="text-[13px] leading-relaxed break-words mt-0.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {comment.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Comment input */}
        <div className="px-4 py-3" style={{ borderTop: '0.33px solid var(--outline)', flexShrink: 0 }}>
          <div
            className="flex items-center gap-2 rounded-full pl-4 pr-2"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--outline)',
              height: '44px',
            }}
          >
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitComment();
                }
              }}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent text-[14px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={submitComment}
              disabled={submitting || !body.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50 flex-shrink-0"
              style={{ background: 'var(--accent)', color: 'white' }}
              aria-label="Post comment"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoViewerModal;
