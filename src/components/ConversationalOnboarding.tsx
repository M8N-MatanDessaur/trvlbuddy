import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Plane, Check, Sparkles, Globe, Languages, Wrench, ArrowRight, Upload } from 'lucide-react';
import { importTripFromJson, TripBundle } from '../utils/tripShare';

import { useTravel } from '../contexts/TravelContext';
import { useToast } from '../contexts/ToastContext';
import { TravelPlan, Destination } from '../types/TravelData';
import { onboardingChat, OnboardingExtraction, generateTravelContent, generateDestinationInfo } from '../services/aiService';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
}

const ConversationalOnboarding: React.FC = () => {
  const { setCurrentPlan, setHasCompletedOnboarding, setIsLoading, setActivities, setTranslations, setEmergencyContacts } = useTravel();
  const [showLanding, setShowLanding] = useState(true);
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'assistant',
      content: "Hey there! I'm excited to help you plan your next adventure. Where are you heading?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [extraction, setExtraction] = useState<OnboardingExtraction | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isThinking]);

  const conversationHistory = messages.map(m => ({ role: m.type as 'user' | 'assistant', text: m.content }));

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isThinking || isGenerating) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), type: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const result = await onboardingChat(conversationHistory, msg);
      setExtraction(result);

      const aiMsg: Message = { id: (Date.now() + 1).toString(), type: 'assistant', content: result.aiResponse };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "Sorry, I had trouble understanding that. Could you tell me again where you'd like to go?",
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCreateTrip = async () => {
    if (!extraction?.destination) return;
    setIsGenerating(true);
    setIsLoading(true);

    try {
      // Get destination info from AI
      const destInfo = await generateDestinationInfo(extraction.destination, extraction.country || '');

      const destination: Destination = {
        id: `dest_${Date.now()}`,
        name: extraction.destination,
        country: extraction.country || '',
        countryCode: destInfo.countryCode || '',
        currency: destInfo.currency || '',
        languages: destInfo.languages || [],
        emergencyNumber: destInfo.emergencyNumber || '112',
        timezone: destInfo.timezone || '',
        coordinates: destInfo.coordinates || { lat: 0, lng: 0 },
      };

      const isDayTrip = extraction.tripType === 'day-trip' || (extraction.duration && extraction.duration <= 1);
      const today = new Date();
      const startDate = extraction.startDate || today.toISOString().split('T')[0];
      const endDate = (() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + (extraction.duration || 1) - 1);
        return d.toISOString().split('T')[0];
      })();

      const travelPlan: TravelPlan = {
        id: `plan_${Date.now()}`,
        title: isDayTrip ? `${extraction.destination} Day Trip` : `${extraction.destination} Adventure`,
        tripType: isDayTrip ? 'day-trip' : 'full-trip',
        destinations: [destination],
        segments: [{
          id: `segment_${Date.now()}`,
          destination,
          city: { id: `city_${Date.now()}`, name: extraction.destination, coordinates: destination.coordinates, countryId: destination.id },
          startDate,
          endDate,
          accommodations: extraction.accommodation ? [{
            id: `acc_${Date.now()}`,
            name: extraction.accommodation,
            address: extraction.accommodationAddress || '',
            checkIn: startDate,
            checkOut: endDate,
          }] : [],
        }],
        startDate,
        endDate,
        travelers: extraction.travelers || 1,
        interests: extraction.interests.length > 0 ? extraction.interests : ['Food & Dining', 'Culture & Shows', 'Historical Sites'],
        budget: extraction.budget || 'mid-range',
        createdAt: new Date().toISOString(),
      };

      await generateTravelContent(travelPlan, setActivities, setTranslations, setEmergencyContacts);
      setCurrentPlan(travelPlan);
      setIsLoading(false);
      setHasCompletedOnboarding(true);
    } catch {
      toast('Failed to create your trip. Please try again.', 'error');
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const extractedItems = extraction ? [
    extraction.destination && `${extraction.destination}${extraction.country ? `, ${extraction.country}` : ''}`,
    extraction.travelers && `${extraction.travelers} traveler${extraction.travelers !== 1 ? 's' : ''}`,
    extraction.duration && `${extraction.duration} day${extraction.duration !== 1 ? 's' : ''}`,
    extraction.interests.length > 0 && extraction.interests.slice(0, 3).join(', '),
    extraction.budget && extraction.budget,
  ].filter(Boolean) : [];

  if (showLanding) {
    return (
      <div className="flex flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg-primary)', height: '100dvh' }}>
        <div className="flex items-center justify-center mb-6" style={{ height: '72px', aspectRatio: '1', borderRadius: '50%', background: 'var(--accent)', color: 'white' }}>
          <Plane size={32} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">TrvlBuddy</h1>
        <p className="text-[15px] leading-relaxed mb-8 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          Your AI travel companion. Activities, phrases, tools, all personalized for your trip.
        </p>

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-10">
          {[
            { icon: Sparkles, label: 'AI Planning', desc: 'Smart itineraries' },
            { icon: Globe, label: 'Activities', desc: 'Local discoveries' },
            { icon: Languages, label: 'Translator', desc: 'Key phrases' },
            { icon: Wrench, label: 'Tools', desc: 'Currency & more' },
          ].map((f, i) => (
            <div key={i} className="p-3.5 rounded-2xl text-left" style={{ background: 'var(--surface-container)' }}>
              <f.icon size={18} style={{ color: 'var(--accent)' }} className="mb-2" />
              <div className="text-[12px] font-bold">{f.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowLanding(false)}
          className="w-full max-w-xs flex items-center justify-center gap-2 py-4 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          Plan My Trip
          <ArrowRight size={18} />
        </button>

        <label
          className="w-full max-w-xs flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-semibold mt-3 cursor-pointer transition-all active:scale-[0.98]"
          style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}
        >
          <Upload size={16} />
          Import Shared Trip
          <input
            type="file"
            accept=".trvlbuddy,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const bundle = importTripFromJson(text);
              if (bundle) {
                setCurrentPlan(bundle.plan);
                setActivities(bundle.activities);
                setTranslations(bundle.translations);
                setEmergencyContacts(bundle.emergencyContacts);
                if (bundle.savedActivities) {
                  localStorage.setItem('savedActivities', JSON.stringify(bundle.savedActivities));
                }
                setHasCompletedOnboarding(true);
              } else {
                toast('Invalid trip file. Please try again.', 'error');
              }
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ background: 'var(--bg-primary)', height: '100dvh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', color: 'white' }}>
            <Plane size={15} />
          </div>
          <span className="text-base font-extrabold tracking-tight">TrvlBuddy</span>
        </div>
        <p className="text-[13px] mt-2" style={{ color: 'var(--text-secondary)' }}>
          Tell me about your trip and I'll set everything up
        </p>
      </div>

      {/* Extracted info bar */}
      {extractedItems.length > 0 && (
        <div className="px-5 pb-2 flex-shrink-0">
          <div className="flex gap-2 flex-wrap">
            {extractedItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}>
                <Check size={10} /> {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3" style={{ minHeight: 0 }}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] px-4 py-3 text-[14px] leading-relaxed"
              style={{
                background: msg.type === 'user' ? 'var(--accent)' : 'var(--surface-container)',
                color: msg.type === 'user' ? 'white' : 'var(--text-primary)',
                borderRadius: msg.type === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: 'var(--surface-container)' }}>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Create Trip button (when extraction is complete) */}
      {extraction?.complete && !isGenerating && (
        <div className="px-5 py-3 flex-shrink-0">
          <button
            onClick={handleCreateTrip}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98]"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Sparkles size={18} />
            Create My Trip
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="px-5 py-3 flex-shrink-0">
          <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[15px] font-semibold" style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}>
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
            Building your travel guide...
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '0.33px solid var(--outline)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Tell me about your trip..."
            className="flex-1 px-4 py-3.5 rounded-2xl text-[14px] border-none outline-none"
            style={{ background: 'var(--surface-container)', color: 'var(--text-primary)' }}
            disabled={isThinking || isGenerating}
          />
          <button
            onClick={() => send()}
            disabled={isThinking || isGenerating || !input.trim()}
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

export default ConversationalOnboarding;
