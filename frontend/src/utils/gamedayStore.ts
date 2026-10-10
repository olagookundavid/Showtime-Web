import type {
    EventDayResponse,
    GamePassDiscountBandResponse,
    SeasonAdmissionTierResponse,
    TicketTierResponse,
} from '../types';

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
    /** True for the tier that gets the gold treatment — highest price for the
     *  per-gameday rates, highest display_order for season tiers. */
    isTop: boolean;
    /** The season admission tier's id, when this rate came from one (Game Pass). Undefined for the per-gameday-derived rates used by single-ticket purchase. */
    id?: string;
}

/**
 * A Game Pass bundle prices off the season-wide admission tier, not any one
 * gameday's ticket price, so this is a separate source from
 * `getRepresentativeTierRates` even though it feeds the same tier picker.
 */
export const seasonTiersToRates = (
    tiers: SeasonAdmissionTierResponse[],
): RepresentativeTierRate[] => {
    // Both the list order and the gold "top tier" treatment follow the
    // admin's own display_order — the highest display_order gets the gold.
    const active = [...tiers].filter((t) => t.is_active).sort((a, b) => a.display_order - b.display_order);
    const topOrder = active.length > 1 ? Math.max(...active.map((t) => t.display_order)) : null;

    return active.map((t) => ({
        id: t.id,
        name: t.name,
        rate: t.price,
        description: t.description,
        isTop: topOrder !== null && t.display_order === topOrder,
    }));
};

export type GamePassTierMatch = 'match' | 'price-mismatch' | 'none';

/**
 * Whether a gameday's own ticket tier lines up with an active season tier —
 * the same name+price rule GamePassService.Checkout and the public Game Pass
 * picker (getGamedaySelectionStatus below) already apply, mirrored here so
 * the admin Event Days page can show it instead of leaving it invisible.
 */
export const gamePassMatchForTier = (
    tier: { name: string; price: number },
    seasonTiers: SeasonAdmissionTierResponse[],
): { status: GamePassTierMatch; seasonTier: SeasonAdmissionTierResponse | null } => {
    const key = tier.name.trim().toLowerCase();
    const season = seasonTiers.find((s) => s.is_active && s.name.trim().toLowerCase() === key);
    if (!season) return { status: 'none', seasonTier: null };
    return { status: season.price === tier.price ? 'match' : 'price-mismatch', seasonTier: season };
};

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

/** Active discount bands, sorted by their starting gameday count. */
const activeBandsSorted = (
    bands: GamePassDiscountBandResponse[],
): GamePassDiscountBandResponse[] =>
    [...bands].filter((b) => b.is_active).sort((a, b) => a.min_gamedays - b.min_gamedays);

/** Same rule as the backend's `domain.GamePassDiscountBand.Covers`: the
 *  first active band whose range includes this many gamedays. `max_gamedays`
 *  of null means open-ended (the top band). */
export const getBundleDiscountBand = (
    gamedayCount: number,
    sortedActiveBands: GamePassDiscountBandResponse[],
): GamePassDiscountBandResponse | null => {
    if (gamedayCount < 2) return null;
    return (
        sortedActiveBands.find(
            (b) =>
                gamedayCount >= b.min_gamedays &&
                (b.max_gamedays === null || gamedayCount <= b.max_gamedays),
        ) ?? null
    );
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
    bands,
}: {
    gamedayCount: number;
    holders: number;
    rate: number;
    bands: GamePassDiscountBandResponse[];
}): GamePassTotals => {
    const standardTotal = gamedayCount * holders * rate;
    const sortedBands = activeBandsSorted(bands);
    const band = getBundleDiscountBand(gamedayCount, sortedBands);
    const discountPercent = band?.discount_percent ?? 0;
    const discountAmount = Math.round((standardTotal * discountPercent) / 100);
    const total = standardTotal - discountAmount;

    const currentIndex = band ? sortedBands.indexOf(band) : -1;
    const nextBand = sortedBands[currentIndex + 1];

    return {
        standardTotal,
        discountPercent,
        discountAmount,
        total,
        nextBandAt: nextBand ? nextBand.min_gamedays : null,
        nextBandPercent: nextBand ? nextBand.discount_percent : null,
    };
};
