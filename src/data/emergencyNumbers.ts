// Emergency numbers, bundled with the app.
//
// SOS used to generate this list at runtime by asking Gemini for the numbers
// for your coordinates. That meant the one screen you open when something has
// gone wrong needed a network round trip, a working API key and credit on the
// account -- and when the Gemini credits ran out, SOS simply stopped working,
// with no fallback at all. It is also the wrong shape of problem for a
// language model: these are fixed, checkable facts, not something to infer.
//
// So they ship in the bundle. No network, no key, no cost, works on a plane.
//
// PROVENANCE
// Every value below was checked on 2026-09-09 against Wikipedia's "List of
// emergency telephone numbers" and "Emergency telephone number" articles:
//   https://en.wikipedia.org/wiki/List_of_emergency_telephone_numbers
//   https://en.wikipedia.org/wiki/Emergency_telephone_number
// Where an earlier draft of this file disagreed with those sources, the
// sources won. Countries the sources did not cover were REMOVED rather than
// guessed at -- an unknown country falls through to the 112 fallback with a
// visible caveat, which is honest, whereas a wrong number is dangerous.
//
// This is still a convenience, not an authority. Numbers change, and a
// national number is not always reachable from every network. The UI always
// shows a "confirm the local number when you arrive" line. When updating,
// cite a source in the commit.
//
// 112 is reachable from any mobile in the EU and, on GSM networks, routes
// through to local services in many countries where it is not the official
// number -- which is why it is the fallback.

export interface EmergencyNumbers {
  /** One number that reaches everything. Shown first when present. */
  general?: string;
  police?: string;
  ambulance?: string;
  fire?: string;
}

export const FALLBACK_NUMBERS: EmergencyNumbers = { general: '112' };

// Keyed by ISO 3166-1 alpha-2. `general` is used when one number reaches all
// services; the per-service fields are only set where the sources list
// distinct numbers.
export const EMERGENCY_NUMBERS: Record<string, EmergencyNumbers> = {
  // ---- North America
  US: { general: '911' },
  CA: { general: '911' },
  MX: { general: '911' },

  // ---- Europe (112 is the common EU number; national lines listed where the
  // sources give distinct ones)
  GB: { general: '999' },
  IE: { general: '112' },
  FR: { general: '112', police: '17', ambulance: '15', fire: '18' },
  DE: { general: '112', police: '110' },
  IT: { general: '112' },
  ES: { general: '112' },
  PT: { general: '112' },
  NL: { general: '112' },
  BE: { general: '112', police: '101' },
  LU: { general: '112' },
  AT: { general: '112', police: '133', ambulance: '144', fire: '122' },
  CH: { police: '117', ambulance: '144', fire: '118' },
  DK: { general: '112' },
  SE: { general: '112' },
  NO: { general: '112', ambulance: '113', fire: '110' },
  FI: { general: '112' },
  IS: { general: '112' },
  PL: { general: '112', police: '997', ambulance: '999', fire: '998' },
  CZ: { general: '112', police: '158', ambulance: '155', fire: '150' },
  SK: { general: '112' },
  HU: { general: '112', police: '107', ambulance: '104', fire: '105' },
  RO: { general: '112' },
  BG: { general: '112' },
  GR: { general: '112', police: '100', ambulance: '166', fire: '199' },
  HR: { general: '112' },
  SI: { general: '112' },
  RS: { general: '112', police: '192', ambulance: '194', fire: '193' },
  EE: { general: '112' },
  LV: { general: '112' },
  LT: { general: '112' },
  CY: { general: '112' },
  MT: { general: '112' },
  UA: { general: '112', police: '102', ambulance: '103', fire: '101' },
  TR: { general: '112' },

  // ---- Middle East
  IL: { police: '100', ambulance: '101', fire: '102' },
  AE: { police: '999', ambulance: '998', fire: '997' },
  SA: { general: '911', ambulance: '997', fire: '998' },
  QA: { general: '999' },

  // ---- Asia
  JP: { police: '110', ambulance: '119', fire: '119' },
  KR: { police: '112', ambulance: '119', fire: '119' },
  CN: { police: '110', ambulance: '120', fire: '119' },
  HK: { general: '999' },
  TW: { police: '110', ambulance: '119', fire: '119' },
  SG: { police: '999', ambulance: '995', fire: '995' },
  MY: { general: '999' },
  TH: { police: '191', ambulance: '1669', fire: '199' },
  VN: { police: '113', ambulance: '115', fire: '114' },
  ID: { police: '112', ambulance: '118', fire: '113' },
  PH: { general: '911' },
  IN: { general: '112', ambulance: '108', fire: '101' },
  NP: { police: '100', ambulance: '102', fire: '101' },
  LK: { police: '119', ambulance: '110', fire: '110' },

  // ---- Oceania
  AU: { general: '000' },
  NZ: { general: '111' },

  // ---- Africa
  ZA: { police: '10111', ambulance: '10177', fire: '10177' },
  MA: { police: '19', ambulance: '15', fire: '15' },
  EG: { police: '112', ambulance: '123', fire: '180' },
  KE: { general: '112' },
  GH: { police: '112', ambulance: '191', fire: '192' },
  NG: { general: '112' },
  ET: { police: '911', ambulance: '907', fire: '939' },

  // ---- South America
  BR: { police: '190', ambulance: '192', fire: '193' },
  AR: { general: '911', ambulance: '107', fire: '100' },
  CL: { police: '133', ambulance: '131', fire: '132' },
  CO: { police: '112', ambulance: '125', fire: '119' },
  PE: { general: '911', ambulance: '106', fire: '116' },
  UY: { general: '911', ambulance: '105', fire: '104' },
  EC: { general: '911', ambulance: '131', fire: '102' },
  BO: { general: '911', ambulance: '118', fire: '119' },

  // ---- Central America / Caribbean
  CR: { general: '911' },
  PA: { general: '911' },
  DO: { general: '911' },
  JM: { police: '119', ambulance: '110', fire: '110' },
  CU: { police: '106', ambulance: '104', fire: '105' },
};

export interface EmergencyLookup {
  numbers: EmergencyNumbers;
  /** False when the country is not in the list and 112 is being offered. */
  known: boolean;
}

/**
 * Numbers for an ISO country code. Always returns something dialable: an
 * unknown country falls back to 112, flagged so the UI can say so.
 */
export function emergencyNumbersFor(countryCode: string | null | undefined): EmergencyLookup {
  const code = (countryCode || '').trim().toUpperCase();
  const hit = code ? EMERGENCY_NUMBERS[code] : undefined;
  if (hit) return { numbers: hit, known: true };
  return { numbers: FALLBACK_NUMBERS, known: false };
}

/** The single number to put on the big button. */
export function primaryEmergencyNumber(numbers: EmergencyNumbers): string {
  return numbers.general || numbers.police || numbers.ambulance || numbers.fire || '112';
}

/** Every distinct number with a label, for the list under the button. */
export function labelledNumbers(numbers: EmergencyNumbers): Array<{ label: string; number: string }> {
  const out: Array<{ label: string; number: string }> = [];
  const seen = new Set<string>();
  const add = (label: string, number?: string) => {
    if (!number || seen.has(number)) return;
    seen.add(number);
    out.push({ label, number });
  };
  add('Emergency', numbers.general);
  add('Police', numbers.police);
  add('Ambulance', numbers.ambulance);
  add('Fire', numbers.fire);
  return out;
}

export const COUNTRY_CODES_WITH_NUMBERS = Object.keys(EMERGENCY_NUMBERS).sort();
