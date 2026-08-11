package transport

import (
	"net/http"
	"strconv"

	"pkg-common/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type INotificationHandler interface {
	GetUserNotifications(c *gin.Context)
	MarkAsRead(c *gin.Context)
	MarkAllAsRead(c *gin.Context)
	GetUnreadCount(c *gin.Context)
}

type NotificationHandler struct {
	service services.INotificationService
}

func NewNotificationHandler(service services.INotificationService) INotificationHandler {
	return &NotificationHandler{service: service}
}

func (h *NotificationHandler) GetUserNotifications(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	unreadOnly, _ := strconv.ParseBool(c.DefaultQuery("unread_only", "false"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	res, err := h.service.GetUserNotifications(c.Request.Context(), payload.UserId, unreadOnly, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	id := c.Param("id")
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.MarkAsRead(c.Request.Context(), id, payload.UserId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.MarkAllAsRead(c.Request.Context(), payload.UserId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	count, err := h.service.GetUnreadCount(c.Request.Context(), payload.UserId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"unread_count": count})
}
