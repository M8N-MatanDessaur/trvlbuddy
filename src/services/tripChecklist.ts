import { supabase } from '../lib/supabase';

/**
 * The trip's own list, shared by everyone on it.
 *
 * Explore reads from trip_activities rather than from the plan blob in local
 * state, for one reason: a trip has more than one person on it. The rows are
 * the shared truth, category, which city, and whether somebody has ticked
 * it off, so two people looking at the same trip see the same list, and a
 * tick by one is a tick for both.
 */
export interface TripActivityRow {
  id: string;
  trip_id: string;
  name: string;
  category: string | null;
  description: string | null;
  estimated_cost: string | null;
  duration: string | null;
  best_time: string | null;
  location: string | null;
  tips: string | null;
  destination_id: string | null;
  city_id: string | null;
  google_place_id: string | null;
  done_at: string | null;
  done_by: string | null;
}

const COLUMNS =
  'id, trip_id, name, category, description, estimated_cost, duration, best_time, location, tips, destination_id, city_id, google_place_id, done_at, done_by';

export async function listTripActivities(tripId: string): Promise<TripActivityRow[]> {
  const { data, error } = await supabase
    .from('trip_activities')
    .select(COLUMNS)
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as unknown as TripActivityRow[];
}

/**
 * Tick something off, or un-tick it.
 *
 * done_at is both the flag and the timestamp, and done_by records who, so the
 * list can say "Sara ticked this off" rather than implying it happened by
 * itself. The trip's existing UPDATE policy already limits this to members of
 * the trip, which is the right rule: you are doing this together.
 */
export async function setTripActivityDone(
  activityId: string,
  done: boolean,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('trip_activities')
    .update(
      (done
        ? { done_at: new Date().toISOString(), done_by: userId }
        : { done_at: null, done_by: null }) as never,
    )
    .eq('id', activityId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * The places this trip covers, in the order they appear.
 *
 * Taken from the rows rather than declared anywhere: a trip that turns out to
 * be Seoul and Busan should offer Seoul and Busan, without anyone having to
 * maintain a second list of what the trip contains.
 */
export interface TripPlace {
  /** city_id when there is one, else the location string. */
  key: string;
  label: string;
  count: number;
  doneCount: number;
}

export function placesOnTrip(rows: TripActivityRow[]): TripPlace[] {
  const map = new Map<string, TripPlace>();
  for (const row of rows) {
    // A city id is stable; a location string is what a person recognises.
    // Group by the id when present so two spellings do not split a city.
    const key = row.city_id || row.location || row.destination_id || 'unknown';
    const label = cityLabel(row) || 'Elsewhere';
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (row.done_at) existing.doneCount += 1;
    } else {
      map.set(key, { key, label, count: 1, doneCount: row.done_at ? 1 : 0 });
    }
  }
  return [...map.values()];
}

/**
 * A recognisable name for where an activity is.
 *
 * The location field is often a full address or a neighbourhood plus a city,
 * so the leading part before a comma is usually the useful half.
 */
function cityLabel(row: TripActivityRow): string | null {
  const source = row.location || row.city_id || row.destination_id;
  if (!source) return null;
  const parts = source.split(',').map((p) => p.trim()).filter(Boolean);
  // "Gwangjang Market, Jongno-gu, Seoul" -> "Seoul": the last part is the
  // city far more often than the first is.
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

/**
 * The categories present on this trip, so the filter offers what actually
 * exists rather than a fixed menu with dead entries.
 */
export function categoriesOnTrip(rows: TripActivityRow[]): Array<{ key: string; label: string; count: number }> {
  const map = new Map<string, { key: string; label: string; count: number }>();
  for (const row of rows) {
    const raw = (row.category || 'other').toLowerCase().trim();
    const existing = map.get(raw);
    if (existing) existing.count += 1;
    else map.set(raw, { key: raw, label: titleCase(raw), count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
