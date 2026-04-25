// Ask the service worker to evict a cached image entry. Used by image
// components on error: after the SW drops the bad entry, re-mounting the
// <img> with the same src triggers a fresh fetch that fully replaces it.
// Falls back silently when there's no SW (browser, dev preview, etc.) —
// the remount alone is enough since there's nothing to purge.
export function purgeCachedImage(url: string): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;
  try {
    controller.postMessage({ type: 'PURGE_IMAGE', url });
  } catch (_) {}
}
