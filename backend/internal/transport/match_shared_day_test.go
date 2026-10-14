package transport

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// fakeMatchService answers only what the shared-day check touches. Anything else
// would hit the embedded nil interface and panic, which is the point: these tests
// should not be reaching beyond it.
type fakeMatchService struct {
	services.IMatchService
	conflicts []dto.SharedDayMatch
	existing  *domain.Match

	created   int
	updated   int
	checkedOn string
	checkedBy string // competition id the check was made for
	excluded  string
}

func (f *fakeMatchService) OtherTournamentMatches(_ context.Context, date time.Time, competitionID, excludeMatchID string) ([]dto.SharedDayMatch, error) {
	f.checkedOn = date.Format("2006-01-02")
	f.checkedBy = competitionID
	f.excluded = excludeMatchID
	return f.conflicts, nil
}
func (f *fakeMatchService) CreateMatch(_ context.Context, m *domain.Match) error {
	f.created++
	m.ID = "new-match"
	return nil
}
func (f *fakeMatchService) UpdateMatch(context.Context, *domain.Match) error {
	f.updated++
	return nil
}
func (f *fakeMatchService) GetMatchByID(context.Context, string) (*domain.Match, error) {
	return f.existing, nil
}

func matchRouter(svc services.IMatchService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewMatchHandler(svc)
	r.POST("/matches", h.CreateMatch)
	r.PUT("/matches/:id", h.UpdateMatch)
	return r
}

func sendJSON(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

var cupMatch = dto.SharedDayMatch{
	MatchID: "m-cup", CompetitionID: "comp-cup", CompetitionName: "Showtime Cup",
	HomeTeam: "Rebels", AwayTeam: "Knights", StartTime: "15:00", Venue: "Showtime Arena", Status: "SCHEDULED",
}

const createBody = `{"competition_id":"comp-season","home_team_id":"a","away_team_id":"b","date":"2026-11-14","start_time":"12:00"}`

func TestCreateMatchOnADayAnotherTournamentPlaysAsksFirst(t *testing.T) {
	svc := &fakeMatchService{conflicts: []dto.SharedDayMatch{cupMatch}}
	w := sendJSON(matchRouter(svc), http.MethodPost, "/matches", createBody)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
	if svc.created != 0 {
		t.Fatal("the match must not be created until it is confirmed")
	}
	var body struct {
		Code      string               `json:"code"`
		Conflicts []dto.SharedDayMatch `json:"conflicts"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != dto.SharedDayCode || len(body.Conflicts) != 1 || body.Conflicts[0].CompetitionName != "Showtime Cup" {
		t.Fatalf("the response should name the other tournament's match, got %s", w.Body.String())
	}
	if svc.checkedOn != "2026-11-14" || svc.checkedBy != "comp-season" || svc.excluded != "" {
		t.Fatalf("checked the wrong thing: on=%q by=%q excluded=%q", svc.checkedOn, svc.checkedBy, svc.excluded)
	}
}

func TestCreateMatchGoesAheadOnceConfirmed(t *testing.T) {
	svc := &fakeMatchService{conflicts: []dto.SharedDayMatch{cupMatch}}
	body := strings.Replace(createBody, `"start_time"`, `"confirm_shared_day":true,"start_time"`, 1)
	w := sendJSON(matchRouter(svc), http.MethodPost, "/matches", body)

	if w.Code != http.StatusCreated || svc.created != 1 {
		t.Fatalf("a confirmed match should be created, got %d created=%d: %s", w.Code, svc.created, w.Body.String())
	}
}

func TestCreateMatchOnAFreeDayIsNotHeldUp(t *testing.T) {
	svc := &fakeMatchService{}
	w := sendJSON(matchRouter(svc), http.MethodPost, "/matches", createBody)

	if w.Code != http.StatusCreated || svc.created != 1 {
		t.Fatalf("no clash means no question, got %d created=%d", w.Code, svc.created)
	}
}

func TestRescheduleOntoAnotherTournamentsDayAsksFirst(t *testing.T) {
	svc := &fakeMatchService{
		conflicts: []dto.SharedDayMatch{cupMatch},
		existing:  &domain.Match{ID: "m1", CompetitionID: "comp-season", Date: time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)},
	}
	w := sendJSON(matchRouter(svc), http.MethodPut, "/matches/m1", `{"date":"2026-11-14"}`)

	if w.Code != http.StatusConflict || svc.updated != 0 {
		t.Fatalf("moving onto a shared day should ask first, got %d updated=%d", w.Code, svc.updated)
	}
	if svc.excluded != "m1" || svc.checkedBy != "comp-season" {
		t.Fatalf("the match being moved must be left out of its own check: excluded=%q by=%q", svc.excluded, svc.checkedBy)
	}
}

func TestSavingAScoreNeverTriggersTheQuestion(t *testing.T) {
	// Same date, same tournament: nothing moved, so a shared day (which has been
	// accepted before) must not hold up saving a result.
	svc := &fakeMatchService{
		conflicts: []dto.SharedDayMatch{cupMatch},
		existing:  &domain.Match{ID: "m1", CompetitionID: "comp-season", Date: time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)},
	}
	w := sendJSON(matchRouter(svc), http.MethodPut, "/matches/m1", `{"date":"2026-11-14","competition_id":"comp-season","home_score":3,"away_score":1}`)

	if w.Code != http.StatusOK || svc.updated != 1 {
		t.Fatalf("a score save should go straight through, got %d updated=%d: %s", w.Code, svc.updated, w.Body.String())
	}
}

func TestRescheduleConfirmedGoesAhead(t *testing.T) {
	svc := &fakeMatchService{
		conflicts: []dto.SharedDayMatch{cupMatch},
		existing:  &domain.Match{ID: "m1", CompetitionID: "comp-season", Date: time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)},
	}
	w := sendJSON(matchRouter(svc), http.MethodPut, "/matches/m1", `{"date":"2026-11-14","confirm_shared_day":true}`)

	if w.Code != http.StatusOK || svc.updated != 1 {
		t.Fatalf("a confirmed move should go through, got %d updated=%d", w.Code, svc.updated)
	}
}
