import { useMemo } from 'react';
import { useContextEngine, type TripMoment } from '../contexts/ContextEngineContext';
import type { TimeOfDay } from '../utils/timezoneHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentDirectives {
  /** Situation group IDs to surface first on the Language page. */
  suggestedPhraseGroups: string[];
  /** Short label describing the moment (e.g. "Dinner time in Seoul"). */
  momentLabel: string;
  /** Activity category IDs to prioritize on Explore. */
  priorityCategories: string[];
  /** Which tools sections to surface first on the Tools page. */
  toolsPriority: ('emergency' | 'currency' | 'weather' | 'photo-scanner' | 'packing')[];
  /** Whether to show the "debrief your day" prompt on the Dashboard. */
  showDebrief: boolean;
  /** Greeting appropriate for the time of day. */
  timeGreeting: string;
}

// ---------------------------------------------------------------------------
// Mapping logic
// ---------------------------------------------------------------------------

const phraseGroupsByTime: Record<TimeOfDay, string[]> = {
  'early-morning': ['transport', 'hotel'],
  morning: ['restaurant', 'transport', 'social'],
  lunch: ['restaurant', 'shopping'],
  afternoon: ['shopping', 'transport', 'social'],
  evening: ['restaurant', 'social', 'transport'],
  'late-night': ['emergency', 'transport', 'hotel'],
};

const categoryPriorityByTime: Record<TimeOfDay, string[]> = {
  'early-morning': ['Food', 'Nature'],
  morning: ['Museums', 'History', 'Nature'],
  lunch: ['Food'],
  afternoon: ['Shopping', 'Entertainment', 'Culture'],
  evening: ['Food', 'Nightlife', 'Entertainment'],
  'late-night': ['Nightlife'],
};

const greetingByTime: Record<TimeOfDay, string> = {
  'early-morning': 'Good morning',
  morning: 'Good morning',
  lunch: 'Good afternoon',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  'late-night': 'Late night',
};

function buildMomentLabel(m: TripMoment): string {
  const dest = m.currentDestination?.name;
  const time = greetingByTime[m.timeOfDay].toLowerCase();

  if (m.tripPhase === 'pre-trip') {
    return dest ? `Getting ready for ${dest}` : 'Getting ready for your trip';
  }
  if (m.tripPhase === 'post-trip') {
    return 'Trip memories';
  }
  if (dest) {
    return `${greetingByTime[m.timeOfDay]} in ${dest}`;
  }
  return `${greetingByTime[m.timeOfDay]}`;
}

function buildToolsPriority(m: TripMoment): ContentDirectives['toolsPriority'] {
  if (m.tripPhase === 'pre-trip') {
    return ['packing', 'currency', 'weather', 'emergency', 'photo-scanner'];
  }
  if (m.timeOfDay === 'late-night') {
    return ['emergency', 'currency', 'photo-scanner', 'weather', 'packing'];
  }
  if (m.nearbyContext === 'hotel') {
    return ['currency', 'weather', 'photo-scanner', 'emergency', 'packing'];
  }
  return ['photo-scanner', 'currency', 'weather', 'emergency', 'packing'];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContextualContent(): ContentDirectives & { moment: TripMoment } {
  const { moment } = useContextEngine();

  const directives = useMemo<ContentDirectives>(() => {
    const suggestedPhraseGroups = [
      ...(phraseGroupsByTime[moment.timeOfDay] ?? []),
    ];
    // If near hotel, bump hotel phrases
    if (moment.nearbyContext === 'hotel' && !suggestedPhraseGroups.includes('hotel')) {
      suggestedPhraseGroups.unshift('hotel');
    }

    return {
      suggestedPhraseGroups,
      momentLabel: buildMomentLabel(moment),
      priorityCategories: categoryPriorityByTime[moment.timeOfDay] ?? [],
      toolsPriority: buildToolsPriority(moment),
      showDebrief:
        moment.tripPhase === 'active' &&
        (moment.timeOfDay === 'evening' || moment.timeOfDay === 'late-night'),
      timeGreeting: greetingByTime[moment.timeOfDay],
    };
  }, [moment]);

  return { ...directives, moment };
}
