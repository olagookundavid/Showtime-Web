package tests_integration

// Integration coverage for joining a paid fantasy league with the spend wallet:
// the membership and the entry-fee debit commit together, a manager is charged
// at most once however many joins race, and a full league or a short wallet
// leaves neither a membership nor a charge.
//
// Fixtures: a ZZFIX competition (its season, teams, leagues and memberships go
// with it) and wallet fixture users (*@walletfixture.test). Skipped when
// TEST_DB_DSN is unset.

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

func cleanLeagueWalletFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	// Season -> leagues -> members and season -> fantasy teams all cascade.
	mustExec(t, pool, `DELETE FROM competitions WHERE name = 'ZZFIX wallet league comp'`)
}

type leagueWalletFixture struct {
	*walletFixture
	leagues  ports.IFantasyLeagueRepository
	seasonID string
}

func newLeagueWalletFixture(t *testing.T) *leagueWalletFixture {
	wf := newWalletFixture(t)
	cleanLeagueWalletFixtures(t, wf.pool)
	// Registered after the wallet fixture's cleanup, so it runs first.
	t.Cleanup(func() { cleanLeagueWalletFixtures(t, wf.pool) })
	compID := mustScan(t, wf.pool, `INSERT INTO competitions (name) VALUES ('ZZFIX wallet league comp') RETURNING id::text`)
	seasonID := mustScan(t, wf.pool,
		`INSERT INTO fantasy_seasons (competition_id, name, status) VALUES ($1, 'ZZFIX Season', 'DRAFT') RETURNING id::text`, compID)
	return &leagueWalletFixture{walletFixture: wf, leagues: ports.NewFantasyLeagueRepository(wf.pool), seasonID: seasonID}
}

var leagueSeq int64

func (f *leagueWalletFixture) league(t *testing.T, fee, maxMembers int) string {
	t.Helper()
	code := fmt.Sprintf("ZZFIX%d%d", time.Now().UnixNano()%1000000, atomic.AddInt64(&leagueSeq, 1))
	return mustScan(t, f.pool, `
		INSERT INTO fantasy_leagues (season_id, name, type, invite_code, entry_fee, max_members)
		VALUES ($1, 'ZZFIX paid league', 'PRIVATE', $2, $3, $4) RETURNING id::text`,
		f.seasonID, code, fee, maxMembers)
}

// manager makes a user with a fantasy team in the fixture season.
func (f *leagueWalletFixture) manager(t *testing.T, name string) (userID, teamID string) {
	t.Helper()
	userID = f.user(t, name)
	teamID = mustScan(t, f.pool,
		`INSERT INTO fantasy_teams (user_id, season_id, name) VALUES ($1, $2, $3) RETURNING id::text`,
		userID, f.seasonID, fmt.Sprintf("ZZFIX XI %d", atomic.AddInt64(&leagueSeq, 1)))
	return userID, teamID
}

func walletJoin(leagueID, userID, teamID string, fee int64) (*domain.FantasyLeagueMember, domain.LedgerEntry) {
	ref := fmt.Sprintf("FNTW-ZZFIX-%d-%d", time.Now().UnixNano(), atomic.AddInt64(&leagueSeq, 1))
	memberRef := ref
	m := &domain.FantasyLeagueMember{
		LeagueID: leagueID, UserID: userID, TeamID: teamID,
		PaymentStatus: domain.LeaguePaymentPaid, PaystackReference: &memberRef,
	}
	return m, domain.LedgerEntry{
		UserID: userID, AmountKobo: -fee, Type: domain.LedgerPurchase, Reference: &ref, Description: "ZZFIX league entry",
	}
}

func (f *leagueWalletFixture) memberRows(t *testing.T, leagueID, userID string) string {
	t.Helper()
	return mustScan(t, f.pool, `SELECT COUNT(*)::text FROM fantasy_league_members WHERE league_id = $1 AND user_id = $2`, leagueID, userID)
}

func (f *leagueWalletFixture) purchases(t *testing.T, userID string) string {
	t.Helper()
	return mustScan(t, f.pool, `SELECT COUNT(*)::text FROM wallet_transactions WHERE user_id = $1 AND type = 'PURCHASE'`, userID)
}

func TestWalletLeague_JoinCreatesAPaidMemberAndOneDebit(t *testing.T) {
	f := newLeagueWalletFixture(t)
	ctx := context.Background()
	league := f.league(t, 200_000, 0)
	u, team := f.manager(t, "ZZFIXmgr")
	f.credit(t, u, 500_000)

	m, debit := walletJoin(league, u, team, 200_000)
	if err := f.leagues.AddMemberPaidFromWallet(ctx, m, debit); err != nil {
		t.Fatalf("join: %v", err)
	}
	if m.ID == "" {
		t.Fatal("membership id not returned")
	}
	got, err := f.leagues.GetMember(ctx, league, u)
	if err != nil || got == nil || got.PaymentStatus != domain.LeaguePaymentPaid {
		t.Fatalf("member: %+v %v", got, err)
	}
	if b := f.balance(t, u); b != 300_000 {
		t.Fatalf("balance = %d, want 300000", b)
	}
	if n := f.purchases(t, u); n != "1" {
		t.Fatalf("%s PURCHASE rows, want 1", n)
	}

	// Joining again is turned away before paying.
	m2, debit2 := walletJoin(league, u, team, 200_000)
	if err := f.leagues.AddMemberPaidFromWallet(ctx, m2, debit2); !errors.Is(err, ports.ErrAlreadyLeagueMember) {
		t.Fatalf("second join: err = %v, want ErrAlreadyLeagueMember", err)
	}
	if b := f.balance(t, u); b != 300_000 {
		t.Fatalf("a repeat join moved the balance to %d", b)
	}
}

func TestWalletLeague_ConcurrentJoinsChargeOnce(t *testing.T) {
	f := newLeagueWalletFixture(t)
	ctx := context.Background()
	league := f.league(t, 100_000, 0)
	u, team := f.manager(t, "ZZFIXmgrrace")
	f.credit(t, u, 1_000_000)

	var joined, already int32
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		m, debit := walletJoin(league, u, team, 100_000) // a different reference each time
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := f.leagues.AddMemberPaidFromWallet(ctx, m, debit)
			switch {
			case err == nil:
				atomic.AddInt32(&joined, 1)
			case errors.Is(err, ports.ErrAlreadyLeagueMember):
				atomic.AddInt32(&already, 1)
			default:
				t.Errorf("join: %v", err)
			}
		}()
	}
	wg.Wait()

	if joined != 1 || already != 9 {
		t.Fatalf("joined=%d already=%d, want 1 and 9", joined, already)
	}
	if n := f.memberRows(t, league, u); n != "1" {
		t.Fatalf("%s membership rows, want 1", n)
	}
	if n := f.purchases(t, u); n != "1" {
		t.Fatalf("%s debits, want 1", n)
	}
	if b := f.balance(t, u); b != 900_000 {
		t.Fatalf("balance = %d, want 900000 (charged once)", b)
	}
}

func TestWalletLeague_FullLeagueRefusesWithoutCharging(t *testing.T) {
	f := newLeagueWalletFixture(t)
	ctx := context.Background()
	league := f.league(t, 50_000, 1)

	first, firstTeam := f.manager(t, "ZZFIXmgrfirst")
	f.credit(t, first, 50_000)
	m, debit := walletJoin(league, first, firstTeam, 50_000)
	if err := f.leagues.AddMemberPaidFromWallet(ctx, m, debit); err != nil {
		t.Fatalf("first join: %v", err)
	}

	late, lateTeam := f.manager(t, "ZZFIXmgrlate")
	f.credit(t, late, 500_000)
	m2, debit2 := walletJoin(league, late, lateTeam, 50_000)
	if err := f.leagues.AddMemberPaidFromWallet(ctx, m2, debit2); !errors.Is(err, ports.ErrLeagueFull) {
		t.Fatalf("err = %v, want ErrLeagueFull", err)
	}
	if b := f.balance(t, late); b != 500_000 {
		t.Fatalf("a full league charged %d", 500_000-b)
	}
	if n := f.purchases(t, late); n != "0" {
		t.Fatalf("%s debits for a refused join", n)
	}
	if n := f.memberRows(t, league, late); n != "0" {
		t.Fatalf("%s membership rows for a refused join", n)
	}
}

func TestWalletLeague_ConcurrentJoinsForTheLastSlotsChargeOnlyMembers(t *testing.T) {
	f := newLeagueWalletFixture(t)
	ctx := context.Background()
	const slots = 3
	const managers = 9
	league := f.league(t, 40_000, slots)

	// Everyone is set up before the race starts.
	users := make([]string, managers)
	members := make([]*domain.FantasyLeagueMember, managers)
	debits := make([]domain.LedgerEntry, managers)
	for i := 0; i < managers; i++ {
		u, team := f.manager(t, "ZZFIXmgrslot")
		users[i] = u
		f.credit(t, u, 40_000)
		members[i], debits[i] = walletJoin(league, u, team, 40_000)
	}

	var wg sync.WaitGroup
	var joined, full int32
	for i := 0; i < managers; i++ {
		m, debit := members[i], debits[i]
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := f.leagues.AddMemberPaidFromWallet(ctx, m, debit)
			switch {
			case err == nil:
				atomic.AddInt32(&joined, 1)
			case errors.Is(err, ports.ErrLeagueFull):
				atomic.AddInt32(&full, 1)
			default:
				t.Errorf("join: %v", err)
			}
		}()
	}
	wg.Wait()

	if joined != slots || full != managers-slots {
		t.Fatalf("joined=%d full=%d, want %d and %d", joined, full, slots, managers-slots)
	}
	if n := mustScan(t, f.pool, `SELECT COUNT(*)::text FROM wallet_transactions WHERE type = 'PURCHASE' AND user_id = ANY($1::uuid[])`, users); n != "3" {
		t.Fatalf("%s debits, want 3", n)
	}
	if n := mustScan(t, f.pool, `
		SELECT COUNT(*)::text FROM fantasy_league_members m
		JOIN wallet_transactions w ON w.user_id = m.user_id AND w.type = 'PURCHASE'
		WHERE m.league_id = $1`, league); n != "3" {
		t.Fatalf("%s members with a matching debit, want 3", n)
	}
}

func TestWalletLeague_InsufficientLeavesNoMember(t *testing.T) {
	f := newLeagueWalletFixture(t)
	ctx := context.Background()
	league := f.league(t, 300_000, 0)
	u, team := f.manager(t, "ZZFIXmgrpoor")
	f.credit(t, u, 100_000)

	m, debit := walletJoin(league, u, team, 300_000)
	if err := f.leagues.AddMemberPaidFromWallet(ctx, m, debit); !errors.Is(err, ports.ErrWalletInsufficient) {
		t.Fatalf("err = %v, want ErrWalletInsufficient", err)
	}
	if n := f.memberRows(t, league, u); n != "0" {
		t.Fatalf("%s membership rows after a short wallet", n)
	}
	if n := f.purchases(t, u); n != "0" {
		t.Fatalf("%s debits after a short wallet", n)
	}
	if b := f.balance(t, u); b != 100_000 {
		t.Fatalf("balance = %d, want 100000", b)
	}
}

func TestWalletLeague_PendingCardMemberCanStillPayFromWallet(t *testing.T) {
	// A manager with an unfinished card attempt (PENDING) is not "already in": the
	// wallet join upgrades that same row to PAID and charges once.
	f := newLeagueWalletFixture(t)
	ctx := context.Background()
	league := f.league(t, 100_000, 0)
	u, team := f.manager(t, "ZZFIXmgrpending")
	f.credit(t, u, 100_000)
	cardRef := fmt.Sprintf("ZZFIX-CARD-%d", time.Now().UnixNano())
	if err := f.leagues.AddMember(ctx, &domain.FantasyLeagueMember{
		LeagueID: league, UserID: u, TeamID: team, PaymentStatus: domain.LeaguePaymentPending, PaystackReference: &cardRef,
	}); err != nil {
		t.Fatal(err)
	}

	m, debit := walletJoin(league, u, team, 100_000)
	m.PaystackReference = &cardRef // the service keeps the earlier card reference
	if err := f.leagues.AddMemberPaidFromWallet(ctx, m, debit); err != nil {
		t.Fatalf("join: %v", err)
	}
	got, _ := f.leagues.GetMember(ctx, league, u)
	if got == nil || got.PaymentStatus != domain.LeaguePaymentPaid {
		t.Fatalf("member: %+v", got)
	}
	if n := f.memberRows(t, league, u); n != "1" {
		t.Fatalf("%s membership rows, want 1", n)
	}
	if b := f.balance(t, u); b != 0 {
		t.Fatalf("balance = %d, want 0", b)
	}
}
