/** Who may redeem a code. Defaults to 'all'. */
export type DiscountAudience = 'all' | 'authenticated' | 'guest';

/** One product or ticket tier a code covers, with its own naira reduction. */
export interface DiscountCodeItem {
    id?: string;
    entity_type: 'product' | 'ticket_tier';
    entity_id: string;
    entity_name?: string;
    entity_price?: number;
    amount_off: number;
}

export interface DiscountCode {
    id: string;
    code: string;
    description: string;
    max_uses?: number | null;
    used_count: number;
    expires_at?: string | null;
    audience: DiscountAudience;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    items: DiscountCodeItem[];
    is_expired: boolean;
    is_exhausted: boolean;
}

export interface SaveDiscountCodePayload {
    code: string;
    description?: string;
    max_uses?: number | null;
    expires_at?: string | null;
    audience?: DiscountAudience;
    is_active?: boolean;
    items: { entity_type: 'product' | 'ticket_tier'; entity_id: string; amount_off: number }[];
}

/** A product or tier selectable in the admin code editor. */
export interface DiscountTarget {
    entity_type: 'product' | 'ticket_tier';
    entity_id: string;
    name: string;
    price: number;
}

export interface DiscountPreview {
    code: string;
    valid: boolean;
    /** Why the code was rejected. Safe to show to the buyer verbatim. */
    message?: string;
    lines: { entity_type: string; entity_id: string; name: string; amount_off: number }[];
    original_amount: number;
    discount_amount: number;
    final_amount: number;
}
