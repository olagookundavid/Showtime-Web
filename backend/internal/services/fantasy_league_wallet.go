package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// WithWallet lets a manager pay a league's entry fee from their spend wallet
// instead of Paystack. Without it, a wallet join is refused.
func (s *FantasyLeagueService) WithWallet(w WalletSpender) *FantasyLeagueService {
	s.wallet = w
	return s
}

// joinPaidLeagueWithWallet takes the entry fee from the spend wallet and makes
// the manager a paid member in one database transaction. Nothing here touches
// Paystack, except to check an earlier card attempt that may still be settling.
//
// The membership is written straight to PAID, which is the status verifyPayment
// sets on a successful Paystack charge, so prize pools (fee x PAID members) count
// a wallet entry exactly like a card entry. The repository takes the league lock,
// turns away a manager who is already in, and writes the debit last; a short
// wallet or a full league leaves no membership and no charge.
func (s *FantasyLeagueService) joinPaidLeagueWithWallet(ctx context.Context, league *domain.FantasyLeague, team *domain.FantasyTeam, userID string) (*dto.JoinLeagueResponse, error) {
	if s.wallet == nil {
		return nil, errors.New("paying from your wallet is not available right now")
	}
	joined := &dto.JoinLeagueResponse{LeagueID: league.ID, LeagueName: league.Name, PaidFromWallet: true}

	// An earlier card attempt for this same league may still be settling (a bank
	// transfer, a Paystack tab left open). Its reference stays on the membership so
	// that late payment can still be matched; and if it has in fact succeeded, the
	// manager is already in and must not be charged a second time.
	existing, _ := s.repo.GetMember(ctx, league.ID, userID)
	var keepRef *string
	if existing != nil && existing.PaystackReference != nil && !strings.HasPrefix(*existing.PaystackReference, walletLeagueRefPrefix) {
		keepRef = existing.PaystackReference
		if s.paystackClient != nil {
			verified, verr := s.paystackClient.VerifyTransaction(*keepRef)
			switch {
			case verr != nil:
				return nil, errors.New("we could not check your earlier card payment for this league; please try again in a moment")
			case verified.Data.Status == "success":
				if err := s.repo.UpdateMemberPaymentStatus(ctx, existing.ID, domain.LeaguePaymentPaid); err != nil {
					return nil, fmt.Errorf("failed to confirm your earlier payment: %w", err)
				}
				joined.PaidFromWallet = false
				return joined, nil
			}
		}
	}

	suffix, err := generateInviteCode()
	if err != nil {
		return nil, err
	}
	// The wallet reference is the ledger key. It is also stored on a brand-new
	// membership (the column is the member's unique payment reference, and a wallet
	// reference can never match a Paystack transaction), but it never replaces an
	// earlier card reference, which would orphan a late card payment.
	ref := fmt.Sprintf("%s%d-%s", walletLeagueRefPrefix, time.Now().Unix(), suffix)
	memberRef := &ref
	if keepRef != nil {
		memberRef = keepRef
	}

	member := &domain.FantasyLeagueMember{
		LeagueID:          league.ID,
		UserID:            userID,
		TeamID:            team.ID,
		PaymentStatus:     domain.LeaguePaymentPaid,
		PaystackReference: memberRef,
	}
	err = s.repo.AddMemberPaidFromWallet(ctx, member, domain.LedgerEntry{
		UserID:      userID,
		AmountKobo:  -int64(league.EntryFee),
		Type:        domain.LedgerPurchase,
		Reference:   &ref,
		Description: "Fantasy league entry: " + league.Name,
	})
	switch {
	case err == nil:
		return joined, nil
	case errors.Is(err, ports.ErrAlreadyLeagueMember):
		// Another request got there first: the manager is in, and paid once.
		joined.PaidFromWallet = false
		return joined, nil
	case errors.Is(err, ports.ErrWalletInsufficient), errors.Is(err, ports.ErrLeagueFull):
		return nil, err
	default:
		return nil, fmt.Errorf("failed to register league membership: %w", err)
	}
}

// walletLeagueRefPrefix marks a league payment reference made for a wallet entry.
const walletLeagueRefPrefix = "FNTW-"
