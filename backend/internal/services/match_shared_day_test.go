package services

import (
	"context"
	"testing"
	"time"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type sharedDayRepo struct {
	ports.MatchRepository
	calls   int
	gotDate string
	gotComp string
	gotSkip string
	result  []dto.SharedDayMatch
}

func (r *sharedDayRepo) FindMatchesInOtherCompetitions(_ context.Context, date, competitionID, excludeMatchID string) ([]dto.SharedDayMatch, error) {
	r.calls++
	r.gotDate, r.gotComp, r.gotSkip = date, competitionID, excludeMatchID
	return r.result, nil
}

func TestOtherTournamentMatchesChecksUpcomingDays(t *testing.T) {
	repo := &sharedDayRepo{result: []dto.SharedDayMatch{{CompetitionName: "Showtime Cup"}}}
	svc := &MatchService{repo: repo}

	// A date a week out, as the time of day on it must not matter.
	next := time.Now().AddDate(0, 0, 7)
	date := time.Date(next.Year(), next.Month(), next.Day(), 18, 30, 0, 0, time.UTC)

	got, err := svc.OtherTournamentMatches(context.Background(), date, "comp-season", "m1")
	if err != nil || len(got) != 1 {
		t.Fatalf("expected the cup match back, got %v err=%v", got, err)
	}
	if repo.gotDate != date.Format("2006-01-02") || repo.gotComp != "comp-season" || repo.gotSkip != "m1" {
		t.Fatalf("asked the repository for %q %q %q", repo.gotDate, repo.gotComp, repo.gotSkip)
	}
}

func TestOtherTournamentMatchesIgnoresDatesThatHavePassed(t *testing.T) {
	repo := &sharedDayRepo{result: []dto.SharedDayMatch{{CompetitionName: "Showtime Cup"}}}
	svc := &MatchService{repo: repo}

	got, err := svc.OtherTournamentMatches(context.Background(), time.Now().AddDate(0, 0, -3), "comp-season", "")
	if err != nil || len(got) != 0 {
		t.Fatalf("a past date is routine result entry and must not be flagged, got %v err=%v", got, err)
	}
	if repo.calls != 0 {
		t.Fatal("a past date should not even query")
	}
}

func TestOtherTournamentMatchesNeedsADateAndATournament(t *testing.T) {
	repo := &sharedDayRepo{}
	svc := &MatchService{repo: repo}
	if got, _ := svc.OtherTournamentMatches(context.Background(), time.Time{}, "comp", ""); len(got) != 0 || repo.calls != 0 {
		t.Fatal("no date means nothing to check")
	}
	if got, _ := svc.OtherTournamentMatches(context.Background(), time.Now().AddDate(0, 0, 2), "", ""); len(got) != 0 || repo.calls != 0 {
		t.Fatal("no tournament means nothing to compare against")
	}
}
