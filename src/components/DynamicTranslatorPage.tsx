import React, { useState } from 'react';
import { Volume2, Copy, Check, ArrowRightLeft, Loader2, Globe, Languages } from 'lucide-react';
import { useTravel } from '../contexts/TravelContext';
import { translateCustomText } from '../services/aiService';

const DynamicTranslatorPage: React.FC = () => {
  const { currentPlan, translations } = useTravel();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [copiedText, setCopiedText] = useState('');
  const [customText, setCustomText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="mb-4">No Travel Plan Found</h2>
          <p className="leading-relaxed text-main-secondary text-lg">
            Please complete the onboarding to use the translator.
          </p>
        </div>
      </section>
    );
  }

  // Get all unique languages from all destinations
  const getAllLanguages = () => {
    const languages = new Set<string>();
    
    if (currentPlan.tripType === 'single-destination' && currentPlan.destination) {
      currentPlan.destination.languages?.forEach(lang => languages.add(lang));
    } else {
      currentPlan.destinations?.forEach(dest => {
        dest.languages?.forEach(lang => languages.add(lang));
      });
    }
    
    return Array.from(languages).filter(lang => lang && lang.toLowerCase() !== 'english');
  };

  const allLanguages = getAllLanguages();
  const currentLanguage = selectedLanguage || allLanguages[0] || 'local language';

  // Set default language if not set
  React.useEffect(() => {
    if (!selectedLanguage && allLanguages.length > 0) {
      setSelectedLanguage(allLanguages[0]);
    }
  }, [allLanguages, selectedLanguage]);

  const categories = ['All', ...Array.from(new Set(translations.map(t => t.category)))];

  // Filter translations by selected language
  const languageFilteredTranslations = translations.filter(translation => {
    if (currentPlan.tripType === 'single-destination') {
      return true; // Show all for single destination
    }
    
    // For multi-destination, filter by language
    const destinationForTranslation = currentPlan.destinations?.find(dest => 
      dest.id === translation.destinationId
    );
    
    return destinationForTranslation?.languages?.includes(currentLanguage);
  });

  const filteredTranslations = languageFilteredTranslations.filter(translation => {
    const matchesSearch = translation.english.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         translation.local.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || translation.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(''), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedText(text);
      setTimeout(() => setCopiedText(''), 2000);
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (lang === 'local') {
        // Find the country code for the current language
        const destinationWithLanguage = currentPlan.destinations?.find(dest => 
          dest.languages?.includes(currentLanguage)
        );
        utterance.lang = destinationWithLanguage?.countryCode?.toLowerCase() || 'en';
      } else {
        utterance.lang = 'en-US';
      }
      
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const translateWithAI = async () => {
    if (!customText.trim()) return;

    setIsTranslating(true);
    setTranslationError('');
    setTranslatedText('');

    try {
      const translation = await translateCustomText(customText, currentLanguage);
      setTranslatedText(translation);
    } catch (error) {
      setTranslationError('Translation failed. Please check your connection and try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTranslating) {
      translateWithAI();
    }
  };

  return (
    <section className="page">
      <div className="text-center max-w-3xl mx-auto mb-8">
        <h2 className="mb-4 flex items-center justify-center gap-2"><Languages size={24} /> Multi-Language Translator</h2>
        <p className="leading-relaxed text-main-secondary text-lg">
          Essential phrases for your adventure, plus AI-powered translation for custom text!
        </p>
      </div>

      {/* Language Selector for Multi-Destination Trips */}
      {allLanguages.length > 1 && (
        <div className="card rounded-2xl p-6 mb-8">
          <h3 className="text-center mb-4 flex items-center justify-center gap-2">
            <Globe className="text-primary" size={24} />
            Select Language
          </h3>
          
          <div className="flex flex-wrap justify-center gap-2">
            {allLanguages.map(language => (
              <button
                key={language}
                onClick={() => setSelectedLanguage(language)}
                className={`filter-btn ${selectedLanguage === language ? 'active' : ''}`}
              >
                {language}
              </button>
            ))}
          </div>
          
          <div className="text-center mt-4 text-sm text-main-secondary">
            Currently showing phrases in <strong>{currentLanguage}</strong>
          </div>
        </div>
      )}

      {/* AI Translator Section */}
      <div className="card rounded-2xl p-6 mb-8">
        <h3 className="text-center mb-4 flex items-center justify-center gap-2">
          <ArrowRightLeft className="text-primary" size={24} />
          AI Translator
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Enter English text to translate to {currentLanguage}:
            </label>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your English text here..."
              className="w-full p-4 rounded-xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
            />
          </div>
          
          <button
            onClick={translateWithAI}
            disabled={!customText.trim() || isTranslating}
            className="action-button w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTranslating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <ArrowRightLeft size={20} />
                Translate to {currentLanguage}
              </>
            )}
          </button>
          
          {translatedText && (
            <div className="p-4 rounded-xl bg-primary-container">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-on-primary-container">{currentLanguage} Translation:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSpeak(translatedText, 'local')}
                    className="p-2 rounded-full hover:bg-primary/20 transition-colors"
                    title="Listen to pronunciation"
                  >
                    <Volume2 size={16} className="text-primary" />
                  </button>
                  <button
                    onClick={() => handleCopy(translatedText)}
                    className="p-2 rounded-full hover:bg-primary/20 transition-colors"
                    title="Copy translation"
                  >
                    {copiedText === translatedText ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} className="text-primary" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-lg font-semibold text-on-primary-container">{translatedText}</p>
            </div>
          )}
          
          {translationError && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20">
              <p className="text-error text-sm">{translationError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 space-y-4">
        <input
          type="text"
          placeholder="Search phrases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-4 rounded-2xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
        />
        
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Pre-defined Translation Cards */}
      <div className="space-y-3">
        {filteredTranslations.map((translation, index) => (
          <div key={index} className="card rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-text-primary">{translation.english}</span>
                  <button
                    onClick={() => handleSpeak(translation.english, 'english')}
                    className="p-1 rounded-full hover:bg-surface-container-high transition-colors"
                    title="Listen to English pronunciation"
                  >
                    <Volume2 size={16} className="text-text-secondary" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-primary text-lg">{translation.local}</span>
                  <button
                    onClick={() => handleSpeak(translation.local, 'local')}
                    className="p-1 rounded-full hover:bg-surface-container-high transition-colors"
                    title={`Listen to ${currentLanguage} pronunciation`}
                  >
                    <Volume2 size={16} className="text-primary" />
                  </button>
                </div>
                {translation.pronunciation && (
                  <div className="text-sm text-text-secondary italic">
                    Pronunciation: {translation.pronunciation}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 ml-4">
                <button
                  onClick={() => handleCopy(translation.local)}
                  className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
                  title={`Copy ${currentLanguage} text`}
                >
                  {copiedText === translation.local ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} className="text-text-secondary" />
                  )}
                </button>
                <span className="text-xs px-2 py-1 rounded-full bg-primary-container text-on-primary-container">
                  {translation.category}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTranslations.length === 0 && (
        <div className="text-center py-8">
          <p className="text-text-secondary">
            {searchTerm 
              ? `No translations found for "${searchTerm}" in ${currentLanguage}`
              : `No translations available for ${currentLanguage}`
            }
          </p>
        </div>
      )}
    </section>
  );
};

export default DynamicTranslatorPage;