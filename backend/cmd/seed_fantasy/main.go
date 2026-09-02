// Seeds the local database with a complete fantasy world to test against: a
// competition with six clubs and a legal player pool, one match day already
// played and scored plus two still to come, an active fantasy season, and a
// field of rival managers with real squads and real points.
//
// You then join with your own account and land on a dashboard that already has
// a leaderboard above you and an open gameweek to pick for.
//
// Idempotent — re-run it any time to reset fantasy test data. It only ever
// touches the fantasy tables and its own competition, so the rest of the
// database is left alone. Local only: it refuses to run against anything but
// localhost.
package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	dsn      = "postgres://role:password@localhost:5432/showtime?sslmode=disable"
	password = "Fantasy1234!"

	competitionName = "Fantasy Test Cup 2026"
	seasonName      = "Fantasy Test Season 2026"
)

type ctxT = context.Context

// club is one of the six teams the player pool is spread across. Six clubs
// keeps the "at most 4 players from one team" rule comfortably satisfiable.
type club struct {
	name  string
	short string
	id    string
}

// manager is a rival already on the board when you join.
type manager struct {
	email string
	name  string
	team  string
}

var clubs = []club{
	{name: "Lagos Thunder", short: "LGT"},
	{name: "Abuja Falcons", short: "ABF"},
	{name: "Ibadan Rovers", short: "IBR"},
	{name: "Kano Kings", short: "KNK"},
	{name: "Enugu Storm", short: "ENS"},
	{name: "Port Harcourt Sharks", short: "PHS"},
}

var managers = []manager{
	{"manager1@fantasy.test", "Ada Obi", "Ada's Avengers"},
	{"manager2@fantasy.test", "Tunde Bello", "Bello Ballers"},
	{"manager3@fantasy.test", "Chioma Eze", "Eze Elite"},
	{"manager4@fantasy.test", "Musa Ibrahim", "Musa United"},
	{"manager5@fantasy.test", "Ngozi Okafor", "Okafor XI"},
	{"manager6@fantasy.test", "Segun Ade", "Ade Army"},
	{"manager7@fantasy.test", "Halima Sani", "Sani Stars"},
	{"manager8@fantasy.test", "Emeka Nwosu", "Nwosu Nation"},
}

// squadTemplate is the 12-player roster every club gets. Between them the six
// clubs field far more than the 14 a manager needs, with enough of each
// position and gender to satisfy the quotas several times over.
var squadTemplate = []struct {
	position string
	gender   string
}{
	{"QB", "M"}, {"QB", "F"},
	{"Receiver", "M"}, {"Receiver", "M"}, {"Receiver", "F"}, {"Receiver", "F"},
	{"Center", "F"},
	{"Rusher", "M"}, {"Rusher", "F"},
	{"Defender", "M"}, {"Defender", "F"}, {"Defender", "F"},
}

var firstNames = []string{
	"Ade", "Bola", "Chidi", "Dami", "Ebun", "Femi", "Gbenga", "Hauwa", "Ify", "Jide",
	"Kemi", "Lola", "Maryam", "Nkem", "Obi", "Peju", "Rita", "Sade", "Tobi", "Uche",
	"Vera", "Wale", "Yemi", "Zainab",
}
var lastNames = []string{
	"Adeyemi", "Balogun", "Chukwu", "Danjuma", "Eze", "Fashola", "Gowon", "Hassan",
	"Ibrahim", "Johnson", "Kalu", "Lawal", "Musa", "Nwosu", "Okafor", "Peters",
}

func main() {
	// Prefer the configured DB_URL so this follows the real local setup, and
	// guard whichever one we end up with.
	target := dsn
	if fromEnv := strings.TrimSpace(os.Getenv("DB_URL")); fromEnv != "" {
		target = fromEnv
	}
	if !strings.Contains(target, "localhost") && !strings.Contains(target, "127.0.0.1") {
		fmt.Println("refusing to seed a non-local database")
		os.Exit(1)
	}
	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(target)
	if err != nil {
		fmt.Println("bad DB_URL:", err)
		os.Exit(1)
	}
	// Production pins every connection to Africa/Lagos, and kickoff maths
	// combines a DATE and a TIME — seed under the same zone or the deadlines
	// land an hour out from what the app computes.
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

	// Deterministic, so re-running produces the same league table.
	rng := rand.New(rand.NewSource(20260902))

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		fmt.Println("hash:", err)
		os.Exit(1)
	}

	// 1. Clear previous fantasy state. Seasons cascade to gameweeks, lineups,
	//    leagues and prices, so this leaves nothing dangling.
	exec(ctx, pool, `DELETE FROM fantasy_seasons`)
	exec(ctx, pool, `DELETE FROM fantasy_wallet_transactions`)
	exec(ctx, pool, `DELETE FROM fantasy_payout_requests`)
	exec(ctx, pool, `DELETE FROM fantasy_wallets`)
	fmt.Println("✓ cleared existing fantasy seasons, squads, leagues and wallets")

	// 2. The competition this all hangs off, and its clubs.
	compID := ensureCompetition(ctx, pool, competitionName)
	for i := range clubs {
		clubs[i].id = ensureTeam(ctx, pool, clubs[i].name, clubs[i].short)
	}
	fmt.Printf("✓ competition %q with %d clubs\n", competitionName, len(clubs))

	// 3. A player pool that can actually field a legal 14-man squad.
	playersByClub := map[string][]string{}
	total := 0
	for _, c := range clubs {
		for i, slot := range squadTemplate {
			name := fmt.Sprintf("%s %s (%s)", firstNames[rng.Intn(len(firstNames))],
				lastNames[rng.Intn(len(lastNames))], c.short)
			id := ensurePlayer(ctx, pool, name, slot.position, slot.gender, c.id, i+1)
			if id != "" {
				playersByClub[c.id] = append(playersByClub[c.id], id)
				total++
			}
		}
	}
	fmt.Printf("✓ %d players across the six clubs (QB M/F, Receivers, Centers, Rushers, Defenders)\n", total)

	// 4. Three match days: one already played, two still to come. The played one
	//    gives the leaderboard real points; the future ones give you something
	//    to pick for.
	type day struct {
		title  string
		date   string
		kickAt string
		past   bool
		id     string
	}
	days := []day{
		{title: "Match Day 1", date: "CURRENT_DATE - 7", kickAt: "15:00", past: true},
		{title: "Match Day 2", date: "CURRENT_DATE + 3", kickAt: "15:00"},
		{title: "Match Day 3", date: "CURRENT_DATE + 10", kickAt: "15:00"},
	}
	for i := range days {
		days[i].id = ensureEventDay(ctx, pool, days[i].title, days[i].date)
		// Three fixtures per day pairs all six clubs.
		for m := 0; m < 3; m++ {
			home, away := clubs[m*2], clubs[m*2+1]
			status := "SCHEDULED"
			if days[i].past {
				status = "FINISHED"
			}
			ensureMatch(ctx, pool, compID, home.id, away.id, days[i].id, days[i].date,
				fmt.Sprintf("1%d:00", 3+m), status)
		}
	}
	fmt.Println("✓ 3 match days (1 played, 2 upcoming) with 3 fixtures each")

	// 5. Stats for the played day, so scoring has something real to work on.
	statRows := seedStats(ctx, pool, compID, days[0].id, rng)
	fmt.Printf("✓ %d player stat lines recorded for Match Day 1\n", statRows)

	// 6. The season itself, live and open.
	seasonID := createSeason(ctx, pool, compID)
	gwIDs := make([]string, 0, len(days))
	for i, d := range days {
		locked := "SCHEDULED"
		if d.past {
			locked = "FINALIZED"
		}
		gwIDs = append(gwIDs, createGameweek(ctx, pool, seasonID, i+1, d.id, locked))
	}
	fmt.Printf("✓ season %q is ACTIVE with %d gameweeks\n", seasonName, len(gwIDs))

	// 7. Opening prices. Every player starts at the 10.00 SC baseline; the admin
	//    "Initialize Player Prices" action recomputes them from ratings.
	exec(ctx, pool, `
		INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, base_price, rating, price)
		SELECT $1::uuid, p.id, NULL, 10.00, 5.00, 10.00
		FROM players p WHERE p.team_id = ANY($2::uuid[])
		ON CONFLICT DO NOTHING`, seasonID, clubIDs())
	fmt.Println("✓ opening player prices set")

	// 8. A public mini-league to join, and a paid one to test the Paystack flow.
	freeLeague := createLeague(ctx, pool, seasonID, "Open Test League", "PUBLIC", 0, "TESTFREE")
	paidLeague := createLeague(ctx, pool, seasonID, "Cash Test League", "PUBLIC", 200000, "TESTCASH")
	fmt.Println("✓ two public mini-leagues: Open Test League (free), Cash Test League (₦2,000)")

	// 9. The rival managers, each with a real squad for both the played and the
	//    open gameweek, so the table has depth and the rollover has history.
	for i, m := range managers {
		userID := upsertUser(ctx, pool, hash, m.email, m.name, "user")
		teamID := enterSeason(ctx, pool, userID, seasonID, m.team)

		squad := pickSquad(playersByClub, rng)
		// Match Day 1: locked, and scored below.
		saveLineup(ctx, pool, teamID, gwIDs[0], squad, "LOCKED")
		// Match Day 2: a draft they could still change, like a real manager.
		saveLineup(ctx, pool, teamID, gwIDs[1], squad, "DRAFT")

		// Half of them join each mini-league, so the tables differ.
		if i%2 == 0 {
			joinLeague(ctx, pool, freeLeague, userID, teamID, "FREE")
		}
		if i%3 == 0 {
			joinLeague(ctx, pool, paidLeague, userID, teamID, "PAID")
		}
	}
	fmt.Printf("✓ %d rival managers entered, each with a squad\n", len(managers))

	// 10. Score the played gameweek the same way the app does: each pick's
	//     points come from that player's stat line, the lineup is the sum, and
	//     the season total is rebuilt from locked lineups.
	scoreGameweek(ctx, pool, seasonID, gwIDs[0], days[0].id)
	fmt.Println("✓ Match Day 1 scored — the leaderboard now has real points")

	summary(ctx, pool, seasonID)
}

func clubIDs() []string {
	ids := make([]string, 0, len(clubs))
	for _, c := range clubs {
		ids = append(ids, c.id)
	}
	return ids
}

// pickSquad assembles a legal 14: a male and female QB, five receivers (Centers
// count, and at least two must be female to reach three females on offense), a
// rusher and six defenders with three females between them, never more than
// four players from one club.
func pickSquad(byClub map[string][]string, rng *rand.Rand) map[string]string {
	// Nothing random about legality — take the roster slots that satisfy the
	// quotas by construction, spread across clubs to respect the club cap.
	// Club order is rotated per squad so managers don't all field the same XI.
	order := make([]string, 0, len(clubs))
	for _, c := range clubs {
		order = append(order, c.id)
	}
	rng.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })

	// squadTemplate index → what that player is.
	const (
		qbM  = 0
		qbF  = 1
		recM = 2
		recF = 4
		cenF = 6
		rusM = 7
		rusF = 8
		defM = 9
		defF = 10
	)
	at := func(clubIdx, slot int) string { return byClub[order[clubIdx]][slot] }

	return map[string]string{
		// Offence: female QB + 2 female receivers = 3 females.
		"QB_M":  at(0, qbM),
		"QB_F":  at(1, qbF),
		"REC_1": at(2, recF),
		"REC_2": at(3, recF),
		"REC_3": at(0, recM),
		"REC_4": at(1, recM),
		"REC_5": at(2, cenF), // a Center, which a receiver slot accepts
		// Defence: female rusher + 2 female defenders = 3 females.
		"RUSHER": at(3, rusF),
		"DEF_1":  at(4, defF),
		"DEF_2":  at(5, defF),
		"DEF_3":  at(0, defM),
		"DEF_4":  at(1, defM),
		"DEF_5":  at(2, defM),
		"DEF_6":  at(3, defM),
	}
}

// ─── Writers ─────────────────────────────────────────────────────────────────

func ensureCompetition(ctx ctxT, pool *pgxpool.Pool, name string) string {
	var id string
	_ = pool.QueryRow(ctx, `SELECT id::text FROM competitions WHERE name=$1`, name).Scan(&id)
	if id != "" {
		return id
	}
	// logo is nullable but is read into a plain string in several queries, so
	// seed an empty string rather than leaving it NULL.
	_ = pool.QueryRow(ctx, `INSERT INTO competitions (name, logo) VALUES ($1, '') RETURNING id::text`, name).Scan(&id)
	return id
}

func ensureTeam(ctx ctxT, pool *pgxpool.Pool, name, short string) string {
	var id string
	_ = pool.QueryRow(ctx, `SELECT id::text FROM teams WHERE name=$1`, name).Scan(&id)
	if id != "" {
		return id
	}
	_ = pool.QueryRow(ctx, `INSERT INTO teams (name, short_name, logo) VALUES ($1,$2,'') RETURNING id::text`,
		name, short).Scan(&id)
	return id
}

func ensurePlayer(ctx ctxT, pool *pgxpool.Pool, name, position, gender, teamID string, jersey int) string {
	var id string
	_ = pool.QueryRow(ctx, `SELECT id::text FROM players WHERE name=$1 AND team_id=$2::uuid`,
		name, teamID).Scan(&id)
	if id != "" {
		exec(ctx, pool, `UPDATE players SET position=$1, gender=$2 WHERE id=$3::uuid`, position, gender, id)
		return id
	}
	err := pool.QueryRow(ctx, `
		INSERT INTO players (name, position, gender, team_id, jersey_number)
		VALUES ($1,$2,$3,$4::uuid,$5) RETURNING id::text`,
		name, position, gender, teamID, jersey).Scan(&id)
	if err != nil {
		fmt.Println("  ! player", name, err)
		return ""
	}
	return id
}

func ensureEventDay(ctx ctxT, pool *pgxpool.Pool, title, dateExpr string) string {
	var id string
	// event_days.date is UNIQUE, so match on the date rather than the title.
	_ = pool.QueryRow(ctx, `SELECT id::text FROM event_days WHERE date = `+dateExpr).Scan(&id)
	if id != "" {
		exec(ctx, pool, `UPDATE event_days SET title=$1 WHERE id=$2::uuid`, title, id)
		return id
	}
	_ = pool.QueryRow(ctx, `INSERT INTO event_days (title, date) VALUES ($1, `+dateExpr+`) RETURNING id::text`,
		title).Scan(&id)
	return id
}

func ensureMatch(ctx ctxT, pool *pgxpool.Pool, compID, home, away, eventDayID, dateExpr, kickoff, status string) {
	var exists bool
	_ = pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM matches
		WHERE event_day_id=$1::uuid AND home_team_id=$2::uuid AND away_team_id=$3::uuid)`,
		eventDayID, home, away).Scan(&exists)
	if exists {
		return
	}
	exec(ctx, pool, `
		INSERT INTO matches (competition_id, home_team_id, away_team_id, date, time, event_day_id, status, venue)
		VALUES ($1::uuid, $2::uuid, $3::uuid, `+dateExpr+`, $4::time, $5::uuid, $6, 'Test Arena')`,
		compID, home, away, kickoff, eventDayID, status)
}

// seedStats gives every player in a played fixture a plausible line for their
// position, so fantasy scoring has real numbers to work from.
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
				exec(ctx, pool, `
					INSERT INTO player_stats (player_id, team_id, match_id, competition_id, match_date,
						passing_yards, passing_tds, interceptions_thrown,
						receptions, receiving_yards, receiving_tds, drops,
						flag_pulls, pass_deflections, interceptions, def_sacks, defensive_tds)
					SELECT $1::uuid, $2::uuid, $3::uuid, $4::uuid, m.date,
						$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
					FROM matches m WHERE m.id = $3::uuid
					ON CONFLICT (player_id, match_id) DO NOTHING`,
					one.id, teamID, f.matchID, compID,
					passYds, passTD, intThrown, rec, recYds, recTD, drops,
					pulls, defl, ints, sacks, defTD)
				n++
			}
		}
	}
	return n
}

func createSeason(ctx ctxT, pool *pgxpool.Pool, compID string) string {
	var id string
	_ = pool.QueryRow(ctx, `
		INSERT INTO fantasy_seasons (competition_id, name, status)
		VALUES ($1::uuid, $2, 'ACTIVE') RETURNING id::text`, compID, seasonName).Scan(&id)
	// The season's official league is system-owned and has no human creator.
	exec(ctx, pool, `
		INSERT INTO fantasy_leagues (season_id, name, type, created_by_user_id, entry_fee)
		VALUES ($1::uuid, $2, 'OVERALL', NULL, 0)`, id, seasonName+" — Official League")
	return id
}

// createGameweek derives the deadline from the day's FIRST kickoff minus the
// season's 15-minute lock window — the same rule the admin action applies, read
// from the fixtures rather than assumed, so it always agrees with the app.
func createGameweek(ctx ctxT, pool *pgxpool.Pool, seasonID string, number int, eventDayID, status string) string {
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO fantasy_gameweeks (season_id, number, event_day_id, deadline, status)
		SELECT $1::uuid, $2, $3::uuid,
		       MIN(m.date + m.time)::timestamptz - INTERVAL '15 minutes', $4
		FROM matches m WHERE m.event_day_id = $3::uuid
		RETURNING id::text`, seasonID, number, eventDayID, status).Scan(&id)
	if err != nil {
		fmt.Println("  ! gameweek", number, err)
	}
	return id
}

func createLeague(ctx ctxT, pool *pgxpool.Pool, seasonID, name, kind string, entryFee int, code string) string {
	var id string
	_ = pool.QueryRow(ctx, `
		INSERT INTO fantasy_leagues (season_id, name, type, invite_code, created_by_user_id, entry_fee)
		VALUES ($1::uuid, $2, $3, $4, NULL, $5) RETURNING id::text`,
		seasonID, name, kind, code, entryFee).Scan(&id)
	return id
}

func upsertUser(ctx ctxT, pool *pgxpool.Pool, hash []byte, email, name, role string) string {
	var id string
	_ = pool.QueryRow(ctx, `SELECT id::text FROM users WHERE LOWER(email)=LOWER($1)`, email).Scan(&id)
	if id != "" {
		exec(ctx, pool, `UPDATE users SET full_name=$1, password_hash=$2, role=$3 WHERE id=$4::uuid`,
			name, hash, role, id)
		return id
	}
	_ = pool.QueryRow(ctx, `
		INSERT INTO users (full_name, email, password_hash, role)
		VALUES ($1,$2,$3,$4) RETURNING id::text`, name, email, hash, role).Scan(&id)
	return id
}

func enterSeason(ctx ctxT, pool *pgxpool.Pool, userID, seasonID, teamName string) string {
	var id string
	_ = pool.QueryRow(ctx, `
		INSERT INTO fantasy_teams (user_id, season_id, name) VALUES ($1::uuid, $2::uuid, $3)
		ON CONFLICT (user_id, season_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id::text`, userID, seasonID, teamName).Scan(&id)
	return id
}

func saveLineup(ctx ctxT, pool *pgxpool.Pool, teamID, gameweekID string, squad map[string]string, status string) {
	var lineupID string
	lockedAt := "NULL"
	if status == "LOCKED" {
		lockedAt = "NOW()"
	}
	err := pool.QueryRow(ctx, `
		INSERT INTO fantasy_lineups (team_id, gameweek_id, total_spent, status, locked_at)
		VALUES ($1::uuid, $2::uuid, 140.00, $3, `+lockedAt+`)
		ON CONFLICT (team_id, gameweek_id) DO UPDATE SET status = EXCLUDED.status
		RETURNING id::text`, teamID, gameweekID, status).Scan(&lineupID)
	if err != nil {
		fmt.Println("  ! lineup:", err)
		return
	}
	exec(ctx, pool, `DELETE FROM fantasy_lineup_picks WHERE lineup_id=$1::uuid`, lineupID)
	for slot, playerID := range squad {
		if playerID == "" {
			continue
		}
		exec(ctx, pool, `
			INSERT INTO fantasy_lineup_picks (lineup_id, player_id, slot, purchase_price)
			VALUES ($1::uuid, $2::uuid, $3, 10.00)`, lineupID, playerID, slot)
	}
}

func joinLeague(ctx ctxT, pool *pgxpool.Pool, leagueID, userID, teamID, payment string) {
	exec(ctx, pool, `
		INSERT INTO fantasy_league_members (league_id, user_id, team_id, payment_status)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
		ON CONFLICT (league_id, user_id) DO UPDATE SET payment_status = EXCLUDED.payment_status`,
		leagueID, userID, teamID, payment)
}

// scoreGameweek mirrors the production scoring path in SQL: each pick takes its
// player's points for the day, the lineup is the sum of its picks, and season
// totals are rebuilt from locked lineups rather than incremented.
func scoreGameweek(ctx ctxT, pool *pgxpool.Pool, seasonID, gameweekID, eventDayID string) {
	// Points per player for this match day, using the live scoring weights.
	exec(ctx, pool, `
		WITH scored AS (
			SELECT ps.player_id,
			       SUM( ps.passing_yards * 0.010 + ps.passing_tds * 2.0
			          + ps.interceptions_thrown * -0.5 + ps.qb_sacks * -0.25
			          + ps.rushing_yards * 0.025 + ps.rushing_tds * 2.0
			          + ps.receptions * 0.25 + ps.receiving_yards * 0.025
			          + ps.receiving_tds * 2.0 + ps.drops * -0.25
			          + ps.xp_good * 0.25 + ps.extra_points_tds * 0.25
			          + ps.bad_snaps * -0.25
			          + ps.flag_pulls * 0.05 + ps.pass_deflections * 0.25
			          + ps.interceptions * 1.25 + ps.def_sacks * 0.75
			          + ps.defensive_tds * 2.0 + ps.defensive_xp_tds * 1.0
			          + ps.safety * 1.25 ) AS pts
			FROM player_stats ps
			JOIN matches m ON ps.match_id = m.id
			WHERE m.event_day_id = $1::uuid
			GROUP BY ps.player_id
		)
		UPDATE fantasy_lineup_picks flp
		SET points = COALESCE(s.pts, 0)
		FROM fantasy_lineups fl
		LEFT JOIN scored s ON TRUE
		WHERE flp.lineup_id = fl.id AND fl.gameweek_id = $2::uuid
		  AND s.player_id = flp.player_id`, eventDayID, gameweekID)

	exec(ctx, pool, `
		UPDATE fantasy_lineups fl
		SET points = COALESCE((SELECT SUM(p.points) FROM fantasy_lineup_picks p WHERE p.lineup_id = fl.id), 0)
		WHERE fl.gameweek_id = $1::uuid`, gameweekID)

	exec(ctx, pool, `
		UPDATE fantasy_teams ft
		SET total_points = COALESCE((
			SELECT SUM(fl.points) FROM fantasy_lineups fl
			WHERE fl.team_id = ft.id AND fl.status = 'LOCKED'), 0)
		WHERE ft.season_id = $1::uuid`, seasonID)
}

func summary(ctx ctxT, pool *pgxpool.Pool, seasonID string) {
	fmt.Println()
	fmt.Println("──────────────────────────────────────────────")
	fmt.Println(" Ready to test")
	fmt.Println("──────────────────────────────────────────────")

	rows, err := pool.Query(ctx, `
		SELECT ft.name, u.full_name, ft.total_points
		FROM fantasy_teams ft JOIN users u ON ft.user_id = u.id
		WHERE ft.season_id = $1::uuid
		ORDER BY ft.total_points DESC LIMIT 10`, seasonID)
	if err == nil {
		fmt.Println(" Leaderboard after Match Day 1:")
		rank := 1
		for rows.Next() {
			var team, who string
			var pts float64
			if err := rows.Scan(&team, &who, &pts); err == nil {
				fmt.Printf("   %2d. %-18s %-14s %6.2f pts\n", rank, team, who, pts)
				rank++
			}
		}
		rows.Close()
	}

	var gwNum int
	var deadline time.Time
	_ = pool.QueryRow(ctx, `
		SELECT number, deadline FROM fantasy_gameweeks
		WHERE season_id=$1::uuid AND status='SCHEDULED' ORDER BY number LIMIT 1`, seasonID).Scan(&gwNum, &deadline)

	fmt.Println()
	fmt.Printf(" Open for entry : Match Day %d, deadline %s\n", gwNum, deadline.Format("Mon 2 Jan, 15:04"))
	fmt.Printf(" Rival managers : %d, all with password %q\n", len(managers), password)
	fmt.Println(" Mini-leagues   : Open Test League (free, code TESTFREE)")
	fmt.Println("                  Cash Test League (₦2,000, code TESTCASH)")
	fmt.Println()
	fmt.Println(" Next: sign in with your own account, open /fantasy and Join This Season.")
	fmt.Println("──────────────────────────────────────────────")
}

func exec(ctx ctxT, pool *pgxpool.Pool, sql string, args ...any) {
	if _, err := pool.Exec(ctx, sql, args...); err != nil {
		fmt.Println("  !", strings.SplitN(strings.TrimSpace(sql), "\n", 2)[0], "->", err)
	}
}
