package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

func priceProductReq(mod func(*dto.VoucherProductRequest)) dto.VoucherProductRequest {
	r := dto.VoucherProductRequest{Kind: "VALUE", Name: "Thank you voucher", PriceKobo: 1_000_000, Active: true}
	if mod != nil {
		mod(&r)
	}
	return r
}

// priceProduct makes a price voucher in the catalogue and returns its id.
func priceProduct(t *testing.T, s *VoucherService, mod func(*dto.VoucherProductRequest)) *domain.VoucherProduct {
	t.Helper()
	p, err := s.AdminCreateProduct(context.Background(), priceProductReq(mod))
	if err != nil {
		t.Fatalf("create price voucher: %v", err)
	}
	return p
}

func people(names ...string) []dto.IssueRecipient {
	out := make([]dto.IssueRecipient, len(names))
	for i, n := range names {
		out[i] = dto.IssueRecipient{HolderName: n}
	}
	return out
}

func issueReq(productID string, recipients []dto.IssueRecipient) dto.IssueVoucherRequest {
	return dto.IssueVoucherRequest{ProductID: productID, Recipients: recipients, ValidFrom: "2026-11-10", ValidTo: "2026-12-10"}
}

// ---- price vouchers in the catalogue ----

func TestCreatePriceVoucherProduct(t *testing.T) {
	s, _ := voucherFixture()
	p := priceProduct(t, s, func(r *dto.VoucherProductRequest) {
		// Items on a price voucher are ignored, not an error.
		r.Items = []domain.VoucherItem{{Name: "Burger", Qty: 1}}
	})
	if p.Kind != domain.VoucherKindValue || p.PriceKobo != 1_000_000 || p.Name != "Thank you voucher" {
		t.Fatalf("unexpected product: %+v", p)
	}
	if len(p.Items) != 0 {
		t.Errorf("a price voucher has no items, got %v", p.Items)
	}
	if p.Description != DefaultValueVoucherDescription {
		t.Errorf("empty description should get the default, got %q", p.Description)
	}
}

func TestPriceVoucherKeepsAnEditedDescription(t *testing.T) {
	s, _ := voucherFixture()
	p := priceProduct(t, s, func(r *dto.VoucherProductRequest) {
		r.Description = "  Good for anything on the site or at the bar.  "
	})
	if p.Description != "Good for anything on the site or at the bar." {
		t.Errorf("description = %q", p.Description)
	}
}

func TestPriceVoucherProductValidation(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	for name, mod := range map[string]func(*dto.VoucherProductRequest){
		"no name":      func(r *dto.VoucherProductRequest) { r.Name = "  " },
		"zero amount":  func(r *dto.VoucherProductRequest) { r.PriceKobo = 0 },
		"negative":     func(r *dto.VoucherProductRequest) { r.PriceKobo = -5 },
		"over the cap": func(r *dto.VoucherProductRequest) { r.PriceKobo = voucherMaxValueKobo + 1 },
		"long name":    func(r *dto.VoucherProductRequest) { r.Name = strings.Repeat("x", 101) },
		"long text":    func(r *dto.VoucherProductRequest) { r.Description = strings.Repeat("x", 301) },
	} {
		if _, err := s.AdminCreateProduct(ctx, priceProductReq(mod)); !errors.Is(err, ErrVoucherValueInvalid) {
			t.Errorf("%s: got %v, want ErrVoucherValueInvalid", name, err)
		}
	}
	if _, err := s.AdminCreateProduct(ctx, priceProductReq(func(r *dto.VoucherProductRequest) { r.Kind = "GIFTCARD" })); !errors.Is(err, ErrVoucherKind) {
		t.Errorf("unknown kind: got %v", err)
	}
	if _, err := s.AdminCreateProduct(ctx, priceProductReq(func(r *dto.VoucherProductRequest) { r.PriceKobo = voucherMaxValueKobo })); err != nil {
		t.Errorf("the maximum amount should be accepted: %v", err)
	}
}

// Leaving the kind out still makes a bundle, which still needs items.
func TestProductKindDefaultsToABundle(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	p, err := s.AdminCreateProduct(ctx, dto.VoucherProductRequest{
		Name: "Combo", PriceKobo: 200_000, Active: true, Items: []domain.VoucherItem{{Name: "Wings", Qty: 2}},
	})
	if err != nil || p.Kind != domain.VoucherKindBundle {
		t.Fatalf("got %+v %v", p, err)
	}
	if _, err := s.AdminCreateProduct(ctx, dto.VoucherProductRequest{Name: "Empty", PriceKobo: 200_000}); !errors.Is(err, ErrVoucherProductInvalid) {
		t.Errorf("a bundle with no items: got %v", err)
	}
}

// A product's kind never changes after it is made, whatever an edit asks for.
func TestEditingKeepsTheKind(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	p := priceProduct(t, s, nil)

	edited, err := s.AdminUpdateProduct(ctx, p.ID, dto.VoucherProductRequest{
		Kind: "BUNDLE", Name: "Renamed", PriceKobo: 500_000, Active: false,
		Items: []domain.VoucherItem{{Name: "Burger", Qty: 1}},
	})
	// The edit is checked as a price voucher: items are dropped, not turned into a bundle.
	if err != nil {
		t.Fatal(err)
	}
	if edited.Kind != domain.VoucherKindValue || len(edited.Items) != 0 || edited.Name != "Renamed" || edited.PriceKobo != 500_000 {
		t.Errorf("unexpected edit result: %+v", edited)
	}
}

// The shop shows bundles only, and a price voucher can't be bought even by id.
func TestPriceVouchersAreNotSold(t *testing.T) {
	s, repo := voucherFixture()
	ctx := context.Background()
	p := priceProduct(t, s, nil)

	shop, _ := s.ListProducts(ctx)
	for _, sp := range shop {
		if sp.ID == p.ID {
			t.Fatal("a price voucher is in the shop list")
		}
	}
	admin, _ := s.AdminListProducts(ctx)
	found := false
	for _, ap := range admin {
		found = found || ap.ID == p.ID
	}
	if !found {
		t.Error("the admin list should include price vouchers")
	}

	repo.balance["buyer"] = 5_000_000
	_, err := s.Purchase(ctx, "buyer", dto.PurchaseVoucherRequest{
		ProductID: p.ID, HolderName: "Tolu", ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	})
	if !errors.Is(err, ErrVoucherProductGone) {
		t.Errorf("buying a price voucher: got %v, want ErrVoucherProductGone", err)
	}
	if repo.balance["buyer"] != 5_000_000 {
		t.Errorf("a refused purchase moved money: balance %d", repo.balance["buyer"])
	}
}

// ---- giving them away ----

// A price voucher given to someone is an amount of money: no items, no price paid.
func TestIssuePriceVoucher(t *testing.T) {
	s, repo := voucherFixture()
	p := priceProduct(t, s, nil)

	out, err := s.AdminIssue(context.Background(), "admin", issueReq(p.ID, people("Tolu Ade")))
	if err != nil {
		t.Fatal(err)
	}
	v := out[0]
	if v.Kind != domain.VoucherKindValue || v.PriceKobo != 1_000_000 || v.Name != "Thank you voucher" || len(v.Items) != 0 {
		t.Fatalf("unexpected voucher: %+v", v)
	}
	if v.Description != DefaultValueVoucherDescription || v.Source != domain.VoucherAdminIssued || !v.Redeemable {
		t.Errorf("description=%q source=%s redeemable=%v", v.Description, v.Source, v.Redeemable)
	}
	if stored := repo.vouchers[v.Code]; stored == nil || stored.Kind != domain.VoucherKindValue {
		t.Errorf("stored voucher: %+v", stored)
	}
}

// A price voucher is redeemed once, for its whole amount.
func TestPriceVoucherRedeemsOnce(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	p := priceProduct(t, s, nil)
	out, _ := s.AdminIssue(ctx, "admin", issueReq(p.ID, people("Tolu")))

	first, err := s.Redeem(ctx, out[0].Code, "staff")
	if err != nil || !first.Redeemed || first.Voucher.PriceKobo != 1_000_000 {
		t.Fatalf("first redeem: %+v %v", first, err)
	}
	if second, err := s.Redeem(ctx, out[0].Code, "staff"); err != nil || second.Redeemed {
		t.Fatalf("second redeem must be refused: %+v %v", second, err)
	}
}

// One price voucher saved in the catalogue is reused for many people, and edits to
// it later never change a voucher someone already holds.
func TestPriceVoucherIsReusableAndSnapshotted(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	p := priceProduct(t, s, nil)

	a, _ := s.AdminIssue(ctx, "admin", issueReq(p.ID, people("Ada")))
	if _, err := s.AdminUpdateProduct(ctx, p.ID, priceProductReq(func(r *dto.VoucherProductRequest) { r.PriceKobo = 2_000_000 })); err != nil {
		t.Fatal(err)
	}
	b, _ := s.AdminIssue(ctx, "admin", issueReq(p.ID, people("Bayo")))

	held, _ := s.GetByCode(ctx, a[0].Code)
	if held.PriceKobo != 1_000_000 || b[0].PriceKobo != 2_000_000 {
		t.Errorf("first voucher %d (want 1000000), second %d (want 2000000)", held.PriceKobo, b[0].PriceKobo)
	}
}

func TestBundleViewCarriesKindDescriptionAndPrice(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	out, _ := s.AdminIssue(ctx, "admin", issueReq(testBurgerID, people("Ada")))
	if out[0].PriceKobo != 450_000 || out[0].Kind != domain.VoucherKindBundle || len(out[0].Items) != 2 {
		t.Errorf("bundle view: %+v", out[0].VoucherView)
	}
	got, err := s.GetByCode(ctx, out[0].Code)
	if err != nil || got.PriceKobo != 450_000 {
		t.Errorf("public lookup should carry the price: %+v %v", got, err)
	}
}

// ---- giving the same bundle to several people ----

func TestIssueToSeveralPeople(t *testing.T) {
	s, repo := voucherFixture()
	ctx := context.Background()
	recipients := []dto.IssueRecipient{
		{HolderName: "Ada", HolderEmail: "ada@example.org"},
		{HolderName: "Bayo", HolderUserID: testVoucherUserID},
		{HolderName: "Chidi"},
	}
	out, err := s.AdminIssue(ctx, "admin", issueReq(testBurgerID, recipients))
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 3 || len(repo.vouchers) != 3 {
		t.Fatalf("made %d vouchers (%d stored), want 3", len(out), len(repo.vouchers))
	}
	codes := map[string]bool{}
	for i, v := range out {
		if codes[v.Code] {
			t.Errorf("code %s used twice", v.Code)
		}
		codes[v.Code] = true
		if v.HolderName != recipients[i].HolderName || v.Name != "Burger and drink" || v.PriceKobo != 450_000 {
			t.Errorf("voucher %d: %+v", i, v)
		}
	}
	// The linked account's voucher shows in their My Vouchers, with the account's email.
	if out[1].HolderUserID == nil || *out[1].HolderUserID != testVoucherUserID || out[1].HolderEmail == nil {
		t.Errorf("linked recipient: %+v", out[1])
	}
	if mine, _ := s.ListMine(ctx, testVoucherUserID); len(mine) != 1 {
		t.Errorf("ListMine = %d, want 1", len(mine))
	}
}

// One bad person in the list means nobody gets a voucher.
func TestIssueToSeveralIsAllOrNothing(t *testing.T) {
	s, repo := voucherFixture()
	ctx := context.Background()
	for name, bad := range map[string]dto.IssueRecipient{
		"no name":         {HolderName: " "},
		"bad email":       {HolderName: "Dee", HolderEmail: "not-an-email"},
		"unknown account": {HolderName: "Eze", HolderUserID: testGhostUserID},
	} {
		recipients := []dto.IssueRecipient{{HolderName: "Ada"}, bad, {HolderName: "Bayo"}}
		if _, err := s.AdminIssue(ctx, "admin", issueReq(testBurgerID, recipients)); err == nil {
			t.Errorf("%s: expected an error", name)
		}
		if len(repo.vouchers) != 0 {
			t.Fatalf("%s: %d vouchers were made although the list had a mistake", name, len(repo.vouchers))
		}
	}
}

func TestIssueRecipientLimits(t *testing.T) {
	s, repo := voucherFixture()
	ctx := context.Background()
	if _, err := s.AdminIssue(ctx, "admin", issueReq(testBurgerID, nil)); !errors.Is(err, ErrVoucherNoRecipients) {
		t.Errorf("no recipients: got %v", err)
	}
	names := make([]string, voucherMaxRecipients+1)
	for i := range names {
		names[i] = fmt.Sprintf("Person %d", i)
	}
	if _, err := s.AdminIssue(ctx, "admin", issueReq(testBurgerID, people(names...))); !errors.Is(err, ErrVoucherTooMany) {
		t.Errorf("too many: got %v", err)
	}
	if len(repo.vouchers) != 0 {
		t.Error("a refused request made vouchers")
	}
	if out, err := s.AdminIssue(ctx, "admin", issueReq(testBurgerID, people(names[:voucherMaxRecipients]...))); err != nil || len(out) != voucherMaxRecipients {
		t.Errorf("exactly the limit should work: %d vouchers, %v", len(out), err)
	}
}

func TestIssueNeedsAValidProductAndDates(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	if _, err := s.AdminIssue(ctx, "admin", issueReq(testMissingProductID, people("Ada"))); !errors.Is(err, ErrVoucherProductGone) {
		t.Errorf("unknown product: got %v", err)
	}
	bad := issueReq(testBurgerID, people("Ada"))
	bad.ValidFrom, bad.ValidTo = "2026-11-10", "2026-11-09"
	if _, err := s.AdminIssue(ctx, "admin", bad); !errors.Is(err, ErrVoucherDates) {
		t.Errorf("bad dates: got %v", err)
	}
}

// ---- emails ----

type sentEmail struct{ to, subject, html string }

type captureEmail struct {
	mu   sync.Mutex
	sent []sentEmail
	wg   sync.WaitGroup
}

func (c *captureEmail) SendEmail(to, subject, html string) error {
	c.mu.Lock()
	c.sent = append(c.sent, sentEmail{to, subject, html})
	c.mu.Unlock()
	c.wg.Done()
	return nil
}

// issueAndCollect issues vouchers and waits for the n emails they should send.
func issueAndCollect(t *testing.T, build func(s *VoucherService) dto.IssueVoucherRequest, n int) []sentEmail {
	t.Helper()
	s, _ := voucherFixture()
	mail := &captureEmail{}
	s.WithEmail(mail)
	mail.wg.Add(n)
	if _, err := s.AdminIssue(context.Background(), "admin", build(s)); err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() { mail.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatalf("expected %d emails, got %d", n, len(mail.sent))
	}
	// Anything beyond n would be a duplicate; give it a moment to show up.
	time.Sleep(50 * time.Millisecond)
	mail.mu.Lock()
	defer mail.mu.Unlock()
	if len(mail.sent) != n {
		t.Fatalf("sent %d emails, want %d", len(mail.sent), n)
	}
	return append([]sentEmail(nil), mail.sent...)
}

func recipientsOf(list []sentEmail) []string {
	out := make([]string, len(list))
	for i, e := range list {
		out[i] = e.to
	}
	sort.Strings(out)
	return out
}

func burgerFor(r ...dto.IssueRecipient) func(*VoucherService) dto.IssueVoucherRequest {
	return func(*VoucherService) dto.IssueVoucherRequest { return issueReq(testBurgerID, r) }
}

// Linking an account emails that account even when no email was typed.
func TestLinkingAnAccountEmailsIt(t *testing.T) {
	got := issueAndCollect(t, burgerFor(dto.IssueRecipient{HolderName: "Ada", HolderUserID: testVoucherUserID}), 1)
	if got[0].to != testVoucherUserID+"@example.com" {
		t.Errorf("sent to %q, want the linked account's email", got[0].to)
	}
}

// A typed address that differs from the account's still gets the voucher, and so
// does the account, each once.
func TestLinkedAccountAndTypedEmailBothGetIt(t *testing.T) {
	got := issueAndCollect(t, burgerFor(dto.IssueRecipient{
		HolderName: "Ada", HolderEmail: "ada.personal@example.org", HolderUserID: testVoucherUserID,
	}), 2)
	want := []string{"ada.personal@example.org", testVoucherUserID + "@example.com"}
	sort.Strings(want)
	if r := recipientsOf(got); r[0] != want[0] || r[1] != want[1] {
		t.Errorf("recipients = %v, want %v", r, want)
	}
}

// The same address typed and linked is one email, not two.
func TestSameAddressIsEmailedOnce(t *testing.T) {
	got := issueAndCollect(t, burgerFor(dto.IssueRecipient{
		HolderName: "Ada", HolderEmail: strings.ToUpper(testVoucherUserID) + "@EXAMPLE.COM", HolderUserID: testVoucherUserID,
	}), 1)
	if len(got) != 1 {
		t.Fatalf("got %d emails", len(got))
	}
}

// Everyone in a group gets their own email, with their own code and name.
func TestEachPersonInAGroupIsEmailed(t *testing.T) {
	got := issueAndCollect(t, burgerFor(
		dto.IssueRecipient{HolderName: "Ada", HolderEmail: "ada@example.org"},
		dto.IssueRecipient{HolderName: "Bayo", HolderEmail: "bayo@example.org"},
		dto.IssueRecipient{HolderName: "Chidi"}, // no email, so none for them
	), 2)
	if r := recipientsOf(got); r[0] != "ada@example.org" || r[1] != "bayo@example.org" {
		t.Errorf("recipients = %v", r)
	}
	for _, e := range got {
		name := "Ada"
		if e.to == "bayo@example.org" {
			name = "Bayo"
		}
		if !strings.Contains(e.html, name) {
			t.Errorf("%s's email should name %s", e.to, name)
		}
	}
}

// A free bundle's email still shows what the bundle is worth.
func TestFreeBundleEmailShowsItsPrice(t *testing.T) {
	got := issueAndCollect(t, burgerFor(dto.IssueRecipient{HolderName: "Ada", HolderEmail: "ada@example.org"}), 1)
	html := got[0].html
	if !strings.Contains(html, "4,500") || !strings.Contains(html, "Value") || !strings.Contains(html, "Burger") {
		t.Errorf("the bundle's ₦4,500 price and items should be in the email")
	}
}

// A price voucher's email leads with the amount and its description, with no items.
func TestPriceVoucherEmailShowsAmountAndDescription(t *testing.T) {
	got := issueAndCollect(t, func(s *VoucherService) dto.IssueVoucherRequest {
		p := priceProduct(t, s, func(r *dto.VoucherProductRequest) { r.Description = "Enjoy a night on us." })
		return issueReq(p.ID, []dto.IssueRecipient{{HolderName: "Tolu", HolderEmail: "tolu@example.org"}})
	}, 1)
	html := got[0].html
	for _, want := range []string{"10,000", "Thank you voucher", "Enjoy a night on us."} {
		if !strings.Contains(html, want) {
			t.Errorf("email is missing %q", want)
		}
	}
	if strings.Contains(html, " covers") {
		t.Errorf("a price voucher has no item list")
	}
}
