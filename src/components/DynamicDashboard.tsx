import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTravel } from '../contexts/TravelContext';
import { MapPin, Calendar, Plane, Train, Car, Ship, Bus, Map, Navigation as NavIcon, Globe, Coins, Phone, Hotel, Compass, Sparkles } from 'lucide-react';

const DynamicDashboard: React.FC = () => {
  const { currentPlan } = useTravel();
  const navigate = useNavigate();

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center py-16">
          <h2 className="mb-3">Welcome!</h2>
          <p className="text-[var(--text-secondary)]">Complete onboarding to get started.</p>
        </div>
      </section>
    );
  }

  const fmtDate = (d: string) => {
    if (!d) return '';
    try { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  const getDuration = () => {
    if (currentPlan.tripType === 'day-trip') return 1;
    const segs = (currentPlan.segments || []).filter((s: any) => s.city && s.startDate && s.endDate);
    if (!segs.length) return 0;
    const sorted = [...segs].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    try {
      const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
      return Math.max(Math.ceil((p(sorted.at(-1)!.endDate).getTime() - p(sorted[0].startDate).getTime()) / 86400000) + 1, 1);
    } catch { return 0; }
  };

  const transportIcon = (m?: string) => ({ flight: Plane, train: Train, car: Car, ferry: Ship, bus: Bus }[m || ''] || Plane);

  const segments = (() => {
    if (!currentPlan.segments) return [];
    const s = currentPlan.tripType === 'full-trip'
      ? currentPlan.segments.filter((s: any) => s.city && s.startDate)
      : currentPlan.segments;
    return [...s].sort((a: any, b: any) => {
      const p = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
      return (a.startDate ? p(a.startDate).getTime() : 0) - (b.startDate ? p(b.startDate).getTime() : 0);
    });
  })();

  const duration = getDuration();
  const dest = currentPlan.destination || currentPlan.destinations?.[0];
  const isDayTrip = currentPlan.tripType === 'day-trip';

  return (
    <section className="page space-y-5">

      {/* ---- HEADER ---- */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight mb-1">
          {currentPlan.title || 'Your Trip'}
        </h1>
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <span>{duration} {duration === 1 ? 'day' : 'days'}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
          <span>{currentPlan.travelers} traveler{currentPlan.travelers !== 1 ? 's' : ''}</span>
          {!isDayTrip && segments.length > 1 && (
            <>
              <span style={{ color: 'var(--text-tertiary)' }}>-</span>
              <span>{segments.length} cities</span>
            </>
          )}
        </div>
      </div>

      {/* ---- ACTIONS ---- */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/explore')}
          className="card p-4 flex items-center gap-3 text-left transition-transform active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)', color: 'white' }}>
            <Compass size={20} />
          </div>
          <div>
            <div className="font-bold text-[14px] leading-tight">Explore</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Activities & places</div>
          </div>
        </button>
        <button
          onClick={() => navigate('/language')}
          className="card p-4 flex items-center gap-3 text-left transition-transform active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-container)' }}>
            <Globe size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="font-bold text-[14px] leading-tight">Translate</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Key phrases</div>
          </div>
        </button>
      </div>

      {/* ---- DESTINATIONS ---- */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
          {isDayTrip ? 'Destination' : 'Itinerary'}
        </h3>

        {(isDayTrip && dest ? [{ id: 'day', city: { name: dest.name }, destination: dest, startDate: '', endDate: '', accommodations: [], transportationToNext: null }] : segments).map((segment: any, index: number) => {
          const cityName = segment.city?.name || segment.destination?.name || '';
          const country = segment.destination?.country || '';
          const lang = segment.destination?.languages?.[0];
          const currency = segment.destination?.currency;
          const emergency = segment.destination?.emergencyNumber || '112';

          return (
            <React.Fragment key={segment.id}>
              <div className="card overflow-hidden">
                {/* City */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {!isDayTrip && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: 'var(--accent)', color: 'white' }}>
                        {index + 1}
                      </div>
                    )}
                    {isDayTrip && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-container)' }}>
                        <MapPin size={15} style={{ color: 'var(--accent)' }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[15px] leading-tight">{cityName}{country ? `, ${country}` : ''}</div>
                      {segment.startDate && (
                        <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{fmtDate(segment.startDate)} - {fmtDate(segment.endDate)}</div>
                      )}
                    </div>
                  </div>

                  {/* Quick info + actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {lang && (
                      <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium" style={{ background: 'var(--surface-container-high)' }}>
                        <Globe size={11} style={{ color: 'var(--text-tertiary)' }} /> {lang}
                      </span>
                    )}
                    {currency && (
                      <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium" style={{ background: 'var(--surface-container-high)' }}>
                        <Coins size={11} style={{ color: 'var(--text-tertiary)' }} /> {currency}
                      </span>
                    )}
                    <a
                      href={`tel:${emergency}`}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold no-underline transition-colors"
                      style={{ background: 'var(--error-container)', color: 'var(--error)' }}
                    >
                      <Phone size={11} /> {emergency}
                    </a>
                  </div>
                </div>

                {/* Accommodations */}
                {segment.accommodations?.length > 0 && segment.accommodations.map((acc: any, i: number) => (
                  <div key={acc.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '0.33px solid var(--outline)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-container-high)' }}>
                      <Hotel size={14} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold leading-tight truncate">{acc.name || `Stay ${i + 1}`}</div>
                      {acc.address && <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{acc.address}</div>}
                    </div>
                    {acc.address && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(acc.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                        title="Directions"
                      >
                        <NavIcon size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Transport connector */}
              {!isDayTrip && index < segments.length - 1 && segment.transportationToNext && (
                <div className="flex items-center justify-center py-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                    {React.createElement(transportIcon(segment.transportationToNext.method), { size: 12 })}
                    <span className="capitalize">{segment.transportationToNext.method}</span>
                    {segment.transportationToNext.duration && <span>({segment.transportationToNext.duration})</span>}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};

export default DynamicDashboard;
