import React from 'react';
import { X, Clock, MapPin, DollarSign, Lightbulb } from 'lucide-react';
import { GeneratedActivity } from '../types/TravelData';

interface DynamicActivityModalProps {
  activity: GeneratedActivity | null;
  isOpen: boolean;
  onClose: () => void;
}

const DynamicActivityModal: React.FC<DynamicActivityModalProps> = ({ activity, isOpen, onClose }) => {
  if (!isOpen || !activity) return null;

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

  const destinationQuery = encodeURIComponent(activity.location);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="modal-content rounded-3xl shadow-2xl w-full max-w-2xl transform transition-all overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline bg-surface-container-high">
          <h3 className="text-xl font-semibold text-text-primary truncate pr-4">{activity.name}</h3>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-full hover:bg-surface-container transition-colors text-text-secondary hover:text-error"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="p-6 md:p-8 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6">
            <p className="text-main-secondary leading-relaxed">{activity.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-bg-secondary">
                <h4 className="font-semibold mb-2 text-text-primary flex items-center gap-2">
                  <DollarSign size={20} className="text-primary" />
                  Cost
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary">{getPriceSymbols(activity.estimatedCost)}</span>
                  <span className="text-sm text-main-secondary">({activity.estimatedCost})</span>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-bg-secondary">
                <h4 className="font-semibold mb-2 text-text-primary flex items-center gap-2">
                  <Clock size={20} className="text-primary" />
                  Duration
                </h4>
                <p>{activity.duration}</p>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-bg-secondary">
              <h4 className="font-semibold mb-2 text-text-primary flex items-center gap-2">
                <MapPin size={20} className="text-primary" />
                Location
              </h4>
              <p>{activity.location}</p>
            </div>
            
            <div className="p-4 rounded-xl bg-bg-secondary">
              <h4 className="font-semibold mb-2 text-secondary-color">🕐 Best Time to Visit</h4>
              <p>{activity.bestTime}</p>
            </div>
            
            {activity.tips && (
              <div className="p-4 rounded-xl bg-secondary-container">
                <h4 className="font-semibold mb-2 text-on-secondary-container flex items-center gap-2">
                  <Lightbulb size={20} />
                  Tips
                </h4>
                <p className="text-on-secondary-container">{activity.tips}</p>
              </div>
            )}
            
            <div className="flex flex-wrap gap-4 pt-4 border-t border-outline">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="action-button inline-flex items-center text-sm py-2 px-6"
              >
                Get Directions
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${destinationQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="filter-btn inline-flex items-center text-sm"
              >
                View on Map
              </a>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(activity.name + ' ' + activity.location + ' tickets booking')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="filter-btn inline-flex items-center text-sm"
              >
                Find Tickets
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicActivityModal;