import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { translateWithPronunciation } from '../services/aiService';
import { groupTranslationsBySituation, getContextualGroups } from '../utils/situationGroups';
import { useContextualContent } from '../hooks/useContextualContent';
import ContextualPhraseBanner from './language/ContextualPhraseBanner';
import ShowToLocal from './ShowToLocal';
import { Volume2, Copy, Check, ArrowRight, Loader2, ChevronDown, ChevronRight, Maximize2, BookmarkPlus, Bookmark, Trash2 } from 'lucide-react';

const DynamicTranslatorPage: React.FC = () => {
  const { currentPlan, translations } = useTravel();
  const { moment, suggestedPhraseGroups } = useContextualContent();
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [customText, setCustomText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translatedPronunciation, setTranslatedPronunciation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');

  interface SavedWord { english: string; local: string; pronunciation: string; language: string; savedAt: number; }
  const MY_WORDS_KEY = 'myWords';
  const [savedWords, setSavedWords] = useState<SavedWord[]>(() => {
    try { return JSON.parse(localStorage.getItem(MY_WORDS_KEY) || '[]'); } catch { return []; }
  });
  const [copiedText, setCopiedText] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const userToggledAccordion = useRef(false);
  const [showToLocalData, setShowToLocalData] = useState<{ phrases: { local: string; english: string; pronunciation?: string }[]; index: number } | null>(null);

  if (!currentPlan) {
    return (
      <section className="page">
        <div className="text-center py-16">
          <h2 className="mb-3">No Travel Plan</h2>
          <p className="text-[var(--text-secondary)]">Complete onboarding for translations.</p>
        </div>
      </section>
    );
  }

  // Build a map of language -> destinationId for filtering, excluding English
  // since all phrases already show English in the left column.
  const languageDestMap = useMemo(() => {
    const map = new Map<string, string>();
    const destinations = currentPlan.destinations || (currentPlan.destination ? [currentPlan.destination] : []);
    for (const dest of destinations) {
      const primary = dest.languages?.[0];
      if (primary && primary.toLowerCase() !== 'english') {
        map.set(primary, dest.id);
      }
    }
    // Also check segments for destinations not in the top-level array
    currentPlan.segments?.forEach((s: any) => {
      const primary = s.destination?.languages?.[0];
      if (primary && primary.toLowerCase() !== 'english' && !map.has(primary)) {
        map.set(primary, s.destination.id);
      }
    });
    return map;
  }, [currentPlan]);

  const languages = useMemo(() => Array.from(languageDestMap.keys()), [languageDestMap]);

  const currentLanguage = selectedLanguage || languages[0] || 'Local';

  const filteredTranslations = useMemo(() => {
    if (languages.length <= 1) return translations;
    const destId = languageDestMap.get(currentLanguage);
    if (!destId) return translations;
    return translations.filter(t => t.destinationId === destId || !t.destinationId);
  }, [translations, currentLanguage, languageDestMap, languages]);

  // Context-aware group ordering
  const situationGroups = useMemo(() => {
    const base = groupTranslationsBySituation(filteredTranslations);
    if (moment.tripPhase === 'active') {
      return getContextualGroups(base, suggestedPhraseGroups);
    }
    return base;
  }, [filteredTranslations, moment.tripPhase, suggestedPhraseGroups]);

  // Auto-expand the most relevant group on mount only (skip if user manually toggled)
  useEffect(() => {
    if (userToggledAccordion.current) return;
    if (moment.tripPhase === 'active' && suggestedPhraseGroups.length > 0) {
      const match = situationGroups.find(
        (g) => suggestedPhraseGroups.includes(g.group.id) && g.phrases.length > 0,
      );
      if (match) {
        setExpandedGroup(match.group.id);
        return;
      }
    }
    setExpandedGroup('emergency');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTranslate = async () => {
    if (!customText.trim()) return;
    setIsTranslating(true);
    setTranslationError('');
    setTranslatedText('');
    setTranslatedPronunciation('');
    try {
      const result = await translateWithPronunciation(customText.trim(), currentLanguage);
      setTranslatedText(result.translation);
      setTranslatedPronunciation(result.pronunciation);
    } catch {
      setTranslationError('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const saveWord = () => {
    if (!translatedText || !customText.trim()) return;
    const word: SavedWord = { english: customText.trim(), local: translatedText, pronunciation: translatedPronunciation, language: currentLanguage, savedAt: Date.now() };
    const updated = [word, ...savedWords.filter(w => !(w.english === word.english && w.language === word.language))];
    setSavedWords(updated);
    localStorage.setItem(MY_WORDS_KEY, JSON.stringify(updated));
  };

  const removeWord = (index: number) => {
    const updated = savedWords.filter((_, i) => i !== index);
    setSavedWords(updated);
    localStorage.setItem(MY_WORDS_KEY, JSON.stringify(updated));
  };

  const isWordSaved = translatedText && savedWords.some(w => w.english === customText.trim() && w.language === currentLanguage);

  const myWordsForLanguage = savedWords.filter(w => w.language === currentLanguage);

  const langCodeMap: Record<string, string> = {
    'Korean': 'ko-KR', 'Japanese': 'ja-JP', 'Chinese': 'zh-CN', 'Mandarin': 'zh-CN',
    'French': 'fr-FR', 'Spanish': 'es-ES', 'Italian': 'it-IT', 'German': 'de-DE',
    'Portuguese': 'pt-BR', 'Russian': 'ru-RU', 'Arabic': 'ar-SA', 'Hindi': 'hi-IN',
    'Thai': 'th-TH', 'Vietnamese': 'vi-VN', 'Turkish': 'tr-TR', 'Dutch': 'nl-NL',
    'Greek': 'el-GR', 'Polish': 'pl-PL', 'Swedish': 'sv-SE', 'Danish': 'da-DK',
    'Norwegian': 'nb-NO', 'Finnish': 'fi-FI', 'Czech': 'cs-CZ', 'Hungarian': 'hu-HU',
    'Romanian': 'ro-RO', 'Indonesian': 'id-ID', 'Malay': 'ms-MY', 'Tagalog': 'fil-PH',
    'English': 'en-US', 'Hebrew': 'he-IL',
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const langCode = langCodeMap[currentLanguage] || 'en-US';
      u.lang = langCode;
      u.rate = 0.85;
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
      if (match) u.voice = match;
      window.speechSynthesis.speak(u);
    }
  };

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <section className="page space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Language</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">{currentLanguage} phrases and AI translator</p>
      </div>

      {languages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {languages.map(lang => (
            <button key={lang} onClick={() => setSelectedLanguage(lang)} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all" style={{ background: lang === currentLanguage ? 'var(--accent)' : 'var(--surface-container)', color: lang === currentLanguage ? 'white' : 'var(--text-secondary)' }}>
              {lang}
            </button>
          ))}
        </div>
      )}

      {/* Contextual phrase banner */}
      <ContextualPhraseBanner
        langCode={langCodeMap[currentLanguage]}
        onSpeak={speak}
        onShowToLocal={(phrases, index) => setShowToLocalData({ phrases, index })}
      />

      {/* AI Translator */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <input type="text" value={customText} onChange={e => setCustomText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTranslate()} placeholder={`Translate to ${currentLanguage}...`} className="flex-1 px-4 py-3 rounded-xl text-[14px] border-none outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          <button onClick={handleTranslate} disabled={isTranslating || !customText.trim()} className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40" style={{ background: 'var(--accent)', color: 'white' }}>
            {isTranslating ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          </button>
        </div>
        {translatedText && (
          <div className="p-3 rounded-xl" style={{ background: 'var(--accent-container)' }}>
            <div className="text-[16px] font-bold mb-1" style={{ color: 'var(--on-accent-container)' }}>{translatedText}</div>
            {translatedPronunciation && (
              <div className="text-[12px] mb-1" style={{ color: 'var(--on-accent-container)', opacity: 0.7 }}>{translatedPronunciation}</div>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={() => speak(translatedText)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-container)', color: 'var(--accent)' }}><Volume2 size={18} /></button>
              <button onClick={() => copyText(translatedText)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-container)', color: copiedText === translatedText ? 'var(--success)' : 'var(--text-secondary)' }}>{copiedText === translatedText ? <Check size={18} /> : <Copy size={18} />}</button>
              <button onClick={() => setShowToLocalData({ phrases: [{ local: translatedText, english: customText, pronunciation: translatedPronunciation }], index: 0 })} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}><Maximize2 size={18} /></button>
              <button onClick={saveWord} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-container)', color: isWordSaved ? 'var(--success)' : 'var(--text-secondary)' }}>{isWordSaved ? <Bookmark size={18} /> : <BookmarkPlus size={18} />}</button>
            </div>
          </div>
        )}
        {translationError && <div className="text-[12px] text-center" style={{ color: 'var(--error)' }}>{translationError}</div>}
      </div>

      {/* My Words */}
      {myWordsForLanguage.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">My Words</h3>
          <div className="card overflow-hidden">
            {myWordsForLanguage.map((word, i) => (
              <div key={word.savedAt} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold leading-tight">{word.local}</div>
                  {word.pronunciation && <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{word.pronunciation}</div>}
                  <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{word.english}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => speak(word.local)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--accent)' }}><Volume2 size={18} /></button>
                  <button onClick={() => copyText(word.local)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: copiedText === word.local ? 'var(--success)' : 'var(--text-tertiary)' }}>{copiedText === word.local ? <Check size={18} /> : <Copy size={18} />}</button>
                  <button onClick={() => setShowToLocalData({ phrases: myWordsForLanguage.map(w => ({ local: w.local, english: w.english, pronunciation: w.pronunciation })), index: i })} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}><Maximize2 size={18} /></button>
                  <button onClick={() => removeWord(savedWords.indexOf(word))} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Situation groups */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Phrase Book</h3>
        {situationGroups.map(({ group, phrases }) => {
          const isExpanded = expandedGroup === group.id;
          return (
            <div key={group.id} className="card overflow-hidden">
              <button onClick={() => { userToggledAccordion.current = true; setExpandedGroup(isExpanded ? null : group.id); }} className="w-full flex items-center gap-3 p-4 text-left">
                <div className="flex items-center justify-center flex-shrink-0" style={{ height: '36px', aspectRatio: '1', borderRadius: '12px', background: 'var(--accent-container)', color: 'var(--accent)' }}>
                  <group.icon size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-bold">{group.title}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{phrases.length} phrases</div>
                </div>
                {isExpanded ? <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />}
              </button>
              {isExpanded && (
                <div style={{ borderTop: '0.33px solid var(--outline)' }}>
                  {phrases.map((phrase, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? '0.33px solid var(--outline)' : 'none' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold leading-tight">{phrase.local}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{phrase.pronunciation}</div>
                        <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{phrase.english}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => speak(phrase.local)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--accent)' }}><Volume2 size={18} /></button>
                        <button onClick={() => copyText(phrase.local)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: copiedText === phrase.local ? 'var(--success)' : 'var(--text-tertiary)' }}>{copiedText === phrase.local ? <Check size={18} /> : <Copy size={18} />}</button>
                        <button onClick={() => setShowToLocalData({ phrases: phrases.map(p => ({ local: p.local, english: p.english, pronunciation: p.pronunciation })), index: i })} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}><Maximize2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ShowToLocal
        isOpen={!!showToLocalData}
        onClose={() => setShowToLocalData(null)}
        phrases={showToLocalData?.phrases || []}
        startIndex={showToLocalData?.index || 0}
        langCode={langCodeMap[currentLanguage]}
      />
    </section>
  );
};

export default DynamicTranslatorPage;
