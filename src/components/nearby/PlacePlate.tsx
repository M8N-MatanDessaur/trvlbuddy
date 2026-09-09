import React from 'react';
import { Navigation, Bookmark } from 'lucide-react';
import type { DiscoveryPlace } from '../../services/discovery';
import { mapsLink } from '../../services/discovery';

// One place, as a plate.
//
// Two shapes, and which one you get depends on whether there is a photograph
// worth the room -- not on rank. That is the point: a place nobody has
// photographed yet becomes a smaller typographic plate rather than a big card
// with a grey box in it. The feed is uneven on purpose, so the gaps in the
// data read as editorial rhythm instead of as missing images.

export interface PlateItem extends DiscoveryPlace {
  /** Google rating, when this came from the places side. */
  rating?: number;
  reviewCount?: number;
  openNow?: boolean;
  /** Contributed in the app: the signal that outranks everything else. */
  photoCount?: number;
}

interface Props {
  place: PlateItem;
  /** Feature plates lead with the picture. */
  variant: 'feature' | 'plain';
  onOpen?: (place: PlateItem) => void;
  onSave?: (place: PlateItem) => void;
}

function walkTime(meters: number): string {
  // 80 m/min is an unhurried walking pace, and this is a city.
  const minutes = Math.max(1, Math.round(meters / 80));
  if (minutes <= 25) return `${minutes} min walk`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

function sourceLabel(place: PlateItem): string | null {
  if (place.photoCount) {
    return place.photoCount === 1 ? 'One photo from a traveller here' : `${place.photoCount} photos from travellers`;
  }
  if (place.source === 'wikipedia') return 'From Wikipedia';
  if (place.source === 'osm') return 'From OpenStreetMap';
  return null;
}

const PlacePlate: React.FC<Props> = ({ place, variant, onOpen, onSave }) => {
  const facts = (
    <>
      <h3 className="tb-name">{place.name}</h3>
      <p className="tb-facts">
        <span className="tb-kind">{place.kind}</span>
        <span className="tb-walk">{walkTime(place.distance)}</span>
        {place.openNow && <span className="tb-open">Open now</span>}
      </p>
      {place.rating != null && (
        <p className="tb-score">
          {place.rating.toFixed(1)}
          {place.reviewCount != null && (
            <span className="tb-score-of">
              from {place.reviewCount.toLocaleString()} reviews
            </span>
          )}
        </p>
      )}
    </>
  );

  const body = (
    <>
      {place.blurb && <p className="tb-note">{place.blurb}</p>}
      {sourceLabel(place) && <p className="tb-from">{sourceLabel(place)}</p>}
      <div>
        <a
          className="tb-go"
          href={mapsLink(place)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Navigation size={15} strokeWidth={2.5} />
          Take me there
        </a>
        {onSave && (
          <button
            type="button"
            className="tb-keep"
            onClick={(e) => { e.stopPropagation(); onSave(place); }}
          >
            <Bookmark size={15} strokeWidth={2.2} />
            Save
          </button>
        )}
      </div>
    </>
  );

  return (
    <article
      className={`tb-plate tb-plate--${variant}`}
      tabIndex={0}
      role="button"
      onClick={() => onOpen?.(place)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(place); }
      }}
      aria-label={`${place.name}, ${place.kind}, ${walkTime(place.distance)}`}
    >
      {variant === 'feature' && place.imageUrl ? (
        <>
          <div className="tb-shot">
            <img src={place.imageUrl} alt="" loading="lazy" decoding="async" />
            <div className="tb-shot-body">{facts}</div>
          </div>
          <div className="tb-body">{body}</div>
        </>
      ) : (
        <div className="tb-body">
          {facts}
          {body}
        </div>
      )}
    </article>
  );
};

export default PlacePlate;
