import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface Props {
  src: string;
  posterUrl?: string | null;
  thumbhashBg?: string | null;
  startMs?: number | null;
  durationMs?: number | null;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Instagram-style muted autoplay loop, scoped to the trim window the
// uploader picked. The source video is uploaded as-is (no transcoding),
// so playback enforces the [startMs, startMs+durationMs] range here:
// seek on load, snap back to start when we cross the end, and pause
// when scrolled off-screen so a feed full of videos doesn't drain the
// battery. The 4:5 portrait frame + object-fit:cover apply the same
// crop the poster shows, so the live frame matches the thumbnail.
const VideoPlayer: React.FC<Props> = ({
  src,
  posterUrl,
  thumbhashBg,
  startMs,
  durationMs,
  autoplay = true,
  className,
  style,
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  const startSec = startMs && startMs > 0 ? startMs / 1000 : 0;
  const endSec =
    durationMs && durationMs > 0 ? startSec + durationMs / 1000 : null;

  // Seek to the trim start as soon as the source has decoded enough
  // metadata to allow it. Re-runs if start/src changes (e.g. swiping
  // between videos in a feed).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (startSec <= 0) return;
    const trySeek = () => {
      try {
        if (Math.abs(el.currentTime - startSec) > 0.05) {
          el.currentTime = startSec;
        }
      } catch { /* seek before metadata can throw on some browsers */ }
    };
    if (el.readyState >= 1) trySeek();
    el.addEventListener('loadedmetadata', trySeek);
    return () => el.removeEventListener('loadedmetadata', trySeek);
  }, [startSec, src]);

  // Loop within the chosen window. Watching currentTime instead of using
  // the native `loop` attribute lets us bound playback to a sub-range
  // of the source.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (endSec !== null && el.currentTime >= endSec - 0.05) {
        try {
          el.currentTime = startSec;
          if (autoplay) void el.play().catch(() => {});
        } catch { /* noop */ }
      } else if (el.currentTime < startSec - 0.05) {
        try { el.currentTime = startSec; } catch { /* noop */ }
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [startSec, endSec, autoplay]);

  // Pause off-screen, autoplay on-screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || !autoplay) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
            void el.play().catch(() => {});
          } else {
            el.pause();
          }
        });
      },
      { threshold: [0, 0.4, 0.75] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoplay, src]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted((m) => !m);
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        aspectRatio: '4 / 5',
        background: thumbhashBg
          ? `center / cover no-repeat url(${thumbhashBg})`
          : 'black',
        overflow: 'hidden',
        ...style,
      }}
    >
      <video
        ref={ref}
        src={src}
        poster={posterUrl || undefined}
        muted={muted}
        playsInline
        autoPlay={autoplay}
        preload="metadata"
        // No native `loop` — we manage the window bounds via timeupdate.
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          color: 'white',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          minHeight: 0,
          minWidth: 0,
          zIndex: 2,
        }}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
};

export default VideoPlayer;
