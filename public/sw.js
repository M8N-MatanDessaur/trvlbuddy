const CACHE_NAME = 'trvlbuddy-v4';
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
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
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

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.hostname !== self.location.hostname) return;

  const isHashedAsset = url.pathname.startsWith('/assets/');
  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document';

  // Navigation (HTML document) requests: always go to network first so a
  // fresh index.html with current chunk hashes is served. Fall back to the
  // cached root document only when offline.
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
