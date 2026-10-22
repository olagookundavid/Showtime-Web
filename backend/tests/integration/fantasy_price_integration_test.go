package tests_integration

import (
	"context"
	"fmt"
	"testing"
	"time"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// TestMarketAndAdminPricesUseTheLivePrice pins the prod bug: once a gameweek has
// repriced a player the market kept showing the opening price while the squad,
// the sell quote and a purchase all used the newest one.
func TestMarketAndAdminPricesUseTheLivePrice(t *testing.T) {
	f := setupFantasyFixture(t)
	ctx := context.Background()
	repo := ports.NewFantasyRepository(f.pool)

	// The fixture's receiver opens at 10. A later gameweek repriced them to 11.5.
	mustExec(t, f.pool,
		`INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, price) VALUES ($1, $2, $3, 11.50)`,
		f.seasonID, f.playerID, f.gameweekID)

	t.Run("market shows the live price a purchase is charged, not the opening one", func(t *testing.T) {
		list, _, err := repo.ListPlayerMarket(ctx, f.seasonID, nil, "", "", "ITest Receiver", "", 1, 50)
		if err != nil {
			t.Fatalf("ListPlayerMarket: %v", err)
		}
		var listed float64 = -1
		for _, p := range list {
			if p.PlayerID == f.playerID {
				listed = p.Price
			}
		}
		if listed != 11.5 {
			t.Errorf("market price = %v, want the repriced 11.5 (opening row is 10)", listed)
		}

		// The same number the buy path quotes.
		charged, _, err := ports.NewFantasySquadRepository(f.pool).GetMarketPlayer(ctx, f.seasonID, f.playerID)
		if err != nil {
			t.Fatalf("GetMarketPlayer: %v", err)
		}
		if charged != listed {
			t.Errorf("market shows %v but a purchase is charged %v", listed, charged)
		}

		// Sorting by price uses the live price too. Price a second player between
		// the receiver's opening (10) and live (11.5) prices: on the opening price
		// they would lead, on the live one the receiver does.
		otherID := mustScan(t, f.pool,
			`INSERT INTO players (name, position, gender, team_id) VALUES ('ITest Priced Other', 'Defender', 'M', $1) RETURNING id`,
			f.clubID)
		t.Cleanup(func() {
			_, _ = f.pool.Exec(ctx, `DELETE FROM fantasy_player_prices WHERE player_id = $1`, otherID)
			_, _ = f.pool.Exec(ctx, `DELETE FROM players WHERE id = $1`, otherID)
		})
		mustExec(t, f.pool,
			`INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, price) VALUES ($1, $2, NULL, 10.50)
			 ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL DO UPDATE SET price = EXCLUDED.price`,
			f.seasonID, otherID)
		desc, _, err := repo.ListPlayerMarket(ctx, f.seasonID, nil, "", "", "ITest ", "price_desc", 1, 50)
		if err != nil {
			t.Fatalf("ListPlayerMarket sorted: %v", err)
		}
		if len(desc) < 2 || desc[0].PlayerID != f.playerID {
			t.Errorf("price_desc should lead with the receiver at 11.5 (opening 10), got %+v", desc)
		}
	})

	t.Run("market filters stay in step with the market", func(t *testing.T) {
		filters, err := repo.ListMarketFilters(ctx, f.seasonID)
		if err != nil {
			t.Fatalf("ListMarketFilters: %v", err)
		}
		for _, tm := range filters.Teams {
			if tm.ID == f.clubID {
				return
			}
		}
		t.Error("the club of a priced, listed player is missing from the filter options")
	})

	t.Run("market points count a match once, not once per team", func(t *testing.T) {
		var matchID string
		if err := f.pool.QueryRow(ctx,
			`SELECT id FROM matches WHERE event_day_id = $1 LIMIT 1`, f.eventDayID).Scan(&matchID); err != nil {
			t.Fatalf("fixture match: %v", err)
		}
		// A second manager who also started the receiver, so fantasy_gw_points
		// holds two rows for the same player and match.
		secondUser := mustScan(t, f.pool,
			`INSERT INTO users (full_name, email, password_hash, role) VALUES ('ITest Second', $1, ''::bytea, 'user') RETURNING id`,
			fmt.Sprintf("itest-second-%d@example.invalid", time.Now().UnixNano()))
		secondTeam := mustScan(t, f.pool,
			`INSERT INTO fantasy_teams (user_id, season_id, name) VALUES ($1, $2, 'ITest Second XI') RETURNING id`,
			secondUser, f.seasonID)
		t.Cleanup(func() {
			_, _ = f.pool.Exec(ctx, `DELETE FROM fantasy_teams WHERE id = $1`, secondTeam)
			_, _ = f.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, secondUser)
		})
		for _, team := range []string{f.teamID, secondTeam} {
			mustExec(t, f.pool,
				`INSERT INTO fantasy_gw_points (team_id, gameweek_id, player_id, match_id, points) VALUES ($1, $2, $3, $4, 20.00)`,
				team, f.gameweekID, f.playerID, matchID)
		}

		list, _, err := repo.ListPlayerMarket(ctx, f.seasonID, nil, "", "", "ITest Receiver", "", 1, 50)
		if err != nil {
			t.Fatalf("ListPlayerMarket: %v", err)
		}
		for _, p := range list {
			if p.PlayerID == f.playerID {
				if p.TotalPoints != 20 {
					t.Errorf("market points = %v, want 20 (two teams started him in one match)", p.TotalPoints)
				}
				return
			}
		}
		t.Fatal("receiver missing from the market")
	})

	// Last, because it changes the receiver's price.
	t.Run("admin price page shows the live price and takes the override flag from the opening row", func(t *testing.T) {
		find := func(items []dto.AdminPlayerPriceItem) *dto.AdminPlayerPriceItem {
			for i := range items {
				if items[i].PlayerID == f.playerID {
					return &items[i]
				}
			}
			return nil
		}

		items, _, err := repo.ListPlayerPricesForAdmin(ctx, f.seasonID, "ITest Receiver", "", "", "", 1, 50)
		if err != nil {
			t.Fatalf("ListPlayerPricesForAdmin: %v", err)
		}
		row := find(items)
		if row == nil {
			t.Fatal("receiver missing from the admin price list")
		}
		if row.Price != 11.5 {
			t.Errorf("admin price = %v, want the live 11.5 buyers are charged (opening row is 10)", row.Price)
		}
		if row.IsOverridden {
			t.Error("nothing is overridden yet")
		}

		nine := 9.0
		updated, err := repo.OverridePlayerPrice(ctx, f.seasonID, f.playerID, &nine, false)
		if err != nil {
			t.Fatalf("OverridePlayerPrice: %v", err)
		}
		if updated.Price != 9 || !updated.IsOverridden {
			t.Errorf("after override the row reads %v overridden=%v, want 9 true", updated.Price, updated.IsOverridden)
		}

		// The override filter follows the opening row, where the override lives.
		items, _, err = repo.ListPlayerPricesForAdmin(ctx, f.seasonID, "ITest Receiver", "", "", "overridden", 1, 50)
		if err != nil {
			t.Fatalf("ListPlayerPricesForAdmin overridden: %v", err)
		}
		if find(items) == nil {
			t.Error("an overridden player must appear under the overridden filter")
		}
		items, _, _ = repo.ListPlayerPricesForAdmin(ctx, f.seasonID, "ITest Receiver", "", "", "calculated", 1, 50)
		if find(items) != nil {
			t.Error("an overridden player must not appear under the calculated filter")
		}
	})
}
