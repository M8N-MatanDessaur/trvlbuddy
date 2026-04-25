// Client-side video trim + 4:5 crop + downscale + poster extraction.
//
// Built on the browser's native pipeline:
//   <video>  ──audio──▶  AudioContext ──▶ MediaStreamAudioDestinationNode
//      │                                            │
//      └──pixels──▶  <canvas> ──▶ canvas.captureStream()
//                                                   │
//                                            MediaStream
//                                                   │
//                                            MediaRecorder ──▶ Blob
//
// We deliberately don't use ffmpeg.wasm anywhere here. Whatever the browser
// can decode through a <video> element we can re-encode — including 10-bit
// HEVC from modern iPhones, which kept trapping libx264 inside the wasm
// build. The MediaRecorder output is muxed by the platform, so there is no
// memory cap and no codec/pixel-format edge cases for us to babysit.
//
// Output container is whatever the browser's MediaRecorder will produce
// best — H.264 in MP4 on Safari and recent Chrome, VP9/VP8 in WebM on
// older Chrome and Firefox. Both play inline on iOS and Android, so the
// caller just needs to upload `result.video` with its existing `.type`
// and not assume `.mp4`.

export const MAX_CLIP_SECONDS = 7;
export const TARGET_HEIGHT = 720;
export const TARGET_FPS = 30;
export const VIDEO_BITRATE = 2_500_000; // ~2.5 Mbps — visually clean at 4:5/720p
export const AUDIO_BITRATE = 128_000;
export const POSTER_QUALITY = 0.85; // canvas.toBlob jpeg quality

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
  video: File; // .mp4 (Safari/recent Chrome) or .webm (Chrome/Firefox), <= maxHeight, exactly durationSec long
  poster: File; // first-frame jpeg
  durationMs: number;
  width: number;
  height: number;
}

// Up-front capability check so we can fail fast with an actionable message
// instead of trying to spin up the pipeline and dying mid-record.
function assertEnvironment(): void {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Your browser does not support video recording.');
  }
  if (typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Your browser does not support video processing.');
  }
}

// Try the codecs in descending order of compatibility/quality. The first one
// the browser admits to supporting wins. We always prefer mp4/h264 because
// every Safari + iOS playback path likes it, and fall through to webm
// (VP9 → VP8 → unconstrained) for Chrome/Firefox/Android.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function pickMimeType(): string {
  for (const t of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  // Last-resort: hand the browser an empty options object and let it choose.
  // Safari historically returned false for isTypeSupported on every type and
  // still recorded fine, so we fall back to "" rather than throwing.
  return '';
}

function extensionFor(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('mp4')) return '.mp4';
  if (lower.includes('webm')) return '.webm';
  return '.mp4';
}

// Largest 4:5 (Instagram portrait) rectangle that fits inside the source.
// Returns the source-space crop window plus the destination canvas size.
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

function seekTo(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('error', onError);
      reject(new Error('Seek failed'));
    };
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('error', onError);
    el.currentTime = Math.max(0, t);
  });
}

// Trim + 4:5 crop + downscale to <= maxHeight, with audio. The promise
// resolves when MediaRecorder has finished flushing, which means the output
// blob is fully muxed and ready to upload.
export async function trimAndDownscale(params: TrimParams): Promise<TrimResult> {
  const { file, startSec, durationSec, maxHeight = TARGET_HEIGHT, onProgress } = params;

  assertEnvironment();

  const sourceUrl = URL.createObjectURL(file);
  const videoEl = document.createElement('video');
  videoEl.src = sourceUrl;
  videoEl.preload = 'auto';
  videoEl.playsInline = true;
  // The actual playback audio is silenced via the AudioContext routing below
  // (we don't connect to AudioContext.destination), so the user never hears
  // the source clip while we encode. .muted on the element itself doesn't
  // matter for what AudioContext captures, but we also keep it true so any
  // browser that does fall back to element output stays silent.
  videoEl.muted = true;
  videoEl.crossOrigin = 'anonymous';

  let audioCtx: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;
  let stopped = false;

  try {
    await waitForMetadata(videoEl);

    const layout = computeLayout(videoEl.videoWidth, videoEl.videoHeight, maxHeight);

    // Canvas at the destination size — every drawn frame is already cropped
    // and downscaled, so the encoder just sees a 4:5 720p stream.
    const canvas = document.createElement('canvas');
    canvas.width = layout.dstW;
    canvas.height = layout.dstH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create canvas context.');
    // Source pixels are nicely high-res and we only ever shrink, so use
    // high-quality downsampling for sharper output.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Black initial frame so the first MediaRecorder chunk has valid pixel
    // data even if the first draw fires a frame later than expected.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const canvasStream = canvas.captureStream(TARGET_FPS);
    const stream = new MediaStream();
    for (const t of canvasStream.getVideoTracks()) stream.addTrack(t);

    // Audio: route the <video> element through Web Audio so we get a
    // MediaStreamTrack regardless of whether the platform supports
    // HTMLMediaElement.captureStream() (iOS Safari notably does not).
    // We only connect to MediaStreamDestination — never to audioCtx.destination
    // — so the user doesn't hear the clip while it's being processed.
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        audioCtx = new Ctor();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaElementSource(videoEl);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      }
    } catch {
      // Some sources have no audio track or the AudioContext is blocked
      // (e.g. autoplay policy on a non-gesture path). Recording video-only
      // is preferable to failing the whole upload.
    }

    const mimeType = pickMimeType();
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: VIDEO_BITRATE,
      audioBitsPerSecond: AUDIO_BITRATE,
    };
    if (mimeType) recorderOptions.mimeType = mimeType;

    const chunks: Blob[] = [];
    recorder = new MediaRecorder(stream, recorderOptions);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const stoppedPromise = new Promise<void>((resolve, reject) => {
      recorder!.onstop = () => resolve();
      recorder!.onerror = (e: Event) => {
        const err = (e as unknown as { error?: DOMException }).error;
        reject(new Error(`Recorder error: ${err?.message || 'unknown'}`));
      };
    });

    // Seek to the user's chosen start before we start the recorder. This
    // guarantees the very first frame the recorder sees is the actual clip
    // start, not the source's t=0.
    await seekTo(videoEl, startSec);

    // Capture the poster from the first cropped frame the moment we land
    // on it — before recording starts — so we always have a valid thumbnail
    // even if recording is interrupted.
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
    const posterBlob = await canvasToBlob(canvas, 'image/jpeg', POSTER_QUALITY);

    // Frame-loop. requestVideoFrameCallback fires once per decoded video
    // frame and is the right hook for re-rendering, but Firefox doesn't
    // support it; rAF gives us ~60Hz polling there which is fine.
    type V = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    const v = videoEl as V;
    const useRVFC = typeof v.requestVideoFrameCallback === 'function';
    let rafHandle = 0;

    const drawFrame = () => {
      if (stopped) return;
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
      const elapsed = Math.max(0, videoEl.currentTime - startSec);
      if (onProgress) onProgress(Math.min(1, elapsed / durationSec));
      if (elapsed >= durationSec) {
        stopped = true;
        try { videoEl.pause(); } catch { /* noop */ }
        try { recorder!.stop(); } catch { /* noop */ }
        return;
      }
      if (useRVFC) {
        v.requestVideoFrameCallback!(drawFrame);
      } else {
        rafHandle = requestAnimationFrame(drawFrame);
      }
    };

    // 100ms timeslice keeps memory steady (chunks flush as they're produced)
    // instead of buffering the entire clip into a single Blob.
    recorder.start(100);

    // Kick off playback + draw loop. play() returns a promise that resolves
    // once the element is actually playing; if it rejects, the user gesture
    // chain was broken — surface that as an actionable error.
    try {
      await videoEl.play();
    } catch (e) {
      throw new Error(
        `Could not play the source video for processing: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    if (useRVFC) {
      v.requestVideoFrameCallback!(drawFrame);
    } else {
      rafHandle = requestAnimationFrame(drawFrame);
    }

    // Hard deadline guard: if the source's currentTime stalls for any
    // reason (e.g. a malformed timestamp range), don't hang forever — give
    // it durationSec * 5 seconds of wallclock and then bail.
    const deadline = Math.max(15_000, durationSec * 5_000);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Video processing timed out.')), deadline);
    });

    await Promise.race([stoppedPromise, timeoutPromise]);

    if (!useRVFC && rafHandle) cancelAnimationFrame(rafHandle);

    if (chunks.length === 0) {
      throw new Error('No video data was recorded — try again.');
    }

    const finalMime = mimeType || chunks[0]?.type || 'video/webm';
    const videoBlob = new Blob(chunks, { type: finalMime });

    if (videoBlob.size < 1024) {
      throw new Error('Recording was empty — try again.');
    }

    const ext = extensionFor(finalMime);
    const stem = (file.name.replace(/\.[^.]+$/, '') || 'clip').slice(0, 48);
    const video = new File([videoBlob], `${stem}${ext}`, {
      type: finalMime,
      lastModified: Date.now(),
    });
    const poster = new File([posterBlob], `${stem}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return {
      video,
      poster,
      durationMs: Math.round(durationSec * 1000),
      width: layout.dstW,
      height: layout.dstH,
    };
  } finally {
    stopped = true;
    try { videoEl.pause(); } catch { /* noop */ }
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* noop */ }
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
    }
    URL.revokeObjectURL(sourceUrl);
  }
}

function waitForMetadata(el: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (el.readyState >= 1 && el.videoWidth > 0) {
      resolve();
      return;
    }
    const onLoaded = () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('error', onError);
      reject(new Error('This video could not be read by the browser.'));
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('error', onError);
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
