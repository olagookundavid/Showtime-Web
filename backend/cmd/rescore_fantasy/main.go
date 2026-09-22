package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	gwNum := flag.Int("gw", 0, "Specific gameweek number to rescore (0 = all locked/finalized gameweeks, every season)")
	seasonFlag := flag.String("season", "", "Season ID to scope --gw to. Required when --gw is given and more than one season has a gameweek with that number.")
	stripOnly := flag.Bool("strip-only", false, "Only strip partial lineups without recomputing scores")
	flag.Parse()

	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")

	target := strings.TrimSpace(os.Getenv("DB_URL"))
	if target == "" {
		target = "postgres://role:password@localhost:5432/showtime?sslmode=disable"
	}

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(target)
	if err != nil {
		log.Fatalf("Bad DB_URL: %v", err)
	}
	cfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error {
		_, err := c.Exec(ctx, "SET TIME ZONE 'Africa/Lagos'")
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	fmt.Println("Connected to database.")

	type gwItem struct {
		id, seasonID, status string
		number               int
	}

	// gameweek_id UNIQUELY identifies a gameweek; number only does so within a
	// season (fantasy_gameweeks has UNIQUE(season_id, number), not UNIQUE(number)).
	// Resolving --gw by number alone risks silently touching a same-numbered
	// gameweek in a different, possibly already-settled, season.
	var targetGWs []gwItem
	if *gwNum > 0 {
		query := `SELECT id, season_id, number, status FROM fantasy_gameweeks WHERE number = $1 AND status IN ('LOCKED', 'FINALIZED')`
		args := []interface{}{*gwNum}
		if s := strings.TrimSpace(*seasonFlag); s != "" {
			query += " AND season_id = $2"
			args = append(args, s)
		}
		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			log.Fatalf("Failed to resolve --gw %d: %v", *gwNum, err)
		}
		for rows.Next() {
			var g gwItem
			if err := rows.Scan(&g.id, &g.seasonID, &g.number, &g.status); err != nil {
				rows.Close()
				log.Fatal(err)
			}
			targetGWs = append(targetGWs, g)
		}
		rows.Close()

		if len(targetGWs) == 0 {
			log.Fatalf("No LOCKED or FINALIZED gameweek numbered %d found%s.", *gwNum, seasonSuffix(*seasonFlag))
		}
		if len(targetGWs) > 1 && *seasonFlag == "" {
			fmt.Printf("Gameweek number %d exists in %d different seasons. Pass --season to pick one:\n", *gwNum, len(targetGWs))
			for _, g := range targetGWs {
				fmt.Printf("  season=%s status=%s\n", g.seasonID, g.status)
			}
			log.Fatal("Refusing to guess which season you mean — re-run with --season.")
		}
	}

	gwIDs := make([]string, 0, len(targetGWs))
	for _, g := range targetGWs {
		gwIDs = append(gwIDs, g.id)
	}

	// Step 1: Strip partial / incomplete lineups (< 14 picks)
	fmt.Println("\n--- STEP 1: Stripping scores from incomplete lineups (< 14 picks) ---")

	scopeClause := ""
	scopeArgs := []interface{}{}
	if len(gwIDs) > 0 {
		scopeClause = " AND fl.gameweek_id = ANY($1)"
		scopeArgs = append(scopeArgs, gwIDs)
	}

	// Reset pick points
	pickRes, err := pool.Exec(ctx, `
		UPDATE fantasy_lineup_picks flp
		SET points = 0.000
		FROM fantasy_lineups fl
		WHERE flp.lineup_id = fl.id
		  AND (SELECT COUNT(*) FROM fantasy_lineup_picks flp2 WHERE flp2.lineup_id = fl.id) <> 14
	`+scopeClause, scopeArgs...)
	if err != nil {
		log.Fatalf("Failed to zero pick points: %v", err)
	}
	fmt.Printf("Reset pick points for %d picks on incomplete lineups.\n", pickRes.RowsAffected())

	// Delete points logs
	logRes, err := pool.Exec(ctx, `
		DELETE FROM fantasy_gw_points fgp
		USING fantasy_lineups fl
		WHERE fgp.team_id = fl.team_id
		  AND fgp.gameweek_id = fl.gameweek_id
		  AND (SELECT COUNT(*) FROM fantasy_lineup_picks flp WHERE flp.lineup_id = fl.id) <> 14
	`+scopeClause, scopeArgs...)
	if err != nil {
		log.Fatalf("Failed to delete points log: %v", err)
	}
	fmt.Printf("Cleared %d points log records for incomplete teams.\n", logRes.RowsAffected())

	// Demote to PARTIAL and zero points
	lineupRes, err := pool.Exec(ctx, `
		UPDATE fantasy_lineups fl
		SET status = 'PARTIAL',
		    points = 0.000,
		    updated_at = NOW()
		WHERE (SELECT COUNT(*) FROM fantasy_lineup_picks flp WHERE flp.lineup_id = fl.id) <> 14
		  AND fl.status IN ('LOCKED', 'DRAFT')
	`+scopeClause, scopeArgs...)
	if err != nil {
		log.Fatalf("Failed to demote lineups: %v", err)
	}
	fmt.Printf("Demoted %d incomplete lineups to 'PARTIAL' with 0.00 points.\n", lineupRes.RowsAffected())

	if *stripOnly {
		// Just re-total team standings
		if _, err := pool.Exec(ctx, `
			UPDATE fantasy_teams ft
			SET total_points = COALESCE((
			        SELECT SUM(fl.points) FROM fantasy_lineups fl
			        WHERE fl.team_id = ft.id AND fl.status = 'LOCKED'
			    ), 0),
			    updated_at = NOW()
		`); err != nil {
			log.Fatalf("Failed to update team totals: %v", err)
		}
		fmt.Println("Recalculated team totals. Done (-strip-only).")
		return
	}

	// Step 2: Initialize Fantasy Service
	fmt.Println("\n--- STEP 2: Re-scoring with DEF-1.0 Defensive Scoring Formula ---")
	fantasyRepo := ports.NewFantasyRepository(pool)
	leagueRepo := ports.NewFantasyLeagueRepository(pool)
	playerRepo := ports.NewPlayerRepository(pool)
	matchRepo := ports.NewMatchRepository(pool)
	squadRepo := ports.NewFantasySquadRepository(pool)

	fantasySvc := services.NewFantasyService(
		fantasyRepo, leagueRepo, playerRepo, matchRepo, squadRepo,
	)

	// Step 3: Find gameweeks to score
	var gws []gwItem
	if *gwNum > 0 {
		gws = targetGWs
	} else {
		rows, err := pool.Query(ctx, `
			SELECT id, season_id, number, status
			FROM fantasy_gameweeks
			WHERE status IN ('LOCKED', 'FINALIZED')
			ORDER BY number ASC
		`)
		if err != nil {
			log.Fatalf("Failed to query gameweeks: %v", err)
		}
		for rows.Next() {
			var g gwItem
			if err := rows.Scan(&g.id, &g.seasonID, &g.number, &g.status); err != nil {
				rows.Close()
				log.Fatal(err)
			}
			gws = append(gws, g)
		}
		rows.Close()
	}

	if len(gws) == 0 {
		fmt.Println("No locked or finalized gameweeks found to rescore.")
		return
	}

	seasonsToSettle := make(map[string]bool)
	for _, g := range gws {
		fmt.Printf("Re-scoring Gameweek %d (%s) [season: %s, status: %s]...\n", g.number, g.id, g.seasonID, g.status)
		if err := fantasySvc.ComputeGameweekScores(ctx, g.id); err != nil {
			log.Fatalf("Error re-scoring Gameweek %d: %v", g.number, err)
		}
		seasonsToSettle[g.seasonID] = true
		fmt.Printf("✓ Gameweek %d re-scored successfully with DEF-1.0 formula.\n", g.number)
	}

	// Step 4: Settle standings
	fmt.Println("\n--- STEP 3: Rebuilding season standings ---")
	for sID := range seasonsToSettle {
		if err := fantasyRepo.RecalculateAllTeamTotalsInSeason(ctx, sID); err != nil {
			log.Fatalf("Failed to recalculate season %s totals: %v", sID, err)
		}
		fmt.Printf("✓ Season %s totals recalculated.\n", sID)
	}

	// Display leaderboard summary
	fmt.Println("\n=== UPDATED STANDINGS (Top 10) ===")
	leaderboardRows, err := pool.Query(ctx, `
		SELECT ft.id, ft.name, ft.total_points, COALESCE(u.full_name, u.email, 'Anonymous') as manager
		FROM fantasy_teams ft
		LEFT JOIN users u ON ft.user_id = u.id
		ORDER BY ft.total_points DESC
		LIMIT 10
	`)
	if err == nil {
		defer leaderboardRows.Close()
		rank := 1
		for leaderboardRows.Next() {
			var id, name, manager string
			var pts float64
			if err := leaderboardRows.Scan(&id, &name, &pts, &manager); err == nil {
				fmt.Printf("#%d | %-25s | Manager: %-20s | Points: %.2f\n", rank, name, manager, pts)
				rank++
			}
		}
	}

	fmt.Println("\nAll operations completed successfully!")
}

func seasonSuffix(season string) string {
	if strings.TrimSpace(season) == "" {
		return ""
	}
	return fmt.Sprintf(" in season %s", season)
}
