// Places worth seeing, from sources that cost nothing.
//
// Google is good at "restaurants near me with ratings" and it bills for every
// question. It is not what you want for "I am in Seoul, show me something
// worth walking to" -- and paying per lookup for that is what made this app
// expensive in the first place.
//
// Two free, keyless sources answer that question better:
//
//   WIKIPEDIA GeoSearch -- everything near you notable enough for an
//   encyclopedia article. In Seoul that is Deoksugung palace, Hwangudan
//   altar, the cathedral. It comes with a photo and a first sentence, both
//   free, which also solves the cold-start problem of a feed with no
//   contributed photos yet. Notability is implicit: somebody wrote an
//   article, so no review-count bar is needed.
//
//   OPENSTREETMAP (Overpass) -- historic sites, city gates, marketplaces,
//   viewpoints, ruins. Finds the things too small for an article: in Seoul it
//   returns "Donuimun Gate Site" and Nakwon Arcade market.
//
// Neither has an API key, neither bills, and neither needs a proxy for cost
// reasons -- only politeness (Overpass requires a User-Agent or it answers
// 406, and both are cached hard so we are not hammering volunteer servers).
//
// Navigation is free too: a Google Maps deep link needs no API.

export type DiscoverySource = 'wikipedia' | 'osm';

export interface DiscoveryPlace {
  id: string;
  source: DiscoverySource;
  name: string;
  /** A one-line "what is this", when the source has one. */
  blurb?: string;
  /** Freely usable image from the source, when there is one. */
  imageUrl?: string;
  location: { lat: number; lng: number };
  distance: number;
  /** Human-readable kind: "Palace", "City gate", "Market". */
  kind: string;
  /** Where to read more. */
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Wikipedia
// ---------------------------------------------------------------------------

// Articles that are near you but are not somewhere you can go: regions,
// administrative areas, transport nodes, organisations at an address.
const WIKI_TITLE_NOISE = [
  // Regions and administrative units
  /metropolitan area/i, /\bdistrict$/i, /\bprovince$/i, /\bcounty$/i,
  /\bprefecture$/i, /\bmunicipality$/i, /\bconstituency\b/i,
  /\b(zone|quarter|rione|neighbourhood|neighborhood)\b/i,
  /\bcentro storico\b/i, /\bcampus martius\b/i,
  // Articles ABOUT a place rather than a place. Wikipedia geotags these to
  // the city centre, so "Climate of Seoul" and "Third Battle of Seoul" show
  // up 300m away as though you could walk to them.
  /^list of/i,
  /^(climate|history|geography|economy|demographics|politics|culture|transport|architecture|education) of\b/i,
  /\b(battle|siege|treaty|massacre|uprising|revolution|earthquake|olympics)\b/i,
  /\b(timeline|outline|index)\b/i,
  // Transport nodes
  / station( \(|$)/i, /\bstation$/i, /\bairport\b/i, /\bbus terminal\b/i,
  /\bmetro line\b/i,
  // Organisations at an address rather than somewhere to visit
  /^embassy of/i, /\bconsulate\b/i, /\bhigh commission\b/i,
  /\buniversity$/i, /\bhospital\b/i, /\bcity hall\b/i, /\bacademy$/i,
  /\bheadquarters\b/i, /\bcompany\b/i, /\bbank of\b/i, /\bministry\b/i,
  // Somewhere to sleep is not somewhere to go: Nearby answers "what to do".
  /\bhotel\b/i, /\bhostel\b/i, /\bresort\b/i,
];

function looksLikeAPlaceToVisit(title: string): boolean {
  return !WIKI_TITLE_NOISE.some((re) => re.test(title));
}

// A rough "what is this" from the opening sentence, so a card can say
// "Palace" rather than nothing.
const KIND_HINTS: Array<[RegExp, string]> = [
  [/\bpalace\b/i, 'Palace'], [/\bcastle\b/i, 'Castle'],
  [/\bgate\b/i, 'Historic gate'], [/\bfortress|\bfort\b/i, 'Fortress'],
  [/\btemple\b/i, 'Temple'], [/\bshrine\b/i, 'Shrine'],
  [/\bcathedral\b/i, 'Cathedral'], [/\bchurch\b/i, 'Church'],
  [/\bmosque\b/i, 'Mosque'], [/\bsynagogue\b/i, 'Synagogue'],
  [/\bmuseum\b/i, 'Museum'], [/\bgallery\b/i, 'Gallery'],
  [/\bmarket\b/i, 'Market'], [/\bpark\b/i, 'Park'],
  [/\bgarden\b/i, 'Garden'], [/\bbridge\b/i, 'Bridge'],
  [/\btower\b/i, 'Tower'], [/\bmonument\b/i, 'Monument'],
  [/\bmemorial\b/i, 'Memorial'], [/\btomb\b/i, 'Tomb'],
  [/\bruins?\b/i, 'Ruins'],
  [/\btheatre\b|\btheater\b/i, 'Theatre'], [/\blibrary\b/i, 'Library'],
  [/\brestaurant\b/i, 'Restaurant'], [/\bobservatory\b/i, 'Observatory'],
  [/\bbasilica\b/i, 'Basilica'], [/\bfountain\b|\bfontana\b/i, 'Fountain'],
  [/\bobelisk\b/i, 'Obelisk'], [/\bbaths?\b|\bterme\b/i, 'Roman baths'],
  [/\bstatue\b/i, 'Statue'], [/\bvilla\b/i, 'Villa'],
  // Generic last, so it only applies when nothing more specific matched.
  [/\bsquare\b|\bplaza\b|\bpiazza\b/i, 'Square'],
];

// The title is the reliable signal; the description is only a fallback.
// Checking them separately stops a passing mention in the prose from deciding
// the label -- it was calling Seoul Metropolitan Library a "Square" because
// its description mentions the plaza outside.
function kindFromText(title: string, description = '', fallback = 'Landmark'): string {
  for (const [re, label] of KIND_HINTS) if (re.test(title)) return label;
  for (const [re, label] of KIND_HINTS) if (re.test(description)) return label;
  return fallback;
}

// Wikipedia opening sentences carry apparatus a reader here does not want.
// Raw, the Pantheon reads:
//
//   "The Pantheon (UK: , US: ; Latin: Pantheum, from Ancient Greek Πάνθειον
//    (Pantheion) '[temple] of all the gods') is an ancient temple in Rome..."
//
// The empty "(UK: , US: ;)" is where the plaintext extract dropped the IPA,
// and the etymology belongs in an encyclopedia, not on a card someone is
// reading while deciding whether to walk somewhere.
function cleanBlurb(extract: string): string | undefined {
  let text = extract;

  // Drop parentheticals that are pronunciation, transliteration or
  // etymology. Nested parens are handled by running the pass twice.
  const APPARATUS = /\s*\((?:[^()]|\([^()]*\))*?(?:UK|US|IPA|English|Latin|Ancient Greek|Greek|Korean|Hanja|Japanese|Chinese|Italian|French|Spanish|German|Arabic|Hebrew|Russian|pronounced|lit\.|romanized|MR|Hepburn)[^()]*(?:\([^()]*\)[^()]*)*\)/gi;
  text = text.replace(APPARATUS, '').replace(APPARATUS, '');

  // Any parenthetical left with no letters in it, e.g. "( , ;)".
  text = text.replace(/\s*\([^A-Za-z)]*\)/g, '');

  // Leading IPA in square brackets, and stray spacing the removals leave.
  text = text.replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

  // First sentence -- but ". " is not a reliable boundary in this material:
  // "constructed c. 25 BC" and "St. Peter's" both break it, which is how a
  // card ended up reading "was an ancient Roman basilica constructed c.".
  const ABBREV = /(?:\b(?:c|ca|circa|St|Mt|Ft|approx|no|vs|etc|Dr|Mr|Mrs|Ms|Jr|Sr|Prof|fl|d|b|r|AD|BC|BCE|CE)\.)$/i;
  const parts = text.split(/(?<=\.)\s+/);
  let sentence = '';
  for (const part of parts) {
    sentence = sentence ? `${sentence} ${part}` : part;
    // Keep going while the piece ends in an abbreviation or is still short.
    if (!ABBREV.test(sentence.trim()) && sentence.length > 40) break;
    if (sentence.length > 260) break;
  }
  sentence = sentence.trim();

  return sentence.length > 20 ? sentence : undefined;
}

interface WikiGeoHit { pageid: number; title: string; lat: number; lon: number; dist: number }

/**
 * Notable places near a coordinate, from Wikipedia. Free, no key.
 * Two requests: the geosearch, then one batched lookup for photos and
 * opening sentences.
 */
export async function wikipediaNearby(
  lat: number,
  lng: number,
  radiusMeters = 3000,
  options: { limit?: number; lang?: string; signal?: AbortSignal } = {},
): Promise<DiscoveryPlace[]> {
  const { limit = 20, lang = 'en', signal } = options;
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  // Wikipedia caps gsradius at 10km.
  const radius = Math.min(Math.max(radiusMeters, 10), 10000);

  const geoUrl = `${api}?action=query&list=geosearch&gscoord=${lat}%7C${lng}` +
    `&gsradius=${radius}&gslimit=${Math.min(limit * 2, 50)}&format=json&origin=*`;

  const geo = await fetch(geoUrl, { signal }).then((r) => r.json()).catch(() => null);
  const hits: WikiGeoHit[] = (geo?.query?.geosearch ?? []).filter(
    (h: WikiGeoHit) => looksLikeAPlaceToVisit(h.title),
  );
  if (hits.length === 0) return [];

  const titles = hits.slice(0, limit).map((h) => h.title);
  const detailUrl = `${api}?action=query&prop=pageimages%7Cextracts&exintro=1&explaintext=1` +
    `&piprop=thumbnail&pithumbsize=1000&titles=${encodeURIComponent(titles.join('|'))}` +
    `&format=json&origin=*`;

  const detail = await fetch(detailUrl, { signal }).then((r) => r.json()).catch(() => null);
  interface WikiPage {
    title: string;
    extract?: string;
    thumbnail?: { source?: string };
  }
  const byTitle = new Map<string, WikiPage>();
  for (const page of Object.values(detail?.query?.pages ?? {}) as WikiPage[]) {
    if (page?.title) byTitle.set(page.title, page);
  }

  return hits
    .slice(0, limit)
    .map((h) => {
      const page = byTitle.get(h.title);
      const extract: string = page?.extract ?? '';
      return {
        id: `wiki:${h.pageid}`,
        source: 'wikipedia' as const,
        // Wikipedia disambiguates titles with the city ("Pantheon, Rome"),
        // which is noise on a card that already says where you are.
        name: h.title.replace(/,\s+[^,]+$/, (m) => (m.length > 18 ? m : '')),
        blurb: cleanBlurb(extract),
        imageUrl: page?.thumbnail?.source,
        location: { lat: h.lat, lng: h.lon },
        distance: Math.round(h.dist),
        kind: kindFromText(h.title, extract.slice(0, 240)),
        sourceUrl: `https://${lang}.wikipedia.org/?curid=${h.pageid}`,
      };
    })
    // An article with neither a photo nor a description makes a poor card.
    .filter((p) => p.imageUrl || p.blurb);
}

// ---------------------------------------------------------------------------
// OpenStreetMap / Overpass
// ---------------------------------------------------------------------------

// Tags worth showing someone, and what to call them.
const OSM_KINDS: Record<string, string> = {
  'historic=castle': 'Castle',
  'historic=city_gate': 'City gate',
  'historic=gate': 'Historic gate',
  'historic=fort': 'Fortress',
  'historic=ruins': 'Ruins',
  'historic=archaeological_site': 'Archaeological site',
  'historic=monument': 'Monument',
  'historic=memorial': 'Memorial',
  'historic=building': 'Historic building',
  'historic=tomb': 'Tomb',
  'historic=aqueduct': 'Aqueduct',
  'historic=temple': 'Temple',
  'amenity=marketplace': 'Market',
  'tourism=attraction': 'Attraction',
  'tourism=museum': 'Museum',
  'tourism=artwork': 'Public art',
  'tourism=viewpoint': 'Viewpoint',
};

// Tagged historic but not a destination: street furniture and survey marks.
const OSM_REJECT = new Set([
  'milestone', 'boundary_stone', 'fire_extinguisher', 'water_pump',
  'wayside_cross', 'wayside_shrine', 'charcoal_pile', 'cannon', 'anchor',
  'railway_car', 'locomotive', 'aircraft', 'tank', 'vehicle', 'optical_telegraph',
]);

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Historic sites, gates, markets and viewpoints from OpenStreetMap. Free, no
 * key. Overpass answers 406 without a User-Agent, and asks that clients cache
 * -- both honoured here.
 */
export async function osmNearby(
  lat: number,
  lng: number,
  radiusMeters = 2500,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<DiscoveryPlace[]> {
  const { limit = 30, signal } = options;
  const r = Math.min(Math.max(radiusMeters, 100), 8000);

  // Ways as well as nodes -- a palace or a market is an area, not a point --
  // and `out center` gives each one a coordinate.
  const query = `[out:json][timeout:25];(
    node["historic"](around:${r},${lat},${lng});
    way["historic"](around:${r},${lat},${lng});
    node["amenity"="marketplace"](around:${r},${lat},${lng});
    way["amenity"="marketplace"](around:${r},${lat},${lng});
    node["tourism"~"^(attraction|museum|artwork|viewpoint)$"](around:${r},${lat},${lng});
    way["tourism"~"^(attraction|museum|artwork|viewpoint)$"](around:${r},${lat},${lng});
  );out center ${limit * 3};`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpass refuses anonymous clients with a 406.
      'User-Agent': 'trvlbuddy/1.0 (https://trvlbuddy.com)',
    },
    body: 'data=' + encodeURIComponent(query),
    signal,
  }).then((x) => x.json()).catch(() => null);

  const out: DiscoveryPlace[] = [];
  for (const el of res?.elements ?? []) {
    const tags = el.tags ?? {};
    const name: string | undefined = tags['name:en'] || tags.name;
    if (!name) continue;

    const historic = tags.historic as string | undefined;
    if (historic && OSM_REJECT.has(historic)) continue;

    const key = historic ? `historic=${historic}`
      : tags.amenity ? `amenity=${tags.amenity}`
      : tags.tourism ? `tourism=${tags.tourism}` : '';
    const kind = OSM_KINDS[key] ?? (historic ? 'Historic site' : 'Attraction');

    const point = el.center ?? { lat: el.lat, lon: el.lon };
    if (point?.lat == null || (point.lon ?? point.lng) == null) continue;
    const location = { lat: point.lat, lng: point.lon ?? point.lng };

    out.push({
      id: `osm:${el.type}/${el.id}`,
      source: 'osm',
      name,
      blurb: tags.description || tags['description:en'] || undefined,
      location,
      distance: haversine({ lat, lng }, location),
      kind,
      sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    });
  }

  return out.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Merge the sources, preferring Wikipedia when both describe the same place
 * (it brings a photo and a sentence). Same place = same-ish name within 250m.
 */
export function mergeDiscoveries(...lists: DiscoveryPlace[][]): DiscoveryPlace[] {
  const kept: DiscoveryPlace[] = [];
  // Wikipedia first so it wins ties.
  const all = [...lists].flat().sort((a, b) =>
    (a.source === 'wikipedia' ? 0 : 1) - (b.source === 'wikipedia' ? 0 : 1));

  for (const place of all) {
    const key = normalise(place.name);
    const duplicate = kept.some((k) => {
      const kk = normalise(k.name);
      const sameName = kk === key || kk.includes(key) || key.includes(kk);
      return sameName && haversine(k.location, place.location) < 250;
    });
    if (!duplicate) kept.push(place);
  }
  return kept.sort((a, b) => a.distance - b.distance);
}

/**
 * Open anywhere in Google Maps. No API, no key, no billing -- just a URL.
 * Prefers the name so Maps shows the place card rather than a dropped pin.
 */
export function mapsLink(place: { name: string; location: { lat: number; lng: number } }): string {
  const q = encodeURIComponent(`${place.name} ${place.location.lat},${place.location.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Turn-by-turn to a place, again with no API. */
export function directionsLink(place: { location: { lat: number; lng: number } }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`;
}
