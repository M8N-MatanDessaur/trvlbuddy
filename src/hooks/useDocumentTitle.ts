import { useEffect } from 'react';

const SUFFIX = 'TrvlBuddy';

/**
 * What the tab says.
 *
 * A single page app keeps whatever title the HTML shipped with, so every
 * screen, every trip and every open tab looked identical in the tab strip,
 * in history and in a bookmark. The title is the only label those places
 * have.
 *
 * Pass null while a screen does not know its own name yet, and the app's
 * name stands alone rather than flashing a wrong one.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = title ? `${title} | ${SUFFIX}` : SUFFIX;
  }, [title]);
}

export default useDocumentTitle;
