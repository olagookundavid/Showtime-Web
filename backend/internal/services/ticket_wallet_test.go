package services

import (
	"context"
	"errors"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// ─── Paying for tickets from the wallet ───────────────────────────────────────

// fakeWallet stands in for the spend wallet. Ticket purchases take the money in
// the ticket's own database transaction (walletTicketRepo below), so the service
// only needs the wallet to be switched on; Pay and Refund must never be called.
type fakeWallet struct {
	calls int
}

func newFakeWallet() *fakeWallet { return &fakeWallet{} }

func (f *fakeWallet) Pay(context.Context, string, int64, string, string) (bool, error) {
	f.calls++
	return false, errors.New("ticket purchases must not call Pay")
}

func (f *fakeWallet) Refund(context.Context, string, int64, string, string) (bool, error) {
	f.calls++
	return false, errors.New("ticket purchases must not call Refund")
}

// walletTicketRepo keeps the tickets the service creates and models the real
// repository's guarantee: a wallet ticket and its debit are written together or
// not at all.
type walletTicketRepo struct {
	ports.TicketRepository
	balance   int64
	debits    []domain.LedgerEntry
	created   []*domain.Ticket
	createErr error
	// failFirst fails only the first create, with createErr.
	failFirst bool
}

func (f *walletTicketRepo) insert(t *domain.Ticket) error {
	if f.createErr != nil {
		err := f.createErr
		if f.failFirst {
			f.createErr = nil
		}
		return err
	}
	cp := *t
	cp.ID = "ticket-1"
	f.created = append(f.created, &cp)
	t.ID = cp.ID
	return nil
}

func (f *walletTicketRepo) Create(_ context.Context, t *domain.Ticket) error { return f.insert(t) }

func (f *walletTicketRepo) CreatePaidFromWallet(_ context.Context, t *domain.Ticket, debit domain.LedgerEntry) error {
	if f.balance+debit.AmountKobo < 0 {
		return ports.ErrWalletInsufficient
	}
	if err := f.insert(t); err != nil {
		return err // rolled back: no debit
	}
	f.balance += debit.AmountKobo
	f.debits = append(f.debits, debit)
	return nil
}

// walletProductRepo adds the Game Pass rules the purchase reads (none).
type walletProductRepo struct{ *fakeProductRepo }

func (f walletProductRepo) ListGamePassRules(ctx context.Context) ([]domain.GamePassRule, error) {
	return nil, nil
}

// newWalletTicketService sells one match day at price naira, to a buyer holding
// 50,000 naira. The Paystack client is left nil on purpose: any attempt to start
// a Paystack payment would panic.
func newWalletTicketService(price int) (*TicketService, *walletTicketRepo, *fakeWallet) {
	base := newSelectionService().productRepo.(*fakeProductRepo)
	base.days[testD1] = futureDay(testD1, 7, price, 0, 0)
	repo := &walletTicketRepo{balance: 50_000 * 100}
	w := newFakeWallet()
	svc := &TicketService{productRepo: walletProductRepo{base}, ticketRepo: repo}
	svc.WithWallet(w)
	return svc, repo, w
}

func walletPurchase() dto.PurchaseTicketRequest {
	return dto.PurchaseTicketRequest{
		ProductID: testProduct, EventDayIDs: []string{testD1}, Email: "a@example.test",
		Name: "A", Phone: "1", Quantity: 2, PayWithWallet: true,
	}
}

func TestWalletPurchaseDebitsOnceAndConfirmsTheTicket(t *testing.T) {
	svc, repo, w := newWalletTicketService(5000)
	user := "user-1"

	res, err := svc.Purchase(context.Background(), walletPurchase(), "http://localhost/tickets/confirm", &user)
	if err != nil {
		t.Fatalf("purchase failed: %v", err)
	}
	if len(repo.debits) != 1 {
		t.Fatalf("wallet should be debited once, got %d", len(repo.debits))
	}
	// 2 tickets x 5,000 naira, in kobo.
	d := repo.debits[0]
	if d.UserID != user || d.AmountKobo != -2*5000*100 || d.Type != domain.LedgerPurchase {
		t.Fatalf("wrong debit: %+v", d)
	}
	if len(repo.created) != 1 {
		t.Fatalf("one ticket expected, got %d", len(repo.created))
	}
	tk := repo.created[0]
	if tk.Status != domain.TicketStatusPaid {
		t.Fatalf("ticket should be created paid, got %s", tk.Status)
	}
	if tk.PaystackAccessCode != nil {
		t.Fatalf("a wallet ticket must not carry a Paystack access code")
	}
	if tk.UserID == nil || *tk.UserID != user {
		t.Fatalf("ticket should belong to the buyer")
	}
	if d.Reference == nil || *d.Reference != tk.TicketCode {
		t.Fatalf("the ledger reference should be the ticket code: %v / %s", d.Reference, tk.TicketCode)
	}
	if res.Status != string(domain.TicketStatusPaid) || res.AuthorizationURL != "" || res.TicketCode == "" {
		t.Fatalf("response should be an already confirmed ticket: %+v", res)
	}
	if w.calls != 0 {
		t.Fatalf("the wallet service must not be called directly")
	}
}

func TestWalletPurchaseInsufficientBalanceLeavesNoTicketAndNoCharge(t *testing.T) {
	svc, repo, _ := newWalletTicketService(5000)
	repo.balance = 9_999_00 // short of the 10,000 naira total
	user := "user-1"

	_, err := svc.Purchase(context.Background(), walletPurchase(), "", &user)
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("want ErrWalletInsufficient, got %v", err)
	}
	if len(repo.created) != 0 || len(repo.debits) != 0 || repo.balance != 9_999_00 {
		t.Fatalf("no ticket and no charge expected: tickets=%d debits=%d", len(repo.created), len(repo.debits))
	}
}

func TestWalletPurchaseFailureChargesNothing(t *testing.T) {
	svc, repo, _ := newWalletTicketService(5000)
	repo.createErr = errors.New("database is down")
	user := "user-1"

	if _, err := svc.Purchase(context.Background(), walletPurchase(), "", &user); err == nil {
		t.Fatalf("the failure should be returned")
	}
	if len(repo.debits) != 0 || len(repo.created) != 0 || repo.balance != 50_000*100 {
		t.Fatalf("a failed ticket must leave the wallet untouched")
	}
}

func TestWalletPurchaseCodeClashRetriesWithAFreshCodeAndChargesOnce(t *testing.T) {
	svc, repo, _ := newWalletTicketService(5000)
	repo.createErr = errors.New(`duplicate key value violates unique constraint "tickets_ticket_code_key"`)
	repo.failFirst = true
	user := "user-1"

	if _, err := svc.Purchase(context.Background(), walletPurchase(), "", &user); err != nil {
		t.Fatalf("a clash should be retried: %v", err)
	}
	if len(repo.debits) != 1 || len(repo.created) != 1 {
		t.Fatalf("want one charge and one ticket, got debits=%d tickets=%d", len(repo.debits), len(repo.created))
	}
	if *repo.debits[0].Reference != repo.created[0].TicketCode {
		t.Fatalf("the charge should name the ticket that was issued")
	}
}

func TestWalletPurchaseRejectsGuests(t *testing.T) {
	svc, repo, _ := newWalletTicketService(5000)

	_, err := svc.Purchase(context.Background(), walletPurchase(), "", nil)
	if !errors.Is(err, ErrTicketWalletSignIn) {
		t.Fatalf("a guest should be told to sign in, got %v", err)
	}
	if len(repo.debits) != 0 || len(repo.created) != 0 {
		t.Fatalf("a guest must not be charged or get a ticket")
	}
}

func TestWalletPurchaseNeedsAWallet(t *testing.T) {
	svc, repo, _ := newWalletTicketService(5000)
	svc.wallet = nil
	user := "user-1"

	if _, err := svc.Purchase(context.Background(), walletPurchase(), "", &user); !errors.Is(err, ErrTicketWalletUnavailable) {
		t.Fatalf("want ErrTicketWalletUnavailable, got %v", err)
	}
	if len(repo.created) != 0 {
		t.Fatalf("no ticket without a wallet")
	}
}

func TestWalletPurchaseOfAFreeTicketTakesNoMoney(t *testing.T) {
	svc, repo, _ := newWalletTicketService(0)
	user := "user-1"

	res, err := svc.Purchase(context.Background(), walletPurchase(), "", &user)
	if err != nil {
		t.Fatalf("free purchase failed: %v", err)
	}
	if len(repo.debits) != 0 {
		t.Fatalf("a free ticket must not touch the wallet")
	}
	if len(repo.created) != 1 || res.Status != string(domain.TicketStatusPaid) {
		t.Fatalf("a free ticket is simply confirmed")
	}
}
