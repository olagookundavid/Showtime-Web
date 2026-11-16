/** What someone can say they are interested in on the join form. */
export type LeadInterest = 'watch' | 'coaches' | 'play';

export interface JoinPayload {
    name: string;
    email: string;
    phone: string;
    interests: LeadInterest[];
    /** The channel's tag from the link (`?src=instagram`). */
    source: string;
    consent: boolean;
    /** Hidden field real visitors never fill in. */
    website: string;
}

export interface LeadResponse {
    id: string;
    name: string;
    email: string;
    phone: string;
    interests: LeadInterest[];
    source: string;
    created_at: string;
    /** They paid for a ticket after joining. */
    bought_ticket: boolean;
}

export interface LeadSourceStat {
    source: string;
    leads: number;
    converted: number;
}

export interface LeadSummary {
    total: number;
    converted: number;
    sources: LeadSourceStat[];
}

export interface LeadListParams {
    page: number;
    limit: number;
    search?: string;
    source?: string;
    interest?: LeadInterest | '';
    bought?: 'yes' | 'no' | '';
}
