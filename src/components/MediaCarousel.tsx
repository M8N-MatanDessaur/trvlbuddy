import React, { useEffect, useMemo, useRef, useState } from 'react';
import { warmImageCache } from '../lib/imagePrefetch';
import { purgeCachedImage } from '../lib/purgeImage';
import { thumbhashToCssDataUrl } from '../lib/thumbhash';

// Slide types for the unified media carousel. The carousel stays
// dumb — it just renders whatever items are passed in — so callers
// can mix photos and short videos in the same horizontal swipe deck.
export type MediaSlide =
  | { kind: 'image'; src: string; thumbhash?: string | null }
  | {
      kind: 'video';
      src: string;
      posterUrl: string;
      thumbhash?: string | null;
      startMs?: number | null;
      durationMs?: number | null;
    };

interface Props {
  items: MediaSlide[];
  className?: string;
  style?: React.CSSProperties;
  eagerCount?: number;
  onIndexChange?: (index: number) => void;
}

const MAX_RETRIES = 2;

// Auto-play, muted, no-controls, looped-within-window video for the
// carousel slot. The trim window applies via seek + timeupdate snap-back
// (the source file is the full clip; the player enforces start/end).
const SlideVideo: React.FC<{
  src: string;
  posterUrl: string;
  startMs?: number | null;
  durationMs?: number | null;
  isActive: boolean;
}> = ({ src, posterUrl, startMs, durationMs, isActive }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const startSec = startMs && startMs > 0 ? startMs / 1000 : 0;
  const endSec = durationMs && durationMs > 0 ? startSec + durationMs / 1000 : null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trySeek = () => {
      if (startSec > 0 && Math.abs(el.currentTime - startSec) > 0.05) {
        try { el.currentTime = startSec; } catch { /* noop */ }
      }
    };
    if (el.readyState >= 1) trySeek();
    el.addEventListener('loadedmetadata', trySeek);
    return () => el.removeEventListener('loadedmetadata', trySeek);
  }, [src, startSec]);

  // Snap back to the trim start once the cursor crosses the window end.
  useEffect(() => {
    const el = ref.current;
    if (!el || endSec === null) return;
    const onTimeUpdate = () => {
      if (el.currentTime >= endSec - 0.05) {
        try {
          el.currentTime = startSec;
          if (isActive) void el.play().catch(() => {});
        } catch { /* noop */ }
      } else if (el.currentTime < startSec - 0.05) {
        try { el.currentTime = startSec; } catch { /* noop */ }
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [startSec, endSec, isActive]);

  // Pause when the slide isn't the active one — saves battery and avoids
  // garbled audio if the muted-attribute ever falls off (it shouldn't).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isActive) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive]);

  return (
    <video
      ref={ref}
      src={src}
      poster={posterUrl}
      muted
      playsInline
      autoPlay={isActive}
      preload="metadata"
      className="absolute inset-0 w-full h-full"
      style={{ objectFit: 'cover', display: 'block', background: 'black' }}
    />
  );
};

const MediaCarousel: React.FC<Props> = ({ items, className, style, eagerCount = 2, onIndexChange }) => {
  const [index, setIndex] = useState(0);
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());
  const [erroredUrls, setErroredUrls] = useState<Set<string>>(new Set());
  const [retryByUrl, setRetryByUrl] = useState<Map<string, number>>(new Map());
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const itemsKey = useMemo(
    () => items.map((it) => `${it.kind}:${it.src}`).join(' '),
    [items],
  );
  useEffect(() => {
    setIndex(0);
    // Pre-warm whichever URLs the browser will actually fetch up front
    // (image bodies + video posters). Source video bodies are large and
    // start when the slide goes active.
    warmImageCache(
      items.map((it) => (it.kind === 'image' ? it.src : it.posterUrl)).filter(Boolean) as string[],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

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

  // Drop image slides whose body refuses to load even after retries.
  // Video slides stay (the poster image has its own retry path; the
  // <video> element itself can recover from a transient miss).
  const valid = useMemo(
    () => items
      .map((slide, originalIndex) => ({ slide, originalIndex }))
      .filter((entry) => entry.slide.kind === 'video' || !erroredUrls.has(entry.slide.src)),
    [items, erroredUrls],
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

  const activeEntry = valid[index];
  const activeSlide = activeEntry?.slide;
  const activeImageLoaded =
    activeSlide && activeSlide.kind === 'image' ? loadedUrls.has(activeSlide.src) : true;

  return (
    <div
      className={className}
      style={{ overflow: 'hidden', ...style }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {items.map((slide, i) => {
        const validIdx = valid.findIndex((entry) => entry.originalIndex === i);
        const isActive = validIdx === index;

        if (slide.kind === 'image') {
          if (erroredUrls.has(slide.src)) return null;
          const attempt = retryByUrl.get(slide.src) ?? 0;
          return (
            <img
              key={`${slide.src}|${attempt}`}
              src={slide.src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: isActive && loadedUrls.has(slide.src) ? 1 : 0,
                transition: 'opacity 0.35s ease',
              }}
              onLoad={() => setLoadedUrls((prev) => {
                if (prev.has(slide.src)) return prev;
                const next = new Set(prev);
                next.add(slide.src);
                return next;
              })}
              onError={() => handleImageError(slide.src)}
              loading={i < eagerCount ? 'eager' : 'lazy'}
              decoding="async"
              crossOrigin="anonymous"
            />
          );
        }

        // Video slide. We render only the active video element to keep
        // memory + decode pressure low when many cards live in the feed
        // — non-active videos collapse to a poster image until they
        // become active again.
        if (!isActive) {
          return (
            <img
              key={`${slide.src}|poster`}
              src={slide.posterUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0, transition: 'opacity 0.35s ease' }}
              loading="lazy"
              decoding="async"
              crossOrigin="anonymous"
            />
          );
        }
        return (
          <SlideVideo
            key={`${slide.src}|video`}
            src={slide.src}
            posterUrl={slide.posterUrl}
            startMs={slide.startMs}
            durationMs={slide.durationMs}
            isActive={isActive}
          />
        );
      })}

      {!activeImageLoaded && (() => {
        if (!activeSlide) return null;
        const placeholder = thumbhashToCssDataUrl(activeSlide.thumbhash || null);
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
              key={`${entry.slide.kind}-${entry.originalIndex}`}
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

export default MediaCarousel;
