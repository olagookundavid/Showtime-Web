package ports

import (
	"context"
	"errors"
	"fmt"
	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IDiscountRepository interface {
	List(ctx context.Context) ([]domain.DiscountCode, error)
	GetByID(ctx context.Context, id string) (*domain.DiscountCode, error)
	GetByCode(ctx context.Context, code string) (*domain.DiscountCode, error)
	Create(ctx context.Context, dc *domain.DiscountCode) error
	Update(ctx context.Context, dc *domain.DiscountCode) error
	Delete(ctx context.Context, id string) error
	ListTargets(ctx context.Context) ([]domain.DiscountCodeItem, error)

	// Reserving is not on this interface: a hold must be taken in the same
	// transaction that claims the seat or the stock, so the storefront and the
	// ticket repository call reserveDiscountTx directly from inside their own
	// CreateOrder / CreateTicket transactions.
	//
	// ConfirmRedemption settles a hold once payment succeeds.
	ConfirmRedemption(ctx context.Context, orderID, ticketID *string) error
	// ReleaseRedemption returns the hold when payment fails or is cancelled.
	ReleaseRedemption(ctx context.Context, orderID, ticketID *string) error
}

type DiscountRepository struct {
	db *pgxpool.Pool
}

func NewDiscountRepository(db *pgxpool.Pool) IDiscountRepository {
	return &DiscountRepository{db: db}
}

// usedCountExpr counts the redemptions that currently occupy a use of a code:
// everything confirmed, plus reservations young enough to still be a live
// checkout. Older reservations are abandoned carts and are ignored, which is
// what keeps a limited code from being permanently consumed by people who never
// paid — no sweeper job required.
const usedCountExpr = `
	(SELECT COUNT(*) FROM discount_code_redemptions r
	  WHERE r.discount_code_id = d.id
	    AND (r.status = 'confirmed'
	         OR (r.status = 'reserved' AND r.created_at > NOW() - INTERVAL '1 hour')))`

const discountColumns = `d.id, d.code, d.description, d.max_uses, d.expires_at, d.audience, d.is_active, d.created_by, d.created_at, d.updated_at, ` + usedCountExpr

func scanDiscount(row pgx.Row) (*domain.DiscountCode, error) {
	var d domain.DiscountCode
	err := row.Scan(&d.ID, &d.Code, &d.Description, &d.MaxUses, &d.ExpiresAt, &d.Audience, &d.IsActive, &d.CreatedBy, &d.CreatedAt, &d.UpdatedAt, &d.UsedCount)
	if err != nil {
		return nil, err
	}
	d.Items = []domain.DiscountCodeItem{}
	return &d, nil
}

// loadItems attaches the covered products/tiers to the given codes, resolving
// each entity's current name and price for display. Done as one query per
// entity kind rather than per code to keep the admin list at constant cost.
func (r *DiscountRepository) loadItems(ctx context.Context, codes map[string]*domain.DiscountCode) error {
	if len(codes) == 0 {
		return nil
	}
	ids := make([]string, 0, len(codes))
	for id := range codes {
		ids = append(ids, id)
	}

	// LEFT JOIN both possible targets; exactly one side matches per row, and a
	// row whose target has since been deleted still returns with a NULL name so
	// the admin can see and remove it.
	query := `
		SELECT i.id, i.discount_code_id, i.entity_type, i.entity_id, i.amount_off,
		       COALESCE(p.name, t.name, '') AS entity_name,
		       COALESCE(p.price, t.price::numeric, 0) AS entity_price
		FROM discount_code_items i
		LEFT JOIN store_products p ON i.entity_type = 'product' AND p.id = i.entity_id
		LEFT JOIN ticket_tiers t ON i.entity_type = 'ticket_tier' AND t.id = i.entity_id
		WHERE i.discount_code_id = ANY($1::uuid[])
		ORDER BY i.created_at ASC`

	rows, err := r.db.Query(ctx, query, ids)
	if err != nil {
		return fmt.Errorf("failed to load discount items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var codeID string
		var it domain.DiscountCodeItem
		if err := rows.Scan(&it.ID, &codeID, &it.EntityType, &it.EntityID, &it.AmountOff, &it.EntityName, &it.EntityPrice); err != nil {
			return fmt.Errorf("failed to scan discount item: %w", err)
		}
		if c, ok := codes[codeID]; ok {
			c.Items = append(c.Items, it)
		}
	}
	return rows.Err()
}

func (r *DiscountRepository) List(ctx context.Context) ([]domain.DiscountCode, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, `SELECT `+discountColumns+` FROM discount_codes d ORDER BY d.created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("failed to list discount codes: %w", err)
	}
	defer rows.Close()

	list := []domain.DiscountCode{}
	for rows.Next() {
		d, err := scanDiscount(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan discount code: %w", err)
		}
		list = append(list, *d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	byID := make(map[string]*domain.DiscountCode, len(list))
	for i := range list {
		byID[list[i].ID] = &list[i]
	}
	if err := r.loadItems(ctx, byID); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *DiscountRepository) getOne(ctx context.Context, where string, arg any) (*domain.DiscountCode, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	d, err := scanDiscount(r.db.QueryRow(ctx, `SELECT `+discountColumns+` FROM discount_codes d WHERE `+where, arg))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if err := r.loadItems(ctx, map[string]*domain.DiscountCode{d.ID: d}); err != nil {
		return nil, err
	}
	return d, nil
}

func (r *DiscountRepository) GetByID(ctx context.Context, id string) (*domain.DiscountCode, error) {
	return r.getOne(ctx, "d.id = $1", id)
}

func (r *DiscountRepository) GetByCode(ctx context.Context, code string) (*domain.DiscountCode, error) {
	return r.getOne(ctx, "d.code = $1", domain.NormalizeCode(code))
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// writeItems replaces a code's covered entities wholesale. Replacing rather than
// diffing keeps the admin editor simple: whatever the screen shows is what ends
// up stored.
func writeItems(ctx context.Context, tx pgx.Tx, codeID string, items []domain.DiscountCodeItem) error {
	if _, err := tx.Exec(ctx, `DELETE FROM discount_code_items WHERE discount_code_id = $1`, codeID); err != nil {
		return err
	}
	for _, it := range items {
		_, err := tx.Exec(ctx,
			`INSERT INTO discount_code_items (discount_code_id, entity_type, entity_id, amount_off) VALUES ($1, $2, $3, $4)`,
			codeID, it.EntityType, it.EntityID, it.AmountOff)
		if err != nil {
			if isUniqueViolation(err) {
				return fmt.Errorf("the same item was added twice to this code")
			}
			return err
		}
	}
	return nil
}

func (r *DiscountRepository) Create(ctx context.Context, dc *domain.DiscountCode) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		INSERT INTO discount_codes (code, description, max_uses, expires_at, audience, is_active, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`,
		dc.Code, dc.Description, dc.MaxUses, dc.ExpiresAt, dc.Audience, dc.IsActive, dc.CreatedBy,
	).Scan(&dc.ID, &dc.CreatedAt, &dc.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return appErrors.ErrDuplicateDiscountCode
		}
		return fmt.Errorf("failed to create discount code: %w", err)
	}

	if err := writeItems(ctx, tx, dc.ID, dc.Items); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *DiscountRepository) Update(ctx context.Context, dc *domain.DiscountCode) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE discount_codes
		SET code = $2, description = $3, max_uses = $4, expires_at = $5, audience = $6, is_active = $7, updated_at = NOW()
		WHERE id = $1`,
		dc.ID, dc.Code, dc.Description, dc.MaxUses, dc.ExpiresAt, dc.Audience, dc.IsActive)
	if err != nil {
		if isUniqueViolation(err) {
			return appErrors.ErrDuplicateDiscountCode
		}
		return fmt.Errorf("failed to update discount code: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}

	if err := writeItems(ctx, tx, dc.ID, dc.Items); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *DiscountRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, `DELETE FROM discount_codes WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete discount code: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

// ListTargets returns every product and ticket tier a code can be pointed at,
// as one merged list for the admin picker.
func (r *DiscountRepository) ListTargets(ctx context.Context) ([]domain.DiscountCodeItem, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Only sellable targets: inactive products and past events can't be bought,
	// so offering them in the picker would only create dead code lines.
	query := `
		SELECT 'product' AS entity_type, p.id, p.name, p.price::numeric, '' AS group_label
		FROM store_products p
		WHERE p.is_active = TRUE
		UNION ALL
		SELECT 'ticket_tier', t.id, t.name, t.price::numeric, e.title
		FROM ticket_tiers t
		JOIN event_days e ON e.id = t.event_day_id
		WHERE e.is_active = TRUE
		ORDER BY entity_type, group_label, name`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list discount targets: %w", err)
	}
	defer rows.Close()

	out := []domain.DiscountCodeItem{}
	for rows.Next() {
		var it domain.DiscountCodeItem
		var group string
		if err := rows.Scan(&it.EntityType, &it.EntityID, &it.EntityName, &it.EntityPrice, &group); err != nil {
			return nil, fmt.Errorf("failed to scan discount target: %w", err)
		}
		if group != "" {
			it.EntityName = group + " — " + it.EntityName
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// ─── Redemption lifecycle ─────────────────────────────────────────────────────

// reserveDiscountTx takes a hold on one use of a code inside an existing
// transaction. The code row is locked FOR UPDATE first, so two buyers racing for
// the last use of a code serialize here and exactly one of them wins.
//
// Lives at package scope because the storefront reserves inside the same
// transaction that reserves stock — one purchase must not take a code without
// also taking the goods.
func reserveDiscountTx(ctx context.Context, tx pgx.Tx, codeID, email string, userID, orderID, ticketID *string, amount float64) error {
	var maxUses *int
	var isActive bool
	var expiresAt *time.Time
	err := tx.QueryRow(ctx,
		`SELECT max_uses, is_active, expires_at FROM discount_codes WHERE id = $1 FOR UPDATE`,
		codeID).Scan(&maxUses, &isActive, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return appErrors.ErrDiscountNotFound
		}
		return err
	}
	if !isActive {
		return appErrors.ErrDiscountInactive
	}
	if expiresAt != nil && time.Now().After(*expiresAt) {
		return appErrors.ErrDiscountExpired
	}

	if maxUses != nil {
		var used int
		err := tx.QueryRow(ctx, `
			SELECT COUNT(*) FROM discount_code_redemptions
			WHERE discount_code_id = $1
			  AND (status = 'confirmed'
			       OR (status = 'reserved' AND created_at > NOW() - INTERVAL '1 hour'))`,
			codeID).Scan(&used)
		if err != nil {
			return err
		}
		if used >= *maxUses {
			return appErrors.ErrDiscountExhausted
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO discount_code_redemptions (discount_code_id, user_id, email, order_id, ticket_id, amount_discounted, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'reserved')`,
		codeID, userID, strings.ToLower(strings.TrimSpace(email)), orderID, ticketID, amount)
	return err
}

// settle moves a purchase's outstanding hold to a terminal state. Only
// 'reserved' rows are touched, which makes repeated webhook deliveries a no-op.
func (r *DiscountRepository) settle(ctx context.Context, status string, orderID, ticketID *string) error {
	if orderID == nil && ticketID == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, `
		UPDATE discount_code_redemptions
		SET status = $1, updated_at = NOW()
		WHERE status = 'reserved'
		  AND (($2::uuid IS NOT NULL AND order_id = $2::uuid)
		    OR ($3::uuid IS NOT NULL AND ticket_id = $3::uuid))`,
		status, orderID, ticketID)
	if err != nil {
		return fmt.Errorf("failed to %s discount redemption: %w", status, err)
	}
	return nil
}

func (r *DiscountRepository) ConfirmRedemption(ctx context.Context, orderID, ticketID *string) error {
	return r.settle(ctx, domain.RedemptionConfirmed, orderID, ticketID)
}

func (r *DiscountRepository) ReleaseRedemption(ctx context.Context, orderID, ticketID *string) error {
	return r.settle(ctx, domain.RedemptionReleased, orderID, ticketID)
}
