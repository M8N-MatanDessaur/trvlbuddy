import React from 'react';
import { Sparkles, Volume2, Maximize2 } from 'lucide-react';
import { useContextualContent } from '../../hooks/useContextualContent';
import { useTravel } from '../../contexts/TravelContext';
import { groupTranslationsBySituation } from '../../utils/situationGroups';
import type { Translation } from '../../types/TravelData';

interface Props {
  langCode?: string;
  onSpeak: (text: string) => void;
  onShowToLocal: (phrases: { local: string; english: string; pronunciation?: string }[], index: number) => void;
}

const ContextualPhraseBanner: React.FC<Props> = ({ langCode, onSpeak, onShowToLocal }) => {
  const { moment, suggestedPhraseGroups, momentLabel } = useContextualContent();
  const { translations } = useTravel();

  if (moment.tripPhase !== 'active' || translations.length === 0) return null;

  // Gather top phrases from suggested groups
  const grouped = groupTranslationsBySituation(translations);
  const contextPhrases: Translation[] = [];
  const used = new Set<string>();

  for (const groupId of suggestedPhraseGroups) {
    const match = grouped.find((g) => g.group.id === groupId);
    if (!match) continue;
    for (const phrase of match.phrases) {
      if (used.has(phrase.english)) continue;
      contextPhrases.push(phrase);
      used.add(phrase.english);
      if (contextPhrases.length >= 4) break;
    }
    if (contextPhrases.length >= 4) break;
  }

  if (contextPhrases.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--accent-container)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Sparkles size={12} />
        </div>
        <div>
          <div className="text-[12px] font-bold" style={{ color: 'var(--accent)' }}>
            You might need these
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {momentLabel}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {contextPhrases.map((phrase, i) => (
          <div
            key={phrase.english}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'var(--surface-container)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold leading-tight">
                {phrase.local}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {phrase.english}
              </div>
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              <button
                onClick={() => onSpeak(phrase.local)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ color: 'var(--accent)' }}
              >
                <Volume2 size={16} />
              </button>
              <button
                onClick={() =>
                  onShowToLocal(
                    contextPhrases.map((p) => ({
                      local: p.local,
                      english: p.english,
                      pronunciation: p.pronunciation,
                    })),
                    i,
                  )
                }
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContextualPhraseBanner;
