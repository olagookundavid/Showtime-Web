package transport

import (
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IPlayHandler interface {
	ListPlays(c *gin.Context)
	CreatePlay(c *gin.Context)
	UpdatePlay(c *gin.Context)
	DeletePlay(c *gin.Context)
	CompareStats(c *gin.Context)
	CommitStats(c *gin.Context)
	GetMatchRules(c *gin.Context)
	GetRules(c *gin.Context)
	UpsertRules(c *gin.Context)
	RecomputeScore(c *gin.Context)
}

type PlayHandler struct {
	service services.IPlayService
}

func NewPlayHandler(service services.IPlayService) IPlayHandler {
	return &PlayHandler{service: service}
}

// ListPlays returns the ordered play-by-play log for a match (public + admin).
func (h *PlayHandler) ListPlays(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	plays, err := h.service.ListByMatch(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch plays"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": plays})
}

func (h *PlayHandler) CreatePlay(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	var req dto.PlayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	play, err := h.service.CreatePlay(c.Request.Context(), matchID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": play})
}

func (h *PlayHandler) UpdatePlay(c *gin.Context) {
	matchID := c.Param("id")
	playID := c.Param("playId")
	if matchID == "" || playID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID and Play ID are required"})
		return
	}
	var req dto.PlayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	play, err := h.service.UpdatePlay(c.Request.Context(), matchID, playID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": play})
}

func (h *PlayHandler) DeletePlay(c *gin.Context) {
	playID := c.Param("playId")
	if playID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Play ID is required"})
		return
	}
	if err := h.service.DeletePlay(c.Request.Context(), playID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete play"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Play deleted"})
}

// CompareStats returns stats derived from the play log alongside the currently
// stored (manually-entered) stats for the same match.
func (h *PlayHandler) CompareStats(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	derived, current, err := h.service.CompareMatchStats(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"derived": derived, "current": current})
}

// CommitStats writes the derived stats into player_stats for the match.
func (h *PlayHandler) CommitStats(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	count, err := h.service.CommitDerivedStats(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Stats committed", "players": count})
}

// GetMatchRules returns the scoring rules for the match's competition (defaults
// if none stored). Handy for the entry screen.
func (h *PlayHandler) GetMatchRules(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	rules, err := h.service.GetRulesForMatch(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rules})
}

// GetRules returns the scoring rules for a competition (defaults if none stored).
func (h *PlayHandler) GetRules(c *gin.Context) {
	competitionID := c.Param("id")
	if competitionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Competition ID is required"})
		return
	}
	rules, err := h.service.GetRules(c.Request.Context(), competitionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rules})
}

// UpsertRules sets the scoring rules for a competition.
func (h *PlayHandler) UpsertRules(c *gin.Context) {
	competitionID := c.Param("id")
	if competitionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Competition ID is required"})
		return
	}
	var req dto.GameRulesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rules, err := h.service.UpsertRules(c.Request.Context(), competitionID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rules})
}

// RecomputeScore rebuilds the running score from the play log using the rules,
// then updates the match score and standings.
func (h *PlayHandler) RecomputeScore(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	home, away, err := h.service.RecomputeScore(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Score recomputed", "home_score": home, "away_score": away})
}
