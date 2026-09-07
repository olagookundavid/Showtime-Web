// Plays a fantasy season out to its final whistle so the money side can be
// tested end to end.
//
// Every gameweek that hasn't been finalised is pulled back into the past, its
// fixtures are marked played with a plausible stat line for each player, and the
// gameweek is then finalised through the real FantasyService — the same locking,
// scoring, rollover and repricing the app runs, not a SQL shortcut. What comes
// out is a season with final standings, ready to settle.
//
// It deliberately stops short of settling. Settlement, and the payout queue that
// follows it, is the part you want to click through yourself.
//
// Local only: it refuses to run against anything but localhost. Re-runnable —
// gameweeks already finalised are left alone.
package main

import (
	"context"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"time"

	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultDSN = "postgres://role:password@localhost:5432/showtime?sslmode=disable"

type ctxT = context.Context

// gameweek is one match day still to be played out.
type gameweek struct {
	id         string
	number     int
	status     string
	eventDayID string
	eventDate  time.Time
}

func main() {
	seasonFlag := flag.String("season", "", "season id (default: the active season)")
	// How far back the last simulated match day lands. Two days is enough for
	// the season to read as finished without colliding with anything today.
	endDaysAgo := flag.Int("end-days-ago", 2, "how many days ago the final match day should be")
	flag.Parse()

	target := defaultDSN
	if fromEnv := strings.TrimSpace(os.Getenv("DB_URL")); fromEnv != "" {
		target = fromEnv
	}
	if !strings.Contains(target, "localhost") && !strings.Contains(target, "127.0.0.1") {
		fmt.Println("refusing to simulate against a non-local database")
		os.Exit(1)
	}

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(target)
	if err != nil {
		fmt.Println("bad DB_URL:", err)
		os.Exit(1)
	}
	// Kickoff maths combines a DATE and a TIME, so this must run under the same
	// zone as the server or every deadline lands an hour out.
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

	seasonID, seasonName, compID, status := resolveSeason(ctx, pool, *seasonFlag)
	if seasonID == "" {
		fmt.Println("no season found — run `go run ./cmd/seed_fantasy` first")
		os.Exit(1)
	}
	if status == "COMPLETED" {
		fmt.Printf("%q is already completed — nothing left to play.\n", seasonName)
		os.Exit(0)
	}
	fmt.Printf("Season: %s (%s)\n\n", seasonName, status)

	all := listGameweeks(ctx, pool, seasonID)
	if len(all) == 0 {
		fmt.Println("this season has no gameweeks")
		os.Exit(1)
	}

	var pending []gameweek
	var lastPlayed time.Time
	for _, gw := range all {
		if gw.status == "FINALIZED" {
			if gw.eventDate.After(lastPlayed) {
				lastPlayed = gw.eventDate
			}
			continue
		}
		pending = append(pending, gw)
	}
	if len(pending) == 0 {
		fmt.Println("every gameweek is already finalised — the season is ready to settle.")
		printNextSteps(ctx, pool, seasonID)
		return
	}

	dates, err := scheduleInThePast(lastPlayed, len(pending), *endDaysAgo)
	if err != nil {
		fmt.Println("cannot fit the remaining match days into the past:", err)
		fmt.Println("re-seed with `go run ./cmd/seed_fantasy` for a season that starts further back.")
		os.Exit(1)
	}

	// Deterministic, so a re-run produces the same final table.
	rng := rand.New(rand.NewSource(20260310))
	fantasy := services.NewFantasyService(
		ports.NewFantasyRepository(pool),
		ports.NewFantasyLeagueRepository(pool),
		ports.NewPlayerRepository(pool),
		ports.NewMatchRepository(pool),
		ports.NewFantasySquadRepository(pool),
	)

	for i, gw := range pending {
		day := dates[i]
		fmt.Printf("Gameweek %d → %s\n", gw.number, day.Format("Mon 2 Jan 2006"))

		if err := movePlayed(ctx, pool, gw, day, rng); err != nil {
			fmt.Println("  ! could not play the fixtures:", err)
			os.Exit(1)
		}
		n := seedStats(ctx, pool, compID, gw.eventDayID, rng)
		fmt.Printf("  played the fixtures and wrote %d player stat lines\n", n)

		// The real path: locks any draft lineups, rolls forward anyone who
		// didn't pick, scores every squad and reprices the market.
		if err := fantasy.FinalizeGameweek(ctx, gw.id); err != nil {
			fmt.Println("  ! finalize:", err)
			os.Exit(1)
		}
		fmt.Println("  finalised — squads scored and the market repriced")
	}

	fmt.Println()
	printNextSteps(ctx, pool, seasonID)
}

// scheduleInThePast lays the remaining match days out between the last one
// already played and a few days ago, keeping them in order and spaced as widely
// as the gap allows.
func scheduleInThePast(lastPlayed time.Time, count, endDaysAgo int) ([]time.Time, error) {
	end := time.Now().AddDate(0, 0, -endDaysAgo)
	end = time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.Local)

	spacing := 3
	for ; spacing >= 1; spacing-- {
		first := end.AddDate(0, 0, -spacing*(count-1))
		if lastPlayed.IsZero() || first.After(lastPlayed) {
			break
		}
	}
	if spacing < 1 {
		return nil, fmt.Errorf("only %s between the last match day and today",
			end.Sub(lastPlayed).Round(24*time.Hour))
	}

	dates := make([]time.Time, count)
	for i := range dates {
		dates[i] = end.AddDate(0, 0, -spacing*(count-1-i))
	}
	return dates, nil
}

// movePlayed backdates a match day and marks its fixtures played. The gameweek
// deadline is rebuilt from the new first kickoff so it stays consistent with the
// rule the app applies.
func movePlayed(ctx ctxT, pool *pgxpool.Pool, gw gameweek, day time.Time, rng *rand.Rand) error {
	date := day.Format("2006-01-02")

	// event_days.date is unique, so step back off any day already taken.
	for {
		var clash bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM event_days WHERE date = $1::date AND id <> $2::uuid)`,
			date, gw.eventDayID).Scan(&clash); err != nil {
			return err
		}
		if !clash {
			break
		}
		day = day.AddDate(0, 0, -1)
		date = day.Format("2006-01-02")
	}

	if _, err := pool.Exec(ctx,
		`UPDATE event_days SET date = $1::date WHERE id = $2::uuid`, date, gw.eventDayID); err != nil {
		return err
	}

	rows, err := pool.Query(ctx,
		`SELECT id::text FROM matches WHERE event_day_id = $1::uuid`, gw.eventDayID)
	if err != nil {
		return err
	}
	var matchIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			matchIDs = append(matchIDs, id)
		}
	}
	rows.Close()
	if len(matchIDs) == 0 {
		return fmt.Errorf("match day for gameweek %d has no fixtures", gw.number)
	}

	for _, id := range matchIDs {
		// Flag football scores run high; these are in the right range without
		// pretending to be anything but test data.
		home, away := 6*rng.Intn(6), 6*rng.Intn(6)
		if _, err := pool.Exec(ctx, `
			UPDATE matches
			SET date = $1::date, status = 'FINISHED', home_score = $2, away_score = $3
			WHERE id = $4::uuid`, date, home, away, id); err != nil {
			return err
		}
	}

	// Same rule as the admin action: first kickoff minus the season's lock window.
	_, err = pool.Exec(ctx, `
		UPDATE fantasy_gameweeks gw
		SET deadline = (
			SELECT MIN(m.date + m.time)::timestamptz - (fs.lock_mins_before || ' minutes')::interval
			FROM matches m WHERE m.event_day_id = gw.event_day_id
		)
		FROM fantasy_seasons fs
		WHERE gw.id = $1::uuid AND fs.id = gw.season_id`, gw.id)
	return err
}

// seedStats gives every player in a played fixture a plausible line for their
// position, so scoring has real numbers to work from.
func seedStats(ctx ctxT, pool *pgxpool.Pool, compID, eventDayID string, rng *rand.Rand) int {
	rows, err := pool.Query(ctx, `
		SELECT m.id::text, m.home_team_id::text, m.away_team_id::text
		FROM matches m WHERE m.event_day_id = $1::uuid`, eventDayID)
	if err != nil {
		fmt.Println("  ! stats:", err)
		return 0
	}
	type fixture struct{ matchID, home, away string }
	var fixtures []fixture
	for rows.Next() {
		var f fixture
		if err := rows.Scan(&f.matchID, &f.home, &f.away); err == nil {
			fixtures = append(fixtures, f)
		}
	}
	rows.Close()

	n := 0
	for _, f := range fixtures {
		for _, teamID := range []string{f.home, f.away} {
			pl, err := pool.Query(ctx, `SELECT id::text, position FROM players WHERE team_id=$1::uuid`, teamID)
			if err != nil {
				continue
			}
			type p struct{ id, pos string }
			var list []p
			for pl.Next() {
				var one p
				if err := pl.Scan(&one.id, &one.pos); err == nil {
					list = append(list, one)
				}
			}
			pl.Close()

			for _, one := range list {
				var passYds, passTD, intThrown, rec, recYds, recTD, drops int
				var pulls, defl, ints, sacks, defTD int
				switch one.pos {
				case "QB":
					passYds, passTD, intThrown = 40+rng.Intn(120), rng.Intn(3), rng.Intn(2)
				case "Receiver", "Center":
					rec, recYds, recTD, drops = 1+rng.Intn(6), 10+rng.Intn(70), rng.Intn(2), rng.Intn(2)
				case "Rusher":
					sacks, pulls = rng.Intn(3), rng.Intn(5)
				case "Defender":
					pulls, defl, ints = rng.Intn(8), rng.Intn(3), rng.Intn(2)
					if rng.Intn(10) == 0 {
						defTD = 1
					}
				}
				if _, err := pool.Exec(ctx, `
					INSERT INTO player_stats (player_id, team_id, match_id, competition_id, match_date,
						passing_yards, passing_tds, interceptions_thrown,
						receptions, receiving_yards, receiving_tds, drops,
						flag_pulls, pass_deflections, interceptions, def_sacks, defensive_tds)
					SELECT $1::uuid, $2::uuid, $3::uuid, $4::uuid, m.date,
						$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
					FROM matches m WHERE m.id = $3::uuid
					ON CONFLICT (player_id, match_id) DO UPDATE SET
						match_date = EXCLUDED.match_date,
						passing_yards = EXCLUDED.passing_yards,
						passing_tds = EXCLUDED.passing_tds,
						interceptions_thrown = EXCLUDED.interceptions_thrown,
						receptions = EXCLUDED.receptions,
						receiving_yards = EXCLUDED.receiving_yards,
						receiving_tds = EXCLUDED.receiving_tds,
						drops = EXCLUDED.drops,
						flag_pulls = EXCLUDED.flag_pulls,
						pass_deflections = EXCLUDED.pass_deflections,
						interceptions = EXCLUDED.interceptions,
						def_sacks = EXCLUDED.def_sacks,
						defensive_tds = EXCLUDED.defensive_tds`,
					one.id, teamID, f.matchID, compID,
					passYds, passTD, intThrown, rec, recYds, recTD, drops,
					pulls, defl, ints, sacks, defTD); err != nil {
					fmt.Println("  ! stat:", err)
					continue
				}
				n++
			}
		}
	}
	return n
}

func resolveSeason(ctx ctxT, pool *pgxpool.Pool, want string) (id, name, compID, status string) {
	query := `SELECT id::text, name, competition_id::text, status FROM fantasy_seasons
	          WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`
	args := []any{}
	if want != "" {
		query = `SELECT id::text, name, competition_id::text, status FROM fantasy_seasons WHERE id = $1::uuid`
		args = append(args, want)
	}
	_ = pool.QueryRow(ctx, query, args...).Scan(&id, &name, &compID, &status)
	return
}

func listGameweeks(ctx ctxT, pool *pgxpool.Pool, seasonID string) []gameweek {
	rows, err := pool.Query(ctx, `
		SELECT gw.id::text, gw.number, gw.status, gw.event_day_id::text, ed.date
		FROM fantasy_gameweeks gw
		JOIN event_days ed ON ed.id = gw.event_day_id
		WHERE gw.season_id = $1::uuid
		ORDER BY gw.number`, seasonID)
	if err != nil {
		fmt.Println("gameweeks:", err)
		return nil
	}
	defer rows.Close()

	var out []gameweek
	for rows.Next() {
		var gw gameweek
		if err := rows.Scan(&gw.id, &gw.number, &gw.status, &gw.eventDayID, &gw.eventDate); err == nil {
			out = append(out, gw)
		}
	}
	return out
}

// printNextSteps shows the final table and what money is waiting on an admin.
func printNextSteps(ctx ctxT, pool *pgxpool.Pool, seasonID string) {
	fmt.Println("──────────────────────────────────────────────")
	fmt.Println(" Final standings")
	fmt.Println("──────────────────────────────────────────────")
	rows, err := pool.Query(ctx, `
		SELECT ft.name, u.full_name, ft.total_points
		FROM fantasy_teams ft JOIN users u ON u.id = ft.user_id
		WHERE ft.season_id = $1::uuid
		ORDER BY ft.total_points DESC`, seasonID)
	if err == nil {
		i := 1
		for rows.Next() {
			var team, who string
			var pts float64
			if err := rows.Scan(&team, &who, &pts); err == nil {
				fmt.Printf(" %2d. %-22s %-16s %7.2f\n", i, team, who, pts)
				i++
			}
		}
		rows.Close()
	}

	fmt.Println()
	fmt.Println(" Paid leagues waiting to be settled")
	rows, err = pool.Query(ctx, `
		SELECT l.name, l.entry_fee,
		       (SELECT COUNT(*) FROM fantasy_league_members m
		         WHERE m.league_id = l.id AND m.payment_status = 'PAID')
		FROM fantasy_leagues l
		WHERE l.season_id = $1::uuid AND l.entry_fee > 0 AND l.settled_at IS NULL
		ORDER BY l.name`, seasonID)
	if err == nil {
		any := false
		for rows.Next() {
			var name string
			var fee int64
			var paid int
			if err := rows.Scan(&name, &fee, &paid); err == nil {
				any = true
				fmt.Printf("   %-24s %d paid × ₦%s = ₦%s in\n",
					name, paid, naira(fee), naira(fee*int64(paid)))
			}
		}
		rows.Close()
		if !any {
			fmt.Println("   none — every paid league is already settled")
		}
	}

	fmt.Println()
	fmt.Println(" Next, in the admin panel:")
	fmt.Println("   Fantasy → the season → Leagues → a paid league → Settle League")
	fmt.Println("   Settling credits each winner's in-app wallet. No money moves yet.")
	fmt.Println("   Fantasy → Payouts shows what is then owed and which account to pay it to.")
}

func naira(kobo int64) string {
	return fmt.Sprintf("%d", kobo/100)
}
