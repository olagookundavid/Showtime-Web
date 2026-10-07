import type { FantasyLineupPick } from './core';

export interface GameweekSummaryStats {
    average_points: number;
    highest_points: number;
    highest_scoring_team: string;
    lowest_points: number;
    total_managers: number;
}

export interface MostOwnedPlayerItem {
    player_id: string;
    player_name: string;
    player_image: string;
    position: string;
    gender: string;
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    current_price: number;
    ownership_count: number;
    ownership_percentage: number;
    points: number;
}

export interface TopScoringPlayerItem {
    player_id: string;
    player_name: string;
    player_image: string;
    position: string;
    gender: string;
    team_id: string;
    team_name: string;
    team_short_name: string;
    team_logo: string;
    price: number;
    points: number;
    ownership_percentage: number;
}

export interface ClubPointsItem {
    club_id: string;
    club_name: string;
    club_short_name: string;
    club_logo: string;
    total_points: number;
    active_player_count: number;
    average_points_per_player: number;
    top_scorer_name: string;
    top_scorer_points: number;
}

export interface GameweekReportResponse {
    season_id: string;
    gameweek_id: string;
    gameweek_number: number;
    gameweek_status: string;
    summary: GameweekSummaryStats;
    most_owned: MostOwnedPlayerItem[];
    top_scorers: TopScoringPlayerItem[];
    club_points: ClubPointsItem[];
    dream_team: FantasyLineupPick[];
    dream_team_total_points: number;
    differentials: TopScoringPlayerItem[];
}

export interface PointsBreakdown {
    version: string;
    passing_yards_pts: number;
    passing_tds_pts: number;
    interceptions_thrown_pts: number;
    qb_sacks_pts: number;
    rushing_yards_pts: number;
    rushing_tds_pts: number;
    receptions_pts: number;
    receiving_yards_pts: number;
    receiving_tds_pts: number;
    drops_pts: number;
    xp_good_pts: number;
    extra_point_tds_pts: number;
    bad_snaps_pts: number;
    offensive_positive: number;
    offensive_negative: number;
    offensive_total: number;
    flag_pulls_pts: number;
    pass_deflections_pts: number;
    interceptions_pts: number;
    def_sacks_pts: number;
    defensive_tds_pts: number;
    defensive_xp_tds_pts: number;
    safety_pts: number;
    safety_conceded_pts: number;
    defensive_total: number;
    net_total: number;
}

export interface PlayerGWBreakdownResponse {
    player_id: string;
    player_name: string;
    match_id: string;
    match_label: string;
    gameweek_number?: number;
    is_nearest_week?: boolean;
    points: number;
    total_points?: number;
    selected_by_pct?: number;
    breakdown: PointsBreakdown;
}

export interface PlayerPriceHistoryItem {
    gameweek_id?: string;
    gameweek_number: number;
    gameweek_label: string;
    price: number;
    calculated_price: number;
    change: number;
    percentage_change: number;
    rating: number;
    is_overridden: boolean;
    created_at: string;
}

export interface PlayerPriceHistoryResponse {
    player_id: string;
    player_name: string;
    current_price: number;
    base_price: number;
    total_change: number;
    total_points?: number;
    selected_by_pct?: number;
    history: PlayerPriceHistoryItem[];
}
