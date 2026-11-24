package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"showtime-backend/internal/domain"
)

// ErrWalletInsufficient is returned when a debit is more than the wallet holds.
var ErrWalletInsufficient = errors.New("your wallet balance is not enough for this")

// ErrTopupOverLimit is returned when a new top-up, with the balance and the
// unpaid top-ups already started, would take the wallet past its maximum.
var ErrTopupOverLimit = errors.New("this top-up would take the wallet past its maximum balance")

type IWalletRepository interface {
	// GetWallet returns the wallet, or an implicit empty one for a user who has
	// never used it. Wallets are created on first credit, so nobody needs a backfill.
	GetWallet(ctx context.Context, userID string) (*domain.Wallet, error)
	ListEntries(ctx context.Context, userID string, limit int) ([]domain.LedgerEntry, error)

	// CreateTopup records a new PENDING top-up, but only if the balance plus the
	// user's unpaid top-ups started after pendingSince plus this one stay within
	// maxBalanceKobo; otherwise it returns ErrTopupOverLimit. The check and the
	// insert happen under the wallet's row lock, so two top-ups started at the
	// same moment can't both squeeze under the cap.
	CreateTopup(ctx context.Context, t *domain.Topup, maxBalanceKobo int64, pendingSince time.Time) error
	// GetTopupByReference returns nil, nil when the reference is not a top-up.
	GetTopupByReference(ctx context.Context, reference string) (*domain.Topup, error)
	// SettleTopup turns a top-up PAID and credits the wallet, in one database
	// transaction. credited is false when it had already been settled, so a payment
	// that reaches us twice (webhook and browser) is only ever credited once.
	SettleTopup(ctx context.Context, reference string) (t *domain.Topup, credited bool, err error)
	// MarkTopupFailed marks a PENDING top-up FAILED. A top-up already PAID is left alone.
	MarkTopupFailed(ctx context.Context, reference string) error
	// PendingTopupsKobo totals a user's unpaid top-ups started after since.
	PendingTopupsKobo(ctx context.Context, userID string, since time.Time) (int64, error)

	// Apply writes one ledger entry and moves the balance by its signed amount.
	// A debit larger than the balance fails with ErrWalletInsufficient.
	Apply(ctx context.Context, e domain.LedgerEntry) (*domain.LedgerEntry, error)
	// ApplyOnce is Apply for an entry that carries a reference and must happen at
	// most once: when a row of the same type and reference already exists, nothing
	// moves and that row is returned with applied=false. Safe under concurrent calls.
	ApplyOnce(ctx context.Context, e domain.LedgerEntry) (entry *domain.LedgerEntry, applied bool, err error)
	// FindEntry returns the ledger row of this type and reference, or nil if none.
	FindEntry(ctx context.Context, t domain.LedgerType, reference string) (*domain.LedgerEntry, error)
}

type WalletRepository struct {
	pool *pgxpool.Pool
}

func NewWalletRepository(pool *pgxpool.Pool) IWalletRepository {
	return &WalletRepository{pool: pool}
}

// lockSpendWallet fetches a user's wallet row FOR UPDATE, creating it on first
// use. Every balance change goes through this, so concurrent credits and debits
// are serialised per user. (Same pattern as the Fantasy prize wallet.)
func lockSpendWallet(ctx context.Context, tx pgx.Tx, userID string) (int64, error) {
	if _, err := tx.Exec(ctx,
		`INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID,
	); err != nil {
		return 0, fmt.Errorf("failed to open wallet: %w", err)
	}
	var balance int64
	if err := tx.QueryRow(ctx,
		`SELECT balance_kobo FROM wallets WHERE user_id = $1 FOR UPDATE`, userID,
	).Scan(&balance); err != nil {
		return 0, fmt.Errorf("failed to lock wallet: %w", err)
	}
	return balance, nil
}

// applySpendEntry locks the wallet, moves the balance and writes the ledger row,
// so the ledger can always reconstruct the balance. Other repositories (vouchers)
// call it inside their own transaction so a purchase and its debit commit together.
func applySpendEntry(ctx context.Context, tx pgx.Tx, e domain.LedgerEntry) (*domain.LedgerEntry, error) {
	if e.AmountKobo == 0 {
		return nil, errors.New("a wallet entry must move some money")
	}
	balance, err := lockSpendWallet(ctx, tx, e.UserID)
	if err != nil {
		return nil, err
	}
	after := balance + e.AmountKobo
	if after < 0 {
		return nil, ErrWalletInsufficient
	}
	if _, err := tx.Exec(ctx,
		`UPDATE wallets SET balance_kobo = $1, updated_at = NOW() WHERE user_id = $2`, after, e.UserID,
	); err != nil {
		return nil, fmt.Errorf("failed to update wallet balance: %w", err)
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO wallet_transactions
			(user_id, amount_kobo, balance_after_kobo, type, reference, voucher_id, description, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`, e.UserID, e.AmountKobo, after, e.Type, e.Reference, e.VoucherID, e.Description, e.CreatedByUserID,
	).Scan(&e.ID, &e.CreatedAt); err != nil {
		return nil, fmt.Errorf("failed to record wallet entry: %w", err)
	}
	e.BalanceAfterKobo = after
	return &e, nil
}

func (r *WalletRepository) GetWallet(ctx context.Context, userID string) (*domain.Wallet, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var w domain.Wallet
	err := r.pool.QueryRow(ctx,
		`SELECT user_id, balance_kobo, created_at, updated_at FROM wallets WHERE user_id = $1`, userID,
	).Scan(&w.UserID, &w.BalanceKobo, &w.CreatedAt, &w.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return &domain.Wallet{UserID: userID}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	return &w, nil
}

func (r *WalletRepository) ListEntries(ctx context.Context, userID string, limit int) ([]domain.LedgerEntry, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, amount_kobo, balance_after_kobo, type, reference, voucher_id,
		       description, created_by_user_id, created_at
		FROM wallet_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list wallet entries: %w", err)
	}
	defer rows.Close()

	list := make([]domain.LedgerEntry, 0)
	for rows.Next() {
		var e domain.LedgerEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.AmountKobo, &e.BalanceAfterKobo, &e.Type, &e.Reference,
			&e.VoucherID, &e.Description, &e.CreatedByUserID, &e.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

func (r *WalletRepository) CreateTopup(ctx context.Context, t *domain.Topup, maxBalanceKobo int64, pendingSince time.Time) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Holding the wallet lock makes concurrent top-up starts for one user take
	// turns, so each one sees the others' pending rows.
	balance, err := lockSpendWallet(ctx, tx, t.UserID)
	if err != nil {
		return err
	}
	var pending int64
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_kobo), 0)::bigint FROM wallet_topups
		WHERE user_id = $1 AND status = 'PENDING' AND created_at > $2`, t.UserID, pendingSince,
	).Scan(&pending); err != nil {
		return err
	}
	if balance+pending+t.AmountKobo > maxBalanceKobo {
		return ErrTopupOverLimit
	}

	if err := tx.QueryRow(ctx, `
		INSERT INTO wallet_topups (user_id, amount_kobo, paystack_reference, paystack_access_code)
		VALUES ($1, $2, $3, $4)
		RETURNING id, status, created_at
	`, t.UserID, t.AmountKobo, t.PaystackReference, t.PaystackAccessCode,
	).Scan(&t.ID, &t.Status, &t.CreatedAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const topupColumns = `id, user_id, amount_kobo, status, paystack_reference, paystack_access_code, created_at, paid_at`

func scanTopup(row pgx.Row) (*domain.Topup, error) {
	var t domain.Topup
	err := row.Scan(&t.ID, &t.UserID, &t.AmountKobo, &t.Status, &t.PaystackReference,
		&t.PaystackAccessCode, &t.CreatedAt, &t.PaidAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *WalletRepository) GetTopupByReference(ctx context.Context, reference string) (*domain.Topup, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	t, err := scanTopup(r.pool.QueryRow(ctx,
		`SELECT `+topupColumns+` FROM wallet_topups WHERE paystack_reference = $1`, reference))
	if err != nil {
		return nil, fmt.Errorf("failed to get top-up: %w", err)
	}
	return t, nil
}

func (r *WalletRepository) SettleTopup(ctx context.Context, reference string) (*domain.Topup, bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, false, err
	}
	defer tx.Rollback(ctx)

	// Only one caller can move a top-up to PAID. The others see no row here and
	// credit nothing, which is what stops a double delivery paying twice.
	t, err := scanTopup(tx.QueryRow(ctx, `
		UPDATE wallet_topups SET status = 'PAID', paid_at = NOW()
		WHERE paystack_reference = $1 AND status IN ('PENDING', 'FAILED')
		RETURNING `+topupColumns, reference))
	if err != nil {
		return nil, false, fmt.Errorf("failed to settle top-up: %w", err)
	}
	if t == nil {
		existing, err := scanTopup(tx.QueryRow(ctx,
			`SELECT `+topupColumns+` FROM wallet_topups WHERE paystack_reference = $1`, reference))
		if err != nil {
			return nil, false, fmt.Errorf("failed to get top-up: %w", err)
		}
		return existing, false, nil
	}

	ref := t.PaystackReference
	if _, err := applySpendEntry(ctx, tx, domain.LedgerEntry{
		UserID:      t.UserID,
		AmountKobo:  t.AmountKobo,
		Type:        domain.LedgerTopup,
		Reference:   &ref,
		Description: "Wallet top-up",
	}); err != nil {
		return nil, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, false, err
	}
	return t, true, nil
}

func (r *WalletRepository) MarkTopupFailed(ctx context.Context, reference string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.pool.Exec(ctx,
		`UPDATE wallet_topups SET status = 'FAILED' WHERE paystack_reference = $1 AND status = 'PENDING'`, reference)
	return err
}

func (r *WalletRepository) PendingTopupsKobo(ctx context.Context, userID string, since time.Time) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var total int64
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_kobo), 0)::bigint FROM wallet_topups
		WHERE user_id = $1 AND status = 'PENDING' AND created_at > $2`, userID, since).Scan(&total)
	return total, err
}

func (r *WalletRepository) Apply(ctx context.Context, e domain.LedgerEntry) (*domain.LedgerEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	out, err := applySpendEntry(ctx, tx, e)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *WalletRepository) ApplyOnce(ctx context.Context, e domain.LedgerEntry) (*domain.LedgerEntry, bool, error) {
	if e.Reference == nil || *e.Reference == "" {
		return nil, false, errors.New("a once-only wallet entry needs a reference")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, false, err
	}
	defer tx.Rollback(ctx)

	out, applied, err := applySpendEntryOnce(ctx, tx, e)
	if err != nil {
		return nil, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, false, err
	}
	return out, applied, nil
}

// applySpendEntryOnce is applySpendEntry for an entry that must happen at most
// once per (type, reference), inside the caller's transaction. When the row
// already exists nothing moves and the existing row comes back with applied=false.
// Taking the wallet lock first serialises every caller for this user, so the
// existence check cannot race with another insert of the same reference.
func applySpendEntryOnce(ctx context.Context, tx pgx.Tx, e domain.LedgerEntry) (*domain.LedgerEntry, bool, error) {
	if e.Reference == nil || *e.Reference == "" {
		return nil, false, errors.New("a once-only wallet entry needs a reference")
	}
	if _, err := lockSpendWallet(ctx, tx, e.UserID); err != nil {
		return nil, false, err
	}
	existing, err := findSpendEntry(ctx, tx, e.Type, *e.Reference)
	if err != nil {
		return nil, false, err
	}
	if existing != nil {
		return existing, false, nil
	}
	out, err := applySpendEntry(ctx, tx, e)
	if err != nil {
		return nil, false, err
	}
	return out, true, nil
}

// spendQuerier is what findSpendEntry needs: a pool or a transaction.
type spendQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func findSpendEntry(ctx context.Context, q spendQuerier, t domain.LedgerType, reference string) (*domain.LedgerEntry, error) {
	var e domain.LedgerEntry
	err := q.QueryRow(ctx, `
		SELECT id, user_id, amount_kobo, balance_after_kobo, type, reference, voucher_id, description, created_by_user_id, created_at
		FROM wallet_transactions WHERE type = $1 AND reference = $2
	`, t, reference).Scan(&e.ID, &e.UserID, &e.AmountKobo, &e.BalanceAfterKobo,
		&e.Type, &e.Reference, &e.VoucherID, &e.Description, &e.CreatedByUserID, &e.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// refundPurchaseTx gives back, inside the caller's transaction, exactly what the
// PURCHASE row for reference took, to the person it was taken from. It does
// nothing when there was no such payment or it was already refunded, so it is
// safe to repeat. It returns the kobo refunded by this call (0 when nothing moved).
func refundPurchaseTx(ctx context.Context, tx pgx.Tx, reference, description string) (int64, error) {
	paid, err := findSpendEntry(ctx, tx, domain.LedgerPurchase, reference)
	if err != nil || paid == nil {
		return 0, err
	}
	refundRef := "REFUND-" + reference
	_, applied, err := applySpendEntryOnce(ctx, tx, domain.LedgerEntry{
		UserID:      paid.UserID,
		AmountKobo:  -paid.AmountKobo,
		Type:        domain.LedgerRefund,
		Reference:   &refundRef,
		Description: description,
	})
	if err != nil || !applied {
		return 0, err
	}
	return -paid.AmountKobo, nil
}

func (r *WalletRepository) FindEntry(ctx context.Context, t domain.LedgerType, reference string) (*domain.LedgerEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return findSpendEntry(ctx, r.pool, t, reference)
}
