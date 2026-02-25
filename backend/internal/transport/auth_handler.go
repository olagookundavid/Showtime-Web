package transport

import (
	"errors"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	userHelper "showtime-backend/internal/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IAuthHandler interface {
	Register(c *gin.Context)
	Login(c *gin.Context)
	ResetPassword(c *gin.Context)
	ReturnUserProfile(c *gin.Context)
	Logout(c *gin.Context)
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
