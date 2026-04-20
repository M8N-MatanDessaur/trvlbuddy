import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, MessageCircle, Pencil, Reply, SendHorizontal, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  deleteActivityImageComment,
  listActivityImageComments,
  updateActivityImageComment,
  type ActivityImageComment,
  type ActivityImageMedia,
} from '../../services/activityMediaService';

interface Props {
  image: ActivityImageMedia | null;
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (
    image: ActivityImageMedia,
    body: string,
    parentCommentId?: string | null,
  ) => Promise<{ ok: boolean; error?: string | null }>;
  onDeleteComment: (image: ActivityImageMedia) => void;
}

interface CommentNode extends ActivityImageComment {
  replies: CommentNode[];
}

function commentAuthor(comment: ActivityImageComment, currentUserId?: string): string {
  return comment.user_id === currentUserId ? 'You' : 'Traveler';
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

const ImageCommentsSheet: React.FC<Props> = ({
  image,
  isOpen,
  onClose,
  onAddComment,
  onDeleteComment,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<ActivityImageComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ActivityImageComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const imageId = image?.id;

  useEffect(() => {
    if (!isOpen || !imageId) return;
    let alive = true;
    setLoading(true);
    listActivityImageComments(imageId)
      .then((rows) => {
        if (alive) setComments(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOpen, imageId]);

  useEffect(() => {
    if (!isOpen) {
      setBody('');
      setReplyingTo(null);
      setEditingId(null);
      setEditingBody('');
    }
  }, [isOpen]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const visibleCommentCount = comments.filter((comment) => !comment.deleted_at).length;

  if (!isOpen || !image) return null;

  const refreshComments = async () => {
    const rows = await listActivityImageComments(image.id);
    setComments(rows);
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (!user) {
      toast('Sign in to comment', 'info');
      return;
    }

    setSubmitting(true);
    const result = await onAddComment(image, trimmed, replyingTo?.id ?? null);
    if (!result.ok) {
      toast(result.error || 'Could not add comment', 'error');
      setSubmitting(false);
      return;
    }

    await refreshComments();
    setBody('');
    setReplyingTo(null);
    setSubmitting(false);
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

  const deleteComment = async (comment: ActivityImageComment) => {
    if (!user || comment.deleted_at) return;

    setBusyCommentId(comment.id);
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
    onDeleteComment(image);
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
    const author = commentAuthor(comment, user?.id);
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
              {!isDeleted && comment.updated_at && (
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
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
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
                    style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="text-[13px] leading-relaxed break-words mt-0.5"
                style={{
                  color: isDeleted ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  fontStyle: isDeleted ? 'italic' : undefined,
                }}
              >
                {comment.body}
              </p>
            )}

            {!isEditing && canAct && (
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setReplyingTo(comment)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold"
                  style={{ color: 'var(--text-tertiary)' }}
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
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteComment(comment)}
                      disabled={busyCommentId === comment.id}
                      className="inline-flex items-center gap-1 text-[11px] font-bold disabled:opacity-50"
                      style={{ color: 'var(--error)' }}
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

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end"
      style={{ background: 'rgba(0,0,0,0.42)' }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden"
        style={{
          background: 'var(--surface-container)',
          borderRadius: '22px 22px 0 0',
          maxHeight: '82vh',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--outline)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <h3 className="text-[16px] font-extrabold tracking-tight">Comments</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                {visibleCommentCount} {visibleCommentCount === 1 ? 'comment' : 'comments'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
            aria-label="Close comments"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-4" style={{ maxHeight: 'calc(82vh - 170px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] font-bold">No comments yet.</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                Start the conversation on this photo.
              </p>
            </div>
          ) : (
            commentTree.map((comment) => renderComment(comment))
          )}
        </div>

        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--outline)' }}>
          {replyingTo && (
            <div
              className="mb-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12px]"
              style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
            >
              <span className="min-w-0 truncate">
                Replying to {commentAuthor(replyingTo, user?.id)}
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                aria-label="Cancel reply"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div
            className="flex items-end gap-2 rounded-lg p-2"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--outline)',
            }}
          >
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, 500))}
              placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
              className="flex-1 resize-none bg-transparent px-1 py-1.5 text-[14px] outline-none"
              rows={1}
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={submit}
              disabled={submitting || body.trim().length === 0}
              className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              aria-label={replyingTo ? 'Post reply' : 'Post comment'}
            >
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <SendHorizontal size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCommentsSheet;
