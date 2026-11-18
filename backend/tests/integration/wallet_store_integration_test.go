package tests_integration

// Integration coverage for paying a store order with the spend wallet and for
// cancelling it: the order turning paid and the debit commit together, and a
// cancel puts back the stock and refunds exactly what the wallet paid, once.
//
// Fixtures: store products named ZZFIX*, orders with ZZFIX references, buyers
// from the wallet fixture (*@walletfixture.test). Skipped when TEST_DB_DSN is unset.

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

func cleanStoreWalletFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	// Items go with the order; the order must go before the product (RESTRICT).
	mustExec(t, pool, `DELETE FROM online_orders WHERE order_reference LIKE 'ZZFIX%'`)
	mustExec(t, pool, `DELETE FROM store_products WHERE name LIKE 'ZZFIX%'`)
}

type storeWalletFixture struct {
	*walletFixture
	store ports.IStoreRepository
}

func newStoreWalletFixture(t *testing.T) *storeWalletFixture {
	wf := newWalletFixture(t)
	cleanStoreWalletFixtures(t, wf.pool)
	// Registered after the wallet fixture's cleanup, so it runs first.
	t.Cleanup(func() { cleanStoreWalletFixtures(t, wf.pool) })
	return &storeWalletFixture{walletFixture: wf, store: ports.NewStoreRepository(wf.pool)}
}

var storeSeq int64

func storeTag() string {
	return fmt.Sprintf("%d%d", time.Now().UnixNano()%1000000, atomic.AddInt64(&storeSeq, 1))
}

func (f *storeWalletFixture) product(t *testing.T, price float64, stock int) *domain.Product {
	t.Helper()
	p, err := f.store.CreateStoreProduct(context.Background(), domain.Product{
		Name: "ZZFIX jersey", SKU: "ZZFIX-SKU-" + storeTag(), Price: price, Quantity: stock, Threshold: 1, IsActive: true,
	})
	if err != nil {
		t.Fatalf("create store product: %v", err)
	}
	return p
}

func (f *storeWalletFixture) stock(t *testing.T, productID string) string {
	t.Helper()
	return mustScan(t, f.pool, `SELECT quantity::text FROM store_products WHERE id = $1`, productID)
}

// order reserves qty of the product in a pending order, as checkout does.
func (f *storeWalletFixture) order(t *testing.T, buyer string, p *domain.Product, qty int, method string) *domain.Order {
	t.Helper()
	tag := storeTag()
	o, err := f.store.CreateOrder(context.Background(), domain.Order{
		OrderReference: "ZZFIX-ORD-" + tag, UserID: &buyer,
		CustomerName: "ZZFIX Buyer", CustomerEmail: "buyer-" + tag + walletFixtureDomain, CustomerPhone: "0800",
		ShippingCountry: "NG", ShippingState: "Lagos", ShippingCity: "Lagos", ShippingAddress: "1 Fixture Way",
		TotalAmount: p.Price * float64(qty), PaymentStatus: "pending", FulfillmentStatus: "pending",
		PaystackReference: "ZZFIX-PSK-" + tag, PaymentMethod: method,
		Items: []domain.OrderItem{{ProductID: p.ID, Quantity: qty, UnitPrice: p.Price}},
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	return o
}

func orderDebit(buyer string, o *domain.Order) domain.LedgerEntry {
	ref := o.OrderReference
	return domain.LedgerEntry{
		UserID:      buyer,
		AmountKobo:  -int64(o.TotalAmount * 100),
		Type:        domain.LedgerPurchase,
		Reference:   &ref,
		Description: "Store order " + o.OrderReference,
	}
}

func (f *storeWalletFixture) paymentStatus(t *testing.T, orderID string) string {
	t.Helper()
	return mustScan(t, f.pool, `SELECT payment_status FROM online_orders WHERE id = $1`, orderID)
}

func TestWalletStore_PayFlipsPendingToPaidAndDebitsOnce(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXshopper")
	f.credit(t, buyer, 1_000_000)
	p := f.product(t, 2_500, 10)
	o := f.order(t, buyer, p, 2, domain.PaymentMethodWallet) // 5000 naira

	if err := f.store.MarkOrderPaidFromWallet(ctx, o.ID, orderDebit(buyer, o)); err != nil {
		t.Fatalf("pay: %v", err)
	}
	if s := f.paymentStatus(t, o.ID); s != "paid" {
		t.Fatalf("payment_status = %s, want paid", s)
	}
	if b := f.balance(t, buyer); b != 500_000 {
		t.Fatalf("balance = %d, want 500000", b)
	}

	// Paying again (a retry, a double click) is refused and charges nothing.
	err := f.store.MarkOrderPaidFromWallet(ctx, o.ID, orderDebit(buyer, o))
	if !errors.Is(err, ports.ErrOrderNotPending) {
		t.Fatalf("second pay: err = %v, want ErrOrderNotPending", err)
	}
	if b := f.balance(t, buyer); b != 500_000 {
		t.Fatalf("a repeat payment moved the balance to %d", b)
	}
	if n := mustScan(t, f.pool, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'PURCHASE'`, buyer); n != "1" {
		t.Fatalf("%s PURCHASE rows, want 1", n)
	}
	if s := f.stock(t, p.ID); s != "8" {
		t.Fatalf("stock = %s, want 8", s)
	}
}

func TestWalletStore_ConcurrentPayChargesOnce(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXshopper")
	f.credit(t, buyer, 1_000_000)
	p := f.product(t, 3_000, 10)
	o := f.order(t, buyer, p, 1, domain.PaymentMethodWallet)

	var paid, notPending int32
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := f.store.MarkOrderPaidFromWallet(ctx, o.ID, orderDebit(buyer, o))
			switch {
			case err == nil:
				atomic.AddInt32(&paid, 1)
			case errors.Is(err, ports.ErrOrderNotPending):
				atomic.AddInt32(&notPending, 1)
			default:
				t.Errorf("pay: %v", err)
			}
		}()
	}
	wg.Wait()
	if paid != 1 || notPending != 9 {
		t.Fatalf("paid=%d notPending=%d, want 1 and 9", paid, notPending)
	}
	if b := f.balance(t, buyer); b != 700_000 {
		t.Fatalf("balance = %d, want 700000 (charged once)", b)
	}
}

func TestWalletStore_InsufficientLeavesOrderPendingAndNoLedger(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXshopper")
	f.credit(t, buyer, 100_000)
	p := f.product(t, 2_500, 10)
	o := f.order(t, buyer, p, 1, domain.PaymentMethodWallet) // 250000 kobo

	err := f.store.MarkOrderPaidFromWallet(ctx, o.ID, orderDebit(buyer, o))
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want ErrWalletInsufficient", err)
	}
	if s := f.paymentStatus(t, o.ID); s != "pending" {
		t.Fatalf("payment_status = %s, want pending", s)
	}
	if b := f.balance(t, buyer); b != 100_000 {
		t.Fatalf("balance = %d, want 100000", b)
	}
	if e, _ := f.wallets.FindEntry(ctx, domain.LedgerPurchase, o.OrderReference); e != nil {
		t.Fatal("a failed payment left a ledger row")
	}
	if n := mustScan(t, f.pool, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'PURCHASE'`, buyer); n != "0" {
		t.Fatalf("%s PURCHASE rows, want 0", n)
	}

	// Unknown order: refused as not pending, no money moved.
	if err := f.store.MarkOrderPaidFromWallet(ctx, "00000000-0000-0000-0000-000000000000", orderDebit(buyer, o)); !errors.Is(err, ports.ErrOrderNotPending) {
		t.Fatalf("unknown order: err = %v, want ErrOrderNotPending", err)
	}
}

func TestWalletStore_ConcurrentCancelRestoresStockAndRefundsOnce(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXshopper")
	f.credit(t, buyer, 1_000_000)
	p := f.product(t, 1_500, 10)
	o := f.order(t, buyer, p, 3, domain.PaymentMethodWallet) // 4500 naira
	if err := f.store.MarkOrderPaidFromWallet(ctx, o.ID, orderDebit(buyer, o)); err != nil {
		t.Fatal(err)
	}
	if b := f.balance(t, buyer); b != 550_000 {
		t.Fatalf("balance after pay = %d, want 550000", b)
	}
	if s := f.stock(t, p.ID); s != "7" {
		t.Fatalf("stock after order = %s, want 7", s)
	}

	var total int64
	var refunders int32
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			got, err := f.store.CancelOrderAndRefundWallet(ctx, o.ID, "ZZFIX refund")
			if err != nil {
				t.Errorf("cancel: %v", err)
				return
			}
			if got > 0 {
				atomic.AddInt64(&total, got)
				atomic.AddInt32(&refunders, 1)
			}
		}()
	}
	wg.Wait()

	if refunders != 1 || total != 450_000 {
		t.Fatalf("%d calls refunded a total of %d, want 1 call refunding 450000", refunders, total)
	}
	if b := f.balance(t, buyer); b != 1_000_000 {
		t.Fatalf("balance = %d, want 1000000", b)
	}
	if s := f.stock(t, p.ID); s != "10" {
		t.Fatalf("stock = %s, want 10 (restored once)", s)
	}
	if fs := mustScan(t, f.pool, `SELECT fulfillment_status FROM online_orders WHERE id = $1`, o.ID); fs != "cancelled" {
		t.Fatalf("fulfillment_status = %s, want cancelled", fs)
	}
	refund, err := f.wallets.FindEntry(ctx, domain.LedgerRefund, "REFUND-"+o.OrderReference)
	if err != nil || refund == nil || refund.AmountKobo != 450_000 || refund.UserID != buyer {
		t.Fatalf("refund row: %+v %v", refund, err)
	}
	if n := mustScan(t, f.pool, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'REFUND'`, buyer); n != "1" {
		t.Fatalf("%s REFUND rows, want 1", n)
	}
	if sum := mustScan(t, f.pool, `SELECT COALESCE(SUM(amount_kobo),0)::text FROM wallet_transactions WHERE user_id = $1`, buyer); sum != "1000000" {
		t.Fatalf("ledger sums to %s, want 1000000", sum)
	}

	// Unknown order is reported as not found.
	if _, err := f.store.CancelOrderAndRefundWallet(ctx, "00000000-0000-0000-0000-000000000000", "x"); err == nil {
		t.Fatal("cancelling an unknown order should fail")
	}
}

func TestWalletStore_CancelRefundsThePayerNotSomeoneElse(t *testing.T) {
	// The refund goes to whoever the PURCHASE row charged, read from the ledger.
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXshopper")
	f.credit(t, buyer, 300_000)
	p := f.product(t, 1_000, 5)
	o := f.order(t, buyer, p, 2, domain.PaymentMethodWallet)
	if err := f.store.MarkOrderPaidFromWallet(ctx, o.ID, orderDebit(buyer, o)); err != nil {
		t.Fatal(err)
	}
	// The order is reassigned (user deleted -> SET NULL, say) before the cancel.
	mustExec(t, f.pool, `UPDATE online_orders SET user_id = NULL WHERE id = $1`, o.ID)
	got, err := f.store.CancelOrderAndRefundWallet(ctx, o.ID, "ZZFIX refund")
	if err != nil || got != 200_000 {
		t.Fatalf("refund = %d err = %v, want 200000", got, err)
	}
	if b := f.balance(t, buyer); b != 300_000 {
		t.Fatalf("balance = %d, want 300000", b)
	}
}

func TestWalletStore_CancelOfAPendingWalletOrderRefundsNothing(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXshopper")
	f.credit(t, buyer, 100_000)
	p := f.product(t, 2_500, 4)
	o := f.order(t, buyer, p, 1, domain.PaymentMethodWallet) // never paid

	got, err := f.store.CancelOrderAndRefundWallet(ctx, o.ID, "ZZFIX refund")
	if err != nil || got != 0 {
		t.Fatalf("refund = %d err = %v, want 0", got, err)
	}
	if b := f.balance(t, buyer); b != 100_000 {
		t.Fatalf("balance = %d, want 100000", b)
	}
	if s := f.stock(t, p.ID); s != "4" {
		t.Fatalf("stock = %s, want 4 (restored)", s)
	}
}

func TestWalletStore_CancelOfAPaystackOrderRefundsNothing(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXcardbuyer")
	f.credit(t, buyer, 200_000)
	p := f.product(t, 2_000, 6)
	o := f.order(t, buyer, p, 2, domain.PaymentMethodPaystack)
	mustExec(t, f.pool, `UPDATE online_orders SET payment_status = 'paid' WHERE id = $1`, o.ID)

	// Even with a wallet PURCHASE row that happens to share the reference, a card
	// order never refunds to the wallet.
	ref := o.OrderReference
	if _, err := f.wallets.Apply(ctx, domain.LedgerEntry{
		UserID: buyer, AmountKobo: -1_000, Type: domain.LedgerPurchase, Reference: &ref, Description: "ZZFIX unrelated",
	}); err != nil {
		t.Fatal(err)
	}
	before := f.balance(t, buyer)

	got, err := f.store.CancelOrderAndRefundWallet(ctx, o.ID, "ZZFIX refund")
	if err != nil || got != 0 {
		t.Fatalf("refund = %d err = %v, want 0", got, err)
	}
	if b := f.balance(t, buyer); b != before {
		t.Fatalf("a card order refunded to the wallet: %d -> %d", before, b)
	}
	if n := mustScan(t, f.pool, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'REFUND'`, buyer); n != "0" {
		t.Fatalf("%s REFUND rows, want 0", n)
	}
	if s := f.stock(t, p.ID); s != "6" {
		t.Fatalf("stock = %s, want 6 (restored)", s)
	}
	if fs := mustScan(t, f.pool, `SELECT fulfillment_status FROM online_orders WHERE id = $1`, o.ID); fs != "cancelled" {
		t.Fatalf("fulfillment_status = %s, want cancelled", fs)
	}
}

// An order cancelled before its payment lands (an admin cancel racing the
// checkout) must not be charged.
func TestWalletStore_CancelledOrderCannotBePaid(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXlate")
	f.credit(t, buyer, 1_000_000)
	p := f.product(t, 2_000, 5)
	o := f.order(t, buyer, p, 1, domain.PaymentMethodWallet)

	if _, err := f.store.CancelOrderAndRefundWallet(ctx, o.ID, "ZZFIX refund"); err != nil {
		t.Fatal(err)
	}
	err := f.store.MarkOrderPaidFromWallet(ctx, o.ID, orderDebit(buyer, o))
	if !errors.Is(err, ports.ErrOrderNotPending) {
		t.Fatalf("err = %v, want ErrOrderNotPending", err)
	}
	if b := f.balance(t, buyer); b != 1_000_000 {
		t.Fatalf("balance = %d, want 1000000 (nothing charged)", b)
	}
	if s := f.paymentStatus(t, o.ID); s != "pending" {
		t.Fatalf("payment_status = %s, want pending", s)
	}
}

func TestWalletStore_StaleListFindsOnlyOldUnpaidWalletOrders(t *testing.T) {
	f := newStoreWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXstale")
	f.credit(t, buyer, 1_000_000)
	p := f.product(t, 1_000, 20)

	old := f.order(t, buyer, p, 1, domain.PaymentMethodWallet)
	fresh := f.order(t, buyer, p, 1, domain.PaymentMethodWallet)
	paid := f.order(t, buyer, p, 1, domain.PaymentMethodWallet)
	card := f.order(t, buyer, p, 1, domain.PaymentMethodPaystack)
	for _, o := range []*domain.Order{old, paid, card} {
		mustExec(t, f.pool, `UPDATE online_orders SET created_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, o.ID)
	}
	mustExec(t, f.pool, `UPDATE online_orders SET payment_status = 'paid' WHERE id = $1`, paid.ID)

	ids, err := f.store.ListStaleWalletOrderIDs(ctx, time.Now().Add(-15*time.Minute), 100)
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]bool{}
	for _, id := range ids {
		found[id] = true
	}
	if !found[old.ID] {
		t.Fatal("the old unpaid wallet order should be listed")
	}
	if found[fresh.ID] || found[paid.ID] || found[card.ID] {
		t.Fatalf("fresh, paid and card orders must not be listed: %v", found)
	}

	// Abandoning it returns the stock and a late payment then fails cleanly.
	if err := f.store.MarkOrderFailedAndRestoreStock(ctx, old.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.store.MarkOrderPaidFromWallet(ctx, old.ID, orderDebit(buyer, old)); !errors.Is(err, ports.ErrOrderNotPending) {
		t.Fatalf("paying an abandoned order: %v, want ErrOrderNotPending", err)
	}
}
