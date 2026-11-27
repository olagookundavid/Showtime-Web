package tests_integration

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

const walletFixtureDomain = "@walletfixture.test"

func cleanWalletFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	mustExec(t, pool, `DELETE FROM vouchers WHERE holder_name LIKE 'ZZFIX%'`)
	mustExec(t, pool, `DELETE FROM voucher_products WHERE name LIKE 'ZZFIX%'`)
	// wallets, ledger rows and top-ups go with the user (ON DELETE CASCADE).
	mustExec(t, pool, `DELETE FROM users WHERE email LIKE '%`+walletFixtureDomain+`'`)
}

type walletFixture struct {
	pool     *pgxpool.Pool
	wallets  ports.IWalletRepository
	vouchers ports.IVoucherRepository
}

func newWalletFixture(t *testing.T) *walletFixture {
	pool := ticketPool(t)
	cleanWalletFixtures(t, pool)
	t.Cleanup(func() { cleanWalletFixtures(t, pool) })
	return &walletFixture{
		pool:     pool,
		wallets:  ports.NewWalletRepository(pool),
		vouchers: ports.NewVoucherRepository(pool),
	}
}

func (f *walletFixture) user(t *testing.T, name string) string {
	t.Helper()
	return mustScan(t, f.pool, `
		INSERT INTO users (full_name, first_name, last_name, email, password_hash, role, phone)
		VALUES ($1, $1, 'Fixture', $2, 'x', 'user', '08000000000') RETURNING id::text`,
		name, fmt.Sprintf("%s-%d%s", name, time.Now().UnixNano(), walletFixtureDomain))
}

func (f *walletFixture) credit(t *testing.T, userID string, kobo int64) {
	t.Helper()
	if _, err := f.wallets.Apply(context.Background(), domain.LedgerEntry{
		UserID: userID, AmountKobo: kobo, Type: domain.LedgerAdjustment, Description: "fixture",
	}); err != nil {
		t.Fatalf("credit: %v", err)
	}
}

func (f *walletFixture) balance(t *testing.T, userID string) int64 {
	t.Helper()
	w, err := f.wallets.GetWallet(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	return w.BalanceKobo
}

func (f *walletFixture) product(t *testing.T, price int64) *domain.VoucherProduct {
	t.Helper()
	p := &domain.VoucherProduct{
		Name: "ZZFIX bundle", PriceKobo: price, Active: true,
		Items: []domain.VoucherItem{{Name: "Burger", Qty: 1}, {Name: "Drink", Qty: 2}},
	}
	if err := f.vouchers.CreateProduct(context.Background(), p); err != nil {
		t.Fatalf("create product: %v", err)
	}
	return p
}

func day(offset int) time.Time {
	n := time.Now().In(time.FixedZone("WAT", 3600)).AddDate(0, 0, offset)
	return time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC)
}

func voucherFor(p *domain.VoucherProduct, code, buyer string, from, to time.Time) *domain.Voucher {
	pid := p.ID
	return &domain.Voucher{
		Code: code, ProductID: &pid, Name: p.Name, Items: p.Items, PriceKobo: p.PriceKobo,
		Source: domain.VoucherPurchased, HolderName: "ZZFIX Holder", PurchasedByUserID: &buyer,
		ValidFrom: from, ValidTo: to,
	}
}

func TestWallet_ConcurrentDebitsCannotOverdraw(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXdebit")
	f.credit(t, u, 1000)

	var ok, short int32
	var wg sync.WaitGroup
	for i := 0; i < 25; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := f.wallets.Apply(ctx, domain.LedgerEntry{
				UserID: u, AmountKobo: -100, Type: domain.LedgerPurchase, Description: "race",
			})
			switch {
			case err == nil:
				atomic.AddInt32(&ok, 1)
			case errors.Is(err, ports.ErrWalletInsufficient):
				atomic.AddInt32(&short, 1)
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}()
	}
	wg.Wait()

	if ok != 10 || short != 15 {
		t.Fatalf("succeeded=%d refused=%d, want 10 and 15", ok, short)
	}
	if b := f.balance(t, u); b != 0 {
		t.Fatalf("balance = %d, want 0", b)
	}
	// The ledger must reconstruct the balance exactly.
	if sum := mustScan(t, f.pool, `SELECT COALESCE(SUM(amount_kobo),0)::text FROM wallet_transactions WHERE user_id = $1`, u); sum != "0" {
		t.Fatalf("ledger sums to %s, want 0", sum)
	}
}

func TestWallet_TopupSettlesOnceUnderConcurrentDelivery(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXtopup")
	ref := fmt.Sprintf("WLT-FIX%d", time.Now().UnixNano()%1000000)
	if err := f.wallets.CreateTopup(ctx, &domain.Topup{UserID: u, AmountKobo: 250_000, PaystackReference: ref},
		domain.DefaultMaxBalanceKobo, time.Now().Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}

	var credited int32
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ { // webhook retries plus the browser verify, all at once
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, did, err := f.wallets.SettleTopup(ctx, ref)
			if err != nil {
				t.Errorf("settle: %v", err)
			}
			if did {
				atomic.AddInt32(&credited, 1)
			}
		}()
	}
	wg.Wait()

	if credited != 1 {
		t.Fatalf("credited %d times, want exactly 1", credited)
	}
	if b := f.balance(t, u); b != 250_000 {
		t.Fatalf("balance = %d, want 250000", b)
	}
}

// Top-ups started at the same moment must not, between them, pass the maximum
// balance: each start sees the others' pending rows because they take turns on
// the wallet lock.
func TestWallet_ConcurrentTopupStartsRespectMaxBalance(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	u := f.user(t, "ZZFIXcap")
	f.credit(t, u, 100_000)
	const maxBalance = 400_000 // room for exactly three top-ups of 100,000
	since := time.Now().Add(-time.Hour)

	var ok, refused int32
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ref := fmt.Sprintf("WLT-CAP%d-%d", time.Now().UnixNano()%1000000, i)
			err := f.wallets.CreateTopup(ctx, &domain.Topup{UserID: u, AmountKobo: 100_000, PaystackReference: ref}, maxBalance, since)
			switch {
			case err == nil:
				atomic.AddInt32(&ok, 1)
			case errors.Is(err, ports.ErrTopupOverLimit):
				atomic.AddInt32(&refused, 1)
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}(i)
	}
	wg.Wait()

	if ok != 3 || refused != 9 {
		t.Fatalf("started=%d refused=%d, want 3 and 9", ok, refused)
	}
	pending, err := f.wallets.PendingTopupsKobo(ctx, u, since)
	if err != nil || pending != 300_000 {
		t.Fatalf("pending = %d (%v), want 300000", pending, err)
	}
}

func TestVoucher_PurchaseIsAtomicWithTheDebit(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXbuyer")
	p := f.product(t, 450_000)

	// Too poor: no voucher, no ledger row, balance untouched.
	f.credit(t, buyer, 100_000)
	poor := voucherFor(p, "VCH-ZZFIXPOOR1", buyer, day(0), day(0))
	if err := f.vouchers.CreatePurchased(ctx, poor); !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("got %v, want ErrWalletInsufficient", err)
	}
	if got, _ := f.vouchers.GetByCode(ctx, "VCH-ZZFIXPOOR1"); got != nil {
		t.Fatal("a voucher exists although the payment failed")
	}
	if b := f.balance(t, buyer); b != 100_000 {
		t.Fatalf("balance changed to %d after a failed purchase", b)
	}

	// Funded: voucher and debit land together and point at each other.
	f.credit(t, buyer, 900_000)
	v := voucherFor(p, "VCH-ZZFIXPAID01", buyer, day(0), day(2))
	if err := f.vouchers.CreatePurchased(ctx, v); err != nil {
		t.Fatal(err)
	}
	if b := f.balance(t, buyer); b != 550_000 {
		t.Fatalf("balance = %d, want 550000", b)
	}
	got, err := f.vouchers.GetByCode(ctx, v.Code)
	if err != nil || got == nil {
		t.Fatalf("lookup: %v %v", got, err)
	}
	if got.WalletTxID == nil || got.Status != domain.VoucherIssued || len(got.Items) != 2 || got.Items[1].Qty != 2 {
		t.Fatalf("unexpected voucher: %+v", got)
	}
	linked := mustScan(t, f.pool, `SELECT voucher_id::text FROM wallet_transactions WHERE id = $1`, *got.WalletTxID)
	if linked != got.ID {
		t.Fatalf("ledger row points at %s, want voucher %s", linked, got.ID)
	}

	// A duplicate code is reported so the service can retry with another.
	dup := voucherFor(p, v.Code, buyer, day(0), day(0))
	if err := f.vouchers.CreatePurchased(ctx, dup); !errors.Is(err, ports.ErrVoucherCodeTaken) {
		t.Fatalf("got %v, want ErrVoucherCodeTaken", err)
	}
	if b := f.balance(t, buyer); b != 550_000 {
		t.Fatalf("a duplicate code still charged the wallet: %d", b)
	}
}

func TestVoucher_ConcurrentRedeemSucceedsExactlyOnce(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXbuyer")
	staff := f.user(t, "ZZFIXstaff")
	f.credit(t, buyer, 1_000_000)
	p := f.product(t, 450_000)

	v := voucherFor(p, "VCH-ZZFIXRACE01", buyer, day(0), day(0))
	if err := f.vouchers.CreatePurchased(ctx, v); err != nil {
		t.Fatal(err)
	}

	var redeemed int32
	var wg sync.WaitGroup
	for i := 0; i < 15; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, did, err := f.vouchers.Redeem(ctx, v.Code, staff, day(0))
			if err != nil {
				t.Errorf("redeem: %v", err)
			}
			if did {
				atomic.AddInt32(&redeemed, 1)
			}
		}()
	}
	wg.Wait()
	if redeemed != 1 {
		t.Fatalf("redeemed %d times, want exactly 1", redeemed)
	}

	got, _ := f.vouchers.GetByCode(ctx, v.Code)
	if got.Status != domain.VoucherRedeemed || got.RedeemedAt == nil || got.RedeemedByName != "ZZFIXstaff" {
		t.Fatalf("unexpected after redeem: %+v", got)
	}
	// It now shows in the redemptions report.
	list, err := f.vouchers.ListRedemptions(ctx, 200)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, r := range list {
		found = found || r.Code == v.Code
	}
	if !found {
		t.Fatal("redeemed voucher missing from ListRedemptions")
	}
}

func TestVoucher_RedeemRespectsTheDates(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXbuyer")
	staff := f.user(t, "ZZFIXstaff")
	f.credit(t, buyer, 2_000_000)
	p := f.product(t, 450_000)

	future := voucherFor(p, "VCH-ZZFIXFUTUR1", buyer, day(3), day(5))
	past := voucherFor(p, "VCH-ZZFIXPAST001", buyer, day(0), day(0)) // valid today only
	for _, v := range []*domain.Voucher{future, past} {
		if err := f.vouchers.CreatePurchased(ctx, v); err != nil {
			t.Fatal(err)
		}
	}

	// Not yet valid.
	if got, did, _ := f.vouchers.Redeem(ctx, future.Code, staff, day(0)); did || got == nil || got.Status != domain.VoucherIssued {
		t.Fatalf("future voucher redeemed early: did=%v got=%+v", did, got)
	}
	// Both end days are inclusive.
	if _, did, _ := f.vouchers.Redeem(ctx, future.Code, staff, day(5)); !did {
		t.Fatal("last day of the range should be redeemable")
	}
	// Too late.
	if got, did, _ := f.vouchers.Redeem(ctx, past.Code, staff, day(1)); did || got.Status != domain.VoucherIssued {
		t.Fatalf("expired voucher redeemed: did=%v", did)
	}
	// Unknown code comes back as nil, not an error.
	if got, did, err := f.vouchers.Redeem(ctx, "VCH-NOSUCHCODE", staff, day(0)); got != nil || did || err != nil {
		t.Fatalf("unknown code: %v %v %v", got, did, err)
	}
}

func TestVoucher_VoidRefundsOnceAndBlocksRedeem(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	buyer := f.user(t, "ZZFIXbuyer")
	staff := f.user(t, "ZZFIXstaff")
	f.credit(t, buyer, 1_000_000)
	p := f.product(t, 450_000)

	v := voucherFor(p, "VCH-ZZFIXVOID001", buyer, day(0), day(0))
	if err := f.vouchers.CreatePurchased(ctx, v); err != nil {
		t.Fatal(err)
	}

	// Two admins void at the same moment: only one wins, the buyer is refunded once.
	var voided, notVoidable int32
	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := f.vouchers.Void(ctx, v.ID, staff, true)
			switch {
			case err == nil:
				atomic.AddInt32(&voided, 1)
			case errors.Is(err, ports.ErrVoucherNotVoidable):
				atomic.AddInt32(&notVoidable, 1)
			default:
				t.Errorf("void: %v", err)
			}
		}()
	}
	wg.Wait()
	if voided != 1 || notVoidable != 5 {
		t.Fatalf("voided=%d notVoidable=%d, want 1 and 5", voided, notVoidable)
	}
	if b := f.balance(t, buyer); b != 1_000_000 {
		t.Fatalf("balance after refund = %d, want 1000000", b)
	}
	if _, did, _ := f.vouchers.Redeem(ctx, v.Code, staff, day(0)); did {
		t.Fatal("a void voucher was redeemed")
	}
	if _, err := f.vouchers.Void(ctx, "00000000-0000-0000-0000-000000000000", staff, false); !errors.Is(err, ports.ErrVoucherNotFound) {
		t.Fatalf("got %v, want ErrVoucherNotFound", err)
	}

	// A used voucher cannot be voided, and a void without refund moves no money.
	used := voucherFor(p, "VCH-ZZFIXUSED001", buyer, day(0), day(0))
	if err := f.vouchers.CreatePurchased(ctx, used); err != nil {
		t.Fatal(err)
	}
	if _, did, _ := f.vouchers.Redeem(ctx, used.Code, staff, day(0)); !did {
		t.Fatal("redeem failed")
	}
	if _, err := f.vouchers.Void(ctx, used.ID, staff, true); !errors.Is(err, ports.ErrVoucherNotVoidable) {
		t.Fatalf("voiding a used voucher: got %v", err)
	}
	other := voucherFor(p, "VCH-ZZFIXNOREF01", buyer, day(0), day(0))
	if err := f.vouchers.CreatePurchased(ctx, other); err != nil {
		t.Fatal(err)
	}
	before := f.balance(t, buyer)
	if _, err := f.vouchers.Void(ctx, other.ID, staff, false); err != nil {
		t.Fatal(err)
	}
	if f.balance(t, buyer) != before {
		t.Fatal("a void without refund changed the wallet")
	}
}

func TestVoucher_AdminIssuedListsAndFilters(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	staff := f.user(t, "ZZFIXstaff")
	holder := f.user(t, "ZZFIXholder")
	p := f.product(t, 450_000)

	issued := voucherFor(p, "VCH-ZZFIXISSUE01", staff, day(0), day(1))
	issued.Source = domain.VoucherAdminIssued
	issued.PurchasedByUserID = nil
	issued.IssuedByUserID = &staff
	issued.HolderUserID = &holder
	issued.HolderName = "ZZFIX Guest"
	if err := f.vouchers.CreateIssued(ctx, issued); err != nil {
		t.Fatal(err)
	}
	if issued.WalletTxID != nil {
		t.Fatal("a free voucher must not have a payment")
	}

	mine, err := f.vouchers.ListForUser(ctx, holder)
	if err != nil || len(mine) != 1 || mine[0].Code != issued.Code {
		t.Fatalf("holder's vouchers: %+v %v", mine, err)
	}
	list, total, err := f.vouchers.List(ctx, ports.VoucherFilter{Search: "zzfix guest", Status: "ISSUED"})
	if err != nil || total != 1 || len(list) != 1 {
		t.Fatalf("search: total=%d len=%d err=%v", total, len(list), err)
	}
	if _, total, _ := f.vouchers.List(ctx, ports.VoucherFilter{Search: "zzfix guest", Status: "VOID"}); total != 0 {
		t.Fatalf("status filter let %d through", total)
	}

	// Editing the catalogue later leaves the voucher's own snapshot alone.
	p.Name = "ZZFIX renamed"
	p.Items = []domain.VoucherItem{{Name: "Changed", Qty: 9}}
	if ok, err := f.vouchers.UpdateProduct(ctx, p); err != nil || !ok {
		t.Fatalf("update product: %v %v", ok, err)
	}
	got, _ := f.vouchers.GetByCode(ctx, issued.Code)
	if got.Name != "ZZFIX bundle" || got.Items[0].Name != "Burger" {
		t.Fatalf("voucher changed with the catalogue: %+v", got)
	}
	active, _ := f.vouchers.ListProducts(ctx, true)
	p.Active = false
	_, _ = f.vouchers.UpdateProduct(ctx, p)
	after, _ := f.vouchers.ListProducts(ctx, true)
	if len(after) != len(active)-1 {
		t.Fatalf("switching a product off should hide it from the shop: %d -> %d", len(active), len(after))
	}
}

// A price voucher is stored with its amount and description, no items and no
// product, and is redeemed exactly once. The database itself refuses a price
// voucher with no value, or one that was bought.
func TestVoucher_PriceVoucherRoundTripAndConstraints(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	staff := f.user(t, "ZZFIXstaff")

	v := &domain.Voucher{
		Code: "VCH-ZZFIXVALUE1", Kind: domain.VoucherKindValue, Name: "Thank you voucher",
		Description: "Valid for anything at the Showtime bar.", PriceKobo: 1_000_000,
		Source: domain.VoucherAdminIssued, HolderName: "ZZFIX Holder", ValidFrom: day(0), ValidTo: day(1),
	}
	if err := f.vouchers.CreateIssued(ctx, v); err != nil {
		t.Fatal(err)
	}
	got, err := f.vouchers.GetByCode(ctx, v.Code)
	if err != nil || got == nil {
		t.Fatalf("lookup: %v %v", got, err)
	}
	if got.Kind != domain.VoucherKindValue || got.PriceKobo != 1_000_000 || got.Description != v.Description ||
		got.ProductID != nil || len(got.Items) != 0 {
		t.Fatalf("unexpected price voucher: %+v", got)
	}

	if _, ok, err := f.vouchers.Redeem(ctx, v.Code, staff, day(0)); err != nil || !ok {
		t.Fatalf("first redeem: ok=%v err=%v", ok, err)
	}
	if _, ok, err := f.vouchers.Redeem(ctx, v.Code, staff, day(0)); err != nil || ok {
		t.Fatalf("second redeem: ok=%v err=%v, want refused", ok, err)
	}

	worthless := *v
	worthless.Code, worthless.PriceKobo = "VCH-ZZFIXVALUE2", 0
	if err := f.vouchers.CreateIssued(ctx, &worthless); err == nil {
		t.Error("a price voucher worth nothing should be refused by the database")
	}
	bought := *v
	bought.Code, bought.Source = "VCH-ZZFIXVALUE3", domain.VoucherPurchased
	if err := f.vouchers.CreateIssued(ctx, &bought); err == nil {
		t.Error("a price voucher that was bought should be refused by the database")
	}

	// A bundle still defaults to kind BUNDLE and keeps its items.
	p := f.product(t, 450_000)
	b := voucherFor(p, "VCH-ZZFIXBUNDLE1", staff, day(0), day(0))
	b.Source = domain.VoucherAdminIssued
	if err := f.vouchers.CreateIssued(ctx, b); err != nil {
		t.Fatal(err)
	}
	gotB, _ := f.vouchers.GetByCode(ctx, b.Code)
	if gotB.Kind != domain.VoucherKindBundle || len(gotB.Items) != 2 {
		t.Fatalf("bundle after the change: %+v", gotB)
	}
}
