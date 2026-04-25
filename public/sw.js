// Service worker — shell + runtime cache.
// Three buckets:
//   trvlbuddy-v6          shell (icons, manifest, fallback document)
//   trvlbuddy-imgs-v5     supabase storage objects (activity photos, avatars) — stale-while-revalidate
//   trvlbuddy-rest-v1     supabase REST reads — stale-while-revalidate

const CACHE_NAME = 'trvlbuddy-v6';
// v5 — switched from cache-first-with-TTL to stale-while-revalidate for
// images. The previous strategy had a race in the expiry path: cache.delete
// and cache.put both ran fire-and-forget, so on slow Android devices the
// delete could resolve after the put and silently remove a fresh entry. It
// also had no cached fallback when the SW's own re-fetch failed (mobile
// network blip, SW killed while backgrounded), leaving users with a broken
// icon that survived reloads. SWR returns the cached entry immediately and
// refreshes in the background, so a transient fetch failure can't break a
// previously-working image. The page can also send {type:'PURGE_IMAGE',url}
// to evict a known-bad entry on its own. Bumping the name evicts v4.
const IMG_CACHE = 'trvlbuddy-imgs-v5';
const REST_CACHE = 'trvlbuddy-rest-v1';

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

// Stale-while-revalidate. Returns the cached response immediately (if any)
// and refreshes it in the background. Image fetches use this so a transient
// network failure or an SW termination mid-revalidate can never turn a
// previously-working image into a broken icon — the cached copy keeps
// serving until a fresh response fully replaces it.
//
// Caching contract: only basic/cors responses with response.ok are stored.
// Opaque responses pass through untouched. The page sets
// crossOrigin="anonymous" on every Supabase image so we always see a
// typed CORS response we can validate.
//
// The cache.put is awaited inside the background revalidation so the put
// either fully completes or the entry is left untouched — no half-written
// entries that masquerade as valid on a later read.
async function staleWhileRevalidate(request, cacheName, maxEntries, { requireOk = true } = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request.clone()).then(async (response) => {
    const cacheable =
      response &&
      (response.type === 'basic' || response.type === 'cors') &&
      (!requireOk || response.ok);
    if (cacheable) {
      try {
        await cache.put(request, response.clone());
        await trimCache(cacheName, maxEntries);
      } catch (_) {}
    }
    return response;
  }).catch(() => null);
  if (cached) return cached;
  const network = await networkPromise;
  return network || Response.error();
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
    // Public storage objects (activity photos, avatars): stale-while-
    // revalidate so a previously-loaded image keeps serving even if the
    // background refresh fails. Bad entries can be evicted by the page via
    // a {type:'PURGE_IMAGE',url} message.
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      event.respondWith(
        staleWhileRevalidate(event.request, IMG_CACHE, IMG_MAX_ENTRIES),
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
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  // Page-driven eviction. When an <img> errors against a cached entry the
  // page asks the SW to drop it before re-requesting, so the next fetch
  // bypasses the bad cached body and the freshly-fetched response replaces
  // it on success.
  if (event.data.type === 'PURGE_IMAGE' && typeof event.data.url === 'string') {
    const url = event.data.url;
    event.waitUntil(
      caches.open(IMG_CACHE).then((cache) => cache.delete(url)).catch(() => {}),
    );
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
