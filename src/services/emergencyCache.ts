import type { EmergencyContact } from '../types/TravelData';
import { haversineMeters, type UserLocation } from '../utils/geolocation';

const CACHE_KEY = 'emergency-contacts-cache-v1';
// Emergency contacts are country-scoped and essentially static. We only
// re-fetch when the user has clearly crossed into a different region --
// ~300 km covers intra-country movement (Montreal <-> Quebec City, across
// a metro area, etc.) without triggering a refetch.
const MOVEMENT_THRESHOLD_METERS = 300_000;

export interface CachedEmergency {
  countryCode: string;
  countryName: string;
  contacts: EmergencyContact[];
  lat: number;
  lng: number;
  fetchedAt: number;
}

export function readEmergencyCache(): CachedEmergency | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEmergency;
    if (!parsed.countryCode || !parsed.contacts) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeEmergencyCache(entry: CachedEmergency): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // storage full / disabled — fail silently
  }
}

export function clearEmergencyCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function canReuseCache(cache: CachedEmergency | null, loc: UserLocation): boolean {
  if (!cache) return false;
  const dist = haversineMeters({ lat: cache.lat, lng: cache.lng }, loc);
  return dist < MOVEMENT_THRESHOLD_METERS;
}
