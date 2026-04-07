import React, { useState, useMemo } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { translateCustomText } from '../services/aiService';
import { groupTranslationsBySituation } from '../utils/situationGroups';
import ShowToLocal from './ShowToLocal';
import { Volume2, Copy, Check, ArrowRight, Loader2, ChevronDown, ChevronRight, Maximize2 } from 'lucide-react';

const DynamicTranslatorPage: React.FC = () => {
  const { currentPlan, translations } = useTravel();
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [customText, setCustomText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [copiedText, setCopiedText] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('emergency');
  const [showToLocal, setShowToLocal] = useState<{ local: string; english: string; pronunciation?: string } | null>(null);

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

  const languages = useMemo(() => {
    const langs = new Set<string>();
    if (currentPlan.destination?.languages) currentPlan.destination.languages.forEach((l: string) => langs.add(l));
    currentPlan.segments?.forEach((s: any) => s.destination?.languages?.forEach((l: string) => langs.add(l)));
    return Array.from(langs);
  }, [currentPlan]);

  const currentLanguage = selectedLanguage || languages[0] || 'Local';

  const filteredTranslations = useMemo(() => {
    if (languages.length <= 1) return translations;
    return translations.filter(t => {
      const dest = currentPlan.segments?.find((s: any) => s.destination?.languages?.includes(currentLanguage));
      return dest ? t.destinationId === dest.destination?.id || !t.destinationId : true;
    });
  }, [translations, currentLanguage, currentPlan, languages]);

  const situationGroups = useMemo(() => groupTranslationsBySituation(filteredTranslations), [filteredTranslations]);

  const handleTranslate = async () => {
    if (!customText.trim()) return;
    setIsTranslating(true);
    setTranslationError('');
    setTranslatedText('');
    try {
      const result = await translateCustomText(customText.trim(), currentLanguage);
      setTranslatedText(result);
    } catch {
      setTranslationError('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Map language names to BCP 47 codes for speech synthesis
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
      // Try to find a matching voice
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
            <div className="flex gap-2 mt-2">
              <button onClick={() => speak(translatedText)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-container)', color: 'var(--accent)' }}><Volume2 size={18} /></button>
              <button onClick={() => copyText(translatedText)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-container)', color: copiedText === translatedText ? 'var(--success)' : 'var(--text-secondary)' }}>{copiedText === translatedText ? <Check size={18} /> : <Copy size={18} />}</button>
              <button onClick={() => setShowToLocal({ local: translatedText, english: customText })} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}><Maximize2 size={18} /></button>
            </div>
          </div>
        )}
        {translationError && <div className="text-[12px] text-center" style={{ color: 'var(--error)' }}>{translationError}</div>}
      </div>

      {/* Situation groups */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Phrase Book</h3>
        {situationGroups.map(({ group, phrases }) => {
          const isExpanded = expandedGroup === group.id;
          return (
            <div key={group.id} className="card overflow-hidden">
              <button onClick={() => setExpandedGroup(isExpanded ? null : group.id)} className="w-full flex items-center gap-3 p-4 text-left">
                <span className="text-xl">{group.emoji}</span>
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
                        <button onClick={() => setShowToLocal({ local: phrase.local, english: phrase.english, pronunciation: phrase.pronunciation })} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}><Maximize2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ShowToLocal isOpen={!!showToLocal} onClose={() => setShowToLocal(null)} localText={showToLocal?.local || ''} englishText={showToLocal?.english || ''} pronunciation={showToLocal?.pronunciation} langCode={langCodeMap[currentLanguage]} />
    </section>
  );
};

export default DynamicTranslatorPage;
