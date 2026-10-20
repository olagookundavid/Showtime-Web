package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"strings"

	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IFAQHandler interface {
	GetPublicPage(c *gin.Context)

	ListPages(c *gin.Context)
	GetAdminPage(c *gin.Context)
	CreatePage(c *gin.Context)
	UpdatePage(c *gin.Context)
	DeletePage(c *gin.Context)

	CreateCategory(c *gin.Context)
	UpdateCategory(c *gin.Context)
	DeleteCategory(c *gin.Context)

	CreateItem(c *gin.Context)
	UpdateItem(c *gin.Context)
	DeleteItem(c *gin.Context)

	Reorder(c *gin.Context)
}

type FAQHandler struct {
	service services.IFAQService
}

func NewFAQHandler(service services.IFAQService) IFAQHandler {
	return &FAQHandler{service: service}
}

// fail maps a service error onto the right status: unknown records are 404, a
// problem with what the admin typed is 400, anything else is a real failure.
func (h *FAQHandler) fail(c *gin.Context, err error) {
	var invalid appErrors.FAQValidationError
	switch {
	case errors.Is(err, appErrors.ErrFAQPageNotFound),
		errors.Is(err, appErrors.ErrFAQCategoryNotFound),
		errors.Is(err, appErrors.ErrFAQItemNotFound):
		helpers.NotFoundResponseWithMsg(c, err.Error())
	case errors.Is(err, appErrors.ErrFAQPageExists), errors.As(err, &invalid):
		helpers.BadResponse(c, err.Error())
	default:
		helpers.ServerErrorResponse(c, err)
	}
}

// GetPublicPage returns one page's active FAQs, grouped by category.
// @Summary Get the FAQs shown on a page
// @Tags faqs
// @Produce json
// @Param pageKey path string true "FAQ page key, e.g. game-pass"
// @Success 200 {object} map[string]dto.FAQPageResponse
// @Router /api/v1/faqs/{pageKey} [get]
func (h *FAQHandler) GetPublicPage(c *gin.Context) {
	page, err := h.service.GetPublicPage(c.Request.Context(), c.Param("pageKey"))
	if err != nil {
		h.fail(c, err)
		return
	}
	// FAQs change rarely and every visitor to these pages asks for them.
	c.Header("Cache-Control", "public, max-age=60")
	c.JSON(http.StatusOK, gin.H{"data": page})
}

// @Summary List FAQ pages (admin)
// @Tags faqs
// @Produce json
// @Success 200 {object} map[string][]dto.FAQPageSummaryResponse
// @Router /api/v1/admin/faqs/pages [get]
func (h *FAQHandler) ListPages(c *gin.Context) {
	pages, err := h.service.ListPages(c.Request.Context())
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": pages})
}

// @Summary Get one FAQ page with hidden questions included (admin)
// @Tags faqs
// @Produce json
// @Param pageKey path string true "FAQ page key"
// @Success 200 {object} map[string]dto.FAQPageResponse
// @Router /api/v1/admin/faqs/pages/{pageKey} [get]
func (h *FAQHandler) GetAdminPage(c *gin.Context) {
	page, err := h.service.GetAdminPage(c.Request.Context(), c.Param("pageKey"))
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": page})
}

// @Summary Create an FAQ page (admin)
// @Tags faqs
// @Accept json
// @Produce json
// @Param request body dto.CreateFAQPageRequest true "Page"
// @Success 201 {object} dto.FAQPageSummaryResponse
// @Router /api/v1/admin/faqs/pages [post]
func (h *FAQHandler) CreatePage(c *gin.Context) {
	var req dto.CreateFAQPageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	page, err := h.service.CreatePage(c.Request.Context(), req)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, page)
}

// @Summary Update an FAQ page (admin)
// @Tags faqs
// @Accept json
// @Produce json
// @Param pageKey path string true "FAQ page key"
// @Param request body dto.UpdateFAQPageRequest true "Page"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/faqs/pages/{pageKey} [put]
func (h *FAQHandler) UpdatePage(c *gin.Context) {
	var req dto.UpdateFAQPageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	if err := h.service.UpdatePage(c.Request.Context(), c.Param("pageKey"), req); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FAQ page updated"})
}

// @Summary Delete an FAQ page and all its FAQs (admin)
// @Tags faqs
// @Produce json
// @Param pageKey path string true "FAQ page key"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/faqs/pages/{pageKey} [delete]
func (h *FAQHandler) DeletePage(c *gin.Context) {
	if err := h.service.DeletePage(c.Request.Context(), c.Param("pageKey")); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FAQ page deleted"})
}

// @Summary Add a category to an FAQ page (admin)
// @Tags faqs
// @Accept json
// @Produce json
// @Param pageKey path string true "FAQ page key"
// @Param request body dto.CreateFAQCategoryRequest true "Category"
// @Success 201 {object} dto.FAQCategoryResponse
// @Router /api/v1/admin/faqs/pages/{pageKey}/categories [post]
func (h *FAQHandler) CreateCategory(c *gin.Context) {
	var req dto.CreateFAQCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	cat, err := h.service.CreateCategory(c.Request.Context(), c.Param("pageKey"), req)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, cat)
}

// @Summary Update an FAQ category (admin)
// @Tags faqs
// @Accept json
// @Produce json
// @Param id path string true "Category ID"
// @Param request body dto.UpdateFAQCategoryRequest true "Category"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/faqs/categories/{id} [put]
func (h *FAQHandler) UpdateCategory(c *gin.Context) {
	var req dto.UpdateFAQCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	if err := h.service.UpdateCategory(c.Request.Context(), c.Param("id"), req); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FAQ category updated"})
}

// @Summary Delete an FAQ category and its FAQs (admin)
// @Tags faqs
// @Produce json
// @Param id path string true "Category ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/faqs/categories/{id} [delete]
func (h *FAQHandler) DeleteCategory(c *gin.Context) {
	if err := h.service.DeleteCategory(c.Request.Context(), c.Param("id")); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FAQ category deleted"})
}

// @Summary Add an FAQ to a page (admin)
// @Tags faqs
// @Accept json
// @Produce json
// @Param pageKey path string true "FAQ page key"
// @Param request body dto.CreateFAQItemRequest true "FAQ"
// @Success 201 {object} dto.FAQItemResponse
// @Router /api/v1/admin/faqs/pages/{pageKey}/items [post]
func (h *FAQHandler) CreateItem(c *gin.Context) {
	var req dto.CreateFAQItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	item, err := h.service.CreateItem(c.Request.Context(), c.Param("pageKey"), req)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

// @Summary Update an FAQ (admin)
// @Tags faqs
// @Accept json
// @Produce json
// @Param id path string true "FAQ ID"
// @Param request body dto.UpdateFAQItemRequest true "FAQ"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/faqs/items/{id} [put]
func (h *FAQHandler) UpdateItem(c *gin.Context) {
	var req dto.UpdateFAQItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	if err := h.service.UpdateItem(c.Request.Context(), c.Param("id"), req); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FAQ updated"})
}

// @Summary Delete an FAQ (admin)
// @Tags faqs
// @Produce json
// @Param id path string true "FAQ ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/faqs/items/{id} [delete]
func (h *FAQHandler) DeleteItem(c *gin.Context) {
	if err := h.service.DeleteItem(c.Request.Context(), c.Param("id")); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FAQ deleted"})
}

// @Summary Set the display order of categories or FAQs (admin)
// @Tags faqs
// @Accept json
// @Produce json
// @Param request body dto.ReorderFAQRequest true "Order"
// @Success 200 {object} map[string]string
// @Router /api/v1/admin/faqs/reorder [put]
func (h *FAQHandler) Reorder(c *gin.Context) {
	var req dto.ReorderFAQRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	req.Kind = strings.ToLower(strings.TrimSpace(req.Kind))
	if err := h.service.Reorder(c.Request.Context(), req); err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Order updated"})
}
