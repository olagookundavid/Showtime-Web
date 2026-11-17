package dto

import "showtime-backend/internal/domain"

// SpendWalletResponse is the signed-in user's wallet with its recent history and the
// limits the top-up form should enforce. All amounts are kobo.
type SpendWalletResponse struct {
	BalanceKobo    int64                `json:"balance_kobo"`
	MinTopupKobo   int64                `json:"min_topup_kobo"`
	MaxTopupKobo   int64                `json:"max_topup_kobo"`
	MaxBalanceKobo int64                `json:"max_balance_kobo"`
	Transactions   []domain.LedgerEntry `json:"transactions"`
}

type TopupRequest struct {
	AmountKobo int64 `json:"amount_kobo"`
}

// TopupInitResponse sends the browser to Paystack to pay.
type TopupInitResponse struct {
	Reference        string `json:"reference"`
	AuthorizationURL string `json:"authorization_url"`
}

type VerifyTopupRequest struct {
	Reference string `json:"reference"`
}

// TopupResponse is where a top-up stands. BalanceKobo is the wallet balance now.
type TopupResponse struct {
	Reference   string             `json:"reference"`
	AmountKobo  int64              `json:"amount_kobo"`
	Status      domain.TopupStatus `json:"status"`
	BalanceKobo int64              `json:"balance_kobo"`
}

// AdjustWalletRequest is a manual credit (positive) or debit (negative) by staff.
type AdjustWalletRequest struct {
	AmountKobo int64  `json:"amount_kobo"`
	Reason     string `json:"reason"`
}

// WalletUser is who a wallet belongs to, as staff see it.
type WalletUser struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// AdminWalletResponse is a user's wallet with the user it belongs to.
type AdminWalletResponse struct {
	User WalletUser `json:"user"`
	SpendWalletResponse
}
