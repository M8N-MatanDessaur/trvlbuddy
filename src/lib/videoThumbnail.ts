// Client-side fallback that decodes the first frame of a video URL into
// a JPEG data URL. Used as a backup thumbnail when the upload-time
// poster is missing or rendered black (older rows uploaded before the
// poster pipeline worked end to end).
//
// Both the in-flight promise and the resolved data URL are cached per
// URL so a profile grid with multiple video tiles only decodes each
// clip once, even across remounts.

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function getCachedFrame(url: string | null | undefined): string | null {
  if (!url) return null;
  return cache.get(url) ?? null;
}

export function captureVideoFirstFrame(url: string): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(url);
  if (existing) return existing;

  const job = decode(url).then((result) => {
    inflight.delete(url);
    if (result) cache.set(url, result);
    return result;
  });
  inflight.set(url, job);
  return job;
}

async function decode(url: string): Promise<string | null> {
  try {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    // metadata is enough to start drawing the first frame in Chromium /
    // Safari; some Firefox builds need a tiny play() nudge before the
    // pixel data lands in the canvas, so we issue one and immediately
    // pause once we've grabbed the frame.
    video.preload = 'auto';
    video.src = url;

    await waitForEvent(video, 'loadeddata', 4000);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try { video.pause(); } catch { /* noop */ }
    video.removeAttribute('src');
    video.load();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    return dataUrl.length > 100 ? dataUrl : null;
  } catch {
    return null;
  }
}

function waitForEvent(el: HTMLVideoElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, timeoutMs);
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('video error'));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      el.removeEventListener(event, onEvent);
      el.removeEventListener('error', onError);
    };
    el.addEventListener(event, onEvent, { once: true });
    el.addEventListener('error', onError, { once: true });
  });
}
