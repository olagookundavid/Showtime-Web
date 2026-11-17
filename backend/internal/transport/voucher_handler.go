package transport

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
)

type IVoucherHandler interface {
	ListProducts(c *gin.Context)
	Purchase(c *gin.Context)
	ListMine(c *gin.Context)
	GetByCode(c *gin.Context)

	BarLookup(c *gin.Context)
	BarRedeem(c *gin.Context)

	AdminListProducts(c *gin.Context)
	AdminCreateProduct(c *gin.Context)
	AdminUpdateProduct(c *gin.Context)
	AdminIssue(c *gin.Context)
	AdminList(c *gin.Context)
	AdminVoid(c *gin.Context)
	AdminRedemptions(c *gin.Context)
	AdminSearchUsers(c *gin.Context)
}

type VoucherHandler struct {
	service services.IVoucherService
}

func NewVoucherHandler(service services.IVoucherService) IVoucherHandler {
	return &VoucherHandler{service: service}
}

// respondVoucherError turns the service's errors into the right status. The ones
// the user can act on are 400s with their own message. A wallet that is too low
// also carries a code so the page can offer a top-up.
func respondVoucherError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrVoucherNotFound),
		errors.Is(err, services.ErrVoucherProductGone),
		errors.Is(err, services.ErrWalletUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ports.ErrWalletInsufficient):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "INSUFFICIENT_BALANCE"})
	case errors.Is(err, services.ErrVoucherNotVoidable):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrVoucherProductInvalid),
		errors.Is(err, services.ErrVoucherHolder),
		errors.Is(err, services.ErrVoucherHolderEmail),
		errors.Is(err, services.ErrVoucherDates),
		errors.Is(err, services.ErrVoucherSpan):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func voucherUserID(c *gin.Context) (string, bool) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return "", false
	}
	return payload.UserId, true
}

// ListProducts godoc
// @Summary The voucher bundles on sale
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/vouchers/products [get]
func (h *VoucherHandler) ListProducts(c *gin.Context) {
	list, err := h.service.ListProducts(c.Request.Context())
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// Purchase godoc
// @Summary Buy a voucher for a named person, paid from the wallet
// @Tags vouchers
// @Security BearerAuth
// @Accept json
// @Router /api/v1/vouchers/purchase [post]
func (h *VoucherHandler) Purchase(c *gin.Context) {
	userID, ok := voucherUserID(c)
	if !ok {
		return
	}
	var req dto.PurchaseVoucherRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	out, err := h.service.Purchase(c.Request.Context(), userID, req)
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": out})
}

// ListMine godoc
// @Summary Vouchers the signed-in user holds or bought
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/vouchers/mine [get]
func (h *VoucherHandler) ListMine(c *gin.Context) {
	userID, ok := voucherUserID(c)
	if !ok {
		return
	}
	list, err := h.service.ListMine(c.Request.Context(), userID)
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// GetByCode godoc
// @Summary Show a voucher to whoever holds its code (no sign-in)
// @Description The code is the secret, like a ticket code. The response leaves out emails and account ids.
// @Tags vouchers
// @Router /api/v1/vouchers/by-code/{code} [get]
func (h *VoucherHandler) GetByCode(c *gin.Context) {
	v, err := h.service.GetByCode(c.Request.Context(), c.Param("code"))
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": v})
}

// BarLookup godoc
// @Summary Look a voucher up at the bar before redeeming it
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/bar/vouchers/{code} [get]
func (h *VoucherHandler) BarLookup(c *gin.Context) {
	h.GetByCode(c)
}

// BarRedeem godoc
// @Summary Redeem a voucher at the bar (once, on a valid date)
// @Description Answers 200 when redeemed and 409 when it cannot be used, with the voucher and the reason in the body.
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/bar/vouchers/{code}/redeem [post]
func (h *VoucherHandler) BarRedeem(c *gin.Context) {
	staffID, ok := voucherUserID(c)
	if !ok {
		return
	}
	out, err := h.service.Redeem(c.Request.Context(), c.Param("code"), staffID)
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	if !out.Redeemed {
		c.JSON(http.StatusConflict, gin.H{"error": out.Voucher.StateMessage, "data": out})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// AdminListProducts godoc
// @Summary Every voucher bundle, including ones switched off (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers/products [get]
func (h *VoucherHandler) AdminListProducts(c *gin.Context) {
	list, err := h.service.AdminListProducts(c.Request.Context())
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// AdminCreateProduct godoc
// @Summary Add a voucher bundle (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers/products [post]
func (h *VoucherHandler) AdminCreateProduct(c *gin.Context) {
	var req dto.VoucherProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.service.AdminCreateProduct(c.Request.Context(), req)
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": p})
}

// AdminUpdateProduct godoc
// @Summary Edit a voucher bundle or switch it on or off (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers/products/{id} [put]
func (h *VoucherHandler) AdminUpdateProduct(c *gin.Context) {
	var req dto.VoucherProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.service.AdminUpdateProduct(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": p})
}

// AdminIssue godoc
// @Summary Give someone a free voucher (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers [post]
func (h *VoucherHandler) AdminIssue(c *gin.Context) {
	staffID, ok := voucherUserID(c)
	if !ok {
		return
	}
	var req dto.IssueVoucherRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	v, err := h.service.AdminIssue(c.Request.Context(), staffID, req)
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": v})
}

// AdminList godoc
// @Summary Search every voucher (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers [get]
func (h *VoucherHandler) AdminList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	out, err := h.service.AdminList(c.Request.Context(), ports.VoucherFilter{
		Status: c.Query("status"),
		Search: c.Query("search"),
		Page:   page,
		Limit:  limit,
	})
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}

// AdminVoid godoc
// @Summary Cancel an unused voucher, optionally refunding the buyer (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers/{id}/void [post]
func (h *VoucherHandler) AdminVoid(c *gin.Context) {
	staffID, ok := voucherUserID(c)
	if !ok {
		return
	}
	var req dto.VoidVoucherRequest
	// The body is optional: no body means no refund.
	if c.Request.ContentLength != 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	v, err := h.service.AdminVoid(c.Request.Context(), c.Param("id"), staffID, req.Refund)
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": v})
}

// AdminRedemptions godoc
// @Summary Recently redeemed vouchers and who redeemed them (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers/redemptions [get]
func (h *VoucherHandler) AdminRedemptions(c *gin.Context) {
	list, err := h.service.AdminRedemptions(c.Request.Context())
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// AdminSearchUsers godoc
// @Summary Find an account to link a voucher to (staff)
// @Tags vouchers
// @Security BearerAuth
// @Router /api/v1/admin/vouchers/users [get]
func (h *VoucherHandler) AdminSearchUsers(c *gin.Context) {
	users, err := h.service.AdminSearchUsers(c.Request.Context(), c.Query("search"))
	if err != nil {
		respondVoucherError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}
