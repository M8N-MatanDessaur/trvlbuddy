import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Loader2, ExternalLink, PartyPopper, ShoppingBag, Palette, Music, Sparkles, Tag } from 'lucide-react';
import { useContextEngine } from '../../contexts/ContextEngineContext';
import { fetchLiveEvents, type LocalEvent } from '../../services/liveEventsService';
import type { LucideIcon } from 'lucide-react';

const typeIcons: Record<LocalEvent['type'], LucideIcon> = {
  festival: PartyPopper,
  market: ShoppingBag,
  exhibition: Palette,
  performance: Music,
  popup: Sparkles,
  other: Tag,
};

const LiveEventsSection: React.FC = () => {
  const { moment } = useContextEngine();
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (moment.tripPhase !== 'active' || !moment.currentDestination) return;
    if (hasLoaded) return;

    let cancelled = false;
    setLoading(true);

    const dest = moment.currentDestination;
    fetchLiveEvents(dest.name, dest.coordinates).then((result) => {
      if (!cancelled) {
        setEvents(result);
        setHasLoaded(true);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [moment.tripPhase, moment.currentDestination, hasLoaded]);

  if (moment.tripPhase !== 'active') return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-1">
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Finding what is happening nearby...
        </span>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar size={14} style={{ color: 'var(--accent)' }} />
        <h2 className="text-[15px] font-bold">Happening Now</h2>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {events.map((event, i) => {
          const TypeIcon = typeIcons[event.type] || Tag;
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;

          return (
            <div
              key={`${event.name}-${i}`}
              className="flex-shrink-0 snap-start"
              style={{ width: '260px' }}
            >
              <div
                className="h-full rounded-2xl p-4 flex flex-col gap-2.5"
                style={{ background: 'var(--surface-container)' }}
              >
                {/* Type badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                    style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                  >
                    <TypeIcon size={10} />
                    {event.type}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {event.time}
                  </span>
                </div>

                {/* Name */}
                <h4
                  className="font-bold text-[13px] leading-tight"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  } as React.CSSProperties}
                >
                  {event.name}
                </h4>

                {/* Description */}
                <p
                  className="text-[11px] leading-relaxed flex-1"
                  style={{
                    color: 'var(--text-secondary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  } as React.CSSProperties}
                >
                  {event.description}
                </p>

                {/* Location link */}
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] font-medium no-underline truncate"
                  style={{ color: 'var(--accent)' }}
                >
                  <MapPin size={10} className="flex-shrink-0" />
                  <span className="truncate">{event.location}</span>
                  <ExternalLink size={9} className="flex-shrink-0" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] px-1" style={{ color: 'var(--text-tertiary)' }}>
        Powered by AI. Verify event details before attending.
      </p>
    </div>
  );
};

export default LiveEventsSection;
