const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;

export interface LocalEvent {
  name: string;
  description: string;
  location: string;
  time: string;
  type: 'festival' | 'market' | 'exhibition' | 'performance' | 'popup' | 'other';
}

// In-memory cache: keyed by "lat,lng,date"
const cache = new Map<string, { events: LocalEvent[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchLiveEvents(
  destinationName: string,
  coords: { lat: number; lng: number },
): Promise<LocalEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)},${today}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.events;
  }

  try {
    const prompt = `What events, festivals, pop-up markets, exhibitions, or performances are happening today (${today}) in or near ${destinationName}? Include temporary events, night markets, seasonal festivals, and any notable happenings.

Return ONLY a JSON array (no markdown, no explanation) with up to 6 events. Each event should have:
- "name": event name
- "description": one sentence description
- "location": specific venue or area
- "time": time range or "All day"
- "type": one of "festival", "market", "exhibition", "performance", "popup", "other"

If you cannot find specific events for today, return events happening this week.
If no events at all, return an empty array [].`;

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

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      cache.set(key, { events: [], fetchedAt: Date.now() });
      return [];
    }

    const events: LocalEvent[] = JSON.parse(jsonMatch[0]);
    cache.set(key, { events, fetchedAt: Date.now() });
    return events;
  } catch (err) {
    console.error('Live events fetch failed:', err);
    return [];
  }
}
