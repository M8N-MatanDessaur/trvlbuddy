import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import PhotoScanner from './tools/PhotoScanner';
import PackingList from './tools/PackingList';

interface CurrencyInfo { code: string; rate: number; }

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'KRW', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'NZD', 'THB', 'TRY', 'ILS'];
const QUICK_AMOUNTS = [10, 20, 50, 100];

const DynamicUtilitiesPage: React.FC = () => {
  const { currentPlan } = useTravel();
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [homeAmount, setHomeAmount] = useState('');
  const [homeCurrency, setHomeCurrency] = useState(() => localStorage.getItem('homeCurrency') || 'USD');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({});
  const [ratesLoading, setRatesLoading] = useState(true);

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center py-16">
          <h2 className="mb-3">No Travel Plan</h2>
          <p className="text-[var(--text-secondary)]">Complete onboarding first.</p>
        </div>
      </section>
    );
  }

  const getAllCurrencies = (): CurrencyInfo[] => {
    const codes = new Set<string>();
    if (currentPlan.tripType === 'day-trip') {
      const d = currentPlan.destination || currentPlan.destinations?.[0];
      if (d?.currency) codes.add(d.currency);
    } else {
      currentPlan.destinations?.forEach((d: any) => { if (d.currency) codes.add(d.currency); });
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

  if (allCurrencies.length === 0) {
    return (
      <section className="page">
        <div className="text-center py-16">
          <AlertTriangle size={32} style={{ color: 'var(--error)', margin: '0 auto 12px' }} />
          <h2 className="mb-2">No Destinations</h2>
          <p className="text-[var(--text-secondary)]">Complete onboarding to access tools.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Tools</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">Currency, photos, and packing</p>
      </div>

      {/* Currency converter */}
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

      {/* Photo Scanner */}
      <PhotoScanner />

      {/* Packing List (pre-trip only) */}
      <PackingList />

    </section>
  );
};

export default DynamicUtilitiesPage;
