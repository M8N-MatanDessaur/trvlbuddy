const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_VISION_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;

export interface ImageAnalysis {
  translation?: string;
  culturalContext?: string;
  recommendations?: string[];
  menuItems?: { name: string; description: string; price?: string }[];
  summary: string;
}

/**
 * Compress an image file to a maximum width and quality before sending to Gemini.
 * Returns a base64 data string (without the data:image prefix).
 */
function compressImage(file: File, maxWidth = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Strip the data:image/jpeg;base64, prefix
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function analyzeImage(
  file: File,
  destinationName?: string,
  language?: string,
): Promise<ImageAnalysis> {
  const base64 = await compressImage(file);

  const contextLine = destinationName
    ? `The user is traveling in ${destinationName}${language ? ` where the local language is ${language}` : ''}.`
    : 'The user is traveling abroad.';

  const prompt = `You are a travel assistant with expertise in culture, food, and language. ${contextLine}

Analyze this image and provide a helpful response for a traveler. The image might be a menu, a street sign, a subway map, a product label, a storefront, or any other thing a traveler might photograph.

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "summary": "One sentence describing what the image shows",
  "translation": "Full translation of any text in the image (null if no text)",
  "culturalContext": "Cultural explanation, tips, or background information that would help a traveler understand what they are looking at (null if not applicable)",
  "recommendations": ["Actionable recommendation 1", "Recommendation 2"],
  "menuItems": [{"name": "dish name in English", "description": "what it is", "price": "price if visible"}]
}

The menuItems array should only be populated if the image is a menu or food-related. Otherwise set it to null.
The recommendations array should contain 1-3 practical tips.`;

  const response = await fetch(GEMINI_VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { summary: text.slice(0, 200) || 'Could not analyze image.' };
  }

  try {
    return JSON.parse(jsonMatch[0]) as ImageAnalysis;
  } catch {
    return { summary: text.slice(0, 200) };
  }
}
