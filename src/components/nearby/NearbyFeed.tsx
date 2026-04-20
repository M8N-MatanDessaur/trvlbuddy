import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LocateFixed, RefreshCw, Radar, Globe, ArrowUp, Footprints, Car, Calendar, Plus } from 'lucide-react';
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
import {
  FeedCacheContext,
  clearFeedCache,
  readFeedCache,
  writeFeedCache,
} from '../../services/nearbyFeedCache';
import NearbyPost from './NearbyPost';
import NearbyLiveEvents from './NearbyLiveEvents';
import NearbyPromptBar, { NearbyPromptBarHandle } from './NearbyPromptBar';
import { interpretNearbyPrompt, NearbyChipSuggestion } from '../../services/aiService';
import { fetchDynamicChips } from '../../services/nearbyChipsService';
import { iconFor } from '../../services/nearbyIconRegistry';
import { useToast } from '../../contexts/ToastContext';
import { getActivityScoresBySlug } from '../../services/activityMediaService';

const CHIP_SCAN_RADIUS_BY_MODE: Record<TransportMode, number> = {
  foot: 1500,
  car: 8000,
};

type Status = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'error';

const BATCH_SIZE = 5;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [transportMode, setTransportMode] = useState<TransportMode>(readStoredTransportMode);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [aiKeyword, setAiKeyword] = useState<string | undefined>(undefined);
  const [aiLoading, setAiLoading] = useState(false);
  const [dynamicChips, setDynamicChips] = useState<NearbyChipSuggestion[]>([]);
  const [chipsLoading, setChipsLoading] = useState(false);
  const [activeChipLabel, setActiveChipLabel] = useState<string | null>(null);
  const { toast } = useToast();

  const cursorRef = useRef<NearbyFeedCursor | null>(null);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollableRef = useRef<HTMLElement | null>(null);
  const promptBarRef = useRef<NearbyPromptBarHandle | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Keep the latest cache context + current places list in refs so loadMore
  // can persist without needing to be recreated on every state change and
  // without racing React's async setState.
  const cacheContextRef = useRef<FeedCacheContext | null>(null);
  const placesRef = useRef<NearbyPlace[]>([]);

  const setPlacesTracked = useCallback((next: NearbyPlace[]) => {
    // Defensive dedupe by placeId. The cursor already skips repeat IDs, but
    // cached snapshots, StrictMode double-mounts, or a provider quirk can
    // occasionally slip a dupe through.
    const seen = new Set<string>();
    const deduped: NearbyPlace[] = [];
    for (const p of next) {
      if (seen.has(p.placeId)) continue;
      seen.add(p.placeId);
      deduped.push(p);
    }
    placesRef.current = deduped;
    setPlaces(deduped);
  }, []);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current) return;
    const cursor = cursorRef.current;
    if (!cursor || cursor.isExhausted()) {
      setExhausted(true);
      return;
    }
    fetchingRef.current = true;
    const isSubsequent = placesRef.current.length > 0;
    if (isSubsequent) setLoadingMore(true);
    try {
      const batch = await cursor.fetchNextBatch(BATCH_SIZE);
      const nextPlaces = [...placesRef.current, ...batch];
      setPlacesTracked(nextPlaces);
      if (cursor.isExhausted()) setExhausted(true);
      // Persist after every fetch so a remount of the tab rehydrates with
      // everything the user has already loaded — no repeat Places API calls.
      const ctx = cacheContextRef.current;
      if (ctx) writeFeedCache(ctx, nextPlaces, cursor.snapshot());
    } catch (err) {
      console.error('NearbyFeed loadMore error', err);
      setErrorMessage('Could not load nearby places.');
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [setPlacesTracked]);

  const bootstrap = useCallback(
    async (loc: UserLocation, types: string[], mode: TransportMode, keyword?: string) => {
      setErrorMessage(null);
      const ctx: FeedCacheContext = {
        location: loc,
        transportMode: mode,
        selectedTypes: types,
        aiKeyword: keyword,
      };
      cacheContextRef.current = ctx;

      // Cache hit — same context, user hasn't moved past the mode's
      // tolerance, within TTL. Rehydrate without hitting Places API.
      const cached = readFeedCache(ctx);
      if (cached) {
        const cursor = new NearbyFeedCursor(loc, types, mode, keyword);
        cursor.restore(cached.cursor);
        cursorRef.current = cursor;
        setPlacesTracked(cached.places);
        setExhausted(cursor.isExhausted());
        setStatus('ready');
        return;
      }

      setStatus('loading');
      cursorRef.current = new NearbyFeedCursor(loc, types, mode, keyword);
      setPlacesTracked([]);
      setExhausted(false);
      await loadMore();
      setStatus('ready');
    },
    [loadMore, setPlacesTracked],
  );

  const requestLocation = useCallback(async () => {
    setStatus('locating');
    setErrorMessage(null);
    try {
      const loc = await getCurrentLocation();
      setUserLocation(loc);
      // Explicit refresh — user tapped the button or we just re-acquired GPS,
      // so bypass the cache for this context and refetch from Places.
      clearFeedCache({
        location: loc,
        transportMode,
        selectedTypes,
        aiKeyword,
      });
      await bootstrap(loc, selectedTypes, transportMode, aiKeyword);
    } catch (err: unknown) {
      const code = (err as GeolocationPositionError | undefined)?.code;
      if (code === 1) {
        setStatus('denied');
      } else {
        setStatus('error');
        setErrorMessage('Could not get your location. Check permissions and try again.');
      }
    }
  }, [bootstrap, selectedTypes, transportMode, aiKeyword]);

  useEffect(() => {
    const cached = getCachedLocation();
    if (cached) {
      setUserLocation(cached);
      bootstrap(cached, selectedTypes, transportMode, aiKeyword);
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
    bootstrap(userLocation, selectedTypes, transportMode, aiKeyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypes, transportMode, aiKeyword]);

  const handleAiSubmit = useCallback(
    async (prompt: string) => {
      if (!userLocation) return;
      setAiLoading(true);
      try {
        const allowed = CATEGORIES.map(c => ({ type: c.type, label: c.label }));
        const result = await interpretNearbyPrompt(prompt, allowed);
        if (result.types.length === 0 && !result.keyword) {
          toast("Couldn't match that to anything nearby. Try something else.", 'error');
          return;
        }
        setAiPrompt(prompt);
        setAiKeyword(result.keyword);
        setSelectedTypes(result.types);
      } catch (err) {
        console.error('AI interpret error', err);
        toast('Something went wrong interpreting that prompt.', 'error');
      } finally {
        setAiLoading(false);
      }
    },
    [userLocation, toast],
  );

  const handleAiClear = useCallback(() => {
    setAiPrompt(null);
    setAiKeyword(undefined);
    setSelectedTypes([]);
    setActiveChipLabel(null);
  }, []);

  // Load dynamic, context-aware chips once we have a location. The service
  // caches per city + hour-of-day in sessionStorage so we don't re-call
  // Places + Gemini on every refresh.
  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    setChipsLoading(true);
    fetchDynamicChips({
      userLocation,
      scanRadius: CHIP_SCAN_RADIUS_BY_MODE[transportMode],
    })
      .then(chips => {
        if (cancelled) return;
        setDynamicChips(chips);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('fetchDynamicChips failed', err);
      })
      .finally(() => {
        if (cancelled) return;
        setChipsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userLocation, transportMode]);

  const selectDynamicChip = useCallback((chip: NearbyChipSuggestion) => {
    // Apply the chip's pre-interpreted types/keyword directly — no extra
    // Gemini round-trip needed since suggestNearbyChips already resolved them.
    setAiPrompt(chip.label);
    setAiKeyword(chip.keyword);
    setSelectedTypes(chip.types);
    setActiveChipLabel(chip.label);
  }, []);

  const openPromptBar = useCallback(() => {
    handleAiClear();
    // Wait a tick so the prompt bar re-renders in its input (not chip) state.
    requestAnimationFrame(() => promptBarRef.current?.focus());
  }, [handleAiClear]);

  const clearTypes = () => {
    setSelectedTypes([]);
    setActiveChipLabel(null);
  };

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

  // Final render-layer guard against duplicate cards.
  const uniquePlaces = useMemo(() => {
    const seen = new Set<string>();
    const out: NearbyPlace[] = [];
    for (const p of places) {
      if (seen.has(p.placeId)) continue;
      seen.add(p.placeId);
      out.push(p);
    }
    return out;
  }, [places]);

  // Vote-score sort: batch-fetch scores by slug for the loaded places, then
  // re-rank by (score desc, distance asc). Places with no row in the votes
  // table fall back to score 0, so unranked items still come back in the
  // original distance-sorted order.
  const [scoreBySlug, setScoreBySlug] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (uniquePlaces.length === 0) return;
    let cancelled = false;
    const slugs = uniquePlaces.map((p) => `gpid-${p.placeId}`);
    getActivityScoresBySlug(slugs)
      .then((rows) => {
        if (cancelled) return;
        setScoreBySlug((prev) => {
          const next = new Map(prev);
          rows.forEach((value, slug) => next.set(slug, value.score));
          return next;
        });
      })
      .catch(() => {
        // Sort fallback to original order is fine -- swallow.
      });
    return () => {
      cancelled = true;
    };
  }, [uniquePlaces]);

  const sortedPlaces = useMemo(() => {
    if (uniquePlaces.length === 0) return uniquePlaces;
    const decorated = uniquePlaces.map((p, idx) => ({
      place: p,
      idx,
      score: scoreBySlug.get(`gpid-${p.placeId}`) ?? 0,
    }));
    decorated.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.place.distance !== b.place.distance) return a.place.distance - b.place.distance;
      return a.idx - b.idx;
    });
    return decorated.map((d) => d.place);
  }, [uniquePlaces, scoreBySlug]);

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
              className="inline-flex items-center gap-1 p-1 rounded-full"
              style={{ background: 'var(--surface-container)' }}
              role="group"
              aria-label="Search radius by transport mode"
            >
              <button
                onClick={() => selectTransportMode('foot')}
                className="flex items-center justify-center transition-all"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '9999px',
                  background: transportMode === 'foot' ? 'var(--accent)' : 'transparent',
                  color: transportMode === 'foot' ? 'var(--on-accent)' : 'var(--text-secondary)',
                }}
                aria-label="Walking distance"
                aria-pressed={transportMode === 'foot'}
              >
                <Footprints size={16} />
              </button>
              <button
                onClick={() => selectTransportMode('car')}
                className="flex items-center justify-center transition-all"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '9999px',
                  background: transportMode === 'car' ? 'var(--accent)' : 'transparent',
                  color: transportMode === 'car' ? 'var(--on-accent)' : 'var(--text-secondary)',
                }}
                aria-label="Driving distance"
                aria-pressed={transportMode === 'car'}
              >
                <Car size={16} />
              </button>
            </div>
            <button
              onClick={() => requestLocation()}
              className="flex items-center justify-center"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '9999px',
                background: 'var(--surface-container)',
                color: 'var(--text-secondary)',
                flexShrink: 0,
              }}
              aria-label="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Free-form AI prompt bar */}
      {userLocation && (status === 'ready' || (status === 'loading' && places.length > 0)) ? (
        <NearbyPromptBar
          ref={promptBarRef}
          activePrompt={aiPrompt}
          loading={aiLoading}
          onSubmit={handleAiSubmit}
          onClear={handleAiClear}
        />
      ) : (
        (status === 'locating' || (status === 'loading' && places.length === 0)) && (
          <div
            className="mb-3 h-[44px] rounded-full activity-card-shimmer"
            style={{ background: 'var(--surface-container)' }}
            aria-hidden="true"
          />
        )
      )}

      {/* Live events (above chips) */}
      {userLocation && (status === 'ready' || (status === 'loading' && places.length > 0)) ? (
        <NearbyLiveEvents userLocation={userLocation} focus={aiPrompt} />
      ) : (
        (status === 'locating' || (status === 'loading' && places.length === 0)) && (
          <div className="space-y-2.5 mb-5" aria-hidden="true">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: 'var(--accent)' }} />
                <h2 className="text-[14px] font-bold">Happening Now</h2>
              </div>
              <div
                className="h-3 w-20 rounded-full activity-card-shimmer"
                style={{ background: 'var(--surface-container-high)' }}
              />
            </div>
            <div className="flex gap-3 overflow-x-hidden pb-2 -mx-1 px-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex-shrink-0" style={{ width: '250px' }}>
                  <div
                    className="h-full rounded-2xl p-3.5 flex flex-col gap-2"
                    style={{ background: 'var(--surface-container)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-4 rounded-md activity-card-shimmer"
                        style={{ width: '60px', background: 'var(--surface-container-high)' }}
                      />
                      <div
                        className="h-3 rounded-full activity-card-shimmer"
                        style={{ width: '40px', background: 'var(--surface-container-high)' }}
                      />
                    </div>
                    <div
                      className="h-4 rounded activity-card-shimmer"
                      style={{ background: 'var(--surface-container-high)' }}
                    />
                    <div
                      className="h-4 rounded activity-card-shimmer"
                      style={{ width: '75%', background: 'var(--surface-container-high)' }}
                    />
                    <div
                      className="h-3 rounded activity-card-shimmer mt-0.5"
                      style={{ background: 'var(--surface-container-high)' }}
                    />
                    <div
                      className="h-3 rounded activity-card-shimmer"
                      style={{ width: '85%', background: 'var(--surface-container-high)' }}
                    />
                    <div
                      className="h-3 rounded activity-card-shimmer mt-auto"
                      style={{ width: '55%', background: 'var(--surface-container-high)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Dynamic AI-suggested chips (hidden while a free-form AI prompt is active) */}
      {!aiPrompt && (status === 'ready' || (status === 'loading' && places.length > 0)) && userLocation && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-4" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={clearTypes}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              background: selectedTypes.length === 0 && !activeChipLabel ? 'var(--accent)' : 'var(--surface-container)',
              color: selectedTypes.length === 0 && !activeChipLabel ? 'var(--on-accent)' : 'var(--text-secondary)',
            }}
          >
            <Globe size={14} />
            All
          </button>

          {chipsLoading && dynamicChips.length === 0 &&
            [72, 96, 84, 80, 92, 76].map((w, i) => (
              <div
                key={`chip-skel-${i}`}
                className="rounded-xl flex-shrink-0 activity-card-shimmer"
                style={{ width: `${w}px`, height: '36px', background: 'var(--surface-container-high)' }}
                aria-hidden="true"
              />
            ))}

          {dynamicChips.map(chip => {
            const isActive = activeChipLabel === chip.label;
            const ChipIcon = iconFor(chip.iconKey);
            return (
              <button
                key={chip.label}
                onClick={() => selectDynamicChip(chip)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--surface-container)',
                  color: isActive ? 'var(--on-accent)' : 'var(--text-secondary)',
                }}
              >
                <ChipIcon size={14} />
                {chip.label}
              </button>
            );
          })}

          {/* Escape hatch: if none of the suggested chips match what the user
              wants, "More" clears the active filter and focuses the prompt bar. */}
          {!chipsLoading && (
            <button
              onClick={openPromptBar}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: 'var(--surface-container)',
                color: 'var(--text-secondary)',
              }}
              aria-label="Search for something else"
            >
              <Plus size={14} />
              More
            </button>
          )}
        </div>
      )}

      {/* Skeleton filter chips during initial load */}
      {!aiPrompt && (status === 'locating' || (status === 'loading' && places.length === 0)) && (
        <div
          className="flex gap-2 overflow-x-hidden pb-1 -mx-1 px-1 mb-4"
          style={{ scrollbarWidth: 'none' }}
          aria-hidden="true"
        >
          {[60, 92, 78, 70, 88, 64, 80, 74].map((w, i) => (
            <div
              key={i}
              className="rounded-xl flex-shrink-0 activity-card-shimmer"
              style={{ width: `${w}px`, height: '36px', background: 'var(--surface-container-high)' }}
            />
          ))}
        </div>
      )}

      {/* States */}

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
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
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
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Try again
          </button>
        </div>
      )}

      {(status === 'locating' || status === 'loading' || status === 'ready') && (
        <>
          {places.length === 0 && (status === 'loading' || status === 'locating') && (
            <div className="space-y-8">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="w-full">
                  <div className="w-full activity-card-shimmer" style={{ aspectRatio: '4 / 5', borderRadius: '22px', background: 'var(--surface-container-high)' }} />
                  <div className="h-4 rounded-full mt-3 activity-card-shimmer" style={{ width: '60%', background: 'var(--surface-container-high)' }} />
                </div>
              ))}
            </div>
          )}

          {sortedPlaces.map((place, idx) => {
            const isSentinel = idx === Math.max(0, sortedPlaces.length - PREFETCH_AHEAD);
            return (
              <React.Fragment key={place.placeId}>
                <NearbyPost place={place} />
                {isSentinel && <div ref={sentinelRef} style={{ height: 1 }} />}
              </React.Fragment>
            );
          })}

          {/* Loading glow is rendered at the bottom of the section via AnimatePresence. */}

          {exhausted && places.length > 0 && (
            <div className="text-center py-10 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              You've reached the end of what's around.
            </div>
          )}

          {exhausted && places.length === 0 && status === 'ready' && (
            <div className="text-center py-16 px-6">
              <h3 className="text-base font-bold mb-1">
                {activeChipLabel
                  ? `Nothing open for "${activeChipLabel}" right now`
                  : aiPrompt
                  ? 'Nothing matched that'
                  : 'Nothing open nearby'}
              </h3>
              <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>
                {activeChipLabel || aiPrompt
                  ? 'Try another chip or search for something specific.'
                  : "We couldn't find anything open around you right now."}
              </p>
              {(activeChipLabel || aiPrompt) && (
                <button
                  onClick={openPromptBar}
                  className="px-5 py-3 rounded-2xl text-[13px] font-bold"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  Search instead
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Infinite-load glow -- sticks to the bottom of the scroll viewport so
          it appears above the PageIndicator, not over it. Wrapper has height 0
          so it never pushes layout; the gradient extends upward via absolute
          positioning within the sticky container. */}
      <div
        aria-hidden="true"
        style={{
          position: 'sticky',
          bottom: 0,
          height: 0,
          pointerEvents: 'none',
          zIndex: 30,
        }}
      >
        <AnimatePresence>
          {loadingMore && (
            <motion.div
              key="infinite-load-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                position: 'absolute',
                left: '-20px',
                right: '-20px',
                bottom: 0,
                height: '120px',
              }}
            >
              <motion.div
                animate={{ opacity: [0.65, 1, 0.65], filter: ['blur(0px)', 'blur(1.5px)', 'blur(0px)'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, color-mix(in srgb, var(--accent) 55%, transparent) 0%, color-mix(in srgb, var(--accent) 22%, transparent) 45%, transparent 100%)',
                }}
              />
              <motion.div
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '8px',
                  transform: 'translateX(-50%)',
                  width: '58%',
                  maxWidth: '360px',
                  height: '10px',
                  borderRadius: '9999px',
                  background: 'var(--accent)',
                  filter: 'blur(14px)',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
