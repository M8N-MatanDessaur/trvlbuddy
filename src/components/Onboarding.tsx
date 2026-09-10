import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  Check,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Sparkles,
  Video,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import { getCurrentLocation } from '../utils/geolocation';
import { reverseGeocodeCountry, reverseGeocodeLocality } from '../utils/geocoding';
import { factsFor } from '../data/countryFacts';
import { PREFERENCE_SUGGESTIONS, savePreferences } from '../services/preferences';

/** Enough to pick from without becoming a menu to read. */
const CHIP_COUNT = 18;

/**
 * The first five minutes.
 *
 * Four screens, and each one shows the real thing rather than a picture of
 * it: the location step actually finds you and tells you something true
 * about where you are standing, the feed step is the shape of a real page,
 * and the preferences you pick here are the ones that rank your feed
 * afterwards. Onboarding that demonstrates instead of describing is the only
 * kind anyone finishes.
 *
 * The points screen states the real numbers. The old one said a photo earned
 * +1 when the database has always given 2, which is the sort of small lie
 * that teaches people not to read the rest.
 */
const Onboarding: React.FC = () => {
  const { user, profile, markOnboarded } = useAuth();
  const { setAppMode, setHasCompletedOnboarding } = useTravel();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [locating, setLocating] = useState(false);
  const [place, setPlace] = useState<{ city: string | null; country: string | null; code: string | null } | null>(null);
  const [declined, setDeclined] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [finishing, setFinishing] = useState<null | 'local' | 'trip'>(null);

  const firstName = (profile?.display_name || '').trim().split(' ')[0] || null;

  // A stable handful, not a fresh shuffle on every render.
  const chips = useMemo(() => {
    const pool = [...PREFERENCE_SUGGESTIONS];
    const out: string[] = [];
    let seed = 7;
    while (out.length < CHIP_COUNT && pool.length > 0) {
      seed = (seed * 1103515245 + 12345) % 2147483647;
      out.push(pool.splice(seed % pool.length, 1)[0]);
    }
    return out;
  }, []);

  const facts = factsFor(place?.code ?? null);

  const findMe = useCallback(async () => {
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      if (!loc) {
        setDeclined(true);
        return;
      }
      const [city, country] = await Promise.all([
        reverseGeocodeLocality(loc.lat, loc.lng),
        reverseGeocodeCountry(loc.lat, loc.lng),
      ]);
      setPlace({ city, country: country?.name ?? null, code: country?.code ?? null });
    } catch {
      setDeclined(true);
    } finally {
      setLocating(false);
    }
  }, []);

  const toggleChip = (value: string) =>
    setPicked((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );

  const finish = async (choice: 'local' | 'trip') => {
    setFinishing(choice);
    if (user && picked.length > 0) await savePreferences(user.id, picked);
    await markOnboarded();
    setAppMode(choice);
    if (choice === 'local') {
      setHasCompletedOnboarding(true);
      navigate('/nearby', { replace: true });
    }
    // A trip carries on into the trip builder, which is its own conversation.
  };

  const steps = [
    {
      key: 'where',
      eyebrow: 'To begin',
      title: place?.city
        ? `${place.city}. Good.`
        : firstName
          ? `Hello ${firstName}. Where are you?`
          : 'Where are you right now?',
    },
    { key: 'feed', eyebrow: 'How it works', title: 'One place at a time' },
    { key: 'likes', eyebrow: 'Your feed', title: 'What are you into?' },
    { key: 'points', eyebrow: 'Influence', title: 'What you give back, counted' },
  ];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: 'var(--bg-primary)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Four segments, filling. A dot row says "some screens"; this says how
          many are left, which is the thing people want to know. */}
      <div className="flex items-center gap-1.5 px-6 pt-6">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: '3px', background: 'var(--surface-container-high)' }}
          >
            <div
              style={{
                height: '100%',
                width: i <= step ? '100%' : '0%',
                background: 'var(--accent)',
                transition: 'width 420ms ease',
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col px-6 pt-10 pb-8 max-w-md w-full mx-auto">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
          style={{ color: 'var(--accent)' }}
        >
          {current.eyebrow}
        </p>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight mb-4">
          {current.title}
        </h1>

        {/* ---- where you are ---- */}
        {current.key === 'where' && (
          <div className="flex-1 flex flex-col">
            {!place && !declined && (
              <>
                <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  This app is about what is around you, so it needs to know where that is.
                  Nothing is shared with anyone. It is used to find places and to tell you
                  the practical things about the country you are standing in.
                </p>
                <button
                  type="button"
                  onClick={findMe}
                  disabled={locating}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-bold self-start px-6"
                  style={{
                    height: '52px',
                    background: 'var(--accent)',
                    color: 'var(--on-accent)',
                    border: 'none',
                  }}
                >
                  {locating ? <Loader2 size={17} className="animate-spin" /> : <Navigation size={17} />}
                  {locating ? 'Looking...' : 'Find me'}
                </button>
              </>
            )}

            {place && (
              <div className="tb-onboard-reveal">
                <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {place.country
                    ? `You are in ${place.country}. A few things worth knowing before you walk out of the door:`
                    : 'Here is what the app knows about where you are:'}
                </p>
                <div
                  className="mt-4 rounded-2xl p-4 flex flex-col gap-3"
                  style={{ background: 'var(--surface-container)', border: '0.5px solid var(--outline)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                    <p className="text-[13.5px]">
                      <strong>{place.city || place.country}</strong>
                      {facts.emergency ? `. Emergency number: ${facts.emergency}.` : '.'}
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Sparkles size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                    <p className="text-[13.5px]">{facts.tipping}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                    <p className="text-[13.5px]">
                      Plugs are {facts.plug}, {facts.voltage}. All of this works with no signal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {declined && (
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                No problem. The app will ask again when you open Nearby, and everything else
                works without it.
              </p>
            )}
          </div>
        )}

        {/* ---- the feed ---- */}
        {current.key === 'feed' && (
          <div className="flex-1 flex flex-col">
            <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Nearby is one place at a time, full screen. What is on tonight and what is open
              around you, in the same stream. Swipe up for the next one.
            </p>

            {/* The shape of a real page, not a drawing of one. */}
            <div
              className="mt-6 rounded-3xl overflow-hidden relative self-center w-full"
              style={{
                maxWidth: '15rem',
                aspectRatio: '9 / 16',
                background:
                  'linear-gradient(160deg, color-mix(in srgb, var(--accent) 55%, #12121a) 0%, #12121a 70%)',
                border: '0.5px solid var(--outline)',
              }}
              aria-hidden="true"
            >
              <div
                className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-1.5"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
              >
                <span
                  className="text-[10px] font-bold px-2 py-1 rounded-full self-start"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  Happening now
                </span>
                <p className="text-[15px] font-extrabold leading-tight" style={{ color: '#fff' }}>
                  Live jazz, 6:00 PM
                </p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  260 m away
                </p>
                <div className="flex gap-1.5 mt-1">
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: '#fff', color: '#111' }}
                  >
                    Visit
                  </span>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
                  >
                    Directions
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[13.5px] leading-relaxed mt-5" style={{ color: 'var(--text-secondary)' }}>
              Every one has a way in and a way there. Tap More for photos other people took
              and what they said about the place.
            </p>
          </div>
        )}

        {/* ---- preferences ---- */}
        {current.key === 'likes' && (
          <div className="flex-1 flex flex-col">
            <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Pick a few and they come first. If you say bagels, the bagel place is at the
              top. If there is no bagel place, the app does not invent one.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              {chips.map((chip) => {
                const on = picked.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleChip(chip)}
                    aria-pressed={on}
                    className="text-[13px] font-bold rounded-full px-3.5 transition-transform active:scale-95"
                    style={{
                      height: '38px',
                      minHeight: 0,
                      border: 'none',
                      background: on ? 'var(--accent)' : 'var(--surface-container-high)',
                      color: on ? 'var(--on-accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <p className="text-[12.5px] mt-4" style={{ color: 'var(--text-tertiary)' }}>
              {picked.length > 0
                ? `${picked.length} picked. You can change these any time in your profile.`
                : 'Optional. You can do this later in your profile.'}
            </p>
          </div>
        )}

        {/* ---- influence ---- */}
        {current.key === 'points' && (
          <div className="flex-1 flex flex-col">
            <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Influence counts what you left for the next person. It is not a leaderboard and
              it does not decide what you see. It is simply the record of what you gave.
            </p>
            <div className="flex flex-col gap-2.5 mt-5">
              {[
                { icon: Camera, label: 'Post a photo of a place', points: '+2' },
                { icon: Video, label: 'Post a clip', points: '+5' },
                { icon: Heart, label: 'Someone likes your photo', points: '+5' },
                { icon: Heart, label: 'Someone likes your clip', points: '+10' },
                { icon: MessageCircle, label: 'Someone comments on your photo', points: '+3' },
                { icon: MessageCircle, label: 'Someone answers your comment', points: '+1' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
                  style={{ background: 'var(--surface-container)', border: '0.5px solid var(--outline)' }}
                >
                  <row.icon size={15} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="text-[13.5px] flex-1">{row.label}</span>
                  <span className="text-[14px] font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>
                    {row.points}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] mt-4" style={{ color: 'var(--text-tertiary)' }}>
              Tips you write are not counted. They help whoever reads them, and that is the
              point of them.
            </p>
          </div>
        )}

        {/* ---- the way on ---- */}
        <div className="mt-8 flex flex-col gap-2">
          {!isLast ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep((i) => i + 1)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-bold"
                style={{
                  height: '52px',
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  border: 'none',
                }}
              >
                {current.key === 'where' && !place && !declined ? 'Skip for now' : 'Next'}
                <ArrowRight size={17} />
              </button>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((i) => i - 1)}
                  className="text-[13px] font-bold px-3"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)' }}
                >
                  Back
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => finish('local')}
                disabled={finishing !== null}
                className="inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-bold disabled:opacity-60"
                style={{
                  height: '52px',
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  border: 'none',
                }}
              >
                {finishing === 'local' ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <>
                    See what is around me
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => finish('trip')}
                disabled={finishing !== null}
                className="inline-flex items-center justify-center rounded-full text-[14px] font-bold disabled:opacity-60"
                style={{
                  height: '48px',
                  background: 'var(--surface-container-high)',
                  color: 'var(--text-primary)',
                  border: 'none',
                }}
              >
                {finishing === 'trip' ? <Loader2 size={16} className="animate-spin" /> : 'I am planning a trip'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
