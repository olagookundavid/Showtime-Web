package transport

import (
	"bytes"
	"errors"
	"net/http"
	"strings"
	"time"

	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type LeadHandler struct {
	service services.ILeadService
}

func NewLeadHandler(service services.ILeadService) *LeadHandler {
	return &LeadHandler{service: service}
}

// Join saves someone from the public join page.
// @Summary      Join the interest list
// @Description  Public. Saves a prospective fan or player who wants to hear about game days.
// @Tags         Leads
// @Accept       json
// @Param        request  body  dto.JoinRequest  true  "Join form"
// @Success      201
// @Router       /leads [post]
func (h *LeadHandler) Join(c *gin.Context) {
	var req dto.JoinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, "Something was wrong with the form. Please check it and try again.")
		return
	}
	if err := h.service.Join(c.Request.Context(), req); err != nil {
		var invalid appErrors.LeadValidationError
		if errors.As(err, &invalid) {
			helpers.BadResponse(c, invalid.Error())
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessCreated(c, "Thanks, you're on the list.", nil)
}

func leadFilter(c *gin.Context) domain.LeadFilter {
	f := domain.LeadFilter{
		Search:   c.Query("search"),
		Source:   strings.ToLower(strings.TrimSpace(c.Query("source"))),
		Interest: c.Query("interest"),
	}
	switch c.Query("bought") {
	case "yes":
		t := true
		f.Converted = &t
	case "no":
		t := false
		f.Converted = &t
	}
	return f
}

// List is the admin's view of every lead.
// @Router /admin/leads [get]
func (h *LeadHandler) List(c *gin.Context) {
	page, limit := pageParams(c, 20)
	leads, total, err := h.service.List(c.Request.Context(), leadFilter(c), page, limit)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	pagedJSON(c, leads, total, page, limit)
}

// Summary is the lead totals and what each channel brought.
// @Router /admin/leads/summary [get]
func (h *LeadHandler) Summary(c *gin.Context) {
	res, err := h.service.Summary(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	helpers.SuccessOK(c, "Lead summary retrieved successfully", res)
}

// Export downloads the leads matching the filter as a CSV.
// @Router /admin/leads/export [get]
func (h *LeadHandler) Export(c *gin.Context) {
	var buf bytes.Buffer
	if err := h.service.ExportCSV(c.Request.Context(), leadFilter(c), &buf); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	name := "showtime-leads-" + time.Now().Format("2006-01-02") + ".csv"
	c.Header("Content-Disposition", `attachment; filename="`+name+`"`)
	c.Data(http.StatusOK, "text/csv; charset=utf-8", buf.Bytes())
}
