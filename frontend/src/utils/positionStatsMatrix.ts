/**
 * Showtime Position Stats Matrix configuration & helpers.
 * Source of truth: Ratings/Showtime_Position_Stats_Matrix.xlsx (Boss Review Checklist).
 * 
 * Rules:
 * 1. Center is treated as Receiver at all times.
 * 2. If a player has a position, only the designated stats for that position are shown.
 * 3. If a player has no position (unassigned / '-'), all stats are shown.
 */

export type NormalizedPosition = 'QB' | 'REC' | 'RUSH' | 'DEF' | 'ALL';

export interface StatDefinition {
    key: string;
    label: string;
    shortLabel: string;
    category: 'General' | 'Passing' | 'Rushing' | 'Receiving' | 'Extra Points' | 'Defense' | 'Safety' | 'Snaps' | 'Team';
    topHeader?: string;
    bottomHeader: string;
    title: string;
    bg?: string;
    playerOnly?: boolean;
    teamOnly?: boolean;
    divider?: boolean;
}

/**
 * Normalizes any position string to one of the 4 canonical positions or ALL.
 * Rule: Center is treated as Receiver at all times.
 */
export function normalizePosition(position?: string | null): NormalizedPosition {
    if (!position) return 'ALL';
    const clean = position.trim().toUpperCase();
    if (['QB', 'QUARTERBACK'].includes(clean)) return 'QB';
    if (['REC', 'RECEIVER', 'WR', 'WIDE RECEIVER', 'CENTER', 'C'].includes(clean)) return 'REC';
    if (['RUSH', 'RUSHER', 'DE', 'DT', 'EDGE', 'BLITZER'].includes(clean)) return 'RUSH';
    if (['DEF', 'DEFENDER', 'DB', 'CB', 'SAFETY', 'FS', 'SS', 'LB'].includes(clean)) return 'DEF';
    return 'ALL';
}

/**
 * Master catalog of all player & team statistics with metadata.
 */
export const ALL_STAT_DEFINITIONS: StatDefinition[] = [
    { key: 'apps', label: 'Appearances', shortLabel: 'Apps', category: 'General', topHeader: '', bottomHeader: 'Apps', title: 'Appearances (Games Played)', bg: '', playerOnly: true },
    
    // Passing
    { key: 'passing_attempts', label: 'Pass Attempts', shortLabel: 'Pass Att', category: 'Passing', topHeader: 'Pass', bottomHeader: 'ATT', title: 'Pass Attempts', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'completed_passes', label: 'Pass Completions', shortLabel: 'Comp. Passes', category: 'Passing', topHeader: 'Pass', bottomHeader: 'COMP', title: 'Pass Completions', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'incomplete_passes', label: 'Incomplete Passes', shortLabel: 'Inc. Passes', category: 'Passing', topHeader: 'Pass', bottomHeader: 'INC', title: 'Incomplete Passes', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'passing_yards', label: 'Passing Yards', shortLabel: 'Pass Yds', category: 'Passing', topHeader: 'Pass', bottomHeader: 'YDS', title: 'Passing Yards', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'passing_tds', label: 'Passing Touchdowns', shortLabel: 'Passing TDs', category: 'Passing', topHeader: 'Pass', bottomHeader: 'TDs', title: 'Passing Touchdowns', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'interceptions_thrown', label: 'Interceptions Thrown', shortLabel: 'INT Thrown', category: 'Passing', topHeader: 'Int', bottomHeader: 'Thrown', title: 'Interceptions Thrown', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'uncatchable_passes', label: 'Uncatchable Passes', shortLabel: 'Uncatchable', category: 'Passing', topHeader: 'Pass', bottomHeader: 'Unc', title: 'Uncatchable Passes', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'thrown_away_passes', label: 'Thrown-Away Passes', shortLabel: 'Thrown Away', category: 'Passing', topHeader: 'Pass', bottomHeader: 'TA', title: 'Thrown-Away Passes', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'batted_down_passes', label: 'Batted-Down Passes', shortLabel: 'Batted Down', category: 'Passing', topHeader: 'Pass', bottomHeader: 'Batted', title: 'Batted-Down Passes (QB)', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },
    { key: 'qb_sacks', label: 'QB Sacks Taken', shortLabel: 'QB Sacks', category: 'Passing', topHeader: 'QB', bottomHeader: 'Sacks', title: 'QB Sacks Accounted (QB fault)', bg: 'bg-blue-50/30 dark:bg-blue-900/10' },

    // Rushing
    { key: 'rushing_attempts', label: 'Rushing Attempts', shortLabel: 'Rush Att', category: 'Rushing', topHeader: 'Rush', bottomHeader: 'ATT', title: 'Rushing Attempts', bg: 'bg-green-50/30 dark:bg-green-900/10' },
    { key: 'rushing_yards', label: 'Rushing Yards', shortLabel: 'Rush Yds', category: 'Rushing', topHeader: 'Rush', bottomHeader: 'YDS', title: 'Rushing Yards', bg: 'bg-green-50/30 dark:bg-green-900/10' },
    { key: 'rushing_tds', label: 'Rushing Touchdowns', shortLabel: 'Rushing TDs', category: 'Rushing', topHeader: 'Rush', bottomHeader: 'TDs', title: 'Rushing Touchdowns', bg: 'bg-green-50/30 dark:bg-green-900/10' },

    // Receiving
    { key: 'targets', label: 'Targets', shortLabel: 'Targets', category: 'Receiving', topHeader: '', bottomHeader: 'Tgt', title: 'Targets (thrown to)', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'receptions', label: 'Receptions', shortLabel: 'Receptions', category: 'Receiving', topHeader: '', bottomHeader: 'Rec', title: 'Receptions', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'receiving_yards', label: 'Receiving Yards', shortLabel: 'Rec Yds', category: 'Receiving', topHeader: 'Rec', bottomHeader: 'YDS', title: 'Receiving Yards', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'receiving_tds', label: 'Receiving Touchdowns', shortLabel: 'Receiving TDs', category: 'Receiving', topHeader: 'RC', bottomHeader: 'TDs', title: 'Receiving Touchdowns', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },
    { key: 'drops', label: 'Drops', shortLabel: 'Drops', category: 'Receiving', topHeader: '', bottomHeader: 'Drops', title: 'Drops', bg: 'bg-yellow-50/30 dark:bg-yellow-900/10' },

    // Extra Points
    { key: 'xp_attempts', label: 'Extra-Point Attempts', shortLabel: 'XP Att', category: 'Extra Points', topHeader: 'XP', bottomHeader: 'Att', title: 'Extra-Point Attempts', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'xp_good', label: 'Extra Points Made', shortLabel: 'XP Good', category: 'Extra Points', topHeader: 'XP', bottomHeader: 'Good', title: 'Extra Points Made', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'xp_fail', label: 'Extra Points Failed', shortLabel: 'XP Fail', category: 'Extra Points', topHeader: 'XP', bottomHeader: 'Fail', title: 'Extra Points Failed', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },
    { key: 'extra_points_tds', label: 'Extra Point Touchdowns', shortLabel: 'XP TDs', category: 'Extra Points', topHeader: 'X-Pts', bottomHeader: 'TDs', title: 'Extra Point Touchdowns (scorer)', bg: 'bg-purple-50/30 dark:bg-purple-900/10' },

    // Snaps (Center/Receiver)
    { key: 'snaps', label: 'Snaps', shortLabel: 'Snaps', category: 'Snaps', topHeader: 'Snap', bottomHeader: 'Total', title: 'Total Snaps', bg: 'bg-amber-50/30 dark:bg-amber-900/10' },
    { key: 'bad_snaps', label: 'Bad Snaps', shortLabel: 'Bad Snaps', category: 'Snaps', topHeader: 'Snap', bottomHeader: 'Bad', title: 'Bad Snaps', bg: 'bg-amber-50/30 dark:bg-amber-900/10' },

    // Defense
    { key: 'flag_pulls', label: 'Flag Pulls (Tackles)', shortLabel: 'Flag Pulls', category: 'Defense', topHeader: 'Flag', bottomHeader: 'Pulls', title: 'Flag Pulls (Tackles)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'pass_deflections', label: 'Pass Deflections', shortLabel: 'Pass Deflect', category: 'Defense', topHeader: 'Pass', bottomHeader: 'Defl', title: 'Pass Deflections', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'interceptions', label: 'Interceptions Caught', shortLabel: 'INT Caught', category: 'Defense', topHeader: 'Def', bottomHeader: 'INT', title: 'Interceptions Caught', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'def_sacks', label: 'Defensive Sacks', shortLabel: 'DEF Sacks', category: 'Defense', topHeader: 'Def', bottomHeader: 'Sacks', title: 'Defensive Sacks (Def fault)', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'defensive_tds', label: 'Defensive Touchdowns', shortLabel: 'DEF TDs', category: 'Defense', topHeader: 'Def', bottomHeader: 'TDs', title: 'Defensive Touchdowns', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'defensive_xp_tds', label: 'Defensive Extra-Point TDs', shortLabel: 'DEF XP TDs', category: 'Defense', topHeader: 'Def XP', bottomHeader: 'TDs', title: 'Defensive Extra-Point TDs (interception returned on an extra point)', bg: 'bg-red-50/30 dark:bg-red-900/10' },

    // Safety
    { key: 'safety', label: 'Safeties Scored', shortLabel: 'Safety', category: 'Safety', topHeader: '', bottomHeader: 'Safety', title: 'Safeties', bg: 'bg-red-50/30 dark:bg-red-900/10' },
    { key: 'safety_conceded', label: 'Safeties Conceded', shortLabel: 'Safety Conceded', category: 'Safety', topHeader: 'Safety', bottomHeader: 'Conc', title: 'Safeties Conceded (QB)', bg: 'bg-red-50/30 dark:bg-red-900/10' },

    // Team Only Stats
    { key: 'total_plays', label: 'Total Plays', shortLabel: 'Plays', category: 'Team', topHeader: 'Team', bottomHeader: 'Plays', title: 'Total Plays (from scrimmage)', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true, divider: true },
    { key: 'drives', label: 'Offensive Drives', shortLabel: 'Drives', category: 'Team', topHeader: 'Team', bottomHeader: 'Drives', title: 'Offensive Drives', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'first_downs', label: 'First Downs', shortLabel: '1st Downs', category: 'Team', topHeader: 'Team', bottomHeader: '1st Dn', title: 'First Downs', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'turnovers', label: 'Turnovers', shortLabel: 'Turnovers', category: 'Team', topHeader: 'Team', bottomHeader: 'TO', title: 'Turnovers', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'punts', label: 'Punts', shortLabel: 'Punts', category: 'Team', topHeader: 'Team', bottomHeader: 'Punts', title: 'Punts', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'penalties', label: 'Penalties', shortLabel: 'Penalties', category: 'Team', topHeader: 'Team', bottomHeader: 'Pen', title: 'Penalties', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
    { key: 'penalty_yards', label: 'Penalty Yards', shortLabel: 'Penalty Yds', category: 'Team', topHeader: 'Pen', bottomHeader: 'YDS', title: 'Penalty Yards', bg: 'bg-amber-50 dark:bg-amber-900/20', teamOnly: true },
];

/**
 * Stat key lists per position as approved in Boss Review Checklist.
 */
export const POSITION_STAT_KEYS: Record<NormalizedPosition, string[]> = {
    QB: [
        'apps',
        'passing_attempts',
        'completed_passes',
        'incomplete_passes',
        'passing_yards',
        'passing_tds',
        'interceptions_thrown',
        'uncatchable_passes',
        'thrown_away_passes',
        'batted_down_passes',
        'qb_sacks',
        'rushing_attempts',
        'rushing_yards',
        'rushing_tds',
        'xp_attempts',
        'xp_good',
        'xp_fail',
        'safety_conceded'
    ],
    REC: [
        'apps',
        'targets',
        'receptions',
        'receiving_yards',
        'receiving_tds',
        'drops',
        'extra_points_tds',
        'snaps',
        'bad_snaps'
    ],
    RUSH: [
        'apps',
        'flag_pulls',
        'pass_deflections',
        'interceptions',
        'def_sacks',
        'defensive_tds',
        'defensive_xp_tds',
        'safety'
    ],
    DEF: [
        'apps',
        'flag_pulls',
        'pass_deflections',
        'interceptions',
        'def_sacks',
        'defensive_tds',
        'defensive_xp_tds',
        'safety'
    ],
    ALL: ALL_STAT_DEFINITIONS.filter(s => !s.teamOnly).map(s => s.key)
};

/**
 * Get all visible stat definitions for a specific position (or all if unassigned).
 */
export function getStatsForPosition(position?: string | null): StatDefinition[] {
    const normalized = normalizePosition(position);
    const allowedKeys = new Set(POSITION_STAT_KEYS[normalized]);
    return ALL_STAT_DEFINITIONS.filter(def => allowedKeys.has(def.key));
}
