// Shared Google Places helpers used by trip-generation enrichment AND the
// Map tab's on-the-fly fallback. Far more accurate than Photon at matching a
// named place ("Tim Hortons", "Gyeongbokgung Palace") to the right city.

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export interface GooglePlaceHit {
  place_id: string;
  lat: number;
  lng: number;
  formatted_address?: string;
}

export interface FindPlaceOptions {
  // Bias the search to a coordinate + radius. Typical use: pass the trip's
  // city center so the query is anchored to the right region.
  near?: { lat: number; lng: number; radiusMeters?: number };
}

/**
 * Find Place from Text (basic SKU, $17 / 1K). Returns the first candidate or
 * null. We bias to a location when given so a name that exists in many
 * countries (chains, common words) lands in the right one.
 */
export async function findPlaceFromText(
  query: string,
  options: FindPlaceOptions = {},
): Promise<GooglePlaceHit | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    input: trimmed,
    inputtype: 'textquery',
    fields: 'place_id,geometry,formatted_address',
    key: GOOGLE_PLACES_API_KEY,
  });
  if (options.near) {
    const radius = options.near.radiusMeters ?? 50000; // 50km default
    params.set('locationbias', `circle:${radius}@${options.near.lat},${options.near.lng}`);
  }

  try {
    // Route through the Netlify proxy /api/places/* (defined in netlify.toml)
    // so the call doesn't hit Google directly from the browser -- Google's
    // legacy Places API doesn't send CORS headers, so direct calls fail.
    const url = `/api/places/findplacefromtext/json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[places] findPlace HTTP', res.status, 'for', query);
      return null;
    }
    const data: {
      status?: string;
      error_message?: string;
      candidates?: Array<{
        place_id?: string;
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    } = await res.json();
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[places] findPlace status', data.status, data.error_message || '', 'for', query);
    }
    const cand = data.candidates?.[0];
    if (!cand?.place_id || !cand.geometry?.location) return null;
    return {
      place_id: cand.place_id,
      lat: cand.geometry.location.lat,
      lng: cand.geometry.location.lng,
      formatted_address: cand.formatted_address,
    };
  } catch (err) {
    console.error('[places] findPlace failed for', query, err);
    return null;
  }
}

/**
 * Text Search ($32 / 1K) -- more permissive than Find Place, better at
 * matching descriptive AI-generated names ("Cozy cafe near Han River") to
 * real places. Use as a fallback after findPlaceFromText returns null.
 */
export async function searchPlaceByText(
  query: string,
  options: FindPlaceOptions = {},
): Promise<GooglePlaceHit | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    query: trimmed,
    key: GOOGLE_PLACES_API_KEY,
  });
  if (options.near) {
    const radius = options.near.radiusMeters ?? 50000;
    params.set('location', `${options.near.lat},${options.near.lng}`);
    params.set('radius', String(radius));
  }

  try {
    const url = `/api/places/textsearch/json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[places] textSearch HTTP', res.status, 'for', query);
      return null;
    }
    const data: {
      status?: string;
      error_message?: string;
      results?: Array<{
        place_id?: string;
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    } = await res.json();
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[places] textSearch status', data.status, data.error_message || '', 'for', query);
    }
    const hit = data.results?.[0];
    if (!hit?.place_id || !hit.geometry?.location) return null;
    return {
      place_id: hit.place_id,
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      formatted_address: hit.formatted_address,
    };
  } catch (err) {
    console.error('[places] textSearch failed for', query, err);
    return null;
  }
}
