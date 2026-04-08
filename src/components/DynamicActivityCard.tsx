import React, { useState } from 'react';
import { GeneratedActivity } from '../types/TravelData';
import { Clock, Heart } from 'lucide-react';
import { getCategoryIcon } from '../utils/categoryIcons';
import { useTravel } from '../contexts/TravelContext';
import CachedImage from './CachedImage';

interface DynamicActivityCardProps {
  activity: GeneratedActivity;
  onClick: (activity: GeneratedActivity) => void;
}

const DynamicActivityCard: React.FC<DynamicActivityCardProps> = ({ activity, onClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

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
  const { savedActivities, toggleSavedActivity } = useTravel();
  const isSaved = savedActivities.includes(activity.name);
  const hasImage = activity.imageUrl && !imageError;
  const showImage = hasImage && imageLoaded;

  // Image card variant
  if (hasImage) {
    return (
      <div
        className="activity-card cursor-pointer flex flex-col"
        onClick={() => onClick(activity)}
        style={{ position: 'relative' }}
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 activity-card-shimmer" style={{ background: 'var(--surface-container)' }} />
          )}
          <CachedImage
            src={activity.imageUrl!}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
          {showImage && (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 100%)' }}
            />
          )}
        </div>

        <div className="relative p-3.5 flex flex-col h-full z-10">
          <div className="flex items-center justify-between mb-auto">
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: 'white',
              }}
            >
              <CategoryIcon size={10} />
              {activity.category}
            </span>
            <button
              onClick={e => { e.stopPropagation(); toggleSavedActivity(activity.name); }}
              className="flex items-center justify-center"
              style={{
                height: '30px',
                aspectRatio: '1',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: isSaved ? '#ff6b6b' : 'rgba(255,255,255,0.9)',
              }}
            >
              <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="mt-auto">
            <h4
              className="font-bold text-[14px] leading-tight mb-1"
              style={{
                color: 'white',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              } as React.CSSProperties}
            >
              {activity.name}
            </h4>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {activity.duration}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
              <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                {getPriceLabel(activity.estimatedCost)}
              </span>
              {activity.difficulty && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
                  <span className="capitalize">{activity.difficulty}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original minimalist card (no image)
  return (
    <div
      className="activity-card cursor-pointer flex flex-col"
      onClick={() => onClick(activity)}
    >
      <div className="p-3.5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
            <CategoryIcon size={11} />
            {activity.category}
          </span>
          <button
            onClick={e => { e.stopPropagation(); toggleSavedActivity(activity.name); }}
            className="flex items-center justify-center -mr-1"
            style={{ height: '32px', aspectRatio: '1', borderRadius: '50%', color: isSaved ? 'var(--accent)' : 'var(--text-tertiary)' }}
          >
            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>

        <h4
          className="font-bold text-[13px] leading-tight mb-1.5"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {activity.name}
        </h4>

        <p
          className="text-[11px] leading-relaxed flex-1"
          style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
        >
          {activity.description}
        </p>

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
