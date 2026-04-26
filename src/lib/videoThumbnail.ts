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
  // CORS-anonymous is required so toDataURL can read pixels back. Without
  // it the canvas is tainted and we can't generate a thumbnail at all --
  // VideoThumbnail's caller falls through to the upload-time poster (or
  // a blank surface) when this returns null.
  try {
    return await decodeOnce(url, true);
  } catch {
    return null;
  }
}

async function decodeOnce(url: string, withCors: boolean): Promise<string | null> {
  const video = document.createElement('video');
  if (withCors) video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  // preload=auto pulls enough of the file that a seek to 0 lands on a
  // real frame instead of the black pre-roll some encoders emit.
  video.preload = 'auto';
  video.src = url;

  try {
    // loadedmetadata gives us videoWidth/videoHeight; we then nudge the
    // currentTime so the browser commits a frame to the decoder before we
    // try to drawImage. Without the seek + 'seeked' wait, Chrome will
    // sometimes draw a black square because no frame has been painted yet.
    await waitForEvent(video, 'loadedmetadata', 6000);
    try {
      video.currentTime = Math.min(0.1, (video.duration || 0.5) / 2);
      await waitForEvent(video, 'seeked', 4000);
    } catch {
      // Some browsers won't seek until 'canplay'; fall back to that.
      await waitForEvent(video, 'canplay', 4000).catch(() => undefined);
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    } catch {
      // Tainted canvas (CORS mismatch) -- can't read back. Caller's
      // outer fallback handles the no-CORS retry. Returning null lets
      // VideoThumbnail keep showing the poster URL.
      return null;
    }
    return dataUrl.length > 100 ? dataUrl : null;
  } finally {
    try { video.pause(); } catch { /* noop */ }
    video.removeAttribute('src');
    try { video.load(); } catch { /* noop */ }
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
