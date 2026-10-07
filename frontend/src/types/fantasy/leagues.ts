import type { PrizeTier } from './wallet';

export interface FantasyLeague {
    id: string;
    season_id: string;
    name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    invite_code?: string;
    // Absent/empty for the system-owned OVERALL league, which has no human owner.
    created_by_user_id?: string;
    entry_fee: number;
    max_members: number;
    member_count: number;
    createdAt?: string;
}

export interface JoinLeagueResponse {
    league_id: string;
    league_name: string;
    paystack_url?: string;
    paystack_ref?: string;
    paystack_access_code?: string;
}

// my_rank is the signed-in viewer's own position, 0 when anonymous or not in
// the table. The UI uses it to open on their page rather than page 1.
export interface Leaderboard {
    data: LeaderboardEntry[];
    total: number;
    total_pages: number;
    my_rank: number;
    my_entry?: LeaderboardEntry | null;
}

export interface LeaderboardEntry {
    rank: number;
    user_id: string;
    user_name: string;
    team_name: string;
    team_id: string;
    gw_points: number;
    total_points: number;
}

export interface LeagueJoinPreview {
    league_id: string;
    name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    owner_name?: string;
    invite_code?: string;
    entry_fee_kobo: number;
    member_count: number;
    max_members: number; // 0 = unlimited
    is_full: boolean;
    already_member: boolean;
    membership_status?: 'FREE' | 'PENDING' | 'PAID' | 'FAILED';
    // Set when this manager paid into the league and then left. The entry is
    // gone and the league cannot be rejoined.
    forfeited: boolean;
    // Already net of the platform's cut — the figure that will actually be
    // shared out. The cut itself is only shown to whoever creates a league.
    prize_pool_kobo: number;
    prize_structure: PrizeTier[];
    // Entry fees are never returned once paid.
    refundable: boolean;
    settled: boolean;
}
