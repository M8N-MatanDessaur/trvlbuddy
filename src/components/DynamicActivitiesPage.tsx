import React, { useState, useMemo } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { GeneratedActivity } from '../types/TravelData';
import DynamicActivityModal from './DynamicActivityModal';
import PlannerModal from './PlannerModal';
import RightNowHero from './explore/RightNowHero';
import HorizontalActivityScroll from './explore/HorizontalActivityScroll';
import LiveEventsSection from './explore/LiveEventsSection';
import { getCategoryIcon } from '../utils/categoryIcons';
import { groupActivities, groupActivitiesByContext } from '../utils/groupActivities';
import { useContextualContent } from '../hooks/useContextualContent';
import { generateCustomItinerary, discoverMoreActivities } from '../services/aiService';
import { Globe, Sparkles, Search, Loader2, Plus, Wand2, MapPin } from 'lucide-react';
import { useActivityPhotos } from '../hooks/useActivityPhotos';

const DynamicActivitiesPage: React.FC = () => {
  const { currentPlan, activities, setActivities } = useTravel();
  useActivityPhotos();
  const { moment } = useContextualContent();
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeLocation, setActiveLocation] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState<GeneratedActivity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  // AI Day Planner
  const [showPlanInput, setShowPlanInput] = useState(false);
  const [planLocation, setPlanLocation] = useState('');
  const [isPlannerModalOpen, setIsPlannerModalOpen] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [itineraryResult, setItineraryResult] = useState('');

  const openActivityModal = (activity: GeneratedActivity) => {
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center py-16">
          <h2 className="mb-3">No Travel Plan</h2>
          <p className="text-[var(--text-secondary)]">Complete onboarding to see activities.</p>
        </div>
      </section>
    );
  }

  // Context-aware section ordering when trip is active
  const sections = useMemo(() => {
    if (moment.tripPhase === 'active') {
      return groupActivitiesByContext(activities, moment.timeOfDay);
    }
    return groupActivities(activities);
  }, [activities, moment.tripPhase, moment.timeOfDay]);

  // Build location options from segments (city, country pairs)
  const locations = useMemo(() => {
    if (!currentPlan?.segments || currentPlan.segments.length <= 1) return [];
    const seen = new Set<string>();
    const locs: { id: string; label: string; cityId?: string; destId?: string }[] = [];
    for (const seg of currentPlan.segments) {
      const key = seg.city?.id || seg.destination.id;
      if (seen.has(key)) continue;
      seen.add(key);
      locs.push({
        id: key,
        label: seg.city ? `${seg.city.name}` : seg.destination.name,
        cityId: seg.city?.id,
        destId: seg.destination.id,
      });
    }
    return locs;
  }, [currentPlan]);

  // Activities filtered by location
  const locationFilteredActivities = useMemo(() => {
    if (activeLocation === 'all') return activities;
    const loc = locations.find(l => l.id === activeLocation);
    if (!loc) return activities;
    return activities.filter(a => {
      if (loc.cityId && a.cityId) return a.cityId === loc.cityId;
      if (loc.destId && a.destinationId) return a.destinationId === loc.destId;
      return true;
    });
  }, [activities, activeLocation, locations]);

  const categories = useMemo(() => ['all', ...new Set(locationFilteredActivities.map(a => a.category))], [locationFilteredActivities]);

  // Rebuild sections from location-filtered activities
  const locationSections = useMemo(() => {
    if (activeLocation === 'all') return sections;
    if (moment.tripPhase === 'active') {
      return groupActivitiesByContext(locationFilteredActivities, moment.timeOfDay);
    }
    return groupActivities(locationFilteredActivities);
  }, [locationFilteredActivities, sections, activeLocation, moment.tripPhase, moment.timeOfDay]);

  const filteredSections = useMemo(() => {
    const base = activeLocation === 'all' ? sections : locationSections;
    if (activeFilter === 'all') return base;
    return base.map(s => ({
      ...s,
      activities: s.activities.filter(a => a.category === activeFilter),
    })).filter(s => s.activities.length > 0);
  }, [sections, locationSections, activeFilter, activeLocation]);

  const handleDiscoverMore = async (dataCategory: string, sectionId: string) => {
    // Use the active location filter to determine which segment to discover more for
    const activeSeg = activeLocation !== 'all'
      ? currentPlan.segments?.find(s => s.city?.id === activeLocation || s.destination.id === activeLocation)
      : currentPlan.segments?.[0];
    const dest = activeSeg?.destination || currentPlan.destination || currentPlan.destinations?.[0];
    if (!dest || !activeSeg || !dataCategory) return;

    setLoadingSection(sectionId);
    try {
      const locationName = activeSeg.city ? `${activeSeg.city.name}, ${dest.country}` : `${dest.name}, ${dest.country}`;
      const existingNames = activities.filter(a => a.category === dataCategory).map(a => a.name);
      const newActivities = await discoverMoreActivities(locationName, dataCategory, existingNames, dest.id, activeSeg.city?.id || dest.id);

      if (newActivities.length > 0) {
        setActivities([...activities, ...newActivities]);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingSection(null);
    }
  };

  const handlePlanMyDay = async () => {
    const dest = currentPlan.destination || currentPlan.destinations?.[0];
    const seg = currentPlan.segments?.[0];
    const locationName = planLocation.trim() || (seg?.city ? `${seg.city.name}, ${dest?.country}` : dest?.name || 'your destination');

    setPlannerLoading(true);
    setItineraryResult('');
    setIsPlannerModalOpen(true);
    setShowPlanInput(false);

    try {
      const activityNames = activities.slice(0, 15).map(a => a.name);
      const result = await generateCustomItinerary(activityNames, locationName);
      setItineraryResult(result);
    } catch {
      setItineraryResult('<p style="color:var(--error)">Failed to generate itinerary. Please try again.</p>');
    } finally {
      setPlannerLoading(false);
    }
  };

  return (
    <section className="page space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Explore</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {activities.length} activities to discover
        </p>
      </div>

      {/* Location filter chips (only for multi-destination trips) */}
      {locations.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => { setActiveLocation('all'); setActiveFilter('all'); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              background: activeLocation === 'all' ? 'var(--accent)' : 'var(--surface-container)',
              color: activeLocation === 'all' ? 'white' : 'var(--text-secondary)',
            }}
          >
            <Globe size={14} />
            All Locations
          </button>
          {locations.map(loc => {
            const isActive = activeLocation === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => { setActiveLocation(loc.id); setActiveFilter('all'); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--surface-container)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                }}
              >
                <MapPin size={14} />
                {loc.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const isActive = activeFilter === cat;
          const CatIcon = cat === 'all' ? Globe : getCategoryIcon(cat);
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: isActive ? 'var(--accent)' : 'var(--surface-container)',
                color: isActive ? 'white' : 'var(--text-secondary)',
              }}
            >
              <CatIcon size={14} />
              {cat === 'all' ? 'All' : cat}
            </button>
          );
        })}
      </div>

      {/* Right Now hero (only during active trip, no filter) */}
      {activeFilter === 'all' && (
        <RightNowHero onActivityClick={openActivityModal} />
      )}

      {/* Live Events (only during active trip, no filter) */}
      {activeFilter === 'all' && <LiveEventsSection />}

      {/* AI Plan My Day */}
      {!showPlanInput ? (
        <button
          onClick={() => setShowPlanInput(true)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl transition-transform active:scale-[0.98]"
          style={{ background: 'var(--accent-container)' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', color: 'white' }}>
            <Wand2 size={18} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[14px] font-bold" style={{ color: 'var(--accent)' }}>AI Plan My Day</div>
            <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Tell me where you will be and I will plan your day</div>
          </div>
        </button>
      ) : (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-[13px] font-bold">Where are you exploring today?</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={planLocation}
                onChange={e => setPlanLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePlanMyDay()}
                placeholder="e.g. Myeongdong area, near Gangnam..."
                className="w-full pl-9 pr-4 py-3 rounded-xl text-[13px] border-none outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>
            <button
              onClick={handlePlanMyDay}
              className="px-4 py-3 rounded-xl text-[13px] font-bold transition-all active:scale-95"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <Sparkles size={16} />
            </button>
          </div>
          <button onClick={() => setShowPlanInput(false)} className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Activity sections with horizontal scroll */}
      {filteredSections.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--surface-container-high)' }}>
            <Search size={22} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <h3 className="text-base font-bold mb-1">No activities found</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Try a different filter</p>
          <button onClick={() => setActiveFilter('all')} className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Clear filters</button>
        </div>
      ) : (
        filteredSections.map(section => {
          const isLoadingThis = loadingSection === section.id;

          return (
            <div key={section.id} className="space-y-3">
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold">{section.title}</h2>
                  <p className="text-[11px] text-[var(--text-tertiary)]">{section.subtitle}</p>
                </div>
                {section.dataCategory && (
                  <button
                    onClick={() => handleDiscoverMore(section.dataCategory, section.id)}
                    disabled={isLoadingThis}
                    className="flex items-center gap-1 text-[12px] font-semibold disabled:opacity-50"
                    style={{ color: 'var(--accent)' }}
                  >
                    {isLoadingThis ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Plus size={12} />
                    )}
                    {isLoadingThis ? 'Finding...' : 'More'}
                  </button>
                )}
              </div>

              {/* Horizontal scroll cards */}
              <HorizontalActivityScroll
                activities={section.activities}
                onActivityClick={openActivityModal}
              />
            </div>
          );
        })
      )}

      <DynamicActivityModal activity={selectedActivity} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedActivity(null); }} />
      <PlannerModal isOpen={isPlannerModalOpen} onClose={() => { setIsPlannerModalOpen(false); setItineraryResult(''); }} isLoading={plannerLoading} result={itineraryResult} />
    </section>
  );
};

export default DynamicActivitiesPage;
