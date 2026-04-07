import { GeneratedActivity } from '../types/TravelData';

export interface ActivitySection {
  id: string;
  title: string;
  subtitle: string;
  dataCategory: string; // The actual category value on activities (e.g. "Food", not "Food & Dining")
  activities: GeneratedActivity[];
}

export function groupActivities(activities: GeneratedActivity[]): ActivitySection[] {
  const sections: ActivitySection[] = [];

  // 1. Recommended: top 6 with variety (pick one per category, prefer easy + varied price)
  const recommended = pickRecommended(activities, 6);
  if (recommended.length > 0) {
    sections.push({ id: 'recommended', title: 'Recommended for You', subtitle: 'Our top picks based on your interests', dataCategory: '', activities: recommended });
  }

  // 2. Free things
  const free = activities.filter(a => {
    const cost = a.estimatedCost.toLowerCase();
    return cost.includes('free') || cost === '0' || cost.includes('$0');
  });
  if (free.length > 0) {
    sections.push({ id: 'free', title: 'Free Things to Do', subtitle: 'Great experiences, zero cost', dataCategory: '', activities: free });
  }

  // 3. Food & Dining
  const food = activities.filter(a => a.category === 'Food');
  if (food.length > 0) {
    sections.push({ id: 'food', title: 'Food & Dining', subtitle: 'Local flavors to try', dataCategory: 'Food', activities: food });
  }

  // 4. Day Trips
  const dayTrips = activities.filter(a => a.category === 'Daytrips');
  if (dayTrips.length > 0) {
    sections.push({ id: 'daytrips', title: 'Day Trips', subtitle: 'Nearby adventures', dataCategory: 'Daytrips', activities: dayTrips });
  }

  // 5. Remaining categories
  const usedCategories = new Set(['Food', 'Daytrips']);
  const remaining = [...new Set(activities.map(a => a.category))].filter(c => !usedCategories.has(c));
  remaining.forEach(cat => {
    const catActivities = activities.filter(a => a.category === cat);
    if (catActivities.length > 0) {
      sections.push({ id: cat.toLowerCase().replace(/\s+/g, '-'), title: cat, subtitle: `${catActivities.length} activities`, dataCategory: cat, activities: catActivities });
    }
  });

  return sections;
}

function pickRecommended(activities: GeneratedActivity[], count: number): GeneratedActivity[] {
  const picked: GeneratedActivity[] = [];
  const usedCategories = new Set<string>();

  // First pass: one per category, prefer easy difficulty
  const sorted = [...activities].sort((a, b) => {
    const diffScore = (d?: string) => d === 'easy' ? 0 : d === 'moderate' ? 1 : 2;
    return diffScore(a.difficulty) - diffScore(b.difficulty);
  });

  for (const activity of sorted) {
    if (picked.length >= count) break;
    if (!usedCategories.has(activity.category)) {
      picked.push(activity);
      usedCategories.add(activity.category);
    }
  }

  // Fill remaining slots
  for (const activity of sorted) {
    if (picked.length >= count) break;
    if (!picked.includes(activity)) {
      picked.push(activity);
    }
  }

  return picked;
}
