import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, ChevronDown } from 'lucide-react';
import { FeedItem, tagFor } from '../../services/unifiedFeed';
import { viewOf } from '../../services/feedItemView';
import type { PlacePulse } from '../../services/placePulse';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import NearbyPost from './NearbyPost';
import NearbyInfoPage from './NearbyInfoPage';
import FeedSidePanel from './FeedSidePanel';

interface Props {
  items: FeedItem[];
  /** Free photographs, keyed by feed item id. */
  images: Record<string, string>;
  /** Signs of life on each place, keyed by its activity slug. */
  pulseBySlug?: Map<string, PlacePulse>;
  /** Called on approach to the end, so the next batch is there on arrival. */
  onNearEnd: () => void;
  /** True when there is nothing more to fetch, which turns the loop on. */
  exhausted?: boolean;
  /** "Montreal, QC". Fixed top-left while the pages move under it. */
  locality?: string | null;
  /** Tapping the pill opens this, when there is anything to choose. */
  localityMenu?: React.ReactNode;
  /** Tapping the pill asks for your position again, when there is no menu. */
  onUpdateLocation?: () => void;
  /** True while that is in flight, so the pill can say so. */
  locating?: boolean;
  /** The viewer, top-right. Opens their profile. */
  avatar?: React.ReactNode;
  /**
   * Which stated preference promoted each item, by id. A promoted card says
   * so, because a feed that quietly reorders itself is indistinguishable
   * from one that is wrong.
   */
  preferenceMatches?: Map<string, string>;
}

/** How far from the end to start fetching. */
const LOOKAHEAD = 3;

/**
 * The whole of Nearby, one thing at a time.
 *
 * A vertical scroller you drag with a thumb: what is on today, what is open
 * around you, and what is worth seeing, in one stream rather than in three
 * sections. Each page says which kind it is.
 *
 * There are no counters and no end. More is fetched three pages out, and once
 * there is genuinely nothing left to fetch the stream carries a second copy of
 * itself and wraps, so dragging onward always lands on something.
 */
const NearbyPager: React.FC<Props> = ({
  items,
  images,
  pulseBySlug,
  onNearEnd,
  exhausted = false,
  locality,
  localityMenu,
  onUpdateLocation,
  locating = false,
  avatar,
  preferenceMatches,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  // Extra passes over the same content, appended once there is nothing new
  // left to fetch. The feed simply keeps getting longer, so there is no wrap,
  // no jump and no end, and each pass is rotated, so a location turns up
  // where an event was and the events come round again after it.
  const [passes, setPasses] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const isDesktop = useIsDesktop();

  // Jumping the stage to a page, for the desktop queue. Scrolling the
  // container rather than calling scrollIntoView keeps the page's own snap
  // points in charge of where it lands.
  const goTo = useCallback((i: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: i * scroller.clientHeight, behavior: 'smooth' });
  }, []);

  const pages = useMemo(() => {
    if (passes === 0) return items;
    const out = [...items];
    for (let p = 1; p <= passes; p += 1) {
      // Rotating by an odd stride re-mixes the kinds against each other
      // instead of replaying the same order.
      const offset = (p * 3) % Math.max(1, items.length);
      const rotated = [...items.slice(offset), ...items.slice(0, offset)];
      // Ids must stay unique per rendered page or React reuses the wrong one.
      out.push(...rotated.map((item) => ({ ...item, id: `${item.id}#${p}` })));
    }
    return out;
  }, [items, passes]);

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const page = scroller.clientHeight;
    if (page <= 0) return;
    setIndex(Math.round(scroller.scrollTop / page));
  }, []);

  // Fetch on approach rather than on arrival, so dragging onward never lands
  // on a spinner.
  //
  // Then the part that matters: if that fetch brings nothing back, add
  // another pass over what we already have. This deliberately does not wait
  // on an "exhausted" flag, that flag was not being set in practice, and
  // the feed ended anyway. What is happening now is still happening, so the
  // only correct behaviour at the bottom is more feed.
  const askedAtRef = useRef(-1);
  const itemsAtAskRef = useRef(0);
  useEffect(() => {
    if (items.length === 0) return;
    if (index < pages.length - LOOKAHEAD) return;
    if (askedAtRef.current === pages.length) return;
    askedAtRef.current = pages.length;

    onNearEnd();

    // Give the fetch a moment. If the feed is no longer than it was, nothing
    // is coming, so extend it ourselves. A cap only so an hour of scrolling
    // cannot grow the DOM without bound.
    const timer = setTimeout(() => {
      if (items.length <= itemsAtAskRef.current && passes < 12) setPasses((p) => p + 1);
    }, 2000);
    itemsAtAskRef.current = items.length;
    return () => clearTimeout(timer);
  }, [index, pages.length, items.length, onNearEnd, passes]);

  if (items.length === 0) return null;

  return (
    // h-full matters: without it this box shrinks to its content, the
    // scroller inside inherits that, and every page's height:100% resolves
    // to nothing, which is exactly how the feed came to show only its
    // loading row on an otherwise empty screen.
    <div className="relative h-full pager-row">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="pager-stage overflow-y-auto snap-y snap-mandatory"
        style={{
          // Actually full screen. The wrapper in NearbyFeed cancels the page
          // padding, so this runs to the edges and stops only at the nav.
          height: '100%',
          background: 'var(--surface-container)',
          scrollbarWidth: 'none',
          overscrollBehaviorY: 'contain',
        }}
      >
        {pages.map((item, i) => {
          const baseId = item.id.split('#')[0];
          const because = preferenceMatches?.get(baseId);
          const label = because ? because.charAt(0).toUpperCase() + because.slice(1) : tagFor(item);
          return (
          <div
            key={`${item.id}-${i}`}
            data-page-index={i}
            className="snap-start"
            style={{ height: '100%' }}
          >
            {item.kind === 'place' ? (
              <NearbyPost
                place={item.place}
                heroImage={images[item.id]}
                variant="page"
                tag={label}
                pulse={pulseBySlug?.get(`gpid-${item.place.placeId}`) ?? null}
              />
            ) : (
              (() => {
                const view = viewOf(item, images[item.id]);
                return (
                  <NearbyInfoPage
                    tag={label}
                    title={view.title}
                    meta={view.meta}
                    blurb={view.blurb}
                    where={view.where}
                    image={view.image}
                    sourceUrl={view.sourceUrl}
                    directionsUrl={view.directionsUrl}
                    Icon={view.Icon}
                  />
                );
              })()
            )}
          </div>
          );
        })}

        {!exhausted && (
          <div
            className="snap-start flex flex-col items-center justify-center gap-3"
            style={{ height: '100%' }}
            aria-label="Loading more"
          >
            <div
              className="rounded-full activity-card-shimmer"
              style={{ width: '2.5rem', height: '2.5rem', background: 'var(--surface-container-high)' }}
            />
            <p className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Finding more to do...
            </p>
          </div>
        )}
      </div>

      {isDesktop && (
        <div className="pager-side">
          <FeedSidePanel
            items={pages}
            index={index}
            images={images}
            onSelect={goTo}
            pulseBySlug={pulseBySlug}
          />
        </div>
      )}

      {/* Where you are, and you. The only chrome, and it stays put while the
          pages move under it. No arrows: the whole thing is swipeable, and
          buttons bolted to a full-screen frame stop it reading as one. */}
      {locality && (
        <div className="absolute left-4 top-4 z-40 max-w-[62%]">
        <button
          type="button"
          onClick={() => (localityMenu ? setMenuOpen((o) => !o) : onUpdateLocation?.())}
          aria-expanded={localityMenu ? menuOpen : undefined}
          aria-label={
            localityMenu
              ? `You are near ${locality}. Choose a place to explore`
              : `You are near ${locality}. Update my location`
          }
          className="px-4 rounded-full text-[12.5px] font-bold max-w-full inline-flex items-center gap-1.5 transition-transform active:scale-95"
          style={{
            height: '44px',
            background: 'rgba(22,22,26,0.62)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.22)',
          }}
        >
          <LocateFixed
            size={13}
            className={locating ? 'flex-shrink-0 animate-spin' : 'flex-shrink-0'}
          />
          <span className="truncate">{locating ? 'Finding you...' : locality}</span>
          {localityMenu && (
            <ChevronDown
              size={13}
              className="flex-shrink-0"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }}
            />
          )}
        </button>

        {localityMenu && menuOpen && (
          <div
            className="mt-2 rounded-2xl p-1.5"
            style={{
              minWidth: 'min(76vw, 17rem)',
              background: 'var(--bg-secondary)',
              border: '0.5px solid var(--outline)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={() => setMenuOpen(false)}
          >
            {localityMenu}
          </div>
        )}
        </div>
      )}
      {avatar && <div className="absolute right-4 top-4 z-40">{avatar}</div>}
    </div>
  );
};

export default NearbyPager;
