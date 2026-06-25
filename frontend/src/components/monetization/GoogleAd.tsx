import { useEffect, useRef, type CSSProperties } from 'react';
import { ADS_ENABLED, ADSENSE_CLIENT_ID, AD_SLOTS, type AdSlotName } from '../../config/monetization';

interface GoogleAdProps {
    /** Logical placement; maps to a numeric slot ID in AD_SLOTS. */
    slot: AdSlotName;
    /** AdSense ad format. "auto" (default) = responsive display unit. */
    format?: string;
    /** Allow the unit to grow to full container width on mobile. */
    responsive?: boolean;
    /** Extra classes on the <ins> (alongside the required "adsbygoogle"). */
    className?: string;
    /**
     * Inline style for the <ins>. A min-height is reserved by default to avoid
     * layout shift (CLS) while the ad loads; override per placement as needed.
     */
    style?: CSSProperties;
}

/**
 * A single responsive AdSense display unit.
 *
 * Renders nothing until ads are enabled AND the matching slot ID is filled in
 * AD_SLOTS — so unconfigured placements simply disappear rather than leaving an
 * empty box. Safe to scatter through the app before all slots exist.
 */
export const GoogleAd = ({
    slot,
    format = 'auto',
    responsive = true,
    className = '',
    style,
}: GoogleAdProps) => {
    const pushed = useRef(false);
    const slotId = AD_SLOTS[slot];

    useEffect(() => {
        if (!ADS_ENABLED || !slotId) return;
        // StrictMode runs effects twice in dev; pushing the same <ins> twice
        // throws "All 'ins' elements already have ads". Guard with a ref so we
        // request the ad exactly once per mount.
        if (pushed.current) return;
        pushed.current = true;

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.error('AdSense push failed', err);
        }
    }, [slotId]);

    if (!ADS_ENABLED || !slotId) return null;

    return (
        <ins
            className={`adsbygoogle ${className}`}
            style={{ display: 'block', minHeight: 90, ...style }}
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={slotId}
            data-ad-format={format}
            data-full-width-responsive={responsive ? 'true' : 'false'}
        />
    );
};
