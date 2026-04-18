import React, { useState, useMemo, useEffect } from 'react';
import { Phone, Shield, Building2, Globe, Loader2, LocateFixed } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { EmergencyContact } from '../types/TravelData';
import { getCachedLocation, getCurrentLocation, UserLocation } from '../utils/geolocation';
import { reverseGeocodeCountry } from '../utils/geocoding';
import { generateEmergencyContactsForDestination } from '../services/aiService';

interface CountryInfo { id: string; name: string; languages: string[]; }

const EmergencyPage: React.FC = () => {
  const { currentPlan, emergencyContacts, appMode } = useTravel();
  const isLocalMode = appMode === 'local' || !currentPlan;
  const [selectedCountry, setSelectedCountry] = useState('');

  // Local mode state: geolocation-derived country + fetched contacts
  const [localLocation, setLocalLocation] = useState<UserLocation | null>(getCachedLocation());
  const [localCountry, setLocalCountry] = useState<{ name: string; code: string } | null>(null);
  const [localContacts, setLocalContacts] = useState<EmergencyContact[] | null>(null);
  const [localStatus, setLocalStatus] = useState<'idle' | 'locating' | 'fetching' | 'ready' | 'denied' | 'error'>('idle');

  useEffect(() => {
    if (!isLocalMode) return;
    let cancelled = false;
    (async () => {
      let loc = localLocation;
      if (!loc) {
        setLocalStatus('locating');
        try {
          loc = await getCurrentLocation();
          if (cancelled) return;
          setLocalLocation(loc);
        } catch (err) {
          if (cancelled) return;
          const code = (err as GeolocationPositionError | undefined)?.code;
          setLocalStatus(code === 1 ? 'denied' : 'error');
          return;
        }
      }
      setLocalStatus('fetching');
      const country = await reverseGeocodeCountry(loc.lat, loc.lng);
      if (cancelled) return;
      if (!country) {
        setLocalStatus('error');
        return;
      }
      setLocalCountry(country);
      const mockDestination = {
        id: `local_${country.code}`,
        name: country.name,
        country: country.name,
        countryCode: country.code,
        currency: '',
        languages: [],
        emergencyNumber: '',
        timezone: '',
        coordinates: { lat: loc.lat, lng: loc.lng },
      };
      const contacts = await generateEmergencyContactsForDestination(mockDestination);
      if (cancelled) return;
      setLocalContacts(contacts);
      setLocalStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocalMode]);

  const allCountries = useMemo((): CountryInfo[] => {
    if (!currentPlan) return [];
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
  }, [currentPlan]);

  // Local-mode early returns for loading / error / denied states
  if (isLocalMode) {
    if (localStatus === 'locating' || localStatus === 'fetching' || (localStatus === 'ready' && !localContacts)) {
      return (
        <section className="page">
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {localStatus === 'locating' ? 'Getting your location...' : 'Loading emergency info...'}
            </p>
          </div>
        </section>
      );
    }
    if (localStatus === 'denied') {
      return (
        <section className="page">
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
            >
              <LocateFixed size={22} />
            </div>
            <h3 className="text-base font-bold">Location needed</h3>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              Emergency info is based on your current country. Enable location to see relevant numbers.
            </p>
          </div>
        </section>
      );
    }
    if (localStatus === 'error') {
      return (
        <section className="page">
          <div className="text-center py-16">
            <h3 className="text-base font-bold mb-1">Couldn't load emergency info</h3>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              Please try again in a moment.
            </p>
          </div>
        </section>
      );
    }
  } else if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center py-16">
          <h2 className="mb-3">No Travel Plan</h2>
          <p className="text-[var(--text-secondary)]">Complete onboarding first.</p>
        </div>
      </section>
    );
  }

  const currentCountryId = isLocalMode
    ? (localCountry ? `local_${localCountry.code}` : '')
    : selectedCountry || allCountries[0]?.id || '';
  const currentCountry = isLocalMode
    ? (localCountry ? { id: currentCountryId, name: localCountry.name, languages: [] } : null)
    : allCountries.find(c => c.id === currentCountryId) || null;
  const filteredContacts = isLocalMode
    ? (localContacts || [])
    : emergencyContacts.filter(c => c.destinationId === currentCountryId && !c.cityId);
  const mainEmergency = filteredContacts.find(c => c.type === 'emergency') || filteredContacts[0];
  const otherContacts = filteredContacts.filter(c => c !== mainEmergency);

  const policeContacts = otherContacts.filter(c => c.type === 'police' || c.name?.toLowerCase().includes('police'));
  const medicalContacts = otherContacts.filter(c => c.type === 'medical' || c.name?.toLowerCase().includes('ambulance') || c.name?.toLowerCase().includes('medical') || c.name?.toLowerCase().includes('hospital'));
  const embassyContacts = otherContacts.filter(c => c.type === 'embassy' || c.name?.toLowerCase().includes('embassy') || c.name?.toLowerCase().includes('consulate'));
  const categorized = new Set([...policeContacts, ...medicalContacts, ...embassyContacts]);
  const otherUncategorized = otherContacts.filter(c => !categorized.has(c));

  return (
    <section className="page space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Emergency</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {currentCountry ? `Emergency contacts for ${currentCountry.name}` : 'Emergency contacts and numbers'}
        </p>
      </div>

      {allCountries.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {allCountries.map(c => (
            <button key={c.id} onClick={() => setSelectedCountry(c.id)} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all" style={{ background: c.id === currentCountryId ? 'var(--error)' : 'var(--surface-container)', color: c.id === currentCountryId ? 'white' : 'var(--text-secondary)' }}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Main emergency call button */}
      {mainEmergency && (
        <a href={`tel:${mainEmergency.number}`} className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl text-[16px] font-bold no-underline transition-transform active:scale-[0.98]" style={{ background: 'var(--error)', color: 'white' }}>
          <Phone size={20} />
          Call {mainEmergency.number}
        </a>
      )}

      {/* Police */}
      {policeContacts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Shield size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Police</span>
          </div>
          <div className="card overflow-hidden">
            {policeContacts.map((contact, i) => (
              <a key={i} href={`tel:${contact.number}`} className="flex items-center justify-between px-4 py-3.5 no-underline" style={{ borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none' }}>
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{contact.name}</div>
                  {contact.description && <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>{contact.description}</div>}
                </div>
                <span className="text-[15px] font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>{contact.number}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Medical */}
      {medicalContacts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Phone size={14} style={{ color: 'var(--error)' }} />
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Medical</span>
          </div>
          <div className="card overflow-hidden">
            {medicalContacts.map((contact, i) => (
              <a key={i} href={`tel:${contact.number}`} className="flex items-center justify-between px-4 py-3.5 no-underline" style={{ borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none' }}>
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{contact.name}</div>
                  {contact.description && <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>{contact.description}</div>}
                </div>
                <span className="text-[15px] font-bold flex-shrink-0" style={{ color: 'var(--error)' }}>{contact.number}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Embassy */}
      {embassyContacts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Building2 size={14} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Embassy / Consulate</span>
          </div>
          <div className="card overflow-hidden">
            {embassyContacts.map((contact, i) => (
              <a key={i} href={`tel:${contact.number}`} className="flex items-center justify-between px-4 py-3.5 no-underline" style={{ borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none' }}>
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{contact.name}</div>
                  {contact.description && <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>{contact.description}</div>}
                </div>
                <span className="text-[15px] font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>{contact.number}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Other contacts */}
      {otherUncategorized.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Globe size={14} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Other</span>
          </div>
          <div className="card overflow-hidden">
            {otherUncategorized.map((contact, i) => (
              <a key={i} href={`tel:${contact.number}`} className="flex items-center justify-between px-4 py-3.5 no-underline" style={{ borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none' }}>
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{contact.name}</div>
                  {contact.description && <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>{contact.description}</div>}
                </div>
                <span className="text-[15px] font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{contact.number}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {filteredContacts.length === 0 && (
        <div className="card p-8 text-center">
          <Phone size={32} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
          <p className="text-[14px] font-semibold mb-1">No emergency contacts</p>
          <p className="text-[12px] text-[var(--text-secondary)]">Emergency contacts will appear here once your trip is set up.</p>
        </div>
      )}
    </section>
  );
};

export default EmergencyPage;
