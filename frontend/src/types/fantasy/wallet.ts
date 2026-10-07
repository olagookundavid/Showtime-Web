export type WalletTransactionType = 'WINNINGS' | 'PAYOUT' | 'PAYOUT_REVERSAL' | 'ADJUSTMENT';

export interface WalletTransaction {
    id: string;
    amount_kobo: number; // signed: credits positive, debits negative
    type: WalletTransactionType;
    league_id?: string;
    league_name?: string;
    description: string;
    created_at: string;
}

export interface BankDetails {
    bank_name: string;
    account_number: string;
    account_name: string;
}

export interface FantasyWallet {
    balance_kobo: number;
    pending_payout_kobo: number;
    lifetime_won_kobo: number;
    lifetime_paid_kobo: number;
    min_payout_kobo: number;
    can_request_payout: boolean;
    last_bank_details?: BankDetails;
    transactions: WalletTransaction[];
}

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'CANCELLED';

export interface PayoutRequest {
    id: string;
    user_id: string;
    user_name?: string;
    user_email?: string;
    amount_kobo: number;
    status: PayoutStatus;
    bank_name: string;
    account_number: string;
    account_name: string;
    user_notes: string;
    admin_notes: string;
    payment_reference?: string;
    processed_at?: string;
    created_at: string;
}

export interface PrizeAward {
    user_id: string;
    team_id: string;
    team_name: string;
    user_name: string;
    rank: number;
    points: number;
    amount_kobo: number;
    shared_with: number; // >1 when the position was tied
    description: string;
}

export interface PrizeTier {
    rank: number;
    percent: number;
    amount_kobo: number;
}

export interface LeagueFinance {
    league_id: string;
    league_name: string;
    type: 'OVERALL' | 'PUBLIC' | 'PRIVATE';
    entry_fee_kobo: number;
    paid_members: number;
    pending_members: number;
    gross_entry_kobo: number;
    platform_cut_kobo: number;
    prize_pool_kobo: number;
    cut_percent: number;
    settled: boolean;
    settled_at?: string;
    prize_structure: PrizeTier[];
    awards: PrizeAward[]; // projected before settlement, actual after
}

// One person the platform owes money to, for the admin's obligation view.
export interface OwedRow {
    user_id: string;
    user_name: string;
    user_email: string;
    /** Still in their wallet — they have not asked for it yet. */
    balance_kobo: number;
    /** Already committed to an open request, so out of the balance. */
    pending_payout_kobo: number;
    total_owed_kobo: number;
    lifetime_won_kobo: number;
    lifetime_paid_kobo: number;
    has_requested: boolean;
    open_requests: number;
    /** The account last submitted on a request; blank until they give us one. */
    bank_name?: string;
    account_number?: string;
    account_name?: string;
}

export interface MoneyOwed {
    rows: OwedRow[];
    /** These totals cover everyone owed money, not just the page in `rows`. */
    total_owed_kobo: number;
    requested_kobo: number;
    unrequested_kobo: number;
    people: number;
    awaiting_details: number;
    page: number;
    limit: number;
    total_pages: number;
}
