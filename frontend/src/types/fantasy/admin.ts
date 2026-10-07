import type { PrizeAward } from './wallet';

export interface AdminFantasyOverview {
    season_id: string;
    season_name: string;
    status: string;
    total_managers: number;
    total_lineups: number;
    total_leagues: number;
    paid_leagues: number;
    gross_entry_kobo: number;
    platform_cut_kobo: number;
    prize_pool_kobo: number;
    cut_percent: number;
    unsettled_leagues: number;
    wallet_liability_kobo: number;
    pending_payout_kobo: number;
    pending_payout_count: number;
    paid_out_kobo: number;
}

export interface AdminManagerRow {
    rank: number;
    user_id: string;
    user_name: string;
    user_email: string;
    team_id: string;
    team_name: string;
    total_points: number;
    lineup_count: number;
    league_count: number;
    wallet_balance_kobo: number;
    created_at: string;
}

export interface AdminLeagueRow {
    league_id: string;
    name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    invite_code?: string;
    owner_name?: string;
    entry_fee_kobo: number;
    max_members: number;
    member_count: number;
    paid_members: number;
    pending_members: number;
    gross_entry_kobo: number;
    platform_cut_kobo: number;
    prize_pool_kobo: number;
    settled: boolean;
    settled_at?: string;
    created_at: string;
}

export interface AdminLeagueMemberRow {
    user_id: string;
    user_name: string;
    user_email: string;
    team_id: string;
    team_name: string;
    total_points: number;
    payment_status: 'FREE' | 'PENDING' | 'PAID' | 'FAILED';
    paystack_reference?: string;
    joined_at: string;
}

export interface SettlementResult {
    leagues_settled: number;
    leagues_skipped: number;
    total_awarded_kobo: number;
    platform_cut_kobo: number;
    awards: PrizeAward[];
}

export interface AdminPlayerPriceRow {
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
    calculated_price: number;
    is_overridden: boolean;
    rating: number;
}
