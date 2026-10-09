package domain

import (
	"fmt"
	"time"
)

// ─── Season Admission Tier ────────────────────────────────────────────────────

// SeasonAdmissionTier is the authoritative per-gameday rate for an admission
// tier across the season. Game Pass bundles are priced from it; single tickets
// keep using the per-gameday ticket_tiers.
type SeasonAdmissionTier struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Price        int       `json:"price"` // whole naira
	Description  string    `json:"description"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ─── Game Pass Discount Band ──────────────────────────────────────────────────

// GamePassDiscountBand is the bundle discount for a range of gameday counts.
// MaxGamedays nil means the band is open ended (the top band).
type GamePassDiscountBand struct {
	ID              string    `json:"id"`
	MinGamedays     int       `json:"min_gamedays"`
	MaxGamedays     *int      `json:"max_gamedays"`
	DiscountPercent int       `json:"discount_percent"`
	DisplayOrder    int       `json:"display_order"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// MinGamePassGamedays is the fewest gamedays a Game Pass can bundle; one
// gameday is a single ticket.
const MinGamePassGamedays = 2

// MaxGamePassHolders caps the pass holders on one Game Pass.
const MaxGamePassHolders = 10

// ─── Pricing ──────────────────────────────────────────────────────────────────

// GamePassPrice is a priced bundle. Every figure is whole naira.
type GamePassPrice struct {
	UnitPrice       int `json:"unit_price"` // season rate per gameday per holder
	Gamedays        int `json:"gamedays"`
	Holders         int `json:"holders"`
	StandardTotal   int `json:"standard_total"`
	DiscountPercent int `json:"discount_percent"`
	DiscountAmount  int `json:"discount_amount"`
	Total           int `json:"total"`
}

// PriceGamePass prices a bundle from the season rate and the active bands:
// rate × gamedays × holders, less the covering band's percentage rounded to the
// nearest naira (half up, matching the buyer page's Math.round preview). No
// covering band means no discount. Inactive bands are ignored.
func PriceGamePass(unitPrice, gamedays, holders int, bands []GamePassDiscountBand) GamePassPrice {
	p := GamePassPrice{UnitPrice: unitPrice, Gamedays: gamedays, Holders: holders}
	p.StandardTotal = unitPrice * gamedays * holders
	for _, b := range bands {
		if b.IsActive && b.Covers(gamedays) {
			p.DiscountPercent = b.DiscountPercent
			break
		}
	}
	p.DiscountAmount = (p.StandardTotal*p.DiscountPercent + 50) / 100
	p.Total = p.StandardTotal - p.DiscountAmount
	return p
}

// ─── Game Pass Lead ───────────────────────────────────────────────────────────

type GamePassLeadStatus string

const (
	GamePassLeadNew       GamePassLeadStatus = "new"
	GamePassLeadContacted GamePassLeadStatus = "contacted"
	GamePassLeadConverted GamePassLeadStatus = "converted"
	GamePassLeadDismissed GamePassLeadStatus = "dismissed"
)

func (s GamePassLeadStatus) Valid() bool {
	switch s {
	case GamePassLeadNew, GamePassLeadContacted, GamePassLeadConverted, GamePassLeadDismissed:
		return true
	}
	return false
}

// GamePassLead is a buyer's interest in a bundle before purchases exist. The
// pricing fields are the server's quote at submission time.
type GamePassLead struct {
	ID         string             `json:"id"`
	Name       string             `json:"name"`
	Email      string             `json:"email"`
	Phone      string             `json:"phone"`
	TierName   string             `json:"tier_name"`
	GamedayIDs []string           `json:"gameday_ids"`
	Price      GamePassPrice      `json:"price"`
	Status     GamePassLeadStatus `json:"status"`
	CreatedAt  time.Time          `json:"created_at"`
	UpdatedAt  time.Time          `json:"updated_at"`

	// Gamedays is read-side only: the event days behind GamedayIDs that still
	// exist, so the admin list can show dates instead of IDs.
	Gamedays []EventDay `json:"gamedays,omitempty"`
}

// Covers reports whether a bundle of n gamedays falls in this band.
func (b GamePassDiscountBand) Covers(n int) bool {
	return n >= b.MinGamedays && (b.MaxGamedays == nil || n <= *b.MaxGamedays)
}

// RangeLabel is the band as an admin reads it: "2–3 gamedays" or "6+ gamedays".
func (b GamePassDiscountBand) RangeLabel() string {
	if b.MaxGamedays == nil {
		return fmt.Sprintf("%d+ gamedays", b.MinGamedays)
	}
	if *b.MaxGamedays == b.MinGamedays {
		return fmt.Sprintf("%d gamedays", b.MinGamedays)
	}
	return fmt.Sprintf("%d–%d gamedays", b.MinGamedays, *b.MaxGamedays)
}

func (b GamePassDiscountBand) overlaps(o GamePassDiscountBand) bool {
	// Closed ranges [aMin, aMax] and [bMin, bMax] overlap unless one ends before
	// the other starts. An open-ended band never ends.
	aEndsBefore := b.MaxGamedays != nil && *b.MaxGamedays < o.MinGamedays
	bEndsBefore := o.MaxGamedays != nil && *o.MaxGamedays < b.MinGamedays
	return !aEndsBefore && !bEndsBefore
}

// ValidateDiscountBand checks a band before it is saved. others is every other
// band in the table; the band itself (same ID) is skipped, so an edit is never
// compared with its own old values. Field rules always apply; the overlap and
// open-ended rules only bind when the band is active, since inactive bands do
// not price anything.
//
// The returned message names the conflicting band so an admin can fix it.
func ValidateDiscountBand(b GamePassDiscountBand, others []GamePassDiscountBand) error {
	if b.MinGamedays < MinGamePassGamedays {
		return fmt.Errorf("min gamedays must be at least %d", MinGamePassGamedays)
	}
	if b.MaxGamedays != nil && *b.MaxGamedays < b.MinGamedays {
		return fmt.Errorf("max gamedays (%d) cannot be less than min gamedays (%d)", *b.MaxGamedays, b.MinGamedays)
	}
	if b.DiscountPercent < 0 || b.DiscountPercent > 100 {
		return fmt.Errorf("discount percent must be between 0 and 100")
	}
	if !b.IsActive {
		return nil
	}

	for _, o := range others {
		if o.ID == b.ID || !o.IsActive {
			continue
		}
		if b.MaxGamedays == nil && o.MaxGamedays == nil {
			return fmt.Errorf("only one active band can be open ended; %s (%d%%) already is", o.RangeLabel(), o.DiscountPercent)
		}
		if b.overlaps(o) {
			return fmt.Errorf("%s overlaps the active band %s (%d%%)", b.RangeLabel(), o.RangeLabel(), o.DiscountPercent)
		}
	}
	return nil
}
