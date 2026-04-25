import React, { useEffect, useState } from 'react';
import CachedImage from './CachedImage';
import { captureVideoFirstFrame, getCachedFrame } from '../lib/videoThumbnail';

interface Props {
  videoUrl: string;
  posterUrl: string | null | undefined;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'eager' | 'lazy';
}

// Renders a poster image for a video tile. Some older video rows shipped
// with empty or all-black posters (the poster pipeline misfired on
// uploads before the trim refactor landed). When the poster fails to
// load — or any time we can decode a real frame from the video — we
// swap in the live first frame, so the grid never shows a black square.
const VideoThumbnail: React.FC<Props> = ({
  videoUrl,
  posterUrl,
  alt = '',
  className,
  style,
  loading,
}) => {
  const [captured, setCaptured] = useState<string | null>(() => getCachedFrame(videoUrl));
  const [posterFailed, setPosterFailed] = useState(false);

  // Always decode in the background so a poster that loads "successfully"
  // but is actually a black frame still gets replaced. The capture is
  // memoised by URL so adjacent tiles don't redo the work.
  useEffect(() => {
    if (!videoUrl) return;
    if (captured) return;
    let alive = true;
    captureVideoFirstFrame(videoUrl).then((res) => {
      if (alive && res) setCaptured(res);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  const showCaptured = !!captured && (posterFailed || captured);
  const src = showCaptured ? captured! : posterUrl || '';

  if (!src) {
    return (
      <div
        className={className}
        style={{ background: 'var(--surface-container-high)', ...style }}
        aria-label={alt}
      />
    );
  }

  return (
    <CachedImage
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding="async"
      onError={() => setPosterFailed(true)}
    />
  );
};

export default VideoThumbnail;
