import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Calendar, MapPin, ExternalLink, PartyPopper, ShoppingBag, Palette, Music, Sparkles, Tag, CheckCircle2, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fetchLiveEvents, type LocalEvent, DEFAULT_LIVE_EVENTS_RADIUS_KM } from '../../services/liveEventsService';
import { UserLocation } from '../../utils/geolocation';
import { reverseGeocodeLocality } from '../../utils/geocoding';
import AutoScrollText from '../AutoScrollText';

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
  focus?: string | null;
}

const NearbyLiveEvents: React.FC<Props> = ({ userLocation, focus }) => {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [localityName, setLocalityName] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(null);

  const localityRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadingMore(false);
    setEvents([]);
    setDone(false);

    (async () => {
      const name = await reverseGeocodeLocality(userLocation.lat, userLocation.lng);
      if (cancelled) return;
      setLocalityName(name);
      localityRef.current = name;
      const displayName = name || 'this area';
      const result = await fetchLiveEvents(
        displayName,
        { lat: userLocation.lat, lng: userLocation.lng },
        { radiusKm: DEFAULT_LIVE_EVENTS_RADIUS_KM, focus: focus || undefined },
      );
      if (cancelled) return;
      setEvents(result);
      if (result.length === 0) setDone(true);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userLocation.lat, userLocation.lng, reloadNonce, focus]);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || loading || done) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    const before = events.length;
    const displayName = localityRef.current || 'this area';
    const existingNames = events.map(e => e.name);
    const more = await fetchLiveEvents(
      displayName,
      { lat: userLocation.lat, lng: userLocation.lng },
      {
        radiusKm: DEFAULT_LIVE_EVENTS_RADIUS_KM,
        excludeNames: existingNames,
        focus: focus || undefined,
      },
    );
    const existingSet = new Set(existingNames.map(n => n.toLowerCase().trim()));
    const unique = more.filter(e => e?.name && !existingSet.has(e.name.toLowerCase().trim()));
    if (unique.length === 0) {
      setDone(true);
    } else {
      setEvents(prev => [...prev, ...unique]);
      setPendingScrollIndex(before);
    }
    setLoadingMore(false);
    // Keep the in-flight guard on for a short cooldown so the sentinel
    // (which may still be intersecting during scroll adjustment) can't
    // re-trigger loadMore immediately.
    setTimeout(() => {
      inFlightRef.current = false;
    }, 600);
  }, [events, loading, done, userLocation.lat, userLocation.lng, focus]);

  // After new events are appended, jump the horizontal scroll so the first
  // newly loaded card sits at the left edge of the viewport. This puts the
  // user on the fresh content and pushes the sentinel far off-screen to the
  // right, so they have to actively scroll again before another load fires.
  useLayoutEffect(() => {
    if (pendingScrollIndex == null) return;
    const scroller = scrollRef.current;
    if (!scroller) {
      setPendingScrollIndex(null);
      return;
    }
    const target = scroller.querySelector<HTMLElement>(
      `[data-card-index="${pendingScrollIndex}"]`,
    );
    if (target) {
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const delta = targetRect.left - scrollerRect.left - 4;
      scroller.scrollLeft += delta;
    }
    setPendingScrollIndex(null);
  }, [pendingScrollIndex, events.length]);

  useEffect(() => {
    if (done || loading) return;
    const sentinel = sentinelRef.current;
    const scroller = scrollRef.current;
    if (!sentinel || !scroller) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) loadMore();
      },
      { root: scroller, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, done, loading, events.length]);

  const handleRetry = () => setReloadNonce(n => n + 1);

  if (loading) {
    return (
      <div className="space-y-2.5 mb-5">
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
        <div
          className="flex gap-3 overflow-x-hidden pb-2 -mx-1 px-1"
          aria-hidden="true"
        >
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
    );
  }

  if (events.length === 0) {
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
          className="rounded-2xl p-3.5 flex items-center gap-3"
          style={{ background: 'var(--surface-container)' }}
        >
          <CheckCircle2 size={18} style={{ color: 'var(--text-tertiary)' }} />
          <div className="flex-1">
            <p className="text-[12px] font-semibold">Nothing happening near you right now.</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Check back later for events within {DEFAULT_LIVE_EVENTS_RADIUS_KM} km.
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
            style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      </div>
    );
  }

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
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {events.map((event, i) => {
          const TypeIcon = typeIcons[event.type] || Tag;
          const hasSource = Boolean(event.sourceUrl);
          const searchQuery = [event.name, event.location].filter(Boolean).join(' ');
          const linkUrl = hasSource
            ? event.sourceUrl!
            : `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
          return (
            <a
              key={`${event.name}-${i}`}
              data-card-index={i}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 snap-start no-underline"
              style={{ width: '250px', color: 'inherit' }}
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
                <AutoScrollText
                  className="text-[11px] leading-relaxed flex-1"
                  style={{ color: 'var(--text-secondary)' }}
                  maxHeight="2.6em"
                >
                  {event.description}
                </AutoScrollText>
                {event.location && (
                  <div
                    className="flex items-center gap-1 text-[10px] truncate"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <MapPin size={9} className="flex-shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
                <div
                  className="flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  <span className="truncate">{hasSource ? 'Visit site' : 'Search the web'}</span>
                  <ExternalLink size={10} className="flex-shrink-0" />
                </div>
              </div>
            </a>
          );
        })}

        {!done && (
          <div
            ref={sentinelRef}
            className="flex-shrink-0 snap-start"
            style={{ width: '250px' }}
            aria-label={loadingMore ? 'Loading more events' : 'Load more events'}
          >
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
                style={{ width: '70%', background: 'var(--surface-container-high)' }}
              />
              <div
                className="h-3 rounded activity-card-shimmer mt-0.5"
                style={{ background: 'var(--surface-container-high)' }}
              />
              <div
                className="h-3 rounded activity-card-shimmer"
                style={{ width: '80%', background: 'var(--surface-container-high)' }}
              />
              <div
                className="h-3 rounded activity-card-shimmer mt-auto"
                style={{ width: '55%', background: 'var(--surface-container-high)' }}
              />
            </div>
          </div>
        )}

        {done && (
          <div className="flex-shrink-0 snap-start" style={{ width: '240px' }}>
            <div
              className="h-full rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 text-center"
              style={{ background: 'var(--surface-container)' }}
            >
              <CheckCircle2 size={20} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-[12px] font-semibold">That's all within {DEFAULT_LIVE_EVENTS_RADIUS_KM} km.</p>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                No more events near you right now. Try again later.
              </p>
              <button
                onClick={handleRetry}
                className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
              >
                <RefreshCw size={11} />
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] px-1" style={{ color: 'var(--text-tertiary)' }}>
        Powered by AI. Verify event details before attending. Results limited to a {DEFAULT_LIVE_EVENTS_RADIUS_KM} km radius.
      </p>
    </div>
  );
};

export default NearbyLiveEvents;
