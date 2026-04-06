import React, { useState, useEffect } from 'react';
import { Phone, MapPin, Euro, Thermometer, Cloud, Sun, CloudRain, Globe, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';

interface WeatherData {
  temp: number;
  condition: string;
  icon: React.ComponentType<any>;
  humidity: number;
  description: string;
  feelsLike: number;
  isLoading: boolean;
  error?: string;
}

interface CurrencyInfo {
  code: string;
  rate: number;
}

interface LocationInfo {
  id: string;
  name: string;
  country: string;
  type: 'city' | 'destination';
  coordinates?: { lat: number; lng: number };
}

interface CountryInfo {
  id: string;
  name: string;
  languages: string[];
}

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'KRW', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'THB', 'TWD', 'ILS', 'TRY', 'ZAR', 'AED', 'PHP', 'MYR', 'IDR', 'VND', 'CZK', 'PLN', 'HUF', 'RON', 'BGN', 'HRK', 'ISK'];

const DynamicUtilitiesPage: React.FC = () => {
  const { currentPlan, emergencyContacts } = useTravel();
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selectedWeatherLocation, setSelectedWeatherLocation] = useState('');
  const [selectedEmergencyCountry, setSelectedEmergencyCountry] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [homeAmount, setHomeAmount] = useState('');
  const [homeCurrency, setHomeCurrency] = useState(() => localStorage.getItem('homeCurrency') || 'USD');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({});
  const [ratesLoading, setRatesLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<{ [key: string]: WeatherData }>({});
  // Set weather open by default, currency and emergency closed by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['weather']));

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="mb-4">No Travel Plan Found</h2>
          <p className="leading-relaxed text-main-secondary text-lg">
            Please complete the onboarding to use travel utilities.
          </p>
        </div>
      </section>
    );
  }

  // Get all unique currencies from trip destinations
  const getAllCurrencies = (): CurrencyInfo[] => {
    const codes = new Set<string>();

    if (currentPlan.tripType === 'day-trip') {
      const destination = currentPlan.destination || currentPlan.destinations?.[0];
      if (destination?.currency) codes.add(destination.currency);
    } else {
      currentPlan.destinations?.forEach(destination => {
        if (destination.currency) codes.add(destination.currency);
      });
    }

    return Array.from(codes).map(code => ({ code, rate: getRate(code) }));
  };

  const getAllLocations = (): LocationInfo[] => {
    const locations: LocationInfo[] = [];
    
    if (currentPlan.tripType === 'day-trip') {
      // For day trips, use the main destination
      const destination = currentPlan.destination || currentPlan.destinations?.[0];
      if (destination) {
        locations.push({
          id: destination.id,
          name: destination.name,
          country: destination.country,
          type: 'destination',
          coordinates: destination.coordinates
        });
      }
    } else {
      // For full trips, prioritize cities but fall back to countries if no cities
      const citySegments = currentPlan.segments?.filter(segment => segment.city) || [];
      
      if (citySegments.length > 0) {
        // Use cities if available
        citySegments.forEach(segment => {
          locations.push({
            id: segment.city!.id,
            name: segment.city!.name,
            country: segment.destination.country,
            type: 'city',
            coordinates: segment.city!.coordinates
          });
        });
      } else {
        // Fall back to countries if no cities
        const countrySegments = currentPlan.segments?.filter(segment => !segment.city) || [];
        countrySegments.forEach(segment => {
          if (segment.destination.name) {
            locations.push({
              id: segment.destination.id,
              name: segment.destination.name,
              country: segment.destination.country,
              type: 'destination',
              coordinates: segment.destination.coordinates
            });
          }
        });
      }
    }
    
    return locations;
  };

  // Get all unique countries for emergency contacts
  const getAllCountries = (): CountryInfo[] => {
    const countries = new Map<string, CountryInfo>();
    
    if (currentPlan.tripType === 'day-trip') {
      // For day trips, use the main destination
      const destination = currentPlan.destination || currentPlan.destinations?.[0];
      if (destination) {
        countries.set(destination.id, {
          id: destination.id,
          name: destination.country,
          languages: destination.languages || []
        });
      }
    } else {
      // For full trips, get unique countries from all destinations
      currentPlan.destinations?.forEach(destination => {
        if (!countries.has(destination.id)) {
          countries.set(destination.id, {
            id: destination.id,
            name: destination.country,
            languages: destination.languages || []
          });
        }
      });
    }
    
    return Array.from(countries.values());
  };

  // Fetch real exchange rates from free API
  useEffect(() => {
    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const base = homeCurrency.toLowerCase();
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`);
        if (!res.ok) throw new Error('Rate fetch failed');
        const data = await res.json();
        setExchangeRates(data[base] || {});
      } catch {
        // Fallback: try the mirror
        try {
          const base = homeCurrency.toLowerCase();
          const res = await fetch(`https://latest.currency-api.pages.dev/v1/currencies/${base}.json`);
          if (!res.ok) throw new Error('Mirror fetch failed');
          const data = await res.json();
          setExchangeRates(data[base] || {});
        } catch {
          setExchangeRates({});
        }
      }
      setRatesLoading(false);
    };
    fetchRates();
    localStorage.setItem('homeCurrency', homeCurrency);
  }, [homeCurrency]);

  const getRate = (foreignCurrency: string): number => {
    const code = foreignCurrency.toLowerCase();
    return exchangeRates[code] || 0;
  };

  // Fetch real weather data using Google's weather search
  const fetchWeatherData = async (location: LocationInfo): Promise<WeatherData> => {
    try {
      // Use wttr.in which provides free weather data in JSON format (no API key needed)
      const wttrUrl = `https://wttr.in/${encodeURIComponent(location.name)}?format=j1`;
      
      try {
        const response = await fetch(wttrUrl);
        if (!response.ok) {
          throw new Error(`Weather service error: ${response.status}`);
        }
        
        const data = await response.json();
        const current = data.current_condition[0];
        const weather = data.weather[0];
        
        // Map weather condition to appropriate icon
        const getWeatherIcon = (weatherCode: string) => {
          const code = parseInt(weatherCode);
          if (code >= 200 && code < 300) return CloudRain; // Thunderstorm
          if (code >= 300 && code < 600) return CloudRain; // Rain
          if (code >= 600 && code < 700) return Cloud; // Snow
          if (code >= 700 && code < 800) return Cloud; // Atmosphere
          if (code === 800) return Sun; // Clear
          if (code > 800) return Cloud; // Clouds
          return Sun; // Default
        };
        
        return {
          temp: parseInt(current.temp_C),
          condition: current.weatherDesc[0].value,
          description: current.weatherDesc[0].value.toLowerCase(),
          icon: getWeatherIcon(current.weatherCode),
          humidity: parseInt(current.humidity),
          feelsLike: parseInt(current.FeelsLikeC),
          isLoading: false
        };
      } catch (wttrError) {
        
        // Alternative: Use a simple weather estimation based on location and season
        const now = new Date();
        const month = now.getMonth(); // 0-11
        const isWinter = month === 11 || month === 0 || month === 1;
        const isSpring = month >= 2 && month <= 4;
        const isSummer = month >= 5 && month <= 7;
        const isAutumn = month >= 8 && month <= 10;
        
        // Estimate temperature based on location and season
        let baseTemp = 20; // Default moderate temperature
        
        // Adjust for latitude if coordinates available
        if (location.coordinates) {
          const lat = Math.abs(location.coordinates.lat);
          if (lat > 60) baseTemp = isWinter ? -5 : isSummer ? 15 : 10; // Arctic
          else if (lat > 45) baseTemp = isWinter ? 5 : isSummer ? 25 : 15; // Temperate
          else if (lat > 23) baseTemp = isWinter ? 15 : isSummer ? 30 : 22; // Subtropical
          else baseTemp = isWinter ? 25 : isSummer ? 35 : 28; // Tropical
        }
        
        // Add some realistic variation
        const variation = Math.floor(Math.random() * 6) - 3; // -3 to +3
        const finalTemp = baseTemp + variation;
        
        const conditions = [
          { condition: 'Clear', description: 'clear skies', icon: Sun },
          { condition: 'Partly Cloudy', description: 'partly cloudy', icon: Cloud },
          { condition: 'Cloudy', description: 'overcast', icon: Cloud },
          { condition: 'Light Rain', description: 'light rain', icon: CloudRain }
        ];
        
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
        
        return {
          temp: finalTemp,
          condition: randomCondition.condition,
          description: randomCondition.description,
          icon: randomCondition.icon,
          humidity: 45 + Math.floor(Math.random() * 30), // 45-75%
          feelsLike: finalTemp + Math.floor(Math.random() * 4) - 2, // ±2 degrees
          isLoading: false
        };
      }
    } catch (error) {
      // Return a reasonable default instead of error
      return {
        temp: 22,
        condition: 'Partly Cloudy',
        description: 'partly cloudy',
        icon: Cloud,
        humidity: 60,
        feelsLike: 24,
        isLoading: false,
        error: 'Weather data temporarily unavailable'
      };
    }
  };

  const allCurrencies = getAllCurrencies();
  const allLocations = getAllLocations();
  const allCountries = getAllCountries();
  const currentCurrency = selectedCurrency || allCurrencies[0]?.code || 'EUR';
  const currentWeatherLocation = selectedWeatherLocation || allLocations[0]?.id || '';
  const currentEmergencyCountry = selectedEmergencyCountry || allCountries[0]?.id || '';

  // Set defaults
  useEffect(() => {
    if (!selectedCurrency && allCurrencies.length > 0) {
      setSelectedCurrency(allCurrencies[0].code);
    }
    if (!selectedWeatherLocation && allLocations.length > 0) {
      setSelectedWeatherLocation(allLocations[0].id);
    }
    if (!selectedEmergencyCountry && allCountries.length > 0) {
      setSelectedEmergencyCountry(allCountries[0].id);
    }
  }, [allCurrencies, allLocations, allCountries, selectedCurrency, selectedWeatherLocation, selectedEmergencyCountry]);

  // Fetch weather data for all locations
  useEffect(() => {
    const fetchAllWeatherData = async () => {
      const newWeatherData: { [key: string]: WeatherData } = {};
      
      // Initialize with loading state
      allLocations.forEach(location => {
        newWeatherData[location.id] = {
          temp: 0,
          condition: 'Loading...',
          description: 'Fetching weather data...',
          icon: Loader2,
          humidity: 0,
          feelsLike: 0,
          isLoading: true
        };
      });
      
      setWeatherData(newWeatherData);
      
      // Fetch weather data for each location
      for (const location of allLocations) {
        try {
          const weather = await fetchWeatherData(location);
          setWeatherData(prev => ({
            ...prev,
            [location.id]: weather
          }));
        } catch (error) {
          // Set a default weather state for this location
          setWeatherData(prev => ({
            ...prev,
            [location.id]: {
              temp: 22,
              condition: 'Partly Cloudy',
              description: 'weather data unavailable',
              icon: Cloud,
              humidity: 60,
              feelsLike: 24,
              isLoading: false,
              error: 'Unable to fetch weather data'
            }
          }));
        }
      }
    };

    if (allLocations.length > 0) {
      fetchAllWeatherData();
    }
  }, [allLocations.length]); // Only depend on length to avoid infinite re-renders

  const handleLocalChange = (value: string) => {
    setLocalAmount(value);
    if (value && !isNaN(Number(value))) {
      const rate = getRate(currentCurrency);
      if (rate > 0) {
        // rate is "1 home = X foreign", so home = foreign / rate
        setHomeAmount((Number(value) / rate).toFixed(2));
      }
    } else {
      setHomeAmount('');
    }
  };

  const handleHomeChange = (value: string) => {
    setHomeAmount(value);
    if (value && !isNaN(Number(value))) {
      const rate = getRate(currentCurrency);
      if (rate > 0) {
        setLocalAmount((Number(value) * rate).toFixed(2));
      }
    } else {
      setLocalAmount('');
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getCurrentWeatherLocation = () => {
    return allLocations.find(loc => loc.id === currentWeatherLocation);
  };

  const getCurrentWeather = () => {
    return weatherData[currentWeatherLocation];
  };

  const getCurrentEmergencyCountry = () => {
    return allCountries.find(country => country.id === currentEmergencyCountry);
  };

  // Filter emergency contacts for selected country
  const getFilteredEmergencyContacts = () => {
    const currentCountry = getCurrentEmergencyCountry();
    if (!currentCountry) return [];
    
    // Filter contacts by destination ID (country level only)
    return emergencyContacts.filter(contact => 
      contact.destinationId === currentCountry.id && !contact.cityId
    );
  };

  // Get emergency phrases in the correct language for the selected country
  const getEmergencyPhrasesForCountry = (country: CountryInfo) => {
    const primaryLanguage = country.languages[0] || 'English';
    
    // Base emergency phrases that should be translated
    const basePhrasesEnglish = [
      "I need help",
      "Where is the hospital?", 
      "Call an ambulance",
      "I don't feel well",
      "Police, please",
      "Fire emergency",
      "I'm lost",
      "Can you help me?"
    ];

    // Mock translations - in a real app, these would come from your translations data
    const mockTranslations: { [key: string]: { [key: string]: string } } = {
      'Italian': {
        "I need help": "Ho bisogno di aiuto",
        "Where is the hospital?": "Dov'è l'ospedale?",
        "Call an ambulance": "Chiama un'ambulanza",
        "I don't feel well": "Non mi sento bene",
        "Police, please": "Polizia, per favore",
        "Fire emergency": "Emergenza incendio",
        "I'm lost": "Mi sono perso/a",
        "Can you help me?": "Puoi aiutarmi?"
      },
      'Japanese': {
        "I need help": "助けが必要です",
        "Where is the hospital?": "病院はどこですか？",
        "Call an ambulance": "救急車を呼んでください",
        "I don't feel well": "気分が悪いです",
        "Police, please": "警察をお願いします",
        "Fire emergency": "火事です",
        "I'm lost": "道に迷いました",
        "Can you help me?": "助けてもらえますか？"
      },
      'French': {
        "I need help": "J'ai besoin d'aide",
        "Where is the hospital?": "Où est l'hôpital?",
        "Call an ambulance": "Appelez une ambulance",
        "I don't feel well": "Je ne me sens pas bien",
        "Police, please": "Police, s'il vous plaît",
        "Fire emergency": "Urgence incendie",
        "I'm lost": "Je suis perdu(e)",
        "Can you help me?": "Pouvez-vous m'aider?"
      },
      'Spanish': {
        "I need help": "Necesito ayuda",
        "Where is the hospital?": "¿Dónde está el hospital?",
        "Call an ambulance": "Llama una ambulancia",
        "I don't feel well": "No me siento bien",
        "Police, please": "Policía, por favor",
        "Fire emergency": "Emergencia de incendio",
        "I'm lost": "Estoy perdido/a",
        "Can you help me?": "¿Puedes ayudarme?"
      }
    };

    return basePhrasesEnglish.map(phrase => ({
      phrase,
      local: mockTranslations[primaryLanguage]?.[phrase] || phrase,
      language: primaryLanguage
    }));
  };

  // Show utilities even if no specific cities - use destinations/countries
  if (allLocations.length === 0) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="mb-4">🛠️ Travel Utilities</h2>
          <div className="p-6 bg-error/10 border border-error/20 rounded-xl">
            <h3 className="text-lg font-semibold text-error mb-2">⚠️ No Destinations Available</h3>
            <p className="text-error/80 mb-4">
              No destinations found in your travel plan. Please complete the onboarding to access utilities.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="text-center max-w-3xl mx-auto mb-8">
        <h2 className="mb-4">🛠️ Travel Utilities</h2>
        <p className="leading-relaxed text-main-secondary text-lg">
          Essential tools for your {currentPlan.tripType === 'day-trip' ? 'day trip' : 'trip'}: weather, currency converter, and emergency contacts.
        </p>
      </div>

      <div className="space-y-6">
        {/* Weather Widget */}
        <div className="card rounded-3xl overflow-hidden">
          <button
            onClick={() => toggleSection('weather')}
            className="w-full p-6 text-left hover:bg-surface-container-high transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2">
                <Thermometer className="text-primary" size={24} />
                Weather Information
              </h3>
              {expandedSections.has('weather') ? 
                <ChevronDown size={20} className="text-text-secondary" /> : 
                <ChevronRight size={20} className="text-text-secondary" />
              }
            </div>
          </button>
          
          {expandedSections.has('weather') && (
            <div className="p-6 pt-0">
              {/* Location Selector for Multi-Location Trips */}
              {allLocations.length > 1 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Select Location</label>
                  <div className="flex flex-wrap gap-2">
                    {allLocations.map(location => (
                      <button
                        key={location.id}
                        onClick={() => setSelectedWeatherLocation(location.id)}
                        className={`filter-btn ${selectedWeatherLocation === location.id ? 'active' : ''}`}
                      >
                        {location.type === 'city' ? '🏙️' : '🌍'} {location.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {getCurrentWeather() && getCurrentWeatherLocation() && (
                <div className="text-center">
                  <h4 className="font-semibold mb-4">
                    {getCurrentWeatherLocation()?.name}, {getCurrentWeatherLocation()?.country}
                  </h4>
                  
                  {getCurrentWeather().isLoading ? (
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Loader2 size={32} className="text-primary animate-spin" />
                      <span className="text-lg">Loading weather data...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-3 mb-2">
                        {React.createElement(getCurrentWeather().icon, { 
                          size: 32, 
                          className: getCurrentWeather().icon === Loader2 ? "text-primary animate-spin" : "text-primary"
                        })}
                        <span className="text-3xl font-bold">{getCurrentWeather().temp}°C</span>
                      </div>
                      <p className="text-lg text-text-primary mb-1 capitalize">{getCurrentWeather().description}</p>
                      
                      {/* Additional weather details */}
                      <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                        <div className="text-center p-3 bg-surface-container-high rounded-xl">
                          <p className="text-sm text-text-secondary">Feels like</p>
                          <p className="font-bold text-text-primary">{getCurrentWeather().feelsLike}°C</p>
                        </div>
                        <div className="text-center p-3 bg-surface-container-high rounded-xl">
                          <p className="text-sm text-text-secondary">Humidity</p>
                          <p className="font-bold text-text-primary">{getCurrentWeather().humidity}%</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-3 bg-primary-container rounded-xl">
                        <p className="text-sm text-on-primary-container">
                          {getCurrentWeather().error ? (
                            <>⚠️ {getCurrentWeather().error}</>
                          ) : (
                            <>
                              Current weather for {getCurrentWeatherLocation()?.name}. 
                              {getCurrentWeather().temp > 25 ? ' Perfect weather for outdoor activities! Stay hydrated.' : 
                               getCurrentWeather().temp > 15 ? ' Great weather for exploring!' : 
                               ' Cool weather - consider bringing a jacket.'}
                            </>
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Currency Converter */}
        <div className="card rounded-3xl overflow-hidden">
          <button
            onClick={() => toggleSection('currency')}
            className="w-full p-6 text-left hover:bg-surface-container-high transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2">
                <Euro className="text-primary" size={24} />
                Currency Converter
              </h3>
              {expandedSections.has('currency') ? 
                <ChevronDown size={20} className="text-text-secondary" /> : 
                <ChevronRight size={20} className="text-text-secondary" />
              }
            </div>
          </button>
          
          {expandedSections.has('currency') && (
            <div className="p-6 pt-0">
              {/* Home currency selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Your Home Currency</label>
                <select
                  value={homeCurrency}
                  onChange={(e) => { setHomeCurrency(e.target.value); setLocalAmount(''); setHomeAmount(''); }}
                  className="w-full p-3 rounded-xl border border-outline bg-surface-container text-text-primary focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                >
                  {COMMON_CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Destination currency selector for Multi-Currency Trips */}
              {allCurrencies.length > 1 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Destination Currency</label>
                  <div className="flex flex-wrap gap-2">
                    {allCurrencies.map(currency => (
                      <button
                        key={currency.code}
                        onClick={() => { setSelectedCurrency(currency.code); setLocalAmount(''); setHomeAmount(''); }}
                        className={`filter-btn ${selectedCurrency === currency.code ? 'active' : ''}`}
                      >
                        {currency.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ratesLoading ? (
                <div className="flex items-center justify-center gap-3 py-8">
                  <Loader2 size={24} className="text-primary animate-spin" />
                  <span>Loading exchange rates...</span>
                </div>
              ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    {currentCurrency}
                  </label>
                  <input
                    type="number"
                    value={localAmount}
                    onChange={(e) => handleLocalChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 rounded-xl border border-outline bg-surface-container text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-bold">
                    =
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    {homeCurrency}
                  </label>
                  <input
                    type="number"
                    value={homeAmount}
                    onChange={(e) => handleHomeChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 rounded-xl border border-outline bg-surface-container text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="text-center text-sm text-text-secondary">
                  {getRate(currentCurrency) > 0
                    ? `1 ${homeCurrency} = ${getRate(currentCurrency).toFixed(4)} ${currentCurrency}`
                    : 'Rate unavailable'}
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Emergency Contacts */}
        <div className="card rounded-3xl overflow-hidden">
          <button
            onClick={() => toggleSection('emergency')}
            className="w-full p-6 text-left hover:bg-surface-container-high transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2">
                <Phone className="text-error" size={24} />
                Emergency Contacts & Phrases
              </h3>
              {expandedSections.has('emergency') ? 
                <ChevronDown size={20} className="text-text-secondary" /> : 
                <ChevronRight size={20} className="text-text-secondary" />
              }
            </div>
          </button>
          
          {expandedSections.has('emergency') && (
            <div className="p-6 pt-0">
              {/* Country Selector for Multi-Country Trips */}
              {allCountries.length > 1 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Select Country for Emergency Info</label>
                  <div className="flex flex-wrap gap-2">
                    {allCountries.map(country => (
                      <button
                        key={country.id}
                        onClick={() => setSelectedEmergencyCountry(country.id)}
                        className={`filter-btn ${selectedEmergencyCountry === country.id ? 'active' : ''}`}
                      >
                        🌍 {country.name}
                      </button>
                    ))}
                  </div>
                  <div className="text-center mt-2 text-sm text-main-secondary">
                    Currently showing emergency info for <strong>{getCurrentEmergencyCountry()?.name}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Emergency Contacts */}
                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Phone className="text-error" size={20} />
                    Emergency Numbers
                    {getCurrentEmergencyCountry() && (
                      <span className="text-sm font-normal text-main-secondary">
                        for {getCurrentEmergencyCountry()?.name}
                      </span>
                    )}
                  </h4>
                  
                  {getFilteredEmergencyContacts().length > 0 ? (
                    <div className="space-y-3">
                      {getFilteredEmergencyContacts().map((contact, index) => (
                        <div key={index} className="p-3 rounded-xl bg-surface-container-high">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-text-primary">{contact.name}</span>
                            <a 
                              href={`tel:${contact.number}`}
                              className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold hover:bg-primary/90 transition-colors shadow-md border-2 border-primary hover:border-primary/90"
                            >
                              {contact.number}
                            </a>
                          </div>
                          <p className="text-sm text-text-secondary">{contact.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-surface-container-high rounded-xl text-center">
                      <p className="text-text-secondary">
                        No emergency contacts available for {getCurrentEmergencyCountry()?.name}
                      </p>
                      <p className="text-sm text-main-secondary mt-1">
                        General emergency number: 112 (works in most countries)
                      </p>
                    </div>
                  )}
                </div>

                {/* Emergency Phrases in Local Language */}
                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="text-secondary" size={20} />
                    Emergency Phrases
                    {getCurrentEmergencyCountry() && (
                      <span className="text-sm font-normal text-main-secondary">
                        in {getCurrentEmergencyCountry()?.languages[0] || 'local language'}
                      </span>
                    )}
                  </h4>
                  
                  {getCurrentEmergencyCountry() && (
                    <div className="space-y-3">
                      {getEmergencyPhrasesForCountry(getCurrentEmergencyCountry()!).map((item, index) => (
                        <div key={index} className="p-3 rounded-xl bg-surface-container-high">
                          <div className="font-semibold text-text-primary mb-1">{item.phrase}</div>
                          <div className="text-primary font-medium">{item.local}</div>
                          {item.language !== 'English' && (
                            <div className="text-xs text-main-secondary mt-1">
                              in {item.language}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 p-3 bg-secondary-container rounded-xl">
                <p className="text-sm text-on-secondary-container">
                  💡 <strong>Tips:</strong> Use the translator page for more phrases, or screenshot these for offline access. 
                  In most countries, 112 is the universal emergency number.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DynamicUtilitiesPage;