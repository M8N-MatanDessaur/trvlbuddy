import React, { useState, useMemo } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { GeneratedActivity } from '../types/TravelData';
import DynamicActivityCard from './DynamicActivityCard';
import DynamicActivityModal from './DynamicActivityModal';
import PlannerModal from './PlannerModal';
import { getCategoryIcon } from '../utils/categoryIcons';
import { groupActivities } from '../utils/groupActivities';
import { generateCustomItinerary } from '../services/aiService';
import { Globe, Sparkles, Search, Check, Wand2 } from 'lucide-react';

const DynamicActivitiesPage: React.FC = () => {
  const { currentPlan, activities } = useTravel();
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState<GeneratedActivity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Day planner state
  const [plannerMode, setPlannerMode] = useState(false);
  const [selectedForPlan, setSelectedForPlan] = useState<string[]>([]);
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

  const handleActivityClick = (activity: GeneratedActivity) => {
    if (plannerMode) {
      setSelectedForPlan(prev =>
        prev.includes(activity.name) ? prev.filter(n => n !== activity.name) : [...prev, activity.name]
      );
    } else {
      setSelectedActivity(activity);
      setIsModalOpen(true);
    }
  };

  const generatePlan = async () => {
    if (selectedForPlan.length === 0) return;
    setPlannerLoading(true);
    setItineraryResult('');
    setIsPlannerModalOpen(true);
    try {
      const dest = currentPlan.destination || currentPlan.destinations?.[0];
      const locationName = dest ? `${dest.name}, ${dest.country}` : 'your destination';
      const result = await generateCustomItinerary(selectedForPlan, locationName);
      setItineraryResult(result);
    } catch {
      setItineraryResult('<p style="color:var(--error)">Failed to generate itinerary. Please try again.</p>');
    } finally {
      setPlannerLoading(false);
    }
  };

  return (
    <section className="page space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Explore</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {activities.length} activities based on your interests
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
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

      {/* Plan My Day toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setPlannerMode(!plannerMode); if (plannerMode) setSelectedForPlan([]); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
          style={{
            background: plannerMode ? 'var(--accent)' : 'var(--accent-container)',
            color: plannerMode ? 'white' : 'var(--accent)',
          }}
        >
          <Wand2 size={15} />
          {plannerMode ? `${selectedForPlan.length} selected` : 'Plan My Day'}
        </button>

        {plannerMode && selectedForPlan.length > 0 && (
          <button
            onClick={generatePlan}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Sparkles size={15} />
            Generate
          </button>
        )}
      </div>

      {/* Activity sections - ALL GRID, no horizontal scroll */}
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
                  <div key={`${activity.name}-${i}`} className="relative">
                    {plannerMode && selectedForPlan.includes(activity.name) && (
                      <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', color: 'white' }}>
                        <Check size={14} />
                      </div>
                    )}
                    <DynamicActivityCard activity={activity} onClick={handleActivityClick} />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <DynamicActivityModal
        activity={selectedActivity}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedActivity(null); }}
      />

      <PlannerModal
        isOpen={isPlannerModalOpen}
        onClose={() => { setIsPlannerModalOpen(false); setItineraryResult(''); }}
        isLoading={plannerLoading}
        result={itineraryResult}
      />
    </section>
  );
};

export default DynamicActivitiesPage;
