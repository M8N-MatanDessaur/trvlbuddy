import { useScrollLock } from '../../hooks/useScrollLock';
import React, { useEffect } from 'react';
import { X, Heart, MessageCircle, Star } from 'lucide-react';
import Avatar from '../Avatar';
import PlaceTips from './PlaceTips';
import type { ActivityImageMedia } from '../../services/activityMediaService';

/**
 * Everything about one place, opened from More.
 *
 * The feed shows one photograph at a time because it is a feed. This is the
 * other mode: everything at once, in a bento of uneven tiles, so a place with
 * twelve photos looks like a place people go to rather than a list of twelve
 * rows. Comments and reviews sit under it in the same grid.
 *
 * Tiles are sized from each photo's own engagement, the most liked photo
 * gets the big tile, so the layout says something rather than being random.
 */
interface Props {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  address?: string | null;
  rating?: number | null;
  ratingCount?: string | null;
  /** What people have posted here. */
  images: ActivityImageMedia[];
  /** A free photograph, shown only when nobody has posted anything. */
  fallbackImage?: string | null;
  /** Comments across all of this place's photos, newest first. */
  comments: Array<{
    id: string;
    body: string;
    created_at: string;
    author: { id?: string; display_name?: string | null; avatar_url?: string | null } | null;
  }>;
  onOpenImage?: (image: ActivityImageMedia) => void;
  /** The invitation, when there is nothing here yet. */
  emptyAction?: React.ReactNode;
  /** The place itself, so what people say about it can hang off it. */
  activityId?: string | null;
}

/**
 * Which tile each photo gets. The first and most-liked photo takes a
 * two-by-two; after that the pattern alternates so the grid stays uneven
 * without ever leaving a hole.
 */
function tileSpan(index: number): { col: string; row: string } {
  if (index === 0) return { col: 'span 2', row: 'span 2' };
  const cycle = (index - 1) % 5;
  if (cycle === 2) return { col: 'span 2', row: 'span 1' };
  return { col: 'span 1', row: 'span 1' };
}

const PlaceDetailSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  name,
  address,
  rating,
  ratingCount,
  images,
  fallbackImage,
  activityId,
  comments,
  onOpenImage,
  emptyAction,
}) => {
  useScrollLock(isOpen);
  // Escape closes it, and the feed underneath must not scroll while it is up.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Most liked first, so the big tile is the one people actually liked.
  const ordered = [...images].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: 'var(--bg-primary)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`About ${name}`}
    >
      <header
        className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0"
        style={{ borderBottom: '0.5px solid var(--outline)' }}
      >
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold tracking-tight leading-tight">{name}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {rating != null && (
              <span
                className="inline-flex items-center gap-1 text-[12px] font-bold"
                style={{ color: 'var(--accent)' }}
              >
                <Star size={12} fill="currentColor" />
                {rating.toFixed(1)}
                {ratingCount && (
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    ({ratingCount})
                  </span>
                )}
              </span>
            )}
            {address && (
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {address}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex items-center justify-center rounded-full flex-shrink-0 transition-transform active:scale-90"
          style={{
            width: '36px',
            height: '36px',
            background: 'var(--surface-container)',
            color: 'var(--text-primary)',
            border: 'none',
          }}
        >
          <X size={17} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-10">
        {ordered.length > 0 ? (
          <>
            <h3 className="text-[13px] font-bold mb-2.5">
              {ordered.length} {ordered.length === 1 ? 'photo' : 'photos'} from travellers
            </h3>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: 'repeat(4, 1fr)',
                gridAutoRows: 'minmax(0, 5.5rem)',
                gridAutoFlow: 'dense',
              }}
            >
              {ordered.map((image, i) => {
                const span = tileSpan(i);
                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => onOpenImage?.(image)}
                    className="relative overflow-hidden rounded-2xl transition-transform active:scale-[0.98]"
                    style={{
                      gridColumn: span.col,
                      gridRow: span.row,
                      background: 'var(--surface-container-high)',
                      border: 'none',
                      padding: 0,
                    }}
                    aria-label={`Photo by ${image.poster?.display_name || 'a traveller'}`}
                  >
                    <img
                      src={image.url}
                      alt=""
                      loading={i < 4 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2 py-1.5"
                      style={{
                        background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
                      }}
                    >
                      {image.poster ? (
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Avatar profile={image.poster} size={18} />
                          <span
                            className="text-[10.5px] font-semibold truncate"
                            style={{ color: '#fff' }}
                          >
                            {image.poster.display_name || 'Traveller'}
                          </span>
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="flex items-center gap-2 flex-shrink-0" style={{ color: '#fff' }}>
                        {(image.likeCount ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-[10.5px] font-bold">
                            <Heart size={10} fill="currentColor" />
                            {image.likeCount}
                          </span>
                        )}
                        {(image.commentCount ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-[10.5px] font-bold">
                            <MessageCircle size={10} />
                            {image.commentCount}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div
            className="rounded-3xl overflow-hidden relative flex flex-col items-center justify-center text-center gap-3 p-6"
            style={{ minHeight: '13rem', background: 'var(--surface-container)' }}
          >
            {fallbackImage && (
              <>
                <img
                  src={fallbackImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: 0.35 }}
                />
                <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
              </>
            )}
            <p
              className="relative text-[15px] font-bold"
              style={{ color: fallbackImage ? '#fff' : 'var(--text-primary)' }}
            >
              No photos here yet
            </p>
            <p
              className="relative text-[12.5px] max-w-[22rem]"
              style={{ color: fallbackImage ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)' }}
            >
              Whatever you post here is the first thing the next person sees.
            </p>
            {emptyAction && <div className="relative">{emptyAction}</div>}
          </div>
        )}

        {comments.length > 0 && (
          <>
            <h3 className="text-[13px] font-bold mt-6 mb-2.5">
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </h3>
            {/* Two columns on a wide screen, one on a phone: the same
                Pinterest logic as the photos, applied to words. */}
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))' }}
            >
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl p-3"
                  style={{
                    background: 'var(--surface-container)',
                    border: '0.5px solid var(--outline)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {comment.author && <Avatar profile={comment.author} size={22} />}
                    <span className="text-[12px] font-bold truncate">
                      {comment.author?.display_name || 'Traveller'}
                    </span>
                  </div>
                  <p
                    className="text-[12.5px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* What people say about the place, which is a different thing from
            what they say about one photograph of it, and the only thing
            there is to add when nobody has posted a photograph at all.

            Only where there is a place to attach them to. Events and the
            Wikipedia discoveries open this same sheet but have no activity
            row behind them yet, and a composer that cannot post is worse
            than no composer. */}
        {activityId && <PlaceTips activityId={activityId} />}
      </div>
    </div>
  );
};

export default PlaceDetailSheet;
