import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ExternalLink,
  MapPin,
  Navigation,
  Radar,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import {
  categoriesOnTrip,
  listTripActivities,
  placesOnTrip,
  setTripActivityDone,
  type TripActivityRow,
} from '../services/tripChecklist';
import { useToast } from '../contexts/ToastContext';
import { useChromePill } from '../contexts/ChromeContext';
import {
  interestForTrip,
  setInterest,
  type ActivityInterest,
  type Interest,
} from '../services/tripInterest';
import InterestRow from './trip/InterestRow';
import DynamicActivityModal from './DynamicActivityModal';
import type { GeneratedActivity } from '../types/TravelData';

/**
 * The trip, explored.
 *
 * Familiar but not the same as Nearby, and the difference is the point.
 * Nearby answers "what should I do in the next hour", so it shows one thing
 * at a time and you swipe. Explore answers "what are we doing on this trip",
 * which is a list you scan, compare, filter and tick off, so it is cards,
 * closer to Yelp or Airbnb than to a feed.
 *
 * Three things follow from a trip being shared:
 *
 *   - The list comes from trip_activities, not from local state, so everyone
 *     on the trip sees the same one.
 *   - Ticking something off is written to the trip. If one of you does the
 *     market, it is done for both of you.
 *   - The location pill is the TRIP's location, not yours. Standing in
 *     Montreal while the trip is in Seoul, "Montreal" is the wrong answer to
 *     every question this screen asks, so the pill says Seoul, and tapping
 *     it switches between the trip's cities or takes you back to Nearby.
 */
const TripExplore: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  // For the optimistic face: showing your own answer should not wait on a
  // round trip to find out what you look like.
  const profileName = profile?.display_name ?? null;
  const profileAvatar = profile?.avatar_url ?? null;
  const { currentTripId } = useTravel();
  const { toast } = useToast();

  const [rows, setRows] = useState<TripActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(true);
  const [openRow, setOpenRow] = useState<TripActivityRow | null>(null);
  const [interest, setInterestMap] = useState<Map<string, ActivityInterest>>(new Map());
  const [interestPending, setInterestPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listTripActivities(currentTripId)
      .then(async (list) => {
        if (cancelled) return;
        setRows(list);
        // Who is coming to each of these, in one query rather than one per card.
        const map = await interestForTrip(list.map((r) => r.id), user?.id ?? null);
        if (!cancelled) setInterestMap(map);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // user?.id matters: it decides which of the answers is marked as yours,
    // so signing in has to reload them rather than leaving every card looking
    // like you have not replied.
  }, [currentTripId, user?.id]);

  const places = useMemo(() => placesOnTrip(rows), [rows]);
  const categories = useMemo(
    () => categoriesOnTrip(place ? rows.filter((r) => placeKey(r) === place) : rows),
    [rows, place],
  );

  const visible = useMemo(() => {
    let list = rows;
    if (place) list = list.filter((r) => placeKey(r) === place);
    if (category) list = list.filter((r) => (r.category || 'other').toLowerCase().trim() === category);
    if (!showDone) list = list.filter((r) => !r.done_at);
    // Outstanding first: the list is a plan, and what is left to do is the
    // part you are reading it for.
    return [...list].sort((a, b) => Number(Boolean(a.done_at)) - Number(Boolean(b.done_at)));
  }, [rows, place, category, showDone]);

  const doneCount = visible.filter((r) => r.done_at).length;

  /**
   * Saying whether you are coming.
   *
   * Optimistic like the tick is: the answer is yours, and waiting on a round
   * trip to see your own face appear makes a group plan feel like a form.
   */
  const answer = useCallback(
    async (row: TripActivityRow, state: Interest | null) => {
      if (!user?.id) {
        toast('Sign in to say if you are coming', 'info');
        return;
      }
      const previous = interest.get(row.id);
      setInterestMap((prev) => {
        const next = new Map(prev);
        const entry = next.get(row.id);
        const others = (entry?.attendees ?? []).filter((a) => a.id !== user.id);
        const mineEntry = state
          ? [{
              id: user.id,
              name: profileName,
              avatarUrl: profileAvatar,
              state,
            }]
          : [];
        const attendees = [...others, ...mineEntry];
        next.set(row.id, {
          attendees,
          in: attendees.filter((a) => a.state === 'in'),
          out: attendees.filter((a) => a.state === 'out'),
          mine: state,
        });
        return next;
      });
      setInterestPending((prev) => new Set(prev).add(row.id));
      const ok = await setInterest({ activityId: row.id, userId: user.id, state });
      setInterestPending((prev) => {
        const copy = new Set(prev);
        copy.delete(row.id);
        return copy;
      });
      if (!ok) {
        toast('Could not save that', 'error');
        setInterestMap((prev) => {
          const next = new Map(prev);
          if (previous) next.set(row.id, previous);
          else next.delete(row.id);
          return next;
        });
      }
    },
    [user?.id, toast, interest, profileName, profileAvatar],
  );

  const toggle = useCallback(
    async (row: TripActivityRow) => {
      if (!user?.id) {
        toast('Sign in to tick things off', 'info');
        return;
      }
      const next = !row.done_at;
      // Optimistic: a tick should feel instant, and it is one boolean.
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, done_at: next ? new Date().toISOString() : null, done_by: next ? user.id : null }
            : r,
        ),
      );
      setPending((prev) => new Set(prev).add(row.id));
      const result = await setTripActivityDone(row.id, next, user.id);
      setPending((prev) => {
        const copy = new Set(prev);
        copy.delete(row.id);
        return copy;
      });
      if (!result.ok) {
        toast(result.error || 'Could not save that', 'error');
        // Put it back rather than leaving the screen claiming something the
        // trip does not agree with.
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, done_at: row.done_at, done_by: row.done_by } : r)),
        );
      }
    },
    [user?.id, toast],
  );

  const activePlace = places.find((p) => p.key === place) ?? null;
  const pillLabel = activePlace?.label ?? (places.length === 1 ? places[0].label : 'Whole trip');

  // The pill belongs to the chrome, not to this page. What it says is this
  // screen's business, which part of the trip you are looking at, but
  // there is one pill in one place, and it was drawing a second one of its
  // own next to the app's, with a second copy of your avatar beside it.
  useChromePill(
    {
      label: pillLabel,
      icon: MapPin,
      menu: (
        <>
              {places.length > 1 && (
                <button
                  type="button"
                  onClick={() => { setPlace(null); setCategory(null); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left"
                  style={{ background: place === null ? 'var(--surface-container-high)' : 'transparent', border: 'none', color: 'var(--text-primary)' }}
                >
                  <span className="text-[13px] font-bold">Whole trip</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {rows.length}
                  </span>
                </button>
              )}
              {places.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { setPlace(p.key); setCategory(null); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left"
                  style={{ background: place === p.key ? 'var(--surface-container-high)' : 'transparent', border: 'none', color: 'var(--text-primary)' }}
                >
                  <span className="text-[13px] font-bold truncate">{p.label}</span>
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    {p.doneCount}/{p.count}
                  </span>
                </button>
              ))}

              {/* The way back out. You are somewhere right now, and that is a
                  different question from what the trip contains. */}
              <button
                type="button"
                onClick={() => navigate('/nearby')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left mt-1"
                style={{ borderTop: '0.5px solid var(--outline)', background: 'transparent', border: 'none', color: 'var(--accent)' }}
              >
                <Radar size={14} />
                <span className="text-[13px] font-bold">What is near me now</span>
              </button>
        </>
      ),
    },
    [pillLabel, place, places, rows.length],
  );


  return (
    <section className="page">
      <div
        className="sticky z-30 -mx-5 px-5 pt-1 pb-2"
        style={{
          top: 0,
          // Its own ground, or the cards would show through it as it scrolls
          // underneath. The bleed either side cancels the page padding so the
          // band reaches the edges of the screen.
          background: 'var(--bg-primary)',
        }}
      >
      {/* Where the trip is up to. A plan you are ticking off should say how
          far through it you are. */}
      {rows.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: '6px', background: 'var(--surface-container-high)' }}
          >
            <div
              style={{
                width: `${visible.length === 0 ? 0 : (doneCount / visible.length) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span className="text-[11.5px] font-bold flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
            {doneCount} of {visible.length} done
          </span>
        </div>
      )}

      {/* Categories that exist on this trip, not a fixed menu with dead
          entries in it. */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-3" style={{ scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setCategory(null)}
            className="px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap flex-shrink-0"
            style={{
              background: category === null ? 'var(--accent)' : 'var(--surface-container)',
              color: category === null ? 'var(--on-accent)' : 'var(--text-secondary)',
              border: 'none',
            }}
          >
            Everything
          </button>
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key === category ? null : c.key)}
              className="px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap flex-shrink-0"
              style={{
                background: category === c.key ? 'var(--accent)' : 'var(--surface-container)',
                color: category === c.key ? 'var(--on-accent)' : 'var(--text-secondary)',
                border: 'none',
              }}
            >
              {c.label} <span style={{ opacity: 0.6 }}>{c.count}</span>
            </button>
          ))}
          {doneCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDone((s) => !s)}
              className="px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5"
              style={{
                background: showDone ? 'var(--surface-container)' : 'var(--accent)',
                color: showDone ? 'var(--text-secondary)' : 'var(--on-accent)',
                border: 'none',
              }}
            >
              <Check size={12} />
              {showDone ? 'Hide done' : 'Done hidden'}
            </button>
          )}
        </div>
      )}

      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="activity-card-shimmer rounded-3xl"
              style={{ height: '9rem', background: 'var(--surface-container-high)' }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl p-8 text-center" style={{ background: 'var(--surface-container)' }}>
          <h2 className="text-[16px] font-extrabold tracking-tight">
            {rows.length === 0 ? 'Nothing planned yet' : 'Nothing here'}
          </h2>
          <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            {rows.length === 0
              ? 'Add somewhere to your trip and it will show up here.'
              : 'Try another city or category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const done = Boolean(row.done_at);
            const busy = pending.has(row.id);
            const facts = [row.best_time, row.duration, row.estimated_cost].filter(Boolean);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [row.name, row.location].filter(Boolean).join(' '),
            )}`;
            return (
              <article
                key={row.id}
                className="rounded-3xl overflow-hidden"
                style={{
                  background: 'var(--surface-container-high)',
                  // Done items settle back rather than disappearing: the trip
                  // is a record of what you did as well as a list of what is
                  // left.
                  opacity: done ? 0.55 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div
                  className="p-4 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenRow(row)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenRow(row); } }}
                  aria-label={`Open details for ${row.name}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {row.category && (
                        <span
                          className="inline-block text-[10px] font-extrabold uppercase tracking-[0.1em] mb-1.5"
                          style={{ color: 'var(--accent)' }}
                        >
                          {row.category}
                        </span>
                      )}
                      <h3
                        className="text-[16px] font-extrabold tracking-tight leading-tight"
                        style={{ textDecoration: done ? 'line-through' : undefined }}
                      >
                        {row.name}
                      </h3>
                      {row.location && (
                        <p className="text-[11.5px] mt-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {row.location}
                        </p>
                      )}
                    </div>

                    {/* The tick. Big enough to be the obvious thing to do on
                        the card, because on a trip it is. */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void toggle(row); }}
                      disabled={busy}
                      aria-pressed={done}
                      aria-label={done ? `Mark ${row.name} as not done` : `Mark ${row.name} as done`}
                      className="flex items-center justify-center rounded-full flex-shrink-0 transition-transform active:scale-90 disabled:opacity-50"
                      style={{
                        width: '44px',
                        height: '44px',
                        background: done ? 'var(--accent)' : 'var(--surface-container)',
                        color: done ? 'var(--on-accent)' : 'var(--text-tertiary)',
                        border: done ? 'none' : '1px solid var(--outline)',
                      }}
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                  </div>

                  {row.description && !done && (
                    <p
                      className="text-[12.5px] leading-relaxed mt-2.5"
                      style={{
                        color: 'var(--text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      } as React.CSSProperties}
                    >
                      {row.description}
                    </p>
                  )}

                  {facts.length > 0 && !done && (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2.5">
                      {facts.map((fact) => (
                        <span
                          key={fact}
                          className="text-[11px] font-bold px-2 py-[3px] rounded-full"
                          style={{ border: '1px solid var(--outline)', color: 'var(--text-secondary)' }}
                        >
                          {fact}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Who is coming. Above the ways out, because on a shared
                      trip the question of whether anyone else is going comes
                      before the question of how to get there. */}
                  {!done && (
                    <div
                      className="mt-3 pt-3"
                      style={{ borderTop: '0.5px solid var(--outline)' }}
                    >
                      <InterestRow
                        interest={interest.get(row.id)}
                        viewerId={user?.id ?? null}
                        busy={interestPending.has(row.id)}
                        onSet={(state) => void answer(row, state)}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <a
                      href={mapsUrl}
                      onClick={(e) => e.stopPropagation()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-underline inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold"
                      style={{ background: 'var(--surface-container)', color: 'var(--text-primary)' }}
                    >
                      <Navigation size={12} />
                      Directions
                    </a>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(row.name)}`}
                      onClick={(e) => e.stopPropagation()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-underline inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold"
                      style={{ background: 'var(--surface-container)', color: 'var(--text-primary)' }}
                    >
                      <ExternalLink size={12} />
                      Look it up
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <DynamicActivityModal
        activity={openRow ? toGeneratedActivity(openRow) : null}
        isOpen={Boolean(openRow)}
        onClose={() => setOpenRow(null)}
      />
    </section>
  );
};

/**
 * A trip row in the shape the details sheet expects. The sheet predates this
 * screen and speaks GeneratedActivity, so the mapping lives here rather than
 * changing a component three other screens already use.
 */
function toGeneratedActivity(row: TripActivityRow): GeneratedActivity {
  return {
    name: row.name,
    category: row.category || 'other',
    description: row.description || '',
    estimatedCost: row.estimated_cost || '',
    duration: row.duration || '',
    bestTime: row.best_time || '',
    location: row.location || '',
    tips: row.tips || '',
    destinationId: row.destination_id || undefined,
    cityId: row.city_id || undefined,
    placeId: row.google_place_id || undefined,
  };
}

/** The same grouping key the service uses, so filters and counts agree. */
function placeKey(row: TripActivityRow): string {
  return row.city_id || row.location || row.destination_id || 'unknown';
}

export default TripExplore;
