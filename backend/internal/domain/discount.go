package domain

import (
	"strings"
	"time"
)

// Entity kinds a discount code line can point at.
const (
	DiscountEntityProduct    = "product"
	DiscountEntityTicketTier = "ticket_tier"
)

// Who is allowed to redeem a code.
const (
	DiscountAudienceAll           = "all"
	DiscountAudienceAuthenticated = "authenticated"
	DiscountAudienceGuest         = "guest"
)

// Redemption lifecycle. A hold is taken at checkout and settled either way once
// payment resolves.
const (
	RedemptionReserved  = "reserved"
	RedemptionConfirmed = "confirmed"
	RedemptionReleased  = "released"
)

// ReservationTTL is how long an unpaid checkout keeps its hold on a code.
// Reservations older than this stop counting toward max_uses, so an abandoned
// cart cannot permanently consume a limited code.
const ReservationTTL = time.Hour

// DiscountCodeItem is one product or ticket tier the code covers, with the naira
// amount taken off it. The same code carries a different amount per entity —
// that is the whole point of it being product-agnostic.
type DiscountCodeItem struct {
	ID         string  `json:"id"`
	EntityType string  `json:"entity_type"`
	EntityID   string  `json:"entity_id"`
	AmountOff  float64 `json:"amount_off"`

	// Filled in on read so the admin screen can show what it is looking at
	// without a second round-trip.
	EntityName  string  `json:"entity_name,omitempty"`
	EntityPrice float64 `json:"entity_price,omitempty"`
}

type DiscountCode struct {
	ID          string     `json:"id"`
	Code        string     `json:"code"`
	Description string     `json:"description"`
	MaxUses     *int       `json:"max_uses,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	Audience    string     `json:"audience"`
	IsActive    bool       `json:"is_active"`
	CreatedBy   *string    `json:"created_by,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	Items []DiscountCodeItem `json:"items"`

	// Derived at read time.
	UsedCount int `json:"used_count"`
}

// NormalizeCode is the single definition of how a code string is compared.
// Buyers type codes casually, so input is trimmed and upper-cased both when
// stored and when looked up.
func NormalizeCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// Expired reports whether the code is past its expiry date.
func (d *DiscountCode) Expired(now time.Time) bool {
	return d.ExpiresAt != nil && now.After(*d.ExpiresAt)
}

// Exhausted reports whether the code has no redemptions left.
func (d *DiscountCode) Exhausted() bool {
	return d.MaxUses != nil && d.UsedCount >= *d.MaxUses
}

// AllowsAudience reports whether a buyer of this kind may redeem the code.
func (d *DiscountCode) AllowsAudience(isAuthenticated bool) bool {
	switch d.Audience {
	case DiscountAudienceAuthenticated:
		return isAuthenticated
	case DiscountAudienceGuest:
		return !isAuthenticated
	default:
		return true
	}
}

// AmountOffFor returns the reduction this code gives on one unit of the given
// entity, and whether the code covers it at all.
func (d *DiscountCode) AmountOffFor(entityType, entityID string) (float64, bool) {
	for _, item := range d.Items {
		if item.EntityType == entityType && item.EntityID == entityID {
			return item.AmountOff, true
		}
	}
	return 0, false
}

// DiscountLine records what a code took off a single cart line, for display and
// for the amount stored against the purchase.
type DiscountLine struct {
	EntityType string
	EntityID   string
	Name       string
	AmountOff  float64
}

// DiscountApplication is the outcome of pricing a cart against a code.
type DiscountApplication struct {
	Code           string
	CodeID         string
	Lines          []DiscountLine
	TotalDiscount  float64
	OriginalAmount float64
	FinalAmount    float64
}
