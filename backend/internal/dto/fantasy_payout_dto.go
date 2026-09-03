package dto

import "showtime-backend/internal/domain"

// All monetary values crossing this boundary are integer kobo (₦1 = 100 kobo),
// matching the Paystack amounts used on the way in.

// ─── Wallet ───────────────────────────────────────────────────────────────────

type WalletTransactionResponse struct {
	ID          string `json:"id"`
	AmountKobo  int64  `json:"amount_kobo"` // signed: credits positive, debits negative
	Type        string `json:"type"`
	LeagueID    string `json:"league_id,omitempty"`
	LeagueName  string `json:"league_name,omitempty"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
}

type WalletResponse struct {
	BalanceKobo int64 `json:"balance_kobo"`
	// PendingPayoutKobo is money already committed to open payout requests. It
	// has left the balance, and is shown so the total reconciles for the user.
	PendingPayoutKobo int64                       `json:"pending_payout_kobo"`
	LifetimeWonKobo   int64                       `json:"lifetime_won_kobo"`
	LifetimePaidKobo  int64                       `json:"lifetime_paid_kobo"`
	MinPayoutKobo     int64                       `json:"min_payout_kobo"`
	CanRequestPayout  bool                        `json:"can_request_payout"`
	LastBankDetails   *BankDetails                `json:"last_bank_details,omitempty"`
	Transactions      []WalletTransactionResponse `json:"transactions"`
}

// BankDetails prefills the payout form from the user's previous request.
type BankDetails struct {
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
}

// ─── Payout requests ──────────────────────────────────────────────────────────

type CreatePayoutRequest struct {
	AmountKobo    int64  `json:"amount_kobo" binding:"required,min=1"`
	BankName      string `json:"bank_name" binding:"required,min=2,max=100"`
	AccountNumber string `json:"account_number" binding:"required,min=6,max=20"`
	AccountName   string `json:"account_name" binding:"required,min=2,max=120"`
	UserNotes     string `json:"user_notes" binding:"max=500"`
}

type PayoutRequestResponse struct {
	ID            string `json:"id"`
	UserID        string `json:"user_id"`
	UserName      string `json:"user_name,omitempty"`
	UserEmail     string `json:"user_email,omitempty"`
	AmountKobo    int64  `json:"amount_kobo"`
	Status        string `json:"status"`
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
	UserNotes     string `json:"user_notes"`
	AdminNotes    string `json:"admin_notes"`

	PaymentReference string `json:"payment_reference,omitempty"`
	ProcessedAt      string `json:"processed_at,omitempty"`
	CreatedAt        string `json:"created_at"`
}

// UpdatePayoutStatusRequest is the admin's action on a queued payout. The
// reference records the bank transfer that settled it.
type UpdatePayoutStatusRequest struct {
	Status           string `json:"status" binding:"required,oneof=PROCESSING PAID REJECTED"`
	AdminNotes       string `json:"admin_notes" binding:"max=500"`
	PaymentReference string `json:"payment_reference" binding:"max=120"`
}

// ─── League prize structure & settlement ──────────────────────────────────────

type PrizeTierInput struct {
	Rank    int     `json:"rank" binding:"required,min=1,max=50"`
	Percent float64 `json:"percent" binding:"required,gt=0,max=100"`
}

type SetPrizeStructureRequest struct {
	Tiers []PrizeTierInput `json:"tiers" binding:"required,min=1,max=50,dive"`
}

type PrizeTierResponse struct {
	Rank    int     `json:"rank"`
	Percent float64 `json:"percent"`
	// AmountKobo is this position's share of the pool as it currently stands.
	AmountKobo int64 `json:"amount_kobo"`
}

// LeagueFinanceResponse is the money view of a single league.
type LeagueFinanceResponse struct {
	LeagueID        string  `json:"league_id"`
	LeagueName      string  `json:"league_name"`
	Type            string  `json:"type"`
	EntryFeeKobo    int64   `json:"entry_fee_kobo"`
	PaidMembers     int     `json:"paid_members"`
	PendingMembers  int     `json:"pending_members"`
	GrossEntryKobo  int64   `json:"gross_entry_kobo"`
	PlatformCutKobo int64   `json:"platform_cut_kobo"`
	PrizePoolKobo   int64   `json:"prize_pool_kobo"`
	CutPercent      float64 `json:"cut_percent"`
	Settled         bool    `json:"settled"`
	SettledAt       string  `json:"settled_at,omitempty"`

	PrizeStructure []PrizeTierResponse `json:"prize_structure"`
	// Awards is the projected split before settlement, and the actual one after.
	Awards []domain.PrizeAward `json:"awards"`
}

// LeagueJoinPreview is everything a manager should read before committing to a
// league — what it costs, who they are competing against, how the money is
// split, and that an entry fee cannot be taken back. Shown before any join or
// payment is set in motion.
type LeagueJoinPreview struct {
	LeagueID   string `json:"league_id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	OwnerName  string `json:"owner_name,omitempty"`
	InviteCode string `json:"invite_code,omitempty"`

	EntryFeeKobo int64 `json:"entry_fee_kobo"`
	MemberCount  int   `json:"member_count"`
	MaxMembers   int   `json:"max_members"` // 0 = unlimited
	IsFull       bool  `json:"is_full"`

	// Where the viewer already stands, so the dialogue can say "you're in"
	// rather than offering to join twice.
	AlreadyMember    bool   `json:"already_member"`
	MembershipStatus string `json:"membership_status,omitempty"`

	// The pool as it stands today; it grows with every paid entry.
	PrizePoolKobo   int64               `json:"prize_pool_kobo"`
	PlatformCutKobo int64               `json:"platform_cut_kobo"`
	CutPercent      float64             `json:"cut_percent"`
	PrizeStructure  []PrizeTierResponse `json:"prize_structure"`

	// Entry fees are never returned once paid; stated outright rather than
	// buried, since a manager is about to part with money.
	Refundable bool `json:"refundable"`
	Settled    bool `json:"settled"`
}

// ─── Admin oversight ──────────────────────────────────────────────────────────

// AdminFantasyOverview is the headline dashboard for a season.
type AdminFantasyOverview struct {
	SeasonID   string `json:"season_id"`
	SeasonName string `json:"season_name"`
	Status     string `json:"status"`

	TotalManagers int `json:"total_managers"`
	TotalLineups  int `json:"total_lineups"`
	TotalLeagues  int `json:"total_leagues"`
	PaidLeagues   int `json:"paid_leagues"`

	GrossEntryKobo  int64   `json:"gross_entry_kobo"`
	PlatformCutKobo int64   `json:"platform_cut_kobo"`
	PrizePoolKobo   int64   `json:"prize_pool_kobo"`
	CutPercent      float64 `json:"cut_percent"`

	UnsettledLeagues    int   `json:"unsettled_leagues"`
	WalletLiabilityKobo int64 `json:"wallet_liability_kobo"` // credited but not yet withdrawn
	PendingPayoutKobo   int64 `json:"pending_payout_kobo"`
	PendingPayoutCount  int   `json:"pending_payout_count"`
	PaidOutKobo         int64 `json:"paid_out_kobo"`
}

// AdminManagerRow is one manager in the admin's season-wide list.
type AdminManagerRow struct {
	Rank        int     `json:"rank"`
	UserID      string  `json:"user_id"`
	UserName    string  `json:"user_name"`
	UserEmail   string  `json:"user_email"`
	TeamID      string  `json:"team_id"`
	TeamName    string  `json:"team_name"`
	TotalPoints float64 `json:"total_points"`
	LineupCount int     `json:"lineup_count"`
	LeagueCount int     `json:"league_count"`
	WalletKobo  int64   `json:"wallet_balance_kobo"`
	CreatedAt   string  `json:"created_at"`
}

// AdminLeagueRow is one league in the admin's season-wide list, including
// private leagues that are invisible on the public browse endpoint.
type AdminLeagueRow struct {
	LeagueID        string `json:"league_id"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	InviteCode      string `json:"invite_code,omitempty"`
	OwnerName       string `json:"owner_name,omitempty"`
	EntryFeeKobo    int64  `json:"entry_fee_kobo"`
	MaxMembers      int    `json:"max_members"`
	MemberCount     int    `json:"member_count"`
	PaidMembers     int    `json:"paid_members"`
	PendingMembers  int    `json:"pending_members"`
	GrossEntryKobo  int64  `json:"gross_entry_kobo"`
	PlatformCutKobo int64  `json:"platform_cut_kobo"`
	PrizePoolKobo   int64  `json:"prize_pool_kobo"`
	Settled         bool   `json:"settled"`
	SettledAt       string `json:"settled_at,omitempty"`
	CreatedAt       string `json:"created_at"`
}

// AdminLeagueMemberRow is one member in the admin's league drill-down.
type AdminLeagueMemberRow struct {
	UserID        string  `json:"user_id"`
	UserName      string  `json:"user_name"`
	UserEmail     string  `json:"user_email"`
	TeamID        string  `json:"team_id"`
	TeamName      string  `json:"team_name"`
	TotalPoints   float64 `json:"total_points"`
	PaymentStatus string  `json:"payment_status"`
	PaystackRef   string  `json:"paystack_reference,omitempty"`
	JoinedAt      string  `json:"joined_at"`
}

// SettlementResultResponse reports what a settlement run actually did.
type SettlementResultResponse struct {
	LeaguesSettled   int                 `json:"leagues_settled"`
	LeaguesSkipped   int                 `json:"leagues_skipped"`
	TotalAwardedKobo int64               `json:"total_awarded_kobo"`
	PlatformCutKobo  int64               `json:"platform_cut_kobo"`
	Awards           []domain.PrizeAward `json:"awards"`
}
