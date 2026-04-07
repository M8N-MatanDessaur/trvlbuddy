export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

let cachedLocation: UserLocation | null = null;
let watchId: number | null = null;

export function getCurrentLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        cachedLocation = loc;
        resolve(loc);
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export function startWatchingLocation(onUpdate: (loc: UserLocation) => void): void {
  if (!navigator.geolocation || watchId !== null) return;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const loc: UserLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      };
      cachedLocation = loc;
      onUpdate(loc);
    },
    () => {},
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 }
  );
}

export function stopWatchingLocation(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export function getCachedLocation(): UserLocation | null {
  return cachedLocation;
}

// --- Location context detection ---

export type NearbyContext =
  | 'hotel'
  | 'restaurant-area'
  | 'transit'
  | 'tourist-area'
  | 'unknown';

interface Coords {
  lat: number;
  lng: number;
}

/** Haversine distance in meters between two lat/lng points. */
function haversineMeters(a: Coords, b: Coords): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Infer what kind of area the user is in based on their coordinates
 * and known accommodation positions. This is a simple heuristic:
 *  - Within 200m of accommodation -> "hotel"
 *  - Otherwise -> "unknown" (pages can refine with Places API later)
 */
export function getLocationContext(
  userCoords: Coords,
  accommodationCoords: Coords[],
): NearbyContext {
  for (const acc of accommodationCoords) {
    if (haversineMeters(userCoords, acc) < 200) {
      return 'hotel';
    }
  }
  return 'unknown';
}

export { haversineMeters };
