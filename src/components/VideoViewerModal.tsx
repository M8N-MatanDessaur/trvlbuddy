import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, X } from 'lucide-react';
import type { UserVideo } from '../services/activityVideoService';

interface Props {
  video: UserVideo | null;
  onClose: () => void;
}

// Fullscreen video viewer — opens when a video tile in the profile grid
// is tapped. Plays the trim window the uploader picked (start_ms +
// duration_ms), starts muted with autoplay, and lets the user tap once
// to unmute. The 4:5 portrait frame matches the carousel + thumbnail
// crop, so the live frame lines up with what they tapped.
const VideoViewerModal: React.FC<Props> = ({ video, onClose }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  const startSec = video && video.start_ms && video.start_ms > 0 ? video.start_ms / 1000 : 0;
  const endSec = video && video.duration_ms && video.duration_ms > 0
    ? startSec + video.duration_ms / 1000
    : null;

  // Reset to muted whenever a different video opens — autoplay only
  // works with sound off in mobile browsers.
  useEffect(() => {
    if (video) setMuted(true);
  }, [video?.id]);

  // Seek to the trim start once metadata is decoded.
  useEffect(() => {
    const el = ref.current;
    if (!el || !video) return;
    const trySeek = () => {
      if (startSec > 0 && Math.abs(el.currentTime - startSec) > 0.05) {
        try { el.currentTime = startSec; } catch { /* noop */ }
      }
    };
    if (el.readyState >= 1) trySeek();
    el.addEventListener('loadedmetadata', trySeek);
    return () => el.removeEventListener('loadedmetadata', trySeek);
  }, [video?.id, startSec]);

  // Loop within the trim window via timeupdate snap-back.
  useEffect(() => {
    const el = ref.current;
    if (!el || endSec === null) return;
    const onTimeUpdate = () => {
      if (el.currentTime >= endSec - 0.05) {
        try {
          el.currentTime = startSec;
          void el.play().catch(() => {});
        } catch { /* noop */ }
      } else if (el.currentTime < startSec - 0.05) {
        try { el.currentTime = startSec; } catch { /* noop */ }
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [video?.id, startSec, endSec]);

  // Block body scroll while open. Mirrors the photo viewer's behavior so
  // the underlying feed doesn't jump when we mount.
  useEffect(() => {
    if (!video) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [video?.id]);

  // Esc to close on desktop.
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video?.id, onClose]);

  return (
    <AnimatePresence>
      {video && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.95)' }}
          onClick={onClose}
        >
          {/* Tapping the surface around the video closes; tapping the
              video itself toggles mute (so it always feels reactive). */}
          <div
            className="relative"
            style={{
              width: '100%',
              maxWidth: '480px',
              aspectRatio: '4 / 5',
              maxHeight: '88dvh',
              background: 'black',
              borderRadius: 18,
              overflow: 'hidden',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMuted((m) => !m);
            }}
          >
            <video
              ref={ref}
              src={video.url}
              poster={video.posterUrl}
              muted={muted}
              autoPlay
              playsInline
              preload="auto"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                background: 'black',
              }}
            />

            {/* Mute indicator bottom-right. Tap target is the whole video
                surface; this is a non-interactive hint. */}
            <div
              aria-hidden="true"
              className="absolute right-3 bottom-3 flex items-center justify-center rounded-full"
              style={{
                width: 36,
                height: 36,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: 'white',
              }}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close video"
            className="absolute flex items-center justify-center"
            style={{
              top: 'max(16px, env(safe-area-inset-top))',
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'white',
              border: 'none',
              padding: 0,
              zIndex: 2,
            }}
          >
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoViewerModal;
