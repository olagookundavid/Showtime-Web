package transport

import (
	"errors"
	"net/http"

	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IGamePassHandler interface {
	// Season admission tiers
	ListActiveSeasonTiers(c *gin.Context)
	ListSeasonTiers(c *gin.Context)
	CreateSeasonTier(c *gin.Context)
	UpdateSeasonTier(c *gin.Context)
	DeleteSeasonTier(c *gin.Context)

	// Discount bands
	ListActiveDiscountBands(c *gin.Context)
	ListDiscountBands(c *gin.Context)
	GetDiscountBand(c *gin.Context)
	CreateDiscountBand(c *gin.Context)
	UpdateDiscountBand(c *gin.Context)
	SetDiscountBandStatus(c *gin.Context)
	DeleteDiscountBand(c *gin.Context)

	// Leads
	CreateLead(c *gin.Context)
	ListLeads(c *gin.Context)
	UpdateLead(c *gin.Context)
}

type GamePassHandler struct {
	service services.IGamePassService
}

func NewGamePassHandler(service services.IGamePassService) IGamePassHandler {
	return &GamePassHandler{service: service}
}

// statusForGamePassErr maps Game Pass errors onto HTTP codes. Validation
// failures are 422 with the reason verbatim, so the admin sees which band or
// field is the problem.
func statusForGamePassErr(err error) int {
	switch {
	case errors.Is(err, appErrors.ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, appErrors.ErrDuplicateSeasonTier):
		return http.StatusConflict
	case errors.Is(err, appErrors.ErrInvalidGamePassConfig):
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

func gamePassError(c *gin.Context, err error) {
	c.JSON(statusForGamePassErr(err), gin.H{"error": err.Error()})
}

// ─── Season admission tiers ───────────────────────────────────────────────────

func (h *GamePassHandler) ListActiveSeasonTiers(c *gin.Context) {
	tiers, err := h.service.ListSeasonTiers(c.Request.Context(), true)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tiers})
}

func (h *GamePassHandler) ListSeasonTiers(c *gin.Context) {
	tiers, err := h.service.ListSeasonTiers(c.Request.Context(), false)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tiers})
}

func (h *GamePassHandler) CreateSeasonTier(c *gin.Context) {
	var req dto.CreateSeasonAdmissionTierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tier, err := h.service.CreateSeasonTier(c.Request.Context(), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": tier})
}

func (h *GamePassHandler) UpdateSeasonTier(c *gin.Context) {
	var req dto.UpdateSeasonAdmissionTierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tier, err := h.service.UpdateSeasonTier(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tier})
}

func (h *GamePassHandler) DeleteSeasonTier(c *gin.Context) {
	if err := h.service.DeleteSeasonTier(c.Request.Context(), c.Param("id")); err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Season admission tier deleted"})
}

// ─── Discount bands ───────────────────────────────────────────────────────────

func (h *GamePassHandler) ListActiveDiscountBands(c *gin.Context) {
	bands, err := h.service.ListDiscountBands(c.Request.Context(), true)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": bands})
}

func (h *GamePassHandler) ListDiscountBands(c *gin.Context) {
	bands, err := h.service.ListDiscountBands(c.Request.Context(), false)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": bands})
}

func (h *GamePassHandler) GetDiscountBand(c *gin.Context) {
	band, err := h.service.GetDiscountBand(c.Request.Context(), c.Param("id"))
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": band})
}

func (h *GamePassHandler) CreateDiscountBand(c *gin.Context) {
	var req dto.CreateGamePassDiscountBandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	band, err := h.service.CreateDiscountBand(c.Request.Context(), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": band})
}

func (h *GamePassHandler) UpdateDiscountBand(c *gin.Context) {
	var req dto.UpdateGamePassDiscountBandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	band, err := h.service.UpdateDiscountBand(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": band})
}

func (h *GamePassHandler) SetDiscountBandStatus(c *gin.Context) {
	var req dto.UpdateGamePassDiscountBandStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	band, err := h.service.SetDiscountBandStatus(c.Request.Context(), c.Param("id"), *req.IsActive)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": band})
}

func (h *GamePassHandler) DeleteDiscountBand(c *gin.Context) {
	if err := h.service.DeleteDiscountBand(c.Request.Context(), c.Param("id")); err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Discount band deleted"})
}

// ─── Leads ────────────────────────────────────────────────────────────────────

// CreateLead stores a buyer's "notify me" interest. The response carries the
// server's quote, which is what the lead was recorded at.
func (h *GamePassHandler) CreateLead(c *gin.Context) {
	var req dto.CreateGamePassLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	lead, err := h.service.CreateLead(c.Request.Context(), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": lead})
}

func (h *GamePassHandler) ListLeads(c *gin.Context) {
	page, limit := pageParams(c, 50)
	leads, total, err := h.service.ListLeads(c.Request.Context(), c.Query("status"), c.Query("email"), page, limit)
	if err != nil {
		gamePassError(c, err)
		return
	}
	pagedJSON(c, leads, total, page, limit)
}

// UpdateLead changes a lead's status only.
func (h *GamePassHandler) UpdateLead(c *gin.Context) {
	var req dto.UpdateGamePassLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	lead, err := h.service.UpdateLeadStatus(c.Request.Context(), c.Param("id"), req.Status)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": lead})
}
