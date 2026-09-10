import { Footprints, Landmark, MapPin, Music, Palette, PartyPopper, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FeedItem } from './unifiedFeed';
import { directionsLink } from './discovery';
import { formatDistance } from './nearbyService';

/**
 * One description of a feed item, whatever kind it is.
 *
 * The pager used to unpack the four kinds inline in its JSX, which was fine
 * while a page was the only thing that showed one. The desktop panel shows the
 * same item beside the feed, and a second copy of that unpacking would be two
 * places to keep in step. This is the one place.
 */
export interface FeedItemView {
  title: string;
  /** When it is on, how far away it is, the one fact that goes under the name. */
  meta: string | null;
  blurb: string | null;
  /** The venue, the category, the address: where this is. */
  where: string | null;
  image: string | null;
  /** The site to read more on, when the source has one. */
  sourceUrl: string | null;
  directionsUrl: string;
  Icon: LucideIcon;
}

const eventIcons: Record<string, LucideIcon> = {
  festival: PartyPopper,
  market: ShoppingBag,
  exhibition: Palette,
  performance: Music,
  popup: Sparkles,
  other: Tag,
};

/** A maps search, for the things that have a name and an address but no coordinates. */
function searchLink(...parts: (string | null | undefined)[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    parts.filter(Boolean).join(' '),
  )}`;
}

export function viewOf(item: FeedItem, image?: string | null): FeedItemView {
  switch (item.kind) {
    case 'event':
      return {
        title: item.event.name,
        meta: item.event.time ?? null,
        blurb: item.event.description ?? null,
        where: item.event.location ?? null,
        // Ticketmaster ships artwork with the event, so those never wait on a
        // lookup and the item's own picture wins.
        image: item.imageUrl || image || null,
        sourceUrl: item.event.sourceUrl ?? null,
        directionsUrl: searchLink(item.event.location, item.event.name),
        Icon: eventIcons[item.event.type] || Tag,
      };
    case 'discovery':
      return {
        title: item.discovery.name,
        meta: `${formatDistance(item.discovery.distance)} away`,
        blurb: item.discovery.blurb ?? null,
        where: item.discovery.kind ?? null,
        image: image || item.discovery.imageUrl || null,
        sourceUrl: item.discovery.sourceUrl ?? null,
        directionsUrl: directionsLink(item.discovery),
        Icon: Landmark,
      };
    case 'trip':
      return {
        title: item.activity.name,
        // A distance only when you are close enough for one to mean anything.
        // From home, "480 m away" would be a lie.
        meta:
          item.distanceMeters != null
            ? `${formatDistance(item.distanceMeters)} away`
            : [item.activity.bestTime, item.activity.duration].filter(Boolean).join(', ') || null,
        blurb: item.activity.description ?? null,
        where: item.activity.formattedAddress || item.activity.location,
        image: item.activity.imageUrl || null,
        sourceUrl: null,
        directionsUrl: searchLink(
          item.activity.name,
          item.activity.formattedAddress || item.activity.location,
        ),
        Icon: Footprints,
      };
    case 'place':
    default: {
      const place = item.place;
      const facts = [
        place.categoryLabel || place.category,
        place.distance != null ? formatDistance(place.distance) : null,
        place.rating != null
          ? `${place.rating}${place.userRatingsTotal ? ` (${place.userRatingsTotal})` : ''}`
          : null,
      ].filter(Boolean);
      return {
        title: place.name,
        meta: facts.join(', ') || null,
        blurb: null,
        where: place.address || null,
        image: image || null,
        // A place has no site of its own here; the maps entry is the source.
        sourceUrl: null,
        directionsUrl: searchLink(place.name, place.address),
        Icon: MapPin,
      };
    }
  }
}

export default viewOf;
