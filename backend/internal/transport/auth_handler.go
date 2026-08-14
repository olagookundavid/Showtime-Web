package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	userHelper "showtime-backend/internal/helpers"
	"showtime-backend/internal/services"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type IAuthHandler interface {
	Register(c *gin.Context)
	ResetPassword(c *gin.Context)
	Login(c *gin.Context)
	Logout(c *gin.Context)
	ReturnUserProfile(c *gin.Context)
	GetUsers(c *gin.Context)
	UpdateUserRole(c *gin.Context)
	UpdateUserInfo(c *gin.Context)
	SendPasswordResetOTP(c *gin.Context)
}

type AuthHandler struct {
	AuthService services.IAuthService
}

func NewAuthHandler(service services.IAuthService) *AuthHandler {
	return &AuthHandler{AuthService: service}
}

// Register godoc
// @Summary      Register a new user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body dto.RegisterRequest true "Register Payload"
// @Success      201 {object} map[string]string
// @Failure      400 {object} map[string]string
// @Router       /api/v1/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {

	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	err := h.AuthService.Register(c, req)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrServerError):
			helpers.ServerErrorResponse(c, err)
		default:
			helpers.BadResponse(c, err.Error())
		}
		return
	}
	helpers.SuccessCreated(c, "Registration successful", nil)
}

// ResetPassword godoc
// @Summary      Reset user password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body dto.ResetPasswordRequest true "Reset Password Payload"
// @Success      200 {object} map[string]string
// @Router       /api/v1/auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req dto.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	err := h.AuthService.ResetPassword(c, req)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrServerError):
			helpers.ServerErrorResponse(c, err)
		default:
			helpers.BadResponse(c, err.Error())
		}
		return
	}

	helpers.SuccessOK(c, "Password reset successful", nil)
}

// Login godoc
// @Summary      Login with email and password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body dto.LoginRequest true "Login Payload"
// @Success      200 {object} dto.LoginResponse
// @Router       /api/v1/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	userRes, err := h.AuthService.Login(c, req)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrMustResetPassword):
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "MUST_RESET_PASSWORD",
				"code":    "MUST_RESET_PASSWORD",
				"message": "Default temporary password cannot be used to log in. Please reset your password to continue.",
			})
		case errors.Is(err, appErrors.ErrServerError):
			helpers.ServerErrorResponse(c, err)
		default:
			helpers.BadResponse(c, err.Error())
		}
		return
	}

	// Set Access Token as HttpOnly cookie
	userHelper.SetTokensInCookie(c, userRes)

	helpers.SuccessOK(c, "Login successful", userRes)
}

// User Profile godoc
// @Summary      Get Profile
// @Tags         auth
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} dto.LoginResponse
// @Router       /api/v1/auth/profile [get]
func (h *AuthHandler) ReturnUserProfile(c *gin.Context) {
	tokenPayload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	userRes, err := h.AuthService.ReturnUserProfile(c, tokenPayload.UserId)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrServerError):
			helpers.ServerErrorResponse(c, err)
		default:
			helpers.BadResponse(c, err.Error())
		}
		return
	}

	helpers.SuccessOK(c, "Profile retrieved", userRes)
}

// Logout godoc
// @Summary      Logout
// @Tags         auth
// @Produce      json
// @Success      200 {object} map[string]string
// @Router       /api/v1/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	userHelper.RemoveTokensInCookie(c)

	helpers.SuccessOK(c, "Logout successfully", nil)
}

// GetUsers godoc
// @Summary      Get users (search by email or name)
// @Tags         admin
// @Security     BearerAuth
// @Param        search query string false "Search by email or name"
// @Param        page query int false "Page number"
// @Param        limit query int false "Items per page"
// @Produce      json
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/users [get]
func (h *AuthHandler) GetUsers(c *gin.Context) {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	users, total, err := h.AuthService.ListUsers(c.Request.Context(), page, limit, search)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	totalPages := 1
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        users,
		"total_pages": totalPages,
		"meta": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// UpdateUserRole godoc
// @Summary      Update user role
// @Tags         admin
// @Security     BearerAuth
// @Param        id path string true "User ID"
// @Param        request body dto.UpdateUserRoleRequest true "Update Role Payload"
// @Produce      json
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/users/{id}/role [put]
func (h *AuthHandler) UpdateUserRole(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	// Privilege-escalation guard: only an app_admin may grant the elevated
	// admin / app_admin roles. The route admits plain admins (for assigning
	// lesser roles like ticketer/team_head), so without this an admin could
	// self-promote to app_admin and unlock the superuser tier.
	if req.Role == "admin" || req.Role == "app_admin" {
		payload, perr := helpers.GetTokenPayloadFromContext(c)
		if perr != nil || payload == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		caller, cerr := h.AuthService.ReturnUserProfile(c.Request.Context(), payload.UserId)
		if cerr != nil || caller == nil || caller.UserType != "app_admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "only an app_admin can assign the admin or app_admin role"})
			return
		}
	}

	err := h.AuthService.UpdateUserRole(c.Request.Context(), id, req.Role)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrNoUserRecordExist):
			helpers.BadResponse(c, "User not found")
		case strings.Contains(err.Error(), "invalid role"):
			helpers.BadResponse(c, err.Error())
		default:
			helpers.ServerErrorResponse(c, err)
		}
		return
	}

	helpers.SuccessOK(c, "User role updated successfully", nil)
}

// UpdateUserInfo godoc
// @Summary      Update user info (fullname, phone)
// @Tags         admin
// @Security     BearerAuth
// @Param        id path string true "User ID"
// @Param        request body dto.UpdateUserInfoRequest true "Update Info Payload"
// @Produce      json
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/users/{id} [put]
func (h *AuthHandler) UpdateUserInfo(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateUserInfoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	err := h.AuthService.UpdateUserInfo(c.Request.Context(), id, req.FullName, req.Phone)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrNoUserRecordExist):
			helpers.BadResponse(c, "User not found")
		default:
			helpers.ServerErrorResponse(c, err)
		}
		return
	}

	helpers.SuccessOK(c, "User info updated successfully", nil)
}

// SendPasswordResetOTP godoc
// @Summary      Send OTP for password reset
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body dto.ForgotPasswordRequest true "Forgot Password Payload"
// @Success      200 {object} map[string]string
// @Router       /api/v1/auth/forgot-password [post]
func (h *AuthHandler) SendPasswordResetOTP(c *gin.Context) {
	var req dto.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	err := h.AuthService.SendPasswordResetOTP(c, req.Email)
	if err != nil {
		switch {
		case errors.Is(err, appErrors.ErrServerError):
			helpers.ServerErrorResponse(c, err)
		default:
			helpers.BadResponse(c, err.Error())
		}
		return
	}

	// Always return success to prevent email enumeration
	helpers.SuccessOK(c, "If your email is registered, a code has been sent", nil)
}
