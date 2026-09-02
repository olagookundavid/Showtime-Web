package tests_integration

// Integration coverage for the fantasy repositories.
//
// These exist because the fantasy layer is almost entirely hand-written SQL:
// neither the Go compiler nor the service-level unit tests (which use fake
// repositories) can catch a query that references a column that isn't there.
// Exactly that bug shipped once — the leaderboards selected `u.name` when the
// users table has `full_name` — and it would only have surfaced as a 500 in
// production. Every query here is executed against a real, fully-migrated
// schema so a mismatch fails the build instead.
//
// To run:
//  1. Start Postgres and apply the migrations:
//     goose -dir internal/sql/migrations postgres "$TEST_DB_DSN" up
//  2. TEST_DB_DSN='postgres://user:pass@localhost:5432/db?sslmode=disable' \
//     go test ./tests/integration/ -v
//
// Skipped automatically when TEST_DB_DSN is unset.

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type fantasyFixture struct {
	pool       *pgxpool.Pool
	compID     string
	seasonID   string
	gameweekID string
	eventDayID string
	leagueID   string
	teamID     string
	userID     string
	playerID   string
	clubID     string
	inviteCode string
}

// fixtureSeq namespaces concurrent fixtures.
var fixtureSeq int64

func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...interface{}) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("fixture setup failed: %v\nSQL: %s", err, sql)
	}
}

func mustScan(t *testing.T, pool *pgxpool.Pool, sql string, args ...interface{}) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(&id); err != nil {
		t.Fatalf("fixture setup failed: %v\nSQL: %s", err, sql)
	}
	return id
}

// setupFantasyFixture builds a minimal but complete fantasy world: a season
// with one gameweek, a paid league, a manager with a locked lineup, and a
// wallet. Everything is namespaced so it can be torn down cleanly.
func setupFantasyFixture(t *testing.T) *fantasyFixture {
	t.Helper()

	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("Skipping fantasy integration tests: TEST_DB_DSN not set")
	}

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("failed to parse TEST_DB_DSN: %v", err)
	}
	// Production pins every connection to Africa/Lagos (see cmd/main/main_setup).
	// Kickoff maths combines a DATE and a TIME, so the session zone changes the
	// answer — the test must run under the same zone as production.
	cfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error {
		_, err := c.Exec(ctx, "SET TIME ZONE 'Africa/Lagos'")
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("failed to connect to the test database: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("failed to reach the test database: %v", err)
	}

	// Each fixture gets its own namespace so several tests can build one
	// without colliding on the unique email / event-day date / invite code.
	n := atomic.AddInt64(&fixtureSeq, 1)
	// Unique per run, not just per process: if a cleanup ever fails, the next
	// run must not inherit its rows and fail on a unique constraint.
	seed := time.Now().UnixNano() % 1000000
	tag := fmt.Sprintf("ITest%d%d", seed, n)
	// event_days.date is UNIQUE, so each fixture needs its own calendar day.
	// Spreading by the same per-run seed keeps repeat runs from colliding.
	dayOffset := 30 + int(seed%4000) + int(n)*11
	f := &fantasyFixture{pool: pool}

	f.compID = mustScan(t, pool,
		`INSERT INTO competitions (name) VALUES ('ITest Competition') RETURNING id`)
	f.clubID = mustScan(t, pool,
		`INSERT INTO teams (name, short_name) VALUES ('ITest Club', 'ITC') RETURNING id`)
	f.userID = mustScan(t, pool,
		`INSERT INTO users (full_name, email, password_hash, role)
		 VALUES ('ITest Manager', $1, ''::bytea, 'user') RETURNING id`,
		tag+"@example.invalid")
	f.playerID = mustScan(t, pool,
		`INSERT INTO players (name, position, gender, team_id) VALUES ('ITest Receiver', 'Receiver', 'F', $1) RETURNING id`,
		f.clubID)

	f.eventDayID = mustScan(t, pool,
		`INSERT INTO event_days (title, date) VALUES ('ITest Day', CURRENT_DATE + $1::int) RETURNING id`, dayOffset)
	matchID := mustScan(t, pool,
		`INSERT INTO matches (competition_id, home_team_id, away_team_id, date, time, event_day_id)
		 VALUES ($1, $2, $2, CURRENT_DATE + $4::int, '15:00', $3) RETURNING id`,
		f.compID, f.clubID, f.eventDayID, dayOffset)
	mustExec(t, pool,
		`INSERT INTO player_stats (player_id, team_id, match_id, competition_id, match_date, receptions, receiving_yards, receiving_tds)
		 VALUES ($1, $2, $3, $4, CURRENT_DATE + $5::int, 5, 80, 1)`,
		f.playerID, f.clubID, matchID, f.compID, dayOffset)

	f.seasonID = mustScan(t, pool,
		`INSERT INTO fantasy_seasons (competition_id, name, status) VALUES ($1, 'ITest Season', 'ACTIVE') RETURNING id`,
		f.compID)
	f.gameweekID = mustScan(t, pool,
		`INSERT INTO fantasy_gameweeks (season_id, number, event_day_id, deadline)
		 VALUES ($1, 1, $2, NOW() + INTERVAL '1 day') RETURNING id`,
		f.seasonID, f.eventDayID)
	f.teamID = mustScan(t, pool,
		`INSERT INTO fantasy_teams (user_id, season_id, name, total_points)
		 VALUES ($1, $2, 'ITest XI', 42.5) RETURNING id`,
		f.userID, f.seasonID)
	f.leagueID = mustScan(t, pool,
		`INSERT INTO fantasy_leagues (season_id, name, type, invite_code, created_by_user_id, entry_fee)
		 VALUES ($1, 'ITest League', 'PRIVATE', $3, $2, 100000) RETURNING id`,
		f.seasonID, f.userID, tag+"A")
	f.inviteCode = tag + "A"
	mustExec(t, pool,
		`INSERT INTO fantasy_league_members (league_id, user_id, team_id, payment_status)
		 VALUES ($1, $2, $3, 'PAID')`,
		f.leagueID, f.userID, f.teamID)

	lineupID := mustScan(t, pool,
		`INSERT INTO fantasy_lineups (team_id, gameweek_id, total_spent, status, locked_at)
		 VALUES ($1, $2, 140.00, 'LOCKED', NOW()) RETURNING id`,
		f.teamID, f.gameweekID)
	mustExec(t, pool,
		`INSERT INTO fantasy_lineup_picks (lineup_id, player_id, slot, purchase_price)
		 VALUES ($1, $2, 'REC_1', 10.00)`,
		lineupID, f.playerID)
	mustExec(t, pool,
		`INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, price) VALUES ($1, $2, NULL, 10.00)`,
		f.seasonID, f.playerID)
	mustExec(t, pool,
		`INSERT INTO fantasy_wallets (user_id, balance_kobo) VALUES ($1, 500000)`, f.userID)
	mustExec(t, pool,
		`INSERT INTO fantasy_payout_requests (user_id, amount_kobo, bank_name, account_number, account_name)
		 VALUES ($1, 200000, 'ITest Bank', '0123456789', 'ITest Manager')`, f.userID)

	t.Cleanup(func() {
		// Order matters: the season's rows reference the user and competition.
		// Failures are logged rather than ignored — silent cleanup failures
		// leave rows that break the next run on a unique constraint.
		for _, step := range []struct {
			what string
			sql  string
			arg  string
		}{
			{"lineups", `DELETE FROM fantasy_lineups WHERE team_id IN (SELECT id FROM fantasy_teams WHERE season_id = $1)`, f.seasonID},
			{"season", `DELETE FROM fantasy_seasons WHERE id = $1`, f.seasonID},
			{"player stats", `DELETE FROM player_stats WHERE competition_id = $1`, f.compID},
			{"matches", `DELETE FROM matches WHERE competition_id = $1`, f.compID},
			{"event day", `DELETE FROM event_days WHERE id = $1`, f.eventDayID},
			{"players", `DELETE FROM players WHERE team_id = $1`, f.clubID},
			{"user", `DELETE FROM users WHERE id = $1`, f.userID},
			{"competition", `DELETE FROM competitions WHERE id = $1`, f.compID},
			{"club", `DELETE FROM teams WHERE id = $1`, f.clubID},
		} {
			if _, err := pool.Exec(ctx, step.sql, step.arg); err != nil {
				t.Logf("cleanup: could not remove %s: %v", step.what, err)
			}
		}
		pool.Close()
	})

	return f
}

// TestFantasyRepositoryQueries executes every fantasy read path against a real
// schema. The assertion that matters most is simply "no error" — a column that
// doesn't exist, or a scan into the wrong Go type, fails here.
func TestFantasyRepositoryQueries(t *testing.T) {
	f := setupFantasyFixture(t)
	ctx := context.Background()
	repo := ports.NewFantasyRepository(f.pool)

	t.Run("season and gameweek reads", func(t *testing.T) {
		if _, err := repo.GetActiveSeason(ctx); err != nil {
			t.Errorf("GetActiveSeason: %v", err)
		}
		if _, err := repo.GetSeasonByID(ctx, f.seasonID); err != nil {
			t.Errorf("GetSeasonByID: %v", err)
		}
		if _, err := repo.GetGameweekByID(ctx, f.gameweekID); err != nil {
			t.Errorf("GetGameweekByID: %v", err)
		}
		if _, err := repo.GetCurrentGameweek(ctx, f.seasonID); err != nil {
			t.Errorf("GetCurrentGameweek: %v", err)
		}
		if _, err := repo.ListGameweeks(ctx, f.seasonID); err != nil {
			t.Errorf("ListGameweeks: %v", err)
		}
		if _, err := repo.GetGameweeksDueForLock(ctx); err != nil {
			t.Errorf("GetGameweeksDueForLock: %v", err)
		}
	})

	// A season is created as DRAFT, and GetActiveSeason only returns ACTIVE
	// ones. Without a listing that ignores status, an admin cannot see — let
	// alone activate — the season they just created, and the whole feature is
	// unreachable. This guards that dead end.
	t.Run("a draft season is invisible to GetActiveSeason but listed for admin", func(t *testing.T) {
		draftID := mustScan(t, f.pool,
			`INSERT INTO fantasy_seasons (competition_id, name, status) VALUES ($1, 'ITest Draft', 'DRAFT') RETURNING id`,
			f.compID)
		t.Cleanup(func() {
			_, _ = f.pool.Exec(ctx, `DELETE FROM fantasy_seasons WHERE id = $1`, draftID)
		})

		active, err := repo.GetActiveSeason(ctx)
		if err != nil {
			t.Fatalf("GetActiveSeason: %v", err)
		}
		if active != nil && active.ID == draftID {
			t.Error("GetActiveSeason must not return a DRAFT season")
		}

		all, err := repo.ListSeasons(ctx)
		if err != nil {
			t.Fatalf("ListSeasons: %v", err)
		}
		var foundDraft bool
		for _, s := range all {
			if s.ID == draftID {
				foundDraft = true
				if s.Status != domain.FantasySeasonDraft {
					t.Errorf("expected the season to be DRAFT, got %s", s.Status)
				}
			}
		}
		if !foundDraft {
			t.Error("ListSeasons must include DRAFT seasons so an admin can activate them")
		}

		// And once activated it becomes the live season players can see.
		if err := repo.UpdateSeasonStatus(ctx, draftID, domain.FantasySeasonActive); err != nil {
			t.Fatalf("UpdateSeasonStatus: %v", err)
		}
		activated, err := repo.GetActiveSeason(ctx)
		if err != nil {
			t.Fatalf("GetActiveSeason after activation: %v", err)
		}
		if activated == nil {
			t.Fatal("expected an active season after activation")
		}
	})

	// Deleting a season cascades to its gameweeks, leagues and prices, so the
	// guards matter: an admin clearing up seasons created by mistake must never
	// be able to erase a live competition or one people have entered.
	t.Run("only an unentered draft season can be deleted", func(t *testing.T) {
		draftID := mustScan(t, f.pool,
			`INSERT INTO fantasy_seasons (competition_id, name, status) VALUES ($1, 'ITest Deletable', 'DRAFT') RETURNING id`,
			f.compID)

		if err := repo.DeleteSeason(ctx, draftID); err != nil {
			t.Fatalf("an empty draft should be deletable: %v", err)
		}
		if gone, _ := repo.GetSeasonByID(ctx, draftID); gone != nil {
			t.Error("expected the draft season to be gone")
		}

		// The fixture season is ACTIVE and has a squad entered.
		err := repo.DeleteSeason(ctx, f.seasonID)
		if err == nil {
			t.Fatal("expected an active season to be undeletable")
		}
		if !strings.Contains(err.Error(), "draft") {
			t.Errorf("expected the refusal to explain the draft rule, got: %v", err)
		}
		if still, _ := repo.GetSeasonByID(ctx, f.seasonID); still == nil {
			t.Error("the active season must survive a refused delete")
		}

		// A draft that already has a squad entered is also protected.
		enteredID := mustScan(t, f.pool,
			`INSERT INTO fantasy_seasons (competition_id, name, status) VALUES ($1, 'ITest Entered', 'DRAFT') RETURNING id`,
			f.compID)
		mustExec(t, f.pool,
			`INSERT INTO fantasy_teams (user_id, season_id, name) VALUES ($1, $2, 'Squatter XI')`,
			f.userID, enteredID)
		t.Cleanup(func() {
			_, _ = f.pool.Exec(ctx, `DELETE FROM fantasy_seasons WHERE id = $1`, enteredID)
		})

		if err := repo.DeleteSeason(ctx, enteredID); err == nil {
			t.Error("expected a draft with squads entered to be undeletable")
		}
	})

	t.Run("first kickoff resolves through the event day FK", func(t *testing.T) {
		kickoff, err := repo.GetEventDayFirstKickoff(ctx, f.eventDayID)
		if err != nil {
			t.Fatalf("GetEventDayFirstKickoff: %v", err)
		}
		if kickoff == nil {
			t.Fatal("expected a kickoff for an event day that has a fixture")
		}
		if kickoff.Hour() != 15 {
			t.Errorf("expected a 15:00 kickoff, got %s", kickoff.Format(time.RFC3339))
		}
	})

	t.Run("player market with position and gender filters", func(t *testing.T) {
		// The receiver slot's real query shape: two positions plus no gender lock.
		list, total, err := repo.ListPlayerMarket(ctx, f.seasonID, []string{"Receiver", "Center"}, "", "", "", "", 1, 50)
		if err != nil {
			t.Fatalf("ListPlayerMarket: %v", err)
		}
		if total == 0 || len(list) == 0 {
			t.Fatal("expected the seeded receiver to appear in the market")
		}
		if _, _, err := repo.ListPlayerMarket(ctx, f.seasonID, []string{"QB"}, "F", "", "", "selected", 1, 50); err != nil {
			t.Errorf("ListPlayerMarket with a gender filter: %v", err)
		}
	})

	t.Run("season rating lines aggregate", func(t *testing.T) {
		lines, err := repo.GetSeasonRatingLines(ctx, f.compID)
		if err != nil {
			t.Fatalf("GetSeasonRatingLines: %v", err)
		}
		var found bool
		for _, l := range lines {
			if l.PlayerID == f.playerID {
				found = true
				if l.Line.Receptions != 5 || l.Line.ReceivingTDs != 1 {
					t.Errorf("expected the seeded stat line to roll up, got %+v", l.Line)
				}
			}
		}
		if !found {
			t.Error("expected the seeded player in the rating lines")
		}
	})

	t.Run("lineup reads and candidate resolution", func(t *testing.T) {
		if _, err := repo.GetLineup(ctx, f.teamID, f.gameweekID); err != nil {
			t.Errorf("GetLineup: %v", err)
		}
		if _, err := repo.GetLockedLineupsForGameweek(ctx, f.gameweekID); err != nil {
			t.Errorf("GetLockedLineupsForGameweek: %v", err)
		}
		if _, err := repo.GetLatestPriorLockedLineup(ctx, f.teamID, 5); err != nil {
			t.Errorf("GetLatestPriorLockedLineup: %v", err)
		}

		candidates, err := repo.GetLineupCandidates(ctx, f.seasonID, f.gameweekID, []string{f.playerID})
		if err != nil {
			t.Fatalf("GetLineupCandidates: %v", err)
		}
		c, ok := candidates[f.playerID]
		if !ok {
			t.Fatal("expected the seeded player among the candidates")
		}
		if c.Position != "Receiver" || c.Gender != "F" || c.Price != 10.00 {
			t.Errorf("candidate resolved wrongly: %+v", c)
		}
	})

	t.Run("stats resolve through matches.event_day_id", func(t *testing.T) {
		stats, err := repo.GetPlayerStatsByEventDay(ctx, f.eventDayID)
		if err != nil {
			t.Fatalf("GetPlayerStatsByEventDay: %v", err)
		}
		if len(stats) == 0 {
			t.Fatal("expected the seeded stat line for the event day")
		}
	})

	// Powers the "you are Nth of M" figure on the manager's dashboard.
	t.Run("overall rank", func(t *testing.T) {
		rank, total, err := repo.GetTeamOverallRank(ctx, f.seasonID, f.teamID)
		if err != nil {
			t.Fatalf("GetTeamOverallRank: %v", err)
		}
		if rank != 1 || total != 1 {
			t.Errorf("expected the only manager to be 1 of 1, got %d of %d", rank, total)
		}

		// A manager who isn't in the season has no rank rather than an error.
		rank, _, err = repo.GetTeamOverallRank(ctx, f.seasonID, "00000000-0000-0000-0000-000000000000")
		if err != nil {
			t.Fatalf("GetTeamOverallRank for an unknown team: %v", err)
		}
		if rank != 0 {
			t.Errorf("expected no rank for a team outside the season, got %d", rank)
		}
	})

	t.Run("team reads and total recalculation", func(t *testing.T) {
		if _, err := repo.GetTeamByUserAndSeason(ctx, f.userID, f.seasonID); err != nil {
			t.Errorf("GetTeamByUserAndSeason: %v", err)
		}
		if _, err := repo.GetTeamByID(ctx, f.teamID); err != nil {
			t.Errorf("GetTeamByID: %v", err)
		}
		if _, err := repo.ListAllActiveTeamsInSeason(ctx, f.seasonID); err != nil {
			t.Errorf("ListAllActiveTeamsInSeason: %v", err)
		}
		if err := repo.RecalculateTeamTotalPoints(ctx, f.teamID); err != nil {
			t.Errorf("RecalculateTeamTotalPoints: %v", err)
		}
		if err := repo.RecalculateAllTeamTotalsInSeason(ctx, f.seasonID); err != nil {
			t.Errorf("RecalculateAllTeamTotalsInSeason: %v", err)
		}
	})

	t.Run("pick points and gameweek points writes", func(t *testing.T) {
		lineup, err := repo.GetLineup(ctx, f.teamID, f.gameweekID)
		if err != nil || lineup == nil {
			t.Fatalf("GetLineup: %v", err)
		}
		if err := repo.UpdateLineupPickPoints(ctx, lineup.ID, map[string]float64{f.playerID: 5.25}); err != nil {
			t.Fatalf("UpdateLineupPickPoints: %v", err)
		}

		reloaded, err := repo.GetLineup(ctx, f.teamID, f.gameweekID)
		if err != nil {
			t.Fatalf("GetLineup after pick update: %v", err)
		}
		if len(reloaded.Picks) == 0 || reloaded.Picks[0].Points != 5.25 {
			t.Errorf("expected the pick to carry 5.25 points, got %+v", reloaded.Picks)
		}
	})
}

// TestFantasyLeagueRepositoryQueries covers the league and leaderboard SQL —
// the queries that carried the u.name bug.
func TestFantasyLeagueRepositoryQueries(t *testing.T) {
	f := setupFantasyFixture(t)
	ctx := context.Background()
	repo := ports.NewFantasyLeagueRepository(f.pool)

	t.Run("league reads", func(t *testing.T) {
		league, err := repo.GetLeagueByID(ctx, f.leagueID)
		if err != nil {
			t.Fatalf("GetLeagueByID: %v", err)
		}
		if league == nil || league.MemberCount != 1 {
			t.Errorf("expected one member on the seeded league, got %+v", league)
		}
		if _, err := repo.GetLeagueByInviteCode(ctx, f.inviteCode); err != nil {
			t.Errorf("GetLeagueByInviteCode: %v", err)
		}
		if _, err := repo.GetOverallLeague(ctx, f.seasonID); err != nil {
			t.Errorf("GetOverallLeague: %v", err)
		}
		if _, err := repo.ListLeaguesByUser(ctx, f.userID, f.seasonID); err != nil {
			t.Errorf("ListLeaguesByUser: %v", err)
		}
		if _, err := repo.ListPublicLeagues(ctx, f.seasonID); err != nil {
			t.Errorf("ListPublicLeagues: %v", err)
		}
		if _, err := repo.CountActiveMembers(ctx, f.leagueID); err != nil {
			t.Errorf("CountActiveMembers: %v", err)
		}
	})

	// A nil Go slice marshals to JSON `null`, not `[]`. The fantasy hub read
	// `leaderboardData.data.length` straight off the response, so an empty
	// leaderboard — a brand new season with no managers — crashed the page for
	// every visitor. Empty list endpoints must serialise as [].
	t.Run("an empty leaderboard serialises as [] not null", func(t *testing.T) {
		emptyLeagueID := mustScan(t, f.pool,
			`INSERT INTO fantasy_leagues (season_id, name, type, created_by_user_id, entry_fee)
			 VALUES ($1, 'ITest Empty', 'PUBLIC', $2, 0) RETURNING id`,
			f.seasonID, f.userID)
		t.Cleanup(func() {
			_, _ = f.pool.Exec(ctx, `DELETE FROM fantasy_leagues WHERE id = $1`, emptyLeagueID)
		})

		entries, _, err := repo.GetLeaderboard(ctx, emptyLeagueID, nil, 1, 25)
		if err != nil {
			t.Fatalf("GetLeaderboard: %v", err)
		}
		if entries == nil {
			t.Fatal("an empty leaderboard must be an empty slice, not nil")
		}

		encoded, err := json.Marshal(entries)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		if string(encoded) != "[]" {
			t.Errorf("expected an empty leaderboard to encode as [], got %s", encoded)
		}

		// The season-wide board has the same contract.
		emptySeasonID := mustScan(t, f.pool,
			`INSERT INTO fantasy_seasons (competition_id, name, status) VALUES ($1, 'ITest Empty Season', 'DRAFT') RETURNING id`,
			f.compID)
		t.Cleanup(func() {
			_, _ = f.pool.Exec(ctx, `DELETE FROM fantasy_seasons WHERE id = $1`, emptySeasonID)
		})

		overall, _, err := repo.GetOverallLeaderboard(ctx, emptySeasonID, nil, 1, 25)
		if err != nil {
			t.Fatalf("GetOverallLeaderboard: %v", err)
		}
		encoded, err = json.Marshal(overall)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		if string(encoded) != "[]" {
			t.Errorf("expected an empty overall leaderboard to encode as [], got %s", encoded)
		}
	})

	// Powers the dashboard's "your mini-leagues and where you sit" panel.
	t.Run("my leagues with rank", func(t *testing.T) {
		rows, err := repo.ListMyLeaguesWithRank(ctx, f.userID, f.seasonID)
		if err != nil {
			t.Fatalf("ListMyLeaguesWithRank: %v", err)
		}
		if len(rows) == 0 {
			t.Fatal("expected the seeded league the manager belongs to")
		}
		var found bool
		for _, r := range rows {
			if r.LeagueID == f.leagueID {
				found = true
				if r.MyRank != 1 || r.MemberCount != 1 {
					t.Errorf("expected rank 1 of 1 member, got rank %d of %d", r.MyRank, r.MemberCount)
				}
				if r.EntryFeeKobo != 100000 {
					t.Errorf("expected the entry fee carried through, got %d", r.EntryFeeKobo)
				}
			}
		}
		if !found {
			t.Error("the manager's own league was missing from the list")
		}

		// Someone with no leagues gets an empty list, not null.
		none, err := repo.ListMyLeaguesWithRank(ctx, "00000000-0000-0000-0000-000000000000", f.seasonID)
		if err != nil {
			t.Fatalf("ListMyLeaguesWithRank for a stranger: %v", err)
		}
		encoded, _ := json.Marshal(none)
		if string(encoded) != "[]" {
			t.Errorf("expected [] for a manager with no leagues, got %s", encoded)
		}
	})

	// These joined users to select the manager's display name.
	t.Run("leaderboards join the users table correctly", func(t *testing.T) {
		entries, _, err := repo.GetLeaderboard(ctx, f.leagueID, nil, 1, 25)
		if err != nil {
			t.Fatalf("GetLeaderboard: %v", err)
		}
		if len(entries) == 0 {
			t.Fatal("expected the seeded manager on the league leaderboard")
		}
		if entries[0].UserName != "ITest Manager" {
			t.Errorf("expected the manager's full name, got %q", entries[0].UserName)
		}

		if _, _, err := repo.GetLeaderboard(ctx, f.leagueID, &f.gameweekID, 1, 25); err != nil {
			t.Errorf("GetLeaderboard with a gameweek: %v", err)
		}

		overall, _, err := repo.GetOverallLeaderboard(ctx, f.seasonID, nil, 1, 25)
		if err != nil {
			t.Fatalf("GetOverallLeaderboard: %v", err)
		}
		if len(overall) == 0 || overall[0].UserName != "ITest Manager" {
			t.Errorf("expected the manager's full name on the overall board, got %+v", overall)
		}
		if _, _, err := repo.GetOverallLeaderboard(ctx, f.seasonID, &f.gameweekID, 1, 25); err != nil {
			t.Errorf("GetOverallLeaderboard with a gameweek: %v", err)
		}
	})
}

// TestFantasyPayoutRepositoryQueries covers the money layer, including the
// database-level guarantees that unit tests with fakes cannot reach.
func TestFantasyPayoutRepositoryQueries(t *testing.T) {
	f := setupFantasyFixture(t)
	ctx := context.Background()
	repo := ports.NewFantasyPayoutRepository(f.pool)

	t.Run("wallet and payout reads", func(t *testing.T) {
		w, err := repo.GetWallet(ctx, f.userID)
		if err != nil {
			t.Fatalf("GetWallet: %v", err)
		}
		if w.BalanceKobo != 500000 {
			t.Errorf("expected a 500000 kobo balance, got %d", w.BalanceKobo)
		}
		if _, err := repo.ListWalletTransactions(ctx, f.userID, 50); err != nil {
			t.Errorf("ListWalletTransactions: %v", err)
		}
		if _, err := repo.SumPendingPayouts(ctx, f.userID); err != nil {
			t.Errorf("SumPendingPayouts: %v", err)
		}
		if _, _, err := repo.SumUserLifetime(ctx, f.userID); err != nil {
			t.Errorf("SumUserLifetime: %v", err)
		}
		bank, err := repo.GetLastBankDetails(ctx, f.userID)
		if err != nil {
			t.Fatalf("GetLastBankDetails: %v", err)
		}
		if bank == nil || bank.AccountNumber != "0123456789" {
			t.Errorf("expected the seeded bank details, got %+v", bank)
		}
		if _, _, err := repo.ListPayoutRequests(ctx, "PENDING", 1, 25); err != nil {
			t.Errorf("ListPayoutRequests: %v", err)
		}
		if _, err := repo.ListPayoutRequestsByUser(ctx, f.userID, 25); err != nil {
			t.Errorf("ListPayoutRequestsByUser: %v", err)
		}
	})

	t.Run("admin reporting queries", func(t *testing.T) {
		if _, err := repo.GetSeasonFinance(ctx, f.seasonID); err != nil {
			t.Errorf("GetSeasonFinance: %v", err)
		}
		managers, _, err := repo.ListManagers(ctx, f.seasonID, "ITest", 1, 50)
		if err != nil {
			t.Fatalf("ListManagers: %v", err)
		}
		if len(managers) == 0 || managers[0].UserName != "ITest Manager" {
			t.Errorf("expected the seeded manager by name search, got %+v", managers)
		}
		leagues, _, err := repo.ListAllLeagues(ctx, f.seasonID, "", 1, 50)
		if err != nil {
			t.Fatalf("ListAllLeagues: %v", err)
		}
		if len(leagues) == 0 {
			t.Error("expected the private league to appear in the admin list")
		}
		members, err := repo.ListLeagueMembers(ctx, f.leagueID)
		if err != nil {
			t.Fatalf("ListLeagueMembers: %v", err)
		}
		if len(members) == 0 || members[0].UserEmail == "" {
			t.Errorf("expected the seeded member with an email, got %+v", members)
		}
	})

	t.Run("settlement credits winners once", func(t *testing.T) {
		if _, _, err := repo.CountPaidMembers(ctx, f.leagueID); err != nil {
			t.Errorf("CountPaidMembers: %v", err)
		}
		standings, err := repo.GetLeagueStandings(ctx, f.leagueID)
		if err != nil {
			t.Fatalf("GetLeagueStandings: %v", err)
		}
		if len(standings) == 0 {
			t.Fatal("expected the seeded manager in the standings")
		}

		awards := domain.DistributePrizes(standings, 90000, domain.DefaultPrizeStructure)
		if err := repo.SettleLeague(ctx, f.leagueID, 100000, 10000, 90000, awards, f.userID); err != nil {
			t.Fatalf("SettleLeague: %v", err)
		}

		// The settled_at guard must refuse a second run.
		if err := repo.SettleLeague(ctx, f.leagueID, 100000, 10000, 90000, awards, f.userID); err == nil {
			t.Error("expected the second settlement to be refused")
		}

		w, err := repo.GetWallet(ctx, f.userID)
		if err != nil {
			t.Fatalf("GetWallet after settlement: %v", err)
		}
		// 500000 seeded + 45000 (50% of a 90000 pool, sole entrant takes 1st).
		if w.BalanceKobo != 545000 {
			t.Errorf("expected 545000 kobo after one settlement, got %d", w.BalanceKobo)
		}
	})

	t.Run("prize structure round-trips", func(t *testing.T) {
		// The seeded league is settled by the previous subtest, so use a fresh one.
		leagueID := mustScan(t, f.pool,
			`INSERT INTO fantasy_leagues (season_id, name, type, invite_code, created_by_user_id, entry_fee)
			 VALUES ($1, 'ITest Prizes', 'PRIVATE', $3, $2, 50000) RETURNING id`,
			f.seasonID, f.userID, "PZ"+f.seasonID[:6])

		tiers := []domain.PrizeTier{{Rank: 1, Percent: 60}, {Rank: 2, Percent: 40}}
		if err := repo.SetPrizeStructure(ctx, leagueID, tiers); err != nil {
			t.Fatalf("SetPrizeStructure: %v", err)
		}
		got, err := repo.GetPrizeStructure(ctx, leagueID)
		if err != nil {
			t.Fatalf("GetPrizeStructure: %v", err)
		}
		if len(got) != 2 || got[0].Percent != 60 || got[1].Percent != 40 {
			t.Errorf("prize structure did not round-trip: %+v", got)
		}
		if _, err := repo.ListUnsettledPaidLeagues(ctx, f.seasonID); err != nil {
			t.Errorf("ListUnsettledPaidLeagues: %v", err)
		}
	})

	// The wallet's CHECK constraint is the last line of defence if application
	// logic ever lets a withdrawal slip past the balance.
	t.Run("the database refuses to overdraw a wallet", func(t *testing.T) {
		_, err := f.pool.Exec(ctx,
			`UPDATE fantasy_wallets SET balance_kobo = balance_kobo - 99999999 WHERE user_id = $1`, f.userID)
		if err == nil {
			t.Error("expected the non-negative balance CHECK to reject an overdraft")
		}
	})

	// Belt-and-braces against paying a league's prize money twice.
	t.Run("the database refuses a duplicate winnings row", func(t *testing.T) {
		_, err := f.pool.Exec(ctx, `
			INSERT INTO fantasy_wallet_transactions (user_id, amount_kobo, type, league_id, description)
			VALUES ($1, 1000, 'WINNINGS', $2, 'duplicate attempt')
		`, f.userID, f.leagueID)
		if err == nil {
			t.Error("expected the partial unique index to reject a second WINNINGS row for the same league")
		}
	})
}
