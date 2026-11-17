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

var (
	// ErrVoucherCodeTaken means the generated code already exists; the caller makes
	// another and tries again.
	ErrVoucherCodeTaken = errors.New("voucher code already exists")
	ErrVoucherNotFound  = errors.New("voucher not found")
	// ErrVoucherNotVoidable is returned for a voucher that is already redeemed or void.
	ErrVoucherNotVoidable = errors.New("only a voucher that has not been used or voided can be voided")
)

// VoucherFilter narrows the admin list. Empty fields match everything.
type VoucherFilter struct {
	Status string
	Search string
	Page   int
	Limit  int
}

type IVoucherRepository interface {
	ListProducts(ctx context.Context, activeOnly bool) ([]domain.VoucherProduct, error)
	// GetProduct returns nil, nil when there is no such product.
	GetProduct(ctx context.Context, id string) (*domain.VoucherProduct, error)
	CreateProduct(ctx context.Context, p *domain.VoucherProduct) error
	// UpdateProduct returns false when there is no such product.
	UpdateProduct(ctx context.Context, p *domain.VoucherProduct) (bool, error)

	// CreatePurchased saves a voucher and takes its price from the buyer's wallet
	// in one transaction, so a voucher never exists unpaid and a payment never
	// exists without its voucher. ports.ErrWalletInsufficient means the buyer is short.
	CreatePurchased(ctx context.Context, v *domain.Voucher) error
	// CreateIssued saves a free, admin-issued voucher.
	CreateIssued(ctx context.Context, v *domain.Voucher) error

	// GetByCode and GetByID return nil, nil when there is no such voucher.
	GetByCode(ctx context.Context, code string) (*domain.Voucher, error)
	GetByID(ctx context.Context, id string) (*domain.Voucher, error)
	// ListForUser is the vouchers a user holds or bought, newest first.
	ListForUser(ctx context.Context, userID string) ([]domain.Voucher, error)
	List(ctx context.Context, f VoucherFilter) ([]domain.Voucher, int, error)
	ListRedemptions(ctx context.Context, limit int) ([]domain.Voucher, error)

	// Redeem uses a voucher up. It is one atomic statement that only succeeds for
	// an ISSUED voucher whose dates include today, so two staff scanning the same
	// code at once cannot both succeed. redeemed is false when it did not apply;
	// the returned voucher (nil if the code is unknown) says why.
	Redeem(ctx context.Context, code, staffID string, today time.Time) (v *domain.Voucher, redeemed bool, err error)
	// Void cancels an unused voucher. With refund, the price goes back to the
	// buyer's wallet (purchased vouchers only), in the same transaction.
	Void(ctx context.Context, id, staffID string, refund bool) (*domain.Voucher, error)
}

type VoucherRepository struct {
	pool *pgxpool.Pool
}

func NewVoucherRepository(pool *pgxpool.Pool) IVoucherRepository {
	return &VoucherRepository{pool: pool}
}

const voucherSelect = `
	SELECT v.id, v.code, v.product_id, v.name, v.items, v.price_kobo, v.source,
	       v.holder_name, v.holder_email, v.holder_user_id, v.purchased_by_user_id, v.issued_by_user_id,
	       v.valid_from, v.valid_to, v.status, v.redeemed_at, v.redeemed_by_user_id,
	       COALESCE(NULLIF(ru.full_name, ''), ''),
	       v.voided_at, v.voided_by_user_id, v.wallet_tx_id, v.created_at
	FROM vouchers v
	LEFT JOIN users ru ON ru.id = v.redeemed_by_user_id`

func scanVoucher(row pgx.Row) (*domain.Voucher, error) {
	var v domain.Voucher
	err := row.Scan(&v.ID, &v.Code, &v.ProductID, &v.Name, &v.Items, &v.PriceKobo, &v.Source,
		&v.HolderName, &v.HolderEmail, &v.HolderUserID, &v.PurchasedByUserID, &v.IssuedByUserID,
		&v.ValidFrom, &v.ValidTo, &v.Status, &v.RedeemedAt, &v.RedeemedByUserID,
		&v.RedeemedByName,
		&v.VoidedAt, &v.VoidedByUserID, &v.WalletTxID, &v.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if v.Items == nil {
		v.Items = []domain.VoucherItem{}
	}
	return &v, nil
}

func scanVouchers(rows pgx.Rows) ([]domain.Voucher, error) {
	defer rows.Close()
	list := make([]domain.Voucher, 0)
	for rows.Next() {
		v, err := scanVoucher(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *v)
	}
	return list, rows.Err()
}

// ---- products ----

const voucherProductColumns = `id, name, description, price_kobo, items, active, created_at, updated_at`

func scanVoucherProduct(row pgx.Row) (*domain.VoucherProduct, error) {
	var p domain.VoucherProduct
	err := row.Scan(&p.ID, &p.Name, &p.Description, &p.PriceKobo, &p.Items, &p.Active, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if p.Items == nil {
		p.Items = []domain.VoucherItem{}
	}
	return &p, nil
}

func (r *VoucherRepository) ListProducts(ctx context.Context, activeOnly bool) ([]domain.VoucherProduct, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	q := `SELECT ` + voucherProductColumns + ` FROM voucher_products`
	if activeOnly {
		q += ` WHERE active`
	}
	q += ` ORDER BY active DESC, price_kobo, name`
	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("failed to list voucher products: %w", err)
	}
	defer rows.Close()

	list := make([]domain.VoucherProduct, 0)
	for rows.Next() {
		p, err := scanVoucherProduct(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *p)
	}
	return list, rows.Err()
}

func (r *VoucherRepository) GetProduct(ctx context.Context, id string) (*domain.VoucherProduct, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	p, err := scanVoucherProduct(r.pool.QueryRow(ctx, `SELECT `+voucherProductColumns+` FROM voucher_products WHERE id = $1`, id))
	if err != nil {
		return nil, fmt.Errorf("failed to get voucher product: %w", err)
	}
	return p, nil
}

func (r *VoucherRepository) CreateProduct(ctx context.Context, p *domain.VoucherProduct) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if p.Items == nil {
		p.Items = []domain.VoucherItem{}
	}
	return r.pool.QueryRow(ctx, `
		INSERT INTO voucher_products (name, description, price_kobo, items, active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`, p.Name, p.Description, p.PriceKobo, p.Items, p.Active).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *VoucherRepository) UpdateProduct(ctx context.Context, p *domain.VoucherProduct) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if p.Items == nil {
		p.Items = []domain.VoucherItem{}
	}
	err := r.pool.QueryRow(ctx, `
		UPDATE voucher_products
		SET name = $2, description = $3, price_kobo = $4, items = $5, active = $6, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at
	`, p.ID, p.Name, p.Description, p.PriceKobo, p.Items, p.Active).Scan(&p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// ---- vouchers ----

const insertVoucher = `
	INSERT INTO vouchers
		(code, product_id, name, items, price_kobo, source,
		 holder_name, holder_email, holder_user_id, purchased_by_user_id, issued_by_user_id,
		 valid_from, valid_to)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	RETURNING id, status, created_at`

func insertVoucherRow(ctx context.Context, tx pgx.Tx, v *domain.Voucher) error {
	if v.Items == nil {
		v.Items = []domain.VoucherItem{}
	}
	err := tx.QueryRow(ctx, insertVoucher,
		v.Code, v.ProductID, v.Name, v.Items, v.PriceKobo, v.Source,
		v.HolderName, v.HolderEmail, v.HolderUserID, v.PurchasedByUserID, v.IssuedByUserID,
		v.ValidFrom, v.ValidTo,
	).Scan(&v.ID, &v.Status, &v.CreatedAt)
	if isUniqueViolation(err) {
		return ErrVoucherCodeTaken
	}
	if err != nil {
		return fmt.Errorf("failed to save voucher: %w", err)
	}
	return nil
}

func (r *VoucherRepository) CreatePurchased(ctx context.Context, v *domain.Voucher) error {
	if v.PurchasedByUserID == nil || v.PriceKobo <= 0 {
		return errors.New("a purchased voucher needs a buyer and a price")
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := insertVoucherRow(ctx, tx, v); err != nil {
		return err
	}

	voucherID := v.ID
	entry, err := applySpendEntry(ctx, tx, domain.LedgerEntry{
		UserID:      *v.PurchasedByUserID,
		AmountKobo:  -v.PriceKobo,
		Type:        domain.LedgerVoucherPurchase,
		VoucherID:   &voucherID,
		Description: "Voucher: " + v.Name,
	})
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE vouchers SET wallet_tx_id = $1 WHERE id = $2`, entry.ID, v.ID); err != nil {
		return fmt.Errorf("failed to link voucher payment: %w", err)
	}
	v.WalletTxID = &entry.ID
	return tx.Commit(ctx)
}

func (r *VoucherRepository) CreateIssued(ctx context.Context, v *domain.Voucher) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := insertVoucherRow(ctx, tx, v); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *VoucherRepository) GetByCode(ctx context.Context, code string) (*domain.Voucher, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	v, err := scanVoucher(r.pool.QueryRow(ctx, voucherSelect+` WHERE v.code = $1`, code))
	if err != nil {
		return nil, fmt.Errorf("failed to get voucher: %w", err)
	}
	return v, nil
}

func (r *VoucherRepository) GetByID(ctx context.Context, id string) (*domain.Voucher, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	v, err := scanVoucher(r.pool.QueryRow(ctx, voucherSelect+` WHERE v.id = $1`, id))
	if err != nil {
		return nil, fmt.Errorf("failed to get voucher: %w", err)
	}
	return v, nil
}

func (r *VoucherRepository) ListForUser(ctx context.Context, userID string) ([]domain.Voucher, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, voucherSelect+`
		WHERE v.holder_user_id = $1 OR v.purchased_by_user_id = $1
		ORDER BY v.created_at DESC
		LIMIT 100`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list vouchers: %w", err)
	}
	return scanVouchers(rows)
}

func (r *VoucherRepository) List(ctx context.Context, f VoucherFilter) ([]domain.Voucher, int, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	where := ` WHERE ($1 = '' OR v.status = $1)
		AND ($2 = '' OR v.code ILIKE '%' || $2 || '%' OR v.holder_name ILIKE '%' || $2 || '%'
		     OR v.holder_email ILIKE '%' || $2 || '%' OR v.name ILIKE '%' || $2 || '%')`

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM vouchers v`+where, f.Status, f.Search).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count vouchers: %w", err)
	}
	rows, err := r.pool.Query(ctx, voucherSelect+where+`
		ORDER BY v.created_at DESC, v.id
		LIMIT $3 OFFSET $4`, f.Status, f.Search, f.Limit, (f.Page-1)*f.Limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list vouchers: %w", err)
	}
	list, err := scanVouchers(rows)
	return list, total, err
}

func (r *VoucherRepository) ListRedemptions(ctx context.Context, limit int) ([]domain.Voucher, error) {
	if limit < 1 || limit > 200 {
		limit = 100
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, voucherSelect+`
		WHERE v.status = 'REDEEMED'
		ORDER BY v.redeemed_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list redemptions: %w", err)
	}
	return scanVouchers(rows)
}

func (r *VoucherRepository) Redeem(ctx context.Context, code, staffID string, today time.Time) (*domain.Voucher, bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	// The whole decision is this one UPDATE: it only matches an unused voucher
	// whose dates include today, and the row lock means a second scan of the same
	// code finds it already REDEEMED.
	var id string
	err := r.pool.QueryRow(ctx, `
		UPDATE vouchers
		SET status = 'REDEEMED', redeemed_at = NOW(), redeemed_by_user_id = $2
		WHERE code = $1 AND status = 'ISSUED' AND $3::date BETWEEN valid_from AND valid_to
		RETURNING id
	`, code, staffID, today).Scan(&id)
	if err == nil {
		v, err := r.GetByID(ctx, id)
		return v, err == nil && v != nil, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("failed to redeem voucher: %w", err)
	}
	v, err := r.GetByCode(ctx, code)
	return v, false, err
}

func (r *VoucherRepository) Void(ctx context.Context, id, staffID string, refund bool) (*domain.Voucher, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var source domain.VoucherSource
	var price int64
	var buyer *string
	var name string
	err = tx.QueryRow(ctx, `
		UPDATE vouchers
		SET status = 'VOID', voided_at = NOW(), voided_by_user_id = $2
		WHERE id = $1 AND status = 'ISSUED'
		RETURNING source, price_kobo, purchased_by_user_id, name
	`, id, staffID).Scan(&source, &price, &buyer, &name)
	if errors.Is(err, pgx.ErrNoRows) {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM vouchers WHERE id = $1)`, id).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			return nil, ErrVoucherNotFound
		}
		return nil, ErrVoucherNotVoidable
	}
	if err != nil {
		return nil, fmt.Errorf("failed to void voucher: %w", err)
	}

	if refund && source == domain.VoucherPurchased && buyer != nil && price > 0 {
		ref := "VOID-" + id
		voucherID := id
		if _, err := applySpendEntry(ctx, tx, domain.LedgerEntry{
			UserID:          *buyer,
			AmountKobo:      price,
			Type:            domain.LedgerRefund,
			Reference:       &ref,
			VoucherID:       &voucherID,
			Description:     "Refund: voucher " + name + " cancelled",
			CreatedByUserID: &staffID,
		}); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}
