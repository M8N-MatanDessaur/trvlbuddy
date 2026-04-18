const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GeocodeResult {
  address_components?: AddressComponent[];
}

export async function reverseGeocodeLocality(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const results: GeocodeResult[] = data.results;
    for (const r of results) {
      const comps = r.address_components || [];
      const locality = comps.find(c => c.types.includes('locality'));
      const admin = comps.find(c => c.types.includes('administrative_area_level_1'));
      const country = comps.find(c => c.types.includes('country'));
      if (locality) {
        return [locality.long_name, admin?.short_name || country?.long_name].filter(Boolean).join(', ');
      }
    }
    const first = results[0];
    const comps = first.address_components || [];
    const admin = comps.find(c => c.types.includes('administrative_area_level_1'));
    const country = comps.find(c => c.types.includes('country'));
    return [admin?.long_name, country?.long_name].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

export interface CountryInfo {
  name: string;
  code: string; // ISO short code (2 letters)
}

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<CountryInfo | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const results: GeocodeResult[] = data.results;
    for (const r of results) {
      const comps = r.address_components || [];
      const country = comps.find(c => c.types.includes('country'));
      if (country) return { name: country.long_name, code: country.short_name };
    }
    return null;
  } catch {
    return null;
  }
}
