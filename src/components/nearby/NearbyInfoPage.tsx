import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import ActivityPageShell from './ActivityPageShell';
import { posterFor } from './poster';
import PlaceDetailSheet from './PlaceDetailSheet';

/**
 * A page in the feed for something that is not a Google place: an event on
 * today, or somewhere worth seeing that no business listing covers.
 *
 * It renders the same shell as a place, so the corners hold the same things
 * and Visit and Directions sit where they always sit. Only the contents of
 * the slots differ.
 */
interface Props {
  /** "Happening now", "Worth seeing". */
  tag: string;
  title: string;
  /** When it is, or what kind of thing it is. */
  meta?: string | null;
  blurb?: string | null;
  where?: string | null;
  image?: string | null;
  /** The page to read more on, when the source gave one. */
  sourceUrl?: string | null;
  /** Google, always, for the way there. */
  directionsUrl: string;
  Icon: LucideIcon;
  /** Going / popularity for an event, up and down votes for a place. */
  vote?: React.ReactNode;
}

const NearbyInfoPage: React.FC<Props> = ({
  tag,
  title,
  meta,
  blurb,
  where,
  image,
  sourceUrl,
  directionsUrl,
  Icon,
  vote,
}) => {
  // An event owns its own More sheet: it has no user media yet, so there is
  // nothing for a parent to coordinate.
  const [detailOpen, setDetailOpen] = useState(false);
  const empty = posterFor(title, tag);

  return (
    <>
    <ActivityPageShell
      media={
        image ? (
          <img
            src={image}
            alt=""
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <>
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
              <Icon
                size={empty.mark.size}
                strokeWidth={0.9}
                className="tb-poster-mark"
                style={{ color: '#fff', opacity: 0.16 }}
              />
            </div>
          </>
        )
      }
      hasImage={Boolean(image)}
      // The name is along the bottom already; the middle carries what this
      // is instead of repeating it.
      emptyTitle={meta ? `${tag} - ${meta}` : tag}
      emptyBlurb={blurb || undefined}
      context={
        <span
          className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-full text-[11px]"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <Icon size={11} />
          {tag}
        </span>
      }
      name={title}
      facts={meta ? <span>{meta}</span> : undefined}
      address={where}
      visitUrl={sourceUrl}
      directionsUrl={directionsUrl}
      vote={vote}
      onMore={() => setDetailOpen(true)}
    />

    <PlaceDetailSheet
      isOpen={detailOpen}
      onClose={() => setDetailOpen(false)}
      name={title}
      address={where}
      images={[]}
      fallbackImage={image}
      comments={[]}
    />
    </>
  );
};

export default NearbyInfoPage;
