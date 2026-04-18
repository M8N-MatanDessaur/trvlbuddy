import {
  UtensilsCrossed,
  Landmark,
  Coffee,
  Beer,
  TreePine,
  Palette,
  Croissant,
  Image as ImageIcon,
  Moon,
  ShoppingBag,
  Store,
  Fish,
  PawPrint,
  BookOpen,
  Library as LibraryIcon,
  Clapperboard,
  Sparkles,
  Flower,
  Shirt,
  Trophy,
  Church,
  Dices,
  FerrisWheel,
  CircleDot,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { UserLocation } from '../utils/geolocation';
import { haversineMeters } from '../utils/geolocation';

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';
const MAX_POST_PHOTOS = 6;

export interface NearbyPlace {
  placeId: string;
  name: string;
  category: string;          // the Places type used (e.g. "restaurant")
  categoryLabel: string;     // human-readable label
  categoryIcon: LucideIcon;
  address: string;
  location: { lat: number; lng: number };
  distance: number;          // meters from user
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  openNow?: boolean;
  imageUrls: string[];       // initial photo urls from nearbysearch response
}

export interface CategoryDef {
  type: string;
  label: string;
  icon: LucideIcon;
  keyword?: string;
  // When true the nearbysearch is fired without a `type=` param so the
  // keyword alone drives the search. Used for AI-prompt broad matches.
  noTypeSearch?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { type: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { type: 'tourist_attraction', label: 'Attraction', icon: Landmark },
  { type: 'cafe', label: 'Cafe', icon: Coffee },
  { type: 'bar', label: 'Bar', icon: Beer },
  { type: 'park', label: 'Park', icon: TreePine },
  { type: 'museum', label: 'Museum', icon: Palette },
  { type: 'bakery', label: 'Bakery', icon: Croissant },
  { type: 'art_gallery', label: 'Gallery', icon: ImageIcon },
  { type: 'night_club', label: 'Nightlife', icon: Moon },
  { type: 'shopping_mall', label: 'Shopping', icon: ShoppingBag },
];

export type TransportMode = 'foot' | 'car';

const RADIUS_STEPS_BY_MODE: Record<TransportMode, number[]> = {
  foot: [500, 1000, 1500, 2000],
  car: [3000, 6000, 12000, 25000],
};

// Place types that are not real "things to go do" and should never appear
// in the feed, even when Google tags a result with e.g. both "restaurant"
// and "gas_station". Any result that carries one of these types is dropped.
const EXCLUDED_PLACE_TYPES = new Set<string>([
  'gas_station',
  'car_repair',
  'car_dealer',
  'car_rental',
  'car_wash',
  'convenience_store',
  'storage',
  'funeral_home',
  'parking',
  'pharmacy',
  'drugstore',
  'hospital',
  'doctor',
  'dentist',
  'veterinary_care',
  'real_estate_agency',
  'insurance_agency',
  'lawyer',
  'accounting',
  'atm',
  'bank',
  'post_office',
  'laundry',
  'locksmith',
  'electrician',
  'plumber',
  'moving_company',
  'roofing_contractor',
]);

function buildPhotoUrl(photoReference: string, maxWidth = 1200): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

// Priority-ordered label resolver. Specific types win first; name hints
// (regex against the place name) are a fallback for places Google tags
// with only generic types like `tourist_attraction` / `food` — that's how
// a place like "Jean-Talon Market" correctly shows as "Market" instead of
// "Attraction" or "Restaurant".
interface LabelRule {
  label: string;
  icon: LucideIcon;
  // One or more Google Places types that trigger this rule.
  types?: string[];
  // Regex against the lowercased place name; used as fallback when types
  // are generic.
  nameHint?: RegExp;
}

// Order matters — earlier rules win on type match. Generic types
// (tourist_attraction) live at the end so specific signals take priority.
const LABEL_RULES: LabelRule[] = [
  { label: 'Market',     icon: Store,           types: ['market', 'grocery_or_supermarket'],      nameHint: /\b(market|marché|marketplace|bazaar|farmers)\b/i },
  { label: 'Bakery',     icon: Croissant,       types: ['bakery'],                                 nameHint: /\b(bakery|boulangerie|patisserie|pâtisserie)\b/i },
  { label: 'Cafe',       icon: Coffee,          types: ['cafe'],                                   nameHint: /\b(coffee|café|espresso|roaster|roastery)\b/i },
  { label: 'Nightlife',  icon: Moon,            types: ['night_club'] },
  { label: 'Bar',        icon: Beer,            types: ['bar'],                                    nameHint: /\b(pub|tavern|brewery|taproom)\b/i },
  { label: 'Restaurant', icon: UtensilsCrossed, types: ['restaurant', 'meal_takeaway', 'meal_delivery'] },
  { label: 'Gallery',    icon: ImageIcon,       types: ['art_gallery'],                            nameHint: /\b(gallery|galerie)\b/i },
  { label: 'Museum',     icon: Palette,         types: ['museum'] },
  { label: 'Aquarium',   icon: Fish,            types: ['aquarium'] },
  { label: 'Zoo',        icon: PawPrint,        types: ['zoo'] },
  { label: 'Amusement',  icon: FerrisWheel,     types: ['amusement_park'] },
  { label: 'Park',       icon: TreePine,        types: ['park'] },
  { label: 'Cinema',     icon: Clapperboard,    types: ['movie_theater'] },
  { label: 'Bookstore',  icon: BookOpen,        types: ['book_store'],                             nameHint: /\b(bookstore|books)\b/i },
  { label: 'Library',    icon: LibraryIcon,     types: ['library'] },
  { label: 'Spa',        icon: Sparkles,        types: ['spa'] },
  { label: 'Bowling',    icon: CircleDot,       types: ['bowling_alley'] },
  { label: 'Stadium',    icon: Trophy,          types: ['stadium'] },
  { label: 'Casino',     icon: Dices,           types: ['casino'] },
  { label: 'Church',     icon: Church,          types: ['church'] },
  { label: 'Temple',     icon: Landmark,        types: ['hindu_temple', 'mosque', 'synagogue'] },
  { label: 'Florist',    icon: Flower,          types: ['florist'] },
  { label: 'Shop',       icon: Shirt,           types: ['clothing_store', 'shoe_store', 'jewelry_store'] },
  { label: 'Shopping',   icon: ShoppingBag,     types: ['shopping_mall', 'department_store'] },
  // Generic fallback — only wins if nothing more specific matched, and only
  // after name hints had a chance above.
  { label: 'Attraction', icon: Landmark,        types: ['tourist_attraction'] },
];

export interface ResolvedLabel {
  label: string;
  icon: LucideIcon;
  type: string;
}

export function resolvePlaceLabel(name: string, rawTypes: string[] = []): ResolvedLabel {
  const typeSet = new Set(rawTypes);
  const lowerName = (name || '').toLowerCase();

  // 1. Specific type match — walk the rules in order and return on first hit,
  //    except the generic `tourist_attraction` rule which we defer so name
  //    hints can override it.
  for (const rule of LABEL_RULES) {
    const isGeneric = rule.types?.length === 1 && rule.types[0] === 'tourist_attraction';
    if (isGeneric) continue;
    if (rule.types?.some(t => typeSet.has(t))) {
      return { label: rule.label, icon: rule.icon, type: rule.types[0] };
    }
  }

  // 2. Name-hint match for places Google tagged only generically (e.g.
  //    Jean-Talon Market whose types are just tourist_attraction/food).
  for (const rule of LABEL_RULES) {
    if (rule.nameHint && rule.nameHint.test(lowerName)) {
      const fallbackType = rule.types?.[0] ?? rule.label.toLowerCase();
      return { label: rule.label, icon: rule.icon, type: fallbackType };
    }
  }

  // 3. Generic `tourist_attraction` fallback.
  if (typeSet.has('tourist_attraction')) {
    return { label: 'Attraction', icon: Landmark, type: 'tourist_attraction' };
  }

  return { label: 'Place', icon: MapPin, type: 'place' };
}

interface NearbyApiResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: { open_now?: boolean };
  photos?: Array<{ photo_reference: string }>;
  types?: string[];
}

export class NearbyFeedCursor {
  private readonly userLocation: UserLocation;
  private readonly categories: CategoryDef[];
  private readonly radiusSteps: number[];
  private readonly globalKeyword?: string;
  private categoryIndex = 0;
  private radiusIndex = 0;
  private readonly seenPlaceIds = new Set<string>();
  private exhausted = false;

  constructor(
    userLocation: UserLocation,
    allowedTypes?: string[],
    transportMode: TransportMode = 'foot',
    keyword?: string,
  ) {
    this.userLocation = userLocation;
    this.radiusSteps = RADIUS_STEPS_BY_MODE[transportMode];
    this.globalKeyword = keyword && keyword.trim().length > 0 ? keyword.trim() : undefined;

    let baseCategories: CategoryDef[];
    if (allowedTypes && allowedTypes.length > 0) {
      const allowed = new Set(allowedTypes);
      const filtered = CATEGORIES.filter(c => allowed.has(c.type));
      baseCategories = filtered.length > 0 ? filtered : CATEGORIES;
    } else {
      baseCategories = CATEGORIES;
    }

    // When an AI keyword is active, do a broad keyword-only sweep first so
    // places that don't fit one of our fixed Places `type` values (e.g. a
    // public market tagged only as `tourist_attraction`/`point_of_interest`)
    // still surface. The type-restricted queries still run afterwards for
    // deeper coverage within the requested categories.
    if (this.globalKeyword) {
      const fallback = CATEGORIES.find(c => c.type === 'tourist_attraction') ?? CATEGORIES[0];
      const broad: CategoryDef = {
        type: fallback.type,
        label: fallback.label,
        icon: fallback.icon,
        noTypeSearch: true,
      };
      this.categories = [broad, ...baseCategories];
    } else {
      this.categories = baseCategories;
    }
  }

  isExhausted() {
    return this.exhausted;
  }

  async fetchNextBatch(targetCount: number): Promise<NearbyPlace[]> {
    const results: NearbyPlace[] = [];
    let safety = 0;
    const maxIterations = this.categories.length * this.radiusSteps.length + 2;
    while (results.length < targetCount && !this.exhausted && safety < maxIterations) {
      safety += 1;
      const cat = this.categories[this.categoryIndex];
      const radius = this.radiusSteps[this.radiusIndex];
      const batch = await this.fetchCategory(cat, radius);
      for (const place of batch) {
        if (this.seenPlaceIds.has(place.placeId)) continue;
        this.seenPlaceIds.add(place.placeId);
        results.push(place);
        if (results.length >= targetCount) break;
      }
      this.advanceCursor();
    }
    return results;
  }

  private advanceCursor() {
    this.categoryIndex += 1;
    if (this.categoryIndex >= this.categories.length) {
      this.categoryIndex = 0;
      this.radiusIndex += 1;
      if (this.radiusIndex >= this.radiusSteps.length) {
        this.exhausted = true;
      }
    }
  }

  private async fetchCategory(cat: CategoryDef, radius: number): Promise<NearbyPlace[]> {
    if (!GOOGLE_PLACES_API_KEY) return [];
    try {
      // For the AI-keyword broad sweep, Google Places Text Search is semantic
      // (same engine Google Maps uses) and finds places like "Jean-Talon Market"
      // that keyword-based Nearby Search misses. For structured category sweeps,
      // stay on Nearby Search which is faster and radius-strict.
      const useTextSearch = Boolean(cat.noTypeSearch && this.globalKeyword);
      const endpoint = useTextSearch ? 'textsearch' : 'nearbysearch';

      const params = new URLSearchParams({
        location: `${this.userLocation.lat},${this.userLocation.lng}`,
        radius: String(radius),
        opennow: 'true',
        key: GOOGLE_PLACES_API_KEY,
      });

      if (useTextSearch) {
        params.set('query', this.globalKeyword!);
      } else {
        if (!cat.noTypeSearch) params.set('type', cat.type);
        const keyword = [this.globalKeyword, cat.keyword].filter(Boolean).join(' ').trim();
        if (keyword) params.set('keyword', keyword);
      }

      const res = await fetch(`/api/places/${endpoint}/json?${params.toString()}`);
      const data = await res.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('Places search non-OK status:', endpoint, data.status, data.error_message);
        return [];
      }
      const raw: NearbyApiResult[] = data.results || [];
      return raw
        .filter(r => r.place_id && r.geometry?.location)
        .filter(r => r.opening_hours?.open_now !== false) // drop explicitly-closed; keep unknown + open
        .filter(r => !(r.types || []).some(t => EXCLUDED_PLACE_TYPES.has(t)))
        .filter(r => {
          // Text Search ignores radius, so enforce it client-side so the
          // transport-mode (foot vs car) radius is still respected.
          if (!useTextSearch) return true;
          const loc = r.geometry?.location;
          if (!loc) return false;
          return haversineMeters(this.userLocation, loc) <= radius;
        })
        .map(r => this.toPlace(r, cat));
    } catch (err) {
      console.error('Places fetch failed', err);
      return [];
    }
  }

  private toPlace(raw: NearbyApiResult, _cat: CategoryDef): NearbyPlace {
    const loc = raw.geometry!.location!;
    const imageUrls = (raw.photos || [])
      .slice(0, MAX_POST_PHOTOS)
      .map(p => buildPhotoUrl(p.photo_reference));

    // Per-place smart label — this wins over the search category so a place
    // like "Jean-Talon Market" that surfaced through a restaurant/attraction
    // sweep still shows "Market" on its card, not "Restaurant".
    const resolved = resolvePlaceLabel(raw.name, raw.types || []);

    return {
      placeId: raw.place_id,
      name: raw.name,
      category: resolved.type,
      categoryLabel: resolved.label,
      categoryIcon: resolved.icon,
      address: raw.vicinity || raw.formatted_address || '',
      location: { lat: loc.lat, lng: loc.lng },
      distance: haversineMeters(this.userLocation, loc),
      rating: raw.rating,
      userRatingsTotal: raw.user_ratings_total,
      priceLevel: raw.price_level,
      openNow: raw.opening_hours?.open_now,
      imageUrls,
    };
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function priceLevelLabel(priceLevel?: number): string | null {
  if (priceLevel == null) return null;
  if (priceLevel === 0) return 'Free';
  return '$'.repeat(Math.max(1, Math.min(4, priceLevel)));
}
