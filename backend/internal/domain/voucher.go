package domain

import "time"

// A voucher is a fixed bundle of items (say a burger and a drink) given to a named
// person for a date or date range. They show its code at the bar; staff redeem it
// once, only on a valid date. It is bought from the spend wallet or issued free by
// an admin.

type VoucherItem struct {
	Name string `json:"name"`
	Qty  int    `json:"qty"`
}

// VoucherProduct is a bundle admins put on sale.
type VoucherProduct struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	PriceKobo   int64         `json:"price_kobo"`
	Items       []VoucherItem `json:"items"`
	Active      bool          `json:"active"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

type VoucherStatus string

const (
	VoucherIssued   VoucherStatus = "ISSUED"
	VoucherRedeemed VoucherStatus = "REDEEMED"
	VoucherVoid     VoucherStatus = "VOID"
)

type VoucherSource string

const (
	VoucherPurchased   VoucherSource = "PURCHASED"
	VoucherAdminIssued VoucherSource = "ADMIN_ISSUED"
)

// VoucherState is what a voucher can be used for right now. It combines the stored
// status with today's date, because a voucher that is still ISSUED can be too early
// or too late. Only VoucherStateValid can be redeemed.
type VoucherState string

const (
	VoucherStateValid    VoucherState = "VALID"
	VoucherStateNotYet   VoucherState = "NOT_YET"
	VoucherStateExpired  VoucherState = "EXPIRED"
	VoucherStateRedeemed VoucherState = "REDEEMED"
	VoucherStateVoid     VoucherState = "VOID"
)

type Voucher struct {
	ID        string        `json:"id"`
	Code      string        `json:"code"`
	ProductID *string       `json:"product_id,omitempty"`
	Name      string        `json:"name"`
	Items     []VoucherItem `json:"items"`
	PriceKobo int64         `json:"price_kobo"`
	Source    VoucherSource `json:"source"`

	HolderName        string  `json:"holder_name"`
	HolderEmail       *string `json:"holder_email,omitempty"`
	HolderUserID      *string `json:"holder_user_id,omitempty"`
	PurchasedByUserID *string `json:"purchased_by_user_id,omitempty"`
	IssuedByUserID    *string `json:"issued_by_user_id,omitempty"`

	// ValidFrom and ValidTo are Lagos calendar dates (midnight UTC), both inclusive.
	ValidFrom time.Time `json:"valid_from"`
	ValidTo   time.Time `json:"valid_to"`

	Status           VoucherStatus `json:"status"`
	RedeemedAt       *time.Time    `json:"redeemed_at,omitempty"`
	RedeemedByUserID *string       `json:"redeemed_by_user_id,omitempty"`
	// RedeemedByName is the staff member who redeemed it, filled in by lookups.
	RedeemedByName string     `json:"redeemed_by_name,omitempty"`
	VoidedAt       *time.Time `json:"voided_at,omitempty"`
	VoidedByUserID *string    `json:"voided_by_user_id,omitempty"`
	WalletTxID     *string    `json:"wallet_tx_id,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

// StateOn is what the voucher can be used for on the given day. today must be a
// date-only value in Lagos (see todayLagos in the services package).
func (v *Voucher) StateOn(today time.Time) VoucherState {
	switch v.Status {
	case VoucherRedeemed:
		return VoucherStateRedeemed
	case VoucherVoid:
		return VoucherStateVoid
	}
	switch {
	case today.Before(v.ValidFrom):
		return VoucherStateNotYet
	case today.After(v.ValidTo):
		return VoucherStateExpired
	}
	return VoucherStateValid
}
