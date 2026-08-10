package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IGalleryHandler interface {
	CreateGallery(c *gin.Context)
	GetGallery(c *gin.Context)
	GetGalleryByID(c *gin.Context)
	UpdateGallery(c *gin.Context)
	DeleteGallery(c *gin.Context)
}

type GalleryHandler struct {
	service services.IGalleryService
}

func NewGalleryHandler(service services.IGalleryService) IGalleryHandler {
	return &GalleryHandler{service: service}
}

// CreateGallery godoc
// @Summary Create a gallery item
// @Description Create a new gallery item
// @Tags gallery
// @Accept json
// @Produce json
// @Param request body dto.CreateGalleryRequest true "Gallery request"
// @Success 201 {object} map[string]string
// @Router /api/v1/gallery [post]
func (h *GalleryHandler) CreateGallery(c *gin.Context) {
	var req dto.CreateGalleryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.service.CreateGallery(c.Request.Context(), req); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Gallery item created successfully"})
}

// GetGallery godoc
// @Summary Get all gallery items
// @Description Get gallery items with pagination, optionally filtered by competition
// @Tags gallery
// @Accept json
// @Produce json
// @Param page query int false "Page number"
// @Param limit query int false "Items per page"
// @Param competition_id query string false "Filter by competition ID"
// @Success 200 {object} dto.PaginatedResponse
// @Router /api/v1/gallery [get]
func (h *GalleryHandler) GetGallery(c *gin.Context) {
	var query dto.PaginationQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 {
		query.Limit = 10
	}

	var competitionID *string
	if cid := c.Query("competition_id"); cid != "" {
		competitionID = &cid
	}

	response, err := h.service.GetGallery(c.Request.Context(), competitionID, query)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetGalleryByID godoc
// @Summary Get a gallery item by ID
// @Description Get a single gallery item by its UUID
// @Tags gallery
// @Accept json
// @Produce json
// @Param id path string true "Gallery ID"
// @Success 200 {object} dto.GalleryResponse
// @Router /api/v1/gallery/{id} [get]
func (h *GalleryHandler) GetGalleryByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}

	gallery, err := h.service.GetGalleryByID(c.Request.Context(), id)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	if gallery == nil {
		helpers.NotFoundResponse(c)
		return
	}

	c.JSON(http.StatusOK, gallery)
}

// UpdateGallery godoc
// @Summary Update a gallery item
// @Description Update an existing gallery item by ID
// @Tags gallery
// @Accept json
// @Produce json
// @Param id path string true "Gallery ID"
// @Param request body dto.CreateGalleryRequest true "Gallery update request"
// @Success 200 {object} map[string]string
// @Router /api/v1/gallery/{id} [put]
func (h *GalleryHandler) UpdateGallery(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}

	var req dto.CreateGalleryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.service.UpdateGallery(c.Request.Context(), id, req); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Gallery item updated successfully"})
}

// DeleteGallery godoc
// @Summary Delete a gallery item
// @Description Delete a gallery item by ID
// @Tags gallery
// @Accept json
// @Produce json
// @Param id path string true "Gallery ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/gallery/{id} [delete]
func (h *GalleryHandler) DeleteGallery(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}

	err := h.service.DeleteGallery(c.Request.Context(), id)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Gallery item deleted successfully"})
}
