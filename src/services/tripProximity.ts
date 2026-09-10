/**
 * Are you actually there?
 *
 * A trip screen is used in two completely different situations, and pretending
 * otherwise is what makes it feel wrong in one of them:
 *
 *   - You are in the city. Then everything Nearby does applies: distances are
 *     real, "open now" means something, and what is happening tonight matters.
 *   - You are at home planning. Then "480 m away" is a lie, "open now" is
 *     noise, and what matters is what the place is, not how far.
 *
 * So the screen asks the question first and says which mode it is in, rather
 * than showing the same card and hoping.
 */

export type Presence = 'here' | 'in-region' | 'away' | 'unknown';

/** Inside this and you are in the city, for any practical purpose. */
const HERE_KM = 40;
/** Inside this and you are close enough for a day trip. */
const REGION_KM = 250;

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ProximityResult {
  presence: Presence;
  /** Kilometres from where you are to the destination, when both are known. */
  km: number | null;
}

export function checkProximity(
  userLocation: { lat: number; lng: number } | null | undefined,
  destination: { lat: number; lng: number } | null | undefined,
): ProximityResult {
  if (!userLocation || !destination) return { presence: 'unknown', km: null };
  const km = distanceKm(userLocation, destination);
  if (km <= HERE_KM) return { presence: 'here', km };
  if (km <= REGION_KM) return { presence: 'in-region', km };
  return { presence: 'away', km };
}

/** How far away, said the way a person would say it. */
export function describeDistance(km: number): string {
  if (km < 1) return 'a few minutes away';
  if (km < 10) return `${Math.round(km)} km away`;
  if (km < 100) return `${Math.round(km)} km away`;
  if (km < 1000) return `${Math.round(km / 10) * 10} km away`;
  return `${(km / 1000).toFixed(1).replace(/\.0$/, '')} thousand km away`;
}

/**
 * The line the trip screen leads with. It has to be honest about which mode
 * the screen is in, because everything below it reads differently depending
 * on the answer.
 */
export function describePresence(
  result: ProximityResult,
  destinationName: string | null,
): string {
  const where = destinationName || 'your destination';
  switch (result.presence) {
    case 'here':
      return `You are in ${where}`;
    case 'in-region':
      return `${describeDistance(result.km ?? 0)} from ${where}`;
    case 'away':
      return `Planning ${where}, ${describeDistance(result.km ?? 0)}`;
    default:
      return where;
  }
}
