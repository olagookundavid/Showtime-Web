export interface PlayerStat {
    player_id: string;
    player_name: string;
    player_image: string;
    player_jersey_number: number;
    player_position: string;
    player_secondary_position?: string;
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    apps: number;
    passing_attempts: number;
    rushing_attempts: number;
    completed_passes: number;
    incomplete_passes: number;
    uncatchable_passes: number;
    thrown_away_passes: number;
    batted_down_passes: number;
    targets: number;
    passing_yards: number;
    rushing_yards: number;
    receiving_yards: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    xp_attempts: number;
    xp_good: number;
    xp_fail: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    safety_conceded: number;
    qb_sacks: number;
    def_sacks: number;
    defensive_xp_tds: number;
}

export interface TeamStat {
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    passing_attempts: number;
    rushing_attempts: number;
    completed_passes: number;
    incomplete_passes: number;
    uncatchable_passes: number;
    thrown_away_passes: number;
    batted_down_passes: number;
    targets: number;
    passing_yards: number;
    rushing_yards: number;
    receiving_yards: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    xp_attempts: number;
    xp_good: number;
    xp_fail: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    safety_conceded: number;
    qb_sacks: number;
    def_sacks: number;
    defensive_xp_tds: number;
    // Team-only stats
    punts: number;
    first_downs: number;
    turnovers: number;
    penalties: number;
    penalty_yards: number;
    total_plays: number;
    drives: number;
}

export interface UpsertPlayerStatPayload {
    player_id: string;
    team_id: string;
    match_id: string;
    competition_id: string;
    match_date: string;
    passing_attempts: number;
    rushing_attempts: number;
    completed_passes: number;
    passing_tds: number;
    rushing_tds: number;
    interceptions_thrown: number;
    receptions: number;
    receiving_tds: number;
    extra_points_tds: number;
    drops: number;
    flag_pulls: number;
    pass_deflections: number;
    interceptions: number;
    defensive_tds: number;
    safety: number;
    qb_sacks: number;
    def_sacks: number;
    defensive_xp_tds: number;
}

// Step 2 — stats derived from the play log vs the currently-stored manual stats.
export interface StatsCompare {
    derived: PlayerStat[];
    current: PlayerStat[];
}

export type NormalizedPosition = 'QB' | 'REC' | 'RUSH' | 'DEF' | 'ALLROUNDER' | 'ALL';

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
