package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// ─── Fakes ────────────────────────────────────────────────────────────────────

// fakePayoutRepo models the production semantics that matter: balances that
// cannot go negative, settlement that runs at most once per league, and an
// append-only ledger. Anything not stubbed panics via the embedded interface.
type fakePayoutRepo struct {
	ports.IFantasyPayoutRepository

	balances  map[string]int64
	ledger    []domain.WalletTransaction
	payouts   map[string]*domain.PayoutRequest
	standings map[string][]domain.PrizeStanding
	structure map[string][]domain.PrizeTier
	paidCount map[string]int
	settled   map[string]bool
	unsettled []domain.FantasyLeague

	nextID int
}

func newFakePayoutRepo() *fakePayoutRepo {
	return &fakePayoutRepo{
		balances:  map[string]int64{},
		payouts:   map[string]*domain.PayoutRequest{},
		standings: map[string][]domain.PrizeStanding{},
		structure: map[string][]domain.PrizeTier{},
		paidCount: map[string]int{},
		settled:   map[string]bool{},
	}
}

func (f *fakePayoutRepo) id(prefix string) string {
	f.nextID++
	return prefix + string(rune('a'+f.nextID-1))
}

func (f *fakePayoutRepo) GetWallet(_ context.Context, userID string) (*domain.FantasyWallet, error) {
	return &domain.FantasyWallet{UserID: userID, BalanceKobo: f.balances[userID]}, nil
}

func (f *fakePayoutRepo) ListWalletTransactions(_ context.Context, userID string, _ int) ([]domain.WalletTransaction, error) {
	var out []domain.WalletTransaction
	for _, t := range f.ledger {
		if t.UserID == userID {
			out = append(out, t)
		}
	}
	return out, nil
}

func (f *fakePayoutRepo) CreditWallet(_ context.Context, wt domain.WalletTransaction) error {
	f.balances[wt.UserID] += wt.AmountKobo
	f.ledger = append(f.ledger, wt)
	return nil
}

func (f *fakePayoutRepo) CreatePayoutRequest(_ context.Context, req *domain.PayoutRequest) error {
	if f.balances[req.UserID] < req.AmountKobo {
		return ports.ErrInsufficientBalance
	}
	req.ID = f.id("payout-")
	req.Status = domain.PayoutPending
	req.CreatedAt = time.Now()
	f.payouts[req.ID] = req
	// The debit lands immediately, exactly as the real repository does.
	f.balances[req.UserID] -= req.AmountKobo
	f.ledger = append(f.ledger, domain.WalletTransaction{
		UserID: req.UserID, AmountKobo: -req.AmountKobo, Type: domain.WalletPayout,
	})
	return nil
}

func (f *fakePayoutRepo) GetPayoutRequestByID(_ context.Context, id string) (*domain.PayoutRequest, error) {
	return f.payouts[id], nil
}

func (f *fakePayoutRepo) ListPayoutRequestsByUser(_ context.Context, userID string, _ int) ([]domain.PayoutRequest, error) {
	var out []domain.PayoutRequest
	for _, p := range f.payouts {
		if p.UserID == userID {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (f *fakePayoutRepo) UpdatePayoutStatus(_ context.Context, id string, to domain.PayoutStatus, adminNotes, ref, actor string) (*domain.PayoutRequest, error) {
	p, ok := f.payouts[id]
	if !ok {
		return nil, errors.New("payout request not found")
	}
	if err := domain.ValidatePayoutStatusTransition(p.Status, to); err != nil {
		return nil, err
	}
	p.Status = to
	if adminNotes != "" {
		p.AdminNotes = adminNotes
	}
	if ref != "" {
		p.PaymentReference = ref
	}
	if to.ReturnsFunds() {
		f.balances[p.UserID] += p.AmountKobo
		f.ledger = append(f.ledger, domain.WalletTransaction{
			UserID: p.UserID, AmountKobo: p.AmountKobo, Type: domain.WalletPayoutReversal,
		})
	}
	return p, nil
}

func (f *fakePayoutRepo) SumPendingPayouts(_ context.Context, userID string) (int64, error) {
	var total int64
	for _, p := range f.payouts {
		if p.UserID == userID && (p.Status == domain.PayoutPending || p.Status == domain.PayoutProcessing) {
			total += p.AmountKobo
		}
	}
	return total, nil
}

func (f *fakePayoutRepo) SumUserLifetime(_ context.Context, userID string) (int64, int64, error) {
	var won, paid int64
	for _, t := range f.ledger {
		if t.UserID == userID && t.Type == domain.WalletWinnings {
			won += t.AmountKobo
		}
	}
	for _, p := range f.payouts {
		if p.UserID == userID && p.Status == domain.PayoutPaid {
			paid += p.AmountKobo
		}
	}
	return won, paid, nil
}

func (f *fakePayoutRepo) GetLastBankDetails(_ context.Context, _ string) (*dto.BankDetails, error) {
	return nil, nil
}

func (f *fakePayoutRepo) GetPrizeStructure(_ context.Context, leagueID string) ([]domain.PrizeTier, error) {
	return f.structure[leagueID], nil
}

func (f *fakePayoutRepo) SetPrizeStructure(_ context.Context, leagueID string, tiers []domain.PrizeTier) error {
	if f.settled[leagueID] {
		return ports.ErrAlreadySettled
	}
	f.structure[leagueID] = tiers
	return nil
}

func (f *fakePayoutRepo) GetLeagueStandings(_ context.Context, leagueID string) ([]domain.PrizeStanding, error) {
	return f.standings[leagueID], nil
}

func (f *fakePayoutRepo) CountPaidMembers(_ context.Context, leagueID string) (int, int, error) {
	return f.paidCount[leagueID], 0, nil
}

func (f *fakePayoutRepo) SettleLeague(_ context.Context, leagueID string, _, _, _ int64, awards []domain.PrizeAward, actor string) error {
	// The settled flag is the production idempotency guard.
	if f.settled[leagueID] {
		return ports.ErrAlreadySettled
	}
	for _, a := range awards {
		f.balances[a.UserID] += a.AmountKobo
		lid := leagueID
		f.ledger = append(f.ledger, domain.WalletTransaction{
			UserID: a.UserID, AmountKobo: a.AmountKobo, Type: domain.WalletWinnings, LeagueID: &lid,
		})
	}
	f.settled[leagueID] = true
	return nil
}

func (f *fakePayoutRepo) ListUnsettledPaidLeagues(_ context.Context, _ string) ([]domain.FantasyLeague, error) {
	var out []domain.FantasyLeague
	for _, l := range f.unsettled {
		if !f.settled[l.ID] {
			out = append(out, l)
		}
	}
	return out, nil
}

type fakePayoutLeagueRepo struct {
	ports.IFantasyLeagueRepository
	leagues map[string]*domain.FantasyLeague
}

func (f *fakePayoutLeagueRepo) GetLeagueByID(_ context.Context, id string) (*domain.FantasyLeague, error) {
	return f.leagues[id], nil
}

type fakePayoutFantasyRepo struct {
	ports.IFantasyRepository
	season       *domain.FantasySeason
	statusWrites []domain.FantasySeasonStatus
}

func (f *fakePayoutFantasyRepo) GetSeasonByID(_ context.Context, _ string) (*domain.FantasySeason, error) {
	return f.season, nil
}

func (f *fakePayoutFantasyRepo) UpdateSeasonStatus(_ context.Context, _ string, st domain.FantasySeasonStatus) error {
	f.statusWrites = append(f.statusWrites, st)
	return nil
}

type fakeSettings struct {
	ports.IAppSettingRepository
	values map[string]string
}

func (f *fakeSettings) Get(_ context.Context, key string) (string, error) { return f.values[key], nil }

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// paidLeagueSetup wires a ₦1,000-entry league with four paid members whose
// standings are 100 / 90 / 80 / 70 points.
func paidLeagueSetup(cutPercent string) (*fakePayoutRepo, *fakePayoutFantasyRepo, IFantasyPayoutService) {
	repo := newFakePayoutRepo()
	league := &domain.FantasyLeague{
		ID: "league-1", SeasonID: "season-1", Name: "Cash League",
		Type: domain.LeagueTypePrivate, EntryFee: 100000, // ₦1,000 in kobo
	}
	repo.paidCount["league-1"] = 4
	repo.standings["league-1"] = []domain.PrizeStanding{
		{UserID: "u1", TeamID: "t1", Points: 100},
		{UserID: "u2", TeamID: "t2", Points: 90},
		{UserID: "u3", TeamID: "t3", Points: 80},
		{UserID: "u4", TeamID: "t4", Points: 70},
	}
	repo.unsettled = []domain.FantasyLeague{*league}

	leagues := &fakePayoutLeagueRepo{leagues: map[string]*domain.FantasyLeague{"league-1": league}}
	fantasy := &fakePayoutFantasyRepo{season: &domain.FantasySeason{
		ID: "season-1", Name: "S1", Status: domain.FantasySeasonActive,
	}}
	settings := &fakeSettings{values: map[string]string{SettingPlatformCutPercent: cutPercent}}

	return repo, fantasy, NewFantasyPayoutService(repo, leagues, fantasy, settings)
}

// ─── Settlement ───────────────────────────────────────────────────────────────

func TestSettleLeague(t *testing.T) {
	t.Run("applies the cut and pays the default split", func(t *testing.T) {
		repo, _, svc := paidLeagueSetup("10")

		res, err := svc.SettleLeague(context.Background(), "admin-1", "league-1")
		if err != nil {
			t.Fatalf("settlement failed: %v", err)
		}

		// Gross ₦4,000 → 10% cut = ₦400, pool = ₦3,600.
		if res.PlatformCutKobo != 40000 {
			t.Errorf("expected a ₦400.00 cut, got %d kobo", res.PlatformCutKobo)
		}
		if res.TotalAwardedKobo != 360000 {
			t.Errorf("expected ₦3,600.00 awarded, got %d kobo", res.TotalAwardedKobo)
		}
		// 50/30/20 of ₦3,600.
		if repo.balances["u1"] != 180000 {
			t.Errorf("1st should receive ₦1,800.00, got %d kobo", repo.balances["u1"])
		}
		if repo.balances["u2"] != 108000 {
			t.Errorf("2nd should receive ₦1,080.00, got %d kobo", repo.balances["u2"])
		}
		if repo.balances["u3"] != 72000 {
			t.Errorf("3rd should receive ₦720.00, got %d kobo", repo.balances["u3"])
		}
		if repo.balances["u4"] != 0 {
			t.Errorf("4th is out of the prizes, got %d kobo", repo.balances["u4"])
		}
	})

	// Settling twice would mint money out of nothing.
	t.Run("refuses to settle the same league twice", func(t *testing.T) {
		repo, _, svc := paidLeagueSetup("10")

		if _, err := svc.SettleLeague(context.Background(), "admin-1", "league-1"); err != nil {
			t.Fatalf("first settlement failed: %v", err)
		}
		before := repo.balances["u1"]

		_, err := svc.SettleLeague(context.Background(), "admin-1", "league-1")
		if !errors.Is(err, ports.ErrAlreadySettled) {
			t.Fatalf("expected ErrAlreadySettled on the second run, got: %v", err)
		}
		if repo.balances["u1"] != before {
			t.Errorf("a refused settlement must not move money: %d became %d", before, repo.balances["u1"])
		}
	})

	t.Run("honours a custom prize structure", func(t *testing.T) {
		repo, _, svc := paidLeagueSetup("0")
		repo.structure["league-1"] = []domain.PrizeTier{{Rank: 1, Percent: 100}}

		if _, err := svc.SettleLeague(context.Background(), "admin-1", "league-1"); err != nil {
			t.Fatalf("settlement failed: %v", err)
		}
		if repo.balances["u1"] != 400000 {
			t.Errorf("winner-takes-all should pay the full ₦4,000.00, got %d kobo", repo.balances["u1"])
		}
		if repo.balances["u2"] != 0 {
			t.Errorf("2nd should receive nothing, got %d kobo", repo.balances["u2"])
		}
	})

	t.Run("falls back to the default cut when the setting is unusable", func(t *testing.T) {
		repo, _, svc := paidLeagueSetup("not-a-number")

		res, err := svc.SettleLeague(context.Background(), "admin-1", "league-1")
		if err != nil {
			t.Fatalf("settlement failed: %v", err)
		}
		if res.PlatformCutKobo != 40000 {
			t.Errorf("expected the 10%% default cut, got %d kobo", res.PlatformCutKobo)
		}
		_ = repo
	})

	t.Run("refuses a free league", func(t *testing.T) {
		repo := newFakePayoutRepo()
		leagues := &fakePayoutLeagueRepo{leagues: map[string]*domain.FantasyLeague{
			"free-1": {ID: "free-1", SeasonID: "season-1", Name: "Free League", EntryFee: 0},
		}}
		svc := NewFantasyPayoutService(repo, leagues, &fakePayoutFantasyRepo{}, &fakeSettings{values: map[string]string{}})

		_, err := svc.SettleLeague(context.Background(), "admin-1", "free-1")
		if err == nil {
			t.Fatal("expected a free league to be refused")
		}
	})
}

func TestCompleteSeason(t *testing.T) {
	t.Run("settles leagues then closes the season", func(t *testing.T) {
		repo, fantasy, svc := paidLeagueSetup("10")

		res, err := svc.CompleteSeason(context.Background(), "admin-1", "season-1")
		if err != nil {
			t.Fatalf("completing the season failed: %v", err)
		}
		if res.LeaguesSettled != 1 {
			t.Errorf("expected 1 league settled, got %d", res.LeaguesSettled)
		}
		if repo.balances["u1"] != 180000 {
			t.Errorf("the winner should have been credited, got %d kobo", repo.balances["u1"])
		}
		if len(fantasy.statusWrites) != 1 || fantasy.statusWrites[0] != domain.FantasySeasonCompleted {
			t.Errorf("expected the season to be marked COMPLETED, got %v", fantasy.statusWrites)
		}
	})

	t.Run("refuses a season that is already completed", func(t *testing.T) {
		_, fantasy, svc := paidLeagueSetup("10")
		fantasy.season.Status = domain.FantasySeasonCompleted

		if _, err := svc.CompleteSeason(context.Background(), "admin-1", "season-1"); err == nil {
			t.Fatal("expected an already-completed season to be refused")
		}
	})

	// Re-running a completion must not pay the prizes again.
	t.Run("is safe to re-run after leagues are settled", func(t *testing.T) {
		repo, fantasy, svc := paidLeagueSetup("10")

		if _, err := svc.CompleteSeason(context.Background(), "admin-1", "season-1"); err != nil {
			t.Fatalf("first completion failed: %v", err)
		}
		before := repo.balances["u1"]

		fantasy.season.Status = domain.FantasySeasonActive // pretend it was reopened
		if _, err := svc.CompleteSeason(context.Background(), "admin-1", "season-1"); err != nil {
			t.Fatalf("second completion failed: %v", err)
		}
		if repo.balances["u1"] != before {
			t.Errorf("prize money was paid twice: %d became %d", before, repo.balances["u1"])
		}
	})
}

// ─── Payout requests ──────────────────────────────────────────────────────────

func newWalletService(balance int64) (*fakePayoutRepo, IFantasyPayoutService) {
	repo := newFakePayoutRepo()
	repo.balances["u1"] = balance
	return repo, NewFantasyPayoutService(repo,
		&fakePayoutLeagueRepo{leagues: map[string]*domain.FantasyLeague{}},
		&fakePayoutFantasyRepo{},
		&fakeSettings{values: map[string]string{}})
}

func validPayout(amount int64) dto.CreatePayoutRequest {
	return dto.CreatePayoutRequest{
		AmountKobo: amount, BankName: "GTBank",
		AccountNumber: "0123456789", AccountName: "Ada Obi",
	}
}

func TestRequestPayout(t *testing.T) {
	t.Run("debits the wallet immediately", func(t *testing.T) {
		repo, svc := newWalletService(500000) // ₦5,000

		res, err := svc.RequestPayout(context.Background(), "u1", validPayout(200000))
		if err != nil {
			t.Fatalf("payout request failed: %v", err)
		}
		if res.Status != string(domain.PayoutPending) {
			t.Errorf("a new payout should be PENDING, got %s", res.Status)
		}
		if repo.balances["u1"] != 300000 {
			t.Errorf("expected ₦3,000.00 left after a ₦2,000.00 request, got %d kobo", repo.balances["u1"])
		}
	})

	// The debit-on-request design is what makes this impossible.
	t.Run("cannot be requested twice against the same funds", func(t *testing.T) {
		repo, svc := newWalletService(300000)

		if _, err := svc.RequestPayout(context.Background(), "u1", validPayout(200000)); err != nil {
			t.Fatalf("first request failed: %v", err)
		}
		_, err := svc.RequestPayout(context.Background(), "u1", validPayout(200000))
		if !errors.Is(err, ports.ErrInsufficientBalance) {
			t.Fatalf("expected the second request to be refused, got: %v", err)
		}
		if repo.balances["u1"] != 100000 {
			t.Errorf("balance should be untouched by the refused request, got %d kobo", repo.balances["u1"])
		}
	})

	t.Run("rejects an amount over the balance", func(t *testing.T) {
		_, svc := newWalletService(150000)

		_, err := svc.RequestPayout(context.Background(), "u1", validPayout(200000))
		if !errors.Is(err, ports.ErrInsufficientBalance) {
			t.Fatalf("expected insufficient balance, got: %v", err)
		}
	})

	t.Run("enforces the minimum payout", func(t *testing.T) {
		_, svc := newWalletService(500000)

		_, err := svc.RequestPayout(context.Background(), "u1", validPayout(domain.MinPayoutKobo-1))
		assertErrContains(t, err, "minimum payout")
	})

	t.Run("rejects a non-numeric account number", func(t *testing.T) {
		_, svc := newWalletService(500000)
		req := validPayout(200000)
		req.AccountNumber = "01234-6789"

		_, err := svc.RequestPayout(context.Background(), "u1", req)
		assertErrContains(t, err, "digits only")
	})
}

func TestPayoutLifecycle(t *testing.T) {
	t.Run("rejection returns the funds", func(t *testing.T) {
		repo, svc := newWalletService(500000)
		created, err := svc.RequestPayout(context.Background(), "u1", validPayout(200000))
		if err != nil {
			t.Fatalf("payout request failed: %v", err)
		}
		if repo.balances["u1"] != 300000 {
			t.Fatalf("setup: expected ₦3,000.00 held back, got %d", repo.balances["u1"])
		}

		if _, err := svc.UpdatePayoutStatus(context.Background(), "admin-1", created.ID,
			dto.UpdatePayoutStatusRequest{Status: "REJECTED", AdminNotes: "wrong account"}); err != nil {
			t.Fatalf("rejection failed: %v", err)
		}
		if repo.balances["u1"] != 500000 {
			t.Errorf("a rejected payout must return the funds, got %d kobo", repo.balances["u1"])
		}
	})

	t.Run("marking paid keeps the funds out", func(t *testing.T) {
		repo, svc := newWalletService(500000)
		created, _ := svc.RequestPayout(context.Background(), "u1", validPayout(200000))

		if _, err := svc.UpdatePayoutStatus(context.Background(), "admin-1", created.ID,
			dto.UpdatePayoutStatusRequest{Status: "PAID", PaymentReference: "TRF-99012"}); err != nil {
			t.Fatalf("marking paid failed: %v", err)
		}
		if repo.balances["u1"] != 300000 {
			t.Errorf("a paid payout must not return funds, got %d kobo", repo.balances["u1"])
		}
	})

	// An untraceable transfer is an operational dead end.
	t.Run("marking paid demands a transfer reference", func(t *testing.T) {
		_, svc := newWalletService(500000)
		created, _ := svc.RequestPayout(context.Background(), "u1", validPayout(200000))

		_, err := svc.UpdatePayoutStatus(context.Background(), "admin-1", created.ID,
			dto.UpdatePayoutStatusRequest{Status: "PAID"})
		assertErrContains(t, err, "bank transfer reference")
	})

	t.Run("a settled payout cannot be reopened", func(t *testing.T) {
		_, svc := newWalletService(500000)
		created, _ := svc.RequestPayout(context.Background(), "u1", validPayout(200000))

		if _, err := svc.UpdatePayoutStatus(context.Background(), "admin-1", created.ID,
			dto.UpdatePayoutStatusRequest{Status: "PAID", PaymentReference: "TRF-1"}); err != nil {
			t.Fatalf("marking paid failed: %v", err)
		}
		_, err := svc.UpdatePayoutStatus(context.Background(), "admin-1", created.ID,
			dto.UpdatePayoutStatusRequest{Status: "REJECTED"})
		assertErrContains(t, err, "can no longer be changed")
	})

	t.Run("a user can cancel their own pending payout", func(t *testing.T) {
		repo, svc := newWalletService(500000)
		created, _ := svc.RequestPayout(context.Background(), "u1", validPayout(200000))

		if _, err := svc.CancelPayout(context.Background(), "u1", created.ID); err != nil {
			t.Fatalf("cancel failed: %v", err)
		}
		if repo.balances["u1"] != 500000 {
			t.Errorf("cancelling must return the funds, got %d kobo", repo.balances["u1"])
		}
	})

	t.Run("a user cannot cancel someone else's payout", func(t *testing.T) {
		_, svc := newWalletService(500000)
		created, _ := svc.RequestPayout(context.Background(), "u1", validPayout(200000))

		_, err := svc.CancelPayout(context.Background(), "someone-else", created.ID)
		assertErrContains(t, err, "not found")
	})

	t.Run("a payout already in flight cannot be cancelled by the user", func(t *testing.T) {
		_, svc := newWalletService(500000)
		created, _ := svc.RequestPayout(context.Background(), "u1", validPayout(200000))
		if _, err := svc.UpdatePayoutStatus(context.Background(), "admin-1", created.ID,
			dto.UpdatePayoutStatusRequest{Status: "PROCESSING"}); err != nil {
			t.Fatalf("marking processing failed: %v", err)
		}

		_, err := svc.CancelPayout(context.Background(), "u1", created.ID)
		assertErrContains(t, err, "no longer be cancelled")
	})
}

func TestGetWallet(t *testing.T) {
	t.Run("reports held funds separately from the balance", func(t *testing.T) {
		_, svc := newWalletService(500000)
		if _, err := svc.RequestPayout(context.Background(), "u1", validPayout(200000)); err != nil {
			t.Fatalf("payout request failed: %v", err)
		}

		w, err := svc.GetWallet(context.Background(), "u1")
		if err != nil {
			t.Fatalf("wallet lookup failed: %v", err)
		}
		if w.BalanceKobo != 300000 {
			t.Errorf("expected a ₦3,000.00 balance, got %d kobo", w.BalanceKobo)
		}
		if w.PendingPayoutKobo != 200000 {
			t.Errorf("expected ₦2,000.00 shown as pending, got %d kobo", w.PendingPayoutKobo)
		}
	})

	t.Run("blocks a payout below the minimum", func(t *testing.T) {
		_, svc := newWalletService(domain.MinPayoutKobo - 1)

		w, err := svc.GetWallet(context.Background(), "u1")
		if err != nil {
			t.Fatalf("wallet lookup failed: %v", err)
		}
		if w.CanRequestPayout {
			t.Error("a balance below the minimum must not allow a payout request")
		}
	})
}
