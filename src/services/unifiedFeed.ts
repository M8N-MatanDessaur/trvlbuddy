import { NearbyPlace } from './nearbyService';
import { LocalEvent } from './liveEventsService';
import { DiscoveryPlace } from './discovery';

/**
 * One feed, several sources.
 *
 * Nearby used to be two separate things: a horizontal strip of events at the
 * top, and a vertical list of places under it. They are the same question --
 * what should I do right now, so they are one stream here, and each item
 * carries a tag saying which kind of answer it is.
 *
 * Sources, all of them free:
 *  - places:      Google Places, already curated and paid for by the cache
 *  - events:      what is on today, from the model with search
 *  - discoveries: Wikipedia and OpenStreetMap, for the things worth seeing
 *                 that no business listing covers, an old city gate, a
 *                 covered market, a basilica
 *
 * Whatever the source, the way out is always Google: every item can produce a
 * maps link and a directions link.
 */
export type FeedItemKind = 'place' | 'event' | 'discovery' | 'trip';

export interface PlaceItem {
  kind: 'place';
  id: string;
  place: NearbyPlace;
}

export interface EventItem {
  kind: 'event';
  id: string;
  event: LocalEvent;
  /**
   * Ticketmaster supplies its own artwork, so an event from there arrives
   * with a picture already attached rather than waiting on a lookup.
   */
  imageUrl?: string | null;
}

export interface DiscoveryItem {
  kind: 'discovery';
  id: string;
  discovery: DiscoveryPlace;
}

/**
 * Something on the trip plan. It comes from a different place than the other
 * three, the trip's own generated list rather than a live search, but it
 * is the same kind of answer to the same question, so it renders as the same
 * page rather than as a card in a carousel.
 */
export interface TripItem {
  kind: 'trip';
  id: string;
  activity: {
    name: string;
    category: string;
    description: string;
    location: string;
    formattedAddress?: string;
    coordinates?: { lat: number; lng: number };
    imageUrl?: string;
    bestTime?: string;
    estimatedCost?: string;
    duration?: string;
    placeId?: string;
  };
  /** How far it is from you, when you are close enough for that to mean
   *  something. Null when planning from home, where a distance is noise. */
  distanceMeters?: number | null;
}

export type FeedItem = PlaceItem | EventItem | DiscoveryItem | TripItem;

/** The label the item wears in the feed, so its kind is never a guess. */
export function tagFor(item: FeedItem): string {
  switch (item.kind) {
    case 'event':
      return 'Happening now';
    case 'discovery':
      return 'Worth seeing';
    case 'trip':
      return 'On your plan';
    case 'place':
      return item.place.openNow === false ? 'Near you' : 'Open now';
  }
}

// How the kinds take turns. Places carry the feed because there are always
// more of them; an event lands early because it is the most perishable thing
// on the screen, and a discovery follows to break up a run of businesses.
// Read as: position in every block of six.
const RHYTHM: FeedItemKind[] = ['event', 'place', 'place', 'discovery', 'place', 'place'];

// On a trip screen the plan comes first: those are the things you decided to
// do, and the live findings are there to fill the gaps between them.
const TRIP_RHYTHM: FeedItemKind[] = ['trip', 'event', 'trip', 'place', 'discovery', 'trip', 'place'];

/**
 * Interleave the sources into one stream.
 *
 * Each kind keeps its own order, places stay in curated order, events stay
 * in the order the model gave them, and the rhythm decides whose turn it is.
 * When a kind runs dry its turns fall to whatever is left, so the feed never
 * stalls waiting for a source and never leaves anything unused.
 */
export function interleaveFeed(
  places: NearbyPlace[],
  events: Array<{ event: LocalEvent; imageUrl?: string | null }>,
  discoveries: DiscoveryPlace[],
  /**
   * The trip plan, when there is one. On a trip screen these lead, because
   * they are the things you decided to do; Nearby's live findings fill in
   * around them.
   */
  tripItems: TripItem[] = [],
): FeedItem[] {
  const queues: Record<FeedItemKind, FeedItem[]> = {
    trip: [...tripItems],
    place: places.map((place) => ({ kind: 'place', id: `place:${place.placeId}`, place })),
    event: events.map(({ event, imageUrl }, i) => ({
      kind: 'event',
      id: `event:${event.name}:${i}`,
      event,
      imageUrl,
    })),
    discovery: discoveries.map((discovery) => ({
      kind: 'discovery',
      id: `discovery:${discovery.id}`,
      discovery,
    })),
  };

  const rhythm = tripItems.length > 0 ? TRIP_RHYTHM : RHYTHM;
  const order: FeedItemKind[] = ['trip', 'place', 'event', 'discovery'];
  const out: FeedItem[] = [];
  const seen = new Set<string>();
  let step = 0;

  const total =
    queues.place.length + queues.event.length + queues.discovery.length + queues.trip.length;
  while (out.length < total) {
    const wanted = rhythm[step % rhythm.length];
    step += 1;

    // Whose turn it is, or the fullest queue still holding something.
    let take = queues[wanted].length > 0 ? wanted : undefined;
    if (!take) {
      take = order
        .filter((kind) => queues[kind].length > 0)
        .sort((a, b) => queues[b].length - queues[a].length)[0];
    }
    if (!take) break;

    const item = queues[take].shift()!;
    // Names repeat across sources: a basilica can be a Google place and a
    // Wikipedia article. Whichever arrives first keeps the slot.
    const fingerprint = nameFingerprint(item);
    if (fingerprint && seen.has(fingerprint)) continue;
    if (fingerprint) seen.add(fingerprint);
    out.push(item);
  }

  return out;
}

function nameFingerprint(item: FeedItem): string | null {
  const name =
    item.kind === 'place'
      ? item.place.name
      : item.kind === 'event'
        ? item.event.name
        : item.kind === 'trip'
          ? item.activity.name
          : item.discovery.name;
  const clean = name
    ?.toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return clean && clean.length > 3 ? clean : null;
}
