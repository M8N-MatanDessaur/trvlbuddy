// Service worker — shell + runtime cache.
// Three buckets:
//   trvlbuddy-v5          shell (icons, manifest, fallback document)
//   trvlbuddy-imgs-v1     supabase storage objects (activity photos, avatars) — cache-first, 30d LRU
//   trvlbuddy-rest-v1     supabase REST reads — stale-while-revalidate

const CACHE_NAME = 'trvlbuddy-v6';
// v4 — Android back-gesture aborts in-flight image streams. The browser's
// HTTP cache (sitting below the SW) sometimes persists that partial response;
// the SW's `fetch(request)` then reads the poisoned bytes from browser cache,
// the CORS HEAD probe to origin still returns 200, and we cache the broken
// response for 30 days. Two changes: the GET now uses `cache: 'reload'` to
// bypass the browser HTTP cache, and only validated CORS responses are
// stored — opaque responses are passed straight through. Bumping the name
// evicts the poisoned v3 entries.
const IMG_CACHE = 'trvlbuddy-imgs-v4';
const REST_CACHE = 'trvlbuddy-rest-v1';

const IMG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const IMG_MAX_ENTRIES = 500;
const REST_MAX_ENTRIES = 200;

const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/appicon-192.png',
  '/appicon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([CACHE_NAME, IMG_CACHE, REST_CACHE]);
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !keep.has(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Open (or create) the IndexedDB used to pass shared files to the app
function openShareDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('trvlbuddy-share', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('pending');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storePendingFile(text) {
  return openShareDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').put(text, 'shared-trip');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// ── Runtime-cache helpers ────────────────────────────────────────────────

// Cache-first with TTL. Two failure modes guided this implementation:
//   1. The browser HTTP cache (below the SW) can persist partial bytes from
//      requests aborted mid-stream by Android back-gesture / route changes.
//      We pass `cache: 'reload'` on the upstream GET to bypass it.
//   2. Opaque (no-cors) responses don't expose status, so we can't tell an
//      error from success — a CORS HEAD heuristic was unreliable. The page
//      now sets crossOrigin="anonymous" on every Supabase image, so we
//      receive validated CORS responses here and cache only response.ok.
//      Opaque responses are passed straight through, never persisted.
async function cacheFirstWithExpiry(request, cacheName, maxAgeMs, maxEntries) {
  const cache = await caches.open(cacheName);
  const tsKey = request.url + '#__sw_ts__';
  const cached = await cache.match(request);
  if (cached) {
    const tsResp = await cache.match(tsKey);
    let cachedAt = 0;
    if (tsResp) {
      try { cachedAt = parseInt(await tsResp.clone().text(), 10) || 0; } catch (_) {}
    }
    if (cachedAt > 0 && Date.now() - cachedAt < maxAgeMs) {
      return cached;
    }
    cache.delete(request).catch(() => {});
    cache.delete(tsKey).catch(() => {});
  }
  try {
    // Build a fresh request that bypasses the browser HTTP cache. Using
    // `cache: 'reload'` here prevents reading aborted/partial responses that
    // an earlier navigation may have left in the browser's HTTP cache.
    const upstream = new Request(request, { cache: 'reload' });
    const response = await fetch(upstream);
    const cacheable =
      response &&
      (response.type === 'basic' || response.type === 'cors') &&
      response.ok;
    if (cacheable) {
      cache.put(request, response.clone())
        .then(() => cache.put(tsKey, new Response(String(Date.now()))))
        .then(() => trimCache(cacheName, maxEntries))
        .catch(() => {});
    }
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// Stale-while-revalidate: return cached immediately (if any), kick off a
// background fetch to refresh. Used for Supabase REST GETs so feed / profile
// data pops up instantly from the last visit and updates silently.
async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request.clone()).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone())
        .then(() => trimCache(cacheName, maxEntries))
        .catch(() => {});
    }
    return response;
  }).catch(() => null);
  return cached || (await networkPromise) || Response.error();
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

// ── Fetch router ─────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle Share Target POST: extract the file, store it, redirect to app
  if (url.pathname === '/_share-target' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('trip');
          if (file) {
            const text = await file.text();
            await storePendingFile(text);
          }
        } catch (e) {
          // If anything fails, just redirect to app anyway
        }
        return Response.redirect('/?import=shared', 303);
      })()
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  // ── Supabase cross-origin caching ──────────────────────────────────────
  // Keyed by hostname ending in .supabase.co so any project id matches.
  if (url.hostname.endsWith('.supabase.co')) {
    // Public storage objects (activity photos, avatars): cache-first 30 days.
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      event.respondWith(
        cacheFirstWithExpiry(event.request, IMG_CACHE, IMG_MAX_AGE_MS, IMG_MAX_ENTRIES),
      );
      return;
    }
    // PostgREST reads: stale-while-revalidate. Mutating methods were already
    // filtered above (GET-only handler). Don't touch /auth/* or /realtime/*.
    if (url.pathname.startsWith('/rest/v1/')) {
      event.respondWith(staleWhileRevalidate(event.request, REST_CACHE, REST_MAX_ENTRIES));
      return;
    }
    // Auth / realtime / functions: pass through untouched so live sessions
    // and websockets are never served from cache.
    return;
  }

  // Trip-intelligence read-only APIs: cache aggressively so weather +
  // exchange rates work offline on the trip page. SWR keeps the UI snappy
  // while background revalidation keeps data fresh when online.
  if (url.hostname === 'api.open-meteo.com' || url.hostname === 'open.er-api.com') {
    event.respondWith(staleWhileRevalidate(event.request, REST_CACHE, REST_MAX_ENTRIES));
    return;
  }

  if (url.hostname !== self.location.hostname) return;

  const isHashedAsset = url.pathname.startsWith('/assets/');
  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document';

  // Navigation (HTML document) requests: network first so a fresh index.html
  // with current chunk hashes is served. Fall back to the cached root
  // document when offline.
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const toCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', toCache));
          }
          return response;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed JS/CSS chunks: always from network, never cached (names change
  // per build so a cached copy would point at a file that no longer exists).
  if (isHashedAsset) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Everything else (icons, manifest, fonts, etc.): cache-first.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request.clone()).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        return response;
      });
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Web Push ─────────────────────────────────────────────────────────────
// The server sends a JSON payload (see send-push edge function). We shape
// it into the OS notification + deep-link so the user lands on the right
// screen when they tap.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: 'TravelBuddy', body: event.data.text() };
  }
  const title = payload.title || 'TravelBuddy';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/appicon-192.png',
    badge: '/appicon-192.png',
    tag: payload.tag,
    renotify: true,
    data: { url: payload.url || '/notifications' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
