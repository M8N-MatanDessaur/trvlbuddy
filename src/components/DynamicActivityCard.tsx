import React from 'react';
import { GeneratedActivity } from '../types/TravelData';
import { Clock } from 'lucide-react';
import { getCategoryIcon } from '../utils/categoryIcons';

interface DynamicActivityCardProps {
  activity: GeneratedActivity;
  onClick: (activity: GeneratedActivity) => void;
}

const DynamicActivityCard: React.FC<DynamicActivityCardProps> = ({ activity, onClick }) => {
  const getPriceLabel = (cost: string) => {
    const c = cost.toLowerCase();
    if (c.includes('free') || c === '0' || c.includes('$0')) return 'Free';
    const nums = cost.match(/\d+/g);
    if (!nums) return '$';
    const max = Math.max(...nums.map(n => parseInt(n)));
    if (max <= 15) return '$';
    if (max <= 35) return '$$';
    if (max <= 60) return '$$$';
    return '$$$$';
  };

  const CategoryIcon = getCategoryIcon(activity.category);

  return (
    <div
      className="activity-card cursor-pointer flex flex-col"
      onClick={() => onClick(activity)}
    >
      <div className="p-3.5 flex flex-col h-full">
        {/* Category + price */}
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
            <CategoryIcon size={11} />
            {activity.category}
          </span>
          <span className="text-[10px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
            {getPriceLabel(activity.estimatedCost)}
          </span>
        </div>

        {/* Title - 2 lines max */}
        <h4
          className="font-bold text-[13px] leading-tight mb-1.5"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {activity.name}
        </h4>

        {/* Description - 3 lines max, fills space */}
        <p
          className="text-[11px] leading-relaxed flex-1"
          style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {activity.description}
        </p>

        {/* Bottom row */}
        <div className="flex items-center gap-2 mt-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {activity.duration}
          </span>
          {activity.difficulty && (
            <span className="font-semibold capitalize">{activity.difficulty}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DynamicActivityCard;
