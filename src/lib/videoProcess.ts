// Client-side video trim + downscale + poster extraction. Uses the
// ffmpeg.wasm single-threaded build so it works on iOS Safari without
// cross-origin isolation headers. Core is lazy-loaded on first use
// (~30MB over the wire, cached by the browser afterwards).

import type { FFmpeg } from '@ffmpeg/ffmpeg';

export const MAX_CLIP_SECONDS = 7;
export const TARGET_HEIGHT = 720;
export const TARGET_VIDEO_BITRATE = '1200k';
export const POSTER_QUALITY = 4; // 1-31 (lower = higher quality)

const FFMPEG_CORE_VERSION = '0.12.6';
// @ffmpeg/ffmpeg@0.12.15 spawns its worker as `type: 'module'`, so the
// worker's `importScripts(coreURL)` throws synchronously (importScripts is
// not defined in module workers) and execution falls into the
// `await import(coreURL)` branch. That branch only succeeds for an actual
// ES module — a UMD bundle imported as ESM has no default export, so the
// worker then throws the opaque "failed to import ffmpeg-core.js".
// Pointing at /dist/esm/ instead of /dist/umd/ gives the dynamic-import
// fallback a real module to consume.
const FFMPEG_CORE_BASES = [
  `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`,
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`,
];

let loader: Promise<FFmpeg> | null = null;

async function loadFFmpeg(): Promise<FFmpeg> {
  if (loader) return loader;
  loader = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ff = new FFmpeg();
    const errors: string[] = [];
    for (const base of FFMPEG_CORE_BASES) {
      try {
        const [coreURL, wasmURL] = await Promise.all([
          fetchAsBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
          fetchAsBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        ]);
        await ff.load({ coreURL, wasmURL });
        return ff;
      } catch (e) {
        errors.push(`${base}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    throw new Error(`Could not load video engine. Tried: ${errors.join(' | ')}`);
  })().catch((e) => {
    // Don't pin a rejected loader — the next call should be allowed to retry
    // (e.g. after the user comes back online).
    loader = null;
    throw e;
  });
  return loader;
}

// Like @ffmpeg/util's toBlobURL but verifies the fetch succeeded and that the
// body looks like the expected asset, so a CDN error page can't be wrapped as
// JavaScript and turned into the opaque "failed to import ffmpeg-core.js"
// downstream.
async function fetchAsBlobURL(url: string, mimeType: string): Promise<string> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) {
    throw new Error(`Empty response from ${url}`);
  }
  if (mimeType === 'application/wasm') {
    // wasm magic: 0x00 0x61 0x73 0x6d (\0asm)
    const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    if (head[0] !== 0x00 || head[1] !== 0x61 || head[2] !== 0x73 || head[3] !== 0x6d) {
      throw new Error(`Invalid wasm magic from ${url}`);
    }
  } else if (mimeType === 'text/javascript') {
    // Reject HTML error pages so they can't be wrapped into a JS blob and then
    // surface inside the worker as the opaque "failed to import ffmpeg-core.js".
    const head = new TextDecoder('utf-8', { fatal: false })
      .decode(new Uint8Array(buf, 0, Math.min(256, buf.byteLength)))
      .trimStart()
      .toLowerCase();
    if (head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<')) {
      throw new Error(`Expected JS, got HTML from ${url}`);
    }
  }
  return URL.createObjectURL(new Blob([buf], { type: mimeType }));
}

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
}

// Reads basic metadata by loading the file into a hidden <video> element.
// Cheaper than firing up ffmpeg just to read a header.
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
      reject(new Error('Could not read video metadata'));
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
  video: File;          // mp4, H.264, <= maxHeight, exactly durationSec long
  poster: File;         // first-frame jpeg
  durationMs: number;
  width: number;
  height: number;
}

// Trim + downscale + re-encode. Output is always .mp4 H.264 AAC so iOS
// Safari and Android Chrome both play inline without fuss. We also pull
// the first frame as a poster jpeg so the grid + feed don't have to
// decode a keyframe just to draw a thumbnail.
export async function trimAndDownscale(params: TrimParams): Promise<TrimResult> {
  const { file, startSec, durationSec, maxHeight = TARGET_HEIGHT, onProgress } = params;
  const ff = await loadFFmpeg();

  // Compute the 4:5 (Instagram portrait) crop window in JS so the ffmpeg
  // filter graph stays free of comma-bearing min() expressions, which
  // ffmpeg.wasm's parser can mis-tokenise as filterchain separators even
  // when single-quoted.
  const sourceMeta = await readVideoMeta(file);
  const { cropW, cropH, targetH } = computeCropDimensions(sourceMeta, maxHeight);

  const inputName = 'input' + inferExtension(file);
  const outputName = 'output.mp4';
  const posterName = 'poster.jpg';

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)))
    : null;
  if (progressHandler) ff.on('progress', progressHandler);

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    await ff.writeFile(inputName, buf);

    // Trim + center-crop to 4:5 + downscale. -ss before -i seeks fast
    // (keyframe-based), after -i is accurate; we use after-input for
    // accuracy on mobile captures. cropW/cropH are precomputed integers
    // (even, for yuv420p), so the filter graph has no expressions to
    // escape. scale=-2 keeps width even-numbered for H.264.
    const code = await ff.exec([
      '-y',
      '-i', inputName,
      '-ss', startSec.toFixed(3),
      '-t', durationSec.toFixed(3),
      '-vf', `crop=${cropW}:${cropH},scale=-2:${targetH}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-b:v', TARGET_VIDEO_BITRATE,
      '-maxrate', TARGET_VIDEO_BITRATE,
      '-bufsize', '2400k',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      outputName,
    ]);
    if (code !== 0) {
      throw new Error(`Video encode failed (ffmpeg exit ${code})`);
    }

    // Poster frame at t=0 of the trimmed clip.
    const posterCode = await ff.exec([
      '-y',
      '-i', outputName,
      '-vframes', '1',
      '-q:v', String(POSTER_QUALITY),
      posterName,
    ]);
    if (posterCode !== 0) {
      throw new Error(`Poster extract failed (ffmpeg exit ${posterCode})`);
    }

    const videoData = await ff.readFile(outputName);
    const posterData = await ff.readFile(posterName);

    const videoBlob = new Blob([asUint8Array(videoData)], { type: 'video/mp4' });
    const posterBlob = new Blob([asUint8Array(posterData)], { type: 'image/jpeg' });

    const stem = (file.name.replace(/\.[^.]+$/, '') || 'clip').slice(0, 48);
    const video = new File([videoBlob], `${stem}.mp4`, {
      type: 'video/mp4',
      lastModified: Date.now(),
    });
    const poster = new File([posterBlob], `${stem}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    // Best-effort width/height via the poster's dimensions; fall back to
    // the precomputed crop/scale target if the browser refuses to decode
    // the poster (rare, but a poster failure shouldn't fail the upload).
    const fallbackHeight = targetH;
    const fallbackWidth = roundEven((cropW / cropH) * targetH);
    const posterMeta = await readImageMeta(poster).catch(() => ({
      width: fallbackWidth,
      height: fallbackHeight,
    }));

    return {
      video,
      poster,
      durationMs: Math.round(durationSec * 1000),
      width: posterMeta.width,
      height: posterMeta.height,
    };
  } finally {
    if (progressHandler) ff.off('progress', progressHandler);
    // Best-effort cleanup of the virtual fs — failures are harmless.
    for (const name of [inputName, outputName, posterName]) {
      try { await ff.deleteFile(name); } catch { /* ignore */ }
    }
  }
}

function asUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return new TextEncoder().encode(data);
  throw new Error('ffmpeg readFile returned unexpected type');
}

function inferExtension(file: File): string {
  const fromName = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  if (fromName) return fromName;
  if (file.type === 'video/mp4') return '.mp4';
  if (file.type === 'video/quicktime') return '.mov';
  if (file.type === 'video/webm') return '.webm';
  return '.mp4';
}

// Largest 4:5 (portrait) rectangle that fits in the source, rounded to
// even integers so libx264 + yuv420p is happy. targetH is the encode
// height, capped by maxHeight and the cropped source height.
function computeCropDimensions(
  meta: VideoMeta,
  maxHeight: number,
): { cropW: number; cropH: number; targetH: number } {
  const srcW = meta.width > 0 ? meta.width : 720;
  const srcH = meta.height > 0 ? meta.height : 1280;
  const cropW = roundEven(Math.min(srcW, (srcH * 4) / 5));
  const cropH = roundEven(Math.min(srcH, (srcW * 5) / 4));
  const targetH = roundEven(Math.min(maxHeight, cropH));
  return { cropW, cropH, targetH };
}

function roundEven(n: number): number {
  const r = Math.max(2, Math.round(n));
  return r % 2 === 0 ? r : r - 1;
}

function readImageMeta(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read poster dimensions'));
    };
    img.src = url;
  });
}
