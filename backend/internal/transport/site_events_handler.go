package transport

import (
	"bytes"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ISiteEventsHandler interface {
	Track(c *gin.Context)
	TrackOnSuccess(eventType string) gin.HandlerFunc
	GetSummary(c *gin.Context)
	ListEvents(c *gin.Context)
	Export(c *gin.Context)
}

type SiteEventsHandler struct {
	service services.ISiteEventsService
}

func NewSiteEventsHandler(service services.ISiteEventsService) *SiteEventsHandler {
	return &SiteEventsHandler{service: service}
}

// requestMeta reads the visitor off the request. In production the API sits
// behind Cloudflare, which always overwrites CF-Connecting-IP with the real
// visitor and adds CF-IPCountry; elsewhere those headers are absent and the
// socket address applies.
func requestMeta(c *gin.Context) services.RequestMeta {
	ip := c.ClientIP()
	if cf := net.ParseIP(c.GetHeader("CF-Connecting-IP")); cf != nil {
		ip = cf.String()
	}
	return services.RequestMeta{
		IP:        ip,
		Country:   c.GetHeader("CF-IPCountry"),
		UserAgent: c.Request.UserAgent(),
	}
}

// Track receives a browser beacon.
// @Summary      Record a site analytics event
// @Description  Public, rate-limited. Accepts only allowlisted browser event types.
// @Tags         SiteAnalytics
// @Accept       json
// @Param        request body dto.TrackEventRequest true "Event"
// @Success      202
// @Router       /events [post]
func (h *SiteEventsHandler) Track(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8<<10)

	var req dto.TrackEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, "invalid event payload")
		return
	}
	if err := h.service.Track(req, requestMeta(c)); err != nil {
		if errors.Is(err, services.ErrInvalidSiteEvent) {
			helpers.BadResponse(c, err.Error())
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.Status(http.StatusAccepted)
}

// TrackOnSuccess records a server-side event after the wrapped handler answers
// 2xx, so failed logins or rejected checkouts are never counted.
func (h *SiteEventsHandler) TrackOnSuccess(eventType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if status := c.Writer.Status(); status >= 200 && status < 300 {
			h.service.RecordServerEvent(eventType, c.FullPath(), requestMeta(c))
		}
	}
}

// wantsComparison: "All time" (no start date) has no earlier period to compare with.
func wantsComparison(c *gin.Context) bool { return c.Query("from") != "" }

// parseReport reads the inclusive from/to dates and the day filter
// (days=all|match|other, default all) shared by every admin analytics route.
func parseReport(c *gin.Context) (time.Time, time.Time, string, bool) {
	from, to, err := services.ResolveRange(c.Query("from"), c.Query("to"), time.Now())
	if err != nil {
		helpers.BadResponse(c, err.Error())
		return from, to, "", false
	}
	days := c.DefaultQuery("days", dto.SiteDaysAll)
	if !services.ValidDayFilter(days) {
		helpers.BadResponse(c, "days must be all, match or other")
		return from, to, "", false
	}
	return from, to, days, true
}

// GetSummary godoc
// @Summary      Site traffic summary
// @Tags         SiteAnalytics
// @Produce      json
// @Param        from query string false "YYYY-MM-DD (inclusive)"
// @Param        to   query string false "YYYY-MM-DD (inclusive)"
// @Param        days query string false "all (default), match (match days only) or other (every day except match days)"
// @Success      200  {object}  dto.SiteTrafficSummary
// @Router       /admin/site-analytics/summary [get]
func (h *SiteEventsHandler) GetSummary(c *gin.Context) {
	from, to, days, ok := parseReport(c)
	if !ok {
		return
	}
	sum, err := h.service.Summary(c.Request.Context(), from, to, days, wantsComparison(c))
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Site traffic retrieved successfully", sum)
}

func (h *SiteEventsHandler) eventFilter(c *gin.Context, from, to time.Time, days string) (ports.SiteEventFilter, error) {
	scope, err := h.service.Scope(c.Request.Context(), from, to, days)
	return ports.SiteEventFilter{
		SiteScope:   scope,
		EventType:   c.Query("type"),
		IncludeBots: c.Query("include_bots") == "true",
	}, err
}

// ListEvents godoc
// @Summary      Raw site events
// @Tags         SiteAnalytics
// @Produce      json
// @Success      200  {object}  dto.SiteEventsPage
// @Router       /admin/site-analytics/events [get]
func (h *SiteEventsHandler) ListEvents(c *gin.Context) {
	from, to, days, ok := parseReport(c)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	filter, err := h.eventFilter(c, from, to, days)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	res, err := h.service.ListEvents(c.Request.Context(), filter, page, limit)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Events retrieved successfully", res)
}

// Export godoc
// @Summary      Download site analytics as CSV
// @Description  kind=summary (default) is a readable report; kind=events is every raw row in the range.
// @Tags         SiteAnalytics
// @Produce      text/csv
// @Router       /admin/site-analytics/export [get]
func (h *SiteEventsHandler) Export(c *gin.Context) {
	from, to, days, ok := parseReport(c)
	if !ok {
		return
	}
	kind := c.DefaultQuery("kind", "summary")
	last := to.AddDate(0, 0, -1).Format("2006-01-02")
	label := kind
	if days != dto.SiteDaysAll {
		label += "-" + days + "-days"
	}
	filename := fmt.Sprintf("showtime-traffic-%s_%s_to_%s.csv", label, from.Format("2006-01-02"), last)

	switch kind {
	case "summary":
		// Small and computed up front, so a failure can still return a proper
		// error instead of a half-written download.
		var buf bytes.Buffer
		if err := h.service.ExportSummaryCSV(c.Request.Context(), from, to, days, wantsComparison(c), &buf); err != nil {
			helpers.ServerErrorResponse(c, err)
			return
		}
		c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
		c.Data(http.StatusOK, "text/csv; charset=utf-8", buf.Bytes())
	case "events":
		filter, err := h.eventFilter(c, from, to, days)
		if err != nil {
			helpers.ServerErrorResponse(c, err)
			return
		}
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
		c.Status(http.StatusOK)
		if err := h.service.ExportEventsCSV(c.Request.Context(), filter, c.Writer); err != nil {
			// Headers are already out; the best we can do is log and cut the stream.
			_ = c.Error(err)
		}
	default:
		helpers.BadResponse(c, "kind must be summary or events")
	}
}
