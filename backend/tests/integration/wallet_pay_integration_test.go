package tests_integration

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
)

// Pay is what tickets, the store and league entry call. The same order reference
// reaching it many times at once (retries, double-clicks) must take the money once.
func TestWallet_PayChargesOnceUnderConcurrentCalls(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	svc := services.NewWalletService(f.wallets, nil, nil, nil)
	u := f.user(t, "ZZFIXpay")
	f.credit(t, u, 10_000)

	var paid, repeats int32
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := svc.Pay(ctx, u, 3_000, "ZZFIX-ORDER-1", "order")
			if err != nil {
				t.Errorf("pay: %v", err)
				return
			}
			if ok {
				atomic.AddInt32(&paid, 1)
			} else {
				atomic.AddInt32(&repeats, 1)
			}
		}()
	}
	wg.Wait()

	if paid != 1 || repeats != 19 {
		t.Fatalf("applied=%d repeats=%d, want 1 and 19", paid, repeats)
	}
	if b := f.balance(t, u); b != 7_000 {
		t.Fatalf("balance = %d, want 7000 (charged once)", b)
	}
}

func TestWallet_RefundOnlyAfterPaymentAndOnlyOnce(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	svc := services.NewWalletService(f.wallets, nil, nil, nil)
	u := f.user(t, "ZZFIXrefund")
	f.credit(t, u, 5_000)

	// Nothing was paid for this reference, so there is nothing to give back.
	if ok, err := svc.Refund(ctx, u, 1_000, "ZZFIX-NEVER", "x"); err != nil || ok {
		t.Fatalf("refund without payment: ok=%v err=%v", ok, err)
	}
	if b := f.balance(t, u); b != 5_000 {
		t.Fatalf("balance = %d, want 5000", b)
	}

	if _, err := svc.Pay(ctx, u, 2_000, "ZZFIX-ORDER-2", "order"); err != nil {
		t.Fatal(err)
	}

	var refunded int32
	var wg sync.WaitGroup
	for i := 0; i < 15; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := svc.Refund(ctx, u, 2_000, "ZZFIX-ORDER-2", "refund")
			if err != nil {
				t.Errorf("refund: %v", err)
				return
			}
			if ok {
				atomic.AddInt32(&refunded, 1)
			}
		}()
	}
	wg.Wait()

	if refunded != 1 {
		t.Fatalf("refunded %d times, want 1", refunded)
	}
	if b := f.balance(t, u); b != 5_000 {
		t.Fatalf("balance = %d, want 5000 (paid then refunded once)", b)
	}
	if sum := mustScan(t, f.pool, `SELECT COALESCE(SUM(amount_kobo),0)::text FROM wallet_transactions WHERE user_id = $1`, u); sum != "5000" {
		t.Fatalf("ledger sums to %s, want 5000", sum)
	}
}

func TestWallet_PayRefusesWhenShortAndLeavesNoTrace(t *testing.T) {
	f := newWalletFixture(t)
	svc := services.NewWalletService(f.wallets, nil, nil, nil)
	u := f.user(t, "ZZFIXshort")
	f.credit(t, u, 500)

	_, err := svc.Pay(context.Background(), u, 900, "ZZFIX-ORDER-3", "order")
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want insufficient", err)
	}
	if e, _ := f.wallets.FindEntry(context.Background(), domain.LedgerPurchase, "ZZFIX-ORDER-3"); e != nil {
		t.Fatal("a failed payment left a ledger row behind")
	}
	if b := f.balance(t, u); b != 500 {
		t.Fatalf("balance = %d, want 500", b)
	}
}
