package service

import (
	"context"
	"strings"
	"time"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// ---- seasons ---------------------------------------------------------------

type SeasonInput struct {
	Number   int    `json:"number"`
	Name     string `json:"name"`
	StartsOn string `json:"starts_on"`
	EndsOn   string `json:"ends_on"`
}

func validateSeason(in SeasonInput) (name string, starts, ends *string, err error) {
	name = cleanText(in.Name)
	if len(name) < 2 || len(name) > 60 {
		return "", nil, nil, badRequest("Give the season a name of 2 to 60 characters.")
	}
	if starts, err = parseDate(in.StartsOn); err != nil {
		return
	}
	if ends, err = parseDate(in.EndsOn); err != nil {
		return
	}
	if starts != nil && ends != nil && *ends < *starts {
		return "", nil, nil, badRequest("The season can't end before it starts.")
	}
	return name, starts, ends, nil
}

func (s *Service) ListSeasons(ctx context.Context) ([]domain.Season, error) {
	out, err := s.store.ListSeasons(ctx)
	return out, s.wrap(err, "seasons")
}

// SeasonWithDivisions is a season and its divisions.
func (s *Service) SeasonWithDivisions(ctx context.Context, id string) (*domain.Season, error) {
	season, err := s.store.GetSeason(ctx, id)
	if err != nil {
		return nil, s.wrap(err, "Season")
	}
	season.Divisions, err = s.store.ListDivisions(ctx, id)
	return season, s.wrap(err, "divisions")
}

func (s *Service) CreateSeason(ctx context.Context, in SeasonInput) (*domain.Season, error) {
	if in.Number < 1 || in.Number > 999 {
		return nil, badRequest("The season number must be between 1 and 999.")
	}
	name, starts, ends, err := validateSeason(in)
	if err != nil {
		return nil, err
	}
	season, err := s.store.CreateSeason(ctx, in.Number, name, starts, ends)
	return season, s.wrap(err, "season")
}

func (s *Service) UpdateSeason(ctx context.Context, id string, in SeasonInput) (*domain.Season, error) {
	name, starts, ends, err := validateSeason(in)
	if err != nil {
		return nil, err
	}
	season, err := s.store.UpdateSeason(ctx, id, name, starts, ends)
	return season, s.wrap(err, "Season")
}

// allowedSeasonMoves is where a season's status may go next.
var allowedSeasonMoves = map[string][]string{
	domain.SeasonSetup:     {domain.SeasonActive},
	domain.SeasonActive:    {domain.SeasonPlayoffs, domain.SeasonCompleted},
	domain.SeasonPlayoffs:  {domain.SeasonActive, domain.SeasonCompleted},
	domain.SeasonCompleted: {},
}

// SetSeasonStatus moves a season along setup, active, playoffs, completed.
func (s *Service) SetSeasonStatus(ctx context.Context, id, to string) (*domain.Season, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		season, err := tx.GetSeasonForUpdate(ctx, id)
		if err != nil {
			return err
		}
		ok := false
		for _, n := range allowedSeasonMoves[season.Status] {
			if n == to {
				ok = true
			}
		}
		if !ok {
			return badRequest("A season that is %s can't be moved to %s.", season.Status, to)
		}
		if season.Status == domain.SeasonSetup {
			divs, err := tx.ListDivisions(ctx, id)
			if err != nil {
				return err
			}
			hasLeague := false
			for _, d := range divs {
				if d.ClubCount >= 2 {
					hasLeague = true
				}
			}
			if !hasLeague {
				return badRequest("Add a division with at least 2 clubs before starting the season.")
			}
		}
		if err := tx.SetSeasonStatus(ctx, id, to); err != nil {
			return err
		}
		if to == domain.SeasonCompleted {
			// A finished season can't keep transfers open.
			return tx.SetTransferWindow(ctx, id, false)
		}
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Season")
	}
	return s.store.GetSeason(ctx, id)
}

func (s *Service) SetTransferWindow(ctx context.Context, id string, open bool) (*domain.Season, error) {
	season, err := s.store.GetSeason(ctx, id)
	if err != nil {
		return nil, s.wrap(err, "Season")
	}
	if open && season.Status == domain.SeasonCompleted {
		return nil, badRequest("A completed season can't open its transfer window.")
	}
	if err := s.store.SetTransferWindow(ctx, id, open); err != nil {
		return nil, s.wrap(err, "Season")
	}
	return s.store.GetSeason(ctx, id)
}

// ---- divisions -------------------------------------------------------------

type DivisionInput struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	PlayoffSpots int      `json:"playoff_spots"`
	KickoffDay   int      `json:"kickoff_day"`
	KickoffSlots []string `json:"kickoff_slots"`
}

func validateDivision(in DivisionInput) (store.DivisionInput, error) {
	name := cleanText(in.Name)
	if len(name) < 2 || len(name) > 40 {
		return store.DivisionInput{}, badRequest("Give the division a name of 2 to 40 characters.")
	}
	if len(in.Description) > 90 {
		return store.DivisionInput{}, badRequest("Keep the description under 90 characters.")
	}
	if in.PlayoffSpots != 0 && in.PlayoffSpots != 2 && in.PlayoffSpots != 4 {
		return store.DivisionInput{}, badRequest("Playoff places must be 0, 2 or 4.")
	}
	if in.KickoffDay < 0 || in.KickoffDay > 6 {
		return store.DivisionInput{}, badRequest("Pick a match day from Sunday to Saturday.")
	}
	if len(in.KickoffSlots) == 0 || len(in.KickoffSlots) > 6 {
		return store.DivisionInput{}, badRequest("Add between 1 and 6 kick-off times.")
	}
	seen := map[string]bool{}
	slots := make([]string, 0, len(in.KickoffSlots))
	for _, sl := range in.KickoffSlots {
		sl = strings.TrimSpace(sl)
		if _, _, err := domain.ParseSlot(sl); err != nil {
			return store.DivisionInput{}, badRequest("%s", err.Error())
		}
		if !seen[sl] {
			seen[sl] = true
			slots = append(slots, sl)
		}
	}
	return store.DivisionInput{Name: name, Description: cleanText(in.Description), PlayoffSpots: in.PlayoffSpots, KickoffDay: in.KickoffDay, KickoffSlots: slots}, nil
}

func (s *Service) CreateDivision(ctx context.Context, seasonID string, in DivisionInput) (*domain.Division, error) {
	v, err := validateDivision(in)
	if err != nil {
		return nil, err
	}
	season, err := s.store.GetSeason(ctx, seasonID)
	if err != nil {
		return nil, s.wrap(err, "Season")
	}
	if season.Status == domain.SeasonCompleted {
		return nil, badRequest("A completed season can't get new divisions.")
	}
	d, err := s.store.CreateDivision(ctx, seasonID, v)
	return d, s.wrap(err, "division")
}

func (s *Service) UpdateDivision(ctx context.Context, id string, in DivisionInput) (*domain.Division, error) {
	v, err := validateDivision(in)
	if err != nil {
		return nil, err
	}
	d, err := s.store.UpdateDivision(ctx, id, v)
	return d, s.wrap(err, "Division")
}

func (s *Service) DeleteDivision(ctx context.Context, id string) error {
	d, err := s.store.GetDivision(ctx, id)
	if err != nil {
		return s.wrap(err, "Division")
	}
	if d.Locked {
		return conflict("This division has recorded results, so it can't be deleted.")
	}
	return s.wrap(s.store.DeleteDivision(ctx, id), "Division")
}

// SetDivisionClubs decides which clubs play in a division. It refuses anything
// that would disturb recorded results or already-made fixtures.
func (s *Service) SetDivisionClubs(ctx context.Context, divisionID string, clubIDs []string) (*domain.Division, error) {
	clubIDs = uniqueStrings(clubIDs)
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.GetDivisionForUpdate(ctx, divisionID); err != nil {
			return err
		}
		d, err := tx.GetDivision(ctx, divisionID)
		if err != nil {
			return err
		}
		season, err := tx.GetSeason(ctx, d.SeasonID)
		if err != nil {
			return err
		}
		if season.Status == domain.SeasonCompleted {
			return badRequest("A completed season can't change its clubs.")
		}

		current := toSet(d.ClubIDs)
		wanted := toSet(clubIDs)
		if sameSet(current, wanted) {
			return nil
		}

		total, _, err := tx.CountMatches(ctx, divisionID, domain.StageLeague)
		if err != nil {
			return err
		}
		if total > 0 {
			return conflict("This division already has fixtures. Delete them (only possible before any result) to change its clubs.")
		}

		// Clubs coming from another division must not have results there.
		for _, id := range clubIDs {
			club, err := tx.GetClub(ctx, id, &d.SeasonID)
			if err != nil {
				return badRequest("One of the selected clubs doesn't exist.")
			}
			if club.Status != "active" {
				return badRequest("%s is archived and can't be added.", club.Name)
			}
			if club.HasPlayed && club.DivisionID != nil && *club.DivisionID != divisionID {
				return conflict("%s has already played this season, so it stays in %s.", club.Name, club.DivisionName)
			}
		}
		return tx.SetDivisionClubs(ctx, divisionID, d.SeasonID, clubIDs)
	})
	if err != nil {
		return nil, s.wrap(err, "Division")
	}
	d, err := s.store.GetDivision(ctx, divisionID)
	return d, s.wrap(err, "Division")
}

// ---- fixtures --------------------------------------------------------------

type FixtureRequest struct {
	// FirstDate is the earliest date the first matchweek may fall on (yyyy-mm-dd).
	FirstDate string `json:"first_date"`
	// Legs is 1 or 2; 2 (home and away) when omitted.
	Legs int `json:"legs"`
}

// PlannedFixture is a fixture as shown in a preview, with club names.
type PlannedFixture struct {
	Matchweek int            `json:"matchweek"`
	Home      domain.ClubRef `json:"home"`
	Away      domain.ClubRef `json:"away"`
	KickoffAt time.Time      `json:"kickoff_at"`
}

type FixturePlan struct {
	Division   domain.Division  `json:"division"`
	Matchweeks int              `json:"matchweeks"`
	Fixtures   []PlannedFixture `json:"fixtures"`
}

func (s *Service) planFixtures(ctx context.Context, tx *store.Store, divisionID string, req FixtureRequest) (*FixturePlan, []domain.Fixture, *domain.Division, error) {
	d, err := tx.GetDivision(ctx, divisionID)
	if err != nil {
		return nil, nil, nil, err
	}
	if d.ClubCount < 2 {
		return nil, nil, nil, badRequest("Add at least 2 clubs to %s before making fixtures.", d.Name)
	}
	total, _, err := tx.CountMatches(ctx, divisionID, domain.StageLeague)
	if err != nil {
		return nil, nil, nil, err
	}
	if total > 0 {
		return nil, nil, nil, conflict("%s already has fixtures. Delete them first to make new ones.", d.Name)
	}
	season, err := tx.GetSeason(ctx, d.SeasonID)
	if err != nil {
		return nil, nil, nil, err
	}
	if season.Status == domain.SeasonCompleted {
		return nil, nil, nil, badRequest("A completed season can't get fixtures.")
	}

	first := s.today()
	if req.FirstDate != "" {
		t, perr := time.Parse("2006-01-02", req.FirstDate)
		if perr != nil {
			return nil, nil, nil, badRequest("The first date must look like 2026-10-12.")
		}
		first = t
	} else if season.StartsOn != nil {
		if t, perr := time.Parse("2006-01-02", *season.StartsOn); perr == nil && t.After(first) {
			first = t
		}
	}
	legs := req.Legs
	if legs == 0 {
		legs = 2
	}

	refs, err := tx.DivisionClubRefs(ctx, divisionID)
	if err != nil {
		return nil, nil, nil, err
	}
	byID := map[string]domain.ClubRef{}
	ids := make([]string, 0, len(refs))
	for _, r := range refs {
		byID[r.ID] = r
		ids = append(ids, r.ID)
	}
	fx, gerr := domain.GenerateFixtures(domain.FixtureInput{
		ClubIDs: ids, FirstDate: first, KickoffDay: d.KickoffDay, Slots: d.KickoffSlots, Legs: legs,
	})
	if gerr != nil {
		return nil, nil, nil, badRequest("%s", gerr.Error())
	}
	plan := &FixturePlan{Division: *d, Fixtures: make([]PlannedFixture, 0, len(fx))}
	for _, f := range fx {
		plan.Fixtures = append(plan.Fixtures, PlannedFixture{Matchweek: f.Matchweek, Home: byID[f.HomeClubID], Away: byID[f.AwayClubID], KickoffAt: f.KickoffAt})
		if f.Matchweek > plan.Matchweeks {
			plan.Matchweeks = f.Matchweek
		}
	}
	return plan, fx, d, nil
}

// PreviewFixtures shows what GenerateFixtures would create, changing nothing.
func (s *Service) PreviewFixtures(ctx context.Context, divisionID string, req FixtureRequest) (*FixturePlan, error) {
	plan, _, _, err := s.planFixtures(ctx, s.store, divisionID, req)
	if err != nil {
		return nil, s.wrap(err, "Division")
	}
	return plan, nil
}

// GenerateFixtures creates a division's league fixtures.
func (s *Service) GenerateFixtures(ctx context.Context, divisionID string, req FixtureRequest) (*FixturePlan, error) {
	var plan *FixturePlan
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.GetDivisionForUpdate(ctx, divisionID); err != nil {
			return err
		}
		p, fx, d, err := s.planFixtures(ctx, tx, divisionID, req)
		if err != nil {
			return err
		}
		for _, f := range fx {
			h, a, ko := f.HomeClubID, f.AwayClubID, f.KickoffAt
			if _, err := tx.InsertMatch(ctx, store.NewMatch{
				SeasonID: d.SeasonID, DivisionID: divisionID, Stage: domain.StageLeague,
				Matchweek: f.Matchweek, HomeClubID: &h, AwayClubID: &a, KickoffAt: &ko,
			}); err != nil {
				return err
			}
		}
		plan = p
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Division")
	}
	return plan, nil
}

// DeleteFixtures clears a division's matches, but only while none has a result.
func (s *Service) DeleteFixtures(ctx context.Context, divisionID string) error {
	return s.wrap(s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.GetDivisionForUpdate(ctx, divisionID); err != nil {
			return err
		}
		d, err := tx.GetDivision(ctx, divisionID)
		if err != nil {
			return err
		}
		if d.Locked {
			return conflict("%s has recorded results, so its fixtures can't be deleted.", d.Name)
		}
		return tx.DeleteMatches(ctx, divisionID, "")
	}), "Division")
}

// RescheduleInput moves a match, or marks it postponed.
type RescheduleInput struct {
	KickoffAt *time.Time `json:"kickoff_at"`
	Postponed bool       `json:"postponed"`
}

func (s *Service) RescheduleMatch(ctx context.Context, matchID string, in RescheduleInput) (*domain.Match, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockMatch(ctx, matchID); err != nil {
			return err
		}
		m, err := tx.GetMatch(ctx, matchID)
		if err != nil {
			return err
		}
		if m.Played() {
			return conflict("This match has a result, so it can't be rescheduled.")
		}
		status := domain.MatchScheduled
		if in.Postponed {
			status = domain.MatchPostponed
		}
		if in.KickoffAt == nil && !in.Postponed {
			return badRequest("Choose a new kick-off time, or mark the match postponed.")
		}
		ko := in.KickoffAt
		if ko == nil {
			ko = m.KickoffAt
		}
		return tx.SetSchedule(ctx, matchID, ko, status)
	})
	if err != nil {
		return nil, s.wrap(err, "Match")
	}
	m, err := s.store.GetMatch(ctx, matchID)
	return m, s.wrap(err, "Match")
}

// ---- small set helpers ------------------------------------------------------

func uniqueStrings(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, v := range in {
		v = strings.TrimSpace(v)
		if v != "" && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}

func toSet(in []string) map[string]bool {
	m := make(map[string]bool, len(in))
	for _, v := range in {
		m[v] = true
	}
	return m
}

func sameSet(a, b map[string]bool) bool {
	if len(a) != len(b) {
		return false
	}
	for k := range a {
		if !b[k] {
			return false
		}
	}
	return true
}
