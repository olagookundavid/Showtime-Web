package tests_integration

// Integration coverage for buying a ticket with the spend wallet: the debit is
// written in the same transaction as the seat reservation and the ticket, so a
// buyer is never charged without a ticket or ticketed without paying.
//
// Uses the ticket fixtures (ZZFIX*, *@ticketfixture.test, dates in 2090) and the
// wallet fixture users (*@walletfixture.test). Skipped when TEST_DB_DSN is unset.

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

// walletTicketDebit is the ledger entry the ticket service writes for a wallet
// purchase: a PURCHASE keyed on the ticket code.
func walletTicketDebit(userID string, tk *domain.Ticket) domain.LedgerEntry {
	ref := tk.TicketCode
	return domain.LedgerEntry{
		UserID:      userID,
		AmountKobo:  -int64(tk.TotalAmount) * 100,
		Type:        domain.LedgerPurchase,
		Reference:   &ref,
		Description: "Ticket: " + tk.ProductName,
	}
}

func countRows(t *testing.T, f *walletFixture, sql string, args ...interface{}) string {
	t.Helper()
	return mustScan(t, f.pool, sql, args...)
}

func TestWalletTicket_SuccessChargesOnceAndCreatesTheTicket(t *testing.T) {
	tf := newTicketFixture(t)
	wf := newWalletFixture(t)
	ctx := context.Background()
	d1 := tf.eventDay(t, "wt-ok", "2090-05-01")
	comp := tf.competition(t, "wtok", "2090-05-01")
	p := tf.product(t, "WTOK", 1000, 5, comp)
	pd := tf.productDay(t, p, d1)

	buyer := wf.user(t, "ZZFIXtkbuyer")
	wf.credit(t, buyer, 500_000)

	tk := tf.newTicket(p, 2, domain.TicketStatusPaid, pd) // 2 x 1000 naira = 200000 kobo
	tk.UserID = &buyer
	if err := tf.tickets.CreatePaidFromWallet(ctx, tk, walletTicketDebit(buyer, tk)); err != nil {
		t.Fatalf("wallet purchase: %v", err)
	}
	if tk.ID == "" {
		t.Fatal("the ticket did not get an id")
	}

	if b := wf.balance(t, buyer); b != 300_000 {
		t.Fatalf("balance = %d, want 300000", b)
	}
	if n := countRows(t, wf, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'PURCHASE'`, buyer); n != "1" {
		t.Fatalf("%s PURCHASE rows, want 1", n)
	}
	e, err := wf.wallets.FindEntry(ctx, domain.LedgerPurchase, tk.TicketCode)
	if err != nil || e == nil {
		t.Fatalf("debit keyed on the ticket code not found: %v %v", e, err)
	}
	if e.AmountKobo != -200_000 || e.UserID != buyer || e.BalanceAfterKobo != 300_000 {
		t.Fatalf("unexpected debit: %+v", e)
	}
	got, err := tf.tickets.GetByCode(ctx, tk.TicketCode)
	if err != nil || got == nil || got.Status != domain.TicketStatusPaid {
		t.Fatalf("ticket lookup: %+v %v", got, err)
	}
	if n := countRows(t, wf, `SELECT COUNT(*)::text FROM ticket_days WHERE product_day_id = $1`, pd.ID); n != "1" {
		t.Fatalf("%s ticket_days rows, want 1", n)
	}

	// The same ticket code (a retry) cannot charge a second time: the reference is
	// unique per ledger type, so the whole purchase rolls back.
	again := tf.newTicket(p, 1, domain.TicketStatusPaid, pd)
	again.UserID = &buyer
	debit := walletTicketDebit(buyer, again)
	sameRef := tk.TicketCode
	debit.Reference = &sameRef
	if err := tf.tickets.CreatePaidFromWallet(ctx, again, debit); err == nil {
		t.Fatal("a second purchase reusing the first ledger reference should fail")
	}
	if b := wf.balance(t, buyer); b != 300_000 {
		t.Fatalf("a rejected retry moved the balance to %d", b)
	}
	if got, _ := tf.tickets.GetByCode(ctx, again.TicketCode); got != nil {
		t.Fatal("a rejected retry left a ticket behind")
	}

	// A credit is refused outright.
	bad := walletTicketDebit(buyer, tf.newTicket(p, 1, domain.TicketStatusPaid, pd))
	bad.AmountKobo = 100
	if err := tf.tickets.CreatePaidFromWallet(ctx, tf.newTicket(p, 1, domain.TicketStatusPaid, pd), bad); err == nil {
		t.Fatal("a positive amount must be refused")
	}
}

func TestWalletTicket_InsufficientLeavesNoTicketNoSeatNoLedger(t *testing.T) {
	tf := newTicketFixture(t)
	wf := newWalletFixture(t)
	ctx := context.Background()
	d1 := tf.eventDay(t, "wt-short", "2090-05-02")
	comp := tf.competition(t, "wtshort", "2090-05-02")
	p := tf.product(t, "WTSHORT", 1000, 1, comp) // a single seat
	pd := tf.productDay(t, p, d1)

	poor := wf.user(t, "ZZFIXtkpoor")
	wf.credit(t, poor, 50_000)

	tk := tf.newTicket(p, 1, domain.TicketStatusPaid, pd) // 100000 kobo
	tk.UserID = &poor
	err := tf.tickets.CreatePaidFromWallet(ctx, tk, walletTicketDebit(poor, tk))
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want ErrWalletInsufficient", err)
	}
	if b := wf.balance(t, poor); b != 50_000 {
		t.Fatalf("balance = %d, want 50000", b)
	}
	if n := countRows(t, wf, `SELECT COUNT(*)::text FROM tickets WHERE ticket_code = $1`, tk.TicketCode); n != "0" {
		t.Fatalf("%s ticket rows left behind", n)
	}
	if n := countRows(t, wf, `SELECT COUNT(*)::text FROM ticket_days WHERE product_day_id = $1`, pd.ID); n != "0" {
		t.Fatalf("%s seat rows left behind", n)
	}
	if n := countRows(t, wf, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'PURCHASE'`, poor); n != "0" {
		t.Fatalf("%s ledger rows left behind", n)
	}

	// The single seat is still free: someone who can pay gets it.
	rich := wf.user(t, "ZZFIXtkrich")
	wf.credit(t, rich, 100_000)
	tk2 := tf.newTicket(p, 1, domain.TicketStatusPaid, pd)
	tk2.UserID = &rich
	if err := tf.tickets.CreatePaidFromWallet(ctx, tk2, walletTicketDebit(rich, tk2)); err != nil {
		t.Fatalf("the seat should still be available: %v", err)
	}
	if b := wf.balance(t, rich); b != 0 {
		t.Fatalf("balance = %d, want 0", b)
	}
}

func TestWalletTicket_SoldOutDayLeavesTheWalletUntouched(t *testing.T) {
	tf := newTicketFixture(t)
	wf := newWalletFixture(t)
	ctx := context.Background()
	d1 := tf.eventDay(t, "wt-full", "2090-05-03")
	comp := tf.competition(t, "wtfull", "2090-05-03")
	p := tf.product(t, "WTFULL", 1000, 1, comp)
	pd := tf.productDay(t, p, d1)

	// Somebody else holds the only seat.
	if err := tf.tickets.Create(ctx, tf.newTicket(p, 1, domain.TicketStatusPaid, pd)); err != nil {
		t.Fatal(err)
	}

	buyer := wf.user(t, "ZZFIXtkfull")
	wf.credit(t, buyer, 500_000)
	tk := tf.newTicket(p, 1, domain.TicketStatusPaid, pd)
	tk.UserID = &buyer
	err := tf.tickets.CreatePaidFromWallet(ctx, tk, walletTicketDebit(buyer, tk))
	if err == nil || !strings.Contains(err.Error(), "remaining") {
		t.Fatalf("expected a sold-out error, got %v", err)
	}
	if b := wf.balance(t, buyer); b != 500_000 {
		t.Fatalf("a sold-out purchase moved the balance to %d", b)
	}
	if n := countRows(t, wf, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'PURCHASE'`, buyer); n != "0" {
		t.Fatalf("%s ledger rows after a sold-out purchase", n)
	}
	if got, _ := tf.tickets.GetByCode(ctx, tk.TicketCode); got != nil {
		t.Fatal("a sold-out purchase left a ticket")
	}
}

func TestWalletTicket_ConcurrentBuyersForTheLastSeatsChargeOnlyTheWinners(t *testing.T) {
	tf := newTicketFixture(t)
	wf := newWalletFixture(t)
	ctx := context.Background()
	d1 := tf.eventDay(t, "wt-race", "2090-05-04")
	comp := tf.competition(t, "wtrace", "2090-05-04")
	const seats = 3
	const buyers = 12
	p := tf.product(t, "WTRACE", 1000, seats, comp)
	pd := tf.productDay(t, p, d1)

	users := make([]string, buyers)
	for i := range users {
		users[i] = wf.user(t, "ZZFIXtkrace")
		wf.credit(t, users[i], 150_000)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	sold, soldOut := 0, 0
	var unexpected []error
	for i := 0; i < buyers; i++ {
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			tk := tf.newTicket(p, 1, domain.TicketStatusPaid, pd)
			tk.UserID = &u
			err := tf.tickets.CreatePaidFromWallet(ctx, tk, walletTicketDebit(u, tk))
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				sold++
			case strings.Contains(err.Error(), "remaining"):
				soldOut++
			default:
				unexpected = append(unexpected, err)
			}
		}(users[i])
	}
	wg.Wait()

	if len(unexpected) > 0 {
		t.Fatalf("unexpected errors: %v", unexpected)
	}
	if sold != seats || soldOut != buyers-seats {
		t.Fatalf("sold=%d soldOut=%d, want %d and %d", sold, soldOut, seats, buyers-seats)
	}

	charged := 0
	for _, u := range users {
		switch b := wf.balance(t, u); b {
		case 50_000:
			charged++
		case 150_000:
		default:
			t.Fatalf("user %s has balance %d: charged a wrong amount", u, b)
		}
	}
	if charged != seats {
		t.Fatalf("%d wallets charged for %d tickets", charged, seats)
	}
	if n := countRows(t, wf, `SELECT COUNT(*)::text FROM tickets WHERE product_id = $1`, p.ID); n != "3" {
		t.Fatalf("%s tickets created, want 3", n)
	}
	// Every debit names a ticket that exists, and every ticket has exactly one debit.
	if n := countRows(t, wf, `
		SELECT COUNT(*)::text FROM wallet_transactions w
		JOIN tickets tk ON tk.ticket_code = w.reference
		WHERE w.type = 'PURCHASE' AND tk.product_id = $1`, p.ID); n != "3" {
		t.Fatalf("%s debits match a ticket, want 3", n)
	}
	if n := countRows(t, wf, `
		SELECT COUNT(*)::text FROM wallet_transactions
		WHERE type = 'PURCHASE' AND user_id = ANY($1::uuid[])`, users); n != "3" {
		t.Fatalf("%s PURCHASE rows across the buyers, want 3", n)
	}
}
