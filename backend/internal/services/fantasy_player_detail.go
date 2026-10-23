package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// ErrFantasyPlayerNotFound is returned for a player who is not in the season's
// fantasy pool: unknown, or with neither a fantasy price nor a stat line.
var ErrFantasyPlayerNotFound = errors.New("that player is not in this season's fantasy pool")

// maxFantasyFacts keeps the facts to the few worth reading.
const maxFantasyFacts = 6

// GetFantasyPlayerDetail is everything the fantasy player page shows: the same
// ranked figures as the leaderboard, plus the player's gameweeks, games, price
// history and a few notable facts. gameweekID narrows the headline figures and
// the game list to one gameweek; empty is the whole season.
func (s *FantasyService) GetFantasyPlayerDetail(ctx context.Context, seasonID, playerID, gameweekID string) (*dto.FantasyPlayerDetailResponse, error) {
	board, err := s.loadLeaderboardInput(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	matchStats, err := s.repo.GetPlayerMatchStats(ctx, seasonID, playerID)
	if err != nil {
		return nil, err
	}
	history, err := s.repo.GetPlayerPriceHistory(ctx, seasonID, playerID)
	if err != nil {
		// An unknown player id is the caller's mistake, not a server fault.
		if strings.Contains(err.Error(), "player not found") {
			return nil, ErrFantasyPlayerNotFound
		}
		return nil, err
	}
	return buildFantasyPlayerDetail(fantasyDetailInput{
		board:      board,
		playerID:   playerID,
		matches:    matchStats,
		history:    history.History,
		gameweekID: gameweekID,
	})
}

type fantasyDetailInput struct {
	board      leaderboardInput
	playerID   string
	matches    []ports.PlayerMatchStat
	history    []dto.PlayerPriceHistoryItem
	gameweekID string
}

// buildFantasyPlayerDetail is the whole detail page as a pure function of its
// inputs, so its arithmetic is testable without a database.
func buildFantasyPlayerDetail(in fantasyDetailInput) (*dto.FantasyPlayerDetailResponse, error) {
	ranked, err := rankPlayerPool(in.board, in.gameweekID)
	if err != nil {
		return nil, err
	}
	var me *dto.PlayerLeaderboardItem
	for i := range ranked.players {
		if ranked.players[i].PlayerID == in.playerID {
			me = &ranked.players[i]
			break
		}
	}
	if me == nil {
		return nil, ErrFantasyPlayerNotFound
	}

	gwNumber := make(map[string]int, len(in.board.gameweeks))
	for _, gw := range in.board.gameweeks {
		gwNumber[gw.ID] = gw.Number
	}

	// Every game, scored with the lineup engine: the player's own full-match
	// total, whether or not anyone started them.
	calc := domain.FantasyWeights{}
	allGames := make([]dto.FantasyDetailMatch, 0, len(in.matches))
	for _, ms := range in.matches {
		if _, ok := gwNumber[ms.GameweekID]; !ok {
			continue
		}
		b := calc.Calculate(ms.Stat)
		game := dto.FantasyDetailMatch{
			MatchID:        ms.Stat.MatchID,
			GameNumber:     len(allGames) + 1,
			GameweekID:     ms.GameweekID,
			GameweekNumber: gwNumber[ms.GameweekID],
			Date:           ms.Stat.MatchDate,
			Points:         round2(b.NetTotal),
			Scoring:        scoreLines(b),
		}
		game.Opponent, game.Home, game.Result = opponentAndResult(ms)
		allGames = append(allGames, game)
	}

	// Gameweeks: one row for every gameweek the league has played, so a week the
	// player missed shows as zero games rather than vanishing.
	priceAt := map[string]dto.PlayerPriceHistoryItem{}
	for _, h := range in.history {
		if h.GameweekID != nil {
			priceAt[*h.GameweekID] = h
		}
	}
	startsByGW := make(map[string]ports.GameweekStarts, len(in.board.starts))
	for _, gs := range in.board.starts {
		startsByGW[gs.GameweekID] = gs
	}
	pointsByGW := map[string]float64{}
	gamesByGW := map[string]int{}
	for _, g := range allGames {
		pointsByGW[g.GameweekID] += g.Points
		gamesByGW[g.GameweekID]++
	}
	gameweeks := make([]dto.FantasyDetailGameweek, 0, len(ranked.played))
	for _, gw := range ranked.played {
		row := dto.FantasyDetailGameweek{
			ID:     gw.ID,
			Number: gw.Number,
			Points: round2(pointsByGW[gw.ID]),
			Games:  gamesByGW[gw.ID],
		}
		gs := startsByGW[gw.ID]
		row.StartedBy = gs.ByPlayer[in.playerID]
		if gs.Locked > 0 {
			row.StartedByPct = round1(float64(row.StartedBy) / float64(gs.Locked) * 100)
		}
		if h, ok := priceAt[gw.ID]; ok {
			row.Price, row.PriceChange = h.Price, h.Change
		}
		gameweeks = append(gameweeks, row)
	}

	// The games in the chosen view.
	games := allGames
	if in.gameweekID != "" {
		games = make([]dto.FantasyDetailMatch, 0, len(allGames))
		for _, g := range allGames {
			if g.GameweekID == in.gameweekID {
				games = append(games, g)
			}
		}
	}

	// Position rank over the same view as the headline figure.
	positionRank, positionSize := 1, 0
	for _, p := range ranked.players {
		if !strings.EqualFold(p.Position, me.Position) {
			continue
		}
		positionSize++
		if p.Points > me.Points {
			positionRank++
		}
	}

	resp := &dto.FantasyPlayerDetailResponse{
		Player: dto.FantasyDetailPlayer{
			ID:       me.PlayerID,
			Name:     me.PlayerName,
			Image:    me.PlayerImage,
			Position: me.Position,
			Gender:   me.Gender,
			Club: dto.FantasyDetailClub{
				ID: me.TeamID, Name: me.TeamName, ShortName: me.TeamShortName, Logo: me.TeamLogo,
			},
			Available:         me.Available,
			UnavailableReason: me.UnavailableReason,
		},
		Summary:      *me,
		PoolSize:     len(ranked.players),
		PositionRank: positionRank,
		PositionSize: positionSize,
		SquadCount:   in.board.squadCount,
		Gameweeks:    gameweeks,
		Matches:      games,
		PriceHistory: in.history,
	}
	if in.gameweekID != "" {
		resp.Gameweek = &dto.PlayerLeaderboardGameweek{ID: in.gameweekID, Number: gwNumber[in.gameweekID]}
	}
	resp.Facts = fantasyFacts(resp, ranked.players, in.gameweekID != "")
	return resp, nil
}

// opponentAndResult reads a match from the player's side: who they faced, whether
// they were at home, and the result once the match is finished.
func opponentAndResult(ms ports.PlayerMatchStat) (dto.FantasyDetailClub, bool, string) {
	home := ms.Stat.TeamID != "" && ms.Stat.TeamID == ms.HomeTeamID
	away := ms.Stat.TeamID != "" && ms.Stat.TeamID == ms.AwayTeamID
	homeClub := dto.FantasyDetailClub{ID: ms.HomeTeamID, Name: ms.HomeName, ShortName: ms.HomeShort, Logo: ms.HomeLogo}
	awayClub := dto.FantasyDetailClub{ID: ms.AwayTeamID, Name: ms.AwayName, ShortName: ms.AwayShort, Logo: ms.AwayLogo}

	var opponent dto.FantasyDetailClub
	var mine, theirs *int
	switch {
	case home:
		opponent, mine, theirs = awayClub, ms.HomeScore, ms.AwayScore
	case away:
		opponent, mine, theirs = homeClub, ms.AwayScore, ms.HomeScore
	default:
		// The stat line carries no club that matches the fixture: show the fixture
		// as it was played rather than guess a side.
		return awayClub, true, ""
	}
	result := ""
	if strings.EqualFold(ms.MatchStatus, "FINISHED") && mine != nil && theirs != nil {
		switch {
		case *mine > *theirs:
			result = fmt.Sprintf("W %d-%d", *mine, *theirs)
		case *mine < *theirs:
			result = fmt.Sprintf("L %d-%d", *mine, *theirs)
		default:
			result = fmt.Sprintf("D %d-%d", *mine, *theirs)
		}
	}
	return opponent, home, result
}

// scoreLines lists what earned or cost points in one game, biggest first and
// costs last, leaving out anything that scored nothing.
func scoreLines(b domain.FantasyPointsBreakdown) []dto.FantasyScoreLine {
	all := []dto.FantasyScoreLine{
		{Label: "Passing yards", Points: b.PassingYardsPts},
		{Label: "Passing TDs", Points: b.PassingTDsPts},
		{Label: "Interceptions thrown", Points: b.InterceptionsThrownPts},
		{Label: "Sacks taken", Points: b.QBSacksPts},
		{Label: "Rushing yards", Points: b.RushingYardsPts},
		{Label: "Rushing TDs", Points: b.RushingTDsPts},
		{Label: "Receptions", Points: b.ReceptionsPts},
		{Label: "Receiving yards", Points: b.ReceivingYardsPts},
		{Label: "Receiving TDs", Points: b.ReceivingTDsPts},
		{Label: "Drops", Points: b.DropsPts},
		{Label: "Extra points", Points: b.XPGoodPts},
		{Label: "Extra-point TDs", Points: b.ExtraPointTDsPts},
		{Label: "Bad snaps", Points: b.BadSnapsPts},
		{Label: "Flag pulls", Points: b.FlagPullsPts},
		{Label: "Pass deflections", Points: b.PassDeflectionsPts},
		{Label: "Interceptions", Points: b.InterceptionsPts},
		{Label: "Sacks", Points: b.DefSacksPts},
		{Label: "Defensive TDs", Points: b.DefensiveTDsPts},
		{Label: "Defensive extra-point TDs", Points: b.DefensiveXPTDsPts},
		{Label: "Safeties", Points: b.SafetyPts},
		{Label: "Safety conceded", Points: b.SafetyConcededPts},
	}
	out := make([]dto.FantasyScoreLine, 0, len(all))
	for _, l := range all {
		if math.Abs(l.Points) < 0.005 {
			continue
		}
		l.Points = round2(l.Points)
		out = append(out, l)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Points > out[j].Points })
	return out
}

// fantasyFacts picks the few things about a player worth saying that the
// headline figures do not already show. Each is left out when it has nothing to
// say, and the list is capped so the page never fills up with trivia.
func fantasyFacts(d *dto.FantasyPlayerDetailResponse, pool []dto.PlayerLeaderboardItem, gameweekView bool) []dto.FantasyDetailFact {
	var facts []dto.FantasyDetailFact
	scope := "this season"
	if gameweekView && d.Gameweek != nil {
		scope = fmt.Sprintf("in GW%d", d.Gameweek.Number)
	}

	// 1. Where they stand among their position.
	if d.PositionSize > 1 {
		facts = append(facts, dto.FantasyDetailFact{
			Key:    "position_rank",
			Label:  "Among " + strings.ToLower(pluralPosition(d.Player.Position)),
			Value:  fmt.Sprintf("#%d of %d", d.PositionRank, d.PositionSize),
			Detail: "by points " + scope,
		})
	}

	// 2. Best and worst game.
	if len(d.Matches) > 0 {
		best, worst := d.Matches[0], d.Matches[0]
		for _, m := range d.Matches {
			if m.Points > best.Points {
				best = m
			}
			if m.Points < worst.Points {
				worst = m
			}
		}
		facts = append(facts, dto.FantasyDetailFact{
			Key:    "best_game",
			Label:  "Best game",
			Value:  fmt.Sprintf("%.1f pts", best.Points),
			Detail: gameLabel(best),
		})
		if len(d.Matches) > 1 && worst.MatchID != best.MatchID {
			facts = append(facts, dto.FantasyDetailFact{
				Key:    "worst_game",
				Label:  "Lowest game",
				Value:  fmt.Sprintf("%.1f pts", worst.Points),
				Detail: gameLabel(worst),
			})
		}
	}

	// 3. Where the points come from, over the games in view.
	totals := map[string]float64{}
	for _, m := range d.Matches {
		for _, l := range m.Scoring {
			if l.Points > 0 {
				totals[l.Label] += l.Points
			}
		}
	}
	if len(totals) > 0 {
		type kv struct {
			k string
			v float64
		}
		list := make([]kv, 0, len(totals))
		for k, v := range totals {
			list = append(list, kv{k, v})
		}
		sort.Slice(list, func(i, j int) bool {
			if list[i].v != list[j].v {
				return list[i].v > list[j].v
			}
			return list[i].k < list[j].k
		})
		top := list
		if len(top) > 2 {
			top = top[:2]
		}
		parts := make([]string, 0, len(top))
		for _, e := range top {
			parts = append(parts, fmt.Sprintf("%s (%.1f)", e.k, e.v))
		}
		facts = append(facts, dto.FantasyDetailFact{
			Key:    "points_from",
			Label:  "Most points come from",
			Value:  strings.Join(parts, " and "),
			Detail: scope,
		})
	}

	// 4. Price swing across the season. The history arrives newest first (as the
	// price modal wants it), so order it by gameweek before reading the opening
	// and current prices.
	if len(d.PriceHistory) > 1 {
		ordered := append([]dto.PlayerPriceHistoryItem(nil), d.PriceHistory...)
		sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].GameweekNumber < ordered[j].GameweekNumber })
		lo, hi := ordered[0].Price, ordered[0].Price
		for _, h := range ordered {
			lo, hi = math.Min(lo, h.Price), math.Max(hi, h.Price)
		}
		opening := ordered[0].Price
		now := ordered[len(ordered)-1].Price
		if hi != lo || now != opening {
			facts = append(facts, dto.FantasyDetailFact{
				Key:    "price_range",
				Label:  "Price range",
				Value:  fmt.Sprintf("₦%.1fm to ₦%.1fm", lo, hi),
				Detail: fmt.Sprintf("opened at ₦%.1fm, now ₦%.1fm", opening, now),
			})
		}
	}

	// 5. Points rank against ownership rank, when the crowd and the scoring
	// disagree by a wide margin.
	ownRank, ahead := 1, 0
	for _, p := range pool {
		if p.OwnedBy > d.Summary.OwnedBy {
			ownRank++
		}
		if p.Points > d.Summary.Points {
			ahead++
		}
	}
	scoreRank := ahead + 1
	if len(pool) >= 20 && d.Summary.Points > 0 && (ownRank-scoreRank >= 10 || scoreRank-ownRank >= 10) {
		facts = append(facts, dto.FantasyDetailFact{
			Key:    "points_vs_ownership",
			Label:  "Points rank vs ownership rank",
			Value:  fmt.Sprintf("#%d for points, #%d for ownership", scoreRank, ownRank),
			Detail: "how the points compare with how many managers own them",
		})
	}

	if len(facts) > maxFantasyFacts {
		facts = facts[:maxFantasyFacts]
	}
	return facts
}

func gameLabel(m dto.FantasyDetailMatch) string {
	label := fmt.Sprintf("GW%d", m.GameweekNumber)
	if m.Opponent.ShortName != "" {
		label += " vs " + m.Opponent.ShortName
	} else if m.Opponent.Name != "" {
		label += " vs " + m.Opponent.Name
	}
	if m.Result != "" {
		label += " (" + m.Result + ")"
	}
	return label
}

func pluralPosition(pos string) string {
	pos = strings.TrimSpace(pos)
	switch {
	case pos == "" || pos == "-":
		return "players"
	case strings.HasSuffix(pos, "s"):
		return pos
	default:
		return pos + "s"
	}
}
