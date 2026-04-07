import React from 'react';
import { Sparkles, Clock, ArrowRight } from 'lucide-react';
import { useContextualContent } from '../../hooks/useContextualContent';
import { useTravel } from '../../contexts/TravelContext';
import { getCategoryIcon } from '../../utils/categoryIcons';
import type { GeneratedActivity } from '../../types/TravelData';

interface Props {
  onActivityClick: (activity: GeneratedActivity) => void;
}

const RightNowHero: React.FC<Props> = ({ onActivityClick }) => {
  const { moment, momentLabel, priorityCategories } = useContextualContent();
  const { activities } = useTravel();

  if (moment.tripPhase !== 'active' || activities.length === 0) return null;

  // Pick up to 3 activities matching priority categories for this time of day
  const suggestions: GeneratedActivity[] = [];
  const used = new Set<string>();
  for (const cat of priorityCategories) {
    const match = activities.find(
      (a) => a.category === cat && !used.has(a.name),
    );
    if (match) {
      suggestions.push(match);
      used.add(match.name);
    }
    if (suggestions.length >= 3) break;
  }
  // Fill remaining slots if needed
  if (suggestions.length < 3) {
    for (const a of activities) {
      if (used.has(a.name)) continue;
      suggestions.push(a);
      used.add(a.name);
      if (suggestions.length >= 3) break;
    }
  }

  if (suggestions.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--accent-container)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Sparkles size={14} />
        </div>
        <div>
          <div className="text-[13px] font-bold" style={{ color: 'var(--accent)' }}>
            Right Now
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {momentLabel}
          </div>
        </div>
      </div>

      {/* Suggestion cards */}
      <div className="space-y-2">
        {suggestions.map((activity) => {
          const CatIcon = getCategoryIcon(activity.category);
          return (
            <button
              key={activity.name}
              onClick={() => onActivityClick(activity)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
              style={{ background: 'var(--surface-container)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
              >
                <CatIcon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {activity.name}
                </div>
                <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} />
                    {activity.duration}
                  </span>
                  <span>{activity.category}</span>
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} className="flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RightNowHero;
