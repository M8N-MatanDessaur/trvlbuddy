import React, { useState, useMemo } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { GeneratedActivity } from '../types/TravelData';
import FilterDropdown from './FilterDropdown';
import DynamicActivityCard from './DynamicActivityCard';
import DynamicActivityModal from './DynamicActivityModal';
import PlannerModal from './PlannerModal';
import TripChatAssistant from './TripChatAssistant';
import { generateCustomItinerary } from '../services/aiService';
import { MapPin, ArrowRight, Calendar, Users, MessageCircle, Sparkles, Bot, Wand2 } from 'lucide-react';

interface PlanningLocation {
  id: string;
  name: string;
  type: 'city';
  destination: any;
  city: any;
  segment: any;
}

const DynamicPlannerPage: React.FC = () => {
  const { currentPlan, activities } = useTravel();
  const [selectedLocation, setSelectedLocation] = useState<PlanningLocation | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [itineraryResult, setItineraryResult] = useState('');
  const [showPlannerFlow, setShowPlannerFlow] = useState(false);

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="mb-4">No Travel Plan Found</h2>
          <p className="leading-relaxed text-main-secondary text-lg">
            Please complete the onboarding to use the AI planner.
          </p>
        </div>
      </section>
    );
  }

  // For day trips, show a simplified interface
  if (currentPlan.tripType === 'day-trip') {
    const destination = currentPlan.destination || currentPlan.destinations[0];
    const locationActivities = activities;

    const categories = ['All', ...Array.from(new Set(locationActivities.map(a => a.category)))];

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
      'Daytrips': '🚌'
    };

    const getFilteredActivities = (filter: string) => {
      if (filter === 'All') {
        return locationActivities;
      }
      return locationActivities.filter(activity => activity.category === filter);
    };

    const handleActivityToggle = (activityName: string, isSelected: boolean) => {
      setSelectedActivities(prev =>
        isSelected 
          ? prev.filter(name => name !== activityName)
          : [...prev, activityName]
      );
    };

    const generateItinerary = async () => {
      if (selectedActivities.length === 0) {
        alert('Please select at least one activity to plan your day.');
        return;
      }

      setIsModalOpen(true);
      setIsLoading(true);
      setItineraryResult('');

      try {
        const locationName = `${destination.name}, ${destination.country}`;
        const result = await generateCustomItinerary(selectedActivities, locationName);
        setItineraryResult(result);
      } catch (error) {
        console.error("Error generating itinerary:", error);
        setItineraryResult(`<p class="text-error">Sorry, there was an error generating your itinerary. Please check your connection and try again.</p>`);
      } finally {
        setIsLoading(false);
      }
    };

    const renderActivityList = (filter: string, selectedActivities: string[]) => {
      const filteredActivities = getFilteredActivities(filter);
      
      if (filteredActivities.length === 0) {
        return (
          <div className="text-center py-8">
            <p className="text-main-secondary">No activities found for this filter.</p>
          </div>
        );
      }
      
      return (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-2 mb-4 border-t border-outline pt-4">
          {filteredActivities.map((activity, index) => {
            const isSelected = selectedActivities.includes(activity.name);
            const isDayTrip = activity.category === 'Daytrips';
            
            return (
              <label
                key={`${activity.name}-${index}`}
                className={`flex items-center p-3 rounded-lg hover:bg-surface-container-high cursor-pointer ${
                  isDayTrip ? 'bg-secondary-container/30' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded-md border-outline text-primary focus:ring-primary bg-bg-secondary"
                  checked={isSelected}
                  onChange={(e) => handleActivityToggle(activity.name, isSelected)}
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{activity.name}</span>
                    {isDayTrip && (
                      <span className="px-2 py-1 bg-secondary text-on-secondary rounded-full text-xs font-medium">
                        🚌 Day Trip
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-main-secondary">{activity.category} • {activity.duration}</div>
                  <div className="text-xs text-main-secondary mt-1">{activity.location}</div>
                </div>
              </label>
            );
          })}
        </div>
      );
    };

    // Show main hub if planner flow is not active
    if (!showPlannerFlow) {
      return (
        <section className="page">
          {/* Main Header */}
          <div className="text-center max-w-4xl mx-auto mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold text-primary">AI Travel Hub</h1>
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xl text-main-secondary mb-8">
              Your intelligent travel companion for {destination.name}
            </p>
          </div>

          {/* Two Main Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* AI Day Planner Section */}
            <div className="card rounded-3xl p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wand2 className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">AI Day Planner</h2>
                <p className="text-main-secondary">
                  Create perfect itineraries with AI-powered scheduling and optimization
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-primary-container">
                  <h4 className="text-on-primary-container font-semibold mb-2">✨ Smart Planning</h4>
                  <p className="text-sm text-on-primary-container/80">
                    Select activities and let AI create the perfect timeline with optimal routing
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-secondary-container">
                  <h4 className="text-on-secondary-container font-semibold mb-2">🎯 Personalized</h4>
                  <p className="text-sm text-on-secondary-container/80">
                    Based on your interests: {currentPlan.interests.slice(0, 3).join(', ')}
                  </p>
                </div>

                <button
                  onClick={() => setShowPlannerFlow(true)}
                  className="action-button w-full flex items-center justify-center gap-2"
                >
                  <Wand2 size={20} />
                  Plan Your Day
                </button>
              </div>
            </div>

            {/* AI Travel Assistant Section */}
            <div className="card rounded-3xl p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-8 w-8 text-secondary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">AI Travel Assistant</h2>
                <p className="text-main-secondary">
                  Get instant answers about restaurants, directions, and local recommendations
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-secondary-container">
                  <h4 className="text-on-secondary-container font-semibold mb-2">🍽️ Real Places</h4>
                  <p className="text-sm text-on-secondary-container/80">
                    Find verified restaurants and attractions with live Google data
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-primary-container">
                  <h4 className="text-on-primary-container font-semibold mb-2">🗺️ Smart Directions</h4>
                  <p className="text-sm text-on-primary-container/80">
                    Get walking directions and transportation tips from your location
                  </p>
                </div>

                <button
                  onClick={() => setIsChatOpen(true)}
                  className="action-button w-full flex items-center justify-center gap-2"
                >
                  <MessageCircle size={20} />
                  Chat with AI Assistant
                </button>
              </div>
            </div>
          </div>

          <TripChatAssistant
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            travelPlan={currentPlan}
            activities={activities}
          />
        </section>
      );
    }

    // Show activity selection flow
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <button
            onClick={() => setShowPlannerFlow(false)}
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4"
          >
            ← Back to AI Hub
          </button>
          
          <h2 className="mb-4">✨ AI Day Planner</h2>
          <p className="leading-relaxed text-main-secondary text-lg">
            Select activities you're interested in, and our AI will create a personalized itinerary with perfect timing and flow!
          </p>
        </div>

        {/* Location Info */}
        <div className="card rounded-2xl p-4 mb-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center">
              🌍
            </div>
            <div>
              <h3 className="font-bold">{destination.name}</h3>
              <div className="text-sm text-main-secondary flex gap-4">
                <span>💬 {destination.languages?.join(', ') || 'Local language'}</span>
                <span>💰 {destination.currency || 'Local currency'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="card rounded-3xl p-6">
            <h3 className="text-center mb-6 flex items-center justify-center gap-3">
              <span className="text-4xl">🗺️</span>
              Choose Your Activities
            </h3>
            
            {/* Category Filter Dropdown */}
            <div className="mb-6 flex justify-center">
              <FilterDropdown
                categories={categories}
                activeCategory={activeFilter}
                onCategoryChange={setActiveFilter}
                categoryIcons={categoryIcons}
                label="Filter Activities"
              />
            </div>
            
            {renderActivityList(activeFilter, selectedActivities)}
            
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-outline">
              <div className="text-sm text-main-secondary">
                {selectedActivities.length} {selectedActivities.length === 1 ? 'activity' : 'activities'} selected
              </div>
              <button
                onClick={generateItinerary}
                disabled={selectedActivities.length === 0}
                className="action-button disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Itinerary
              </button>
            </div>
          </div>
        </div>

        <PlannerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isLoading={isLoading}
          result={itineraryResult}
        />

        <TripChatAssistant
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          travelPlan={currentPlan}
          activities={activities}
        />
      </section>
    );
  }

  // Full trip planner logic - ONLY show cities, not countries
  const getPlanningLocations = (): PlanningLocation[] => {
    const locations: PlanningLocation[] = [];
    
    // Only process segments that have cities
    currentPlan.segments?.forEach(segment => {
      if (segment.city) {
        locations.push({
          id: segment.city.id,
          name: `${segment.city.name}, ${segment.destination.country}`,
          type: 'city',
          destination: segment.destination,
          city: segment.city,
          segment
        });
      }
    });
    
    return locations;
  };

  const planningLocations = getPlanningLocations();

  // If no cities are available, show a message
  if (planningLocations.length === 0) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-primary">AI Travel Hub</h1>
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="p-6 bg-secondary-container rounded-xl">
            <h3 className="text-lg font-semibold text-on-secondary-container mb-2">No Cities Available</h3>
            <p className="text-on-secondary-container/80 mb-4">
              The AI planner works with specific cities. Please add cities to your trip plan to use this feature.
            </p>
            <p className="text-sm text-on-secondary-container/70">
              💡 Tip: Go back to your trip planning and add specific cities within your countries.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Filter activities for the selected location (city only)
  const locationActivities = selectedLocation 
    ? activities.filter(activity => activity.cityId === selectedLocation.city.id)
    : [];

  const categories = ['All', ...Array.from(new Set(locationActivities.map(a => a.category)))];

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
    'Daytrips': '🚌'
  };

  const getFilteredActivities = (filter: string) => {
    if (filter === 'All') {
      return locationActivities;
    }
    return locationActivities.filter(activity => activity.category === filter);
  };

  const handleActivityToggle = (activityName: string, isSelected: boolean) => {
    setSelectedActivities(prev =>
      isSelected 
        ? prev.filter(name => name !== activityName)
        : [...prev, activityName]
    );
  };

  const generateItinerary = async () => {
    if (selectedActivities.length === 0) {
      alert('Please select at least one activity to plan your day.');
      return;
    }

    if (!selectedLocation) {
      alert('Please select a city first.');
      return;
    }

    setIsModalOpen(true);
    setIsLoading(true);
    setItineraryResult('');

    try {
      const locationName = `${selectedLocation.city.name}, ${selectedLocation.destination.country}`;
      const result = await generateCustomItinerary(selectedActivities, locationName);
      setItineraryResult(result);
    } catch (error) {
      console.error("Error generating itinerary:", error);
      setItineraryResult(`<p class="text-error">Sorry, there was an error generating your itinerary. Please check your connection and try again.</p>`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLocations = () => {
    setSelectedLocation(null);
    setSelectedActivities([]);
    setActiveFilter('All');
    // Don't reset showPlannerFlow here - keep it true to show city selection
  };

  const renderActivityList = (filter: string, selectedActivities: string[]) => {
    const filteredActivities = getFilteredActivities(filter);
    
    if (filteredActivities.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-main-secondary">No activities found for this city and filter.</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-1 max-h-96 overflow-y-auto pr-2 mb-4 border-t border-outline pt-4">
        {filteredActivities.map((activity, index) => {
          const isSelected = selectedActivities.includes(activity.name);
          const isDayTrip = activity.category === 'Daytrips';
          
          return (
            <label
              key={`${activity.name}-${index}`}
              className={`flex items-center p-3 rounded-lg hover:bg-surface-container-high cursor-pointer ${
                isDayTrip ? 'bg-secondary-container/30' : ''
              }`}
            >
              <input
                type="checkbox"
                className="h-5 w-5 rounded-md border-outline text-primary focus:ring-primary bg-bg-secondary"
                checked={isSelected}
                onChange={(e) => handleActivityToggle(activity.name, isSelected)}
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{activity.name}</span>
                  {isDayTrip && (
                    <span className="px-2 py-1 bg-secondary text-on-secondary rounded-full text-xs font-medium">
                      🚌 Day Trip
                    </span>
                  )}
                </div>
                <div className="text-xs text-main-secondary">{activity.category} • {activity.duration}</div>
                <div className="text-xs text-main-secondary mt-1">{activity.location}</div>
              </div>
            </label>
          );
        })}
      </div>
    );
  };

  // Step 1: Show city selection (if planner flow not started)
  if (!selectedLocation && !showPlannerFlow) {
    return (
      <section className="page">
        {/* Main Header */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-primary">AI Travel Hub</h1>
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <p className="text-xl text-main-secondary mb-8">
            Welcome to your trip's ai hub
          </p>
        </div>

        {/* Two Main Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* AI Day Planner Section */}
          <div className="card rounded-3xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wand2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">AI Day Planner</h2>
              <p className="text-main-secondary">
                Create perfect itineraries with AI-powered scheduling and optimization
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-primary-container">
                <h4 className="text-on-primary-container font-semibold mb-2">✨ Smart Planning</h4>
                <p className="text-sm text-on-primary-container/80">
                  Select activities and let AI create the perfect timeline with optimal routing
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-secondary-container">
                <h4 className="text-on-secondary-container font-semibold mb-2">🎯 Personalized</h4>
                <p className="text-sm text-on-secondary-container/80">
                  Based on your interests: {currentPlan.interests.slice(0, 3).join(', ')}
                </p>
              </div>

              <button
                onClick={() => setShowPlannerFlow(true)}
                className="action-button w-full flex items-center justify-center gap-2"
              >
                <Wand2 size={20} />
                Plan Your Day
              </button>
            </div>
          </div>

          {/* AI Travel Assistant Section */}
          <div className="card rounded-3xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-secondary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">AI Travel Assistant</h2>
              <p className="text-main-secondary">
                Get instant answers about restaurants, directions, and local recommendations
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary-container">
                <h4 className="text-on-secondary-container font-semibold mb-2">🍽️ Real Places</h4>
                <p className="text-sm text-on-secondary-container/80">
                  Find verified restaurants and attractions with live Google data
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-primary-container">
                <h4 className="text-on-primary-container font-semibold mb-2">🗺️ Smart Directions</h4>
                <p className="text-sm text-on-primary-container/80">
                  Get walking directions and transportation tips from your location
                </p>
              </div>

              <button
                onClick={() => setIsChatOpen(true)}
                className="action-button w-full flex items-center justify-center gap-2"
              >
                <MessageCircle size={20} />
                Chat with AI Assistant
              </button>
            </div>
          </div>
        </div>

        <TripChatAssistant
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          travelPlan={currentPlan}
          activities={activities}
        />
      </section>
    );
  }

  // Step 2: Show city selection for planner flow
  if (showPlannerFlow && !selectedLocation) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <button
            onClick={() => setShowPlannerFlow(false)}
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4"
          >
            ← Back to AI Hub
          </button>
          
          <h2 className="mb-4">✨ AI Day Planner</h2>
          <p className="leading-relaxed text-main-secondary text-lg">
            Choose a city to start planning your perfect day!
          </p>
        </div>

        {/* City Selection */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-center mb-6">Select a City to Plan</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planningLocations.map((location) => (
              <button
                key={location.id}
                onClick={() => setSelectedLocation(location)}
                className="card rounded-2xl p-6 text-left hover:bg-surface-container-high transition-all hover:scale-[1.02] border-2 border-transparent hover:border-primary group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center text-xl">
                      🏙️
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{location.name}</h4>
                      <p className="text-sm text-main-secondary">{location.destination.country}</p>
                    </div>
                  </div>
                  <ArrowRight className="text-primary group-hover:translate-x-1 transition-transform" size={20} />
                </div>
                
                <div className="space-y-2 text-sm text-main-secondary">
                  <div className="flex items-center gap-2">
                    <span>💬</span>
                    <span>{location.destination.languages?.join(', ') || 'Local language'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>💰</span>
                    <span>{location.destination.currency || 'Local currency'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🎯</span>
                    <span>
                      {activities.filter(a => a.cityId === location.city.id).length} activities available
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <TripChatAssistant
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          travelPlan={currentPlan}
          activities={activities}
        />
      </section>
    );
  }

  // Step 3: Show activity selection for chosen city
  return (
    <section className="page">
      <div className="text-center max-w-3xl mx-auto mb-8">
        <button
          onClick={handleBackToLocations}
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4"
        >
          ← Back to Cities
        </button>
        
        <h2 className="mb-4">Plan Your Day in {selectedLocation.name}</h2>
        <p className="leading-relaxed text-main-secondary text-lg">
          Select activities you're interested in, and our AI will create a personalized itinerary with perfect timing and flow!
        </p>
      </div>
      
      {/* Location Info */}
      <div className="card rounded-2xl p-4 mb-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center">
            🏙️
          </div>
          <div>
            <h3 className="font-bold">{selectedLocation.name}</h3>
            <div className="text-sm text-main-secondary flex gap-4">
              <span>💬 {selectedLocation.destination.languages?.join(', ') || 'Local language'}</span>
              <span>💰 {selectedLocation.destination.currency || 'Local currency'}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto">
        <div className="card rounded-3xl p-6">
          <h3 className="text-center mb-6 flex items-center justify-center gap-3">
            <span className="text-4xl">🗺️</span>
            Choose Your Activities
          </h3>
          
          {/* Category Filter Dropdown */}
          <div className="mb-6 flex justify-center">
            <FilterDropdown
              categories={categories}
              activeCategory={activeFilter}
              onCategoryChange={setActiveFilter}
              categoryIcons={categoryIcons}
              label="Filter Activities"
            />
          </div>
          
          {renderActivityList(activeFilter, selectedActivities)}
          
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-outline">
            <div className="text-sm text-main-secondary">
              {selectedActivities.length} {selectedActivities.length === 1 ? 'activity' : 'activities'} selected
            </div>
            <button
              onClick={generateItinerary}
              disabled={selectedActivities.length === 0}
              className="action-button disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Itinerary
            </button>
          </div>
        </div>
      </div>

      <PlannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isLoading={isLoading}
        result={itineraryResult}
      />

      <TripChatAssistant
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        travelPlan={currentPlan}
        activities={activities}
        selectedCity={selectedLocation}
      />
    </section>
  );
};

export default DynamicPlannerPage;