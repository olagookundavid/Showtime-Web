package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type IInventoryHandler interface {
	CreateProduct(c *gin.Context)
	UpdateProduct(c *gin.Context)
	DeleteProduct(c *gin.Context)
	GetProduct(c *gin.Context)
	ListProducts(c *gin.Context)
	GetLowStockAlerts(c *gin.Context)
	LogSale(c *gin.Context)
	ListSales(c *gin.Context)
	GetSalesReport(c *gin.Context)
	ListPaymentMethods(c *gin.Context)
	CreatePaymentMethod(c *gin.Context)
	TogglePaymentMethod(c *gin.Context)
}

type InventoryHandler struct {
	Service services.IInventoryService
}

func NewInventoryHandler(service services.IInventoryService) *InventoryHandler {
	return &InventoryHandler{Service: service}
}

func (h *InventoryHandler) CreateProduct(c *gin.Context) {
	var req dto.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	res, err := h.Service.CreateProduct(c.Request.Context(), req)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessCreated(c, "Product created successfully", res)
}

func (h *InventoryHandler) UpdateProduct(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	res, err := h.Service.UpdateProduct(c.Request.Context(), id, req)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Product not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Product updated successfully", res)
}

func (h *InventoryHandler) DeleteProduct(c *gin.Context) {
	id := c.Param("id")

	err := h.Service.DeleteProduct(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Product not found")
			return
		}
		if err.Error() == "cannot delete product with sales history; consider deactivating it instead" {
			helpers.BadResponse(c, err.Error())
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Product deleted successfully", nil)
}

func (h *InventoryHandler) GetProduct(c *gin.Context) {
	id := c.Param("id")

	res, err := h.Service.GetProduct(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Product not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Product retrieved successfully", res)
}

func (h *InventoryHandler) ListProducts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	activeOnly := c.Query("active_only") == "true"

	res, total, err := h.Service.ListProducts(c.Request.Context(), page, limit, search, activeOnly)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	totalPages := (total + limit - 1) / limit
	c.JSON(http.StatusOK, gin.H{
		"message":     "Products retrieved successfully",
		"data":        res,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

func (h *InventoryHandler) GetLowStockAlerts(c *gin.Context) {
	res, err := h.Service.GetLowStockAlerts(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Low stock products retrieved successfully", res)
}

func (h *InventoryHandler) LogSale(c *gin.Context) {
	var req dto.LogSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.Service.LogSale(c.Request.Context(), payload.UserId, req)
	if err != nil {
		if err.Error() == "insufficient stock available" {
			helpers.BadResponse(c, err.Error())
			return
		}
		if errors.Is(err, errors.New("not found")) || err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Product not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessCreated(c, "Sale logged successfully", res)
}

func (h *InventoryHandler) ListSales(c *gin.Context) {
	var filters dto.SaleFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	res, total, err := h.Service.ListSales(c.Request.Context(), filters)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	page := filters.Page
	if page < 1 {
		page = 1
	}
	limit := filters.Limit
	if limit < 1 {
		limit = 20
	}
	totalPages := (total + limit - 1) / limit

	c.JSON(http.StatusOK, gin.H{
		"message":     "Sales retrieved successfully",
		"data":        res,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

func (h *InventoryHandler) GetSalesReport(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")
	fromDateStr := c.Query("from_date")
	toDateStr := c.Query("to_date")

	res, err := h.Service.GetSalesReport(c.Request.Context(), period, fromDateStr, toDateStr)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Sales report retrieved successfully", res)
}

// Payment Methods
func (h *InventoryHandler) ListPaymentMethods(c *gin.Context) {
	activeOnly := c.Query("active_only") == "true"
	res, err := h.Service.ListPaymentMethods(c.Request.Context(), activeOnly)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Payment methods retrieved successfully", res)
}

func (h *InventoryHandler) CreatePaymentMethod(c *gin.Context) {
	var req dto.CreatePaymentMethodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	res, err := h.Service.CreatePaymentMethod(c.Request.Context(), req)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessCreated(c, "Payment method created successfully", res)
}

func (h *InventoryHandler) TogglePaymentMethod(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.Service.TogglePaymentMethod(c.Request.Context(), id, req.IsActive); err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Payment method not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Payment method status updated", nil)
}
