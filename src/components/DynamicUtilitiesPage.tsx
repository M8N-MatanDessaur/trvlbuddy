import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useScope } from '../hooks/useScope';
import { factsFor } from '../data/countryFacts';
import { reverseGeocodeCountry } from '../utils/geocoding';
import PhotoScanner from './tools/PhotoScanner';
import PackingList from './tools/PackingList';
import WhereYouAreCard from './tools/WhereYouAreCard';

interface CurrencyInfo { code: string; rate: number; }

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'KRW', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'NZD', 'THB', 'TRY', 'ILS'];
const QUICK_AMOUNTS = [10, 20, 50, 100];

const DynamicUtilitiesPage: React.FC = () => {
  const { currentPlan: loadedPlan, appMode } = useTravel();
  // The address decides what this screen is about. At /tools it is where you
  // are standing, so the trip that happens to be loaded is not consulted at
  // all -- that is how the currency and the plugs for South Korea ended up on
  // a Tools screen opened from Nearby in Montreal.
  const scope = useScope();
  const currentPlan = scope.kind === 'trip' ? loadedPlan : null;
  const isLocalMode = scope.kind === 'local' || appMode === 'local' || !currentPlan;
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [homeAmount, setHomeAmount] = useState('');
  const [homeCurrency, setHomeCurrency] = useState(() => localStorage.getItem('homeCurrency') || 'USD');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({});
  const [ratesLoading, setRatesLoading] = useState(true);
  // Where the practical facts are about. On a trip that is the destination.
  // Off one it is wherever you are standing, which is the whole point of the
  // Tools tab in Nearby: it used to refuse to open at all without a plan.
  const [hereCountry, setHereCountry] = useState<{ code: string; name: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const tripCountry = useMemo(() => {
    if (!currentPlan) return null;
    const dest = currentPlan.destination || currentPlan.destinations?.[0];
    const code = (dest as { countryCode?: string; country?: string } | undefined)?.countryCode
      ?? (dest as { country?: string } | undefined)?.country
      ?? null;
    const name = (dest as { country?: string } | undefined)?.country ?? null;
    return code ? { code, name: name ?? code } : null;
  }, [currentPlan]);

  useEffect(() => {
    // Only ask the browser where we are when there is no trip to answer for
    // us. Position is not needed to convert currency, and asking for it when
    // it changes nothing is rude.
    if (tripCountry || hereCountry || locating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const found = await reverseGeocodeCountry(pos.coords.latitude, pos.coords.longitude);
        setHereCountry(found ? { code: found.code, name: found.name } : null);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600000 },
    );
  }, [tripCountry, hereCountry, locating]);

  const country = tripCountry ?? hereCountry;
  const facts = useMemo(() => factsFor(country?.code ?? null), [country?.code]);

  const getAllCurrencies = (): CurrencyInfo[] => {
    if (isLocalMode) {
      return COMMON_CURRENCIES
        .filter(code => code !== homeCurrency)
        .map(code => ({ code, rate: getRate(code) }));
    }
    const codes = new Set<string>();
    if (currentPlan!.tripType === 'day-trip') {
      const d = currentPlan!.destination || currentPlan!.destinations?.[0];
      if (d?.currency) codes.add(d.currency);
    } else {
      currentPlan!.destinations?.forEach((d: any) => { if (d.currency) codes.add(d.currency); });
    }
    return Array.from(codes).map(code => ({ code, rate: getRate(code) }));
  };

  useEffect(() => {
    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const base = homeCurrency.toLowerCase();
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setExchangeRates(data[base] || {});
      } catch {
        try {
          const base = homeCurrency.toLowerCase();
          const res = await fetch(`https://latest.currency-api.pages.dev/v1/currencies/${base}.json`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          setExchangeRates(data[base] || {});
        } catch { setExchangeRates({}); }
      }
      setRatesLoading(false);
    };
    fetchRates();
    localStorage.setItem('homeCurrency', homeCurrency);
  }, [homeCurrency]);

  const getRate = (fc: string): number => exchangeRates[fc.toLowerCase()] || 0;

  const allCurrencies = getAllCurrencies();
  const currentCurrency = selectedCurrency || allCurrencies[0]?.code || 'EUR';

  useEffect(() => {
    if (!selectedCurrency && allCurrencies.length > 0) setSelectedCurrency(allCurrencies[0].code);
  }, [allCurrencies.length]);

  const handleLocalChange = (v: string) => {
    setLocalAmount(v);
    const rate = getRate(currentCurrency);
    if (v && !isNaN(Number(v)) && rate > 0) setHomeAmount((Number(v) / rate).toFixed(2));
    else setHomeAmount('');
  };

  const handleHomeChange = (v: string) => {
    setHomeAmount(v);
    const rate = getRate(currentCurrency);
    if (v && !isNaN(Number(v)) && rate > 0) setLocalAmount((Number(v) * rate).toFixed(2));
    else setLocalAmount('');
  };

  const quickConvert = (homeAmt: number) => {
    const rate = getRate(currentCurrency);
    return rate > 0 ? (homeAmt * rate).toFixed(0) : '...';
  };

  return (
    <section className="page space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Tools</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {country ? `What to know in ${country.name}` : 'The practical things'}
        </p>
      </div>

      <WhereYouAreCard
        place={country?.name ?? null}
        facts={facts}
        loading={locating}
      />

      {/* Currency converter */}
      {allCurrencies.length > 0 && (
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Currency</span>
          <div className="flex items-center gap-2">
            <select value={homeCurrency} onChange={e => setHomeCurrency(e.target.value)} className="text-[12px] font-semibold px-2 py-1 rounded-lg border-none outline-none" style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)' }}>
              {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ArrowRightLeft size={14} style={{ color: 'var(--text-tertiary)' }} />
            {allCurrencies.length > 1 ? (
              <select value={currentCurrency} onChange={e => setSelectedCurrency(e.target.value)} className="text-[12px] font-semibold px-2 py-1 rounded-lg border-none outline-none" style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)' }}>
                {allCurrencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            ) : (
              <span className="text-[12px] font-semibold">{currentCurrency}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] mb-1">{homeCurrency}</div>
            <input type="number" value={homeAmount} onChange={e => handleHomeChange(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl text-[16px] font-bold border-none outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] mb-1">{currentCurrency}</div>
            <input type="number" value={localAmount} onChange={e => handleLocalChange(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl text-[16px] font-bold border-none outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        {/* Quick convert buttons */}
        <div className="flex gap-2">
          {QUICK_AMOUNTS.map(amt => (
            <button key={amt} onClick={() => handleHomeChange(String(amt))} className="flex-1 py-2 rounded-xl text-center transition-all active:scale-95" style={{ background: 'var(--surface-container-high)' }}>
              <div className="text-[11px] font-bold">{amt} {homeCurrency}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">= {quickConvert(amt)} {currentCurrency}</div>
            </button>
          ))}
        </div>

        {ratesLoading && <div className="text-[10px] text-center text-[var(--text-tertiary)]">Loading rates...</div>}
      </div>
      )}

      {/* Photo Scanner */}
      <PhotoScanner />

      {/* Packing List (pre-trip only, not shown in local mode) */}
      {!isLocalMode && <PackingList />}

    </section>
  );
};

export default DynamicUtilitiesPage;
