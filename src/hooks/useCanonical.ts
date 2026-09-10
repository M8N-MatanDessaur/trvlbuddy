import { useEffect } from 'react';

/** Where this app really lives, whatever host it is being served from. */
const SITE = 'https://trvlbuddy.com';

/**
 * A canonical that matches the page, and an honest answer about indexing.
 *
 * The tag shipped in the HTML always said the root, so on any other screen it
 * pointed somewhere else and every checker flagged it. It is now written per
 * route.
 *
 * The rest of the app is behind an account. A crawler that follows a link to
 * a trip finds a sign-in screen, so those pages say noindex rather than
 * offering an empty page to the index. The headers say the same thing, and
 * the two agreeing is the point: a header alone is invisible in the markup,
 * and a tag alone is invisible to anything that only reads headers.
 */
export function useCanonical(pathname: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const isPublic = pathname === '/';
    const href = `${SITE}${pathname === '/' ? '/' : pathname}`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = href;

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = isPublic
      ? 'index, follow, max-image-preview:large, max-snippet:-1'
      : 'noindex, follow';

    // og:url follows the canonical, or a share of an inner page advertises
    // the front page as its address.
    const og = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (og) og.content = href;
  }, [pathname]);
}

export default useCanonical;
