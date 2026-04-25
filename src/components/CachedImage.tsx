import React, { useEffect, useState } from 'react';
import { purgeCachedImage } from '../lib/purgeImage';

interface CachedImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
  width?: number;
  height?: number;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  draggable?: boolean;
  // crossOrigin defaults to "anonymous" so the service worker receives a
  // typed CORS response it can validate (response.ok). Without this, all
  // image fetches are opaque and the SW can't tell success from failure.
  crossOrigin?: 'anonymous' | 'use-credentials' | '';
}

// On error we ask the SW to drop the cached entry, then remount the same
// <img> via a key bump. The fresh fetch fully replaces the bad cache entry
// on success — unlike a `?_r=N` cachebuster, which leaves the original URL
// poisoned forever and just creates a parallel cache entry.
const MAX_RETRIES = 2;

const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt = '',
  className,
  style,
  onLoad,
  onError,
  loading,
  decoding,
  width,
  height,
  referrerPolicy,
  draggable,
  crossOrigin = 'anonymous',
}) => {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  const handleError = () => {
    if (attempt < MAX_RETRIES) {
      purgeCachedImage(src);
      setAttempt(attempt + 1);
      return;
    }
    onError?.();
  };

  return (
    <img
      key={`${src}|${attempt}`}
      src={src}
      alt={alt}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={handleError}
      loading={loading}
      decoding={decoding}
      width={width}
      height={height}
      referrerPolicy={referrerPolicy}
      draggable={draggable}
      crossOrigin={crossOrigin}
    />
  );
};

export default CachedImage;
