package services

import (
	"context"
	"errors"
	"sync"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// walletJoinLeagueRepo is a league repo that records the memberships it is given.
type walletJoinLeagueRepo struct {
	ports.IFantasyLeagueRepository
	league  *domain.FantasyLeague
	addErr  error
	members []domain.FantasyLeagueMember
}

func (f *walletJoinLeagueRepo) GetLeagueByID(_ context.Context, _ string) (*domain.FantasyLeague, error) {
	return f.league, nil
}

func (f *walletJoinLeagueRepo) GetMember(_ context.Context, _, _ string) (*domain.FantasyLeagueMember, error) {
	return nil, nil
}

func (f *walletJoinLeagueRepo) HasForfeitedEntry(_ context.Context, _, _ string) (bool, error) {
	return false, nil
}

func (f *walletJoinLeagueRepo) CountActiveMembers(_ context.Context, _ string) (int, error) {
	return len(f.members), nil
}

func (f *walletJoinLeagueRepo) AddMember(_ context.Context, m *domain.FantasyLeagueMember) error {
	if f.addErr != nil {
		return f.addErr
	}
	f.members = append(f.members, *m)
	return nil
}

type walletJoinFantasyRepo struct {
	ports.IFantasyRepository
}

func (walletJoinFantasyRepo) GetTeamByUserAndSeason(_ context.Context, _, _ string) (*domain.FantasyTeam, error) {
	return &domain.FantasyTeam{ID: "team-1"}, nil
}

// fakeSpender stands in for the spend wallet: every Pay and Refund is recorded.
type fakeSpender struct {
	mu       sync.Mutex
	payErr   error
	paid     map[string]int64
	refunded map[string]int64
}

func newFakeSpender() *fakeSpender {
	return &fakeSpender{paid: map[string]int64{}, refunded: map[string]int64{}}
}

func (f *fakeSpender) Pay(_ context.Context, _ string, amount int64, ref, _ string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.payErr != nil {
		return false, f.payErr
	}
	if _, done := f.paid[ref]; done {
		return false, nil
	}
	f.paid[ref] = amount
	return true, nil
}

func (f *fakeSpender) Refund(_ context.Context, _ string, amount int64, ref, _ string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.paid[ref]; !ok {
		return false, nil
	}
	if _, done := f.refunded[ref]; done {
		return false, nil
	}
	f.refunded[ref] = amount
	return true, nil
}

func walletJoinSetup(entryFee int) (*FantasyLeagueService, *walletJoinLeagueRepo, *fakeSpender) {
	league := &domain.FantasyLeague{
		ID: "league-1", SeasonID: "season-1", Name: "Cash League",
		Type: domain.LeagueTypePublic, EntryFee: entryFee, MaxMembers: 10,
	}
	repo := &walletJoinLeagueRepo{league: league}
	spender := newFakeSpender()
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
	if len(spender.paid) != 1 {
		t.Fatalf("expected exactly one wallet debit, got %d", len(spender.paid))
	}
	if len(repo.members) != 1 {
		t.Fatalf("expected one membership, got %d", len(repo.members))
	}
	m := repo.members[0]
	if m.PaymentStatus != domain.LeaguePaymentPaid {
		t.Errorf("membership status = %s, want PAID so the prize pool counts it", m.PaymentStatus)
	}
	if m.PaystackReference == nil || spender.paid[*m.PaystackReference] != 100000 {
		t.Errorf("membership must carry the reference the wallet was debited under, got %v", m.PaystackReference)
	}
	if len(spender.refunded) != 0 {
		t.Errorf("nothing should be refunded on success")
	}
}

func TestJoinLeagueWithWallet_InsufficientLeavesNoMembership(t *testing.T) {
	svc, repo, spender := walletJoinSetup(100000)
	spender.payErr = ports.ErrWalletInsufficient

	_, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want ErrWalletInsufficient", err)
	}
	if len(repo.members) != 0 {
		t.Errorf("a short wallet must leave no membership, got %d", len(repo.members))
	}
	if len(spender.refunded) != 0 {
		t.Errorf("nothing was debited so nothing should be refunded")
	}
}

func TestJoinLeagueWithWallet_FailureAfterDebitRefunds(t *testing.T) {
	svc, repo, spender := walletJoinSetup(100000)
	repo.addErr = errors.New("database down")

	_, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if err == nil {
		t.Fatal("expected the join to fail")
	}
	if len(spender.paid) != 1 || len(spender.refunded) != 1 {
		t.Fatalf("expected one debit and one matching refund, got paid=%d refunded=%d", len(spender.paid), len(spender.refunded))
	}
	for ref, amt := range spender.paid {
		if spender.refunded[ref] != amt {
			t.Errorf("refund for %s = %d, want %d", ref, spender.refunded[ref], amt)
		}
	}
}

func TestJoinLeagueWithWallet_LeagueFilledMeanwhileRefunds(t *testing.T) {
	svc, repo, spender := walletJoinSetup(100000)
	repo.addErr = ports.ErrLeagueFull

	_, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if !errors.Is(err, ports.ErrLeagueFull) {
		t.Fatalf("err = %v, want ErrLeagueFull", err)
	}
	if len(spender.refunded) != 1 {
		t.Errorf("the debit must be reversed when the league fills, refunded=%d", len(spender.refunded))
	}
}

func TestJoinLeagueWithWallet_FullLeagueNeverDebits(t *testing.T) {
	svc, repo, spender := walletJoinSetup(100000)
	repo.league.MaxMembers = 1
	repo.members = []domain.FantasyLeagueMember{{UserID: "someone-else"}}

	_, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if !errors.Is(err, ports.ErrLeagueFull) {
		t.Fatalf("err = %v, want ErrLeagueFull", err)
	}
	if len(spender.paid) != 0 {
		t.Errorf("a full league must be refused before any debit")
	}
}

func TestJoinLeagueWithWallet_FreeLeagueUnaffected(t *testing.T) {
	svc, repo, spender := walletJoinSetup(0)

	res, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq())
	if err != nil {
		t.Fatalf("JoinLeague: %v", err)
	}
	if res.PaidFromWallet {
		t.Errorf("a free league must not be reported as wallet-paid")
	}
	if len(spender.paid) != 0 {
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

// memberRepo remembers memberships, so a second join can see the first one.
type memberRepo struct {
	walletJoinLeagueRepo
	mu       sync.Mutex
	existing *domain.FantasyLeagueMember
}

func (r *memberRepo) GetMember(_ context.Context, _, _ string) (*domain.FantasyLeagueMember, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.existing == nil {
		return nil, nil
	}
	m := *r.existing
	return &m, nil
}

func (r *memberRepo) CountActiveMembers(_ context.Context, _ string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.members), nil
}

func (r *memberRepo) AddMember(_ context.Context, m *domain.FantasyLeagueMember) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *m
	// Same upsert rule as the real repository: a new reference replaces the old one.
	if r.existing != nil && cp.PaystackReference == nil {
		cp.PaystackReference = r.existing.PaystackReference
	}
	r.existing = &cp
	r.members = append(r.members, cp)
	return nil
}

// A double click sends two joins at once. Only one may take the fee.
func TestJoinLeagueWithWallet_ConcurrentJoinsChargeOnce(t *testing.T) {
	league := &domain.FantasyLeague{ID: "league-1", SeasonID: "season-1", Name: "Cash League",
		Type: domain.LeagueTypePublic, EntryFee: 100000, MaxMembers: 10}
	repo := &memberRepo{walletJoinLeagueRepo: walletJoinLeagueRepo{league: league}}
	spender := newFakeSpender()
	svc := &FantasyLeagueService{repo: repo, fantasyRepo: walletJoinFantasyRepo{}}
	svc.WithWallet(spender)

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

	if len(spender.paid) != 1 {
		t.Fatalf("fee was taken %d times, want 1", len(spender.paid))
	}
}

// An earlier card attempt that is still settling keeps its reference, so a late
// Paystack success can still be matched to the membership.
func TestJoinLeagueWithWallet_KeepsEarlierCardReference(t *testing.T) {
	league := &domain.FantasyLeague{ID: "league-1", SeasonID: "season-1", Name: "Cash League",
		Type: domain.LeagueTypePublic, EntryFee: 100000, MaxMembers: 10}
	cardRef := "FNT-1700000000-ABC"
	repo := &memberRepo{
		walletJoinLeagueRepo: walletJoinLeagueRepo{league: league},
		existing: &domain.FantasyLeagueMember{
			ID: "m1", LeagueID: "league-1", UserID: "user-1",
			PaymentStatus: domain.LeaguePaymentPending, PaystackReference: &cardRef,
		},
	}
	spender := newFakeSpender()
	// No Paystack client: the verification step is skipped, the reference rule is what is under test.
	svc := &FantasyLeagueService{repo: repo, fantasyRepo: walletJoinFantasyRepo{}}
	svc.WithWallet(spender)

	if _, err := svc.JoinLeague(context.Background(), "user-1", "season-1", "http://cb", walletJoinReq()); err != nil {
		t.Fatalf("JoinLeague: %v", err)
	}
	got := repo.existing
	if got.PaystackReference == nil || *got.PaystackReference != cardRef {
		t.Fatalf("card reference was replaced: %v", got.PaystackReference)
	}
	if got.PaymentStatus != domain.LeaguePaymentPaid || len(spender.paid) != 1 {
		t.Fatalf("status=%s debits=%d, want PAID and 1", got.PaymentStatus, len(spender.paid))
	}
}
