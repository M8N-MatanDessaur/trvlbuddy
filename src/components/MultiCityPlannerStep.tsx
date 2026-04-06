import React, { useState } from 'react';
import { Plus, Trash2, MapPin, ArrowRight, ChevronRight } from 'lucide-react';
import { TripSegment, Destination, City } from '../types/TravelData';
import PlacesAutocomplete from './PlacesAutocomplete';
import MUIDateRangePicker from './MUIDateRangePicker';
import MUIDatePicker from './MUIDatePicker';

// =================================================================
// FIX START: Add reliable, timezone-safe date helper functions
// =================================================================

/**
 * Converts a Date object to a 'YYYY-MM-DD' string, respecting the local date.
 * This avoids timezone conversion errors that occur with toISOString().
 * USE THIS WHEN SAVING A DATE OBJECT TO THE STATE.
 * @param date The Date object to format. Can be null.
 * @returns The formatted date string (e.g., "2025-09-14") or an empty string.
 */
const formatDateToYyyyMmDd = (date: Date | null): string => {
  if (!date || isNaN(date.getTime())) return ''; // Check for null or invalid date
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() is 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a 'YYYY-MM-DD' string for display (e.g., DD/MM/YYYY) without timezone issues.
 * It parses the date as UTC and formats it using UTC methods.
 * USE THIS WHEN DISPLAYING A DATE STRING FROM THE STATE.
 * @param dateString The date string to format (e.g., "2025-09-14"). Can be null/undefined.
 * @returns The formatted date string for display (e.g., "14/09/2025") or an empty string.
 */
const formatDateForDisplay = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  // Appending 'T00:00:00Z' ensures the string is parsed as UTC midnight,
  // preventing the browser's local timezone from shifting the date.
  const date = new Date(`${dateString}T00:00:00Z`);
  if (isNaN(date.getTime())) return ''; // Check for invalid date

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

// Helper to create a Date object from a YYYY-MM-DD string for date pickers
const createDateFromString = (dateString?: string | null): Date | null => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
}

// =================================================================
// FIX END
// =================================================================


interface MultiCityPlannerStepProps {
  segments: TripSegment[];
  onSegmentsChange: (segments: TripSegment[]) => void;
  tripType: 'single-destination' | 'multi-city' | 'multi-country';
}

const MultiCityPlannerStep: React.FC<MultiCityPlannerStepProps> = ({
  segments,
  onSegmentsChange,
}) => {
  const [expandedSegment, setExpandedSegment] = useState<string | null>(segments[0]?.id || null);

  const addCountrySegment = () => {
    const newCountrySegment: TripSegment = {
      id: `segment_${Date.now()}_country`,
      destination: { id: `dest_${Date.now()}`, name: '', country: '', countryCode: '', currency: '', languages: [], emergencyNumber: '', timezone: '', coordinates: { lat: 0, lng: 0 }, cities: [] },
      startDate: '', endDate: '', accommodations: []
    };
    onSegmentsChange([...segments, newCountrySegment]);
    setExpandedSegment(newCountrySegment.id);
  };

  const addCityToCountry = (countryId: string) => {
    const countryIndex = segments.findIndex(s => s.destination.id === countryId);
    if (countryIndex === -1) return;

    const allCitySegments = segments.filter(s => s.city && s.startDate && s.endDate);
    let newStartDateString = formatDateToYyyyMmDd(new Date()); // Default to today for the very first city

    if (allCitySegments.length > 0) {
      // CRITICAL FIX: Use the same end date as the start date (no adding one day)
      const sortedCities = allCitySegments.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
      const lastEndDate = sortedCities[0].endDate;
      if (lastEndDate) {
        // Start the new city on the SAME date as the previous city ends
        newStartDateString = lastEndDate;
        console.log(`Previous city ended: ${lastEndDate}, new city starts: ${newStartDateString}`);
      }
    }

    const countrySegment = segments[countryIndex];
    const newCity: City = { id: `city_${Date.now()}`, name: '', coordinates: { lat: 0, lng: 0 }, countryId: countrySegment.destination.id };
    const newCitySegment: TripSegment = {
      id: `segment_${Date.now()}_city`,
      destination: countrySegment.destination,
      city: newCity,
      startDate: newStartDateString,
      endDate: '',
      accommodations: [{ id: `acc_${Date.now()}`, name: '', address: '', checkIn: newStartDateString, checkOut: '', destinationId: countrySegment.destination.id, cityId: newCity.id }]
    };

    const updated = [...segments, newCitySegment];
    onSegmentsChange(updated);
    setExpandedSegment(newCitySegment.id);
  };

  const removeSegment = (segmentId: string) => {
    const segmentToRemove = segments.find(s => s.id === segmentId);
    if (!segmentToRemove) return;

    let updatedSegments: TripSegment[];
    if (!segmentToRemove.city) { // It's a country segment
      updatedSegments = segments.filter(s => s.destination.id !== segmentToRemove.destination.id);
    } else { // It's a city segment
      updatedSegments = segments.filter(s => s.id !== segmentId);
    }
    onSegmentsChange(updatedSegments);
    if (expandedSegment === segmentId) setExpandedSegment(null);
  };

  const updateSegmentData = (segmentId: string, updates: Partial<TripSegment>) => {
    const updated = segments.map(s => s.id === segmentId ? { ...s, ...updates } : s);
    onSegmentsChange(updated);
  };

  const handleDestinationSelect = (segmentId: string, place: any) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;
    
    if (segment.city) { // It's a city
      const updatedCity = { ...segment.city, name: place.name || '', coordinates: place.coordinates || { lat: 0, lng: 0 } };
      updateSegmentData(segmentId, { city: updatedCity });
    } else { // It's a country
      const updatedDestination = { ...segment.destination, name: place.country || place.name || '', country: place.country || place.name || '', countryCode: place.countryCode || '' };
      // Also update this destination for all its cities
      const updated = segments.map(s => s.destination.id === segment.destination.id ? {...s, destination: updatedDestination} : s);
      onSegmentsChange(updated);
    }
  };

  const handleDatesChange = (segmentId: string, startDate: string, endDate: string) => {
    const accommodations = segments.find(s => s.id === segmentId)?.accommodations.map(acc => ({ ...acc, checkIn: startDate, checkOut: endDate })) || [];
    updateSegmentData(segmentId, { startDate, endDate, accommodations });
  };
  
  const handleEndDateChange = (segmentId: string, date: string) => {
    const accommodations = segments.find(s => s.id === segmentId)?.accommodations.map(acc => ({ ...acc, checkOut: date })) || [];
    updateSegmentData(segmentId, { endDate: date, accommodations });
  };
  
  const getCountrySegments = () => segments.filter(s => !s.city);
  const getCitySegmentsForCountry = (countryId: string) => segments.filter(s => s.city && s.destination.id === countryId).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const isFirstCityInTrip = (segmentId: string) => {
      const allCitySegments = segments.filter(s => s.city && s.startDate).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      return allCitySegments.length > 0 && allCitySegments[0].id === segmentId;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold">🗺️ Plan Your Trip</h3>
        <p className="text-main-secondary">Add countries and cities to build your itinerary.</p>
      </div>

      {getCountrySegments().map(countrySegment => {
        const citySegments = getCitySegmentsForCountry(countrySegment.destination.id);
        const hasValidationError = citySegments.length === 0 && countrySegment.destination.name;

        return (
          <div key={countrySegment.id} className={`p-4 border rounded-2xl space-y-4 ${hasValidationError ? 'border-error' : 'border-outline'} bg-surface-container`}>
            {/* Country Header & Input */}
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-3 px-2 py-1">Country</label>
                    <PlacesAutocomplete
                      key={countrySegment.id}
                      onPlaceSelect={(place) => handleDestinationSelect(countrySegment.id, place)}
                      value={countrySegment.destination.name}
                      types={['country']}
                      placeholder="e.g. Italy"
                    />
                </div>
                <button onClick={() => removeSegment(countrySegment.id)} className="ml-4 p-2 text-error hover:bg-error/10 rounded-full self-end"><Trash2 size={18} /></button>
            </div>
            
            {/* Cities List */}
            <div className="space-y-3 pl-2">
              {citySegments.map(citySegment => {
                 const isExpanded = expandedSegment === citySegment.id;

                 return (
                  <div key={citySegment.id} className="bg-surface-container-high rounded-xl border border-outline-variant">
                    <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setExpandedSegment(isExpanded ? null : citySegment.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">🏙️</span>
                        <div>
                          <p className="font-medium">{citySegment.city?.name || 'New City'}</p>
                          <p className="text-xs text-main-secondary">
                            {formatDateForDisplay(citySegment.startDate)} - {formatDateForDisplay(citySegment.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <button onClick={(e) => { e.stopPropagation(); removeSegment(citySegment.id);}} className="p-1.5 text-error hover:bg-error/10 rounded-full"><Trash2 size={16} /></button>
                        <ChevronRight size={20} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-4 border-t border-outline-variant space-y-4">
                        <PlacesAutocomplete
                            key={`${citySegment.id}-autocomplete`}
                            onPlaceSelect={(place) => handleDestinationSelect(citySegment.id, place)}
                            value={citySegment.city?.name || ''}
                            types={['(cities)']}
                            placeholder="e.g. Rome"
                          />

                        {isFirstCityInTrip(citySegment.id) ? (
                          <MUIDateRangePicker
                            startDate={citySegment.startDate}
                            endDate={citySegment.endDate}
                            onStartDateChange={(startDate) => handleDatesChange(citySegment.id, startDate, citySegment.endDate)}
                            onEndDateChange={(endDate) => handleDatesChange(citySegment.id, citySegment.startDate, endDate)}
                            minDate={formatDateToYyyyMmDd(new Date())}
                          />
                        ) : (
                          <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-main-secondary">Start Date (auto-filled from previous city)</label>
                                <p className="p-3 border rounded-lg bg-surface-container">{formatDateForDisplay(citySegment.startDate)}</p>
                            </div>
                            <MUIDatePicker
                                value={citySegment.endDate}
                                onChange={(date) => handleEndDateChange(citySegment.id, date)}
                                minDate={citySegment.startDate}
                                label="End Date"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                 )
              })}
               <button onClick={() => addCityToCountry(countrySegment.destination.id)} className="w-full mt-2 text-sm flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-outline rounded-lg hover:bg-primary/10 hover:border-primary">
                    <Plus size={16} /> Add City
                </button>
            </div>
          </div>
        );
      })}

      <button onClick={addCountrySegment} className="w-full p-4 border-2 border-dashed border-outline rounded-xl hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-3">
        <Plus size={20} /> <span className="font-medium">Add A Destination</span>
      </button>
    </div>
  );
};

export default MultiCityPlannerStep;