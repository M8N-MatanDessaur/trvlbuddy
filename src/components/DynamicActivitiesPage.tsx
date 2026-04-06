import React, { useState, useMemo } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { GeneratedActivity } from '../types/TravelData';
import FilterDropdown from './FilterDropdown';
import DynamicActivityCard from './DynamicActivityCard';
import DynamicActivityModal from './DynamicActivityModal';

const DynamicActivitiesPage: React.FC = () => {
  const { currentPlan, activities } = useTravel();
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDestination, setActiveDestination] = useState('All');
  const [selectedActivity, setSelectedActivity] = useState<GeneratedActivity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="mb-4">No Travel Plan Found</h2>
          <p className="leading-relaxed text-main-secondary text-lg">
            Please complete the onboarding to see personalized activities.
          </p>
        </div>
      </section>
    );
  }

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(activities.map(item => item.category))];
    return ['All', ...uniqueCategories];
  }, [activities]);

  const destinations = useMemo(() => {
    if (currentPlan.tripType === 'day-trip') {
      return ['All'];
    }
    
    // Only show cities, not countries
    const uniqueCities = [...new Set(
      currentPlan.segments
        ?.filter(segment => segment.city) // Only segments with cities
        .map(segment => segment.city!.name) || []
    )];
    
    return ['All', ...uniqueCities];
  }, [currentPlan]);

  const categoryIcons: { [key: string]: string } = {
    'All': '🌍',
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
    'Daytrips': '🚌' // New icon for day trips
  };

  const destinationIcons: { [key: string]: string } = {
    'All': '🌍'
  };

  const filteredActivities = useMemo(() => {
    let filtered = activities;
    
    if (activeCategory !== 'All') {
      filtered = filtered.filter(activity => activity.category === activeCategory);
    }
    
    if (activeDestination !== 'All' && currentPlan.tripType !== 'day-trip') {
      // Find the city ID for the selected destination
      const citySegment = currentPlan.segments?.find(segment => 
        segment.city && segment.city.name === activeDestination
      );
      
      if (citySegment?.city) {
        filtered = filtered.filter(activity => activity.cityId === citySegment.city!.id);
      }
    }
    
    return filtered;
  }, [activities, activeCategory, activeDestination, currentPlan]);

  const handleActivityClick = (activity: GeneratedActivity) => {
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedActivity(null);
  };

  const getCityName = (cityId?: string) => {
    if (!cityId) return '';
    const segment = currentPlan.segments?.find(segment => segment.city?.id === cityId);
    return segment?.city?.name || '';
  };

  // Count day trips for display
  const dayTripsCount = activities.filter(activity => activity.category === 'Daytrips').length;

  return (
    <section className="page">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="mb-4">
          Discover {currentPlan.tripType === 'day-trip' 
            ? (currentPlan.destination?.name || currentPlan.destinations[0]?.name)
            : 'Your Cities'
          }
        </h2>
        <p className="leading-relaxed text-main-secondary text-lg">
          Personalized activities based on your interests: {currentPlan.interests.join(', ')}. 
          {currentPlan.tripType !== 'day-trip' && destinations.length > 2 && ' Use the filters below to explore by category and city.'}
          {dayTripsCount > 0 && (
            <span className="block mt-2 text-primary font-medium">
              🚌 Plus {dayTripsCount} amazing day trips to nearby destinations!
            </span>
          )}
        </p>
      </div>

      {/* Filter Section */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row gap-6 justify-center items-start md:items-end">
          {/* Category Filter */}
          <div className="w-full md:w-auto">
            <FilterDropdown
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              categoryIcons={categoryIcons}
              label="Filter by Category"
            />
          </div>

          {/* City Filter (for full trips with multiple cities) */}
          {currentPlan.tripType !== 'day-trip' && destinations.length > 2 && (
            <div className="w-full md:w-auto">
              <FilterDropdown
                categories={destinations}
                activeCategory={activeDestination}
                onCategoryChange={setActiveDestination}
                categoryIcons={destinationIcons}
                label="Filter by City"
              />
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container rounded-full text-on-primary-container text-sm max-w-full">
            <span className="flex-shrink-0">Showing:</span>
            <span className="font-semibold flex-shrink-0">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
            </span>
            
            {/* Filter badges container with overflow handling */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeCategory !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-on-primary rounded-full text-xs font-medium flex-shrink-0">
                  <span>{categoryIcons[activeCategory]}</span>
                  <span className="truncate max-w-[80px]">{activeCategory}</span>
                </span>
              )}
              {activeDestination !== 'All' && currentPlan.tripType !== 'day-trip' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-on-secondary rounded-full text-xs font-medium flex-shrink-0">
                  <span>🏙️</span>
                  <span className="truncate max-w-[80px]">{activeDestination}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Day Trips Info Banner */}
      {activeCategory === 'Daytrips' && filteredActivities.length > 0 && (
        <div className="mb-8 p-6 bg-secondary-container rounded-3xl">
          <div className="text-center">
            <h3 className="text-xl font-bold text-on-secondary-container mb-2 flex items-center justify-center gap-2">
              🚌 Day Trip Adventures
            </h3>
            <p className="text-on-secondary-container/80 leading-relaxed">
              Discover amazing nearby destinations perfect for day trips! These are carefully selected cities and attractions 
              within easy reach of your planned destinations, offering unique experiences you can enjoy and return the same day.
            </p>
          </div>
        </div>
      )}

      {filteredActivities.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">No activities found</h3>
          <p className="text-main-secondary text-lg mb-4">
            {currentPlan.tripType === 'day-trip' 
              ? 'No activities available for this destination yet.'
              : 'Try adjusting your filters or make sure you have cities added to your trip plan.'
            }
          </p>
          <button
            onClick={() => {
              setActiveCategory('All');
              setActiveDestination('All');
            }}
            className="action-button"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredActivities.map((activity, index) => (
            <div key={`${activity.name}-${index}`} className="relative">
              {/* City badge for full trips */}
              {currentPlan.tripType !== 'day-trip' && activity.cityId && activity.category !== 'Daytrips' && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="inline-block px-3 py-1 bg-secondary text-on-secondary rounded-full text-xs font-medium shadow-sm">
                    🏙️ {getCityName(activity.cityId)}
                  </span>
                </div>
              )}
              
              {/* Day trip badge */}
              {activity.category === 'Daytrips' && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="inline-block px-3 py-1 bg-primary text-on-primary rounded-full text-xs font-medium shadow-sm">
                    🚌 Day Trip
                  </span>
                </div>
              )}
              
              <DynamicActivityCard
                activity={activity}
                onClick={handleActivityClick}
              />
            </div>
          ))}
        </div>
      )}

      <DynamicActivityModal
        activity={selectedActivity}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </section>
  );
};

export default DynamicActivitiesPage;