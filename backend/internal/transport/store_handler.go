package transport

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type IStoreHandler interface {
	ListStoreProducts(c *gin.Context)
	GetStoreProduct(c *gin.Context)
	Checkout(c *gin.Context)
	VerifyPayment(c *gin.Context)
	Webhook(c *gin.Context)
	GetOrderByReference(c *gin.Context)
	VerifyOrder(c *gin.Context)
	ListOrders(c *gin.Context)
	GetOrder(c *gin.Context)
	UpdateFulfillment(c *gin.Context)
	CancelOrder(c *gin.Context)
	ListSavedAddresses(c *gin.Context)
	SaveAddress(c *gin.Context)
	ListCustomerOrders(c *gin.Context)
	SaveProductVariants(c *gin.Context)
	SaveProductImages(c *gin.Context)

	// Admin online storefront CRUD endpoints
	CreateStoreProduct(c *gin.Context)
	UpdateStoreProduct(c *gin.Context)
	DeleteStoreProduct(c *gin.Context)
	ListAllStoreProducts(c *gin.Context)

	// Reviews
	ListProductReviews(c *gin.Context)
	CreateProductReview(c *gin.Context)
	GetMyProductReview(c *gin.Context)
	DeleteProductReview(c *gin.Context)
}

type StoreHandler struct {
	Service  services.IStoreService
	Paystack *services.PaystackClient
}

func NewStoreHandler(service services.IStoreService, paystack *services.PaystackClient) *StoreHandler {
	return &StoreHandler{Service: service, Paystack: paystack}
}

func (h *StoreHandler) ListStoreProducts(c *gin.Context) {
	res, err := h.Service.ListStoreProducts(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Storefront catalog retrieved successfully", res)
}

func (h *StoreHandler) GetStoreProduct(c *gin.Context) {
	id := c.Param("id")
	res, err := h.Service.GetStoreProduct(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Product not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Storefront product retrieved successfully", res)
}

func (h *StoreHandler) Checkout(c *gin.Context) {
	var req dto.CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	var userID *string
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err == nil && payload != nil {
		userID = &payload.UserId
	}

	res, err := h.Service.CreateOrder(c.Request.Context(), userID, req)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrInsufficientStock):
			helpers.BadResponse(c, "Sorry, this item just sold out. Please pick a different size or come back later.")
		case errors.Is(err, appErrors.ErrVariantRequired):
			helpers.BadResponse(c, "Please choose a variant (e.g. size) before checking out.")
		case errors.Is(err, appErrors.ErrVariantNotFound):
			helpers.BadResponse(c, "The selected variant is no longer available.")
		default:
			helpers.BadResponse(c, err.Error())
		}
		return
	}
	helpers.SuccessCreated(c, "Order initialized successfully", res)
}

func (h *StoreHandler) VerifyPayment(c *gin.Context) {
	reference := c.Query("reference")
	if reference == "" {
		var req struct {
			Reference string `json:"reference"`
		}
		if err := c.ShouldBindJSON(&req); err == nil {
			reference = req.Reference
		}
	}

	if reference == "" {
		helpers.BadResponse(c, "reference query param or body reference is required")
		return
	}

	res, err := h.Service.VerifyPayment(c.Request.Context(), reference)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Transaction verified successfully", res)
}

func (h *StoreHandler) ListOrders(c *gin.Context) {
	// Admin listing of all orders with paging & status filters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	paymentStatus := c.Query("payment_status")
	fulfillmentStatus := c.Query("fulfillment_status")

	var statusP *string
	if paymentStatus != "" {
		statusP = &paymentStatus
	}
	var fulfillmentP *string
	if fulfillmentStatus != "" {
		fulfillmentP = &fulfillmentStatus
	}

	res, total, err := h.Service.ListOrders(c.Request.Context(), page, limit, nil, statusP, fulfillmentP)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	totalPages := (total + limit - 1) / limit
	c.JSON(http.StatusOK, gin.H{
		"message":     "Online orders retrieved successfully",
		"data":        res,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

func (h *StoreHandler) ListCustomerOrders(c *gin.Context) {
	// Paging customer orders for logged-in user historical view
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	paymentStatus := c.Query("payment_status")
	fulfillmentStatus := c.Query("fulfillment_status")

	var statusP *string
	if paymentStatus != "" {
		statusP = &paymentStatus
	}
	var fulfillmentP *string
	if fulfillmentStatus != "" {
		fulfillmentP = &fulfillmentStatus
	}

	res, total, err := h.Service.ListOrders(c.Request.Context(), page, limit, &payload.UserId, statusP, fulfillmentP)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	totalPages := (total + limit - 1) / limit
	c.JSON(http.StatusOK, gin.H{
		"message":     "Customer historical orders retrieved",
		"data":        res,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

func (h *StoreHandler) GetOrder(c *gin.Context) {
	id := c.Param("id")
	res, err := h.Service.GetOrder(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Order not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Order retrieved successfully", res)
}

func (h *StoreHandler) CancelOrder(c *gin.Context) {
	id := c.Param("id")
	res, err := h.Service.CancelOrder(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Order not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Order cancelled and stock restored", res)
}

func (h *StoreHandler) UpdateFulfillment(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateFulfillmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	res, err := h.Service.UpdateFulfillmentStatus(c.Request.Context(), id, req.FulfillmentStatus)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Order not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Order fulfillment updated successfully", res)
}

func (h *StoreHandler) ListSavedAddresses(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.Service.ListSavedAddresses(c.Request.Context(), payload.UserId)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Saved shipping addresses retrieved successfully", res)
}

func (h *StoreHandler) SaveAddress(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var req dto.SaveAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	res, err := h.Service.SaveAddress(c.Request.Context(), payload.UserId, req)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessCreated(c, "Shipping address saved successfully", res)
}

func (h *StoreHandler) SaveProductVariants(c *gin.Context) {
	id := c.Param("id")
	var req []dto.ProductVariantResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	err := h.Service.SaveProductVariants(c.Request.Context(), id, req)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Product variants saved successfully", nil)
}

func (h *StoreHandler) SaveProductImages(c *gin.Context) {
	id := c.Param("id")
	var req []dto.ProductImageResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	err := h.Service.SaveProductImages(c.Request.Context(), id, req)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Product images saved successfully", nil)
}

func (h *StoreHandler) CreateStoreProduct(c *gin.Context) {
	var req dto.CreateStoreProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	// Admin-only route — TokenMiddleware guarantees the payload exists, but
	// we treat a missing one as anonymous (created_by stays NULL) to be safe.
	var createdBy string
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		createdBy = payload.UserId
	}

	res, err := h.Service.CreateStoreProduct(c.Request.Context(), createdBy, req)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessCreated(c, "Store product created successfully", res)
}

func (h *StoreHandler) UpdateStoreProduct(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateStoreProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	err := h.Service.UpdateStoreProduct(c.Request.Context(), id, req)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Product not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Store product updated successfully", nil)
}

func (h *StoreHandler) DeleteStoreProduct(c *gin.Context) {
	id := c.Param("id")
	err := h.Service.DeleteStoreProduct(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Product not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Store product deleted successfully", nil)
}

func (h *StoreHandler) ListAllStoreProducts(c *gin.Context) {
	res, err := h.Service.ListAllStoreProducts(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "All storefront products retrieved successfully", res)
}

func (h *StoreHandler) Webhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return
	}

	// Verify Paystack HMAC signature (REQUIRED)
	signature := c.GetHeader("x-paystack-signature")
	if signature == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
		return
	}

	mac := hmac.New(sha512.New, []byte(h.Paystack.GetSecretKey()))
	mac.Write(body)
	expectedMAC := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(signature), []byte(expectedMAC)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var payload struct {
		Event string `json:"event"`
		Data  struct {
			Reference string `json:"reference"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if payload.Event == "charge.success" {
		if _, err := h.Service.VerifyPayment(c.Request.Context(), payload.Data.Reference); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *StoreHandler) GetOrderByReference(c *gin.Context) {
	reference := c.Param("reference")
	order, err := h.Service.GetOrderByReference(c.Request.Context(), reference)
	if err != nil {
		helpers.NotFoundResponseWithMsg(c, "order not found")
		return
	}
	helpers.SuccessOK(c, "Order retrieved successfully", order)
}

func (h *StoreHandler) VerifyOrder(c *gin.Context) {
	id := c.Param("id")
	order, err := h.Service.VerifyOrder(c.Request.Context(), id)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Order payment verified successfully", order)
}

// ─── Reviews ──────────────────────────────────────────────────────────────

func (h *StoreHandler) ListProductReviews(c *gin.Context) {
	productID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	sort := c.DefaultQuery("sort", "newest")

	res, total, err := h.Service.ListProductReviews(c.Request.Context(), productID, page, limit, sort)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	totalPages := (total + limit - 1) / limit
	c.JSON(http.StatusOK, gin.H{
		"message":     "Reviews retrieved successfully",
		"data":        res,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

func (h *StoreHandler) CreateProductReview(c *gin.Context) {
	productID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var req dto.CreateProductReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	res, err := h.Service.CreateOrUpdateProductReview(c.Request.Context(), payload.UserId, productID, req)
	if err != nil {
		// Surface the verified-purchase guard as a friendly 400 rather than a 500.
		helpers.BadResponse(c, err.Error())
		return
	}
	helpers.SuccessCreated(c, "Review saved", res)
}

func (h *StoreHandler) GetMyProductReview(c *gin.Context) {
	productID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.Service.GetMyReviewForProduct(c.Request.Context(), payload.UserId, productID)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	// Returning null `data` (vs 404) so the FE can branch cleanly on
	// "user hasn't reviewed yet" without exception handling.
	helpers.SuccessOK(c, "Review retrieved", res)
}

func (h *StoreHandler) DeleteProductReview(c *gin.Context) {
	id := c.Param("id")
	if err := h.Service.DeleteProductReview(c.Request.Context(), id); err != nil {
		if err.Error() == "not found" {
			helpers.NotFoundResponseWithMsg(c, "Review not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Review deleted", nil)
}

