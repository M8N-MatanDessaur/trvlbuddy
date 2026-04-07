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
