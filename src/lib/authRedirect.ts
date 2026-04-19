const PRODUCTION_ORIGIN = 'https://trvlbuddy.com';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getAuthRedirectUrl(): string {
  const configuredUrl = import.meta.env.VITE_SITE_URL || import.meta.env.VITE_APP_URL;
  if (configuredUrl) return trimTrailingSlash(configuredUrl);

  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;

  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return PRODUCTION_ORIGIN;

  return trimTrailingSlash(origin);
}
