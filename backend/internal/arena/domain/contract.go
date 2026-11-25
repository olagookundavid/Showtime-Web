package domain

import (
	"errors"
	"strings"
	"time"
)

// Contract rules. The status moves only along these edges:
//
//	offer made ──► awaiting_release  (player is at another club)
//	           └─► awaiting_player   (free agent)
//	awaiting_release ──► awaiting_player   (current club approves)
//	                 ├─► release_declined  (current club declines)
//	                 └─► withdrawn         (offering club withdraws)
//	awaiting_player  ──► signed            (player signs)
//	                 ├─► rejected          (player rejects)
//	                 └─► withdrawn         (offering club withdraws, or the player
//	                                        signed elsewhere)
//
// signed, rejected, release_declined and withdrawn are final.

var (
	ErrWindowClosed    = errors.New("the transfer window is closed")
	ErrAlreadyAtClub   = errors.New("this player is already registered to your club")
	ErrOpenOffer       = errors.New("you already have an open offer to this player")
	ErrBadTransition   = errors.New("this offer can't be changed from its current status")
	ErrBadSignature    = errors.New("type your gamertag exactly as it appears to sign")
	ErrConsentRequired = errors.New("you must agree to the terms to sign")
	ErrBadContract     = errors.New("complete the contract terms and choose a valid end date")
)

// ContractTerms is what a manager fills in when making an offer.
type ContractTerms struct {
	SquadRole string
	EndDate   time.Time // a calendar date; only Y-M-D matters
	FeeNGN    int64
	Terms     string
}

const MaxFeeNGN = 100_000_000

// MaxTermsLen is the longest contract text accepted.
const MaxTermsLen = 1500

// ValidateTerms checks an offer's terms against the season, using today's date in
// Lagos. The end date must be today or later, and not past the season's end when
// the season has one.
func ValidateTerms(t ContractTerms, today time.Time, seasonEnd *time.Time) error {
	if !ValidSquadRole(t.SquadRole) || t.FeeNGN < 0 || t.FeeNGN > MaxFeeNGN {
		return ErrBadContract
	}
	terms := strings.TrimSpace(t.Terms)
	if terms == "" || len(terms) > MaxTermsLen {
		return ErrBadContract
	}
	end := dateOnly(t.EndDate)
	if end.Before(dateOnly(today)) {
		return ErrBadContract
	}
	if seasonEnd != nil && end.After(dateOnly(*seasonEnd)) {
		return ErrBadContract
	}
	return nil
}

func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// InitialStatus is where a new offer starts: a free agent goes straight to the
// player, a registered player needs their current club's release first.
func InitialStatus(fromClubID *string) string {
	if fromClubID == nil {
		return ContractAwaitingPlayer
	}
	return ContractAwaitingRelease
}

// IsOpen reports whether an offer is still waiting on someone.
func IsOpen(status string) bool {
	return status == ContractAwaitingRelease || status == ContractAwaitingPlayer
}

// ApproveRelease moves awaiting_release to awaiting_player.
func ApproveRelease(status string) (string, error) {
	if status != ContractAwaitingRelease {
		return status, ErrBadTransition
	}
	return ContractAwaitingPlayer, nil
}

// DeclineRelease ends an offer at the release step.
func DeclineRelease(status string) (string, error) {
	if status != ContractAwaitingRelease {
		return status, ErrBadTransition
	}
	return ContractReleaseDeclined, nil
}

// RejectOffer is the player turning an offer down.
func RejectOffer(status string) (string, error) {
	if status != ContractAwaitingPlayer {
		return status, ErrBadTransition
	}
	return ContractRejected, nil
}

// Withdraw is the offering club taking an open offer back.
func Withdraw(status string) (string, error) {
	if !IsOpen(status) {
		return status, ErrBadTransition
	}
	return ContractWithdrawn, nil
}

// CheckSignature confirms the player really means it: the typed name has to be
// their gamertag (case-insensitive) and the consent box ticked.
func CheckSignature(typed, gamertag string, consent bool) error {
	if !consent {
		return ErrConsentRequired
	}
	if !strings.EqualFold(strings.TrimSpace(typed), gamertag) {
		return ErrBadSignature
	}
	return nil
}

// Sign moves awaiting_player to signed.
func Sign(status string) (string, error) {
	if status != ContractAwaitingPlayer {
		return status, ErrBadTransition
	}
	return ContractSigned, nil
}

// PickShirtNumber keeps the player's preferred number if free at the new club,
// otherwise the lowest free number from 1 to 99. It returns 0 when the club has
// no free number at all.
func PickShirtNumber(preferred int, taken map[int]bool) int {
	if preferred >= 1 && preferred <= 99 && !taken[preferred] {
		return preferred
	}
	for n := 1; n <= 99; n++ {
		if !taken[n] {
			return n
		}
	}
	return 0
}
