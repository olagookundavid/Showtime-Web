package ports

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PlayerRepository interface {
	GetPlayers(ctx context.Context, teamID string, search string, page, limit int, rosterStatus string) ([]domain.Player, int64, error)
	GetPlayerByID(ctx context.Context, id string) (*domain.Player, error)
	CreatePlayer(ctx context.Context, player *domain.Player) error
	UpdatePlayer(ctx context.Context, player *domain.Player) error
	DeletePlayer(ctx context.Context, id string) error
	RestorePlayer(ctx context.Context, id string) error
	AssignRandomJerseyNumbers(ctx context.Context, teamID string) (int, error)
	GetPlayerByUserID(ctx context.Context, userID string) (*domain.Player, error)
	UpdatePlayerUserID(ctx context.Context, playerID string, userID *string) error
	HasPlayerWithEmail(ctx context.Context, email string) (bool, error)
	MovePlayerToReserve(ctx context.Context, teamID, playerID string) error
	GraduatePlayerFromReserve(ctx context.Context, teamID, playerID string) error
	GetMainPlayerCount(ctx context.Context, teamID string) (int, error)
	GetReservePlayerCount(ctx context.Context, teamID string) (int, error)
	GetTeamRosterSummary(ctx context.Context, teamID string) (*dto.RosterSummaryResponse, error)
	RemovePlayerFromReserves(ctx context.Context, playerID string) error
}

type PostgresPlayerRepository struct {
	db *pgxpool.Pool
}

func NewPlayerRepository(db *pgxpool.Pool) *PostgresPlayerRepository {
	return &PostgresPlayerRepository{db: db}
}

func (r *PostgresPlayerRepository) GetPlayers(ctx context.Context, teamID string, search string, page, limit int, rosterStatus string) ([]domain.Player, int64, error) {
	fromClause := ` FROM players p LEFT JOIN teams t ON p.team_id = t.id LEFT JOIN team_reserves tr ON tr.player_id = p.id`
	whereClause := ` WHERE 1=1 AND (p.team_id IS NULL OR COALESCE(t.status, 'active') = 'active')`
	args := []any{}
	argCount := 1

	if teamID != "" {
		if teamID == "FREE_AGENT" || teamID == "UNASSIGNED" {
			// Free agency is defined by the contract, not by players.team_id.
			//
			// Filtering on team_id disagreed with every other free-agent surface
			// (contracts.GetFreeAgents, the team-head market, IssueContract): a
			// player whose contract had been terminated or had expired still
			// carried their old team_id unless a release path happened to clear
			// it, so this filter returned nothing while the contracts page
			// plainly showed the contract as TERMINATED. Matching on the absence
			// of an ACTIVE contract keeps the two views in agreement and still
			// catches genuinely unassigned players, who have no contract either.
			whereClause += ` AND p.id NOT IN (SELECT player_id FROM contracts WHERE status = 'ACTIVE')`
		} else {
			whereClause += ` AND p.team_id = $` + strconv.Itoa(argCount)
			args = append(args, teamID)
			argCount++
		}
	}

	if search != "" {
		whereClause += ` AND (p.name ILIKE $` + strconv.Itoa(argCount) + ` OR p.position ILIKE $` + strconv.Itoa(argCount) + `)`
		args = append(args, "%"+search+"%")
		argCount++
	}

	if rosterStatus == "reserve" {
		whereClause += ` AND tr.id IS NOT NULL`
	} else if rosterStatus == "all" {
		// no reserve filter
	} else {
		// Default is "main": only main squad players, reserves excluded!
		whereClause += ` AND tr.id IS NULL`
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) `+fromClause+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			p.id, p.name,
			COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
			COALESCE(p.team_id::text, ''),
			COALESCE(p.bio, ''), COALESCE(p.image, ''), p.email,
			COALESCE(p.gender, ''),
			p.created_at, p.updated_at,
			COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
			COALESCE(p.status, 'active'),
			(tr.id IS NOT NULL) AS is_reserve
	` + fromClause + whereClause +
		// Deactivated players sort last but are still returned: they stay
		// searchable and the client greys them rather than hiding them.
		` ORDER BY (COALESCE(p.status, 'active') = 'inactive'), p.jersey_number ASC`

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
			&p.Gender,
			&p.CreatedAt, &p.UpdatedAt,
			&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
			&p.Status,
			&p.IsReserve,
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
			COALESCE(p.gender, ''),
			p.user_id, p.created_at, p.updated_at,
			COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
			COALESCE(p.status, 'active'), p.deactivated_at,
			(tr.id IS NOT NULL) AS is_reserve
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id
		LEFT JOIN team_reserves tr ON tr.player_id = p.id
		WHERE p.id = $1
	`
	var p domain.Player
	p.Team = &domain.Team{}
	var uid *string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio, &p.Image, &p.Email,
		&p.Gender,
		&uid, &p.CreatedAt, &p.UpdatedAt,
		&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
		&p.Status, &p.DeactivatedAt,
		&p.IsReserve,
	)
	if err != nil {
		return nil, err
	}
	p.UserID = uid
	p.Team.ID = p.TeamID

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
		INSERT INTO players (name, jersey_number, position, team_id, bio, image, email, user_id, gender)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''))
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		player.Name, player.JerseyNumber, player.Position, player.TeamID, player.Bio, player.Image, player.Email, player.UserID, player.Gender,
	).Scan(&player.ID, &player.CreatedAt, &player.UpdatedAt)
}

func (r *PostgresPlayerRepository) UpdatePlayer(ctx context.Context, player *domain.Player) error {
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

	query := `
		UPDATE players SET
			name=$1, jersey_number=$2, position=$3, team_id=NULLIF($4::text, '')::uuid, bio=$5, image=$6, email=$7, user_id=COALESCE($8, user_id), gender=NULLIF($9, ''),
			updated_at=NOW()
		WHERE id=$10
	`
	_, err := r.db.Exec(ctx, query,
		player.Name, player.JerseyNumber, player.Position, player.TeamID, player.Bio, player.Image, player.Email, player.UserID, player.Gender,
		player.ID,
	)
	return err
}

// DeletePlayer deactivates a player rather than removing the row.
//
// A hard delete used to take the player's history with it: player_stats,
// match_team_sheets, player_team_history and the fantasy ledgers all cascaded
// off players(id), so tidying a roster silently erased seasons of stats.
// Migration 087 turned those foreign keys into RESTRICT, which means a real
// DELETE here would now fail against any player who has ever played -- the
// constraint is the backstop, and this is the intended path.
//
// The row stays, keeps its id, and keeps everything pointing at it. Callers
// that list current players filter on status; history reads do not, so a
// deactivated player still appears in past results and remains searchable.
func (r *PostgresPlayerRepository) DeletePlayer(ctx context.Context, id string) error {
	query := `
		UPDATE players
		   SET status = 'inactive',
		       deactivated_at = COALESCE(deactivated_at, NOW()),
		       updated_at = NOW()
		 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// RestorePlayer reverses DeletePlayer.
func (r *PostgresPlayerRepository) RestorePlayer(ctx context.Context, id string) error {
	query := `
		UPDATE players
		   SET status = 'active',
		       deactivated_at = NULL,
		       updated_at = NOW()
		 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresPlayerRepository) AssignRandomJerseyNumbers(ctx context.Context, teamID string) (int, error) {
	var teamIDs []string
	if teamID != "" {
		teamIDs = []string{teamID}
	} else {
		rows, err := r.db.Query(ctx, `SELECT DISTINCT team_id FROM players
			  WHERE team_id IS NOT NULL AND COALESCE(jersey_number, 0) = 0
			    AND COALESCE(status, 'active') = 'active'`)
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

		pRows, err := r.db.Query(ctx, // A deactivated player keeps the shirt they had; handing them a new one
		// would be assigning a number to someone who no longer plays.
		`SELECT id FROM players WHERE team_id = $1 AND COALESCE(jersey_number, 0) = 0
		   AND COALESCE(status, 'active') = 'active' ORDER BY name ASC`, tid)
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
			COALESCE(p.gender, ''),
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
		&p.Gender,
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
			COALESCE(p.gender, ''),
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
		&p.Gender,
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

func (r *PostgresPlayerRepository) MovePlayerToReserve(ctx context.Context, teamID, playerID string) error {
	// Verify player belongs to team
	var currentTeamID string
	err := r.db.QueryRow(ctx, `SELECT COALESCE(team_id::text, '') FROM players WHERE id = $1`, playerID).Scan(&currentTeamID)
	if err != nil {
		return fmt.Errorf("player not found: %w", err)
	}
	if currentTeamID != teamID {
		return fmt.Errorf("forbidden: player does not belong to this team")
	}

	query := `
		INSERT INTO team_reserves (team_id, player_id)
		VALUES ($1, $2)
		ON CONFLICT (player_id) DO UPDATE SET team_id = EXCLUDED.team_id, created_at = CURRENT_TIMESTAMP
	`
	_, err = r.db.Exec(ctx, query, teamID, playerID)
	return err
}

func (r *PostgresPlayerRepository) GraduatePlayerFromReserve(ctx context.Context, teamID, playerID string) error {
	// 1. Verify player is currently in reserve for this team
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM team_reserves WHERE team_id = $1 AND player_id = $2)`, teamID, playerID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("player is not in this team's reserves")
	}

	// 2. Enforce 25-player cap on main squad
	mainCount, err := r.GetMainPlayerCount(ctx, teamID)
	if err != nil {
		return fmt.Errorf("failed to check main squad count: %w", err)
	}
	if mainCount >= 25 {
		return fmt.Errorf("cannot graduate player: main squad is at maximum capacity (%d/25 players). Move an active player to reserves or release a player first", mainCount)
	}

	// 3. Remove from reserves
	_, err = r.db.Exec(ctx, `DELETE FROM team_reserves WHERE team_id = $1 AND player_id = $2`, teamID, playerID)
	return err
}

func (r *PostgresPlayerRepository) GetMainPlayerCount(ctx context.Context, teamID string) (int, error) {
	query := `
		SELECT COUNT(*) FROM players p
		WHERE p.team_id = $1
		  AND COALESCE(p.status, 'active') = 'active'
		  AND p.id NOT IN (SELECT player_id FROM team_reserves WHERE team_id = $1)
	`
	var count int
	err := r.db.QueryRow(ctx, query, teamID).Scan(&count)
	return count, err
}

func (r *PostgresPlayerRepository) GetReservePlayerCount(ctx context.Context, teamID string) (int, error) {
	query := `
		SELECT COUNT(*) FROM team_reserves tr
		JOIN players p ON p.id = tr.player_id
		WHERE tr.team_id = $1
		  AND COALESCE(p.status, 'active') = 'active'
	`
	var count int
	err := r.db.QueryRow(ctx, query, teamID).Scan(&count)
	return count, err
}

func (r *PostgresPlayerRepository) GetTeamRosterSummary(ctx context.Context, teamID string) (*dto.RosterSummaryResponse, error) {
	mainCount, err := r.GetMainPlayerCount(ctx, teamID)
	if err != nil {
		return nil, err
	}
	reserveCount, err := r.GetReservePlayerCount(ctx, teamID)
	if err != nil {
		return nil, err
	}

	return &dto.RosterSummaryResponse{
		MainCount:       mainCount,
		ReserveCount:    reserveCount,
		MaxMainLimit:    25,
		CanAddOrPromote: mainCount < 25,
	}, nil
}

func (r *PostgresPlayerRepository) RemovePlayerFromReserves(ctx context.Context, playerID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM team_reserves WHERE player_id = $1`, playerID)
	return err
}

