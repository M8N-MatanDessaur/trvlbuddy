import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, ExternalLink, PartyPopper, ShoppingBag, Palette, Music, Sparkles, Tag, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fetchLiveEvents, type LocalEvent } from '../../services/liveEventsService';
import { UserLocation } from '../../utils/geolocation';

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

const typeIcons: Record<LocalEvent['type'], LucideIcon> = {
  festival: PartyPopper,
  market: ShoppingBag,
  exhibition: Palette,
  performance: Music,
  popup: Sparkles,
  other: Tag,
};

interface Props {
  userLocation: UserLocation;
}

interface GeocodeResult {
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
}

async function reverseGeocodeLocality(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const results: GeocodeResult[] = data.results;
    // Prefer the first result that has a locality component
    for (const r of results) {
      const comps = r.address_components || [];
      const locality = comps.find(c => c.types.includes('locality'));
      const admin = comps.find(c => c.types.includes('administrative_area_level_1'));
      const country = comps.find(c => c.types.includes('country'));
      if (locality) {
        return [locality.long_name, admin?.short_name || country?.long_name].filter(Boolean).join(', ');
      }
    }
    // Fallback: first result's admin area + country
    const first = results[0];
    const comps = first.address_components || [];
    const admin = comps.find(c => c.types.includes('administrative_area_level_1'));
    const country = comps.find(c => c.types.includes('country'));
    return [admin?.long_name, country?.long_name].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

const NearbyLiveEvents: React.FC<Props> = ({ userLocation }) => {
  const [events, setEvents] = useState<LocalEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [localityName, setLocalityName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const name = await reverseGeocodeLocality(userLocation.lat, userLocation.lng);
      if (cancelled) return;
      setLocalityName(name);
      const displayName = name || 'this area';
      const result = await fetchLiveEvents(displayName, { lat: userLocation.lat, lng: userLocation.lng });
      if (cancelled) return;
      setEvents(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userLocation.lat, userLocation.lng]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 px-1 mb-4">
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Finding what's happening around you...
        </span>
      </div>
    );
  }

  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-2.5 mb-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--accent)' }} />
          <h2 className="text-[14px] font-bold">Happening Now</h2>
        </div>
        {localityName && (
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {localityName}
          </span>
        )}
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
              style={{ width: '250px' }}
            >
              <div
                className="h-full rounded-2xl p-3.5 flex flex-col gap-2"
                style={{ background: 'var(--surface-container)' }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize"
                    style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                  >
                    <TypeIcon size={10} />
                    {event.type}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {event.time}
                  </span>
                </div>
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

export default NearbyLiveEvents;
