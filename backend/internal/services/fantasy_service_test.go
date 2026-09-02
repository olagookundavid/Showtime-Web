package services

import (
	"context"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// ─── Fakes ────────────────────────────────────────────────────────────────────

// The repository interfaces are embedded rather than fully implemented, so a
// test only stubs the methods its path actually touches — anything else panics
// loudly instead of silently returning a zero value.

type fakeFantasyRepo struct {
	ports.IFantasyRepository

	season      *domain.FantasySeason
	liveSeason  *domain.FantasySeason
	enteredTeam *domain.FantasyTeam
	gameweeks   map[string]*domain.FantasyGameweek
	candidates  map[string]domain.LineupCandidate
	teams       []domain.FantasyTeam
	stats       []domain.PlayerStat

	// lineups is keyed "teamID|gameweekID"; priorLocked by teamID.
	lineups     map[string]*domain.FantasyLineup
	priorLocked map[string]*domain.FantasyLineup

	dueForLock []domain.FantasyGameweek

	// observed effects
	teamTotals   map[string]float64
	seasonStatus map[string]domain.FantasySeasonStatus
	gwStatus     map[string]domain.GameweekStatus
	clonedInto   []string
	lockedGWs    []string
	savedLineup  *domain.FantasyLineup
	savedPicks   []domain.FantasyLineupPick
	pickPoints   map[string]map[string]float64
	pointsLogLen int
}

func newFakeRepo() *fakeFantasyRepo {
	return &fakeFantasyRepo{
		gameweeks:    map[string]*domain.FantasyGameweek{},
		candidates:   map[string]domain.LineupCandidate{},
		lineups:      map[string]*domain.FantasyLineup{},
		priorLocked:  map[string]*domain.FantasyLineup{},
		teamTotals:   map[string]float64{},
		seasonStatus: map[string]domain.FantasySeasonStatus{},
		gwStatus:     map[string]domain.GameweekStatus{},
		pickPoints:   map[string]map[string]float64{},
	}
}

func lineupKey(teamID, gwID string) string { return teamID + "|" + gwID }

func (f *fakeFantasyRepo) GetSeasonByID(_ context.Context, _ string) (*domain.FantasySeason, error) {
	return f.season, nil
}

func (f *fakeFantasyRepo) GetActiveSeason(_ context.Context) (*domain.FantasySeason, error) {
	return f.liveSeason, nil
}

func (f *fakeFantasyRepo) UpdateSeasonStatus(_ context.Context, id string, st domain.FantasySeasonStatus) error {
	f.seasonStatus[id] = st
	return nil
}

func (f *fakeFantasyRepo) GetGameweekByID(_ context.Context, id string) (*domain.FantasyGameweek, error) {
	return f.gameweeks[id], nil
}

func (f *fakeFantasyRepo) GetLineupCandidates(_ context.Context, _, _ string, ids []string) (map[string]domain.LineupCandidate, error) {
	out := map[string]domain.LineupCandidate{}
	for _, id := range ids {
		if c, ok := f.candidates[id]; ok {
			out[id] = c
		}
	}
	return out, nil
}

func (f *fakeFantasyRepo) GetTeamByUserAndSeason(_ context.Context, _, _ string) (*domain.FantasyTeam, error) {
	return f.enteredTeam, nil
}

func (f *fakeFantasyRepo) GetTeamOverallRank(_ context.Context, _, _ string) (int, int, error) {
	return 1, 1, nil
}

func (f *fakeFantasyRepo) GetOrCreateTeam(_ context.Context, userID, seasonID, name string) (*domain.FantasyTeam, error) {
	return &domain.FantasyTeam{ID: "team-" + userID, UserID: userID, SeasonID: seasonID, Name: name}, nil
}

func (f *fakeFantasyRepo) SaveLineupDraft(_ context.Context, l *domain.FantasyLineup, picks []domain.FantasyLineupPick) error {
	l.ID = "lineup-1"
	f.savedLineup = l
	f.savedPicks = picks
	return nil
}

func (f *fakeFantasyRepo) GetGameweeksDueForLock(_ context.Context) ([]domain.FantasyGameweek, error) {
	return f.dueForLock, nil
}

func (f *fakeFantasyRepo) LockLineupsForGameweek(_ context.Context, gwID string) error {
	f.lockedGWs = append(f.lockedGWs, gwID)
	for _, l := range f.lineups {
		if l.GameweekID == gwID && l.Status == domain.LineupDraft {
			l.Status = domain.LineupLocked
		}
	}
	return nil
}

func (f *fakeFantasyRepo) ListAllActiveTeamsInSeason(_ context.Context, _ string) ([]domain.FantasyTeam, error) {
	return f.teams, nil
}

func (f *fakeFantasyRepo) GetLineup(_ context.Context, teamID, gwID string) (*domain.FantasyLineup, error) {
	return f.lineups[lineupKey(teamID, gwID)], nil
}

func (f *fakeFantasyRepo) GetLatestPriorLockedLineup(_ context.Context, teamID string, _ int) (*domain.FantasyLineup, error) {
	return f.priorLocked[teamID], nil
}

func (f *fakeFantasyRepo) CloneLineupToGameweek(_ context.Context, src *domain.FantasyLineup, targetGW string) error {
	f.clonedInto = append(f.clonedInto, src.TeamID+"->"+targetGW)
	clone := *src
	clone.ID = "clone-" + src.TeamID + "-" + targetGW
	clone.GameweekID = targetGW
	clone.Status = domain.LineupLocked
	f.lineups[lineupKey(src.TeamID, targetGW)] = &clone
	return nil
}

func (f *fakeFantasyRepo) UpdateGameweekStatus(_ context.Context, id string, st domain.GameweekStatus) error {
	f.gwStatus[id] = st
	return nil
}

func (f *fakeFantasyRepo) GetPlayerStatsByEventDay(_ context.Context, _ string) ([]domain.PlayerStat, error) {
	return f.stats, nil
}

func (f *fakeFantasyRepo) GetLockedLineupsForGameweek(_ context.Context, gwID string) ([]domain.FantasyLineup, error) {
	var out []domain.FantasyLineup
	for _, l := range f.lineups {
		if l.GameweekID == gwID && l.Status == domain.LineupLocked {
			out = append(out, *l)
		}
	}
	return out, nil
}

func (f *fakeFantasyRepo) UpdateLineupPickPoints(_ context.Context, lineupID string, pts map[string]float64) error {
	f.pickPoints[lineupID] = pts
	return nil
}

func (f *fakeFantasyRepo) UpdateLineupPoints(_ context.Context, lineupID string, points float64) error {
	for _, l := range f.lineups {
		if l.ID == lineupID {
			l.Points = points
		}
	}
	return nil
}

func (f *fakeFantasyRepo) BulkUpsertGWPoints(_ context.Context, pts []domain.FantasyGWPoints) error {
	f.pointsLogLen = len(pts)
	return nil
}

// RecalculateAllTeamTotalsInSeason mirrors the production SQL: a team's total is
// the SUM of its locked lineups, never an increment. Modelling it faithfully is
// what lets the idempotency test below actually catch a regression to `+=`.
func (f *fakeFantasyRepo) RecalculateAllTeamTotalsInSeason(_ context.Context, _ string) error {
	totals := map[string]float64{}
	for _, l := range f.lineups {
		if l.Status == domain.LineupLocked {
			totals[l.TeamID] += l.Points
		}
	}
	f.teamTotals = totals
	return nil
}

type fakeLeagueRepo struct {
	ports.IFantasyLeagueRepository
	overall *domain.FantasyLeague
	added   int
}

func (f *fakeLeagueRepo) GetOverallLeague(_ context.Context, _ string) (*domain.FantasyLeague, error) {
	return f.overall, nil
}

func (f *fakeLeagueRepo) AddMember(_ context.Context, _ *domain.FantasyLeagueMember) error {
	f.added++
	return nil
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

func testSeason() *domain.FantasySeason {
	return &domain.FantasySeason{
		ID: "season-1", CompetitionID: "comp-1", Name: "Test Season",
		SquadSize: 14, Budget: 230, MinFemaleOffense: 3, MinFemaleDefense: 3,
		MaxPerClub: 4, LockMinsBefore: 15, Status: domain.FantasySeasonActive,
	}
}

func testGameweek() *domain.FantasyGameweek {
	return &domain.FantasyGameweek{
		ID: "gw-1", SeasonID: "season-1", Number: 1, EventDayID: "ed-1",
		Deadline: time.Now().Add(2 * time.Hour), Status: domain.GameweekScheduled,
	}
}

// validSquad builds a legal 14-man squad: a male and female QB, five receivers
// of whom two are female, a rusher and six defenders of whom three are female,
// spread across enough clubs to stay inside the per-club cap.
func validSquad() []domain.LineupCandidate {
	type seed struct {
		slot     domain.FantasySlot
		position string
		gender   string
	}
	seeds := []seed{
		{domain.SlotQBMale, "QB", "M"},
		{domain.SlotQBFemale, "QB", "F"},
		{domain.SlotRec1, "Receiver", "F"},
		{domain.SlotRec2, "Receiver", "F"},
		{domain.SlotRec3, "Receiver", "M"},
		{domain.SlotRec4, "Receiver", "M"},
		{domain.SlotRec5, "Receiver", "M"},
		{domain.SlotRusher, "Rusher", "F"},
		{domain.SlotDef1, "Defender", "F"},
		{domain.SlotDef2, "Defender", "F"},
		{domain.SlotDef3, "Defender", "M"},
		{domain.SlotDef4, "Defender", "M"},
		{domain.SlotDef5, "Defender", "M"},
		{domain.SlotDef6, "Defender", "M"},
	}

	squad := make([]domain.LineupCandidate, 0, len(seeds))
	for i, s := range seeds {
		squad = append(squad, domain.LineupCandidate{
			Slot:     s.slot,
			PlayerID: string(s.slot) + "-player",
			Name:     string(s.slot),
			Position: s.position,
			Gender:   s.gender,
			// Four clubs keeps every club at or under the max of 4.
			TeamID: []string{"club-a", "club-b", "club-c", "club-d"}[i%4],
			Price:  10.00,
		})
	}
	return squad
}

// newServiceWith wires a service whose player pool is exactly the given squad.
func newServiceWith(squad []domain.LineupCandidate) (*fakeFantasyRepo, *fakeLeagueRepo, IFantasyService) {
	repo := newFakeRepo()
	repo.season = testSeason()
	gw := testGameweek()
	repo.gameweeks[gw.ID] = gw
	for _, c := range squad {
		repo.candidates[c.PlayerID] = c
	}
	repo.enteredTeam = &domain.FantasyTeam{ID: "team-user-1", UserID: "user-1", SeasonID: "season-1", Name: "Test XI"}
	leagues := &fakeLeagueRepo{overall: &domain.FantasyLeague{ID: "overall-1", Type: domain.LeagueTypeOverall}}
	return repo, leagues, NewFantasyService(repo, leagues, nil, nil)
}

func saveRequest(squad []domain.LineupCandidate) dto.SaveLineupRequest {
	picks := make([]dto.LineupSlotItem, 0, len(squad))
	for _, c := range squad {
		picks = append(picks, dto.LineupSlotItem{PlayerID: c.PlayerID, Slot: c.Slot})
	}
	return dto.SaveLineupRequest{
		SeasonID: "season-1", GameweekID: "gw-1", TeamName: "Test XI", Picks: picks,
	}
}

// ─── Season activation ────────────────────────────────────────────────────────

// Players are served "the active season", so two live at once would silently
// hide one of them.
func TestActivateSeason(t *testing.T) {
	newSvc := func(target *domain.FantasySeason, live *domain.FantasySeason) (*fakeFantasyRepo, IFantasyService) {
		repo := newFakeRepo()
		repo.season = target
		repo.liveSeason = live
		return repo, NewFantasyService(repo, &fakeLeagueRepo{}, nil, nil)
	}

	t.Run("releases a draft when nothing else is live", func(t *testing.T) {
		draft := &domain.FantasySeason{ID: "s1", Name: "Season 1", Status: domain.FantasySeasonDraft}
		repo, svc := newSvc(draft, nil)

		if err := svc.ActivateSeason(context.Background(), "s1"); err != nil {
			t.Fatalf("expected the draft to be released, got: %v", err)
		}
		if repo.seasonStatus["s1"] != domain.FantasySeasonActive {
			t.Errorf("expected the season to be ACTIVE, got %s", repo.seasonStatus["s1"])
		}
	})

	t.Run("refuses when another season is already live", func(t *testing.T) {
		draft := &domain.FantasySeason{ID: "s2", Name: "Season 2", Status: domain.FantasySeasonDraft}
		live := &domain.FantasySeason{ID: "s1", Name: "Season 1", Status: domain.FantasySeasonActive}
		repo, svc := newSvc(draft, live)

		err := svc.ActivateSeason(context.Background(), "s2")
		assertErrContains(t, err, "already live")
		if _, wrote := repo.seasonStatus["s2"]; wrote {
			t.Error("a refused activation must not change the season's status")
		}
	})

	t.Run("refuses to reopen a completed season", func(t *testing.T) {
		done := &domain.FantasySeason{ID: "s3", Name: "Old", Status: domain.FantasySeasonCompleted}
		_, svc := newSvc(done, nil)

		err := svc.ActivateSeason(context.Background(), "s3")
		assertErrContains(t, err, "cannot be reopened")
	})

	t.Run("is a no-op complaint when already live", func(t *testing.T) {
		live := &domain.FantasySeason{ID: "s4", Name: "Live", Status: domain.FantasySeasonActive}
		_, svc := newSvc(live, live)

		err := svc.ActivateSeason(context.Background(), "s4")
		assertErrContains(t, err, "already live")
	})
}

// ─── Season entry ─────────────────────────────────────────────────────────────

// Entering is the deliberate opt-in that replaced being signed up as a side
// effect of saving a squad.
func TestEnterSeason(t *testing.T) {
	t.Run("creates the manager's team", func(t *testing.T) {
		repo := newFakeRepo()
		repo.season = testSeason()
		svc := NewFantasyService(repo, &fakeLeagueRepo{}, nil, nil)

		team, err := svc.EnterSeason(context.Background(), "user-1", "season-1",
			dto.EnterSeasonRequest{TeamName: "  Lagos Lions  "})
		if err != nil {
			t.Fatalf("entering failed: %v", err)
		}
		if team.Name != "Lagos Lions" {
			t.Errorf("expected the team name trimmed, got %q", team.Name)
		}
	})

	t.Run("refuses a season that is not live", func(t *testing.T) {
		repo := newFakeRepo()
		repo.season = testSeason()
		repo.season.Status = domain.FantasySeasonDraft
		svc := NewFantasyService(repo, &fakeLeagueRepo{}, nil, nil)

		_, err := svc.EnterSeason(context.Background(), "user-1", "season-1",
			dto.EnterSeasonRequest{TeamName: "Lagos Lions"})
		assertErrContains(t, err, "not open for entry")
	})

	t.Run("entering does not join any league", func(t *testing.T) {
		repo := newFakeRepo()
		repo.season = testSeason()
		leagues := &fakeLeagueRepo{overall: &domain.FantasyLeague{ID: "overall-1", Type: domain.LeagueTypeOverall}}
		svc := NewFantasyService(repo, leagues, nil, nil)

		if _, err := svc.EnterSeason(context.Background(), "user-1", "season-1",
			dto.EnterSeasonRequest{TeamName: "Lagos Lions"}); err != nil {
			t.Fatalf("entering failed: %v", err)
		}
		if leagues.added != 0 {
			t.Errorf("entering a season must not join a league, but joined %d", leagues.added)
		}
	})
}

// ─── Lineup validation ────────────────────────────────────────────────────────

func TestLineupValidation(t *testing.T) {
	t.Run("accepts a legal squad", func(t *testing.T) {
		repo, leagues, svc := newServiceWith(validSquad())

		res, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(validSquad()))
		if err != nil {
			t.Fatalf("expected a legal squad to save, got: %v", err)
		}
		if res.TotalSpent != 140 {
			t.Errorf("expected total spend 140.00, got %.2f", res.TotalSpent)
		}
		if res.Remaining != 90 {
			t.Errorf("expected 90.00 remaining of a 230.00 budget, got %.2f", res.Remaining)
		}
		if len(repo.savedPicks) != 14 {
			t.Errorf("expected 14 picks persisted, got %d", len(repo.savedPicks))
		}
		// Saving a squad must not sign the manager up to anything — joining a
		// league is always a separate, deliberate act.
		if leagues.added != 0 {
			t.Errorf("saving a lineup must not join any league, but joined %d", leagues.added)
		}
	})

	// A Center is scored with the Receiver formula, so it must be selectable in
	// a receiver slot — otherwise Centers are unpickable across the whole game.
	t.Run("accepts a Center in a receiver slot", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			if squad[i].Slot == domain.SlotRec3 {
				squad[i].Position = "Center"
			}
		}
		_, _, svc := newServiceWith(squad)

		if _, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad)); err != nil {
			t.Fatalf("expected a Center to be eligible for REC_3, got: %v", err)
		}
	})

	t.Run("rejects a Center in a defender slot", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			if squad[i].Slot == domain.SlotDef1 {
				squad[i].Position = "Center"
			}
		}
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad))
		assertErrContains(t, err, "must be a Defender")
	})

	t.Run("rejects a wrong position for a slot", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			if squad[i].Slot == domain.SlotRec1 {
				squad[i].Position = "Defender"
			}
		}
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad))
		assertErrContains(t, err, "Receiver or Center")
	})

	t.Run("rejects a female QB in the male QB slot", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			if squad[i].Slot == domain.SlotQBMale {
				squad[i].Gender = "F"
			}
		}
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad))
		assertErrContains(t, err, "must be a Male QB")
	})

	t.Run("rejects fewer than three females on offense", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			if squad[i].Slot == domain.SlotRec1 {
				squad[i].Gender = "M" // leaves only the female QB + REC_2
			}
		}
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad))
		assertErrContains(t, err, "offensive unit requires at least 3 female athletes")
	})

	t.Run("rejects fewer than three females on defense", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			if squad[i].Slot == domain.SlotDef1 {
				squad[i].Gender = "M"
			}
		}
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad))
		assertErrContains(t, err, "defensive unit requires at least 3 female athletes")
	})

	t.Run("rejects too many players from one club", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			squad[i].TeamID = "club-a"
		}
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad))
		assertErrContains(t, err, "no more than 4 players")
	})

	t.Run("rejects a squad over budget", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			squad[i].Price = 20.00 // 14 x 20.00 = 280.00 against a 230.00 budget
		}
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad))
		assertErrContains(t, err, "exceeds budget")
	})

	// A squad costing exactly the budget must not be rejected by float drift.
	t.Run("accepts a squad costing exactly the budget", func(t *testing.T) {
		squad := validSquad()
		for i := range squad {
			squad[i].Price = 230.0 / 14.0
		}
		_, _, svc := newServiceWith(squad)

		if _, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(squad)); err != nil {
			t.Fatalf("expected a squad at exactly the budget to be accepted, got: %v", err)
		}
	})

	t.Run("rejects the same player in two slots", func(t *testing.T) {
		squad := validSquad()
		req := saveRequest(squad)
		req.Picks[3].PlayerID = req.Picks[2].PlayerID // REC_2 duplicates REC_1
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", req)
		assertErrContains(t, err, "more than one slot")
	})

	t.Run("rejects a missing slot", func(t *testing.T) {
		squad := validSquad()
		req := saveRequest(squad)
		req.Picks[13].Slot = domain.SlotDef5 // DEF_6 never filled, DEF_5 twice
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", req)
		assertErrContains(t, err, "duplicate slot")
	})

	t.Run("rejects a short squad", func(t *testing.T) {
		squad := validSquad()
		req := saveRequest(squad)
		req.Picks = req.Picks[:13]
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", req)
		assertErrContains(t, err, "exactly 14 slots")
	})

	t.Run("rejects an unknown player", func(t *testing.T) {
		squad := validSquad()
		req := saveRequest(squad)
		req.Picks[0].PlayerID = "ghost"
		_, _, svc := newServiceWith(squad)

		_, err := svc.SaveLineup(context.Background(), "user-1", req)
		assertErrContains(t, err, "not found")
	})

	t.Run("rejects a submission after the deadline", func(t *testing.T) {
		repo, _, svc := newServiceWith(validSquad())
		repo.gameweeks["gw-1"].Deadline = time.Now().Add(-time.Minute)

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(validSquad()))
		assertErrContains(t, err, "deadline for this match day has passed")
	})

	t.Run("rejects a submission to a locked gameweek", func(t *testing.T) {
		repo, _, svc := newServiceWith(validSquad())
		repo.gameweeks["gw-1"].Status = domain.GameweekLocked

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(validSquad()))
		assertErrContains(t, err, "locked or finalized")
	})

	// The manager complained about being enrolled without choosing to be, so
	// entry is now a prerequisite rather than a side effect.
	t.Run("refuses a squad from someone who has not entered the season", func(t *testing.T) {
		repo, _, svc := newServiceWith(validSquad())
		repo.enteredTeam = nil

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(validSquad()))
		assertErrContains(t, err, "join this season before picking a squad")
	})

	t.Run("rejects a submission to an inactive season", func(t *testing.T) {
		repo, _, svc := newServiceWith(validSquad())
		repo.season.Status = domain.FantasySeasonDraft

		_, err := svc.SaveLineup(context.Background(), "user-1", saveRequest(validSquad()))
		assertErrContains(t, err, "not currently active")
	})
}

// ─── Rollover ─────────────────────────────────────────────────────────────────

func TestLineupRollover(t *testing.T) {
	// gw2 is the match day being locked; each team is in a different state.
	setup := func() (*fakeFantasyRepo, IFantasyService) {
		repo := newFakeRepo()
		repo.season = testSeason()

		gw2 := &domain.FantasyGameweek{
			ID: "gw-2", SeasonID: "season-1", Number: 2, EventDayID: "ed-2",
			Deadline: time.Now().Add(-time.Minute), Status: domain.GameweekScheduled,
		}
		repo.gameweeks[gw2.ID] = gw2
		repo.dueForLock = []domain.FantasyGameweek{*gw2}

		repo.teams = []domain.FantasyTeam{
			{ID: "team-active", SeasonID: "season-1"},   // edited this week
			{ID: "team-forgot", SeasonID: "season-1"},   // set-and-forget
			{ID: "team-brandnew", SeasonID: "season-1"}, // never submitted anything
		}

		// The active manager submitted a fresh draft for gw2.
		repo.lineups[lineupKey("team-active", "gw-2")] = &domain.FantasyLineup{
			ID: "active-gw2", TeamID: "team-active", GameweekID: "gw-2",
			Status: domain.LineupDraft, TotalSpent: 140,
		}

		// The forgetful manager has a locked gw1 squad and nothing for gw2.
		prior := &domain.FantasyLineup{
			ID: "forgot-gw1", TeamID: "team-forgot", GameweekID: "gw-1",
			Status: domain.LineupLocked, TotalSpent: 140, Points: 12,
		}
		for _, c := range validSquad() {
			prior.Picks = append(prior.Picks, domain.FantasyLineupPick{
				PlayerID: c.PlayerID, Slot: c.Slot, PurchasePrice: c.Price,
			})
		}
		repo.priorLocked["team-forgot"] = prior
		repo.lineups[lineupKey("team-forgot", "gw-1")] = prior

		return repo, NewFantasyService(repo, &fakeLeagueRepo{}, nil, nil)
	}

	t.Run("locks a submitted draft without cloning it", func(t *testing.T) {
		repo, svc := setup()
		if err := svc.AutoLockGameweeks(context.Background()); err != nil {
			t.Fatalf("auto-lock failed: %v", err)
		}

		active := repo.lineups[lineupKey("team-active", "gw-2")]
		if active.Status != domain.LineupLocked {
			t.Errorf("expected the submitted draft to be locked, got %s", active.Status)
		}
		for _, c := range repo.clonedInto {
			if strings.HasPrefix(c, "team-active->") {
				t.Errorf("a team that submitted its own lineup must not be cloned into: %v", repo.clonedInto)
			}
		}
	})

	t.Run("carries a set-and-forget squad forward", func(t *testing.T) {
		repo, svc := setup()
		if err := svc.AutoLockGameweeks(context.Background()); err != nil {
			t.Fatalf("auto-lock failed: %v", err)
		}

		rolled := repo.lineups[lineupKey("team-forgot", "gw-2")]
		if rolled == nil {
			t.Fatal("expected the previous locked squad to roll forward into gw-2")
		}
		if rolled.Status != domain.LineupLocked {
			t.Errorf("expected the rolled-over lineup to be locked, got %s", rolled.Status)
		}
		if len(rolled.Picks) != 14 {
			t.Errorf("expected all 14 picks carried forward, got %d", len(rolled.Picks))
		}
	})

	t.Run("leaves a team with no history alone", func(t *testing.T) {
		repo, svc := setup()
		if err := svc.AutoLockGameweeks(context.Background()); err != nil {
			t.Fatalf("auto-lock failed: %v", err)
		}

		if repo.lineups[lineupKey("team-brandnew", "gw-2")] != nil {
			t.Error("a team that never submitted a squad must not get a phantom lineup")
		}
	})

	t.Run("past gameweeks stay frozen", func(t *testing.T) {
		repo, svc := setup()
		if err := svc.AutoLockGameweeks(context.Background()); err != nil {
			t.Fatalf("auto-lock failed: %v", err)
		}

		gw1 := repo.lineups[lineupKey("team-forgot", "gw-1")]
		if gw1.Points != 12 || gw1.GameweekID != "gw-1" {
			t.Errorf("gw-1 must be immutable, got points=%.2f gw=%s", gw1.Points, gw1.GameweekID)
		}
	})

	t.Run("marks the gameweek locked", func(t *testing.T) {
		repo, svc := setup()
		if err := svc.AutoLockGameweeks(context.Background()); err != nil {
			t.Fatalf("auto-lock failed: %v", err)
		}

		if repo.gwStatus["gw-2"] != domain.GameweekLocked {
			t.Errorf("expected gw-2 to be LOCKED, got %s", repo.gwStatus["gw-2"])
		}
	})
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

// A gameweek must be safely re-scorable: correcting a stat and finalising again
// has to restate the standings, not add a second helping of points.
func TestGameweekScoringIsIdempotent(t *testing.T) {
	repo := newFakeRepo()
	repo.season = testSeason()
	gw := &domain.FantasyGameweek{
		ID: "gw-1", SeasonID: "season-1", Number: 1, EventDayID: "ed-1",
		Deadline: time.Now().Add(-time.Hour), Status: domain.GameweekLocked,
	}
	repo.gameweeks[gw.ID] = gw

	squad := validSquad()
	lineup := &domain.FantasyLineup{
		ID: "lineup-1", TeamID: "team-1", GameweekID: "gw-1", Status: domain.LineupLocked,
	}
	for _, c := range squad {
		lineup.Picks = append(lineup.Picks, domain.FantasyLineupPick{PlayerID: c.PlayerID, Slot: c.Slot})
	}
	repo.lineups[lineupKey("team-1", "gw-1")] = lineup

	// One receiver: 5 catches (1.250) + 80 yds (2.000) + 1 TD (2.000) = 5.250
	repo.stats = []domain.PlayerStat{{
		PlayerID: squad[2].PlayerID, MatchID: "match-1",
		Receptions: 5, ReceivingYards: 80, ReceivingTDs: 1,
	}}

	svc := NewFantasyService(repo, &fakeLeagueRepo{}, nil, nil)

	if err := svc.ComputeGameweekScores(context.Background(), "gw-1"); err != nil {
		t.Fatalf("first scoring run failed: %v", err)
	}
	first := repo.teamTotals["team-1"]
	if first < 5.24 || first > 5.26 {
		t.Fatalf("expected 5.25 points after scoring, got %.4f", first)
	}

	if err := svc.ComputeGameweekScores(context.Background(), "gw-1"); err != nil {
		t.Fatalf("second scoring run failed: %v", err)
	}
	if second := repo.teamTotals["team-1"]; second != first {
		t.Errorf("re-scoring must be idempotent: total went from %.4f to %.4f", first, second)
	}

	// The per-pick score must actually be written — the squad view reads it.
	if got := repo.pickPoints["lineup-1"][squad[2].PlayerID]; got < 5.24 || got > 5.26 {
		t.Errorf("expected the scoring player's pick to carry 5.25 points, got %.4f", got)
	}
	if got := repo.pickPoints["lineup-1"][squad[0].PlayerID]; got != 0 {
		t.Errorf("expected a player with no stats to score 0, got %.4f", got)
	}
}

// ─── Deadline derivation ──────────────────────────────────────────────────────

func TestResolveDeadline(t *testing.T) {
	kickoff := time.Date(2026, 3, 14, 15, 0, 0, 0, time.UTC)

	t.Run("derives from first kickoff minus the lock window", func(t *testing.T) {
		got, err := resolveDeadline("", &kickoff, 15)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if want := kickoff.Add(-15 * time.Minute); !got.Equal(want) {
			t.Errorf("expected %s, got %s", want, got)
		}
	})

	t.Run("an explicit override wins", func(t *testing.T) {
		got, err := resolveDeadline("2026-03-14T12:00:00Z", &kickoff, 15)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if want := time.Date(2026, 3, 14, 12, 0, 0, 0, time.UTC); !got.Equal(want) {
			t.Errorf("expected %s, got %s", want, got)
		}
	})

	t.Run("rejects a malformed override", func(t *testing.T) {
		_, err := resolveDeadline("next tuesday", &kickoff, 15)
		assertErrContains(t, err, "RFC3339")
	})

	// Silently inventing a deadline is how a match day ends up locking at an
	// arbitrary time, so an event day with no fixtures must be refused.
	t.Run("refuses an event day with no fixtures", func(t *testing.T) {
		_, err := resolveDeadline("", nil, 15)
		assertErrContains(t, err, "no fixtures yet")
	})
}

func assertErrContains(t *testing.T, err error, want string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected an error containing %q, got nil", want)
	}
	if !strings.Contains(err.Error(), want) {
		t.Errorf("expected an error containing %q, got: %v", want, err)
	}
}
