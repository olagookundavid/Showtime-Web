package broadcast

import (
	"log"
	"net/http"
	"showtime-backend/internal/services"
	"time"

	"github.com/gin-gonic/gin"
)

type IBroadcastHandler interface {
	GetState(c *gin.Context)
	UpdateState(c *gin.Context)
	GetPlayers(c *gin.Context)
	ProducerWS(c *gin.Context)
	ViewerWS(c *gin.Context)
}

type BroadcastHandler struct {
	hub          *Hub
	matchService services.IMatchService
	playService  services.IPlayService
}

func NewBroadcastHandler(hub *Hub, matchService services.IMatchService, playService services.IPlayService) *BroadcastHandler {
	return &BroadcastHandler{
		hub:          hub,
		matchService: matchService,
		playService:  playService,
	}
}

// ensureMatchState returns the current state (from memory or the persisted copy)
// or bootstraps a fresh one from the match data.
func (h *BroadcastHandler) ensureMatchState(c *gin.Context, matchID string) (*BroadcastState, error) {
	if state, ok := h.hub.LoadState(c.Request.Context(), matchID); ok {
		return state, nil
	}

	// Bootstrap from match data
	matchDetail, err := h.matchService.GetMatchDetail(c.Request.Context(), matchID)
	if err != nil {
		return nil, err
	}

	homeName := "HOME"
	awayName := "AWAY"
	homeLogo := ""
	awayLogo := ""
	if matchDetail.Match.HomeTeam != nil {
		homeName = matchDetail.Match.HomeTeam.Name
		homeLogo = matchDetail.Match.HomeTeam.Logo
	}
	if matchDetail.Match.AwayTeam != nil {
		awayName = matchDetail.Match.AwayTeam.Name
		awayLogo = matchDetail.Match.AwayTeam.Logo
	}

	// Check latest play scores
	pbpHome := 0
	pbpAway := 0
	if matchDetail.Match.HomeScore != nil {
		pbpHome = *matchDetail.Match.HomeScore
	}
	if matchDetail.Match.AwayScore != nil {
		pbpAway = *matchDetail.Match.AwayScore
	}

	// Use the latest play that carries a score; non-scoring plays may leave it unset.
	if plays, err := h.playService.ListByMatch(c.Request.Context(), matchID); err == nil {
		for i := len(plays) - 1; i >= 0; i-- {
			if plays[i].HomeScoreAfter != nil && plays[i].AwayScoreAfter != nil {
				pbpHome = *plays[i].HomeScoreAfter
				pbpAway = *plays[i].AwayScoreAfter
				break
			}
		}
	}

	initialState := &BroadcastState{
		MatchID:      matchID,
		Home:         homeName,
		Away:         awayName,
		HomeLogo:     homeLogo,
		AwayLogo:     awayLogo,
		ManualHome:   pbpHome,
		ManualAway:   pbpAway,
		PBPHome:      pbpHome,
		PBPAway:      pbpAway,
		Period:       "H1",
		ClockSeconds: 720, // 12 minutes default half countdown
		ClockRunning: false,
		ClockStamp:   time.Now().UnixMilli(),
		Down:         "1",
		Possession:   homeName,
		TimeoutsHome: 3,
		TimeoutsAway: 3,
		ScoreBug:     true,
		Graphic:      nil,
		GraphicID:    0,
		UpdatedAt:    time.Now().UnixMilli(),
	}

	h.hub.SetState(initialState)
	return initialState, nil
}

// GetState returns the current broadcast state for the given match.
func (h *BroadcastHandler) GetState(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		matchID = c.Param("matchId")
	}

	state, err := h.ensureMatchState(c, matchID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "match not found", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, state)
}

// UpdateState receives a REST state update from the producer.
func (h *BroadcastHandler) UpdateState(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		matchID = c.Param("matchId")
	}

	var state BroadcastState
	if err := c.ShouldBindJSON(&state); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload", "details": err.Error()})
		return
	}

	state.MatchID = matchID
	h.hub.SetState(&state)
	c.JSON(http.StatusOK, state)
}

// GetPlayers returns team sheet players for graphic selection.
func (h *BroadcastHandler) GetPlayers(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		matchID = c.Param("matchId")
	}

	detail, err := h.matchService.GetMatchDetail(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "match not found", "details": err.Error()})
		return
	}

	var result []BroadcastPlayer
	homeName := "Home Team"
	homeID := ""
	if detail.Match.HomeTeam != nil {
		homeName = detail.Match.HomeTeam.Name
		homeID = detail.Match.HomeTeam.ID
	}
	awayName := "Away Team"
	awayID := ""
	if detail.Match.AwayTeam != nil {
		awayName = detail.Match.AwayTeam.Name
		awayID = detail.Match.AwayTeam.ID
	}

	for _, p := range detail.TeamSheet.HomeTeam {
		result = append(result, BroadcastPlayer{
			PlayerID:     p.PlayerID,
			Name:         p.Name,
			JerseyNumber: p.JerseyNumber,
			Position:     p.Position,
			TeamID:       homeID,
			TeamName:     homeName,
			Image:        p.Image,
		})
	}
	for _, p := range detail.TeamSheet.AwayTeam {
		result = append(result, BroadcastPlayer{
			PlayerID:     p.PlayerID,
			Name:         p.Name,
			JerseyNumber: p.JerseyNumber,
			Position:     p.Position,
			TeamID:       awayID,
			TeamName:     awayName,
			Image:        p.Image,
		})
	}

	c.JSON(http.StatusOK, result)
}

// ProducerWS upgrades connection to WebSocket for authenticated producers.
func (h *BroadcastHandler) ProducerWS(c *gin.Context) {
	matchID := c.Param("id")
	if matchID == "" {
		matchID = c.Param("matchId")
	}

	// Bootstrap state if not present
	_, _ = h.ensureMatchState(c, matchID)

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[BroadcastProducerWS] upgrade error: %v", err)
		return
	}

	client := &Client{
		Hub:        h.hub,
		Conn:       conn,
		Send:       make(chan []byte, 256),
		MatchID:    matchID,
		IsProducer: true,
	}

	h.hub.Register(client)
	go client.WritePump()
	client.ReadPump()
}

// ViewerWS upgrades connection to WebSocket for public overlay displays (vMix).
func (h *BroadcastHandler) ViewerWS(c *gin.Context) {
	matchID := c.Param("matchId")
	if matchID == "" {
		matchID = c.Param("id")
	}

	// Bootstrap state if not present so vMix sees graphics right away
	_, _ = h.ensureMatchState(c, matchID)

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[BroadcastViewerWS] upgrade error: %v", err)
		return
	}

	client := &Client{
		Hub:        h.hub,
		Conn:       conn,
		Send:       make(chan []byte, 256),
		MatchID:    matchID,
		IsProducer: false,
	}

	h.hub.Register(client)
	go client.WritePump()
	client.ReadPump()
}
