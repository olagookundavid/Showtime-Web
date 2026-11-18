package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"
)

const (
	// App setting keys for the top-up limits, in kobo. Unset or malformed values
	// fall back to the domain defaults.
	SettingWalletMinTopup   = "wallet_min_topup_kobo"
	SettingWalletMaxTopup   = "wallet_max_topup_kobo"
	SettingWalletMaxBalance = "wallet_max_balance_kobo"

	walletRecentEntries = 50

	// pendingTopupWindow is how far back unpaid top-ups count against the maximum
	// balance. Paystack checkouts and bank transfers settle well within it.
	pendingTopupWindow = 2 * time.Hour
)

// errTopupPaymentFailed marks a top-up Paystack says did not succeed: a result,
// not a fault, so neither the webhook nor the browser needs to retry it.
var errTopupPaymentFailed = errors.New("payment not successful")

// Errors a caller can show the user as they are.
var (
	ErrTopupAmount   = errors.New("top-up amount is outside the allowed range")
	ErrWalletFull    = errors.New("this top-up would take your wallet over its maximum balance")
	ErrTopupNotFound = errors.New("top-up not found")
	ErrAdjustReason  = errors.New("a reason is required for a wallet adjustment")
	ErrAdjustAmount  = errors.New("an adjustment must move some money")
	// ErrTopupPending is returned when unpaid top-ups started recently would take
	// the wallet over its maximum balance if they all went through.
	ErrTopupPending = errors.New("you have top-ups still waiting for payment; finish or wait for those first")

	ErrWalletUserNotFound = errors.New("user not found")
)

// What the wallet needs from the rest of the app, kept small so each can be faked.
type (
	walletPaystack interface {
		InitializeTransaction(req PaystackInitRequest) (*PaystackInitResponse, error)
		VerifyTransaction(reference string) (*PaystackVerifyResponse, error)
	}
	walletUsers interface {
		GetUserByID(ctx context.Context, id string) (*domain.User, error)
		ListUsers(ctx context.Context, page, limit int, searchFilter string, roleFilter string) ([]domain.User, int, error)
	}
	walletSettings interface {
		Get(ctx context.Context, key string) (string, error)
	}
)

type IWalletService interface {
	GetWallet(ctx context.Context, userID string) (*dto.SpendWalletResponse, error)
	StartTopup(ctx context.Context, userID string, amountKobo int64, callbackURL string) (*dto.TopupInitResponse, error)
	// VerifyTopup is the browser coming back from Paystack: it checks the payment
	// and credits the wallet. userID must own the top-up.
	VerifyTopup(ctx context.Context, userID, reference string) (*dto.TopupResponse, error)
	// HandleWebhook is Paystack telling us a charge succeeded.
	HandleWebhook(ctx context.Context, reference string) error

	AdminSearchUsers(ctx context.Context, search string) ([]dto.WalletUser, error)
	AdminGetWallet(ctx context.Context, userID string) (*dto.AdminWalletResponse, error)
	AdminAdjust(ctx context.Context, userID string, amountKobo int64, reason, staffID string) (*domain.LedgerEntry, error)

	WalletSpender
}

// WalletSpender is what the rest of the app (tickets, store, league entry) needs
// to take payment from a wallet. Both calls are idempotent on reference, so a
// retried request or a duplicate webhook can never charge or refund twice.
type WalletSpender interface {
	// Pay debits amountKobo for the thing named by reference (e.g. an order
	// reference). paid is false when this reference was already paid. A wallet
	// that holds less than the amount fails with ports.ErrWalletInsufficient.
	Pay(ctx context.Context, userID string, amountKobo int64, reference, description string) (paid bool, err error)
	// Refund puts back what Pay took for the same reference. It does nothing when
	// the reference was never paid from the wallet, or was already refunded.
	Refund(ctx context.Context, userID string, amountKobo int64, reference, description string) (refunded bool, err error)
}

type WalletService struct {
	repo     ports.IWalletRepository
	paystack walletPaystack
	users    walletUsers
	settings walletSettings
	email    ports.EmailService
}

func NewWalletService(repo ports.IWalletRepository, paystack walletPaystack, users walletUsers, settings walletSettings) *WalletService {
	return &WalletService{repo: repo, paystack: paystack, users: users, settings: settings}
}

// WithEmail turns on the top-up receipt email.
func (s *WalletService) WithEmail(e ports.EmailService) *WalletService {
	s.email = e
	return s
}

// limit reads a kobo setting, or fallback when it is unset, malformed or not positive.
func (s *WalletService) limit(ctx context.Context, key string, fallback int64) int64 {
	if s.settings == nil {
		return fallback
	}
	raw, err := s.settings.Get(ctx, key)
	if err != nil {
		return fallback
	}
	v, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func (s *WalletService) limits(ctx context.Context) (min, max, maxBalance int64) {
	min = s.limit(ctx, SettingWalletMinTopup, domain.DefaultMinTopupKobo)
	max = s.limit(ctx, SettingWalletMaxTopup, domain.DefaultMaxTopupKobo)
	maxBalance = s.limit(ctx, SettingWalletMaxBalance, domain.DefaultMaxBalanceKobo)
	return
}

func (s *WalletService) view(ctx context.Context, userID string) (*dto.SpendWalletResponse, error) {
	w, err := s.repo.GetWallet(ctx, userID)
	if err != nil {
		return nil, err
	}
	entries, err := s.repo.ListEntries(ctx, userID, walletRecentEntries)
	if err != nil {
		return nil, err
	}
	min, max, maxBalance := s.limits(ctx)
	return &dto.SpendWalletResponse{
		BalanceKobo:    w.BalanceKobo,
		MinTopupKobo:   min,
		MaxTopupKobo:   max,
		MaxBalanceKobo: maxBalance,
		Transactions:   entries,
	}, nil
}

func (s *WalletService) GetWallet(ctx context.Context, userID string) (*dto.SpendWalletResponse, error) {
	return s.view(ctx, userID)
}

func walletUserName(u *domain.User) string {
	if name := strings.TrimSpace(u.FullName); name != "" {
		return name
	}
	return strings.TrimSpace(u.FirstName + " " + u.LastName)
}

func (s *WalletService) AdminGetWallet(ctx context.Context, userID string) (*dto.AdminWalletResponse, error) {
	user, err := s.users.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, ErrWalletUserNotFound
	}
	view, err := s.view(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &dto.AdminWalletResponse{
		User:                dto.WalletUser{ID: user.ID, Name: walletUserName(user), Email: user.Email},
		SpendWalletResponse: *view,
	}, nil
}

// AdminSearchUsers finds accounts by name or email so staff can open a wallet. It
// needs a few characters, so it cannot be used to list every user.
func (s *WalletService) AdminSearchUsers(ctx context.Context, search string) ([]dto.WalletUser, error) {
	search = strings.TrimSpace(search)
	if len(search) < 3 {
		return []dto.WalletUser{}, nil
	}
	users, _, err := s.users.ListUsers(ctx, 1, 20, search, "")
	if err != nil {
		return nil, err
	}
	out := make([]dto.WalletUser, 0, len(users))
	for i := range users {
		out = append(out, dto.WalletUser{ID: users[i].ID, Name: walletUserName(&users[i]), Email: users[i].Email})
	}
	return out, nil
}

// generateTopupReference makes a Paystack reference like WLT-7K2M9QXA. The
// alphabet leaves out look-alike characters (0/O, 1/I).
func generateTopupReference() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 8)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		b[i] = chars[n.Int64()]
	}
	return "WLT-" + string(b)
}

func (s *WalletService) StartTopup(ctx context.Context, userID string, amountKobo int64, callbackURL string) (*dto.TopupInitResponse, error) {
	min, max, maxBalance := s.limits(ctx)
	if amountKobo < min || amountKobo > max {
		return nil, fmt.Errorf("%w: between ₦%d and ₦%d", ErrTopupAmount, min/100, max/100)
	}
	w, err := s.repo.GetWallet(ctx, userID)
	if err != nil {
		return nil, err
	}
	if w.BalanceKobo+amountKobo > maxBalance {
		return nil, fmt.Errorf("%w (₦%d)", ErrWalletFull, maxBalance/100)
	}
	// Unpaid top-ups started recently count too: otherwise several checkouts
	// started back to back would each pass this check and all be paid.
	pending, err := s.repo.PendingTopupsKobo(ctx, userID, time.Now().Add(-pendingTopupWindow))
	if err != nil {
		return nil, err
	}
	if w.BalanceKobo+pending+amountKobo > maxBalance {
		return nil, ErrTopupPending
	}
	user, err := s.users.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, ErrWalletUserNotFound
	}

	reference := generateTopupReference()
	resp, err := s.paystack.InitializeTransaction(PaystackInitRequest{
		Email:       user.Email,
		Amount:      int(amountKobo),
		Reference:   reference,
		CallbackURL: callbackURL,
	})
	if err != nil {
		return nil, fmt.Errorf("could not start the payment: %w", err)
	}

	accessCode := resp.Data.AccessCode
	topup := &domain.Topup{
		UserID:             userID,
		AmountKobo:         amountKobo,
		PaystackReference:  reference,
		PaystackAccessCode: &accessCode,
	}
	if err := s.repo.CreateTopup(ctx, topup); err != nil {
		return nil, fmt.Errorf("could not record the top-up: %w", err)
	}
	return &dto.TopupInitResponse{Reference: reference, AuthorizationURL: resp.Data.AuthorizationURL}, nil
}

// verifyTopupPayment is the money check before the wallet is credited. A
// "success" status alone is not enough: the amount charged must cover the top-up
// and the currency must be naira, or an underpaid transaction would credit in full.
func verifyTopupPayment(resp *PaystackVerifyResponse, topup *domain.Topup) error {
	if resp == nil || resp.Data.Status != "success" {
		return errTopupPaymentFailed
	}
	if int64(resp.Data.Amount) < topup.AmountKobo {
		return fmt.Errorf("payment amount mismatch: charged %d kobo, expected %d kobo", resp.Data.Amount, topup.AmountKobo)
	}
	if resp.Data.Currency != "NGN" {
		return fmt.Errorf("unexpected payment currency %q", resp.Data.Currency)
	}
	return nil
}

// settle asks Paystack about a top-up and credits the wallet if it was paid.
// Whoever gets here first credits it; everyone after sees it already PAID.
func (s *WalletService) settle(ctx context.Context, topup *domain.Topup) (*domain.Topup, error) {
	if topup.Status == domain.TopupPaid {
		return topup, nil // already credited; a retry changes nothing
	}
	resp, err := s.paystack.VerifyTransaction(topup.PaystackReference)
	if err != nil {
		return nil, fmt.Errorf("failed to verify transaction: %w", err)
	}
	if err := verifyTopupPayment(resp, topup); err != nil {
		// Still open (a bank transfer can take minutes): leave it PENDING.
		if paystackStillOpen(resp) {
			return topup, nil
		}
		if markErr := s.repo.MarkTopupFailed(ctx, topup.PaystackReference); markErr != nil {
			return nil, markErr
		}
		topup.Status = domain.TopupFailed
		return topup, fmt.Errorf("%w: %v", errTopupPaymentFailed, err)
	}

	settled, credited, err := s.repo.SettleTopup(ctx, topup.PaystackReference)
	if err != nil {
		return nil, err
	}
	if credited {
		s.sendReceipt(ctx, settled)
		// The money is already taken, so the credit can't be refused; but a wallet
		// over its limit should be looked at.
		if _, _, maxBalance := s.limits(ctx); maxBalance > 0 {
			if w, err := s.repo.GetWallet(ctx, settled.UserID); err == nil && w.BalanceKobo > maxBalance {
				fmt.Printf("⚠️ WARNING: wallet of user %s is over its maximum balance after top-up %s (%d > %d kobo)\n",
					settled.UserID, settled.PaystackReference, w.BalanceKobo, maxBalance)
			}
		}
	}
	return settled, nil
}

func (s *WalletService) HandleWebhook(ctx context.Context, reference string) error {
	topup, err := s.repo.GetTopupByReference(ctx, reference)
	if err != nil {
		return err
	}
	if topup == nil {
		return fmt.Errorf("%w: %s", ErrTopupNotFound, reference)
	}
	_, err = s.settle(ctx, topup)
	// A payment Paystack says failed is not something to retry the webhook for.
	// Any other error (Paystack or the database unreachable) is, even when the
	// stored row says FAILED from an earlier attempt: the retry may credit it.
	if errors.Is(err, errTopupPaymentFailed) {
		return nil
	}
	return err
}

func (s *WalletService) VerifyTopup(ctx context.Context, userID, reference string) (*dto.TopupResponse, error) {
	topup, err := s.repo.GetTopupByReference(ctx, reference)
	if err != nil {
		return nil, err
	}
	// Not found and not yours look the same, so references cannot be probed.
	if topup == nil || topup.UserID != userID {
		return nil, ErrTopupNotFound
	}

	settled, settleErr := s.settle(ctx, topup)
	if settled == nil {
		return nil, settleErr
	}
	w, err := s.repo.GetWallet(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := &dto.TopupResponse{
		Reference:   settled.PaystackReference,
		AmountKobo:  settled.AmountKobo,
		Status:      settled.Status,
		BalanceKobo: w.BalanceKobo,
	}
	// A failed payment is a result to show, not a server error.
	if errors.Is(settleErr, errTopupPaymentFailed) {
		return out, nil
	}
	return out, settleErr
}

func (s *WalletService) AdminAdjust(ctx context.Context, userID string, amountKobo int64, reason, staffID string) (*domain.LedgerEntry, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, ErrAdjustReason
	}
	if amountKobo == 0 {
		return nil, ErrAdjustAmount
	}
	if user, err := s.users.GetUserByID(ctx, userID); err != nil || user == nil {
		return nil, ErrWalletUserNotFound
	}
	return s.repo.Apply(ctx, domain.LedgerEntry{
		UserID:          userID,
		AmountKobo:      amountKobo,
		Type:            domain.LedgerAdjustment,
		Description:     reason,
		CreatedByUserID: &staffID,
	})
}

// sendReceipt emails the top-up receipt in the background. A failure to send
// never undoes a credit that has already been made.
func (s *WalletService) sendReceipt(ctx context.Context, topup *domain.Topup) {
	if s.email == nil || topup == nil {
		return
	}
	user, err := s.users.GetUserByID(ctx, topup.UserID)
	if err != nil || user == nil || user.Email == "" {
		return
	}
	w, err := s.repo.GetWallet(ctx, topup.UserID)
	if err != nil {
		return
	}
	name := strings.TrimSpace(user.FirstName)
	if name == "" {
		name = strings.TrimSpace(user.FullName)
	}
	if name == "" {
		name = "there"
	}
	html := email.TopupReceiptEmailHTML(name, topup.AmountKobo, w.BalanceKobo, topup.PaystackReference)
	to := user.Email
	_ = SubmitJob(func() {
		if err := s.email.SendEmail(to, "Your Showtime wallet top-up", html); err != nil {
			fmt.Printf("⚠️ WARNING: wallet top-up receipt to %s failed: %s\n", to, err.Error())
		}
	})
}

func (s *WalletService) Pay(ctx context.Context, userID string, amountKobo int64, reference, description string) (bool, error) {
	reference = strings.TrimSpace(reference)
	if amountKobo <= 0 || reference == "" {
		return false, errors.New("a wallet payment needs an amount and a reference")
	}
	_, applied, err := s.repo.ApplyOnce(ctx, domain.LedgerEntry{
		UserID:      userID,
		AmountKobo:  -amountKobo,
		Type:        domain.LedgerPurchase,
		Reference:   &reference,
		Description: description,
	})
	return applied, err
}

func (s *WalletService) Refund(ctx context.Context, userID string, amountKobo int64, reference, description string) (bool, error) {
	reference = strings.TrimSpace(reference)
	if amountKobo <= 0 || reference == "" {
		return false, errors.New("a wallet refund needs an amount and a reference")
	}
	// Only refund what was actually taken from the wallet, and only to the person
	// it was taken from. The caller's amount and user are never trusted beyond that:
	// a refund can't exceed the payment or land in another account.
	paid, err := s.repo.FindEntry(ctx, domain.LedgerPurchase, reference)
	if err != nil || paid == nil {
		return false, err
	}
	userID = paid.UserID
	if taken := -paid.AmountKobo; amountKobo > taken {
		amountKobo = taken
	}
	refRef := "REFUND-" + reference
	_, applied, err := s.repo.ApplyOnce(ctx, domain.LedgerEntry{
		UserID:      userID,
		AmountKobo:  amountKobo,
		Type:        domain.LedgerRefund,
		Reference:   &refRef,
		Description: description,
	})
	return applied, err
}
