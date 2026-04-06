import React from 'react';
import { Map, Calendar, Sparkles, Target } from 'lucide-react';

interface TripTypeSelectorProps {
  tripType: 'full-trip' | 'day-trip';
  onTripTypeChange: (type: 'full-trip' | 'day-trip') => void;
}

const TripTypeSelector: React.FC<TripTypeSelectorProps> = ({
  tripType,
  onTripTypeChange
}) => {
  const tripTypes = [
    {
      value: 'full-trip',
      label: 'Plan a Trip',
      description: 'Full trip planning with multiple countries/cities',
      icon: Map,
    },
    {
      value: 'day-trip',
      label: 'Day Trip',
      description: 'Quick exploration of things to do in a specific location',
      icon: Calendar,
    }
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold mb-2">What type of adventure are you planning?</h3>
        <p className="text-main-secondary">Choose the style that best fits your needs</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tripTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <button
              key={type.value}
              onClick={() => onTripTypeChange(type.value as any)}
              className={`p-8 rounded-2xl border-2 text-center transition-all hover:scale-105 ${
                tripType === type.value
                  ? 'bg-primary text-on-primary border-primary shadow-lg'
                  : 'bg-surface-container border-outline text-text-primary hover:border-primary hover:bg-primary/5'
              }`}
            >
              <div className="mb-4"><IconComponent size={48} /></div>
              <div className="font-bold text-xl mb-3">{type.label}</div>
              <div className={`text-sm leading-relaxed ${
                tripType === type.value ? 'text-on-primary/80' : 'text-main-secondary'
              }`}>
                {type.description}
              </div>
            </button>
          );
        })}
      </div>
      
      {tripType === 'full-trip' && (
        <div className="mt-6 p-6 bg-primary-container rounded-xl">
          <div className="flex items-start gap-3">
            <Sparkles size={24} className="text-on-primary-container flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-on-primary-container mb-2">
                Full Trip Planning Features
              </h4>
              <ul className="text-sm text-on-primary-container/80 space-y-1">
                <li>• Plan multiple countries and cities in one trip</li>
                <li>• Transportation planning between locations</li>
                <li>• Accommodation management for each destination</li>
                <li>• Local language phrases for each region</li>
                <li>• Destination-specific emergency contacts</li>
                <li>• Currency and cultural information</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {tripType === 'day-trip' && (
        <div className="mt-6 p-6 bg-secondary-container rounded-xl">
          <div className="flex items-start gap-3">
            <Target size={24} className="text-on-secondary-container flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-on-secondary-container mb-2">
                Day Trip Features
              </h4>
              <ul className="text-sm text-on-secondary-container/80 space-y-1">
                <li>• Quick discovery of local activities and attractions</li>
                <li>• Personalized recommendations based on your interests</li>
                <li>• Interactive maps and location details</li>
                <li>• Essential travel tools and information</li>
                <li>• No complex itinerary planning required</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripTypeSelector;