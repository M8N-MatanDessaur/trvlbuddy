import React, { useState } from 'react';
import { MapPin, Calendar, Users, Heart, DollarSign, Plane, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { TravelPlan, Destination, Accommodation, TripSegment } from '../types/TravelData';
import { generateTravelContent } from '../services/aiService';
import PlacesAutocomplete from './PlacesAutocomplete';
import AccommodationInput from './AccommodationInput';
import TripTypeSelector from './TripTypeSelector';
import MultiCityPlannerStep from './MultiCityPlannerStep';
import MUIDateRangePicker from './MUIDateRangePicker';
import Header from './Header';

const OnboardingFlow: React.FC = () => {
  const { theme } = useTheme();
  const { toast } = useToast();
  const { setCurrentPlan, setHasCompletedOnboarding, setIsLoading, setActivities, setTranslations, setEmergencyContacts } = useTravel();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    tripType: 'full-trip' as 'full-trip' | 'day-trip',
    title: '',
    // Day trip fields
    dayTripDestination: null as { name: string; country: string; countryCode: string; coordinates: { lat: number; lng: number } } | null,
    // Full trip fields
    segments: [] as TripSegment[],
    // Common fields
    travelers: 2,
    interests: [] as string[],
    budget: 'mid-range' as 'budget' | 'mid-range' | 'luxury'
  });

  // Calculate total steps based on trip type
  const getTotalSteps = () => {
    if (formData.tripType === 'day-trip') {
      return 6; // 1. Welcome, 2. Type, 3. Destination, 4. Travelers, 5. Interests, 6. Budget
    } else {
      return 7; // 1. Welcome, 2. Type, 3. Destinations, 4. Accommodation, 5. Travelers, 6. Interests, 7. Budget
    }
  };

  const totalSteps = getTotalSteps();

  const interestOptions = [
    { id: 'historical', label: 'Historical Sites', icon: '🏛️' },
    { id: 'outdoor', label: 'Outdoor Adventures', icon: '🥾' },
    { id: 'food', label: 'Food & Dining', icon: '🍽️' },
    { id: 'museums', label: 'Museums & Art', icon: '🖼️' },
    { id: 'beach', label: 'Beach & Water Sports', icon: '🏖️' },
    { id: 'shopping', label: 'Shopping', icon: '🛍️' },
    { id: 'nightlife', label: 'Nightlife', icon: '🌃' },
    { id: 'nature', label: 'Nature & Wildlife', icon: '🌿' },
    { id: 'photography', label: 'Photography', icon: '📸' },
    { id: 'culture', label: 'Local Culture', icon: '🎭' },
    { id: 'wellness', label: 'Wellness & Spa', icon: '♨️' },
    { id: 'architecture', label: 'Architecture', icon: '🏗️' },
    { id: 'markets', label: 'Markets & Street Food', icon: '🛒' },
    { id: 'hiking', label: 'Hiking', icon: '🥾' },
    { id: 'boat', label: 'Boat Tours', icon: '🛥️' },
    { id: 'religious', label: 'Religious Sites', icon: '⛪' }
  ];

  // =================================================================
  // FIX START: Add a reliable date formatting helper function
  // =================================================================
  /**
   * Formats a 'YYYY-MM-DD' string to 'DD/MM/YYYY' without timezone issues.
   * @param dateString The date string to format (e.g., "2025-09-14")
   * @returns The formatted date string (e.g., "14/09/2025")
   */
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    // new Date('YYYY-MM-DD') creates a date at midnight UTC.
    const date = new Date(dateString);
    // Use getUTC* methods to extract date parts, ignoring the local timezone.
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // getUTCMonth() is 0-indexed
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };
  // =================================================================
  // FIX END
  // =================================================================

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTripTypeChange = (type: 'full-trip' | 'day-trip') => {
    setFormData({
      ...formData,
      tripType: type,
      segments: type === 'full-trip' ? [{
        id: `segment_${Date.now()}`,
        destination: {
          id: `dest_${Date.now()}`,
          name: '',
          country: '',
          countryCode: '',
          currency: '',
          languages: [],
          emergencyNumber: '',
          timezone: '',
          coordinates: { lat: 0, lng: 0 }
        },
        startDate: '',
        endDate: '',
        accommodations: [] // Start with empty accommodations - only add for cities
      }] : []
    });
  };

  const handleDayTripPlaceSelect = (place: any) => {
    setFormData({
      ...formData,
      dayTripDestination: {
        name: place.name || place.formatted_address || '',
        country: place.country || '',
        countryCode: place.countryCode || '',
        coordinates: place.coordinates || { lat: 0, lng: 0 }
      }
    });
  };

  const toggleInterest = (interest: string) => {
    const updated = formData.interests.includes(interest)
      ? formData.interests.filter(i => i !== interest)
      : [...formData.interests, interest];
    setFormData({ ...formData, interests: updated });
  };

  const generateTripTitle = () => {
    if (formData.tripType === 'day-trip' && formData.dayTripDestination) {
      return `${formData.dayTripDestination.name} Day Trip`;
    } else if (formData.segments.length > 0) {
      const countries = [...new Set(formData.segments.map(s => s.destination.country).filter(Boolean))];
      if (countries.length === 0) return 'My Trip';
      if (countries.length === 1) return `${countries[0]} Adventure`;
      if (countries.length === 2) return `${countries[0]} & ${countries[1]} Journey`;
      return `${countries[0]} & ${countries.length - 1} More Countries`;
    }
    return 'My Trip';
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      let travelPlan: TravelPlan;
      
      if (formData.tripType === 'day-trip' && formData.dayTripDestination) {
        const destination: Destination = {
          id: `dest_${Date.now()}`,
          name: formData.dayTripDestination.name,
          country: formData.dayTripDestination.country,
          countryCode: formData.dayTripDestination.countryCode,
          currency: '',
          languages: [],
          emergencyNumber: '',
          timezone: '',
          coordinates: formData.dayTripDestination.coordinates
        };

        travelPlan = {
          id: `plan_${Date.now()}`,
          title: formData.title || generateTripTitle(),
          tripType: 'day-trip',
          destinations: [destination],
          segments: [{
            id: `segment_${Date.now()}`,
            destination,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            accommodations: []
          }],
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          travelers: formData.travelers,
          interests: formData.interests,
          budget: formData.budget,
          createdAt: new Date().toISOString()
        };
      } else {
        const allDestinations = formData.segments.map(s => s.destination);
        const startDate = formData.segments[0]?.startDate || '';
        const endDate = formData.segments[formData.segments.length - 1]?.endDate || '';

        travelPlan = {
          id: `plan_${Date.now()}`,
          title: formData.title || generateTripTitle(),
          tripType: 'full-trip',
          destinations: allDestinations,
          segments: formData.segments,
          startDate,
          endDate,
          travelers: formData.travelers,
          interests: formData.interests,
          budget: formData.budget,
          createdAt: new Date().toISOString()
        };
      }

      await generateTravelContent(travelPlan, setActivities, setTranslations, setEmergencyContacts);
      
      setCurrentPlan(travelPlan);
      setHasCompletedOnboarding(true);
    } catch {
      toast('Failed to generate travel content. Please check your connection and try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        if (formData.tripType === 'day-trip') {
          return formData.dayTripDestination !== null;
        } else {
          const hasValidSegments = formData.segments.length > 0 && 
                 formData.segments.every(s => s.destination.name && s.startDate && s.endDate);
          const countrySegments = formData.segments.filter(s => !s.city);
          if (countrySegments.length === 0) return hasValidSegments;
          const allCountriesHaveCities = countrySegments.every(countrySegment => {
            const citiesForThisCountry = formData.segments.filter(s => 
              s.city && s.destination.id === countrySegment.destination.id
            );
            return citiesForThisCountry.length > 0;
          });
          const allSegmentsValid = formData.segments.every(s => {
            if (s.city) {
              return s.city.name && s.startDate && s.endDate;
            } else {
              return s.destination.name || s.destination.country;
            }
          });
          return allSegmentsValid && allCountriesHaveCities;
        }
      case 4:
        if (formData.tripType === 'day-trip') {
          return formData.travelers >= 1;
        } else {
          const citySegments = formData.segments.filter(s => s.city);
          return citySegments.length > 0 && citySegments.every(s => 
            s.accommodations.every(acc => acc.name && acc.address && acc.checkIn && acc.checkOut)
          );
        }
      case 5:
        if (formData.tripType === 'day-trip') {
          return formData.interests.length > 0;
        } else {
          return formData.travelers >= 1;
        }
      case 6:
        if (formData.tripType === 'day-trip') {
          return true;
        } else {
          return formData.interests.length > 0;
        }
      case 7:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderWelcomeStep();
      case 2:
        return (
          <div className="space-y-6 md:space-y-8">
            <TripTypeSelector
              tripType={formData.tripType}
              onTripTypeChange={handleTripTypeChange}
            />
          </div>
        );
      case 3:
        if (formData.tripType === 'day-trip') {
          return renderDayTripDestinationStep();
        } else {
          return renderFullTripPlanningStep();
        }
      case 4:
        if (formData.tripType === 'day-trip') {
          return renderTravelersStep();
        } else {
          return renderAccommodationStep();
        }
      case 5:
        if (formData.tripType === 'day-trip') {
          return renderInterestsStep();
        } else {
          return renderTravelersStep();
        }
      case 6:
        if (formData.tripType === 'day-trip') {
          return renderBudgetStep();
        } else {
          return renderInterestsStep();
        }
      case 7:
        return renderBudgetStep();
      default:
        return null;
    }
  };

  const renderWelcomeStep = () => (
    <div className="space-y-8 md:space-y-12 text-center">
      <div className="flex justify-center mb-8">
        <div className="w-24 h-24 md:w-32 md:h-32 bg-primary/10 rounded-full flex items-center justify-center">
          <div className="text-4xl md:text-5xl">✈️</div>
        </div>
      </div>
      <div className="space-y-4 md:space-y-6">
        <h1 className="text-3xl md:text-5xl font-bold text-primary mb-4">
          Welcome to TravelBuddy
        </h1>
        <p className="text-xl md:text-2xl text-main-secondary leading-relaxed max-w-2xl mx-auto">
          Your intelligent AI-powered travel companion
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
        <div className="p-6 rounded-2xl bg-primary-container">
          <div className="text-3xl mb-3">🤖</div>
          <h3 className="font-bold text-lg mb-2 text-on-primary-container">AI-Powered Planning</h3>
          <p className="text-sm text-on-primary-container/80">
            Get personalized itineraries and activity recommendations tailored to your interests
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-secondary-container">
          <div className="text-3xl mb-3">🗺️</div>
          <h3 className="font-bold text-lg mb-2 text-on-secondary-container">Smart Discovery</h3>
          <p className="text-sm text-on-secondary-container/80">
            Discover hidden gems and local experiences in any destination worldwide
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-surface-container-high">
          <div className="text-3xl mb-3">🗣️</div>
          <h3 className="font-bold text-lg mb-2">Language Support</h3>
          <p className="text-sm text-main-secondary">
            Essential phrases and real-time translation for seamless communication
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-surface-container-high">
          <div className="text-3xl mb-3">🛠️</div>
          <h3 className="font-bold text-lg mb-2">Travel Tools</h3>
          <p className="text-sm text-main-secondary">
            Weather updates, currency conversion, and emergency contacts all in one place
          </p>
        </div>
      </div>
      <div className="p-6 md:p-8 bg-primary-container rounded-2xl max-w-2xl mx-auto">
        <h3 className="font-bold text-xl mb-3 text-on-primary-container">Let's Plan Your Perfect Adventure!</h3>
        <p className="text-on-primary-container/80 leading-relaxed">
          Whether you're planning a full trip or just exploring a new city for the day, 
          we'll create a personalized guide with activities, language support, and essential tools. 
          Ready to start your adventure?
        </p>
      </div>
    </div>
  );

  const renderDayTripDestinationStep = () => (
    <div className="space-y-6 md:space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <MapPin className="h-8 w-8 md:h-10 md:w-10 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3">Where would you like to explore?</h2>
        <p className="text-main-secondary text-base md:text-lg">Choose a destination for your day trip adventure</p>
      </div>
      <div className="space-y-4 md:space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2 md:mb-3">Destination</label>
          <PlacesAutocomplete
            key={`day-trip-${formData.dayTripDestination?.name || ''}`}
            onPlaceSelect={handleDayTripPlaceSelect}
            placeholder="Search for cities, countries, or regions..."
            value={formData.dayTripDestination?.name || ''}
            types={['(regions)']}
          />
          {formData.dayTripDestination && (
            <div className="mt-3 p-3 bg-primary-container rounded-xl">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <span className="text-on-primary-container font-medium">
                  {formData.dayTripDestination.name}, {formData.dayTripDestination.country}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 bg-secondary-container rounded-xl">
          <h4 className="font-semibold text-on-secondary-container mb-2">🎯 Perfect for Day Trips</h4>
          <ul className="text-sm text-on-secondary-container/80 space-y-1">
            <li>• Discover local attractions and hidden gems</li>
            <li>• Get personalized activity recommendations</li>
            <li>• Access essential travel information</li>
            <li>• No complex planning required</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderFullTripPlanningStep = () => (
    <div className="space-y-6 md:space-y-8">
      <MultiCityPlannerStep
        segments={formData.segments}
        onSegmentsChange={(segments) => setFormData({ ...formData, segments })}
        tripType="multi-country"
      />
    </div>
  );

  const renderTravelersStep = () => (
    <div className="space-y-6 md:space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <Users className="h-8 w-8 md:h-10 md:w-10 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3">How many travelers?</h2>
        <p className="text-main-secondary text-base md:text-lg">This helps us suggest appropriate group activities and accommodations</p>
      </div>
      <div className="max-w-md mx-auto">
        <div className="space-y-4">
          <div className="text-center">
            <label className="block text-sm font-medium mb-3">Number of Travelers</label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setFormData({ ...formData, travelers: Math.max(1, formData.travelers - 1) })}
                className="w-12 h-12 rounded-full border-2 border-outline hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center text-xl font-bold"
                disabled={formData.travelers <= 1}
              >
                -
              </button>
              <div className="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center text-2xl font-bold">
                {formData.travelers}
              </div>
              <button
                onClick={() => setFormData({ ...formData, travelers: Math.min(20, formData.travelers + 1) })}
                className="w-12 h-12 rounded-full border-2 border-outline hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center text-xl font-bold"
                disabled={formData.travelers >= 20}
              >
                +
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-6">
            {[1, 2, 4, 6].map((count) => (
              <button
                key={count}
                onClick={() => setFormData({ ...formData, travelers: count })}
                className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-105 ${
                  formData.travelers === count
                    ? 'bg-primary text-on-primary border-primary shadow-lg'
                    : 'bg-surface-container border-outline hover:border-primary hover:bg-primary/5'
                }`}
              >
                <div className="text-2xl font-bold">{count}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 p-4 bg-primary-container rounded-xl">
          <p className="text-sm text-on-primary-container text-center">
            💡 <strong>Perfect for {formData.travelers} {formData.travelers === 1 ? 'traveler' : 'travelers'}!</strong> 
            We'll suggest activities and accommodations that work great for your group size.
          </p>
        </div>
      </div>
    </div>
  );

  const renderAccommodationStep = () => {
    const citySegments = formData.segments
      .filter(segment => segment.city)
      .sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });

    return (
      <div className="space-y-6 md:space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
            <Plane className="h-8 w-8 md:h-10 md:w-10 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3">Accommodation Details</h2>
          <p className="text-main-secondary text-base md:text-lg">
            Add accommodation details for each city in your trip
          </p>
        </div>
        
        {citySegments.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-6 bg-error/10 border border-error/20 rounded-xl">
              <h3 className="font-semibold text-error mb-2">⚠️ No Cities Added</h3>
              <p className="text-error text-sm">
                You need to add at least one city before setting up accommodations.
              </p>
              <button
                onClick={() => setCurrentStep(3)}
                className="mt-3 px-4 py-2 bg-error text-white rounded-xl text-sm font-medium hover:bg-error/90 transition-colors"
              >
                Go Back to Add Cities
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {citySegments.map((segment, cityIndex) => {
              const originalSegmentIndex = formData.segments.findIndex(s => s.id === segment.id);
              const displayName = `${segment.city!.name}, ${segment.destination.country}`;
              
              return (
                <div key={segment.id} className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center text-sm font-bold">
                      {cityIndex + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-lg">{displayName}</h3>
                      {/* ================================================================= */}
                      {/* FIX START: Use the new helper function for reliable date display */}
                      {/* ================================================================= */}
                      <p className="text-sm text-main-secondary">
                        {segment.startDate && segment.endDate && (
                          <>
                            {formatDate(segment.startDate)} - {formatDate(segment.endDate)}
                          </>
                        )}
                      </p>
                      {/* ================================================================= */}
                      {/* FIX END */}
                      {/* ================================================================= */}
                    </div>
                  </div>
                  
                  <AccommodationInput
                    accommodations={segment.accommodations}
                    onAccommodationsChange={(accommodations) => {
                      const updated = [...formData.segments];
                      updated[originalSegmentIndex] = { ...updated[originalSegmentIndex], accommodations };
                      setFormData({ ...formData, segments: updated });
                    }}
                    hideStayDuration={true}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderInterestsStep = () => (
    <div className="space-y-6 md:space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <Heart className="h-8 w-8 md:h-10 md:w-10 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3">What interests you?</h2>
        <p className="text-main-secondary text-base md:text-lg">Select activities and experiences you enjoy</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {interestOptions.map((interest) => (
          <button
            key={interest.id}
            onClick={() => toggleInterest(interest.label)}
            className={`p-3 md:p-4 rounded-2xl border-2 text-center transition-all hover:scale-105 ${
              formData.interests.includes(interest.label)
                ? 'bg-primary border-primary shadow-lg'
                : 'bg-surface-container border-outline hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="text-2xl md:text-3xl mb-1 md:mb-2">{interest.icon}</div>
            <div className="text-xs md:text-sm font-medium">{interest.label}</div>
          </button>
        ))}
      </div>
      <div className="text-center p-3 md:p-4 bg-primary-container rounded-xl">
        <span className="text-on-primary-container font-medium">
          {formData.interests.length} {formData.interests.length === 1 ? 'interest' : 'interests'} selected
        </span>
      </div>
    </div>
  );

  const renderBudgetStep = () => (
    <div className="space-y-6 md:space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <DollarSign className="h-8 w-8 md:h-10 md:w-10 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3">What's your budget style?</h2>
        <p className="text-main-secondary text-base md:text-lg">This helps us suggest appropriate activities and dining</p>
      </div>
      <div className="space-y-3 md:space-y-4">
        {[
          { value: 'budget', label: 'Budget-Friendly', desc: 'Free activities, local eateries, public transport', icon: '💰' },
          { value: 'mid-range', label: 'Mid-Range', desc: 'Mix of paid attractions, nice restaurants, some tours', icon: '💳' },
          { value: 'luxury', label: 'Luxury', desc: 'Premium experiences, fine dining, private tours', icon: '💎' }
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFormData({ ...formData, budget: option.value as any })}
            className={`w-full p-4 md:p-6 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] ${
              formData.budget === option.value
                ? 'bg-primary border-primary shadow-lg'
                : 'bg-surface-container border-outline hover:border-primary hover:bg-primary/5'
            }`}
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className="text-2xl md:text-3xl">{option.icon}</div>
              <div>
                <div className="font-bold text-base md:text-lg">{option.label}</div>
                <div className="text-sm text-main-secondary">{option.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const getProgressPercentage = () => {
    if (currentStep === 1) return 0;
    return ((currentStep - 1) / (totalSteps - 1)) * 100;
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-[16px] md:p-4" style={{ paddingTop: '6rem' }}>
        <div className="w-full max-w-4xl">
          <div className="mb-8 md:mb-12">
            <div className="flex justify-between items-center mb-3 md:mb-4">
              <span className="text-sm font-medium text-text-secondary">
                Step {currentStep === 1 ? 0 : currentStep - 1} of {totalSteps - 1}
              </span>
              <span className="text-sm font-medium text-text-secondary">
                {Math.round(getProgressPercentage())}%
              </span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-2 md:h-3 overflow-hidden">
              <div 
                className="progress-bar h-2 md:h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(getProgressPercentage(), 95)}%` }}
              />
            </div>
          </div>
          <div className="mb-6 md:mb-8 min-h-[400px] md:min-h-[500px] flex flex-col justify-center">
            {renderStep()}
          </div>
          <div className="flex justify-between items-center gap-3 md:gap-0">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 border-outline text-text-primary hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 disabled:hover:scale-100"
            >
              <ArrowLeft size={18} />
              <span className="font-medium text-sm md:text-base">Previous</span>
            </button>
            {currentStep === totalSteps ? (
              <button
                onClick={handleComplete}
                disabled={!canProceed()}
                className="action-button flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 shadow-lg text-sm md:text-base"
              >
                <Sparkles size={18} />
                <span className="font-medium">Create My Guide</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="action-button flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 shadow-lg text-sm md:text-base"
              >
                <span className="font-medium">Next</span>
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;