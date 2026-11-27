package dto

import (
	"time"

	"showtime-backend/internal/domain"
)

// VoucherProductRequest creates or edits a bundle on sale. Price is kobo.
//
// Kind is "BUNDLE" (the default) or "VALUE", a price voucher: Price is its amount
// and Items is ignored. Kind is fixed when the product is created.
type VoucherProductRequest struct {
	Kind        string               `json:"kind"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	PriceKobo   int64                `json:"price_kobo"`
	Items       []domain.VoucherItem `json:"items"`
	Active      bool                 `json:"active"`
}

// PurchaseVoucherRequest buys a voucher from the wallet for a named person.
// Dates are Lagos calendar dates written YYYY-MM-DD, both inclusive.
type PurchaseVoucherRequest struct {
	ProductID   string `json:"product_id"`
	HolderName  string `json:"holder_name"`
	HolderEmail string `json:"holder_email"`
	ValidFrom   string `json:"valid_from"`
	ValidTo     string `json:"valid_to"`
}

// IssueRecipient is one person an admin gives a voucher to. HolderUserID is
// optional and links the voucher to an account, so it shows in that person's "My
// vouchers"; the account's email is used when HolderEmail is empty.
type IssueRecipient struct {
	HolderName   string `json:"holder_name"`
	HolderEmail  string `json:"holder_email"`
	HolderUserID string `json:"holder_user_id"`
}

// IssueVoucherRequest is an admin giving the same bundle (or price voucher) to one
// or more people, all valid on the same dates. Each recipient gets a voucher of
// their own. It is all or nothing: if any recipient is invalid, none are made.
type IssueVoucherRequest struct {
	ProductID  string           `json:"product_id"`
	Recipients []IssueRecipient `json:"recipients"`
	ValidFrom  string           `json:"valid_from"`
	ValidTo    string           `json:"valid_to"`
}

type VoidVoucherRequest struct {
	// Refund puts the price back in the buyer's wallet. It does nothing for a
	// voucher an admin issued, since nobody paid for it.
	Refund bool `json:"refund"`
}

// VoucherView is a voucher as the holder and the bar staff see it. It leaves out
// emails and account ids. State is what it can be used for today.
type VoucherView struct {
	ID          string               `json:"id,omitempty"`
	Code        string               `json:"code"`
	Kind        domain.VoucherKind   `json:"kind"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Items       []domain.VoucherItem `json:"items"`
	// PriceKobo is the bundle's price, or the amount of a VALUE voucher.
	PriceKobo      int64                `json:"price_kobo"`
	HolderName     string               `json:"holder_name"`
	ValidFrom      string               `json:"valid_from"`
	ValidTo        string               `json:"valid_to"`
	Status         domain.VoucherStatus `json:"status"`
	State          domain.VoucherState  `json:"state"`
	StateMessage   string               `json:"state_message"`
	Redeemable     bool                 `json:"redeemable"`
	RedeemedAt     *time.Time           `json:"redeemed_at,omitempty"`
	RedeemedByName string               `json:"redeemed_by_name,omitempty"`
	CreatedAt      time.Time            `json:"created_at"`
}

// AdminVoucherView adds what staff need to manage a voucher.
type AdminVoucherView struct {
	VoucherView
	Source            domain.VoucherSource `json:"source"`
	HolderEmail       *string              `json:"holder_email,omitempty"`
	HolderUserID      *string              `json:"holder_user_id,omitempty"`
	PurchasedByUserID *string              `json:"purchased_by_user_id,omitempty"`
}

type AdminVoucherList struct {
	Data  []AdminVoucherView `json:"data"`
	Total int                `json:"total"`
	Page  int                `json:"page"`
	Limit int                `json:"limit"`
}

// RedeemVoucherResponse is the result of trying to redeem. Redeemed is false when
// the voucher cannot be used; the voucher's StateMessage says why.
type RedeemVoucherResponse struct {
	Redeemed bool        `json:"redeemed"`
	Voucher  VoucherView `json:"voucher"`
}
