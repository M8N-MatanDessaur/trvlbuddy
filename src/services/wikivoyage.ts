import type { DiscoveryPlace } from './discovery';

/**
 * Wikivoyage: what to actually do here, chosen by people.
 *
 * Every other source we have answers a different question. Google answers
 * "what is near this point", which is why it offers a bank and a petrol
 * station. Wikipedia answers "what has an article", which is why it offered a
 * borough and three electoral districts. Neither is a recommendation.
 *
 * Wikivoyage is a travel guide written by editors, and its articles carry
 * structured listings, {{see}} and {{do}}, each with a name, coordinates,
 * a description and often the official website. That is a curated answer to
 * "best things to do near here", which is the one question that matters.
 *
 * Free, no key, no quota, same MediaWiki API as Wikipedia. Google stays for
 * what Google is good at: the details, the map and the directions.
 */

const API = 'https://en.wikivoyage.org/w/api.php';
const CACHE_KEY = 'tb:wikivoyage:v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Guides are per-district, so a handful covers a city centre.
const MAX_GUIDES = 4;
const SEARCH_RADIUS_M = 10000;

/** Only the two that mean "worth going to". Eat/drink/sleep are directories. */
const WANTED = new Set(['see', 'do']);

/**
 * Even a travel guide lists the hospital, because a traveller who needs one
 * needs it badly. It is not an answer to "what should I do tonight", so it
 * does not belong in this feed. Written for the languages these places are
 * actually named in.
 */
const NOT_AN_OUTING =
  /\bhospital|h[oô]pital|centre hospitalier|hospitalier|clinic|clinique|polyclini|\bCHU\b|\bCLSC\b|urgence|emergency room|pharmac|\bdentist|medical cent(re|er)|\bembassy\b|\bconsulate\b|police station|\bhostel\b|\bhotel\b/i;

interface CacheEntry {
  places: DiscoveryPlace[];
  t: number;
}

function cacheKeyFor(lat: number, lng: number): string {
  // ~1km cells: everyone in a neighbourhood shares one parse.
  return `${CACHE_KEY}:${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function readCache(lat: number, lng: number): DiscoveryPlace[] | null {
  try {
    const raw = localStorage.getItem(cacheKeyFor(lat, lng));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!Array.isArray(parsed?.places) || Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.places;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lng: number, places: DiscoveryPlace[]): void {
  try {
    localStorage.setItem(cacheKeyFor(lat, lng), JSON.stringify({ places, t: Date.now() }));
  } catch {
    // Over quota or unwritable; the fetch still served this call.
  }
}

/** Metres between two points. */
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Wikitext into something a card can show. */
function cleanWikitext(value: string): string {
  return value
    // [[Target|shown]] and [[shown]]
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    // ''' bold ''' and '' italic ''
    .replace(/'{2,}/g, '')
    // {{templates}} left inside a description
    .replace(/\{\{[^}]*\}\}/g, '')
    // <ref>...</ref> and stray tags
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One named parameter out of a template body. */
function field(body: string, name: string): string {
  const match = body.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^|]*)`));
  return match ? match[1].trim() : '';
}

export async function wikivoyageNearby(
  lat: number,
  lng: number,
  options: { signal?: AbortSignal; limit?: number } = {},
): Promise<DiscoveryPlace[]> {
  const { signal, limit = 30 } = options;

  const cached = readCache(lat, lng);
  if (cached) return cached.slice(0, limit);

  try {
    // 1. Which guides cover this point. City guides are split by district, so
    //    the nearest few together describe the area you are standing in.
    const geo = await fetch(
      `${API}?action=query&list=geosearch&gscoord=${lat}%7C${lng}` +
        `&gsradius=${SEARCH_RADIUS_M}&gslimit=${MAX_GUIDES * 2}&format=json&origin=*`,
      { signal },
    ).then((r) => r.json());

    const guides: Array<{ title: string; dist: number }> = (geo?.query?.geosearch ?? [])
      .slice(0, MAX_GUIDES)
      .map((g: { title: string; dist: number }) => ({ title: g.title, dist: g.dist }));
    if (guides.length === 0) return [];

    // 2. Their source, in one request, and pull the listings out of it.
    const source = await fetch(
      `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
        `&titles=${encodeURIComponent(guides.map((g) => g.title).join('|'))}` +
        `&format=json&origin=*`,
      { signal },
    ).then((r) => r.json());

    const listing = /\{\{(see|do)\b([^}]*)\}\}/gi;
    const out: DiscoveryPlace[] = [];
    const seen = new Set<string>();

    for (const raw of Object.values(source?.query?.pages ?? {})) {
      const page = raw as { title?: string; revisions?: Array<{ slots?: { main?: { '*'?: string } } }> };
      const text = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
      let match: RegExpExecArray | null;
      while ((match = listing.exec(text)) !== null) {
        const kind = match[1].toLowerCase();
        if (!WANTED.has(kind)) continue;
        const body = match[2];

        const name = cleanWikitext(field(body, 'name'));
        const itemLat = Number(field(body, 'lat'));
        const itemLng = Number(field(body, 'long'));
        // Without coordinates there is no distance and no directions, which
        // are half of what the card is for.
        if (!name || !Number.isFinite(itemLat) || !Number.isFinite(itemLng)) continue;
        if (itemLat === 0 && itemLng === 0) continue;

        if (NOT_AN_OUTING.test(name)) continue;

        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const url = field(body, 'url').trim();
        out.push({
          id: `wikivoyage:${key}`,
          source: 'wikipedia',
          name,
          blurb: cleanWikitext(field(body, 'content')) || undefined,
          // No image: Wikivoyage listings do not carry one, and guessing at a
          // photograph by name is what the review ruled out.
          imageUrl: undefined,
          location: { lat: itemLat, lng: itemLng },
          distance: distanceMeters(lat, lng, itemLat, itemLng),
          kind: kind === 'do' ? 'Things to do' : 'Worth seeing',
          sourceUrl: /^https?:\/\//i.test(url) ? url : undefined,
        });
      }
    }

    // Nearest first: a guide covers a district, and the far end of it is not
    // "near you" however good it is.
    out.sort((a, b) => a.distance - b.distance);
    writeCache(lat, lng, out);
    return out.slice(0, limit);
  } catch {
    // One source being down is not a broken feed.
    return [];
  }
}
