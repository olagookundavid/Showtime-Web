/**
 * Showtime Position Stats Matrix configuration & helpers.
 * Source of truth: Ratings/Showtime_Position_Stats_Matrix.xlsx (Boss Review Checklist).
 *
 * Rules:
 * 1. Center is treated as Receiver at all times.
 * 2. If a player has a position, only the designated stats for that position are shown.
 * 3. If a player has no position (unassigned / '-'), all stats are shown.
 */
import type { StatDefinition, NormalizedPosition } from '../types';
import { ALL_STAT_DEFINITIONS, POSITION_STAT_KEYS } from '../constants';

/**
 * Normalizes any position string to one of the 5 canonical positions or ALL.
 * Rule: Center is treated as Receiver at all times.
 */
export function normalizePosition(position?: string | null): NormalizedPosition {
    if (!position) return 'ALL';
    const clean = position.trim().toUpperCase();
    if (['QB', 'QUARTERBACK'].includes(clean)) return 'QB';
    if (['REC', 'RECEIVER', 'WR', 'WIDE RECEIVER', 'CENTER', 'C'].includes(clean)) return 'REC';
    if (['RUSH', 'RUSHER', 'DE', 'DT', 'EDGE', 'BLITZER'].includes(clean)) return 'RUSH';
    if (['DEF', 'DEFENDER', 'DB', 'CB', 'SAFETY', 'FS', 'SS', 'LB'].includes(clean)) return 'DEF';
    if (['ALLROUNDER', 'ALL-ROUNDER', 'ALL ROUNDER', 'AR'].includes(clean)) return 'ALLROUNDER';
    return 'ALL';
}

/**
 * Get all visible stat definitions for a specific position (or all if unassigned),
 * merging in any secondary position stats if present.
 */
export function getStatsForPosition(position?: string | null, secondaryPosition?: string | null): StatDefinition[] {
    const normalized = normalizePosition(position);
    const allowedKeys = new Set(POSITION_STAT_KEYS[normalized]);
    if (secondaryPosition) {
        const secNorm = normalizePosition(secondaryPosition);
        for (const key of POSITION_STAT_KEYS[secNorm]) {
            allowedKeys.add(key);
        }
    }
    return ALL_STAT_DEFINITIONS.filter(def => allowedKeys.has(def.key));
}
