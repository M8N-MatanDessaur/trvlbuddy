import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { placesCallSafe } from '../lib/placesProxy';

// Place search, without a Google key in the browser.
//
// This used to load the Maps JavaScript API and run google.maps.places
// .Autocomplete, which requires a key in the client. That key was in the
// shipped bundle and unrestricted, so anyone could read it off the site and
// spend the budget -- and the Autocomplete widget is billed per session on
// top. Now the typing goes to the places edge function, which holds the key,
// requires a session, caps each user, and caches predictions for everybody.
//
// The props are unchanged so the three callers (onboarding, the multi-city
// planner, the accommodation input) did not have to change. `apiKey` is
// accepted and ignored so an old call site still compiles.

interface PlaceResult {
  name: string;
  country?: string;
  countryCode?: string;
  coordinates: { lat: number; lng: number };
  placeId: string;
  formatted_address?: string;
}

interface Prediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text?: string;
}

interface PlacesAutocompleteProps {
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  value?: string;
  className?: string;
  types?: string[];
  /** @deprecated the key lives server side; accepted only for compatibility. */
  apiKey?: string;
}

// Somewhere to start before anyone has typed, and the fallback when lookups
// are unavailable. Coordinates are hardcoded so choosing one of these costs
// nothing at all.
const POPULAR: PlaceResult[] = [
  { name: 'Paris', country: 'France', countryCode: 'FR', coordinates: { lat: 48.8566, lng: 2.3522 }, placeId: 'ChIJD7fiBh9u5kcRYJSMaMOCCwQ', formatted_address: 'Paris, France' },
  { name: 'Rome', country: 'Italy', countryCode: 'IT', coordinates: { lat: 41.9028, lng: 12.4964 }, placeId: 'ChIJu46S-ZZhLxMROG5lkwZ3D7k', formatted_address: 'Rome, Italy' },
  { name: 'Tokyo', country: 'Japan', countryCode: 'JP', coordinates: { lat: 35.6762, lng: 139.6503 }, placeId: 'ChIJ51cu8IcbXWARiRtXIothAS4', formatted_address: 'Tokyo, Japan' },
  { name: 'New York', country: 'United States', countryCode: 'US', coordinates: { lat: 40.7128, lng: -74.006 }, placeId: 'ChIJOwg_06VPwokRYv534QaPC8g', formatted_address: 'New York, NY, USA' },
  { name: 'Barcelona', country: 'Spain', countryCode: 'ES', coordinates: { lat: 41.3874, lng: 2.1686 }, placeId: 'ChIJ5TCOcRaYpBIRCmZHTz37sEQ', formatted_address: 'Barcelona, Spain' },
  { name: 'Lisbon', country: 'Portugal', countryCode: 'PT', coordinates: { lat: 38.7223, lng: -9.1393 }, placeId: 'ChIJO_PkYRozGQ0R0DaQ5L3rAAQ', formatted_address: 'Lisbon, Portugal' },
  { name: 'Montreal', country: 'Canada', countryCode: 'CA', coordinates: { lat: 45.5019, lng: -73.5674 }, placeId: 'ChIJDbdkHFQayUwR7-8fITgxTmU', formatted_address: 'Montreal, QC, Canada' },
];

// Long enough that a single keystroke does not cost a lookup, short enough
// that it still feels like it is keeping up.
const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;

const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  onPlaceSelect,
  placeholder = 'Search for a destination...',
  value = '',
  className = '',
  types = ['(cities)'],
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showList, setShowList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setInputValue(value), [value]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    abortRef.current?.abort();
  }, []);

  // Google's `types` for autocomplete is a single value, and the legacy
  // '(cities)' collection is what the callers ask for.
  const typeParam = types.includes('(cities)') ? '(cities)' : types[0];

  const lookup = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const data = await placesCallSafe<{
        status?: string;
        predictions?: Array<{
          place_id?: string;
          description?: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        }>;
      }>('autocomplete', { input: q, ...(typeParam ? { types: typeParam } : {}) }, { signal: controller.signal });

      if (controller.signal.aborted) return;
      if (!data) { setUnavailable(true); setPredictions([]); return; }
      setUnavailable(false);
      setPredictions(
        (data.predictions ?? [])
          .filter((p) => p.place_id && p.description)
          .slice(0, 6)
          .map((p) => ({
            place_id: p.place_id!,
            description: p.description!,
            main_text: p.structured_formatting?.main_text || p.description!,
            secondary_text: p.structured_formatting?.secondary_text,
          })),
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setUnavailable(true);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [typeParam]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setInputValue(next);
    setShowList(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < MIN_CHARS) {
      setPredictions([]);
      setIsLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => lookup(next.trim()), DEBOUNCE_MS);
  };

  // A prediction carries no coordinates, so picking one costs a details
  // lookup -- once per place, then cached server side for everybody.
  const choosePrediction = async (p: Prediction) => {
    setResolvingId(p.place_id);
    try {
      const data = await placesCallSafe<{
        status?: string;
        result?: {
          name?: string;
          formatted_address?: string;
          geometry?: { location?: { lat: number; lng: number } };
          address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        };
      }>('details', { place_id: p.place_id });

      const r = data?.result;
      const loc = r?.geometry?.location;
      if (!r || !loc) {
        setUnavailable(true);
        return;
      }
      const country = r.address_components?.find((c) => c.types.includes('country'));
      const place: PlaceResult = {
        name: r.name || p.main_text,
        country: country?.long_name,
        countryCode: country?.short_name,
        coordinates: { lat: loc.lat, lng: loc.lng },
        placeId: p.place_id,
        formatted_address: r.formatted_address || p.description,
      };
      setInputValue(place.formatted_address || place.name);
      setShowList(false);
      setPredictions([]);
      onPlaceSelect(place);
    } finally {
      setResolvingId(null);
    }
  };

  const choosePopular = (place: PlaceResult) => {
    setInputValue(place.formatted_address || place.name);
    setShowList(false);
    onPlaceSelect(place);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setShowList(true);
  };

  const handleBlur = () => {
    // Delayed so a click on the list still lands.
    blurTimerRef.current = setTimeout(() => setShowList(false), 200);
  };

  const typed = inputValue.trim();
  const showPopular = showList && (typed.length < MIN_CHARS || (unavailable && predictions.length === 0));
  const popularShown = typed.length >= MIN_CHARS
    ? POPULAR.filter((d) =>
        d.name.toLowerCase().includes(typed.toLowerCase()) ||
        (d.country || '').toLowerCase().includes(typed.toLowerCase()))
    : POPULAR;

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10" size={20} style={{ color: 'var(--text-secondary)' }} />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-12 pr-12 py-4 rounded-xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary transition-all ${className}`}
          style={{
            backgroundColor: 'var(--surface-container)',
            color: 'var(--text-primary)',
            borderColor: 'var(--outline)',
          }}
        />
        {(isLoading || resolvingId) && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin z-10" size={20} style={{ color: 'var(--primary)' }} />
        )}
        {unavailable && !isLoading && (
          <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10" size={20} style={{ color: '#f59e0b' }} />
        )}
      </div>

      {showList && (predictions.length > 0 || showPopular) && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-container)', border: '1px solid var(--outline)' }}
        >
          {unavailable && (
            <div className="px-4 py-2 text-sm border-b flex items-center gap-2" style={{ color: '#f59e0b', borderColor: 'var(--outline)' }}>
              <AlertCircle size={14} />
              Showing popular destinations - search is unavailable
            </div>
          )}

          {predictions.length > 0
            ? predictions.map((p) => (
                <button
                  key={p.place_id}
                  type="button"
                  onClick={() => choosePrediction(p)}
                  disabled={resolvingId !== null}
                  className="w-full px-4 py-3 text-left transition-colors flex items-center gap-3 border-b last:border-b-0 disabled:opacity-50"
                  style={{ borderColor: 'var(--outline)' }}
                >
                  <MapPin size={16} style={{ color: 'var(--primary)' }} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.main_text}</div>
                    {p.secondary_text && (
                      <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{p.secondary_text}</div>
                    )}
                  </div>
                  {resolvingId === p.place_id && (
                    <Loader2 className="ml-auto animate-spin flex-shrink-0" size={14} style={{ color: 'var(--primary)' }} />
                  )}
                </button>
              ))
            : popularShown.map((place) => (
                <button
                  key={place.placeId}
                  type="button"
                  onClick={() => choosePopular(place)}
                  className="w-full px-4 py-3 text-left transition-colors flex items-center gap-3 border-b last:border-b-0"
                  style={{ borderColor: 'var(--outline)' }}
                >
                  <MapPin size={16} style={{ color: 'var(--primary)' }} className="flex-shrink-0" />
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{place.name}</div>
                    {place.country && (
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{place.country}</div>
                    )}
                  </div>
                </button>
              ))}
        </div>
      )}
    </div>
  );
};

export default PlacesAutocomplete;
