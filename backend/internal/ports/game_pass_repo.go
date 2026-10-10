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

// isUniqueViolationOn reports whether err is a Postgres unique-violation on
// the named constraint specifically, so two different unique indexes on the
// same table (name, display_order) can be told apart and given their own error.
func isUniqueViolationOn(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraint
}

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
		if isUniqueViolationOn(err, "uq_season_admission_tiers_name") {
			return appErrors.ErrDuplicateSeasonTier
		}
		if isUniqueViolationOn(err, "uq_season_admission_tiers_display_order") {
			return appErrors.ErrDuplicateDisplayOrder
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
		if isUniqueViolationOn(err, "uq_season_admission_tiers_name") {
			return appErrors.ErrDuplicateSeasonTier
		}
		if isUniqueViolationOn(err, "uq_season_admission_tiers_display_order") {
			return appErrors.ErrDuplicateDisplayOrder
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

// ═══════════════════════════════════════════════════════════════════════════════
// Game Pass Leads
// ═══════════════════════════════════════════════════════════════════════════════

type GamePassLeadRepository interface {
	Create(ctx context.Context, l *domain.GamePassLead) error
	// List filters by exact status and case-insensitive email substring (either
	// may be empty), newest first.
	List(ctx context.Context, status, email string, page, limit int) ([]domain.GamePassLead, int, error)
	GetByID(ctx context.Context, id string) (*domain.GamePassLead, error)
	UpdateStatus(ctx context.Context, id string, status domain.GamePassLeadStatus) error
}

type PostgresGamePassLeadRepository struct {
	db *pgxpool.Pool
}

func NewGamePassLeadRepository(db *pgxpool.Pool) GamePassLeadRepository {
	return &PostgresGamePassLeadRepository{db: db}
}

// gameday_ids is read and written as text[] so pgx handles plain Go strings.
const leadColumns = `id, name, email, phone, tier_name, gameday_ids::text[], holders,
	standard_total, discount_percent, discount_amount, total, status, created_at, updated_at`

func scanLead(row pgx.Row) (*domain.GamePassLead, error) {
	var l domain.GamePassLead
	err := row.Scan(&l.ID, &l.Name, &l.Email, &l.Phone, &l.TierName, &l.GamedayIDs, &l.Price.Holders,
		&l.Price.StandardTotal, &l.Price.DiscountPercent, &l.Price.DiscountAmount, &l.Price.Total,
		&l.Status, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, err
	}
	l.Price.Gamedays = len(l.GamedayIDs)
	return &l, nil
}

func (r *PostgresGamePassLeadRepository) Create(ctx context.Context, l *domain.GamePassLead) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if l.Status == "" {
		l.Status = domain.GamePassLeadNew
	}
	err := r.db.QueryRow(ctx, `
		INSERT INTO game_pass_leads (name, email, phone, tier_name, gameday_ids, holders,
			standard_total, discount_percent, discount_amount, total, status)
		VALUES ($1, $2, $3, $4, $5::text[]::uuid[], $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`,
		l.Name, l.Email, l.Phone, l.TierName, l.GamedayIDs, l.Price.Holders,
		l.Price.StandardTotal, l.Price.DiscountPercent, l.Price.DiscountAmount, l.Price.Total, l.Status,
	).Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create game pass lead: %w", err)
	}
	return nil
}

func (r *PostgresGamePassLeadRepository) List(ctx context.Context, status, email string, page, limit int) ([]domain.GamePassLead, int, error) {
	page, limit, offset := paging(page, limit, 50)

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	where := ` WHERE ($1 = '' OR status = $1) AND ($2 = '' OR LOWER(email) LIKE '%' || LOWER($2) || '%')`

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM game_pass_leads`+where, status, email).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count game pass leads: %w", err)
	}

	rows, err := r.db.Query(ctx,
		`SELECT `+leadColumns+` FROM game_pass_leads`+where+` ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		status, email, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list game pass leads: %w", err)
	}
	defer rows.Close()

	leads := []domain.GamePassLead{}
	for rows.Next() {
		l, err := scanLead(rows)
		if err != nil {
			return nil, 0, err
		}
		leads = append(leads, *l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if err := r.attachGamedays(ctx, leads); err != nil {
		return nil, 0, err
	}
	return leads, total, nil
}

func (r *PostgresGamePassLeadRepository) GetByID(ctx context.Context, id string) (*domain.GamePassLead, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	l, err := scanLead(r.db.QueryRow(ctx, `SELECT `+leadColumns+` FROM game_pass_leads WHERE id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get game pass lead: %w", err)
	}
	leads := []domain.GamePassLead{*l}
	if err := r.attachGamedays(ctx, leads); err != nil {
		return nil, err
	}
	return &leads[0], nil
}

func (r *PostgresGamePassLeadRepository) UpdateStatus(ctx context.Context, id string, status domain.GamePassLeadStatus) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, `UPDATE game_pass_leads SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		return fmt.Errorf("failed to update game pass lead: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

// attachGamedays loads the event days behind every lead's gameday_ids in one
// query. A gameday deleted since the lead was taken is simply left out.
func (r *PostgresGamePassLeadRepository) attachGamedays(ctx context.Context, leads []domain.GamePassLead) error {
	seen := map[string]bool{}
	ids := []string{}
	for _, l := range leads {
		for _, id := range l.GamedayIDs {
			if !seen[id] {
				seen[id] = true
				ids = append(ids, id)
			}
		}
	}
	if len(ids) == 0 {
		return nil
	}

	rows, err := r.db.Query(ctx,
		`SELECT id::text, title, date FROM event_days WHERE id = ANY($1::text[]::uuid[])`, ids)
	if err != nil {
		return fmt.Errorf("failed to load lead gamedays: %w", err)
	}
	defer rows.Close()

	days := map[string]domain.EventDay{}
	for rows.Next() {
		var ed domain.EventDay
		if err := rows.Scan(&ed.ID, &ed.Title, &ed.Date); err != nil {
			return err
		}
		days[ed.ID] = ed
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i := range leads {
		for _, id := range leads[i].GamedayIDs {
			if ed, ok := days[id]; ok {
				leads[i].Gamedays = append(leads[i].Gamedays, ed)
			}
		}
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Game Pass Orders
// ═══════════════════════════════════════════════════════════════════════════════

// ErrTicketCodeTaken means a generated ticket code collided with an existing
// one. Nothing was written; the caller retries with fresh codes.
var ErrTicketCodeTaken = errors.New("ticket code already taken")

type GamePassOrderRepository interface {
	// Create reserves capacity and writes the order, its gamedays and one
	// PENDING ticket per holder per gameday in one transaction. codes holds a
	// ticket code per ticket, gameday by gameday in line order.
	Create(ctx context.Context, o *domain.GamePassOrder, lines []domain.GamePassOrderLine, codes []string) error
	SetAccessCode(ctx context.Context, id, accessCode string) error
	GetByID(ctx context.Context, id string) (*domain.GamePassOrder, error)
	GetByReference(ctx context.Context, reference string) (*domain.GamePassOrder, error)
	List(ctx context.Context, status, email string, page, limit int) ([]domain.GamePassOrder, int, error)
	// MarkPaid moves the order and its tickets to paid and counts the seats
	// sold. It reports false when the order was already paid, so a repeated
	// webhook changes nothing.
	MarkPaid(ctx context.Context, id string) (bool, error)
	// MarkFailed fails a still-pending order and its pending tickets.
	MarkFailed(ctx context.Context, id string) error
}

type PostgresGamePassOrderRepository struct {
	db *pgxpool.Pool
}

func NewGamePassOrderRepository(db *pgxpool.Pool) GamePassOrderRepository {
	return &PostgresGamePassOrderRepository{db: db}
}

const orderColumns = `id, name, email, phone, user_id::text, season_tier_id::text, tier_name,
	unit_price, gameday_count, holders, standard_total, discount_percent, discount_amount, total,
	payment_status, paystack_reference, paystack_access_code, paid_at, created_at, updated_at`

func scanOrder(row pgx.Row) (*domain.GamePassOrder, error) {
	var o domain.GamePassOrder
	err := row.Scan(&o.ID, &o.Name, &o.Email, &o.Phone, &o.UserID, &o.SeasonTierID, &o.TierName,
		&o.Price.UnitPrice, &o.Price.Gamedays, &o.Price.Holders, &o.Price.StandardTotal,
		&o.Price.DiscountPercent, &o.Price.DiscountAmount, &o.Price.Total,
		&o.PaymentStatus, &o.PaystackReference, &o.PaystackAccessCode, &o.PaidAt, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *PostgresGamePassOrderRepository) Create(ctx context.Context, o *domain.GamePassOrder, lines []domain.GamePassOrderLine, codes []string) error {
	holders := o.Price.Holders
	if len(codes) != len(lines)*holders {
		return fmt.Errorf("expected %d ticket codes, got %d", len(lines)*holders, len(codes))
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Lock every tier in the bundle, in ID order so two overlapping checkouts
	// can't deadlock. Single ticket purchases lock the same rows, so the two
	// flows serialize on the last seats.
	tierIDs := make([]string, 0, len(lines))
	for _, l := range lines {
		tierIDs = append(tierIDs, l.TicketTierID)
	}
	rows, err := tx.Query(ctx, `
		SELECT tt.id::text, tt.capacity, tt.name, COALESCE(ed.title, '')
		FROM ticket_tiers tt LEFT JOIN event_days ed ON ed.id = tt.event_day_id
		WHERE tt.id = ANY($1::text[]::uuid[])
		ORDER BY tt.id
		FOR UPDATE OF tt`, tierIDs)
	if err != nil {
		return fmt.Errorf("failed to lock tiers: %w", err)
	}
	type tierInfo struct {
		capacity       int
		name, dayTitle string
	}
	tiers := map[string]tierInfo{}
	for rows.Next() {
		var id string
		var t tierInfo
		if err := rows.Scan(&id, &t.capacity, &t.name, &t.dayTitle); err != nil {
			rows.Close()
			return err
		}
		tiers[id] = t
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	// Same rule as a single purchase: paid and used seats, plus pending ones
	// still inside the reservation window, count against capacity.
	for _, id := range tierIDs {
		t, ok := tiers[id]
		if !ok {
			return appErrors.InvalidGamePassConfig("a ticket tier in this Game Pass no longer exists")
		}
		if t.capacity == 0 {
			continue
		}
		var reserved int
		if err := tx.QueryRow(ctx,
			`SELECT COALESCE(SUM(quantity), 0) FROM tickets
			 WHERE tier_id = $1
			   AND (status IN ('PAID', 'USED')
			        OR (status = 'PENDING' AND created_at > NOW() - INTERVAL '`+pendingReservationTTL+`'))`,
			id,
		).Scan(&reserved); err != nil {
			return err
		}
		if reserved+holders > t.capacity {
			left := t.capacity - reserved
			if left < 0 {
				left = 0
			}
			return appErrors.InvalidGamePassConfig("%s has only %d %s place(s) left", t.dayTitle, left, t.name)
		}
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO game_pass_orders (name, email, phone, user_id, season_tier_id, tier_name,
			unit_price, gameday_count, holders, standard_total, discount_percent, discount_amount, total,
			payment_status, paystack_reference)
		VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, created_at, updated_at`,
		o.Name, o.Email, o.Phone, o.UserID, o.SeasonTierID, o.TierName,
		o.Price.UnitPrice, o.Price.Gamedays, o.Price.Holders, o.Price.StandardTotal,
		o.Price.DiscountPercent, o.Price.DiscountAmount, o.Price.Total,
		domain.GamePassOrderPending, o.PaystackReference,
	).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create game pass order: %w", err)
	}
	o.PaymentStatus = domain.GamePassOrderPending

	shares := domain.SplitGamePassTotal(o.Price.Total, len(codes))
	k := 0
	for _, l := range lines {
		if _, err := tx.Exec(ctx,
			`INSERT INTO game_pass_order_gamedays (order_id, event_day_id) VALUES ($1, $2)`,
			o.ID, l.EventDayID); err != nil {
			return fmt.Errorf("failed to link gameday: %w", err)
		}
		for h := 0; h < holders; h++ {
			_, err := tx.Exec(ctx, `
				INSERT INTO tickets (event_day_id, tier_id, email, phone, name, user_id, quantity, unit_price,
					total_amount, status, ticket_code, game_pass_order_id,
					event_title, event_date, event_venue, tier_name)
				VALUES ($1, $2, $3, $4, $5, $6::uuid, 1, $7, $8, 'PENDING', $9, $10,
					COALESCE((SELECT title FROM event_days WHERE id = $1), ''),
					(SELECT date FROM event_days WHERE id = $1),
					COALESCE((SELECT venue FROM event_days WHERE id = $1), ''),
					COALESCE((SELECT name FROM ticket_tiers WHERE id = $2), ''))`,
				l.EventDayID, l.TicketTierID, o.Email, o.Phone, o.Name, o.UserID,
				o.Price.UnitPrice, shares[k], codes[k], o.ID)
			if err != nil {
				if isUniqueViolation(err) {
					return ErrTicketCodeTaken
				}
				return fmt.Errorf("failed to issue game pass ticket: %w", err)
			}
			k++
		}
	}

	return tx.Commit(ctx)
}

func (r *PostgresGamePassOrderRepository) SetAccessCode(ctx context.Context, id, accessCode string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	_, err := r.db.Exec(ctx, `UPDATE game_pass_orders SET paystack_access_code = $1, updated_at = NOW() WHERE id = $2`, accessCode, id)
	return err
}

func (r *PostgresGamePassOrderRepository) GetByID(ctx context.Context, id string) (*domain.GamePassOrder, error) {
	return r.getOne(ctx, "id = $1", id)
}

func (r *PostgresGamePassOrderRepository) GetByReference(ctx context.Context, reference string) (*domain.GamePassOrder, error) {
	return r.getOne(ctx, "paystack_reference = $1", reference)
}

// getOne loads an order with its gamedays and tickets.
func (r *PostgresGamePassOrderRepository) getOne(ctx context.Context, where string, arg string) (*domain.GamePassOrder, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	o, err := scanOrder(r.db.QueryRow(ctx, `SELECT `+orderColumns+` FROM game_pass_orders WHERE `+where, arg))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get game pass order: %w", err)
	}

	dayRows, err := r.db.Query(ctx, `
		SELECT ed.id::text, ed.title, ed.date, ed.venue, ed.is_active
		FROM game_pass_order_gamedays g JOIN event_days ed ON ed.id = g.event_day_id
		WHERE g.order_id = $1
		ORDER BY ed.date`, o.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load order gamedays: %w", err)
	}
	for dayRows.Next() {
		var ed domain.EventDay
		if err := dayRows.Scan(&ed.ID, &ed.Title, &ed.Date, &ed.Venue, &ed.IsActive); err != nil {
			dayRows.Close()
			return nil, err
		}
		o.Gamedays = append(o.Gamedays, ed)
	}
	dayRows.Close()
	if err := dayRows.Err(); err != nil {
		return nil, err
	}

	// Snapshot columns, so a ticket still reads right if its gameday or tier
	// has since been deleted.
	ticketRows, err := r.db.Query(ctx, `
		SELECT id::text, COALESCE(event_day_id::text, ''), COALESCE(tier_id::text, ''), email,
			quantity, unit_price, total_amount, status, ticket_code, checked_in_at, checked_in_by,
			event_title, event_date, event_venue, tier_name, created_at, updated_at
		FROM tickets
		WHERE game_pass_order_id = $1
		ORDER BY event_date NULLS LAST, ticket_code`, o.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load order tickets: %w", err)
	}
	defer ticketRows.Close()
	for ticketRows.Next() {
		var t domain.Ticket
		var title, venue, tierName string
		var date *time.Time
		if err := ticketRows.Scan(&t.ID, &t.EventDayID, &t.TierID, &t.Email,
			&t.Quantity, &t.UnitPrice, &t.TotalAmount, &t.Status, &t.TicketCode, &t.CheckedInAt, &t.CheckedInBy,
			&title, &date, &venue, &tierName, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.EventDay = &domain.EventDay{ID: t.EventDayID, Title: title, Venue: venue}
		if date != nil {
			t.EventDay.Date = *date
		}
		t.Tier = &domain.TicketTier{ID: t.TierID, Name: tierName}
		o.Tickets = append(o.Tickets, t)
	}
	return o, ticketRows.Err()
}

func (r *PostgresGamePassOrderRepository) List(ctx context.Context, status, email string, page, limit int) ([]domain.GamePassOrder, int, error) {
	page, limit, offset := paging(page, limit, 50)

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	where := ` WHERE ($1 = '' OR payment_status = $1) AND ($2 = '' OR LOWER(email) LIKE '%' || LOWER($2) || '%')`

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM game_pass_orders`+where, status, email).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count game pass orders: %w", err)
	}

	rows, err := r.db.Query(ctx,
		`SELECT `+orderColumns+` FROM game_pass_orders`+where+` ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		status, email, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list game pass orders: %w", err)
	}
	defer rows.Close()

	orders := []domain.GamePassOrder{}
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			return nil, 0, err
		}
		orders = append(orders, *o)
	}
	return orders, total, rows.Err()
}

func (r *PostgresGamePassOrderRepository) MarkPaid(ctx context.Context, id string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	// The status guard is the idempotency key: of two webhooks racing on the
	// same order, only one sees a row come back. A failed order can still turn
	// paid — Paystack's later charge.success outranks an early failed verify.
	tag, err := tx.Exec(ctx, `
		UPDATE game_pass_orders SET payment_status = 'paid', paid_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND payment_status <> 'paid'`, id)
	if err != nil {
		return false, fmt.Errorf("failed to mark game pass order paid: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}

	// Pay the tickets, then add exactly those to their tiers' sold counts,
	// capacity guarded the same way a single purchase is.
	if _, err := tx.Exec(ctx, `
		WITH paid AS (
			UPDATE tickets SET status = 'PAID', updated_at = NOW()
			WHERE game_pass_order_id = $1 AND status IN ('PENDING', 'FAILED')
			RETURNING tier_id
		)
		UPDATE ticket_tiers t SET sold_count = t.sold_count + c.n, updated_at = NOW()
		FROM (SELECT tier_id, COUNT(*)::int AS n FROM paid WHERE tier_id IS NOT NULL GROUP BY tier_id) c
		WHERE t.id = c.tier_id AND (t.capacity = 0 OR t.sold_count + c.n <= t.capacity)`, id); err != nil {
		return false, fmt.Errorf("failed to issue game pass tickets: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (r *PostgresGamePassOrderRepository) MarkFailed(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE game_pass_orders SET payment_status = 'failed', updated_at = NOW()
		WHERE id = $1 AND payment_status = 'pending'`, id)
	if err != nil {
		return fmt.Errorf("failed to mark game pass order failed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		UPDATE tickets SET status = 'FAILED', updated_at = NOW()
		WHERE game_pass_order_id = $1 AND status = 'PENDING'`, id); err != nil {
		return fmt.Errorf("failed to fail game pass tickets: %w", err)
	}
	return tx.Commit(ctx)
}
