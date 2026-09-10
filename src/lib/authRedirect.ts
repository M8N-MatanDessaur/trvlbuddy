const PRODUCTION_ORIGIN = 'https://trvlbuddy.com';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getAuthRedirectUrl(): string {
  const configuredUrl = import.meta.env.VITE_SITE_URL || import.meta.env.VITE_APP_URL;
  if (configuredUrl) return trimTrailingSlash(configuredUrl);

  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;

  const { hostname, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  // On the dev server, come back to the dev server. Sending localhost to
  // production is what made signing in locally land you on the live site,
  // so there was no way to see local changes past the sign-in screen.
  if (isLocal) return import.meta.env.DEV ? trimTrailingSlash(origin) : PRODUCTION_ORIGIN;

  return trimTrailingSlash(origin);
}
