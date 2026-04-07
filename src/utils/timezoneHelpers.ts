/**
 * Get the current hour (0-23) in a destination's timezone.
 * Uses Intl.DateTimeFormat so no external dependencies are needed.
 */
export function getLocalHour(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).formatToParts(new Date());

    const hourPart = parts.find((p) => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : new Date().getHours();
  } catch {
    // Invalid timezone string: fall back to device local time
    return new Date().getHours();
  }
}

export type TimeOfDay =
  | 'early-morning' // 5-7
  | 'morning' // 8-11
  | 'lunch' // 12-13
  | 'afternoon' // 14-16
  | 'evening' // 17-20
  | 'late-night'; // 21-4

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour <= 7) return 'early-morning';
  if (hour >= 8 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 13) return 'lunch';
  if (hour >= 14 && hour <= 16) return 'afternoon';
  if (hour >= 17 && hour <= 20) return 'evening';
  return 'late-night';
}

/**
 * Get a formatted local time string for display (e.g. "8:30 PM").
 */
export function getLocalTimeString(timezone: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  } catch {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
