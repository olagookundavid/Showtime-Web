package service

import (
	"context"
	"math"
	"sort"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// StatLine is one player's numbers in a match, as an admin enters them.
type StatLine struct {
	PlayerID string   `json:"player_id"`
	ClubID   string   `json:"club_id"`
	Started  bool     `json:"started"`
	Goals    int      `json:"goals"`
	Assists  int      `json:"assists"`
	Rating   *float64 `json:"rating"`
	MOTM     bool     `json:"motm"`
}

// ResultInput is a match result. For a forfeit, ForfeitWinner is "home" or "away",
// the score is set to 3-0 for that side and no player stats are kept.
type ResultInput struct {
	HomeScore     int        `json:"home_score"`
	AwayScore     int        `json:"away_score"`
	PenaltyWinner string     `json:"penalty_winner"`
	ForfeitWinner string     `json:"forfeit_winner"`
	Stats         []StatLine `json:"stats"`
}

const maxScore = 99

// RecordResult saves a match's score and player stats in one transaction, and for
// a knockout match moves the winner into the next round.
func (s *Service) RecordResult(ctx context.Context, matchID string, in ResultInput) (*domain.Match, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockMatch(ctx, matchID); err != nil {
			return err
		}
		m, err := tx.GetMatch(ctx, matchID)
		if err != nil {
			return err
		}
		if m.HomeClubID == nil || m.AwayClubID == nil {
			return badRequest("This match is waiting for its clubs, so it can't have a result yet.")
		}

		status := domain.MatchCompleted
		home, away := in.HomeScore, in.AwayScore
		var penalty *string
		stats := in.Stats

		switch in.ForfeitWinner {
		case "":
			if home < 0 || away < 0 || home > maxScore || away > maxScore {
				return badRequest("Scores must be between 0 and %d.", maxScore)
			}
		case "home":
			status, home, away, stats = domain.MatchForfeit, 3, 0, nil
		case "away":
			status, home, away, stats = domain.MatchForfeit, 0, 3, nil
		default:
			return badRequest("The forfeit winner must be home or away.")
		}

		knockout := m.Stage != domain.StageLeague
		if in.PenaltyWinner != "" {
			if in.PenaltyWinner != "home" && in.PenaltyWinner != "away" {
				return badRequest("The penalty winner must be home or away.")
			}
			if !knockout || home != away {
				return badRequest("A penalty winner only applies to a knockout match that finished level.")
			}
			p := in.PenaltyWinner
			penalty = &p
		}
		if knockout && status == domain.MatchCompleted && home == away && penalty == nil {
			return badRequest("A knockout match can't end level. Say who won on penalties.")
		}

		// A knockout result can't change once the next round has been played.
		if m.FeedsMatchID != nil {
			next, err := tx.GetMatch(ctx, *m.FeedsMatchID)
			if err != nil {
				return err
			}
			if next.Played() {
				return conflict("The next round has already been played, so this result is locked.")
			}
		}

		lines, err := s.checkStats(ctx, tx, m, stats, home, away)
		if err != nil {
			return err
		}
		if err := tx.SetResult(ctx, matchID, status, home, away, penalty); err != nil {
			return err
		}
		if err := tx.ReplaceMatchStats(ctx, matchID, lines); err != nil {
			return err
		}
		return s.advanceWinner(ctx, tx, matchID)
	})
	if err != nil {
		return nil, s.wrap(err, "Match")
	}
	m, err := s.store.GetMatch(ctx, matchID)
	return m, s.wrap(err, "Match")
}

// checkStats validates the player lines against the score and the squads.
func (s *Service) checkStats(ctx context.Context, tx *store.Store, m *domain.Match, in []StatLine, home, away int) ([]domain.PlayerStat, error) {
	if len(in) == 0 {
		return nil, nil
	}
	existing, err := tx.ListMatchStats(ctx, m.ID)
	if err != nil {
		return nil, err
	}
	allowed := map[string]bool{} // "club:player"
	for _, e := range existing {
		allowed[e.ClubID+":"+e.PlayerID] = true
	}
	rosters := map[string]map[string]domain.RosterPlayer{}
	for _, cid := range []string{*m.HomeClubID, *m.AwayClubID} {
		r, _, err := tx.RosterMap(ctx, cid)
		if err != nil {
			return nil, err
		}
		rosters[cid] = r
	}

	score := map[string]int{*m.HomeClubID: home, *m.AwayClubID: away}
	goals := map[string]int{}
	assists := map[string]int{}
	rows := map[string]int{}
	seen := map[string]bool{}
	motms := 0
	out := make([]domain.PlayerStat, 0, len(in))

	for _, l := range in {
		if l.ClubID != *m.HomeClubID && l.ClubID != *m.AwayClubID {
			return nil, badRequest("A player line names a club that isn't in this match.")
		}
		if seen[l.PlayerID] {
			return nil, badRequest("A player appears twice in the stats.")
		}
		seen[l.PlayerID] = true
		if _, onSquad := rosters[l.ClubID][l.PlayerID]; !onSquad && !allowed[l.ClubID+":"+l.PlayerID] {
			return nil, badRequest("A player in the stats isn't on that club's squad.")
		}
		if l.Goals < 0 || l.Assists < 0 || l.Goals > maxScore || l.Assists > maxScore {
			return nil, badRequest("Goals and assists must be between 0 and %d.", maxScore)
		}
		var rating *float64
		if l.Rating != nil {
			r := math.Round(*l.Rating*10) / 10
			if r < 0 || r > 10 {
				return nil, badRequest("Ratings run from 0 to 10.")
			}
			rating = &r
		}
		if l.MOTM {
			motms++
		}
		goals[l.ClubID] += l.Goals
		assists[l.ClubID] += l.Assists
		rows[l.ClubID]++
		out = append(out, domain.PlayerStat{PlayerID: l.PlayerID, ClubID: l.ClubID, Started: l.Started, Goals: l.Goals, Assists: l.Assists, Rating: rating, MOTM: l.MOTM})
	}
	if motms > 1 {
		return nil, badRequest("Only one player can be man of the match.")
	}
	for cid, n := range rows {
		if n == 0 {
			continue
		}
		name := m.Home.Name
		if cid == *m.AwayClubID {
			name = m.Away.Name
		}
		if goals[cid] != score[cid] {
			return nil, badRequest("%s scored %d, but the players' goals add up to %d.", name, score[cid], goals[cid])
		}
		if assists[cid] > score[cid] {
			return nil, badRequest("%s scored %d, so they can't have %d assists.", name, score[cid], assists[cid])
		}
	}
	return out, nil
}

// advanceWinner puts a decided knockout match's winner into the match it feeds.
func (s *Service) advanceWinner(ctx context.Context, tx *store.Store, matchID string) error {
	m, err := tx.GetMatch(ctx, matchID)
	if err != nil {
		return err
	}
	if m.Stage == domain.StageLeague || m.FeedsMatchID == nil || m.FeedsSlot == nil {
		return nil
	}
	winner, err := domain.KnockoutWinner(*m)
	if err != nil {
		return nil // no decisive result (yet): nothing to advance
	}
	return tx.SetMatchClub(ctx, *m.FeedsMatchID, *m.FeedsSlot, &winner)
}

// ClearResult takes a result off a match (for a mistaken entry).
func (s *Service) ClearResult(ctx context.Context, matchID string) (*domain.Match, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockMatch(ctx, matchID); err != nil {
			return err
		}
		m, err := tx.GetMatch(ctx, matchID)
		if err != nil {
			return err
		}
		if !m.Played() {
			return badRequest("This match has no result to clear.")
		}
		if m.FeedsMatchID != nil && m.FeedsSlot != nil {
			next, err := tx.GetMatch(ctx, *m.FeedsMatchID)
			if err != nil {
				return err
			}
			if next.Played() {
				return conflict("The next round has already been played, so this result is locked.")
			}
			if err := tx.SetMatchClub(ctx, next.ID, *m.FeedsSlot, nil); err != nil {
				return err
			}
		}
		if err := tx.DeleteMatchStats(ctx, matchID); err != nil {
			return err
		}
		return tx.ClearResult(ctx, matchID)
	})
	if err != nil {
		return nil, s.wrap(err, "Match")
	}
	m, err := s.store.GetMatch(ctx, matchID)
	return m, s.wrap(err, "Match")
}

// ResultFormSide is one club's half of the result entry grid.
type ResultFormSide struct {
	Club    domain.ClubRef  `json:"club"`
	Players []ResultFormRow `json:"players"`
}

// ResultFormRow is a squad member with the numbers already entered for them (or a
// starting guess from the team sheet).
type ResultFormRow struct {
	PlayerID    string   `json:"player_id"`
	Gamertag    string   `json:"gamertag"`
	Position    string   `json:"position"`
	ShirtNumber *int     `json:"shirt_number"`
	Included    bool     `json:"included"`
	Started     bool     `json:"started"`
	Goals       int      `json:"goals"`
	Assists     int      `json:"assists"`
	Rating      *float64 `json:"rating"`
	MOTM        bool     `json:"motm"`
}

// ResultForm is everything the result screen needs.
type ResultForm struct {
	Match domain.Match   `json:"match"`
	Home  ResultFormSide `json:"home"`
	Away  ResultFormSide `json:"away"`
}

// ResultForm builds the result entry screen for a match. Players already in the
// match's stats come first with their numbers; otherwise the submitted team sheet
// pre-selects the starters and bench; otherwise the squad is listed unselected.
func (s *Service) ResultForm(ctx context.Context, matchID string) (*ResultForm, error) {
	m, err := s.store.GetMatch(ctx, matchID)
	if err != nil {
		return nil, s.wrap(err, "Match")
	}
	if m.Home == nil || m.Away == nil {
		return nil, badRequest("This match is waiting for its clubs.")
	}
	stats, err := s.store.ListMatchStats(ctx, matchID)
	if err != nil {
		return nil, s.wrap(err, "stats")
	}
	byPlayer := map[string]domain.PlayerStat{}
	for _, x := range stats {
		byPlayer[x.PlayerID] = x
	}

	build := func(club *domain.ClubRef) (ResultFormSide, error) {
		side := ResultFormSide{Club: *club, Players: []ResultFormRow{}}
		squad, err := s.store.Roster(ctx, club.ID)
		if err != nil {
			return side, err
		}
		sheet, err := s.store.GetSheet(ctx, matchID, club.ID)
		if err != nil && err != store.ErrNotFound {
			return side, err
		}
		starters, bench := map[string]bool{}, map[string]bool{}
		if sheet != nil && sheet.Status == domain.SheetSubmitted {
			for _, st := range sheet.Starters {
				starters[st.PlayerID] = true
			}
			for _, b := range sheet.Bench {
				bench[b] = true
			}
		}
		seen := map[string]bool{}
		add := func(id, tag, pos string, shirt *int) {
			row := ResultFormRow{PlayerID: id, Gamertag: tag, Position: pos, ShirtNumber: shirt}
			if x, ok := byPlayer[id]; ok && x.ClubID == club.ID {
				row.Included, row.Started, row.Goals, row.Assists, row.Rating, row.MOTM = true, x.Started, x.Goals, x.Assists, x.Rating, x.MOTM
			} else if len(stats) == 0 && (starters[id] || bench[id]) {
				row.Included, row.Started = true, starters[id]
			}
			seen[id] = true
			side.Players = append(side.Players, row)
		}
		for _, p := range squad {
			add(p.ID, p.Gamertag, p.PrimaryPosition, p.ShirtNumber)
		}
		// Someone who played but has since moved on still belongs to this match.
		for _, x := range stats {
			if x.ClubID == club.ID && !seen[x.PlayerID] {
				if p, err := s.store.GetPlayer(ctx, x.PlayerID); err == nil {
					add(p.ID, p.Gamertag, p.PrimaryPosition, nil)
				}
			}
		}
		sort.SliceStable(side.Players, func(i, j int) bool {
			a, b := side.Players[i], side.Players[j]
			if a.Included != b.Included {
				return a.Included
			}
			if a.Started != b.Started {
				return a.Started
			}
			return false
		})
		return side, nil
	}
	form := &ResultForm{Match: *m}
	if form.Home, err = build(m.Home); err != nil {
		return nil, s.wrap(err, "squad")
	}
	if form.Away, err = build(m.Away); err != nil {
		return nil, s.wrap(err, "squad")
	}
	return form, nil
}

// ---- playoffs --------------------------------------------------------------

// GeneratePlayoffs builds a division's knockout bracket from its final league
// table. The league must be finished.
func (s *Service) GeneratePlayoffs(ctx context.Context, divisionID string) ([]domain.Match, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.GetDivisionForUpdate(ctx, divisionID); err != nil {
			return err
		}
		d, err := tx.GetDivision(ctx, divisionID)
		if err != nil {
			return err
		}
		if d.PlayoffSpots == 0 {
			return badRequest("%s has no playoff places.", d.Name)
		}
		total, played, err := tx.CountMatches(ctx, divisionID, domain.StageLeague)
		if err != nil {
			return err
		}
		if total == 0 {
			return badRequest("%s has no league fixtures yet.", d.Name)
		}
		if played < total {
			return badRequest("%d league match(es) in %s still need a result before the playoffs.", total-played, d.Name)
		}
		for _, stage := range []string{domain.StageSemi, domain.StageFinal} {
			n, _, err := tx.CountMatches(ctx, divisionID, stage)
			if err != nil {
				return err
			}
			if n > 0 {
				return conflict("The playoffs for %s have already been made.", d.Name)
			}
		}

		table, err := s.table(ctx, tx, divisionID)
		if err != nil {
			return err
		}
		ranked := make([]string, 0, len(table))
		for _, r := range table {
			ranked = append(ranked, r.Club.ID)
		}
		plan, err := domain.PlanBracket(d.PlayoffSpots, ranked)
		if err != nil {
			return badRequest("%s", err.Error())
		}

		// Playoffs come the weekend after the last league matchweek, same slots.
		lastWeek, err := tx.ListMatches(ctx, store.MatchFilter{DivisionID: divisionID, Stage: domain.StageLeague, Newest: true, Limit: 1})
		if err != nil {
			return err
		}
		startAfter := s.today()
		if len(lastWeek) == 1 && lastWeek[0].KickoffAt != nil {
			startAfter = *lastWeek[0].KickoffAt
		}
		semiDay := nextKickoffDay(startAfter, d.KickoffDay)
		finalDay := semiDay
		if len(plan) > 1 {
			finalDay = semiDay.AddDate(0, 0, 7)
		}

		matchweek := 1
		if len(lastWeek) == 1 {
			matchweek = lastWeek[0].Matchweek + 1
		}

		ids := map[string]string{}
		for _, b := range plan {
			day := semiDay
			mw := matchweek
			if b.Stage == domain.StageFinal {
				day = finalDay
				if len(plan) > 1 {
					mw = matchweek + 1
				}
			}
			slot := 0
			if b.Key == "semi2" {
				slot = 1
			}
			ko := kickoffOn(day, d.KickoffSlots, slot)
			nm := store.NewMatch{SeasonID: d.SeasonID, DivisionID: divisionID, Stage: b.Stage, Matchweek: mw, KickoffAt: &ko}
			if b.HomeClubID != "" {
				h, a := b.HomeClubID, b.AwayClubID
				nm.HomeClubID, nm.AwayClubID = &h, &a
			}
			id, err := tx.InsertMatch(ctx, nm)
			if err != nil {
				return err
			}
			ids[b.Key] = id
		}
		for _, b := range plan {
			if b.FeedsKey != "" {
				if err := tx.SetFeeds(ctx, ids[b.Key], ids[b.FeedsKey], b.FeedsSlot); err != nil {
					return err
				}
			}
		}
		// The season moves into its playoffs the first time one is made.
		season, err := tx.GetSeasonForUpdate(ctx, d.SeasonID)
		if err != nil {
			return err
		}
		if season.Status == domain.SeasonActive {
			return tx.SetSeasonStatus(ctx, season.ID, domain.SeasonPlayoffs)
		}
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Division")
	}
	out := []domain.Match{}
	for _, stage := range []string{domain.StageSemi, domain.StageFinal} {
		ms, err := s.store.ListMatches(ctx, store.MatchFilter{DivisionID: divisionID, Stage: stage})
		if err != nil {
			return nil, s.wrap(err, "matches")
		}
		out = append(out, ms...)
	}
	return out, nil
}
