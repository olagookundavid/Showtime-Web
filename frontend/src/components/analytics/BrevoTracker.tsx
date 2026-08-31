import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BREVO_CLIENT_KEY, BREVO_TRACKING_ENABLED } from '../../config/analytics';

const SCRIPT_SRC = 'https://cdn.brevo.com/js/sdk-loader.js';

/** The SDK's command queue — an array of tuples pushed before/after the CDN loads. */
type BrevoQueue = unknown[][];

declare global {
    interface Window {
        Brevo?: BrevoQueue;
    }
}

/**
 * Loads the Brevo tracker and reports client-side navigations to it.
 *
 * Renders nothing. Mount once inside <BrowserRouter> (see App.tsx) — it needs
 * router context for useLocation.
 *
 * What this is for: Brevo ties page visits to *contacts*, so a newsletter
 * subscriber's browsing can trigger automation ("viewed tickets 3x → email").
 * It is not a traffic-counting tool — Vercel Web Analytics does that job.
 *
 * Stays inert until VITE_BREVO_CLIENT_KEY is set, so dev builds send nothing.
 */
export const BrevoTracker = () => {
    const location = useLocation();

    // Inject the loader once. window.Brevo is a command queue, so pushes that
    // happen before the CDN script arrives are replayed once it does.
    useEffect(() => {
        if (!BREVO_TRACKING_ENABLED) return;
        // Guard against double-injection (StrictMode, Vite fast-refresh).
        if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;

        window.Brevo = window.Brevo || [];
        window.Brevo.push(['init', { client_key: BREVO_CLIENT_KEY }]);

        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
    }, []);

    // Brevo auto-tracks the first page load, but a React Router navigation never
    // reloads the document, so every subsequent page has to be reported by hand.
    // Sending on mount too would double-count the landing page, hence the ref.
    useEffect(() => {
        if (!BREVO_TRACKING_ENABLED) return;
        if (!hasTrackedInitialView) {
            hasTrackedInitialView = true;
            return;
        }

        window.Brevo = window.Brevo || [];
        window.Brevo.push([
            'page',
            document.title || location.pathname,
            {
                ma_url: window.location.href,
                ma_path: location.pathname,
                ma_title: document.title,
            },
        ]);
    }, [location.pathname]);

    return null;
};

// Module-scoped rather than a ref: StrictMode double-mounts in dev, and a ref
// would reset with the component, letting the landing page report twice.
let hasTrackedInitialView = false;
