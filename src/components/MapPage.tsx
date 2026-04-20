import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Accommodation, GeneratedActivity, TripSegment } from '../types/TravelData';
import { supabase } from '../lib/supabase';
import { computeSlug } from '../services/activityMediaService';
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
}

// CartoDB Voyager / dark_all -- free, no API key, designed look that
// blends with our app's neutrals far better than raw OSM tiles.
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function hotelMarkerHtml(): string {
  return `
  <div style="position: relative; width: 36px; height: 36px;">
    <div style="
      position: absolute; top: 0; left: 0;
      width: 36px; height: 36px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: var(--accent);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      border: 2px solid var(--surface-container);
    "></div>
    <div style="
      position: absolute; top: 7px; left: 7px;
      width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      color: var(--on-accent);
    ">
      <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'>
        <path d='M2 4v16'/>
        <path d='M2 8h18a2 2 0 0 1 2 2v10'/>
        <path d='M2 17h20'/>
        <path d='M6 8v9'/>
      </svg>
    </div>
  </div>`;
}

function activityMarkerHtml(): string {
  return `
  <div style="
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--surface-container);
    border: 3px solid var(--accent);
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  "></div>`;
}

const MapPage: React.FC = () => {
  const { currentPlan, activities } = useTravel();
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [openActivity, setOpenActivity] = useState<GeneratedActivity | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const { seedHotels, activityCandidates, fallbackCity } = useMemo(() => {
    if (!currentPlan) {
      return {
        seedHotels: [] as MapPoint[],
        activityCandidates: [] as Array<{ activity: GeneratedActivity; key: string; query: string }>,
        fallbackCity: null as string | null,
      };
    }

    const segments: TripSegment[] = currentPlan.segments || [];
    const accs: Accommodation[] = [
      ...segments.flatMap((s) => s.accommodations || []),
      ...(currentPlan.accommodations || []),
    ];

    const hotels: MapPoint[] = accs
      .filter((acc) => acc.coordinates)
      .map((acc) => ({
        id: `hotel-${acc.id}`,
        kind: 'hotel',
        name: acc.name || 'Accommodation',
        subtitle: acc.address || null,
        lat: acc.coordinates!.lat,
        lng: acc.coordinates!.lng,
      }));

    const city = segments[0]?.city?.name || segments[0]?.destination?.name
      || currentPlan.destination?.name || currentPlan.destinations?.[0]?.name || null;
    const country = segments[0]?.destination?.country
      || currentPlan.destination?.country || currentPlan.destinations?.[0]?.country || '';

    // Dedupe activities by slug so a place that appears in two AI sections is
    // only plotted once.
    const seenSlugs = new Set<string>();
    const candidates: Array<{ activity: GeneratedActivity; key: string; query: string }> = [];
    activities.forEach((activity) => {
      const slug = computeSlug({
        name: activity.name,
        city,
        address: activity.location || null,
        googlePlaceId: activity.placeId || null,
      });
      if (seenSlugs.has(slug)) return;
      seenSlugs.add(slug);
      const parts = [activity.name, activity.location, city, country]
        .map((p) => (p || '').trim())
        .filter(Boolean);
      const query = Array.from(new Set(parts)).join(', ');
      candidates.push({ activity, key: slug, query });
    });

    return { seedHotels: hotels, activityCandidates: candidates, fallbackCity: city };
  }, [currentPlan, activities]);

  // Init Leaflet once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([20, 0], 2);
    tileLayerRef.current = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
      subdomains: 'abcd',
      detectRetina: true,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tiles when theme flips light/dark.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
      subdomains: 'abcd',
      detectRetina: true,
    }).addTo(map);
  }, [isDark]);

  // Load activity coords -- supabase first (fast, shared), Nominatim only for misses.
  useEffect(() => {
    let cancelled = false;
    setPoints(seedHotels);
    setPendingCount(0);
    setInitialLoading(true);

    if (activityCandidates.length === 0 && seedHotels.length === 0 && fallbackCity) {
      geocode(fallbackCity).then((res) => {
        if (cancelled) return;
        setInitialLoading(false);
        if (!res || !mapRef.current) return;
        mapRef.current.setView([res.lat, res.lng], 12);
      });
      return () => { cancelled = true; };
    }

    if (activityCandidates.length === 0) {
      setInitialLoading(false);
      return () => { cancelled = true; };
    }

    (async () => {
      const slugs = activityCandidates.map((c) => c.key).filter(Boolean);
      const { data: rows } = slugs.length > 0
        ? await supabase.from('activities').select('slug, lat, lng').in('slug', slugs)
        : { data: [] };

      const known = new Map<string, { lat: number; lng: number }>();
      rows?.forEach((row) => {
        if (row.lat != null && row.lng != null && row.slug) {
          known.set(row.slug, { lat: row.lat, lng: row.lng });
        }
      });

      const seeded: MapPoint[] = [];
      const queue: typeof activityCandidates = [];
      activityCandidates.forEach(({ activity, key, query }, i) => {
        const hit = known.get(key);
        if (hit) {
          seeded.push({
            id: `act-${i}`,
            kind: 'activity',
            name: activity.name,
            subtitle: activity.location || null,
            lat: hit.lat,
            lng: hit.lng,
            activity,
          });
        } else {
          queue.push({ activity, key, query });
        }
      });

      if (cancelled) return;
      setPoints((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        seeded.forEach((p) => map.set(p.id, p));
        return Array.from(map.values());
      });
      setPendingCount(queue.length);
      setInitialLoading(false);

      for (let i = 0; i < queue.length; i++) {
        if (cancelled) return;
        const { activity, key, query } = queue[i];
        const res = await geocode(query);
        if (cancelled) return;
        setPendingCount((n) => Math.max(0, n - 1));
        if (!res) continue;

        setPoints((prev) => {
          const idx = activityCandidates.findIndex((c) => c.key === key);
          const id = `act-${idx}`;
          if (prev.some((p) => p.id === id)) return prev;
          return [...prev, {
            id,
            kind: 'activity',
            name: activity.name,
            subtitle: activity.location || null,
            lat: res.lat,
            lng: res.lng,
            activity,
          }];
        });

        if (key) {
          supabase.from('activities').update({ lat: res.lat, lng: res.lng }).eq('slug', key).then(() => {});
        }
      }
    })();

    return () => { cancelled = true; };
  }, [seedHotels, activityCandidates, fallbackCity]);

  // Re-render markers + auto-fit on point change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (points.length === 0) return;

    points.forEach((point) => {
      const html = point.kind === 'hotel' ? hotelMarkerHtml() : activityMarkerHtml();
      const icon = L.divIcon({
        className: 'trvl-map-marker',
        html,
        iconSize: point.kind === 'hotel' ? [36, 36] : [22, 22],
        iconAnchor: point.kind === 'hotel' ? [18, 32] : [11, 11],
      });
      const marker = L.marker([point.lat, point.lng], { icon, title: point.name }).addTo(map);
      if (point.activity) {
        marker.on('click', () => setOpenActivity(point.activity ?? null));
      } else {
        marker.bindTooltip(point.name, { direction: 'top', offset: [0, -28] });
      }
      markersRef.current.push(marker);
    });

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
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

  const totalExpected = activityCandidates.length + seedHotels.length;
  const isStillLoading = initialLoading || pendingCount > 0;

  return (
    <section className="page space-y-3" style={{ paddingBottom: 0 }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 flex items-center gap-2">
            <MapPin size={22} style={{ color: 'var(--accent)' }} />
            Map
          </h1>
          <p className="text-[12.5px] flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            {isStillLoading && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent)' }} />}
            {initialLoading
              ? 'Loading places...'
              : pendingCount > 0
              ? `${points.length} of ${totalExpected} places \u00b7 ${pendingCount} more loading...`
              : `${points.length} ${points.length === 1 ? 'place' : 'places'} on the map`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
          <span className="inline-flex items-center gap-1.5">
            <span style={{
              width: 14, height: 14, borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              background: 'var(--accent)',
              border: '1.5px solid var(--surface-container)',
            }} />
            Hotel
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: 'var(--surface-container)',
              border: '2.5px solid var(--accent)',
            }} />
            Activity
          </span>
        </div>
      </div>

      <div className="relative">
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

        {initialLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              borderRadius: '20px',
              background: 'color-mix(in srgb, var(--bg-primary) 70%, transparent)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="flex flex-col items-center gap-2 px-5 py-4 rounded-2xl"
              style={{
                background: 'var(--surface-container)',
                border: '0.5px solid var(--outline)',
                boxShadow: '0 12px 32px -10px rgba(0,0,0,0.25)',
              }}
            >
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <div className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                Plotting your trip
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                Loading places...
              </div>
            </div>
          </div>
        )}
      </div>

      <DynamicActivityModal
        activity={openActivity}
        isOpen={!!openActivity}
        onClose={() => setOpenActivity(null)}
      />
    </section>
  );
};

export default MapPage;
