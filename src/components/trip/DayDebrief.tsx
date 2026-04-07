import React, { useState } from 'react';
import { BookOpen, Loader2, MapPin, Footprints, Smile, Meh, Frown, Star, ChevronDown, ChevronRight } from 'lucide-react';
import { useContextEngine } from '../../contexts/ContextEngineContext';
import { useTravel } from '../../contexts/TravelContext';
import { useContextualContent } from '../../hooks/useContextualContent';
import { getTodayHistory, calculateDistanceWalked } from '../../services/locationHistoryService';
import { generateDayDebrief } from '../../services/aiService';
import type { JournalEntry } from '../../types/TravelData';

const moods = [
  { id: 'amazing', icon: Star, label: 'Amazing' },
  { id: 'good', icon: Smile, label: 'Good' },
  { id: 'okay', icon: Meh, label: 'Okay' },
  { id: 'tired', icon: Frown, label: 'Tired' },
];

const DayDebrief: React.FC = () => {
  const { moment } = useContextEngine();
  const { showDebrief } = useContextualContent();
  const { journalEntries, addJournalEntry, activities } = useTravel();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showJournal, setShowJournal] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = journalEntries.find((e) => e.date === today);

  // Show the debrief prompt only during evening/late-night of an active trip
  const canDebrief = showDebrief && !todayEntry;

  const handleDebrief = async () => {
    if (!moment.currentDestination) return;

    setIsGenerating(true);
    try {
      const pings = getTodayHistory();
      const distanceKm = calculateDistanceWalked(pings);

      // For now, we cannot match pings to activity coordinates without geocoding
      // So we pass an empty list and let the AI write a general entry
      const placesVisited: string[] = [];

      const summary = await generateDayDebrief(
        moment.currentDestination.name,
        moment.dayOfTrip,
        placesVisited,
        distanceKm,
        selectedMood || undefined,
      );

      const entry: JournalEntry = {
        date: today,
        dayNumber: moment.dayOfTrip,
        destinationName: moment.currentDestination.name,
        placesVisited,
        distanceKm,
        mood: selectedMood || undefined,
        generatedSummary: summary,
        createdAt: new Date().toISOString(),
      };

      addJournalEntry(entry);
    } catch {
      // silently fail
    } finally {
      setIsGenerating(false);
    }
  };

  // Sort entries newest first for the timeline
  const sortedEntries = [...journalEntries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      {/* Debrief prompt card */}
      {canDebrief && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'var(--accent-container)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <BookOpen size={14} />
            </div>
            <div>
              <div className="text-[13px] font-bold" style={{ color: 'var(--accent)' }}>
                How was your day?
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                Day {moment.dayOfTrip} in {moment.currentDestination?.name}
              </div>
            </div>
          </div>

          {/* Mood selector */}
          <div className="flex gap-2">
            {moods.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                style={{
                  background: selectedMood === m.id ? 'var(--accent)' : 'var(--surface-container)',
                  color: selectedMood === m.id ? 'white' : 'var(--text-secondary)',
                }}
              >
                <m.icon size={18} />
                <span className="text-[10px] font-semibold">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={handleDebrief}
            disabled={isGenerating}
            className="w-full py-3 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Writing your journal...
              </span>
            ) : (
              'Generate Day Journal'
            )}
          </button>
        </div>
      )}

      {/* Today's entry (if just created) */}
      {todayEntry && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-[13px] font-bold">
              Day {todayEntry.dayNumber} Journal
            </span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {todayEntry.generatedSummary}
          </p>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            {todayEntry.distanceKm > 0 && (
              <span className="flex items-center gap-1">
                <Footprints size={10} />
                {todayEntry.distanceKm.toFixed(1)} km walked
              </span>
            )}
            {todayEntry.mood && (
              <span className="capitalize">{todayEntry.mood}</span>
            )}
          </div>
        </div>
      )}

      {/* Journal timeline (past entries) */}
      {sortedEntries.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowJournal(!showJournal)}
            className="flex items-center gap-1.5 px-1"
          >
            {showJournal ? (
              <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
            ) : (
              <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />
            )}
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
              Trip Journal ({sortedEntries.length})
            </span>
          </button>

          {showJournal && (
            <div className="space-y-2">
              {sortedEntries.map((entry) => (
                <div key={entry.date} className="card p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-bold" style={{ color: 'var(--accent)' }}>
                      Day {entry.dayNumber}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {entry.generatedSummary}
                  </p>
                  {entry.distanceKm > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      <Footprints size={9} />
                      {entry.distanceKm.toFixed(1)} km
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DayDebrief;
