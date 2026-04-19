import React, { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  listActivityImageComments,
  type ActivityImageComment,
  type ActivityImageMedia,
} from '../../services/activityMediaService';

interface Props {
  image: ActivityImageMedia | null;
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (image: ActivityImageMedia, body: string) => Promise<{ ok: boolean; error?: string | null }>;
}

const ImageCommentsSheet: React.FC<Props> = ({ image, isOpen, onClose, onAddComment }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<ActivityImageComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !image) return;
    let alive = true;
    setLoading(true);
    listActivityImageComments(image.id)
      .then((rows) => {
        if (alive) setComments(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOpen, image?.id]);

  useEffect(() => {
    if (!isOpen) setBody('');
  }, [isOpen]);

  if (!isOpen || !image) return null;

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (!user) {
      toast('Sign in to comment', 'info');
      return;
    }

    setSubmitting(true);
    const result = await onAddComment(image, trimmed);
    if (!result.ok) {
      toast(result.error || 'Could not add comment', 'error');
      setSubmitting(false);
      return;
    }

    const rows = await listActivityImageComments(image.id);
    setComments(rows);
    setBody('');
    setSubmitting(false);
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
          maxHeight: '76vh',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--outline)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="text-[16px] font-extrabold tracking-tight">Comments</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
            aria-label="Close comments"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 'calc(76vh - 138px)' }}>
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
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
                  style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                >
                  {comment.user_id === user?.id ? 'You'.slice(0, 1) : 'T'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold">
                      {comment.user_id === user?.id ? 'You' : 'Traveler'}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed break-words" style={{ color: 'var(--text-secondary)' }}>
                    {comment.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--outline)' }}>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 500))}
            placeholder="Add a comment"
            className="flex-1 resize-none rounded-xl px-3 py-2 text-[13px] outline-none"
            rows={2}
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--text-primary)',
              border: '0.5px solid var(--outline)',
            }}
          />
          <button
            onClick={submit}
            disabled={submitting || body.trim().length === 0}
            className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
            aria-label="Post comment"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCommentsSheet;
