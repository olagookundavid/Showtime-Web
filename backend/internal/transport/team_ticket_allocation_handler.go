package transport

import (
	"fmt"
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/middlewares"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ITeamTicketAllocationHandler interface {
	// Admin Routes
	CreateOrUpdateAllocation(c *gin.Context)
	GetAllocationsByEventDay(c *gin.Context)
	DeleteAllocation(c *gin.Context)

	// Team Head Routes
	GetTeamAllocations(c *gin.Context)
	IssueTeamTicket(c *gin.Context)
}

type TeamTicketAllocationHandler struct {
	service services.ITeamTicketAllocationService
}

func NewTeamTicketAllocationHandler(service services.ITeamTicketAllocationService) ITeamTicketAllocationHandler {
	return &TeamTicketAllocationHandler{service: service}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Routes
// ═══════════════════════════════════════════════════════════════════════════════

func (h *TeamTicketAllocationHandler) CreateOrUpdateAllocation(c *gin.Context) {
	var req dto.CreateOrUpdateAllocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	svcReq := services.CreateOrUpdateAllocationReq{
		EventDayID:     req.EventDayID,
		TeamID:         req.TeamID,
		AllocatedCount: req.AllocatedCount,
	}

	if err := h.service.CreateOrUpdateAllocation(c.Request.Context(), svcReq); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "allocation successfully saved"})
}

func (h *TeamTicketAllocationHandler) GetAllocationsByEventDay(c *gin.Context) {
	eventDayID := c.Param("id")
	allocations, err := h.service.GetAllocationsByEventDay(c.Request.Context(), eventDayID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var responses []dto.TeamTicketAllocationResponse
	for _, a := range allocations {
		res := dto.TeamTicketAllocationResponse{
			ID:             a.ID,
			EventDayID:     a.EventDayID,
			TeamID:         a.TeamID,
			AllocatedCount: a.AllocatedCount,
		}
		if a.Team != nil {
			res.TeamName = a.Team.Name
		}
		responses = append(responses, res)
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

func (h *TeamTicketAllocationHandler) DeleteAllocation(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteAllocation(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "allocation deleted successfully"})
}

// ═══════════════════════════════════════════════════════════════════════════════
// Team Head Routes
// ═══════════════════════════════════════════════════════════════════════════════

func (h *TeamTicketAllocationHandler) GetTeamAllocations(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "team ID not found in context"})
		return
	}

	allocations, err := h.service.GetAllocationsByTeam(c.Request.Context(), fmt.Sprintf("%v", teamID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var responses []dto.TeamTicketAllocationResponse
	for _, a := range allocations {
		// Calculate issued count
		_, issuedCount, err := h.service.GetAllocatedAndIssuedTicketsCount(c.Request.Context(), a.EventDayID, a.TeamID)
		if err != nil {
			issuedCount = 0
		}

		res := dto.TeamTicketAllocationResponse{
			ID:             a.ID,
			EventDayID:     a.EventDayID,
			TeamID:         a.TeamID,
			AllocatedCount: a.AllocatedCount,
			IssuedCount:    issuedCount,
		}
		if a.EventDay != nil {
			res.EventTitle = a.EventDay.Title
		}
		responses = append(responses, res)
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

func (h *TeamTicketAllocationHandler) IssueTeamTicket(c *gin.Context) {
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "team manager unauthorized"})
		return
	}

	tID := fmt.Sprintf("%v", teamID)

	var req dto.IssueTeamTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, err := h.service.IssueTeamTicket(c.Request.Context(), req, tID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ticket)
}
