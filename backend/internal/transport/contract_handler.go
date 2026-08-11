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

type IContractHandler interface {
	IssueContract(c *gin.Context)
	RespondToContract(c *gin.Context)
	RenewContract(c *gin.Context)
	ReleasePlayer(c *gin.Context)
	GetTeamContracts(c *gin.Context)
	GetMyContracts(c *gin.Context)
	GetFreeAgents(c *gin.Context)
	GetContractByID(c *gin.Context)
	AdminOverrideContract(c *gin.Context)
}

type ContractHandler struct {
	service services.IContractService
}

func NewContractHandler(service services.IContractService) IContractHandler {
	return &ContractHandler{service: service}
}

func (h *ContractHandler) IssueContract(c *gin.Context) {
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

	var req dto.IssueContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.IssueContract(c.Request.Context(), payload.UserId, teamID.(string), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": res})
}

func (h *ContractHandler) RespondToContract(c *gin.Context) {
	contractID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.ContractActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.RespondToContract(c.Request.Context(), contractID, payload.UserId, req.Action, req.Notes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contract response recorded successfully"})
}

func (h *ContractHandler) RenewContract(c *gin.Context) {
	contractID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.RenewContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.RenewContract(c.Request.Context(), contractID, payload.UserId, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": res})
}

func (h *ContractHandler) ReleasePlayer(c *gin.Context) {
	contractID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.ReleasePlayer(c.Request.Context(), contractID, payload.UserId); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Player released successfully"})
}

func (h *ContractHandler) GetTeamContracts(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		// Try query param for admin
		teamID = c.Query("team_id")
		if teamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "team_id required"})
			return
		}
	}

	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	res, err := h.service.GetTeamContracts(c.Request.Context(), teamID.(string), status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *ContractHandler) GetMyContracts(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	res, err := h.service.GetMyContracts(c.Request.Context(), payload.UserId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *ContractHandler) GetFreeAgents(c *gin.Context) {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	res, err := h.service.GetFreeAgents(c.Request.Context(), search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *ContractHandler) GetContractByID(c *gin.Context) {
	id := c.Param("id")
	res, err := h.service.GetContractByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *ContractHandler) AdminOverrideContract(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AdminOverrideContract(c.Request.Context(), id, req.Status, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contract status overridden successfully"})
}
