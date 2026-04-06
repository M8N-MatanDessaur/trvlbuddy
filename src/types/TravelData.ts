export interface Destination {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  currency: string;
  languages: string[];
  emergencyNumber: string;
  timezone: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  // New field to support cities within countries
  cities?: City[];
}

export interface City {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  countryId: string; // Reference to parent country
}

export interface Accommodation {
  id: string;
  name: string;
  address: string;
  checkIn: string;
  checkOut: string;
  destinationId?: string; // Link to which destination this accommodation belongs to
  cityId?: string; // Link to which city this accommodation belongs to
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface TripSegment {
  id: string;
  destination: Destination;
  city?: City; // Optional city within the destination
  startDate: string;
  endDate: string;
  accommodations: Accommodation[];
  transportationToNext?: {
    method: 'flight' | 'train' | 'bus' | 'car' | 'ferry';
    duration: string;
    notes?: string;
  };
}

export interface TravelPlan {
  id: string;
  title: string;
  tripType: 'full-trip' | 'day-trip'; // Updated trip types
  destinations: Destination[]; // All destinations in the trip
  segments: TripSegment[]; // Ordered segments of the trip
  startDate: string; // Overall trip start
  endDate: string; // Overall trip end
  travelers: number;
  interests: string[];
  budget: 'budget' | 'mid-range' | 'luxury';
  createdAt: string;
  
  // Legacy support for single destination trips
  destination?: Destination;
  accommodations?: Accommodation[];
}

export interface GeneratedActivity {
  name: string;
  category: string;
  description: string;
  estimatedCost: string;
  duration: string;
  bestTime: string;
  location: string;
  tips: string;
  difficulty?: 'easy' | 'moderate' | 'challenging';
  destinationId?: string; // Which destination this activity belongs to
  cityId?: string; // Which city this activity belongs to (for multi-city countries)
}

export interface EmergencyContact {
  name: string;
  number: string;
  description: string;
  type: 'emergency' | 'police' | 'medical' | 'fire' | 'tourist';
  destinationId?: string; // Which destination this contact is for
  cityId?: string; // Which city this contact is for
}

export interface Translation {
  english: string;
  local: string;
  pronunciation: string;
  category: string;
  destinationId?: string; // Which destination/language this translation is for
  cityId?: string; // Which city this translation is for
}