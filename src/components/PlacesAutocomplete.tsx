import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

interface PlaceResult {
  name: string;
  country?: string;
  countryCode?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId: string;
  formatted_address?: string;
}

interface PlacesAutocompleteProps {
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  value?: string;
  className?: string;
  types?: string[];
  apiKey?: string;
}

const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  onPlaceSelect,
  placeholder = "Search for a destination...",
  value = "",
  className = "",
  types = ['(cities)'],
  apiKey = "AIzaSyB-QqGGN0wHjSHwpI2zh1FP9iq3Ex7UPF8"
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [isGoogleApiActive, setIsGoogleApiActive] = useState(false);

  // Popular destinations as fallback
  const popularDestinations: PlaceResult[] = [
    {
      name: "Paris",
      country: "France",
      countryCode: "FR",
      coordinates: { lat: 48.8566, lng: 2.3522 },
      placeId: "ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
      formatted_address: "Paris, France"
    },
    {
      name: "Rome",
      country: "Italy",
      countryCode: "IT",
      coordinates: { lat: 41.9028, lng: 12.4964 },
      placeId: "ChIJu46S-ZZhLxMROG5lkwZ3D7k",
      formatted_address: "Rome, Italy"
    },
    {
      name: "Barcelona",
      country: "Spain",
      countryCode: "ES",
      coordinates: { lat: 41.3851, lng: 2.1734 },
      placeId: "ChIJ5TCOcRaYpBIRCmZHTz37sEQ",
      formatted_address: "Barcelona, Spain"
    },
    {
      name: "Amsterdam",
      country: "Netherlands",
      countryCode: "NL",
      coordinates: { lat: 52.3676, lng: 4.9041 },
      placeId: "ChIJVXealLU_xkcRja_At0z9AGY",
      formatted_address: "Amsterdam, Netherlands"
    },
    {
      name: "Tokyo",
      country: "Japan",
      countryCode: "JP",
      coordinates: { lat: 35.6762, lng: 139.6503 },
      placeId: "ChIJ51cu8IcbXWARiRtXIothAS4",
      formatted_address: "Tokyo, Japan"
    },
    {
      name: "London",
      country: "United Kingdom",
      countryCode: "GB",
      coordinates: { lat: 51.5074, lng: -0.1278 },
      placeId: "ChIJdd4hrwug2EcRmSrV3Vo6llI",
      formatted_address: "London, United Kingdom"
    },
    {
      name: "New York",
      country: "United States",
      countryCode: "US",
      coordinates: { lat: 40.7128, lng: -74.0060 },
      placeId: "ChIJOwg_06VPwokRYv534QaPC8g",
      formatted_address: "New York, NY, USA"
    },
    {
      name: "Sydney",
      country: "Australia",
      countryCode: "AU",
      coordinates: { lat: -33.8688, lng: 151.2093 },
      placeId: "ChIJP3Sa8ziYEmsRUKgyFmh9AQM",
      formatted_address: "Sydney NSW, Australia"
    },
    {
      name: "Dubai",
      country: "United Arab Emirates",
      countryCode: "AE",
      coordinates: { lat: 25.2048, lng: 55.2708 },
      placeId: "ChIJRcbZaklDXz4RYlEphFBu5r0",
      formatted_address: "Dubai, United Arab Emirates"
    },
    {
      name: "Bangkok",
      country: "Thailand",
      countryCode: "TH",
      coordinates: { lat: 13.7563, lng: 100.5018 },
      placeId: "ChIJ2VHQVDJgHTERvCFzYBxNkwM",
      formatted_address: "Bangkok, Thailand"
    }
  ];

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const initializeAutocomplete = async () => {
      try {
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places"]
        });

        await loader.load();

        if (inputRef.current) {
          const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            types: types,
            fields: ['place_id', 'name', 'formatted_address', 'address_components', 'geometry']
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.geometry && place.formatted_address) {
              const country = place.address_components?.find(
                component => component.types.includes('country')
              );
              
              const placeResult: PlaceResult = {
                name: place.name || place.formatted_address,
                country: country?.long_name,
                countryCode: country?.short_name,
                coordinates: {
                  lat: place.geometry.location?.lat() || 0,
                  lng: place.geometry.location?.lng() || 0
                },
                placeId: place.place_id || '',
                formatted_address: place.formatted_address
              };
              
              setInputValue(place.formatted_address);
              setShowSuggestions(false);
              onPlaceSelect(placeResult);
            }
          });

          autocompleteRef.current = autocomplete;
          setApiError(false);
          setIsGoogleApiActive(true);
        }
      } catch (error) {
        console.warn('Google Places API not available, using fallback suggestions:', error);
        setApiError(true);
        setIsGoogleApiActive(false);
      }
    };

    initializeAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        try {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (error) {
          // Ignore cleanup errors when API is not available
        }
      }
    };
  }, [onPlaceSelect, types, apiKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Only show manual suggestions when Google API is not active
    if (!isGoogleApiActive && value.length > 0) {
      const filtered = popularDestinations.filter(dest =>
        dest.name.toLowerCase().includes(value.toLowerCase()) ||
        (dest.country && dest.country.toLowerCase().includes(value.toLowerCase()))
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else if (!isGoogleApiActive) {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (place: PlaceResult) => {
    setInputValue(place.formatted_address || place.name);
    setShowSuggestions(false);
    onPlaceSelect(place);
  };

  const handleFocus = () => {
    // Only show popular destinations when Google API is not available
    if (!isGoogleApiActive) {
      setSuggestions(popularDestinations);
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10" size={20} style={{ color: 'var(--text-secondary)' }} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-full pl-12 pr-12 py-4 rounded-xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary transition-all ${className}`}
          style={{ 
            backgroundColor: 'var(--surface-container)',
            color: 'var(--text-primary)',
            borderColor: 'var(--outline)'
          }}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin z-10" size={20} style={{ color: 'var(--primary)' }} />
        )}
        {apiError && (
          <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10" size={20} style={{ color: '#f59e0b' }} title="Using offline suggestions" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && !isGoogleApiActive && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto" style={{ backgroundColor: 'var(--surface-container)', border: '1px solid var(--outline)' }}>
          {apiError && (
            <div className="px-4 py-2 text-sm border-b flex items-center gap-2" style={{ color: '#f59e0b', backgroundColor: '#fef3c7', borderColor: 'var(--outline)' }}>
              <AlertCircle size={14} />
              Using offline suggestions - Google Maps API unavailable
            </div>
          )}
          {inputValue.length === 0 && (
            <div className="px-4 py-2 text-sm border-b" style={{ color: 'var(--text-secondary)', borderColor: 'var(--outline)' }}>
              Popular destinations
            </div>
          )}
          {suggestions.map((place, index) => (
            <button
              key={`${place.placeId}-${index}`}
              onClick={() => handleSuggestionClick(place)}
              className="w-full px-4 py-3 text-left hover:bg-surface-container-high transition-colors flex items-center gap-3 border-b border-outline last:border-b-0"
              style={{ borderColor: 'var(--outline)' }}
            >
              <MapPin size={16} style={{ color: 'var(--primary)' }} className="flex-shrink-0" />
              <div>
                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{place.name}</div>
                {place.country && (
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{place.country}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlacesAutocomplete;