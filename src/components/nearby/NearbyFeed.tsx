import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LocateFixed, Loader2, RefreshCw, Radar, Globe, ArrowUp, Footprints, Car } from 'lucide-react';
import {
  getCachedLocation,
  getCurrentLocation,
  UserLocation,
} from '../../utils/geolocation';
import {
  NearbyFeedCursor,
  NearbyPlace,
  CATEGORIES,
  TransportMode,
} from '../../services/nearbyService';
import NearbyPost from './NearbyPost';
import NearbyLiveEvents from './NearbyLiveEvents';

type Status = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'error';

const BATCH_SIZE = 10;
const PREFETCH_AHEAD = 3;
const TRANSPORT_STORAGE_KEY = 'nearby-transport-mode';

function readStoredTransportMode(): TransportMode {
  if (typeof window === 'undefined') return 'foot';
  const stored = window.localStorage.getItem(TRANSPORT_STORAGE_KEY);
  return stored === 'car' ? 'car' : 'foot';
}

const NearbyFeed: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(getCachedLocation());
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [transportMode, setTransportMode] = useState<TransportMode>(readStoredTransportMode);

  const cursorRef = useRef<NearbyFeedCursor | null>(null);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollableRef = useRef<HTMLElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current) return;
    const cursor = cursorRef.current;
    if (!cursor || cursor.isExhausted()) {
      setExhausted(true);
      return;
    }
    fetchingRef.current = true;
    try {
      const batch = await cursor.fetchNextBatch(BATCH_SIZE);
      setPlaces(prev => [...prev, ...batch]);
      if (cursor.isExhausted()) setExhausted(true);
    } catch (err) {
      console.error('NearbyFeed loadMore error', err);
      setErrorMessage('Could not load nearby places.');
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const bootstrap = useCallback(
    async (loc: UserLocation, types: string[], mode: TransportMode) => {
      setStatus('loading');
      setErrorMessage(null);
      cursorRef.current = new NearbyFeedCursor(loc, types, mode);
      setPlaces([]);
      setExhausted(false);
      await loadMore();
      setStatus('ready');
    },
    [loadMore],
  );

  const requestLocation = useCallback(async () => {
    setStatus('locating');
    setErrorMessage(null);
    try {
      const loc = await getCurrentLocation();
      setUserLocation(loc);
      await bootstrap(loc, selectedTypes, transportMode);
    } catch (err: unknown) {
      const code = (err as GeolocationPositionError | undefined)?.code;
      if (code === 1) {
        setStatus('denied');
      } else {
        setStatus('error');
        setErrorMessage('Could not get your location. Check permissions and try again.');
      }
    }
  }, [bootstrap, selectedTypes, transportMode]);

  useEffect(() => {
    const cached = getCachedLocation();
    if (cached) {
      setUserLocation(cached);
      bootstrap(cached, selectedTypes, transportMode);
    } else {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload feed when filter or transport mode changes (after initial load)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    if (!userLocation) return;
    bootstrap(userLocation, selectedTypes, transportMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypes, transportMode]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type],
    );
  };

  const clearTypes = () => setSelectedTypes([]);

  const selectTransportMode = (mode: TransportMode) => {
    if (mode === transportMode) return;
    setTransportMode(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TRANSPORT_STORAGE_KEY, mode);
    }
  };

  useEffect(() => {
    if (status !== 'ready') return;
    if (exhausted) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) loadMore();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [status, places.length, exhausted, loadMore]);

  // Track scroll position on the nearest scrollable ancestor so we can
  // show a back-to-top button once the user has scrolled a meaningful amount.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      node = node.parentElement;
    }
    if (!node) return;
    scrollableRef.current = node;
    const scroller = node;
    const onScroll = () => setShowScrollTop(scroller.scrollTop > 600);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    scrollableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="page" ref={sectionRef}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 flex items-center gap-2">
            <Radar size={22} style={{ color: 'var(--accent)' }} />
            Nearby
          </h1>
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {userLocation ? "What's open around you right now" : 'We need your location to show you what\'s around'}
          </p>
        </div>
        {status === 'ready' && userLocation && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-full p-0.5"
              style={{ background: 'var(--surface-container)' }}
              role="group"
              aria-label="Search radius by transport mode"
            >
              <button
                onClick={() => selectTransportMode('foot')}
                className="flex items-center justify-center rounded-full transition-all"
                style={{
                  width: '32px',
                  height: '32px',
                  background: transportMode === 'foot' ? 'var(--accent)' : 'transparent',
                  color: transportMode === 'foot' ? 'white' : 'var(--text-secondary)',
                }}
                aria-label="Walking distance"
                aria-pressed={transportMode === 'foot'}
              >
                <Footprints size={15} />
              </button>
              <button
                onClick={() => selectTransportMode('car')}
                className="flex items-center justify-center rounded-full transition-all"
                style={{
                  width: '32px',
                  height: '32px',
                  background: transportMode === 'car' ? 'var(--accent)' : 'transparent',
                  color: transportMode === 'car' ? 'white' : 'var(--text-secondary)',
                }}
                aria-label="Driving distance"
                aria-pressed={transportMode === 'car'}
              >
                <Car size={15} />
              </button>
            </div>
            <button
              onClick={() => requestLocation()}
              className="flex items-center justify-center rounded-full"
              style={{
                width: '36px',
                height: '36px',
                background: 'var(--surface-container)',
                color: 'var(--text-secondary)',
              }}
              aria-label="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Live events (above chips) */}
      {userLocation && (status === 'ready' || (status === 'loading' && places.length > 0)) && (
        <NearbyLiveEvents userLocation={userLocation} />
      )}

      {/* Category filter chips */}
      {(status === 'ready' || (status === 'loading' && places.length > 0)) && userLocation && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-4" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={clearTypes}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              background: selectedTypes.length === 0 ? 'var(--accent)' : 'var(--surface-container)',
              color: selectedTypes.length === 0 ? 'white' : 'var(--text-secondary)',
            }}
          >
            <Globe size={14} />
            All
          </button>
          {CATEGORIES.map(cat => {
            const isActive = selectedTypes.includes(cat.type);
            const Icon = cat.icon;
            return (
              <button
                key={cat.type}
                onClick={() => toggleType(cat.type)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--surface-container)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                }}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* States */}
      {status === 'locating' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Getting your location...</p>
        </div>
      )}

      {status === 'denied' && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
          >
            <LocateFixed size={22} />
          </div>
          <h3 className="text-base font-bold">Location permission denied</h3>
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Enable location in your browser settings to see what's around you.
          </p>
          <button
            onClick={requestLocation}
            className="mt-2 px-5 py-3 rounded-2xl text-[13px] font-bold"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Try again
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-6">
          <h3 className="text-base font-bold">Something went wrong</h3>
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{errorMessage}</p>
          <button
            onClick={requestLocation}
            className="mt-2 px-5 py-3 rounded-2xl text-[13px] font-bold"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Try again
          </button>
        </div>
      )}

      {(status === 'loading' || status === 'ready') && (
        <>
          {places.length === 0 && status === 'loading' && (
            <div className="space-y-8">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="w-full">
                  <div className="w-full activity-card-shimmer" style={{ aspectRatio: '4 / 5', borderRadius: '22px', background: 'var(--surface-container-high)' }} />
                  <div className="h-4 rounded-full mt-3 activity-card-shimmer" style={{ width: '60%', background: 'var(--surface-container-high)' }} />
                </div>
              ))}
            </div>
          )}

          {places.map((place, idx) => {
            const isSentinel = idx === Math.max(0, places.length - PREFETCH_AHEAD);
            return (
              <React.Fragment key={place.placeId}>
                <NearbyPost place={place} />
                {isSentinel && <div ref={sentinelRef} style={{ height: 1 }} />}
              </React.Fragment>
            );
          })}

          {fetchingRef.current && places.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          )}

          {exhausted && places.length > 0 && (
            <div className="text-center py-10 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              You've reached the end of what's around.
            </div>
          )}

          {exhausted && places.length === 0 && status === 'ready' && (
            <div className="text-center py-16 px-6">
              <h3 className="text-base font-bold mb-1">Nothing open nearby</h3>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                We couldn't find anything open around you right now.
              </p>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            key="scroll-top"
            onClick={scrollToTop}
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            aria-label="Scroll to top"
            className="flex items-center justify-center"
            style={{
              position: 'fixed',
              right: '18px',
              bottom: '88px',
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'white',
              boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              zIndex: 40,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ArrowUp size={20} strokeWidth={2.4} />
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
};

export default NearbyFeed;
