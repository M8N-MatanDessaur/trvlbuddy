import { useLocation } from 'react-router-dom';

/**
 * Which side of the app a screen is on, taken from the address.
 *
 * Tools, SOS and Chat exist twice over. At /tools they are about where you
 * are standing right now. At /trip/<id>/tools they are about that trip. Same
 * screens, different subject, and the address is what says which, so a screen
 * asks here rather than reading whichever trip happens to be loaded.
 *
 * That was the bug this replaces: every screen read the current trip, so
 * walking from Nearby into Tools showed you the currency and the plugs for a
 * country you were not in.
 */
export interface Scope {
  kind: 'local' | 'trip';
  /** The trip this screen belongs to, when it belongs to one. */
  tripId: string | null;
}

export function scopeOf(pathname: string): Scope {
  const match = pathname.match(/^\/trip\/([^/]+)/);
  if (match) return { kind: 'trip', tripId: decodeURIComponent(match[1]) };
  return { kind: 'local', tripId: null };
}

export function useScope(): Scope {
  return scopeOf(useLocation().pathname);
}

/** Where a section lives, given the scope you are in. */
export function pathIn(scope: Scope, section: string): string {
  const suffix = section === '' || section === '/' ? '' : section;
  if (scope.kind === 'trip' && scope.tripId) {
    return `/trip/${encodeURIComponent(scope.tripId)}${suffix}`;
  }
  return suffix || '/nearby';
}

export default useScope;
