package ports

import (
	"context"
	"errors"
	"fmt"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BadgeRepository interface {
	ListBadges(ctx context.Context) ([]domain.Badge, error)
	GetBadgeByID(ctx context.Context, id string) (*domain.Badge, error)
	GetBadgeByCode(ctx context.Context, code string) (*domain.Badge, error)
	CreateBadge(ctx context.Context, badge *domain.Badge) error
	UpdateBadge(ctx context.Context, badge *domain.Badge) error
	DeleteBadge(ctx context.Context, id string) error
	GetPlayerBadges(ctx context.Context, playerID string) ([]domain.PlayerBadge, error)
	AwardBadge(ctx context.Context, award *domain.PlayerBadgeAward, increment int) (*domain.PlayerBadge, error)
	DeleteAward(ctx context.Context, awardID string) error
	SyncPlayerMVPBadge(ctx context.Context, playerID string) error
	BackfillAllMVPBadges(ctx context.Context) (int, error)
	SyncTOTWBadgeForPlayer(ctx context.Context, playerID string) error
	DeleteTOTWAwards(ctx context.Context, totwID string, exceptPlayerIDs []string) ([]string, error)
	EnsureTOTWAward(ctx context.Context, award *domain.PlayerBadgeAward) error
	ListAwards(ctx context.Context, badgeID string, playerID string, limit, offset int) ([]domain.PlayerBadgeAward, int64, error)
}

type PostgresBadgeRepository struct {
	db *pgxpool.Pool
}

func NewBadgeRepository(db *pgxpool.Pool) *PostgresBadgeRepository {
	return &PostgresBadgeRepository{db: db}
}

func (r *PostgresBadgeRepository) ListBadges(ctx context.Context) ([]domain.Badge, error) {
	query := `
		SELECT id, code, name, COALESCE(description, ''), COALESCE(icon, '🏆'),
		       COALESCE(category, 'Honor'), COALESCE(color_scheme, 'gold'),
		       is_system, created_at, updated_at
		FROM badges
		ORDER BY is_system DESC, name ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var badges []domain.Badge
	for rows.Next() {
		var b domain.Badge
		err := rows.Scan(
			&b.ID, &b.Code, &b.Name, &b.Description, &b.Icon,
			&b.Category, &b.ColorScheme, &b.IsSystem, &b.CreatedAt, &b.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		badges = append(badges, b)
	}
	return badges, nil
}

func (r *PostgresBadgeRepository) GetBadgeByID(ctx context.Context, id string) (*domain.Badge, error) {
	query := `
		SELECT id, code, name, COALESCE(description, ''), COALESCE(icon, '🏆'),
		       COALESCE(category, 'Honor'), COALESCE(color_scheme, 'gold'),
		       is_system, created_at, updated_at
		FROM badges
		WHERE id = $1
	`
	var b domain.Badge
	err := r.db.QueryRow(ctx, query, id).Scan(
		&b.ID, &b.Code, &b.Name, &b.Description, &b.Icon,
		&b.Category, &b.ColorScheme, &b.IsSystem, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("badge not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *PostgresBadgeRepository) GetBadgeByCode(ctx context.Context, code string) (*domain.Badge, error) {
	query := `
		SELECT id, code, name, COALESCE(description, ''), COALESCE(icon, '🏆'),
		       COALESCE(category, 'Honor'), COALESCE(color_scheme, 'gold'),
		       is_system, created_at, updated_at
		FROM badges
		WHERE code = $1
	`
	var b domain.Badge
	err := r.db.QueryRow(ctx, query, code).Scan(
		&b.ID, &b.Code, &b.Name, &b.Description, &b.Icon,
		&b.Category, &b.ColorScheme, &b.IsSystem, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("badge not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *PostgresBadgeRepository) CreateBadge(ctx context.Context, badge *domain.Badge) error {
	query := `
		INSERT INTO badges (code, name, description, icon, category, color_scheme, is_system, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		badge.Code, badge.Name, badge.Description, badge.Icon,
		badge.Category, badge.ColorScheme, badge.IsSystem,
	).Scan(&badge.ID, &badge.CreatedAt, &badge.UpdatedAt)
}

func (r *PostgresBadgeRepository) UpdateBadge(ctx context.Context, badge *domain.Badge) error {
	query := `
		UPDATE badges
		SET name = $1, description = $2, icon = $3, category = $4, color_scheme = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING updated_at
	`
	return r.db.QueryRow(ctx, query,
		badge.Name, badge.Description, badge.Icon, badge.Category, badge.ColorScheme, badge.ID,
	).Scan(&badge.UpdatedAt)
}

func (r *PostgresBadgeRepository) DeleteBadge(ctx context.Context, id string) error {
	// Guard against deleting system badges
	var isSystem bool
	err := r.db.QueryRow(ctx, `SELECT is_system FROM badges WHERE id = $1`, id).Scan(&isSystem)
	if err != nil {
		return err
	}
	if isSystem {
		return fmt.Errorf("cannot delete system badge")
	}

	_, err = r.db.Exec(ctx, `DELETE FROM badges WHERE id = $1`, id)
	return err
}

func (r *PostgresBadgeRepository) GetPlayerBadges(ctx context.Context, playerID string) ([]domain.PlayerBadge, error) {
	query := `
		SELECT pb.id, pb.player_id, pb.badge_id, pb.count, pb.last_awarded_at, pb.created_at, pb.updated_at,
		       b.id, b.code, b.name, COALESCE(b.description, ''), COALESCE(b.icon, '🏆'),
		       COALESCE(b.category, 'Honor'), COALESCE(b.color_scheme, 'gold'), b.is_system
		FROM player_badges pb
		JOIN badges b ON pb.badge_id = b.id
		WHERE pb.player_id = $1 AND pb.count > 0
		ORDER BY b.is_system DESC, pb.count DESC, pb.last_awarded_at DESC
	`
	rows, err := r.db.Query(ctx, query, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var badges []domain.PlayerBadge
	for rows.Next() {
		var pb domain.PlayerBadge
		var b domain.Badge
		err := rows.Scan(
			&pb.ID, &pb.PlayerID, &pb.BadgeID, &pb.Count, &pb.LastAwardedAt, &pb.CreatedAt, &pb.UpdatedAt,
			&b.ID, &b.Code, &b.Name, &b.Description, &b.Icon,
			&b.Category, &b.ColorScheme, &b.IsSystem,
		)
		if err != nil {
			return nil, err
		}
		pb.Badge = &b
		badges = append(badges, pb)
	}

	// Fetch up to 5 most recent awards for each badge
	for i := range badges {
		awardsQuery := `
			SELECT id, player_id, badge_id, competition_id, season_id, match_id, totw_id,
			       COALESCE(reason, ''), COALESCE(count, 1), awarded_by, created_at
			FROM player_badge_awards
			WHERE player_id = $1 AND badge_id = $2
			ORDER BY created_at DESC
			LIMIT 10
		`
		aRows, aErr := r.db.Query(ctx, awardsQuery, playerID, badges[i].BadgeID)
		if aErr == nil {
			var awards []domain.PlayerBadgeAward
			for aRows.Next() {
				var a domain.PlayerBadgeAward
				if err := aRows.Scan(
					&a.ID, &a.PlayerID, &a.BadgeID, &a.CompetitionID, &a.SeasonID,
					&a.MatchID, &a.TOTWID, &a.Reason, &a.Count, &a.AwardedBy, &a.CreatedAt,
				); err == nil {
					awards = append(awards, a)
				}
			}
			aRows.Close()
			badges[i].Awards = awards
		}
	}

	return badges, nil
}

func (r *PostgresBadgeRepository) AwardBadge(ctx context.Context, award *domain.PlayerBadgeAward, increment int) (*domain.PlayerBadge, error) {
	if increment <= 0 {
		increment = 1
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Insert award record
	insertAward := `
		INSERT INTO player_badge_awards (player_id, badge_id, competition_id, season_id, match_id, totw_id, reason, count, awarded_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING id, created_at
	`
	err = tx.QueryRow(ctx, insertAward,
		award.PlayerID, award.BadgeID, award.CompetitionID, award.SeasonID,
		award.MatchID, award.TOTWID, award.Reason, increment, award.AwardedBy,
	).Scan(&award.ID, &award.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to record badge award: %w", err)
	}

	// 2. Upsert player_badges counter grounded in player_badge_awards
	upsertCounter := `
		INSERT INTO player_badges (player_id, badge_id, count, last_awarded_at, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW(), NOW())
		ON CONFLICT (player_id, badge_id)
		DO UPDATE SET
			count = (SELECT COALESCE(SUM(pba.count), 0) FROM player_badge_awards pba WHERE pba.player_id = $1 AND pba.badge_id = $2),
			last_awarded_at = NOW(),
			updated_at = NOW()
		RETURNING id, count, last_awarded_at, created_at, updated_at
	`
	var pb domain.PlayerBadge
	pb.PlayerID = award.PlayerID
	pb.BadgeID = award.BadgeID
	err = tx.QueryRow(ctx, upsertCounter, award.PlayerID, award.BadgeID, increment).Scan(
		&pb.ID, &pb.Count, &pb.LastAwardedAt, &pb.CreatedAt, &pb.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update player badge counter: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &pb, nil
}

func (r *PostgresBadgeRepository) DeleteAward(ctx context.Context, awardID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var playerID, badgeID, badgeCode string
	var matchID, totwID *string
	err = tx.QueryRow(ctx, `
		SELECT pba.player_id, pba.badge_id, b.code, pba.match_id::text, pba.totw_id::text
		FROM player_badge_awards pba
		JOIN badges b ON b.id = pba.badge_id
		WHERE pba.id = $1`, awardID).Scan(&playerID, &badgeID, &badgeCode, &matchID, &totwID)
	if err != nil {
		return err
	}

	// Automatic awards are rebuilt from their source on the next sync, so a
	// revoke here would silently come back. Change the source instead.
	if totwID != nil {
		return fmt.Errorf("this award comes from a Team of the Week edition; remove the player from that edition or unpublish it instead")
	}
	if badgeCode == "MVP" && matchID != nil {
		return fmt.Errorf("this award comes from the match MVP; change the MVP on the match instead")
	}

	_, err = tx.Exec(ctx, `DELETE FROM player_badge_awards WHERE id = $1`, awardID)
	if err != nil {
		return err
	}

	// Recount based on actual remaining awards in player_badge_awards
	updateQuery := `
		UPDATE player_badges
		SET count = (SELECT COALESCE(SUM(count), 0) FROM player_badge_awards WHERE player_id = $1 AND badge_id = $2),
		    updated_at = NOW()
		WHERE player_id = $1 AND badge_id = $2
	`
	_, err = tx.Exec(ctx, updateQuery, playerID, badgeID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *PostgresBadgeRepository) SyncPlayerMVPBadge(ctx context.Context, playerID string) error {
	badge, err := r.GetBadgeByCode(ctx, "MVP")
	if err != nil {
		return err
	}

	query := `
		SELECT COALESCE(SUM(count), 0), COALESCE(MAX(created_at), NOW())
		FROM player_badge_awards
		WHERE player_id = $1 AND badge_id = $2
	`
	var count int
	var lastAwarded time.Time
	err = r.db.QueryRow(ctx, query, playerID, badge.ID).Scan(&count, &lastAwarded)
	if err != nil {
		return err
	}

	if count > 0 {
		upsert := `
			INSERT INTO player_badges (player_id, badge_id, count, last_awarded_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
			ON CONFLICT (player_id, badge_id)
			DO UPDATE SET count = $3, last_awarded_at = $4, updated_at = NOW()
		`
		_, err = r.db.Exec(ctx, upsert, playerID, badge.ID, count, lastAwarded)
		return err
	} else {
		// Zero count: update counter to 0
		_, err = r.db.Exec(ctx, `UPDATE player_badges SET count = 0, updated_at = NOW() WHERE player_id = $1 AND badge_id = $2`, playerID, badge.ID)
		return err
	}
}

func (r *PostgresBadgeRepository) BackfillAllMVPBadges(ctx context.Context) (int, error) {
	badge, err := r.GetBadgeByCode(ctx, "MVP")
	if err != nil {
		return 0, err
	}

	// 1. Remove stale MVP awards first (match not FINISHED, or the player is no
	// longer its MVP) so a match never holds two MVP awards.
	cleanupQuery := `
		DELETE FROM player_badge_awards pba
		USING matches m
		WHERE pba.badge_id = $1 AND pba.match_id = m.id
		  AND (m.status != 'FINISHED' OR m.mvp_player_id IS NULL OR m.mvp_player_id != pba.player_id)
	`
	if _, err := r.db.Exec(ctx, cleanupQuery, badge.ID); err != nil {
		return 0, fmt.Errorf("clean up stale MVP awards: %w", err)
	}

	// 2. Backfill awards for all finished matches with mvp_player_id
	awardQuery := `
		INSERT INTO player_badge_awards (player_id, badge_id, match_id, competition_id, reason, count, created_at)
		SELECT m.mvp_player_id, $1, m.id, m.competition_id, 'Match MVP honor', 1, COALESCE((m.date + COALESCE(m.time, '00:00'::time))::timestamptz, NOW())
		FROM matches m
		WHERE m.mvp_player_id IS NOT NULL AND m.status = 'FINISHED'
		ON CONFLICT DO NOTHING
	`
	if _, err := r.db.Exec(ctx, awardQuery, badge.ID); err != nil {
		return 0, fmt.Errorf("backfill MVP awards: %w", err)
	}

	// 3. Aggregate counts into player_badges based on player_badge_awards (preserving manual awards)
	syncQuery := `
		INSERT INTO player_badges (player_id, badge_id, count, last_awarded_at, created_at, updated_at)
		SELECT pba.player_id, $1, COALESCE(SUM(pba.count), 0), MAX(pba.created_at), NOW(), NOW()
		FROM player_badge_awards pba
		WHERE pba.badge_id = $1
		GROUP BY pba.player_id
		ON CONFLICT (player_id, badge_id)
		DO UPDATE SET
			count = EXCLUDED.count,
			last_awarded_at = EXCLUDED.last_awarded_at,
			updated_at = NOW()
	`
	tag, err := r.db.Exec(ctx, syncQuery, badge.ID)
	if err != nil {
		return 0, err
	}

	// Zero out counters for players who have 0 awards in player_badge_awards for MVP
	zeroQuery := `
		UPDATE player_badges pb
		SET count = 0, updated_at = NOW()
		WHERE pb.badge_id = $1
		  AND NOT EXISTS (
		      SELECT 1 FROM player_badge_awards pba
		      WHERE pba.player_id = pb.player_id AND pba.badge_id = $1
		  )
	`
	if _, err := r.db.Exec(ctx, zeroQuery, badge.ID); err != nil {
		return 0, fmt.Errorf("zero MVP counters: %w", err)
	}

	return int(tag.RowsAffected()), nil
}

func (r *PostgresBadgeRepository) SyncTOTWBadgeForPlayer(ctx context.Context, playerID string) error {
	badge, err := r.GetBadgeByCode(ctx, "TOTW")
	if err != nil {
		return err
	}

	query := `
		SELECT COALESCE(SUM(count), 0), COALESCE(MAX(created_at), NOW())
		FROM player_badge_awards
		WHERE player_id = $1 AND badge_id = $2
	`
	var count int
	var lastAwarded time.Time
	err = r.db.QueryRow(ctx, query, playerID, badge.ID).Scan(&count, &lastAwarded)
	if err != nil {
		return err
	}

	if count > 0 {
		upsert := `
			INSERT INTO player_badges (player_id, badge_id, count, last_awarded_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
			ON CONFLICT (player_id, badge_id)
			DO UPDATE SET count = $3, last_awarded_at = $4, updated_at = NOW()
		`
		_, err = r.db.Exec(ctx, upsert, playerID, badge.ID, count, lastAwarded)
		return err
	} else {
		_, err = r.db.Exec(ctx, `UPDATE player_badges SET count = 0, updated_at = NOW() WHERE player_id = $1 AND badge_id = $2`, playerID, badge.ID)
		return err
	}
}

func (r *PostgresBadgeRepository) DeleteTOTWAwards(ctx context.Context, totwID string, exceptPlayerIDs []string) ([]string, error) {
	var query string
	var args []any
	args = append(args, totwID)

	if len(exceptPlayerIDs) > 0 {
		query = `SELECT DISTINCT player_id::text FROM player_badge_awards WHERE totw_id = $1 AND NOT (player_id = ANY($2::uuid[]))`
		args = append(args, exceptPlayerIDs)
	} else {
		query = `SELECT DISTINCT player_id::text FROM player_badge_awards WHERE totw_id = $1`
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var affected []string
	for rows.Next() {
		var pID string
		if err := rows.Scan(&pID); err == nil {
			affected = append(affected, pID)
		}
	}

	if len(exceptPlayerIDs) > 0 {
		_, err = r.db.Exec(ctx, `DELETE FROM player_badge_awards WHERE totw_id = $1 AND NOT (player_id = ANY($2::uuid[]))`, totwID, exceptPlayerIDs)
	} else {
		_, err = r.db.Exec(ctx, `DELETE FROM player_badge_awards WHERE totw_id = $1`, totwID)
	}
	return affected, err
}

func (r *PostgresBadgeRepository) EnsureTOTWAward(ctx context.Context, award *domain.PlayerBadgeAward) error {
	q := `
		INSERT INTO player_badge_awards (player_id, badge_id, competition_id, totw_id, reason, count, awarded_by, created_at)
		SELECT $1, $2, $3, $4, $5, 1, $6, NOW()
		WHERE NOT EXISTS (
			SELECT 1 FROM player_badge_awards
			WHERE player_id = $1 AND badge_id = $2 AND totw_id = $4
		)
	`
	_, err := r.db.Exec(ctx, q, award.PlayerID, award.BadgeID, award.CompetitionID, award.TOTWID, award.Reason, award.AwardedBy)
	return err
}

func (r *PostgresBadgeRepository) ListAwards(ctx context.Context, badgeID string, playerID string, limit, offset int) ([]domain.PlayerBadgeAward, int64, error) {
	where := " WHERE 1=1"
	var args []any
	argIndex := 1

	if badgeID != "" {
		where += fmt.Sprintf(" AND pba.badge_id = $%d", argIndex)
		args = append(args, badgeID)
		argIndex++
	}
	if playerID != "" {
		where += fmt.Sprintf(" AND pba.player_id = $%d", argIndex)
		args = append(args, playerID)
		argIndex++
	}

	countQuery := "SELECT COUNT(*) FROM player_badge_awards pba" + where
	var total int64
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT pba.id, pba.player_id, pba.badge_id, pba.competition_id, pba.season_id,
		       pba.match_id, pba.totw_id, COALESCE(pba.reason, ''), COALESCE(pba.count, 1), pba.awarded_by, pba.created_at,
		       b.id, b.code, b.name, COALESCE(b.icon, '🏆'), COALESCE(b.color_scheme, 'gold'),
		       COALESCE(p.name, ''), COALESCE(p.image, ''), COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
		       COALESCE(t.name, ''), c.name
		FROM player_badge_awards pba
		JOIN badges b ON pba.badge_id = b.id
		LEFT JOIN players p ON pba.player_id = p.id
		LEFT JOIN teams t ON p.team_id = t.id
		LEFT JOIN competitions c ON pba.competition_id = c.id
		%s
		ORDER BY pba.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var awards []domain.PlayerBadgeAward
	for rows.Next() {
		var a domain.PlayerBadgeAward
		var b domain.Badge
		var playerName, playerImage, playerPosition, teamName string
		var playerJersey int
		var compName *string
		err := rows.Scan(
			&a.ID, &a.PlayerID, &a.BadgeID, &a.CompetitionID, &a.SeasonID,
			&a.MatchID, &a.TOTWID, &a.Reason, &a.Count, &a.AwardedBy, &a.CreatedAt,
			&b.ID, &b.Code, &b.Name, &b.Icon, &b.ColorScheme,
			&playerName, &playerImage, &playerJersey, &playerPosition,
			&teamName, &compName,
		)
		if err != nil {
			return nil, 0, err
		}
		a.Badge = &b
		a.CompetitionName = compName
		if playerName != "" {
			a.Player = &domain.Player{
				ID:           a.PlayerID,
				Name:         playerName,
				Image:        playerImage,
				JerseyNumber: playerJersey,
				Position:     playerPosition,
				Team: &domain.Team{
					Name: teamName,
				},
			}
		}
		awards = append(awards, a)
	}

	return awards, total, nil
}
