import type { Team } from './matches';

/** A Game Pass (one match day or several under one code) or a Season Pass (valid until an end date). */
export type PurchaseType = 'GAME_PASS' | 'SEASON_PASS';

/** A match day a ticket is on sale for, because it has a match in a competition the ticket is linked to. */
export interface TicketProductDayResponse {
    /** The seat-lock row. Empty until the day has first been looked up for a purchase, so key by event_day_id. */
    id: string;
    product_id: string;
    event_day_id: string;
    event_title: string;
    event_date: string;
    event_venue: string;
    /** The competition that put this day on sale. */
    competition_id: string;
    competition_name: string;
    /** The ticket's price per match day. */
    price: number;
    /** Seats per match day; 0 means unlimited. */
    capacity: number;
    sold_count: number;
    held_count: number;
    /** Seats left; -1 means unlimited. */
    available: number;
}

export interface TicketCompetition {
    id: string;
    name: string;
}

/** A ticket you can buy (5K, VIP, VVIP). Every match day of its competitions is on sale. */
export interface TicketProductResponse {
    id: string;
    name: string;
    slug: string;
    description: string;
    base_price: number;
    is_hidden: boolean;
    /** Only returned to admins. */
    access_code?: string;
    is_active: boolean;
    /** Seats per match day; 0 means unlimited. */
    capacity: number;
    sort_order: number;
    competitions: TicketCompetition[];
    days: TicketProductDayResponse[];
}

export interface CreateTicketProductPayload {
    name: string;
    description?: string;
    base_price: number;
    is_hidden?: boolean;
    access_code?: string;
    is_active?: boolean;
    /** Seats per match day; 0 or left out means unlimited. */
    capacity?: number;
    sort_order?: number;
    /** The competitions this ticket is sold for. */
    competition_ids?: string[];
}

export type UpdateTicketProductPayload = Partial<CreateTicketProductPayload>;

/** One rung of the Game Pass discount ladder. */
export interface GamePassRule {
    min_days: number;
    percent_off: number;
    is_active: boolean;
}

export interface PriceQuoteRequest {
    product_id: string;
    event_day_ids: string[];
    quantity: number;
}

export interface PriceQuote {
    unit_price: number;
    subtotal: number;
    game_pass_discount_percent: number;
    game_pass_discount_amount: number;
    total: number;
    days: number;
}

export interface EventDayMatch {
    id: string;
    home_team: string;
    away_team: string;
    start_time: string;
    status: string;
    venue: string;
}

/** A match day. Tickets are sold on it through products, not owned by it. */
export interface EventDayResponse {
    id: string;
    title: string;
    date: string;
    venue: string;
    is_active: boolean;
    matches: EventDayMatch[];
    created_at: string;
}

/** One match day a ticket covers, with its own check-in. */
export interface TicketDayResponse {
    id: string;
    event_day_id: string;
    title: string;
    date: string;
    venue: string;
    unit_price: number;
    checked_in_at?: string;
    checked_in_by?: string;
}

export interface TicketResponse {
    id: string;
    product_id?: string;
    product_name?: string;
    purchase_type: PurchaseType;
    email: string;
    name?: string;
    phone?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    game_pass_discount_percent: number;
    game_pass_discount_amount: number;
    discount_code?: string;
    discount_amount: number;
    total_amount: number;
    status: string;
    paystack_reference?: string;
    ticket_code?: string;
    authorization_url?: string;
    referral_code?: string;
    /** Set for a Season Pass: the last day it lets people in (YYYY-MM-DD). It has no match days. */
    season_pass_id?: string;
    valid_until?: string;
    days: TicketDayResponse[];
    created_at: string;
}

export interface PurchaseTicketPayload {
    product_id: string;
    event_day_ids: string[];
    email: string;
    name: string;
    phone: string;
    quantity: number;
    referral_code?: string;
    /** Unlocks a hidden ticket. */
    access_code?: string;
}

export interface GiftTicketPayload {
    product_id: string;
    event_day_ids: string[];
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
