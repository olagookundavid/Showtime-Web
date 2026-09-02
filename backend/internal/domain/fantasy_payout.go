package domain

import (
	"fmt"
	"sort"
	"time"
)

// Money throughout the payout system is integer kobo (₦1 = 100 kobo). Prize
// splitting divides a pot between people, so floating point is not an option —
// every division here is exact integer arithmetic with the remainder explicitly
// accounted for.

// ─── Prize structure ──────────────────────────────────────────────────────────

// PrizeTier awards a percentage of the prize pool to a finishing position.
type PrizeTier struct {
	ID       string  `json:"id,omitempty"`
	LeagueID string  `json:"league_id,omitempty"`
	Rank     int     `json:"rank"`
	Percent  float64 `json:"percent"`
}

// DefaultPrizeStructure is used by any paid league that hasn't defined its own.
var DefaultPrizeStructure = []PrizeTier{
	{Rank: 1, Percent: 50},
	{Rank: 2, Percent: 30},
	{Rank: 3, Percent: 20},
}

// ValidatePrizeStructure checks a proposed split: ranks must be unique and
// start at 1 with no gaps, and the percentages must not exceed 100.
func ValidatePrizeStructure(tiers []PrizeTier) error {
	if len(tiers) == 0 {
		return fmt.Errorf("a prize structure needs at least one position")
	}

	sorted := append([]PrizeTier(nil), tiers...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Rank < sorted[j].Rank })

	var total float64
	for i, t := range sorted {
		if t.Rank != i+1 {
			return fmt.Errorf("prize positions must run 1, 2, 3… without gaps (found position %d at slot %d)", t.Rank, i+1)
		}
		if t.Percent <= 0 || t.Percent > 100 {
			return fmt.Errorf("position %d has an invalid share of %.2f%%", t.Rank, t.Percent)
		}
		total += t.Percent
	}
	if total > 100.0001 {
		return fmt.Errorf("prize shares add up to %.2f%%, which is more than the pool", total)
	}
	return nil
}

// ─── Prize distribution ───────────────────────────────────────────────────────

// PrizeStanding is one manager's final position input.
type PrizeStanding struct {
	UserID   string
	TeamID   string
	TeamName string
	UserName string
	Points   float64
}

// PrizeAward is one manager's computed winnings.
type PrizeAward struct {
	UserID      string  `json:"user_id"`
	TeamID      string  `json:"team_id"`
	TeamName    string  `json:"team_name"`
	UserName    string  `json:"user_name"`
	Rank        int     `json:"rank"`
	Points      float64 `json:"points"`
	AmountKobo  int64   `json:"amount_kobo"`
	SharedWith  int     `json:"shared_with"` // how many managers tied for this position
	Description string  `json:"description"`
}

// SplitPool applies the platform's percentage cut to gross entry fees,
// returning the cut and the remaining prize pool. The cut absorbs any rounding
// remainder so cut + pool always equals gross exactly.
func SplitPool(grossKobo int64, cutPercent float64) (cut, pool int64) {
	if grossKobo <= 0 {
		return 0, 0
	}
	if cutPercent <= 0 {
		return 0, grossKobo
	}
	if cutPercent >= 100 {
		return grossKobo, 0
	}
	// Scale by 1000 to keep a fractional percent (e.g. 7.5%) exact in integers.
	pool = grossKobo * int64((100-cutPercent)*1000) / 100000
	return grossKobo - pool, pool
}

// DistributePrizes splits a prize pool across final standings.
//
// Managers level on points share the combined prize for the positions they
// occupy: two tied for 1st take (1st + 2nd) ÷ 2 each, and the next manager
// finishes 3rd. Every kobo is accounted for — the remainder from a division is
// handed out one kobo at a time down the tied group, and if the structure adds
// up to a full 100% any final rounding remainder goes to the top position, so
// the awards always sum to exactly the pool.
func DistributePrizes(standings []PrizeStanding, poolKobo int64, tiers []PrizeTier) []PrizeAward {
	if poolKobo <= 0 || len(standings) == 0 || len(tiers) == 0 {
		return nil
	}

	byRank := make(map[int]int64, len(tiers))
	var totalPercent float64
	var allocated int64
	for _, t := range tiers {
		amt := poolKobo * int64(t.Percent*1000) / 100000
		byRank[t.Rank] = amt
		allocated += amt
		totalPercent += t.Percent
	}
	// A structure that adds up to 100% must pay out the entire pool; give the
	// rounding dust to first place. A deliberately partial structure keeps its
	// unallocated share in the pool instead.
	if totalPercent > 99.9999 && allocated < poolKobo {
		byRank[1] += poolKobo - allocated
	}

	// Highest points first; ties broken deterministically so repeated runs
	// award identically.
	ordered := append([]PrizeStanding(nil), standings...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].Points != ordered[j].Points {
			return ordered[i].Points > ordered[j].Points
		}
		return ordered[i].UserID < ordered[j].UserID
	})

	var awards []PrizeAward
	for i := 0; i < len(ordered); {
		// Collect everyone level on points with ordered[i].
		j := i
		for j < len(ordered) && ordered[j].Points == ordered[i].Points {
			j++
		}
		groupSize := j - i
		rank := i + 1

		// Pool the prizes for every position this tied group occupies.
		var combined int64
		for r := rank; r < rank+groupSize; r++ {
			combined += byRank[r]
		}

		if combined > 0 {
			each := combined / int64(groupSize)
			remainder := combined % int64(groupSize)
			for k := 0; k < groupSize; k++ {
				amount := each
				if int64(k) < remainder {
					amount++ // spread the indivisible kobo across the first few
				}
				s := ordered[i+k]
				awards = append(awards, PrizeAward{
					UserID: s.UserID, TeamID: s.TeamID, TeamName: s.TeamName,
					UserName: s.UserName, Rank: rank, Points: s.Points,
					AmountKobo: amount, SharedWith: groupSize,
					Description: prizeDescription(rank, groupSize),
				})
			}
		}
		i = j
	}
	return awards
}

func prizeDescription(rank, groupSize int) string {
	if groupSize > 1 {
		return fmt.Sprintf("Prize for joint %s place", ordinal(rank))
	}
	return fmt.Sprintf("Prize for %s place", ordinal(rank))
}

func ordinal(n int) string {
	suffix := "th"
	// 11th, 12th and 13th are the exceptions to the 1st/2nd/3rd pattern.
	if n%100 < 11 || n%100 > 13 {
		switch n % 10 {
		case 1:
			suffix = "st"
		case 2:
			suffix = "nd"
		case 3:
			suffix = "rd"
		}
	}
	return fmt.Sprintf("%d%s", n, suffix)
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

type WalletTransactionType string

const (
	WalletWinnings       WalletTransactionType = "WINNINGS"
	WalletPayout         WalletTransactionType = "PAYOUT"
	WalletPayoutReversal WalletTransactionType = "PAYOUT_REVERSAL"
	WalletAdjustment     WalletTransactionType = "ADJUSTMENT"
)

type FantasyWallet struct {
	UserID      string    `json:"user_id"`
	BalanceKobo int64     `json:"balance_kobo"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type WalletTransaction struct {
	ID              string                `json:"id"`
	UserID          string                `json:"user_id"`
	AmountKobo      int64                 `json:"amount_kobo"` // signed
	Type            WalletTransactionType `json:"type"`
	LeagueID        *string               `json:"league_id,omitempty"`
	LeagueName      string                `json:"league_name,omitempty"`
	PayoutRequestID *string               `json:"payout_request_id,omitempty"`
	Description     string                `json:"description"`
	CreatedByUserID *string               `json:"created_by_user_id,omitempty"`
	CreatedAt       time.Time             `json:"created_at"`
}

// ─── Payout requests ──────────────────────────────────────────────────────────

type PayoutStatus string

const (
	PayoutPending    PayoutStatus = "PENDING"
	PayoutProcessing PayoutStatus = "PROCESSING"
	PayoutPaid       PayoutStatus = "PAID"
	PayoutRejected   PayoutStatus = "REJECTED"
	PayoutCancelled  PayoutStatus = "CANCELLED"
)

// IsTerminal reports whether a payout has reached a final state.
func (s PayoutStatus) IsTerminal() bool {
	return s == PayoutPaid || s == PayoutRejected || s == PayoutCancelled
}

// ReturnsFunds reports whether moving to this status should credit the held
// money back to the user's wallet.
func (s PayoutStatus) ReturnsFunds() bool {
	return s == PayoutRejected || s == PayoutCancelled
}

// MinPayoutKobo is the smallest withdrawal we will process, since each one
// costs manual operator time and a bank transfer fee. ₦1,000.
const MinPayoutKobo int64 = 100000

type PayoutRequest struct {
	ID            string       `json:"id"`
	UserID        string       `json:"user_id"`
	AmountKobo    int64        `json:"amount_kobo"`
	Status        PayoutStatus `json:"status"`
	BankName      string       `json:"bank_name"`
	AccountNumber string       `json:"account_number"`
	AccountName   string       `json:"account_name"`
	UserNotes     string       `json:"user_notes"`
	AdminNotes    string       `json:"admin_notes"`

	PaymentReference  string     `json:"payment_reference"`
	ProcessedByUserID *string    `json:"processed_by_user_id,omitempty"`
	ProcessedAt       *time.Time `json:"processed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// Joined for the admin queue.
	UserName  string `json:"user_name,omitempty"`
	UserEmail string `json:"user_email,omitempty"`
}

// ValidatePayoutStatusTransition guards the payout lifecycle. Terminal states
// are final: reopening a paid or refunded request would let the same money be
// released twice.
func ValidatePayoutStatusTransition(from, to PayoutStatus) error {
	if from == to {
		return fmt.Errorf("this payout is already marked %s", to)
	}
	if from.IsTerminal() {
		return fmt.Errorf("this payout is already %s and can no longer be changed", from)
	}
	switch to {
	case PayoutProcessing, PayoutPaid, PayoutRejected, PayoutCancelled:
		return nil
	default:
		return fmt.Errorf("unknown payout status: %s", to)
	}
}
