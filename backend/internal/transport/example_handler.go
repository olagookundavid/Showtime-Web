package transport

import (
	"net/http"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IExampleHandler interface {
	CreateExample(c *gin.Context)
}

type ExampleHandler struct {
	Service services.IExampleService
}

func NewExampleHandler(service services.IExampleService) *ExampleHandler {
	return &ExampleHandler{Service: service}
}

// CreateExample godoc
// @Summary Create example
// @Description Create an example record
// @Tags example
// @Security     BearerAuth
// @Accept json
// @Produce json
// @Param request body dto.InviteRequest true "Example details"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/example [post]
func (h *ExampleHandler) CreateExample(c *gin.Context) {

	// _, userId, err := helpers.GetPayloadFromContext(c)
	// if err != nil {
	// 	helpers.ServerErrorResponse(c, err)
	// 	return
	// }

	var req dto.InviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// req.InviterId = userId

	err := h.Service.CreateExample(c, req)
	if err != nil {
		// switch {
		// case errors.Is(err, appErrors.ErrServerError):
		// 	helpers.ServerErrorResponse(c, err)
		// default:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		// }
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Example Created"})

}

// // Revoke Invitation godoc
// // @Summary Revoke user invitation
// // @Description Revoke an invitation email
// // @Tags invitations
// // @Security     BearerAuth
// // @Produce json
// // @Param request body dto.EmailRequest true "Email details"
// // @Success 200 {object} map[string]string
// // @Failure 400 {object} map[string]string
// // @Failure 500 {object} map[string]string
// // @Router /api/v1/admin/invitations [put]
// Revoke Example godoc
// @Summary Revoke user example
// @Description Revoke an example email
// @Tags example
// @Security     BearerAuth
// @Produce json
// @Param request body dto.EmailRequest true "Email details"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/example [put]
func (h *ExampleHandler) RevokeExample(c *gin.Context) {
	var req dto.EmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// err := h.Service.RevokeExample(c, req)
	// if err != nil {
	// 	// switch {
	// 	// case errors.Is(err, appErrors.ErrServerError):
	// 	// 	helpers.ServerErrorResponse(c, err)
	// 	// default:
	// c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	// 	// }
	// 	return
	// }
	c.JSON(http.StatusCreated, gin.H{"message": "Example Revoked"})
}

// Accept Example godoc
// @Summary Accept user example
// @Description Accept an example email
// @Tags example
// @Security     BearerAuth
// @Produce json
// @Param token query string true "Example Token"
// @Param request body dto.RegisterRequest true "Email details"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/example/accept/{id} [post]
func (h *ExampleHandler) AcceptExample(c *gin.Context) {

	//no it's query, test later
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token shouldn't be empty"})
	}

	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Token = token

	// err := h.Service.AcceptExample(c, req)
	// if err != nil {
	// 	// switch {
	// 	// case errors.Is(err, appErrors.ErrServerError):
	// 	// 	helpers.ServerErrorResponse(c, err)
	// 	// default:
	// c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	// 	// }
	// 	return
	// }
	c.JSON(http.StatusCreated, gin.H{"message": "Example Accepted, login to continue"})

}

// Resend Example godoc
// @Summary Resend user example
// @Description Resend an example email
// @Tags example
// @Security     BearerAuth
// @Accept json
// @Produce json
// @Param request body dto.EmailRequest true "Example details"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/example/resend [post]
func (h *ExampleHandler) ResendExample(c *gin.Context) {

	var req dto.EmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// err := h.Service.ResendExample(c, req)
	// if err != nil {
	// 	// switch {
	// 	// case errors.Is(err, appErrors.ErrServerError):
	// 	// 	helpers.ServerErrorResponse(c, err)
	// 	// default:
	// c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	// 	// }
	// 	return
	// }
	c.JSON(http.StatusOK, gin.H{"message": "Example Sent"})

}
