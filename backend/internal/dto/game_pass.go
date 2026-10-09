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

// ─── Game Pass leads ──────────────────────────────────────────────────────────

// CreateGamePassLeadRequest is a buyer's "notify me" submission. It carries
// only what was chosen; the price is quoted server side, never taken from here.
type CreateGamePassLeadRequest struct {
	Name       string   `json:"name" binding:"required,max=200"`
	Email      string   `json:"email" binding:"required,email,max=255"`
	Phone      string   `json:"phone" binding:"required,max=40"`
	TierID     string   `json:"tier_id" binding:"required,uuid"`
	GamedayIDs []string `json:"gameday_ids" binding:"required,min=1,max=50,dive,uuid"`
	Holders    int      `json:"holders" binding:"required,min=1"`
}

type UpdateGamePassLeadRequest struct {
	Status string `json:"status" binding:"required,oneof=new contacted converted dismissed"`
}

type GamePassLeadGameday struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Date  string `json:"date"`
}

type GamePassLeadResponse struct {
	ID              string                `json:"id"`
	Name            string                `json:"name"`
	Email           string                `json:"email"`
	Phone           string                `json:"phone"`
	TierName        string                `json:"tier_name"`
	GamedayIDs      []string              `json:"gameday_ids"`
	Gamedays        []GamePassLeadGameday `json:"gamedays"`
	Holders         int                   `json:"holders"`
	StandardTotal   int                   `json:"standard_total"`
	DiscountPercent int                   `json:"discount_percent"`
	DiscountAmount  int                   `json:"discount_amount"`
	Total           int                   `json:"total"`
	Status          string                `json:"status"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
}
