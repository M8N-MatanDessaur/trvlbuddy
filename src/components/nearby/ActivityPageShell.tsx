import React from 'react';
import { ExternalLink, Navigation, MoreHorizontal } from 'lucide-react';

/**
 * One activity, filling the screen.
 *
 * The layout is fixed and the contents are slots, because an event and a
 * place have to look like the same kind of thing: the same corners hold the
 * same information, and Visit and Directions sit in the same place whichever
 * you are looking at. Everything that differs, what counts as context, what
 * a vote means, is passed in.
 *
 *   top-left      where you are
 *   top-right     you (opens your profile)
 *   middle        the picture, or the invitation to add one
 *   bottom-left   context, name, address, then Visit and Directions
 *   bottom-right  More, then the vote
 *
 * There are no arrows: the whole thing is swipeable, and a full-screen frame
 * with chrome bolted to the top of it stops reading as full-screen.
 */
interface Props {
  /** "Montreal, QC". */
  locality?: string | null;
  /** The viewer's avatar, top right. */
  avatar?: React.ReactNode;
  /** Full-bleed background: a photo, a carousel, or a poster. */
  media: React.ReactNode;
  /**
   * True when there is a real picture. When false the middle of the screen
   * carries the invitation instead, because there is nothing to look at.
   */
  hasImage: boolean;
  /** Shown in the middle when there is no picture. */
  emptyTitle?: string;
  emptyBlurb?: string;
  emptyAction?: React.ReactNode;
  /** Above the name, on its own line: what kind of answer this is. */
  context?: React.ReactNode;
  name: string;
  /**
   * Between the name and the address: category, distance, rating. The facts
   * read better under the name than crowded above it.
   */
  facts?: React.ReactNode;
  address?: string | null;
  /**
   * Signs of life: who has been here and what they left. Sits under the
   * address, above the two ways out, and renders nothing when a place has
   * nothing on it yet.
   */
  pulse?: React.ReactNode;
  /** The official page, when there is one. */
  visitUrl?: string | null;
  /** Google, always. */
  directionsUrl: string;
  /** Upvote/downvote for a place; going/popularity for an event. */
  vote?: React.ReactNode;
  onMore: () => void;
  /** Extra affordances over the media, e.g. like and comment on a photo. */
  mediaOverlay?: React.ReactNode;
}

// Dark enough to carry white type over a bright photograph, with a hairline
// edge so the shape still reads over a dark one. Black alone disappeared
// into the bottom of the scrim.
const glass: React.CSSProperties = {
  background: 'rgba(22,22,26,0.62)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.22)',
  color: '#fff',
};

const ActivityPageShell: React.FC<Props> = ({
  locality,
  avatar,
  media,
  hasImage,
  emptyTitle,
  emptyBlurb,
  emptyAction,
  context,
  name,
  facts,
  address,
  pulse,
  visitUrl,
  directionsUrl,
  vote,
  onMore,
  mediaOverlay,
}) => (
  <article className="relative w-full h-full overflow-hidden">
    {media}

    {/* The text carries its own ground, so nothing depends on how dark a
        particular photograph happens to be. */}
    <div
      className="absolute inset-x-0 bottom-0 pointer-events-none"
      style={{
        height: '58%',
        background:
          'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.72) 26%, rgba(0,0,0,0.24) 62%, transparent 100%)',
      }}
    />
    <div
      className="absolute inset-x-0 top-0 pointer-events-none"
      style={{
        height: '18%',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)',
      }}
    />

    {locality && (
      <span
        className="absolute left-4 top-4 z-20 px-4 rounded-full text-[12.5px] font-bold max-w-[52%] truncate inline-flex items-center"
        style={{ ...glass, height: '44px' }}
      >
        {locality}
      </span>
    )}

    {avatar && <div className="absolute right-4 top-4 z-20">{avatar}</div>}

    {mediaOverlay}

    {/* Nothing to look at, so the middle of the screen asks for something to
        look at. Centred in the frame, and sitting directly on the ground
        rather than inside a card, a panel floating on a full-bleed page
        reads as a dialogue box, not as part of the design. */}
    {!hasImage && (emptyTitle || emptyAction) && (
      <div className="absolute inset-0 z-10 px-7 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-3 text-center pointer-events-auto" style={{ maxWidth: '20rem' }}>
          {emptyTitle && (
            <h3
              className="font-extrabold tracking-tight"
              style={{
                color: '#fff',
                fontSize: 'clamp(1.5rem, 7vw, 2.1rem)',
                lineHeight: 1.08,
                textWrap: 'balance',
                // The only thing standing between white type and a pale
                // photograph, now that there is no panel behind it.
                textShadow: '0 2px 18px rgba(0,0,0,0.55)',
              } as React.CSSProperties}
            >
              {emptyTitle}
            </h3>
          )}
          {emptyBlurb && (
            <p
              className="text-[12.5px] leading-relaxed"
              style={{
                color: 'rgba(255,255,255,0.82)',
                textShadow: '0 1px 12px rgba(0,0,0,0.5)',
              }}
            >
              {emptyBlurb}
            </p>
          )}
          {emptyAction}
        </div>
      </div>
    )}

    <div className="absolute inset-x-0 bottom-0 z-20 p-4 flex items-end justify-between gap-3">
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        {context && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
            {context}
          </div>
        )}

        <h2
          className="font-extrabold tracking-tight"
          style={{
            color: '#fff',
            fontSize: 'clamp(1.4rem, 6.5vw, 2.1rem)',
            lineHeight: 1.05,
            textWrap: 'balance',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as React.CSSProperties}
        >
          {name}
        </h2>

        {facts && (
          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-bold"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          >
            {facts}
          </div>
        )}

        {address && (
          <p
            className="text-[11.5px] leading-snug"
            style={{
              color: 'rgba(255,255,255,0.7)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {address}
          </p>
        )}

        {pulse && <div className="mt-1.5">{pulse}</div>}

        {/* The same two ways out for an event as for a place. */}
        <div className="flex items-center gap-2 mt-1.5">
          <a
            href={visitUrl || `https://www.google.com/search?q=${encodeURIComponent(name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-bold whitespace-nowrap transition-transform active:scale-[0.96]"
            style={{ background: '#fff', color: '#111' }}
          >
            Visit
            <ExternalLink size={12} />
          </a>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-bold whitespace-nowrap transition-transform active:scale-[0.96]"
            style={glass}
          >
            Directions
            <Navigation size={12} />
          </a>
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMore}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition-transform active:scale-90"
            style={{ ...glass, border: 'none' }}
            aria-label={`More about ${name}`}
          >
            More
            <MoreHorizontal size={14} />
          </button>
        </div>
        {vote}
      </div>
    </div>
  </article>
);

export default ActivityPageShell;
