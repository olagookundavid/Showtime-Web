package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type IAuditHandler interface {
	ListAuditLogs(c *gin.Context)
}

type AuditHandler struct {
	service services.IAuditService
}

func NewAuditHandler(service services.IAuditService) IAuditHandler {
	return &AuditHandler{service: service}
}

// parseAuditTime reads a date (2026-11-08) or a full timestamp. A bare date as the upper
// bound means "through the end of that day", so the caller can pass the same date twice.
func parseAuditTime(raw string, endOfDay bool) (*time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t, true
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		if endOfDay {
			t = t.AddDate(0, 0, 1)
		}
		return &t, true
	}
	return nil, false
}

// ListAuditLogs godoc
// @Summary      The audit trail: who did what, and what the system did on its own
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        search         query  string false "Matches path, details, actor name or email"
// @Param        user_id        query  string false "Only this user's actions"
// @Param        action         query  string false "HTTP verb or system action name"
// @Param        source         query  string false "'system' for platform-raised events only"
// @Param        from           query  string false "Start (date or RFC3339)"
// @Param        to             query  string false "End (date, inclusive, or RFC3339)"
// @Param        include_noise  query  bool   false "Include health checks and anonymous logins"
// @Param        page           query  int    false "Page"
// @Param        limit          query  int    false "Page size (max 200)"
// @Router       /api/v1/admin/audit-logs [get]
func (h *AuditHandler) ListAuditLogs(c *gin.Context) {
	from, okFrom := parseAuditTime(c.Query("from"), false)
	to, okTo := parseAuditTime(c.Query("to"), true)
	if !okFrom || !okTo {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from and to must be a date (2026-11-08) or an RFC3339 timestamp"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	res, err := h.service.ListLogs(c.Request.Context(), ports.AuditLogFilter{
		Search:       c.Query("search"),
		UserID:       c.Query("user_id"),
		Action:       c.Query("action"),
		SystemOnly:   c.Query("source") == "system",
		From:         from,
		To:           to,
		IncludeNoise: c.Query("include_noise") == "true",
		Page:         page,
		Limit:        limit,
	})
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}
