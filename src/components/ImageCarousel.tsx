import React, { useEffect, useMemo, useRef, useState } from 'react';
import { warmImageCache } from '../lib/imagePrefetch';
import { purgeCachedImage } from '../lib/purgeImage';
import { thumbhashToCssDataUrl } from '../lib/thumbhash';

interface Props {
  images: string[];
  thumbhashes?: (string | null | undefined)[];
  className?: string;
  style?: React.CSSProperties;
  eagerCount?: number;
  onIndexChange?: (index: number) => void;
}

// On error we ask the SW to drop the cached entry, then remount the <img>
// via the key. The fresh fetch fully replaces the bad cache entry on
// success — unlike a `?_r=N` cachebuster, which leaves the original URL
// poisoned and just creates a parallel cache entry that fills the bucket.
const MAX_RETRIES = 2;

const ImageCarousel: React.FC<Props> = ({ images, thumbhashes, className, style, eagerCount = 2, onIndexChange }) => {
  const [index, setIndex] = useState(0);
  // Track loaded/errored state by URL, not by index. Parents may hand back a
  // fresh array on every state update with the same URLs, and surviving
  // <img> elements (stable key={src}) won't remount or refire onLoad — so
  // index-keyed state would falsely mark them as not-yet-loaded and hide
  // them at opacity 0 forever.
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());
  const [erroredUrls, setErroredUrls] = useState<Set<string>>(new Set());
  const [retryByUrl, setRetryByUrl] = useState<Map<string, number>>(new Map());
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const imagesKey = useMemo(() => images.join(' '), [images]);
  useEffect(() => {
    setIndex(0);
    warmImageCache(images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesKey]);

  const handleImageError = (src: string) => {
    const attempts = retryByUrl.get(src) ?? 0;
    if (attempts >= MAX_RETRIES) {
      setErroredUrls((prev) => {
        if (prev.has(src)) return prev;
        const next = new Set(prev);
        next.add(src);
        return next;
      });
      return;
    }
    purgeCachedImage(src);
    setRetryByUrl((prev) => {
      const next = new Map(prev);
      next.set(src, attempts + 1);
      return next;
    });
  };

  const valid = useMemo(
    () => images
      .map((src, originalIndex) => ({ src, originalIndex }))
      .filter((entry) => !erroredUrls.has(entry.src)),
    [images, erroredUrls],
  );
  const count = valid.length;

  useEffect(() => {
    const active = valid[index];
    if (active) onIndexChange?.(active.originalIndex);
  }, [index, valid, onIndexChange]);

  const go = (next: number) => {
    if (count === 0) return;
    if (next < 0) next = count - 1;
    if (next >= count) next = 0;
    setIndex(next);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) swiping.current = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || !swiping.current) {
      touchStart.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchStart.current = null;
    swiping.current = false;
  };

  if (count === 0) return null;

  const activeSrc = valid[index]?.src;
  const activeLoaded = activeSrc ? loadedUrls.has(activeSrc) : false;

  return (
    <div
      className={className}
      style={{ overflow: 'hidden', ...style }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {images.map((src, i) => {
        if (erroredUrls.has(src)) return null;
        const validIdx = valid.findIndex((entry) => entry.originalIndex === i);
        const isActive = validIdx === index;
        const attempt = retryByUrl.get(src) ?? 0;
        // Key includes the retry count so a fresh <img> element is created
        // each retry — without that, the browser would re-use the cached
        // (poisoned) response for the same DOM node.
        return (
          <img
            key={`${src}|${attempt}`}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: isActive && loadedUrls.has(src) ? 1 : 0,
              transition: 'opacity 0.35s ease',
            }}
            onLoad={() => setLoadedUrls((prev) => {
              if (prev.has(src)) return prev;
              const next = new Set(prev);
              next.add(src);
              return next;
            })}
            onError={() => handleImageError(src)}
            loading={i < eagerCount ? 'eager' : 'lazy'}
            decoding="async"
            crossOrigin="anonymous"
          />
        );
      })}

      {!activeLoaded && (() => {
        const activeEntry = valid[index];
        const placeholder = activeEntry && thumbhashes
          ? thumbhashToCssDataUrl(thumbhashes[activeEntry.originalIndex])
          : null;
        return (
          <div
            className={placeholder ? 'absolute inset-0' : 'absolute inset-0 activity-card-shimmer'}
            style={{
              background: placeholder
                ? `center / cover no-repeat url(${placeholder})`
                : 'var(--surface-container-high)',
            }}
          />
        );
      })()}

      {count > 1 && (
        <div className="absolute bottom-3 left-4 flex items-center gap-1.5 z-10">
          {valid.map((entry, i) => (
            <div
              key={entry.originalIndex}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === index ? '14px' : '5px',
                height: '5px',
                background: i === index ? 'white' : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageCarousel;
