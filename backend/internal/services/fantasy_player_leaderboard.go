package services

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

const (
	playerLeaderboardDefaultLimit = 25
	playerLeaderboardMaxLimit     = 100
	// formWindow is how many of the latest played gameweeks "form" averages.
	formWindow = 3
)

// ErrGameweekNotInSeason is returned when a leaderboard asks for a gameweek
// that belongs to another season.
var ErrGameweekNotInSeason = errors.New("that gameweek is not part of this season")

// GetPlayerLeaderboard ranks every player in the season by fantasy points.
//
// Points come from each player's own match stats through the same engine that
// scores lineups (FantasyWeights.Calculate), not from fantasy_gw_points. That
// log only has rows for players someone started, so reading it would show an
// unpicked player who had a big game on zero — the opposite of what a player
// leaderboard is for.
func (s *FantasyService) GetPlayerLeaderboard(ctx context.Context, seasonID string, q dto.PlayerLeaderboardQuery) (*dto.PlayerLeaderboardResponse, error) {
	gameweeks, err := s.repo.ListGameweeks(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	players, err := s.repo.ListLeaderboardPlayers(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	stats, err := s.repo.GetSeasonGameweekStats(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	starts, err := s.repo.GetSeasonLineupStarts(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	squadCount, err := s.repo.CountSeasonTeams(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	return buildPlayerLeaderboard(leaderboardInput{
		gameweeks:  gameweeks,
		players:    players,
		stats:      stats,
		starts:     starts,
		squadCount: squadCount,
	}, q)
}

type leaderboardInput struct {
	gameweeks  []domain.FantasyGameweek
	players    []ports.LeaderboardPlayerRow
	stats      []ports.GameweekPlayerStat
	starts     []ports.GameweekStarts
	squadCount int
}

// buildPlayerLeaderboard is the whole leaderboard as a pure function of its
// inputs, so the arithmetic is testable without a database.
func buildPlayerLeaderboard(in leaderboardInput, q dto.PlayerLeaderboardQuery) (*dto.PlayerLeaderboardResponse, error) {
	gwNumber := make(map[string]int, len(in.gameweeks))
	for _, gw := range in.gameweeks {
		gwNumber[gw.ID] = gw.Number
	}
	if q.GameweekID != "" {
		if _, ok := gwNumber[q.GameweekID]; !ok {
			return nil, ErrGameweekNotInSeason
		}
	}

	// 1. Score every stat line once. A player's own score is the full-match
	// total: the All-Rounder split (ForSlot) is about which slot a manager
	// used, and says nothing about how well the player played.
	calc := domain.FantasyWeights{}
	gwPoints := map[string]map[string]float64{} // player -> gameweek -> points
	matches := map[string]map[string]bool{}     // player -> matches appeared in
	played := map[string]bool{}                 // gameweeks with any stats
	for _, st := range in.stats {
		if _, ok := gwNumber[st.GameweekID]; !ok {
			continue
		}
		pid := st.Stat.PlayerID
		if gwPoints[pid] == nil {
			gwPoints[pid] = map[string]float64{}
			matches[pid] = map[string]bool{}
		}
		gwPoints[pid][st.GameweekID] += calc.Calculate(st.Stat).NetTotal
		matches[pid][st.Stat.MatchID] = true
		played[st.GameweekID] = true
	}

	playedGWs := make([]dto.PlayerLeaderboardGameweek, 0, len(played))
	for id := range played {
		playedGWs = append(playedGWs, dto.PlayerLeaderboardGameweek{ID: id, Number: gwNumber[id]})
	}
	sort.Slice(playedGWs, func(i, j int) bool { return playedGWs[i].Number < playedGWs[j].Number })

	// The gameweek the per-gameweek columns describe: the one asked for, or
	// the latest played when looking at the season.
	var focus *dto.PlayerLeaderboardGameweek
	if q.GameweekID != "" {
		focus = &dto.PlayerLeaderboardGameweek{ID: q.GameweekID, Number: gwNumber[q.GameweekID]}
	} else if len(playedGWs) > 0 {
		last := playedGWs[len(playedGWs)-1]
		focus = &last
	}

	formGWs := playedGWs
	if len(formGWs) > formWindow {
		formGWs = formGWs[len(formGWs)-formWindow:]
	}

	startsByGW := make(map[string]ports.GameweekStarts, len(in.starts))
	seasonStarts := map[string]int{}
	for _, gs := range in.starts {
		startsByGW[gs.GameweekID] = gs
		for pid, n := range gs.ByPlayer {
			seasonStarts[pid] += n
		}
	}

	// 2. One row per player.
	pool := make([]dto.PlayerLeaderboardItem, 0, len(in.players))
	for _, p := range in.players {
		item := dto.PlayerLeaderboardItem{
			PlayerID:      p.PlayerID,
			PlayerName:    p.Name,
			PlayerImage:   p.Image,
			Position:      p.Position,
			Gender:        domain.NormalizeGender(p.Gender),
			TeamID:        p.TeamID,
			TeamName:      p.TeamName,
			TeamShortName: p.TeamShortName,
			TeamLogo:      p.TeamLogo,
			Price:         round2(p.Price),
			OwnedBy:       p.OwnedNow,
			TransfersIn:   p.BoughtTotal,
			TransfersOut:  p.SoldTotal,
			SeasonStarts:  seasonStarts[p.PlayerID],
			Available:     true,
		}
		if p.OpeningPrice > 0 {
			item.PriceChange = round2(p.Price - p.OpeningPrice)
		}
		switch {
		case p.PlayerStatus != "" && p.PlayerStatus != "active":
			item.Available, item.UnavailableReason = false, "Deactivated"
		case !p.TeamActive:
			item.Available, item.UnavailableReason = false, "Club inactive"
		case p.IsReserve:
			item.Available, item.UnavailableReason = false, "Club reserve"
		}

		var season, best float64
		for _, pts := range gwPoints[p.PlayerID] {
			season += pts
			if pts > best {
				best = pts
			}
		}
		item.SeasonPoints = round2(season)
		item.BestGameweek = round2(best)
		item.Appearances = len(matches[p.PlayerID])
		if item.Appearances > 0 {
			item.PointsPerGame = round2(season / float64(item.Appearances))
		}
		if p.Price > 0 {
			item.Value = round2(season / p.Price)
		}
		if len(formGWs) > 0 {
			var sum float64
			for _, gw := range formGWs {
				sum += gwPoints[p.PlayerID][gw.ID]
			}
			item.Form = round2(sum / float64(len(formGWs)))
		}
		if focus != nil {
			item.GameweekPoints = round2(gwPoints[p.PlayerID][focus.ID])
			gs := startsByGW[focus.ID]
			item.StartedBy = gs.ByPlayer[p.PlayerID]
			if gs.Locked > 0 {
				item.StartedByPct = round1(float64(item.StartedBy) / float64(gs.Locked) * 100)
			}
		}
		if in.squadCount > 0 {
			item.SelectedByPct = round1(float64(p.OwnedNow) / float64(in.squadCount) * 100)
		}

		item.Points = item.SeasonPoints
		if q.GameweekID != "" {
			item.Points = item.GameweekPoints
		}
		pool = append(pool, item)
	}

	// 3. Rank the whole pool by points before any filter, so a search shows a
	// player's real standing. Ties share a rank (1, 1, 3).
	sort.SliceStable(pool, func(i, j int) bool { return byPointsThenName(pool[i], pool[j]) })
	for i := range pool {
		if i > 0 && pool[i].Points == pool[i-1].Points {
			pool[i].Rank = pool[i-1].Rank
		} else {
			pool[i].Rank = i + 1
		}
	}

	resp := &dto.PlayerLeaderboardResponse{
		Gameweek:        focus,
		PlayedGameweeks: playedGWs,
		SquadCount:      in.squadCount,
		Highlights:      leaderboardHighlights(pool),
	}
	resp.Teams, resp.Positions = leaderboardFilterOptions(pool)

	// 4. Filter, sort, page.
	filtered := filterLeaderboard(pool, q)
	sortLeaderboard(filtered, q.Sort)

	limit := q.Limit
	if limit <= 0 {
		limit = playerLeaderboardDefaultLimit
	}
	if limit > playerLeaderboardMaxLimit {
		limit = playerLeaderboardMaxLimit
	}
	page := q.Page
	if page < 1 {
		page = 1
	}
	resp.Total = len(filtered)
	resp.Limit = limit
	resp.Page = page
	resp.TotalPages = (resp.Total + limit - 1) / limit
	start := (page - 1) * limit
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	resp.Data = filtered[start:end]
	return resp, nil
}

func byPointsThenName(a, b dto.PlayerLeaderboardItem) bool {
	if a.Points != b.Points {
		return a.Points > b.Points
	}
	if a.PlayerName != b.PlayerName {
		return a.PlayerName < b.PlayerName
	}
	return a.PlayerID < b.PlayerID
}

func filterLeaderboard(pool []dto.PlayerLeaderboardItem, q dto.PlayerLeaderboardQuery) []dto.PlayerLeaderboardItem {
	search := strings.ToLower(strings.TrimSpace(q.Search))
	position := strings.TrimSpace(q.Position)
	gender := ""
	if strings.TrimSpace(q.Gender) != "" {
		gender = domain.NormalizeGender(q.Gender)
	}
	out := make([]dto.PlayerLeaderboardItem, 0, len(pool))
	for _, p := range pool {
		if search != "" &&
			!strings.Contains(strings.ToLower(p.PlayerName), search) &&
			!strings.Contains(strings.ToLower(p.TeamShortName), search) &&
			!strings.Contains(strings.ToLower(p.TeamName), search) {
			continue
		}
		if position != "" && !strings.EqualFold(p.Position, position) {
			continue
		}
		if q.TeamID != "" && p.TeamID != q.TeamID {
			continue
		}
		if gender != "" && p.Gender != gender {
			continue
		}
		out = append(out, p)
	}
	return out
}

// leaderboardSortKeys maps a sort name to the figure it orders by, highest
// first. "name" is handled separately (A–Z).
var leaderboardSortKeys = map[string]func(dto.PlayerLeaderboardItem) float64{
	"points":          func(p dto.PlayerLeaderboardItem) float64 { return p.Points },
	"season_points":   func(p dto.PlayerLeaderboardItem) float64 { return p.SeasonPoints },
	"gameweek_points": func(p dto.PlayerLeaderboardItem) float64 { return p.GameweekPoints },
	"form":            func(p dto.PlayerLeaderboardItem) float64 { return p.Form },
	"ppg":             func(p dto.PlayerLeaderboardItem) float64 { return p.PointsPerGame },
	"value":           func(p dto.PlayerLeaderboardItem) float64 { return p.Value },
	"selected":        func(p dto.PlayerLeaderboardItem) float64 { return p.SelectedByPct },
	"started":         func(p dto.PlayerLeaderboardItem) float64 { return p.StartedByPct },
	"transfers_in":    func(p dto.PlayerLeaderboardItem) float64 { return float64(p.TransfersIn) },
	"transfers_out":   func(p dto.PlayerLeaderboardItem) float64 { return float64(p.TransfersOut) },
	"price":           func(p dto.PlayerLeaderboardItem) float64 { return p.Price },
	"price_change":    func(p dto.PlayerLeaderboardItem) float64 { return p.PriceChange },
	"appearances":     func(p dto.PlayerLeaderboardItem) float64 { return float64(p.Appearances) },
}

func sortLeaderboard(rows []dto.PlayerLeaderboardItem, sortBy string) {
	if sortBy == "name" {
		sort.SliceStable(rows, func(i, j int) bool {
			if rows[i].PlayerName != rows[j].PlayerName {
				return rows[i].PlayerName < rows[j].PlayerName
			}
			return rows[i].PlayerID < rows[j].PlayerID
		})
		return
	}
	key, ok := leaderboardSortKeys[sortBy]
	if !ok {
		key = leaderboardSortKeys["points"]
	}
	sort.SliceStable(rows, func(i, j int) bool {
		a, b := key(rows[i]), key(rows[j])
		if a != b {
			return a > b
		}
		return byPointsThenName(rows[i], rows[j])
	})
}

// leaderboardHighlights picks the headline players over the whole pool. A card
// whose best figure is zero is left out: "Top scorer: 0 pts" says nothing.
func leaderboardHighlights(pool []dto.PlayerLeaderboardItem) []dto.PlayerLeaderboardHighlight {
	cards := []struct {
		key, label string
		value      func(dto.PlayerLeaderboardItem) float64
	}{
		{"top_scorer", "Top scorer", func(p dto.PlayerLeaderboardItem) float64 { return p.Points }},
		{"in_form", "In form", func(p dto.PlayerLeaderboardItem) float64 { return p.Form }},
		{"most_selected", "Most selected", func(p dto.PlayerLeaderboardItem) float64 { return p.SelectedByPct }},
		{"most_transferred_in", "Most transferred in", func(p dto.PlayerLeaderboardItem) float64 { return float64(p.TransfersIn) }},
		{"best_value", "Best value", func(p dto.PlayerLeaderboardItem) float64 { return p.Value }},
	}
	out := make([]dto.PlayerLeaderboardHighlight, 0, len(cards))
	for _, c := range cards {
		bestIdx := -1
		for i, p := range pool {
			if bestIdx == -1 || c.value(p) > c.value(pool[bestIdx]) {
				bestIdx = i
			}
		}
		if bestIdx == -1 || c.value(pool[bestIdx]) <= 0 {
			continue
		}
		player := pool[bestIdx]
		out = append(out, dto.PlayerLeaderboardHighlight{
			Key: c.key, Label: c.label, Value: c.value(player), Player: &player,
		})
	}
	return out
}

func leaderboardFilterOptions(pool []dto.PlayerLeaderboardItem) ([]dto.MarketFilterTeam, []string) {
	teams := []dto.MarketFilterTeam{}
	positions := []string{}
	seenTeam := map[string]bool{}
	seenPos := map[string]bool{}
	for _, p := range pool {
		if p.TeamID != "" && !seenTeam[p.TeamID] {
			seenTeam[p.TeamID] = true
			teams = append(teams, dto.MarketFilterTeam{
				ID: p.TeamID, Name: p.TeamName, ShortName: p.TeamShortName, Logo: p.TeamLogo,
			})
		}
		if p.Position != "" && p.Position != "-" && !seenPos[p.Position] {
			seenPos[p.Position] = true
			positions = append(positions, p.Position)
		}
	}
	sort.Slice(teams, func(i, j int) bool {
		a, b := teams[i].ShortName, teams[j].ShortName
		if a == "" {
			a = teams[i].Name
		}
		if b == "" {
			b = teams[j].Name
		}
		if a != b {
			return a < b
		}
		return teams[i].ID < teams[j].ID
	})
	sort.Strings(positions)
	return teams, positions
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }
func round1(v float64) float64 { return math.Round(v*10) / 10 }
