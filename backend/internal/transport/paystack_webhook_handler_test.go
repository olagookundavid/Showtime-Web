package transport

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
)

const testSecret = "sk_test_webhook"

// fakePayments knows one reference per kind of payment and records what was confirmed.
type fakePayments struct {
	ticketRef, orderRef, feeRef string
	lookupErr                   error
	confirmed                   []string
}

func (f *fakePayments) GetByReference(_ context.Context, ref string) (*domain.Ticket, error) {
	if f.lookupErr != nil {
		return nil, f.lookupErr
	}
	if ref == f.ticketRef {
		return &domain.Ticket{}, nil
	}
	return nil, pgx.ErrNoRows
}
func (f *fakePayments) HandleWebhook(_ context.Context, ref string) error {
	f.confirmed = append(f.confirmed, "ticket:"+ref)
	return nil
}
func (f *fakePayments) GetOrderByPaystackRef(_ context.Context, ref string) (*domain.Order, error) {
	if ref == f.orderRef {
		return &domain.Order{}, nil
	}
	return nil, appErrors.ErrNotFound
}
func (f *fakePayments) VerifyPayment(_ context.Context, ref string) (*dto.OrderResponse, error) {
	f.confirmed = append(f.confirmed, "order:"+ref)
	return &dto.OrderResponse{}, nil
}
func (f *fakePayments) GetMemberByPaystackRef(_ context.Context, ref string) (*domain.FantasyLeagueMember, error) {
	if ref == f.feeRef {
		return &domain.FantasyLeagueMember{}, nil
	}
	return nil, nil
}
func (f *fakePayments) LeagueWebhook(_ context.Context, _ []byte, _ string) error {
	f.confirmed = append(f.confirmed, "fee:"+f.feeRef)
	return nil
}

func sign(body string) string {
	mac := hmac.New(sha512.New, []byte(testSecret))
	mac.Write([]byte(body))
	return hex.EncodeToString(mac.Sum(nil))
}

func callWebhook(t *testing.T, f *fakePayments, body, signature string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	h := NewPaystackWebhookHandler(func() string { return testSecret }, f, f, f, f, f, f)
	r := gin.New()
	r.POST("/paystack/webhook", h.Webhook)
	req := httptest.NewRequest(http.MethodPost, "/paystack/webhook", strings.NewReader(body))
	if signature != "" {
		req.Header.Set("x-paystack-signature", signature)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func charge(ref string) string {
	return `{"event":"charge.success","data":{"reference":"` + ref + `","status":"success"}}`
}

func TestPaystackWebhookSendsEachPaymentToItsOwner(t *testing.T) {
	for _, c := range []struct{ ref, want string }{
		{"SFFL-TICKET01", "ticket:SFFL-TICKET01"},
		{"ORDER-REF", "order:ORDER-REF"},
		{"FEE-REF", "fee:FEE-REF"},
	} {
		f := &fakePayments{ticketRef: "SFFL-TICKET01", orderRef: "ORDER-REF", feeRef: "FEE-REF"}
		body := charge(c.ref)
		if w := callWebhook(t, f, body, sign(body)); w.Code != http.StatusOK {
			t.Errorf("%s: status %d, want 200 (%s)", c.ref, w.Code, w.Body.String())
		}
		if len(f.confirmed) != 1 || f.confirmed[0] != c.want {
			t.Errorf("%s: confirmed %v, want [%s]", c.ref, f.confirmed, c.want)
		}
	}
}

func TestPaystackWebhookRefusesBadSignatures(t *testing.T) {
	f := &fakePayments{ticketRef: "SFFL-TICKET01"}
	body := charge("SFFL-TICKET01")
	if w := callWebhook(t, f, body, ""); w.Code != http.StatusUnauthorized {
		t.Errorf("no signature: %d, want 401", w.Code)
	}
	if w := callWebhook(t, f, body, sign(body+"x")); w.Code != http.StatusUnauthorized {
		t.Errorf("wrong signature: %d, want 401", w.Code)
	}
	if len(f.confirmed) != 0 {
		t.Errorf("an unsigned call confirmed %v", f.confirmed)
	}
}

func TestPaystackWebhookAcknowledgesWhatIsNotOurs(t *testing.T) {
	f := &fakePayments{ticketRef: "SFFL-TICKET01"}
	body := charge("SOMEONE-ELSES")
	if w := callWebhook(t, f, body, sign(body)); w.Code != http.StatusOK || len(f.confirmed) != 0 {
		t.Errorf("unknown reference: %d, confirmed %v; want 200 and nothing", w.Code, f.confirmed)
	}
	other := `{"event":"transfer.success","data":{"reference":"SFFL-TICKET01"}}`
	if w := callWebhook(t, f, other, sign(other)); w.Code != http.StatusOK || len(f.confirmed) != 0 {
		t.Errorf("other event: %d, confirmed %v; want 200 and nothing", w.Code, f.confirmed)
	}
}

func TestPaystackWebhookAsksForARetryWhenTheDatabaseFails(t *testing.T) {
	f := &fakePayments{ticketRef: "SFFL-TICKET01", lookupErr: errors.New("connection refused")}
	body := charge("SFFL-TICKET01")
	if w := callWebhook(t, f, body, sign(body)); w.Code != http.StatusInternalServerError {
		t.Errorf("database down: %d, want 500 so Paystack retries", w.Code)
	}
}
