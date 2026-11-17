package services

import (
	"context"
	"errors"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

// fakeWalletRepo models what the real repository guarantees: a top-up settles
// once, the ledger is append-only, and a balance cannot go negative.
type fakeWalletRepo struct {
	balance map[string]int64
	topups  map[string]*domain.Topup
	entries []domain.LedgerEntry
}

func newFakeWalletRepo() *fakeWalletRepo {
	return &fakeWalletRepo{balance: map[string]int64{}, topups: map[string]*domain.Topup{}}
}

func (r *fakeWalletRepo) GetWallet(_ context.Context, userID string) (*domain.Wallet, error) {
	return &domain.Wallet{UserID: userID, BalanceKobo: r.balance[userID]}, nil
}
func (r *fakeWalletRepo) ListEntries(_ context.Context, userID string, _ int) ([]domain.LedgerEntry, error) {
	out := []domain.LedgerEntry{}
	for _, e := range r.entries {
		if e.UserID == userID {
			out = append(out, e)
		}
	}
	return out, nil
}
func (r *fakeWalletRepo) CreateTopup(_ context.Context, t *domain.Topup) error {
	t.Status = domain.TopupPending
	cp := *t
	r.topups[t.PaystackReference] = &cp
	return nil
}
func (r *fakeWalletRepo) GetTopupByReference(_ context.Context, ref string) (*domain.Topup, error) {
	t, ok := r.topups[ref]
	if !ok {
		return nil, nil
	}
	cp := *t
	return &cp, nil
}
func (r *fakeWalletRepo) SettleTopup(_ context.Context, ref string) (*domain.Topup, bool, error) {
	t := r.topups[ref]
	if t.Status == domain.TopupPaid {
		cp := *t
		return &cp, false, nil
	}
	t.Status = domain.TopupPaid
	r.balance[t.UserID] += t.AmountKobo
	r.entries = append(r.entries, domain.LedgerEntry{
		UserID: t.UserID, AmountKobo: t.AmountKobo, Type: domain.LedgerTopup, Reference: &ref,
		BalanceAfterKobo: r.balance[t.UserID],
	})
	cp := *t
	return &cp, true, nil
}
func (r *fakeWalletRepo) MarkTopupFailed(_ context.Context, ref string) error {
	if t := r.topups[ref]; t != nil && t.Status == domain.TopupPending {
		t.Status = domain.TopupFailed
	}
	return nil
}
func (r *fakeWalletRepo) Apply(_ context.Context, e domain.LedgerEntry) (*domain.LedgerEntry, error) {
	if r.balance[e.UserID]+e.AmountKobo < 0 {
		return nil, ports.ErrWalletInsufficient
	}
	r.balance[e.UserID] += e.AmountKobo
	e.BalanceAfterKobo = r.balance[e.UserID]
	r.entries = append(r.entries, e)
	return &e, nil
}

func (r *fakeWalletRepo) FindEntry(_ context.Context, t domain.LedgerType, ref string) (*domain.LedgerEntry, error) {
	for i := range r.entries {
		e := r.entries[i]
		if e.Type == t && e.Reference != nil && *e.Reference == ref {
			return &e, nil
		}
	}
	return nil, nil
}

func (r *fakeWalletRepo) ApplyOnce(ctx context.Context, e domain.LedgerEntry) (*domain.LedgerEntry, bool, error) {
	if e.Reference != nil {
		if found, _ := r.FindEntry(ctx, e.Type, *e.Reference); found != nil {
			return found, false, nil
		}
	}
	out, err := r.Apply(ctx, e)
	return out, err == nil, err
}

type fakeWalletPaystack struct {
	initCalls int
	verify    *PaystackVerifyResponse
}

func (p *fakeWalletPaystack) InitializeTransaction(req PaystackInitRequest) (*PaystackInitResponse, error) {
	p.initCalls++
	var resp PaystackInitResponse
	resp.Data.AuthorizationURL = "https://paystack.test/pay/" + req.Reference
	resp.Data.AccessCode = "ac_test"
	return &resp, nil
}
func (p *fakeWalletPaystack) VerifyTransaction(string) (*PaystackVerifyResponse, error) {
	return p.verify, nil
}

type fakeWalletUsers struct{}

func (fakeWalletUsers) GetUserByID(_ context.Context, id string) (*domain.User, error) {
	return &domain.User{ID: id, Email: id + "@example.com", FirstName: "Ada"}, nil
}

func (fakeWalletUsers) ListUsers(_ context.Context, _, _ int, search, _ string) ([]domain.User, int, error) {
	return []domain.User{{ID: "u1", FullName: "Ada Obi", Email: "ada@example.com"}}, 1, nil
}

type fakeWalletSettings map[string]string

func (s fakeWalletSettings) Get(_ context.Context, key string) (string, error) { return s[key], nil }

func paid(kobo int, currency string) *PaystackVerifyResponse {
	var r PaystackVerifyResponse
	r.Data.Status = "success"
	r.Data.Amount = kobo
	r.Data.Currency = currency
	return &r
}

func walletFixture() (*WalletService, *fakeWalletRepo, *fakeWalletPaystack) {
	repo := newFakeWalletRepo()
	ps := &fakeWalletPaystack{}
	return NewWalletService(repo, ps, fakeWalletUsers{}, fakeWalletSettings{}), repo, ps
}

func startTopup(t *testing.T, s *WalletService, user string, kobo int64) string {
	t.Helper()
	out, err := s.StartTopup(context.Background(), user, kobo, "https://app.test/wallet/confirm")
	if err != nil {
		t.Fatalf("StartTopup: %v", err)
	}
	if !strings.HasPrefix(out.Reference, "WLT-") {
		t.Fatalf("reference %q should start with WLT-", out.Reference)
	}
	return out.Reference
}

func TestTopupRejectsAmountsOutsideLimits(t *testing.T) {
	s, _, ps := walletFixture()
	for name, kobo := range map[string]int64{
		"below the minimum": domain.DefaultMinTopupKobo - 1,
		"above the maximum": domain.DefaultMaxTopupKobo + 1,
		"zero":              0,
		"negative":          -50_000,
	} {
		if _, err := s.StartTopup(context.Background(), "u1", kobo, "cb"); !errors.Is(err, ErrTopupAmount) {
			t.Errorf("%s: err = %v, want ErrTopupAmount", name, err)
		}
	}
	if ps.initCalls != 0 {
		t.Errorf("Paystack was called %d times for amounts that should never get that far", ps.initCalls)
	}
}

func TestTopupHonoursConfiguredLimits(t *testing.T) {
	repo := newFakeWalletRepo()
	s := NewWalletService(repo, &fakeWalletPaystack{}, fakeWalletUsers{}, fakeWalletSettings{
		SettingWalletMinTopup: "100000", // ₦1,000
	})
	if _, err := s.StartTopup(context.Background(), "u1", 50_000, "cb"); !errors.Is(err, ErrTopupAmount) {
		t.Errorf("₦500 under a ₦1,000 minimum: err = %v, want ErrTopupAmount", err)
	}
	if _, err := s.StartTopup(context.Background(), "u1", 100_000, "cb"); err != nil {
		t.Errorf("₦1,000 should be allowed: %v", err)
	}
}

func TestTopupRefusedWhenItWouldExceedMaxBalance(t *testing.T) {
	s, repo, _ := walletFixture()
	repo.balance["u1"] = domain.DefaultMaxBalanceKobo - 10_000
	if _, err := s.StartTopup(context.Background(), "u1", 50_000, "cb"); !errors.Is(err, ErrWalletFull) {
		t.Errorf("err = %v, want ErrWalletFull", err)
	}
}

func TestTopupCreditsExactlyOnceWhenWebhookAndBrowserBothArrive(t *testing.T) {
	s, repo, ps := walletFixture()
	ref := startTopup(t, s, "u1", 100_000)
	ps.verify = paid(100_000, "NGN")

	if err := s.HandleWebhook(context.Background(), ref); err != nil {
		t.Fatalf("webhook: %v", err)
	}
	out, err := s.VerifyTopup(context.Background(), "u1", ref)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if err := s.HandleWebhook(context.Background(), ref); err != nil {
		t.Fatalf("webhook retry: %v", err)
	}

	if repo.balance["u1"] != 100_000 {
		t.Errorf("balance = %d, want 100000 (credited once)", repo.balance["u1"])
	}
	if len(repo.entries) != 1 {
		t.Errorf("ledger has %d entries, want 1", len(repo.entries))
	}
	if out.Status != domain.TopupPaid || out.BalanceKobo != 100_000 {
		t.Errorf("verify response = %+v, want PAID with balance 100000", out)
	}
}

func TestTopupNotCreditedForUnderpaymentOrWrongCurrency(t *testing.T) {
	for name, resp := range map[string]*PaystackVerifyResponse{
		"underpaid":      paid(50_000, "NGN"),
		"wrong currency": paid(100_000, "USD"),
	} {
		s, repo, ps := walletFixture()
		ref := startTopup(t, s, "u1", 100_000)
		ps.verify = resp

		out, err := s.VerifyTopup(context.Background(), "u1", ref)
		if err != nil {
			t.Errorf("%s: a failed payment is a result to show, not an error: %v", name, err)
		}
		if out == nil || out.Status != domain.TopupFailed {
			t.Errorf("%s: status = %+v, want FAILED", name, out)
		}
		if repo.balance["u1"] != 0 || len(repo.entries) != 0 {
			t.Errorf("%s: wallet was credited (%d) for a bad payment", name, repo.balance["u1"])
		}
	}
}

func TestTopupLeftPendingWhilePaystackIsStillOpen(t *testing.T) {
	s, repo, ps := walletFixture()
	ref := startTopup(t, s, "u1", 100_000)
	ps.verify = &PaystackVerifyResponse{}
	ps.verify.Data.Status = "pending"

	out, err := s.VerifyTopup(context.Background(), "u1", ref)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if out.Status != domain.TopupPending {
		t.Errorf("status = %s, want PENDING so the page keeps polling", out.Status)
	}
	if repo.balance["u1"] != 0 {
		t.Error("an unfinished payment must not credit the wallet")
	}
}

func TestFailedPaystackStatusMarksTopupFailed(t *testing.T) {
	s, repo, ps := walletFixture()
	ref := startTopup(t, s, "u1", 100_000)

	ps.verify = &PaystackVerifyResponse{}
	ps.verify.Data.Status = "failed"
	if _, err := s.VerifyTopup(context.Background(), "u1", ref); err != nil {
		t.Fatalf("verify failed payment: %v", err)
	}
	if repo.topups[ref].Status != domain.TopupFailed {
		t.Fatalf("status = %s, want FAILED", repo.topups[ref].Status)
	}
}

func TestVerifyTopupHidesOtherPeoplesTopups(t *testing.T) {
	s, repo, ps := walletFixture()
	ref := startTopup(t, s, "u1", 100_000)
	ps.verify = paid(100_000, "NGN")

	if _, err := s.VerifyTopup(context.Background(), "someone-else", ref); !errors.Is(err, ErrTopupNotFound) {
		t.Errorf("err = %v, want ErrTopupNotFound", err)
	}
	if _, err := s.VerifyTopup(context.Background(), "u1", "WLT-NOSUCH00"); !errors.Is(err, ErrTopupNotFound) {
		t.Errorf("unknown reference: err = %v, want ErrTopupNotFound", err)
	}
	if repo.balance["u1"] != 0 {
		t.Error("someone else's verify call must not credit the wallet")
	}
}

func TestAdminAdjust(t *testing.T) {
	ctx := context.Background()
	s, repo, _ := walletFixture()

	if _, err := s.AdminAdjust(ctx, "u1", 100_000, "  ", "staff1"); !errors.Is(err, ErrAdjustReason) {
		t.Errorf("blank reason: err = %v, want ErrAdjustReason", err)
	}
	if _, err := s.AdminAdjust(ctx, "u1", 0, "nothing", "staff1"); err == nil {
		t.Error("a zero adjustment should be refused")
	}

	e, err := s.AdminAdjust(ctx, "u1", 100_000, "Goodwill credit", "staff1")
	if err != nil {
		t.Fatalf("credit: %v", err)
	}
	if e.CreatedByUserID == nil || *e.CreatedByUserID != "staff1" || e.Type != domain.LedgerAdjustment {
		t.Errorf("entry = %+v, want an ADJUSTMENT recording who made it", e)
	}

	if _, err := s.AdminAdjust(ctx, "u1", -150_000, "Too much", "staff1"); !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Errorf("overdraw: err = %v, want ErrWalletInsufficient", err)
	}
	if repo.balance["u1"] != 100_000 {
		t.Errorf("balance = %d, want 100000 after the refused debit", repo.balance["u1"])
	}
}

func TestAdminSearchUsersNeedsAFewCharacters(t *testing.T) {
	s, _, _ := walletFixture()
	if got, _ := s.AdminSearchUsers(context.Background(), "ad"); len(got) != 0 {
		t.Errorf("two characters returned %d users, want none", len(got))
	}
	got, err := s.AdminSearchUsers(context.Background(), "ada")
	if err != nil || len(got) != 1 || got[0].Email != "ada@example.com" {
		t.Errorf("search = %+v, %v", got, err)
	}
}

func TestGenerateTopupReference(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		ref := generateTopupReference()
		if len(ref) != len("WLT-")+8 || !strings.HasPrefix(ref, "WLT-") {
			t.Fatalf("reference %q is not WLT- plus 8 characters", ref)
		}
		if strings.ContainsAny(ref[4:], "01OI") {
			t.Fatalf("reference %q has an ambiguous character", ref)
		}
		seen[ref] = true
	}
	if len(seen) < 199 {
		t.Errorf("only %d distinct references in 200", len(seen))
	}
}

func TestWallet_PayAndRefundAreIdempotent(t *testing.T) {
	svc, repo, _ := walletFixture()
	repo.balance["u1"] = 10_000
	ctx := context.Background()

	paid, err := svc.Pay(ctx, "u1", 4_000, "ORD-1", "Order")
	if err != nil || !paid {
		t.Fatalf("first pay: paid=%v err=%v", paid, err)
	}
	if paid, err = svc.Pay(ctx, "u1", 4_000, "ORD-1", "Order"); err != nil || paid {
		t.Fatalf("second pay must be a no-op: paid=%v err=%v", paid, err)
	}
	if repo.balance["u1"] != 6_000 {
		t.Fatalf("balance = %d, want 6000 (charged once)", repo.balance["u1"])
	}

	if refunded, err := svc.Refund(ctx, "u1", 4_000, "ORD-1", "Refund"); err != nil || !refunded {
		t.Fatalf("refund: %v %v", refunded, err)
	}
	if refunded, _ := svc.Refund(ctx, "u1", 4_000, "ORD-1", "Refund"); refunded {
		t.Fatal("second refund must be a no-op")
	}
	if repo.balance["u1"] != 10_000 {
		t.Fatalf("balance = %d, want 10000 (refunded once)", repo.balance["u1"])
	}
}

func TestWallet_RefundWithoutPaymentDoesNothing(t *testing.T) {
	svc, repo, _ := walletFixture()
	if refunded, err := svc.Refund(context.Background(), "u1", 500, "NEVER-PAID", "x"); err != nil || refunded {
		t.Fatalf("refunded=%v err=%v", refunded, err)
	}
	if repo.balance["u1"] != 0 {
		t.Fatal("money appeared from nowhere")
	}
}

func TestWallet_PayInsufficientLeavesBalance(t *testing.T) {
	svc, repo, _ := walletFixture()
	repo.balance["u1"] = 100
	if _, err := svc.Pay(context.Background(), "u1", 500, "ORD-2", "x"); !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want insufficient", err)
	}
	if repo.balance["u1"] != 100 {
		t.Fatal("balance changed on a failed payment")
	}
}

func TestWallet_RefundNeverExceedsOrRedirectsThePayment(t *testing.T) {
	svc, repo, _ := walletFixture()
	repo.balance["u1"] = 10_000
	ctx := context.Background()
	if _, err := svc.Pay(ctx, "u1", 3_000, "ORD-9", "order"); err != nil {
		t.Fatal(err)
	}

	// A caller asking for more, and naming someone else, still only returns the
	// 3000 that was taken, to the person it was taken from.
	if ok, err := svc.Refund(ctx, "someone-else", 9_000, "ORD-9", "refund"); err != nil || !ok {
		t.Fatalf("refund: ok=%v err=%v", ok, err)
	}
	if repo.balance["u1"] != 10_000 {
		t.Fatalf("u1 balance = %d, want 10000", repo.balance["u1"])
	}
	if repo.balance["someone-else"] != 0 {
		t.Fatalf("another user was credited %d", repo.balance["someone-else"])
	}
}
