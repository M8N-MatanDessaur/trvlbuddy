import { TravelPlan, GeneratedActivity, Translation, EmergencyContact, Destination, TripSegment, City } from '../types/TravelData';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

async function callGeminiAPI(prompt: string, useGrounding: boolean = false): Promise<string> {
  try {
    const requestBody: any = {
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    // Add grounding when requested for better accuracy with current data
    if (useGrounding) {
      requestBody.tools = [{ google_search: {} }];
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (result.candidates?.[0]?.content?.parts?.[0]) {
      return result.candidates[0].content.parts[0].text;
    } else {
      // Log the full error response from the API for better debugging
      console.error('Gemini API Error Response:', JSON.stringify(result, null, 2));
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

// Enhanced Google Places API search using Gemini AI for intelligent query formatting
async function searchRealPlacesWithGemini(
  userQuery: string,
  location: { lat: number; lng: number },
  radius: number = 10000,
  searchType: 'restaurant' | 'attraction' | 'shopping' | 'general' = 'general'
): Promise<any[]> {
  try {
    // Use Gemini AI to intelligently format the Google Places API request
    const geminiPrompt = `
You are an expert at creating Google Places API search queries. Given a user's search request, create the PERFECT search parameters.

User Query: "${userQuery}"
Search Type: ${searchType}
Location: ${location.lat}, ${location.lng}

CRITICAL INSTRUCTIONS:
1. For cuisine searches (like "Chinese food"), use the cuisine name as keyword (e.g., "chinese")
2. For specific items (like "vegan ice cream"), use the exact terms as keywords
3. Choose the most appropriate Google Places API type parameter
4. Create multiple search strategies for better coverage

Available Google Places API types:
- restaurant, cafe, bakery, bar, meal_takeaway, meal_delivery, food
- tourist_attraction, museum, park, church, art_gallery
- store, shopping_mall, clothing_store, jewelry_store
- establishment (general)

Return a JSON response with this EXACT structure:
{
  "searchStrategies": [
    {
      "type": "nearbysearch",
      "params": {
        "location": "${location.lat},${location.lng}",
        "radius": ${radius},
        "type": "restaurant",
        "keyword": "chinese",
        "opennow": true
      },
      "priority": "high"
    },
    {
      "type": "textsearch", 
      "params": {
        "query": "chinese restaurant near me",
        "location": "${location.lat},${location.lng}",
        "radius": ${radius},
        "opennow": true
      },
      "priority": "high"
    }
  ]
}

EXAMPLES:
- "Chinese food" → keyword: "chinese", type: "restaurant"
- "Vegan ice cream" → keyword: "vegan ice cream", type: "food"
- "Italian pizza" → keyword: "pizza", type: "restaurant"
- "Coffee shop" → keyword: "coffee", type: "cafe"
- "Museum" → keyword: "museum", type: "tourist_attraction"

Create 2-3 search strategies with different approaches. Return ONLY valid JSON.
`;

    const geminiResponse = await callGeminiAPI(geminiPrompt, true); // Enable grounding for search queries
    const cleanResponse = geminiResponse.replace(/```json\n?|\n?```/g, '').trim();
    
    let searchConfig;
    try {
      searchConfig = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response, using fallback:', parseError);
      // Fallback to manual search strategy
      return await searchRealPlacesFallback(userQuery, location, radius, searchType);
    }


    let allValidPlaces: any[] = [];

    // Execute each search strategy from Gemini
    for (const strategy of searchConfig.searchStrategies || []) {
      try {
        let url = '';
        
        if (strategy.type === 'nearbysearch') {
          const params = new URLSearchParams({
            ...strategy.params,
            key: GOOGLE_PLACES_API_KEY
          });
          url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
        } else if (strategy.type === 'textsearch') {
          const params = new URLSearchParams({
            ...strategy.params,
            key: GOOGLE_PLACES_API_KEY
          });
          url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const validPlaces = [];
          
          for (const place of data.results.slice(0, 8)) {
            // Skip permanently closed places
            if (place.permanently_closed || place.business_status === 'CLOSED_PERMANENTLY') {
              continue;
            }
            
            // Apply type filtering for restaurants
            if (searchType === 'restaurant') {
              const types = place.types || [];
              const excludedTypes = ['gas_station', 'convenience_store', 'grocery_store', 'supermarket', 'liquor_store'];
              const requiredTypes = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery', 'food'];
              
              const hasExcludedType = types.some((type: string) => excludedTypes.includes(type));
              const hasRequiredType = types.some((type: string) => requiredTypes.includes(type));
              
              if (hasExcludedType || !hasRequiredType) {
                continue;
              }
            }
            
            // Check if we already have this place
            if (allValidPlaces.some(p => p.place_id === place.place_id)) {
              continue;
            }
            
            // Get detailed information
            try {
              const details = await fetchPlaceDetails(place.place_id, location);
              if (details && details.business_status !== 'CLOSED_PERMANENTLY') {
                const enhancedPlace = {
                  place_id: place.place_id,
                  name: place.name,
                  formatted_address: details.address,
                  rating: place.rating,
                  price_level: place.price_level,
                  types: place.types,
                  is_open_now: details.isOpen,
                  opening_hours: details.openingHours,
                  formatted_phone_number: details.phoneNumber,
                  website: details.website,
                  current_status: details.isOpen ? 'Open now' : 'Closed now',
                  today_hours: getTodayHours(details.openingHours),
                  geometry: place.geometry,
                  photos: details.photos,
                  search_priority: strategy.priority
                };
                
                validPlaces.push(enhancedPlace);
              }
            } catch (detailError) {
              console.error('Error fetching details for place:', place.name, detailError);
              continue;
            }
          }
          
          allValidPlaces = [...allValidPlaces, ...validPlaces];
          
          // If we have enough high-priority results, stop searching
          if (strategy.priority === 'high' && allValidPlaces.length >= 5) {
            break;
          }
        }
      } catch (strategyError) {
        console.error('Search strategy failed:', strategyError);
        continue;
      }
    }
    
    // Remove duplicates and sort by: open now first, then by rating, then by search priority
    const uniquePlaces = allValidPlaces.filter((place, index, self) => 
      index === self.findIndex(p => p.place_id === place.place_id)
    );
    
    const sortedPlaces = uniquePlaces
      .sort((a, b) => {
        // First priority: open now
        if (a.is_open_now && !b.is_open_now) return -1;
        if (!a.is_open_now && b.is_open_now) return 1;
        
        // Second priority: search priority
        if (a.search_priority === 'high' && b.search_priority !== 'high') return -1;
        if (a.search_priority !== 'high' && b.search_priority === 'high') return 1;
        
        // Third priority: rating
        return (b.rating || 0) - (a.rating || 0);
      })
      .slice(0, 6);

    return sortedPlaces;
    
  } catch (error) {
    console.error('Gemini-enhanced search failed, using fallback:', error);
    return await searchRealPlacesFallback(userQuery, location, radius, searchType);
  }
}

// Fallback search function (your original working implementation)
async function searchRealPlacesFallback(
  query: string,
  location: { lat: number; lng: number },
  radius: number = 10000,
  searchType: 'restaurant' | 'attraction' | 'shopping' | 'general' = 'general'
): Promise<any[]> {
  try {
    let typeFilter = '';
    let excludedTypes: string[] = [];
    let requiredTypes: string[] = [];
    
    // Set up type filtering based on search type
    switch (searchType) {
      case 'restaurant':
        typeFilter = 'restaurant|cafe|bakery|bar|meal_takeaway|meal_delivery';
        excludedTypes = ['gas_station', 'convenience_store', 'grocery_store', 'supermarket', 'liquor_store'];
        requiredTypes = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery', 'food'];
        break;
      case 'attraction':
        typeFilter = 'tourist_attraction|museum|park|church|art_gallery';
        break;
      case 'shopping':
        typeFilter = 'store|shopping_mall|clothing_store|jewelry_store';
        break;
      default:
        break;
    }
    
    // Enhanced query processing for better cuisine search
    const processedQuery = enhanceSearchQuery(query, searchType);
    
    // Try multiple search strategies for better results
    const searchStrategies = [
      // Strategy 1: Keyword search with opennow=true
      {
        url: `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&keyword=${encodeURIComponent(processedQuery)}&opennow=true&key=${GOOGLE_PLACES_API_KEY}${typeFilter ? `&type=${typeFilter}` : ''}`,
        priority: 'high'
      },
      // Strategy 2: Text search for better cuisine matching
      {
        url: `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(processedQuery + ' near me')}&location=${location.lat},${location.lng}&radius=${radius}&opennow=true&key=${GOOGLE_PLACES_API_KEY}${typeFilter ? `&type=${typeFilter}` : ''}`,
        priority: 'high'
      }
    ];
    
    let allValidPlaces: any[] = [];
    
    for (const strategy of searchStrategies) {
      try {
        const response = await fetch(strategy.url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const validPlaces = [];
          
          for (const place of data.results.slice(0, 6)) {
            if (place.permanently_closed || place.business_status === 'CLOSED_PERMANENTLY') {
              continue;
            }
            
            if (searchType === 'restaurant') {
              const types = place.types || [];
              const hasExcludedType = types.some((type: string) => excludedTypes.includes(type));
              const hasRequiredType = types.some((type: string) => requiredTypes.includes(type));
              
              if (hasExcludedType || !hasRequiredType) {
                continue;
              }
            }
            
            if (allValidPlaces.some(p => p.place_id === place.place_id)) {
              continue;
            }
            
            try {
              const details = await fetchPlaceDetails(place.place_id, location);
              if (details && details.business_status !== 'CLOSED_PERMANENTLY') {
                const enhancedPlace = {
                  place_id: place.place_id,
                  name: place.name,
                  formatted_address: details.address,
                  rating: place.rating,
                  price_level: place.price_level,
                  types: place.types,
                  is_open_now: details.isOpen,
                  opening_hours: details.openingHours,
                  formatted_phone_number: details.phoneNumber,
                  website: details.website,
                  current_status: details.isOpen ? 'Open now' : 'Closed now',
                  today_hours: getTodayHours(details.openingHours),
                  geometry: place.geometry,
                  photos: details.photos,
                  search_priority: strategy.priority
                };
                
                validPlaces.push(enhancedPlace);
              }
            } catch (detailError) {
              console.error('Error fetching details for place:', place.name, detailError);
              continue;
            }
          }
          
          allValidPlaces = [...allValidPlaces, ...validPlaces];
          
          if (strategy.priority === 'high' && allValidPlaces.length >= 4) {
            break;
          }
        }
      } catch (strategyError) {
        console.error('Search strategy failed:', strategyError);
        continue;
      }
    }
    
    return allValidPlaces.slice(0, 6);
    
  } catch (error) {
    console.error('Fallback search failed:', error);
    return [];
  }
}

// Helper function to fetch detailed restaurant information
async function fetchPlaceDetails(placeId: string, userLocation: { lat: number; lng: number }) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,photos,price_level,rating,opening_hours,website,url,types,formatted_phone_number,business_status&key=${GOOGLE_PLACES_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Google API error: ${data.status}`);
    }

    const result = data.result;

    return {
      name: result.name || "Unknown Name",
      address: result.formatted_address || "No Address Available",
      rating: result.rating || "No Rating Available",
      priceLevel: result.price_level || "Not Specified",
      photos: result.photos
        ? result.photos.map(
            (photo: any) =>
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
          )
        : [],
      openingHours: result.opening_hours?.weekday_text || [],
      isOpen: result.opening_hours?.open_now || false,
      website: result.website || "No Website Available",
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${result.geometry?.location.lat},${result.geometry?.location.lng}`,
      types: result.types || [],
      location: result.geometry?.location || null,
      phoneNumber: result.formatted_phone_number || null,
      place_id: placeId,
      business_status: result.business_status || 'OPERATIONAL'
    };
  } catch (error) {
    console.error("Error fetching place details:", error);
    throw new Error("Failed to fetch place details.");
  }
}

// Enhanced query processing for better cuisine and food search
function enhanceSearchQuery(query: string, searchType: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Cuisine mapping for better search results
  const cuisineMap: { [key: string]: string[] } = {
    'chinese': ['chinese restaurant', 'chinese food', 'dim sum', 'szechuan', 'cantonese'],
    'italian': ['italian restaurant', 'pizza', 'pasta', 'trattoria', 'pizzeria'],
    'japanese': ['japanese restaurant', 'sushi', 'ramen', 'izakaya', 'japanese food'],
    'thai': ['thai restaurant', 'thai food', 'pad thai', 'thai cuisine'],
    'indian': ['indian restaurant', 'indian food', 'curry', 'indian cuisine'],
    'mexican': ['mexican restaurant', 'mexican food', 'tacos', 'mexican cuisine'],
    'french': ['french restaurant', 'french food', 'bistro', 'brasserie'],
    'korean': ['korean restaurant', 'korean food', 'korean bbq', 'kimchi'],
    'vietnamese': ['vietnamese restaurant', 'pho', 'vietnamese food'],
    'greek': ['greek restaurant', 'greek food', 'gyros', 'souvlaki'],
    'mediterranean': ['mediterranean restaurant', 'mediterranean food'],
    'middle eastern': ['middle eastern restaurant', 'falafel', 'shawarma'],
    'vegan': ['vegan restaurant', 'vegan food', 'plant based'],
    'vegetarian': ['vegetarian restaurant', 'vegetarian food'],
    'ice cream': ['ice cream', 'gelato', 'frozen yogurt', 'dessert'],
    'coffee': ['coffee shop', 'cafe', 'espresso', 'coffee'],
    'bakery': ['bakery', 'pastry', 'bread', 'croissant'],
    'pizza': ['pizza', 'pizzeria', 'pizza restaurant'],
    'burger': ['burger', 'hamburger', 'burger restaurant'],
    'seafood': ['seafood restaurant', 'fish restaurant', 'seafood'],
    'steakhouse': ['steakhouse', 'steak restaurant', 'grill']
  };
  
  // Find matching cuisine keywords
  for (const [cuisine, variations] of Object.entries(cuisineMap)) {
    if (lowerQuery.includes(cuisine)) {
      // Return the most specific variation for better search results
      return variations[0];
    }
  }
  
  // If it's a restaurant search but no specific enhancements, add "restaurant"
  if (searchType === 'restaurant' && !lowerQuery.includes('restaurant') && !lowerQuery.includes('cafe') && !lowerQuery.includes('bar')) {
    return query + ' restaurant';
  }
  
  return query;
}

// Helper function to get today's hours
function getTodayHours(openingHours: string[]): string {
  if (!openingHours || openingHours.length === 0) {
    return '';
  }
  
  const today = new Date().getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const todayHours = openingHours.find((day: string) => 
    day.toLowerCase().startsWith(dayNames[today].toLowerCase())
  );
  
  if (todayHours) {
    const hours = todayHours.split(': ')[1];
    return hours === 'Closed' ? 'Closed today' : hours || '';
  }
  
  return '';
}

// Enhanced search intent detection
function extractSearchIntent(message: string): {
  isSearchQuery: boolean;
  searchType: 'restaurant' | 'attraction' | 'shopping' | 'general';
  keywords: string[];
  specificQuery: string;
} {
  const lowerMessage = message.toLowerCase();
  
  // Food/restaurant keywords - expanded with more cuisines
  const foodKeywords = [
    'restaurant', 'food', 'eat', 'dining', 'cafe', 'coffee', 'pizza', 'pasta', 'gelato', 'ice cream', 
    'vegan', 'vegetarian', 'breakfast', 'lunch', 'dinner', 'brunch', 'bakery', 'bar', 'wine', 'cocktail', 
    'sushi', 'burger', 'sandwich', 'italian', 'french', 'chinese', 'japanese', 'mexican', 'thai', 'indian',
    'korean', 'vietnamese', 'greek', 'mediterranean', 'middle eastern', 'seafood', 'steakhouse', 'bbq',
    'dim sum', 'ramen', 'pho', 'tacos', 'curry', 'falafel', 'shawarma', 'gyros', 'souvlaki',
    'fine dining', 'casual dining', 'fast food', 'buffet', 'romantic dinner', 'family restaurant'
  ];
  
  // Attraction keywords
  const attractionKeywords = ['museum', 'gallery', 'church', 'cathedral', 'monument', 'park', 'garden', 'beach', 'view', 'sightseeing', 'tour', 'attraction', 'landmark', 'historic', 'art', 'culture'];
  
  // Shopping keywords
  const shoppingKeywords = ['shop', 'shopping', 'store', 'market', 'boutique', 'souvenir', 'buy', 'purchase', 'mall', 'clothes', 'fashion'];
  
  const hasFood = foodKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasAttraction = attractionKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasShopping = shoppingKeywords.some(keyword => lowerMessage.includes(keyword));
  
  const isSearchQuery = hasFood || hasAttraction || hasShopping || 
                       lowerMessage.includes('find') || 
                       lowerMessage.includes('where') ||
                       lowerMessage.includes('recommend') ||
                       lowerMessage.includes('suggest') ||
                       lowerMessage.includes('near') ||
                       lowerMessage.includes('close to');
  
  let searchType: 'restaurant' | 'attraction' | 'shopping' | 'general' = 'general';
  if (hasFood) searchType = 'restaurant';
  else if (hasAttraction) searchType = 'attraction';
  else if (hasShopping) searchType = 'shopping';
  
  // Extract meaningful keywords for search - preserve important cuisine words
  const stopWords = ['the', 'and', 'for', 'near', 'find', 'where', 'can', 'you', 'recommend', 'suggest', 'want', 'need', 'some', 'good', 'best', 'close', 'to', 'my', 'hotel', 'me', 'a', 'an', 'is', 'are', 'there', 'any'];
  const keywords = message.split(' ')
    .map(word => word.replace(/[^\w]/g, '').toLowerCase())
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  // Create a specific search query - preserve the original query for better cuisine matching
  const specificQuery = message.replace(/find|where|can you|recommend|suggest|near|close to|my hotel/gi, '').trim();
  
  return { isSearchQuery, searchType, keywords, specificQuery };
}

// Helper function to validate activity objects
const isValidActivity = (activity: any): activity is GeneratedActivity => {
  return activity && 
         typeof activity === 'object' && 
         typeof activity.name === 'string' && 
         activity.name.trim() !== '' &&
         typeof activity.category === 'string' &&
         typeof activity.description === 'string';
};

export async function generateDestinationInfo(destination: string, country: string): Promise<Partial<Destination>> {
  const prompt = `
Provide destination information for ${destination}, ${country} in JSON format:

{
  "countryCode": "2-letter ISO code",
  "currency": "currency code (e.g., EUR, USD)",
  "languages": ["primary language", "secondary language if applicable"],
  "emergencyNumber": "main emergency number",
  "timezone": "timezone (e.g., Europe/Rome)",
  "coordinates": {
    "lat": latitude as number,
    "lng": longitude as number
  }
}

Return only valid JSON, no additional text.
`;

  try {
    const response = await callGeminiAPI(prompt, true); // Enable grounding for destination info
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('Error generating destination info:', error);
    return {
      countryCode: '',
      currency: 'EUR',
      languages: ['English'],
      emergencyNumber: '112',
      timezone: 'UTC',
      coordinates: { lat: 0, lng: 0 }
    };
  }
}

export async function generateActivitiesForLocation(
  destination: Destination, 
  city: City | undefined,
  interests: string[], 
  budget: string, 
  travelers: number
): Promise<GeneratedActivity[]> {
  // ONLY generate activities if we have a city - no country-level activities
  if (!city) {
    return [];
  }

  const locationName = `${city.name}, ${destination.country}`;
  const locationContext = `the city of ${city.name}`;
  
  const prompt = `
Generate 25-35 diverse activities for ${locationName} based on:
- Interests: ${interests.join(', ')}
- Budget: ${budget}
- Travelers: ${travelers}
- Focus SPECIFICALLY on activities within ${city.name} city limits and immediate surroundings

IMPORTANT: Use ONLY these simplified single-word categories (choose the most appropriate one):
History, Nature, Food, Museums, Beach, Shopping, Nightlife, Culture, Wellness, City

Category Guidelines:
- History: Historical sites, monuments, ancient ruins, castles, heritage sites
- Nature: Parks, gardens, hiking, outdoor activities, wildlife, scenic views
- Food: Restaurants, food tours, markets, cooking classes, local cuisine
- Museums: Art galleries, museums, exhibitions, cultural centers
- Beach: Beach activities, water sports, coastal experiences
- Shopping: Markets, boutiques, shopping districts, souvenirs
- Nightlife: Bars, clubs, evening entertainment, live music
- Culture: Festivals, traditions, local experiences, performances
- Wellness: Spas, thermal baths, relaxation, health activities
- City: Urban exploration, architecture, city tours, neighborhoods

CRITICAL PRICING FORMAT: Use the LOCAL CURRENCY for ${destination.country} (${destination.currency || 'local currency'}). Examples:
- "Free"
- "${destination.currency || '$'}5-15"
- "${destination.currency || '$'}20-35"
Use ONLY simple price ranges with the correct local currency symbol. NO additional text!

Return a JSON array of activities with this structure:
[
  {
    "name": "Activity name",
    "category": "ONE SINGLE WORD from: History, Nature, Food, Museums, Beach, Shopping, Nightlife, Culture, Wellness, City",
    "description": "Detailed description (100-150 words)",
    "estimatedCost": "SIMPLE price range ONLY (e.g., Free, €10-15, $20-30)",
    "duration": "Time needed (e.g., 2-3 hours, Half day, Full day)",
    "bestTime": "Best time to visit",
    "location": "Specific location/address in ${city.name}",
    "tips": "Practical tips for visitors",
    "difficulty": "easy|moderate|challenging",
    "destinationId": "${destination.id}",
    "cityId": "${city.id}"
  }
]

CRITICAL: Each activity must have exactly ONE category word from this list:
History, Nature, Food, Museums, Beach, Shopping, Nightlife, Culture, Wellness, City

CRITICAL: estimatedCost must be ONLY the price range with NO additional text!

Focus on authentic, local experiences specific to ${city.name}. Include mix of free and paid activities. Return only valid JSON.
`;

  try {
    const response = await callGeminiAPI(prompt, true); // Enable grounding for activity generation
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const activities = JSON.parse(cleanResponse);
    
    // Filter and validate activities before returning
    const validActivities = Array.isArray(activities) 
      ? activities.filter(isValidActivity).map((activity: any) => ({
          ...activity,
          destinationId: destination.id,
          cityId: city.id
        }))
      : [];
    
    return validActivities;
  } catch (error) {
    console.error('Error generating activities:', error);
    return [];
  }
}

export async function generateDayTripsForLocation(
  destination: Destination,
  city: City,
  interests: string[],
  budget: string,
  travelers: number,
  existingCities: string[] = []
): Promise<GeneratedActivity[]> {
  const locationName = `${city.name}, ${destination.country}`;
  const excludeCitiesText = existingCities.length > 0 
    ? `EXCLUDE these cities that are already in the user's itinerary: ${existingCities.join(', ')}.` 
    : '';
  
  const prompt = `
Generate 8-12 DAY TRIP destinations and activities from ${locationName} to nearby cities and attractions. 
${excludeCitiesText}

Focus on destinations that are:
- Within 1-3 hours travel time from ${city.name}
- Perfect for day trips (can be visited and returned same day)
- Different from ${city.name} and offer unique experiences
- Accessible by public transport, tour, or short drive

Based on traveler preferences:
- Interests: ${interests.join(', ')}
- Budget: ${budget}
- Travelers: ${travelers}

IMPORTANT: Use ONLY the category "Daytrips" for ALL day trip activities.

CRITICAL PRICING FORMAT: Include transportation + activity costs in simple ranges like:
- "€25-45" (includes transport + entry)
- "$30-60" (includes ferry + activities)
- "Free-€15" (transport only, free activities)

Return a JSON array with this structure:
[
  {
    "name": "Day Trip to [Destination Name]",
    "category": "Daytrips",
    "description": "Detailed description of the day trip destination, what to see/do, why it's worth visiting, and what makes it special (150-200 words)",
    "estimatedCost": "TOTAL cost including transport and main activities (e.g., €25-45, $30-60)",
    "duration": "Full day" or "Half day",
    "bestTime": "Best time to visit this destination",
    "location": "Name of the destination city/town from ${city.name}",
    "tips": "Transportation options, booking tips, what to bring, best departure times",
    "difficulty": "easy|moderate|challenging",
    "destinationId": "${destination.id}",
    "cityId": "${city.id}"
  }
]

Examples of good day trips from ${city.name}:
- Nearby coastal towns or islands
- Historic villages or towns
- Natural parks or scenic areas
- Famous landmarks within day trip distance
- Cultural sites or UNESCO locations
- Wine regions or food destinations

Focus on authentic, must-visit destinations that locals and tourists love for day trips. Return only valid JSON.
`;

  try {
    const response = await callGeminiAPI(prompt, true); // Enable grounding for day trip generation
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const dayTrips = JSON.parse(cleanResponse);
    
    // Filter and validate day trips before returning
    const validDayTrips = Array.isArray(dayTrips) 
      ? dayTrips.filter(isValidActivity).map((activity: any) => ({
          ...activity,
          category: 'Daytrips', // Ensure category is always Daytrips
          destinationId: destination.id,
          cityId: city.id
        }))
      : [];
    
    return validDayTrips;
  } catch (error) {
    console.error('Error generating day trips:', error);
    return [];
  }
}

export async function generateActivities(travelPlan: TravelPlan): Promise<GeneratedActivity[]> {
  const { interests, budget, travelers } = travelPlan;
  let allActivities: GeneratedActivity[] = [];

  // Get list of existing cities in the user's plan to exclude from day trips
  const existingCities: string[] = [];
  
  if (travelPlan.tripType === 'day-trip') {
    const destination = travelPlan.destination || travelPlan.destinations[0];
    if (destination) {
      existingCities.push(destination.name);
      
      // For day trips, treat the destination as a city-like location
      const mockCity: City = {
        id: `city_${destination.id}`,
        name: destination.name,
        coordinates: destination.coordinates,
        countryId: destination.id
      };
      
      // Generate regular activities
      const activities = await generateActivitiesForLocation(destination, mockCity, interests, budget, travelers);
      allActivities = [...allActivities, ...activities];
      
      // Generate day trips to nearby destinations
      const dayTrips = await generateDayTripsForLocation(destination, mockCity, interests, budget, travelers, existingCities);
      allActivities = [...allActivities, ...dayTrips];
    }
  } else {
    // For full trips: collect existing cities and generate activities + day trips
    travelPlan.segments?.forEach(segment => {
      if (segment.city) {
        existingCities.push(segment.city.name);
      }
    });
    
    // Generate activities for each city segment
    for (const segment of travelPlan.segments || []) {
      if (segment.city && segment.destination.name) {
        // Generate regular activities for the city
        const activities = await generateActivitiesForLocation(segment.destination, segment.city, interests, budget, travelers);
        allActivities = [...allActivities, ...activities];
        
        // Generate day trips from this city to nearby destinations
        const dayTrips = await generateDayTripsForLocation(segment.destination, segment.city, interests, budget, travelers, existingCities);
        allActivities = [...allActivities, ...dayTrips];
      }
      // Skip country-only segments - no activities generated
    }
  }

  // Final validation filter
  return allActivities.filter(isValidActivity);
}

export async function generateTranslationsForDestination(destination: Destination): Promise<Translation[]> {
  const primaryLanguage = destination.languages[0] || 'local language';
  
  const prompt = `
Generate 40-50 essential travel phrases for ${destination.name}, ${destination.country}.
Translate from English to ${primaryLanguage} with pronunciation guide.

Return JSON array:
[
  {
    "english": "English phrase",
    "local": "Translation in ${primaryLanguage}",
    "pronunciation": "Phonetic pronunciation guide",
    "category": "Greetings|Directions|Food|Shopping|Emergency|Travel|Numbers|Time|Accommodation",
    "destinationId": "${destination.id}"
  }
]

Include essential phrases for travelers. Return only valid JSON.
`;

  try {
    const response = await callGeminiAPI(prompt, true); // Enable grounding for translations
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const translations = JSON.parse(cleanResponse);
    return translations.map((translation: any) => ({
      ...translation,
      destinationId: destination.id
    }));
  } catch (error) {
    console.error('Error generating translations:', error);
    return [];
  }
}

export async function generateTranslations(travelPlan: TravelPlan): Promise<Translation[]> {
  let allTranslations: Translation[] = [];

  // Handle both single and multi-destination trips
  const destinations = travelPlan.tripType === 'day-trip' && travelPlan.destination 
    ? [travelPlan.destination] 
    : travelPlan.destinations;

  // Generate translations for each unique language
  const processedLanguages = new Set<string>();
  
  for (const destination of destinations) {
    if (destination.name && destination.languages.length > 0) {
      const primaryLanguage = destination.languages[0];
      
      // Only generate translations once per language
      if (!processedLanguages.has(primaryLanguage)) {
        const translations = await generateTranslationsForDestination(destination);
        allTranslations = [...allTranslations, ...translations];
        processedLanguages.add(primaryLanguage);
      }
    }
  }

  return allTranslations;
}

export async function generateEmergencyContactsForDestination(destination: Destination): Promise<EmergencyContact[]> {
  const prompt = `
Generate emergency contacts for ${destination.name}, ${destination.country}.

Return JSON array:
[
  {
    "name": "Service name",
    "number": "Phone number",
    "description": "What this service provides",
    "type": "emergency|police|medical|fire|tourist",
    "destinationId": "${destination.id}"
  }
]

Include: general emergency, police, medical, fire, tourist police, embassy contacts if relevant.
Return only valid JSON.
`;

  try {
    const response = await callGeminiAPI(prompt, true); // Enable grounding for emergency contacts
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const contacts = JSON.parse(cleanResponse);
    return contacts.map((contact: any) => ({
      ...contact,
      destinationId: destination.id
    }));
  } catch (error) {
    console.error('Error generating emergency contacts:', error);
    return [
      {
        name: 'Emergency Services',
        number: '112',
        description: 'General emergency number',
        type: 'emergency',
        destinationId: destination.id
      }
    ];
  }
}

export async function generateEmergencyContacts(travelPlan: TravelPlan): Promise<EmergencyContact[]> {
  let allContacts: EmergencyContact[] = [];

  // Handle both single and multi-destination trips
  const destinations = travelPlan.tripType === 'day-trip' && travelPlan.destination 
    ? [travelPlan.destination] 
    : travelPlan.destinations;

  // Generate emergency contacts for each destination
  for (const destination of destinations) {
    if (destination.name) {
      const contacts = await generateEmergencyContactsForDestination(destination);
      allContacts = [...allContacts, ...contacts];
    }
  }

  return allContacts;
}

export async function generateTravelContent(
  travelPlan: TravelPlan,
  setActivities: (activities: GeneratedActivity[]) => void,
  setTranslations: (translations: Translation[]) => void,
  setEmergencyContacts: (contacts: EmergencyContact[]) => void
): Promise<void> {
  try {
    // Get all destinations that need info
    const destinations = travelPlan.tripType === 'day-trip' && travelPlan.destination 
      ? [travelPlan.destination] 
      : travelPlan.destinations;

    // Update destination info for each destination
    for (const destination of destinations) {
      if (destination.name && !destination.currency) {
        const destInfo = await generateDestinationInfo(destination.name, destination.country);
        Object.assign(destination, destInfo);
      }
    }
    
    // Generate all content in parallel
    const [activities, translations, emergencyContacts] = await Promise.all([
      generateActivities(travelPlan),
      generateTranslations(travelPlan),
      generateEmergencyContacts(travelPlan)
    ]);
    
    // Use the passed setter functions
    setActivities(activities);
    setTranslations(translations);
    setEmergencyContacts(emergencyContacts);
    
  } catch (error) {
    console.error('Error generating travel content:', error);
    throw error;
  }
}

export async function generateCustomItinerary(selectedActivities: string[], destination: string, date?: string): Promise<string> {
  const prompt = `
Create a personalized day itinerary for ${destination} using these selected activities:
${selectedActivities.map(activity => `- ${activity}`).join('\n')}

${date ? `Date: ${date}` : ''}

Create a detailed itinerary with:
- Logical timing and flow throughout the day
- Transportation suggestions between locations
- Meal recommendations and timing
- Practical tips for each activity
- Estimated time for each activity

Format the response as clean, readable text with clear sections and timing. Use emojis for visual appeal but NO HTML tags.

Structure:
🌅 MORNING (8:00 AM - 12:00 PM)
[Morning activities with times and details]

🌞 AFTERNOON (12:00 PM - 6:00 PM) 
[Afternoon activities with times and details]

🌆 EVENING (6:00 PM - 10:00 PM)
[Evening activities with times and details]

💡 PRACTICAL TIPS
[General tips for the day]

🚗 TRANSPORTATION NOTES
[How to get around]

Make it engaging and practical for travelers!
`;

  return await callGeminiAPI(prompt, true); // Enable grounding for itinerary generation
}

export async function translateCustomText(text: string, targetLanguage: string): Promise<string> {
  const prompt = `
Translate this English text to ${targetLanguage}:
"${text}"

Provide only the translation, no additional text or explanations.
Use natural, conversational language appropriate for travelers.
`;

  return await callGeminiAPI(prompt, true); // Enable grounding for translations
}

export async function chatWithTripAssistant(
  userMessage: string,
  travelPlan: TravelPlan,
  activities: GeneratedActivity[],
  selectedCity?: any
): Promise<{
  content: string;
  suggestions?: string[];
  locations?: Array<{
    name: string;
    address: string;
    type: 'restaurant' | 'attraction' | 'hotel' | 'general';
  }>;
}> {
  // Build context about the trip
  const currentLocation = selectedCity 
    ? `${selectedCity.city.name}, ${selectedCity.destination.country}`
    : travelPlan.tripType === 'day-trip' 
      ? `${travelPlan.destination?.name || travelPlan.destinations[0]?.name}`
      : 'multiple destinations';

  const accommodations = selectedCity 
    ? selectedCity.segment?.accommodations || []
    : travelPlan.tripType === 'day-trip' 
      ? []
      : travelPlan.segments?.flatMap(s => s.accommodations || []) || [];

  const cityActivities = selectedCity 
    ? activities.filter(a => a.cityId === selectedCity.city.id)
    : activities;

  // Extract search intent from user message
  const searchIntent = extractSearchIntent(userMessage);
  let realPlaces: any[] = [];

  // If this is a search query, use Gemini + Google Places API to get REAL places
  if (searchIntent.isSearchQuery && selectedCity?.city?.coordinates) {
    realPlaces = await searchRealPlacesWithGemini(
      searchIntent.specificQuery,
      selectedCity.city.coordinates,
      10000, // 10km radius
      searchIntent.searchType
    );
    
  }

  const tripContext = `
TRIP CONTEXT:
- Location: ${currentLocation}
- Trip Type: ${travelPlan.tripType}
- Travelers: ${travelPlan.travelers}
- Interests: ${travelPlan.interests.join(', ')}
- Budget: ${travelPlan.budget}
- Languages: ${selectedCity?.destination.languages?.join(', ') || 'Local languages'}
- Currency: ${selectedCity?.destination.currency || 'Local currency'}

ACCOMMODATIONS:
${accommodations.map(acc => `- ${acc.name} at ${acc.address}`).join('\n') || 'No accommodations specified'}

AVAILABLE ACTIVITIES:
${cityActivities.slice(0, 10).map(act => `- ${act.name} (${act.category}) - ${act.location}`).join('\n')}
${cityActivities.length > 10 ? `... and ${cityActivities.length - 10} more activities` : ''}

${realPlaces.length > 0 ? `
REAL VERIFIED PLACES FROM GOOGLE (for "${userMessage}"):
${realPlaces.map(place => `- ${place.name} at ${place.formatted_address} (Rating: ${place.rating || 'N/A'}/5, ${place.current_status}, Today: ${place.today_hours || 'Hours unknown'})`).join('\n')}
` : ''}
`;

  const prompt = `
You are an expert AI travel assistant with access to real, verified place data from Google Places API and enhanced with grounding for maximum accuracy and awareness.

${tripContext}

USER QUESTION: "${userMessage}"

CRITICAL RESPONSE GUIDELINES:
1. ALWAYS prioritize REAL PLACES from Google over generic suggestions
2. Provide SPECIFIC, ACTIONABLE recommendations with exact names and addresses
3. NO markdown formatting - use plain text only (no *, **, #, etc.)
4. Be conversational and helpful, not formal
5. ONLY answer questions related to this specific trip and destinations
6. Use accommodation addresses as reference points when giving directions
7. ALWAYS mention current opening status when available (Open now, Closed now, etc.)
8. Prioritize places that are currently open when making recommendations
9. Include ratings when available to help users choose
10. Keep responses under 120 words but pack them with specific, useful information
11. Use grounding to provide the most current and accurate information available

RESPONSE FORMAT:
Provide a helpful response with specific recommendations. When you mention specific places (restaurants, attractions, etc.), format them as a JSON array at the end:

LOCATIONS: [
  {
    "name": "Exact Restaurant/Place Name",
    "address": "Full street address",
    "type": "restaurant|attraction|hotel|general"
  }
]

If no specific locations are mentioned, don't include the LOCATIONS section.

SUGGESTIONS: Provide 2-3 follow-up questions the user might ask, formatted as:
SUGGESTIONS: ["Question 1", "Question 2", "Question 3"]

EXAMPLES OF GOOD RESPONSES WITH REAL PLACES:
- For "vegan ice cream": "Here are 3 excellent vegan gelaterias currently verified: Hoche Glacé on 2225 Av. Bennett (open now, rating 4.6/5, smooth vegan options), ICONOGLACE at 1320 Rue Bélanger (open until 10pm, rating 4.7/5, creative presentations), and Crèmerie SWIRL on 230 Rue Rachel E (open now, rating 4.7/5, coconut milk soft serve). All within 15 minutes from downtown."

CRITICAL: If you have real places from Google, use ONLY those places. Do not invent or suggest places that aren't in the verified list.

Be direct, specific, and helpful. Focus on real places with exact details and current availability. Use grounding to ensure all information is as accurate and current as possible.
`;

  try {
    const response = await callGeminiAPI(prompt, true); // CRITICAL: Enable grounding for chat assistant
    
    // Clean up any markdown formatting that might slip through
    let cleanContent = response
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/`(.*?)`/g, '$1') // Remove code formatting
      .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Remove links, keep text
    
    // Parse the response to extract content, locations, and suggestions
    let content = cleanContent;
    let locations: any[] = [];
    let suggestions: string[] = [];

    // If we have real places from Google but no locations were extracted, create them
    if (realPlaces.length > 0) {
      locations = realPlaces.slice(0, 4).map(place => ({
        name: place.name,
        address: place.formatted_address,
        type: searchIntent.searchType
      }));
    }

    // Extract locations if present in response
    const locationsMatch = response.match(/LOCATIONS:\s*(\[[\s\S]*?\])/);
    if (locationsMatch) {
      try {
        const extractedLocations = JSON.parse(locationsMatch[1]);
        if (extractedLocations.length > 0) {
          locations = extractedLocations;
        }
        content = content.replace(/LOCATIONS:\s*\[[\s\S]*?\]/, '').trim();
      } catch (e) {
        console.error('Error parsing locations:', e);
      }
    }

    // Extract suggestions if present
    const suggestionsMatch = response.match(/SUGGESTIONS:\s*(\[[\s\S]*?\])/);
    if (suggestionsMatch) {
      try {
        suggestions = JSON.parse(suggestionsMatch[1]);
        content = content.replace(/SUGGESTIONS:\s*\[[\s\S]*?\]/, '').trim();
      } catch (e) {
        console.error('Error parsing suggestions:', e);
      }
    }

    // Final cleanup of content
    content = content
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove any remaining bold
      .replace(/\*(.*?)\*/g, '$1') // Remove any remaining italic
      .trim();

    return {
      content: content,
      locations: locations.length > 0 ? locations : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  } catch (error) {
    console.error('Error in chat assistant:', error);
    throw error;
  }
}

// Conversational onboarding: extract trip details from natural language
export interface OnboardingExtraction {
  destination?: string;
  country?: string;
  travelers?: number;
  duration?: number;
  startDate?: string;
  interests?: string[];
  budget?: 'budget' | 'mid-range' | 'luxury';
  tripType?: 'full-trip' | 'day-trip';
  accommodation?: string;
  accommodationAddress?: string;
  complete: boolean;
  missingFields: string[];
  aiResponse: string;
}

export async function onboardingChat(
  conversationHistory: { role: 'user' | 'assistant'; text: string }[],
  userMessage: string
): Promise<OnboardingExtraction> {
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');

  const prompt = `You are a friendly travel planning assistant helping someone set up their trip. You are having a conversation to gather trip details naturally.

CONVERSATION SO FAR:
${historyText}
User: ${userMessage}

TASK: Respond naturally and extract any trip details from the ENTIRE conversation so far. Be warm, brief, and conversational (2-3 sentences max for your response). Ask about missing details naturally.

The details you need to collect:
1. Destination (city/country) - REQUIRED
2. Trip type (day-trip or multi-day) - REQUIRED
3. Number of travelers - REQUIRED
4. Duration / dates (how many days, when) - REQUIRED for multi-day trips
5. Interests (what they want to do) - REQUIRED (at least 1)
6. Budget level (budget, mid-range, luxury) - OPTIONAL, default mid-range
7. Accommodation name and address - OPTIONAL

IMPORTANT RULES:
- Do NOT list all missing fields at once. Ask about ONE thing at a time.
- If the user gave destination, ask about who is coming or what they want to do next.
- If you have destination + travelers + interests, you probably have enough. Set complete to true.
- Be smart about inferring: "with my family" = 3-4 travelers, "weekend trip" = 2-3 days, "backpacking" = budget.
- Valid interests: Historical Sites, Outdoor Adventures, Food & Dining, Museums & Art, Beach & Water, Shopping, Nightlife, Nature & Wildlife, Photography, Culture & Shows, Wellness & Spa, Architecture, Local Markets, Water Activities, Religious Sites

Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "destination": "city name or null",
  "country": "country name or null",
  "travelers": number or null,
  "duration": number of days or null,
  "startDate": "YYYY-MM-DD or null",
  "interests": ["interest1", "interest2"] or [],
  "budget": "budget|mid-range|luxury or null",
  "tripType": "full-trip|day-trip or null",
  "accommodation": "hotel name or null",
  "accommodationAddress": "address or null",
  "complete": true/false,
  "missingFields": ["field1", "field2"],
  "aiResponse": "your conversational response to the user"
}`;

  const raw = await callGeminiAPI(prompt, true);

  // Parse JSON from response
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      destination: parsed.destination || undefined,
      country: parsed.country || undefined,
      travelers: parsed.travelers || undefined,
      duration: parsed.duration || undefined,
      startDate: parsed.startDate || undefined,
      interests: parsed.interests || [],
      budget: parsed.budget || undefined,
      tripType: parsed.tripType || undefined,
      accommodation: parsed.accommodation || undefined,
      accommodationAddress: parsed.accommodationAddress || undefined,
      complete: parsed.complete || false,
      missingFields: parsed.missingFields || [],
      aiResponse: parsed.aiResponse || 'Tell me more about your trip!',
    };
  } catch {
    return {
      complete: false,
      missingFields: ['destination'],
      interests: [],
      aiResponse: raw.length > 200 ? 'Sounds great! Where are you heading?' : raw,
    };
  }
}

// Discover more activities for a specific category or general
export async function discoverMoreActivities(
  locationName: string,
  category: string,
  existingNames: string[],
  destinationId: string,
  cityId: string
): Promise<GeneratedActivity[]> {
  const exclusionList = existingNames.slice(0, 20).join(', ');

  const prompt = `
Generate EXACTLY 10 NEW and UNIQUE activities for ${locationName} in the "${category}" category.

CRITICAL: You MUST return exactly 10 activities. No fewer.
CRITICAL: Do NOT include any of these existing activities: ${exclusionList}

Use ONLY this category: ${category}

Return a JSON array with exactly 10 items:
[
  {
    "name": "Activity name",
    "category": "${category}",
    "description": "Detailed description (80-120 words)",
    "estimatedCost": "Simple price range (e.g., Free, $10-25)",
    "duration": "Time needed",
    "bestTime": "Best time to visit",
    "location": "Specific address in ${locationName}",
    "tips": "Practical tips",
    "difficulty": "easy|moderate|challenging",
    "destinationId": "${destinationId}",
    "cityId": "${cityId}"
  }
]

Focus on lesser-known, authentic local experiences. Include hidden gems, local favorites, and off-the-beaten-path spots that most tourists miss. You MUST return 10 items. Return only valid JSON.
`;

  try {
    const response = await callGeminiAPI(prompt, true);
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const activities = JSON.parse(cleaned);
    return Array.isArray(activities) ? activities.filter(isValidActivity).map((a: any) => ({ ...a, destinationId, cityId })) : [];
  } catch (error) {
    console.error('Error discovering more activities:', error);
    return [];
  }
}

// Smart suggestion based on time of day and trip context
export async function getSmartSuggestion(
  locationName: string,
  interests: string[],
  existingActivities: string[]
): Promise<{ title: string; description: string; activityName: string } | null> {
  const hour = new Date().getHours();
  const timeContext = hour < 11 ? 'morning' : hour < 14 ? 'lunchtime' : hour < 17 ? 'afternoon' : hour < 20 ? 'evening' : 'night';

  const prompt = `
It is ${timeContext} in ${locationName}. A traveler interested in ${interests.slice(0, 4).join(', ')} needs a quick suggestion.

Their existing activities include: ${existingActivities.slice(0, 10).join(', ')}

Give ONE smart suggestion for right now. Respond in JSON:
{
  "title": "Short catchy title (3-5 words)",
  "description": "One sentence why this is perfect right now",
  "activityName": "The specific activity or place name"
}

Be specific to ${locationName} and the current time of day. Return only valid JSON.
`;

  try {
    const response = await callGeminiAPI(prompt, true);
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}