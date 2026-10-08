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
