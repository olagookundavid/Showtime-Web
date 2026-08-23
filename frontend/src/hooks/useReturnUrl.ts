import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Where to send someone after they authenticate.
 *
 * Read from router state first (set when we navigate internally, e.g. the
 * comment auth prompt) and fall back to the ?returnUrl= query param, which is
 * what survives a page reload or a user bouncing between /login and /signup.
 *
 * Only same-origin paths are honoured: the value reaches us through a query
 * string anyone can edit, so an absolute URL here would turn every auth link
 * into an open redirect off the site.
 */
export function useReturnUrl(fallback = '/'): string {
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const raw = (location.state as { returnUrl?: string } | null)?.returnUrl
        ?? searchParams.get('returnUrl')
        ?? '';

    // Must start with a single "/" — "//evil.com" and "https://evil.com" are
    // both rejected, as is any scheme-relative or protocol-prefixed value.
    if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
    return raw;
}

/** Appends the current returnUrl to an internal auth path, so hopping between
 *  /login and /signup doesn't lose where the user came from. */
export function withReturnUrl(path: string, returnUrl: string): string {
    if (!returnUrl || returnUrl === '/') return path;
    return `${path}?returnUrl=${encodeURIComponent(returnUrl)}`;
}
