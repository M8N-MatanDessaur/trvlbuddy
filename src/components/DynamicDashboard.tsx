import React from 'react';
import { useTravel } from '../contexts/TravelContext';
import { MapPin, Calendar, Users, Plane, Train, Car, Ship, Bus, Map, Navigation, Phone, Globe } from 'lucide-react';

interface DynamicDashboardProps {
  onPlannerClick: () => void;
}

const DynamicDashboard: React.FC<DynamicDashboardProps> = ({ onPlannerClick }) => {
  const { currentPlan } = useTravel();

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="mb-4">Welcome to Your Travel Companion!</h2>
          <p className="leading-relaxed text-main-secondary text-lg">
            It looks like you haven't set up your trip yet. Please complete the onboarding to get started.
          </p>
        </div>
      </section>
    );
  }

  // CRITICAL FIX: Proper date formatting that matches the date picker exactly
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      // Parse the YYYY-MM-DD string directly without timezone conversion
      const [year, month, day] = dateString.split('-').map(Number);
      
      // Validate the parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day) || 
          month < 1 || month > 12 || day < 1 || day > 31) {
        console.error('Invalid date components:', { year, month, day, original: dateString });
        return 'Invalid date';
      }
      
      // Create date object with local timezone (month is 0-indexed)
      // This ensures the date displays exactly as selected
      const date = new Date(year, month - 1, day);
      
      // Double-check the date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date object created from:', dateString);
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'for date:', dateString);
      return 'Invalid date';
    }
  };

  // CRITICAL FIX: Short date format for accordion headers (DD/MM/YYYY)
  const formatDateShort = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      // Parse the YYYY-MM-DD string directly without timezone conversion
      const [year, month, day] = dateString.split('-').map(Number);
      
      // Validate the parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day) || 
          month < 1 || month > 12 || day < 1 || day > 31) {
        console.error('Invalid date components:', { year, month, day, original: dateString });
        return 'Invalid date';
      }
      
      // Create date object with local timezone (month is 0-indexed)
      // This ensures the date displays exactly as selected
      const date = new Date(year, month - 1, day);
      
      // Double-check the date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date object created from:', dateString);
        return 'Invalid date';
      }
      
      // Format as DD/MM/YYYY to match the accordion display
      const formattedDay = String(date.getDate()).padStart(2, '0');
      const formattedMonth = String(date.getMonth() + 1).padStart(2, '0');
      const formattedYear = date.getFullYear();
      
      return `${formattedDay}/${formattedMonth}/${formattedYear}`;
    } catch (error) {
      console.error('Date formatting error:', error, 'for date:', dateString);
      return 'Invalid date';
    }
  };

  const getTripDuration = () => {
    // For day trips, always return 1
    if (currentPlan.tripType === 'day-trip') {
      return 1;
    }

    // For full trips, calculate total duration from first to last segment
    const segments = currentPlan.segments || [];
    const citySegments = segments.filter(s => s.city && s.startDate && s.endDate);
    
    if (citySegments.length === 0) {
      return 0;
    }

    // Sort segments by start date to ensure proper chronological order
    const sortedSegments = [...citySegments].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    try {
      // Get the earliest start date and latest end date
      const firstSegment = sortedSegments[0];
      const lastSegment = sortedSegments[sortedSegments.length - 1];
      
      // Parse dates correctly without timezone issues - SAME METHOD AS formatDate
      const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      
      const startDate = parseLocalDate(firstSegment.startDate);
      const endDate = parseLocalDate(lastSegment.endDate);
      
      // Check if dates are valid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid dates found:', firstSegment.startDate, lastSegment.endDate);
        return 0;
      }
      
      // Calculate total duration in days (including both start and end days)
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
      
      console.log('Trip duration calculation:', {
        firstStart: firstSegment.startDate,
        lastEnd: lastSegment.endDate,
        startDate: startDate.toDateString(),
        endDate: endDate.toDateString(),
        diffTime,
        diffDays
      });
      
      // Ensure we return a positive number
      return Math.max(diffDays, 1);
    } catch (error) {
      console.error('Error calculating trip duration:', error);
      return 0;
    }
  };

  const getTransportationIcon = (method?: string) => {
    switch (method) {
      case 'flight': return Plane;
      case 'train': return Train;
      case 'car': return Car;
      case 'ferry': return Ship;
      case 'bus': return Bus;
      default: return Plane;
    }
  };

  // Helper function to open location in maps - ONLY use address
  const openInMaps = (address: string) => {
    const query = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  // Helper function to get directions - ONLY use address
  const getDirections = (address: string) => {
    const query = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
  };

  // Get display segments - PROPERLY SORTED BY START DATE
  const getDisplaySegments = () => {
    if (!currentPlan.segments) return [];
    
    if (currentPlan.tripType === 'full-trip') {
      // CRITICAL FIX: Only show city segments and sort by start date chronologically
      const citySegments = currentPlan.segments.filter(segment => segment.city && segment.startDate);
      return citySegments.sort((a, b) => {
        // Parse dates using the same method to ensure consistency
        const parseLocalDate = (dateStr: string) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        
        const dateA = parseLocalDate(a.startDate).getTime();
        const dateB = parseLocalDate(b.startDate).getTime();
        return dateA - dateB; // Ascending order (earliest first)
      });
    } else {
      // For day trips, show all segments
      return currentPlan.segments;
    }
  };

  const getSegmentDisplayName = (segment: any) => {
    if (segment.city) {
      return `${segment.city.name}, ${segment.destination.country}`;
    }
    return segment.destination.name;
  };

  const renderTripOverview = () => {
    if (currentPlan.tripType === 'day-trip') {
      const destination = currentPlan.destination || currentPlan.destinations?.[0];
      
      return (
        <div className="space-y-6">
          {/* Day Trip Header */}
          <div className="text-center p-6 bg-primary-container rounded-2xl">
            <h3 className="text-xl font-bold text-on-primary-container mb-2">
              📍 {destination?.name}
            </h3>
            <p className="text-on-primary-container/80">
              {destination?.country} • {currentPlan.travelers} travelers • 1 day
            </p>
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-secondary-container rounded-xl">
              <div className="text-center">
                <Globe size={20} className="text-secondary mx-auto mb-2" />
                <div className="text-sm font-medium text-on-secondary-container">Language</div>
                <div className="text-xs text-on-secondary-container/80">
                  {destination?.languages?.join(', ') || 'Local'}
                </div>
              </div>
            </div>
            <div className="p-4 bg-surface-container-high rounded-xl">
              <div className="text-center">
                <span className="text-xl mb-2 block">💰</span>
                <div className="text-sm font-medium text-text-primary">Currency</div>
                <div className="text-xs text-text-secondary">
                  {destination?.currency || 'Local'}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      // Full trip - show properly sorted segments
      const displaySegments = getDisplaySegments();
      const totalDuration = getTripDuration();
      
      console.log('Dashboard segments order:', displaySegments.map(s => ({
        name: getSegmentDisplayName(s),
        startDate: s.startDate,
        endDate: s.endDate,
        formattedStart: formatDate(s.startDate),
        formattedEnd: formatDate(s.endDate),
        formattedShortStart: formatDateShort(s.startDate),
        formattedShortEnd: formatDateShort(s.endDate)
      })));
      
      return (
        <div className="space-y-6">
          {/* Trip Summary */}
          <div className="text-center p-6 bg-primary-container rounded-2xl">
            <h3 className="text-xl font-bold text-on-primary-container mb-2">
              🗺️ Your Journey
            </h3>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-on-primary-container">{displaySegments.length}</div>
                <div className="text-xs text-on-primary-container/80">Cities</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-on-primary-container">{totalDuration}</div>
                <div className="text-xs text-on-primary-container/80">Days</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-on-primary-container">{currentPlan.travelers}</div>
                <div className="text-xs text-on-primary-container/80">Travelers</div>
              </div>
            </div>
          </div>

          {/* Cities List - NOW PROPERLY SORTED BY START DATE */}
          <div className="space-y-4">
            {displaySegments.map((segment, index) => {
              const displayName = getSegmentDisplayName(segment);
              
              return (
                <div key={segment.id} className="bg-surface-container rounded-2xl p-4 border border-outline">
                  {/* City Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{displayName}</h4>
                      <div className="flex items-center gap-2 text-sm text-main-secondary">
                        <Calendar size={12} />
                        {/* CRITICAL FIX: Use formatDateShort for accordion header display */}
                        <span>{formatDateShort(segment.startDate)} - {formatDateShort(segment.endDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Info Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 bg-primary-container rounded-xl">
                      <Globe size={14} className="text-primary mx-auto mb-1" />
                      <div className="text-xs font-medium text-on-primary-container">Language</div>
                      <div className="text-xs text-on-primary-container/80 truncate">
                        {segment.destination.languages?.[0] || 'Local'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-secondary-container rounded-xl">
                      <span className="text-sm mb-1 block">💰</span>
                      <div className="text-xs font-medium text-on-secondary-container">Currency</div>
                      <div className="text-xs text-on-secondary-container/80">
                        {segment.destination.currency || 'Local'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-surface-container-high rounded-xl">
                      <Phone size={14} className="text-primary mx-auto mb-1" />
                      <div className="text-xs font-medium text-text-primary">Emergency</div>
                      <div className="text-xs text-text-secondary">
                        {segment.destination.emergencyNumber || '112'}
                      </div>
                    </div>
                  </div>

                  {/* Accommodations */}
                  {segment.accommodations && segment.accommodations.length > 0 && (
                    <div>
                      <h5 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                        🏨 Accommodations ({segment.accommodations.length})
                      </h5>
                      <div className="space-y-3">
                        {segment.accommodations.map((accommodation, accIndex) => (
                          <div key={accommodation.id} className="p-3 rounded-xl bg-surface-container-high border border-outline">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <h6 className="font-semibold text-text-primary mb-1 text-sm">
                                  {accommodation.name || `Accommodation ${accIndex + 1}`}
                                </h6>
                                <div className="flex items-start gap-2 mb-2">
                                  <MapPin size={12} className="text-primary flex-shrink-0 mt-0.5" />
                                  <span className="text-xs text-text-secondary leading-relaxed">
                                    {accommodation.address || 'Address not specified'}
                                  </span>
                                </div>
                                {accommodation.checkIn && accommodation.checkOut && (
                                  <div className="flex items-center gap-2 text-xs text-main-secondary">
                                    <Calendar size={10} />
                                    {/* CRITICAL FIX: Use formatDateShort for accommodation dates too */}
                                    <span>
                                      {formatDateShort(accommodation.checkIn)} - {formatDateShort(accommodation.checkOut)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Action Buttons */}
                              {accommodation.address && (
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => openInMaps(accommodation.address)}
                                    className="p-2 rounded-full hover:bg-primary/20 transition-colors"
                                    title="View on map"
                                  >
                                    <Map size={14} className="text-primary" />
                                  </button>
                                  <button
                                    onClick={() => getDirections(accommodation.address)}
                                    className="p-2 rounded-full hover:bg-secondary/20 transition-colors"
                                    title="Get directions"
                                  >
                                    <Navigation size={14} className="text-secondary" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transportation to Next */}
                  {index < displaySegments.length - 1 && segment.transportationToNext && (
                    <div className="mt-4 pt-4 border-t border-outline">
                      <div className="flex items-center justify-center gap-2 p-3 bg-secondary-container rounded-xl">
                        {React.createElement(getTransportationIcon(segment.transportationToNext.method), { 
                          size: 16, 
                          className: "text-secondary" 
                        })}
                        <div className="text-center">
                          <div className="text-sm font-medium text-on-secondary-container">
                            {segment.transportationToNext.method}
                          </div>
                          {segment.transportationToNext.duration && (
                            <div className="text-xs text-on-secondary-container/70">
                              {segment.transportationToNext.duration}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <section className="page">
      {/* Main title */}
      <div className="text-center max-w-4xl mx-auto mb-8">
        <h1 className="mb-2 text-primary-color text-3xl sm:text-4xl lg:text-5xl">
          {currentPlan.title || 'Your Travel Discovery'}
        </h1>
        <p className="text-lg sm:text-xl text-main-secondary mb-6">
          {currentPlan.tripType === 'day-trip' ? 'Your Day Trip Guide' : 'Your Personalized Travel Guide'}
        </p>
      </div>

      <div className="text-center max-w-3xl mx-auto mb-8">
        <h2 className="mb-4 text-xl sm:text-2xl">Welcome to your adventure!</h2>
        <p className="leading-relaxed text-main-secondary text-base sm:text-lg">
          {currentPlan.tripType === 'day-trip' 
            ? 'Your personalized day trip guide is ready. Explore activities, use the translator, and discover amazing local experiences!'
            : 'Your personalized travel guide is ready. Explore activities, use the translator, and try the ✨ AI Hub to create custom itineraries!'
          }
        </p>
      </div>
      
      {/* Trip Overview */}
      {renderTripOverview()}
    </section>
  );
};

export default DynamicDashboard;