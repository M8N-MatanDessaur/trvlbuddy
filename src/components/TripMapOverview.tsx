import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import maplibregl, { LngLatBoundsLike, Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTravel } from '../contexts/TravelContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Palette for up to 12 segments; wraps after that. Eye-balled to be
// distinguishable on a light OSM base map.
const SEGMENT_COLORS = [
  '#5856D6', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#007AFF',
  '#FFCC00', '#FF2D55', '#5AC8FA', '#32ADE6', '#FF6482', '#BF5AF2',
];

// Free OSM tiles via OpenFreeMap (no key, community-funded mirror of
// OpenMapTiles). Fallback style inline so the map works even if the
// remote style.json endpoint is down.
const DEFAULT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

interface PinData {
  lat: number;
  lng: number;
  label: string;
  color: string;
  segmentName: string;
}

const TripMapOverview: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentPlan, activities } = useTravel();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const pins = useMemo<PinData[]>(() => {
    if (!currentPlan) return [];
    const segmentIndex = new Map<string, number>();
    const segs = currentPlan.segments || [];
    segs.forEach((s: { id: string }, i: number) => segmentIndex.set(s.id, i));

    const out: PinData[] = [];

    // Segment anchors (city centers).
    segs.forEach((seg: { id: string; city?: { name: string; coordinates?: { lat: number; lng: number } }; destination?: { name: string; coordinates?: { lat: number; lng: number } } }, i: number) => {
      const coords = seg.city?.coordinates || seg.destination?.coordinates;
      if (!coords || (coords.lat === 0 && coords.lng === 0)) return;
      out.push({
        lat: coords.lat,
        lng: coords.lng,
        label: seg.city?.name || seg.destination?.name || 'Stop',
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        segmentName: seg.city?.name || seg.destination?.name || 'Stop',
      });
    });

    // Individual activities.
    activities.forEach((a) => {
      if (!a.coordinates || (a.coordinates.lat === 0 && a.coordinates.lng === 0)) return;
      const segIndex = a.cityId || a.destinationId
        ? segs.findIndex((s: { city?: { id: string }; destination?: { id: string } }) =>
            s.city?.id === a.cityId || s.destination?.id === a.destinationId,
          )
        : 0;
      const color = SEGMENT_COLORS[Math.max(0, segIndex) % SEGMENT_COLORS.length];
      out.push({
        lat: a.coordinates.lat,
        lng: a.coordinates.lng,
        label: a.name,
        color,
        segmentName: '',
      });
    });

    return out;
  }, [currentPlan, activities]);

  const bounds = useMemo<LngLatBoundsLike | null>(() => {
    if (pins.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    pins.forEach((p) => {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    });
    return [[minLng, minLat], [maxLng, maxLat]] as LngLatBoundsLike;
  }, [pins]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      center: pins[0] ? [pins[0].lng, pins[0].lat] : [0, 20],
      zoom: 2,
      attributionControl: { compact: true },
    });

    map.on('load', () => {
      setMapReady(true);
      if (bounds) {
        map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 11 });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [isOpen, bounds, pins]);

  // Re-apply pins on every change while the map stays mounted.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const markers: maplibregl.Marker[] = [];
    pins.forEach((p) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: ${p.color};
        box-shadow: 0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.25);
        cursor: pointer;
      `;
      el.title = p.label;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(p.label))
        .addTo(map);
      markers.push(marker);
    });

    if (bounds) {
      map.fitBounds(bounds, { padding: 60, duration: 500, maxZoom: 11 });
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [pins, bounds, mapReady]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)', height: '100dvh' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full mx-auto relative"
        style={{ maxWidth: '480px', background: 'var(--bg-primary)', height: '100dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center gap-2 px-3 flex-shrink-0"
          style={{
            height: 'calc(3.25rem + env(safe-area-inset-top))',
            paddingTop: 'env(safe-area-inset-top)',
            background: 'var(--bg-primary)',
            borderBottom: '0.33px solid var(--outline)',
          }}
        >
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Close map"
          >
            <X size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-extrabold tracking-tight truncate">
              Trip map
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {pins.length} {pins.length === 1 ? 'pin' : 'pins'}
            </div>
          </div>
        </header>

        <div className="flex-1 relative">
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
          {pins.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center text-center px-8"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-primary)' }}
            >
              <div>
                <p className="text-[14px] font-bold">Nothing to plot yet</p>
                <p className="text-[12px] mt-1">
                  Add activities with locations to see them here.
                </p>
              </div>
            </div>
          )}
          {pins.length > 0 && !mapReady && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripMapOverview;
