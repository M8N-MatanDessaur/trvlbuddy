import type { UserLocation } from '../utils/geolocation';
import { haversineMeters } from '../utils/geolocation';
import type { GeneratedActivity } from '../types/TravelData';

export interface LocationPing {
  lat: number;
  lng: number;
  timestamp: number;
}

const STORAGE_PREFIX = 'trvlbuddy-lochistory-';

function todayKey(): string {
  return STORAGE_PREFIX + new Date().toISOString().slice(0, 10);
}

/** Record a location ping for today. Called from the geolocation watcher. */
export function recordLocationPing(loc: UserLocation): void {
  const key = todayKey();
  const existing: LocationPing[] = JSON.parse(localStorage.getItem(key) || '[]');

  // Deduplicate: skip if last ping was less than 2 minutes ago and less than 50m away
  const last = existing[existing.length - 1];
  if (last) {
    const timeDiff = loc.timestamp - last.timestamp;
    const distDiff = haversineMeters(
      { lat: last.lat, lng: last.lng },
      { lat: loc.lat, lng: loc.lng },
    );
    if (timeDiff < 120_000 && distDiff < 50) return;
  }

  existing.push({ lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp });
  localStorage.setItem(key, JSON.stringify(existing));
}

/** Get all location pings for a specific date (YYYY-MM-DD). */
export function getLocationHistory(date: string): LocationPing[] {
  return JSON.parse(localStorage.getItem(STORAGE_PREFIX + date) || '[]');
}

/** Get today's location pings. */
export function getTodayHistory(): LocationPing[] {
  return JSON.parse(localStorage.getItem(todayKey()) || '[]');
}

/** Calculate total distance walked in kilometers from a series of pings. */
export function calculateDistanceWalked(pings: LocationPing[]): number {
  if (pings.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pings.length; i++) {
    total += haversineMeters(pings[i - 1], pings[i]);
  }
  return total / 1000; // Convert to km
}

/**
 * Match location pings against known activity locations to determine
 * which places the user likely visited. Uses a 300m proximity threshold.
 */
export function extractPlacesVisited(
  pings: LocationPing[],
  activities: GeneratedActivity[],
  activityCoords: Map<string, { lat: number; lng: number }>,
): string[] {
  const visited = new Set<string>();
  for (const ping of pings) {
    for (const [name, coords] of activityCoords) {
      if (haversineMeters(ping, coords) < 300) {
        visited.add(name);
      }
    }
  }
  return [...visited];
}

/** Get all dates that have location history data. */
export function getHistoryDates(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      dates.push(key.replace(STORAGE_PREFIX, ''));
    }
  }
  return dates.sort();
}
