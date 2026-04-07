import React, { useState, useMemo } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { GeneratedActivity } from '../types/TravelData';
import DynamicActivityCard from './DynamicActivityCard';
import DynamicActivityModal from './DynamicActivityModal';
import PlannerModal from './PlannerModal';
import { getCategoryIcon } from '../utils/categoryIcons';
import { groupActivities } from '../utils/groupActivities';
import { generateCustomItinerary, discoverMoreActivities } from '../services/aiService';
import { Globe, Sparkles, Search, Loader2, Plus, Wand2, MapPin } from 'lucide-react';

const DynamicActivitiesPage: React.FC = () => {
  const { currentPlan, activities, setActivities } = useTravel();
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState<GeneratedActivity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  // AI Day Planner
  const [showPlanInput, setShowPlanInput] = useState(false);
  const [planLocation, setPlanLocation] = useState('');
  const [isPlannerModalOpen, setIsPlannerModalOpen] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [itineraryResult, setItineraryResult] = useState('');

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

  const sections = useMemo(() => groupActivities(activities), [activities]);
  const categories = useMemo(() => ['all', ...new Set(activities.map(a => a.category))], [activities]);

  const filteredSections = useMemo(() => {
    if (activeFilter === 'all') return sections;
    return sections.map(s => ({
      ...s,
      activities: s.activities.filter(a => a.category === activeFilter),
    })).filter(s => s.activities.length > 0);
  }, [sections, activeFilter]);

  const handleDiscoverMore = async (category: string) => {
    const dest = currentPlan.destination || currentPlan.destinations?.[0];
    const seg = currentPlan.segments?.[0];
    if (!dest || !seg) return;

    setLoadingSection(category);
    try {
      const locationName = seg.city ? `${seg.city.name}, ${dest.country}` : `${dest.name}, ${dest.country}`;
      const existingNames = activities.filter(a => a.category === category).map(a => a.name);
      const newActivities = await discoverMoreActivities(locationName, category, existingNames, dest.id, seg.city?.id || dest.id);

      if (newActivities.length > 0) {
        setActivities([...activities, ...newActivities]);
        // Auto-expand section to show new results
        const sectionId = category.toLowerCase().replace(/\s+/g, '-');
        setExpandedSection(sectionId);
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
      // Pick a diverse set of activities for the AI to work with
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

      {/* Filter chips */}
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
            <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Tell me where you'll be and I'll plan your day</div>
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

      {/* Activity sections */}
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
          const isExpanded = expandedSection === section.id;
          const displayActivities = isExpanded ? section.activities : section.activities.slice(0, 4);
          const isLoadingThis = loadingSection === section.title;

          return (
            <div key={section.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold">{section.title}</h2>
                  <p className="text-[11px] text-[var(--text-tertiary)]">{section.subtitle}</p>
                </div>
                {section.activities.length > 4 && (
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    {isExpanded ? 'Less' : `All ${section.activities.length}`}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {displayActivities.map((activity, i) => (
                  <DynamicActivityCard key={`${activity.name}-${i}`} activity={activity} onClick={a => { setSelectedActivity(a); setIsModalOpen(true); }} />
                ))}

                {/* Find More card - sits in the grid like an activity card */}
                {section.title !== 'Recommended for You' && section.title !== 'Free Things to Do' && (
                  <button
                    onClick={() => handleDiscoverMore(section.title)}
                    disabled={isLoadingThis}
                    className="activity-card flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ border: '2px dashed var(--outline)' }}
                  >
                    {isLoadingThis ? (
                      <>
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Finding more...</span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-center" style={{ height: '48px', aspectRatio: '1', borderRadius: '50%', background: 'var(--accent-container)', color: 'var(--accent)' }}>
                          <Plus size={24} />
                        </div>
                        <div className="text-center">
                          <div className="text-[13px] font-bold" style={{ color: 'var(--accent)' }}>Find More</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{section.title}</div>
                        </div>
                      </>
                    )}
                  </button>
                )}
              </div>
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
