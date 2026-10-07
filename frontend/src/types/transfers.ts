export interface TransferData {
    id: string;
    type: 'REQUEST' | 'LISTING' | 'DIRECT_SALE';
    status: 'PENDING' | 'REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
    player_id: string;
    from_team_id: string;
    to_team_id?: string;
    initiated_by?: string;
    asking_price?: number;
    notes?: string;
    review_notes?: string;
    completed_at?: string;
    from_team_approved: boolean;
    to_team_approved: boolean;
    created_at: string;
    updated_at: string;
    player?: {
        id: string;
        name: string;
        jersey_number: number;
        position: string;
        image: string;
    };
    from_team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
    to_team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
    bids?: TransferBidData[];
}

export interface TransferBidData {
    id: string;
    transfer_id: string;
    bidder_team_id: string;
    bid_value: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    bidder_id?: string;
    created_at: string;
    bidder_team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
}

export interface TeamBudgetData {
    id: string;
    team_id: string;
    total_budget: number;
    spent: number;
    remaining: number;
    created_at: string;
    updated_at: string;
    team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
}

export interface TransferWindowData {
    id: string;
    name: string;
    opens_at: string;
    closes_at: string;
    is_active: boolean;
    is_open: boolean;
    created_at: string;
    updated_at: string;
}
