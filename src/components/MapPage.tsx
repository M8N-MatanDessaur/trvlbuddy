import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import type { Accommodation, GeneratedActivity, TripSegment } from '../types/TravelData';
import { supabase } from '../lib/supabase';
import { geocode } from '../services/geocodingService';
import DynamicActivityModal from './DynamicActivityModal';

interface MapPoint {
  id: string;
  kind: 'hotel' | 'activity';
  name: string;
  subtitle?: string | null;
  lat: number;
  lng: number;
  activity?: GeneratedActivity;
  category?: string;
}

function hotelIconHtml(): string {
  return `
  <div style="
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--accent); color: var(--on-accent);
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    border: 2px solid white;
  ">
    <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M2 4v16'/>
      <path d='M2 8h18a2 2 0 0 1 2 2v10'/>
      <path d='M2 17h20'/>
      <path d='M6 8v9'/>
    </svg>
  </div>`;
}

function activityIconHtml(): string {
  return `
  <div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: white; color: var(--accent);
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 3px 8px rgba(0,0,0,0.3);
    border: 2px solid var(--accent);
  ">
    <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='currentColor'>
      <circle cx='12' cy='12' r='6' />
    </svg>
  </div>`;
}

const MapPage: React.FC = () => {
  const { currentPlan, activities } = useTravel();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [openActivity, setOpenActivity] = useState<GeneratedActivity | null>(null);

  // Identify the hotels we already have coordinates for, plus the city pivot
  // we'll use as the geocode hint and as the fallback map center.
  const { seedPoints, geocodeQueries } = useMemo(() => {
    const seeds: MapPoint[] = [];
    const queries: Array<{ id: string; query: string; activity: GeneratedActivity }> = [];

    if (!currentPlan) {
      return { seedPoints: seeds, geocodeQueries: queries };
    }

    const segments: TripSegment[] = currentPlan.segments || [];
    const accommodations: Accommodation[] = [
      ...segments.flatMap((s) => s.accommodations || []),
      ...(currentPlan.accommodations || []),
    ];

    // Hotels (only those with coords are seeded; the rest get geocoded below).
    accommodations.forEach((acc) => {
      if (acc.coordinates) {
        seeds.push({
          id: `hotel-${acc.id}`,
          kind: 'hotel',
          name: acc.name || 'Accommodation',
          subtitle: acc.address || null,
          lat: acc.coordinates.lat,
          lng: acc.coordinates.lng,
        });
      }
    });

    // Activities — queue every one for geocoding using its location string +
    // the segment city/country as context for accuracy.
    const fallbackCity = segments[0]?.city?.name || segments[0]?.destination?.name
      || currentPlan.destination?.name || currentPlan.destinations?.[0]?.name || '';
    const fallbackCountry = segments[0]?.destination?.country
      || currentPlan.destination?.country || currentPlan.destinations?.[0]?.country || '';

    activities.forEach((activity, i) => {
      const parts = [activity.name, activity.location, fallbackCity, fallbackCountry]
        .map((p) => (p || '').trim())
        .filter(Boolean);
      const query = Array.from(new Set(parts)).join(', ');
      if (!query) return;
      queries.push({ id: `act-${i}-${activity.name}`, query, activity });
    });

    return { seedPoints: seeds, geocodeQueries: queries };
  }, [currentPlan, activities]);

  // Initialise Leaflet once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([20, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Seed initial points and geocode the rest.
  useEffect(() => {
    let cancelled = false;
    setPoints(seedPoints);
    setPendingCount(geocodeQueries.length);

    if (geocodeQueries.length === 0 && !seedPoints.length && currentPlan) {
      // No hotel coords + no activities to geocode — center on the city name.
      const cityName = currentPlan.segments?.[0]?.city?.name
        || currentPlan.segments?.[0]?.destination?.name
        || currentPlan.destination?.name
        || currentPlan.destinations?.[0]?.name;
      if (cityName) {
        geocode(cityName).then((res) => {
          if (cancelled || !res || !mapRef.current) return;
          mapRef.current.setView([res.lat, res.lng], 12);
        });
      }
    }

    (async () => {
      for (const q of geocodeQueries) {
        if (cancelled) return;
        const res = await geocode(q.query);
        if (cancelled) return;
        setPendingCount((n) => Math.max(0, n - 1));
        if (!res) continue;
        setPoints((prev) => {
          if (prev.some((p) => p.id === q.id)) return prev;
          return [
            ...prev,
            {
              id: q.id,
              kind: 'activity',
              name: q.activity.name,
              subtitle: q.activity.location || null,
              lat: res.lat,
              lng: res.lng,
              activity: q.activity,
              category: q.activity.category,
            },
          ];
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seedPoints, geocodeQueries, currentPlan]);

  // Render markers + auto-fit when the point set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (points.length === 0) return;

    points.forEach((point) => {
      const html = point.kind === 'hotel' ? hotelIconHtml() : activityIconHtml();
      const icon = L.divIcon({
        className: 'trvl-map-marker',
        html,
        iconSize: point.kind === 'hotel' ? [36, 36] : [28, 28],
        iconAnchor: point.kind === 'hotel' ? [18, 18] : [14, 14],
        popupAnchor: [0, -16],
      });
      const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
      const popupHtml = `
        <div style="font-family: inherit; max-width: 220px;">
          <div style="font-weight: 800; font-size: 13.5px; line-height: 1.2; margin-bottom: 2px;">
            ${escapeHtml(point.name)}
          </div>
          ${point.subtitle ? `<div style="font-size: 11.5px; color: #666; line-height: 1.3;">${escapeHtml(point.subtitle)}</div>` : ''}
          ${point.kind === 'activity'
            ? `<button data-act="open" style="margin-top: 8px; padding: 6px 10px; border-radius: 9999px; background: var(--accent); color: var(--on-accent); border: none; font-weight: 700; font-size: 11.5px; cursor: pointer;">Open details</button>`
            : ''}
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.on('popupopen', (e) => {
        const node = (e as { popup: L.Popup }).popup.getElement();
        if (!node) return;
        const btn = node.querySelector<HTMLButtonElement>('[data-act="open"]');
        if (btn && point.activity) {
          btn.onclick = () => {
            marker.closePopup();
            setOpenActivity(point.activity ?? null);
          };
        }
      });
      markersRef.current.push(marker);
    });

    // Fit bounds to all points (with padding).
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [points]);

  // Persist activity coordinates back to supabase so the AI/feed flows can use
  // them later (keyed by slug derived from googlePlaceId or name+city).
  useEffect(() => {
    if (points.length === 0) return;
    points.filter((p) => p.kind === 'activity' && p.activity).forEach(async (p) => {
      if (!p.activity) return;
      const slug = p.activity.placeId
        ? `gpid-${p.activity.placeId}`
        : '';
      if (!slug) return;
      // Only update if lat/lng is missing on the row (avoid overwriting accurate values).
      const { data: row } = await supabase
        .from('activities')
        .select('id, lat, lng')
        .eq('slug', slug)
        .maybeSingle();
      if (!row) return;
      if (row.lat != null && row.lng != null) return;
      await supabase
        .from('activities')
        .update({ lat: p.lat, lng: p.lng })
        .eq('id', row.id);
    });
  }, [points]);

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center py-16">
          <h2 className="mb-3">No Travel Plan</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Plan a trip from the + tab to see it on the map.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page space-y-3" style={{ paddingBottom: 0 }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 flex items-center gap-2">
            <MapPin size={22} style={{ color: 'var(--accent)' }} />
            Map
          </h1>
          <p className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
            {points.length === 0 && pendingCount > 0
              ? `Plotting your trip${'\u2026'}`
              : pendingCount > 0
              ? `${points.length} on the map · ${pendingCount} more loading${'\u2026'}`
              : `${points.length} ${points.length === 1 ? 'place' : 'places'} on the map`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--accent)', border: '2px solid white' }} />
            Hotel
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ width: 12, height: 12, borderRadius: 6, background: 'white', border: '2px solid var(--accent)' }} />
            Activity
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 'calc(100vh - 12rem)',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '0.5px solid var(--outline)',
        }}
      />

      <DynamicActivityModal
        activity={openActivity}
        isOpen={!!openActivity}
        onClose={() => setOpenActivity(null)}
      />
    </section>
  );
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default MapPage;
