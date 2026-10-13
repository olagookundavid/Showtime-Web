export type POTWPollStatus = 'scheduled' | 'open' | 'closed';

export interface POTWNominee {
    player_id: string;
    name: string;
    image?: string;
    jersey_number: number;
    position: string;
    team_id?: string;
    team_name?: string;
    team_logo?: string;
    display_order: number;
    totw_position?: string;
    rating: number;
    stat1_value?: string;
    stat1_label?: string;
    stat2_value?: string;
    stat2_label?: string;
    stat3_value?: string;
    stat3_label?: string;
    /** Present only once results are visible (after the deadline, or for admins). */
    votes?: number;
    percent?: number;
    is_winner: boolean;
}

export interface POTWPoll {
    id: string;
    totw_id: string;
    week_title: string;
    headline: string;
    competition_id: string;
    competition_name?: string;
    totw_published: boolean;
    status: POTWPollStatus;
    opens_at: string;
    closes_at: string;
    /** Server clock at response time, so countdowns ignore a wrong device clock. */
    server_time: string;
    finalized_at?: string;
    winner_player_id?: string;
    winner_source?: 'VOTE' | 'ADMIN';
    total_votes: number;
    results_visible: boolean;
    my_vote?: string;
    nominees: POTWNominee[];
    votes_by_day?: { day: string; votes: number }[];
}

export interface POTWPollSummary {
    id: string;
    totw_id: string;
    week_title: string;
    competition_name?: string;
    status: POTWPollStatus;
    opens_at: string;
    closes_at: string;
    total_votes: number;
    winner_player_id?: string;
    winner_name?: string;
    winner_source?: 'VOTE' | 'ADMIN';
}

/** One award on the public Player of the Week honours list. */
export interface POTWWinner {
    totw_id: string;
    /** The fan vote, when the edition had one. */
    poll_id?: string;
    week_title: string;
    competition_name?: string;
    competition_format?: string;
    /** VOTE: chosen by fans. ADMIN: named by the league office. */
    source: 'VOTE' | 'ADMIN';
    /** When the vote closed, or when the edition was published. */
    awarded_at: string;
    /** The winner's share of the fan vote, when chosen by fans. */
    share_percent?: number;
    player: POTWNominee;
}

export interface SavePOTWPollPayload {
    nominee_ids: string[];
    opens_at?: string;
    closes_at: string;
}
