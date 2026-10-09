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
