import { useEffect, useState } from 'react';

/**
 * Whether a media query currently matches, kept in sync as the window changes.
 *
 * Used for the places where desktop is a different layout rather than the same
 * layout with different numbers, a left rail instead of a bottom bar, say.
 * Anything that is only a matter of size belongs in CSS, not here.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Wide enough for a rail beside the content and a pointer to drive it. The
 * breakpoint is where two columns stop being cramped, not where a particular
 * device sits.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export default useMediaQuery;
