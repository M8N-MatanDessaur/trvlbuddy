import React, { useEffect, useRef, useState } from 'react';
import { GeneratedActivity } from '../../types/TravelData';
import ExploreActivityCard from './ExploreActivityCard';

interface Props {
  activities: GeneratedActivity[];
  cityName: string | null;
  country: string | null;
  onOpenDetails: (activity: GeneratedActivity) => void;
}

// One card visible per page. Swipe-only navigation; a thin progress bar plus
// a counter shows position. We avoid <button> dots because a global CSS rule
// (`@media (pointer: coarse) button { min-width: 44px; min-height: 44px }`)
// inflates any small <button>.
const ExploreCardCarousel: React.FC<Props> = ({
  activities,
  cityName,
  country,
  onOpenDetails,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

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

  const total = activities.length;
  const progress = total > 1 ? ((index + 1) / total) * 100 : 100;

  return (
    <div>
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

      {total > 1 && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: '3px', background: 'var(--surface-container-high)' }}
          >
            <div
              className="h-full transition-all duration-200 ease-out"
              style={{
                width: `${progress}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
          <span
            className="text-[10.5px] font-bold tabular-nums"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {index + 1} / {total}
          </span>
        </div>
      )}
    </div>
  );
};

export default ExploreCardCarousel;
