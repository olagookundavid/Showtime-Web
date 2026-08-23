package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ICommentHandler interface {
	GetComments(c *gin.Context)
	CreateComment(c *gin.Context)
	DeleteComment(c *gin.Context)
	ToggleLike(c *gin.Context)
	UpdateNewsCommentSettings(c *gin.Context)
}

type CommentHandler struct {
	service  services.ICommentService
	authRepo ports.IAuthRepository
}

func NewCommentHandler(service services.ICommentService, authRepo ports.IAuthRepository) ICommentHandler {
	return &CommentHandler{service: service, authRepo: authRepo}
}

func (h *CommentHandler) GetComments(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")

	// Unparseable values fall through as 0 and the service clamps them to the
	// defaults, so a junk ?page= still renders the thread.
	page, _ := strconv.Atoi(c.Query("page"))
	limit, _ := strconv.Atoi(c.Query("limit"))

	var callerUserID string
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		callerUserID = payload.UserId
	}

	result, err := h.service.GetCommentsByEntity(c.Request.Context(), entityType, entityID, callerUserID, page, limit)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *CommentHandler) CreateComment(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: you must be logged in to post a comment"})
		return
	}

	var req dto.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	comment, err := h.service.CreateComment(c.Request.Context(), payload.UserId, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": comment})
}

func (h *CommentHandler) DeleteComment(c *gin.Context) {
	commentID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Check if user is admin
	isAdmin := false
	userProfile, err := h.authRepo.GetUserByID(c.Request.Context(), payload.UserId)
	if err == nil && userProfile != nil && (userProfile.Role == "admin" || userProfile.Role == "app_admin") {
		isAdmin = true
	}

	if err := h.service.DeleteComment(c.Request.Context(), commentID, payload.UserId, isAdmin); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully"})
}

func (h *CommentHandler) ToggleLike(c *gin.Context) {
	commentID := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: you must be logged in to like a comment"})
		return
	}

	liked, newCount, err := h.service.ToggleLike(c.Request.Context(), commentID, payload.UserId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"liked":       liked,
		"likes_count": newCount,
	})
}

func (h *CommentHandler) UpdateNewsCommentSettings(c *gin.Context) {
	newsID := c.Param("id")

	var req dto.UpdateNewsCommentSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateNewsCommentSettings(c.Request.Context(), newsID, req.CommentsEnabled); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment settings updated successfully"})
}
