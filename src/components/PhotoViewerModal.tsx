import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Reply,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  addActivityImageComment,
  deleteActivityImage,
  deleteActivityImageComment,
  isImageLikedByViewer,
  listActivityImageComments,
  setActivityImageLiked,
  updateActivityImageComment,
  type ActivityImageComment,
  type UserPhoto,
} from '../services/activityMediaService';
import { thumbhashToCssDataUrl } from '../lib/thumbhash';
import { getActiveMentionQuery, type MentionSuggestion } from '../lib/mentions';
import MentionSuggestions from './MentionSuggestions';
import MentionBody from './MentionBody';
import CachedImage from './CachedImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { impact as hapticImpact, success as hapticSuccess, tap as hapticTap, warning as hapticWarning } from '../lib/haptics';

interface CommentNode extends ActivityImageComment {
  replies: CommentNode[];
}

const DELETED_TOMBSTONE_MS = 30_000;

function isStaleDelete(comment: ActivityImageComment, nowMs: number): boolean {
  if (!comment.deleted_at) return false;
  return nowMs - new Date(comment.deleted_at).getTime() >= DELETED_TOMBSTONE_MS;
}

function buildCommentTree(comments: ActivityImageComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  comments.forEach((comment) => {
    nodes.set(comment.id, { ...comment, replies: [] });
  });
  const roots: CommentNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parent_comment_id ? nodes.get(node.parent_comment_id) : null;
    if (parent && parent.id !== node.id) parent.replies.push(node);
    else roots.push(node);
  });
  return roots;
}

interface Props {
  photos: UserPhoto[];
  initialIndex: number | null;
  uploaderId: string | null;
  onClose: () => void;
  onLikeChange?: (photoId: string, delta: number, liked: boolean) => void;
  onCommentAdded?: (photoId: string) => void;
  onPhotoDeleted?: (photoId: string) => void;
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
  onPhotoDeleted,
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
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ActivityImageComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const updateMentionQuery = (value: string, caret: number) => {
    const ctx = getActiveMentionQuery(value, caret);
    setMentionQuery(ctx ? ctx.query : null);
  };

  const insertMention = (s: MentionSuggestion) => {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionEnd ?? body.length;
    const ctx = getActiveMentionQuery(body, caret);
    if (!ctx) return;
    const token = `@[${s.display_name}](${s.id}) `;
    const next = body.slice(0, ctx.start) + token + body.slice(ctx.end);
    setBody(next.slice(0, 500));
    setMentionQuery(null);
    // Restore focus and move caret past the inserted token.
    requestAnimationFrame(() => {
      const pos = Math.min(next.length, ctx.start + token.length);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

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
    setMenuOpen(false);
    setConfirmDeleteOpen(false);
    setReplyingTo(null);
    setEditingId(null);
    setEditingBody('');
    setBusyCommentId(null);
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

  // Instagram-style horizontal snap gallery. Scrolling and swipe physics are
  // native; we just observe scrollLeft to keep `index` in sync and provide
  // programmatic scrolls for chevron / keyboard nav.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const suppressScrollSyncRef = useRef(false);

  const scrollToIndex = (target: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, target));
    suppressScrollSyncRef.current = behavior === 'auto';
    el.scrollTo({ left: clamped * el.clientWidth, behavior });
  };

  const goPrev = () => scrollToIndex(index - 1);
  const goNext = () => scrollToIndex(index + 1);

  // Jump to the starting photo instantly when the modal opens on a new index.
  useEffect(() => {
    if (initialIndex === null) return;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      suppressScrollSyncRef.current = true;
      node.scrollTo({ left: initialIndex * node.clientWidth, behavior: 'auto' });
      requestAnimationFrame(() => {
        suppressScrollSyncRef.current = false;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex, photos.length]);

  const handleGalleryScroll = () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (suppressScrollSyncRef.current) return;
      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = Math.round(el.scrollLeft / el.clientWidth);
      if (next !== index && next >= 0 && next < photos.length) {
        setIndex(next);
        hapticTap();
      }
    });
  };

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

  // Double-tap on the image likes it (matches social-app convention).
  // Declared here so the hook order stays stable across renders.
  const lastTapRef = useRef(0);

  // Re-render every 5s while a just-deleted tombstone is still within its
  // 30s grace window, so it disappears on schedule even without new events.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const hasRecentDelete = comments.some(
      (c) => c.deleted_at && Date.now() - new Date(c.deleted_at).getTime() < DELETED_TOMBSTONE_MS,
    );
    if (!hasRecentDelete) return;
    const id = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(id);
  }, [comments]);

  const displayComments = useMemo(
    () => comments.filter((c) => !isStaleDelete(c, nowMs)),
    [comments, nowMs],
  );
  const commentTree = useMemo(() => buildCommentTree(displayComments), [displayComments]);
  const visibleCommentCount = displayComments.filter((c) => !c.deleted_at).length;

  if (!photo) return null;

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
    if (next) hapticImpact();
    else hapticTap();

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

  const handleImageTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      setHeartBurst((n) => n + 1);
      hapticImpact();
      // Only fire a like (not an unlike) on double-tap to match social-app convention.
      if (!liked && !ownPhoto && user) {
        void handleLike();
      }
    } else {
      lastTapRef.current = now;
    }
  };

  const confirmDelete = async () => {
    if (!user || !ownPhoto) return;
    setDeleting(true);
    hapticWarning();
    const { error } = await deleteActivityImage({
      imageId: photo.id,
      userId: user.id,
      storagePath: photo.storage_path,
    });
    setDeleting(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    onPhotoDeleted?.(photo.id);
    setConfirmDeleteOpen(false);
  };

  const downloadImage = async () => {
    setMenuOpen(false);
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = (photo.storage_path.split('.').pop() || 'jpg').toLowerCase();
      const safeName = photo.activity_name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'photo';
      a.href = url;
      a.download = `${safeName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not download', 'error');
    }
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
      parentCommentId: replyingTo?.id ?? null,
    });
    setSubmitting(false);
    if (error || !comment) {
      toast(error || 'Could not add comment', 'error');
      return;
    }
    setComments((rows) => [...rows, comment]);
    setBody('');
    setReplyingTo(null);
    hapticSuccess();
    onCommentAdded?.(photo.id);
  };

  const startEdit = (comment: ActivityImageComment) => {
    setEditingId(comment.id);
    setEditingBody(comment.body);
  };

  const saveEdit = async (comment: ActivityImageComment) => {
    if (!user) return;
    const trimmed = editingBody.trim();
    if (!trimmed) return;

    setBusyCommentId(comment.id);
    const result = await updateActivityImageComment({
      commentId: comment.id,
      userId: user.id,
      body: trimmed,
    });
    setBusyCommentId(null);

    if (result.error || !result.comment) {
      toast(result.error || 'Could not update comment', 'error');
      return;
    }

    setComments((rows) => rows.map((row) => (row.id === comment.id ? result.comment! : row)));
    setEditingId(null);
    setEditingBody('');
  };

  const removeComment = async (comment: ActivityImageComment) => {
    if (!user || comment.deleted_at) return;

    setBusyCommentId(comment.id);
    hapticWarning();
    const result = await deleteActivityImageComment({
      commentId: comment.id,
      userId: user.id,
    });
    setBusyCommentId(null);

    if (result.error) {
      toast(result.error || 'Could not delete comment', 'error');
      return;
    }

    const deletedAt = new Date().toISOString();
    setComments((rows) => rows.map((row) => (
      row.id === comment.id
        ? { ...row, body: 'This comment was deleted.', deleted_at: deletedAt, updated_at: deletedAt }
        : row
    )));
    if (replyingTo?.id === comment.id) setReplyingTo(null);
    if (editingId === comment.id) {
      setEditingId(null);
      setEditingBody('');
    }
  };

  const renderComment = (comment: CommentNode, depth = 0): React.ReactNode => {
    const isOwn = comment.user_id === user?.id;
    const isDeleted = Boolean(comment.deleted_at);
    const isEditing = editingId === comment.id;
    const author = isOwn ? 'You' : 'Traveler';
    const canAct = Boolean(user) && !isDeleted;

    return (
      <div key={comment.id} className={depth > 0 ? 'ml-9 mt-3' : ''}>
        <div className="flex gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
            style={{
              background: isDeleted ? 'var(--surface-container-high)' : 'var(--accent-container)',
              color: isDeleted ? 'var(--text-tertiary)' : 'var(--accent)',
            }}
          >
            {isDeleted ? '-' : author.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold">{isDeleted ? 'Deleted' : author}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {formatCommentTime(comment.created_at)}
              </span>
              {!isDeleted && comment.updated_at && comment.updated_at !== comment.created_at && (
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  edited
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="mt-1.5">
                <textarea
                  value={editingBody}
                  onChange={(event) => setEditingBody(event.target.value.slice(0, 500))}
                  rows={2}
                  className="w-full resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--outline)',
                  }}
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => saveEdit(comment)}
                    disabled={busyCommentId === comment.id || !editingBody.trim()}
                    className="h-8 px-2.5 rounded-lg flex items-center gap-1 text-[12px] font-bold disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', minHeight: 0 }}
                  >
                    {busyCommentId === comment.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditingBody('');
                    }}
                    className="h-8 px-2.5 rounded-lg text-[12px] font-bold"
                    style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)', border: 'none', minHeight: 0 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <MentionBody
                body={comment.body}
                className="text-[13px] leading-relaxed break-words mt-0.5"
                style={{
                  color: isDeleted ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  fontStyle: isDeleted ? 'italic' : undefined,
                }}
              />
            )}

            {!isEditing && canAct && (
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setReplyingTo(comment)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold"
                  style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', padding: 0, minHeight: 0, minWidth: 0 }}
                >
                  <Reply size={12} />
                  Reply
                </button>
                {isOwn && (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(comment)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold"
                      style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', padding: 0, minHeight: 0, minWidth: 0 }}
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeComment(comment)}
                      disabled={busyCommentId === comment.id}
                      className="inline-flex items-center gap-1 text-[11px] font-bold disabled:opacity-50"
                      style={{ color: '#dc2626', background: 'transparent', border: 'none', padding: 0, minHeight: 0, minWidth: 0 }}
                    >
                      {busyCommentId === comment.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {comment.replies.length > 0 && (
          <div className="mt-1">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const mapsUrl = photo.google_maps_url
    || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${photo.activity_name} ${photo.activity_address || ''}`.trim())}`;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)', height: '100dvh' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full mx-auto"
        style={{ maxWidth: '480px', background: 'var(--bg-primary)', height: '100dvh', minHeight: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className="flex items-center gap-2 px-3"
          style={{
            height: 'calc(3.25rem + env(safe-area-inset-top))',
            paddingTop: 'env(safe-area-inset-top)',
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

        {/* Horizontal snap gallery. Native scroll gives Instagram-style
            momentum + snap; index stays in sync via scroll observer. Square
            container, capped at 50dvh so comments always stay in view. */}
        <div
          className="relative w-full select-none"
          style={{
            aspectRatio: '1 / 1',
            maxHeight: '50dvh',
            background: 'black',
            flexShrink: 0,
          }}
        >
          <div
            ref={scrollRef}
            onScroll={handleGalleryScroll}
            className="absolute inset-0 flex overflow-x-auto overflow-y-hidden photo-gallery-scroll"
            style={{
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
            }}
          >
            {photos.map((p, i) => {
              const placeholder = thumbhashToCssDataUrl(p.thumbhash);
              return (
              <div
                key={p.id}
                className="relative flex-shrink-0 w-full h-full"
                style={{
                  scrollSnapAlign: 'center',
                  scrollSnapStop: 'always',
                  background: placeholder
                    ? `center / cover no-repeat url(${placeholder})`
                    : 'black',
                }}
                onClick={() => { if (i === index) handleImageTap(); }}
              >
                <CachedImage
                  src={p.url}
                  alt={p.activity_name}
                  draggable={false}
                  loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              );
            })}
          </div>

          {/* Heart burst on double-tap, overlays the centered slide */}
          <AnimatePresence>
            {heartBurst > 0 && (
              <motion.div
                key={heartBurst}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                onAnimationComplete={() => setHeartBurst((n) => Math.max(0, n - 1))}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 5 }}
              >
                <Heart
                  size={120}
                  fill="white"
                  style={{
                    color: 'white',
                    filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {photos.length > 1 && (
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none"
              style={{ zIndex: 4 }}
            >
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
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '0.33px solid var(--outline)', flexShrink: 0 }}
        >
          <button
            onClick={handleLike}
            disabled={likeBusy}
            className="inline-flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-60"
            style={{
              height: '36px',
              minHeight: '36px',
              minWidth: 0,
              padding: '0 14px',
              borderRadius: '9999px',
              background: liked ? 'var(--accent)' : 'var(--surface-container-high)',
              color: liked ? 'var(--on-accent)' : 'var(--text-primary)',
              border: 'none',
            }}
            aria-label={liked ? 'Unlike photo' : 'Like photo'}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-[13px] font-bold leading-none">{likeCount}</span>
          </button>
          <div
            className="inline-flex items-center gap-1.5"
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '9999px',
              background: 'var(--surface-container-high)',
              color: 'var(--text-primary)',
            }}
          >
            <MessageCircle size={16} />
            <span className="text-[13px] font-bold leading-none">{visibleCommentCount}</span>
          </div>

          {ownPhoto && (
            <div className="ml-auto relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex items-center justify-center transition-transform active:scale-95"
                style={{
                  width: '36px',
                  height: '36px',
                  minWidth: 0,
                  minHeight: 0,
                  borderRadius: '50%',
                  background: 'var(--surface-container-high)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  padding: 0,
                }}
                aria-label="Photo options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[1]"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 rounded-2xl overflow-hidden z-[2]"
                    style={{
                      background: 'var(--surface-container)',
                      border: '0.5px solid var(--outline)',
                      minWidth: '180px',
                      boxShadow: '0 12px 32px -8px rgba(0,0,0,0.35)',
                    }}
                  >
                    <button
                      onClick={downloadImage}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        border: 'none',
                        minHeight: 0,
                        minWidth: 0,
                      }}
                      role="menuitem"
                    >
                      <Download size={16} style={{ color: 'var(--accent)' }} />
                      <span className="text-[13px] font-semibold">Download image</span>
                    </button>
                    <div style={{ height: '0.5px', background: 'var(--outline)' }} aria-hidden="true" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDeleteOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{
                        background: 'transparent',
                        color: '#dc2626',
                        border: 'none',
                        minHeight: 0,
                        minWidth: 0,
                      }}
                      role="menuitem"
                    >
                      <Trash2 size={16} />
                      <span className="text-[13px] font-semibold">Unpublish</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Comments scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ minHeight: 0 }}>
          {loadingComments ? (
            <div className="flex items-center justify-center py-8" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] font-bold">No comments yet.</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                Be the first to say something.
              </p>
            </div>
          ) : (
            commentTree.map((comment) => renderComment(comment))
          )}
        </div>

        {/* Comment input */}
        <div
          className="px-4 py-3"
          style={{
            borderTop: '0.33px solid var(--outline)',
            flexShrink: 0,
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          {replyingTo && (
            <div
              className="mb-2 flex items-center justify-between gap-2 rounded-full px-3 py-1.5 text-[12px]"
              style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
            >
              <span className="min-w-0 truncate font-bold">
                Replying to {replyingTo.user_id === user?.id ? 'yourself' : 'Traveler'}
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', minHeight: 0, minWidth: 0, padding: 0 }}
                aria-label="Cancel reply"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="relative">
          <MentionSuggestions query={mentionQuery} onSelect={insertMention} />
          <div
            className="flex items-center gap-2 rounded-full pl-4 pr-0"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--outline)',
              height: '50px',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={body}
              onChange={(e) => {
                const next = e.target.value.slice(0, 500);
                setBody(next);
                const caret = e.target.selectionEnd ?? next.length;
                updateMentionQuery(next, caret);
              }}
              onKeyUp={(e) => {
                const el = e.currentTarget;
                updateMentionQuery(el.value, el.selectionEnd ?? el.value.length);
              }}
              onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitComment();
                }
              }}
              placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
              className="flex-1 bg-transparent text-[14px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={submitComment}
              disabled={submitting || !body.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50 flex-shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              aria-label={replyingTo ? 'Post reply' : 'Post comment'}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Unpublish confirmation modal */}
      <AnimatePresence>
        {confirmDeleteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] flex items-center justify-center px-5"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => !deleting && setConfirmDeleteOpen(false)}
          >
            <motion.div
              initial={{ y: 16, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 16, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface-container)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 flex flex-col items-center text-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(220, 38, 38, 0.12)',
                    color: '#dc2626',
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <h3 className="text-[16px] font-extrabold tracking-tight">
                  Unpublish this image?
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  This is non-reversible. The photo, its likes, and its comments will be removed from
                  every place it appears.
                </p>
              </div>
              <div className="flex border-t" style={{ borderColor: 'var(--outline)' }}>
                <button
                  onClick={() => setConfirmDeleteOpen(false)}
                  disabled={deleting}
                  className="flex-1 py-3.5 text-[14px] font-bold transition-colors"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    minHeight: 0,
                  }}
                >
                  Cancel
                </button>
                <div style={{ width: '0.5px', background: 'var(--outline)' }} aria-hidden="true" />
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 py-3.5 text-[14px] font-bold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  style={{
                    background: 'transparent',
                    color: '#dc2626',
                    border: 'none',
                    minHeight: 0,
                  }}
                >
                  {deleting && <Loader2 size={14} className="animate-spin" />}
                  {deleting ? 'Removing' : 'Unpublish'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoViewerModal;
