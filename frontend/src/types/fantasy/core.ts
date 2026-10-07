export type FantasySlot =
    | 'QB_M'
    | 'QB_F'
    | 'REC_1'
    | 'REC_2'
    | 'REC_3'
    | 'REC_4'
    | 'REC_5'
    | 'RUSHER'
    | 'DEF_1'
    | 'DEF_2'
    | 'DEF_3'
    | 'DEF_4'
    | 'DEF_5'
    | 'DEF_6';

export interface FantasySeason {
    id: string;
    competition_id: string;
    name: string;
    squad_size: number;
    budget: number;
    min_female_offense: number;
    min_female_defense: number;
    max_per_club: number;
    lock_mins_before: number;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
    created_at: string;
}

export interface FantasyGameweek {
    id: string;
    season_id: string;
    number: number;
    event_day_id: string;
    deadline: string;
    status: 'SCHEDULED' | 'LOCKED' | 'LIVE' | 'FINALIZED';
}

export interface FantasyPlayerListItem {
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
    rating: number;
    total_points: number;

    /** Ownership across the season's managers: how many hold them now, as a
     *  percentage, and how many times they have been signed and sold. */
    owned_by: number;
    selected_by_pct: number;
    transfers_in: number;
    transfers_out: number;
}

/** How the market list is ordered. Every option is applied by the server. */
export type MarketSort =
    | ''
    | 'price_desc'
    | 'price_asc'
    | 'rating'
    | 'points'
    | 'selected'
    | 'owned'
    | 'transfers_in'
    | 'transfers_out'
    | 'name';

export interface FantasyLineupPick {
    slot: FantasySlot;
    player_id: string;
    player_name?: string;
    player_image?: string;
    position?: string;
    gender?: string;
    team_id?: string;
    team_name?: string;
    team_short_name?: string;
    team_logo?: string;
    purchase_price: number;
    current_price: number;
    points: number;
    player_status?: string;
    team_active?: boolean;
    is_reserve?: boolean;
    is_eligible?: boolean;
}

export interface FantasyLineupResponse {
    id: string;
    team_id: string;
    team_name: string;
    gameweek_id: string;
    total_spent: number;
    remaining_budget: number;
    points: number;
    /** PARTIAL is a sheet still being filled in: saved, but never scored. */
    status: 'PARTIAL' | 'DRAFT' | 'LOCKED';
    is_rollover: boolean;
    /** True when the sheet is finished and passes every rule — ready to publish. */
    complete: boolean;
    /** True when the lineup is live and earning points. Publishing is always the manager's own action. */
    published: boolean;
    /** What stands between this sheet and being publishable. Empty once complete. */
    blocking_reason?: string;
    picks: FantasyLineupPick[];
}

export interface FantasyTeamLineupDetailResponse {
    team_id: string;
    team_name: string;
    manager_name: string;
    season_id: string;
    gameweek_id: string;
    gameweek_number: number;
    gameweek_status: string;
    deadline_passed: boolean;
    is_private: boolean;
    private_reason?: string;
    points: number;
    total_spent: number;
    is_rollover: boolean;
    picks: FantasyLineupPick[];
}

export interface ScheduledMatchDay {
    date: string;
    match_count: number;
    earliest_kickoff: string;
    event_day_id?: string;
}

// Player presentation data for the player-inspect modal (Dashboard, My Team, Hub, Pitch).
export interface FantasyPlayerModalData {
    playerId: string;
    playerName: string;
    playerImage?: string | null;
    position?: string;
    gender?: string;
    teamName?: string;
    teamShortName?: string;
    teamLogo?: string;
    price?: number;
    currentPrice?: number;
    purchasePrice?: number;
    points?: number;
    totalPoints?: number;
    rating?: number;
    ownedByPct?: number;
    gameweekId?: string;
    gameweekNumber?: number;
}

// One occupied slot on the pitch diagram.
export interface PitchPlayerItem {
    slot: FantasySlot;
    player_id?: string;
    player_name?: string;
    player_image?: string;
    position?: string;
    gender?: string;
    team_id?: string;
    team_name?: string;
    team_short_name?: string;
    team_logo?: string;
    price?: number;
    current_price?: number;
    purchase_price?: number;
    points?: number;
    isInactiveClub?: boolean;
    isDeleted?: boolean;
    isReserve?: boolean;
    isInvalid?: boolean;
    invalidReason?: string;
}
