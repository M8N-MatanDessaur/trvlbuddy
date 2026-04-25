import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { searchMentionCandidates, type MentionSuggestion } from '../lib/mentions';

interface Props {
  query: string | null;
  onSelect: (suggestion: MentionSuggestion) => void;
}

// Floating popover above the comment input. Debounces the profile lookup
// and keeps a stable ordering so the user can tap without the list
// reshuffling on every keystroke.

const MentionSuggestions: React.FC<Props> = ({ query, onSelect }) => {
  const [results, setResults] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (query === null) {
      setResults([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      if (query.trim().length === 0) {
        setResults([]);
        return;
      }
      setLoading(true);
      const rows = await searchMentionCandidates(query);
      setLoading(false);
      setResults(rows);
    }, 120);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (query === null) return null;
  if (!loading && results.length === 0 && query.trim().length === 0) return null;

  return (
    <div
      className="absolute left-0 right-0 mb-2 rounded-2xl overflow-hidden"
      style={{
        bottom: '100%',
        background: 'var(--surface-container)',
        border: '0.5px solid var(--outline)',
        boxShadow: '0 12px 32px -8px rgba(0,0,0,0.25)',
        zIndex: 10,
      }}
    >
      {loading ? (
        <div
          className="flex items-center justify-center py-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div
          className="px-4 py-3 text-[12.5px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          No travelers matching &quot;{query}&quot;
        </div>
      ) : (
        <ul>
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(r)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                style={{
                  background: 'transparent',
                  borderBottom: i < results.length - 1 ? '0.33px solid var(--outline)' : 'none',
                  color: 'var(--text-primary)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                  style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                >
                  {r.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{r.display_name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {r.influence} Influence
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MentionSuggestions;
