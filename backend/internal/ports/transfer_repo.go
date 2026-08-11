package ports

import (
	"context"
	"strconv"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ITransferRepository interface {
	CreateTransfer(ctx context.Context, t *domain.Transfer) error
	GetTransferByID(ctx context.Context, id string) (*domain.Transfer, error)
	GetTransfersByTeamID(ctx context.Context, teamID string, transferType string, status string, page, limit int) ([]domain.Transfer, int64, error)
	UpdateTransferStatus(ctx context.Context, id string, status string, notes string, reviewNotes string, completedAt *time.Time) error
	SetTeamApproval(ctx context.Context, id string, fromApproved, toApproved bool) error
	GetActiveListings(ctx context.Context, search string, page, limit int) ([]domain.Transfer, int64, error)
	CreateBid(ctx context.Context, b *domain.TransferBid) error
	GetBidsByTransferID(ctx context.Context, transferID string) ([]domain.TransferBid, error)
	GetBidByID(ctx context.Context, bidID string) (*domain.TransferBid, error)
	UpdateBidStatus(ctx context.Context, bidID string, status string) error
	GetTeamBudget(ctx context.Context, teamID string) (*domain.TeamBudget, error)
	UpdateTeamBudget(ctx context.Context, teamID string, newSpent int64) error
	InitTeamBudget(ctx context.Context, teamID string, totalBudget int64) error
	GetAllTeamBudgets(ctx context.Context) ([]domain.TeamBudget, error)
}

type PostgresTransferRepository struct {
	db *pgxpool.Pool
}

func NewTransferRepository(db *pgxpool.Pool) ITransferRepository {
	return &PostgresTransferRepository{db: db}
}

func (r *PostgresTransferRepository) CreateTransfer(ctx context.Context, t *domain.Transfer) error {
	query := `
		INSERT INTO transfers (
			type, status, player_id, from_team_id, to_team_id, initiated_by,
			asking_price, notes, from_team_approved, to_team_approved
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		t.Type, t.Status, t.PlayerID, t.FromTeamID, t.ToTeamID, t.InitiatedBy,
		t.AskingPrice, t.Notes, t.FromTeamApproved, t.ToTeamApproved,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *PostgresTransferRepository) GetTransferByID(ctx context.Context, id string) (*domain.Transfer, error) {
	query := `
		SELECT
			tr.id, tr.type, tr.status, tr.player_id, tr.from_team_id,
			COALESCE(tr.to_team_id::text, ''), COALESCE(tr.initiated_by::text, ''),
			tr.asking_price, COALESCE(tr.notes, ''), COALESCE(tr.review_notes, ''),
			tr.completed_at, tr.from_team_approved, tr.to_team_approved,
			tr.created_at, tr.updated_at,
			p.name, COALESCE(p.position, ''), COALESCE(p.jersey_number, 0), COALESCE(p.image, ''),
			ft.name, COALESCE(ft.short_name, ''), COALESCE(ft.logo, ''),
			COALESCE(tt.name, ''), COALESCE(tt.short_name, ''), COALESCE(tt.logo, '')
		FROM transfers tr
		JOIN players p ON tr.player_id = p.id
		JOIN teams ft ON tr.from_team_id = ft.id
		LEFT JOIN teams tt ON tr.to_team_id = tt.id
		WHERE tr.id = $1
	`
	var t domain.Transfer
	t.Player = &domain.Player{}
	t.FromTeam = &domain.Team{}
	t.ToTeam = &domain.Team{}
	var toTeamID string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.Type, &t.Status, &t.PlayerID, &t.FromTeamID,
		&toTeamID, &t.InitiatedBy, &t.AskingPrice, &t.Notes, &t.ReviewNotes,
		&t.CompletedAt, &t.FromTeamApproved, &t.ToTeamApproved,
		&t.CreatedAt, &t.UpdatedAt,
		&t.Player.Name, &t.Player.Position, &t.Player.JerseyNumber, &t.Player.Image,
		&t.FromTeam.Name, &t.FromTeam.ShortName, &t.FromTeam.Logo,
		&t.ToTeam.Name, &t.ToTeam.ShortName, &t.ToTeam.Logo,
	)
	if err != nil {
		return nil, err
	}
	t.Player.ID = t.PlayerID
	t.FromTeam.ID = t.FromTeamID
	if toTeamID != "" {
		t.ToTeamID = &toTeamID
		t.ToTeam.ID = toTeamID
	} else {
		t.ToTeam = nil
	}
	return &t, nil
}

func (r *PostgresTransferRepository) GetTransfersByTeamID(ctx context.Context, teamID string, transferType string, status string, page, limit int) ([]domain.Transfer, int64, error) {
	whereClause := ` WHERE (tr.from_team_id = $1 OR tr.to_team_id = $1)`
	args := []any{teamID}
	argCount := 2

	if transferType != "" {
		whereClause += ` AND tr.type = $` + strconv.Itoa(argCount)
		args = append(args, transferType)
		argCount++
	}

	if status != "" {
		whereClause += ` AND tr.status = $` + strconv.Itoa(argCount)
		args = append(args, status)
		argCount++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM transfers tr`+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			tr.id, tr.type, tr.status, tr.player_id, tr.from_team_id,
			COALESCE(tr.to_team_id::text, ''), COALESCE(tr.initiated_by::text, ''),
			tr.asking_price, COALESCE(tr.notes, ''), COALESCE(tr.review_notes, ''),
			tr.completed_at, tr.from_team_approved, tr.to_team_approved,
			tr.created_at, tr.updated_at,
			p.name, COALESCE(p.position, ''), COALESCE(p.jersey_number, 0), COALESCE(p.image, ''),
			ft.name, COALESCE(ft.short_name, ''), COALESCE(ft.logo, ''),
			COALESCE(tt.name, ''), COALESCE(tt.short_name, ''), COALESCE(tt.logo, '')
		FROM transfers tr
		JOIN players p ON tr.player_id = p.id
		JOIN teams ft ON tr.from_team_id = ft.id
		LEFT JOIN teams tt ON tr.to_team_id = tt.id` + whereClause +
		` ORDER BY tr.created_at DESC`

	if limit > 0 {
		offset := (page - 1) * limit
		if offset < 0 {
			offset = 0
		}
		query += ` LIMIT $` + strconv.Itoa(argCount) + ` OFFSET $` + strconv.Itoa(argCount+1)
		args = append(args, limit, offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var transfers []domain.Transfer
	for rows.Next() {
		var t domain.Transfer
		t.Player = &domain.Player{}
		t.FromTeam = &domain.Team{}
		t.ToTeam = &domain.Team{}
		var toTeamID string
		err := rows.Scan(
			&t.ID, &t.Type, &t.Status, &t.PlayerID, &t.FromTeamID,
			&toTeamID, &t.InitiatedBy, &t.AskingPrice, &t.Notes, &t.ReviewNotes,
			&t.CompletedAt, &t.FromTeamApproved, &t.ToTeamApproved,
			&t.CreatedAt, &t.UpdatedAt,
			&t.Player.Name, &t.Player.Position, &t.Player.JerseyNumber, &t.Player.Image,
			&t.FromTeam.Name, &t.FromTeam.ShortName, &t.FromTeam.Logo,
			&t.ToTeam.Name, &t.ToTeam.ShortName, &t.ToTeam.Logo,
		)
		if err != nil {
			return nil, 0, err
		}
		t.Player.ID = t.PlayerID
		t.FromTeam.ID = t.FromTeamID
		if toTeamID != "" {
			t.ToTeamID = &toTeamID
			t.ToTeam.ID = toTeamID
		} else {
			t.ToTeam = nil
		}
		transfers = append(transfers, t)
	}
	return transfers, total, nil
}

func (r *PostgresTransferRepository) UpdateTransferStatus(ctx context.Context, id string, status string, notes string, reviewNotes string, completedAt *time.Time) error {
	query := `
		UPDATE transfers SET
			status = $1,
			notes = CASE WHEN $2 <> '' THEN $2 ELSE notes END,
			review_notes = CASE WHEN $3 <> '' THEN $3 ELSE review_notes END,
			completed_at = COALESCE($4, completed_at),
			updated_at = NOW()
		WHERE id = $5
	`
	_, err := r.db.Exec(ctx, query, status, notes, reviewNotes, completedAt, id)
	return err
}

func (r *PostgresTransferRepository) SetTeamApproval(ctx context.Context, id string, fromApproved, toApproved bool) error {
	query := `
		UPDATE transfers SET
			from_team_approved = $1,
			to_team_approved = $2,
			updated_at = NOW()
		WHERE id = $3
	`
	_, err := r.db.Exec(ctx, query, fromApproved, toApproved, id)
	return err
}

func (r *PostgresTransferRepository) GetActiveListings(ctx context.Context, search string, page, limit int) ([]domain.Transfer, int64, error) {
	whereClause := ` WHERE tr.type = 'LISTING' AND tr.status = 'PENDING'`
	args := []any{}
	argCount := 1

	if search != "" {
		whereClause += ` AND (p.name ILIKE $` + strconv.Itoa(argCount) + ` OR p.position ILIKE $` + strconv.Itoa(argCount) + `)`
		args = append(args, "%"+search+"%")
		argCount++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM transfers tr JOIN players p ON tr.player_id = p.id`+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			tr.id, tr.type, tr.status, tr.player_id, tr.from_team_id,
			COALESCE(tr.to_team_id::text, ''), COALESCE(tr.initiated_by::text, ''),
			tr.asking_price, COALESCE(tr.notes, ''), COALESCE(tr.review_notes, ''),
			tr.completed_at, tr.from_team_approved, tr.to_team_approved,
			tr.created_at, tr.updated_at,
			p.name, COALESCE(p.position, ''), COALESCE(p.jersey_number, 0), COALESCE(p.image, ''),
			ft.name, COALESCE(ft.short_name, ''), COALESCE(ft.logo, '')
		FROM transfers tr
		JOIN players p ON tr.player_id = p.id
		JOIN teams ft ON tr.from_team_id = ft.id` + whereClause +
		` ORDER BY tr.created_at DESC`

	if limit > 0 {
		offset := (page - 1) * limit
		if offset < 0 {
			offset = 0
		}
		query += ` LIMIT $` + strconv.Itoa(argCount) + ` OFFSET $` + strconv.Itoa(argCount+1)
		args = append(args, limit, offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var transfers []domain.Transfer
	for rows.Next() {
		var t domain.Transfer
		t.Player = &domain.Player{}
		t.FromTeam = &domain.Team{}
		var toTeamID string
		err := rows.Scan(
			&t.ID, &t.Type, &t.Status, &t.PlayerID, &t.FromTeamID,
			&toTeamID, &t.InitiatedBy, &t.AskingPrice, &t.Notes, &t.ReviewNotes,
			&t.CompletedAt, &t.FromTeamApproved, &t.ToTeamApproved,
			&t.CreatedAt, &t.UpdatedAt,
			&t.Player.Name, &t.Player.Position, &t.Player.JerseyNumber, &t.Player.Image,
			&t.FromTeam.Name, &t.FromTeam.ShortName, &t.FromTeam.Logo,
		)
		if err != nil {
			return nil, 0, err
		}
		t.Player.ID = t.PlayerID
		t.FromTeam.ID = t.FromTeamID
		transfers = append(transfers, t)
	}
	return transfers, total, nil
}

func (r *PostgresTransferRepository) CreateBid(ctx context.Context, b *domain.TransferBid) error {
	query := `
		INSERT INTO transfer_bids (transfer_id, bidder_team_id, bid_value, status, bidder_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	return r.db.QueryRow(ctx, query,
		b.TransferID, b.BidderTeamID, b.BidValue, b.Status, b.BidderID,
	).Scan(&b.ID, &b.CreatedAt)
}

func (r *PostgresTransferRepository) GetBidsByTransferID(ctx context.Context, transferID string) ([]domain.TransferBid, error) {
	query := `
		SELECT
			tb.id, tb.transfer_id, tb.bidder_team_id, tb.bid_value, tb.status,
			COALESCE(tb.bidder_id::text, ''), tb.created_at,
			t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM transfer_bids tb
		JOIN teams t ON tb.bidder_team_id = t.id
		WHERE tb.transfer_id = $1
		ORDER BY tb.bid_value DESC
	`
	rows, err := r.db.Query(ctx, query, transferID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bids []domain.TransferBid
	for rows.Next() {
		var b domain.TransferBid
		b.BidderTeam = &domain.Team{}
		err := rows.Scan(
			&b.ID, &b.TransferID, &b.BidderTeamID, &b.BidValue, &b.Status,
			&b.BidderID, &b.CreatedAt,
			&b.BidderTeam.Name, &b.BidderTeam.ShortName, &b.BidderTeam.Logo,
		)
		if err != nil {
			return nil, err
		}
		b.BidderTeam.ID = b.BidderTeamID
		bids = append(bids, b)
	}
	return bids, nil
}

func (r *PostgresTransferRepository) GetBidByID(ctx context.Context, bidID string) (*domain.TransferBid, error) {
	query := `
		SELECT
			tb.id, tb.transfer_id, tb.bidder_team_id, tb.bid_value, tb.status,
			COALESCE(tb.bidder_id::text, ''), tb.created_at
		FROM transfer_bids tb
		WHERE tb.id = $1
	`
	var b domain.TransferBid
	err := r.db.QueryRow(ctx, query, bidID).Scan(
		&b.ID, &b.TransferID, &b.BidderTeamID, &b.BidValue, &b.Status,
		&b.BidderID, &b.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *PostgresTransferRepository) UpdateBidStatus(ctx context.Context, bidID string, status string) error {
	query := `UPDATE transfer_bids SET status = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, bidID)
	return err
}

func (r *PostgresTransferRepository) GetTeamBudget(ctx context.Context, teamID string) (*domain.TeamBudget, error) {
	query := `
		SELECT
			tb.id, tb.team_id, tb.total_budget, tb.spent,
			(tb.total_budget - tb.spent) AS remaining,
			tb.created_at, tb.updated_at,
			t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM team_budgets tb
		JOIN teams t ON tb.team_id = t.id
		WHERE tb.team_id = $1
	`
	var b domain.TeamBudget
	b.Team = &domain.Team{}
	err := r.db.QueryRow(ctx, query, teamID).Scan(
		&b.ID, &b.TeamID, &b.TotalBudget, &b.Spent, &b.Remaining,
		&b.CreatedAt, &b.UpdatedAt,
		&b.Team.Name, &b.Team.ShortName, &b.Team.Logo,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Auto-init 15M budget if missing
			if initErr := r.InitTeamBudget(ctx, teamID, 15000000); initErr != nil {
				return nil, initErr
			}
			return r.GetTeamBudget(ctx, teamID)
		}
		return nil, err
	}
	b.Team.ID = b.TeamID
	return &b, nil
}

func (r *PostgresTransferRepository) UpdateTeamBudget(ctx context.Context, teamID string, newSpent int64) error {
	query := `
		UPDATE team_budgets SET spent = $1, updated_at = NOW() WHERE team_id = $2
	`
	_, err := r.db.Exec(ctx, query, newSpent, teamID)
	return err
}

func (r *PostgresTransferRepository) InitTeamBudget(ctx context.Context, teamID string, totalBudget int64) error {
	query := `
		INSERT INTO team_budgets (team_id, total_budget, spent)
		VALUES ($1, $2, 0)
		ON CONFLICT (team_id) DO UPDATE SET total_budget = EXCLUDED.total_budget, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, teamID, totalBudget)
	return err
}

func (r *PostgresTransferRepository) GetAllTeamBudgets(ctx context.Context) ([]domain.TeamBudget, error) {
	query := `
		SELECT
			tb.id, tb.team_id, tb.total_budget, tb.spent,
			(tb.total_budget - tb.spent) AS remaining,
			tb.created_at, tb.updated_at,
			t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM team_budgets tb
		JOIN teams t ON tb.team_id = t.id
		ORDER BY t.name ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var budgets []domain.TeamBudget
	for rows.Next() {
		var b domain.TeamBudget
		b.Team = &domain.Team{}
		err := rows.Scan(
			&b.ID, &b.TeamID, &b.TotalBudget, &b.Spent, &b.Remaining,
			&b.CreatedAt, &b.UpdatedAt,
			&b.Team.Name, &b.Team.ShortName, &b.Team.Logo,
		)
		if err != nil {
			return nil, err
		}
		b.Team.ID = b.TeamID
		budgets = append(budgets, b)
	}
	return budgets, nil
}
