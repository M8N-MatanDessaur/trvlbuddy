import {
  Landmark,
  TreePine,
  UtensilsCrossed,
  Palette,
  Umbrella,
  ShoppingBag,
  Moon,
  Theater,
  Heart,
  Building2,
  Bus,
  Camera,
  Church,
  Ship,
  Wallet,
  CreditCard,
  Gem,
  Bot,
  Compass,
  Languages,
  Wrench,
  Mountain,
  type LucideIcon,
} from 'lucide-react';

const categoryMap: Record<string, LucideIcon> = {
  History: Landmark,
  Nature: TreePine,
  Food: UtensilsCrossed,
  Museums: Palette,
  Beach: Umbrella,
  Shopping: ShoppingBag,
  Nightlife: Moon,
  Culture: Theater,
  Wellness: Heart,
  City: Building2,
  Daytrips: Bus,
  Photography: Camera,
  Religious: Church,
  Water: Ship,
  Outdoor: Mountain,
};

export function getCategoryIcon(category: string): LucideIcon {
  return categoryMap[category] || Compass;
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    History: '#B45309',
    Nature: '#16A34A',
    Food: '#DC2626',
    Museums: '#7C3AED',
    Beach: '#0891B2',
    Shopping: '#DB2777',
    Nightlife: '#7C3AED',
    Culture: '#C2410C',
    Wellness: '#EC4899',
    City: '#2563EB',
    Daytrips: '#0D9488',
    Photography: '#6D28D9',
    Religious: '#92400E',
    Water: '#0284C7',
    Outdoor: '#15803D',
  };
  return colors[category] || '#64748B';
}

export const interestIcons: Record<string, { icon: LucideIcon; label: string }> = {
  historical: { icon: Landmark, label: 'Historical Sites' },
  outdoor: { icon: Mountain, label: 'Outdoor Adventures' },
  food: { icon: UtensilsCrossed, label: 'Food & Dining' },
  museums: { icon: Palette, label: 'Museums & Art' },
  beach: { icon: Umbrella, label: 'Beach & Water' },
  shopping: { icon: ShoppingBag, label: 'Shopping' },
  nightlife: { icon: Moon, label: 'Nightlife' },
  nature: { icon: TreePine, label: 'Nature & Wildlife' },
  photography: { icon: Camera, label: 'Photography' },
  culture: { icon: Theater, label: 'Culture & Shows' },
  wellness: { icon: Heart, label: 'Wellness & Spa' },
  architecture: { icon: Building2, label: 'Architecture' },
  markets: { icon: ShoppingBag, label: 'Local Markets' },
  water: { icon: Ship, label: 'Water Activities' },
  religious: { icon: Church, label: 'Religious Sites' },
};

export const budgetIcons: Record<string, { icon: LucideIcon; label: string; description: string }> = {
  budget: { icon: Wallet, label: 'Budget', description: 'Hostels, street food, public transit' },
  'mid-range': { icon: CreditCard, label: 'Mid-Range', description: 'Hotels, restaurants, some tours' },
  luxury: { icon: Gem, label: 'Luxury', description: 'Premium stays, fine dining, private tours' },
};

export const featureIcons: Record<string, { icon: LucideIcon; label: string }> = {
  ai: { icon: Bot, label: 'AI-Powered Recommendations' },
  explore: { icon: Compass, label: 'Discover Local Activities' },
  language: { icon: Languages, label: 'Language Translation' },
  tools: { icon: Wrench, label: 'Travel Tools & Utilities' },
};
