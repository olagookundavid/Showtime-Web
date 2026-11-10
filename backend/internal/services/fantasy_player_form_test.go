package services

import (
	"fmt"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

func TestBuildPlayerForm_SeasonFigures(t *testing.T) {
	in, exp := leaderboardFixture()
	ada := buildPlayerForm(playerFormInput{gameweeks: in.gameweeks, stats: in.stats}, "ada")

	adaSeason := exp["ada/gw1"] + exp["ada/gw3"]
	// Ada played two matches in gw1 (m1, m2) and one in gw3 (m5): points per
	// match divides by matches, not gameweeks, so the denominator is 3.
	if !near(ada.pointsPerGame, adaSeason/3) {
		t.Errorf("Ada points per match = %v, want %v", ada.pointsPerGame, adaSeason/3)
	}

	// Form is the average over the last three gameweeks the league played at
	// all (gw1, gw2, gw3): gw2 is Bayo's week, not Ada's, so it counts as
	// zero for her — same definition the player leaderboard uses.
	wantForm := (exp["ada/gw1"] + 0 + exp["ada/gw3"]) / 3
	if !near(ada.form, wantForm) {
		t.Errorf("Ada form = %v, want %v", ada.form, wantForm)
	}

	// The recent-games strip lists only gameweeks she actually played,
	// oldest first, each carrying the match to resolve an opponent from.
	if len(ada.recentGames) != 2 {
		t.Fatalf("Ada recent games = %d, want 2 (gw1, gw3)", len(ada.recentGames))
	}
	if ada.recentGames[0].GameweekID != "gw1" || ada.recentGames[1].GameweekID != "gw3" {
		t.Errorf("Ada recent games out of order: %+v", ada.recentGames)
	}
	if !near(ada.recentGames[0].Points, exp["ada/gw1"]) {
		t.Errorf("Ada gw1 points = %v, want %v", ada.recentGames[0].Points, exp["ada/gw1"])
	}
	// gw1 has two matches (m1, m2); the service keeps the first for its
	// opponent lookup.
	if ada.recentGames[0].matchID != "m1" {
		t.Errorf("Ada gw1 matchID = %q, want m1", ada.recentGames[0].matchID)
	}

	chidi := buildPlayerForm(playerFormInput{gameweeks: in.gameweeks, stats: in.stats}, "chidi")
	if !near(chidi.pointsPerGame, exp["chidi/gw3"]) {
		t.Errorf("Chidi points per match = %v, want %v (one match)", chidi.pointsPerGame, exp["chidi/gw3"])
	}
	if len(chidi.recentGames) != 1 || chidi.recentGames[0].GameweekID != "gw3" {
		t.Errorf("Chidi recent games = %+v, want just gw3", chidi.recentGames)
	}
}

func TestBuildPlayerForm_NoStats(t *testing.T) {
	in, _ := leaderboardFixture()
	ghost := buildPlayerForm(playerFormInput{gameweeks: in.gameweeks, stats: in.stats}, "ghost")

	if ghost.form != 0 || ghost.pointsPerGame != 0 {
		t.Errorf("unplayed player should score 0/0, got form=%v ppg=%v", ghost.form, ghost.pointsPerGame)
	}
	if len(ghost.recentGames) != 0 {
		t.Errorf("unplayed player should have no recent games, got %+v", ghost.recentGames)
	}
}

func TestBuildPlayerForm_RecentGamesCapAtFive(t *testing.T) {
	gameweeks := make([]domain.FantasyGameweek, 0, 7)
	var stats []ports.GameweekPlayerStat
	for i := 1; i <= 7; i++ {
		gwID := fmt.Sprintf("gw%d", i)
		gameweeks = append(gameweeks, domain.FantasyGameweek{ID: gwID, Number: i})
		s, _ := stat("p1", fmt.Sprintf("m%d", i), 1, 0)
		stats = append(stats, ports.GameweekPlayerStat{GameweekID: gwID, Stat: s})
	}

	// Seven played gameweeks for one player should trim to the latest five.
	res := buildPlayerForm(playerFormInput{gameweeks: gameweeks, stats: stats}, "p1")
	if len(res.recentGames) != 5 {
		t.Fatalf("recent games = %d, want 5", len(res.recentGames))
	}
	if res.recentGames[0].GameweekNumber != 3 || res.recentGames[4].GameweekNumber != 7 {
		t.Errorf("recent games not trimmed to the latest 5: %+v", res.recentGames)
	}
}
