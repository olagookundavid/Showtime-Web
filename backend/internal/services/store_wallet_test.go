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

// storeFakeWallet records what the store asks of the wallet.
type storeFakeWallet struct {
	payErr    error
	refundErr error
	pays      []storeWalletCall
	refunds   []storeWalletCall
}

type storeWalletCall struct {
	userID    string
	amount    int64
	reference string
}

func (f *storeFakeWallet) Pay(_ context.Context, userID string, amountKobo int64, reference, _ string) (bool, error) {
	if f.payErr != nil {
		return false, f.payErr
	}
	f.pays = append(f.pays, storeWalletCall{userID, amountKobo, reference})
	return true, nil
}

func (f *storeFakeWallet) Refund(_ context.Context, userID string, amountKobo int64, reference, _ string) (bool, error) {
	if f.refundErr != nil {
		return false, f.refundErr
	}
	f.refunds = append(f.refunds, storeWalletCall{userID, amountKobo, reference})
	return true, nil
}

// storeFakeRepo is a one-product store that reserves and restores stock like the
// real repository does.
type storeFakeRepo struct {
	ports.IStoreRepository
	product   domain.Product
	orders    map[string]*domain.Order
	createErr error
	// payStatusErr makes flipping an order to "paid" fail.
	payStatusErr error
}

func newStoreFakeRepo(price float64, stock int) *storeFakeRepo {
	return &storeFakeRepo{
		product: domain.Product{ID: "prod-1", Name: "Jersey", Price: price, Quantity: stock, IsActive: true},
		orders:  map[string]*domain.Order{},
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
	if r.payStatusErr != nil {
		return r.payStatusErr
	}
	r.orders[id].PaymentStatus = status
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
	if len(rig.wallet.pays) != 1 {
		t.Fatalf("expected exactly one wallet debit, got %d", len(rig.wallet.pays))
	}
	got := rig.wallet.pays[0]
	if got.userID != "user-1" || got.amount != 500100 || got.reference != order.OrderReference {
		t.Fatalf("debit should be 500100 kobo on the order reference for user-1, got %+v", got)
	}
	if len(rig.wallet.refunds) != 0 {
		t.Fatalf("a good payment must not refund, got %v", rig.wallet.refunds)
	}
}

func TestWalletCheckoutTooLowTakesNothingAndReleasesTheOrder(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.wallet.payErr = ports.ErrWalletInsufficient

	_, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1))
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("expected ErrWalletInsufficient, got %v", err)
	}

	order := rig.onlyOrder(t)
	if order.PaymentStatus != "failed" {
		t.Fatalf("the unpaid order should be marked failed, got %q", order.PaymentStatus)
	}
	if rig.repo.product.Quantity != 5 {
		t.Fatalf("stock should be back to 5, got %d", rig.repo.product.Quantity)
	}
	if rig.discount.released != 1 || rig.discount.confirmed != 0 {
		t.Fatalf("the code hold should be released once, got released=%d confirmed=%d", rig.discount.released, rig.discount.confirmed)
	}
	if len(rig.wallet.pays) != 0 || len(rig.wallet.refunds) != 0 {
		t.Fatalf("nothing was charged, so nothing should be refunded: pays=%v refunds=%v", rig.wallet.pays, rig.wallet.refunds)
	}
}

func TestWalletCheckoutRefundsWhenConfirmingTheOrderFailsAfterTheDebit(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.repo.payStatusErr = errors.New("db down")

	_, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(3))
	if err == nil {
		t.Fatal("expected the checkout to fail")
	}

	order := rig.onlyOrder(t)
	if len(rig.wallet.pays) != 1 || len(rig.wallet.refunds) != 1 {
		t.Fatalf("expected one debit and one refund, got pays=%v refunds=%v", rig.wallet.pays, rig.wallet.refunds)
	}
	if rig.wallet.refunds[0] != rig.wallet.pays[0] {
		t.Fatalf("the refund must match the debit (same user, amount, reference): pay=%+v refund=%+v", rig.wallet.pays[0], rig.wallet.refunds[0])
	}
	if rig.wallet.refunds[0].reference != order.OrderReference || rig.wallet.refunds[0].amount != 300000 {
		t.Fatalf("unexpected refund %+v", rig.wallet.refunds[0])
	}
	if order.PaymentStatus != "failed" || rig.repo.product.Quantity != 5 {
		t.Fatalf("order should be failed and stock restored, got %q / %d", order.PaymentStatus, rig.repo.product.Quantity)
	}
	if rig.discount.released != 1 {
		t.Fatalf("the code hold should be released, got %d", rig.discount.released)
	}
}

func TestWalletCheckoutRefundsAfterAnAmbiguousDebitError(t *testing.T) {
	// A timeout can mean the debit committed. The refund is a no-op in the real
	// wallet when nothing was debited, so the store always asks.
	rig := newStoreWalletRig(t, 1000, 5)
	rig.wallet.payErr = errors.New("context deadline exceeded")

	if _, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1)); err == nil {
		t.Fatal("expected the checkout to fail")
	}
	// The order and stock must be undone either way.
	if order := rig.onlyOrder(t); order.PaymentStatus != "failed" || rig.repo.product.Quantity != 5 {
		t.Fatalf("order should be failed and stock restored, got %q / %d", order.PaymentStatus, rig.repo.product.Quantity)
	}
	if len(rig.wallet.refunds) != 1 {
		t.Fatalf("an ambiguous debit error should ask for a refund once, got %v", rig.wallet.refunds)
	}
}

func TestWalletCheckoutRejectsGuestsBeforeTouchingAnything(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)

	for _, uid := range []*string{nil, strp(""), strp("  ")} {
		_, err := rig.svc.CreateOrder(context.Background(), uid, walletCheckout(1))
		if !errors.Is(err, ErrStoreWalletSignIn) {
			t.Fatalf("expected ErrStoreWalletSignIn for %v, got %v", uid, err)
		}
	}
	if len(rig.repo.orders) != 0 || rig.repo.product.Quantity != 5 || len(rig.wallet.pays) != 0 {
		t.Fatal("a rejected guest must leave no order, no reserved stock and no debit")
	}
}

func TestWalletCheckoutNeedsAWalletToBeWired(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.svc.wallet = nil

	_, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1))
	if !errors.Is(err, ErrStoreWalletUnavailable) {
		t.Fatalf("expected ErrStoreWalletUnavailable, got %v", err)
	}
	if len(rig.repo.orders) != 0 {
		t.Fatal("no order should be created")
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
	if len(rig.wallet.pays) != 0 {
		t.Fatalf("nothing to debit, got %v", rig.wallet.pays)
	}
}

func TestCancellingAWalletOrderRefundsTheWallet(t *testing.T) {
	rig := newStoreWalletRig(t, 2500.50, 10)
	if _, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(2)); err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	order := rig.onlyOrder(t)

	res, err := rig.svc.CancelOrder(context.Background(), order.ID)
	if err != nil {
		t.Fatalf("CancelOrder: %v", err)
	}
	if res.FulfillmentStatus != "cancelled" {
		t.Fatalf("order should be cancelled, got %q", res.FulfillmentStatus)
	}
	if len(rig.wallet.refunds) != 1 {
		t.Fatalf("expected one refund, got %v", rig.wallet.refunds)
	}
	if got := rig.wallet.refunds[0]; got.userID != "user-1" || got.amount != 500100 || got.reference != order.OrderReference {
		t.Fatalf("refund should return the 500100 kobo debit, got %+v", got)
	}
	if rig.repo.product.Quantity != 10 {
		t.Fatalf("stock should be back to 10, got %d", rig.repo.product.Quantity)
	}
}

func TestCancellingAPaystackOrderNeverTouchesTheWallet(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.repo.orders["order-1"] = &domain.Order{
		ID: "order-1", OrderReference: "SFFL-ORD-X", UserID: strp("user-1"), TotalAmount: 1000,
		PaymentStatus: "paid", FulfillmentStatus: "pending", PaymentMethod: domain.PaymentMethodPaystack,
	}

	if _, err := rig.svc.CancelOrder(context.Background(), "order-1"); err != nil {
		t.Fatalf("CancelOrder: %v", err)
	}
	if len(rig.wallet.refunds) != 0 {
		t.Fatalf("a card payment is not refunded to the wallet, got %v", rig.wallet.refunds)
	}
}

func TestCancellingAnUnpaidWalletOrderDoesNotRefund(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	rig.repo.orders["order-1"] = &domain.Order{
		ID: "order-1", OrderReference: "SFFL-ORD-X", UserID: strp("user-1"), TotalAmount: 1000,
		PaymentStatus: "failed", FulfillmentStatus: "pending", PaymentMethod: domain.PaymentMethodWallet,
	}

	if _, err := rig.svc.CancelOrder(context.Background(), "order-1"); err != nil {
		t.Fatalf("CancelOrder: %v", err)
	}
	if len(rig.wallet.refunds) != 0 {
		t.Fatalf("nothing was taken, so nothing is refunded, got %v", rig.wallet.refunds)
	}
}

func TestCancellingAWalletOrderReportsAFailedRefundAndCanBeRetried(t *testing.T) {
	rig := newStoreWalletRig(t, 1000, 5)
	if _, err := rig.svc.CreateOrder(context.Background(), strp("user-1"), walletCheckout(1)); err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	rig.wallet.refundErr = errors.New("db down")

	if _, err := rig.svc.CancelOrder(context.Background(), "order-1"); err == nil {
		t.Fatal("a refund that failed must be reported")
	}
	if rig.repo.product.Quantity != 5 {
		t.Fatalf("stock still goes back, got %d", rig.repo.product.Quantity)
	}

	// Cancelling again is the retry: the cancel is a no-op, the refund goes through.
	rig.wallet.refundErr = nil
	if _, err := rig.svc.CancelOrder(context.Background(), "order-1"); err != nil {
		t.Fatalf("retry: %v", err)
	}
	if len(rig.wallet.refunds) != 1 || rig.repo.product.Quantity != 5 {
		t.Fatalf("expected one refund and no double restock, got %v / %d", rig.wallet.refunds, rig.repo.product.Quantity)
	}
}
