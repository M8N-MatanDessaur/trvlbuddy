import React from 'react';
import { GeneratedActivity } from '../types/TravelData';
import { Clock, MapPin } from 'lucide-react';

interface DynamicActivityCardProps {
  activity: GeneratedActivity;
  onClick: (activity: GeneratedActivity) => void;
}

const DynamicActivityCard: React.FC<DynamicActivityCardProps> = ({ activity, onClick }) => {
  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'challenging': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Convert price range to dollar signs
  const getPriceSymbols = (estimatedCost: string) => {
    const cost = estimatedCost.toLowerCase();
    
    if (cost.includes('free') || cost === '0' || cost.includes('€0') || cost.includes('$0')) {
      return 'Free';
    }
    
    // Extract numbers from the cost string
    const numbers = estimatedCost.match(/\d+/g);
    if (!numbers || numbers.length === 0) {
      return '$';
    }
    
    // Get the highest number in the range
    const maxPrice = Math.max(...numbers.map(n => parseInt(n)));
    
    // Convert to dollar symbols based on price ranges
    if (maxPrice <= 15) {
      return '$';
    } else if (maxPrice <= 35) {
      return '$$';
    } else if (maxPrice <= 60) {
      return '$$$';
    } else {
      return '$$$$';
    }
  };

  const categoryIcons: { [key: string]: string } = {
    'History': '🏛️',
    'Nature': '🌿',
    'Food': '🍽️',
    'Museums': '🖼️',
    'Beach': '🏖️',
    'Shopping': '🛍️',
    'Nightlife': '🌃',
    'Culture': '🎭',
    'Wellness': '♨️',
    'City': '🏙️',
    'Daytrips': '🚌'
  };

  // Special styling for day trips
  const isDayTrip = activity.category === 'Daytrips';

  return (
    <div
      className={`activity-card card rounded-3xl overflow-hidden cursor-pointer p-6 flex flex-col justify-between hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary/20 ${
        isDayTrip ? 'bg-gradient-to-br from-secondary-container to-secondary-container/70' : ''
      }`}
      onClick={() => onClick(activity)}
    >
      {/* Category badge at top left */}
      <div className="mb-4">
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
          isDayTrip 
            ? 'bg-secondary text-on-secondary' 
            : 'bg-primary text-on-primary'
        }`}>
          <span className="text-lg">{categoryIcons[activity.category] || '✨'}</span>
          <span>{activity.category}</span>
        </span>
      </div>

      <div className="flex-1">
        <div className="mb-3">
          <h4 className="font-bold text-xl leading-tight">{activity.name}</h4>
        </div>
        
        <p className="text-sm mb-6 text-main-secondary leading-relaxed">
          {activity.description.substring(0, 120)}...
        </p>
        
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-main-secondary">
            <Clock size={16} className={isDayTrip ? 'text-secondary' : 'text-primary'} />
            <span>{activity.duration}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-main-secondary">
            <MapPin size={16} className={isDayTrip ? 'text-secondary' : 'text-primary'} />
            <span>{activity.location}</span>
          </div>
        </div>
      </div>
      
      {/* Bottom section with difficulty and price pills */}
      <div className="flex justify-between items-center gap-3">
        <div className="flex-shrink-0 min-w-0 flex-1">
          {activity.difficulty && (
            <span className={`inline-block py-2 px-3 rounded-full text-xs font-medium whitespace-nowrap truncate max-w-full ${getDifficultyColor(activity.difficulty)}`}>
              {activity.difficulty}
            </span>
          )}
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold border whitespace-nowrap flex-shrink-0 min-w-0 ${
          isDayTrip 
            ? 'bg-secondary/10 text-secondary border-secondary/20' 
            : 'bg-primary/10 text-primary border-primary/20'
        }`}>
          <span className="truncate block max-w-[120px]">
            {getPriceSymbols(activity.estimatedCost)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DynamicActivityCard;