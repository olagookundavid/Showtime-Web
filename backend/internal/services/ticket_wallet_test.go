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

// fakeWallet records what the ticket service asks of the wallet.
type fakeWallet struct {
	payErr    error
	payNew    bool // false: report the reference as already paid
	pays      []fakeWalletCall
	refunds   []fakeWalletCall
	refundErr error
}

type fakeWalletCall struct {
	userID    string
	amount    int64
	reference string
}

func newFakeWallet() *fakeWallet { return &fakeWallet{payNew: true} }

func (f *fakeWallet) Pay(ctx context.Context, userID string, amountKobo int64, reference, description string) (bool, error) {
	if f.payErr != nil {
		return false, f.payErr
	}
	f.pays = append(f.pays, fakeWalletCall{userID, amountKobo, reference})
	return f.payNew, nil
}

func (f *fakeWallet) Refund(ctx context.Context, userID string, amountKobo int64, reference, description string) (bool, error) {
	if f.refundErr != nil {
		return false, f.refundErr
	}
	f.refunds = append(f.refunds, fakeWalletCall{userID, amountKobo, reference})
	return true, nil
}

// walletTicketRepo keeps the tickets the service creates.
type walletTicketRepo struct {
	ports.TicketRepository
	created   []*domain.Ticket
	createErr error
	// failFirst fails only the first Create, with createErr.
	failFirst bool
}

func (f *walletTicketRepo) Create(ctx context.Context, t *domain.Ticket) error {
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

// walletProductRepo adds the Game Pass rules the purchase reads (none).
type walletProductRepo struct{ *fakeProductRepo }

func (f walletProductRepo) ListGamePassRules(ctx context.Context) ([]domain.GamePassRule, error) {
	return nil, nil
}

// newWalletTicketService sells one 5,000 naira match day. The Paystack client is
// left nil on purpose: any attempt to start a Paystack payment would panic.
func newWalletTicketService(price int) (*TicketService, *walletTicketRepo, *fakeWallet) {
	base := newSelectionService().productRepo.(*fakeProductRepo)
	base.days[testD1] = futureDay(testD1, 7, price, 0, 0)
	repo := &walletTicketRepo{}
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
	if len(w.pays) != 1 {
		t.Fatalf("wallet should be debited once, got %d", len(w.pays))
	}
	// 2 tickets x 5,000 naira, in kobo.
	if got := w.pays[0]; got.userID != user || got.amount != 2*5000*100 {
		t.Fatalf("wrong debit: %+v", got)
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
	if w.pays[0].reference != tk.TicketCode || tk.PaystackReference == nil || *tk.PaystackReference != tk.TicketCode {
		t.Fatalf("the debit, reference and code should all match: %+v / %v / %s", w.pays[0], tk.PaystackReference, tk.TicketCode)
	}
	if res.Status != string(domain.TicketStatusPaid) || res.AuthorizationURL != "" || res.TicketCode == "" {
		t.Fatalf("response should be an already confirmed ticket: %+v", res)
	}
	if len(w.refunds) != 0 {
		t.Fatalf("nothing should be refunded on success")
	}
}

func TestWalletPurchaseInsufficientBalanceLeavesNoTicketAndNoCharge(t *testing.T) {
	svc, repo, w := newWalletTicketService(5000)
	w.payErr = ports.ErrWalletInsufficient
	user := "user-1"

	_, err := svc.Purchase(context.Background(), walletPurchase(), "", &user)
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("want ErrWalletInsufficient, got %v", err)
	}
	if len(repo.created) != 0 {
		t.Fatalf("no ticket should exist, got %d", len(repo.created))
	}
	if len(w.pays) != 0 || len(w.refunds) != 0 {
		t.Fatalf("no money should move: pays=%d refunds=%d", len(w.pays), len(w.refunds))
	}
}

func TestWalletPurchaseRefundsWhenTheTicketCannotBeCreated(t *testing.T) {
	svc, repo, w := newWalletTicketService(5000)
	repo.createErr = errors.New("database is down")
	user := "user-1"

	_, err := svc.Purchase(context.Background(), walletPurchase(), "", &user)
	if err == nil {
		t.Fatalf("the failure should be returned")
	}
	if len(w.pays) != 1 || len(w.refunds) != 1 {
		t.Fatalf("one debit and one refund expected, got pays=%d refunds=%d", len(w.pays), len(w.refunds))
	}
	if w.refunds[0] != w.pays[0] {
		t.Fatalf("the refund must repeat the debit (same user, amount, reference): %+v vs %+v", w.refunds[0], w.pays[0])
	}
	if len(repo.created) != 0 {
		t.Fatalf("no ticket should remain")
	}
}

func TestWalletPurchaseCodeClashRefundsAndRetriesWithAFreshCode(t *testing.T) {
	svc, repo, w := newWalletTicketService(5000)
	repo.createErr = errors.New(`duplicate key value violates unique constraint "tickets_ticket_code_key"`)
	repo.failFirst = true
	user := "user-1"

	if _, err := svc.Purchase(context.Background(), walletPurchase(), "", &user); err != nil {
		t.Fatalf("a clash should be retried: %v", err)
	}
	if len(w.pays) != 2 || len(w.refunds) != 1 {
		t.Fatalf("want 2 debits and 1 refund (net one charge), got pays=%d refunds=%d", len(w.pays), len(w.refunds))
	}
	if w.refunds[0].reference != w.pays[0].reference || w.pays[0].reference == w.pays[1].reference {
		t.Fatalf("the first debit is refunded and the second uses a new code: %+v %+v", w.pays, w.refunds)
	}
	if len(repo.created) != 1 || repo.created[0].TicketCode != w.pays[1].reference {
		t.Fatalf("the ticket should carry the second code")
	}
}

func TestWalletPurchaseReferenceAlreadyPaidIsNotRefundedAndRetries(t *testing.T) {
	svc, repo, w := newWalletTicketService(5000)
	w.payNew = false // every reference looks already paid: the loop must give up
	user := "user-1"

	if _, err := svc.Purchase(context.Background(), walletPurchase(), "", &user); err == nil {
		t.Fatalf("expected an error when no fresh reference can be had")
	}
	if len(repo.created) != 0 || len(w.refunds) != 0 {
		t.Fatalf("an already-paid reference must neither make a ticket nor be refunded")
	}
}

func TestWalletPurchaseRejectsGuests(t *testing.T) {
	svc, repo, w := newWalletTicketService(5000)

	_, err := svc.Purchase(context.Background(), walletPurchase(), "", nil)
	if !errors.Is(err, ErrTicketWalletSignIn) {
		t.Fatalf("a guest should be told to sign in, got %v", err)
	}
	if len(w.pays) != 0 || len(repo.created) != 0 {
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
	svc, repo, w := newWalletTicketService(0)
	user := "user-1"

	res, err := svc.Purchase(context.Background(), walletPurchase(), "", &user)
	if err != nil {
		t.Fatalf("free purchase failed: %v", err)
	}
	if len(w.pays) != 0 {
		t.Fatalf("a free ticket must not touch the wallet")
	}
	if len(repo.created) != 1 || res.Status != string(domain.TicketStatusPaid) {
		t.Fatalf("a free ticket is simply confirmed")
	}
}
