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
