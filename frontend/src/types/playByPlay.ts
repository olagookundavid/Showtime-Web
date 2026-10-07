import type { Team } from './matches';

// Player subset hydrated onto a play (name + jersey for display).
export interface PlayPlayer {
    id: string;
    name: string;
    jersey_number: number;
    position: string;
}

export interface GamePlay {
    id: string;
    match_id: string;
    seq: number;
    drive_no: number;
    quarter: number;
    clock?: string;
    offense_team_id?: string;
    down?: number;
    to_go?: number;
    ball_on?: string;
    play_type?: string;
    off_qb_id?: string;
    target_id?: string;
    yards?: number;
    result?: string;
    defender_id?: string;
    rusher_id?: string;
    center_id?: string;
    dropped: boolean;
    batted_down: boolean;
    uncatchable: boolean;
    returned_for_td: boolean;
    penalty?: string;
    penalty_team_id?: string;
    penalty_player_id?: string;
    penalty_yards?: number;
    home_score_after?: number;
    away_score_after?: number;
    notes?: string;
    // Hydrated relations
    offense_team?: Team;
    off_qb?: PlayPlayer;
    target?: PlayPlayer;
    defender?: PlayPlayer;
    rusher?: PlayPlayer;
    center?: PlayPlayer;
    penalty_player?: PlayPlayer;
}

// Mirrors backend dto.PlayRequest — every field optional; match_id is in the URL.
export interface PlayPayload {
    drive_no?: number;
    quarter?: number;
    clock?: string;
    offense_team_id?: string;
    down?: number | null;
    to_go?: number | null;
    ball_on?: string;
    play_type?: string;
    off_qb_id?: string;
    target_id?: string;
    yards?: number | null;
    result?: string;
    defender_id?: string;
    rusher_id?: string;
    center_id?: string;
    dropped?: boolean;
    batted_down?: boolean;
    uncatchable?: boolean;
    returned_for_td?: boolean;
    penalty?: string;
    penalty_team_id?: string;
    penalty_player_id?: string;
    penalty_yards?: number | null;
    home_score_after?: number | null;
    away_score_after?: number | null;
    notes?: string;
    seq?: number;
}

// Re-derive the down/distance/possession/drive of plays after a mid-sequence
// insert. The client computes the new snapshots (same logic as live entry) and
// sends them; the server applies them and recomputes the score.
export interface SituationUpdate {
    id: string;
    drive_no: number;
    down: number | null;
    to_go: number | null;
    offense_team_id?: string;
}

// Bulk re-derive of stats for every match that HAS a play log. Matches without
// one (e.g. the historical Excel imports) are excluded server-side, and scores /
// standings are never touched — stats only. App Admin only.
export interface BulkRecomputeMatch {
    match_id: string;
    label: string;
    date: string;
    plays: number;
    players: number;
    error?: string;
}

export interface BulkRecomputeResult {
    dry_run: boolean;
    matches_found: number;
    matches_updated: number;
    players_updated: number;
    failed: number;
    matches: BulkRecomputeMatch[];
}
