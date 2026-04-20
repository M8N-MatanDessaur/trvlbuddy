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
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: {
      status?: string;
      candidates?: Array<{
        place_id?: string;
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    } = await res.json();
    const cand = data.candidates?.[0];
    if (!cand?.place_id || !cand.geometry?.location) return null;
    return {
      place_id: cand.place_id,
      lat: cand.geometry.location.lat,
      lng: cand.geometry.location.lng,
      formatted_address: cand.formatted_address,
    };
  } catch (err) {
    console.error('findPlaceFromText failed for', query, err);
    return null;
  }
}
