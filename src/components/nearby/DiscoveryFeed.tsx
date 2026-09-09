import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlacePlate, { PlateItem } from './PlacePlate';
import {
  wikipediaNearby,
  osmNearby,
  mergeDiscoveries,
  type DiscoveryPlace,
} from '../../services/discovery';
import { getCachedLocation, getCurrentLocation, UserLocation } from '../../utils/geolocation';
import { reverseGeocodeLocality } from '../../utils/geocoding';
import '../../styles/design.css';

// What to do today, where you are standing.
//
// Three modes, because "I don't know what to do" is really three different
// questions and answering them from one undifferentiated list is why the old
// feed felt monotone:
//
//   See   -- landmarks, gates, palaces, markets. Free: Wikipedia + OSM.
//   Do    -- what is actually happening, which is the time-bound and
//            therefore most interesting answer.
//   Taste -- food and drink worth crossing town for, from the curated
//            Google side.
//
// Nothing here refetches on a whim. The old feed reloaded when you switched
// tabs and came back, when you walked 500m, and every half hour -- each one a
// billed round trip. This asks once per place per session and caches for the
// day, because the Pantheon will still be there this afternoon.

type Mode = 'see' | 'do' | 'taste';

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: 'see', label: 'See', hint: 'Worth the walk' },
  { id: 'do', label: 'Do', hint: 'Happening now' },
  { id: 'taste', label: 'Taste', hint: 'Eat and drink' },
];

const CACHE_PREFIX = 'tb-discovery-v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
// Everyone inside the same ~500m square shares a cached answer, matching how
// the places proxy keys its own cache.
const GRID = 0.005;

function gridKey(loc: UserLocation): string {
  const snap = (n: number) => (Math.round(n / GRID) * GRID).toFixed(4);
  return `${snap(loc.lat)},${snap(loc.lng)}`;
}

function readCache(key: string): DiscoveryPlace[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const { at, places } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return places as DiscoveryPlace[];
  } catch {
    return null;
  }
}

function writeCache(key: string, places: DiscoveryPlace[]) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify({ at: Date.now(), places }));
  } catch { /* storage full or unavailable; the feed still works */ }
}

/**
 * Lay the plates out so the feed has rhythm. A place with a photograph earns
 * a feature plate; everything else is a small one. Features are spaced so two
 * never sit together, which is what stops the page reading as a list.
 */
function arrange(places: PlateItem[]): Array<{ place: PlateItem; variant: 'feature' | 'plain' }> {
  const out: Array<{ place: PlateItem; variant: 'feature' | 'plain' }> = [];
  let sinceFeature = 99;
  for (const place of places) {
    const canFeature = Boolean(place.imageUrl) && sinceFeature >= 2;
    out.push({ place, variant: canFeature ? 'feature' : 'plain' });
    sinceFeature = canFeature ? 0 : sinceFeature + 1;
  }
  return out;
}

const DiscoveryFeed: React.FC = () => {
  const [mode, setMode] = useState<Mode>('see');
  const [location, setLocation] = useState<UserLocation | null>(getCachedLocation());
  const [placeName, setPlaceName] = useState<string>('');
  const [items, setItems] = useState<PlateItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const asked = useRef<Set<string>>(new Set());

  // Where are we. Cached position first so the feed can render immediately.
  useEffect(() => {
    if (location) return;
    let cancelled = false;
    getCurrentLocation()
      .then((loc) => { if (!cancelled) setLocation(loc); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [location]);

  // The city name, for the heading. Cached 30 days server side.
  useEffect(() => {
    if (!location || placeName) return;
    let cancelled = false;
    reverseGeocodeLocality(location.lat, location.lng)
      .then((name) => { if (!cancelled && name) setPlaceName(name); })
      .catch(() => { /* the heading falls back to "Nearby" */ });
    return () => { cancelled = true; };
  }, [location, placeName]);

  const load = useCallback(async (loc: UserLocation) => {
    const key = gridKey(loc);
    const cached = readCache(key);
    if (cached) { setItems(cached as PlateItem[]); return; }
    // One fetch per grid square per session, whatever the mode does.
    if (asked.current.has(key)) return;
    asked.current.add(key);

    // Both sources are free and independent, so ask together and let either
    // one carry the feed if the other is having a bad day (Overpass is a
    // volunteer service and does time out).
    const [wiki, osm] = await Promise.all([
      wikipediaNearby(loc.lat, loc.lng, 2500, { limit: 16 }).catch(() => []),
      osmNearby(loc.lat, loc.lng, 2000, { limit: 24 }).catch(() => []),
    ]);
    const merged = mergeDiscoveries(wiki, osm);
    if (merged.length === 0) { setFailed(true); return; }
    writeCache(key, merged);
    setItems(merged as PlateItem[]);
  }, []);

  useEffect(() => {
    if (location) void load(location);
  }, [location, load]);

  const arranged = useMemo(() => arrange(items ?? []), [items]);

  const heading = placeName || 'Nearby';
  const count = items?.length ?? 0;

  return (
    <section className="tb-surface">
      <header className="tb-head">
        <h1 className="tb-head-place">{heading}</h1>
        {count > 0 && (
          <p className="tb-head-count">
            {count} {count === 1 ? 'place' : 'places'} worth the walk
          </p>
        )}
      </header>

      <div className="tb-modes" role="tablist" aria-label="What to do">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className="tb-mode"
            onClick={() => setMode(m.id)}
          >
            {m.label}
            <span className="tb-mode-hint">{m.hint}</span>
          </button>
        ))}
      </div>

      <div className="tb-feed">
        {mode !== 'see' && (
          <div className="tb-state">
            <h2 className="tb-state-title">
              {mode === 'do' ? 'Events are next' : 'Places to eat are next'}
            </h2>
            <p className="tb-state-note">
              {mode === 'do'
                ? 'What is on tonight will land here, alongside the things travellers are doing near you right now.'
                : 'The food and drink worth crossing town for, ranked by what people actually say about it rather than by how close it is.'}
            </p>
          </div>
        )}

        {mode === 'see' && items === null && !failed && (
          <>
            <div className="tb-skel tb-skel--feature" />
            <div className="tb-skel tb-skel--plain" />
            <div className="tb-skel tb-skel--plain" />
          </>
        )}

        {mode === 'see' && failed && (
          <div className="tb-state">
            <h2 className="tb-state-title">We need to know where you are</h2>
            <p className="tb-state-note">
              Turn on location and this fills with the palaces, markets and old
              gates within walking distance. Nothing is sent anywhere: the
              search happens against your coordinates and stays on your device
              for the day.
            </p>
          </div>
        )}

        {mode === 'see' && items?.length === 0 && (
          <div className="tb-state">
            <h2 className="tb-state-title">Quiet around here</h2>
            <p className="tb-state-note">
              Nothing notable within a walk. Try Taste for somewhere to eat, or
              be the first to put this corner on the map by adding a photo of
              somewhere good.
            </p>
          </div>
        )}

        {mode === 'see' && arranged.map(({ place, variant }) => (
          <PlacePlate key={place.id} place={place} variant={variant} />
        ))}
      </div>
    </section>
  );
};

export default DiscoveryFeed;
