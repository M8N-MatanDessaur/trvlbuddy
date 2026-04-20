import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, MapPin } from 'lucide-react';
import type { Trip } from '../lib/supabase';

interface Props {
  trips: Trip[];
  activeTripId?: string | null;
  onSelect: (trip: Trip) => void;
  busyTripId?: string | null;
  selectLabel?: string;
}

function formatDateRange(start: string | null, end: string | null): string | null {
  const fmt = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return null;
}

const TripsCarousel: React.FC<Props> = ({
  trips,
  activeTripId,
  onSelect,
  busyTripId,
  selectLabel = 'Open',
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
  }, [trips.length]);

  if (trips.length === 0) return null;

  const total = trips.length;
  const progress = total > 1 ? ((index + 1) / total) * 100 : 100;

  return (
    <div>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
      >
        {trips.map((trip) => {
          const isActive = activeTripId && trip.id === activeTripId;
          const dateRange = formatDateRange(trip.start_date, trip.end_date);
          const cities = (trip.cities || []).join(' · ');
          return (
            <div
              key={trip.id}
              className="snap-center flex-shrink-0"
              style={{ width: '92%' }}
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: isActive ? 'var(--accent-container)' : 'var(--surface-container-high)',
                  border: isActive ? '1px solid var(--accent)' : '0.5px solid var(--outline)',
                  padding: '1rem',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      width: '40px',
                      height: '40px',
                      background: isActive ? 'var(--accent)' : 'var(--accent-container)',
                      color: isActive ? 'white' : 'var(--accent)',
                    }}
                  >
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-extrabold tracking-tight truncate">
                      {trip.title}
                    </div>
                    <div
                      className="text-[12px] truncate mt-0.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {cities || 'No cities yet'}
                    </div>
                    {dateRange && (
                      <div
                        className="inline-flex items-center gap-1 text-[11px] font-bold mt-1.5"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <Calendar size={10} />
                        {dateRange}
                      </div>
                    )}
                  </div>
                  {isActive && <Check size={16} style={{ color: 'var(--accent)' }} />}
                </div>

                <button
                  onClick={() => onSelect(trip)}
                  disabled={busyTripId === trip.id}
                  className="w-full mt-3 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-[0.985] disabled:opacity-60"
                  style={{
                    background: isActive ? 'var(--surface-container)' : 'var(--accent)',
                    color: isActive ? 'var(--text-primary)' : 'white',
                    border: 'none',
                    minHeight: 0,
                  }}
                >
                  {busyTripId === trip.id ? 'Loading...' : isActive ? 'Currently here' : selectLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: '3px', background: 'var(--surface-container-high)' }}
          >
            <div
              className="h-full transition-all duration-200 ease-out"
              style={{ width: `${progress}%`, background: 'var(--accent)' }}
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

export default TripsCarousel;
