// Lightweight haptics wrapper. `navigator.vibrate` works on Android Chrome
// and Firefox; iOS Safari doesn't expose it at all (no taptic-engine hook
// from the web, even in standalone PWAs). On unsupported platforms every
// call is a silent no-op so callers don't have to feature-detect.

const supported =
  typeof navigator !== 'undefined' &&
  typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function';

function fire(pattern: number | number[]): void {
  if (!supported) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when the document isn't focused.
  }
}

// A tiny nudge — button taps, list selections.
export const tap = (): void => fire(8);

// A firmer bump — successful like, photo-swipe snap, pull-to-refresh arm.
export const impact = (): void => fire(16);

// A positive double-beat — comment posted, trip saved.
export const success = (): void => fire([10, 40, 10]);

// A warning triple-beat — destructive confirm, error.
export const warning = (): void => fire([30, 30, 30]);
