import { Translation } from '../types/TravelData';

export interface SituationGroup {
  id: string;
  title: string;
  emoji: string;
  categories: string[];
}

export const situationGroups: SituationGroup[] = [
  { id: 'emergency', title: 'Emergency', emoji: '🚨', categories: ['Emergency'] },
  { id: 'restaurant', title: 'At a Restaurant', emoji: '🍽', categories: ['Food', 'Numbers'] },
  { id: 'transport', title: 'Getting Around', emoji: '🚕', categories: ['Directions', 'Transportation', 'Travel'] },
  { id: 'hotel', title: 'At Your Hotel', emoji: '🏨', categories: ['Accommodation'] },
  { id: 'shopping', title: 'Shopping', emoji: '🛍', categories: ['Shopping'] },
  { id: 'social', title: 'Being Polite', emoji: '👋', categories: ['Greetings'] },
];

export function groupTranslationsBySituation(translations: Translation[]): { group: SituationGroup; phrases: Translation[] }[] {
  const assigned = new Set<string>();
  const result: { group: SituationGroup; phrases: Translation[] }[] = [];

  for (const group of situationGroups) {
    const phrases = translations.filter(t =>
      group.categories.some(cat => t.category.toLowerCase().includes(cat.toLowerCase()))
    );
    if (phrases.length > 0) {
      phrases.forEach(p => assigned.add(p.english));
      result.push({ group, phrases });
    }
  }

  // Catch-all for unmatched
  const unmatched = translations.filter(t => !assigned.has(t.english));
  if (unmatched.length > 0) {
    result.push({
      group: { id: 'other', title: 'Other Phrases', emoji: '💬', categories: [] },
      phrases: unmatched,
    });
  }

  return result;
}
