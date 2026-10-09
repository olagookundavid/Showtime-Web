package transport

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"

	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Only the methods the webhook calls are implemented; the embedded interfaces
// would panic on anything else, which is the point.
type webhookTicketService struct {
	services.ITicketService
	got string
}

func (s *webhookTicketService) HandleWebhook(_ context.Context, ref string) error {
	s.got = ref
	return nil
}

type webhookGamePassService struct {
	services.IGamePassService
	got string
}

func (s *webhookGamePassService) HandleWebhook(_ context.Context, ref string) error {
	s.got = ref
	return nil
}

// Paystack calls only /tickets/webhook, so Game Pass references must be routed
// from there and single tickets must keep going where they always did.
func TestTicketWebhookRoutesGamePassReferences(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("PAYSTACK_SECRET_KEY", "sk_test_dispatch")
	paystack := services.NewPaystackClient()

	cases := []struct {
		ref          string
		wantGamePass bool
	}{
		{"SFFL-GP-ABC123DEF456", true},
		{"SFFL-1a2b3c4d5e6f", false},
	}
	for _, tc := range cases {
		tickets := &webhookTicketService{}
		gamePass := &webhookGamePassService{}
		h := NewTicketHandler(tickets, paystack).(*TicketHandler)
		h.WithGamePass(gamePass)

		body := []byte(`{"event":"charge.success","data":{"reference":"` + tc.ref + `"}}`)
		mac := hmac.New(sha512.New, []byte("sk_test_dispatch"))
		mac.Write(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/tickets/webhook", bytes.NewReader(body))
		c.Request.Header.Set("x-paystack-signature", hex.EncodeToString(mac.Sum(nil)))
		h.Webhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("%s: status %d", tc.ref, w.Code)
		}
		if tc.wantGamePass && (gamePass.got != tc.ref || tickets.got != "") {
			t.Fatalf("%s: expected Game Pass to handle it (gamePass=%q tickets=%q)", tc.ref, gamePass.got, tickets.got)
		}
		if !tc.wantGamePass && (tickets.got != tc.ref || gamePass.got != "") {
			t.Fatalf("%s: expected tickets to handle it (gamePass=%q tickets=%q)", tc.ref, gamePass.got, tickets.got)
		}
	}
}
