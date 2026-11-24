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
	//
	// When an earlier card attempt is still open, the wallet reference is built
	// from it. If that card payment succeeds later, verifyPayment can find this
	// wallet payment from the card reference alone and refund it, so the manager
	// ends up paying once.
	ref := fmt.Sprintf("%s%d-%s", walletLeagueRefPrefix, time.Now().Unix(), suffix)
	memberRef := &ref
	if keepRef != nil {
		ref = walletRefForCard(*keepRef)
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

// walletRefForCard is the ledger reference of a wallet entry paid while the card
// attempt cardRef was still open.
func walletRefForCard(cardRef string) string {
	return walletLeagueRefPrefix + cardRef
}

// walletPaymentLookup is the part of the wallet service that says how much of a
// payment is still unrefunded. It is kept off WalletSpender, which the store and
// ticket flows share and don't need it.
type walletPaymentLookup interface {
	UnrefundedPaymentKobo(ctx context.Context, reference string) (int64, error)
}

// The real wallet must keep providing it, or the refund would silently stop.
var _ walletPaymentLookup = (*WalletService)(nil)

// refundWalletIfCardAlsoPaid handles a manager who joined with the wallet while
// an earlier card attempt was open, and whose card payment then went through as
// well. The card payment stands as the entry fee and the wallet payment is put
// back. It does nothing unless a wallet payment is tied to cardRef, has not been
// refunded, and Paystack confirms the card charge, so it is safe to repeat.
func (s *FantasyLeagueService) refundWalletIfCardAlsoPaid(ctx context.Context, member *domain.FantasyLeagueMember, cardRef string) error {
	if s.wallet == nil || s.paystackClient == nil || strings.HasPrefix(cardRef, walletLeagueRefPrefix) {
		return nil
	}
	lookup, ok := s.wallet.(walletPaymentLookup)
	if !ok {
		return nil
	}
	walletRef := walletRefForCard(cardRef)
	owed, err := lookup.UnrefundedPaymentKobo(ctx, walletRef)
	if err != nil {
		return fmt.Errorf("failed to check the wallet payment for this league: %w", err)
	}
	if owed <= 0 {
		return nil
	}
	resp, err := s.paystackClient.VerifyTransaction(cardRef)
	if err != nil {
		return fmt.Errorf("paystack verification call failed: %w", err)
	}
	if resp.Data.Status != "success" || int64(resp.Data.Amount) < owed {
		return nil
	}
	_, err = s.wallet.Refund(ctx, member.UserID, owed, walletRef,
		"Refund: league entry was also paid by card")
	return err
}
