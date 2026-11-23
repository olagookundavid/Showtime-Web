package transport

import (
	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/service"

	"github.com/gin-gonic/gin"
)

// Public endpoints: anyone can read these, signed in or not.

func (h *Handler) Overview(c *gin.Context) {
	v, err := h.svc.Overview(c.Request.Context(), c.Query("division_id"))
	reply(c, v, err)
}

func (h *Handler) Standings(c *gin.Context) {
	v, err := h.svc.Standings(c.Request.Context(), c.Query("division_id"))
	reply(c, v, err)
}

func (h *Handler) Matches(c *gin.Context) {
	state := c.Query("state")
	if state != "" && state != "results" && state != "upcoming" {
		state = ""
	}
	v, err := h.svc.Matches(c.Request.Context(), c.Query("division_id"), state, c.Query("club_id"))
	reply(c, v, err)
}

func (h *Handler) MatchDetail(c *gin.Context) {
	v, err := h.svc.MatchDetail(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) Clubs(c *gin.Context) {
	out, err := h.svc.ListClubs(c.Request.Context(), service.ClubFilter{DivisionID: c.Query("division_id"), Query: c.Query("q")})
	reply(c, out, err)
}

func (h *Handler) ClubProfile(c *gin.Context) {
	v, err := h.svc.ClubProfile(c.Request.Context(), c.Param("slug"))
	reply(c, v, err)
}

func (h *Handler) PlayerStats(c *gin.Context) {
	v, err := h.svc.PlayerStats(c.Request.Context(), c.Query("division_id"), c.Query("club_id"), c.Query("q"))
	reply(c, v, err)
}

func (h *Handler) PlayerProfile(c *gin.Context) {
	v, err := h.svc.PlayerProfile(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) Bracket(c *gin.Context) {
	v, err := h.svc.Bracket(c.Request.Context(), c.Query("division_id"))
	reply(c, v, err)
}

func (h *Handler) Seasons(c *gin.Context) {
	out, err := h.svc.ListSeasons(c.Request.Context())
	reply(c, out, err)
}

// Formations is the list of shapes and where each slot sits on the pitch board.
func (h *Handler) Formations(c *gin.Context) {
	c.JSON(200, domain.Formations)
}

// ---- the signed-in user ------------------------------------------------------

func (h *Handler) Me(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	v, err := h.svc.Me(c.Request.Context(), uid)
	reply(c, v, err)
}

func (h *Handler) CreateMyPlayer(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	var in service.MyPlayerInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.CreateMyPlayer(c.Request.Context(), uid, in)
	replyCreated(c, v, err)
}

func (h *Handler) UpdateMyPlayer(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	var in service.MyPlayerInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.UpdateMyPlayer(c.Request.Context(), uid, in)
	reply(c, v, err)
}

func (h *Handler) Follow(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	var in struct {
		ClubID string `json:"club_id"`
	}
	if !bind(c, &in) {
		return
	}
	done(c, h.svc.Follow(c.Request.Context(), uid, in.ClubID))
}

func (h *Handler) Unfollow(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	done(c, h.svc.Unfollow(c.Request.Context(), uid))
}

// ---- a player's own contracts --------------------------------------------------

func (h *Handler) MyContracts(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	out, err := h.svc.PlayerContracts(c.Request.Context(), uid)
	reply(c, out, err)
}

func (h *Handler) MyContract(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	v, err := h.svc.GetContractFor(c.Request.Context(), uid, c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) SignContract(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	var in service.SignInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.SignContract(c.Request.Context(), uid, c.Param("id"), in)
	reply(c, v, err)
}

func (h *Handler) RejectContract(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	var in struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&in)
	v, err := h.svc.RejectOffer(c.Request.Context(), uid, c.Param("id"), in.Reason)
	reply(c, v, err)
}
