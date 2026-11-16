package services

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
)

func validJoin() dto.JoinRequest {
	return dto.JoinRequest{
		Name:      "  Ada   Obi ",
		Email:     "Ada@Example.com",
		Phone:     "0803 123 4567",
		Interests: []string{"play", "watch"},
		Source:    "Instagram",
		Consent:   true,
	}
}

func TestCleanJoinRequest_NormalisesAGoodForm(t *testing.T) {
	lead, err := cleanJoinRequest(validJoin())
	if err != nil {
		t.Fatal(err)
	}
	if lead.Name != "Ada Obi" || lead.Email != "ada@example.com" || lead.Phone != "08031234567" {
		t.Fatalf("not tidied: %+v", lead)
	}
	if lead.Source != "instagram" {
		t.Fatalf("source = %q", lead.Source)
	}
	// Interests come back in the form's order, whatever order they were sent in.
	if strings.Join(lead.Interests, ",") != "watch,play" {
		t.Fatalf("interests = %v", lead.Interests)
	}
}

func TestCleanJoinRequest_RejectsBadForms(t *testing.T) {
	cases := map[string]func(*dto.JoinRequest){
		"no name":          func(r *dto.JoinRequest) { r.Name = " " },
		"bad email":        func(r *dto.JoinRequest) { r.Email = "ada@" },
		"email with name":  func(r *dto.JoinRequest) { r.Email = "Ada <ada@example.com>" },
		"short phone":      func(r *dto.JoinRequest) { r.Phone = "0803" },
		"no interests":     func(r *dto.JoinRequest) { r.Interests = nil },
		"unknown interest": func(r *dto.JoinRequest) { r.Interests = []string{"free-money"} },
		"no consent":       func(r *dto.JoinRequest) { r.Consent = false },
	}
	for name, mutate := range cases {
		req := validJoin()
		mutate(&req)
		_, err := cleanJoinRequest(req)
		var invalid appErrors.LeadValidationError
		if err == nil || !asLeadValidation(err, &invalid) {
			t.Errorf("%s: want a validation error, got %v", name, err)
		}
	}
}

func asLeadValidation(err error, target *appErrors.LeadValidationError) bool {
	v, ok := err.(appErrors.LeadValidationError)
	if ok {
		*target = v
	}
	return ok
}

func TestCleanJoinRequest_UnsafeSourceFallsBackToDirect(t *testing.T) {
	for _, src := range []string{"", "<script>", "has space", strings.Repeat("a", 41)} {
		req := validJoin()
		req.Source = src
		lead, err := cleanJoinRequest(req)
		if err != nil || lead.Source != "direct" {
			t.Errorf("source %q -> %q, %v", src, lead.Source, err)
		}
	}
}

type fakeLeadRepo struct {
	saved []domain.Lead
	all   []domain.Lead
}

func (f *fakeLeadRepo) Upsert(_ context.Context, l *domain.Lead) (bool, error) {
	f.saved = append(f.saved, *l)
	return true, nil
}
func (f *fakeLeadRepo) List(context.Context, domain.LeadFilter, int, int) ([]domain.Lead, int, error) {
	return nil, 0, nil
}
func (f *fakeLeadRepo) All(context.Context, domain.LeadFilter) ([]domain.Lead, error) {
	return f.all, nil
}
func (f *fakeLeadRepo) SourceStats(context.Context) ([]domain.LeadSourceStat, error) {
	return nil, nil
}

func TestJoin_BotFillingTheHiddenFieldIsIgnoredQuietly(t *testing.T) {
	repo := &fakeLeadRepo{}
	svc := NewLeadService(repo)
	req := validJoin()
	req.Website = "http://spam.example"
	if err := svc.Join(context.Background(), req); err != nil {
		t.Fatalf("a bot should be told it worked, got %v", err)
	}
	if len(repo.saved) != 0 {
		t.Fatal("nothing from a bot should be saved")
	}
	if err := svc.Join(context.Background(), validJoin()); err != nil || len(repo.saved) != 1 {
		t.Fatalf("a real visitor is saved: %v, %d", err, len(repo.saved))
	}
}

func TestExportCSV_StopsFormulasRunningInASpreadsheet(t *testing.T) {
	repo := &fakeLeadRepo{all: []domain.Lead{{
		Name: "=HYPERLINK(\"http://evil\")", Email: "a@b.co", Phone: "08031234567",
		Interests: []string{"play"}, Source: "whatsapp",
		CreatedAt: time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC), Converted: true,
	}}}
	var buf bytes.Buffer
	if err := NewLeadService(repo).ExportCSV(context.Background(), domain.LeadFilter{}, &buf); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if strings.Contains(out, "\n=HYPERLINK") || !strings.Contains(out, "'=HYPERLINK") {
		t.Fatalf("formula not neutralised:\n%s", out)
	}
	if !strings.Contains(out, "Play flag football") || !strings.Contains(out, "2026-11-01 11:00") || !strings.Contains(out, "Yes") {
		t.Fatalf("export missing fields:\n%s", out)
	}
}
