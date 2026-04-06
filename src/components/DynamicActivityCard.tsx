import React from 'react';
import { GeneratedActivity } from '../types/TravelData';
import { Clock, MapPin } from 'lucide-react';
import { getCategoryIcon, getCategoryColor } from '../utils/categoryIcons';

interface DynamicActivityCardProps {
  activity: GeneratedActivity;
  onClick: (activity: GeneratedActivity) => void;
}

const DynamicActivityCard: React.FC<DynamicActivityCardProps> = ({ activity, onClick }) => {
  const getDifficultyStyle = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return { bg: 'var(--success-container)', color: 'var(--success)' };
      case 'moderate': return { bg: 'var(--warning-container)', color: 'var(--warning)' };
      case 'challenging': return { bg: 'var(--error-container)', color: 'var(--error)' };
      default: return { bg: 'var(--surface-container-high)', color: 'var(--text-secondary)' };
    }
  };

  const getPriceSymbols = (estimatedCost: string) => {
    const cost = estimatedCost.toLowerCase();
    if (cost.includes('free') || cost === '0' || cost.includes('$0')) return 'Free';
    const numbers = estimatedCost.match(/\d+/g);
    if (!numbers || numbers.length === 0) return '$';
    const maxPrice = Math.max(...numbers.map(n => parseInt(n)));
    if (maxPrice <= 15) return '$';
    if (maxPrice <= 35) return '$$';
    if (maxPrice <= 60) return '$$$';
    return '$$$$';
  };

  const CategoryIcon = getCategoryIcon(activity.category);
  const categoryColor = getCategoryColor(activity.category);
  const isDayTrip = activity.category === 'Daytrips';
  const diffStyle = getDifficultyStyle(activity.difficulty);

  return (
    <div
      className="activity-card cursor-pointer flex flex-col overflow-hidden group"
      onClick={() => onClick(activity)}
    >
      {/* Category accent stripe */}
      <div className="h-1 w-full" style={{ backgroundColor: categoryColor }} />

      <div className="p-5 flex flex-col flex-1">
        {/* Top row: category chip + price */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="chip"
            style={{ backgroundColor: categoryColor + '18', color: categoryColor }}
          >
            <CategoryIcon size={12} />
            {activity.category}
          </span>
          <span className="text-sm font-semibold" style={{ color: categoryColor }}>
            {getPriceSymbols(activity.estimatedCost)}
          </span>
        </div>

        {/* Title */}
        <h4 className="font-bold text-base leading-snug mb-2 group-hover:text-[var(--accent)] transition-colors">
          {activity.name}
        </h4>

        {/* Description */}
        <p className="text-xs text-text-secondary leading-relaxed mb-4 flex-1">
          {activity.description.substring(0, 100)}...
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-4 text-xs text-text-tertiary mb-3">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {activity.duration}
          </span>
          <span className="flex items-center gap-1 truncate">
            <MapPin size={12} />
            {activity.location}
          </span>
        </div>

        {/* Bottom: difficulty badge */}
        <div className="flex items-center gap-2">
          {activity.difficulty && (
            <span
              className="chip text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: diffStyle.bg, color: diffStyle.color }}
            >
              {activity.difficulty}
            </span>
          )}
          {isDayTrip && (
            <span className="chip chip-accent text-[10px] font-semibold uppercase tracking-wider">
              Day Trip
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DynamicActivityCard;
