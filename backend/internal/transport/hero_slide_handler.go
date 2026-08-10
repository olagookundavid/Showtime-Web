package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IHeroSlideHandler interface {
	List(c *gin.Context)
	ListPublic(c *gin.Context)
	Create(c *gin.Context)
	Update(c *gin.Context)
	Delete(c *gin.Context)
}

type HeroSlideHandler struct {
	service services.IHeroSlideService
}

func NewHeroSlideHandler(service services.IHeroSlideService) IHeroSlideHandler {
	return &HeroSlideHandler{service: service}
}

// ListPublic returns only ACTIVE slides — what the homepage carousel renders.
// @Summary List active hero slides for the homepage carousel
// @Tags hero-slides
// @Produce json
// @Success 200 {object} map[string][]dto.HeroSlideResponse
// @Router /api/v1/hero-slides [get]
func (h *HeroSlideHandler) ListPublic(c *gin.Context) {
	slides, err := h.service.List(c.Request.Context(), true)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": slides})
}

// List returns ALL slides (active + inactive) for the admin UI.
// @Summary List all hero slides (admin)
// @Tags hero-slides
// @Produce json
// @Success 200 {object} map[string][]dto.HeroSlideResponse
// @Router /api/v1/admin/hero-slides [get]
func (h *HeroSlideHandler) List(c *gin.Context) {
	slides, err := h.service.List(c.Request.Context(), false)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": slides})
}

// Create adds a new hero slide. Rejected with 400 if the cap (5) is reached.
// @Summary Create a hero slide (admin)
// @Tags hero-slides
// @Accept json
// @Produce json
// @Param request body dto.CreateHeroSlideRequest true "Slide"
// @Success 201 {object} dto.HeroSlideResponse
// @Router /api/v1/admin/hero-slides [post]
func (h *HeroSlideHandler) Create(c *gin.Context) {
	var req dto.CreateHeroSlideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	slide, err := h.service.Create(c.Request.Context(), req)
	if err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	c.JSON(http.StatusCreated, slide)
}

// Update edits image/order/active state of a slide.
// @Summary Update a hero slide (admin)
// @Tags hero-slides
// @Accept json
// @Produce json
// @Param id path string true "Slide ID"
// @Param request body dto.UpdateHeroSlideRequest true "Slide"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/hero-slides/{id} [put]
func (h *HeroSlideHandler) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}

	var req dto.UpdateHeroSlideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.service.Update(c.Request.Context(), id, req); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Hero slide updated"})
}

// Delete removes a slide.
// @Summary Delete a hero slide (admin)
// @Tags hero-slides
// @Produce json
// @Param id path string true "Slide ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/hero-slides/{id} [delete]
func (h *HeroSlideHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Hero slide deleted"})
}
