package services

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

func valueReq(mod func(*dto.IssueVoucherRequest)) dto.IssueVoucherRequest {
	r := dto.IssueVoucherRequest{
		Kind: "VALUE", Name: "Thank you voucher", AmountKobo: 1_000_000,
		HolderName: "Tolu Ade", ValidFrom: "2026-11-10", ValidTo: "2026-12-10",
	}
	if mod != nil {
		mod(&r)
	}
	return r
}

// A price voucher is an amount of money: no items, no product, and it can never be
// bought, only given.
func TestAdminIssueValueVoucher(t *testing.T) {
	s, repo := voucherFixture()

	v, err := s.AdminIssue(context.Background(), "admin", valueReq(nil))
	if err != nil {
		t.Fatal(err)
	}
	if v.Kind != domain.VoucherKindValue || v.PriceKobo != 1_000_000 || v.Name != "Thank you voucher" {
		t.Fatalf("unexpected voucher: %+v", v)
	}
	if len(v.Items) != 0 {
		t.Errorf("a price voucher has no items, got %v", v.Items)
	}
	if v.Description != DefaultValueVoucherDescription {
		t.Errorf("empty description should get the default, got %q", v.Description)
	}
	if v.Source != domain.VoucherAdminIssued || !v.Redeemable {
		t.Errorf("source=%s redeemable=%v, want an admin gift that can be redeemed", v.Source, v.Redeemable)
	}
	stored := repo.vouchers[v.Code]
	if stored == nil || stored.ProductID != nil || stored.Kind != domain.VoucherKindValue {
		t.Errorf("stored voucher should have no product and kind VALUE: %+v", stored)
	}
}

func TestValueVoucherKeepsAnEditedDescription(t *testing.T) {
	s, _ := voucherFixture()
	v, err := s.AdminIssue(context.Background(), "admin", valueReq(func(r *dto.IssueVoucherRequest) {
		r.Description = "  Good for anything on the site or at the bar.  "
	}))
	if err != nil {
		t.Fatal(err)
	}
	if v.Description != "Good for anything on the site or at the bar." {
		t.Errorf("description = %q", v.Description)
	}
}

func TestValueVoucherValidation(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	for name, mod := range map[string]func(*dto.IssueVoucherRequest){
		"no name":      func(r *dto.IssueVoucherRequest) { r.Name = "  " },
		"zero amount":  func(r *dto.IssueVoucherRequest) { r.AmountKobo = 0 },
		"negative":     func(r *dto.IssueVoucherRequest) { r.AmountKobo = -5 },
		"over the cap": func(r *dto.IssueVoucherRequest) { r.AmountKobo = voucherMaxValueKobo + 1 },
		"long name":    func(r *dto.IssueVoucherRequest) { r.Name = strings.Repeat("x", 101) },
		"long text":    func(r *dto.IssueVoucherRequest) { r.Description = strings.Repeat("x", 301) },
	} {
		if _, err := s.AdminIssue(ctx, "admin", valueReq(mod)); !errors.Is(err, ErrVoucherValueInvalid) {
			t.Errorf("%s: got %v, want ErrVoucherValueInvalid", name, err)
		}
	}
	if _, err := s.AdminIssue(ctx, "admin", valueReq(func(r *dto.IssueVoucherRequest) { r.Kind = "GIFTCARD" })); !errors.Is(err, ErrVoucherKind) {
		t.Errorf("unknown kind: got %v", err)
	}
	// The ceiling itself is allowed.
	if _, err := s.AdminIssue(ctx, "admin", valueReq(func(r *dto.IssueVoucherRequest) { r.AmountKobo = voucherMaxValueKobo })); err != nil {
		t.Errorf("the maximum amount should be accepted: %v", err)
	}
}

// Leaving the kind out still means a bundle, so existing callers are unchanged and a
// bundle still needs its product.
func TestIssueDefaultsToABundle(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()

	v, err := s.AdminIssue(ctx, "admin", dto.IssueVoucherRequest{
		ProductID: testBurgerID, HolderName: "Ada", ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	})
	if err != nil {
		t.Fatal(err)
	}
	if v.Kind != domain.VoucherKindBundle || v.PriceKobo != 450_000 || len(v.Items) != 2 {
		t.Errorf("unexpected bundle voucher: %+v", v)
	}
	if _, err := s.AdminIssue(ctx, "admin", dto.IssueVoucherRequest{
		HolderName: "Ada", ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	}); !errors.Is(err, ErrVoucherProductGone) {
		t.Errorf("a bundle without a product: got %v", err)
	}
}

// A price voucher is redeemed once, for its whole amount, like any other voucher.
func TestValueVoucherRedeemsOnce(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()
	v, err := s.AdminIssue(ctx, "admin", valueReq(nil))
	if err != nil {
		t.Fatal(err)
	}

	first, err := s.Redeem(ctx, v.Code, "staff")
	if err != nil || !first.Redeemed || first.Voucher.PriceKobo != 1_000_000 {
		t.Fatalf("first redeem: %+v %v", first, err)
	}
	second, err := s.Redeem(ctx, v.Code, "staff")
	if err != nil || second.Redeemed {
		t.Fatalf("second redeem must be refused: %+v %v", second, err)
	}
}

// Both kinds show their price to the holder, bought or given.
func TestViewCarriesKindDescriptionAndPrice(t *testing.T) {
	s, _ := voucherFixture()
	ctx := context.Background()

	bundle, _ := s.AdminIssue(ctx, "admin", dto.IssueVoucherRequest{
		ProductID: testBurgerID, HolderName: "Ada", ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	})
	if bundle.PriceKobo != 450_000 || bundle.Kind != domain.VoucherKindBundle {
		t.Errorf("bundle view: %+v", bundle.VoucherView)
	}
	got, err := s.GetByCode(ctx, bundle.Code)
	if err != nil || got.PriceKobo != 450_000 {
		t.Errorf("public lookup should carry the price: %+v %v", got, err)
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

// issueAndCollect issues a voucher and waits for the n emails it should send.
func issueAndCollect(t *testing.T, req dto.IssueVoucherRequest, n int) []sentEmail {
	t.Helper()
	s, _ := voucherFixture()
	mail := &captureEmail{}
	s.WithEmail(mail)
	mail.wg.Add(n)
	if _, err := s.AdminIssue(context.Background(), "admin", req); err != nil {
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

func recipients(list []sentEmail) []string {
	out := make([]string, len(list))
	for i, e := range list {
		out[i] = e.to
	}
	sort.Strings(out)
	return out
}

// Linking an account emails that account even when no email was typed.
func TestLinkingAnAccountEmailsIt(t *testing.T) {
	got := issueAndCollect(t, dto.IssueVoucherRequest{
		ProductID: testBurgerID, HolderName: "Ada", HolderUserID: testVoucherUserID,
		ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	}, 1)
	if got[0].to != testVoucherUserID+"@example.com" {
		t.Errorf("sent to %q, want the linked account's email", got[0].to)
	}
}

// A typed address that differs from the account's still gets the voucher, and so
// does the account, each once.
func TestLinkedAccountAndTypedEmailBothGetIt(t *testing.T) {
	got := issueAndCollect(t, dto.IssueVoucherRequest{
		ProductID: testBurgerID, HolderName: "Ada", HolderEmail: "ada.personal@example.org",
		HolderUserID: testVoucherUserID, ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	}, 2)
	want := []string{"ada.personal@example.org", testVoucherUserID + "@example.com"}
	sort.Strings(want)
	if r := recipients(got); r[0] != want[0] || r[1] != want[1] {
		t.Errorf("recipients = %v, want %v", r, want)
	}
}

// The same address typed and linked is one email, not two.
func TestSameAddressIsEmailedOnce(t *testing.T) {
	got := issueAndCollect(t, dto.IssueVoucherRequest{
		ProductID: testBurgerID, HolderName: "Ada", HolderEmail: strings.ToUpper(testVoucherUserID) + "@EXAMPLE.COM",
		HolderUserID: testVoucherUserID, ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	}, 1)
	if len(got) != 1 {
		t.Fatalf("got %d emails", len(got))
	}
}

// A free bundle's email still shows what the bundle is worth.
func TestFreeBundleEmailShowsItsPrice(t *testing.T) {
	got := issueAndCollect(t, dto.IssueVoucherRequest{
		ProductID: testBurgerID, HolderName: "Ada", HolderEmail: "ada@example.org",
		ValidFrom: "2026-11-10", ValidTo: "2026-11-10",
	}, 1)
	html := got[0].html
	if !strings.Contains(html, "4,500") || !strings.Contains(html, "Value") {
		t.Errorf("the bundle's ₦4,500 price should be in the email")
	}
	if !strings.Contains(html, "Burger") {
		t.Errorf("the items should still be listed")
	}
}

// A price voucher's email leads with the amount and its description, with no items.
func TestPriceVoucherEmailShowsAmountAndDescription(t *testing.T) {
	got := issueAndCollect(t, valueReq(func(r *dto.IssueVoucherRequest) {
		r.HolderEmail = "tolu@example.org"
		r.Description = "Enjoy a night on us."
	}), 1)
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
