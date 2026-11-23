package service

import (
	"context"
	"errors"
	"sort"
	"time"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// table builds a division's league table from its clubs and league matches.
func (s *Service) table(ctx context.Context, st *store.Store, divisionID string) ([]domain.StandingRow, error) {
	refs, err := st.DivisionClubRefs(ctx, divisionID)
	if err != nil {
		return nil, err
	}
	ms, err := st.ListMatches(ctx, store.MatchFilter{DivisionID: divisionID, Stage: domain.StageLeague})
	if err != nil {
		return nil, err
	}
	return domain.ComputeStandings(refs, ms), nil
}

// nextKickoffDay is the first date after `after` that falls on weekday (0 =
// Sunday), as midnight in Lagos.
func nextKickoffDay(after time.Time, weekday int) time.Time {
	a := after.In(domain.Lagos)
	day := time.Date(a.Year(), a.Month(), a.Day(), 0, 0, 0, 0, domain.Lagos).AddDate(0, 0, 1)
	for int(day.Weekday()) != weekday {
		day = day.AddDate(0, 0, 1)
	}
	return day
}

// kickoffOn is the day at the i-th slot (wrapping), in Lagos.
func kickoffOn(day time.Time, slots []string, i int) time.Time {
	if len(slots) == 0 {
		return day.Add(20 * time.Hour)
	}
	h, m, err := domain.ParseSlot(slots[i%len(slots)])
	if err != nil {
		return day.Add(20 * time.Hour)
	}
	return time.Date(day.Year(), day.Month(), day.Day(), h, m, 0, 0, domain.Lagos)
}

// Scope is the season and division a public page is showing.
type Scope struct {
	Season    domain.Season     `json:"season"`
	Division  *domain.Division  `json:"division"`
	Divisions []domain.Division `json:"divisions"`
}

// ResolveScope finds the season (the current one) and the division asked for, or
// the season's first division. Division is nil when the season has none yet.
func (s *Service) ResolveScope(ctx context.Context, divisionID string) (*Scope, error) {
	var season *domain.Season
	var err error
	if divisionID != "" {
		d, derr := s.store.GetDivision(ctx, divisionID)
		if derr != nil {
			return nil, s.wrap(derr, "Division")
		}
		season, err = s.store.GetSeason(ctx, d.SeasonID)
	} else {
		season, err = s.store.CurrentSeason(ctx)
	}
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, notFoundErr("Season")
		}
		return nil, s.wrap(err, "Season")
	}
	divs, err := s.store.ListDivisions(ctx, season.ID)
	if err != nil {
		return nil, s.wrap(err, "divisions")
	}
	sc := &Scope{Season: *season, Divisions: divs}
	for i := range divs {
		if divisionID == "" || divs[i].ID == divisionID {
			sc.Division = &divs[i]
			break
		}
	}
	return sc, nil
}

// ---- overview, standings, matches -------------------------------------------

type Metrics struct {
	Clubs         int     `json:"clubs"`
	Players       int     `json:"players"`
	MatchesPlayed int     `json:"matches_played"`
	Goals         int     `json:"goals"`
	GoalsPerMatch float64 `json:"goals_per_match"`
	LastMatchweek int     `json:"last_matchweek"`
	TotalWeeks    int     `json:"total_matchweeks"`
	NextMatchweek int     `json:"next_matchweek"`
}

type Overview struct {
	Scope      *Scope                     `json:"scope"`
	Metrics    Metrics                    `json:"metrics"`
	Latest     []domain.Match             `json:"latest"`
	Upcoming   []domain.Match             `json:"upcoming"`
	Standings  []domain.StandingRow       `json:"standings"`
	TopScorers []domain.PlayerSeasonStats `json:"top_scorers"`
	Champion   *domain.ClubRef            `json:"champion"`
}

func (s *Service) Overview(ctx context.Context, divisionID string) (*Overview, error) {
	sc, err := s.ResolveScope(ctx, divisionID)
	if err != nil {
		return nil, err
	}
	ov := &Overview{Scope: sc, Latest: []domain.Match{}, Upcoming: []domain.Match{}, Standings: []domain.StandingRow{}, TopScorers: []domain.PlayerSeasonStats{}}
	if sc.Division == nil {
		return ov, nil
	}
	d := sc.Division
	rows, err := s.table(ctx, s.store, d.ID)
	if err != nil {
		return nil, s.wrap(err, "standings")
	}
	ov.Metrics = metricsFrom(rows)
	if len(rows) > 5 {
		ov.Standings = rows[:5]
	} else {
		ov.Standings = rows
	}
	ov.Metrics.Clubs = len(rows)

	all, err := s.store.ListMatches(ctx, store.MatchFilter{DivisionID: d.ID, Stage: domain.StageLeague})
	if err != nil {
		return nil, s.wrap(err, "matches")
	}
	weeks := 0
	for _, m := range all {
		if m.Matchweek > weeks {
			weeks = m.Matchweek
		}
		if m.Played() && m.Matchweek > ov.Metrics.LastMatchweek {
			ov.Metrics.LastMatchweek = m.Matchweek
		}
	}
	ov.Metrics.TotalWeeks = weeks

	if ov.Latest, err = s.store.ListMatches(ctx, store.MatchFilter{DivisionID: d.ID, State: "results", Newest: true, Limit: 5}); err != nil {
		return nil, s.wrap(err, "matches")
	}
	if ov.Upcoming, err = s.store.ListMatches(ctx, store.MatchFilter{DivisionID: d.ID, State: "upcoming", Limit: 5}); err != nil {
		return nil, s.wrap(err, "matches")
	}
	if len(ov.Upcoming) > 0 {
		ov.Metrics.NextMatchweek = ov.Upcoming[0].Matchweek
	}
	stats, err := s.store.PlayerSeasonStats(ctx, store.PlayerStatsFilter{DivisionID: d.ID})
	if err != nil {
		return nil, s.wrap(err, "stats")
	}
	distinct := map[string]bool{}
	for _, st := range stats {
		distinct[st.PlayerID] = true
	}
	ov.Metrics.Players = len(distinct)
	sort.SliceStable(stats, func(i, j int) bool { return stats[i].Goals > stats[j].Goals })
	for _, st := range stats {
		if len(ov.TopScorers) == 4 || st.Goals == 0 {
			break
		}
		ov.TopScorers = append(ov.TopScorers, st)
	}
	ov.Champion, err = s.champion(ctx, d.ID)
	if err != nil {
		return nil, s.wrap(err, "champion")
	}
	return ov, nil
}

func metricsFrom(rows []domain.StandingRow) Metrics {
	var played, goals int
	for _, r := range rows {
		played += r.Played
		goals += r.GF
	}
	m := Metrics{MatchesPlayed: played / 2, Goals: goals}
	if m.MatchesPlayed > 0 {
		m.GoalsPerMatch = float64(goals) / float64(m.MatchesPlayed)
		m.GoalsPerMatch = float64(int(m.GoalsPerMatch*100+0.5)) / 100
	}
	return m
}

// champion is the winner of the division's final, if it has been decided.
func (s *Service) champion(ctx context.Context, divisionID string) (*domain.ClubRef, error) {
	finals, err := s.store.ListMatches(ctx, store.MatchFilter{DivisionID: divisionID, Stage: domain.StageFinal})
	if err != nil || len(finals) == 0 {
		return nil, err
	}
	f := finals[0]
	id, werr := domain.KnockoutWinner(f)
	if werr != nil {
		return nil, nil
	}
	if f.Home != nil && f.Home.ID == id {
		return f.Home, nil
	}
	return f.Away, nil
}

type StandingsView struct {
	Scope        *Scope               `json:"scope"`
	Rows         []domain.StandingRow `json:"rows"`
	PlayoffSpots int                  `json:"playoff_spots"`
	Metrics      Metrics              `json:"metrics"`
}

func (s *Service) Standings(ctx context.Context, divisionID string) (*StandingsView, error) {
	sc, err := s.ResolveScope(ctx, divisionID)
	if err != nil {
		return nil, err
	}
	v := &StandingsView{Scope: sc, Rows: []domain.StandingRow{}}
	if sc.Division == nil {
		return v, nil
	}
	if v.Rows, err = s.table(ctx, s.store, sc.Division.ID); err != nil {
		return nil, s.wrap(err, "standings")
	}
	v.PlayoffSpots = sc.Division.PlayoffSpots
	v.Metrics = metricsFrom(v.Rows)
	v.Metrics.Clubs = len(v.Rows)
	all, err := s.store.ListMatches(ctx, store.MatchFilter{DivisionID: sc.Division.ID, Stage: domain.StageLeague})
	if err != nil {
		return nil, s.wrap(err, "matches")
	}
	for _, m := range all {
		if m.Matchweek > v.Metrics.TotalWeeks {
			v.Metrics.TotalWeeks = m.Matchweek
		}
		if m.Played() && m.Matchweek > v.Metrics.LastMatchweek {
			v.Metrics.LastMatchweek = m.Matchweek
		}
	}
	return v, nil
}

type MatchesView struct {
	Scope   *Scope         `json:"scope"`
	Matches []domain.Match `json:"matches"`
}

// Matches lists a division's matches. state is "results", "upcoming" or "".
func (s *Service) Matches(ctx context.Context, divisionID, state, clubID string) (*MatchesView, error) {
	sc, err := s.ResolveScope(ctx, divisionID)
	if err != nil {
		return nil, err
	}
	v := &MatchesView{Scope: sc, Matches: []domain.Match{}}
	if sc.Division == nil {
		return v, nil
	}
	v.Matches, err = s.store.ListMatches(ctx, store.MatchFilter{DivisionID: sc.Division.ID, State: state, ClubID: clubID, Newest: state == "results"})
	return v, s.wrap(err, "matches")
}

// ---- one match --------------------------------------------------------------

type SheetPlayer struct {
	Index       int    `json:"index"`
	Position    string `json:"position"`
	PlayerID    string `json:"player_id"`
	Gamertag    string `json:"gamertag"`
	ShirtNumber *int   `json:"shirt_number"`
}

// SheetView is a submitted team sheet with names, for the public match page.
type SheetView struct {
	ClubID    string        `json:"club_id"`
	Formation string        `json:"formation"`
	Captain   string        `json:"captain_player_id"`
	Starters  []SheetPlayer `json:"starters"`
	Bench     []SheetPlayer `json:"bench"`
}

type MatchDetail struct {
	Match  domain.Match        `json:"match"`
	Stats  []domain.PlayerStat `json:"stats"`
	Sheets []SheetView         `json:"sheets"`
}

func (s *Service) sheetView(ctx context.Context, sh *domain.TeamSheet) (*SheetView, error) {
	ids := make([]string, 0, len(sh.Starters)+len(sh.Bench))
	for _, st := range sh.Starters {
		ids = append(ids, st.PlayerID)
	}
	ids = append(ids, sh.Bench...)
	names, err := s.store.PlayersByIDs(ctx, ids, sh.ClubID)
	if err != nil {
		return nil, err
	}
	v := &SheetView{ClubID: sh.ClubID, Formation: sh.Formation, Starters: []SheetPlayer{}, Bench: []SheetPlayer{}}
	if sh.CaptainPlayerID != nil {
		v.Captain = *sh.CaptainPlayerID
	}
	for _, st := range sh.Starters {
		n := names[st.PlayerID]
		v.Starters = append(v.Starters, SheetPlayer{Index: st.Index, Position: st.Position, PlayerID: st.PlayerID, Gamertag: n.Gamertag, ShirtNumber: n.ShirtNumber})
	}
	for _, id := range sh.Bench {
		n := names[id]
		v.Bench = append(v.Bench, SheetPlayer{Position: n.Position, PlayerID: id, Gamertag: n.Gamertag, ShirtNumber: n.ShirtNumber})
	}
	return v, nil
}

// MatchDetail is a match with its player stats and, once kick-off has passed, the
// two submitted team sheets.
func (s *Service) MatchDetail(ctx context.Context, id string) (*MatchDetail, error) {
	m, err := s.store.GetMatch(ctx, id)
	if err != nil {
		return nil, s.wrap(err, "Match")
	}
	d := &MatchDetail{Match: *m, Sheets: []SheetView{}}
	if d.Stats, err = s.store.ListMatchStats(ctx, id); err != nil {
		return nil, s.wrap(err, "stats")
	}
	revealed := m.Played() || (m.KickoffAt != nil && !m.KickoffAt.After(s.now()))
	if revealed {
		for _, cid := range []*string{m.HomeClubID, m.AwayClubID} {
			if cid == nil {
				continue
			}
			sh, err := s.store.GetSheet(ctx, id, *cid)
			if errors.Is(err, store.ErrNotFound) || (err == nil && sh.Status != domain.SheetSubmitted) {
				continue
			}
			if err != nil {
				return nil, s.wrap(err, "team sheet")
			}
			v, err := s.sheetView(ctx, sh)
			if err != nil {
				return nil, s.wrap(err, "team sheet")
			}
			d.Sheets = append(d.Sheets, *v)
		}
	}
	return d, nil
}

// ---- clubs ------------------------------------------------------------------

type ClubProfile struct {
	Club       domain.Club                `json:"club"`
	Scope      *Scope                     `json:"scope"`
	Standing   *domain.StandingRow        `json:"standing"`
	Recent     []domain.Match             `json:"recent"`
	Upcoming   []domain.Match             `json:"upcoming"`
	Squad      []domain.PlayerSeasonStats `json:"squad"`
	StartingXI *SheetView                 `json:"starting_xi"`
}

func (s *Service) ClubProfile(ctx context.Context, slug string) (*ClubProfile, error) {
	season, err := s.store.CurrentSeason(ctx)
	var seasonID *string
	if err == nil {
		seasonID = &season.ID
	}
	club, err := s.store.GetClubBySlug(ctx, slug, seasonID)
	if err != nil {
		return nil, s.wrap(err, "Club")
	}
	p := &ClubProfile{Club: *club, Recent: []domain.Match{}, Upcoming: []domain.Match{}, Squad: []domain.PlayerSeasonStats{}}
	if club.DivisionID == nil {
		return p, nil
	}
	if p.Scope, err = s.ResolveScope(ctx, *club.DivisionID); err != nil {
		return nil, err
	}
	rows, err := s.table(ctx, s.store, *club.DivisionID)
	if err != nil {
		return nil, s.wrap(err, "standings")
	}
	for i := range rows {
		if rows[i].Club.ID == club.ID {
			p.Standing = &rows[i]
		}
	}
	if p.Recent, err = s.store.ListMatches(ctx, store.MatchFilter{DivisionID: *club.DivisionID, ClubID: club.ID, State: "results", Newest: true, Limit: 5}); err != nil {
		return nil, s.wrap(err, "matches")
	}
	if p.Upcoming, err = s.store.ListMatches(ctx, store.MatchFilter{DivisionID: *club.DivisionID, ClubID: club.ID, State: "upcoming", Limit: 5}); err != nil {
		return nil, s.wrap(err, "matches")
	}
	if p.Squad, err = s.store.PlayerSeasonStats(ctx, store.PlayerStatsFilter{DivisionID: *club.DivisionID, ClubID: club.ID}); err != nil {
		return nil, s.wrap(err, "squad")
	}
	if sh, err := s.store.LastSubmittedSheet(ctx, club.ID); err == nil {
		if v, err := s.sheetView(ctx, sh); err == nil {
			p.StartingXI = v
		}
	}
	return p, nil
}

// ---- players ----------------------------------------------------------------

type PlayerStatsView struct {
	Scope   *Scope                     `json:"scope"`
	Players []domain.PlayerSeasonStats `json:"players"`
}

// PlayerStats lists a division's players with their numbers.
func (s *Service) PlayerStats(ctx context.Context, divisionID, clubID, query string) (*PlayerStatsView, error) {
	sc, err := s.ResolveScope(ctx, divisionID)
	if err != nil {
		return nil, err
	}
	v := &PlayerStatsView{Scope: sc, Players: []domain.PlayerSeasonStats{}}
	if sc.Division == nil {
		return v, nil
	}
	v.Players, err = s.store.PlayerSeasonStats(ctx, store.PlayerStatsFilter{DivisionID: sc.Division.ID, ClubID: clubID, Query: query})
	return v, s.wrap(err, "stats")
}

type PlayerProfile struct {
	Player domain.Player             `json:"player"`
	Season *domain.PlayerSeasonStats `json:"season"`
	Recent []store.PlayerMatchLine   `json:"recent"`
}

func (s *Service) PlayerProfile(ctx context.Context, id string) (*PlayerProfile, error) {
	p, err := s.store.GetPlayer(ctx, id)
	if err != nil {
		return nil, s.wrap(err, "Player")
	}
	prof := &PlayerProfile{Player: *p}
	if p.ClubID != nil {
		if season, err := s.store.CurrentSeason(ctx); err == nil {
			if d, err := s.store.DivisionOfClub(ctx, *p.ClubID, season.ID); err == nil {
				stats, err := s.store.PlayerSeasonStats(ctx, store.PlayerStatsFilter{DivisionID: d.ID, ClubID: *p.ClubID})
				if err != nil {
					return nil, s.wrap(err, "stats")
				}
				for i := range stats {
					if stats[i].PlayerID == id {
						prof.Season = &stats[i]
					}
				}
			}
		}
	}
	if prof.Recent, err = s.store.PlayerMatchLines(ctx, id, 10); err != nil {
		return nil, s.wrap(err, "matches")
	}
	return prof, nil
}

// ---- playoffs ---------------------------------------------------------------

type BracketView struct {
	Scope    *Scope          `json:"scope"`
	Semis    []domain.Match  `json:"semis"`
	Final    *domain.Match   `json:"final"`
	Champion *domain.ClubRef `json:"champion"`
}

func (s *Service) Bracket(ctx context.Context, divisionID string) (*BracketView, error) {
	sc, err := s.ResolveScope(ctx, divisionID)
	if err != nil {
		return nil, err
	}
	v := &BracketView{Scope: sc, Semis: []domain.Match{}}
	if sc.Division == nil {
		return v, nil
	}
	if v.Semis, err = s.store.ListMatches(ctx, store.MatchFilter{DivisionID: sc.Division.ID, Stage: domain.StageSemi}); err != nil {
		return nil, s.wrap(err, "matches")
	}
	finals, err := s.store.ListMatches(ctx, store.MatchFilter{DivisionID: sc.Division.ID, Stage: domain.StageFinal})
	if err != nil {
		return nil, s.wrap(err, "matches")
	}
	if len(finals) > 0 {
		v.Final = &finals[0]
	}
	v.Champion, err = s.champion(ctx, sc.Division.ID)
	return v, s.wrap(err, "champion")
}
