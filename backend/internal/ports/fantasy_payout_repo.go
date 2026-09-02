package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrInsufficientBalance is returned when a withdrawal exceeds the wallet.
var ErrInsufficientBalance = errors.New("your wallet balance is not enough for this payout")

// ErrAlreadySettled is returned when a league's prizes have already been paid.
var ErrAlreadySettled = errors.New("this league has already been settled")

type IFantasyPayoutRepository interface {
	// Wallet
	GetWallet(ctx context.Context, userID string) (*domain.FantasyWallet, error)
	ListWalletTransactions(ctx context.Context, userID string, limit int) ([]domain.WalletTransaction, error)
	// CreditWallet books a credit and its ledger row atomically. Used for
	// prize money and for manual admin adjustments.
	CreditWallet(ctx context.Context, tx domain.WalletTransaction) error

	// Payout requests
	// CreatePayoutRequest debits the wallet and records the request in one
	// transaction, so the money is committed the moment it is requested and
	// cannot be requested twice.
	CreatePayoutRequest(ctx context.Context, req *domain.PayoutRequest) error
	GetPayoutRequestByID(ctx context.Context, id string) (*domain.PayoutRequest, error)
	ListPayoutRequestsByUser(ctx context.Context, userID string, limit int) ([]domain.PayoutRequest, error)
	ListPayoutRequests(ctx context.Context, status string, page, limit int) ([]domain.PayoutRequest, int, error)
	GetLastBankDetails(ctx context.Context, userID string) (*dto.BankDetails, error)
	// UpdatePayoutStatus transitions a request and, when the new status
	// returns funds, credits them back in the same transaction.
	UpdatePayoutStatus(ctx context.Context, id string, to domain.PayoutStatus, adminNotes, reference string, actorUserID string) (*domain.PayoutRequest, error)
	SumPendingPayouts(ctx context.Context, userID string) (int64, error)
	SumUserLifetime(ctx context.Context, userID string) (won, paid int64, err error)

	// Prize structure
	GetPrizeStructure(ctx context.Context, leagueID string) ([]domain.PrizeTier, error)
	SetPrizeStructure(ctx context.Context, leagueID string, tiers []domain.PrizeTier) error

	// Settlement
	GetLeagueStandings(ctx context.Context, leagueID string) ([]domain.PrizeStanding, error)
	CountPaidMembers(ctx context.Context, leagueID string) (paid, pending int, err error)
	// SettleLeague credits every award and stamps the league as settled in a
	// single transaction, refusing to run twice.
	SettleLeague(ctx context.Context, leagueID string, grossKobo, cutKobo, poolKobo int64, awards []domain.PrizeAward, actorUserID string) error
	ListUnsettledPaidLeagues(ctx context.Context, seasonID string) ([]domain.FantasyLeague, error)

	// Admin reporting
	GetSeasonFinance(ctx context.Context, seasonID string) (*dto.AdminFantasyOverview, error)
	ListManagers(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminManagerRow, int, error)
	ListLeagueMembers(ctx context.Context, leagueID string) ([]dto.AdminLeagueMemberRow, error)
	// ListAllLeagues includes PRIVATE leagues, which the public browse
	// endpoint deliberately hides.
	ListAllLeagues(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminLeagueRow, int, error)
}

type FantasyPayoutRepository struct {
	pool *pgxpool.Pool
}

func NewFantasyPayoutRepository(pool *pgxpool.Pool) IFantasyPayoutRepository {
	return &FantasyPayoutRepository{pool: pool}
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

// lockWallet fetches a user's wallet row FOR UPDATE, creating it on first use.
// Every balance change goes through this so concurrent credits and withdrawals
// are serialised per user.
func lockWallet(ctx context.Context, tx pgx.Tx, userID string) (int64, error) {
	if _, err := tx.Exec(ctx,
		`INSERT INTO fantasy_wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
		userID,
	); err != nil {
		return 0, fmt.Errorf("failed to open wallet: %w", err)
	}

	var balance int64
	if err := tx.QueryRow(ctx,
		`SELECT balance_kobo FROM fantasy_wallets WHERE user_id = $1 FOR UPDATE`,
		userID,
	).Scan(&balance); err != nil {
		return 0, fmt.Errorf("failed to lock wallet: %w", err)
	}
	return balance, nil
}

func (r *FantasyPayoutRepository) GetWallet(ctx context.Context, userID string) (*domain.FantasyWallet, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var w domain.FantasyWallet
	err := r.pool.QueryRow(ctx,
		`SELECT user_id, balance_kobo, created_at, updated_at FROM fantasy_wallets WHERE user_id = $1`,
		userID,
	).Scan(&w.UserID, &w.BalanceKobo, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// A user who has never won anything has an implicit empty wallet.
			return &domain.FantasyWallet{UserID: userID}, nil
		}
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	return &w, nil
}

func (r *FantasyPayoutRepository) ListWalletTransactions(ctx context.Context, userID string, limit int) ([]domain.WalletTransaction, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.user_id, t.amount_kobo, t.type, t.league_id, COALESCE(l.name, ''),
		       t.payout_request_id, t.description, t.created_at
		FROM fantasy_wallet_transactions t
		LEFT JOIN fantasy_leagues l ON t.league_id = l.id
		WHERE t.user_id = $1
		ORDER BY t.created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list wallet transactions: %w", err)
	}
	defer rows.Close()

	list := make([]domain.WalletTransaction, 0)
	for rows.Next() {
		var t domain.WalletTransaction
		if err := rows.Scan(&t.ID, &t.UserID, &t.AmountKobo, &t.Type, &t.LeagueID,
			&t.LeagueName, &t.PayoutRequestID, &t.Description, &t.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (r *FantasyPayoutRepository) CreditWallet(ctx context.Context, wt domain.WalletTransaction) error {
	if wt.AmountKobo <= 0 {
		return errors.New("a credit must be a positive amount")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := lockWallet(ctx, tx, wt.UserID); err != nil {
		return err
	}
	if err := applyWalletDelta(ctx, tx, wt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// applyWalletDelta writes one ledger row and moves the balance by the same
// amount. The two are always written together, so the ledger can always
// reconstruct the balance.
func applyWalletDelta(ctx context.Context, tx pgx.Tx, wt domain.WalletTransaction) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO fantasy_wallet_transactions
			(user_id, amount_kobo, type, league_id, payout_request_id, description, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, wt.UserID, wt.AmountKobo, wt.Type, wt.LeagueID, wt.PayoutRequestID, wt.Description, wt.CreatedByUserID); err != nil {
		return fmt.Errorf("failed to record wallet transaction: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE fantasy_wallets SET balance_kobo = balance_kobo + $1, updated_at = NOW() WHERE user_id = $2
	`, wt.AmountKobo, wt.UserID); err != nil {
		// The non-negative CHECK constraint is the last line of defence
		// against a withdrawal racing past the balance.
		return fmt.Errorf("failed to update wallet balance: %w", err)
	}
	return nil
}

// ─── Payout requests ──────────────────────────────────────────────────────────

func (r *FantasyPayoutRepository) CreatePayoutRequest(ctx context.Context, req *domain.PayoutRequest) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	balance, err := lockWallet(ctx, tx, req.UserID)
	if err != nil {
		return err
	}
	if balance < req.AmountKobo {
		return ErrInsufficientBalance
	}

	if err := tx.QueryRow(ctx, `
		INSERT INTO fantasy_payout_requests
			(user_id, amount_kobo, status, bank_name, account_number, account_name, user_notes)
		VALUES ($1, $2, 'PENDING', $3, $4, $5, $6)
		RETURNING id, status, created_at, updated_at
	`, req.UserID, req.AmountKobo, req.BankName, req.AccountNumber, req.AccountName, req.UserNotes,
	).Scan(&req.ID, &req.Status, &req.CreatedAt, &req.UpdatedAt); err != nil {
		return fmt.Errorf("failed to create payout request: %w", err)
	}

	// Debit immediately. The money is committed the moment it is requested, so
	// a second request cannot be raised against the same funds.
	if err := applyWalletDelta(ctx, tx, domain.WalletTransaction{
		UserID:          req.UserID,
		AmountKobo:      -req.AmountKobo,
		Type:            domain.WalletPayout,
		PayoutRequestID: &req.ID,
		Description:     "Payout requested",
		CreatedByUserID: &req.UserID,
	}); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

const payoutSelect = `
	SELECT p.id, p.user_id, p.amount_kobo, p.status, p.bank_name, p.account_number,
	       p.account_name, p.user_notes, p.admin_notes, p.payment_reference,
	       p.processed_by_user_id, p.processed_at, p.created_at, p.updated_at,
	       COALESCE(u.full_name, ''), COALESCE(u.email, '')
	FROM fantasy_payout_requests p
	LEFT JOIN users u ON p.user_id = u.id
`

func scanPayout(row pgx.Row) (*domain.PayoutRequest, error) {
	var p domain.PayoutRequest
	err := row.Scan(&p.ID, &p.UserID, &p.AmountKobo, &p.Status, &p.BankName, &p.AccountNumber,
		&p.AccountName, &p.UserNotes, &p.AdminNotes, &p.PaymentReference,
		&p.ProcessedByUserID, &p.ProcessedAt, &p.CreatedAt, &p.UpdatedAt,
		&p.UserName, &p.UserEmail)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *FantasyPayoutRepository) GetPayoutRequestByID(ctx context.Context, id string) (*domain.PayoutRequest, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	p, err := scanPayout(r.pool.QueryRow(ctx, payoutSelect+` WHERE p.id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get payout request: %w", err)
	}
	return p, nil
}

func (r *FantasyPayoutRepository) ListPayoutRequestsByUser(ctx context.Context, userID string, limit int) ([]domain.PayoutRequest, error) {
	if limit < 1 || limit > 100 {
		limit = 25
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, payoutSelect+` WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list payout requests: %w", err)
	}
	defer rows.Close()

	list := make([]domain.PayoutRequest, 0)
	for rows.Next() {
		p, err := scanPayout(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *p)
	}
	return list, rows.Err()
}

func (r *FantasyPayoutRepository) ListPayoutRequests(ctx context.Context, status string, page, limit int) ([]domain.PayoutRequest, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	where := ""
	args := []interface{}{}
	if status != "" {
		where = " WHERE p.status = $1"
		args = append(args, status)
	}

	var total int
	countQuery := `SELECT COUNT(p.id) FROM fantasy_payout_requests p` + where
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count payout requests: %w", err)
	}

	// Oldest first: the payout queue is worked front to back.
	query := payoutSelect + where + fmt.Sprintf(" ORDER BY p.created_at ASC LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list payout requests: %w", err)
	}
	defer rows.Close()

	list := make([]domain.PayoutRequest, 0)
	for rows.Next() {
		p, err := scanPayout(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, *p)
	}
	return list, total, rows.Err()
}

func (r *FantasyPayoutRepository) GetLastBankDetails(ctx context.Context, userID string) (*dto.BankDetails, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var b dto.BankDetails
	err := r.pool.QueryRow(ctx, `
		SELECT bank_name, account_number, account_name
		FROM fantasy_payout_requests
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(&b.BankName, &b.AccountNumber, &b.AccountName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get last bank details: %w", err)
	}
	return &b, nil
}

func (r *FantasyPayoutRepository) UpdatePayoutStatus(ctx context.Context, id string, to domain.PayoutStatus, adminNotes, reference, actorUserID string) (*domain.PayoutRequest, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Lock the request so two admins can't settle the same payout twice.
	var userID string
	var amount int64
	var current domain.PayoutStatus
	if err := tx.QueryRow(ctx,
		`SELECT user_id, amount_kobo, status FROM fantasy_payout_requests WHERE id = $1 FOR UPDATE`, id,
	).Scan(&userID, &amount, &current); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("payout request not found")
		}
		return nil, err
	}

	if err := domain.ValidatePayoutStatusTransition(current, to); err != nil {
		return nil, err
	}

	processedAt := "NULL"
	if to.IsTerminal() {
		processedAt = "NOW()"
	}
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		UPDATE fantasy_payout_requests
		SET status = $1,
		    admin_notes = COALESCE(NULLIF($2, ''), admin_notes),
		    payment_reference = COALESCE(NULLIF($3, ''), payment_reference),
		    processed_by_user_id = $4,
		    processed_at = %s,
		    updated_at = NOW()
		WHERE id = $5
	`, processedAt), to, adminNotes, reference, actorUserID, id); err != nil {
		return nil, fmt.Errorf("failed to update payout status: %w", err)
	}

	// Rejecting or cancelling gives the held money back. The credit is a new
	// compensating ledger row, never an edit of the original debit.
	if to.ReturnsFunds() {
		if _, err := lockWallet(ctx, tx, userID); err != nil {
			return nil, err
		}
		reason := "Payout " + string(to) + " — funds returned"
		if err := applyWalletDelta(ctx, tx, domain.WalletTransaction{
			UserID:          userID,
			AmountKobo:      amount,
			Type:            domain.WalletPayoutReversal,
			PayoutRequestID: &id,
			Description:     reason,
			CreatedByUserID: &actorUserID,
		}); err != nil {
			return nil, err
		}
	}

	updated, err := scanPayout(tx.QueryRow(ctx, payoutSelect+` WHERE p.id = $1`, id))
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return updated, nil
}

func (r *FantasyPayoutRepository) SumPendingPayouts(ctx context.Context, userID string) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var total int64
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_kobo), 0) FROM fantasy_payout_requests
		WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING')
	`, userID).Scan(&total)
	return total, err
}

func (r *FantasyPayoutRepository) SumUserLifetime(ctx context.Context, userID string) (int64, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var won, paid int64
	err := r.pool.QueryRow(ctx, `
		SELECT
			COALESCE((SELECT SUM(amount_kobo) FROM fantasy_wallet_transactions
			          WHERE user_id = $1 AND type = 'WINNINGS'), 0),
			COALESCE((SELECT SUM(amount_kobo) FROM fantasy_payout_requests
			          WHERE user_id = $1 AND status = 'PAID'), 0)
	`, userID).Scan(&won, &paid)
	return won, paid, err
}

// ─── Prize structure ──────────────────────────────────────────────────────────

func (r *FantasyPayoutRepository) GetPrizeStructure(ctx context.Context, leagueID string) ([]domain.PrizeTier, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx,
		`SELECT id, league_id, rank, percent FROM fantasy_league_prizes WHERE league_id = $1 ORDER BY rank ASC`, leagueID)
	if err != nil {
		return nil, fmt.Errorf("failed to get prize structure: %w", err)
	}
	defer rows.Close()

	tiers := make([]domain.PrizeTier, 0)
	for rows.Next() {
		var t domain.PrizeTier
		if err := rows.Scan(&t.ID, &t.LeagueID, &t.Rank, &t.Percent); err != nil {
			return nil, err
		}
		tiers = append(tiers, t)
	}
	return tiers, rows.Err()
}

func (r *FantasyPayoutRepository) SetPrizeStructure(ctx context.Context, leagueID string, tiers []domain.PrizeTier) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Changing the split after prizes have been paid would misrepresent what
	// actually happened.
	var settled *time.Time
	if err := tx.QueryRow(ctx, `SELECT settled_at FROM fantasy_leagues WHERE id = $1 FOR UPDATE`, leagueID).Scan(&settled); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("league not found")
		}
		return err
	}
	if settled != nil {
		return ErrAlreadySettled
	}

	if _, err := tx.Exec(ctx, `DELETE FROM fantasy_league_prizes WHERE league_id = $1`, leagueID); err != nil {
		return err
	}
	for _, t := range tiers {
		if _, err := tx.Exec(ctx,
			`INSERT INTO fantasy_league_prizes (league_id, rank, percent) VALUES ($1, $2, $3)`,
			leagueID, t.Rank, t.Percent); err != nil {
			return fmt.Errorf("failed to save prize position %d: %w", t.Rank, err)
		}
	}
	return tx.Commit(ctx)
}

// ─── Settlement ───────────────────────────────────────────────────────────────

func (r *FantasyPayoutRepository) GetLeagueStandings(ctx context.Context, leagueID string) ([]domain.PrizeStanding, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Only paid-up members are eligible for prize money.
	rows, err := r.pool.Query(ctx, `
		SELECT m.user_id, m.team_id, COALESCE(t.name, ''), COALESCE(u.full_name, ''), COALESCE(t.total_points, 0)
		FROM fantasy_league_members m
		JOIN fantasy_teams t ON m.team_id = t.id
		LEFT JOIN users u ON m.user_id = u.id
		WHERE m.league_id = $1 AND m.payment_status IN ('FREE', 'PAID')
		ORDER BY t.total_points DESC
	`, leagueID)
	if err != nil {
		return nil, fmt.Errorf("failed to get league standings: %w", err)
	}
	defer rows.Close()

	list := make([]domain.PrizeStanding, 0)
	for rows.Next() {
		var s domain.PrizeStanding
		if err := rows.Scan(&s.UserID, &s.TeamID, &s.TeamName, &s.UserName, &s.Points); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (r *FantasyPayoutRepository) CountPaidMembers(ctx context.Context, leagueID string) (int, int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var paid, pending int
	err := r.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE payment_status = 'PAID'),
			COUNT(*) FILTER (WHERE payment_status = 'PENDING')
		FROM fantasy_league_members WHERE league_id = $1
	`, leagueID).Scan(&paid, &pending)
	return paid, pending, err
}

func (r *FantasyPayoutRepository) SettleLeague(ctx context.Context, leagueID string, grossKobo, cutKobo, poolKobo int64, awards []domain.PrizeAward, actorUserID string) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// The settled_at guard, checked under a row lock, is what makes settlement
	// run exactly once even if the endpoint is called twice concurrently.
	var settled *time.Time
	var leagueName string
	if err := tx.QueryRow(ctx,
		`SELECT settled_at, name FROM fantasy_leagues WHERE id = $1 FOR UPDATE`, leagueID,
	).Scan(&settled, &leagueName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("league not found")
		}
		return err
	}
	if settled != nil {
		return ErrAlreadySettled
	}

	for _, a := range awards {
		if a.AmountKobo <= 0 {
			continue
		}
		if _, err := lockWallet(ctx, tx, a.UserID); err != nil {
			return err
		}
		lid := leagueID
		actor := actorUserID
		if err := applyWalletDelta(ctx, tx, domain.WalletTransaction{
			UserID:          a.UserID,
			AmountKobo:      a.AmountKobo,
			Type:            domain.WalletWinnings,
			LeagueID:        &lid,
			Description:     fmt.Sprintf("%s in %s", a.Description, leagueName),
			CreatedByUserID: &actor,
		}); err != nil {
			return fmt.Errorf("failed to credit %s: %w", a.UserName, err)
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE fantasy_leagues
		SET gross_entry_kobo = $1, platform_cut_kobo = $2, prize_pool_kobo = $3,
		    settled_at = NOW(), updated_at = NOW()
		WHERE id = $4
	`, grossKobo, cutKobo, poolKobo, leagueID); err != nil {
		return fmt.Errorf("failed to mark league settled: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *FantasyPayoutRepository) ListUnsettledPaidLeagues(ctx context.Context, seasonID string) ([]domain.FantasyLeague, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT id, season_id, name, type, COALESCE(invite_code, ''), created_by_user_id,
		       entry_fee, max_members, created_at, updated_at
		FROM fantasy_leagues
		WHERE season_id = $1 AND entry_fee > 0 AND settled_at IS NULL
		ORDER BY created_at ASC
	`, seasonID)
	if err != nil {
		return nil, fmt.Errorf("failed to list unsettled leagues: %w", err)
	}
	defer rows.Close()

	list := make([]domain.FantasyLeague, 0)
	for rows.Next() {
		var l domain.FantasyLeague
		if err := rows.Scan(&l.ID, &l.SeasonID, &l.Name, &l.Type, &l.InviteCode,
			&l.CreatedByUserID, &l.EntryFee, &l.MaxMembers, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	return list, rows.Err()
}

// ─── Admin reporting ──────────────────────────────────────────────────────────

func (r *FantasyPayoutRepository) GetSeasonFinance(ctx context.Context, seasonID string) (*dto.AdminFantasyOverview, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var o dto.AdminFantasyOverview
	o.SeasonID = seasonID

	err := r.pool.QueryRow(ctx, `
		SELECT
			COALESCE((SELECT COUNT(*) FROM fantasy_teams WHERE season_id = $1), 0),
			COALESCE((SELECT COUNT(*) FROM fantasy_lineups fl
			          JOIN fantasy_gameweeks g ON fl.gameweek_id = g.id
			          WHERE g.season_id = $1), 0),
			COALESCE((SELECT COUNT(*) FROM fantasy_leagues WHERE season_id = $1), 0),
			COALESCE((SELECT COUNT(*) FROM fantasy_leagues WHERE season_id = $1 AND entry_fee > 0), 0),
			COALESCE((SELECT COUNT(*) FROM fantasy_leagues
			          WHERE season_id = $1 AND entry_fee > 0 AND settled_at IS NULL), 0),
			-- Gross is what paid-up members actually contributed.
			COALESCE((SELECT SUM(l.entry_fee) FROM fantasy_league_members m
			          JOIN fantasy_leagues l ON m.league_id = l.id
			          WHERE l.season_id = $1 AND l.entry_fee > 0 AND m.payment_status = 'PAID'), 0),
			COALESCE((SELECT SUM(balance_kobo) FROM fantasy_wallets w
			          WHERE EXISTS (SELECT 1 FROM fantasy_teams t
			                        WHERE t.user_id = w.user_id AND t.season_id = $1)), 0),
			COALESCE((SELECT SUM(amount_kobo) FROM fantasy_payout_requests
			          WHERE status IN ('PENDING', 'PROCESSING')), 0),
			COALESCE((SELECT COUNT(*) FROM fantasy_payout_requests
			          WHERE status IN ('PENDING', 'PROCESSING')), 0),
			COALESCE((SELECT SUM(amount_kobo) FROM fantasy_payout_requests WHERE status = 'PAID'), 0)
	`, seasonID).Scan(
		&o.TotalManagers, &o.TotalLineups, &o.TotalLeagues, &o.PaidLeagues, &o.UnsettledLeagues,
		&o.GrossEntryKobo, &o.WalletLiabilityKobo, &o.PendingPayoutKobo, &o.PendingPayoutCount, &o.PaidOutKobo,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load season finance: %w", err)
	}

	if err := r.pool.QueryRow(ctx,
		`SELECT name, status FROM fantasy_seasons WHERE id = $1`, seasonID,
	).Scan(&o.SeasonName, &o.Status); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	return &o, nil
}

func (r *FantasyPayoutRepository) ListManagers(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminManagerRow, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	where := " WHERE t.season_id = $1"
	args := []interface{}{seasonID}
	if search != "" {
		where += " AND (u.full_name ILIKE $2 OR u.email ILIKE $2 OR t.name ILIKE $2)"
		args = append(args, "%"+search+"%")
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(t.id) FROM fantasy_teams t LEFT JOIN users u ON t.user_id = u.id`+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count managers: %w", err)
	}

	query := `
		SELECT t.user_id, COALESCE(u.full_name, ''), COALESCE(u.email, ''), t.id, t.name,
		       t.total_points,
		       (SELECT COUNT(*) FROM fantasy_lineups fl WHERE fl.team_id = t.id),
		       (SELECT COUNT(*) FROM fantasy_league_members m WHERE m.team_id = t.id),
		       COALESCE((SELECT w.balance_kobo FROM fantasy_wallets w WHERE w.user_id = t.user_id), 0),
		       t.created_at
		FROM fantasy_teams t
		LEFT JOIN users u ON t.user_id = u.id` + where +
		fmt.Sprintf(" ORDER BY t.total_points DESC, t.created_at ASC LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list managers: %w", err)
	}
	defer rows.Close()

	list := make([]dto.AdminManagerRow, 0, limit)
	rank := offset + 1
	for rows.Next() {
		var m dto.AdminManagerRow
		var createdAt time.Time
		if err := rows.Scan(&m.UserID, &m.UserName, &m.UserEmail, &m.TeamID, &m.TeamName,
			&m.TotalPoints, &m.LineupCount, &m.LeagueCount, &m.WalletKobo, &createdAt); err != nil {
			return nil, 0, err
		}
		m.Rank = rank
		m.CreatedAt = createdAt.Format(time.RFC3339)
		rank++
		list = append(list, m)
	}
	return list, total, rows.Err()
}

func (r *FantasyPayoutRepository) ListAllLeagues(ctx context.Context, seasonID, search string, page, limit int) ([]dto.AdminLeagueRow, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	where := " WHERE l.season_id = $1"
	args := []interface{}{seasonID}
	if search != "" {
		where += " AND (l.name ILIKE $2 OR l.invite_code ILIKE $2)"
		args = append(args, "%"+search+"%")
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(l.id) FROM fantasy_leagues l`+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count leagues: %w", err)
	}

	query := `
		SELECT l.id, l.name, l.type, COALESCE(l.invite_code, ''), COALESCE(u.full_name, ''),
		       l.entry_fee, l.max_members,
		       (SELECT COUNT(*) FROM fantasy_league_members m
		        WHERE m.league_id = l.id AND m.payment_status IN ('FREE','PAID')),
		       (SELECT COUNT(*) FROM fantasy_league_members m
		        WHERE m.league_id = l.id AND m.payment_status = 'PAID'),
		       (SELECT COUNT(*) FROM fantasy_league_members m
		        WHERE m.league_id = l.id AND m.payment_status = 'PENDING'),
		       l.gross_entry_kobo, l.platform_cut_kobo, l.prize_pool_kobo, l.settled_at, l.created_at
		FROM fantasy_leagues l
		LEFT JOIN users u ON l.created_by_user_id = u.id` + where +
		fmt.Sprintf(" ORDER BY l.entry_fee DESC, l.created_at DESC LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list leagues: %w", err)
	}
	defer rows.Close()

	list := make([]dto.AdminLeagueRow, 0, limit)
	for rows.Next() {
		var l dto.AdminLeagueRow
		var settledAt *time.Time
		var createdAt time.Time
		if err := rows.Scan(&l.LeagueID, &l.Name, &l.Type, &l.InviteCode, &l.OwnerName,
			&l.EntryFeeKobo, &l.MaxMembers, &l.MemberCount, &l.PaidMembers, &l.PendingMembers,
			&l.GrossEntryKobo, &l.PlatformCutKobo, &l.PrizePoolKobo, &settledAt, &createdAt); err != nil {
			return nil, 0, err
		}
		l.Settled = settledAt != nil
		if settledAt != nil {
			l.SettledAt = settledAt.Format(time.RFC3339)
		}
		l.CreatedAt = createdAt.Format(time.RFC3339)
		list = append(list, l)
	}
	return list, total, rows.Err()
}

func (r *FantasyPayoutRepository) ListLeagueMembers(ctx context.Context, leagueID string) ([]dto.AdminLeagueMemberRow, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT m.user_id, COALESCE(u.full_name, ''), COALESCE(u.email, ''), m.team_id,
		       COALESCE(t.name, ''), COALESCE(t.total_points, 0), m.payment_status,
		       COALESCE(m.paystack_reference, ''), m.joined_at
		FROM fantasy_league_members m
		LEFT JOIN users u ON m.user_id = u.id
		LEFT JOIN fantasy_teams t ON m.team_id = t.id
		WHERE m.league_id = $1
		ORDER BY t.total_points DESC NULLS LAST, m.joined_at ASC
	`, leagueID)
	if err != nil {
		return nil, fmt.Errorf("failed to list league members: %w", err)
	}
	defer rows.Close()

	list := make([]dto.AdminLeagueMemberRow, 0)
	for rows.Next() {
		var m dto.AdminLeagueMemberRow
		var joined time.Time
		if err := rows.Scan(&m.UserID, &m.UserName, &m.UserEmail, &m.TeamID, &m.TeamName,
			&m.TotalPoints, &m.PaymentStatus, &m.PaystackRef, &joined); err != nil {
			return nil, err
		}
		m.JoinedAt = joined.Format(time.RFC3339)
		list = append(list, m)
	}
	return list, rows.Err()
}
