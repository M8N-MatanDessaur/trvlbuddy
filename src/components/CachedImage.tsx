import React, { useEffect, useState } from 'react';

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

// An <img> request can be aborted mid-flight when its parent unmounts during
// a route change, and some browsers (and intermediate caches) hold onto the
// aborted/partial response. The next mount with the same URL then reads that
// poisoned entry from cache, fires onError, and shows a broken placeholder
// that survives full page reloads. Retrying the same URL with a throwaway
// query param forces a fresh fetch from origin and replaces the bad entry.
const MAX_RETRIES = 2;

const cacheBust = (url: string, attempt: number): string => {
  if (attempt <= 0) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_r=${attempt}`;
};

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

  // Reset retry count when the underlying URL changes, otherwise a fresh
  // image inherits the previous URL's attempt counter.
  useEffect(() => {
    setAttempt(0);
  }, [src]);

  const handleError = () => {
    if (attempt < MAX_RETRIES) {
      setAttempt(attempt + 1);
      return;
    }
    onError?.();
  };

  return (
    <img
      key={`${src}|${attempt}`}
      src={cacheBust(src, attempt)}
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
