// Fire-and-forget browser HTTP-cache warmer. Creating a detached Image and
// assigning its src kicks off a normal fetch — the bytes land in the disk
// cache so the next <img> with the same URL paints instantly. We also hold a
// short-lived reference to the element until load/error to guarantee the
// request survives garbage collection.

const warmed = new Set<string>();
const inFlight = new Set<string>();
const pool = new Set<HTMLImageElement>();

export function warmImageCache(urls: Iterable<string | null | undefined>): void {
  if (typeof window === 'undefined') return;
  for (const url of urls) {
    if (!url || warmed.has(url) || inFlight.has(url)) continue;
    inFlight.add(url);
    const img = new Image();
    pool.add(img);
    const onSuccess = () => {
      warmed.add(url);
      inFlight.delete(url);
      pool.delete(img);
    };
    // On failure (transient network, navigation abort, etc.) drop the URL
    // from inFlight without marking it warmed — the next call retries
    // instead of permanently treating a broken URL as cached.
    const onFailure = () => {
      inFlight.delete(url);
      pool.delete(img);
    };
    img.onload = onSuccess;
    img.onerror = onFailure;
    img.decoding = 'async';
    img.loading = 'eager';
    // CORS so this populates the same cache bucket as the rendered <img>s
    // (which all set crossOrigin="anonymous"). Without matching CORS modes
    // the browser keeps separate cache entries and the warming has no effect.
    img.crossOrigin = 'anonymous';
    img.src = url;
  }
}

export function isImageWarmed(url: string | null | undefined): boolean {
  return Boolean(url) && warmed.has(url as string);
}
