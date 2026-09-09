import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Shield, LocateFixed, AlertTriangle, ChevronDown } from 'lucide-react';
import { getCachedLocation, getCurrentLocation, UserLocation } from '../utils/geolocation';
import { reverseGeocodeCountry } from '../utils/geocoding';
import {
  emergencyNumbersFor,
  primaryEmergencyNumber,
  labelledNumbers,
  COUNTRY_CODES_WITH_NUMBERS,
} from '../data/emergencyNumbers';

// SOS for people who are not on a planned trip.
//
// This screen used to ask Gemini for emergency numbers for your coordinates,
// which meant the screen you open when something has gone wrong depended on a
// network round trip, a working API key, and credit on the account. When the
// Gemini credits ran out, SOS stopped working entirely -- and there was no
// fallback of any kind, just "Couldn't load emergency info".
//
// The rules now:
//   * The numbers are bundled (src/data/emergencyNumbers.ts). No network, no
//     key, no cost.
//   * There is ALWAYS something dialable on screen. Never a dead end.
//   * Locating you is an optimisation, not a requirement. If it fails, or you
//     denied it, or you are offline, you pick your country by hand.
//   * The last country you were in is remembered, so the common case needs
//     nothing at all.

const LAST_COUNTRY_KEY = 'trvlbuddy_last_country_v1';

type Remembered = { code: string; name: string };

function readRemembered(): Remembered | null {
  try {
    const raw = localStorage.getItem(LAST_COUNTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.code ? parsed : null;
  } catch {
    return null;
  }
}

function remember(c: Remembered) {
  try { localStorage.setItem(LAST_COUNTRY_KEY, JSON.stringify(c)); } catch { /* fine */ }
}

// A readable country name from a code, without shipping a name table.
function countryName(code: string): string {
  try {
    const dn = new Intl.DisplayNames(undefined, { type: 'region' });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

const LocalEmergency: React.FC = () => {
  const remembered = readRemembered();
  const [country, setCountry] = useState<Remembered | null>(remembered);
  // 'idle' means we have a country already and are not looking for a better
  // one; nothing about locating should ever block the numbers being shown.
  const [locating, setLocating] = useState(!remembered);
  const [locateFailed, setLocateFailed] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loc: UserLocation | null = getCachedLocation();
      if (!loc) {
        try {
          loc = await getCurrentLocation();
        } catch {
          if (!cancelled) { setLocateFailed(true); setLocating(false); }
          return;
        }
      }
      if (cancelled || !loc) return;

      // Reverse geocoding goes through the places proxy and is cached for 30
      // days server side -- a coordinate's country does not move. If it is
      // unavailable we simply keep whatever country we already had.
      const found = await reverseGeocodeCountry(loc.lat, loc.lng);
      if (cancelled) return;
      if (found?.code) {
        const next = { code: found.code.toUpperCase(), name: found.name || countryName(found.code) };
        setCountry(next);
        remember(next);
      } else if (!remembered) {
        setLocateFailed(true);
      }
      setLocating(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookup = useMemo(() => emergencyNumbersFor(country?.code), [country?.code]);
  const primary = primaryEmergencyNumber(lookup.numbers);
  const listed = labelledNumbers(lookup.numbers);

  const chooseCountry = (code: string) => {
    const next = { code, name: countryName(code) };
    setCountry(next);
    remember(next);
    setPicking(false);
    setLocateFailed(false);
  };

  return (
    <section className="page space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Emergency</h1>
        <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          {country
            ? `Emergency numbers for ${country.name}`
            : locating
              ? 'Finding your country...'
              : 'Pick your country to see local numbers'}
        </p>
      </div>

      {/* The call button comes first and is never gated on anything. */}
      <a
        href={`tel:${primary}`}
        className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl text-[18px] font-bold no-underline transition-transform active:scale-[0.98]"
        style={{ background: 'var(--error)', color: 'white' }}
      >
        <Phone size={22} />
        Call {primary}
      </a>

      {!lookup.known && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[12px] leading-relaxed"
          style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}
        >
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <span>
            {country
              ? `We don't have verified numbers for ${country.name} yet. 112 reaches emergency services from most mobile networks.`
              : '112 reaches emergency services from most mobile networks. Pick your country below for local numbers.'}
          </span>
        </div>
      )}

      {listed.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Shield size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-tertiary)' }}>
              Direct lines
            </span>
          </div>
          <div className="card overflow-hidden">
            {listed.map((entry, i) => (
              <a
                key={entry.number}
                href={`tel:${entry.number}`}
                className="flex items-center justify-between px-4 py-3.5 no-underline"
                style={{ borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none' }}
              >
                <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.label}</span>
                <span className="text-[15px] font-bold" style={{ color: 'var(--accent)' }}>{entry.number}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Always available: correct the country by hand. This is the whole
          reason the screen cannot dead-end -- no location, no network, no
          problem. */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-[13px] font-semibold"
          style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}
        >
          <span className="flex items-center gap-2">
            <LocateFixed size={15} />
            {locateFailed && !country ? 'Choose your country' : 'Wrong country?'}
          </span>
          <ChevronDown
            size={16}
            style={{ transform: picking ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
          />
        </button>

        {picking && (
          <div
            className="card max-h-64 overflow-y-auto"
            style={{ border: '1px solid var(--outline)' }}
          >
            {COUNTRY_CODES_WITH_NUMBERS.map((code, i) => (
              <button
                key={code}
                type="button"
                onClick={() => chooseCountry(code)}
                className="flex items-center justify-between w-full px-4 py-3 text-left"
                style={{
                  borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none',
                  color: code === country?.code ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                <span className="text-[14px]">{countryName(code)}</span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
                  {primaryEmergencyNumber(emergencyNumbersFor(code).numbers)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed px-1" style={{ color: 'var(--text-tertiary)' }}>
        These numbers work without a connection. Always confirm the local emergency
        number when you arrive somewhere new.
      </p>
    </section>
  );
};

export default LocalEmergency;
