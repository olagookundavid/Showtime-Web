package services

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// walletJoinLeagueRepo is a league repo that keeps memberships and one manager's
// wallet the way the real repository does: under one lock (standing in for the
// league row lock), it refuses a full league, turns away an existing member, and
// writes the membership and the debit together or not at all.
type walletJoinLeagueRepo struct {
	ports.IFantasyLeagueRepository
	mu       sync.Mutex
	league   *domain.FantasyLeague
	addErr   error
	balance  int64
	debits   []domain.LedgerEntry
	members  []domain.FantasyLeagueMember
	existing *domain.FantasyLeagueMember // the manager's row, if any
}

func (f *walletJoinLeagueRepo) GetLeagueByID(_ context.Context, _ string) (*domain.FantasyLeague, error) {
	return f.league, nil
}

func (f *walletJoinLeagueRepo) GetMember(_ context.Context, _, _ string) (*domain.FantasyLeagueMember, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.existing == nil {
		return nil, nil
	}
	m := *f.existing
	return &m, nil
}

func (f *walletJoinLeagueRepo) HasForfeitedEntry(_ context.Context, _, _ string) (bool, error) {
	return false, nil
}

func (f *walletJoinLeagueRepo) CountActiveMembers(_ context.Context, _ string) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.members), nil
}

func (f *walletJoinLeagueRepo) add(m *domain.FantasyLeagueMember, debit *domain.LedgerEntry) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.addErr != nil {
		return f.addErr
	}
	if debit != nil && f.existing != nil &&
		(f.existing.PaymentStatus == domain.LeaguePaymentPaid || f.existing.PaymentStatus == domain.LeaguePaymentFree) {
		return ports.ErrAlreadyLeagueMember
	}
	if f.existing == nil && f.league.MaxMembers > 0 && len(f.members) >= f.league.MaxMembers {
		return ports.ErrLeagueFull
	}
	if debit != nil {
		if f.balance+debit.AmountKobo < 0 {
			return ports.ErrWalletInsufficient
		}
		f.balance += debit.AmountKobo
		f.debits = append(f.debits, *debit)
	}
	cp := *m
	if f.existing != nil && cp.PaystackReference == nil {
		cp.PaystackReference = f.existing.PaystackReference
	}
	f.existing = &cp
	f.members = append(f.members, cp)
	return nil
}

func (f *walletJoinLeagueRepo) AddMember(_ context.Context, m *domain.FantasyLeagueMember) error {
	return f.add(m, nil)
}

func (f *walletJoinLeagueRepo) AddMemberPaidFromWallet(_ context.Context, m *domain.FantasyLeagueMember, debit domain.LedgerEntry) error {
	return f.add(m, &debit)
}

type walletJoinFantasyRepo struct {
	ports.IFantasyRepository
}

func (walletJoinFantasyRepo) GetTeamByUserAndSeason(_ context.Context, _, _ string) (*domain.FantasyTeam, error) {
	return &domain.FantasyTeam{ID: "team-1"}, nil
}

// fakeSpender switches wallet payment on. League entry takes the fee inside the
// membership's own transaction, so Pay and Refund must never be called.
type fakeSpender struct{ calls int }

func (f *fakeSpender) Pay(context.Context, string, int64, string, string) (bool, error) {
	f.calls++
	return false, errors.New("league entry must not call Pay")
}

func (f *fakeSpender) Refund(context.Context, string, int64, string, string) (bool, error) {
	f.calls++
	return false, errors.New("league entry must not call Refund")
}

func walletJoinSetup(entryFee int) (*FantasyLeagueService, *walletJoinLeagueRepo, *fakeSpender) {
	league := &domain.FantasyLeague{
		ID: "league-1", SeasonID: "season-1", Name: "Cash League",
		Type: domain.LeagueTypePublic, EntryFee: entryFee, MaxMembers: 10,
	}
	repo := &walletJoinLeagueRepo{league: league, balance: 500_000}
	spender := &fakeSpender{}
	// No Paystack client and no auth repo: a wallet join must never need either,
	// so reaching for one would nil-panic and fail the test.
	svc := &FantasyLeagueService{repo: repo, fantasyRepo: walletJoinFantasyRepo{}}
	svc.WithWallet(spender)
	return svc, repo, spender
}

func walletJoinReq() dto.JoinLeagueRequest {
	return dto.JoinLeagueRequest{LeagueID: "league-1", PayWithWallet: true}
}

func TestJoinLeagueWithWallet_PaysOnceAndConfirms(t *testing.T) {
	svc, repo, spender := walletJoinSetup(100000)

	res, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if err != nil {
		t.Fatalf("JoinLeague: %v", err)
	}
	if !res.PaidFromWallet || res.PaystackURL != "" || res.PaystackRef != "" {
		t.Fatalf("response should be confirmed with no Paystack step, got %+v", res)
	}
	if len(repo.debits) != 1 || repo.debits[0].AmountKobo != -100000 || repo.debits[0].UserID != "user-1" {
		t.Fatalf("expected one debit of 100000 kobo, got %+v", repo.debits)
	}
	if len(repo.members) != 1 {
		t.Fatalf("expected one membership, got %d", len(repo.members))
	}
	m := repo.members[0]
	if m.PaymentStatus != domain.LeaguePaymentPaid {
		t.Errorf("membership status = %s, want PAID so the prize pool counts it", m.PaymentStatus)
	}
	if m.PaystackReference == nil || *m.PaystackReference != *repo.debits[0].Reference {
		t.Errorf("a new membership carries the wallet reference, got %v", m.PaystackReference)
	}
	if spender.calls != 0 {
		t.Error("the wallet service must not be called directly")
	}
}

func TestJoinLeagueWithWallet_InsufficientLeavesNoMembership(t *testing.T) {
	svc, repo, _ := walletJoinSetup(100000)
	repo.balance = 99_999

	_, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want ErrWalletInsufficient", err)
	}
	if len(repo.members) != 0 || len(repo.debits) != 0 {
		t.Errorf("no membership and no charge expected")
	}
}

func TestJoinLeagueWithWallet_FailureChargesNothing(t *testing.T) {
	svc, repo, _ := walletJoinSetup(100000)
	repo.addErr = errors.New("database is down")

	if _, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq()); err == nil {
		t.Fatal("the failure should be returned")
	}
	if len(repo.debits) != 0 || repo.balance != 500_000 {
		t.Error("a failed join must leave the wallet untouched")
	}
}

func TestJoinLeagueWithWallet_FullLeagueNeverDebits(t *testing.T) {
	svc, repo, _ := walletJoinSetup(100000)
	repo.league.MaxMembers = 1
	repo.members = []domain.FantasyLeagueMember{{UserID: "someone-else"}}

	_, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if !errors.Is(err, ports.ErrLeagueFull) {
		t.Fatalf("err = %v, want ErrLeagueFull", err)
	}
	if len(repo.debits) != 0 {
		t.Errorf("a full league must be refused without a debit")
	}
}

func TestJoinLeagueWithWallet_FreeLeagueUnaffected(t *testing.T) {
	svc, repo, _ := walletJoinSetup(0)

	res, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if err != nil {
		t.Fatalf("JoinLeague: %v", err)
	}
	if res.PaidFromWallet || len(repo.debits) != 0 {
		t.Errorf("a free league must never touch the wallet")
	}
	if len(repo.members) != 1 || repo.members[0].PaymentStatus != domain.LeaguePaymentFree {
		t.Errorf("expected one FREE membership, got %+v", repo.members)
	}
}

func TestJoinLeagueWithWallet_NotWiredIsRefused(t *testing.T) {
	svc, repo, _ := walletJoinSetup(100000)
	svc.wallet = nil

	if _, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq()); err == nil {
		t.Fatal("expected an error when the wallet is not wired")
	}
	if len(repo.members) != 0 {
		t.Errorf("no membership should be created")
	}
}

// A double click sends two joins at once. Only one may take the fee; the other
// finds the membership and succeeds without paying.
func TestJoinLeagueWithWallet_ConcurrentJoinsChargeOnce(t *testing.T) {
	svc, repo, _ := walletJoinSetup(100000)

	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq()); err != nil {
				t.Errorf("JoinLeague: %v", err)
			}
		}()
	}
	wg.Wait()

	if len(repo.debits) != 1 {
		t.Fatalf("fee was taken %d times, want 1", len(repo.debits))
	}
}

// An earlier card attempt that is still settling keeps its reference, so a late
// Paystack success can still be matched to the membership.
func TestJoinLeagueWithWallet_KeepsEarlierCardReference(t *testing.T) {
	svc, repo, _ := walletJoinSetup(100000)
	cardRef := "FNT-1700000000-ABC"
	repo.existing = &domain.FantasyLeagueMember{
		ID: "m1", LeagueID: "league-1", UserID: "user-1",
		PaymentStatus: domain.LeaguePaymentPending, PaystackReference: &cardRef,
	}

	// No Paystack client: the verification step is skipped, the reference rule is what is under test.
	if _, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq()); err != nil {
		t.Fatalf("JoinLeague: %v", err)
	}
	got := repo.existing
	if got.PaystackReference == nil || *got.PaystackReference != cardRef {
		t.Fatalf("card reference was replaced: %v", got.PaystackReference)
	}
	if got.PaymentStatus != domain.LeaguePaymentPaid || len(repo.debits) != 1 {
		t.Fatalf("status=%s debits=%d, want PAID and 1", got.PaymentStatus, len(repo.debits))
	}
	if *repo.debits[0].Reference != walletRefForCard(cardRef) {
		t.Fatalf("ledger reference = %s, want %s so a late card payment can find it", *repo.debits[0].Reference, walletRefForCard(cardRef))
	}
}

// refundingSpender is a wallet that remembers what each reference paid and
// whether it was refunded, the way WalletService does.
type refundingSpender struct {
	mu       sync.Mutex
	paid     map[string]int64
	refunded map[string]bool
	refunds  int
}

func (f *refundingSpender) Pay(context.Context, string, int64, string, string) (bool, error) {
	return false, errors.New("not used")
}

func (f *refundingSpender) Refund(_ context.Context, _ string, _ int64, ref, _ string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.paid[ref] == 0 || f.refunded[ref] {
		return false, nil
	}
	f.refunded[ref] = true
	f.refunds++
	return true, nil
}

func (f *refundingSpender) UnrefundedPaymentKobo(_ context.Context, ref string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.refunded[ref] {
		return 0, nil
	}
	return f.paid[ref], nil
}

// stubPaystack answers every verify with the given status and amount, and
// counts the calls.
func stubPaystack(t *testing.T, status string, amount int) (*PaystackClient, *atomic.Int32) {
	t.Helper()
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = fmt.Fprintf(w, `{"status":true,"data":{"status":%q,"amount":%d,"currency":"NGN"}}`, status, amount)
	}))
	t.Cleanup(srv.Close)
	return &PaystackClient{secretKey: "sk_test", baseURL: srv.URL, client: srv.Client()}, &calls
}

func paidMemberWithCard(cardRef string) *domain.FantasyLeagueMember {
	return &domain.FantasyLeagueMember{
		ID: "m1", LeagueID: "league-1", UserID: "user-1",
		PaymentStatus: domain.LeaguePaymentPaid, PaystackReference: &cardRef,
	}
}

// A manager joins with the wallet while a card attempt is open, then the card
// payment goes through as well. The wallet payment is refunded once, however
// many times the confirmation arrives.
func TestLateCardPaymentRefundsTheWalletEntry(t *testing.T) {
	cardRef := "FNT-1700000000-ABC"
	spender := &refundingSpender{paid: map[string]int64{walletRefForCard(cardRef): 100000}, refunded: map[string]bool{}}
	ps, calls := stubPaystack(t, "success", 100000)
	svc := &FantasyLeagueService{paystackClient: ps}
	svc.WithWallet(spender)

	for i := 0; i < 3; i++ { // webhook, its retry, and the browser confirm
		if err := svc.verifyPayment(context.Background(), paidMemberWithCard(cardRef), cardRef); err != nil {
			t.Fatalf("verifyPayment: %v", err)
		}
	}
	if spender.refunds != 1 {
		t.Fatalf("wallet refunded %d times, want 1", spender.refunds)
	}
	if calls.Load() != 1 {
		t.Fatalf("Paystack asked %d times, want 1 (once refunded, no further checks)", calls.Load())
	}
}

// A card attempt that never completed leaves the wallet payment alone.
func TestUnpaidCardAttemptKeepsTheWalletEntry(t *testing.T) {
	cardRef := "FNT-1700000000-DEF"
	spender := &refundingSpender{paid: map[string]int64{walletRefForCard(cardRef): 100000}, refunded: map[string]bool{}}
	ps, _ := stubPaystack(t, "abandoned", 0)
	svc := &FantasyLeagueService{paystackClient: ps}
	svc.WithWallet(spender)

	if err := svc.verifyPayment(context.Background(), paidMemberWithCard(cardRef), cardRef); err != nil {
		t.Fatalf("verifyPayment: %v", err)
	}
	if spender.refunds != 0 {
		t.Fatal("the wallet was refunded although the card was never charged")
	}
}

// An ordinary card member has no wallet payment, so a repeat confirmation does
// not reach Paystack at all.
func TestPaidCardMemberWithoutWalletEntryIsUntouched(t *testing.T) {
	cardRef := "FNT-1700000000-GHI"
	spender := &refundingSpender{paid: map[string]int64{}, refunded: map[string]bool{}}
	ps, calls := stubPaystack(t, "success", 100000)
	svc := &FantasyLeagueService{paystackClient: ps}
	svc.WithWallet(spender)

	if err := svc.verifyPayment(context.Background(), paidMemberWithCard(cardRef), cardRef); err != nil {
		t.Fatalf("verifyPayment: %v", err)
	}
	if spender.refunds != 0 || calls.Load() != 0 {
		t.Fatalf("refunds=%d paystack calls=%d, want 0 and 0", spender.refunds, calls.Load())
	}
}
