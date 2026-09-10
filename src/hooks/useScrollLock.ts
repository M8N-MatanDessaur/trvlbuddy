import { useEffect } from 'react';

/**
 * Hold the page still while something is open on top of it.
 *
 * A full-screen viewer is its own place: the page it came from should not
 * move behind it, and a flick meant for the photograph should never end up
 * scrolling the list underneath. Restores whatever the page had before,
 * rather than assuming it was the default, and counts holders so two
 * overlapping overlays cannot unlock each other.
 */
let holders = 0;
let previousOverflow = '';
let previousTouchAction = '';

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Self-heal. If nothing is holding the page and it is still locked, let
    // it go: a lock outliving its overlay strands the page with no way back
    // except a reload, and the person it happens to has no idea why the
    // screen stopped moving. Only this hook ever sets these, so clearing
    // them when there is no holder cannot take away someone else's lock.
    if (!active && holders === 0) {
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
      if (document.body.style.touchAction === 'none') document.body.style.touchAction = '';
      return;
    }
    if (!active) return;

    if (holders === 0) {
      previousOverflow = document.body.style.overflow;
      previousTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
    holders += 1;

    return () => {
      holders = Math.max(0, holders - 1);
      if (holders === 0) {
        document.body.style.overflow = previousOverflow;
        document.body.style.touchAction = previousTouchAction;
      }
    };
  }, [active]);
}

export default useScrollLock;
