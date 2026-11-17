package services

import (
	"context"
	"errors"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
)

// ─── Paying for store orders from the wallet ──────────────────────────────────

func TestNairaToKoboRoundsToTheNearestKobo(t *testing.T) {
	cases := []struct {
		naira float64
		want  int64
	}{
		{0, 0},
		{1, 100},
		{1234.56, 123456},    // 1234.56*100 = 123456.00000000001
		{0.1 + 0.2, 30},      // 0.30000000000000004
		{19.99, 1999},        // 19.99*100 = 1998.9999999999998
		{4.35, 435},          // 4.35*100 = 434.99999999999994
		{2500.5 * 2, 500100}, // exact
		{0.005, 1},           // half a kobo rounds up, never truncates to 0
		{0.004, 0},           // under half a kobo is nothing
		{1e6 + 0.07, 100000007},
	}
	for _, c := range cases {
		if got := nairaToKobo(c.naira); got != c.want {
			t.Errorf("nairaToKobo(%v) = %d, want %d", c.naira, got, c.want)
		}
	}
}

// storeFakeWallet switches wallet payment on. Store payments and refunds happen
// inside the order's own database transaction (storeFakeRepo below), so the
// service must never call Pay or Refund directly.
type storeFakeWallet struct{ calls int }

func (f *storeFakeWallet) Pay(context.Context, string, int64, string, string) (bool, error) {
	f.calls++
	return false, errors.New("store orders must not call Pay")
}

func (f *storeFakeWallet) Refund(context.Context, string, int64, string, string) (bool, error) {
	f.calls++
	return false, errors.New("store orders must not call Refund")
}

// storeFakeRepo is a one-product store that reserves and restores stock, and
// pays and refunds from one buyer's wallet, the way the real repository does:
// each money movement commits together with the order change or not at all.
type storeFakeRepo struct {
	ports.IStoreRepository
	product   domain.Product
	orders    map[string]*domain.Order
	createErr error
	// payErr makes the wallet payment fail (after nothing moved).
	payErr  error
	balance int64
	debits  []domain.LedgerEntry
	refunds []int64
}

func newStoreFakeRepo(price float64, stock int) *storeFakeRepo {
	return &storeFakeRepo{
		product: domain.Product{ID: "prod-1", Name: "Jersey", Price: price, Quantity: stock, IsActive: true},
		orders:  map[string]*domain.Order{},
		balance: 1_000_000_00,
	}
}

func (r *storeFakeRepo) GetStoreProduct(_ context.Context, _ string) (*domain.Product, error) {
	p := r.product
	return &p, nil
}

func (r *storeFakeRepo) CreateOrder(_ context.Context, o domain.Order) (*domain.Order, error) {
	if r.createErr != nil {
		return nil, r.createErr
	}
	for _, it := range o.Items {
		if r.product.Quantity < it.Quantity {
			return nil, appErrors.ErrInsufficientStock
		}
		r.product.Quantity -= it.Quantity
	}
	o.ID = "order-1"
	r.orders[o.ID] = &o
	cp := o
	return &cp, nil
}

func (r *storeFakeRepo) GetOrder(_ context.Context, id string) (*domain.Order, error) {
	o, ok := r.orders[id]
	if !ok {
		return nil, appErrors.ErrNotFound
	}
	cp := *o
	return &cp, nil
}

func (r *storeFakeRepo) UpdateOrderPaymentStatus(_ context.Context, id, status string) error {
	r.orders[id].PaymentStatus = status
	return nil
}

func (r *storeFakeRepo) MarkOrderPaidFromWallet(_ context.Context, id string, debit domain.LedgerEntry) error {
	if r.payErr != nil {
		return r.payErr
	}
	o := r.orders[id]
	if o.PaymentStatus != "pending" {
		return ports.ErrOrderNotPending
	}
	if r.balance+debit.AmountKobo < 0 {
		return ports.ErrWalletInsufficient
	}
	r.balance += debit.AmountKobo
	r.debits = append(r.debits, debit)
	o.PaymentStatus = "paid"
	return nil
}

func (r *storeFakeRepo) restore(o *domain.Order) {
	for _, it := range o.Items {
		r.product.Quantity += it.Quantity
	}
}

func (r *storeFakeRepo) MarkOrderFailedAndRestoreStock(_ context.Context, id string) error {
	o := r.orders[id]
	if o.PaymentStatus != "pending" {
		return nil
	}
	r.restore(o)
	o.PaymentStatus = "failed"
	return nil
}

func (r *storeFakeRepo) CancelOrderAndRestoreStock(_ context.Context, id string) error {
	o, ok := r.orders[id]
	if !ok {
		return appErrors.ErrNotFound
	}
	if o.FulfillmentStatus == "cancelled" {
		return nil
	}
	r.restore(o)
	o.FulfillmentStatus = "cancelled"
	return nil
}

func (r *storeFakeRepo) CancelOrderAndRefundWallet(ctx context.Context, id, _ string) (int64, error) {
	if err := r.CancelOrderAndRestoreStock(ctx, id); err != nil {
		return 0, err
	}
	o := r.orders[id]
	if o.PaymentMethod != domain.PaymentMethodWallet || o.PaymentStatus != "paid" || len(r.debits) == 0 || len(r.refunds) > 0 {
		return 0, nil
	}
	back := -r.debits[0].AmountKobo
	r.balance += back
	r.refunds = append(r.refunds, back)
	return back, nil
}

func (r *storeFakeRepo) ListSavedAddresses(_ context.Context, _ string) ([]domain.SavedAddress, error) {
	return nil, nil
}

func (r *storeFakeRepo) SaveAddress(_ context.Context, a domain.SavedAddress) (*domain.SavedAddress, error) {
	return &a, nil
}

// storeFakeDiscountRepo counts the code settlements and releases.
type storeFakeDiscountRepo struct {
	ports.IDiscountRepository
	confirmed, released int
}

func (d *storeFakeDiscountRepo) ConfirmRedemption(_ context.Context, _, _ *string) error {
	d.confirmed++
	return nil
}

func (d *storeFakeDiscountRepo) ReleaseRedemption(_ context.Context, _, _ *string) error {
	d.released++
	return nil
}

type storeWalletRig struct {
	svc      *StoreService
	repo     *storeFakeRepo
	wallet   *storeFakeWallet
	discount *storeFakeDiscountRepo
}

// newStoreWalletRig builds a store service with no Paystack client and no email
// service on purpose: a Paystack call would panic, so a wallet order that reaches
// for one fails the test loudly.
func newStoreWalletRig(t *testing.T, price float64, stock int) *storeWalletRig {
	t.Helper()
	t.Setenv("RESEND_API_KEY", "") // the confirmation emails are skipped
	repo := newStoreFakeRepo(price, stock)
	wallet := &storeFakeWallet{}
	discount := &storeFakeDiscountRepo{}
	svc := NewStoreService(repo, nil, nil, nil, nil, discount, nil).(*StoreService).WithWallet(wallet)
	return &storeWalletRig{svc: svc, repo: repo, wallet: wallet, discount: discount}
}

func walletCheckout(qty int) dto.CheckoutRequest {
	return dto.CheckoutRequest{
		CustomerName: "Ada", CustomerEmail: "ada@example.com", CustomerPhone: "0801",
		ShippingCountry: "NG", ShippingState: "Lagos", ShippingCity: "Ikeja", ShippingAddress: "1 Road",
		Items:         []dto.OrderItemRequest{{ProductID: "prod-1", Quantity: qty}},
		PayWithWallet: true,
	}
}

func (r *storeWalletRig) onlyOrder(t *testing.T) *domain.Order {
	t.Helper()
	if len(r.repo.orders) != 1 {
		t.Fatalf("expected exactly one order row, got %d", len(r.repo.orders))
	}
	return r.repo.orders["order-1"]
}

func TestWalletCheckoutPaysOnceAndConfirmsTheOrder(t *testing.T) {
	rig := newStoreWalletRig(t, 2500.50, 10)

	res, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(2))
	if err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	if !res.Paid || res.PaystackURL != "" || res.PaystackRef != "" || res.PaystackAccessCode != "" {
		t.Fatalf("expected an already-confirmed response with no Paystack parts, got %+v", res)
	}
	order := rig.onlyOrder(t)
	if res.OrderReference != order.OrderReference {
		t.Fatalf("response reference %q does not match the order %q", res.OrderReference, order.OrderReference)
	}
	if order.PaymentStatus != "paid" || order.PaymentMethod != domain.PaymentMethodWallet {
		t.Fatalf("order should be paid by wallet, got status %q method %q", order.PaymentStatus, order.PaymentMethod)
	}
	if rig.repo.product.Quantity != 8 {
		t.Fatalf("stock should stay reserved (8 left), got %d", rig.repo.product.Quantity)
	}
	if len(rig.repo.debits) != 1 {
		t.Fatalf("expected exactly one wallet debit, got %d", len(rig.repo.debits))
	}
	d := rig.repo.debits[0]
	if d.UserID != "user-1" || d.AmountKobo != -500100 || d.Reference == nil || *d.Reference != order.OrderReference {
		t.Fatalf("debit should be 500100 kobo on the order reference for user-1, got %+v", d)
	}
	if rig.discount.confirmed != 1 {
		t.Fatalf("the code hold should be settled once, got %d", rig.discount.confirmed)
	}
	if rig.wallet.calls != 0 {
		t.Fatal("the wallet service must not be called directly")
	}
}

func TestWalletCheckoutTooLowTakesNothingAndReleasesTheOrder(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.repo.balance = 999_00

	_, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1))
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want ErrWalletInsufficient", err)
	}
	order := rig.onlyOrder(t)
	if order.PaymentStatus != "failed" {
		t.Fatalf("the order should be marked failed, got %q", order.PaymentStatus)
	}
	if rig.repo.product.Quantity != 5 {
		t.Fatalf("stock should be back to 5, got %d", rig.repo.product.Quantity)
	}
	if len(rig.repo.debits) != 0 || rig.repo.balance != 999_00 {
		t.Fatal("nothing should be charged")
	}
	if rig.discount.released != 1 {
		t.Fatalf("the code hold should be released, got %d", rig.discount.released)
	}
}

func TestWalletCheckoutFailureChargesNothingAndReleasesTheOrder(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.repo.payErr = errors.New("database is down")

	if _, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1)); err == nil {
		t.Fatal("the failure should be returned")
	}
	if order := rig.onlyOrder(t); order.PaymentStatus != "failed" {
		t.Fatalf("the order should be abandoned, got %q", order.PaymentStatus)
	}
	if len(rig.repo.debits) != 0 || rig.repo.product.Quantity != 5 {
		t.Fatal("no charge and stock restored expected")
	}
}

func TestWalletCheckoutRejectsGuestsBeforeTouchingAnything(t *testing.T) {
	for _, user := range []*string{nil, strp(""), strp("  ")} {
		rig := newStoreWalletRig(t, 1000, 5)
		_, err := rig.svc.CreateOrder(context.Background(), user, walletCheckout(1))
		if !errors.Is(err, ErrStoreWalletSignIn) {
			t.Fatalf("err = %v, want ErrStoreWalletSignIn", err)
		}
		if len(rig.repo.orders) != 0 || rig.repo.product.Quantity != 5 || len(rig.repo.debits) != 0 {
			t.Fatal("a guest must not reserve stock, create an order or be charged")
		}
	}
}

func TestWalletCheckoutNeedsAWalletToBeWired(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.svc.wallet = nil

	if _, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1)); !errors.Is(err, ErrStoreWalletUnavailable) {
		t.Fatalf("err = %v, want ErrStoreWalletUnavailable", err)
	}
	if len(rig.repo.orders) != 0 {
		t.Fatal("no order without a wallet")
	}
}

func TestWalletCheckoutOfAFreeOrderDebitsNothing(t *testing.T) {
	rig := newStoreWalletRig(t, 0, 5)

	res, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1))
	if err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	if res.Paid {
		t.Fatal("a free order goes through the free path, not the wallet one")
	}
	order := rig.onlyOrder(t)
	if order.PaymentMethod != domain.PaymentMethodFree || order.PaymentStatus != "paid" {
		t.Fatalf("expected a paid free order, got %q / %q", order.PaymentMethod, order.PaymentStatus)
	}
	if len(rig.repo.debits) != 0 {
		t.Fatal("nothing to debit")
	}
}

func TestCancellingAWalletOrderRefundsOnceAndRestocksOnce(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	if _, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(2)); err != nil {
		t.Fatal(err)
	}
	start := rig.repo.balance

	for i := 0; i < 2; i++ {
		if _, err := rig.svc.CancelOrder(context.Background(), "order-1"); err != nil {
			t.Fatalf("cancel %d: %v", i+1, err)
		}
	}
	if len(rig.repo.refunds) != 1 || rig.repo.refunds[0] != 200000 {
		t.Fatalf("want one refund of 200000 kobo, got %v", rig.repo.refunds)
	}
	if rig.repo.balance != start+200000 {
		t.Fatalf("balance should be back up by the order total")
	}
	if rig.repo.product.Quantity != 5 {
		t.Fatalf("stock should be restored once (5), got %d", rig.repo.product.Quantity)
	}
}

func TestCancellingAPaystackOrderNeverTouchesTheWallet(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.repo.orders["order-1"] = &domain.Order{ID: "order-1", OrderReference: "SFFL-ORD-1",
		UserID: strp("user-1"), PaymentStatus: "paid", PaymentMethod: domain.PaymentMethodPaystack, TotalAmount: 1000}

	if _, err := rig.svc.CancelOrder(context.Background(), "order-1"); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if len(rig.repo.refunds) != 0 {
		t.Fatal("a card order must not be refunded to the wallet")
	}
	if rig.repo.orders["order-1"].FulfillmentStatus != "cancelled" {
		t.Fatal("the order should still be cancelled")
	}
}

func TestCancellingAnUnpaidWalletOrderDoesNotRefund(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.repo.balance = 0
	_, _ = rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1)) // fails: short

	if _, err := rig.svc.CancelOrder(context.Background(), "order-1"); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if len(rig.repo.refunds) != 0 || rig.repo.balance != 0 {
		t.Fatal("nothing was paid, so nothing may come back")
	}
}
