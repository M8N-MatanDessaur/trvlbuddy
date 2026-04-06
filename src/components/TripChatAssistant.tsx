import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle, MapPin, ExternalLink, Navigation, Loader2 } from 'lucide-react';
import { TravelPlan, GeneratedActivity } from '../types/TravelData';
import { chatWithTripAssistant } from '../services/aiService';

interface TripChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  travelPlan: TravelPlan;
  activities: GeneratedActivity[];
  selectedCity?: {
    id: string;
    name: string;
    destination: any;
    city: any;
  } | null;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  locations?: {
    name: string;
    address: string;
    type: 'restaurant' | 'attraction' | 'hotel' | 'general';
  }[];
}

const TripChatAssistant: React.FC<TripChatAssistantProps> = ({
  isOpen,
  onClose,
  travelPlan,
  activities,
  selectedCity
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        type: 'assistant',
        content: getWelcomeMessage(),
        timestamp: new Date(),
        suggestions: getSuggestions()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, travelPlan, selectedCity]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const getWelcomeMessage = () => {
    const currentLocation = selectedCity 
      ? `${selectedCity.city.name}, ${selectedCity.destination.country}`
      : travelPlan.tripType === 'day-trip' 
        ? `${travelPlan.destination?.name || travelPlan.destinations[0]?.name}`
        : 'your destinations';

    return `👋 Hi! I'm your AI travel assistant with full knowledge of your ${travelPlan.tripType === 'day-trip' ? 'day trip' : 'trip'} to ${currentLocation}.

I can help you with:
🍽️ Restaurant recommendations near your hotels
🗺️ Directions and transportation
🎯 Specific activity suggestions
⏰ Timing and logistics
🏨 Local tips and insider knowledge

What would you like to know about your trip?`;
  };

  const getSuggestions = () => {
    const currentLocation = selectedCity?.city.name || travelPlan.destination?.name || travelPlan.destinations[0]?.name;
    
    return [
      `Find Italian restaurants near my hotel in ${currentLocation}`,
      `What's the best way to get around ${currentLocation}?`,
      `Suggest a romantic dinner spot for tonight`,
      `What should I do if it rains?`,
      `Find breakfast places within walking distance`
    ];
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatWithTripAssistant(text, travelPlan, activities, selectedCity);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: response.content,
        timestamp: new Date(),
        locations: response.locations,
        suggestions: response.suggestions
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'restaurant': return '🍽️';
      case 'attraction': return '🎯';
      case 'hotel': return '🏨';
      default: return '📍';
    }
  };

  const openInMaps = (location: string) => {
    const query = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const getDirections = (location: string) => {
    const query = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end p-4 z-[70]">
      <div className="bg-surface-container rounded-3xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden border border-outline">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline bg-primary-container">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-on-primary-container">AI Travel Assistant</h3>
              <p className="text-xs text-on-primary-container/70">
                {selectedCity ? `Planning for ${selectedCity.city.name}` : 'Trip Planning Helper'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-primary/20 transition-colors text-on-primary-container"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-3 ${
                message.type === 'user' 
                  ? 'bg-primary text-on-primary' 
                  : 'bg-surface-container-high text-text-primary'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
                
                {/* Locations */}
                {message.locations && message.locations.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.locations.map((location, index) => (
                      <div key={index} className="p-2 bg-surface-container rounded-xl border border-outline">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="text-lg flex-shrink-0">{getLocationIcon(location.type)}</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-text-primary truncate">{location.name}</div>
                              <div className="text-xs text-text-secondary">{location.address}</div>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => openInMaps(location.address)}
                              className="p-1 rounded-full hover:bg-primary/20 transition-colors"
                              title="View on map"
                            >
                              <MapPin size={14} className="text-primary" />
                            </button>
                            <button
                              onClick={() => getDirections(location.address)}
                              className="p-1 rounded-full hover:bg-primary/20 transition-colors"
                              title="Get directions"
                            >
                              <Navigation size={14} className="text-primary" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs text-text-secondary mb-2">💡 Try asking:</div>
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSendMessage(suggestion)}
                        className="block w-full text-left p-2 text-xs bg-surface-container hover:bg-surface-container-high rounded-lg transition-colors text-text-primary border border-outline"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="text-xs opacity-60 mt-2">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface-container-high text-text-primary rounded-2xl p-3 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-outline">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about restaurants, directions, activities..."
              className="flex-1 p-3 rounded-xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="p-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
          
          <div className="text-xs text-text-secondary mt-2 text-center">
            AI assistant with knowledge of your trip details
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripChatAssistant;