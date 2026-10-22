package tests_integration

import (
	"context"
	"fmt"
	"math"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
)

// TestPlayerLeaderboardAgainstTheSchema runs the leaderboard's queries and the
// service on top of them against the real schema.
func TestPlayerLeaderboardAgainstTheSchema(t *testing.T) {
	f := setupFantasyFixture(t)
	ctx := context.Background()
	repo := ports.NewFantasyRepository(f.pool)

	// The fixture's receiver has a stat line (5 rec, 80 yds, 1 TD), a locked
	// lineup start and an opening price of 10. Give them a later gameweek
	// price, which is the one buying and selling charge.
	mustExec(t, f.pool,
		`INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, price) VALUES ($1, $2, $3, 11.50)`,
		f.seasonID, f.playerID, f.gameweekID)

	// An unpriced, unpicked player who still played: they must rank.
	var matchID string
	if err := f.pool.QueryRow(ctx,
		`SELECT id FROM matches WHERE event_day_id = $1 LIMIT 1`, f.eventDayID).Scan(&matchID); err != nil {
		t.Fatalf("fixture match: %v", err)
	}
	unpickedID := mustScan(t, f.pool,
		`INSERT INTO players (name, position, gender, team_id) VALUES ('ITest Unpicked', 'Defender', 'M', $1) RETURNING id`,
		f.clubID)
	mustExec(t, f.pool,
		`INSERT INTO player_stats (player_id, team_id, match_id, competition_id, match_date, flag_pulls, interceptions)
		 VALUES ($1, $2, $3, $4, CURRENT_DATE + $5::int, 6, 1)`,
		unpickedID, f.clubID, matchID, f.compID, f.dayOffset)

	// A second manager who owns the receiver too, so two squads exist and
	// ownership is 1 of 2.
	secondUser := mustScan(t, f.pool,
		`INSERT INTO users (full_name, email, password_hash, role) VALUES ('ITest Second', $1, ''::bytea, 'user') RETURNING id`,
		fmt.Sprintf("itest-second-%d@example.invalid", time.Now().UnixNano()))
	secondTeam := mustScan(t, f.pool,
		`INSERT INTO fantasy_teams (user_id, season_id, name) VALUES ($1, $2, 'ITest Second XI') RETURNING id`,
		secondUser, f.seasonID)
	mustExec(t, f.pool,
		`INSERT INTO fantasy_squad_players (team_id, player_id, purchase_price) VALUES ($1, $2, 10.00)`,
		secondTeam, f.playerID)

	t.Cleanup(func() {
		for _, q := range []struct{ sql, id string }{
			{`DELETE FROM fantasy_teams WHERE id = $1`, secondTeam},
			{`DELETE FROM users WHERE id = $1`, secondUser},
			{`DELETE FROM player_stats WHERE player_id = $1`, unpickedID},
			{`DELETE FROM players WHERE id = $1`, unpickedID},
		} {
			if _, err := f.pool.Exec(ctx, q.sql, q.id); err != nil {
				t.Logf("cleanup %s: %v", q.id, err)
			}
		}
	})

	t.Run("pool keeps unpriced scorers and reads the live price", func(t *testing.T) {
		rows, err := repo.ListLeaderboardPlayers(ctx, f.seasonID)
		if err != nil {
			t.Fatalf("ListLeaderboardPlayers: %v", err)
		}
		byID := map[string]ports.LeaderboardPlayerRow{}
		for _, r := range rows {
			byID[r.PlayerID] = r
		}
		rec, ok := byID[f.playerID]
		if !ok {
			t.Fatal("the priced receiver is missing from the pool")
		}
		if rec.Price != 11.5 || rec.OpeningPrice != 10 {
			t.Errorf("receiver price = %v (opening %v), want live 11.5 and opening 10", rec.Price, rec.OpeningPrice)
		}
		if rec.OwnedNow != 1 {
			t.Errorf("receiver owned by %d squads, want 1", rec.OwnedNow)
		}
		if _, ok := byID[unpickedID]; !ok {
			t.Error("a player with stats but no price must still be in the pool")
		}
	})

	t.Run("stats are tagged with their gameweek", func(t *testing.T) {
		stats, err := repo.GetSeasonGameweekStats(ctx, f.seasonID)
		if err != nil {
			t.Fatalf("GetSeasonGameweekStats: %v", err)
		}
		if len(stats) != 2 {
			t.Fatalf("got %d stat lines, want 2", len(stats))
		}
		for _, s := range stats {
			if s.GameweekID != f.gameweekID {
				t.Errorf("stat for %s tagged %s, want %s", s.Stat.PlayerID, s.GameweekID, f.gameweekID)
			}
		}
	})

	t.Run("starts count locked lineups", func(t *testing.T) {
		starts, err := repo.GetSeasonLineupStarts(ctx, f.seasonID)
		if err != nil {
			t.Fatalf("GetSeasonLineupStarts: %v", err)
		}
		if len(starts) != 1 || starts[0].Locked != 1 || starts[0].ByPlayer[f.playerID] != 1 {
			t.Errorf("starts = %+v, want 1 locked lineup starting the receiver", starts)
		}
	})

	t.Run("service scores everyone from their stats", func(t *testing.T) {
		svc := services.NewFantasyService(repo, nil, nil, nil, nil)
		res, err := svc.GetPlayerLeaderboard(ctx, f.seasonID, dto.PlayerLeaderboardQuery{Limit: 100})
		if err != nil {
			t.Fatalf("GetPlayerLeaderboard: %v", err)
		}
		want := domain.FantasyWeights{}.Calculate(domain.PlayerStat{Receptions: 5, ReceivingYards: 80, ReceivingTDs: 1}).NetTotal
		var recFound, unpickedFound bool
		for _, p := range res.Data {
			switch p.PlayerID {
			case f.playerID:
				recFound = true
				if math.Abs(p.SeasonPoints-want) > 0.01 {
					t.Errorf("receiver season points = %v, want %v from the engine", p.SeasonPoints, want)
				}
				if p.SelectedByPct != 50 || p.StartedByPct != 100 {
					t.Errorf("receiver selected %v%% / started %v%%, want 50 / 100", p.SelectedByPct, p.StartedByPct)
				}
			case unpickedID:
				unpickedFound = true
				if p.SeasonPoints == 0 || p.Appearances != 1 {
					t.Errorf("unpicked player = %v pts over %d games; they played, so they scored", p.SeasonPoints, p.Appearances)
				}
			}
		}
		if !recFound || !unpickedFound {
			t.Fatalf("missing players: receiver %v, unpicked %v", recFound, unpickedFound)
		}
		if res.SquadCount != 2 || res.Gameweek == nil || res.Gameweek.ID != f.gameweekID {
			t.Errorf("squads %d, focus %+v", res.SquadCount, res.Gameweek)
		}
	})

}
