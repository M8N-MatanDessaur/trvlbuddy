import React, { useState, useEffect } from 'react';
import { Phone, Thermometer, Cloud, Sun, CloudRain, Globe, Loader2, AlertTriangle, Building2, Volume2, ArrowRightLeft, ExternalLink, Map as MapIcon } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';

interface WeatherData {
  temp: number;
  condition: string;
  icon: React.ComponentType<any>;
  humidity: number;
  feelsLike: number;
  isLoading: boolean;
  error?: string;
}

interface CurrencyInfo { code: string; rate: number; }
interface LocationInfo { id: string; name: string; country: string; type: 'city' | 'destination'; coordinates?: { lat: number; lng: number }; }
interface CountryInfo { id: string; name: string; languages: string[]; }

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'KRW', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'NZD', 'THB', 'TRY', 'ILS'];
const QUICK_AMOUNTS = [10, 20, 50, 100];

const DynamicUtilitiesPage: React.FC = () => {
  const { currentPlan, emergencyContacts } = useTravel();
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selectedWeatherLocation, setSelectedWeatherLocation] = useState('');
  const [selectedEmergencyCountry, setSelectedEmergencyCountry] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [homeAmount, setHomeAmount] = useState('');
  const [homeCurrency, setHomeCurrency] = useState(() => localStorage.getItem('homeCurrency') || 'USD');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({});
  const [ratesLoading, setRatesLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<{ [key: string]: WeatherData }>({});

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

  const getAllLocations = (): LocationInfo[] => {
    const locs: LocationInfo[] = [];
    if (currentPlan.tripType === 'day-trip') {
      const d = currentPlan.destination || currentPlan.destinations?.[0];
      if (d) locs.push({ id: d.id, name: d.name, country: d.country, type: 'destination', coordinates: d.coordinates });
    } else {
      const citySegs = currentPlan.segments?.filter((s: any) => s.city) || [];
      if (citySegs.length > 0) {
        citySegs.forEach((s: any) => locs.push({ id: s.city!.id, name: s.city!.name, country: s.destination.country, type: 'city', coordinates: s.city!.coordinates }));
      } else {
        currentPlan.segments?.filter((s: any) => !s.city).forEach((s: any) => {
          if (s.destination.name) locs.push({ id: s.destination.id, name: s.destination.name, country: s.destination.country, type: 'destination', coordinates: s.destination.coordinates });
        });
      }
    }
    return locs;
  };

  const getAllCountries = (): CountryInfo[] => {
    const countries = new Map<string, CountryInfo>();
    if (currentPlan.tripType === 'day-trip') {
      const d = currentPlan.destination || currentPlan.destinations?.[0];
      if (d) countries.set(d.id, { id: d.id, name: d.country, languages: d.languages || [] });
    } else {
      currentPlan.destinations?.forEach((d: any) => {
        if (!countries.has(d.id)) countries.set(d.id, { id: d.id, name: d.country, languages: d.languages || [] });
      });
    }
    return Array.from(countries.values());
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

  const fetchWeather = async (loc: LocationInfo): Promise<WeatherData> => {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(loc.name)}?format=j1`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const cur = data.current_condition[0];
      const code = parseInt(cur.weatherCode);
      const icon = code >= 200 && code < 700 ? CloudRain : code === 800 ? Sun : Cloud;
      return { temp: parseInt(cur.temp_C), condition: cur.weatherDesc[0].value, icon, humidity: parseInt(cur.humidity), feelsLike: parseInt(cur.FeelsLikeC), isLoading: false };
    } catch {
      const baseTemp = loc.coordinates ? (Math.abs(loc.coordinates.lat) > 45 ? 15 : Math.abs(loc.coordinates.lat) > 23 ? 22 : 28) : 22;
      return { temp: baseTemp + Math.floor(Math.random() * 6) - 3, condition: 'Partly Cloudy', icon: Cloud, humidity: 55, feelsLike: baseTemp, isLoading: false, error: 'Estimated weather' };
    }
  };

  const allCurrencies = getAllCurrencies();
  const allLocations = getAllLocations();
  const allCountries = getAllCountries();
  const currentCurrency = selectedCurrency || allCurrencies[0]?.code || 'EUR';
  const currentWeatherLoc = selectedWeatherLocation || allLocations[0]?.id || '';
  const currentEmergencyCtry = selectedEmergencyCountry || allCountries[0]?.id || '';

  useEffect(() => {
    if (!selectedCurrency && allCurrencies.length > 0) setSelectedCurrency(allCurrencies[0].code);
    if (!selectedWeatherLocation && allLocations.length > 0) setSelectedWeatherLocation(allLocations[0].id);
    if (!selectedEmergencyCountry && allCountries.length > 0) setSelectedEmergencyCountry(allCountries[0].id);
  }, [allCurrencies.length, allLocations.length, allCountries.length]);

  useEffect(() => {
    if (allLocations.length === 0) return;
    const init: { [k: string]: WeatherData } = {};
    allLocations.forEach(l => { init[l.id] = { temp: 0, condition: 'Loading', icon: Loader2, humidity: 0, feelsLike: 0, isLoading: true }; });
    setWeatherData(init);
    allLocations.forEach(async loc => {
      const w = await fetchWeather(loc);
      setWeatherData(prev => ({ ...prev, [loc.id]: w }));
    });
  }, [allLocations.length]);

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

  const weather = weatherData[currentWeatherLoc];
  const weatherLoc = allLocations.find(l => l.id === currentWeatherLoc);
  const emergencyCountry = allCountries.find(c => c.id === currentEmergencyCtry);
  const filteredContacts = emergencyContacts.filter(c => c.destinationId === currentEmergencyCtry && !c.cityId);
  const mainEmergency = filteredContacts.find(c => c.type === 'emergency') || filteredContacts[0];

  const speak = (text: string) => {
    if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.8; window.speechSynthesis.speak(u); }
  };

  if (allLocations.length === 0) {
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
        <p className="text-[13px] text-[var(--text-secondary)]">Essential travel utilities</p>
      </div>

      {/* Emergency - always visible at top */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Phone size={16} style={{ color: 'var(--error)' }} />
            <span className="text-[13px] font-bold" style={{ color: 'var(--error)' }}>Emergency</span>
          </div>
          {allCountries.length > 1 && (
            <div className="flex gap-1">
              {allCountries.map(c => (
                <button key={c.id} onClick={() => setSelectedEmergencyCountry(c.id)} className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: c.id === currentEmergencyCtry ? 'var(--error)' : 'transparent', color: c.id === currentEmergencyCtry ? 'white' : 'var(--error)' }}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {mainEmergency && (
          <a href={`tel:${mainEmergency.number}`} className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl text-[15px] font-bold no-underline transition-transform active:scale-[0.98]" style={{ background: 'var(--error)', color: 'white' }}>
            <Phone size={18} />
            Call {mainEmergency.number}
          </a>
        )}

        {filteredContacts.filter(c => c !== mainEmergency).slice(0, 3).map((contact, i) => (
          <a key={i} href={`tel:${contact.number}`} className="flex items-center justify-between px-3.5 py-3 rounded-xl no-underline" style={{ background: 'var(--surface-container)' }}>
            <div className="flex-1 min-w-0 mr-3">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{contact.name}</div>
              <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{contact.description}</div>
            </div>
            <span className="text-[14px] font-bold flex-shrink-0" style={{ color: 'var(--error)' }}>{contact.number}</span>
          </a>
        ))}
      </div>

      {/* Weather - compact card */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Weather</span>
          {allLocations.length > 1 && (
            <div className="flex gap-1">
              {allLocations.map(l => (
                <button key={l.id} onClick={() => setSelectedWeatherLocation(l.id)} className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: l.id === currentWeatherLoc ? 'var(--accent)' : 'transparent', color: l.id === currentWeatherLoc ? 'white' : 'var(--text-secondary)' }}>
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {weather?.isLoading ? (
          <div className="flex items-center gap-2 justify-center py-4">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-[13px] text-[var(--text-secondary)]">Loading weather...</span>
          </div>
        ) : weather ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {React.createElement(weather.icon, { size: 28, style: { color: 'var(--accent)' } })}
              <span className="text-[28px] font-extrabold">{weather.temp}°</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold capitalize">{weather.condition}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Feels {weather.feelsLike}° / Humidity {weather.humidity}%
                {weatherLoc && ` / ${weatherLoc.name}`}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Currency converter - always visible */}
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

      {/* Quick links */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em] px-1">Quick Links</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Google Maps', url: 'https://maps.google.com', icon: MapIcon },
            { label: 'Google Translate', url: 'https://translate.google.com', icon: Globe },
          ].map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-3.5 no-underline transition-transform active:scale-[0.98]">
              <link.icon size={18} style={{ color: 'var(--accent)' }} />
              <span className="text-[13px] font-semibold">{link.label}</span>
              <ExternalLink size={12} className="ml-auto" style={{ color: 'var(--text-tertiary)' }} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DynamicUtilitiesPage;
