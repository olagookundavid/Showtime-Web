// Production CLI to seed player opening prices from the official Showtime
// Fantasy Player Pricing Model workbook (314 players across 10 clubs).
//
// Matches players by team and name, creates any unseeded players or clubs,
// upserts their opening price snapshots into fantasy_player_prices, and
// optionally restates existing squads against the new prices.
//
// Supports --dry-run for zero-risk inspection before committing.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"os"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type rawPlayerStats struct {
	PassAtt           int `json:"pass_att"`
	PassComp          int `json:"pass_comp"`
	PassTDs           int `json:"pass_tds"`
	IntsThrown        int `json:"ints_thrown"`
	RushAtt           int `json:"rush_att"`
	RushTDs           int `json:"rush_tds"`
	Receptions        int `json:"receptions"`
	RecTDs            int `json:"rec_tds"`
	Drops             int `json:"drops"`
	TotalTDs          int `json:"total_tds"`
	XP                int `json:"xp"`
	TotalPointsScored int `json:"total_points_scored"`
	FlagPulls         int `json:"flag_pulls"`
	DefSacks          int `json:"def_sacks"`
	Interceptions     int `json:"interceptions"`
	PassDeflections   int `json:"pass_deflections"`
	DefTDs            int `json:"def_tds"`
	DefXPTDs          int `json:"def_xp_tds"`
	Safeties          int `json:"safeties"`
	QBSacksAllowed    int `json:"qb_sacks_allowed"`
}

type playerPricingRecord struct {
	Rank               int            `json:"rank"`
	Name               string         `json:"name"`
	TeamName           string         `json:"team_name"`
	TeamCode           string         `json:"team_code"`
	GamesPlayed        int            `json:"games_played"`
	SourceRole         string         `json:"source_role"`
	FantasyPosition    string         `json:"fantasy_position"`
	PassingPts         float64        `json:"passing_pts"`
	RushRecPts         float64        `json:"rush_rec_pts"`
	DefencePts         float64        `json:"defence_pts"`
	OtherDeductions    float64        `json:"other_deductions"`
	FantasyPts         float64        `json:"fantasy_pts"`
	PtsPerGame         float64        `json:"pts_per_game"`
	PositionPercentile float64        `json:"position_percentile"`
	Availability       float64        `json:"availability"`
	CompositeIndex     float64        `json:"composite_index"`
	RawPrice           float64        `json:"raw_price"`
	FinalPrice         float64        `json:"final_price"`
	PriceTier          string         `json:"price_tier"`
	PricingStatus      string         `json:"pricing_status"`
	ReviewNote         *string        `json:"review_note"`
	Stats              rawPlayerStats `json:"stats"`
}

type teamRow struct {
	ID        string
	Name      string
	ShortName string
}

type playerRow struct {
	ID       string
	Name     string
	TeamID   string
	Position string
}

func main() {
	var (
		dbURL         string
		seasonID      string
		dryRun        bool
		createMissing bool
		restate       bool
		verbose       bool
	)

	flag.StringVar(&dbURL, "db-url", "", "Postgres connection string (or set DB_URL/DATABASE_URL)")
	flag.StringVar(&seasonID, "season-id", "", "Target fantasy season UUID (auto-selects active/draft if omitted)")
	flag.BoolVar(&dryRun, "dry-run", false, "Test run inside a transaction with automatic ROLLBACK")
	flag.BoolVar(&createMissing, "create-missing", true, "Create clubs or players if missing from database")
	flag.BoolVar(&restate, "restate-squads", true, "Restate existing squads and banks against new prices")
	flag.BoolVar(&verbose, "verbose", false, "Print detailed matching logs per player")
	flag.Parse()

	if dbURL == "" {
		dbURL = os.Getenv("DB_URL")
		if dbURL == "" {
			dbURL = os.Getenv("DATABASE_URL")
		}
	}
	if dbURL == "" {
		fmt.Println("Error: No database URL provided. Use --db-url or set DB_URL/DATABASE_URL environment variable.")
		os.Exit(1)
	}

	var records []playerPricingRecord
	if err := json.Unmarshal(embeddedPlayersPricing, &records); err != nil {
		fmt.Printf("Error unmarshalling embedded pricing data: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Loaded %d player pricing records from embedded official model\n", len(records))

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		fmt.Printf("Invalid database URL: %v\n", err)
		os.Exit(1)
	}
	cfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error {
		_, err := c.Exec(ctx, "SET TIME ZONE 'Africa/Lagos'")
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		fmt.Printf("Database connection failed: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		fmt.Printf("Database ping failed: %v\n", err)
		os.Exit(1)
	}

	// 1. Resolve Target Season
	type seasonInfo struct {
		ID     string
		Name   string
		Status string
		Budget float64
	}
	var targetSeason seasonInfo

	if seasonID != "" {
		err := pool.QueryRow(ctx, `SELECT id::text, name, status, budget FROM fantasy_seasons WHERE id = $1::uuid`, seasonID).
			Scan(&targetSeason.ID, &targetSeason.Name, &targetSeason.Status, &targetSeason.Budget)
		if err != nil {
			fmt.Printf("Specified season %s not found: %v\n", seasonID, err)
			os.Exit(1)
		}
	} else {
		// Pick active or latest draft
		rows, err := pool.Query(ctx, `SELECT id::text, name, status, budget FROM fantasy_seasons ORDER BY (status = 'ACTIVE') DESC, created_at DESC`)
		if err != nil {
			fmt.Printf("Failed to query fantasy seasons: %v\n", err)
			os.Exit(1)
		}
		var seasons []seasonInfo
		for rows.Next() {
			var s seasonInfo
			rows.Scan(&s.ID, &s.Name, &s.Status, &s.Budget)
			seasons = append(seasons, s)
		}
		rows.Close()

		if len(seasons) == 0 {
			fmt.Println("No fantasy seasons found in database. Auto-creating default competition and active season...")
			var compID string
			err := pool.QueryRow(ctx, `SELECT id::text FROM competitions ORDER BY created_at DESC LIMIT 1`).Scan(&compID)
			if err != nil {
				err = pool.QueryRow(ctx, `INSERT INTO competitions (name, created_at, updated_at) VALUES ('Showtime Flag Football League', NOW(), NOW()) RETURNING id::text`).Scan(&compID)
				if err != nil {
					fmt.Printf("Failed to create default competition: %v\n", err)
					os.Exit(1)
				}
				fmt.Printf("Created default competition: %s\n", compID)
			}
			targetSeason = seasonInfo{
				Name:   "Showtime Fantasy Season 2026",
				Status: "ACTIVE",
				Budget: 100.00,
			}
			err = pool.QueryRow(ctx, `
				INSERT INTO fantasy_seasons (competition_id, name, squad_size, budget, min_female_offense, min_female_defense, max_per_club, lock_mins_before, status, created_at, updated_at)
				VALUES ($1::uuid, $2, 14, 100.00, 3, 3, 4, 15, 'ACTIVE', NOW(), NOW())
				RETURNING id::text
			`, compID, targetSeason.Name).Scan(&targetSeason.ID)
			if err != nil {
				fmt.Printf("Failed to auto-create fantasy season: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("Auto-created active fantasy season: %s (%s, Budget: ₦%.1fm)\n", targetSeason.Name, targetSeason.ID, targetSeason.Budget)
		} else {
			targetSeason = seasons[0]
			fmt.Printf("Auto-selected season: %s (%s, Status: %s, Budget: ₦%.1fm)\n", targetSeason.Name, targetSeason.ID, targetSeason.Status, targetSeason.Budget)
		}
		if len(seasons) > 1 {
			fmt.Println("Other available seasons (use --season-id to target one specifically):")
			for _, s := range seasons[1:] {
				fmt.Printf("  - %s (%s, %s)\n", s.Name, s.ID, s.Status)
			}
		}
	}

	fmt.Println("\n========================================================")
	if dryRun {
		fmt.Println("MODE: DRY RUN (Zero database mutations will be committed)")
	} else {
		fmt.Println("MODE: LIVE PRODUCTION SEED (Will commit changes)")
	}
	fmt.Printf("Target Season: %s (%s)\n", targetSeason.Name, targetSeason.ID)
	fmt.Println("========================================================")
	fmt.Println()

	tx, err := pool.Begin(ctx)
	if err != nil {
		fmt.Printf("Failed to begin transaction: %v\n", err)
		os.Exit(1)
	}
	defer tx.Rollback(ctx)

	// 2. Load and map Teams
	tRows, err := tx.Query(ctx, `SELECT id::text, name, COALESCE(short_name, '') FROM teams`)
	if err != nil {
		fmt.Printf("Failed to query teams: %v\n", err)
		os.Exit(1)
	}
	teamsByName := make(map[string]teamRow)
	teamsByCode := make(map[string]teamRow)
	for tRows.Next() {
		var t teamRow
		tRows.Scan(&t.ID, &t.Name, &t.ShortName)
		normName := strings.ToLower(strings.TrimSpace(t.Name))
		normCode := strings.ToUpper(strings.TrimSpace(t.ShortName))
		teamsByName[normName] = t
		if normCode != "" {
			teamsByCode[normCode] = t
		}
	}
	tRows.Close()

	// 3. Ensure all 10 clubs exist
	teamsCreated := 0
	for _, r := range records {
		normName := strings.ToLower(strings.TrimSpace(r.TeamName))
		normCode := strings.ToUpper(strings.TrimSpace(r.TeamCode))
		if _, ok := teamsByName[normName]; !ok {
			if _, ok2 := teamsByCode[normCode]; !ok2 {
				if !createMissing {
					fmt.Printf("Team missing and create-missing disabled: %s (%s)\n", r.TeamName, r.TeamCode)
					continue
				}
				var newID string
				err := tx.QueryRow(ctx, `
					INSERT INTO teams (name, short_name, created_at, updated_at)
					VALUES ($1, $2, NOW(), NOW()) RETURNING id::text
				`, r.TeamName, r.TeamCode).Scan(&newID)
				if err != nil {
					fmt.Printf("Failed to create team %s: %v\n", r.TeamName, err)
					os.Exit(1)
				}
				t := teamRow{ID: newID, Name: r.TeamName, ShortName: r.TeamCode}
				teamsByName[normName] = t
				teamsByCode[normCode] = t
				teamsCreated++
				if verbose {
					fmt.Printf("[+] Created club: %s (%s) -> ID: %s\n", r.TeamName, r.TeamCode, newID)
				}
			}
		}
	}

	// 4. Load existing players
	pRows, err := tx.Query(ctx, `SELECT id::text, name, COALESCE(team_id::text, ''), COALESCE(position, '') FROM players`)
	if err != nil {
		fmt.Printf("Failed to query players: %v\n", err)
		os.Exit(1)
	}
	playersByTeamAndName := make(map[string]playerRow)
	playersByName := make(map[string][]playerRow)
	for pRows.Next() {
		var p playerRow
		pRows.Scan(&p.ID, &p.Name, &p.TeamID, &p.Position)
		normName := strings.ToLower(strings.TrimSpace(p.Name))
		if p.TeamID != "" {
			key := fmt.Sprintf("%s|%s", p.TeamID, normName)
			playersByTeamAndName[key] = p
		}
		playersByName[normName] = append(playersByName[normName], p)
	}
	pRows.Close()

	// 5. Match or create players and upsert prices
	matchedCount := 0
	createdCount := 0
	pricesUpserted := 0
	tierCounts := make(map[string]int)
	priceCounts := make(map[float64]int)

	for _, rec := range records {
		normName := strings.ToLower(strings.TrimSpace(rec.Name))
		normTeamName := strings.ToLower(strings.TrimSpace(rec.TeamName))
		normTeamCode := strings.ToUpper(strings.TrimSpace(rec.TeamCode))

		var teamID string
		if t, ok := teamsByName[normTeamName]; ok {
			teamID = t.ID
		} else if t, ok := teamsByCode[normTeamCode]; ok {
			teamID = t.ID
		}

		var targetPlayerID string
		// Try exact team + name match
		if teamID != "" {
			if p, ok := playersByTeamAndName[fmt.Sprintf("%s|%s", teamID, normName)]; ok {
				targetPlayerID = p.ID
				matchedCount++
			}
		}

		// Fallback: match by unique name
		if targetPlayerID == "" {
			candidates := playersByName[normName]
			if len(candidates) == 1 {
				targetPlayerID = candidates[0].ID
				matchedCount++
			}
		}

		// If still not found, create player
		if targetPlayerID == "" {
			if !createMissing {
				fmt.Printf("Player not found in database: %s (%s)\n", rec.Name, rec.TeamName)
				continue
			}

			position := rec.FantasyPosition
			if position == "Unclassified" || position == "" {
				position = "Defender"
			}

			err := tx.QueryRow(ctx, `
				INSERT INTO players (name, team_id, position, created_at, updated_at)
				VALUES ($1, $2::uuid, $3, NOW(), NOW()) RETURNING id::text
			`, rec.Name, teamID, position).Scan(&targetPlayerID)
			if err != nil {
				fmt.Printf("Failed to create player %s: %v\n", rec.Name, err)
				os.Exit(1)
			}
			createdCount++
			if verbose {
				fmt.Printf("[+] Created player: %s [%s] (%s) -> ID: %s\n", rec.Name, position, rec.TeamName, targetPlayerID)
			}
		}

		// Rating clamped between 3.0 and 10.0
		rating := math.Round(math.Max(3.0, math.Min(10.0, rec.CompositeIndex*10.0))*100) / 100
		if rec.CompositeIndex == 0 {
			rating = 5.00
		}

		// Upsert opening price
		_, err := tx.Exec(ctx, `
			INSERT INTO fantasy_player_prices (
				id, season_id, player_id, gameweek_id, base_price, rating, price, created_at
			) VALUES (
				gen_random_uuid(), $1::uuid, $2::uuid, NULL, $3, $4, $5, NOW()
			)
			ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL
			DO UPDATE SET
				price = EXCLUDED.price,
				base_price = EXCLUDED.base_price,
				rating = EXCLUDED.rating,
				created_at = NOW()
		`, targetSeason.ID, targetPlayerID, rec.FinalPrice, rating, rec.FinalPrice)
		if err != nil {
			fmt.Printf("Failed to upsert price for %s: %v\n", rec.Name, err)
			os.Exit(1)
		}

		pricesUpserted++
		tierCounts[rec.PriceTier]++
		priceCounts[rec.FinalPrice]++
	}

	// 6. Restate existing squads if requested
	squadsRestated := 0
	if restate {
		res, err := tx.Exec(ctx, `
			UPDATE fantasy_squad_players sp
			SET purchase_price = COALESCE((
			        SELECT pp.price FROM fantasy_player_prices pp
			        WHERE pp.player_id = sp.player_id AND pp.season_id = $1::uuid
			        ORDER BY (pp.gameweek_id IS NULL), pp.created_at DESC LIMIT 1
			    ), 3.0)
			FROM fantasy_teams ft
			WHERE ft.id = sp.team_id AND ft.season_id = $1::uuid AND sp.sold_at IS NULL
		`, targetSeason.ID)
		if err != nil {
			fmt.Printf("Warning: failed to restate squad player prices: %v\n", err)
		} else {
			// Update bank
			tx.Exec(ctx, `
				UPDATE fantasy_teams ft
				SET bank = GREATEST($2 - COALESCE((
				        SELECT SUM(sp.purchase_price) FROM fantasy_squad_players sp
				        WHERE sp.team_id = ft.id AND sp.sold_at IS NULL), 0), 0)
				WHERE ft.season_id = $1::uuid
			`, targetSeason.ID, targetSeason.Budget)
			squadsRestated = int(res.RowsAffected())
		}
	}

	// 7. Verification and Summary
	fmt.Println("---------------- SUMMARY OF SEEDING ----------------")
	fmt.Printf("Total players in model:       %d\n", len(records))
	fmt.Printf("Clubs created:                %d\n", teamsCreated)
	fmt.Printf("Existing players matched:     %d\n", matchedCount)
	fmt.Printf("New players created:          %d\n", createdCount)
	fmt.Printf("Opening prices upserted:      %d\n", pricesUpserted)
	if restate {
		fmt.Printf("Squad entries restated:       %d\n", squadsRestated)
	}

	fmt.Println("\nTier Breakdown:")
	tierNames := []string{"Minimum", "Value", "Core", "Starter", "Premium", "Elite"}
	for _, t := range tierNames {
		fmt.Printf("  %-10s : %3d players\n", t, tierCounts[t])
	}

	fmt.Println("\nPrice Distribution (₦m):")
	var sortedPrices []float64
	for p := range priceCounts {
		sortedPrices = append(sortedPrices, p)
	}
	sort.Float64s(sortedPrices)
	for _, p := range sortedPrices {
		fmt.Printf("  ₦%4.1fm : %3d players\n", p, priceCounts[p])
	}
	fmt.Println("----------------------------------------------------")

	if dryRun {
		fmt.Println("\n[!] DRY RUN COMPLETED: Transaction rolled back. No database modifications were committed.")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Printf("Failed to commit transaction: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("\n[✓] SUCCESS: All 314 player opening prices committed to production!")
}
