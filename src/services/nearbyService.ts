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

const RADIUS_STEPS = [1500, 3000, 6000, 12000];

function buildPhotoUrl(photoReference: string, maxWidth = 1200): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
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
}

export class NearbyFeedCursor {
  private readonly userLocation: UserLocation;
  private readonly categories: CategoryDef[];
  private categoryIndex = 0;
  private radiusIndex = 0;
  private readonly seenPlaceIds = new Set<string>();
  private exhausted = false;

  constructor(userLocation: UserLocation, allowedTypes?: string[]) {
    this.userLocation = userLocation;
    if (allowedTypes && allowedTypes.length > 0) {
      const allowed = new Set(allowedTypes);
      const filtered = CATEGORIES.filter(c => allowed.has(c.type));
      this.categories = filtered.length > 0 ? filtered : CATEGORIES;
    } else {
      this.categories = CATEGORIES;
    }
  }

  isExhausted() {
    return this.exhausted;
  }

  async fetchNextBatch(targetCount: number): Promise<NearbyPlace[]> {
    const results: NearbyPlace[] = [];
    let safety = 0;
    const maxIterations = this.categories.length * RADIUS_STEPS.length + 2;
    while (results.length < targetCount && !this.exhausted && safety < maxIterations) {
      safety += 1;
      const cat = this.categories[this.categoryIndex];
      const radius = RADIUS_STEPS[this.radiusIndex];
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
      if (this.radiusIndex >= RADIUS_STEPS.length) {
        this.exhausted = true;
      }
    }
  }

  private async fetchCategory(cat: CategoryDef, radius: number): Promise<NearbyPlace[]> {
    if (!GOOGLE_PLACES_API_KEY) return [];
    try {
      const params = new URLSearchParams({
        location: `${this.userLocation.lat},${this.userLocation.lng}`,
        radius: String(radius),
        type: cat.type,
        opennow: 'true',
        key: GOOGLE_PLACES_API_KEY,
      });
      if (cat.keyword) params.set('keyword', cat.keyword);

      const res = await fetch(`/api/places/nearbysearch/json?${params.toString()}`);
      const data = await res.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('Nearby search non-OK status:', data.status, data.error_message);
        return [];
      }
      const raw: NearbyApiResult[] = data.results || [];
      return raw
        .filter(r => r.place_id && r.geometry?.location)
        .filter(r => r.opening_hours?.open_now !== false) // drop explicitly-closed; keep unknown + open
        .map(r => this.toPlace(r, cat));
    } catch (err) {
      console.error('Nearby fetch failed', err);
      return [];
    }
  }

  private toPlace(raw: NearbyApiResult, cat: CategoryDef): NearbyPlace {
    const loc = raw.geometry!.location!;
    const imageUrls = (raw.photos || [])
      .slice(0, MAX_POST_PHOTOS)
      .map(p => buildPhotoUrl(p.photo_reference));
    return {
      placeId: raw.place_id,
      name: raw.name,
      category: cat.type,
      categoryLabel: cat.label,
      categoryIcon: cat.icon,
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
