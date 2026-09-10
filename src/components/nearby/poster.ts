/**
 * The look of a location nobody has photographed yet.
 *
 * Most places in a feed have no free photograph, an independent restaurant
 * is not on Wikipedia and never will be. That is the normal case, not the
 * error case, so it gets a real design rather than a grey box: a poster, and
 * an invitation to be the one who fixes it.
 *
 * Everything here is picked from the location's own id, so a place looks the
 * same every time you see it, while the feed as a whole varies. Twenty
 * identical posters in a row is the thing this exists to avoid.
 */

/** Stable small integer from a string. Same place, same poster, every time. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Built from the theme's own tokens, so all twelve themes keep working and
// none of this is a second palette competing with the first.
const GROUNDS = [
  'linear-gradient(160deg, var(--accent) 0%, var(--accent-light, var(--accent)) 45%, var(--surface-container-high) 100%)',
  'linear-gradient(30deg, var(--accent) 0%, var(--surface-container-high) 70%)',
  'radial-gradient(120% 90% at 15% 10%, var(--accent-light, var(--accent)) 0%, var(--accent) 45%, var(--surface-container-high) 100%)',
  'linear-gradient(200deg, var(--surface-container-high) 0%, var(--accent) 85%)',
  'radial-gradient(100% 100% at 85% 100%, var(--accent) 0%, var(--surface-container-high) 75%)',
];

/** Where the oversized category mark sits. Corner and rotation both vary. */
const MARKS = [
  { top: '6%', right: '-3rem', left: 'auto', rotate: -8, size: 250 },
  { top: '-1rem', right: 'auto', left: '-2.5rem', rotate: 12, size: 230 },
  { top: '30%', right: '-4rem', left: 'auto', rotate: 0, size: 280 },
  { top: '4%', right: '-1rem', left: 'auto', rotate: 20, size: 210 },
];

// The invitation. Playful, short, and specific to what the place is where
// being specific is funnier than being general.
const CTA_GENERAL = [
  'Been there? Share!',
  'Show us how you live it.',
  'First photo here is yours.',
  'Put this place on the map.',
  'No pics yet. Go on then.',
  'Seen it? Show it.',
];

const CTA_FOOD = [
  'Be the first to share your worst!',
  'Plate it, post it.',
  'Was it any good? Prove it.',
  'Show us how you live it.',
];

const CTA_DRINK = [
  'Be the first to quench our thirst!',
  'Cheers? Show us.',
  'One round, one photo.',
];

const CTA_OUTDOORS = [
  'Catch the view for us.',
  'Worth the walk? Show us.',
  'Been there? Share!',
];

const CTA_NIGHT = [
  'Front row? Share it.',
  'Show us how you live it.',
  'Big night? Post the proof.',
];

const FOOD = /restaurant|food|bakery|bakeries|patisserie|deli|pizza|sushi|meal|brunch|breakfast|diner|steak|grill|market/i;
const DRINK = /bar|pub|caf|coffee|tea|brewery|brew|wine|cocktail|juice/i;
const OUTDOORS = /park|garden|trail|beach|mountain|lookout|viewpoint|nature|hike|monument|church|basilica|cathedral|museum|gallery|historic/i;
const NIGHT = /club|night|music|concert|theatre|theater|comedy|venue|performance|festival|jazz|rock|pop/i;

function ctaPool(category: string | undefined): string[] {
  const c = category ?? '';
  if (DRINK.test(c)) return CTA_DRINK;
  if (FOOD.test(c)) return CTA_FOOD;
  if (NIGHT.test(c)) return CTA_NIGHT;
  if (OUTDOORS.test(c)) return CTA_OUTDOORS;
  return CTA_GENERAL;
}

// Two soft floating shapes per poster, for depth and for movement that is
// not the whole background sliding. Positions and tints vary; the tints are
// theme tokens, so this stays inside the palette.
const BLOBS = [
  [
    { top: '-12%', left: '-10%', size: '62%', color: 'var(--accent-light, var(--accent))', delay: '0s' },
    { top: '55%', left: '48%', size: '55%', color: 'var(--accent)', delay: '-7s' },
  ],
  [
    { top: '40%', left: '-18%', size: '70%', color: 'var(--accent)', delay: '-3s' },
    { top: '-15%', left: '45%', size: '58%', color: 'var(--accent-light, var(--accent))', delay: '-11s' },
  ],
  [
    { top: '10%', left: '30%', size: '75%', color: 'var(--accent-light, var(--accent))', delay: '-5s' },
    { top: '62%', left: '-12%', size: '50%', color: 'var(--accent)', delay: '-14s' },
  ],
];

export interface PosterBlob {
  top: string;
  left: string;
  size: string;
  color: string;
  delay: string;
}

export interface Poster {
  background: string;
  mark: { top: string; right: string; left: string; rotate: number; size: number };
  blobs: PosterBlob[];
  /** Seconds for the ground drift, so two posters never breathe in step. */
  driftSeconds: number;
  /** The invitation to post the first photo. */
  cta: string;
}

/**
 * A poster for one location. `seed` should be the location's stable id, and
 * `category` its kind, so the copy can be about the actual place.
 */
export function posterFor(seed: string, category?: string): Poster {
  const h = hash(seed || 'unknown');
  const pool = ctaPool(category);
  return {
    background: GROUNDS[h % GROUNDS.length],
    // Separately-derived indices, or the ground, the mark and the copy would
    // move together and the variety would be thinner than it looks.
    mark: MARKS[Math.floor(h / 7) % MARKS.length],
    blobs: BLOBS[Math.floor(h / 11) % BLOBS.length],
    // 20 to 30 seconds. Slow, because text sits on top of it.
    driftSeconds: 20 + (Math.floor(h / 17) % 11),
    cta: pool[Math.floor(h / 13) % pool.length],
  };
}
