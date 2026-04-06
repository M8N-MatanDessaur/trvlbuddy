import React from 'react';
import { Plane, Train, Car, Ship, Bus, Clock, MapPin } from 'lucide-react';
import { TripSegment } from '../types/TravelData';

interface TransportationPlanningStepProps {
  segments: TripSegment[];
  onSegmentsChange: (segments: TripSegment[]) => void;
  tripType: 'single-destination' | 'multi-city' | 'multi-country';
}

const TransportationPlanningStep: React.FC<TransportationPlanningStepProps> = ({
  segments,
  onSegmentsChange,
  tripType
}) => {
  const transportationOptions = [
    { value: 'flight', label: 'Flight', icon: Plane, description: 'Fastest for long distances' },
    { value: 'train', label: 'Train', icon: Train, description: 'Scenic and comfortable' },
    { value: 'bus', label: 'Bus', icon: Bus, description: 'Budget-friendly option' },
    { value: 'car', label: 'Car/Drive', icon: Car, description: 'Flexible and independent' },
    { value: 'ferry', label: 'Ferry', icon: Ship, description: 'For island destinations' }
  ];

  const handleTransportationChange = (segmentIndex: number, field: string, value: string) => {
    const updated = [...segments];
    if (!updated[segmentIndex].transportationToNext) {
      updated[segmentIndex].transportationToNext = {
        method: 'flight',
        duration: '',
        notes: ''
      };
    }
    updated[segmentIndex].transportationToNext = {
      ...updated[segmentIndex].transportationToNext,
      [field]: value
    } as any;
    onSegmentsChange(updated);
  };

  const getSegmentDisplayName = (segment: TripSegment) => {
    if (segment.city) {
      return `${segment.city.name}, ${segment.destination.country}`;
    }
    return segment.destination.name || 'Destination';
  };

  const getNextSegmentDisplayName = (currentIndex: number) => {
    const nextSegment = segments[currentIndex + 1];
    if (!nextSegment) return '';
    return getSegmentDisplayName(nextSegment);
  };

  // Filter segments that need transportation (exclude the last one)
  const segmentsWithTransportation = segments.slice(0, -1);

  if (segmentsWithTransportation.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Plane className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Transportation Needed</h3>
        <p className="text-main-secondary">
          You only have one destination, so no transportation planning is required.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-main-secondary">
          Plan how you'll travel between your {segmentsWithTransportation.length} destination{segmentsWithTransportation.length > 1 ? 's' : ''}
        </p>
      </div>

      {segmentsWithTransportation.map((segment, index) => {
        const nextDestination = getNextSegmentDisplayName(index);
        
        return (
          <div key={segment.id} className="border border-outline rounded-2xl p-6">
            {/* Route Header */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center gap-4 text-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span className="font-medium">{getSegmentDisplayName(segment)}</span>
                </div>
                <div className="flex-1 h-px bg-outline"></div>
                <div className="text-text-secondary">
                  <Plane size={16} />
                </div>
                <div className="flex-1 h-px bg-outline"></div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{nextDestination}</span>
                  <div className="w-3 h-3 bg-secondary rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Transportation Method Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">Transportation Method</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {transportationOptions.map((option) => {
                  const IconComponent = option.icon;
                  const isSelected = segment.transportationToNext?.method === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleTransportationChange(index, 'method', option.value)}
                      className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-105 ${
                        isSelected
                          ? 'bg-primary text-on-primary border-primary shadow-lg'
                          : 'bg-surface-container border-outline hover:border-primary hover:bg-primary/5'
                      }`}
                    >
                      <IconComponent size={24} className="mx-auto mb-2" />
                      <div className="text-sm font-medium mb-1">{option.label}</div>
                      <div className={`text-xs ${isSelected ? 'text-on-primary/80' : 'text-main-secondary'}`}>
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration and Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  Estimated Duration
                </label>
                <input
                  type="text"
                  value={segment.transportationToNext?.duration || ''}
                  onChange={(e) => handleTransportationChange(index, 'duration', e.target.value)}
                  placeholder="e.g., 2 hours, 1 day, 3h 30m"
                  className="w-full p-3 rounded-xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  Travel Notes (Optional)
                </label>
                <input
                  type="text"
                  value={segment.transportationToNext?.notes || ''}
                  onChange={(e) => handleTransportationChange(index, 'notes', e.target.value)}
                  placeholder="Booking details, tips, departure times..."
                  className="w-full p-3 rounded-xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Transportation Summary */}
            {segment.transportationToNext?.method && (
              <div className="mt-4 p-3 bg-primary-container rounded-xl">
                <div className="flex items-center gap-2 text-on-primary-container">
                  <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center">
                    {transportationOptions.find(opt => opt.value === segment.transportationToNext?.method)?.icon && 
                      React.createElement(transportationOptions.find(opt => opt.value === segment.transportationToNext?.method)!.icon, { size: 12 })
                    }
                  </div>
                  <span className="font-medium">
                    {transportationOptions.find(opt => opt.value === segment.transportationToNext?.method)?.label}
                    {segment.transportationToNext?.duration && ` • ${segment.transportationToNext.duration}`}
                  </span>
                </div>
                {segment.transportationToNext?.notes && (
                  <p className="text-sm text-on-primary-container/80 mt-1 ml-8">
                    {segment.transportationToNext.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="text-center p-4 bg-surface-container-high rounded-xl">
        <h4 className="font-semibold mb-2">Transportation Summary</h4>
        <p className="text-sm text-main-secondary">
          You'll be traveling between {segmentsWithTransportation.length + 1} destinations using{' '}
          {segmentsWithTransportation.length === 1 ? 'one transportation method' : 'multiple transportation methods'}.
          You can always update these details later in your trip dashboard.
        </p>
      </div>
    </div>
  );
};

export default TransportationPlanningStep;