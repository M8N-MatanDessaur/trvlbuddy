const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;

export interface LocalEvent {
  name: string;
  description: string;
  location: string;
  time: string;
  type: 'festival' | 'market' | 'exhibition' | 'performance' | 'popup' | 'other';
  sourceUrl?: string;
}

export interface FetchLiveEventsOptions {
  radiusKm?: number;
  excludeNames?: string[];
  focus?: string;
}

export const DEFAULT_LIVE_EVENTS_RADIUS_KM = 50;

const cache = new Map<string, { events: LocalEvent[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchLiveEvents(
  destinationName: string,
  coords: { lat: number; lng: number },
  options: FetchLiveEventsOptions = {},
): Promise<LocalEvent[]> {
  const radiusKm = options.radiusKm ?? DEFAULT_LIVE_EVENTS_RADIUS_KM;
  const excludeNames = options.excludeNames ?? [];
  const focus = options.focus?.trim() || '';
  const today = new Date().toISOString().slice(0, 10);

  const canCache = excludeNames.length === 0;
  const cacheKey = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)},${radiusKm},${today},${focus}`;

  if (canCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached.events;
    }
  }

  try {
    const excludeBlock = excludeNames.length
      ? `\n\nDo NOT include any of these events (already shown to the user): ${excludeNames.map(n => `"${n}"`).join(', ')}. Find different ones.`
      : '';

    const focusBlock = focus
      ? `\n\nSTRICT FOCUS: The user specifically asked for "${focus}". ONLY include events that clearly and directly match this request. Reject anything that does not fit — do NOT return adjacent or tangential events (e.g. if they asked for "outdoor markets", do NOT return exhibitions, concerts, or indoor gallery shows). If nothing matches within ${radiusKm} km, return an empty array []. An empty array is the correct answer when nothing truly matches.`
      : '';

    const prompt = `What events, festivals, pop-up markets, exhibitions, or performances are happening today (${today}) strictly within a ${radiusKm} km radius of ${destinationName} (approximate coordinates ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})?

Hard rules:
- Only include events whose venue is within ${radiusKm} km of those coordinates. Do NOT include events from other cities or regions that are farther away.
- Include temporary events, night markets, seasonal festivals, and notable local happenings.
- If nothing is happening exactly today, you may include events happening within the next 3 days, but still inside the ${radiusKm} km radius.${focusBlock}${excludeBlock}

Return ONLY a JSON array (no markdown, no explanation) with up to 6 events. Each event should have:
- "name": event name
- "description": one sentence description
- "location": specific venue or area (must be within ${radiusKm} km)
- "time": time range or "All day"
- "type": one of "festival", "market", "exhibition", "performance", "popup", "other"
- "sourceUrl": official event page / organizer / venue URL if you can confidently identify one (must start with http or https). Omit this field entirely if you are not confident it is a real, live URL. Do NOT guess, do NOT invent, do NOT output Google Maps or generic search URLs.

If you cannot find any qualifying events within the radius, return an empty array [].`;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    });

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      if (canCache) cache.set(cacheKey, { events: [], fetchedAt: Date.now() });
      return [];
    }

    const parsed: LocalEvent[] = JSON.parse(jsonMatch[0]);
    const excludeSet = new Set(excludeNames.map(n => n.toLowerCase().trim()));
    const events = parsed
      .filter(e => e && e.name && !excludeSet.has(e.name.toLowerCase().trim()))
      .map(e => {
        const url = typeof e.sourceUrl === 'string' ? e.sourceUrl.trim() : '';
        const isHttp = /^https?:\/\//i.test(url);
        return { ...e, sourceUrl: isHttp ? url : undefined };
      });

    if (canCache) cache.set(cacheKey, { events, fetchedAt: Date.now() });
    return events;
  } catch (err) {
    console.error('Live events fetch failed:', err);
    return [];
  }
}
