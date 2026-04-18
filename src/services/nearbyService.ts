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
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { UserLocation } from '../utils/geolocation';
import { haversineMeters } from '../utils/geolocation';
import { NEARBY_ICON_REGISTRY } from './nearbyIconRegistry';

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';
const MAX_POST_PHOTOS = 6;

export interface NearbyPlace {
  placeId: string;
  name: string;
  category: string;          // Google primaryType (e.g. "market", "sushi_restaurant")
  categoryLabel: string;     // Google primaryTypeDisplayName.text ("Fresh food market")
  categoryIcon: LucideIcon;
  address: string;
  location: { lat: number; lng: number };
  distance: number;          // meters from user
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  openNow?: boolean;
  imageUrls: string[];       // initial photo urls from search response
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

// Used as the taxonomy for the sweep loop and for constraining AI chip /
// prompt interpretation — NOT for rendering card labels. Card labels come
// straight from Google's primaryTypeDisplayName.
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

// Icon fallbacks keyed by Google primaryType values that don't match the
// NEARBY_ICON_REGISTRY keys 1:1. Purely for icon selection — labels come
// from primaryTypeDisplayName so we never need a label table.
const PRIMARY_TYPE_ICON_ALIASES: Record<string, string> = {
  grocery_store: 'market',
  grocery_or_supermarket: 'market',
  supermarket: 'market',
  farmers_market: 'market',
  food_store: 'market',
  food: 'restaurant',
  art_gallery: 'gallery',
  movie_theater: 'cinema',
  book_store: 'bookstore',
  night_club: 'nightlife',
  shopping_mall: 'shopping',
  department_store: 'shopping',
  amusement_park: 'amusement',
  ice_cream_shop: 'dessert',
  pizza_restaurant: 'pizza',
  meal_takeaway: 'restaurant',
  meal_delivery: 'restaurant',
  tourist_attraction: 'attraction',
  clothing_store: 'clothing',
  shoe_store: 'clothing',
  jewelry_store: 'clothing',
  hindu_temple: 'church',
  mosque: 'church',
  synagogue: 'church',
  bowling_alley: 'bowling',
  concert_hall: 'music',
  performing_arts_theater: 'music',
  fitness_center: 'gym',
  sports_complex: 'sports',
};

// Resolves an icon from the dynamic API data. Preference: primaryType exact
// match → primaryType alias → types list (first hit) → suffix heuristics
// (_restaurant/_store/_shop) → MapPin. No label logic — the card label is
// always Google's primaryTypeDisplayName.text.
function iconForPrimaryType(primaryType?: string, types: string[] = []): LucideIcon {
  const candidates = [primaryType, ...types].filter((c): c is string => Boolean(c));

  for (const c of candidates) {
    const direct = NEARBY_ICON_REGISTRY[c];
    if (direct) return direct;
    const alias = PRIMARY_TYPE_ICON_ALIASES[c];
    if (alias && NEARBY_ICON_REGISTRY[alias]) return NEARBY_ICON_REGISTRY[alias];
  }

  for (const c of candidates) {
    if (/_restaurant$/.test(c)) return NEARBY_ICON_REGISTRY.restaurant;
    if (/_store$/.test(c) || /_shop$/.test(c)) return NEARBY_ICON_REGISTRY.shopping;
  }

  return NEARBY_ICON_REGISTRY.default ?? MapPin;
}

// Snake_case → Title Case fallback for the rare case where the API omits
// primaryTypeDisplayName but gives us a primaryType (e.g. "ice_cream_shop"
// → "Ice Cream Shop"). Still dynamic — no lookup table.
function titleCaseType(type: string): string {
  return type
    .split('_')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface PlacesV1Photo {
  name: string; // "places/{id}/photos/{id}"
}

interface PlacesV1Place {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { openNow?: boolean };
  photos?: PlacesV1Photo[];
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string; languageCode?: string };
}

interface PlacesV1Response {
  places?: PlacesV1Place[];
  error?: { status?: string; message?: string };
}

const PLACES_V1_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.currentOpeningHours.openNow',
  'places.regularOpeningHours.openNow',
  'places.photos',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
].join(',');

function buildPhotoUrl(photoName: string, maxWidth = 1200): string {
  // v1 photo endpoint returns a 302 to the actual image. Browsers follow
  // redirects on <img> loads so this just works.
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
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
      const useTextSearch = Boolean(cat.noTypeSearch && this.globalKeyword);
      const endpoint = useTextSearch
        ? '/api/placesv1/places:searchText'
        : '/api/placesv1/places:searchNearby';

      const body: Record<string, unknown> = { maxResultCount: 20 };
      if (useTextSearch) {
        body.textQuery = this.globalKeyword;
        body.openNow = true;
        body.locationBias = {
          circle: {
            center: {
              latitude: this.userLocation.lat,
              longitude: this.userLocation.lng,
            },
            radius,
          },
        };
      } else {
        body.includedTypes = [cat.type];
        body.locationRestriction = {
          circle: {
            center: {
              latitude: this.userLocation.lat,
              longitude: this.userLocation.lng,
            },
            radius,
          },
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': PLACES_V1_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      const data: PlacesV1Response = await res.json();
      if (!res.ok) {
        console.warn('Places v1 non-OK:', endpoint, data.error?.status, data.error?.message);
        return [];
      }

      const raw: PlacesV1Place[] = data.places || [];
      return raw
        .filter(r => r.id && r.location?.latitude != null && r.location?.longitude != null)
        .filter(r => {
          // Drop explicitly-closed places; keep unknown + open. Nearby search
          // doesn't support a server-side openNow filter, so we do it here
          // for both endpoints for consistency.
          const openNow =
            r.currentOpeningHours?.openNow ?? r.regularOpeningHours?.openNow;
          return openNow !== false;
        })
        .filter(r => !(r.types || []).some(t => EXCLUDED_PLACE_TYPES.has(t)))
        .filter(r => {
          // Text Search uses locationBias (not restriction), so results outside
          // the transport-mode radius can come back. Enforce it here.
          if (!useTextSearch) return true;
          const lat = r.location?.latitude;
          const lng = r.location?.longitude;
          if (lat == null || lng == null) return false;
          return haversineMeters(this.userLocation, { lat, lng }) <= radius;
        })
        .map(r => this.toPlace(r));
    } catch (err) {
      console.error('Places v1 fetch failed', err);
      return [];
    }
  }

  private toPlace(raw: PlacesV1Place): NearbyPlace {
    const lat = raw.location!.latitude!;
    const lng = raw.location!.longitude!;
    const imageUrls = (raw.photos || [])
      .slice(0, MAX_POST_PHOTOS)
      .map(p => buildPhotoUrl(p.name));

    const primaryType = raw.primaryType;
    const types = raw.types || [];

    // Label is 100% dynamic from Google — the exact phrase Google Maps shows
    // ("Fresh food market"). Only fall back to a title-cased primaryType or
    // types[0] if the API omits the display name, which is rare.
    const categoryLabel =
      raw.primaryTypeDisplayName?.text?.trim() ||
      (primaryType ? titleCaseType(primaryType) : '') ||
      (types[0] ? titleCaseType(types[0]) : 'Place');

    const category = primaryType || types[0] || 'place';
    const categoryIcon = iconForPrimaryType(primaryType, types);

    const priceLevel =
      raw.priceLevel && raw.priceLevel in PRICE_LEVEL_MAP
        ? PRICE_LEVEL_MAP[raw.priceLevel]
        : undefined;

    return {
      placeId: raw.id!,
      name: raw.displayName?.text || '',
      category,
      categoryLabel,
      categoryIcon,
      address: raw.shortFormattedAddress || raw.formattedAddress || '',
      location: { lat, lng },
      distance: haversineMeters(this.userLocation, { lat, lng }),
      rating: raw.rating,
      userRatingsTotal: raw.userRatingCount,
      priceLevel,
      openNow: raw.currentOpeningHours?.openNow ?? raw.regularOpeningHours?.openNow,
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
