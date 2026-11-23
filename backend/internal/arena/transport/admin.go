package transport

import (
	"showtime-backend/internal/arena/service"
	"showtime-backend/internal/arena/store"

	"github.com/gin-gonic/gin"
)

// Admin endpoints. Access is decided by the route's feature (see routes.go).

// ---- seasons and divisions (arena_seasons) --------------------------------------

func (h *Handler) AdminSeasons(c *gin.Context) {
	out, err := h.svc.ListSeasons(c.Request.Context())
	reply(c, out, err)
}

func (h *Handler) AdminSeason(c *gin.Context) {
	v, err := h.svc.SeasonWithDivisions(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) AdminCreateSeason(c *gin.Context) {
	var in service.SeasonInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.CreateSeason(c.Request.Context(), in)
	replyCreated(c, v, err)
}

func (h *Handler) AdminUpdateSeason(c *gin.Context) {
	var in service.SeasonInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.UpdateSeason(c.Request.Context(), c.Param("id"), in)
	reply(c, v, err)
}

func (h *Handler) AdminSeasonStatus(c *gin.Context) {
	var in struct {
		Status string `json:"status"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.SetSeasonStatus(c.Request.Context(), c.Param("id"), in.Status)
	reply(c, v, err)
}

func (h *Handler) AdminTransferWindow(c *gin.Context) {
	var in struct {
		Open bool `json:"open"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.SetTransferWindow(c.Request.Context(), c.Param("id"), in.Open)
	reply(c, v, err)
}

func (h *Handler) AdminCreateDivision(c *gin.Context) {
	var in service.DivisionInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.CreateDivision(c.Request.Context(), c.Param("id"), in)
	replyCreated(c, v, err)
}

func (h *Handler) AdminUpdateDivision(c *gin.Context) {
	var in service.DivisionInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.UpdateDivision(c.Request.Context(), c.Param("id"), in)
	reply(c, v, err)
}

func (h *Handler) AdminDeleteDivision(c *gin.Context) {
	done(c, h.svc.DeleteDivision(c.Request.Context(), c.Param("id")))
}

func (h *Handler) AdminDivisionClubs(c *gin.Context) {
	var in struct {
		ClubIDs []string `json:"club_ids"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.SetDivisionClubs(c.Request.Context(), c.Param("id"), in.ClubIDs)
	reply(c, v, err)
}

func (h *Handler) AdminPreviewFixtures(c *gin.Context) {
	var in service.FixtureRequest
	_ = c.ShouldBindJSON(&in)
	v, err := h.svc.PreviewFixtures(c.Request.Context(), c.Param("id"), in)
	reply(c, v, err)
}

func (h *Handler) AdminGenerateFixtures(c *gin.Context) {
	var in service.FixtureRequest
	_ = c.ShouldBindJSON(&in)
	v, err := h.svc.GenerateFixtures(c.Request.Context(), c.Param("id"), in)
	replyCreated(c, v, err)
}

func (h *Handler) AdminDeleteFixtures(c *gin.Context) {
	done(c, h.svc.DeleteFixtures(c.Request.Context(), c.Param("id")))
}

func (h *Handler) AdminGeneratePlayoffs(c *gin.Context) {
	v, err := h.svc.GeneratePlayoffs(c.Request.Context(), c.Param("id"))
	replyCreated(c, v, err)
}

func (h *Handler) AdminReschedule(c *gin.Context) {
	var in service.RescheduleInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.RescheduleMatch(c.Request.Context(), c.Param("id"), in)
	reply(c, v, err)
}

// ---- clubs and players (arena_clubs) --------------------------------------------

func (h *Handler) AdminClubs(c *gin.Context) {
	out, err := h.svc.ListClubs(c.Request.Context(), service.ClubFilter{
		DivisionID:      c.Query("division_id"),
		Query:           c.Query("q"),
		IncludeArchived: c.Query("archived") == "true",
		Unassigned:      c.Query("unassigned") == "true",
	})
	reply(c, out, err)
}

func (h *Handler) AdminClub(c *gin.Context) {
	v, err := h.svc.GetClub(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) AdminCreateClub(c *gin.Context) {
	var in service.ClubInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.CreateClub(c.Request.Context(), in)
	replyCreated(c, v, err)
}

func (h *Handler) AdminUpdateClub(c *gin.Context) {
	var in service.ClubInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.UpdateClub(c.Request.Context(), c.Param("id"), in)
	reply(c, v, err)
}

func (h *Handler) AdminArchiveClub(c *gin.Context) {
	var in struct {
		Archived bool `json:"archived"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.SetClubArchived(c.Request.Context(), c.Param("id"), in.Archived)
	reply(c, v, err)
}

func (h *Handler) AdminDeleteClub(c *gin.Context) {
	done(c, h.svc.DeleteClub(c.Request.Context(), c.Param("id")))
}

func (h *Handler) AdminClubManager(c *gin.Context) {
	var in struct {
		Email string `json:"email"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.SetClubManager(c.Request.Context(), c.Param("id"), in.Email)
	reply(c, v, err)
}

func (h *Handler) AdminPlayers(c *gin.Context) {
	out, err := h.svc.ListPlayers(c.Request.Context(), store.PlayerFilter{
		ClubID:     c.Query("club_id"),
		Query:      c.Query("q"),
		FreeAgents: c.Query("free") == "true",
		Limit:      queryInt(c, "limit"),
		Offset:     queryInt(c, "offset"),
	})
	reply(c, out, err)
}

func (h *Handler) AdminPlayer(c *gin.Context) {
	v, err := h.svc.GetPlayer(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) AdminCreatePlayer(c *gin.Context) {
	var in service.PlayerInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.CreatePlayer(c.Request.Context(), in)
	replyCreated(c, v, err)
}

func (h *Handler) AdminUpdatePlayer(c *gin.Context) {
	var in service.PlayerInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.UpdatePlayer(c.Request.Context(), c.Param("id"), in)
	reply(c, v, err)
}

func (h *Handler) AdminDeletePlayer(c *gin.Context) {
	done(c, h.svc.DeletePlayer(c.Request.Context(), c.Param("id")))
}

func (h *Handler) AdminLinkPlayer(c *gin.Context) {
	var in struct {
		Email string `json:"email"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.LinkPlayerUser(c.Request.Context(), c.Param("id"), in.Email)
	reply(c, v, err)
}

func (h *Handler) AdminRegisterPlayer(c *gin.Context) {
	var in struct {
		ClubID    string `json:"club_id"`
		Shirt     int    `json:"shirt_number"`
		SquadRole string `json:"squad_role"`
	}
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.RegisterPlayer(c.Request.Context(), c.Param("id"), in.ClubID, in.Shirt, in.SquadRole)
	reply(c, v, err)
}

func (h *Handler) AdminReleasePlayer(c *gin.Context) {
	v, err := h.svc.ReleasePlayer(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

// ---- results (arena_results) ------------------------------------------------------

func (h *Handler) AdminResultForm(c *gin.Context) {
	v, err := h.svc.ResultForm(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) AdminRecordResult(c *gin.Context) {
	var in service.ResultInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.RecordResult(c.Request.Context(), c.Param("id"), in)
	reply(c, v, err)
}

func (h *Handler) AdminClearResult(c *gin.Context) {
	v, err := h.svc.ClearResult(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

// ---- transfers (arena_transfers) --------------------------------------------------

func (h *Handler) AdminContracts(c *gin.Context) {
	out, err := h.svc.AdminContracts(c.Request.Context(), c.Query("status"))
	reply(c, out, err)
}

func (h *Handler) AdminContract(c *gin.Context) {
	v, err := h.svc.GetContractAdmin(c.Request.Context(), c.Param("id"))
	reply(c, v, err)
}

func (h *Handler) AdminWithdrawContract(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	v, err := h.svc.AdminWithdrawOffer(c.Request.Context(), uid, c.Param("id"))
	reply(c, v, err)
}
