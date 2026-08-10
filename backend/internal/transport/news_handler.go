package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type INewsHandler interface {
	CreateNews(c *gin.Context)
	GetNews(c *gin.Context)
	GetNewsByID(c *gin.Context)
	GetNewsBySlug(c *gin.Context)
	UpdateNews(c *gin.Context)
	DeleteNews(c *gin.Context)
}

type NewsHandler struct {
	service services.INewsService
}

func NewNewsHandler(service services.INewsService) INewsHandler {
	return &NewsHandler{service: service}
}

// CreateNews godoc
// @Summary Create a news article
// @Description Create a new news article
// @Tags news
// @Accept json
// @Produce json
// @Param request body dto.CreateNewsRequest true "News request"
// @Success 201 {object} map[string]string
// @Router /api/v1/news [post]
func (h *NewsHandler) CreateNews(c *gin.Context) {
	var req dto.CreateNewsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.service.CreateNews(c.Request.Context(), req); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "News created successfully"})
}

// GetNews godoc
// @Summary Get all news articles
// @Description Get news articles with pagination
// @Tags news
// @Accept json
// @Produce json
// @Param page query int false "Page number"
// @Param limit query int false "Items per page"
// @Success 200 {object} dto.PaginatedResponse
// @Router /api/v1/news [get]
func (h *NewsHandler) GetNews(c *gin.Context) {
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

	response, err := h.service.GetNews(c.Request.Context(), query)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetNewsByID godoc
// @Summary Get a news article by ID
// @Description Get a single news article by its UUID
// @Tags news
// @Accept json
// @Produce json
// @Param id path string true "News ID"
// @Success 200 {object} dto.NewsResponse
// @Router /api/v1/news/{id} [get]
func (h *NewsHandler) GetNewsByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}

	news, err := h.service.GetNewsByID(c.Request.Context(), id)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	if news == nil {
		helpers.NotFoundResponse(c)
		return
	}

	c.JSON(http.StatusOK, news)
}

// GetNewsBySlug godoc
// @Summary Get a news article by slug
// @Description Get a single news article by its slug (resolves hero-carousel-only articles too)
// @Tags news
// @Accept json
// @Produce json
// @Param slug path string true "News slug"
// @Success 200 {object} dto.NewsResponse
// @Router /api/v1/news/slug/{slug} [get]
func (h *NewsHandler) GetNewsBySlug(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		helpers.BadResponse(c, "slug is required")
		return
	}

	news, err := h.service.GetNewsBySlug(c.Request.Context(), slug)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	if news == nil {
		helpers.NotFoundResponse(c)
		return
	}

	c.JSON(http.StatusOK, news)
}

// UpdateNews godoc
// @Summary Update a news article
// @Description Update an existing news article by ID
// @Tags news
// @Accept json
// @Produce json
// @Param id path string true "News ID"
// @Param request body dto.CreateNewsRequest true "News update request"
// @Success 200 {object} map[string]string
// @Router /api/v1/news/{id} [put]
func (h *NewsHandler) UpdateNews(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}

	var req dto.CreateNewsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.service.UpdateNews(c.Request.Context(), id, req); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "News updated successfully"})
}

// DeleteNews godoc
// @Summary Delete a news article
// @Description Delete a news article by ID
// @Tags news
// @Accept json
// @Produce json
// @Param id path string true "News ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/news/{id} [delete]
func (h *NewsHandler) DeleteNews(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		helpers.BadResponse(c, "ID is required")
		return
	}

	err := h.service.DeleteNews(c.Request.Context(), id)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "News deleted successfully"})
}
