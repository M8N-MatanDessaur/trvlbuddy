// What makes a place worth showing someone.
//
// The Nearby feed used to ask Google for `park`, `restaurant` and `cafe`
// within a radius and then sort by distance. That is a list of the nearest
// buildings, which is why it read like this:
//
//   a kids' park / another very small park / another very small park /
//   a Tim Hortons / a McDonald's / a small grocery store
//
// Every one of those is a *resident amenity*. None of them is a reason to
// leave the house. The distinction this module draws is between somewhere you
// would go and somewhere you merely pass -- and it holds whether you are at
// home or standing in Italy.
//
// Four signals do almost all the work:
//
//   1. NOTABILITY. Review count is the honest proxy for "people care about
//      this". A neighbourhood playground has eleven reviews; the Galleria
//      has forty thousand. This is the single strongest signal and the one
//      the old feed ignored completely.
//   2. CATEGORY INTENT. A museum is a destination. A grocery store is an
//      errand. Same distance, different reason to exist.
//   3. CHAINS. A McDonald's is not a discovery anywhere on earth. Detected
//      by name -- both from a list of the obvious global ones and, more
//      usefully, by noticing when one name occupies many different places.
//   4. DISTANCE, but gently. The old feed treated proximity as the point. A
//      great gallery twenty minutes away beats a bench two minutes away, so
//      distance decays slowly and never dominates.
//
// Plus the app's own signal: somewhere a person has photographed or discussed
// is, by definition, somewhere worth showing. That is the whole thesis of the
// app, so it outranks anything Google can tell us.

export interface ScorableAppSignals {
  /** Photos/videos contributed in the app for this place. */
  mediaCount?: number;
  /** Comments across that media. */
  commentCount?: number;
  /** Net upvotes. */
  voteScore?: number;
}

export interface ScorablePlace {
  placeId: string;
  name: string;
  /** Google primaryType, e.g. "museum", "sushi_restaurant". */
  category: string;
  /** The full Google types array when available; primaryType alone otherwise. */
  types?: string[];
  distance: number;
  rating?: number;
  userRatingsTotal?: number;
  app?: ScorableAppSignals;
}

// ---------------------------------------------------------------------------
// Category intent
// ---------------------------------------------------------------------------

// Somewhere you make a trip to see. Weight is how much of a destination it is.
const DESTINATION_WEIGHTS: Record<string, number> = {
  // Culture and sights
  museum: 1.0, art_gallery: 1.0, historical_landmark: 1.0, historical_place: 1.0,
  monument: 1.0, cultural_landmark: 1.0, observation_deck: 1.0, tourist_attraction: 0.95,
  aquarium: 0.95, zoo: 0.95, planetarium: 0.95, botanical_garden: 0.95,
  national_park: 1.0, state_park: 0.9, hiking_area: 0.85, beach: 0.9,
  church: 0.75, cathedral: 0.95, mosque: 0.75, synagogue: 0.75, temple: 0.8,
  castle: 1.0, palace: 1.0, fort: 0.95, ruins: 0.95,
  // Going out
  performing_arts_theater: 0.95, concert_hall: 0.95, opera_house: 1.0,
  live_music_venue: 0.9, comedy_club: 0.85, movie_theater: 0.6,
  night_club: 0.8, cocktail_bar: 0.85, wine_bar: 0.85, brewery: 0.85,
  distillery: 0.85, pub: 0.65, bar: 0.6,
  // Eating, where the interesting end is
  fine_dining_restaurant: 0.95, wine_tasting_room: 0.9,
  restaurant: 0.6, bakery: 0.6, dessert_shop: 0.6, ice_cream_shop: 0.55,
  cafe: 0.5, coffee_shop: 0.5, tea_house: 0.6,
  // Markets and browsing
  market: 0.85, farmers_market: 0.85, flea_market: 0.8, book_store: 0.7,
  antique_store: 0.7, art_studio: 0.75, gift_shop: 0.4, shopping_mall: 0.2,
  // Outdoors that can be either -- notability decides
  park: 0.45, garden: 0.7, plaza: 0.7, scenic_point: 0.95, viewpoint: 0.95,
  bridge: 0.7, marina: 0.6,
};

// Errands. Never a reason to go somewhere, however close.
const AMENITY_TYPES = new Set<string>([
  'grocery_store', 'supermarket', 'convenience_store', 'wholesaler',
  'gas_station', 'electric_vehicle_charging_station', 'parking', 'rest_stop',
  'pharmacy', 'drugstore', 'hospital', 'doctor', 'dentist', 'physiotherapist',
  'veterinary_care', 'medical_lab',
  'bank', 'atm', 'insurance_agency', 'accounting', 'lawyer', 'notary_public',
  'real_estate_agency', 'moving_company', 'storage', 'courier_service',
  'post_office', 'local_government_office', 'city_hall', 'courthouse',
  'police', 'fire_station', 'embassy',
  'car_repair', 'car_dealer', 'car_rental', 'car_wash', 'auto_parts_store',
  'laundry', 'dry_cleaner', 'hair_salon', 'barber_shop', 'nail_salon',
  'hardware_store', 'home_improvement_store', 'electrician', 'plumber',
  'gym', 'fitness_center', 'tanning_studio',
  'school', 'primary_school', 'secondary_school', 'preschool', 'child_care_agency',
  'playground', 'dog_park', 'picnic_ground',
  'cell_phone_store', 'electronics_store', 'furniture_store', 'discount_store',
  'warehouse_store', 'funeral_home', 'cemetery', 'campground',
  'bus_station', 'train_station', 'subway_station', 'transit_depot', 'taxi_stand',
  'fast_food_restaurant',
  // Somewhere to sleep is not somewhere to go. Nearby answers "what should I
  // do"; finding a bed belongs to trip planning.
  'hotel', 'motel', 'hostel', 'resort_hotel', 'extended_stay_hotel',
  'bed_and_breakfast', 'guest_house', 'lodging', 'campground',
]);

// Deliberately NOT here: meal_takeaway and meal_delivery. Plenty of good
// sit-down restaurants carry those tags, and excluding them dropped a real
// restaurant in testing purely for offering takeout. Chains are caught by
// name and by fast_food_restaurant instead.

// The global chains nobody discovers. Matched case-insensitively as a prefix
// of the name, so "McDonald's Downtown" is caught. Regional chains are handled
// by the repeat-name signal instead, which needs no list and works anywhere.
const CHAIN_NAMES = [
  'mcdonald', 'burger king', 'kfc', 'subway', 'domino', 'pizza hut', 'papa john',
  'wendy', 'taco bell', 'five guys', 'chipotle', 'popeyes', 'dunkin',
  'tim horton', 'starbucks', 'costa coffee', 'caffe nero', 'pret a manger',
  'greggs', 'panera', 'krispy kreme', 'cinnabon', 'baskin',
  '7-eleven', 'circle k', 'couche-tard', 'walmart', 'target', 'costco',
  'carrefour', 'lidl', 'aldi', 'tesco', 'sainsbury', 'spar', 'coop', 'conad',
  'esselunga', 'autogrill', 'ikea', 'decathlon', 'h&m', 'zara', 'uniqlo',
  'shell', 'esso', 'total', 'bp ', 'petro-canada',
];

function isChainName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return CHAIN_NAMES.some((c) => n.startsWith(c) || n.includes(` ${c}`));
}

/**
 * Names that occur more than once across a set of places are almost certainly
 * a chain, whatever country you are in. Cheap, list-free, and it catches the
 * local franchise the curated list has never heard of.
 */
export function repeatedNames(places: Array<{ name: string }>): Set<string> {
  const counts = new Map<string, number>();
  for (const p of places) {
    const key = p.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = new Set<string>();
  for (const [name, n] of counts) if (n > 1) repeated.add(name);
  return repeated;
}

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

/**
 * Below this many reviews a place is not a destination -- it is somewhere
 * local people use. This one rule removes the pocket parks, and it is why the
 * feed stops looking like a map of the nearest buildings.
 *
 * Places with contributed photos or comments in the app skip the bar
 * entirely: a person bothering to photograph somewhere IS the notability
 * signal, and it is a better one than Google's.
 */
export const MIN_REVIEWS_FOR_DESTINATION = 40;

/** Below this rating, being popular is not a recommendation. */
export const MIN_RATING = 3.8;

export interface ScoreBreakdown {
  score: number;
  keep: boolean;
  /** Why it was dropped, for debugging the feed rather than for the UI. */
  reason?: string;
}

export interface ScoreOptions {
  /** Names seen more than once in this batch: treated as chains. */
  chains?: Set<string>;
  /** Distance at which a place is half as compelling. Default 2.5km. */
  halfLifeMeters?: number;
}

export function scorePlace(place: ScorablePlace, options: ScoreOptions = {}): ScoreBreakdown {
  const { chains, halfLifeMeters = 2500 } = options;
  const types = place.types?.length ? place.types : [place.category];
  const app = place.app ?? {};
  const appWeight = (app.mediaCount ?? 0) * 3 + (app.commentCount ?? 0) * 2 + Math.max(0, app.voteScore ?? 0);
  const hasAppContent = appWeight > 0;

  // An errand is an errand no matter how well reviewed, unless somebody in the
  // app has actually made a case for it.
  if (!hasAppContent && types.some((t) => AMENITY_TYPES.has(t))) {
    return { score: 0, keep: false, reason: 'amenity' };
  }

  const nameKey = place.name.trim().toLowerCase();
  const chained = isChainName(place.name) || (chains?.has(nameKey) ?? false);
  if (!hasAppContent && chained) {
    return { score: 0, keep: false, reason: 'chain' };
  }

  const reviews = place.userRatingsTotal ?? 0;
  const rating = place.rating ?? 0;

  if (!hasAppContent) {
    if (reviews < MIN_REVIEWS_FOR_DESTINATION) {
      return { score: 0, keep: false, reason: 'too few reviews to be a destination' };
    }
    if (rating > 0 && rating < MIN_RATING) {
      return { score: 0, keep: false, reason: 'rated below the bar' };
    }
  }

  // Notability: log so that 40 -> 400 matters a lot and 4,000 -> 40,000 less.
  const notability = Math.log10(Math.max(reviews, 1)) / 4; // ~0..1 at 10k

  // Quality above the bar, 3.8 -> 0, 5.0 -> 1.
  const quality = rating > 0 ? Math.max(0, (rating - MIN_RATING) / (5 - MIN_RATING)) : 0.3;

  // Category intent. An UNKNOWN type sits mid-table rather than being
  // punished -- but a type we deliberately weighted low must keep that low
  // weight. Flooring everything at 0.45 quietly promoted shopping malls to
  // the same standing as an unrecognised category, which put a mall above a
  // good restaurant in testing.
  const known = [...types, place.category].filter((t) => t in DESTINATION_WEIGHTS);
  const intent = known.length
    ? Math.max(...known.map((t) => DESTINATION_WEIGHTS[t]))
    : 0.45;

  // Gentle distance decay: half as compelling every halfLifeMeters.
  const proximity = 1 / (1 + place.distance / halfLifeMeters);

  // App content is the strongest single term, deliberately.
  const social = Math.min(1, appWeight / 10);

  const score =
    intent * 3.0 +
    notability * 2.5 +
    quality * 1.5 +
    proximity * 1.0 +
    social * 4.0;

  return { score, keep: true };
}

/**
 * Curate a batch: drop the errands, chains and the merely-nearby, then order
 * by how much someone would want to go. Ties break on distance so equally
 * compelling places favour the closer one.
 */
export function curatePlaces<T extends ScorablePlace>(
  places: T[],
  options: Omit<ScoreOptions, 'chains'> = {},
): Array<T & { score: number }> {
  const chains = repeatedNames(places);
  return places
    .map((p) => ({ place: p, result: scorePlace(p, { ...options, chains }) }))
    .filter((x) => x.result.keep)
    .map((x) => ({ ...x.place, score: x.result.score }))
    .sort((a, b) => (b.score - a.score) || (a.distance - b.distance));
}

/** Same scoring, but explains every drop. For diagnosing an empty feed. */
export function explainCuration<T extends ScorablePlace>(
  places: T[],
  options: Omit<ScoreOptions, 'chains'> = {},
): Array<{ name: string; kept: boolean; score: number; reason?: string }> {
  const chains = repeatedNames(places);
  return places.map((p) => {
    const r = scorePlace(p, { ...options, chains });
    return { name: p.name, kept: r.keep, score: Number(r.score.toFixed(2)), reason: r.reason };
  });
}
