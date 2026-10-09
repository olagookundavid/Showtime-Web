package dto

import (
	"encoding/json"
	"time"
)

// OptionalInt tells "field omitted" apart from "field sent as null" in a JSON
// body. A partial update needs both: the admin toggle sends only is_active and
// must leave max_gamedays alone, while the full edit form sends
// max_gamedays: null to make a band open ended.
type OptionalInt struct {
	Set   bool // the key was present in the body
	Value *int // nil when the key was sent as null
}

func (o *OptionalInt) UnmarshalJSON(data []byte) error {
	// Only called when the key is present, so Set is true even for null.
	o.Set = true
	if string(data) == "null" {
		o.Value = nil
		return nil
	}
	var v int
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	o.Value = &v
	return nil
}

// ─── Season admission tiers ───────────────────────────────────────────────────

type CreateSeasonAdmissionTierRequest struct {
	Name         string `json:"name" binding:"required,max=100"`
	Price        int    `json:"price" binding:"gte=0"`
	Description  string `json:"description"`
	DisplayOrder int    `json:"display_order"`
	IsActive     *bool  `json:"is_active"`
}

type UpdateSeasonAdmissionTierRequest struct {
	Name         *string `json:"name" binding:"omitempty,max=100"`
	Price        *int    `json:"price" binding:"omitempty,gte=0"`
	Description  *string `json:"description"`
	DisplayOrder *int    `json:"display_order"`
	IsActive     *bool   `json:"is_active"`
}

type SeasonAdmissionTierResponse struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Price        int       `json:"price"`
	Description  string    `json:"description"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ─── Game Pass discount bands ─────────────────────────────────────────────────

// Range rules (min >= 2, max >= min, percent 0–100, no overlap) are checked by
// domain.ValidateDiscountBand so the message can name the conflicting band.
type CreateGamePassDiscountBandRequest struct {
	MinGamedays     int   `json:"min_gamedays" binding:"required"`
	MaxGamedays     *int  `json:"max_gamedays"` // nil/omitted = open ended
	DiscountPercent int   `json:"discount_percent"`
	DisplayOrder    int   `json:"display_order"`
	IsActive        *bool `json:"is_active"`
}

type UpdateGamePassDiscountBandRequest struct {
	MinGamedays     *int        `json:"min_gamedays"`
	MaxGamedays     OptionalInt `json:"max_gamedays"`
	DiscountPercent *int        `json:"discount_percent"`
	DisplayOrder    *int        `json:"display_order"`
	IsActive        *bool       `json:"is_active"`
}

type UpdateGamePassDiscountBandStatusRequest struct {
	IsActive *bool `json:"is_active" binding:"required"`
}

type GamePassDiscountBandResponse struct {
	ID              string    `json:"id"`
	MinGamedays     int       `json:"min_gamedays"`
	MaxGamedays     *int      `json:"max_gamedays"`
	DiscountPercent int       `json:"discount_percent"`
	DisplayOrder    int       `json:"display_order"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
