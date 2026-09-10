import React, { useCallback, useEffect, useState } from 'react';
import { CornerDownRight, Loader2, ThumbsUp, Trash2 } from 'lucide-react';
import Avatar from '../Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { addTip, deleteTip, listTips, setHelpful, type Tip } from '../../services/tipsService';

interface Props {
  /** The place these are about. Null while it is still being created. */
  activityId: string | null;
}

/** Relative, and short. "3 days" reads faster than a date on a card. */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const units: Array<[number, string]> = [
    [31_536_000, 'y'],
    [2_592_000, 'mo'],
    [604_800, 'w'],
    [86_400, 'd'],
    [3_600, 'h'],
    [60, 'm'],
  ];
  for (const [size, label] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label}`;
  }
  return 'now';
}

/**
 * What people say about this place.
 *
 * Not a review section. A review is a verdict on somewhere you have been; a
 * tip is something the next person needs to know before they go, when the
 * queue starts, which door is open, what to order. So the ordering is by what
 * people found helpful and how recently it was said, and nothing here counts
 * up to a score on the person who said it.
 */
const PlaceTips: React.FC<Props> = ({ activityId }) => {
  const { user, profile } = useAuth();
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activityId) {
      setTips([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTips(await listTips(activityId, user?.id ?? null));
    setLoading(false);
  }, [activityId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: string, parentId: string | null) => {
    if (!activityId || !user) return;
    setBusy(true);
    setError(null);
    const result = await addTip({ activityId, userId: user.id, body, parentId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not post that.');
      return;
    }
    if (parentId) {
      setReplyDraft('');
      setReplyTo(null);
    } else {
      setDraft('');
    }
    await load();
  };

  const toggleHelpful = async (tip: Tip) => {
    if (!user) return;
    // Move first, reconcile after: marking something helpful should feel
    // instant, and being wrong about it costs nothing.
    const next = !tip.helpfulByMe;
    setTips((current) =>
      current.map((t) =>
        t.id === tip.id
          ? { ...t, helpfulByMe: next, helpfulCount: t.helpfulCount + (next ? 1 : -1) }
          : {
              ...t,
              replies: t.replies.map((r) =>
                r.id === tip.id
                  ? { ...r, helpfulByMe: next, helpfulCount: r.helpfulCount + (next ? 1 : -1) }
                  : r,
              ),
            },
      ),
    );
    const ok = await setHelpful({ tipId: tip.id, userId: user.id, helpful: next });
    if (!ok) await load();
  };

  const remove = async (tip: Tip) => {
    if (await deleteTip(tip.id)) await load();
  };

  const line = (tip: Tip, isReply: boolean) => (
    <div key={tip.id} className={isReply ? 'flex gap-2.5 pl-9' : 'flex gap-2.5'}>
      {isReply ? (
        <CornerDownRight
          size={14}
          className="flex-shrink-0 mt-2.5"
          style={{ color: 'var(--text-tertiary)' }}
        />
      ) : (
        <div className="flex-shrink-0 mt-0.5">
          <Avatar
            profile={{
              display_name: tip.author?.displayName ?? null,
              avatar_url: tip.author?.avatarUrl ?? null,
            }}
            size={28}
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {tip.author?.displayName || 'Someone'}
          </span>
          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {ago(tip.createdAt)}
            {tip.editedAt ? ' - edited' : ''}
          </span>
        </div>

        <p
          className="text-[13.5px] leading-relaxed mt-0.5"
          style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}
        >
          {tip.body}
        </p>

        <div className="flex items-center gap-3 mt-1.5">
          <button
            type="button"
            onClick={() => toggleHelpful(tip)}
            disabled={!user}
            aria-pressed={tip.helpfulByMe}
            aria-label={tip.helpfulByMe ? 'Not helpful after all' : 'This helped'}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              minHeight: 0,
              color: tip.helpfulByMe ? 'var(--accent)' : 'var(--text-tertiary)',
            }}
          >
            <ThumbsUp size={13} />
            {tip.helpfulCount > 0 ? tip.helpfulCount : 'Helpful'}
          </button>

          {!isReply && user && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(replyTo === tip.id ? null : tip.id);
                setReplyDraft('');
              }}
              className="text-[11.5px] font-bold"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 0',
                minHeight: 0,
                color: 'var(--text-tertiary)',
              }}
            >
              Reply
            </button>
          )}

          {user && tip.author?.id === user.id && (
            <button
              type="button"
              onClick={() => remove(tip)}
              aria-label="Delete this"
              className="inline-flex items-center"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 0',
                minHeight: 0,
                color: 'var(--text-tertiary)',
              }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {replyTo === tip.id && (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && replyDraft.trim()) void post(replyDraft, tip.id);
              }}
              placeholder="Add to this"
              autoFocus
              className="flex-1 min-w-0 px-3 rounded-full text-[13px] outline-none"
              style={{
                height: '38px',
                background: 'var(--surface-container-high)',
                border: 'none',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => void post(replyDraft, tip.id)}
              disabled={busy || !replyDraft.trim()}
              className="px-3.5 rounded-full text-[12.5px] font-bold flex-shrink-0 disabled:opacity-40"
              style={{
                height: '38px',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                border: 'none',
              }}
            >
              Post
            </button>
          </div>
        )}

        {tip.replies.length > 0 && (
          <div className="flex flex-col gap-3 mt-3">
            {tip.replies.map((reply) => line(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="mt-6">
      <h3 className="text-[15px] font-extrabold tracking-tight mb-3">Tips</h3>

      {user && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-shrink-0">
            <Avatar profile={profile} size={28} />
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) void post(draft, null);
            }}
            // No place name in here. It was "What should the next person know
            // about <place>?" and the name pushed the question off the end of
            // the field, so the prompt read as an unfinished sentence. The
            // sheet is already titled with the place; the field only has to
            // ask the question.
            placeholder="What should the next person know?"
            className="flex-1 min-w-0 px-3.5 rounded-full text-[13px] outline-none"
            style={{
              height: '42px',
              background: 'var(--surface-container-high)',
              border: 'none',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            onClick={() => void post(draft, null)}
            disabled={busy || !draft.trim() || !activityId}
            className="px-4 rounded-full text-[13px] font-bold flex-shrink-0 disabled:opacity-40"
            style={{
              height: '42px',
              background: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              border: 'none',
            }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : 'Post'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[12.5px] mb-3" style={{ color: 'var(--error)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-2.5">
              <div
                className="rounded-full activity-card-shimmer flex-shrink-0"
                style={{ width: 28, height: 28, background: 'var(--surface-container-high)' }}
              />
              <div className="flex-1 flex flex-col gap-1.5">
                <div
                  className="h-3 rounded activity-card-shimmer"
                  style={{ width: '35%', background: 'var(--surface-container-high)' }}
                />
                <div
                  className="h-3 rounded activity-card-shimmer"
                  style={{ background: 'var(--surface-container-high)' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : tips.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          Nobody has said anything yet. If you know the trick to this place, say it here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">{tips.map((tip) => line(tip, false))}</div>
      )}
    </section>
  );
};

export default PlaceTips;
