import type { GamePassRule, TicketProductDayResponse } from '../../types';

/** "Saturday, November 14", from a plain YYYY-MM-DD match day. */
export const formatDayLong = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** "Sat, Nov 14". */
export const formatDayShort = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** A product's description, as non-blank lines: the first is its one-line tagline, the rest are perks. */
const descriptionLines = (description: string) =>
    description
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

/** The short pitch shown above a product's perks. */
export const taglineOf = (description: string): string => descriptionLines(description)[0] ?? '';

/** Every perk line after the tagline. */
export const perksOf = (description: string) => descriptionLines(description).slice(1);

export const isSoldOut = (day: TicketProductDayResponse) => day.capacity > 0 && day.available <= 0;

/** "12 left", "Sold out", or nothing when the day has no cap. */
export const seatsLabel = (day: TicketProductDayResponse): string | null => {
    if (day.capacity <= 0) return null;
    if (day.available <= 0) return 'Sold out';
    return `${day.available} left`;
};

export const naira = (amount: number) => `₦${amount.toLocaleString()}`;

/**
 * The percentage a Game Pass over `days` days gets off, from the ladder: the
 * active rule with the highest min_days the selection reaches. Used only to show
 * the saving while choosing; the server prices the purchase itself.
 */
export const gamePassPercentFor = (days: number, rules: GamePassRule[]): number => {
    let best = 0;
    let percent = 0;
    for (const rule of rules) {
        if (rule.is_active && rule.min_days <= days && rule.min_days > best) {
            best = rule.min_days;
            percent = rule.percent_off;
        }
    }
    return percent;
};
