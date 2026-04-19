import React, { useState } from 'react';
import { Clock, Heart } from 'lucide-react';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { useTravel } from '../../contexts/TravelContext';
import type { GeneratedActivity } from '../../types/TravelData';
import CachedImage from '../CachedImage';

interface Props {
  activities: GeneratedActivity[];
  onActivityClick: (activity: GeneratedActivity) => void;
}

const ImageCard: React.FC<{ activity: GeneratedActivity }> = ({ activity }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!activity.imageUrl || error) return null;

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 activity-card-shimmer" style={{ background: 'var(--surface-container)' }} />
      )}
      <CachedImage
        src={activity.imageUrl}
        alt=""
        className="w-full h-full object-cover"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
      {loaded && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.1) 100%)' }}
        />
      )}
    </>
  );
};

const HorizontalActivityScroll: React.FC<Props> = ({ activities, onActivityClick }) => {
  const { savedActivities, toggleSavedActivity } = useTravel();

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
      style={{ scrollbarWidth: 'none' }}
    >
      {activities.map((activity, i) => {
        const CatIcon = getCategoryIcon(activity.category);
        const isSaved = savedActivities.includes(activity.name);
        const hasImage = !!activity.imageUrl;

        const getPriceLabel = (cost: string) => {
          const c = cost.toLowerCase();
          if (c.includes('free') || c === '0' || c.includes('$0')) return 'Free';
          const nums = cost.match(/\d+/g);
          if (!nums) return '$';
          const max = Math.max(...nums.map((n) => parseInt(n)));
          if (max <= 15) return '$';
          if (max <= 35) return '$$';
          if (max <= 60) return '$$$';
          return '$$$$';
        };

        // Image card variant
        if (hasImage) {
          return (
            <div
              key={`${activity.name}-${i}`}
              className="flex-shrink-0 snap-start cursor-pointer transition-all active:scale-[0.98]"
              style={{ width: '220px' }}
              onClick={() => onActivityClick(activity)}
            >
              <div
                className="h-full rounded-2xl flex flex-col relative overflow-hidden"
                style={{ minHeight: '180px' }}
              >
                <div className="absolute inset-0">
                  <ImageCard activity={activity} />
                </div>

                <div className="relative p-3.5 flex flex-col h-full z-10" style={{ minHeight: '180px' }}>
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
                      <CatIcon size={10} />
                      {activity.category}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSavedActivity(activity.name);
                      }}
                      className="flex items-center justify-center"
                      style={{
                        height: '28px',
                        aspectRatio: '1',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        color: isSaved ? '#ff6b6b' : 'rgba(255,255,255,0.9)',
                      }}
                    >
                      <Heart size={13} fill={isSaved ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div className="mt-auto">
                    <h4
                      className="font-bold text-[13px] leading-tight mb-1.5"
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

                    <div
                      className="flex items-center justify-between text-[10px]"
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                    >
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {activity.duration}
                      </span>
                      <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                        {getPriceLabel(activity.estimatedCost)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Original minimalist card (no image)
        return (
          <div
            key={`${activity.name}-${i}`}
            className="flex-shrink-0 snap-start cursor-pointer transition-all active:scale-[0.98]"
            style={{ width: '220px' }}
            onClick={() => onActivityClick(activity)}
          >
            <div
              className="h-full rounded-2xl p-3.5 flex flex-col"
              style={{ background: 'var(--surface-container)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  <CatIcon size={11} />
                  {activity.category}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSavedActivity(activity.name);
                  }}
                  className="flex items-center justify-center -mr-1"
                  style={{
                    height: '28px',
                    aspectRatio: '1',
                    borderRadius: '50%',
                    color: isSaved ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                >
                  <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
              </div>

              <h4
                className="font-bold text-[13px] leading-tight mb-1.5"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties}
              >
                {activity.name}
              </h4>

              <p
                className="text-[11px] leading-relaxed flex-1 mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties}
              >
                {activity.description}
              </p>

              <div
                className="flex items-center justify-between text-[10px]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {activity.duration}
                </span>
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                  {getPriceLabel(activity.estimatedCost)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HorizontalActivityScroll;
