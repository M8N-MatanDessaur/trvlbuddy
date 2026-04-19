import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GeneratedActivity } from '../../types/TravelData';
import ExploreActivityCard from './ExploreActivityCard';

interface Props {
  activities: GeneratedActivity[];
  cityName: string | null;
  country: string | null;
  onOpenDetails: (activity: GeneratedActivity) => void;
}

// One card visible per page; user pages through with swipe, dots, or arrows.
// Distinct from the Nearby feed's infinite vertical scroll.
const ExploreCardCarousel: React.FC<Props> = ({
  activities,
  cityName,
  country,
  onOpenDetails,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  const scrollToIndex = useCallback((next: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = el.children[next] as HTMLElement | undefined;
    if (target) {
      el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    }
  }, []);

  // Track which card is most visible based on scroll position.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = el.scrollLeft + el.clientWidth / 2;
        let closest = 0;
        let closestDist = Infinity;
        Array.from(el.children).forEach((child, i) => {
          const node = child as HTMLElement;
          const childCenter = node.offsetLeft + node.clientWidth / 2;
          const dist = Math.abs(childCenter - center);
          if (dist < closestDist) {
            closestDist = dist;
            closest = i;
          }
        });
        setIndex(closest);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [activities.length]);

  if (activities.length === 0) return null;

  const goPrev = () => scrollToIndex(Math.max(0, index - 1));
  const goNext = () => scrollToIndex(Math.min(activities.length - 1, index + 1));

  const showArrows = activities.length > 1;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex overflow-x-auto snap-x snap-mandatory -mx-1 pb-1"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
      >
        {activities.map((activity, i) => (
          <div
            key={`${activity.name}-${i}`}
            className="snap-center flex-shrink-0 px-1"
            style={{ width: '100%' }}
          >
            <ExploreActivityCard
              activity={activity}
              cityName={cityName}
              country={country}
              onOpenDetails={onOpenDetails}
            />
          </div>
        ))}
      </div>

      {showArrows && (
        <>
          {index > 0 && (
            <button
              onClick={goPrev}
              className="absolute top-1/2 -translate-y-1/2 left-1 transition-transform active:scale-90"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Previous activity"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {index < activities.length - 1 && (
            <button
              onClick={goNext}
              className="absolute top-1/2 -translate-y-1/2 right-1 transition-transform active:scale-90"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Next activity"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </>
      )}

      {activities.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {activities.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className="rounded-full transition-all"
              style={{
                width: i === index ? '18px' : '6px',
                height: '6px',
                background: i === index ? 'var(--accent)' : 'var(--surface-container-high)',
                border: 'none',
                padding: 0,
              }}
              aria-label={`Go to activity ${i + 1}`}
            />
          ))}
          <span
            className="ml-2 text-[10.5px] font-bold"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {index + 1} / {activities.length}
          </span>
        </div>
      )}
    </div>
  );
};

export default ExploreCardCarousel;
