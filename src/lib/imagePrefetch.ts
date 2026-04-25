// Fire-and-forget browser HTTP-cache warmer. Creating a detached Image and
// assigning its src kicks off a normal fetch — the bytes land in the disk
// cache so the next <img> with the same URL paints instantly. We also hold a
// short-lived reference to the element until load/error to guarantee the
// request survives garbage collection.

const warmed = new Set<string>();
const pool = new Set<HTMLImageElement>();

export function warmImageCache(urls: Iterable<string | null | undefined>): void {
  if (typeof window === 'undefined') return;
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    const img = new Image();
    pool.add(img);
    const done = () => { pool.delete(img); };
    img.onload = done;
    img.onerror = done;
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;
  }
}

export function isImageWarmed(url: string | null | undefined): boolean {
  return Boolean(url) && warmed.has(url as string);
}
