/**
 * Ranks leaders first by a stat key (descending); pass an empty key to
 * return the rows unsorted. Shared by PlayerStatsTable and TeamStatsTable.
 */
export function sortStatRows<T>(rows: T[], sortKey: string): T[] {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
        const valA = Number((a as Record<string, unknown>)[sortKey] ?? 0);
        const valB = Number((b as Record<string, unknown>)[sortKey] ?? 0);
        return valB - valA;
    });
}
