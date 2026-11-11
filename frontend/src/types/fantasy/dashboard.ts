import type { FantasySeason, FantasyLineupResponse, FantasyGameweek } from './core';
import type { LeaderboardEntry } from './leagues';

/** "UP"/"DOWN" against the rank before the last scored gameweek, "SAME" if
 *  unchanged, or "" when there's no prior gameweek to compare against. */
export type RankMovement = 'UP' | 'DOWN' | 'SAME' | '';

export interface DashboardTeam {
    id: string;
    name: string;
    total_points: number;
    gameweek_points: number;
    overall_rank: number;
    total_managers: number;
    rank_movement?: RankMovement;
}

export interface DashboardLeagueRow {
    league_id: string;
    name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    member_count: number;
    my_rank: number;
    entry_fee_kobo: number;
    rank_movement?: RankMovement;
}

export interface FantasyDashboard {
    season: FantasySeason;
    // false until the manager has deliberately joined the season.
    entered: boolean;
    team?: DashboardTeam;
    lineup?: FantasyLineupResponse;
    current_gameweek?: FantasyGameweek;
    deadline_passed: boolean;
    leagues: DashboardLeagueRow[];
    top_managers: LeaderboardEntry[];
}
