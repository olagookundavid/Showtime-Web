export interface SeasonAdmissionTierResponse {
  id: string;
  name: string;
  price: number;
  description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSeasonAdmissionTierPayload {
  name: string;
  price: number;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateSeasonAdmissionTierPayload {
  name?: string;
  price?: number;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface GamePassDiscountBandResponse {
  id: string;
  min_gamedays: number;
  /** null = open-ended (the top band). */
  max_gamedays: number | null;
  discount_percent: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGamePassDiscountBandPayload {
  min_gamedays: number;
  max_gamedays?: number | null;
  discount_percent: number;
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateGamePassDiscountBandPayload {
  min_gamedays?: number;
  max_gamedays?: number | null;
  discount_percent?: number;
  display_order?: number;
  is_active?: boolean;
}

export interface GamePassGameday {
  id: string;
  title: string;
  date: string;
  venue?: string;
}

export interface GamePassCheckoutPayload {
  name: string;
  email: string;
  phone: string;
  tier_id: string;
  gameday_ids: string[];
  holders: number;
}

export interface GamePassOrderTicket {
  id: string;
  ticket_code: string;
  event_day_id: string;
  event_title: string;
  event_date: string;
  event_venue?: string;
  tier_name: string;
  status: string;
  total_amount: number;
  checked_in_at?: string;
}

export interface GamePassOrderResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier_name: string;
  unit_price: number;
  gameday_count: number;
  holders: number;
  standard_total: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  payment_status: "pending" | "paid" | "failed";
  paystack_reference?: string;
  /** Only present on the Checkout response — the Paystack redirect target. */
  authorization_url?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  gamedays: GamePassGameday[];
  /** Present once paid (public endpoints) or always (admin GetOrder). */
  tickets?: GamePassOrderTicket[];
}
