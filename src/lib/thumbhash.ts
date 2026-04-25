import { rgbaToThumbHash, thumbHashToDataURL } from 'thumbhash';

// A ThumbHash is a ~80-byte representation of an image that decodes to a
// tiny blurred preview. We compute it client-side at upload time and store
// the base64 string on activity_images.thumbhash. At render time, decoding
// is cheap enough to do on every paint (~0.1 ms) so we don't memoize unless
// a profile says we should.

const PREVIEW_MAX = 100; // px — the source for the hash, ThumbHash wants small input.

export async function computeThumbhashFromFile(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, PREVIEW_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const hashBytes = rgbaToThumbHash(w, h, data);
    return bytesToBase64(hashBytes);
  } catch (err) {
    console.warn('thumbhash compute failed', err);
    return null;
  }
}

const dataUrlCache = new Map<string, string>();

export function thumbhashToCssDataUrl(base64: string | null | undefined): string | null {
  if (!base64) return null;
  const cached = dataUrlCache.get(base64);
  if (cached) return cached;
  try {
    const bytes = base64ToBytes(base64);
    const url = thumbHashToDataURL(bytes);
    dataUrlCache.set(base64, url);
    return url;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
