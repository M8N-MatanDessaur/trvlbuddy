import fs from 'fs';

// Re-check the bundled table against what the sources said on 2026-09-09.
// The expectations below are transcribed from:
//   https://en.wikipedia.org/wiki/List_of_emergency_telephone_numbers
//   https://en.wikipedia.org/wiki/Emergency_telephone_number
// If this ever fails, either the table drifted or a number genuinely changed --
// in which case re-check the source and update BOTH.
const SOURCE = {
  US: ['911'], CA: ['911'], MX: ['911'],
  GB: ['999'], IE: ['112'],
  FR: ['112', '17', '15', '18'], DE: ['112', '110'],
  IT: ['112'], ES: ['112'], PT: ['112'], NL: ['112'],
  BE: ['112', '101'], AT: ['112', '133', '144', '122'],
  CH: ['117', '144', '118'],
  DK: ['112'], SE: ['112'], NO: ['112', '113', '110'], FI: ['112'], IS: ['112'],
  PL: ['112', '997', '999', '998'], CZ: ['112', '158', '155', '150'],
  HU: ['112', '107', '104', '105'], GR: ['112', '100', '166', '199'],
  RS: ['112', '192', '194', '193'], UA: ['112', '102', '103', '101'],
  TR: ['112'],
  IL: ['100', '101', '102'], AE: ['999', '998', '997'], SA: ['911', '997', '998'],
  QA: ['999'],
  JP: ['110', '119'], KR: ['112', '119'], CN: ['110', '120', '119'],
  HK: ['999'], TW: ['110', '119'], SG: ['999', '995'], MY: ['999'],
  TH: ['191', '1669', '199'], VN: ['113', '115', '114'],
  ID: ['112', '118', '113'], PH: ['911'], IN: ['112', '108', '101'],
  NP: ['100', '102', '101'], LK: ['119', '110'],
  AU: ['000'], NZ: ['111'],
  ZA: ['10111', '10177'], MA: ['19', '15'], EG: ['112', '123', '180'],
  KE: ['112'], GH: ['112', '191', '192'], NG: ['112'], ET: ['911', '907', '939'],
  BR: ['190', '192', '193'], AR: ['911', '107', '100'], CL: ['133', '131', '132'],
  CO: ['112', '125', '119'], PE: ['911', '106', '116'], UY: ['911', '105', '104'],
  EC: ['911', '131', '102'], BO: ['911', '118', '119'],
  CR: ['911'], PA: ['911'], DO: ['911'], JM: ['119', '110'], CU: ['106', '104', '105'],
};

// Countries kept on the strength of the EU-wide 112 arrangement rather than a
// per-country line in the source.
const EU_112_ONLY = ['LU', 'SK', 'RO', 'BG', 'HR', 'SI', 'EE', 'LV', 'LT', 'CY', 'MT'];

const src = fs.readFileSync('src/data/emergencyNumbers.ts', 'utf8');
const body = src.slice(src.indexOf('EMERGENCY_NUMBERS: Record<string, EmergencyNumbers> = {'));
const table = {};
for (const m of body.matchAll(/^\s{2}([A-Z]{2}): \{([^}]*)\},$/gm)) {
  table[m[1]] = [...m[2].matchAll(/'(\d+)'/g)].map((x) => x[1]);
}

console.log(`table has ${Object.keys(table).length} countries\n`);

let problems = 0;
for (const [code, expected] of Object.entries(SOURCE)) {
  const actual = table[code];
  if (!actual) { console.log(`MISSING  ${code} — source has ${expected.join('/')}`); problems++; continue; }
  const extra = actual.filter((n) => !expected.includes(n));
  const missing = expected.filter((n) => !actual.includes(n));
  if (extra.length || missing.length) {
    console.log(`DIFF     ${code}  table=${actual.join('/')}  source=${expected.join('/')}` +
      (extra.length ? `  [unsourced: ${extra.join(',')}]` : '') +
      (missing.length ? `  [not in table: ${missing.join(',')}]` : ''));
    problems++;
  }
}

for (const code of EU_112_ONLY) {
  const actual = table[code];
  if (!actual || actual.join() !== '112') {
    console.log(`DIFF     ${code}  expected 112 only, table=${actual?.join('/') ?? 'missing'}`);
    problems++;
  }
}

const unaccounted = Object.keys(table).filter((c) => !SOURCE[c] && !EU_112_ONLY.includes(c));
if (unaccounted.length) {
  console.log(`\nUNVERIFIED entries still in the table: ${unaccounted.join(', ')}`);
  problems += unaccounted.length;
}

console.log(problems === 0
  ? '\nOK - every entry matches a checked source, and nothing unverified is present.'
  : `\n${problems} discrepancies to resolve.`);
