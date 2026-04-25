// open-meteo.com — no API key, generous rate limits, documented at
// https://open-meteo.com/en/docs. We request the 7-day forecast and
// cache each (lat, lng) request in localStorage for six hours so a trip
// open/close cycle doesn't hammer the endpoint.

const CACHE_PREFIX = 'trvlbuddy-weather:';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface DailyForecast {
  date: string;          // YYYY-MM-DD
  tempMaxC: number;
  tempMinC: number;
  precipChance: number;  // 0-100
  weatherCode: number;   // WMO code
}

export interface WeatherSnapshot {
  fetchedAt: number;
  lat: number;
  lng: number;
  current: {
    tempC: number;
    weatherCode: number;
    windKph: number;
  } | null;
  daily: DailyForecast[];
}

function cacheKey(lat: number, lng: number): string {
  const round = (n: number) => n.toFixed(2);
  return `${CACHE_PREFIX}${round(lat)},${round(lng)}`;
}

function readCache(lat: number, lng: number): WeatherSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(lat, lng));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherSnapshot;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(snapshot: WeatherSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cacheKey(snapshot.lat, snapshot.lng), JSON.stringify(snapshot));
  } catch {
    // Quota exceeded — best-effort.
  }
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  const cached = readCache(lat, lng);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: 'temperature_2m,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'auto',
    forecast_days: '7',
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const body = await res.json();

    const dailyTimes: string[] = body.daily?.time || [];
    const dailyMax: number[] = body.daily?.temperature_2m_max || [];
    const dailyMin: number[] = body.daily?.temperature_2m_min || [];
    const dailyPrecip: number[] = body.daily?.precipitation_probability_max || [];
    const dailyCode: number[] = body.daily?.weather_code || [];

    const snapshot: WeatherSnapshot = {
      fetchedAt: Date.now(),
      lat,
      lng,
      current: body.current
        ? {
            tempC: Math.round(body.current.temperature_2m ?? 0),
            weatherCode: body.current.weather_code ?? 0,
            windKph: Math.round(body.current.wind_speed_10m ?? 0),
          }
        : null,
      daily: dailyTimes.map((date, i) => ({
        date,
        tempMaxC: Math.round(dailyMax[i] ?? 0),
        tempMinC: Math.round(dailyMin[i] ?? 0),
        precipChance: Math.round(dailyPrecip[i] ?? 0),
        weatherCode: dailyCode[i] ?? 0,
      })),
    };

    writeCache(snapshot);
    return snapshot;
  } catch (err) {
    console.warn('fetchWeather failed', err);
    return null;
  }
}

// WMO codes → friendly label + lucide icon name (string — resolver in UI).
export function describeWeatherCode(code: number): { label: string; icon: 'sun' | 'cloud' | 'cloud-rain' | 'cloud-snow' | 'cloud-fog' } {
  if (code === 0) return { label: 'Clear', icon: 'sun' };
  if (code <= 3) return { label: 'Partly cloudy', icon: 'cloud' };
  if (code <= 49) return { label: 'Foggy', icon: 'cloud-fog' };
  if (code <= 69) return { label: 'Rainy', icon: 'cloud-rain' };
  if (code <= 79) return { label: 'Snowy', icon: 'cloud-snow' };
  if (code <= 99) return { label: 'Thunderstorms', icon: 'cloud-rain' };
  return { label: 'Cloudy', icon: 'cloud' };
}
