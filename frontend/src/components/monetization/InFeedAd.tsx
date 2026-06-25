import { GoogleAd } from './GoogleAd';
import { ADS_ENABLED, AD_SLOTS, type AdSlotName } from '../../config/monetization';

interface InFeedAdProps {
    /** Logical placement; maps to a slot ID in AD_SLOTS. */
    slot: AdSlotName;
    className?: string;
}

/**
 * A display ad in a centered, site-styled container with an "Advertisement"
 * label — for dropping between cards in a feed (news list, match list, …) or
 * within article content.
 *
 * Returns null (no empty gap) when ads are off or the slot is unconfigured, so
 * it can be placed in feeds unconditionally. The label keeps us AdSense-policy
 * compliant: ad clusters must be clearly labelled, using only "Advertisement"
 * or "Sponsored Links".
 */
export const InFeedAd = ({ slot, className = '' }: InFeedAdProps) => {
    if (!ADS_ENABLED || !AD_SLOTS[slot]) return null;

    return (
        <div className={`my-6 flex w-full justify-center ${className}`}>
            <div className="w-full max-w-3xl">
                <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Advertisement
                </p>
                <GoogleAd slot={slot} />
            </div>
        </div>
    );
};
