package services

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// fakeVoucherRepo behaves like the real one where it matters: a purchase takes the
// price from a wallet balance, and redeeming only works once, on a valid date.
type fakeVoucherRepo struct {
	products map[string]*domain.VoucherProduct
	vouchers map[string]*domain.Voucher // by code
	balance  map[string]int64
	taken    map[string]bool // codes that "already exist"
	tries    int
}

func newFakeVoucherRepo() *fakeVoucherRepo {
	return &fakeVoucherRepo{
		products: map[string]*domain.VoucherProduct{},
		vouchers: map[string]*domain.Voucher{},
		balance:  map[string]int64{},
		taken:    map[string]bool{},
	}
}

func (r *fakeVoucherRepo) ListProducts(_ context.Context, activeOnly bool) ([]domain.VoucherProduct, error) {
	out := []domain.VoucherProduct{}
	for _, p := range r.products {
		if !activeOnly || p.Active {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (r *fakeVoucherRepo) GetProduct(_ context.Context, id string) (*domain.VoucherProduct, error) {
	return r.products[id], nil
}

func (r *fakeVoucherRepo) CreateProduct(_ context.Context, p *domain.VoucherProduct) error {
	p.ID = "prod-new"
	r.products[p.ID] = p
	return nil
}

func (r *fakeVoucherRepo) UpdateProduct(_ context.Context, p *domain.VoucherProduct) (bool, error) {
	if _, ok := r.products[p.ID]; !ok {
		return false, nil
	}
	r.products[p.ID] = p
	return true, nil
}

func (r *fakeVoucherRepo) store(v *domain.Voucher) error {
	r.tries++
	if r.taken[v.Code] {
		return ports.ErrVoucherCodeTaken
	}
	v.ID = "v-" + v.Code
	v.Status = domain.VoucherIssued
	v.CreatedAt = time.Now()
	r.vouchers[v.Code] = v
	return nil
}

func (r *fakeVoucherRepo) CreatePurchased(_ context.Context, v *domain.Voucher) error {
	buyer := *v.PurchasedByUserID
	if r.balance[buyer] < v.PriceKobo {
		return ports.ErrWalletInsufficient
	}
	if err := r.store(v); err != nil {
		return err
	}
	r.balance[buyer] -= v.PriceKobo
	return nil
}

func (r *fakeVoucherRepo) CreateIssued(_ context.Context, v *domain.Voucher) error { return r.store(v) }

func (r *fakeVoucherRepo) GetByCode(_ context.Context, code string) (*domain.Voucher, error) {
	return r.vouchers[code], nil
}

func (r *fakeVoucherRepo) GetByID(_ context.Context, id string) (*domain.Voucher, error) {
	for _, v := range r.vouchers {
		if v.ID == id {
			return v, nil
		}
	}
	return nil, nil
}

func (r *fakeVoucherRepo) ListForUser(_ context.Context, userID string) ([]domain.Voucher, error) {
	out := []domain.Voucher{}
	for _, v := range r.vouchers {
		if (v.HolderUserID != nil && *v.HolderUserID == userID) ||
			(v.PurchasedByUserID != nil && *v.PurchasedByUserID == userID) {
			out = append(out, *v)
		}
	}
	return out, nil
}

func (r *fakeVoucherRepo) List(_ context.Context, _ ports.VoucherFilter) ([]domain.Voucher, int, error) {
	out := []domain.Voucher{}
	for _, v := range r.vouchers {
		out = append(out, *v)
	}
	return out, len(out), nil
}

func (r *fakeVoucherRepo) ListRedemptions(context.Context, int) ([]domain.Voucher, error) {
	return nil, nil
}

func (r *fakeVoucherRepo) Redeem(_ context.Context, code, staffID string, today time.Time) (*domain.Voucher, bool, error) {
	v := r.vouchers[code]
	if v == nil {
		return nil, false, nil
	}
	if v.StateOn(today) != domain.VoucherStateValid {
		return v, false, nil
	}
	now := time.Now()
	v.Status = domain.VoucherRedeemed
	v.RedeemedAt = &now
	v.RedeemedByUserID = &staffID
	return v, true, nil
}

func (r *fakeVoucherRepo) Void(_ context.Context, id, staffID string, refund bool) (*domain.Voucher, error) {
	v, _ := r.GetByID(context.Background(), id)
	if v == nil {
		return nil, ports.ErrVoucherNotFound
	}
	if v.Status != domain.VoucherIssued {
		return nil, ports.ErrVoucherNotVoidable
	}
	v.Status = domain.VoucherVoid
	if refund && v.Source == domain.VoucherPurchased && v.PurchasedByUserID != nil {
		r.balance[*v.PurchasedByUserID] += v.PriceKobo
	}
	return v, nil
}

type fakeVoucherUsers struct{}

func (fakeVoucherUsers) GetUserByID(_ context.Context, id string) (*domain.User, error) {
	if id == "ghost" {
		return nil, errors.New("not found")
	}
	return &domain.User{ID: id, FullName: "User " + id, Email: id + "@example.com"}, nil
}

type fakeVoucherSearch struct{}

func (fakeVoucherSearch) AdminSearchUsers(context.Context, string) ([]dto.WalletUser, error) {
	return []dto.WalletUser{{ID: "u1", Name: "Ada"}}, nil
}

// 10 Nov 2026 in Lagos; every test runs "today".
var voucherToday = time.Date(2026, 11, 10, 12, 0, 0, 0, lagos())

func voucherFixture() (*VoucherService, *fakeVoucherRepo) {
	repo := newFakeVoucherRepo()
	repo.products["burger"] = &domain.VoucherProduct{
		ID: "burger", Name: "Burger and drink", PriceKobo: 450_000, Active: true,
		Items: []domain.VoucherItem{{Name: "Burger", Qty: 1}, {Name: "Soft drink", Qty: 1}},
	}
	repo.products["old"] = &domain.VoucherProduct{
		ID: "old", Name: "Retired bundle", PriceKobo: 100_000, Active: false,
		Items: []domain.VoucherItem{{Name: "Water", Qty: 1}},
	}
	s := NewVoucherService(repo, fakeVoucherUsers{}, fakeVoucherSearch{})
	s.now = func() time.Time { return voucherToday }
	return s, repo
}

func purchaseReq(from, to string) dto.PurchaseVoucherRequest {
	return dto.PurchaseVoucherRequest{ProductID: "burger", HolderName: "Tolu Ade", ValidFrom: from, ValidTo: to}
}

func TestNormalizeVoucherCode(t *testing.T) {
	for in, want := range map[string]string{
		"VCH-ABCDEFGHJK":      "VCH-ABCDEFGHJK",
		"  vch-abcdefghjk \n": "VCH-ABCDEFGHJK",
		"https://www.showtimeflag.football/vouchers/VCH-X2": "VCH-X2",
		"https://x.test/vouchers/vch-x2/?utm=1#top":         "VCH-X2",
		"": "",
	} {
		if got := normalizeVoucherCode(in); got != want {
			t.Errorf("normalizeVoucherCode(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestGeneratedVoucherCodesLookRight(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		c := generateVoucherCode()
		if len(c) != len("VCH-")+10 || !strings.HasPrefix(c, "VCH-") {
			t.Fatalf("bad code %q", c)
		}
		if strings.ContainsAny(c[4:], "01OI") {
			t.Fatalf("code %q has a look-alike character", c)
		}
		if seen[c] {
			t.Fatalf("duplicate code %q in 200 draws", c)
		}
		seen[c] = true
	}
}

func TestParseVoucherDates(t *testing.T) {
	today := todayLagos(voucherToday)
	for _, tc := range []struct {
		name, from, to string
		err            error
	}{
		{"one day today", "2026-11-10", "2026-11-10", nil},
		{"range", "2026-11-12", "2026-11-20", nil},
		{"full year", "2026-11-10", "2027-11-10", nil},
		{"past start", "2026-11-09", "2026-11-12", ErrVoucherDates},
		{"end before start", "2026-11-15", "2026-11-14", ErrVoucherDates},
		{"garbage", "tomorrow", "2026-11-14", ErrVoucherDates},
		{"too long", "2026-11-10", "2027-11-11", ErrVoucherSpan},
	} {
		_, _, err := parseVoucherDates(tc.from, tc.to, today)
		if !errors.Is(err, tc.err) {
			t.Errorf("%s: got %v, want %v", tc.name, err, tc.err)
		}
	}
}

func TestVoucherStateOn(t *testing.T) {
	d := func(day int) time.Time { return time.Date(2026, 11, day, 0, 0, 0, 0, time.UTC) }
	v := &domain.Voucher{Status: domain.VoucherIssued, ValidFrom: d(10), ValidTo: d(12)}
	for _, tc := range []struct {
		today time.Time
		want  domain.VoucherState
	}{
		{d(9), domain.VoucherStateNotYet},
		{d(10), domain.VoucherStateValid},
		{d(12), domain.VoucherStateValid},
		{d(13), domain.VoucherStateExpired},
	} {
		if got := v.StateOn(tc.today); got != tc.want {
			t.Errorf("day %d: got %s, want %s", tc.today.Day(), got, tc.want)
		}
	}
	v.Status = domain.VoucherRedeemed
	if v.StateOn(d(11)) != domain.VoucherStateRedeemed {
		t.Error("a redeemed voucher must read REDEEMED even on a valid day")
	}
	v.Status = domain.VoucherVoid
	if v.StateOn(d(11)) != domain.VoucherStateVoid {
		t.Error("a void voucher must read VOID even on a valid day")
	}
}

func TestPurchaseTakesThePriceAndSnapshotsTheBundle(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 1_000_000

	v, err := s.Purchase(context.Background(), "buyer", purchaseReq("2026-11-10", "2026-11-12"))
	if err != nil {
		t.Fatal(err)
	}
	if repo.balance["buyer"] != 550_000 {
		t.Errorf("balance = %d, want 550000", repo.balance["buyer"])
	}
	if v.HolderName != "Tolu Ade" || v.State != domain.VoucherStateValid || !v.Redeemable {
		t.Errorf("unexpected view: %+v", v)
	}
	if !strings.HasPrefix(v.Code, "VCH-") || len(v.Items) != 2 {
		t.Errorf("unexpected code or items: %+v", v)
	}

	// Editing the catalogue afterwards must not change a voucher already sold.
	repo.products["burger"].Items[0].Name = "Changed"
	if got := repo.vouchers[v.Code].Items[0].Name; got != "Burger" {
		t.Errorf("voucher items changed with the catalogue: %q", got)
	}
}

func TestPurchaseRefusedWhenWalletTooLow(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 100

	_, err := s.Purchase(context.Background(), "buyer", purchaseReq("2026-11-10", "2026-11-10"))
	if !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("got %v, want ErrWalletInsufficient", err)
	}
	if len(repo.vouchers) != 0 {
		t.Error("a voucher was created without payment")
	}
}

func TestPurchaseValidation(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 10_000_000
	ctx := context.Background()

	cases := []struct {
		name string
		mod  func(*dto.PurchaseVoucherRequest)
		err  error
	}{
		{"unknown product", func(r *dto.PurchaseVoucherRequest) { r.ProductID = "nope" }, ErrVoucherProductGone},
		{"switched off product", func(r *dto.PurchaseVoucherRequest) { r.ProductID = "old" }, ErrVoucherProductGone},
		{"no holder", func(r *dto.PurchaseVoucherRequest) { r.HolderName = "   " }, ErrVoucherHolder},
		{"bad email", func(r *dto.PurchaseVoucherRequest) { r.HolderEmail = "not-an-email" }, ErrVoucherHolderEmail},
		{"past date", func(r *dto.PurchaseVoucherRequest) { r.ValidFrom = "2026-11-01" }, ErrVoucherDates},
	}
	for _, tc := range cases {
		req := purchaseReq("2026-11-10", "2026-11-12")
		tc.mod(&req)
		if _, err := s.Purchase(ctx, "buyer", req); !errors.Is(err, tc.err) {
			t.Errorf("%s: got %v, want %v", tc.name, err, tc.err)
		}
	}
	if repo.balance["buyer"] != 10_000_000 {
		t.Error("a rejected purchase still charged the wallet")
	}
}

func TestPurchaseRetriesWhenACodeIsTaken(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 1_000_000
	collide := &collidingRepo{fakeVoucherRepo: repo, failures: 2}
	s.repo = collide

	if _, err := s.Purchase(context.Background(), "buyer", purchaseReq("2026-11-10", "2026-11-10")); err != nil {
		t.Fatal(err)
	}
	if collide.attempts != 3 {
		t.Errorf("attempts = %d, want 3 (two collisions then success)", collide.attempts)
	}
	if repo.balance["buyer"] != 550_000 {
		t.Errorf("buyer charged %d, want exactly one price taken", 1_000_000-repo.balance["buyer"])
	}
}

// collidingRepo fails the first `failures` saves with a code collision.
type collidingRepo struct {
	*fakeVoucherRepo
	failures, attempts int
}

func (r *collidingRepo) CreatePurchased(ctx context.Context, v *domain.Voucher) error {
	r.attempts++
	if r.failures > 0 {
		r.failures--
		return ports.ErrVoucherCodeTaken
	}
	return r.fakeVoucherRepo.CreatePurchased(ctx, v)
}

func TestPurchaseGivesUpAfterRepeatedCollisions(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 1_000_000
	collide := &collidingRepo{fakeVoucherRepo: repo, failures: 100}
	s.repo = collide

	if _, err := s.Purchase(context.Background(), "buyer", purchaseReq("2026-11-10", "2026-11-10")); err == nil {
		t.Fatal("expected an error")
	}
	if collide.attempts != voucherCodeTries {
		t.Errorf("attempts = %d, want %d", collide.attempts, voucherCodeTries)
	}
}

func TestRedeemWorksOnceOnAValidDate(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 1_000_000
	ctx := context.Background()
	v, err := s.Purchase(ctx, "buyer", purchaseReq("2026-11-10", "2026-11-10"))
	if err != nil {
		t.Fatal(err)
	}

	// Staff may scan a link or type the code in lower case.
	out, err := s.Redeem(ctx, " "+strings.ToLower(v.Code), "bar-staff")
	if err != nil || !out.Redeemed {
		t.Fatalf("first redeem: %+v, %v", out, err)
	}
	if out.Voucher.State != domain.VoucherStateRedeemed {
		t.Errorf("state after redeem = %s", out.Voucher.State)
	}

	again, err := s.Redeem(ctx, v.Code, "bar-staff-2")
	if err != nil {
		t.Fatal(err)
	}
	if again.Redeemed {
		t.Fatal("a voucher was redeemed twice")
	}
	if !strings.HasPrefix(again.Voucher.StateMessage, "Already used") {
		t.Errorf("message = %q", again.Voucher.StateMessage)
	}
}

func TestRedeemRefusedOutsideTheDates(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 10_000_000
	ctx := context.Background()

	future, _ := s.Purchase(ctx, "buyer", purchaseReq("2026-11-12", "2026-11-14"))
	out, err := s.Redeem(ctx, future.Code, "bar-staff")
	if err != nil || out.Redeemed {
		t.Fatalf("future voucher redeemed early: %+v, %v", out, err)
	}
	if out.Voucher.State != domain.VoucherStateNotYet || out.Voucher.StateMessage != "Not valid until 12 Nov 2026" {
		t.Errorf("unexpected: %s / %q", out.Voucher.State, out.Voucher.StateMessage)
	}

	// Move the clock past the end date.
	s.now = func() time.Time { return voucherToday.AddDate(0, 0, 10) }
	late, _ := s.Redeem(ctx, future.Code, "bar-staff")
	if late.Redeemed || late.Voucher.State != domain.VoucherStateExpired {
		t.Errorf("expired voucher: %+v", late)
	}
}

func TestRedeemUnknownCode(t *testing.T) {
	s, _ := voucherFixture()
	if _, err := s.Redeem(context.Background(), "VCH-NOPE", "bar-staff"); !errors.Is(err, ErrVoucherNotFound) {
		t.Fatalf("got %v, want ErrVoucherNotFound", err)
	}
	if _, err := s.GetByCode(context.Background(), "VCH-NOPE"); !errors.Is(err, ErrVoucherNotFound) {
		t.Fatalf("GetByCode: got %v, want ErrVoucherNotFound", err)
	}
}

func TestPublicViewDoesNotLeakContactDetails(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 1_000_000
	req := purchaseReq("2026-11-10", "2026-11-10")
	req.HolderEmail = "tolu@example.com"
	v, err := s.Purchase(context.Background(), "buyer", req)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := s.GetByCode(context.Background(), v.Code)
	// VoucherView has no email or account fields at all; the admin view carries them.
	admin := s.adminView(repo.vouchers[got.Code])
	if admin.HolderEmail == nil || *admin.HolderEmail != "tolu@example.com" {
		t.Errorf("admin view lost the holder email: %+v", admin)
	}
}

func TestVoidRefundsOnlyPurchasedVouchers(t *testing.T) {
	s, repo := voucherFixture()
	repo.balance["buyer"] = 1_000_000
	ctx := context.Background()

	bought, _ := s.Purchase(ctx, "buyer", purchaseReq("2026-11-10", "2026-11-10"))
	if _, err := s.AdminVoid(ctx, bought.ID, "admin", true); err != nil {
		t.Fatal(err)
	}
	if repo.balance["buyer"] != 1_000_000 {
		t.Errorf("balance after refund = %d, want 1000000", repo.balance["buyer"])
	}
	if _, err := s.AdminVoid(ctx, bought.ID, "admin", true); !errors.Is(err, ErrVoucherNotVoidable) {
		t.Errorf("second void: got %v, want ErrVoucherNotVoidable", err)
	}
	out, _ := s.Redeem(ctx, bought.Code, "bar-staff")
	if out.Redeemed || out.Voucher.State != domain.VoucherStateVoid {
		t.Errorf("a void voucher was redeemable: %+v", out)
	}

	issued, _ := s.AdminIssue(ctx, "admin", dto.IssueVoucherRequest{
		ProductID: "burger", HolderName: "Guest", ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	})
	before := repo.balance["admin"]
	if _, err := s.AdminVoid(ctx, issued.ID, "admin", true); err != nil {
		t.Fatal(err)
	}
	if repo.balance["admin"] != before {
		t.Error("voiding a free voucher must not move any money")
	}
	if _, err := s.AdminVoid(ctx, "missing", "admin", false); !errors.Is(err, ErrVoucherNotFound) {
		t.Errorf("got %v, want ErrVoucherNotFound", err)
	}
}

func TestAdminIssueLinksAnAccountAndTakesItsEmail(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()

	v, err := s.AdminIssue(ctx, "admin", dto.IssueVoucherRequest{
		ProductID: "old", HolderName: "Ada", HolderUserID: "u1", ValidFrom: "2026-11-10", ValidTo: "2026-11-11",
	})
	if err != nil {
		t.Fatal(err)
	}
	if v.Source != domain.VoucherAdminIssued || v.HolderUserID == nil || *v.HolderUserID != "u1" {
		t.Errorf("unexpected: %+v", v)
	}
	if v.HolderEmail == nil || *v.HolderEmail != "u1@example.com" {
		t.Errorf("holder email = %v, want the account's", v.HolderEmail)
	}
	mine, _ := s.ListMine(ctx, "u1")
	if len(mine) != 1 {
		t.Errorf("ListMine = %d vouchers, want 1", len(mine))
	}

	if _, err := s.AdminIssue(ctx, "admin", dto.IssueVoucherRequest{
		ProductID: "burger", HolderName: "Ada", HolderUserID: "ghost", ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	}); !errors.Is(err, ErrWalletUserNotFound) {
		t.Errorf("unknown account: got %v", err)
	}
	if _, err := s.AdminIssue(ctx, "admin", dto.IssueVoucherRequest{
		ProductID: "nope", HolderName: "Ada", ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	}); !errors.Is(err, ErrVoucherProductGone) {
		t.Errorf("unknown product: got %v", err)
	}
}

func TestProductValidation(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	good := dto.VoucherProductRequest{
		Name: " Combo ", PriceKobo: 200_000, Active: true,
		Items: []domain.VoucherItem{{Name: " Wings ", Qty: 2}, {Name: "  ", Qty: 1}},
	}
	p, err := s.AdminCreateProduct(ctx, good)
	if err != nil {
		t.Fatal(err)
	}
	if p.Name != "Combo" || len(p.Items) != 1 || p.Items[0].Name != "Wings" {
		t.Errorf("not cleaned: %+v", p)
	}

	for name, mod := range map[string]func(*dto.VoucherProductRequest){
		"no name":    func(r *dto.VoucherProductRequest) { r.Name = " " },
		"free":       func(r *dto.VoucherProductRequest) { r.PriceKobo = 0 },
		"no items":   func(r *dto.VoucherProductRequest) { r.Items = nil },
		"zero qty":   func(r *dto.VoucherProductRequest) { r.Items = []domain.VoucherItem{{Name: "x", Qty: 0}} },
		"huge qty":   func(r *dto.VoucherProductRequest) { r.Items = []domain.VoucherItem{{Name: "x", Qty: 100}} },
		"only blank": func(r *dto.VoucherProductRequest) { r.Items = []domain.VoucherItem{{Name: " ", Qty: 1}} },
	} {
		req := good
		mod(&req)
		if _, err := s.AdminCreateProduct(ctx, req); !errors.Is(err, ErrVoucherProductInvalid) {
			t.Errorf("%s: got %v, want ErrVoucherProductInvalid", name, err)
		}
	}
	if _, err := s.AdminUpdateProduct(ctx, "missing", good); !errors.Is(err, ErrVoucherProductGone) {
		t.Errorf("update missing: got %v", err)
	}
}
