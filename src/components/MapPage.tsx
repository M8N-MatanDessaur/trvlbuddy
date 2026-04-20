import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import maplibregl, { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Bed, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Accommodation, GeneratedActivity, TripSegment } from '../types/TravelData';
import { supabase } from '../lib/supabase';
import { computeSlug } from '../services/activityMediaService';
import { geocodeMany } from '../services/geocodingService';
import { getCachedLocation, getCurrentLocation, type UserLocation } from '../utils/geolocation';
import { getCategoryIcon } from '../utils/categoryIcons';
import DynamicActivityModal from './DynamicActivityModal';

interface MapPoint {
  id: string;
  kind: 'hotel' | 'activity';
  name: string;
  subtitle?: string | null;
  category?: string;
  lat: number;
  lng: number;
  activity?: GeneratedActivity;
}

// Carto vector styles -- free, no API key, designed look that flips with theme.
const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Zoom threshold past which the marker labels appear. ~15 = neighborhood
// scale; higher numbers mean closer (street-level).
const LABEL_ZOOM = 15;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function categoryIconSvg(category: string): string {
  const Icon = getCategoryIcon(category);
  return renderToStaticMarkup(
    <Icon size={14} strokeWidth={2.4} />
  );
}

function bedIconSvg(): string {
  return renderToStaticMarkup(<Bed size={14} strokeWidth={2.6} />);
}

function makeHotelMarkerEl(point: MapPoint): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'trvl-marker trvl-marker--hotel';
  el.innerHTML = `
    <div class="trvl-marker__pin trvl-marker__pin--hotel" style="position: relative; width: 36px; height: 36px;">
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
      ">${bedIconSvg()}</div>
    </div>
    <div class="trvl-marker__label" style="
      position: absolute;
      top: 38px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 220px;
      padding: 6px 10px;
      border-radius: 12px;
      background: var(--surface-container);
      border: 0.5px solid var(--outline);
      box-shadow: 0 6px 16px rgba(0,0,0,0.18);
      font-family: inherit;
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    ">
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="
          width:18px; height:18px; border-radius:50%;
          background:var(--accent); color:var(--on-accent);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        ">${bedIconSvg()}</div>
        <div style="font-weight:800; font-size:11.5px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(point.name)}
        </div>
      </div>
      ${point.subtitle ? `<div style="font-size:10.5px; color:var(--text-secondary); margin-top:2px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(point.subtitle)}</div>` : ''}
    </div>`;
  return el;
}

function makeActivityMarkerEl(point: MapPoint): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'trvl-marker trvl-marker--activity';
  el.style.cursor = 'pointer';
  const iconSvg = point.category ? categoryIconSvg(point.category) : '';
  el.innerHTML = `
    <div class="trvl-marker__pin trvl-marker__pin--activity" style="
      width: 30px; height: 30px;
      border-radius: 50%;
      background: var(--surface-container);
      color: var(--accent);
      border: 2.5px solid var(--accent);
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s ease;
    ">${iconSvg}</div>
    <div class="trvl-marker__label" style="
      position: absolute;
      top: 32px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 220px;
      padding: 6px 10px;
      border-radius: 12px;
      background: var(--surface-container);
      border: 0.5px solid var(--outline);
      box-shadow: 0 6px 16px rgba(0,0,0,0.18);
      font-family: inherit;
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    ">
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="
          width:18px; height:18px; border-radius:50%;
          background:var(--accent-container); color:var(--accent);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        ">${iconSvg}</div>
        <div style="font-weight:800; font-size:11.5px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(point.name)}
        </div>
      </div>
      ${point.subtitle ? `<div style="font-size:10.5px; color:var(--text-secondary); margin-top:2px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(point.subtitle)}</div>` : ''}
    </div>`;
  el.addEventListener('mouseenter', () => {
    const pin = el.querySelector('.trvl-marker__pin') as HTMLElement | null;
    if (pin) pin.style.transform = 'scale(1.12)';
  });
  el.addEventListener('mouseleave', () => {
    const pin = el.querySelector('.trvl-marker__pin') as HTMLElement | null;
    if (pin) pin.style.transform = 'scale(1)';
  });
  return el;
}

function makeUserLocationEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'trvl-marker trvl-marker--me';
  el.innerHTML = `
    <div style="position: relative; width: 22px; height: 22px;">
      <div style="
        position: absolute; inset: 0;
        border-radius: 50%;
        background: var(--accent);
        opacity: 0.25;
        animation: trvl-me-pulse 1.6s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: 5px; left: 5px;
        width: 12px; height: 12px;
        border-radius: 50%;
        background: var(--accent);
        border: 2px solid var(--surface-container);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    </div>`;
  return el;
}

const MapPage: React.FC = () => {
  const { currentPlan, activities } = useTravel();
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<MlMarker[]>([]);
  const userMarkerRef = useRef<MlMarker | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [openActivity, setOpenActivity] = useState<GeneratedActivity | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(getCachedLocation());

  const { seedHotels, hotelGeocodeQueue, activityCandidates, fallbackCity } = useMemo(() => {
    if (!currentPlan) {
      return {
        seedHotels: [] as MapPoint[],
        hotelGeocodeQueue: [] as Array<{ accommodation: Accommodation; query: string }>,
        activityCandidates: [] as Array<{ activity: GeneratedActivity; key: string; query: string }>,
        fallbackCity: null as string | null,
      };
    }

    const segments: TripSegment[] = currentPlan.segments || [];
    const accs: Accommodation[] = [
      ...segments.flatMap((s) => s.accommodations || []),
      ...(currentPlan.accommodations || []),
    ];

    const seedH: MapPoint[] = [];
    const hotelQueue: Array<{ accommodation: Accommodation; query: string }> = [];
    const city = segments[0]?.city?.name || segments[0]?.destination?.name
      || currentPlan.destination?.name || currentPlan.destinations?.[0]?.name || null;
    const country = segments[0]?.destination?.country
      || currentPlan.destination?.country || currentPlan.destinations?.[0]?.country || '';

    accs.forEach((acc) => {
      if (acc.coordinates) {
        seedH.push({
          id: `hotel-${acc.id}`,
          kind: 'hotel',
          name: acc.name || 'Accommodation',
          subtitle: acc.address || null,
          lat: acc.coordinates.lat,
          lng: acc.coordinates.lng,
        });
      } else if (acc.name) {
        // Hotel without coords -- queue for Photon geocoding so the pin appears.
        const parts = [acc.name, acc.address, city, country].filter(Boolean) as string[];
        hotelQueue.push({ accommodation: acc, query: parts.join(', ') });
      }
    });

    // Dedupe activities by slug.
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

    return {
      seedHotels: seedH,
      hotelGeocodeQueue: hotelQueue,
      activityCandidates: candidates,
      fallbackCity: city,
    };
  }, [currentPlan, activities]);

  // Init MapLibre once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isDark ? STYLE_DARK : STYLE_LIGHT,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;

    // Toggle a class on the container based on zoom so CSS can show labels.
    const updateZoomClass = () => {
      const root = containerRef.current;
      if (!root) return;
      if (map.getZoom() >= LABEL_ZOOM) root.classList.add('trvl-map--zoomed-in');
      else root.classList.remove('trvl-map--zoomed-in');
    };
    map.on('zoom', updateZoomClass);
    map.on('load', updateZoomClass);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(isDark ? STYLE_DARK : STYLE_LIGHT);
  }, [isDark]);

  // Resolve activity coords and missing hotel coords.
  useEffect(() => {
    let cancelled = false;
    setPoints(seedHotels);
    setPendingCount(0);
    setInitialLoading(true);

    const nothingToDo = activityCandidates.length === 0
      && hotelGeocodeQueue.length === 0
      && seedHotels.length === 0;

    if (nothingToDo && fallbackCity) {
      import('../services/geocodingService').then(({ geocode }) => geocode(fallbackCity)).then((res) => {
        if (cancelled) return;
        setInitialLoading(false);
        if (!res || !mapRef.current) return;
        mapRef.current.flyTo({ center: [res.lng, res.lat], zoom: 11, essential: true });
      });
      return () => { cancelled = true; };
    }

    if (activityCandidates.length === 0 && hotelGeocodeQueue.length === 0) {
      setInitialLoading(false);
      return () => { cancelled = true; };
    }

    (async () => {
      // Activity coords from supabase first.
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

      const seededActivities: MapPoint[] = [];
      const missesQueries: string[] = [];
      const missesMeta: Array<{ activity: GeneratedActivity; key: string; index: number }> = [];

      activityCandidates.forEach(({ activity, key, query }, i) => {
        const hit = known.get(key);
        if (hit) {
          seededActivities.push({
            id: `act-${i}`,
            kind: 'activity',
            name: activity.name,
            subtitle: activity.formattedAddress || activity.location || null,
            category: activity.category,
            lat: hit.lat,
            lng: hit.lng,
            activity,
          });
        } else {
          missesQueries.push(query);
          missesMeta.push({ activity, key, index: i });
        }
      });

      if (cancelled) return;
      setPoints((prev) => {
        const merged = new Map(prev.map((p) => [p.id, p]));
        seededActivities.forEach((p) => merged.set(p.id, p));
        return Array.from(merged.values());
      });

      const totalPending = missesQueries.length + hotelGeocodeQueue.length;
      setPendingCount(totalPending);
      setInitialLoading(false);

      if (totalPending === 0) return;

      // Geocode misses (activities + hotels) in one parallel batch.
      const allQueries = [...missesQueries, ...hotelGeocodeQueue.map((h) => h.query)];
      const results = await geocodeMany(allQueries, {
        concurrency: 6,
        onProgress: (resolved, total) => {
          if (cancelled) return;
          setPendingCount(Math.max(0, total - resolved));
        },
      });
      if (cancelled) return;

      const resolved: MapPoint[] = [];
      results.forEach((res, idx) => {
        if (!res) return;
        if (idx < missesMeta.length) {
          const { activity, key, index } = missesMeta[idx];
          resolved.push({
            id: `act-${index}`,
            kind: 'activity',
            name: activity.name,
            subtitle: activity.formattedAddress || activity.location || null,
            category: activity.category,
            lat: res.lat,
            lng: res.lng,
            activity,
          });
          if (key) {
            supabase.from('activities').update({ lat: res.lat, lng: res.lng }).eq('slug', key).then(() => {});
          }
        } else {
          const hotelIdx = idx - missesMeta.length;
          const { accommodation } = hotelGeocodeQueue[hotelIdx];
          resolved.push({
            id: `hotel-${accommodation.id}`,
            kind: 'hotel',
            name: accommodation.name || 'Accommodation',
            subtitle: accommodation.address || null,
            lat: res.lat,
            lng: res.lng,
          });
        }
      });

      setPoints((prev) => {
        const merged = new Map(prev.map((p) => [p.id, p]));
        resolved.forEach((p) => merged.set(p.id, p));
        return Array.from(merged.values());
      });
      setPendingCount(0);
    })();

    return () => { cancelled = true; };
  }, [seedHotels, hotelGeocodeQueue, activityCandidates, fallbackCity]);

  // Re-render markers + auto-fit on point change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (points.length === 0) return;

    points.forEach((point) => {
      const el = point.kind === 'hotel' ? makeHotelMarkerEl(point) : makeActivityMarkerEl(point);
      const offset: [number, number] = point.kind === 'hotel' ? [0, -16] : [0, 0];
      const marker = new maplibregl.Marker({ element: el, offset, anchor: 'center' })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      if (point.activity) {
        const pin = el.querySelector('.trvl-marker__pin') as HTMLElement | null;
        (pin || el).addEventListener('click', () => setOpenActivity(point.activity ?? null));
      }
      markersRef.current.push(marker);
    });

    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 14, essential: true });
    } else {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
    }
  }, [points]);

  // User location dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      return;
    }
    const el = makeUserLocationEl();
    userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);
  }, [userLocation]);

  const recenterOnMe = async () => {
    try {
      const loc = await getCurrentLocation();
      setUserLocation(loc);
      const map = mapRef.current;
      if (map) map.flyTo({ center: [loc.lng, loc.lat], zoom: 14, essential: true });
    } catch {
      // permission denied or unavailable -- silent
    }
  };

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

  const totalExpected = activityCandidates.length + seedHotels.length + hotelGeocodeQueue.length;
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

        <button
          onClick={recenterOnMe}
          className="absolute z-10 transition-transform active:scale-90"
          style={{
            right: '14px',
            bottom: '64px',
            width: '40px',
            height: '40px',
            minWidth: 0,
            minHeight: 0,
            borderRadius: '50%',
            background: 'var(--surface-container)',
            color: 'var(--accent)',
            border: '0.5px solid var(--outline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}
          aria-label="Center on my location"
        >
          <LocateFixed size={18} />
        </button>

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
