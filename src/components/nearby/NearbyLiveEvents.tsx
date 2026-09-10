import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Calendar, MapPin, ExternalLink, PartyPopper, ShoppingBag, Palette, Music, Sparkles, Tag, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fetchLiveEvents, type LocalEvent, DEFAULT_LIVE_EVENTS_RADIUS_KM } from '../../services/liveEventsService';
import { UserLocation } from '../../utils/geolocation';
import { reverseGeocodeLocality } from '../../utils/geocoding';
import { resolveImages } from '../../services/imageLookup';
import { computeSlug } from '../../services/activityMediaService';

const typeIcons: Record<LocalEvent['type'], LucideIcon> = {
  festival: PartyPopper,
  market: ShoppingBag,
  exhibition: Palette,
  performance: Music,
  popup: Sparkles,
  other: Tag,
};

/**
 * The hero before it has arrived: the same frame, the same size, the same
 * text blocks in the same places. Nothing moves or resizes when the real one
 * replaces it.
 */
const HeroSkeleton: React.FC = () => (
  <div
    className="flex-shrink-0 relative overflow-hidden rounded-3xl activity-card-shimmer"
    style={{
      width: '100%',
      aspectRatio: '4 / 5',
      maxHeight: '32rem',
      background: 'var(--surface-container-high)',
    }}
  >
    <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3">
      <div className="min-w-0 flex-1 flex flex-col gap-2.5">
        <div
          className="rounded-full"
          style={{ height: '1.1rem', width: '5.5rem', background: 'var(--surface-container)' }}
        />
        <div
          className="rounded"
          style={{ height: '1.85rem', width: '85%', background: 'var(--surface-container)' }}
        />
        <div
          className="rounded"
          style={{ height: '1.85rem', width: '55%', background: 'var(--surface-container)' }}
        />
      </div>
      <div
        className="rounded-full flex-shrink-0"
        style={{ height: '2.5rem', width: '6rem', background: 'var(--surface-container)' }}
      />
    </div>
  </div>
);

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
  // A photograph per event, looked up from the venue or the event name. Free,
  // and deliberately absent rather than wrong: see imageLookup.
  const [images, setImages] = useState<Record<string, string>>({});
  const loopingRef = useRef(false);

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

    // Also watch the third card from the end. Reaching it starts the next
    // fetch while there is still content to swipe through, so the carousel
    // never stops at a spinner.
    const lookahead = scroller.querySelector<HTMLElement>(
      `[data-card-index="${Math.max(0, events.length - 3)}"]`,
    );
    if (lookahead && lookahead !== sentinel) observer.observe(lookahead);

    return () => observer.disconnect();
  }, [loadMore, done, loading, events.length]);

  // Find a picture for each event. One request covers the whole batch, the
  // answers are cached across sessions, each image is decoded before it is
  // shown, and no two events are given the same photograph. The venue is
  // tried first because a picture of the place beats one of a festival logo.
  useEffect(() => {
    if (events.length === 0) return;
    const controller = new AbortController();
    void resolveImages(
      events.map(event => ({
        key: event.name,
        locationId: computeSlug({
          name: event.name,
          address: event.location || null,
          city: null,
          country: null,
          lat: userLocation.lat,
          lng: userLocation.lng,
          googlePlaceId: null,
        }),
        names: [event.location, event.name],
        lat: userLocation.lat,
        lng: userLocation.lng,
      })),
      {
        signal: controller.signal,
        onImage: (key, url) => setImages(prev => (prev[key] ? prev : { ...prev, [key]: url })),
      },
    );
    return () => controller.abort();
  }, [events, localityName, userLocation.lat, userLocation.lng]);

  const handleRetry = () => setReloadNonce(n => n + 1);

  // Once there is nothing left to fetch, the strip carries a second copy of
  // everything and wraps around: swipe past the last event and you are back
  // at the first, with no end to arrive at. Until then it just grows, because
  // the next batch is already being fetched three cards out.
  const looping = done && events.length > 1;
  loopingRef.current = looping;
  const displayEvents = looping ? [...events, ...events] : events;

  // The wrap itself. Both copies are identical, so moving the scroll back by
  // exactly one copy is invisible, the same picture is under the thumb
  // before and after.
  const handleStripScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!loopingRef.current) return;
    const scroller = e.currentTarget;
    const card = scroller.querySelector<HTMLElement>('[data-card-index]');
    if (!card) return;
    const copyWidth = (card.getBoundingClientRect().width + 12) * events.length;
    if (copyWidth <= 0) return;
    if (scroller.scrollLeft >= copyWidth) {
      scroller.scrollLeft -= copyWidth;
    } else if (scroller.scrollLeft < 1) {
      // Going backwards off the front lands on the end of the first copy.
      scroller.scrollLeft += copyWidth;
    }
  };

  // Arrows as well as the drag: on a desktop pointer there is nothing to
  // swipe with, and a hero that can only be dragged looks like it is stuck.
  const nudge = (direction: -1 | 1) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const card = scroller.querySelector<HTMLElement>('[data-card-index]');
    const step = card ? card.getBoundingClientRect().width + 12 : scroller.clientWidth;
    if (!looping) {
      // Not looping yet, so going back off the front wraps to the last card
      // that has loaded rather than sitting against a wall.
      if (direction === -1 && scroller.scrollLeft < 1) {
        scroller.scrollTo({ left: step * (events.length - 1), behavior: 'smooth' });
        return;
      }
      scroller.scrollBy({ left: step * direction, behavior: 'smooth' });
      return;
    }
    scroller.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="space-y-3 mb-5">
        {/* The same header the loaded state has, including the two arrows, so
            the row does not rearrange itself the moment the events land. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-[14px] font-bold">Happening Now</h2>
            <div
              className="h-3 w-16 rounded-full activity-card-shimmer"
              style={{ background: 'var(--surface-container-high)' }}
            />
          </div>
          {/* Say what is happening, rather than shimmering silently. Finding
              what is on nearby takes a few seconds, and a wait you understand
              is a shorter wait. */}
          <span
            className="text-[11px] font-semibold flex-shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Finding what's on...
          </span>
        </div>
        <div className="flex -mx-1 px-1" aria-hidden="true">
          <HeroSkeleton />
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
    <div className="space-y-3 mb-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={14} style={{ color: 'var(--accent)' }} />
          <h2 className="text-[14px] font-bold">Happening Now</h2>
          {localityName && (
            <span className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
              {localityName}
            </span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleStripScroll}
        className="flex overflow-x-auto snap-x snap-mandatory -mx-1 px-1"
        style={{
          // One hero at a time, dragged with a thumb. No scrollbar, and no
          // hard stop at either end once the loop is on.
          gap: '0.75rem',
          scrollbarWidth: 'none',
        }}
      >
        {displayEvents.map((event, i) => {
          const TypeIcon = typeIcons[event.type] || Tag;
          const image = images[event.name];
          const hasSource = Boolean(event.sourceUrl);
          const searchQuery = [event.name, event.location].filter(Boolean).join(' ');
          const linkUrl = hasSource
            ? event.sourceUrl!
            : `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
          return (
            <div
              key={`${event.name}-${i}`}
              data-card-index={i}
              className="flex-shrink-0 snap-center relative overflow-hidden rounded-3xl"
              style={{
                width: '100%',
                aspectRatio: '4 / 5',
                maxHeight: '32rem',
                background: 'var(--surface-container)',
              }}
            >
              {image ? (
                <img
                  src={image}
                  alt=""
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(155deg, var(--accent) 0%, var(--accent-light, var(--accent)) 45%, var(--surface-container-high) 100%)',
                    }}
                  />
                  {/* The category, oversized and faint: something to look at
                      where a photograph would have been, drawn from the
                      content rather than added as decoration. */}
                  <TypeIcon
                    size={240}
                    strokeWidth={0.9}
                    className="absolute"
                    style={{
                      color: '#fff',
                      opacity: 0.15,
                      top: '8%',
                      right: '-3rem',
                      transform: 'rotate(-8deg)',
                    }}
                    aria-hidden="true"
                  />
                </>
              )}

              {/* The text sits over a picture, so it carries its own ground. */}
              <div
                className="absolute inset-x-0 bottom-0 pointer-events-none"
                style={{
                  height: '70%',
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.58) 34%, rgba(0,0,0,0.14) 70%, transparent 100%)',
                }}
              />

              {/* The whole hero opens the event. It is a layer under the text
                  rather than a wrapper around it, so the arrows below can be
                  real buttons instead of links inside a link. */}
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-[1]"
                aria-label={`Open ${event.name}`}
              />

              {/* Title, type and when along the bottom left; where it is, the
                  way in, and the way onward on the bottom right. */}
              <div className="absolute inset-x-0 bottom-0 z-[2] p-4 flex items-end justify-between gap-3 pointer-events-none">
                <div className="min-w-0 flex-1 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10.5px] font-bold capitalize"
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        color: '#fff',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                      }}
                    >
                      <TypeIcon size={10} />
                      {event.type}
                    </span>
                    {event.time && (
                      <span className="text-[11.5px] font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                        {event.time}
                      </span>
                    )}
                  </div>

                  <h4
                    className="font-extrabold tracking-tight"
                    style={{
                      color: '#fff',
                      fontSize: 'clamp(1.5rem, 7vw, 2.25rem)',
                      lineHeight: 1.03,
                      textWrap: 'balance',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    } as React.CSSProperties}
                  >
                    {event.name}
                  </h4>

                  {event.description && (
                    <p
                      className="text-[12.5px] leading-relaxed"
                      style={{
                        color: 'rgba(255,255,255,0.8)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      } as React.CSSProperties}
                    >
                      {event.description}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-2" style={{ maxWidth: '46%' }}>
                  {event.location && (
                    <div
                      className="flex items-center gap-1 text-[11px] text-right"
                      style={{ color: 'rgba(255,255,255,0.78)' }}
                    >
                      <MapPin size={10} className="flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-underline inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-bold whitespace-nowrap transition-transform active:scale-[0.96]"
                      style={{ background: '#fff', color: '#111' }}
                    >
                      {hasSource ? 'Visit site' : 'Search'}
                      <ExternalLink size={12} className="flex-shrink-0" />
                    </a>
                    {/* Next to the way in, the way onward. On the hero, where
                        the thumb already is, rather than up in the heading. */}
                    {([['Previous', -1, ChevronLeft], ['Next', 1, ChevronRight]] as const).map(
                      ([label, direction, Icon]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => nudge(direction)}
                          aria-label={`${label} event`}
                          className="flex items-center justify-center rounded-full transition-transform active:scale-90"
                          style={{
                            width: '38px',
                            height: '38px',
                            minWidth: '38px',
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            color: '#fff',
                            border: 'none',
                          }}
                        >
                          <Icon size={17} />
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!done && (
          <div
            ref={sentinelRef}
            className="flex-shrink-0 snap-center"
            style={{ width: '100%' }}
            aria-label={loadingMore ? 'Loading more events' : 'Load more events'}
          >
            <HeroSkeleton />
          </div>
        )}

        {/* Only when there is genuinely nothing to loop through. With events
            in hand the strip wraps instead, so there is no end card to hit. */}
        {done && !looping && (
          <div className="flex-shrink-0 snap-center" style={{ width: '100%' }}>
            <div
              className="rounded-3xl p-6 flex flex-col items-center justify-center gap-2 text-center"
              style={{ background: 'var(--surface-container)', minHeight: '11rem' }}
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
