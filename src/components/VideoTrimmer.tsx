import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pause, Play, X } from 'lucide-react';
import { MAX_CLIP_SECONDS, readVideoMeta, trimAndDownscale, type TrimResult } from '../lib/videoProcess';
import { tap as hapticTap, impact as hapticImpact } from '../lib/haptics';

interface Props {
  source: File;
  onCancel: () => void;
  // The trimmer awaits this promise so the screen stays mounted (with
  // real upload-progress %) for the whole prepare → upload pipeline,
  // instead of vanishing the moment the poster is ready and leaving the
  // user staring at the feed for several seconds with no feedback.
  onConfirm: (
    result: TrimResult,
    onProgress?: (progress: number) => void,
  ) => Promise<{ ok: boolean; error?: string | null }>;
}

// Mobile-first trim UI. A single draggable 7-second window slides along
// the full-length preview; the video element scrubs live as the user
// drags so they see exactly what will be kept. Confirming runs the
// poster-extract step (~instant) and then awaits the upload, with the
// confirm button reflecting real progress the entire time.

const FRAME_THUMB_COUNT = 8;
const WINDOW_SEC = MAX_CLIP_SECONDS;

const VideoTrimmer: React.FC<Props> = ({ source, onCancel, onConfirm }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [sourceUrl] = useState(() => URL.createObjectURL(source));
  const [durationSec, setDurationSec] = useState(0);
  const [start, setStart] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Release the blob URL on unmount.
  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);

  // Read metadata once. If the clip is already shorter than the cap, the
  // window stays at 0 and spans the full clip (no trim needed).
  useEffect(() => {
    let alive = true;
    readVideoMeta(source).then((meta) => {
      if (!alive) return;
      const clamped = Math.max(0, Math.min(meta.durationSec, 600)); // 10-minute sanity cap
      setDurationSec(clamped);
      setStart(0);
    }).catch(() => {
      setError('This video could not be read. Try a different file.');
    });
    return () => { alive = false; };
  }, [source]);

  const effectiveWindow = Math.min(WINDOW_SEC, durationSec);
  const maxStart = Math.max(0, durationSec - effectiveWindow);

  // Loop playback inside the selected window.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const tick = () => {
      const t = el.currentTime;
      setCurrentTime(t);
      if (t >= start + effectiveWindow - 0.02) {
        el.currentTime = start;
        if (!playing) el.pause();
      }
    };
    el.addEventListener('timeupdate', tick);
    return () => el.removeEventListener('timeupdate', tick);
  }, [start, effectiveWindow, playing]);

  const seekTo = (t: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(durationSec, t));
  };

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    if (el.currentTime < start || el.currentTime >= start + effectiveWindow) {
      el.currentTime = start;
    }
    try {
      await el.play();
      setPlaying(true);
      hapticTap();
    } catch {
      setPlaying(false);
    }
  };

  // Drag handling for the 7s window. One draggable rectangle; dragging
  // moves `start`. Touch + mouse both supported.
  const dragState = useRef<{ pointerId: number; startX: number; origStart: number } | null>(null);

  const pointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const tl = timelineRef.current;
    if (!tl) return;
    dragState.current = { pointerId: e.pointerId, startX: e.clientX, origStart: start };
    (e.target as Element).setPointerCapture(e.pointerId);
    hapticImpact();
  };

  const pointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || dragState.current.pointerId !== e.pointerId) return;
    const tl = timelineRef.current;
    if (!tl) return;
    const dx = e.clientX - dragState.current.startX;
    const secondsPerPx = durationSec / tl.clientWidth;
    const next = Math.max(0, Math.min(maxStart, dragState.current.origStart + dx * secondsPerPx));
    setStart(next);
    seekTo(next);
  };

  const pointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId === e.pointerId) {
      dragState.current = null;
    }
  };

  const windowPercent = durationSec > 0 ? (effectiveWindow / durationSec) * 100 : 100;
  const startPercent = durationSec > 0 ? (start / durationSec) * 100 : 0;
  const playheadPercent = durationSec > 0 ? (currentTime / durationSec) * 100 : 0;

  const confirm = async () => {
    if (processing) return;
    setError(null);
    setProcessing(true);
    setProgress(0);
    setPhase('preparing');
    try {
      // Pause the preview so the canvas grab in trimAndDownscale doesn't
      // race the playing element.
      try { videoRef.current?.pause(); } catch { /* noop */ }
      setPlaying(false);

      const result = await trimAndDownscale({
        file: source,
        startSec: start,
        durationSec: effectiveWindow,
        onProgress: (p) => setProgress(p),
      });

      setPhase('uploading');
      setProgress(0);
      const res = await onConfirm(result, (p) => setProgress(p));
      if (!res.ok) {
        // Stay on screen with a retry-able error; parent's toast already
        // surfaced the user-facing copy.
        setError(res.error || 'Upload failed. Please try again.');
        setProcessing(false);
        setPhase('idle');
      }
      // On success the parent unmounts us; nothing else to do.
    } catch (err) {
      console.error('[VideoTrimmer] confirm failed', err);
      const detail = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : '';
      setError(detail || 'Could not prepare the clip. Please try again.');
      setProcessing(false);
      setPhase('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.95)', height: '100dvh', overscrollBehavior: 'contain' }}
    >
      <header
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 'calc(3.25rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: 'rgba(0,0,0,0.85)',
          color: 'white',
        }}
      >
        <button
          onClick={onCancel}
          disabled={processing}
          className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40"
          style={{ background: 'transparent', color: 'white', border: 'none', minHeight: 0, minWidth: 0 }}
          aria-label="Cancel"
        >
          <X size={20} />
        </button>
        <div className="text-[13px] font-extrabold tracking-tight">
          Trim to {WINDOW_SEC}s
        </div>
        <button
          onClick={confirm}
          disabled={processing || durationSec === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-extrabold disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            border: 'none',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {phase === 'preparing' && 'Preparing'}
          {phase === 'uploading' && `${Math.round(progress * 100)}%`}
          {phase === 'idle' && 'Share'}
        </button>
      </header>

      <div className="flex-1 flex flex-col">
        {/* Preview — locked to a 4:5 portrait frame (Instagram-style).
            Cover-cropping the source so the user sees exactly what will
            be saved, instead of letting a 16:9 capture overflow. */}
        <div
          className="flex-1 flex items-center justify-center bg-black"
          style={{ minHeight: 0, padding: 8 }}
        >
          <video
            ref={videoRef}
            src={sourceUrl}
            style={{
              aspectRatio: '4 / 5',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'cover',
              display: 'block',
              background: 'black',
              borderRadius: 12,
            }}
            playsInline
            muted
            preload="metadata"
            onClick={togglePlay}
          />
        </div>

        {/* Timeline */}
        <div
          className="px-4 py-4 flex-shrink-0"
          style={{
            background: 'rgba(0,0,0,0.9)',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex items-center justify-center mb-3">
            <button
              onClick={togglePlay}
              disabled={processing}
              className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: 'none',
                minHeight: 0,
                minWidth: 0,
              }}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
          </div>

          <div
            ref={timelineRef}
            className="relative w-full rounded-xl overflow-hidden"
            style={{
              height: 56,
              background: 'rgba(255,255,255,0.08)',
              touchAction: 'pan-y',
            }}
          >
            {/* Striped "filmstrip" backdrop — gives the user a sense of scale
                without actually decoding frames. */}
            <div className="absolute inset-0 flex">
              {Array.from({ length: FRAME_THUMB_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  }}
                />
              ))}
            </div>

            {/* Playhead line */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${playheadPercent}%`,
                width: 2,
                background: 'white',
                opacity: 0.7,
                pointerEvents: 'none',
              }}
            />

            {/* Draggable 7s window */}
            <div
              role="slider"
              aria-label="Trim window"
              aria-valuemin={0}
              aria-valuemax={Math.round(maxStart)}
              aria-valuenow={Math.round(start)}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              style={{
                position: 'absolute',
                top: -2,
                bottom: -2,
                left: `${startPercent}%`,
                width: `${windowPercent}%`,
                background: 'rgba(88, 86, 214, 0.25)',
                border: '2px solid var(--accent)',
                borderRadius: 10,
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              {/* Grab handles left + right */}
              {['left', 'right'].map((side) => (
                <div
                  key={side}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    [side]: -2,
                    width: 12,
                    background: 'var(--accent)',
                    borderTopLeftRadius: side === 'left' ? 8 : 0,
                    borderBottomLeftRadius: side === 'left' ? 8 : 0,
                    borderTopRightRadius: side === 'right' ? 8 : 0,
                    borderBottomRightRadius: side === 'right' ? 8 : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  } as React.CSSProperties}
                >
                  <div style={{ width: 2, height: 20, background: 'white', borderRadius: 2 }} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <span>{formatSec(start)}</span>
            <span className="font-bold" style={{ color: 'white' }}>
              {formatSec(effectiveWindow)} selected
            </span>
            <span>{formatSec(start + effectiveWindow)}</span>
          </div>

          {error && (
            <div
              className="mt-3 rounded-xl px-3 py-2 text-[12px]"
              style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5' }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Full-surface progress overlay during prepare/upload. The
          underlying trim UI stays mounted so a failure leaves the
          user's chosen window intact for retry. */}
      {(phase === 'preparing' || phase === 'uploading') && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            color: 'white',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: 10,
          }}
        >
          <div className="flex flex-col items-center gap-4 px-8" style={{ width: '100%', maxWidth: 320 }}>
            <Loader2 size={36} className="animate-spin" />
            <div className="text-[15px] font-extrabold tracking-tight text-center">
              {phase === 'preparing' ? 'Preparing your clip…' : 'Uploading your clip…'}
            </div>
            {phase === 'uploading' && (
              <>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.15)', height: 6 }}
                >
                  <div
                    style={{
                      width: `${Math.round(progress * 100)}%`,
                      height: '100%',
                      background: 'var(--accent)',
                      transition: 'width 120ms linear',
                    }}
                  />
                </div>
                <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {Math.round(progress * 100)}%
                </div>
              </>
            )}
            <div className="text-[11.5px] text-center" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Keep this screen open until it finishes.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatSec(value: number): string {
  const total = Math.max(0, Math.round(value * 10) / 10);
  const s = Math.floor(total);
  const d = Math.round((total - s) * 10);
  return `${s}.${d}s`;
}

export default VideoTrimmer;
