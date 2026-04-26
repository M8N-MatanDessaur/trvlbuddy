import { supabase } from '../lib/supabase';
import type { NearbyPlace } from './nearbyService';
import { iconForPrimaryType } from './nearbyService';
import { haversineMeters, type UserLocation } from '../utils/geolocation';

// The Database type isn't regenerated yet, so we hand-shape the row.
// Column set mirrors supabase/migrations/20260425_user_saved_places.sql.
export interface SavedPlaceRow {
  user_id: string;
  place_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  primary_type: string | null;
  primary_type_label: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  price_level: number | null;
  saved_at: string;
}

const TABLE = 'user_saved_places';

function rowFromPlace(userId: string, place: NearbyPlace): Omit<SavedPlaceRow, 'saved_at'> {
  return {
    user_id: userId,
    place_id: place.placeId,
    name: place.name,
    address: place.address || null,
    lat: place.location.lat,
    lng: place.location.lng,
    primary_type: place.category || null,
    primary_type_label: place.categoryLabel || null,
    rating: place.rating ?? null,
    user_ratings_total: place.userRatingsTotal ?? null,
    price_level: place.priceLevel ?? null,
  };
}

// Build a NearbyPlace from a saved row + the user's current location so the
// Saved view renders the same card UI as the live feed. Distance is computed
// against the active user location -- a saved place across the world will
// surface its true distance when you reopen the app on the road.
export function placeFromSavedRow(row: SavedPlaceRow, userLocation: UserLocation | null): NearbyPlace {
  const lat = row.lat ?? userLocation?.lat ?? 0;
  const lng = row.lng ?? userLocation?.lng ?? 0;
  const distance = userLocation
    ? haversineMeters(userLocation, { lat, lng })
    : 0;
  return {
    placeId: row.place_id,
    name: row.name,
    category: row.primary_type || 'place',
    categoryLabel: row.primary_type_label || 'Place',
    categoryIcon: iconForPrimaryType(row.primary_type || undefined, []),
    address: row.address || '',
    location: { lat, lng },
    distance,
    rating: row.rating ?? undefined,
    userRatingsTotal: row.user_ratings_total ?? undefined,
    priceLevel: row.price_level ?? undefined,
    openNow: undefined,
    imageUrls: [],
  };
}

export async function listSavedPlaces(userId: string): Promise<SavedPlaceRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) {
    console.error('listSavedPlaces failed', error);
    return [];
  }
  return (data || []) as SavedPlaceRow[];
}

export async function listSavedPlaceIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('place_id')
    .eq('user_id', userId);
  if (error) {
    console.error('listSavedPlaceIds failed', error);
    return new Set();
  }
  const set = new Set<string>();
  for (const row of data || []) {
    set.add(row.place_id);
  }
  return set;
}

export async function savePlace(userId: string, place: NearbyPlace): Promise<{ ok: boolean; error?: string }> {
  const row = rowFromPlace(userId, place);
  // upsert so re-tapping save on a place we already have refreshes the
  // snapshot (rating may have changed since the original save).
  const { error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id,place_id' });
  if (error) {
    console.error('savePlace failed', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function unsavePlace(userId: string, placeId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('place_id', placeId);
  if (error) {
    console.error('unsavePlace failed', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
