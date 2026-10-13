import type { Team } from './matches';

export interface TicketTierResponse {
    id: string;
    event_day_id: string;
    name: string;
    price: number;
    capacity: number;
    sold_count: number;
    available: number;
    description: string;
    is_hidden: boolean;
    access_code?: string;
}

export interface EventDayMatch {
    id: string;
    home_team: string;
    away_team: string;
    start_time: string;
    status: string;
    venue: string;
}

export interface EventDayResponse {
    id: string;
    title: string;
    date: string;
    venue: string;
    is_active: boolean;
    tiers: TicketTierResponse[];
    matches: EventDayMatch[];
    created_at: string;
}

export interface TicketResponse {
    id: string;
    event_day_id: string;
    tier_id: string;
    email: string;
    name?: string;
    phone?: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    status: string;
    paystack_reference?: string;
    ticket_code?: string;
    checked_in_at?: string;
    checked_in_by?: string;
    authorization_url?: string;
    tier_name?: string;
    event_title?: string;
    event_date?: string;
    event_venue?: string;
    referral_code?: string;
    created_at: string;
}

export interface PurchaseTicketPayload {
    event_day_id: string;
    tier_id: string;
    email: string;
    name: string;
    phone: string;
    quantity: number;
    referral_code?: string;
    /** Distinct from referral_code (attribution only) — this one changes price. */
    discount_code?: string;
}

export interface GiftTicketPayload {
    event_day_id: string;
    tier_id: string;
    email: string;
    name: string;
    phone?: string;
    quantity: number;
}

export interface TeamTicketAllocation {
    id: string;
    event_day_id: string;
    team_id: string;
    allocated_count: number;
    issued_count: number;
    team_name?: string;
    event_title?: string;
    team?: Team;
}

export interface CreateReferralPayload {
    name: string;
    email?: string;
}

export interface ReferralResponse {
    id: string;
    code: string;
    name: string;
    email?: string;
    created_at: string;
}

export interface ReferralStatsResponse {
    id: string;
    code: string;
    name: string;
    email?: string;
    tickets_sold: number;
    total_revenue: number;
    created_at: string;
}
