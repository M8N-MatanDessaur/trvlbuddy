// Client-side video upload prep. We deliberately do NOT transcode here —
// every browser-side transcoder we tried (ffmpeg.wasm, MediaRecorder)
// hit codec/memory/format edges that broke uploads on real devices.
//
// Instead the original file is uploaded as-is, plus a poster image we
// extract from the user's chosen start frame, plus the trim window
// (start + duration) as metadata. The player applies the trim by
// seeking + looping in [start, start+duration], and the 4:5 crop is
// applied at display time via CSS object-fit:cover.
//
// Result: upload feels Instagram-fast (just the network upload), and
// the pipeline cannot fail on any clip the trimmer could already
// preview, because we never touch the bytes.

export const MAX_CLIP_SECONDS = 7;
export const TARGET_HEIGHT = 720;
export const POSTER_QUALITY = 0.85; // canvas.toBlob jpeg quality
export const MAX_INPUT_BYTES = 500 * 1024 * 1024; // 500 MB hard ceiling on raw upload

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
}

// Reads basic metadata by loading the file into a hidden <video> element.
export function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    el.src = url;
    el.onloadedmetadata = () => {
      const meta: VideoMeta = {
        durationSec: el.duration || 0,
        width: el.videoWidth || 0,
        height: el.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This video could not be read by the browser.'));
    };
  });
}

export interface TrimParams {
  file: File;
  startSec: number;
  durationSec: number;
  maxHeight?: number;
  onProgress?: (progress: number) => void;
}

export interface TrimResult {
  video: File;       // original source file, unchanged
  poster: File;      // jpeg captured from the chosen start frame, 4:5 cropped
  durationMs: number;
  startMs: number;   // offset into the source where playback should begin
  width: number;     // poster width — what the feed renders at
  height: number;    // poster height
}

// "Prepare" rather than "trim": we never re-encode the source. We only
// need the poster (so the feed renders instantly) and the trim metadata
// (so the player knows which 7-second window to play).
export async function trimAndDownscale(params: TrimParams): Promise<TrimResult> {
  const { file, startSec, durationSec, maxHeight = TARGET_HEIGHT, onProgress } = params;

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      `Video is too large (${formatMB(file.size)}, max ${formatMB(MAX_INPUT_BYTES)}).`,
    );
  }

  onProgress?.(0.05);

  const poster = await capturePoster(file, startSec, maxHeight);
  onProgress?.(1);

  const startMs = Math.max(0, Math.round(startSec * 1000));
  const durationMs = Math.max(0, Math.round(durationSec * 1000));

  return {
    video: file,
    poster: poster.file,
    durationMs,
    startMs,
    width: poster.width,
    height: poster.height,
  };
}

// Renders the chosen frame to a 4:5 portrait canvas (largest 4:5 rectangle
// that fits inside the source, downscaled to <= maxHeight) and turns it
// into a jpeg File. This is the same crop the player applies via
// object-fit:cover, so the poster matches the live frame exactly.
async function capturePoster(
  file: File,
  startSec: number,
  maxHeight: number,
): Promise<{ file: File; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const videoEl = document.createElement('video');
  videoEl.src = url;
  videoEl.preload = 'auto';
  videoEl.playsInline = true;
  videoEl.muted = true;
  videoEl.crossOrigin = 'anonymous';

  try {
    await waitForMetadata(videoEl);
    await seekTo(videoEl, startSec);

    const layout = computeLayout(videoEl.videoWidth, videoEl.videoHeight, maxHeight);
    const canvas = document.createElement('canvas');
    canvas.width = layout.dstW;
    canvas.height = layout.dstH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create canvas context.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      videoEl,
      layout.cropX,
      layout.cropY,
      layout.cropW,
      layout.cropH,
      0,
      0,
      layout.dstW,
      layout.dstH,
    );

    const blob = await canvasToBlob(canvas, 'image/jpeg', POSTER_QUALITY);
    const stem = (file.name.replace(/\.[^.]+$/, '') || 'clip').slice(0, 48);
    const posterFile = new File([blob], `${stem}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return { file: posterFile, width: layout.dstW, height: layout.dstH };
  } finally {
    try { videoEl.pause(); } catch { /* noop */ }
    videoEl.removeAttribute('src');
    videoEl.load();
    URL.revokeObjectURL(url);
  }
}

// Largest 4:5 rectangle that fits inside the source, scaled so its short
// edge is no taller than maxHeight. cropX/Y are in source pixel space;
// dstW/H are the canvas (output) dimensions, rounded to even integers.
function computeLayout(
  srcW: number,
  srcH: number,
  maxHeight: number,
): { cropX: number; cropY: number; cropW: number; cropH: number; dstW: number; dstH: number } {
  const safeSrcW = srcW > 0 ? srcW : 720;
  const safeSrcH = srcH > 0 ? srcH : 1280;
  const cropW = Math.min(safeSrcW, (safeSrcH * 4) / 5);
  const cropH = Math.min(safeSrcH, (safeSrcW * 5) / 4);
  const cropX = (safeSrcW - cropW) / 2;
  const cropY = (safeSrcH - cropH) / 2;
  const dstH = roundEven(Math.min(maxHeight, cropH));
  const dstW = roundEven((cropW / cropH) * dstH);
  return { cropX, cropY, cropW, cropH, dstW, dstH };
}

function roundEven(n: number): number {
  const r = Math.max(2, Math.round(n));
  return r % 2 === 0 ? r : r - 1;
}

function waitForMetadata(el: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (el.readyState >= 1 && el.videoWidth > 0) {
      resolve();
      return;
    }
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('This video could not be read by the browser.'));
    };
    const cleanup = () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('error', onError);
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('error', onError);
  });
}

function seekTo(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.max(0, t);
    const cleanup = () => {
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Could not seek to the chosen frame.'));
    };
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('error', onError);
    // If we're already there (or within a frame), the browser may not
    // fire 'seeked'; bail out after a short grace period.
    if (Math.abs(el.currentTime - target) < 0.05) {
      setTimeout(() => {
        cleanup();
        resolve();
      }, 0);
      return;
    }
    el.currentTime = target;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not capture poster frame.'));
      },
      type,
      quality,
    );
  });
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
