export interface Competition {
    id: string;
    name: string;
    logo: string;
    status: string;
    format?: string; // PRESEASON | SEASON | PLAYOFFS | CUP
    season_id?: string | null;
    tie_breaker_rule?: string;
}

export interface Team {
    id: string;
    name: string;
    short_name: string;
    logo: string;
    status?: string;
}

// Lean view of Team for the public team-filter dropdown.
export type PublicTeam = Pick<Team, 'id' | 'name' | 'status'>;

export interface Match {
    id: string;
    competition: Competition;
    home_team: Team;
    away_team: Team;
    date: string;
    start_time: string;
    venue: string;
    status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
    home_score?: number;
    away_score?: number;
    highlights_url?: string;
    ticket_url?: string;
    round?: string;
    bracket_pos?: number;
    feeds_match_id?: string;
    feeds_slot?: 'HOME' | 'AWAY';
    second_leg_match_id?: string | null;
    pbp_locked?: boolean;
    mvp_player_id?: string | null;
    mvp_overridden?: boolean;
    home_coverage?: number;
    away_coverage?: number;
}

export interface TeamSheetPlayer {
    player_id: string;
    name: string;
    jersey_number: number;
    position: string;
    /** Second role, when the player has one. Stat entry offers both roles' fields. */
    secondary_position?: string | null;
    gender?: string;
    image: string;
    // Per-match rating (Receiver/Defender/Rusher only). Null/absent for QB and
    // undetermined "-" positions, and for rateable players with no activity.
    rating?: number | null;
    rating_status?: string;
    /**
     * 'active' | 'inactive'. A player deleted after this sheet was named stays
     * on it — the appearance happened. Stat entry must still work for them, so
     * this only marks them visually.
     */
    status?: string;
    is_starter?: boolean;
    starter_unit?: 'OFFENSE' | 'DEFENSE';
    position_slot?: string;
    order_index?: number;
}

export interface MatchTeamSheet {
    home_team: TeamSheetPlayer[];
    away_team: TeamSheetPlayer[];
    home_coverage?: number;
    away_coverage?: number;
}

export interface MatchDetail {
    match: Match;
    team_sheet: MatchTeamSheet;
}

export interface Standing {
    id: string;
    team: Team;
    position: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    pct: number;
    l5: string;
}

export interface CreateMatchPayload {
    competition_id: string;
    home_team_id: string; // '' = TBD slot (knockout brackets only)
    away_team_id: string; // '' = TBD slot (knockout brackets only)
    date: string;
    start_time: string;
    venue?: string;
    status?: string;
    home_score?: number | null;
    away_score?: number | null;
    highlights_url?: string;
    ticket_url?: string;
    round?: string;
    bracket_pos?: number | null;
    feeds_match_id?: string | null;
    feeds_slot?: string;
    second_leg_match_id?: string | null;
    mvp_player_id?: string | null;
    mvp_overridden?: boolean;
}

export interface TeamSheetSlotPayload {
    player_id: string;
    is_starter: boolean;
    starter_unit?: 'OFFENSE' | 'DEFENSE';
    position_slot?: string;
    order_index?: number;
}

export interface SaveTeamSheetPayload {
    team_id: string;
    player_ids?: string[];
    players?: TeamSheetSlotPayload[];
    coverage?: number;
}

// ─── Bulk historical-data CSV import ──────────────────────────────────────────
export interface ImportMatchPlayerRow {
    side: 'home' | 'away';
    player_name: string;
    jersey_number?: number;
    position?: string;
    passing_attempts?: number;
    rushing_attempts?: number;
    completed_passes?: number;
    passing_tds?: number;
    rushing_tds?: number;
    interceptions_thrown?: number;
    receptions?: number;
    receiving_tds?: number;
    extra_points_tds?: number;
    drops?: number;
    flag_pulls?: number;
    pass_deflections?: number;
    interceptions?: number;
    defensive_tds?: number;
    safety?: number;
    qb_sacks?: number;
    def_sacks?: number;
    defensive_xp_tds?: number;
}

export interface ImportMatchResult {
    players_created: number;
    players_matched: number;
    sheet_rows: number;
    stat_rows: number;
    created_players?: Array<{
        id: string;
        name: string;
        team_id: string;
        jersey_number: number;
        position: string;
    }>;
}

export interface CreateStandingPayload {
    competition_id: string;
    team_id: string;
    won?: number;
    drawn?: number;
    lost?: number;
    goals_for?: number;
    goals_against?: number;
    l5?: string;
}

// One first-round slot of a knockout bracket: a matchup or a bye.
// Adjacent slots pair up: winners of slots 1 & 2 meet next round, 3 & 4 meet, etc.
export interface BracketEntryPayload {
    bye: boolean;
    team_id?: string;
    home_team_id?: string;
    away_team_id?: string;
}

export interface GameRules {
    competition_id: string;
    td_points: number;
    xp_run_points: number;
    xp_pass_points: number;
    safety_points: number;
    def_return_points: number;
    downs_per_series: number;
    yards_to_first_down: number;
    first_down_model: string;
}

export type GameRulesPayload = Omit<GameRules, 'competition_id'>;

// One round/column of a knockout bracket view.
export interface BracketColumn {
    title: string;
    matches: Match[];
}

// Extends the base Competition with the raw team-id list needed by the admin edit form.
export type CompetitionWithTeamIds = Omit<Competition, 'status'> & {
    status?: string;
    team_ids?: string[];
};

// Extends the base Match with the raw team-id fields needed by admin edit forms.
export type MatchWithTeamIds = Match & {
    competition_id?: string;
    home_team_id?: string;
    away_team_id?: string;
};

// Result of the unified Match MVP calculation (SFFL fantasy points + rating bonus).
export interface UnifiedMvpResult {
    playerId: string;
    playerName: string;
    playerImage?: string;
    playerJerseyNumber?: number;
    playerPosition?: string;
    teamName?: string;
    teamId?: string;
    fp: number;
    rating?: number | null;
    statSummary?: string;
}

// A starting player's node on the team-sheet pitch diagram.
export interface PitchStarterNode {
    player?: TeamSheetPlayer;
    role: string;
    unit: 'OFFENSE' | 'DEFENSE';
    x: number;
    y: number;
    slotKey: string;
}
