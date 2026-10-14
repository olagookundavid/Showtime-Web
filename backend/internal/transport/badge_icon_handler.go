package transport

import (
	"errors"
	"net/http"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// badgeIconError maps the library's errors to a status and a message for the admin.
func badgeIconError(c *gin.Context, err error) {
	var inUse ports.ErrBadgeIconInUse
	switch {
	case errors.Is(err, ports.ErrBadgeIconNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ports.ErrBadgeIconDuplicate), errors.As(err, &inUse):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrBadgeIconInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

// ListBadgeIcons returns the badge artwork library.
func (h *BadgeHandler) ListBadgeIcons(c *gin.Context) {
	icons, err := h.service.ListBadgeIcons(c.Request.Context())
	if err != nil {
		badgeIconError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": icons})
}

// CreateBadgeIcon adds artwork to the library.
func (h *BadgeHandler) CreateBadgeIcon(c *gin.Context) {
	var req dto.SaveBadgeIconRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrBadgeIconInvalid.Error()})
		return
	}
	icon, err := h.service.CreateBadgeIcon(c.Request.Context(), req)
	if err != nil {
		badgeIconError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": icon})
}

// UpdateBadgeIcon renames artwork or replaces its image.
func (h *BadgeHandler) UpdateBadgeIcon(c *gin.Context) {
	var req dto.SaveBadgeIconRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrBadgeIconInvalid.Error()})
		return
	}
	res, err := h.service.UpdateBadgeIcon(c.Request.Context(), c.Param("iconId"), req)
	if err != nil {
		badgeIconError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

// DeleteBadgeIcon removes artwork no badge is using.
func (h *BadgeHandler) DeleteBadgeIcon(c *gin.Context) {
	if err := h.service.DeleteBadgeIcon(c.Request.Context(), c.Param("iconId")); err != nil {
		badgeIconError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Artwork removed from the badge library"})
}
