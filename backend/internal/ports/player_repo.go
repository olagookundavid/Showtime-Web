package ports

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PlayerRepository interface {
	GetPlayers(ctx context.Context, teamID string, search string, page, limit int) ([]domain.Player, int64, error)
	GetPlayerByID(ctx context.Context, id string) (*domain.Player, error)
	CreatePlayer(ctx context.Context, player *domain.Player) error
	UpdatePlayer(ctx context.Context, player *domain.Player) error
	DeletePlayer(ctx context.Context, id string) error
	AssignRandomJerseyNumbers(ctx context.Context, teamID string) (int, error)
	GetPlayerByUserID(ctx context.Context, userID string) (*domain.Player, error)
	UpdatePlayerUserID(ctx context.Context, playerID string, userID *string) error
	HasPlayerWithEmail(ctx context.Context, email string) (bool, error)
}

type PostgresPlayerRepository struct {
	db *pgxpool.Pool
}

func NewPlayerRepository(db *pgxpool.Pool) *PostgresPlayerRepository {
	return &PostgresPlayerRepository{db: db}
}

func (r *PostgresPlayerRepository) GetPlayers(ctx context.Context, teamID string, search string, page, limit int) ([]domain.Player, int64, error) {
	whereClause := ` WHERE 1=1`
	args := []any{}
	argCount := 1

	if teamID != "" {
		whereClause += ` AND p.team_id = $` + strconv.Itoa(argCount)
		args = append(args, teamID)
		argCount++
	}

	if search != "" {
		whereClause += ` AND (p.name ILIKE $` + strconv.Itoa(argCount) + ` OR p.position ILIKE $` + strconv.Itoa(argCount) + `)`
		args = append(args, "%"+search+"%")
		argCount++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM players p`+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			p.id, p.name,
			COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
			COALESCE(p.team_id::text, ''),
			COALESCE(p.bio, ''), COALESCE(p.image, ''), p.email,
			p.created_at, p.updated_at,
			COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id` + whereClause +
		` ORDER BY p.jersey_number ASC`

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

	var players []domain.Player
	for rows.Next() {
		var p domain.Player
		p.Team = &domain.Team{}
		err := rows.Scan(
			&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio, &p.Image, &p.Email,
			&p.CreatedAt, &p.UpdatedAt,
			&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
		)
		if err != nil {
			return nil, 0, err
		}
		p.Team.ID = p.TeamID
		players = append(players, p)
	}
	return players, total, nil
}

func (r *PostgresPlayerRepository) GetPlayerByID(ctx context.Context, id string) (*domain.Player, error) {
	query := `
		SELECT
			p.id, p.name,
			COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
			COALESCE(p.team_id::text, ''),
			COALESCE(p.bio, ''), COALESCE(p.image, ''), p.email,
			p.user_id, p.created_at, p.updated_at,
			COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE p.id = $1
	`
	var p domain.Player
	p.Team = &domain.Team{}
	var uid *string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio, &p.Image, &p.Email,
		&uid, &p.CreatedAt, &p.UpdatedAt,
		&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
	)
	if err != nil {
		return nil, err
	}
	p.UserID = uid
	p.Team.ID = p.TeamID

	// There used to be a fallback here that linked players.user_id to any users row
	// sharing the player's email whenever this ran. It was removed because it granted
	// account ownership with nobody approving it — the same bypass closed in
	// CreatePlayer and AuthService.Register — and it did so as a write on a read path,
	// so merely viewing a player was enough to trigger it. That is how a player ended up
	// linked to an account whose role was never changed. players.user_id is now set only
	// by ClaimService.ApproveClaim.

	return &p, nil
}

func (r *PostgresPlayerRepository) CreatePlayer(ctx context.Context, player *domain.Player) error {
	if player.JerseyNumber > 0 {
		var existingCount int
		err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM players WHERE COALESCE(team_id::text, '') = $1 AND jersey_number = $2`, player.TeamID, player.JerseyNumber).Scan(&existingCount)
		if err == nil && existingCount > 0 {
			return fmt.Errorf("jersey number %d already exists for this team", player.JerseyNumber)
		}
	}

	query := `
		INSERT INTO players (name, jersey_number, position, team_id, bio, image, email, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		player.Name, player.JerseyNumber, player.Position, player.TeamID, player.Bio, player.Image, player.Email, player.UserID,
	).Scan(&player.ID, &player.CreatedAt, &player.UpdatedAt)
}

func (r *PostgresPlayerRepository) UpdatePlayer(ctx context.Context, player *domain.Player) error {
	// Only police jersey numbers when the number is actually changing.
	//
	// The edit form resends the player's existing number on every save, and nothing has
	// ever enforced uniqueness at the database level, so the historical import left
	// teams with duplicate numbers. Checking unconditionally meant both players in any
	// such pair were permanently uneditable — a manager could not fix a photo, position
	// or bio without first resolving a clash they may not even have known about.
	// Assigning a number someone else already holds is still refused.
	if player.JerseyNumber > 0 {
		var currentJersey int
		if err := r.db.QueryRow(ctx,
			`SELECT COALESCE(jersey_number, 0) FROM players WHERE id = $1`, player.ID).Scan(&currentJersey); err != nil {
			return err
		}

		if currentJersey != player.JerseyNumber {
			var existingCount int
			err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM players WHERE LOWER(COALESCE(team_id::text, '')) = LOWER($1) AND jersey_number = $2 AND id != $3`, player.TeamID, player.JerseyNumber, player.ID).Scan(&existingCount)
			if err == nil && existingCount > 0 {
				return fmt.Errorf("jersey number %d already exists for this team", player.JerseyNumber)
			}
		}
	}

	// team_id is NULLIF'd because domain.Player.TeamID is a plain string: releasing a
	// player is expressed as "", and passing that straight into a UUID column made
	// Postgres reject the whole UPDATE ("invalid input syntax for type uuid"). Every
	// contract expiry silently failed to release its player because of it.
	query := `
		UPDATE players SET
			name=$1, jersey_number=$2, position=$3, team_id=NULLIF($4::text, '')::uuid, bio=$5, image=$6, email=$7, user_id=COALESCE($8, user_id),
			updated_at=NOW()
		WHERE id=$9
	`
	_, err := r.db.Exec(ctx, query,
		player.Name, player.JerseyNumber, player.Position, player.TeamID, player.Bio, player.Image, player.Email, player.UserID,
		player.ID,
	)
	return err
}

func (r *PostgresPlayerRepository) DeletePlayer(ctx context.Context, id string) error {
	query := `DELETE FROM players WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresPlayerRepository) AssignRandomJerseyNumbers(ctx context.Context, teamID string) (int, error) {
	var teamIDs []string
	if teamID != "" {
		teamIDs = []string{teamID}
	} else {
		rows, err := r.db.Query(ctx, `SELECT DISTINCT team_id FROM players WHERE team_id IS NOT NULL AND COALESCE(jersey_number, 0) = 0`)
		if err != nil {
			return 0, err
		}
		defer rows.Close()
		for rows.Next() {
			var tid string
			if err := rows.Scan(&tid); err == nil {
				teamIDs = append(teamIDs, tid)
			}
		}
		if err := rows.Err(); err != nil {
			return 0, err
		}
	}

	totalAssigned := 0
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for _, tid := range teamIDs {
		rows, err := r.db.Query(ctx, `SELECT jersey_number FROM players WHERE team_id = $1 AND COALESCE(jersey_number, 0) > 0`, tid)
		if err != nil {
			continue
		}
		used := make(map[int]bool)
		for rows.Next() {
			var num int
			if err := rows.Scan(&num); err == nil {
				used[num] = true
			}
		}
		rows.Close()

		pRows, err := r.db.Query(ctx, `SELECT id FROM players WHERE team_id = $1 AND COALESCE(jersey_number, 0) = 0 ORDER BY name ASC`, tid)
		if err != nil {
			continue
		}
		var unassignedIDs []string
		for pRows.Next() {
			var pid string
			if err := pRows.Scan(&pid); err == nil {
				unassignedIDs = append(unassignedIDs, pid)
			}
		}
		pRows.Close()

		var pool []int
		for n := 1; n <= 99; n++ {
			if !used[n] {
				pool = append(pool, n)
			}
		}

		rng.Shuffle(len(pool), func(i, j int) {
			pool[i], pool[j] = pool[j], pool[i]
		})

		for i, pid := range unassignedIDs {
			if i >= len(pool) {
				break
			}
			assignedNum := pool[i]
			_, err := r.db.Exec(ctx, `UPDATE players SET jersey_number = $1, updated_at = NOW() WHERE id = $2`, assignedNum, pid)
			if err == nil {
				totalAssigned++
			}
		}
	}

	return totalAssigned, nil
}

func (r *PostgresPlayerRepository) GetPlayerByUserID(ctx context.Context, userID string) (*domain.Player, error) {
	query := `
		SELECT
			p.id, p.name,
			COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
			COALESCE(p.team_id::text, ''),
			COALESCE(p.bio, ''), COALESCE(p.image, ''), p.email,
			p.user_id, p.created_at, p.updated_at,
			COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE p.user_id = $1
	`
	var p domain.Player
	p.Team = &domain.Team{}
	var uid *string
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio, &p.Image, &p.Email,
		&uid, &p.CreatedAt, &p.UpdatedAt,
		&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
	)
	if err == nil {
		p.UserID = uid
		p.Team.ID = p.TeamID
		return &p, nil
	}

	// Fallback: If not found by user_id, check if user's email matches a player's email
	fallbackQuery := `
		SELECT
			p.id, p.name,
			COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
			COALESCE(p.team_id::text, ''),
			COALESCE(p.bio, ''), COALESCE(p.image, ''), p.email,
			p.user_id, p.created_at, p.updated_at,
			COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM players p
		JOIN users u ON LOWER(p.email) = LOWER(u.email)
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE u.id = $1
		ORDER BY p.created_at DESC LIMIT 1
	`
	err = r.db.QueryRow(ctx, fallbackQuery, userID).Scan(
		&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio, &p.Image, &p.Email,
		&uid, &p.CreatedAt, &p.UpdatedAt,
		&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
	)
	if err != nil {
		return nil, err
	}

	// Auto-link user_id to player record
	_ = r.UpdatePlayerUserID(ctx, p.ID, &userID)
	p.UserID = &userID
	p.Team.ID = p.TeamID
	return &p, nil
}

func (r *PostgresPlayerRepository) UpdatePlayerUserID(ctx context.Context, playerID string, userID *string) error {
	query := `UPDATE players SET user_id = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, userID, playerID)
	return err
}

func (r *PostgresPlayerRepository) HasPlayerWithEmail(ctx context.Context, email string) (bool, error) {
	query := `SELECT EXISTS (SELECT 1 FROM players WHERE LOWER(email) = LOWER($1))`
	var exists bool
	err := r.db.QueryRow(ctx, query, email).Scan(&exists)
	return exists, err
}
