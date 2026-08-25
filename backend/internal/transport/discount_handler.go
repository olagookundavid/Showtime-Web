package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IDiscountHandler interface {
	List(c *gin.Context)
	Get(c *gin.Context)
	Create(c *gin.Context)
	Update(c *gin.Context)
	Delete(c *gin.Context)
	ListTargets(c *gin.Context)
	Preview(c *gin.Context)
}

type DiscountHandler struct {
	service      services.IDiscountService
	storeService services.IStoreService
	tierRepo     ports.TicketTierRepository
}

func NewDiscountHandler(service services.IDiscountService, storeService services.IStoreService, tierRepo ports.TicketTierRepository) IDiscountHandler {
	return &DiscountHandler{service: service, storeService: storeService, tierRepo: tierRepo}
}

// statusForDiscountErr maps the business errors onto HTTP codes. Everything a
// buyer can trigger by typing a code is a 400 carrying the reason verbatim.
func statusForDiscountErr(err error) int {
	switch {
	case errors.Is(err, appErrors.ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, appErrors.ErrDuplicateDiscountCode):
		return http.StatusConflict
	default:
		return http.StatusBadRequest
	}
}

func (h *DiscountHandler) List(c *gin.Context) {
	codes, err := h.service.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": codes})
}

func (h *DiscountHandler) Get(c *gin.Context) {
	code, err := h.service.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(statusForDiscountErr(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": code})
}

func (h *DiscountHandler) Create(c *gin.Context) {
	var req dto.SaveDiscountCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var createdBy string
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		createdBy = payload.UserId
	}

	code, err := h.service.Create(c.Request.Context(), createdBy, req)
	if err != nil {
		c.JSON(statusForDiscountErr(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": code})
}

func (h *DiscountHandler) Update(c *gin.Context) {
	var req dto.SaveDiscountCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code, err := h.service.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		c.JSON(statusForDiscountErr(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": code})
}

func (h *DiscountHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(statusForDiscountErr(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Discount code deleted"})
}

func (h *DiscountHandler) ListTargets(c *gin.Context) {
	targets, err := h.service.ListTargets(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": targets})
}

// Preview tells the checkout what a code would do, without committing to it.
// The cart is priced through the very same code path the real checkout uses, so
// the saving quoted here is the saving the buyer gets charged.
func (h *DiscountHandler) Preview(c *gin.Context) {
	var req dto.PreviewDiscountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isAuthenticated := false
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil && payload.UserId != "" {
		isAuthenticated = true
	}

	var lines []services.CartLine

	switch {
	case len(req.Items) > 0:
		priced, err := h.storeService.PriceCartLines(c.Request.Context(), req.Items)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		lines = priced

	case req.TierID != "":
		tier, err := h.tierRepo.GetByID(c.Request.Context(), req.TierID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ticket tier not found"})
			return
		}
		qty := req.Quantity
		if qty < 1 {
			qty = 1
		}
		lines = []services.CartLine{{
			EntityType: domain.DiscountEntityTicketTier,
			EntityID:   tier.ID,
			Name:       tier.Name,
			UnitPrice:  float64(tier.Price),
			Quantity:   qty,
		}}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "nothing to apply the code to"})
		return
	}

	c.JSON(http.StatusOK, h.service.Preview(c.Request.Context(), isAuthenticated, lines, req.Code))
}
