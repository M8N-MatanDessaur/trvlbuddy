import { Translation } from '../types/TravelData';
import { AlertTriangle, UtensilsCrossed, Car, Hotel, ShoppingBag, HandHeart, MessageCircle } from 'lucide-react';

export interface SituationGroup {
  id: string;
  title: string;
  icon: React.FC<any>;
  categories: string[];
}

import React from 'react';

export const situationGroups: SituationGroup[] = [
  { id: 'emergency', title: 'Emergency', icon: AlertTriangle, categories: ['Emergency'] },
  { id: 'restaurant', title: 'At a Restaurant', icon: UtensilsCrossed, categories: ['Food', 'Numbers'] },
  { id: 'transport', title: 'Getting Around', icon: Car, categories: ['Directions', 'Transportation', 'Travel'] },
  { id: 'hotel', title: 'At Your Hotel', icon: Hotel, categories: ['Accommodation'] },
  { id: 'shopping', title: 'Shopping', icon: ShoppingBag, categories: ['Shopping'] },
  { id: 'social', title: 'Being Polite', icon: HandHeart, categories: ['Greetings'] },
];

/**
 * Sort situation groups so that groups matching the given IDs appear first.
 * Emergency always stays above everything else.
 */
export function getContextualGroups(
  groups: { group: SituationGroup; phrases: Translation[] }[],
  priorityGroupIds: string[],
): { group: SituationGroup; phrases: Translation[] }[] {
  const priority = new Set(priorityGroupIds);

  return [...groups].sort((a, b) => {
    // Emergency is always first
    if (a.group.id === 'emergency') return -1;
    if (b.group.id === 'emergency') return 1;

    const aP = priority.has(a.group.id) ? 0 : 1;
    const bP = priority.has(b.group.id) ? 0 : 1;
    return aP - bP;
  });
}

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

  const unmatched = translations.filter(t => !assigned.has(t.english));
  if (unmatched.length > 0) {
    result.push({
      group: { id: 'other', title: 'Other Phrases', icon: MessageCircle, categories: [] },
      phrases: unmatched,
    });
  }

  return result;
}
