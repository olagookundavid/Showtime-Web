package transport

import (
	"errors"
	"io"
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// playMutationStatus maps a play-log mutation error to its HTTP status: a
// locked match is 423 (Locked), everything else stays a 400.
func playMutationStatus(err error) int {
	if errors.Is(err, services.ErrPBPLocked) {
		return http.StatusLocked
	}
	return http.StatusBadRequest
}

type IPlayHandler interface {
	ListPlays(c *gin.Context)
	StreamPlays(c *gin.Context)
	CreatePlay(c *gin.Context)
	UpdatePlay(c *gin.Context)
	DeletePlay(c *gin.Context)
	CompareStats(c *gin.Context)
	CommitStats(c *gin.Context)
	GetMatchRules(c *gin.Context)
	GetRules(c *gin.Context)
	UpsertRules(c *gin.Context)
	RecomputeScore(c *gin.Context)
	CommitScore(c *gin.Context)
	LockPBP(c *gin.Context)
	UnlockPBP(c *gin.Context)
	ReDeriveSituations(c *gin.Context)
	RecomputeAllStats(c *gin.Context)
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
		c.JSON(playMutationStatus(err), gin.H{"error": err.Error()})
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
		c.JSON(playMutationStatus(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": play})
}

func (h *PlayHandler) DeletePlay(c *gin.Context) {
	matchID := c.Param("id")
	playID := c.Param("playId")
	if playID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Play ID is required"})
		return
	}
	if err := h.service.DeletePlay(c.Request.Context(), matchID, playID); err != nil {
		if errors.Is(err, services.ErrPBPLocked) {
			c.JSON(http.StatusLocked, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete play"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Play deleted"})
}

// LockPBP / UnlockPBP toggle the per-match play-by-play editing lock. The
// global audit middleware records who flipped it, when, and from where.
func (h *PlayHandler) LockPBP(c *gin.Context)   { h.setPBPLock(c, true) }
func (h *PlayHandler) UnlockPBP(c *gin.Context) { h.setPBPLock(c, false) }

func (h *PlayHandler) setPBPLock(c *gin.Context, locked bool) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	if err := h.service.SetPBPLock(c.Request.Context(), matchID, locked); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update play-by-play lock"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"pbp_locked": locked}})
}

// ReDeriveSituations applies a batch of recomputed down/distance/possession
// snapshots to plays after a mid-sequence insert, then refreshes the score.
func (h *PlayHandler) ReDeriveSituations(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	var req dto.ReDeriveSituationsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.service.ReDeriveSituations(c.Request.Context(), matchID, req.Plays); err != nil {
		c.JSON(playMutationStatus(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Situations re-derived", "count": len(req.Plays)})
}

// RecomputeAllStats re-derives stats for every match that has a play log, so a
// derivation change lands everywhere at once. `?competition_id=` scopes it to one
// competition; `?dry_run=true` reports what would change without writing.
func (h *PlayHandler) RecomputeAllStats(c *gin.Context) {
	competitionID := c.Query("competition_id")
	dryRun := c.Query("dry_run") == "true"

	res, err := h.service.RecomputeAllStats(c.Request.Context(), competitionID, dryRun)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
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

// CommitScore persists the derived play-by-play score to the match record and recalculates standings.
func (h *PlayHandler) CommitScore(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}
	home, away, err := h.service.CommitScore(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Score committed to match", "home_score": home, "away_score": away})
}

// StreamPlays establishes a Server-Sent Events (SSE) stream for live play-by-play updates.
func (h *PlayHandler) StreamPlays(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.Flush()

	clientChan := services.GlobalSSEBroker.Subscribe(matchID)
	defer services.GlobalSSEBroker.Unsubscribe(matchID, clientChan)

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		case msg, ok := <-clientChan:
			if !ok {
				return false
			}
			_, err := w.Write([]byte(msg))
			if err != nil {
				return false
			}
			c.Writer.Flush()
			return true
		}
	})
}
