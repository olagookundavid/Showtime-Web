package services

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

func ptrInt(v int) *int          { return &v }
func ptrString(s string) *string { return &s }

// detailFixture: Ada (a receiver at club c1) plays games in GW1, GW1 and GW3 and
// misses GW2. Bayo is another receiver, so Ada has a position to be ranked in.
func detailFixture() (fantasyDetailInput, map[string]float64) {
	pts := map[string]float64{}
	mk := func(match, player, team string, rec, recTD int) ports.GameweekPlayerStat {
		st := domain.PlayerStat{PlayerID: player, MatchID: match, TeamID: team, Receptions: rec, ReceivingTDs: recTD,
			MatchDate: time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)}
		pts[player+"/"+match] = domain.FantasyWeights{}.Calculate(st).NetTotal
		return ports.GameweekPlayerStat{Stat: st}
	}
	g1 := mk("m1", "ada", "c1", 4, 1)
	g1.GameweekID = "gw1"
	g2 := mk("m2", "ada", "c1", 2, 0)
	g2.GameweekID = "gw1"
	g3 := mk("m3", "ada", "c1", 6, 2)
	g3.GameweekID = "gw3"
	b1 := mk("m1", "bayo", "c2", 3, 0)
	b1.GameweekID = "gw1"

	board := leaderboardInput{
		gameweeks: []domain.FantasyGameweek{{ID: "gw1", Number: 1}, {ID: "gw2", Number: 2}, {ID: "gw3", Number: 3}},
		players: []ports.LeaderboardPlayerRow{
			{PlayerID: "ada", Name: "Ada", Position: "Receiver", Gender: "F", TeamID: "c1", TeamShortName: "LAK", TeamActive: true, PlayerStatus: "active", Price: 11, OpeningPrice: 10, OwnedNow: 3},
			{PlayerID: "bayo", Name: "Bayo", Position: "Receiver", Gender: "M", TeamID: "c2", TeamShortName: "HNS", TeamActive: true, PlayerStatus: "active", Price: 5, OpeningPrice: 5, OwnedNow: 1},
		},
		stats:      []ports.GameweekPlayerStat{g1, g2, g3, b1},
		starts:     []ports.GameweekStarts{{GameweekID: "gw1", Locked: 4, ByPlayer: map[string]int{"ada": 3}}, {GameweekID: "gw3", Locked: 4, ByPlayer: map[string]int{"ada": 1}}},
		squadCount: 4,
	}
	finished := func(match, gw string, ms ports.GameweekPlayerStat, home bool, mine, theirs int) ports.PlayerMatchStat {
		p := ports.PlayerMatchStat{GameweekID: gw, Stat: ms.Stat, MatchStatus: "FINISHED"}
		if home {
			p.HomeTeamID, p.HomeShort, p.AwayTeamID, p.AwayShort = "c1", "LAK", "c2", "HNS"
			p.HomeScore, p.AwayScore = ptrInt(mine), ptrInt(theirs)
		} else {
			p.HomeTeamID, p.HomeShort, p.AwayTeamID, p.AwayShort = "c2", "HNS", "c1", "LAK"
			p.HomeScore, p.AwayScore = ptrInt(theirs), ptrInt(mine)
		}
		return p
	}
	// Newest first, the order GetPlayerPriceHistory really returns.
	history := []dto.PlayerPriceHistoryItem{
		{GameweekID: ptrString("gw3"), GameweekNumber: 3, Price: 11, Change: -1},
		{GameweekID: ptrString("gw1"), GameweekNumber: 1, Price: 12, Change: 2},
		{GameweekNumber: 0, GameweekLabel: "Opening Price", Price: 10},
	}
	return fantasyDetailInput{
		board:    board,
		playerID: "ada",
		matches: []ports.PlayerMatchStat{
			finished("m1", "gw1", g1, true, 24, 18),
			finished("m2", "gw1", g2, false, 12, 30),
			finished("m3", "gw3", g3, true, 6, 6),
		},
		history: history,
	}, pts
}

func TestFantasyPlayerDetailGamesAndGameweeks(t *testing.T) {
	in, pts := detailFixture()
	d, err := buildFantasyPlayerDetail(in)
	if err != nil {
		t.Fatal(err)
	}

	if len(d.Matches) != 3 {
		t.Fatalf("games = %d, want 3", len(d.Matches))
	}
	for i, m := range d.Matches {
		if m.GameNumber != i+1 {
			t.Errorf("game %d numbered %d", i+1, m.GameNumber)
		}
		if !near(m.Points, pts["ada/"+m.MatchID]) {
			t.Errorf("game %d points = %v, want %v from the engine", i+1, m.Points, pts["ada/"+m.MatchID])
		}
	}
	// Opponent and result are read from the player's side, home or away.
	g1, g2, g3 := d.Matches[0], d.Matches[1], d.Matches[2]
	if g1.Opponent.ShortName != "HNS" || !g1.Home || g1.Result != "W 24-18" {
		t.Errorf("game 1 = %+v", g1)
	}
	if g2.Opponent.ShortName != "HNS" || g2.Home || g2.Result != "L 12-30" {
		t.Errorf("game 2 (away) = %+v", g2)
	}
	if g3.Result != "D 6-6" {
		t.Errorf("game 3 result = %q, want D 6-6", g3.Result)
	}
	if len(g1.Scoring) == 0 || g1.Scoring[0].Points <= 0 {
		t.Errorf("a game should list what scored, biggest first: %+v", g1.Scoring)
	}

	// Every played gameweek is listed, with zero games where the player missed it.
	if len(d.Gameweeks) != 2 {
		// GW2 has no stats from anyone, so the league never played it.
		t.Fatalf("gameweeks = %d, want the 2 with stats", len(d.Gameweeks))
	}
	gw1, gw3 := d.Gameweeks[0], d.Gameweeks[1]
	if gw1.Games != 2 || !near(gw1.Points, pts["ada/m1"]+pts["ada/m2"]) {
		t.Errorf("GW1 = %+v", gw1)
	}
	if gw1.StartedBy != 3 || gw1.StartedByPct != 75 || gw1.Price != 12 || gw1.PriceChange != 2 {
		t.Errorf("GW1 started/price = %+v", gw1)
	}
	if gw3.Games != 1 || gw3.StartedByPct != 25 || gw3.Price != 11 || gw3.PriceChange != -1 {
		t.Errorf("GW3 = %+v", gw3)
	}

	// The headline matches the leaderboard's own figure for the same player.
	board, _ := buildPlayerLeaderboard(in.board, dto.PlayerLeaderboardQuery{Limit: 100})
	for _, row := range board.Data {
		if row.PlayerID == "ada" && (!near(row.Points, d.Summary.Points) || row.Rank != d.Summary.Rank) {
			t.Errorf("detail says %v pts rank %d, leaderboard says %v pts rank %d", d.Summary.Points, d.Summary.Rank, row.Points, row.Rank)
		}
	}
	if d.Summary.Rank != 1 || d.PositionRank != 1 || d.PositionSize != 2 {
		t.Errorf("rank %d, position rank %d of %d; want 1 and 1 of 2", d.Summary.Rank, d.PositionRank, d.PositionSize)
	}
}

func TestFantasyPlayerDetailGameweekFilter(t *testing.T) {
	in, pts := detailFixture()
	in.gameweekID = "gw3"
	d, err := buildFantasyPlayerDetail(in)
	if err != nil {
		t.Fatal(err)
	}
	if d.Gameweek == nil || d.Gameweek.Number != 3 {
		t.Fatalf("gameweek = %+v", d.Gameweek)
	}
	if len(d.Matches) != 1 || d.Matches[0].MatchID != "m3" {
		t.Errorf("only GW3's game should show, got %+v", d.Matches)
	}
	// The game keeps its place in the season: it was her third.
	if d.Matches[0].GameNumber != 3 {
		t.Errorf("game number = %d, want 3 (third of the season)", d.Matches[0].GameNumber)
	}
	if !near(d.Summary.Points, pts["ada/m3"]) {
		t.Errorf("headline points = %v, want GW3's %v", d.Summary.Points, pts["ada/m3"])
	}
	// The gameweek table does not shrink to the one chosen.
	if len(d.Gameweeks) != 2 {
		t.Errorf("gameweek table = %d rows, want all played gameweeks", len(d.Gameweeks))
	}

	in.gameweekID = "nope"
	if _, err := buildFantasyPlayerDetail(in); !errors.Is(err, ErrGameweekNotInSeason) {
		t.Errorf("unknown gameweek = %v, want ErrGameweekNotInSeason", err)
	}
}

func TestFantasyPlayerDetailFacts(t *testing.T) {
	in, pts := detailFixture()
	d, _ := buildFantasyPlayerDetail(in)
	byKey := map[string]dto.FantasyDetailFact{}
	for _, f := range d.Facts {
		byKey[f.Key] = f
	}

	if f := byKey["position_rank"]; f.Value != "#1 of 2" || f.Label != "Among receivers" {
		t.Errorf("position fact = %+v", f)
	}
	// Her best game is game 3 (6 receptions, 2 TDs), and it ended 6-6.
	best := byKey["best_game"]
	if best.Value != fmt.Sprintf("%.1f pts", pts["ada/m3"]) || !strings.Contains(best.Detail, "GW3 vs HNS (D 6-6)") {
		t.Errorf("best game fact = %+v (game 3 scored %v)", best, pts["ada/m3"])
	}
	if f, ok := byKey["worst_game"]; !ok || !strings.Contains(f.Detail, "GW1 vs HNS (L 12-30)") {
		t.Errorf("lowest game fact = %+v", f)
	}
	if f := byKey["points_from"]; !strings.Contains(f.Value, "Receiving TDs") {
		t.Errorf("points-from fact = %+v", f)
	}
	if f := byKey["price_range"]; f.Value != "₦10.0m to ₦12.0m" || !strings.Contains(f.Detail, "now ₦11.0m") {
		t.Errorf("price fact = %+v", f)
	}
	// Two players is too small a pool to call ownership and scoring "different".
	if _, ok := byKey["points_vs_ownership"]; ok {
		t.Error("the ownership comparison should need a real pool")
	}
	if len(d.Facts) > maxFantasyFacts {
		t.Errorf("%d facts, cap is %d", len(d.Facts), maxFantasyFacts)
	}
}

func TestFantasyPlayerDetailUnknownPlayerAndNoGames(t *testing.T) {
	in, _ := detailFixture()
	in.playerID = "ghost"
	if _, err := buildFantasyPlayerDetail(in); !errors.Is(err, ErrFantasyPlayerNotFound) {
		t.Errorf("unknown player = %v, want ErrFantasyPlayerNotFound", err)
	}

	// A priced player who has not played yet still gets a page, with no games.
	in, _ = detailFixture()
	in.board.players = append(in.board.players, ports.LeaderboardPlayerRow{PlayerID: "new", Name: "Newbie", Position: "Defender", TeamID: "c1", TeamActive: true, PlayerStatus: "active", Price: 3, OpeningPrice: 3})
	in.playerID, in.matches, in.history = "new", nil, nil
	d, err := buildFantasyPlayerDetail(in)
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Matches) != 0 || d.Summary.Appearances != 0 {
		t.Errorf("a player with no games = %+v", d.Matches)
	}
	for _, f := range d.Facts {
		if f.Key == "best_game" || f.Key == "worst_game" || f.Key == "points_from" || f.Key == "price_range" {
			t.Errorf("fact %q needs data this player does not have", f.Key)
		}
	}
	if len(d.Gameweeks) != 2 || d.Gameweeks[0].Games != 0 {
		t.Errorf("gameweeks should still list the played weeks with zero games: %+v", d.Gameweeks)
	}
}

func TestOpponentAndResultWithoutAMatchingClub(t *testing.T) {
	// A stat line whose club is on neither side must not claim a result.
	ms := ports.PlayerMatchStat{
		Stat:       domain.PlayerStat{TeamID: "elsewhere"},
		HomeTeamID: "a", HomeShort: "AAA", AwayTeamID: "b", AwayShort: "BBB",
		HomeScore: ptrInt(10), AwayScore: ptrInt(3), MatchStatus: "FINISHED",
	}
	_, _, result := opponentAndResult(ms)
	if result != "" {
		t.Errorf("result = %q, want none", result)
	}
	// An unfinished match has no result either.
	ms.Stat.TeamID, ms.MatchStatus = "a", "LIVE"
	if _, _, result := opponentAndResult(ms); result != "" {
		t.Errorf("a live match result = %q, want none", result)
	}
}
