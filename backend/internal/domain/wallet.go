package domain

import "time"

// The spend wallet: a balance every account can top up with Paystack and spend
// inside Showtime. Money is integer kobo (₦1 = 100 kobo) throughout, never a
// float. It is separate from the Fantasy prize wallet (FantasyWallet), which holds
// withdrawable winnings; this one is closed-loop, so there is no withdrawal.

type LedgerType string

const (
	LedgerTopup           LedgerType = "TOPUP"
	LedgerVoucherPurchase LedgerType = "VOUCHER_PURCHASE"
	LedgerPurchase        LedgerType = "PURCHASE"
	LedgerRefund          LedgerType = "REFUND"
	LedgerAdjustment      LedgerType = "ADJUSTMENT"
	// LedgerFantasyTransfer is Fantasy prize money moved in, one-way.
	LedgerFantasyTransfer LedgerType = "FANTASY_TRANSFER"
)

type Wallet struct {
	UserID      string    `json:"user_id"`
	BalanceKobo int64     `json:"balance_kobo"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// LedgerEntry is one row of the append-only ledger. AmountKobo is signed: credits
// are positive, debits negative.
type LedgerEntry struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	AmountKobo       int64      `json:"amount_kobo"`
	BalanceAfterKobo int64      `json:"balance_after_kobo"`
	Type             LedgerType `json:"type"`
	Reference        *string    `json:"reference,omitempty"`
	VoucherID        *string    `json:"voucher_id,omitempty"`
	Description      string     `json:"description"`
	CreatedByUserID  *string    `json:"created_by_user_id,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}

type TopupStatus string

const (
	TopupPending TopupStatus = "PENDING"
	TopupPaid    TopupStatus = "PAID"
	TopupFailed  TopupStatus = "FAILED"
)

// Topup is one attempt to add money: created when the user starts paying and
// settled when Paystack confirms. The wallet is credited only when it turns PAID.
type Topup struct {
	ID                 string      `json:"id"`
	UserID             string      `json:"user_id"`
	AmountKobo         int64       `json:"amount_kobo"`
	Status             TopupStatus `json:"status"`
	PaystackReference  string      `json:"paystack_reference"`
	PaystackAccessCode *string     `json:"-"`
	CreatedAt          time.Time   `json:"created_at"`
	PaidAt             *time.Time  `json:"paid_at,omitempty"`
}

// Default top-up limits, in kobo. They are used until an admin changes the
// matching app settings.
const (
	DefaultMinTopupKobo   int64 = 50_000      // ₦500
	DefaultMaxTopupKobo   int64 = 20_000_000  // ₦200,000
	DefaultMaxBalanceKobo int64 = 100_000_000 // ₦1,000,000
)
