package transport

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/middlewares"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IContractHandler interface {
	IssueContract(c *gin.Context)
	RespondToContract(c *gin.Context)
	RenewContract(c *gin.Context)
	ReleasePlayer(c *gin.Context)
	CancelContract(c *gin.Context)
	GetTeamContracts(c *gin.Context)
	GetMyContracts(c *gin.Context)
	GetFreeAgents(c *gin.Context)
	GetContractByID(c *gin.Context)
	AdminOverrideContract(c *gin.Context)
	AdminForceAcceptContract(c *gin.Context)
}

type ContractHandler struct {
	service      services.IContractService
	authRepo     ports.IAuthRepository
	auditService services.IAuditService
}

func NewContractHandler(service services.IContractService, authRepo ports.IAuthRepository, auditService services.IAuditService) IContractHandler {
	return &ContractHandler{service: service, authRepo: authRepo, auditService: auditService}
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

	teamIDStr := ""
	if teamID, exists := c.Get(middlewares.TeamIDContextKey); exists {
		teamIDStr = teamID.(string)
	}

	var req dto.RenewContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.RenewContract(c.Request.Context(), contractID, payload.UserId, teamIDStr, req)
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

	teamIDStr := ""
	if teamID, exists := c.Get(middlewares.TeamIDContextKey); exists {
		teamIDStr = teamID.(string)
	}

	if err := h.service.ReleasePlayer(c.Request.Context(), contractID, payload.UserId, teamIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Player released successfully"})
}

func (h *ContractHandler) CancelContract(c *gin.Context) {
	contractID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	teamIDStr := ""
	if teamID, exists := c.Get(middlewares.TeamIDContextKey); exists {
		teamIDStr = teamID.(string)
	}

	if err := h.service.CancelContract(c.Request.Context(), contractID, payload.UserId, teamIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contract offer withdrawn successfully"})
}

func (h *ContractHandler) GetTeamContracts(c *gin.Context) {
	teamIDStr := ""
	if teamID, exists := c.Get(middlewares.TeamIDContextKey); exists {
		teamIDStr = teamID.(string)
	} else {
		teamIDStr = c.Query("team_id")
	}

	status := c.Query("status")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	res, err := h.service.GetTeamContracts(c.Request.Context(), teamIDStr, status, search, page, limit)
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

func (h *ContractHandler) AdminForceAcceptContract(c *gin.Context) {
	contractID := c.Param("id")

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Look up admin user to get their name for audit trail
	adminUser, err := h.authRepo.GetUserByID(c.Request.Context(), payload.UserId)
	if err != nil || adminUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin user not found"})
		return
	}

	adminName := adminUser.FullName
	if adminName == "" {
		adminName = adminUser.Email
	}

	if err := h.service.AdminForceAcceptContract(c.Request.Context(), contractID, payload.UserId, adminName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Write explicit audit log with admin identity and action details
	detailsMap := map[string]interface{}{
		"action":      "ADMIN_FORCE_ACCEPT_CONTRACT",
		"contract_id": contractID,
		"admin_id":    payload.UserId,
		"admin_name":  adminName,
		"admin_email": adminUser.Email,
		"note":        fmt.Sprintf("Admin %s force-accepted contract %s on behalf of the player (player may not have a claimed account)", adminName, contractID),
	}
	detailsJSON, _ := json.Marshal(detailsMap)
	detailsStr := string(detailsJSON)
	entityID := contractID
	h.auditService.LogAction(&payload.UserId, "ADMIN_FORCE_ACCEPT", "contract", &entityID, &detailsStr)

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Contract force-accepted by admin %s", adminName)})
}
