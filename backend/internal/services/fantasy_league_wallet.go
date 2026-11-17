package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
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
// the manager a paid member in one go. Nothing here touches Paystack.
//
// The debit comes first. The membership is then written straight to PAID, which
// is the status verifyPayment sets on a successful Paystack charge, so prize
// pools (fee x PAID members) count a wallet entry exactly like a card entry. If
// the membership cannot be written — the league filled in the meantime, say —
// the debit is reversed under the same reference. A short balance fails before
// any row exists, so there is nothing to clean up.
func (s *FantasyLeagueService) joinPaidLeagueWithWallet(ctx context.Context, league *domain.FantasyLeague, team *domain.FantasyTeam, userID string) (*dto.JoinLeagueResponse, error) {
	if s.wallet == nil {
		return nil, errors.New("paying from your wallet is not available right now")
	}

	// One wallet join per (league, user) at a time. Every attempt draws its own
	// payment reference, so two simultaneous requests (a double click) would
	// otherwise each pass the "already a member" check and each take the fee.
	lockKey := league.ID + "|" + userID
	mu, _ := s.walletJoinLocks.LoadOrStore(lockKey, &sync.Mutex{})
	lock := mu.(*sync.Mutex)
	lock.Lock()
	defer lock.Unlock()

	// Re-check under the lock: a request that was queued behind another one finds
	// the membership already paid and must not charge again.
	existing, _ := s.repo.GetMember(ctx, league.ID, userID)
	if existing != nil && (existing.PaymentStatus == domain.LeaguePaymentFree || existing.PaymentStatus == domain.LeaguePaymentPaid) {
		return &dto.JoinLeagueResponse{LeagueID: league.ID, LeagueName: league.Name}, nil
	}

	// An earlier card attempt for this same league may still be settling (a bank
	// transfer, a Paystack tab left open). Its reference stays on the membership so
	// that late payment can still be matched; and if it has in fact succeeded, the
	// manager is already in and must not be charged a second time.
	var keepRef *string
	if existing != nil && existing.PaystackReference != nil && !strings.HasPrefix(*existing.PaystackReference, "FNTW-") {
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
				return &dto.JoinLeagueResponse{LeagueID: league.ID, LeagueName: league.Name}, nil
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
	ref := fmt.Sprintf("FNTW-%d-%s", time.Now().Unix(), suffix)
	memberRef := &ref
	if keepRef != nil {
		memberRef = keepRef
	}
	amount := int64(league.EntryFee)
	description := "Fantasy league entry: " + league.Name

	paid, err := s.wallet.Pay(ctx, userID, amount, ref, description)
	if err != nil {
		if errors.Is(err, ports.ErrWalletInsufficient) {
			return nil, err
		}
		return nil, fmt.Errorf("could not take the entry fee from your wallet: %w", err)
	}
	if !paid {
		// A fresh reference was already paid: something is badly wrong, and
		// refunding could hand back money this call never took.
		return nil, errors.New("this wallet payment was already recorded; check your leagues before trying again")
	}

	member := &domain.FantasyLeagueMember{
		LeagueID:          league.ID,
		UserID:            userID,
		TeamID:            team.ID,
		PaymentStatus:     domain.LeaguePaymentPaid,
		PaystackReference: memberRef,
	}
	if err := s.repo.AddMember(ctx, member); err != nil {
		if _, rerr := s.wallet.Refund(ctx, userID, amount, ref, "Refund: could not join "+league.Name); rerr != nil {
			return nil, fmt.Errorf("could not join the league (%w) and the wallet refund for %s also failed: %v", err, ref, rerr)
		}
		if errors.Is(err, ports.ErrLeagueFull) {
			return nil, err
		}
		return nil, fmt.Errorf("failed to register league membership: %w", err)
	}

	return &dto.JoinLeagueResponse{
		LeagueID:       league.ID,
		LeagueName:     league.Name,
		PaidFromWallet: true,
	}, nil
}
