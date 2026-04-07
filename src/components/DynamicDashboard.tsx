import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTravel } from '../contexts/TravelContext';
import { getSmartSuggestion } from '../services/aiService';
import { MapPin, Calendar, Plane, Train, Car, Ship, Bus, Map, Navigation as NavIcon, Globe, Coins, Phone, Hotel, Compass, Sparkles, Lightbulb, Heart, RefreshCw, Loader2, Pencil, X as XIcon } from 'lucide-react';
import DayDebrief from './trip/DayDebrief';

// Cache suggestion outside component so it persists across remounts
let cachedSuggestion: { title: string; description: string; activityName: string } | null = null;
let suggestionFetched = false;

const DynamicDashboard: React.FC = () => {
  const { currentPlan, activities, savedActivities, setCurrentPlan } = useTravel();
  const navigate = useNavigate();
  const [suggestion, setSuggestion] = useState(cachedSuggestion);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [editingAcc, setEditingAcc] = useState<{ segmentId: string; accId: string; name: string; address: string } | null>(null);

  const saveAccommodation = () => {
    if (!editingAcc || !currentPlan) return;
    const updated = {
      ...currentPlan,
      segments: currentPlan.segments?.map((seg: any) => {
        if (seg.id !== editingAcc.segmentId) return seg;
        return {
          ...seg,
          accommodations: seg.accommodations?.map((acc: any) =>
            acc.id === editingAcc.accId ? { ...acc, name: editingAcc.name, address: editingAcc.address } : acc
          ),
        };
      }),
    };
    setCurrentPlan(updated);
    setEditingAcc(null);
  };

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

  const fetchSuggestion = async (force = false) => {
    if ((!force && suggestionFetched) || !currentPlan || activities.length === 0) return;
    const d = currentPlan.destination || currentPlan.destinations?.[0];
    const seg = segments[0];
    const loc = seg?.city ? `${seg.city.name}, ${d?.country}` : d?.name || '';
    if (!loc) return;

    setSuggestionLoading(true);
    try {
      const s = await getSmartSuggestion(loc, currentPlan.interests || [], activities.map(a => a.name));
      if (s) { cachedSuggestion = s; setSuggestion(s); }
      suggestionFetched = true;
    } catch {} finally { setSuggestionLoading(false); }
  };

  useEffect(() => { fetchSuggestion(); }, [currentPlan?.id]);

  // Trip day calculation
  const getTripDayInfo = () => {
    if (!currentPlan.startDate) return null;
    const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const start = p(currentPlan.startDate);
    const end = currentPlan.endDate ? p(currentPlan.endDate) : start;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
    const total = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    if (diff < 0) return { label: `Starts in ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''}`, type: 'upcoming' as const };
    if (diff >= total) return { label: 'Trip complete', type: 'past' as const };
    return { label: `Day ${diff + 1} of ${total}`, type: 'active' as const };
  };

  const tripDay = getTripDayInfo();
  const savedActivityList = activities.filter(a => savedActivities.includes(a.name));

  return (
    <section className="page space-y-5">

      {/* ---- HEADER ---- */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {currentPlan.title || 'Your Trip'}
          </h1>
          {tripDay && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{
              background: tripDay.type === 'active' ? 'var(--accent)' : tripDay.type === 'upcoming' ? 'var(--accent-container)' : 'var(--surface-container-high)',
              color: tripDay.type === 'active' ? 'white' : tripDay.type === 'upcoming' ? 'var(--accent)' : 'var(--text-tertiary)',
            }}>
              {tripDay.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] mt-1">
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

      {/* Smart Suggestion */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/explore')}
          className="flex-1 flex items-center gap-3 p-3.5 rounded-2xl text-left transition-transform active:scale-[0.98]"
          style={{ background: 'var(--accent-container)' }}
        >
          <div className="flex items-center justify-center flex-shrink-0" style={{ height: '40px', aspectRatio: '1', borderRadius: '50%', background: 'var(--accent)', color: 'white' }}>
            <Lightbulb size={18} />
          </div>
          <div className="flex-1 min-w-0">
            {suggestionLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Getting suggestion...</span>
              </div>
            ) : suggestion ? (
              <>
                <div className="text-[13px] font-bold" style={{ color: 'var(--accent)' }}>{suggestion.title}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{suggestion.description}</div>
              </>
            ) : (
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Tap to explore activities</div>
            )}
          </div>
        </button>
        <button
          onClick={() => fetchSuggestion(true)}
          disabled={suggestionLoading}
          className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-40"
          style={{ height: '40px', aspectRatio: '1', borderRadius: '50%', background: 'var(--surface-container)', color: 'var(--text-tertiary)' }}
        >
          <RefreshCw size={16} className={suggestionLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Saved Activities */}
      {savedActivityList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Heart size={12} style={{ color: 'var(--accent)' }} fill="var(--accent)" />
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Saved ({savedActivityList.length})</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {savedActivityList.slice(0, 8).map((a, i) => (
              <button
                key={i}
                onClick={() => navigate('/explore')}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-[12px] font-medium text-left"
                style={{ background: 'var(--surface-container)', maxWidth: '180px' }}
              >
                <div className="truncate">{a.name}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{a.category} - {a.duration}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day Debrief + Journal Timeline */}
      <DayDebrief />

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

                  {/* Quick info pills */}
                  <div className="flex items-stretch gap-2 flex-wrap">
                    {lang && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', minHeight: '36px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: 'var(--surface-container-high)', color: 'var(--text-primary)', lineHeight: 1 }}>
                        <Globe size={13} /> {lang}
                      </span>
                    )}
                    {currency && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', minHeight: '36px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: 'var(--surface-container-high)', color: 'var(--text-primary)', lineHeight: 1 }}>
                        <Coins size={13} /> {currency}
                      </span>
                    )}
                    <a href={`tel:${emergency}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', minHeight: '36px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: 'var(--error-container)', color: 'var(--error)', textDecoration: 'none', lineHeight: 1 }}>
                      <Phone size={13} /> {emergency}
                    </a>
                  </div>
                </div>

                {/* Accommodations */}
                {segment.accommodations?.length > 0 && segment.accommodations.map((acc: any, i: number) => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:opacity-80"
                    style={{ borderTop: '0.33px solid var(--outline)' }}
                    onClick={() => setEditingAcc({ segmentId: segment.id, accId: acc.id, name: acc.name || '', address: acc.address || '' })}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-container-high)' }}>
                      <Hotel size={14} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold leading-tight truncate">{acc.name || `Tap to add accommodation`}</div>
                      {acc.address ? <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{acc.address}</div> : <div className="text-[11px] mt-0.5" style={{ color: 'var(--accent)' }}>Tap to edit</div>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <div className="flex items-center justify-center" style={{ height: '32px', aspectRatio: '1', borderRadius: '50%', background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}>
                        <Pencil size={14} />
                      </div>
                      {acc.address && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(acc.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center"
                          style={{ height: '32px', aspectRatio: '1', borderRadius: '50%', background: 'var(--accent-container)', color: 'var(--accent)' }}
                          title="Directions"
                          onClick={e => e.stopPropagation()}
                        >
                          <NavIcon size={14} />
                        </a>
                      )}
                    </div>
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

      {/* Edit Accommodation Modal */}
      {editingAcc && (
        <div className="flex items-end justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', margin: 0, padding: 0 }} onClick={() => setEditingAcc(null)}>
          <div className="w-full max-w-lg" style={{ background: 'var(--surface-container)', borderRadius: '24px 24px 0 0', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-3"><div className="w-8 h-1 rounded-full" style={{ background: 'var(--outline)' }} /></div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold">Edit Accommodation</h3>
              <button onClick={() => setEditingAcc(null)} className="flex items-center justify-center" style={{ height: '32px', aspectRatio: '1', borderRadius: '50%', background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}>
                <XIcon size={16} />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input type="text" value={editingAcc.name} onChange={e => setEditingAcc({ ...editingAcc, name: e.target.value })} placeholder="Hotel name, Airbnb, etc." className="w-full px-4 py-3 rounded-xl text-[14px] border-none outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Address</label>
                <input type="text" value={editingAcc.address} onChange={e => setEditingAcc({ ...editingAcc, address: e.target.value })} placeholder="Full address" className="w-full px-4 py-3 rounded-xl text-[14px] border-none outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <button onClick={saveAccommodation} className="w-full py-3.5 rounded-2xl text-[14px] font-bold transition-all active:scale-[0.98]" style={{ background: 'var(--accent)', color: 'white' }}>
              Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default DynamicDashboard;
