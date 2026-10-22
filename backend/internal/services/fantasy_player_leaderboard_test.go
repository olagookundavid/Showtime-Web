package services

import (
	"errors"
	"math"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// stat returns a stat line and the points the real engine gives it, so the
// tests follow the scoring weights instead of hardcoding them.
func stat(playerID, matchID string, receptions, recTDs int) (domain.PlayerStat, float64) {
	s := domain.PlayerStat{PlayerID: playerID, MatchID: matchID, Receptions: receptions, ReceivingTDs: recTDs}
	return s, domain.FantasyWeights{}.Calculate(s).NetTotal
}

func near(a, b float64) bool { return math.Abs(a-b) < 0.011 }

func leaderboardFixture() (leaderboardInput, map[string]float64) {
	gws := []domain.FantasyGameweek{
		{ID: "gw1", Number: 1}, {ID: "gw2", Number: 2}, {ID: "gw3", Number: 3}, {ID: "gw4", Number: 4},
	}
	players := []ports.LeaderboardPlayerRow{
		{PlayerID: "ada", Name: "Ada", Position: "Receiver", Gender: "F", TeamID: "c1", TeamShortName: "LAK", TeamActive: true, PlayerStatus: "active", Price: 8, OpeningPrice: 7, OwnedNow: 3, BoughtTotal: 4, SoldTotal: 1},
		{PlayerID: "bayo", Name: "Bayo", Position: "Receiver", Gender: "M", TeamID: "c2", TeamShortName: "HNS", TeamActive: true, PlayerStatus: "active", Price: 5, OpeningPrice: 5, OwnedNow: 1},
		// Nobody owns or starts Chidi — he must still rank on his own stats.
		{PlayerID: "chidi", Name: "Chidi", Position: "Defender", Gender: "M", TeamID: "c2", TeamShortName: "HNS", TeamActive: true, PlayerStatus: "active", Price: 4, OpeningPrice: 4, IsReserve: true},
		{PlayerID: "dayo", Name: "Dayo", Position: "QB", Gender: "M", TeamID: "c3", TeamActive: false, PlayerStatus: "active", Price: 6, OpeningPrice: 6},
	}

	exp := map[string]float64{}
	var stats []ports.GameweekPlayerStat
	add := func(gw string, s domain.PlayerStat, pts float64) {
		stats = append(stats, ports.GameweekPlayerStat{GameweekID: gw, Stat: s})
		exp[s.PlayerID+"/"+gw] += pts
	}
	// Ada: two matches in gw1, one in gw3.
	s, p := stat("ada", "m1", 4, 1)
	add("gw1", s, p)
	s, p = stat("ada", "m2", 2, 0)
	add("gw1", s, p)
	s, p = stat("ada", "m5", 3, 1)
	add("gw3", s, p)
	// Bayo: one match in gw2.
	s, p = stat("bayo", "m3", 5, 2)
	add("gw2", s, p)
	// Chidi: unpicked, big gw3.
	s, p = stat("chidi", "m6", 6, 2)
	add("gw3", s, p)

	starts := []ports.GameweekStarts{
		{GameweekID: "gw3", Locked: 4, ByPlayer: map[string]int{"ada": 3, "bayo": 1}},
		{GameweekID: "gw1", Locked: 2, ByPlayer: map[string]int{"ada": 2}},
	}
	return leaderboardInput{gameweeks: gws, players: players, stats: stats, starts: starts, squadCount: 4}, exp
}

func find(t *testing.T, rows []dto.PlayerLeaderboardItem, id string) dto.PlayerLeaderboardItem {
	t.Helper()
	for _, r := range rows {
		if r.PlayerID == id {
			return r
		}
	}
	t.Fatalf("player %s not in page", id)
	return dto.PlayerLeaderboardItem{}
}

func TestPlayerLeaderboardSeasonFigures(t *testing.T) {
	in, exp := leaderboardFixture()
	res, err := buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Limit: 100})
	if err != nil {
		t.Fatal(err)
	}

	ada := find(t, res.Data, "ada")
	adaSeason := exp["ada/gw1"] + exp["ada/gw3"]
	if !near(ada.SeasonPoints, adaSeason) || !near(ada.Points, adaSeason) {
		t.Errorf("Ada season = %v, want %v", ada.SeasonPoints, adaSeason)
	}
	if ada.Appearances != 3 {
		t.Errorf("Ada appearances = %d, want 3 (distinct matches)", ada.Appearances)
	}
	if !near(ada.PointsPerGame, adaSeason/3) {
		t.Errorf("Ada PPG = %v, want %v", ada.PointsPerGame, adaSeason/3)
	}
	if !near(ada.BestGameweek, math.Max(exp["ada/gw1"], exp["ada/gw3"])) {
		t.Errorf("Ada best GW = %v", ada.BestGameweek)
	}
	if !near(ada.Value, adaSeason/8) {
		t.Errorf("Ada value = %v, want %v", ada.Value, adaSeason/8)
	}
	if ada.PriceChange != 1 {
		t.Errorf("Ada price change = %v, want +1", ada.PriceChange)
	}
	if ada.SelectedByPct != 75 {
		t.Errorf("Ada selected = %v%%, want 75%% (3 of 4 squads)", ada.SelectedByPct)
	}
	if ada.SeasonStarts != 5 || ada.TransfersIn != 4 || ada.TransfersOut != 1 {
		t.Errorf("Ada starts/in/out = %d/%d/%d", ada.SeasonStarts, ada.TransfersIn, ada.TransfersOut)
	}

	// The season view's per-gameweek columns describe the latest played
	// gameweek (gw3), not the last one on the calendar (gw4 has no stats).
	if res.Gameweek == nil || res.Gameweek.ID != "gw3" {
		t.Fatalf("focus gameweek = %+v, want gw3", res.Gameweek)
	}
	if ada.StartedByPct != 75 {
		t.Errorf("Ada started in gw3 = %v%%, want 75%% (3 of 4 locked)", ada.StartedByPct)
	}
	if len(res.PlayedGameweeks) != 3 {
		t.Errorf("played gameweeks = %d, want 3", len(res.PlayedGameweeks))
	}

	// Form is the average over the last three played gameweeks, a gameweek the
	// player did not score in counting as zero.
	wantForm := (exp["ada/gw1"] + 0 + exp["ada/gw3"]) / 3
	if !near(ada.Form, wantForm) {
		t.Errorf("Ada form = %v, want %v", ada.Form, wantForm)
	}

	chidi := find(t, res.Data, "chidi")
	if !near(chidi.SeasonPoints, exp["chidi/gw3"]) || chidi.SeasonPoints == 0 {
		t.Errorf("an unpicked player must still score from his stats: got %v", chidi.SeasonPoints)
	}
	if chidi.Available || chidi.UnavailableReason != "Club reserve" {
		t.Errorf("Chidi availability = %v %q", chidi.Available, chidi.UnavailableReason)
	}
	dayo := find(t, res.Data, "dayo")
	if dayo.Available || dayo.UnavailableReason != "Club inactive" || dayo.Points != 0 {
		t.Errorf("Dayo = %+v", dayo)
	}
}

func TestPlayerLeaderboardRanksByPointsWithSharedTies(t *testing.T) {
	in, _ := leaderboardFixture()
	// Give Bayo exactly Ada's season so they tie.
	in.stats = in.stats[:3]
	in.stats = append(in.stats,
		ports.GameweekPlayerStat{GameweekID: "gw1", Stat: domain.PlayerStat{PlayerID: "bayo", MatchID: "m1", Receptions: 4, ReceivingTDs: 1}},
		ports.GameweekPlayerStat{GameweekID: "gw1", Stat: domain.PlayerStat{PlayerID: "bayo", MatchID: "m2", Receptions: 2}},
		ports.GameweekPlayerStat{GameweekID: "gw3", Stat: domain.PlayerStat{PlayerID: "bayo", MatchID: "m5", Receptions: 3, ReceivingTDs: 1}},
	)
	res, err := buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Limit: 100})
	if err != nil {
		t.Fatal(err)
	}
	if res.Data[0].Rank != 1 || res.Data[1].Rank != 1 || res.Data[2].Rank != 3 {
		t.Errorf("ranks = %d, %d, %d; want 1, 1, 3", res.Data[0].Rank, res.Data[1].Rank, res.Data[2].Rank)
	}
	if res.Data[0].PlayerID != "ada" {
		t.Errorf("a tie is broken by name: got %s first", res.Data[0].PlayerID)
	}

	// Searching narrows the list but keeps everyone's real rank: Dayo is tied
	// on zero with Chidi behind the two leaders, so third, not first.
	res, _ = buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Search: "DAYO", Limit: 100})
	if res.Total != 1 || res.Data[0].Rank != 3 {
		t.Errorf("search for Dayo = %d rows, rank %d; want 1 row at rank 3", res.Total, res.Data[0].Rank)
	}
}

func TestPlayerLeaderboardGameweekView(t *testing.T) {
	in, exp := leaderboardFixture()
	res, err := buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{GameweekID: "gw1", Limit: 100})
	if err != nil {
		t.Fatal(err)
	}
	if res.Data[0].PlayerID != "ada" || !near(res.Data[0].Points, exp["ada/gw1"]) {
		t.Errorf("gw1 leader = %s on %v; want Ada on %v", res.Data[0].PlayerID, res.Data[0].Points, exp["ada/gw1"])
	}
	ada := find(t, res.Data, "ada")
	if ada.StartedByPct != 100 {
		t.Errorf("Ada started in gw1 = %v%%, want 100%% (2 of 2)", ada.StartedByPct)
	}
	// Bayo and Chidi scored nothing in gw1, so they share the next rank.
	if find(t, res.Data, "bayo").Rank != 2 || find(t, res.Data, "chidi").Rank != 2 {
		t.Error("zero-point players should share rank 2")
	}

	if _, err := buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{GameweekID: "other-season"}); !errors.Is(err, ErrGameweekNotInSeason) {
		t.Errorf("a gameweek from another season = %v, want ErrGameweekNotInSeason", err)
	}
}

func TestPlayerLeaderboardFiltersSortsAndPages(t *testing.T) {
	in, _ := leaderboardFixture()

	res, _ := buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{TeamID: "c2", Limit: 100})
	if res.Total != 2 {
		t.Errorf("club filter = %d, want 2", res.Total)
	}
	res, _ = buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Gender: "f", Limit: 100})
	if res.Total != 1 || res.Data[0].PlayerID != "ada" {
		t.Errorf("gender filter = %+v", res.Data)
	}
	res, _ = buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Position: "defender", Limit: 100})
	if res.Total != 1 || res.Data[0].PlayerID != "chidi" {
		t.Errorf("position filter = %+v", res.Data)
	}
	res, _ = buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Sort: "selected", Limit: 100})
	if res.Data[0].PlayerID != "ada" || res.Data[1].PlayerID != "bayo" {
		t.Errorf("sort by selected = %s, %s", res.Data[0].PlayerID, res.Data[1].PlayerID)
	}
	res, _ = buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Sort: "name", Limit: 100})
	if res.Data[0].PlayerID != "ada" || res.Data[3].PlayerID != "dayo" {
		t.Errorf("sort by name = %s … %s", res.Data[0].PlayerID, res.Data[3].PlayerID)
	}

	res, _ = buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Page: 2, Limit: 3})
	if res.Total != 4 || res.TotalPages != 2 || len(res.Data) != 1 {
		t.Errorf("page 2 of 3 = total %d, pages %d, rows %d", res.Total, res.TotalPages, len(res.Data))
	}
	res, _ = buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{Page: 9, Limit: 3})
	if len(res.Data) != 0 {
		t.Errorf("a page past the end must be empty, got %d", len(res.Data))
	}

	if len(res.Teams) != 3 || len(res.Positions) != 3 {
		t.Errorf("filter options = %d clubs, %d positions", len(res.Teams), len(res.Positions))
	}
}

func TestPlayerLeaderboardHighlightsSkipEmptyCards(t *testing.T) {
	in, _ := leaderboardFixture()
	for i := range in.players {
		in.players[i].BoughtTotal = 0
	}
	res, _ := buildPlayerLeaderboard(in, dto.PlayerLeaderboardQuery{})
	for _, h := range res.Highlights {
		if h.Key == "most_transferred_in" {
			t.Error("a card whose best figure is zero must be left out")
		}
		if h.Player == nil || h.Value <= 0 {
			t.Errorf("highlight %s = %+v", h.Key, h)
		}
	}
	if len(res.Highlights) == 0 || res.Highlights[0].Key != "top_scorer" {
		t.Errorf("highlights = %+v", res.Highlights)
	}
}
