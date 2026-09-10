import { supabase } from '../lib/supabase';

/**
 * Default images for locations, from the app's own library.
 *
 * This used to ask Wikipedia from the browser and remember the answers in
 * localStorage. That meant every visitor repeated the same lookups, nothing
 * accumulated, and clearing site data put the app back to knowing nothing
 * about anywhere.
 *
 * Now it asks the place-images function, which answers from our own table and
 * only goes out to a source for locations nobody has ever looked up, then
 * writes what it finds back, negatives included. One person's lookup serves
 * everybody, permanently.
 *
 * localStorage is still here, but only as a paint-fast layer: it holds what
 * this browser has already been told so a returning view draws immediately
 * instead of waiting on a round trip. The library is the truth.
 *
 * This is only the DEFAULT image. Photos people have posted live in
 * activity_images and always win, callers prefer those and never ask here
 * for a location that already has media.
 */

const CACHE_KEY = 'tb:place-images:v2';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const DECODE_TIMEOUT_MS = 6000;
const MAX_PER_CALL = 60;

interface CacheEntry {
  u: string;
  t: number;
}

let memory: Record<string, CacheEntry> | null = null;

function readCache(): Record<string, CacheEntry> {
  if (memory) return memory;
  memory = {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
      const fresh = Date.now() - CACHE_TTL_MS;
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v.t === 'number' && v.t > fresh && typeof v.u === 'string') memory[k] = v;
      }
    }
  } catch {
    // Private window, cleared data, storage disabled: an empty local layer is
    // correct, and the library still answers.
  }
  return memory;
}

function writeCache(): void {
  if (!memory) return;
  try {
    let entries = Object.entries(memory);
    if (entries.length > CACHE_MAX_ENTRIES) {
      entries = entries.sort((a, b) => b[1].t - a[1].t).slice(0, CACHE_MAX_ENTRIES);
      memory = Object.fromEntries(entries);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(memory));
  } catch {
    // Over quota or unwritable; the in-memory copy still serves this session.
  }
}

/** Load and decode, so a card is only ever handed an image it can paint at
 *  once, never a half-drawn frame. */
function preload(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), DECODE_TIMEOUT_MS);
    const done = (ok: boolean) => {
      clearTimeout(timer);
      finish(ok);
    };
    image.onload = () => {
      if (typeof image.decode === 'function') {
        image.decode().then(() => done(true), () => done(true));
      } else {
        done(true);
      }
    };
    image.onerror = () => done(false);
    image.src = url;
  });
}

const decoded = new Set<string>();

export interface ImageRequest {
  /** Whatever the caller keys its own state by. */
  key: string;
  /**
   * The location's stable id, the same slug activities uses, so a default
   * image and the photos people post share one identity.
   */
  locationId: string;
  /** Names to try, best first: the venue, then the thing's own name. */
  names: Array<string | undefined | null>;
  lat?: number | null;
  lng?: number | null;
}

export interface ResolveOptions {
  signal?: AbortSignal;
  /** Called as each image is ready, so cards fill in as they arrive. */
  onImage?: (key: string, url: string) => void;
}

export async function resolveImages(
  requests: ImageRequest[],
  options: ResolveOptions = {},
): Promise<Record<string, string>> {
  const { signal, onImage } = options;
  if (requests.length === 0) return {};

  const wanted = requests
    .filter((r) => r.locationId && r.names.some((n) => n && n.trim().length >= 4))
    .slice(0, MAX_PER_CALL);
  if (wanted.length === 0) return {};

  const cache = readCache();
  const resolved: Record<string, string> = {};

  // 1. Anything this browser already knows, painted immediately.
  const unknown: typeof wanted = [];
  for (const r of wanted) {
    const hit = cache[r.locationId];
    if (hit?.u) {
      resolved[r.key] = hit.u;
      onImage?.(r.key, hit.u);
    } else {
      unknown.push(r);
    }
  }
  if (unknown.length === 0) return resolved;

  // 2. The library, for the rest.
  let images: Record<string, string> = {};
  try {
    const { data, error } = await supabase.functions.invoke('place-images', {
      body: {
        locations: unknown.map((r) => ({
          locationId: r.locationId,
          names: r.names.filter((n): n is string => Boolean(n && n.trim())),
          lat: r.lat ?? undefined,
          lng: r.lng ?? undefined,
        })),
      },
    });
    if (error) return resolved;
    const got = (data as { images?: unknown })?.images;
    if (got && typeof got === 'object') images = got as Record<string, string>;
  } catch {
    // One source unavailable is not a broken feed; the posters stand in.
    return resolved;
  }
  if (signal?.aborted) return resolved;

  // 3. Decode before handing over, and remember locally for next time.
  await Promise.all(
    unknown.map(async (r) => {
      const url = images[r.locationId];
      if (!url) return;
      if (!decoded.has(url)) {
        const ok = await preload(url);
        if (signal?.aborted || !ok) return;
        decoded.add(url);
      }
      cache[r.locationId] = { u: url, t: Date.now() };
      resolved[r.key] = url;
      onImage?.(r.key, url);
    }),
  );
  writeCache();

  return resolved;
}
