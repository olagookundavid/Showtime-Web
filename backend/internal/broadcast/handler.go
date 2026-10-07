package broadcast

import (
	"log"
	"net/http"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type IBroadcastHandler interface {
	GetState(c *gin.Context)
	UpdateState(c *gin.Context)
	GetPlayers(c *gin.Context)
	ProducerWS(c *gin.Context)
	ViewerWS(c *gin.Context)

	ListDays(c *gin.Context)
	GetDay(c *gin.Context)
	SetDayOnAir(c *gin.Context)
	DayOverlayState(c *gin.Context)
	DayViewerWS(c *gin.Context)
}

type BroadcastHandler struct {
	hub          *Hub
	matchService services.IMatchService
	playService  services.IPlayService
	days         ports.IBroadcastStateRepository
}

func NewBroadcastHandler(hub *Hub, matchService services.IMatchService, playService services.IPlayService, days ports.IBroadcastStateRepository) *BroadcastHandler {
	return &BroadcastHandler{
		hub:          hub,
		matchService: matchService,
		playService:  playService,
		days:         days,
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

// ── Event-day channels ──────────────────────────────────────────────────────
// A live stream covers a whole match day, so vMix loads one overlay link per
// day (/broadcast/day/:date/overlay) and the producer picks which of that
// day's matches it shows. Each match keeps its own state; the day only points
// at one of them.

// dayParam returns the :date path param if it is a valid YYYY-MM-DD date.
func dayParam(c *gin.Context) (string, bool) {
	day := c.Param("date")
	if _, err := time.Parse("2006-01-02", day); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
		return "", false
	}
	return day, true
}

// dayOnAirState returns the state of the day's on-air match, or nil when the
// day has none.
func (h *BroadcastHandler) dayOnAirState(c *gin.Context, day string) (*BroadcastState, error) {
	matchID, err := h.hub.DayOnAir(c.Request.Context(), day)
	if err != nil || matchID == "" {
		return nil, err
	}
	return h.ensureMatchState(c, matchID)
}

// ListDays returns match days, newest first, for the studio's day picker.
func (h *BroadcastHandler) ListDays(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}

	days, total, err := h.days.ListMatchDays(c.Request.Context(), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load match days"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data":        days,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": (total + limit - 1) / limit,
	})
}

// GetDay returns a day's summary, its matches and which one is on air.
func (h *BroadcastHandler) GetDay(c *gin.Context) {
	day, ok := dayParam(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	summary, err := h.days.GetMatchDay(ctx, day)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load match day"})
		return
	}
	matches, err := h.days.ListDayMatches(ctx, day)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load the day's matches"})
		return
	}
	// The hub's choice is authoritative (it may not be saved yet on a fresh day).
	if onAir, err := h.hub.DayOnAir(ctx, day); err == nil {
		summary.OnAirMatchID = onAir
	}
	c.JSON(http.StatusOK, gin.H{"day": summary, "matches": matches})
}

type setDayOnAirRequest struct {
	// MatchID is the match to show; empty takes the day off air.
	MatchID string `json:"match_id"`
}

// SetDayOnAir switches which match the day's overlay shows.
func (h *BroadcastHandler) SetDayOnAir(c *gin.Context) {
	day, ok := dayParam(c)
	if !ok {
		return
	}
	var req setDayOnAirRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload", "details": err.Error()})
		return
	}
	ctx := c.Request.Context()

	if req.MatchID != "" {
		matches, err := h.days.ListDayMatches(ctx, day)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load the day's matches"})
			return
		}
		found := false
		for _, m := range matches {
			if m.ID == req.MatchID {
				found = true
				break
			}
		}
		if !found {
			c.JSON(http.StatusBadRequest, gin.H{"error": "that match is not on this day"})
			return
		}
		if _, err := h.ensureMatchState(c, req.MatchID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "match not found", "details": err.Error()})
			return
		}
	}

	if err := h.hub.SetDayOnAir(ctx, day, req.MatchID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to switch the on-air match", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"date": day, "on_air_match_id": req.MatchID})
}

// DayOverlayState is the public initial state for an event-day overlay: the
// on-air match's state, or null when nothing is on air.
func (h *BroadcastHandler) DayOverlayState(c *gin.Context) {
	day, ok := dayParam(c)
	if !ok {
		return
	}
	state, err := h.dayOnAirState(c, day)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load the on-air match"})
		return
	}
	if state == nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	c.JSON(http.StatusOK, state)
}

// DayViewerWS streams an event day's on-air match to a public overlay (vMix),
// following it when the producer switches matches.
func (h *BroadcastHandler) DayViewerWS(c *gin.Context) {
	day, ok := dayParam(c)
	if !ok {
		return
	}
	// Load the on-air match first so the overlay gets its state on connect.
	_, _ = h.dayOnAirState(c, day)

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[BroadcastDayViewerWS] upgrade error: %v", err)
		return
	}

	client := &Client{
		Hub:  h.hub,
		Conn: conn,
		Send: make(chan []byte, 256),
		Day:  day,
	}

	h.hub.Register(client)
	go client.WritePump()
	client.ReadPump()
}
