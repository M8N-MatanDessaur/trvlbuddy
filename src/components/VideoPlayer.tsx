import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface Props {
  src: string;
  posterUrl?: string | null;
  thumbhashBg?: string | null;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Instagram-style muted autoplay loop. Pauses when off-screen via
// IntersectionObserver so a feed full of videos doesn't murder the
// battery. Tap anywhere to toggle sound; double-tap bubbles out so
// parent components can still wire like-on-double-tap.

const VideoPlayer: React.FC<Props> = ({
  src,
  posterUrl,
  thumbhashBg,
  autoplay = true,
  className,
  style,
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

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
        background: thumbhashBg
          ? `center / cover no-repeat url(${thumbhashBg})`
          : 'black',
        ...style,
      }}
    >
      <video
        ref={ref}
        src={src}
        poster={posterUrl || undefined}
        muted={muted}
        playsInline
        loop
        autoPlay={autoplay}
        preload="metadata"
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
