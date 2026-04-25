// open.er-api.com — free, no API key, CORS-friendly, ~160 currencies from
// ECB + fallbacks. We fetch the full table once per 24h keyed on the base
// currency so every (base -> target) pair is served from the same cache
// entry. exchangerate.host used to work keyless but now requires an API
// key, which is why we switched.

const CACHE_PREFIX = 'trvlbuddy-fx:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ExchangeRates {
  base: string;
  fetchedAt: number;
  rates: Record<string, number>;
}

function readCache(base: string): ExchangeRates | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + base.toUpperCase());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExchangeRates;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rates: ExchangeRates): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + rates.base, JSON.stringify(rates));
  } catch {
    // Quota exceeded — best-effort.
  }
}

export async function fetchRates(base: string): Promise<ExchangeRates | null> {
  const upper = base.toUpperCase();
  const cached = readCache(upper);
  if (cached) return cached;

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${upper}`);
    if (!res.ok) throw new Error(`open.er-api.com ${res.status}`);
    const body = await res.json();
    if (body.result !== 'success' || !body.rates) throw new Error('No rates returned');
    const snapshot: ExchangeRates = {
      base: upper,
      fetchedAt: Date.now(),
      rates: body.rates,
    };
    writeCache(snapshot);
    return snapshot;
  } catch (err) {
    console.warn('fetchRates failed', err);
    return null;
  }
}

export function convert(amount: number, rates: ExchangeRates, target: string): number | null {
  const rate = rates.rates[target.toUpperCase()];
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;
  return amount * rate;
}

// Best-effort guess at the user's home currency from browser locale. Only
// used as a default — the UI should let them override.
export function guessHomeCurrency(): string {
  if (typeof navigator === 'undefined') return 'USD';
  try {
    const region = (navigator.language || 'en-US').split('-')[1] || 'US';
    const MAP: Record<string, string> = {
      US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD',
      JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', BR: 'BRL',
      MX: 'MXN', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
      PL: 'PLN', CZ: 'CZK', HU: 'HUF', RU: 'RUB', TR: 'TRY',
      ZA: 'ZAR', SG: 'SGD', HK: 'HKD', TH: 'THB', ID: 'IDR',
      PH: 'PHP', VN: 'VND', AE: 'AED', IL: 'ILS', SA: 'SAR',
    };
    // Default EU + EEA to EUR.
    const EUR = new Set(['FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'PT', 'IE', 'GR', 'AT', 'FI', 'LU', 'EE', 'LV', 'LT', 'SK', 'SI', 'MT', 'CY', 'HR']);
    if (EUR.has(region)) return 'EUR';
    return MAP[region] || 'USD';
  } catch {
    return 'USD';
  }
}
