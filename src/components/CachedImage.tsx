import React, { useState, useEffect, useRef } from 'react';
import { getOrCacheImage } from '../services/imageCacheService';

interface CachedImageProps {
  src: string;
  /**
   * Stable logical key for the blob cache (e.g. `${placeId}:${index}`).
   * When provided, we look up and store by this key, so Google rotating the
   * photo_reference / photoName token in `src` between searches doesn't miss
   * the cache and bill another Places Photo request.
   */
  cacheKey?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
}

const CachedImage: React.FC<CachedImageProps> = ({ src, cacheKey, alt = '', className, style, onLoad, onError, loading }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setResolvedSrc(null);

    getOrCacheImage(src, cacheKey).then(url => {
      if (!mountedRef.current) return;
      // Track blob URLs so we can revoke them on cleanup
      if (url.startsWith('blob:')) {
        blobUrlRef.current = url;
      }
      setResolvedSrc(url);
    });

    return () => {
      mountedRef.current = false;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src, cacheKey]);

  if (!resolvedSrc) {
    // Return nothing while resolving; parent handles shimmer/placeholder
    return null;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={onError}
      loading={loading}
    />
  );
};

export default CachedImage;
