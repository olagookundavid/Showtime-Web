import { useEffect } from 'react';
import { ADS_ENABLED, ADSENSE_CLIENT_ID } from '../../config/monetization';

const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

/**
 * Injects the Google AdSense loader script once, app-wide. This single script
 * powers BOTH:
 *   • Auto ads — toggled per-site in the AdSense dashboard, and
 *   • the manual <GoogleAd /> units placed around the app.
 *
 * Renders nothing. Mount it once high in the tree (see App.tsx). Stays inert
 * until VITE_ADS_ENABLED=true and a real ca-pub client ID is configured, so
 * dev and pre-approval builds never load Google's script.
 *
 * Note for this SPA: Auto ads only scan the page on a full load, so they're
 * unreliable across React Router client-side navigations — the manual
 * <GoogleAd /> units are what reliably fill on in-app navigation.
 */
export const AdSenseScript = () => {
    useEffect(() => {
        if (!ADS_ENABLED) return;
        // Guard against double-injection (StrictMode, Vite fast-refresh).
        if (document.querySelector('script[src*="adsbygoogle.js"]')) return;

        const script = document.createElement('script');
        script.src = `${SCRIPT_SRC}?client=${ADSENSE_CLIENT_ID}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
    }, []);

    return null;
};
