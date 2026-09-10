import { useEffect } from 'react';

const SUFFIX = 'TrvlBuddy';

/**
 * What the front page is called, matching the title in index.html.
 *
 * A screen with no name of its own must fall back to this rather than to the
 * brand alone: the front page is the one page a crawler reads, and this hook
 * runs before it gets there, so "TrvlBuddy" on its own is what a search
 * result would have said.
 */
const DEFAULT_TITLE = 'TrvlBuddy: find what is worth doing, right where you are';

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
    document.title = title ? `${title} | ${SUFFIX}` : DEFAULT_TITLE;
  }, [title]);
}

export default useDocumentTitle;
