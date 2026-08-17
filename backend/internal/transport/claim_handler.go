package transport

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/middlewares"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IClaimHandler interface {
	// Public
	VerifyCode(c *gin.Context)
	SubmitClaim(c *gin.Context)
	VerifyClaimEmail(c *gin.Context)

	// Claimant
	GetMyClaim(c *gin.Context)
	UpdateMyClaimPhoto(c *gin.Context)
	ResendVerification(c *gin.Context)

	// Review (team head / admin)
	ListClaims(c *gin.Context)
	ApproveClaim(c *gin.Context)
	RejectClaim(c *gin.Context)
	RevokeClaim(c *gin.Context)

	// Codes
	CreateClaimCode(c *gin.Context)
	GetMyClaimCode(c *gin.Context)
	ListClaimCodes(c *gin.Context)
	RevokeClaimCode(c *gin.Context)
}

type ClaimHandler struct {
	service services.IClaimService
}

func NewClaimHandler(service services.IClaimService) IClaimHandler {
	return &ClaimHandler{service: service}
}

// claimScopedTeamID returns the team a team_head is restricted to. An empty string
// means the caller is an admin and may act across teams.
func claimScopedTeamID(c *gin.Context) string {
	v, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

// --- Public ---

// VerifyCode godoc
// @Summary      Exchange a team claim code for that team's unclaimed roster
// @Tags         claims
// @Produce      json
// @Router       /api/v1/claim/verify-code [post]
func (h *ClaimHandler) VerifyCode(c *gin.Context) {
	var req dto.VerifyClaimCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a code is required"})
		return
	}

	res, err := h.service.VerifyCode(c.Request.Context(), req.Code)
	if err != nil {
		// Invalid, expired, revoked and exhausted all land here with the same message,
		// so the endpoint cannot be used to discover which codes exist.
		if errors.Is(err, services.ErrInvalidClaimCode) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the team roster"})
		return
	}

	c.JSON(http.StatusOK, res)
}

// SubmitClaim godoc
// @Summary      Submit a claim for a player account
// @Tags         claims
// @Produce      json
// @Router       /api/v1/claim/submit [post]
func (h *ClaimHandler) SubmitClaim(c *gin.Context) {
	var req dto.SubmitClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email, password and a valid code are required"})
		return
	}

	res, err := h.service.SubmitClaim(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidClaimCode):
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		case errors.Is(err, ports.ErrClaimConflict):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, res)
}

// VerifyClaimEmail godoc
// @Summary      Confirm a claimant's email address
// @Tags         claims
// @Produce      json
// @Router       /api/v1/claim/verify-email [post]
func (h *ClaimHandler) VerifyClaimEmail(c *gin.Context) {
	var req dto.VerifyClaimEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a token is required"})
		return
	}

	if err := h.service.VerifyClaimEmail(c.Request.Context(), req.Token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Your email address is confirmed."})
}

// --- Claimant ---

// GetMyClaim godoc
// @Summary      Get the signed-in claimant's own claim status
// @Tags         claims
// @Produce      json
// @Router       /api/v1/claim/my-status [get]
func (h *ClaimHandler) GetMyClaim(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	res, err := h.service.GetMyClaim(c.Request.Context(), payload.UserId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// UpdateMyClaimPhoto godoc
// @Summary      Attach a photo to the signed-in claimant's pending claim
// @Tags         claims
// @Produce      json
// @Router       /api/v1/claim/my-photo [patch]
func (h *ClaimHandler) UpdateMyClaimPhoto(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.UpdateClaimPhotoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a photo is required"})
		return
	}

	if err := h.service.UpdateMyClaimPhoto(c.Request.Context(), payload.UserId, req.Photo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Photo saved."})
}

// ResendVerification godoc
// @Summary      Resend the claimant's email verification link
// @Tags         claims
// @Produce      json
// @Router       /api/v1/claim/resend-verification [post]
func (h *ClaimHandler) ResendVerification(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.ResendVerification(c.Request.Context(), payload.UserId); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Verification email sent."})
}

// --- Review ---

// ListClaims godoc
// @Summary      List player claims, scoped to the caller's team unless admin
// @Tags         claims
// @Produce      json
// @Router       /api/v1/team-head/claims [get]
func (h *ClaimHandler) ListClaims(c *gin.Context) {
	scopedTeam := claimScopedTeamID(c)

	// Admins may narrow to a team explicitly; a team head is always pinned to their own.
	teamID := scopedTeam
	if scopedTeam == "" {
		teamID = c.Query("team_id")
	}

	status := c.Query("status")
	if status == "" {
		status = "PENDING"
	}
	if status == "ALL" {
		status = ""
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	res, err := h.service.ListClaims(c.Request.Context(), teamID, status, strings.TrimSpace(c.Query("search")), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// ApproveClaim godoc
// @Summary      Approve a player claim, minting the player's account
// @Tags         claims
// @Produce      json
// @Router       /api/v1/team-head/claims/{id}/approve [post]
func (h *ClaimHandler) ApproveClaim(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Body is optional: a manager may approve as-submitted, or correct the roster
	// fields on the way through.
	var req dto.ApproveClaimRequest
	_ = c.ShouldBindJSON(&req)

	err = h.service.ApproveClaim(c.Request.Context(), c.Param("id"), payload.UserId, claimScopedTeamID(c), req)
	if err != nil {
		if strings.Contains(err.Error(), "forbidden") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Claim approved. The player can now sign in."})
}

// RejectClaim godoc
// @Summary      Reject a player claim, freeing the player to be claimed again
// @Tags         claims
// @Produce      json
// @Router       /api/v1/team-head/claims/{id}/reject [post]
func (h *ClaimHandler) RejectClaim(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.RejectClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a reason is required"})
		return
	}

	err = h.service.RejectClaim(c.Request.Context(), c.Param("id"), payload.UserId, claimScopedTeamID(c), req.Reason)
	if err != nil {
		if strings.Contains(err.Error(), "forbidden") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Claim rejected."})
}

// RevokeClaim godoc
// @Summary      Undo an approved claim (admin only)
// @Tags         claims
// @Produce      json
// @Router       /api/v1/admin/claims/{id}/revoke [post]
func (h *ClaimHandler) RevokeClaim(c *gin.Context) {
	if err := h.service.RevokeClaim(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Approval revoked. The claim is pending review again."})
}

// --- Codes ---

// CreateClaimCode godoc
// @Summary      Generate (or rotate) a team's claim code
// @Tags         claims
// @Produce      json
// @Router       /api/v1/team-head/claim-codes [post]
func (h *ClaimHandler) CreateClaimCode(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req dto.CreateClaimCodeRequest
	_ = c.ShouldBindJSON(&req)

	// A team head can only ever mint a code for their own team, regardless of body.
	teamID := claimScopedTeamID(c)
	if teamID == "" {
		teamID = strings.TrimSpace(req.TeamID)
	}
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a team_id is required"})
		return
	}

	res, err := h.service.GenerateCode(c.Request.Context(), teamID, payload.UserId, req.ExpiresInDays, req.MaxUses)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, res)
}

// GetMyClaimCode godoc
// @Summary      Get the live claim code for the caller's team
// @Tags         claims
// @Produce      json
// @Router       /api/v1/team-head/claim-codes [get]
func (h *ClaimHandler) GetMyClaimCode(c *gin.Context) {
	teamID := claimScopedTeamID(c)
	if teamID == "" {
		teamID = c.Query("team_id")
	}
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a team_id is required"})
		return
	}

	res, err := h.service.GetLiveCode(c.Request.Context(), teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res == nil {
		c.JSON(http.StatusOK, gin.H{"code": nil, "message": "No live code. Generate one to start onboarding players."})
		return
	}

	c.JSON(http.StatusOK, res)
}

// ListClaimCodes godoc
// @Summary      List every team's live claim code (admin)
// @Tags         claims
// @Produce      json
// @Router       /api/v1/admin/claim-codes [get]
func (h *ClaimHandler) ListClaimCodes(c *gin.Context) {
	res, err := h.service.ListCodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

// RevokeClaimCode godoc
// @Summary      Revoke a claim code
// @Tags         claims
// @Produce      json
// @Router       /api/v1/team-head/claim-codes/{id} [delete]
func (h *ClaimHandler) RevokeClaimCode(c *gin.Context) {
	if err := h.service.RevokeCode(c.Request.Context(), c.Param("id"), claimScopedTeamID(c)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Claim code revoked."})
}
