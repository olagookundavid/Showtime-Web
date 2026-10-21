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

/**
 * `event_title` with a leading, exact repeat of the competition's own name cut
 * off — some titles are written as "{competition name} · Match Day 3" or
 * "{competition name} Wildcard Weekend". Strips only a match at the very
 * start, and only on a word boundary (" · " or a single space), so a name
 * like "Series" can't eat into a title that happens to start "Series14 ...".
 * Anything else is returned untouched, and an all-consumed match falls back
 * to the original title rather than ever showing a blank label.
 */
export const stripCompetitionName = (title: string, competitionName: string): string => {
    if (!competitionName || !title.startsWith(competitionName)) return title;

    const rest = title.slice(competitionName.length);
    const afterSeparator = rest.startsWith(' · ') ? rest.slice(3) : rest.startsWith(' ') ? rest.slice(1) : null;
    if (afterSeparator === null) return title;

    const stripped = afterSeparator.trim();
    return stripped || title;
};

/**
 * "Match Day 3": the match day/round alone, never the tournament. Only one
 * Showtime competition of a kind is ever active at a time, so the day alone
 * is enough to tell match days apart.
 */
export const dayLabel = (day: TicketProductDayResponse) =>
    stripCompetitionName(day.event_title, day.competition_name);

/**
 * Match days in the order they are played, earliest first. Never the order they
 * were created in: Game Week 19 can be entered before Game Week 3, and buyers
 * must still see Game Week 3 first. The server sends them this way; sorting again
 * here keeps the list right wherever it is shown.
 */
export const sortDaysByDate = <T extends { event_date: string; event_title: string }>(days: T[]): T[] =>
    [...days].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.event_title.localeCompare(b.event_title));
