import React, { useEffect, useState } from 'react';
import { Cloud, CloudFog, CloudRain, CloudSnow, Coins, Globe, Loader2, Plug, Sun, Thermometer } from 'lucide-react';
import { describeWeatherCode, fetchWeather, type WeatherSnapshot } from '../services/weatherService';
import { convert, fetchRates, guessHomeCurrency, type ExchangeRates } from '../services/currencyService';
import { factsFor, type QuickFact } from '../data/countryFacts';

interface Props {
  city: string | null | undefined;
  country: string | null | undefined;
  currency: string | null | undefined;
  coordinates: { lat: number; lng: number } | null | undefined;
}

// Three-column widget row under the existing segment pills. Weather pulls
// from open-meteo (cached 6h), currency from exchangerate.host (cached
// 24h), quick-facts from a static JSON table. Everything fails open — if
// one service is down the others still render.

const weatherIcon = (name: string) => {
  switch (name) {
    case 'sun': return Sun;
    case 'cloud-rain': return CloudRain;
    case 'cloud-snow': return CloudSnow;
    case 'cloud-fog': return CloudFog;
    default: return Cloud;
  }
};

const SegmentBrief: React.FC<Props> = ({ city, country, currency, coordinates }) => {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [facts] = useState<QuickFact>(() => factsFor(country));
  const homeCurrency = guessHomeCurrency();

  useEffect(() => {
    if (!coordinates) return;
    let alive = true;
    setWeatherLoading(true);
    fetchWeather(coordinates.lat, coordinates.lng).then((snapshot) => {
      if (!alive) return;
      setWeather(snapshot);
      setWeatherLoading(false);
    });
    return () => { alive = false; };
  }, [coordinates?.lat, coordinates?.lng]);

  useEffect(() => {
    if (!currency) return;
    let alive = true;
    fetchRates(homeCurrency).then((snapshot) => {
      if (alive) setRates(snapshot);
    });
    return () => { alive = false; };
  }, [currency, homeCurrency]);

  const weatherTile = (() => {
    if (!coordinates) return null;
    if (weatherLoading && !weather) {
      return <Loader2 size={14} className="animate-spin" />;
    }
    if (!weather?.current) return null;
    const desc = describeWeatherCode(weather.current.weatherCode);
    const Icon = weatherIcon(desc.icon);
    return (
      <div className="flex items-center gap-1.5">
        <Icon size={14} />
        <span className="font-bold">{weather.current.tempC}°</span>
        <span style={{ color: 'var(--text-tertiary)' }}>{desc.label}</span>
      </div>
    );
  })();

  const currencyTile = (() => {
    if (!currency) return null;
    if (currency.toUpperCase() === homeCurrency) return null;
    if (!rates) return <Loader2 size={14} className="animate-spin" />;
    const value = convert(1, rates, currency);
    if (value === null) return null;
    const fmt = value < 1 ? value.toFixed(3) : value.toFixed(2);
    return (
      <div className="flex items-center gap-1.5">
        <Coins size={14} />
        <span>
          1 {homeCurrency} = <span className="font-bold">{fmt} {currency.toUpperCase()}</span>
        </span>
      </div>
    );
  })();

  const factsTile = (
    <div className="flex items-center gap-1.5">
      <Globe size={14} />
      <span>
        <span className="font-bold">{facts.hello}</span>
        <span style={{ color: 'var(--text-tertiary)' }}> · {facts.thanks}</span>
      </span>
    </div>
  );

  const plugTile = (
    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
      <Plug size={13} />
      <span>{facts.plug} · {facts.voltage}</span>
    </div>
  );

  const tempRangeTile = weather && weather.daily.length > 0 ? (
    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
      <Thermometer size={13} />
      <span>
        {Math.min(...weather.daily.slice(0, 5).map((d) => d.tempMinC))}°–
        {Math.max(...weather.daily.slice(0, 5).map((d) => d.tempMaxC))}° this week
      </span>
    </div>
  ) : null;

  const cells: React.ReactNode[] = [weatherTile, currencyTile, factsTile, tempRangeTile, plugTile].filter(Boolean);
  if (cells.length === 0) return null;

  return (
    <div
      className="mt-3 grid grid-cols-1 gap-2 rounded-xl p-3"
      style={{
        background: 'var(--surface-container-high)',
        color: 'var(--text-primary)',
        fontSize: '11.5px',
      }}
      aria-label={`Quick brief for ${city || country || 'destination'}`}
    >
      {cells.map((cell, i) => (
        <div key={i}>{cell}</div>
      ))}
      <div className="text-[10.5px] leading-snug mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
        {facts.tipping}
      </div>
    </div>
  );
};

export default SegmentBrief;
