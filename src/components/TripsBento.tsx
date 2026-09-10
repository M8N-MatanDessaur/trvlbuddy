import React from 'react';
import { CalendarDays, Loader2, MapPin, Plane, Plus } from 'lucide-react';
import type { Trip } from '../lib/supabase';

/**
 * Trips as a bento, not a carousel.
 *
 * A carousel hides everything but one trip and asks you to swipe to find out
 * what you have. A profile should just say it: this is where you have been
 * and where you are going, all visible at once. The trip you are currently
 * on takes the wide tile, because it is the one you would be opening.
 *
 * Tiles are the same family as the counters above them, so the profile reads
 * as one object rather than a page of unrelated sections.
 */
interface Props {
  trips: Trip[];
  /** The trip currently loaded, which gets the wide tile. */
  activeTripId?: string | null;
  onSelect: (trip: Trip) => void;
  onPlanTrip: () => void;
  busyTripId?: string | null;
}

function formatDateRange(start: string | null, end: string | null): string | null {
  const format = (value: string) => {
    try {
      return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return value;
    }
  };
  if (start && end) {
    const from = format(start);
    const to = format(end);
    return from === to ? from : `${from} - ${to}`;
  }
  if (start) return format(start);
  if (end) return format(end);
  return null;
}

/** Days until it starts, or nothing when it is past or undated. */
function countdown(start: string | null): string | null {
  if (!start) return null;
  const then = new Date(start).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.ceil((then - Date.now()) / 86400000);
  if (days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 60) return `In ${days} days`;
  return null;
}

const TripsBento: React.FC<Props> = ({
  trips,
  activeTripId,
  onSelect,
  onPlanTrip,
  busyTripId,
}) => {
  // The live trip first and wide; the rest in the order they came.
  const ordered = [...trips].sort((a, b) => {
    if (a.id === activeTripId) return -1;
    if (b.id === activeTripId) return 1;
    return 0;
  });

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
    >
      {ordered.map((trip, i) => {
        const isActive = Boolean(activeTripId) && trip.id === activeTripId;
        // The active trip, or the only trip, earns the full width.
        const wide = isActive || (ordered.length === 1 && i === 0);
        const cities = (trip.cities || []).join(' · ');
        const dates = formatDateRange(trip.start_date, trip.end_date);
        const soon = countdown(trip.start_date);
        const busy = busyTripId === trip.id;

        return (
          <button
            key={trip.id}
            type="button"
            onClick={() => onSelect(trip)}
            disabled={Boolean(busyTripId)}
            className="rounded-2xl p-3.5 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{
              gridColumn: wide ? 'span 2' : undefined,
              minHeight: '6.5rem',
              background: isActive
                ? 'linear-gradient(150deg, color-mix(in srgb, var(--accent) 24%, var(--surface-container-high)) 0%, var(--surface-container-high) 72%)'
                : 'var(--surface-container-high)',
              border: 'none',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center gap-2">
              {busy ? (
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
              ) : (
                <MapPin size={16} style={{ color: 'var(--accent)' }} />
              )}
              {/* Where the tile says something about itself: on this trip
                  now, or how soon it starts. */}
              {isActive ? (
                <span
                  className="text-[10px] font-extrabold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  On this trip
                </span>
              ) : soon ? (
                <span
                  className="text-[10.5px] font-bold"
                  style={{ color: 'var(--accent)' }}
                >
                  {soon}
                </span>
              ) : null}
            </div>

            <div
              className="font-extrabold tracking-tight mt-2 leading-tight"
              style={{
                fontSize: wide ? '17px' : '14.5px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              } as React.CSSProperties}
            >
              {trip.title}
            </div>

            <div
              className="text-[11.5px] mt-1 truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {cities || 'No cities yet'}
            </div>

            {dates && (
              <div
                className="inline-flex items-center gap-1 text-[10.5px] font-bold mt-1.5"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <CalendarDays size={11} />
                {dates}
              </div>
            )}
          </button>
        );
      })}

      {/* Always last, always present: the way to start one. It is a tile so
          an empty trips section is still a bento rather than a placeholder. */}
      <button
        type="button"
        onClick={onPlanTrip}
        className="rounded-2xl p-3.5 flex flex-col items-start justify-center gap-2 transition-transform active:scale-[0.98]"
        style={{
          gridColumn: trips.length === 0 ? 'span 2' : undefined,
          minHeight: '6.5rem',
          background: 'transparent',
          border: '1px dashed var(--outline)',
          color: 'var(--text-primary)',
        }}
      >
        <span
          className="rounded-xl flex items-center justify-center"
          style={{
            width: '30px',
            height: '30px',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
          }}
        >
          <Plus size={16} />
        </span>
        <span className="text-[13px] font-bold">
          {trips.length === 0 ? 'Plan your first trip' : 'Plan a trip'}
        </span>
        {trips.length === 0 && (
          <span className="text-[11.5px] inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Plane size={11} />
            Somewhere you are going, saved for later
          </span>
        )}
      </button>
    </div>
  );
};

export default TripsBento;
