import { supabase } from '../lib/supabase';
import type { FeedItem } from './unifiedFeed';

/**
 * What you said you want, applied to the feed.
 *
 * The rule, in the owner's words: "if I say bagels, I want the bagels spot to
 * appear first, but if there is no bagels spot, I don't want to see
 * anything."
 *
 * So a preference is a hard promotion, never a widening. Something that
 * genuinely matches goes to the top; nothing gets promoted for being
 * bagel-adjacent, and no substitute is dressed up as a match. A feed that
 * answers "bagels" with a doughnut shop has lied, and the whole point of
 * asking was to be able to trust the answer.
 *
 * Preferences are ordered, so the first one listed wins ties, the list is a
 * priority order, not a set.
 */

export const MAX_PREFERENCES = 12;

/**
 * A preference list read back as a sentence: "likes to eat bagels and tacos,
 * walk in parks and see films".
 *
 * A list of chips says what was configured. A sentence says who someone is,
 * which is what belongs on a profile, so each preference is grouped under
 * the verb you would actually use for it.
 */
const VERBS: Array<{ verb: string; test: RegExp }> = [
  { verb: 'drink', test: /coffee|espresso|tea|cocktail|wine|beer|brewer|bar\b|bars|pub|speakeas/i },
  { verb: 'eat', test: /bagel|brunch|food|bakery|bakeries|patisser|pizza|ramen|dumpling|taco|sushi|barbecue|seafood|deli|ice cream|vegan|market|breakfast|dinner|lunch|restaurant/i },
  { verb: 'walk in', test: /park|garden|trail|waterfront|beach|hik|old town|quarter|promenade/i },
  { verb: 'hear', test: /music|jazz|techno|opera|open mic|gig|concert/i },
  { verb: 'see', test: /galler|museum|art|architect|brutal|cathedral|observator|planetar|sculpture|cinema|film|theatre|theater|comedy|ruin|castle|monument|gate|viewpoint|lookout|rooftop|sunset|festival|bathhouse/i },
  { verb: 'browse', test: /shop|store|bookshop|vintage|antique|thrift|flea|record/i },
];

function joinNaturally(list: string[]): string {
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export function describePreferences(preferences: string[]): string {
  if (preferences.length === 0) return '';

  // Grouped in the order the verbs are declared, but each group keeps the
  // person's own priority order inside it.
  const groups = new Map<string, string[]>();
  for (const preference of preferences) {
    const match = VERBS.find((v) => v.test.test(preference));
    const verb = match?.verb ?? 'look for';
    if (!groups.has(verb)) groups.set(verb, []);
    groups.get(verb)!.push(preference.toLowerCase());
  }

  const clauses = [...groups.entries()].map(
    ([verb, list]) => `${verb} ${joinNaturally(list)}`,
  );
  return `Likes to ${joinNaturally(clauses)}.`;
}

/**
 * Ideas, not options. Anything typed is equally valid, so this list exists
 * only to show the SHAPE of a useful preference, concrete and narrow
 * ("bagels", "rooftop bars") rather than a category ("food").
 *
 * Long on purpose: it scrolls past as a marquee, and a short list would
 * repeat itself within seconds and stop reading as ideas.
 */
export const PREFERENCE_SUGGESTIONS = [
  // Eating
  'bagels', 'brunch', 'street food', 'bakeries', 'patisseries', 'pizza',
  'ramen', 'dumplings', 'tacos', 'sushi', 'barbecue', 'seafood',
  'night markets', 'food halls', 'delis', 'ice cream', 'vegan food',
  'hole in the wall',
  // Drinking
  'specialty coffee', 'espresso bars', 'tea houses', 'cocktail bars',
  'wine bars', 'natural wine', 'breweries', 'rooftop bars', 'dive bars',
  'speakeasies', 'jazz bars',
  // Listening and watching
  'live music', 'jazz', 'techno', 'record shops', 'open mic', 'comedy',
  'theatre', 'independent cinema', 'opera', 'festivals',
  // Looking
  'galleries', 'museums', 'street art', 'architecture', 'brutalism',
  'cathedrals', 'observatories', 'planetariums', 'botanical gardens',
  'sculpture parks',
  // Outside
  'viewpoints', 'lookouts', 'rooftops', 'waterfronts', 'beaches',
  'hiking trails', 'city parks', 'swimming', 'cycling routes',
  'sunset spots',
  // Browsing
  'vintage shops', 'bookshops', 'flea markets', 'antiques', 'design shops',
  'plant shops', 'thrift stores',
  // Older things
  'ruins', 'city gates', 'castles', 'monuments', 'historic quarters',
  'old town', 'covered markets', 'bathhouses',
];

export async function getPreferences(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return [];
  const list = (data as { preferences?: unknown }).preferences;
  return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : [];
}

export async function savePreferences(
  userId: string,
  preferences: string[],
): Promise<{ ok: boolean; error?: string }> {
  // Normalised here as well as constrained in the database: trimmed, deduped
  // case-insensitively, capped.
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of preferences) {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value.length < 2 || value.length > 40) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(value);
    if (clean.length >= MAX_PREFERENCES) break;
  }

  const { error } = await supabase
    .from('profiles')
    // The generated Database types predate this column, so the payload is
    // asserted rather than inferred. The database constrains it regardless.
    .update({ preferences: clean } as never)
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Words worth matching on. Short ones match too much. */
function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/** Everything about an item a preference could legitimately match. */
function haystack(item: FeedItem): string {
  if (item.kind === 'place') {
    // Google's primaryType is the machine name ('bagel_shop'), which is
    // often the only place the word appears.
    return [item.place.name, item.place.categoryLabel, item.place.category]
      .filter(Boolean)
      .join(' ')
      .replace(/_/g, ' ');
  }
  if (item.kind === 'event') {
    return [item.event.name, item.event.description, item.event.type].filter(Boolean).join(' ');
  }
  if (item.kind === 'trip') {
    return [item.activity.name, item.activity.category, item.activity.description]
      .filter(Boolean)
      .join(' ');
  }
  return [item.discovery.name, item.discovery.kind, item.discovery.blurb]
    .filter(Boolean)
    .join(' ');
}

/**
 * Does this item actually match the preference?
 *
 * Every significant word of the preference has to be present. "live music"
 * matches a live music venue and not a music shop, and not a place that
 * happens to be alive. This is deliberately strict: the cost of a false match
 * is that the feature stops being believable.
 */
/**
 * The singular of a word, roughly.
 *
 * People write preferences in the plural, "bagels", "bars", "markets" --
 * and places are named in the singular: "Fairmount Bagel", "bagel_shop",
 * "Le Bar George". Matching the literal word missed every one of those, so
 * both sides are reduced to a stem before comparing.
 */
function stem(word: string): string {
  if (/(ch|sh|s|x|z)es$/.test(word)) return word.slice(0, -2);
  // Not "glass" -> "glas".
  if (word.endsWith('ss')) return word;
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function matches(item: FeedItem, preference: string): boolean {
  const wanted = tokens(preference).map(stem);
  if (wanted.length === 0) return false;
  const text = ` ${haystack(item).toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '')} `;
  return wanted.every((word) => {
    // A word boundary either side, so "bar" does not match "barber" and
    // "art" does not match "started", while the optional ending still allows
    // the plural of the stem.
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}])${escaped}(s|es)?([^\\p{L}]|$)`, 'u').test(text);
  });
}

export interface PreferenceRanking {
  items: FeedItem[];
  /** How many items matched, and which preference each matched, for the UI. */
  matchedBy: Map<string, string>;
  matchCount: number;
}

/**
 * Move genuine matches to the front, in preference order. Everything else
 * keeps the order it arrived in.
 *
 * Nothing is removed. An empty result for "bagels" means no bagel place is
 * promoted, it does not mean the screen goes blank, because then a stated
 * preference would make the app less useful than not stating one.
 */
export function rankByPreferences(
  items: FeedItem[],
  preferences: string[],
): PreferenceRanking {
  const matchedBy = new Map<string, string>();
  if (preferences.length === 0 || items.length === 0) {
    return { items, matchedBy, matchCount: 0 };
  }

  // Buckets in preference order, so "bagels" outranks "coffee" if it is
  // listed first, and an item matching both lands in the earlier bucket.
  const buckets: FeedItem[][] = preferences.map(() => []);
  const rest: FeedItem[] = [];

  for (const item of items) {
    const index = preferences.findIndex((preference) => matches(item, preference));
    if (index === -1) {
      rest.push(item);
      continue;
    }
    buckets[index].push(item);
    matchedBy.set(item.id, preferences[index]);
  }

  return {
    items: [...buckets.flat(), ...rest],
    matchedBy,
    matchCount: matchedBy.size,
  };
}
