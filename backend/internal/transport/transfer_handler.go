package transport

import (
	"net/http"
	"strconv"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/middlewares"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ITransferHandler interface {
	CreateTransferRequest(c *gin.Context)
	CreatePlayerListing(c *gin.Context)
	CreateDirectSale(c *gin.Context)
	RespondToTransfer(c *gin.Context)
	PlaceBid(c *gin.Context)
	RespondToBid(c *gin.Context)
	GetMarketListings(c *gin.Context)
	GetTeamTransfers(c *gin.Context)
	GetTransferByID(c *gin.Context)
	GetTeamBudget(c *gin.Context)
	GetAllTeamBudgets(c *gin.Context)
	AdminOverrideTransfer(c *gin.Context)
	AdminAdjustBudget(c *gin.Context)
	AdminSeedBudgets(c *gin.Context)

	// Transfer Window handlers
	CreateWindow(c *gin.Context)
	GetActiveWindow(c *gin.Context)
	GetAllWindows(c *gin.Context)
	UpdateWindow(c *gin.Context)
	DeleteWindow(c *gin.Context)
}

type TransferHandler struct {
	service       services.ITransferService
	windowService services.ITransferWindowService
}

func NewTransferHandler(service services.ITransferService, windowService services.ITransferWindowService) ITransferHandler {
	return &TransferHandler{service: service, windowService: windowService}
}

func (h *TransferHandler) CreateTransferRequest(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "team manager context required"})
		return
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.CreateTransferRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.CreateTransferRequest(c.Request.Context(), payload.UserId, teamID.(string), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": res})
}

func (h *TransferHandler) CreatePlayerListing(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "team manager context required"})
		return
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.CreatePlayerListingDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.CreatePlayerListing(c.Request.Context(), payload.UserId, teamID.(string), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": res})
}

func (h *TransferHandler) CreateDirectSale(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "team manager context required"})
		return
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.CreateDirectSaleDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.CreateDirectSale(c.Request.Context(), payload.UserId, teamID.(string), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": res})
}

func (h *TransferHandler) RespondToTransfer(c *gin.Context) {
	id := c.Param("id")
	teamID, _ := c.Get(middlewares.TeamIDContextKey)
	teamIDStr := ""
	if teamID != nil {
		teamIDStr = teamID.(string)
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.TransferActionDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.RespondToTransfer(c.Request.Context(), id, payload.UserId, teamIDStr, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *TransferHandler) PlaceBid(c *gin.Context) {
	id := c.Param("id")
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "team manager context required"})
		return
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.CreateBidDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.PlaceBid(c.Request.Context(), id, payload.UserId, teamID.(string), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": res})
}

func (h *TransferHandler) RespondToBid(c *gin.Context) {
	transferID := c.Param("id")
	bidID := c.Param("bidId")

	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "team manager context required"})
		return
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		Action string `json:"action" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.RespondToBid(c.Request.Context(), transferID, bidID, payload.UserId, teamID.(string), req.Action); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Bid response recorded successfully"})
}

func (h *TransferHandler) GetMarketListings(c *gin.Context) {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	res, err := h.service.GetMarketListings(c.Request.Context(), search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *TransferHandler) GetTeamTransfers(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		teamID = c.Query("team_id")
		if teamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "team_id required"})
			return
		}
	}

	tType := c.Query("type")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	res, err := h.service.GetTeamTransfers(c.Request.Context(), teamID.(string), tType, status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *TransferHandler) GetTransferByID(c *gin.Context) {
	id := c.Param("id")
	res, err := h.service.GetTransferByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *TransferHandler) GetTeamBudget(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		teamID = c.Query("team_id")
		if teamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "team_id required"})
			return
		}
	}

	res, err := h.service.GetTeamBudget(c.Request.Context(), teamID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *TransferHandler) GetAllTeamBudgets(c *gin.Context) {
	res, err := h.service.GetAllTeamBudgets(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *TransferHandler) AdminOverrideTransfer(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required"`
		Notes  string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AdminOverrideTransfer(c.Request.Context(), id, req.Status, req.Notes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transfer status overridden successfully"})
}

func (h *TransferHandler) AdminAdjustBudget(c *gin.Context) {
	teamID := c.Param("teamId")
	var req struct {
		TotalBudget int64 `json:"total_budget" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AdminAdjustBudget(c.Request.Context(), teamID, req.TotalBudget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team budget updated successfully"})
}

func (h *TransferHandler) AdminSeedBudgets(c *gin.Context) {
	if err := h.service.AdminSeedBudgets(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "All team budgets seeded to 15,000,000 successfully"})
}

// Transfer Window Handler Methods

func (h *TransferHandler) CreateWindow(c *gin.Context) {
	var req dto.TransferWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.windowService.CreateWindow(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": res})
}

func (h *TransferHandler) GetActiveWindow(c *gin.Context) {
	res, err := h.windowService.GetActiveWindow(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res == nil {
		c.JSON(http.StatusOK, gin.H{"data": nil, "is_open": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res, "is_open": res.IsOpen})
}

func (h *TransferHandler) GetAllWindows(c *gin.Context) {
	res, err := h.windowService.GetAllWindows(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *TransferHandler) UpdateWindow(c *gin.Context) {
	id := c.Param("id")
	var req dto.TransferWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.windowService.UpdateWindow(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *TransferHandler) DeleteWindow(c *gin.Context) {
	id := c.Param("id")
	if err := h.windowService.DeleteWindow(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Transfer window deleted successfully"})
}
