import React, { useState, useEffect, useRef } from 'react';
import { getOrCacheImage } from '../services/imageCacheService';

interface CachedImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
}

const CachedImage: React.FC<CachedImageProps> = ({ src, alt = '', className, style, onLoad, onError, loading }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setResolvedSrc(null);

    getOrCacheImage(src).then(url => {
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
  }, [src]);

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
