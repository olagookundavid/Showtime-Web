package dto

import "time"

// ─── Admin management ─────────────────────────────────────────────────────────

type DiscountCodeItemRequest struct {
	EntityType string  `json:"entity_type" binding:"required,oneof=product ticket_tier"`
	EntityID   string  `json:"entity_id" binding:"required"`
	AmountOff  float64 `json:"amount_off" binding:"required,gt=0"`
}

type SaveDiscountCodeRequest struct {
	Code        string `json:"code" binding:"required,min=3,max=40"`
	Description string `json:"description"`
	// nil = unlimited redemptions.
	MaxUses *int `json:"max_uses" binding:"omitempty,gt=0"`
	// nil = never expires.
	ExpiresAt *time.Time `json:"expires_at"`
	Audience  string     `json:"audience" binding:"omitempty,oneof=all authenticated guest"`
	IsActive  *bool      `json:"is_active"`
	// At least one covered product or tier — a code that discounts nothing is
	// just a way to confuse a customer at checkout.
	Items []DiscountCodeItemRequest `json:"items" binding:"required,min=1,max=200,dive"`
}

type DiscountCodeItemResponse struct {
	ID          string  `json:"id"`
	EntityType  string  `json:"entity_type"`
	EntityID    string  `json:"entity_id"`
	EntityName  string  `json:"entity_name,omitempty"`
	EntityPrice float64 `json:"entity_price,omitempty"`
	AmountOff   float64 `json:"amount_off"`
}

type DiscountCodeResponse struct {
	ID          string                     `json:"id"`
	Code        string                     `json:"code"`
	Description string                     `json:"description"`
	MaxUses     *int                       `json:"max_uses,omitempty"`
	UsedCount   int                        `json:"used_count"`
	ExpiresAt   *time.Time                 `json:"expires_at,omitempty"`
	Audience    string                     `json:"audience"`
	IsActive    bool                       `json:"is_active"`
	CreatedAt   time.Time                  `json:"created_at"`
	UpdatedAt   time.Time                  `json:"updated_at"`
	Items       []DiscountCodeItemResponse `json:"items"`
	// Convenience flags so the admin list can label a code without re-deriving
	// the rules client-side.
	IsExpired   bool `json:"is_expired"`
	IsExhausted bool `json:"is_exhausted"`
}

// DiscountTargetOption is one selectable product or tier in the admin code
// editor, so the picker doesn't have to stitch two separate list endpoints.
type DiscountTargetOption struct {
	EntityType string  `json:"entity_type"`
	EntityID   string  `json:"entity_id"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	// For ticket tiers: which event day the tier belongs to, for disambiguation.
	GroupLabel string `json:"group_label,omitempty"`
}

// ─── Buyer-facing preview ─────────────────────────────────────────────────────

// PreviewDiscountRequest asks "what would this code do to my cart?" without
// committing to anything. Exactly one of Items or TierID is expected.
type PreviewDiscountRequest struct {
	Code  string             `json:"code" binding:"required"`
	Items []OrderItemRequest `json:"items" binding:"omitempty,max=50,dive"`
	// Ticket purchase preview.
	TierID   string `json:"tier_id"`
	Quantity int    `json:"quantity"`
}

type DiscountLineResponse struct {
	EntityType string  `json:"entity_type"`
	EntityID   string  `json:"entity_id"`
	Name       string  `json:"name"`
	AmountOff  float64 `json:"amount_off"`
}

type DiscountPreviewResponse struct {
	Code           string                 `json:"code"`
	Valid          bool                   `json:"valid"`
	Message        string                 `json:"message,omitempty"`
	Lines          []DiscountLineResponse `json:"lines"`
	OriginalAmount float64                `json:"original_amount"`
	DiscountAmount float64                `json:"discount_amount"`
	FinalAmount    float64                `json:"final_amount"`
}
