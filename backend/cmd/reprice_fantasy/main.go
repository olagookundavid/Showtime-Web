// Reprices a fantasy season onto the current pricing model and restates every
// squad against the result.
//
// Needed whenever the pricing model itself changes: the stored prices were
// produced by the previous formula, and a squad's purchase prices and bank are
// denominated in whatever scale was in force when they were bought. This
// recomputes prices through the production path, then rewrites each squad at the
// new prices so budget and squad reconcile exactly.
//
// Local only: it refuses to run against anything but localhost.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultDSN = "postgres://role:password@localhost:5432/showtime?sslmode=disable"

func main() {
	restate := flag.Bool("restate-squads", true, "rewrite squad purchase prices and banks at the new prices")
	flag.Parse()

	target := defaultDSN
	if env := strings.TrimSpace(os.Getenv("DB_URL")); env != "" {
		target = env
	}
	if !strings.Contains(target, "localhost") && !strings.Contains(target, "127.0.0.1") {
		fmt.Println("refusing to reprice a non-local database")
		os.Exit(1)
	}

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(target)
	if err != nil {
		fmt.Println("bad DB_URL:", err)
		os.Exit(1)
	}
	cfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error {
		_, err := c.Exec(ctx, "SET TIME ZONE 'Africa/Lagos'")
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		fmt.Println("connect:", err)
		os.Exit(1)
	}
	defer pool.Close()

	fantasy := services.NewFantasyService(
		ports.NewFantasyRepository(pool), ports.NewFantasyLeagueRepository(pool),
		ports.NewPlayerRepository(pool), ports.NewMatchRepository(pool),
		ports.NewFantasySquadRepository(pool),
	)

	rows, err := pool.Query(ctx, `SELECT id::text, name, budget FROM fantasy_seasons ORDER BY created_at`)
	if err != nil {
		fmt.Println("seasons:", err)
		os.Exit(1)
	}
	type season struct {
		id, name string
		budget   float64
	}
	var seasons []season
	for rows.Next() {
		var s season
		rows.Scan(&s.id, &s.name, &s.budget)
		seasons = append(seasons, s)
	}
	rows.Close()

	for _, s := range seasons {
		fmt.Printf("%s (budget %.2f)\n", s.name, s.budget)

		if err := fantasy.InitializePlayerPrices(ctx, s.id); err != nil {
			fmt.Println("  ! reprice:", err)
			continue
		}
		report(ctx, pool, s.id)

		if *restate {
			restateSquads(ctx, pool, s.id, s.budget)
		}
	}
}

// report prints the shape of the new price list, which is the quickest way to
// see whether the model is behaving: a healthy distribution has a large block at
// the floor and very few at the ceiling.
func report(ctx context.Context, pool *pgxpool.Pool, seasonID string) {
	var n int
	var min, max, avg float64
	pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(MIN(price),0), COALESCE(MAX(price),0), COALESCE(AVG(price),0)
		FROM fantasy_player_prices WHERE season_id = $1::uuid AND gameweek_id IS NULL`,
		seasonID).Scan(&n, &min, &max, &avg)
	fmt.Printf("  priced %d players: min %.2f, max %.2f, average %.2f\n", n, min, max, avg)

	rows, _ := pool.Query(ctx, `
		SELECT price, COUNT(*) FROM fantasy_player_prices
		WHERE season_id = $1::uuid AND gameweek_id IS NULL
		GROUP BY price ORDER BY price`, seasonID)
	defer rows.Close()
	fmt.Print("  distribution: ")
	for rows.Next() {
		var p float64
		var c int
		rows.Scan(&p, &c)
		fmt.Printf("%.1f×%d  ", p, c)
	}
	fmt.Println()
}

// restateSquads rewrites what every manager paid, at the new prices, and sets
// the bank from what is left. Purchase prices from the old scale are meaningless
// now, and leaving them would make budget and squad disagree.
func restateSquads(ctx context.Context, pool *pgxpool.Pool, seasonID string, budget float64) {
	if _, err := pool.Exec(ctx, `
		UPDATE fantasy_squad_players sp
		SET purchase_price = COALESCE((
		        SELECT pp.price FROM fantasy_player_prices pp
		        WHERE pp.player_id = sp.player_id AND pp.season_id = $1::uuid
		        ORDER BY (pp.gameweek_id IS NULL), pp.created_at DESC LIMIT 1
		    ), $2)
		FROM fantasy_teams ft
		WHERE ft.id = sp.team_id AND ft.season_id = $1::uuid AND sp.sold_at IS NULL
	`, seasonID, domain.PriceFloor); err != nil {
		fmt.Println("  ! restate purchase prices:", err)
		return
	}

	// A squad assembled under the old economy can cost more than the new budget.
	// The bank floors at zero rather than the migration failing: the manager
	// keeps their players and simply has nothing left to spend, which they can
	// fix by selling.
	if _, err := pool.Exec(ctx, `
		UPDATE fantasy_teams ft
		SET bank = GREATEST($2 - COALESCE((
		        SELECT SUM(sp.purchase_price) FROM fantasy_squad_players sp
		        WHERE sp.team_id = ft.id AND sp.sold_at IS NULL), 0), 0)
		WHERE ft.season_id = $1::uuid
	`, seasonID, budget); err != nil {
		fmt.Println("  ! restate banks:", err)
		return
	}

	rows, _ := pool.Query(ctx, `
		SELECT ft.name,
		       (SELECT COUNT(*) FROM fantasy_squad_players sp WHERE sp.team_id=ft.id AND sp.sold_at IS NULL),
		       COALESCE((SELECT SUM(sp.purchase_price) FROM fantasy_squad_players sp
		                 WHERE sp.team_id=ft.id AND sp.sold_at IS NULL), 0),
		       ft.bank
		FROM fantasy_teams ft WHERE ft.season_id = $1::uuid ORDER BY ft.name`, seasonID)
	defer rows.Close()
	fmt.Println("  squads restated:")
	for rows.Next() {
		var name string
		var owned int
		var spent, bank float64
		rows.Scan(&name, &owned, &spent, &bank)
		fmt.Printf("    %-22s %2d players  spent %6.2f  bank %6.2f  total %6.2f\n",
			name, owned, spent, bank, spent+bank)
	}
}
