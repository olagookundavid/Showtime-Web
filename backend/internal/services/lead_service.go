package services

import (
	"context"
	"encoding/csv"
	"io"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
)

type ILeadService interface {
	Join(ctx context.Context, req dto.JoinRequest) error
	List(ctx context.Context, filter domain.LeadFilter, page, limit int) ([]dto.LeadResponse, int, error)
	Summary(ctx context.Context) (*dto.LeadSummary, error)
	ExportCSV(ctx context.Context, filter domain.LeadFilter, w io.Writer) error
}

type LeadService struct {
	repo ports.LeadRepository
	// contacts is optional: when set, every new lead is added to the marketing list.
	contacts ports.ContactSyncer
}

func NewLeadService(repo ports.LeadRepository) *LeadService {
	return &LeadService{repo: repo}
}

// WithContactSyncer wires in the marketing list that new leads are added to.
func (s *LeadService) WithContactSyncer(syncer ports.ContactSyncer) *LeadService {
	s.contacts = syncer
	return s
}

var (
	leadSourcePattern = regexp.MustCompile(`^[a-z0-9_-]{1,40}$`)
	nonPhoneChars     = regexp.MustCompile(`[^0-9+]`)
)

const defaultLeadSource = "direct"

// Join saves someone who filled in the public form. A bot that fills the hidden
// field is told it worked and nothing is saved; so is anyone already on the list,
// whose details are refreshed.
func (s *LeadService) Join(ctx context.Context, req dto.JoinRequest) error {
	lead, err := cleanJoinRequest(req)
	if err != nil {
		return err
	}
	if strings.TrimSpace(req.Website) != "" {
		return nil
	}
	inserted, err := s.repo.Upsert(ctx, lead)
	if err != nil {
		return err
	}
	if inserted {
		first, last := splitFullName(lead.Name)
		addMarketingContact(s.contacts, lead.Email, first, last)
	}
	return nil
}

// cleanJoinRequest checks the form and returns the lead to save.
func cleanJoinRequest(req dto.JoinRequest) (*domain.Lead, error) {
	name := strings.Join(strings.Fields(req.Name), " ")
	if len(name) < 2 || len(name) > 120 {
		return nil, appErrors.LeadValidationError("Please enter your full name.")
	}

	addr, err := mail.ParseAddress(strings.TrimSpace(req.Email))
	if err != nil || addr.Address != strings.TrimSpace(req.Email) || len(addr.Address) > 254 {
		return nil, appErrors.LeadValidationError("Please enter a valid email address.")
	}

	phone := nonPhoneChars.ReplaceAllString(req.Phone, "")
	digits := strings.TrimPrefix(phone, "+")
	if len(digits) < 10 || len(digits) > 15 || strings.Contains(digits, "+") {
		return nil, appErrors.LeadValidationError("Please enter a valid phone number.")
	}

	interests := []string{}
	for _, want := range domain.LeadInterests {
		for _, got := range req.Interests {
			if got == want {
				interests = append(interests, want)
				break
			}
		}
	}
	if len(interests) == 0 {
		return nil, appErrors.LeadValidationError("Please pick at least one thing you are interested in.")
	}

	if !req.Consent {
		return nil, appErrors.LeadValidationError("Please tick the box to agree to hear from us.")
	}

	source := strings.ToLower(strings.TrimSpace(req.Source))
	if !leadSourcePattern.MatchString(source) {
		source = defaultLeadSource
	}

	return &domain.Lead{
		Name:      name,
		Email:     strings.ToLower(addr.Address),
		Phone:     phone,
		Interests: interests,
		Source:    source,
	}, nil
}

func leadToResponse(l domain.Lead) dto.LeadResponse {
	return dto.LeadResponse{
		ID:           l.ID,
		Name:         l.Name,
		Email:        l.Email,
		Phone:        l.Phone,
		Interests:    l.Interests,
		Source:       l.Source,
		CreatedAt:    l.CreatedAt.UTC().Format(time.RFC3339),
		BoughtTicket: l.Converted,
	}
}

func (s *LeadService) List(ctx context.Context, filter domain.LeadFilter, page, limit int) ([]dto.LeadResponse, int, error) {
	leads, total, err := s.repo.List(ctx, filter, page, limit)
	if err != nil {
		return nil, 0, err
	}
	out := make([]dto.LeadResponse, len(leads))
	for i, l := range leads {
		out[i] = leadToResponse(l)
	}
	return out, total, nil
}

func (s *LeadService) Summary(ctx context.Context) (*dto.LeadSummary, error) {
	stats, err := s.repo.SourceStats(ctx)
	if err != nil {
		return nil, err
	}
	sum := &dto.LeadSummary{Sources: make([]dto.LeadSourceStat, len(stats))}
	for i, st := range stats {
		sum.Sources[i] = dto.LeadSourceStat{Source: st.Source, Leads: st.Leads, Converted: st.Converted}
		sum.Total += st.Leads
		sum.Converted += st.Converted
	}
	return sum, nil
}

// ExportCSV writes every lead matching the filter, ready to open in a spreadsheet.
func (s *LeadService) ExportCSV(ctx context.Context, filter domain.LeadFilter, w io.Writer) error {
	leads, err := s.repo.All(ctx, filter)
	if err != nil {
		return err
	}
	lagos := lagos()
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"Name", "Email", "Phone", "Interested in", "Source", "Joined (Lagos)", "Bought a ticket"})
	for _, l := range leads {
		bought := "No"
		if l.Converted {
			bought = "Yes"
		}
		_ = cw.Write([]string{
			csvSafe(l.Name), csvSafe(l.Email), csvSafe(l.Phone),
			strings.Join(interestLabels(l.Interests), ", "), csvSafe(l.Source),
			l.CreatedAt.In(lagos).Format("2006-01-02 15:04"), bought,
		})
	}
	cw.Flush()
	return cw.Error()
}

// csvSafe stops a spreadsheet running a typed value as a formula, since leads
// come from a public form.
func csvSafe(v string) string {
	if v != "" && strings.ContainsRune("=+-@\t\r", rune(v[0])) {
		return "'" + v
	}
	return v
}

func interestLabels(keys []string) []string {
	labels := map[string]string{
		domain.LeadInterestWatch:   "Watch games",
		domain.LeadInterestCoaches: "Meet the coaches",
		domain.LeadInterestPlay:    "Play flag football",
	}
	out := make([]string, 0, len(keys))
	for _, k := range keys {
		if l, ok := labels[k]; ok {
			out = append(out, l)
		}
	}
	return out
}
