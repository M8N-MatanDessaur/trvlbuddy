import React, { useState, useRef, useEffect } from 'react';
import { Send, MapPin, Navigation, Loader2, LocateFixed } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { useChat, ChatMessage } from '../contexts/ChatContext';
import { chatWithTripAssistant } from '../services/aiService';
import { getCurrentLocation, getCachedLocation, startWatchingLocation, UserLocation } from '../utils/geolocation';

const ChatPage: React.FC = () => {
  const { currentPlan, activities } = useTravel();
  const { messages, addMessage, setMessages } = useChat();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(getCachedLocation());
  const [locationLoading, setLocationLoading] = useState(false);

  // Welcome message on first mount (only if no messages yet)
  useEffect(() => {
    if (messages.length === 0 && currentPlan) {
      const destinations = currentPlan.destinations || [];
      const destLabel = destinations.length > 1
        ? destinations.map(d => d.name).join(', ')
        : destinations[0]?.name || currentPlan.destination?.name || 'your trip';
      setMessages([{
        id: 'welcome',
        type: 'assistant',
        content: `Hey! I'm your travel assistant for ${destLabel}. Ask me anything: restaurant recommendations, directions, local tips, or help planning your day.`,
        timestamp: new Date(),
        suggestions: [
          'Best restaurants nearby?',
          'What should I do today?',
          'How do I get around?',
        ],
      }]);
    }
  }, [currentPlan]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Don't auto-focus input (prevents keyboard from opening on page load)
    // Start watching location in background
    startWatchingLocation(loc => setUserLocation(loc));
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = text || inputValue.trim();
    if (!msg || isLoading || !currentPlan) return;
    setInputValue('');

    const userMsg: ChatMessage = { id: Date.now().toString(), type: 'user', content: msg, timestamp: new Date() };
    addMessage(userMsg);
    setIsLoading(true);

    try {
      // Append location context to the message if available
      let enrichedMsg = msg;
      if (userLocation) {
        enrichedMsg += ` [USER_LOCATION: ${userLocation.lat},${userLocation.lng}]`;
      }
      const response = await chatWithTripAssistant(enrichedMsg, currentPlan, activities);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.content || 'Sorry, I could not process that.',
        timestamp: new Date(),
        suggestions: response.suggestions,
        locations: response.locations,
      };
      addMessage(assistantMsg);
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentPlan) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: 'var(--text-secondary)' }}>Set up your trip first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col -mx-5 -mt-2 flex-1" style={{ minHeight: 0 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[82%] px-4 py-3"
              style={{
                background: msg.type === 'user' ? 'var(--accent)' : 'var(--surface-container)',
                color: msg.type === 'user' ? 'white' : 'var(--text-primary)',
                borderRadius: msg.type === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              }}
            >
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>

              {/* Locations */}
              {msg.locations && msg.locations.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {msg.locations.map((loc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'var(--surface-container-high)' }}>
                      <MapPin size={14} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{loc.name}</div>
                        <div className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{loc.address}</div>
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <Navigation size={12} />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {msg.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-[0.98]"
                      style={{ background: 'var(--accent-container)', color: 'var(--accent)', border: '1px solid var(--outline)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="text-[10px] mt-2 text-right" style={{ opacity: 0.35 }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: 'var(--surface-container)' }}>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3" style={{ borderTop: '0.33px solid var(--outline)' }}>
        {/* Location status */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={async () => {
              setLocationLoading(true);
              try {
                const loc = await getCurrentLocation();
                setUserLocation(loc);
              } catch {}
              setLocationLoading(false);
            }}
            className="flex items-center gap-1.5 px-2.5 text-[11px] font-medium transition-all active:scale-95"
            style={{
              height: '28px',
              borderRadius: '14px',
              background: userLocation ? 'var(--accent-container)' : 'var(--surface-container)',
              color: userLocation ? 'var(--accent)' : 'var(--text-tertiary)',
            }}
          >
            {locationLoading ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={12} />}
            {userLocation ? 'Location active' : 'Enable location'}
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={userLocation ? 'Ask about things near you...' : 'Ask me anything...'}
            className="flex-1 px-4 py-3 rounded-2xl text-[14px] border-none outline-none"
            style={{ background: 'var(--surface-container)', color: 'var(--text-primary)' }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
