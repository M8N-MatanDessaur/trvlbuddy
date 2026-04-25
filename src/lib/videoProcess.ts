// Client-side video trim + downscale + poster extraction. Uses the
// ffmpeg.wasm single-threaded build so it works on iOS Safari without
// cross-origin isolation headers. Core is lazy-loaded on first use
// (~30MB over the wire, cached by the browser afterwards).

import type { FFmpeg } from '@ffmpeg/ffmpeg';

export const MAX_CLIP_SECONDS = 7;
export const TARGET_HEIGHT = 720;
export const TARGET_VIDEO_BITRATE = '1200k';
export const POSTER_QUALITY = 4; // 1-31 (lower = higher quality)

let loader: Promise<FFmpeg> | null = null;

async function loadFFmpeg(): Promise<FFmpeg> {
  if (loader) return loader;
  loader = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ff;
  })();
  return loader;
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

    // Trim + downscale. -ss before -i seeks fast (keyframe-based), after -i
    // is accurate. We use after-input for accuracy on mobile captures.
    // scale=-2 keeps width even-numbered for H.264.
    await ff.exec([
      '-y',
      '-i', inputName,
      '-ss', startSec.toFixed(3),
      '-t', durationSec.toFixed(3),
      '-vf', `scale=-2:'min(${maxHeight},ih)'`,
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

    // Poster frame at t=0 of the trimmed clip.
    await ff.exec([
      '-y',
      '-i', outputName,
      '-vframes', '1',
      '-q:v', String(POSTER_QUALITY),
      posterName,
    ]);

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

    // Best-effort width/height via the poster's dimensions.
    const posterMeta = await readImageMeta(poster);

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
