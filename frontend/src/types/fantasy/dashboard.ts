import type { FantasySeason, FantasyLineupResponse, FantasyGameweek } from './core';
import type { LeaderboardEntry } from './leagues';

export interface DashboardTeam {
    id: string;
    name: string;
    total_points: number;
    gameweek_points: number;
    overall_rank: number;
    total_managers: number;
}

export interface DashboardLeagueRow {
    league_id: string;
    name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    member_count: number;
    my_rank: number;
    entry_fee_kobo: number;
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
