package tests_integration

// Integration coverage for moving Fantasy prize winnings into the spend wallet
// (migration 131). Needs a database migrated with `goose ... up`; skipped when
// TEST_DB_DSN is unset. Reuses the wallet fixtures from
// wallet_voucher_integration_test.go.

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

type transferFixture struct {
	*walletFixture
	prizes ports.IFantasyPayoutRepository
}

func newTransferFixture(t *testing.T) *transferFixture {
	f := newWalletFixture(t)
	return &transferFixture{walletFixture: f, prizes: ports.NewFantasyPayoutRepository(f.pool)}
}

func (f *transferFixture) win(t *testing.T, userID string, kobo int64) {
	t.Helper()
	if err := f.prizes.CreditWallet(context.Background(), domain.WalletTransaction{
		UserID: userID, AmountKobo: kobo, Type: domain.WalletAdjustment, Description: "fixture",
	}); err != nil {
		t.Fatalf("seed prize wallet: %v", err)
	}
}

func (f *transferFixture) prizeBalance(t *testing.T, userID string) int64 {
	t.Helper()
	w, err := f.prizes.GetWallet(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	return w.BalanceKobo
}

func (f *transferFixture) count(t *testing.T, sql string, args ...any) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

const noCap = int64(0)

func TestFantasyTransfer_MovesBothBalancesTogether(t *testing.T) {
	f := newTransferFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXtransfer")
	f.win(t, u, 500000)
	f.credit(t, u, 25000) // the spend wallet already holds something

	res, err := f.prizes.TransferToSpendWallet(ctx, u, 200000, "FTR-test-1", 100_000_000)
	if err != nil {
		t.Fatalf("transfer: %v", err)
	}
	if res.PrizeBalanceKobo != 300000 || res.SpendBalanceKobo != 225000 {
		t.Errorf("result reports %d / %d, want 300000 / 225000", res.PrizeBalanceKobo, res.SpendBalanceKobo)
	}
	if got := f.prizeBalance(t, u); got != 300000 {
		t.Errorf("prize wallet = %d, want 300000", got)
	}
	if got := f.balance(t, u); got != 225000 {
		t.Errorf("spend wallet = %d, want 225000", got)
	}

	// Each ledger has one row, carrying the same reference and opposite signs.
	var prizeAmt int64
	var prizeType string
	if err := f.pool.QueryRow(ctx, `SELECT amount_kobo, type FROM fantasy_wallet_transactions WHERE reference = 'FTR-test-1'`).
		Scan(&prizeAmt, &prizeType); err != nil {
		t.Fatalf("prize ledger row: %v", err)
	}
	if prizeAmt != -200000 || prizeType != string(domain.WalletTransfer) {
		t.Errorf("prize ledger row = %d %s", prizeAmt, prizeType)
	}
	entry, err := f.wallets.FindEntry(ctx, domain.LedgerFantasyTransfer, "FTR-test-1")
	if err != nil || entry == nil {
		t.Fatalf("spend ledger row missing: %v", err)
	}
	if entry.AmountKobo != 200000 || entry.BalanceAfterKobo != 225000 || entry.UserID != u {
		t.Errorf("spend ledger row = %+v", entry)
	}
}

func TestFantasyTransfer_OverdrawAndBadInputMoveNothing(t *testing.T) {
	f := newTransferFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXover")
	f.win(t, u, 1000)

	if _, err := f.prizes.TransferToSpendWallet(ctx, u, 1001, "FTR-over", noCap); !errors.Is(err, ports.ErrTransferInsufficient) {
		t.Fatalf("want ErrTransferInsufficient, got %v", err)
	}
	if _, err := f.prizes.TransferToSpendWallet(ctx, u, 0, "FTR-zero", noCap); err == nil {
		t.Error("a zero transfer should be refused")
	}
	if _, err := f.prizes.TransferToSpendWallet(ctx, u, -5, "FTR-neg", noCap); err == nil {
		t.Error("a negative transfer should be refused (it would pull money back out of the spend wallet)")
	}
	if f.prizeBalance(t, u) != 1000 || f.balance(t, u) != 0 {
		t.Errorf("balances moved: prize %d spend %d", f.prizeBalance(t, u), f.balance(t, u))
	}
}

func TestFantasyTransfer_ConcurrentTransfersCannotOverdrawThePrizeWallet(t *testing.T) {
	f := newTransferFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXrace")
	f.win(t, u, 1000)

	var ok, short int32
	var wg sync.WaitGroup
	for i := 0; i < 25; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := f.prizes.TransferToSpendWallet(ctx, u, 100, fmt.Sprintf("FTR-race-%d", i), noCap)
			switch {
			case err == nil:
				atomic.AddInt32(&ok, 1)
			case errors.Is(err, ports.ErrTransferInsufficient):
				atomic.AddInt32(&short, 1)
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}(i)
	}
	wg.Wait()

	if ok != 10 || short != 15 {
		t.Errorf("want exactly 10 transfers to win, got %d ok / %d refused", ok, short)
	}
	if f.prizeBalance(t, u) != 0 || f.balance(t, u) != 1000 {
		t.Errorf("prize %d spend %d, want 0 / 1000", f.prizeBalance(t, u), f.balance(t, u))
	}
	if n := f.count(t, `SELECT COUNT(*) FROM wallet_transactions WHERE user_id = $1 AND type = 'FANTASY_TRANSFER'`, u); n != 10 {
		t.Errorf("%d spend ledger rows, want 10", n)
	}
	if n := f.count(t, `SELECT COUNT(*) FROM fantasy_wallet_transactions WHERE user_id = $1 AND type = 'WALLET_TRANSFER'`, u); n != 10 {
		t.Errorf("%d prize ledger rows, want 10", n)
	}
}

// Transfers racing a top-up credit, a purchase debit and a payout request on the
// same user must all finish (no deadlock) and leave both wallets exactly
// reconcilable with their ledgers.
func TestFantasyTransfer_NoDeadlockAgainstOtherWalletTraffic(t *testing.T) {
	f := newTransferFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXmix")
	f.win(t, u, 100000)
	f.credit(t, u, 100000)

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(3)
		go func(i int) {
			defer wg.Done()
			_, _ = f.prizes.TransferToSpendWallet(ctx, u, 100, fmt.Sprintf("FTR-mix-%d", i), noCap)
		}(i)
		go func() {
			defer wg.Done()
			_, _ = f.wallets.Apply(ctx, domain.LedgerEntry{UserID: u, AmountKobo: -50, Type: domain.LedgerPurchase, Description: "mix"})
		}()
		go func() {
			defer wg.Done()
			_, _ = f.wallets.Apply(ctx, domain.LedgerEntry{UserID: u, AmountKobo: 70, Type: domain.LedgerAdjustment, Description: "mix"})
		}()
	}
	wg.Wait()

	for _, c := range []struct{ name, bal, ledger string }{
		{"spend", `SELECT balance_kobo FROM wallets WHERE user_id = $1`,
			`SELECT COALESCE(SUM(amount_kobo),0) FROM wallet_transactions WHERE user_id = $1`},
		{"prize", `SELECT balance_kobo FROM fantasy_wallets WHERE user_id = $1`,
			`SELECT COALESCE(SUM(amount_kobo),0) FROM fantasy_wallet_transactions WHERE user_id = $1`},
	} {
		var bal, sum int64
		if err := f.pool.QueryRow(ctx, c.bal, u).Scan(&bal); err != nil {
			t.Fatal(err)
		}
		if err := f.pool.QueryRow(ctx, c.ledger, u).Scan(&sum); err != nil {
			t.Fatal(err)
		}
		if bal != sum {
			t.Errorf("%s wallet balance %d does not match its ledger %d", c.name, bal, sum)
		}
	}
}

func TestFantasyTransfer_SpendWalletCapIsHard(t *testing.T) {
	f := newTransferFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXcap")
	f.win(t, u, 100000)
	f.credit(t, u, 9000)

	if _, err := f.prizes.TransferToSpendWallet(ctx, u, 1001, "FTR-cap-1", 10000); !errors.Is(err, ports.ErrSpendWalletFull) {
		t.Fatalf("want ErrSpendWalletFull, got %v", err)
	}
	if f.prizeBalance(t, u) != 100000 || f.balance(t, u) != 9000 {
		t.Errorf("a refused transfer moved money: prize %d spend %d", f.prizeBalance(t, u), f.balance(t, u))
	}
	if _, err := f.prizes.TransferToSpendWallet(ctx, u, 1000, "FTR-cap-2", 10000); err != nil {
		t.Fatalf("a transfer that lands exactly on the cap should work: %v", err)
	}

	// Concurrent transfers cannot jointly overshoot the cap.
	v := f.user(t, "ZZFIXcap2")
	f.win(t, v, 100000)
	var ok int32
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if _, err := f.prizes.TransferToSpendWallet(ctx, v, 100, fmt.Sprintf("FTR-cap-race-%d", i), 500); err == nil {
				atomic.AddInt32(&ok, 1)
			}
		}(i)
	}
	wg.Wait()
	if ok != 5 || f.balance(t, v) != 500 || f.prizeBalance(t, v) != 99500 {
		t.Errorf("cap overshot or undershot: %d ok, spend %d, prize %d", ok, f.balance(t, v), f.prizeBalance(t, v))
	}
}

// The prize wallet is debited before the spend wallet is credited. If the credit
// fails, the debit must go with it. A trigger that rejects this user's
// FANTASY_TRANSFER ledger row makes the credit fail for real, after the debit.
func TestFantasyTransfer_FailedCreditLeavesThePrizeWalletUntouched(t *testing.T) {
	f := newTransferFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXfail")
	f.win(t, u, 500000)

	mustExec(t, f.pool, `
		CREATE OR REPLACE FUNCTION zzfix_reject_transfer() RETURNS trigger AS $$
		BEGIN
			IF NEW.type = 'FANTASY_TRANSFER' AND NEW.user_id = '`+u+`' THEN
				RAISE EXCEPTION 'zzfix: credit rejected';
			END IF;
			RETURN NEW;
		END $$ LANGUAGE plpgsql`)
	mustExec(t, f.pool, `CREATE TRIGGER zzfix_reject_transfer BEFORE INSERT ON wallet_transactions
		FOR EACH ROW EXECUTE FUNCTION zzfix_reject_transfer()`)
	t.Cleanup(func() {
		mustExec(t, f.pool, `DROP TRIGGER IF EXISTS zzfix_reject_transfer ON wallet_transactions`)
		mustExec(t, f.pool, `DROP FUNCTION IF EXISTS zzfix_reject_transfer()`)
	})

	_, err := f.prizes.TransferToSpendWallet(ctx, u, 200000, "FTR-fail-1", noCap)
	if err == nil || !strings.Contains(err.Error(), "credit rejected") {
		t.Fatalf("want the credit to fail, got %v", err)
	}
	if got := f.prizeBalance(t, u); got != 500000 {
		t.Errorf("prize wallet = %d after a failed credit, want 500000", got)
	}
	if got := f.balance(t, u); got != 0 {
		t.Errorf("spend wallet = %d after a failed credit, want 0", got)
	}
	if n := f.count(t, `SELECT COUNT(*) FROM fantasy_wallet_transactions WHERE user_id = $1 AND type = 'WALLET_TRANSFER'`, u); n != 0 {
		t.Errorf("%d orphan prize ledger rows left behind", n)
	}
}
