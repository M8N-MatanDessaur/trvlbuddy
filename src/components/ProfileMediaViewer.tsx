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
  Volume2,
  VolumeX,
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
import {
  addActivityVideoComment,
  deleteActivityVideo,
  deleteActivityVideoComment,
  isVideoLikedByViewer,
  listActivityVideoComments,
  setActivityVideoLiked,
  updateActivityVideoComment,
  type ActivityVideoComment,
  type UserVideo,
} from '../services/activityVideoService';
import { thumbhashToCssDataUrl } from '../lib/thumbhash';
import { getActiveMentionQuery, type MentionSuggestion } from '../lib/mentions';
import MentionSuggestions from './MentionSuggestions';
import MentionBody from './MentionBody';
import CachedImage from './CachedImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { impact as hapticImpact, success as hapticSuccess, tap as hapticTap, warning as hapticWarning } from '../lib/haptics';

export type MediaItem =
  | { kind: 'image'; data: UserPhoto }
  | { kind: 'video'; data: UserVideo };

interface AnyComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  parent_comment_id: string | null;
}

interface CommentNode extends AnyComment {
  replies: CommentNode[];
}

const DELETED_TOMBSTONE_MS = 30_000;

function isStaleDelete(comment: AnyComment, nowMs: number): boolean {
  if (!comment.deleted_at) return false;
  return nowMs - new Date(comment.deleted_at).getTime() >= DELETED_TOMBSTONE_MS;
}

function buildCommentTree(comments: AnyComment[]): CommentNode[] {
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
  media: MediaItem[];
  initialIndex: number | null;
  uploaderId: string | null;
  onClose: () => void;
  onLikeChange?: (id: string, kind: 'image' | 'video', delta: number, liked: boolean) => void;
  onCommentAdded?: (id: string, kind: 'image' | 'video') => void;
  onMediaDeleted?: (id: string, kind: 'image' | 'video') => void;
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

function getActivityName(item: MediaItem): string {
  return item.data.activity_name;
}
function getActivityAddress(item: MediaItem): string | null {
  return item.data.activity_address;
}
function getMapsUrl(item: MediaItem): string {
  if (item.data.google_maps_url) return item.data.google_maps_url;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.data.activity_name} ${item.data.activity_address || ''}`.trim())}`;
}
function getLikeCount(item: MediaItem): number {
  return item.data.likeCount;
}
function getCommentCount(item: MediaItem): number {
  return item.data.commentCount;
}

const ProfileMediaViewer: React.FC<Props> = ({
  media,
  initialIndex,
  uploaderId,
  onClose,
  onLikeChange,
  onCommentAdded,
  onMediaDeleted,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [index, setIndex] = useState<number>(initialIndex ?? 0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<AnyComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const [replyingTo, setReplyingTo] = useState<AnyComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

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
    requestAnimationFrame(() => {
      const pos = Math.min(next.length, ctx.start + token.length);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const open = initialIndex !== null && media.length > 0;
  const item = open ? media[Math.max(0, Math.min(index, media.length - 1))] : null;
  const ownItem = !!user && !!uploaderId && uploaderId === user.id;

  useEffect(() => {
    if (initialIndex !== null) setIndex(initialIndex);
  }, [initialIndex]);

  // Reload like + comments whenever the focused item changes.
  useEffect(() => {
    if (!item) return;
    setLikeCount(getLikeCount(item));
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
    const id = item.data.id;
    const kind = item.kind;

    Promise.all([
      user
        ? kind === 'image'
          ? isImageLikedByViewer(id, user.id)
          : isVideoLikedByViewer(id, user.id)
        : Promise.resolve(false),
      kind === 'image'
        ? listActivityImageComments(id).then((rows) =>
            rows.map<AnyComment>((r) => ({
              id: r.id,
              user_id: r.user_id,
              body: r.body,
              created_at: r.created_at,
              updated_at: r.updated_at,
              deleted_at: r.deleted_at,
              parent_comment_id: r.parent_comment_id,
            })),
          )
        : listActivityVideoComments(id).then((rows) =>
            rows.map<AnyComment>((r) => ({
              id: r.id,
              user_id: r.user_id,
              body: r.body,
              created_at: r.created_at,
              updated_at: r.updated_at,
              deleted_at: r.deleted_at,
              parent_comment_id: r.parent_comment_id,
            })),
          ),
    ]).then(([isLiked, rows]) => {
      if (!alive) return;
      setLiked(isLiked);
      setComments(rows);
      setLoadingComments(false);
    });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.data.id, item?.kind, user?.id]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const suppressScrollSyncRef = useRef(false);

  const scrollToIndex = (target: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(media.length - 1, target));
    suppressScrollSyncRef.current = behavior === 'auto';
    el.scrollTo({ left: clamped * el.clientWidth, behavior });
  };

  const goPrev = () => scrollToIndex(index - 1);
  const goNext = () => scrollToIndex(index + 1);

  // Jump to the starting media item instantly when the modal opens.
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
  }, [initialIndex, media.length]);

  const handleGalleryScroll = () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (suppressScrollSyncRef.current) return;
      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = Math.round(el.scrollLeft / el.clientWidth);
      if (next !== index && next >= 0 && next < media.length) {
        setIndex(next);
        hapticTap();
      }
    });
  };

  // Pause every video that isn't the active slide; play the active one.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === index) {
        video.muted = muted;
        try {
          void video.play().catch(() => {});
        } catch { /* noop */ }
      } else {
        try { video.pause(); } catch { /* noop */ }
      }
    });
  }, [index, muted, item?.kind]);

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
  }, [open, media.length, index]);

  const lastTapRef = useRef(0);

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

  if (!item) return null;

  const handleLike = async () => {
    if (!user) {
      toast('Sign in to like posts', 'info');
      return;
    }
    if (ownItem) {
      toast('Your own post does not earn Influence', 'info');
      return;
    }
    const next = !liked;
    setLikeBusy(true);
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) hapticImpact();
    else hapticTap();

    const id = item.data.id;
    const { error } = item.kind === 'image'
      ? await setActivityImageLiked({ imageId: id, userId: user.id, liked: next })
      : await setActivityVideoLiked({ videoId: id, userId: user.id, liked: next });
    setLikeBusy(false);
    if (error) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast(error, 'error');
      return;
    }
    onLikeChange?.(id, item.kind, next ? 1 : -1, next);
  };

  const handleSlideTap = () => {
    if (item.kind === 'video') {
      setMuted((m) => !m);
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      setHeartBurst((n) => n + 1);
      hapticImpact();
      if (!liked && !ownItem && user) {
        void handleLike();
      }
    } else {
      lastTapRef.current = now;
    }
  };

  const confirmDelete = async () => {
    if (!user || !ownItem) return;
    setDeleting(true);
    hapticWarning();
    const id = item.data.id;
    const result = item.kind === 'image'
      ? await deleteActivityImage({ imageId: id, userId: user.id, storagePath: (item.data as UserPhoto).storage_path })
      : await deleteActivityVideo({
          videoId: id,
          userId: user.id,
          storagePath: (item.data as UserVideo).storage_path,
          posterPath: (item.data as UserVideo).poster_path,
        });
    setDeleting(false);
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    onMediaDeleted?.(id, item.kind);
    setConfirmDeleteOpen(false);
  };

  const downloadMedia = async () => {
    setMenuOpen(false);
    try {
      const url = item.kind === 'image' ? (item.data as UserPhoto).url : (item.data as UserVideo).url;
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const path = item.kind === 'image'
        ? (item.data as UserPhoto).storage_path
        : (item.data as UserVideo).storage_path;
      const ext = (path.split('.').pop() || (item.kind === 'image' ? 'jpg' : 'mp4')).toLowerCase();
      const safeName = item.data.activity_name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || (item.kind === 'image' ? 'photo' : 'video');
      a.href = blobUrl;
      a.download = `${safeName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
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
    const id = item.data.id;
    const result = item.kind === 'image'
      ? await addActivityImageComment({
          imageId: id,
          userId: user.id,
          body: trimmed,
          parentCommentId: replyingTo?.id ?? null,
        })
      : await addActivityVideoComment({
          videoId: id,
          userId: user.id,
          body: trimmed,
          parentCommentId: replyingTo?.id ?? null,
        });
    setSubmitting(false);
    if (result.error || !result.comment) {
      toast(result.error || 'Could not add comment', 'error');
      return;
    }
    const c = result.comment as ActivityImageComment | ActivityVideoComment;
    const normalized: AnyComment = {
      id: c.id,
      user_id: c.user_id,
      body: c.body,
      created_at: c.created_at,
      updated_at: c.updated_at,
      deleted_at: c.deleted_at,
      parent_comment_id: c.parent_comment_id,
    };
    setComments((rows) => [...rows, normalized]);
    setBody('');
    setReplyingTo(null);
    hapticSuccess();
    onCommentAdded?.(id, item.kind);
  };

  const startEdit = (comment: AnyComment) => {
    setEditingId(comment.id);
    setEditingBody(comment.body);
  };

  const saveEdit = async (comment: AnyComment) => {
    if (!user) return;
    const trimmed = editingBody.trim();
    if (!trimmed) return;

    setBusyCommentId(comment.id);
    const result = item.kind === 'image'
      ? await updateActivityImageComment({
          commentId: comment.id,
          userId: user.id,
          body: trimmed,
        })
      : await updateActivityVideoComment({
          commentId: comment.id,
          userId: user.id,
          body: trimmed,
        });
    setBusyCommentId(null);

    if (result.error || !result.comment) {
      toast(result.error || 'Could not update comment', 'error');
      return;
    }

    const c = result.comment as ActivityImageComment | ActivityVideoComment;
    const normalized: AnyComment = {
      id: c.id,
      user_id: c.user_id,
      body: c.body,
      created_at: c.created_at,
      updated_at: c.updated_at,
      deleted_at: c.deleted_at,
      parent_comment_id: c.parent_comment_id,
    };

    setComments((rows) => rows.map((row) => (row.id === comment.id ? normalized : row)));
    setEditingId(null);
    setEditingBody('');
  };

  const removeComment = async (comment: AnyComment) => {
    if (!user || comment.deleted_at) return;

    setBusyCommentId(comment.id);
    hapticWarning();
    const result = item.kind === 'image'
      ? await deleteActivityImageComment({ commentId: comment.id, userId: user.id })
      : await deleteActivityVideoComment({ commentId: comment.id, userId: user.id });
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

  const mapsUrl = getMapsUrl(item);
  const headerName = getActivityName(item);
  const headerAddress = getActivityAddress(item);
  const totalCount = media.length;

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
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-extrabold tracking-tight truncate">
              {headerName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="truncate">{headerAddress || 'Activity'}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span className="flex-shrink-0 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                {index + 1} / {totalCount}
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
            {media.map((m, i) => {
              const placeholder = thumbhashToCssDataUrl(m.data.thumbhash);
              return (
                <div
                  key={`${m.kind}-${m.data.id}`}
                  className="relative flex-shrink-0 w-full h-full"
                  style={{
                    scrollSnapAlign: 'center',
                    scrollSnapStop: 'always',
                    background: placeholder
                      ? `center / cover no-repeat url(${placeholder})`
                      : 'black',
                  }}
                  onClick={() => { if (i === index) handleSlideTap(); }}
                >
                  {m.kind === 'image' ? (
                    <CachedImage
                      src={m.data.url}
                      alt={m.data.activity_name}
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
                  ) : (
                    <VideoSlide
                      video={m.data}
                      isActive={i === index}
                      muted={muted}
                      registerRef={(el) => {
                        if (el) videoRefs.current.set(i, el);
                        else videoRefs.current.delete(i);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

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

          {/* Mute indicator for video slides */}
          {item.kind === 'video' && (
            <div
              aria-hidden="true"
              className="absolute right-2 top-2 flex items-center justify-center rounded-full pointer-events-none"
              style={{
                width: 28,
                height: 28,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: 'white',
                zIndex: 4,
              }}
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </div>
          )}

          {media.length > 1 && (
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none"
              style={{ zIndex: 4 }}
            >
              {media.map((_, i) => (
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
            aria-label={liked ? 'Unlike' : 'Like'}
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
            <span className="text-[13px] font-bold leading-none">{visibleCommentCount || getCommentCount(item)}</span>
          </div>

          {ownItem && (
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
                aria-label="Options"
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
                      onClick={downloadMedia}
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
                      <span className="text-[13px] font-semibold">
                        {item.kind === 'image' ? 'Download image' : 'Download video'}
                      </span>
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
                  Unpublish this {item.kind === 'image' ? 'image' : 'video'}?
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  This is non-reversible. The {item.kind}, its likes, and its comments will be removed from
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

interface VideoSlideProps {
  video: UserVideo;
  isActive: boolean;
  muted: boolean;
  registerRef: (el: HTMLVideoElement | null) => void;
}

// Inner video slide. Loops within the trim window the uploader picked
// (start_ms + duration_ms) so playback only ever shows the chosen
// 7-second segment, mirroring the standalone video viewer's behavior.
// The poster attribute keeps the first frame visible while bytes load,
// fixing the "video has no thumbnail" feel.
const VideoSlide: React.FC<VideoSlideProps> = ({ video, isActive, muted, registerRef }) => {
  const ref = useRef<HTMLVideoElement | null>(null);

  const startSec = video.start_ms && video.start_ms > 0 ? video.start_ms / 1000 : 0;
  const endSec = video.duration_ms && video.duration_ms > 0
    ? startSec + video.duration_ms / 1000
    : null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trySeek = () => {
      if (startSec > 0 && Math.abs(el.currentTime - startSec) > 0.05) {
        try { el.currentTime = startSec; } catch { /* noop */ }
      }
    };
    if (el.readyState >= 1) trySeek();
    el.addEventListener('loadedmetadata', trySeek);
    return () => el.removeEventListener('loadedmetadata', trySeek);
  }, [startSec]);

  useEffect(() => {
    const el = ref.current;
    if (!el || endSec === null) return;
    const onTimeUpdate = () => {
      if (el.currentTime >= endSec - 0.05) {
        try {
          el.currentTime = startSec;
          void el.play().catch(() => {});
        } catch { /* noop */ }
      } else if (el.currentTime < startSec - 0.05) {
        try { el.currentTime = startSec; } catch { /* noop */ }
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [startSec, endSec]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    if (isActive) {
      try { void el.play().catch(() => {}); } catch { /* noop */ }
    } else {
      try { el.pause(); } catch { /* noop */ }
    }
  }, [isActive, muted]);

  return (
    <video
      ref={(el) => {
        ref.current = el;
        registerRef(el);
      }}
      src={video.url}
      poster={video.posterUrl}
      muted={muted}
      autoPlay={isActive}
      playsInline
      loop={endSec === null}
      preload={isActive ? 'auto' : 'metadata'}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        background: 'black',
        cursor: 'pointer',
        pointerEvents: 'none',
      }}
    />
  );
};

export default ProfileMediaViewer;
