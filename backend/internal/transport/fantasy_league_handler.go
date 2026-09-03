package transport

import (
	"io"
	"net/http"
	"strconv"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IFantasyLeagueHandler interface {
	ListPublicLeagues(c *gin.Context)
	GetLeaderboard(c *gin.Context)
	GetOverallLeaderboard(c *gin.Context)
	CreateLeague(c *gin.Context)
	JoinLeague(c *gin.Context)
	VerifyLeaguePayment(c *gin.Context)
	ListMyLeagues(c *gin.Context)
	LeagueWebhook(c *gin.Context)
}

type FantasyLeagueHandler struct {
	service services.IFantasyLeagueService
}

func NewFantasyLeagueHandler(service services.IFantasyLeagueService) IFantasyLeagueHandler {
	return &FantasyLeagueHandler{service: service}
}

func (h *FantasyLeagueHandler) ListPublicLeagues(c *gin.Context) {
	seasonID := c.Query("season_id")
	if seasonID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "season_id query param is required"})
		return
	}

	leagues, err := h.service.ListPublicLeagues(c.Request.Context(), seasonID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": leagues})
}

func (h *FantasyLeagueHandler) GetLeaderboard(c *gin.Context) {
	leagueID := c.Param("id")
	var gwPtr *string
	if gwID := c.Query("gameweek_id"); gwID != "" {
		gwPtr = &gwID
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	list, total, err := h.service.GetLeaderboard(c.Request.Context(), leagueID, gwPtr, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Optional auth: a signed-in viewer also gets their own position, so the
	// client can jump straight to the page they are on.
	myRank := 0
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		myRank, _ = h.service.GetMyRankInLeague(c.Request.Context(), leagueID, payload.UserId)
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        list,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
		"my_rank":     myRank,
	})
}

func (h *FantasyLeagueHandler) GetOverallLeaderboard(c *gin.Context) {
	seasonID := c.Param("id")
	var gwPtr *string
	if gwID := c.Query("gameweek_id"); gwID != "" {
		gwPtr = &gwID
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	list, total, err := h.service.GetOverallLeaderboard(c.Request.Context(), seasonID, gwPtr, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	myRank := 0
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		myRank, _ = h.service.GetMyOverallRank(c.Request.Context(), seasonID, payload.UserId)
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        list,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
		"my_rank":     myRank,
	})
}

func (h *FantasyLeagueHandler) CreateLeague(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var req dto.CreateLeagueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.CreateLeague(c.Request.Context(), payload.UserId, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "League created successfully",
		"data":    res,
	})
}

func (h *FantasyLeagueHandler) JoinLeague(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	seasonID := c.Query("season_id")
	if seasonID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "season_id query param is required"})
		return
	}

	var req dto.JoinLeagueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Where Paystack returns the payer, built from the request the same way the
	// ticket purchase does. Taking it from the caller's own origin means it
	// follows whatever host the manager is on — localhost in development, the
	// real domain in production — with nothing to configure.
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	callbackURL := scheme + "://" + c.Request.Host + "/fantasy/leagues/confirm"
	if origin := c.GetHeader("Origin"); origin != "" {
		callbackURL = origin + "/fantasy/leagues/confirm"
	}

	res, err := h.service.JoinLeague(c.Request.Context(), payload.UserId, seasonID, callbackURL, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "League joined successfully",
		"data":    res,
	})
}

func (h *FantasyLeagueHandler) VerifyLeaguePayment(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var body struct {
		Reference string `json:"reference" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.VerifyLeaguePayment(c.Request.Context(), payload.UserId, body.Reference); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment verified and membership activated"})
}

func (h *FantasyLeagueHandler) ListMyLeagues(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	seasonID := c.Query("season_id")
	if seasonID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "season_id query param is required"})
		return
	}

	leagues, err := h.service.ListMyLeagues(c.Request.Context(), payload.UserId, seasonID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": leagues})
}

func (h *FantasyLeagueHandler) LeagueWebhook(c *gin.Context) {
	signature := c.GetHeader("x-paystack-signature")
	if signature == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing signature"})
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return
	}

	if err := h.service.LeagueWebhook(c.Request.Context(), payload, signature); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
