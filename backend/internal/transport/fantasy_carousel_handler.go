package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type IFantasyCarouselHandler interface {
	ListPublic(c *gin.Context)
	List(c *gin.Context)
	Add(c *gin.Context)
	QuickAdd(c *gin.Context)
	Update(c *gin.Context)
	Remove(c *gin.Context)
}

type FantasyCarouselHandler struct {
	service services.IFantasyCarouselService
}

func NewFantasyCarouselHandler(service services.IFantasyCarouselService) IFantasyCarouselHandler {
	return &FantasyCarouselHandler{service: service}
}

// carouselError answers the errors an editor can cause with a 4xx and their own
// words, and anything else as a server error.
func carouselError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrFantasyCarouselFull), errors.Is(err, domain.ErrAlreadyOnFantasyCarousel):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, domain.ErrFantasyCarouselArticleNotFound):
		helpers.NotFoundResponseWithMsg(c, err.Error())
	case errors.Is(err, pgx.ErrNoRows):
		helpers.NotFoundResponseWithMsg(c, "that slide could not be found")
	default:
		helpers.ServerErrorResponse(c, err)
	}
}

// ListPublic returns the visible slides, in order, for the Fantasy page.
// @Summary List the Fantasy page carousel
// @Tags fantasy-carousel
// @Produce json
// @Success 200 {object} map[string][]dto.FantasyCarouselSlideResponse
// @Router /api/v1/fantasy/carousel [get]
func (h *FantasyCarouselHandler) ListPublic(c *gin.Context) {
	slides, err := h.service.List(c.Request.Context(), true)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": slides})
}

// List returns every slide, hidden ones included, for the admin page.
// @Summary List all Fantasy carousel slides (admin)
// @Tags fantasy-carousel
// @Produce json
// @Success 200 {object} map[string][]dto.FantasyCarouselSlideResponse
// @Router /api/v1/admin/fantasy-carousel [get]
func (h *FantasyCarouselHandler) List(c *gin.Context) {
	slides, err := h.service.List(c.Request.Context(), false)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": slides})
}

// Add features an existing news article on the carousel.
// @Summary Add an article to the Fantasy carousel (admin)
// @Tags fantasy-carousel
// @Accept json
// @Produce json
// @Param request body dto.AddFantasyCarouselSlideRequest true "Article"
// @Success 201 {object} dto.FantasyCarouselSlideResponse
// @Router /api/v1/admin/fantasy-carousel [post]
func (h *FantasyCarouselHandler) Add(c *gin.Context) {
	var req dto.AddFantasyCarouselSlideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	slide, err := h.service.Add(c.Request.Context(), req)
	if err != nil {
		carouselError(c, err)
		return
	}
	c.JSON(http.StatusCreated, slide)
}

// QuickAdd publishes a new article and features it on the carousel.
// @Summary Publish an article straight onto the Fantasy carousel (admin)
// @Tags fantasy-carousel
// @Accept json
// @Produce json
// @Param request body dto.CreateNewsRequest true "Article"
// @Success 201 {object} dto.FantasyCarouselSlideResponse
// @Router /api/v1/admin/fantasy-carousel/quick-add [post]
func (h *FantasyCarouselHandler) QuickAdd(c *gin.Context) {
	var req dto.CreateNewsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	slide, err := h.service.QuickAdd(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrFantasyCarouselFull),
			errors.Is(err, domain.ErrAlreadyOnFantasyCarousel),
			errors.Is(err, domain.ErrFantasyCarouselArticleNotFound):
			carouselError(c, err)
		default:
			// Everything else here is the article failing validation (category,
			// featured media) before anything was saved.
			helpers.BadResponse(c, err.Error())
		}
		return
	}
	c.JSON(http.StatusCreated, slide)
}

// Update reorders a slide or shows/hides it.
// @Summary Update a Fantasy carousel slide (admin)
// @Tags fantasy-carousel
// @Accept json
// @Produce json
// @Param id path string true "Slide ID"
// @Param request body dto.UpdateFantasyCarouselSlideRequest true "Slide"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/fantasy-carousel/{id} [put]
func (h *FantasyCarouselHandler) Update(c *gin.Context) {
	var req dto.UpdateFantasyCarouselSlideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	if err := h.service.Update(c.Request.Context(), c.Param("id"), req); err != nil {
		carouselError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Slide updated"})
}

// Remove takes a slide off the carousel. The article stays on the news site.
// @Summary Remove a Fantasy carousel slide (admin)
// @Tags fantasy-carousel
// @Produce json
// @Param id path string true "Slide ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/fantasy-carousel/{id} [delete]
func (h *FantasyCarouselHandler) Remove(c *gin.Context) {
	if err := h.service.Remove(c.Request.Context(), c.Param("id")); err != nil {
		carouselError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Slide removed from the carousel"})
}
