package transport

import (
	"pkg-common/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IAnalyticsHandler interface {
	GetAnalytics(c *gin.Context)
	GetRepeatCustomers(c *gin.Context)
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

// GetRepeatCustomers handles the weekly repeat-customer report
// @Summary      Repeat customers by match day
// @Description  Every match day's buyers and returning share, plus the returning buyers for one match day
// @Tags         Analytics
// @Produce      json
// @Param        event_day_id  query  string  false  "Match day to list returning buyers for"
// @Success      200  {object}  dto.RepeatCustomerReport
// @Router       /admin/analytics/repeat-customers [get]
func (h *AnalyticsHandler) GetRepeatCustomers(c *gin.Context) {
	resp, err := h.service.GetRepeatCustomerReport(c.Request.Context(), c.Query("event_day_id"))
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	helpers.SuccessOK(c, "Repeat customers retrieved successfully", resp)
}
