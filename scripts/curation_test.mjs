import fs from 'fs';
import { execSync } from 'child_process';

// Does the curation actually reject the list the owner complained about, and
// does it surface the things worth going to? Tested against real rows from
// place_facts, not invented data.
const TOKEN = fs.readFileSync('C:/Code/Personal/MindSteps/.env.local', 'utf8')
  .split(/\r?\n/).find(l => l.startsWith('SUPABASE_ACCESS_TOKEN='))
  .split('=').slice(1).join('=').trim();

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/zuflsfetbywjrszrvqwl/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  try { return JSON.parse(await r.text()); } catch { return []; }
}

// Compile the TS module to something node can import.
execSync('npx esbuild src/services/placeScore.ts --bundle --format=esm --platform=node --outfile=.ai-workspace/placeScore.mjs --log-level=error', { stdio: 'inherit' });
const { curatePlaces, explainCuration } = await import('./placeScore.mjs');

// 1. The exact feed the owner described. Review counts are realistic for a
//    residential neighbourhood.
const complained = [
  { placeId: '1', name: 'Parc Jean-Brillant playground', category: 'playground', types: ['playground', 'park'], distance: 120, rating: 4.4, userRatingsTotal: 18 },
  { placeId: '2', name: 'Parc de la Petite-Place', category: 'park', types: ['park'], distance: 210, rating: 4.2, userRatingsTotal: 11 },
  { placeId: '3', name: 'Parc Lafond-Est', category: 'park', types: ['park'], distance: 330, rating: 4.0, userRatingsTotal: 7 },
  { placeId: '4', name: 'Tim Hortons', category: 'coffee_shop', types: ['coffee_shop', 'cafe'], distance: 150, rating: 3.6, userRatingsTotal: 412 },
  { placeId: '5', name: "McDonald's", category: 'fast_food_restaurant', types: ['fast_food_restaurant', 'restaurant'], distance: 190, rating: 3.4, userRatingsTotal: 1870 },
  { placeId: '6', name: 'Alimentation Bo-Choix', category: 'grocery_store', types: ['grocery_store', 'convenience_store'], distance: 240, rating: 4.1, userRatingsTotal: 63 },
];

console.log('=== the feed as it looked (all six should be dropped) ===');
for (const row of explainCuration(complained)) {
  console.log(`  ${row.kept ? 'KEPT   ' : 'dropped'} ${row.name.padEnd(34)} ${row.reason ?? 'score ' + row.score}`);
}
const keptFromComplaint = curatePlaces(complained);
console.log(`  -> ${keptFromComplaint.length} of 6 kept\n`);

// 2. Real places out of place_facts, which came from actual searches.
const real = await sql(`
  select place_id, name, coalesce(types, array[]::text[]) as types,
         rating, user_ratings_total
  from public.place_facts
  where user_ratings_total is not null
  order by user_ratings_total desc limit 14`);

const asPlaces = real.map((r, i) => ({
  placeId: r.place_id,
  name: r.name ?? 'Unnamed',
  category: (r.types ?? [])[0] ?? 'point_of_interest',
  types: r.types ?? [],
  // Spread them 200m..2.8km so distance is in play but not decisive.
  distance: 200 + i * 200,
  rating: r.rating != null ? Number(r.rating) : undefined,
  userRatingsTotal: r.user_ratings_total ?? undefined,
}));

console.log('=== real cached places, ranked ===');
const curated = curatePlaces(asPlaces);
for (const [i, p] of curated.entries()) {
  console.log(`  ${String(i + 1).padStart(2)}. ${p.name.slice(0, 36).padEnd(38)} score ${p.score.toFixed(2)}  ${p.userRatingsTotal} reviews  ${Math.round(p.distance)}m  ${p.category}`);
}
const dropped = explainCuration(asPlaces).filter((x) => !x.kept);
if (dropped.length) {
  console.log('\n  dropped:');
  for (const d of dropped) console.log(`    ${d.name.slice(0, 36).padEnd(38)} ${d.reason}`);
}

// 3. The thesis: a place somebody photographed beats a famous one nobody did.
console.log('\n=== app content outranks Google notability ===');
const thesis = [
  { placeId: 'a', name: 'Huge Famous Museum', category: 'museum', types: ['museum'], distance: 400, rating: 4.6, userRatingsTotal: 41000 },
  { placeId: 'b', name: 'Tiny bar a friend shot a video in', category: 'bar', types: ['bar'], distance: 900, rating: 4.5, userRatingsTotal: 22,
    app: { mediaCount: 2, commentCount: 3, voteScore: 5 } },
];
for (const p of curatePlaces(thesis)) {
  console.log(`  ${p.name.padEnd(36)} score ${p.score.toFixed(2)}`);
}

// 4. A great place further away must beat a dull one next door.
console.log('\n=== distance does not dominate ===');
const geo = [
  { placeId: 'c', name: 'Bench-sized park 80m away', category: 'park', types: ['park'], distance: 80, rating: 4.3, userRatingsTotal: 55 },
  { placeId: 'd', name: 'Gallery 2.2km away', category: 'art_gallery', types: ['art_gallery'], distance: 2200, rating: 4.7, userRatingsTotal: 1900 },
];
for (const p of curatePlaces(geo)) {
  console.log(`  ${p.name.padEnd(36)} score ${p.score.toFixed(2)}  ${p.distance}m`);
}

const ok =
  keptFromComplaint.length === 0 &&
  curatePlaces(thesis)[0].name.startsWith('Tiny bar') &&
  curatePlaces(geo)[0].name.startsWith('Gallery');
console.log(`\n${ok ? 'PASS' : 'FAIL'} - boring feed rejected, app content wins, distance does not dominate`);
