import { supabase } from './supabase';

// The one way the client asks about places.
//
// There used to be a VITE_GOOGLE_PLACES_API_KEY here and thirteen call sites
// fetching Google directly (some via Netlify redirects, which hid the URL but
// not the key). Vite inlines every VITE_ variable into the shipped bundle, so
// the key was public and unrestricted: anyone could read it off the site and
// spend the budget. The same arrangement billed Google per user per action
// with only per-browser localStorage in front of it, which is how a $500 day
// happens.
//
// Now: one edge function holds the key, requires a session, enforces a
// per-user quota, and reads a shared cache first. A lookup one person paid for
// serves everybody.

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/places`;

export type PlacesOp =
  | 'textsearch' | 'nearbysearch' | 'details' | 'findplace'
  | 'autocomplete' | 'geocode' | 'searchText' | 'searchNearby';

export class PlacesQuotaError extends Error {
  constructor(message: string) { super(message); this.name = 'PlacesQuotaError'; }
}
export class PlacesAuthError extends Error {
  constructor(message: string) { super(message); this.name = 'PlacesAuthError'; }
}

/**
 * Call a whitelisted Google Places / Geocoding operation through the proxy.
 * Returns Google's response body unchanged, so call sites keep reading
 * `data.results`, `data.result`, `data.places` exactly as before.
 *
 * Parameters not on the operation's allow-list are dropped server side. In
 * particular `fields` and `key` are never accepted from here: the field list
 * decides the price of a details call, so the server owns it.
 */
export async function placesCall<T = unknown>(
  op: PlacesOp,
  params: Record<string, unknown>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new PlacesAuthError('Sign in to search for places');
  }

  const response = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ op, params }),
    signal: options.signal,
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    throw new PlacesQuotaError(body.error || 'You have reached the lookup limit for now.');
  }
  if (response.status === 401) {
    throw new PlacesAuthError('Your session expired. Sign in again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Place lookup failed (${response.status})`);
  }

  const { payload } = await response.json();
  return payload as T;
}

/**
 * Same as placesCall but resolves to null instead of throwing, for the many
 * call sites that already treat "no result" as an ordinary outcome and should
 * not break the screen when a lookup is unavailable or over quota.
 */
export async function placesCallSafe<T = unknown>(
  op: PlacesOp,
  params: Record<string, unknown>,
  options: { signal?: AbortSignal } = {},
): Promise<T | null> {
  try {
    return await placesCall<T>(op, params, options);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    console.warn(`places ${op} unavailable:`, (err as Error)?.message);
    return null;
  }
}
