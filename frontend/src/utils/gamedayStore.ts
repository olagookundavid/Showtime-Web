import type { EventDayResponse, TicketTierResponse } from '../types';

/** One perk per line. Blank lines are dropped. Shared by every tier card. */
export const parseTierPerks = (description?: string): string[] =>
    description
        ?.split('\n')
        .map((line) => line.trim())
        .filter(Boolean) ?? [];

/**
 * Ticket tiers are priced per gameday, not season-wide — two gamedays can
 * price "VIP" differently. Rather than averaging or inventing a flat rate,
 * this derives the most common ("mode") price per tier name across all
 * currently-loaded gamedays, so the tier picker has one number to show
 * before a specific gameday is chosen. Ties break on the lower price.
 */
export interface RepresentativeTierRate {
    /** Most common raw-cased spelling for this (case-insensitively grouped) tier name. */
    name: string;
    rate: number;
    description: string;
    /** True for the highest-rate tier — the one that gets the gold treatment. */
    isTop: boolean;
}

export const getRepresentativeTierRates = (
    eventDays: EventDayResponse[],
): RepresentativeTierRate[] => {
    type PriceStat = { price: number; count: number; description: string };
    const groups = new Map<
        string,
        { names: Map<string, number>; prices: Map<number, PriceStat> }
    >();

    eventDays
        .filter((day) => day.is_active)
        .forEach((day) => {
            (day.tiers ?? []).forEach((tier) => {
                const key = tier.name.trim().toLowerCase();
                if (!key) return;
                const group = groups.get(key) ?? {
                    names: new Map<string, number>(),
                    prices: new Map<number, PriceStat>(),
                };
                group.names.set(tier.name, (group.names.get(tier.name) ?? 0) + 1);
                const existing = group.prices.get(tier.price);
                if (existing) {
                    existing.count += 1;
                } else {
                    group.prices.set(tier.price, {
                        price: tier.price,
                        count: 1,
                        description: tier.description,
                    });
                }
                groups.set(key, group);
            });
        });

    const rates: Omit<RepresentativeTierRate, 'isTop'>[] = [];

    groups.forEach((group) => {
        const bestName = [...group.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        const bestPrice = [...group.prices.values()].sort(
            (a, b) => b.count - a.count || a.price - b.price,
        )[0];

        rates.push({
            name: bestName,
            rate: bestPrice?.price ?? 0,
            description: bestPrice?.description ?? '',
        });
    });

    rates.sort((a, b) => a.rate - b.rate);
    const topRate = rates.length > 1 ? Math.max(...rates.map((r) => r.rate)) : null;

    return rates.map((r) => ({ ...r, isTop: topRate !== null && r.rate === topRate }));
};

/** Why a given gameday can or can't be picked for the currently selected tier. */
export type GamedaySelectionStatus = 'match' | 'price-mismatch' | 'not-offered' | 'sold-out';

export interface GamedaySelectionResult {
    status: GamedaySelectionStatus;
    /** The real tier row for this gameday, when one exists by that name. */
    tier: TicketTierResponse | null;
}

export const getGamedaySelectionStatus = (
    eventDay: EventDayResponse,
    tierName: string,
    representativeRate: number,
): GamedaySelectionResult => {
    const key = tierName.trim().toLowerCase();
    const tier = (eventDay.tiers ?? []).find((t) => t.name.trim().toLowerCase() === key) ?? null;

    if (!tier) return { status: 'not-offered', tier: null };
    if (tier.price !== representativeRate) return { status: 'price-mismatch', tier };
    if (tier.capacity > 0 && tier.available <= 0) return { status: 'sold-out', tier };
    return { status: 'match', tier };
};

export interface BundleDiscountBand {
    min: number;
    max: number;
    percent: number;
}

/** 2-3 gamedays: 5% off. 4-5: 10% off. 6 or more: 15% off, uncapped (a real
 *  season can run longer than the mockup's 8-gameday sample). */
export const BUNDLE_DISCOUNT_BANDS: BundleDiscountBand[] = [
    { min: 2, max: 3, percent: 5 },
    { min: 4, max: 5, percent: 10 },
    { min: 6, max: Infinity, percent: 15 },
];

export const getBundleDiscountBand = (gamedayCount: number): BundleDiscountBand | null => {
    if (gamedayCount < 2) return null;
    return BUNDLE_DISCOUNT_BANDS.find((b) => gamedayCount >= b.min && gamedayCount <= b.max) ?? null;
};

export interface GamePassTotals {
    standardTotal: number;
    discountPercent: number;
    discountAmount: number;
    total: number;
    /** How many gamedays would unlock the next band, or null already in the top band. */
    nextBandAt: number | null;
    nextBandPercent: number | null;
}

export const calculateGamePassTotals = ({
    gamedayCount,
    holders,
    rate,
}: {
    gamedayCount: number;
    holders: number;
    rate: number;
}): GamePassTotals => {
    const standardTotal = gamedayCount * holders * rate;
    const band = getBundleDiscountBand(gamedayCount);
    const discountPercent = band?.percent ?? 0;
    const discountAmount = Math.round((standardTotal * discountPercent) / 100);
    const total = standardTotal - discountAmount;

    const currentIndex = band ? BUNDLE_DISCOUNT_BANDS.indexOf(band) : -1;
    const nextBand = BUNDLE_DISCOUNT_BANDS[currentIndex + 1];

    return {
        standardTotal,
        discountPercent,
        discountAmount,
        total,
        nextBandAt: nextBand ? nextBand.min : null,
        nextBandPercent: nextBand ? nextBand.percent : null,
    };
};
