package transport

import (
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ISeasonHandler interface {
	ListGraphics(c *gin.Context)
	UpsertGraphic(c *gin.Context)
	ListMVPsPublic(c *gin.Context)
	ListMVPsAdmin(c *gin.Context)
	CreateMVP(c *gin.Context)
	UpdateMVP(c *gin.Context)
	DeleteMVP(c *gin.Context)
}

type SeasonHandler struct {
	service services.ISeasonService
}

func NewSeasonHandler(service services.ISeasonService) ISeasonHandler {
	return &SeasonHandler{service: service}
}

// ── Graphics ─────────────────────────────────────────────────────────────────

// ListGraphics returns both Team-of-the-Season graphics (public + admin).
func (h *SeasonHandler) ListGraphics(c *gin.Context) {
	graphics, err := h.service.ListGraphics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch season graphics"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": graphics})
}

// UpsertGraphic sets/replaces the graphic for a category (offense|defense).
func (h *SeasonHandler) UpsertGraphic(c *gin.Context) {
	var req dto.UpsertSeasonGraphicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g, err := h.service.UpsertGraphic(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, g)
}

// ── MVPs ─────────────────────────────────────────────────────────────────────

// ListMVPsPublic returns only ACTIVE MVPs for the homepage.
func (h *SeasonHandler) ListMVPsPublic(c *gin.Context) {
	mvps, err := h.service.ListMVPs(c.Request.Context(), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch MVPs"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": mvps})
}

// ListMVPsAdmin returns all MVPs (active + hidden) for the admin UI.
func (h *SeasonHandler) ListMVPsAdmin(c *gin.Context) {
	mvps, err := h.service.ListMVPs(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch MVPs"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": mvps})
}

func (h *SeasonHandler) CreateMVP(c *gin.Context) {
	var req dto.CreateSeasonMVPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m, err := h.service.CreateMVP(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, m)
}

func (h *SeasonHandler) UpdateMVP(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID is required"})
		return
	}
	var req dto.UpdateSeasonMVPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.UpdateMVP(c.Request.Context(), id, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MVP updated"})
}

func (h *SeasonHandler) DeleteMVP(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID is required"})
		return
	}
	if err := h.service.DeleteMVP(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete MVP"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MVP deleted"})
}
