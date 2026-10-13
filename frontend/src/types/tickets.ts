import type { Team } from './matches';

/** SINGLE is one match day; GAME_PASS is two or more under one code. */
export type PurchaseType = 'SINGLE' | 'GAME_PASS';

/** A ticket product on sale for one match day. */
export interface TicketProductDayResponse {
    id: string;
    product_id: string;
    event_day_id: string;
    event_title: string;
    event_date: string;
    event_venue: string;
    /** Effective price: the override when set, else the product's base price. */
    price: number;
    price_override?: number | null;
    /** 0 means unlimited. */
    capacity: number;
    sold_count: number;
    held_count: number;
    /** Seats left; -1 means unlimited. */
    available: number;
    is_active: boolean;
}

/** A ticket you can buy (5K, VIP, VVIP), sold on one or more match days. */
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
    allow_game_pass: boolean;
    sort_order: number;
    days: TicketProductDayResponse[];
}

export interface CreateTicketProductPayload {
    name: string;
    description?: string;
    base_price: number;
    is_hidden?: boolean;
    access_code?: string;
    is_active?: boolean;
    allow_game_pass?: boolean;
    sort_order?: number;
}

export type UpdateTicketProductPayload = Partial<CreateTicketProductPayload>;

export interface SaveProductDayPayload {
    event_day_id: string;
    /** null clears the override, falling back to the product's base price. */
    price_override: number | null;
    /** 0 means unlimited. */
    capacity: number;
    is_active?: boolean;
}

/** One rung of the Game Pass discount ladder. */
export interface GamePassRule {
    min_days: number;
    percent_off: number;
    is_active: boolean;
}

export interface PriceQuoteRequest {
    product_id: string;
    event_day_ids: string[];
    purchase_type: PurchaseType;
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
    days: TicketDayResponse[];
    created_at: string;
}

export interface PurchaseTicketPayload {
    product_id: string;
    purchase_type: PurchaseType;
    event_day_ids: string[];
    email: string;
    name: string;
    phone: string;
    quantity: number;
    referral_code?: string;
    /** Unlocks a hidden ticket. */
    access_code?: string;
    /** Distinct from referral_code (attribution only) — this one changes price. */
    discount_code?: string;
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
