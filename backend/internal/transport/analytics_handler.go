package transport

import (
	"pkg-common/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IAnalyticsHandler interface {
	GetAnalytics(c *gin.Context)
}

type AnalyticsHandler struct {
	service services.IAnalyticsService
}

func NewAnalyticsHandler(service services.IAnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{service: service}
}

// GetAnalytics handles fetching admin dashboard metrics
// @Summary      Get admin dashboard metrics
// @Description  Aggregates total revenue, ticket sales, user count, and recent sales
// @Tags         Analytics
// @Produce      json
// @Success      200  {object}  dto.AdminAnalyticsResponse
// @Router       /admin/analytics [get]
func (h *AnalyticsHandler) GetAnalytics(c *gin.Context) {
	resp, err := h.service.GetAdminDashboardMetrics(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	helpers.SuccessOK(c, "Analytics retrieved successfully", resp)
}
