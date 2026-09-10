import React from 'react';
import { ArrowUpRight, Navigation } from 'lucide-react';
import type { FeedItem } from '../../services/unifiedFeed';
import { tagFor } from '../../services/unifiedFeed';
import { viewOf } from '../../services/feedItemView';
import type { PlacePulse } from '../../services/placePulse';
import PlacePulseLine from './PlacePulseLine';

interface Props {
  /** Everything in the feed, in order. */
  items: FeedItem[];
  /** Signs of life on each place, keyed by activity slug. */
  pulseBySlug?: Map<string, PlacePulse>;
  /** Which one is on the stage. */
  index: number;
  images: Record<string, string>;
  /** Jump the stage to a page. */
  onSelect: (index: number) => void;
}

/** How many of the coming pages to show. Enough to be worth glancing at. */
const QUEUE = 8;

/**
 * What is on the stage, and what is next, beside it.
 *
 * A phone shows one thing at a time because that is all it has room for. A
 * laptop has a whole window either side of the feed, and filling it with
 * nothing was the desktop layout's remaining tell. So the details that live
 * over the photograph on a phone sit next to it here, and under them is the
 * queue, which turns a feed you can only go forward through into one you
 * can see coming and skip ahead in.
 */
const FeedSidePanel: React.FC<Props> = ({ items, index, images, onSelect, pulseBySlug }) => {
  const current = items[index];
  if (!current) return null;
  const pulse =
    current.kind === 'place' ? pulseBySlug?.get(`gpid-${current.place.placeId}`) ?? null : null;
  const view = viewOf(current, images[current.id]);
  const Icon = view.Icon;
  const queue = items.slice(index + 1, index + 1 + QUEUE);

  return (
    <div className="flex flex-col gap-4 min-w-0 h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--surface-container)', border: '0.5px solid var(--outline)' }}
      >
        <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--accent)' }}>
          <Icon size={13} className="flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{tagFor(current)}</span>
        </div>

        <h2 className="text-[19px] font-extrabold tracking-tight leading-tight mb-1.5">
          {view.title}
        </h2>

        {view.meta && (
          <p className="text-[13px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {view.meta}
          </p>
        )}
        {view.where && (
          <p className="text-[12.5px] mb-2" style={{ color: 'var(--text-secondary)' }}>
            {view.where}
          </p>
        )}
        {view.blurb && (
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {view.blurb}
          </p>
        )}

        {pulse && (
          <div className="mt-3">
            <PlacePulseLine pulse={pulse} />
          </div>
        )}

        {/* The one thing worth reading before you go. On a phone there is no
            room for it beside the photograph; here there is. */}
        {pulse?.topTip && (
          <div
            className="mt-3 rounded-xl p-3"
            style={{ background: 'var(--surface-container-high)' }}
          >
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {pulse.topTip.body}
            </p>
            {pulse.topTip.helpfulCount > 0 && (
              <p className="text-[11px] font-bold mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                {pulse.topTip.helpfulCount} found this helpful
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3.5">
          {view.sourceUrl && (
            <a
              href={view.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 rounded-full text-[12.5px] font-bold no-underline"
              style={{
                height: '38px',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              Visit <ArrowUpRight size={13} />
            </a>
          )}
          <a
            href={view.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 rounded-full text-[12.5px] font-bold no-underline"
            style={{
              height: '38px',
              background: 'var(--surface-container-high)',
              color: 'var(--text-primary)',
            }}
          >
            Directions <Navigation size={13} />
          </a>
        </div>
      </div>

      {queue.length > 0 && (
        <div>
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 px-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Coming up
          </p>
          <div className="flex flex-col gap-1">
            {queue.map((item, i) => {
              const q = viewOf(item, images[item.id]);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(index + 1 + i)}
                  className="flex items-center gap-3 p-2 rounded-xl text-left transition-colors"
                  style={{ background: 'transparent', border: 'none', width: '100%' }}
                >
                  <div
                    className="rounded-lg overflow-hidden flex-shrink-0"
                    style={{
                      width: '44px',
                      height: '44px',
                      background: 'var(--surface-container-high)',
                    }}
                  >
                    {q.image && (
                      <img
                        src={q.image}
                        alt=""
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {q.title}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {q.meta || tagFor(item)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedSidePanel;
