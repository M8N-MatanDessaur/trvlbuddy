import React from 'react';

interface CachedImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
}

const CachedImage: React.FC<CachedImageProps> = ({ src, alt = '', className, style, onLoad, onError, loading }) => (
  <img src={src} alt={alt} className={className} style={style} onLoad={onLoad} onError={onError} loading={loading} />
);

export default CachedImage;
