import { supabase } from '../lib/supabase';

/**
 * Ticketed events near you: concerts, matches, theatre, comedy.
 *
 * The model-with-search source finds festivals, markets and one-off local
 * happenings but is vague about exact times and often has no link. This is
 * the opposite: fewer kinds of thing, but a real start time, a real venue, an
 * official ticket page, and artwork Ticketmaster supplies itself. Between them
 * the feed covers both the street market and the arena.
 *
 * The key is not here. Everything goes through the ticketmaster edge
 * function, which holds it, requires a session, and shares one grid-snapped
 * cache across everybody, see supabase/functions/ticketmaster/index.ts.
 */
export interface TicketmasterEvent {
  id: string;
  name: string;
  /** "Today, 8:00 PM", "Sat, Sep 13". */
  time: string;
  /** Venue and city on one line. */
  location: string;
  /** "Rock", "Soccer", "Theatre", Ticketmaster's own classification. */
  category: string;
  lat: number | null;
  lng: number | null;
  /** The official event page. Linking back is a condition of the API. */
  url: string;
  imageUrl: string | null;
}

export async function fetchTicketmasterEvents(
  coords: { lat: number; lng: number },
  options: { radiusMiles?: number; signal?: AbortSignal } = {},
): Promise<TicketmasterEvent[]> {
  try {
    const { data, error } = await supabase.functions.invoke('ticketmaster', {
      body: {
        lat: coords.lat,
        lng: coords.lng,
        radiusMiles: options.radiusMiles ?? 30,
      },
    });
    if (error) return [];
    const events = (data as { events?: unknown })?.events;
    if (!Array.isArray(events)) return [];
    // The function already trimmed the payload; this is belt and braces
    // against a shape change upstream.
    return events.filter(
      (e): e is TicketmasterEvent =>
        Boolean(e) && typeof (e as TicketmasterEvent).name === 'string' &&
        typeof (e as TicketmasterEvent).url === 'string',
    );
  } catch {
    // One source being unavailable is not a broken feed.
    return [];
  }
}
