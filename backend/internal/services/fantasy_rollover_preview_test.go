package services

import (
	"context"
	"testing"

	"showtime-backend/internal/domain"
)

func priorLineup() *domain.FantasyLineup {
	return &domain.FantasyLineup{
		Status: domain.LineupLocked,
		Points: 21.46,
		Picks: []domain.FantasyLineupPick{
			{PlayerID: "a", Points: 10},
			{PlayerID: "b", Points: 11.46},
		},
	}
}

// A gameweek still open for changes must not preview as locked or carry the
// previous gameweek's score.
func TestPreviewRolloverOpenGameweekIsADraftWithNothingScored(t *testing.T) {
	l := priorLineup()
	previewRollover(l, &domain.FantasyGameweek{Status: domain.GameweekScheduled})

	if l.Status != domain.LineupDraft {
		t.Errorf("status = %s, want DRAFT", l.Status)
	}
	if l.Points != 0 {
		t.Errorf("points = %v, want 0", l.Points)
	}
	for _, p := range l.Picks {
		if p.Points != 0 {
			t.Errorf("pick %s points = %v, want 0", p.PlayerID, p.Points)
		}
	}
}

// Once the deadline has passed the squad really is locked in, so it stays
// LOCKED — but it still has not scored anything for this gameweek.
func TestPreviewRolloverPastDeadlineStaysLockedButUnscored(t *testing.T) {
	l := priorLineup()
	previewRollover(l, &domain.FantasyGameweek{Status: domain.GameweekLocked})

	if l.Status != domain.LineupLocked {
		t.Errorf("status = %s, want LOCKED", l.Status)
	}
	if l.Points != 0 {
		t.Errorf("points = %v, want 0", l.Points)
	}
}

// rolloverFixture is a team with a locked, scored GW3 squad and no lineup of
// its own for GW4 — exactly the state behind a "LOCKED / Auto Rolled Over /
// 21.46 pts" header on a gameweek that has not kicked off.
func rolloverFixture(gw4Status domain.GameweekStatus) *fakeFantasyRepo {
	repo := newFakeRepo()
	repo.season = testSeason()

	gw3 := testGameweek()
	gw3.ID, gw3.Number, gw3.Status = "gw-3", 3, domain.GameweekFinalized
	gw4 := testGameweek()
	gw4.ID, gw4.Number, gw4.Status = "gw-4", 4, gw4Status
	repo.gameweeks["gw-3"] = gw3
	repo.gameweeks["gw-4"] = gw4

	repo.enteredTeam = &domain.FantasyTeam{ID: "team-1", UserID: "user-1", SeasonID: "season-1", Name: "Admin Team"}
	repo.priorLocked["team-1"] = &domain.FantasyLineup{
		ID: "lineup-gw3", TeamID: "team-1", GameweekID: "gw-3",
		Status: domain.LineupLocked, Points: 21.46, TotalSpent: 15,
		Picks: []domain.FantasyLineupPick{
			{PlayerID: "p-1", Slot: domain.SlotQBMale, PurchasePrice: 15, Points: 21.46},
		},
	}
	return repo
}

func ownsP1() *fakeSquadRepo {
	return &fakeSquadRepo{owned: []domain.LineupCandidate{
		{PlayerID: "p-1", Name: "QB", Price: 15, Position: "QB", Gender: "M", TeamID: "club-1"},
	}}
}

func TestGetMyLineupRolloverPreviewIsNotLockedOrScored(t *testing.T) {
	svc := NewFantasyService(rolloverFixture(domain.GameweekScheduled), &fakeLeagueRepo{}, nil, nil, ownsP1())

	res, err := svc.GetMyLineup(context.Background(), "user-1", "season-1", "gw-4")
	if err != nil {
		t.Fatalf("GetMyLineup: %v", err)
	}
	if res == nil || !res.IsRollover {
		t.Fatalf("expected a rollover preview, got %+v", res)
	}
	if res.Status != string(domain.LineupDraft) {
		t.Errorf("status = %s, want DRAFT for a gameweek that has not locked", res.Status)
	}
	if res.Points != 0 {
		t.Errorf("points = %v, want 0 (21.46 is last gameweek's score)", res.Points)
	}
	if len(res.Picks) != 1 || res.Picks[0].Points != 0 {
		t.Errorf("pick points must be 0 in the preview, got %+v", res.Picks)
	}
	if !res.Published {
		t.Error("a rollover preview must still count as published so it scores at lock")
	}
}

func TestGetTeamLineupRolloverPreviewIsNotScored(t *testing.T) {
	svc := NewFantasyService(rolloverFixture(domain.GameweekScheduled), &fakeLeagueRepo{}, nil, nil, ownsP1())

	res, err := svc.GetTeamLineup(context.Background(), "rival-user", "team-1", "gw-4")
	if err != nil {
		t.Fatalf("GetTeamLineup: %v", err)
	}
	if !res.IsRollover {
		t.Fatalf("expected a rollover preview")
	}
	if res.Points != 0 {
		t.Errorf("points = %v, want 0 (21.46 is last gameweek's score)", res.Points)
	}
	for _, p := range res.Picks {
		if p.Points != 0 {
			t.Errorf("pick %s points = %v, want 0", p.PlayerID, p.Points)
		}
	}
}
