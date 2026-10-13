// First-party visitor analytics beacon. Reports page views and a few actions to
// our own API (POST /events), which stores them for the admin Traffic page.
// See docs/analytics/README.md for the full design.
//
// Anonymous by design: nothing here identifies a person. The server records the
// request's IP; the browser contributes only a random per-tab session id.

import { API_URL } from '../constants';

const SESSION_KEY = 'st_sid';
const ENTRY_KEY = 'st_entry_sent';

// Dev builds would pollute the real table, so tracking is production-only.
// VITE_SITE_ANALYTICS_DISABLED=true switches it off in a production build too.
const enabled =
    import.meta.env.PROD && import.meta.env.VITE_SITE_ANALYTICS_DISABLED !== 'true';

export type TrackableEvent = 'page_view' | 'newsletter_signup' | 'add_to_cart' | 'outbound_click' | 'share';

function respectsDoNotTrack(): boolean {
    return typeof navigator !== 'undefined' && navigator.doNotTrack === '1';
}

function safeSession(): Storage | null {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

function randomId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

// sessionStorage (not localStorage or a cookie): the id dies with the tab, so
// it can count visits without following anyone around.
function sessionId(): string {
    const store = safeSession();
    if (!store) return '';
    let id = store.getItem(SESSION_KEY);
    if (!id) {
        id = randomId();
        store.setItem(SESSION_KEY, id);
    }
    return id;
}

function send(payload: Record<string, unknown>) {
    // text/plain keeps this a CORS "simple request": no preflight round-trip
    // before every page view. The API parses the body as JSON regardless.
    void fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit',
    }).catch(() => {
        // Analytics must never surface an error to the visitor.
    });
}

function externalReferrer(): string {
    if (!document.referrer) return '';
    try {
        return new URL(document.referrer).host === window.location.host ? '' : document.referrer;
    } catch {
        return '';
    }
}

/** Reports a page view. The first one in a browser session also carries where the visit came from. */
export function trackPageView(pathname: string) {
    // The admin panel is staff, not audience.
    if (!enabled || respectsDoNotTrack() || pathname.startsWith('/admin')) return;

    const payload: Record<string, unknown> = {
        type: 'page_view',
        path: pathname,
        session_id: sessionId(),
    };

    const store = safeSession();
    if (store && !store.getItem(ENTRY_KEY)) {
        store.setItem(ENTRY_KEY, '1');
        const params = new URLSearchParams(window.location.search);
        payload.is_entry = true;
        payload.referrer = externalReferrer();
        payload.utm_source = params.get('utm_source') ?? '';
        payload.utm_medium = params.get('utm_medium') ?? '';
        payload.utm_campaign = params.get('utm_campaign') ?? '';
    }
    send(payload);
}

/** Reports a meaningful action. Keep properties small and free of personal data. */
export function trackEvent(type: Exclude<TrackableEvent, 'page_view'>, properties?: Record<string, unknown>) {
    if (!enabled || respectsDoNotTrack()) return;
    send({ type, path: window.location.pathname, session_id: sessionId(), properties });
}
