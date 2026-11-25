package transport

import (
	"net/http"

	"showtime-backend/internal/arena/service"
	showtime "showtime-backend/internal/domain"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

const (
	ctxClubID   = "arena_club_id"
	ctxOverride = "arena_override"
)

// ManagerScope lets in the signed-in manager of a club and records which club they
// act for. With allowStaff, anyone holding full Arena club access may also act for
// any club by passing ?club_id=, and may edit past kick-off (the override).
func ManagerScope(svc *service.Service, roles services.IRoleService, allowStaff bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := userID(c)
		if !ok {
			c.Abort()
			return
		}
		if allowStaff {
			if clubID := c.Query("club_id"); clubID != "" {
				access, err := roles.ResolveUser(c.Request.Context(), uid)
				if err == nil && access.Level(showtime.FeatureArenaClubs) == showtime.AccessFull {
					c.Set(ctxClubID, clubID)
					c.Set(ctxOverride, true)
					c.Next()
					return
				}
			}
		}
		club, err := svc.ManagerClub(c.Request.Context(), uid)
		if err != nil {
			fail(c, err)
			c.Abort()
			return
		}
		c.Set(ctxClubID, club.ID)
		c.Next()
	}
}

func scope(c *gin.Context) (clubID string, override bool) {
	clubID = c.GetString(ctxClubID)
	override = c.GetBool(ctxOverride)
	return
}

// ManageClub is the manager's club with its squad.
func (h *Handler) ManageClub(c *gin.Context) {
	clubID, _ := scope(c)
	club, err := h.svc.GetClub(c.Request.Context(), clubID)
	if err != nil {
		fail(c, err)
		return
	}
	roster, err := h.svc.ListPlayersOfClub(c.Request.Context(), clubID)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"club": club, "roster": roster})
}

func (h *Handler) ManageContracts(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	out, err := h.svc.ClubContracts(c.Request.Context(), uid, c.Query("status"))
	reply(c, out, err)
}

func (h *Handler) ManageContract(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	v, err := h.svc.GetContractFor(c.Request.Context(), uid, c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) MakeOffer(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	var in service.OfferInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.MakeOffer(c.Request.Context(), uid, in)
	replyCreated(c, v, err)
}

func (h *Handler) WithdrawOffer(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	v, err := h.svc.WithdrawOffer(c.Request.Context(), uid, c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) ApproveRelease(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	v, err := h.svc.ApproveRelease(c.Request.Context(), uid, c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) DeclineRelease(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	var in struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&in)
	v, err := h.svc.DeclineRelease(c.Request.Context(), uid, c.Param("id"), in.Reason)
	reply(c, v, err)
}

func (h *Handler) FreeAgents(c *gin.Context) {
	out, err := h.svc.FreeAgents(c.Request.Context(), c.Query("q"))
	reply(c, out, err)
}

func (h *Handler) SearchPlayers(c *gin.Context) {
	out, err := h.svc.SearchPlayers(c.Request.Context(), c.Query("q"))
	reply(c, out, err)
}

// ---- team sheets -------------------------------------------------------------

func (h *Handler) ManageFixtures(c *gin.Context) {
	clubID, _ := scope(c)
	out, err := h.svc.ClubFixtures(c.Request.Context(), clubID)
	reply(c, out, err)
}

func (h *Handler) GetSheet(c *gin.Context) {
	clubID, override := scope(c)
	v, err := h.svc.GetSheetEditor(c.Request.Context(), clubID, c.Param("matchId"), override)
	reply(c, v, err)
}

func (h *Handler) SaveSheet(c *gin.Context) {
	clubID, override := scope(c)
	var in service.SheetSave
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.SaveSheet(c.Request.Context(), clubID, c.Param("matchId"), in, override)
	reply(c, v, err)
}

func (h *Handler) ReopenSheet(c *gin.Context) {
	clubID, override := scope(c)
	v, err := h.svc.ReopenSheet(c.Request.Context(), clubID, c.Param("matchId"), override)
	reply(c, v, err)
}

func (h *Handler) AutoPickSheet(c *gin.Context) {
	clubID, _ := scope(c)
	var in struct {
		Formation string `json:"formation"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.AutoPick(c.Request.Context(), clubID, in.Formation)
	reply(c, v, err)
}
