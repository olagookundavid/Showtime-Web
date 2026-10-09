package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ═══════════════════════════════════════════════════════════════════════════════
// Season Admission Tiers
// ═══════════════════════════════════════════════════════════════════════════════

type SeasonAdmissionTierRepository interface {
	// List returns tiers ordered by display_order; activeOnly hides inactive ones.
	List(ctx context.Context, activeOnly bool) ([]domain.SeasonAdmissionTier, error)
	GetByID(ctx context.Context, id string) (*domain.SeasonAdmissionTier, error)
	Create(ctx context.Context, t *domain.SeasonAdmissionTier) error
	Update(ctx context.Context, t *domain.SeasonAdmissionTier) error
	Delete(ctx context.Context, id string) error
}

type PostgresSeasonAdmissionTierRepository struct {
	db *pgxpool.Pool
}

func NewSeasonAdmissionTierRepository(db *pgxpool.Pool) SeasonAdmissionTierRepository {
	return &PostgresSeasonAdmissionTierRepository{db: db}
}

const seasonTierColumns = `id, name, price, description, display_order, is_active, created_at, updated_at`

func scanSeasonTier(row pgx.Row) (*domain.SeasonAdmissionTier, error) {
	var t domain.SeasonAdmissionTier
	if err := row.Scan(&t.ID, &t.Name, &t.Price, &t.Description, &t.DisplayOrder, &t.IsActive, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *PostgresSeasonAdmissionTierRepository) List(ctx context.Context, activeOnly bool) ([]domain.SeasonAdmissionTier, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	query := `SELECT ` + seasonTierColumns + ` FROM season_admission_tiers`
	if activeOnly {
		query += ` WHERE is_active`
	}
	query += ` ORDER BY display_order, name`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list season admission tiers: %w", err)
	}
	defer rows.Close()

	tiers := []domain.SeasonAdmissionTier{}
	for rows.Next() {
		t, err := scanSeasonTier(rows)
		if err != nil {
			return nil, err
		}
		tiers = append(tiers, *t)
	}
	return tiers, rows.Err()
}

func (r *PostgresSeasonAdmissionTierRepository) GetByID(ctx context.Context, id string) (*domain.SeasonAdmissionTier, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	t, err := scanSeasonTier(r.db.QueryRow(ctx, `SELECT `+seasonTierColumns+` FROM season_admission_tiers WHERE id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get season admission tier: %w", err)
	}
	return t, nil
}

func (r *PostgresSeasonAdmissionTierRepository) Create(ctx context.Context, t *domain.SeasonAdmissionTier) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, `
		INSERT INTO season_admission_tiers (name, price, description, display_order, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`,
		t.Name, t.Price, t.Description, t.DisplayOrder, t.IsActive,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return appErrors.ErrDuplicateSeasonTier
		}
		return fmt.Errorf("failed to create season admission tier: %w", err)
	}
	return nil
}

func (r *PostgresSeasonAdmissionTierRepository) Update(ctx context.Context, t *domain.SeasonAdmissionTier) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, `
		UPDATE season_admission_tiers
		SET name = $1, price = $2, description = $3, display_order = $4, is_active = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING updated_at`,
		t.Name, t.Price, t.Description, t.DisplayOrder, t.IsActive, t.ID,
	).Scan(&t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return appErrors.ErrNotFound
		}
		if isUniqueViolation(err) {
			return appErrors.ErrDuplicateSeasonTier
		}
		return fmt.Errorf("failed to update season admission tier: %w", err)
	}
	return nil
}

func (r *PostgresSeasonAdmissionTierRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, `DELETE FROM season_admission_tiers WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete season admission tier: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Game Pass Discount Bands
// ═══════════════════════════════════════════════════════════════════════════════

type GamePassDiscountBandRepository interface {
	// List returns bands ordered by min_gamedays; activeOnly hides inactive ones.
	List(ctx context.Context, activeOnly bool) ([]domain.GamePassDiscountBand, error)
	GetByID(ctx context.Context, id string) (*domain.GamePassDiscountBand, error)
	// Save inserts the band when its ID is empty and updates it otherwise.
	// check runs inside the write transaction, after the band table is locked,
	// against every stored band — so two admins saving at once can't each pass
	// validation and together leave overlapping bands.
	Save(ctx context.Context, b *domain.GamePassDiscountBand, check func(all []domain.GamePassDiscountBand) error) error
	Delete(ctx context.Context, id string) error
}

type PostgresGamePassDiscountBandRepository struct {
	db *pgxpool.Pool
}

func NewGamePassDiscountBandRepository(db *pgxpool.Pool) GamePassDiscountBandRepository {
	return &PostgresGamePassDiscountBandRepository{db: db}
}

const discountBandColumns = `id, min_gamedays, max_gamedays, discount_percent, display_order, is_active, created_at, updated_at`

func scanDiscountBand(row pgx.Row) (*domain.GamePassDiscountBand, error) {
	var b domain.GamePassDiscountBand
	if err := row.Scan(&b.ID, &b.MinGamedays, &b.MaxGamedays, &b.DiscountPercent, &b.DisplayOrder, &b.IsActive, &b.CreatedAt, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return &b, nil
}

func queryDiscountBands(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, activeOnly bool) ([]domain.GamePassDiscountBand, error) {
	query := `SELECT ` + discountBandColumns + ` FROM game_pass_discount_bands`
	if activeOnly {
		query += ` WHERE is_active`
	}
	query += ` ORDER BY min_gamedays, display_order`

	rows, err := q.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list discount bands: %w", err)
	}
	defer rows.Close()

	bands := []domain.GamePassDiscountBand{}
	for rows.Next() {
		b, err := scanDiscountBand(rows)
		if err != nil {
			return nil, err
		}
		bands = append(bands, *b)
	}
	return bands, rows.Err()
}

func (r *PostgresGamePassDiscountBandRepository) List(ctx context.Context, activeOnly bool) ([]domain.GamePassDiscountBand, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return queryDiscountBands(ctx, r.db, activeOnly)
}

func (r *PostgresGamePassDiscountBandRepository) GetByID(ctx context.Context, id string) (*domain.GamePassDiscountBand, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	b, err := scanDiscountBand(r.db.QueryRow(ctx, `SELECT `+discountBandColumns+` FROM game_pass_discount_bands WHERE id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get discount band: %w", err)
	}
	return b, nil
}

func (r *PostgresGamePassDiscountBandRepository) Save(ctx context.Context, b *domain.GamePassDiscountBand, check func(all []domain.GamePassDiscountBand) error) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Serialize every band write. The table is a handful of rows edited by
	// hand, so a table-wide lock costs nothing.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('game_pass_discount_bands'))`); err != nil {
		return err
	}

	if check != nil {
		all, err := queryDiscountBands(ctx, tx, false)
		if err != nil {
			return err
		}
		if err := check(all); err != nil {
			return err
		}
	}

	if b.ID == "" {
		err = tx.QueryRow(ctx, `
			INSERT INTO game_pass_discount_bands (min_gamedays, max_gamedays, discount_percent, display_order, is_active)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, created_at, updated_at`,
			b.MinGamedays, b.MaxGamedays, b.DiscountPercent, b.DisplayOrder, b.IsActive,
		).Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
	} else {
		err = tx.QueryRow(ctx, `
			UPDATE game_pass_discount_bands
			SET min_gamedays = $1, max_gamedays = $2, discount_percent = $3, display_order = $4, is_active = $5, updated_at = NOW()
			WHERE id = $6
			RETURNING created_at, updated_at`,
			b.MinGamedays, b.MaxGamedays, b.DiscountPercent, b.DisplayOrder, b.IsActive, b.ID,
		).Scan(&b.CreatedAt, &b.UpdatedAt)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return appErrors.ErrNotFound
		}
		if isBandConstraintViolation(err) {
			// The table constraints are the backstop for the service validation;
			// reaching here means the two disagree, so report it the same way.
			return appErrors.InvalidGamePassConfig("this band conflicts with the existing bands")
		}
		return fmt.Errorf("failed to save discount band: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *PostgresGamePassDiscountBandRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, `DELETE FROM game_pass_discount_bands WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete discount band: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

// isBandConstraintViolation matches the overlap exclusion (23P01) and the
// range CHECKs (23514) on game_pass_discount_bands.
func isBandConstraintViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && (pgErr.Code == "23P01" || pgErr.Code == "23514")
}
