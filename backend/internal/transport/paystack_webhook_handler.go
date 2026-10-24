package transport

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
)

// Paystack sends every event for the account to the one webhook URL set on its
// dashboard. Tickets, store orders and fantasy league fees each had their own
// endpoint, so whichever one the dashboard named, the other two never heard about
// a payment. This one handler takes any of them and hands the payment to whichever
// part of the app its reference belongs to. Every old webhook path is served by it
// too, so the dashboard keeps working whichever of them it is set to.

// The parts of the app a payment can belong to. Each looks a reference up and,
// when it is theirs, confirms the payment.
type (
	ticketPayments interface {
		GetByReference(ctx context.Context, reference string) (*domain.Ticket, error)
	}
	ticketPaymentConfirmer interface {
		HandleWebhook(ctx context.Context, reference string) error
	}
	storePayments interface {
		GetOrderByPaystackRef(ctx context.Context, reference string) (*domain.Order, error)
	}
	storePaymentConfirmer interface {
		VerifyPayment(ctx context.Context, reference string) (*dto.OrderResponse, error)
	}
	leaguePayments interface {
		GetMemberByPaystackRef(ctx context.Context, reference string) (*domain.FantasyLeagueMember, error)
	}
	leaguePaymentConfirmer interface {
		LeagueWebhook(ctx context.Context, payload []byte, signature string) error
	}
)

type PaystackWebhookHandler struct {
	secret       func() string
	tickets      ticketPayments
	confirmTkt   ticketPaymentConfirmer
	orders       storePayments
	confirmOrder storePaymentConfirmer
	members      leaguePayments
	confirmFee   leaguePaymentConfirmer
}

func NewPaystackWebhookHandler(
	secret func() string,
	tickets ticketPayments, confirmTkt ticketPaymentConfirmer,
	orders storePayments, confirmOrder storePaymentConfirmer,
	members leaguePayments, confirmFee leaguePaymentConfirmer,
) *PaystackWebhookHandler {
	return &PaystackWebhookHandler{
		secret: secret, tickets: tickets, confirmTkt: confirmTkt,
		orders: orders, confirmOrder: confirmOrder, members: members, confirmFee: confirmFee,
	}
}

// errUnknownReference is a payment none of the app's parts recognise.
var errUnknownReference = errors.New("no ticket, order or league fee has this reference")

// Webhook godoc
// @Summary Paystack webhook for every payment (tickets, store orders, fantasy league fees)
// @Tags payments
// @Accept json
// @Success 200
// @Router /api/v1/paystack/webhook [post]
func (h *PaystackWebhookHandler) Webhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return
	}
	signature := c.GetHeader("x-paystack-signature")
	if signature == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
		return
	}
	if !validPaystackSignature(h.secret(), body, signature) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var event struct {
		Event string `json:"event"`
		Data  struct {
			Reference string `json:"reference"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	// Only a successful charge confirms anything; acknowledge the rest so Paystack
	// does not keep resending them.
	if event.Event != "charge.success" || event.Data.Reference == "" {
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
		return
	}

	err = h.route(c.Request.Context(), event.Data.Reference, body, signature)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	case errors.Is(err, errUnknownReference):
		// Not ours (another integration on the account, or a test): acknowledged,
		// but logged in case it is a payment that should have been found.
		fmt.Printf("⚠️ WARNING: Paystack webhook for unknown reference %s\n", event.Data.Reference)
		c.JSON(http.StatusOK, gin.H{"status": "unknown reference"})
	default:
		// A 500 makes Paystack try again later, which is what a passing database or
		// network fault needs.
		fmt.Printf("⚠️ WARNING: Paystack webhook for %s failed: %s\n", event.Data.Reference, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

// route confirms the payment with the part of the app its reference belongs to.
func (h *PaystackWebhookHandler) route(ctx context.Context, reference string, body []byte, signature string) error {
	if _, err := h.tickets.GetByReference(ctx, reference); err == nil {
		return h.confirmTkt.HandleWebhook(ctx, reference)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("looking up the ticket: %w", err)
	}

	if _, err := h.orders.GetOrderByPaystackRef(ctx, reference); err == nil {
		_, err := h.confirmOrder.VerifyPayment(ctx, reference)
		return err
	} else if !errors.Is(err, appErrors.ErrNotFound) {
		return fmt.Errorf("looking up the order: %w", err)
	}

	member, err := h.members.GetMemberByPaystackRef(ctx, reference)
	if err != nil {
		return fmt.Errorf("looking up the league fee: %w", err)
	}
	if member != nil {
		return h.confirmFee.LeagueWebhook(ctx, body, signature)
	}
	return errUnknownReference
}

func validPaystackSignature(secret string, body []byte, signature string) bool {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	return hmac.Equal([]byte(signature), []byte(hex.EncodeToString(mac.Sum(nil))))
}
