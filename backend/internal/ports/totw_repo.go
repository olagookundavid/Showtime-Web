package ports

import (
	"context"
	"errors"
	"fmt"
	"showtime-backend/internal/domain"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TOTWRepository interface {
	CreateTOTW(ctx context.Context, totw *domain.TeamOfTheWeek, players []domain.TOTWPlayer) (*domain.TeamOfTheWeek, error)
	UpdateTOTW(ctx context.Context, totw *domain.TeamOfTheWeek, players []domain.TOTWPlayer) (*domain.TeamOfTheWeek, error)
	DeleteTOTW(ctx context.Context, id string) error
	GetTOTWByID(ctx context.Context, id string) (*domain.TeamOfTheWeek, error)
	GetLatestPublishedTOTW(ctx context.Context, competitionID string) (*domain.TeamOfTheWeek, error)
	ListTOTWArchive(ctx context.Context, competitionID string, onlyPublished bool) ([]domain.TeamOfTheWeek, error)
	PublishTOTW(ctx context.Context, id string, isPublished bool) (*domain.TeamOfTheWeek, error)
	GetPlayerDayStats(ctx context.Context, playerID string, eventDayID string) (map[string]string, error)
}

type PostgresTOTWRepository struct {
	db *pgxpool.Pool
}

func NewTOTWRepository(db *pgxpool.Pool) *PostgresTOTWRepository {
	return &PostgresTOTWRepository{db: db}
}

func (r *PostgresTOTWRepository) CreateTOTW(ctx context.Context, totw *domain.TeamOfTheWeek, players []domain.TOTWPlayer) (*domain.TeamOfTheWeek, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var pubAt *time.Time
	if totw.IsPublished {
		now := time.Now()
		pubAt = &now
	}

	query := `
		INSERT INTO team_of_the_week (competition_id, event_day_id, week_title, headline, sub_headline, is_published, published_at, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRow(ctx, query,
		totw.CompetitionID, totw.EventDayID, totw.WeekTitle, totw.Headline,
		totw.SubHeadline, totw.IsPublished, pubAt, totw.CreatedBy,
	).Scan(&totw.ID, &totw.CreatedAt, &totw.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert totw header: %w", err)
	}
	totw.PublishedAt = pubAt

	// Insert players
	for i, p := range players {
		insertPlayer := `
			INSERT INTO team_of_the_week_players (
				totw_id, player_id, slot_code, position, unit, coord_x, coord_y,
				rating, stat1_value, stat1_label, stat2_value, stat2_label,
				stat3_value, stat3_label, display_order, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
		`
		_, err := tx.Exec(ctx, insertPlayer,
			totw.ID, p.PlayerID, p.SlotCode, p.Position, p.Unit, p.CoordX, p.CoordY,
			p.Rating, p.Stat1Value, p.Stat1Label, p.Stat2Value, p.Stat2Label,
			p.Stat3Value, p.Stat3Label, i,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert totw player %s (%s): %w", p.SlotCode, p.PlayerID, err)
		}
	}

	if totw.IsPublished {
		countQuery := `
			SELECT tp.unit, COALESCE(p.gender, '')
			FROM team_of_the_week_players tp
			JOIN players p ON tp.player_id = p.id
			WHERE tp.totw_id = $1
		`
		cRows, err := tx.Query(ctx, countQuery, totw.ID)
		if err != nil {
			return nil, err
		}
		if err := checkFemaleQuota(cRows); err != nil {
			cRows.Close()
			return nil, err
		}
		cRows.Close()
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetTOTWByID(ctx, totw.ID)
}

func (r *PostgresTOTWRepository) UpdateTOTW(ctx context.Context, totw *domain.TeamOfTheWeek, players []domain.TOTWPlayer) (*domain.TeamOfTheWeek, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Fetch existing to see published status transition
	var existingPub bool
	var existingPubAt *time.Time
	err = tx.QueryRow(ctx, `SELECT is_published, published_at FROM team_of_the_week WHERE id = $1`, totw.ID).Scan(&existingPub, &existingPubAt)
	if err != nil {
		return nil, err
	}

	pubAt := existingPubAt
	if totw.IsPublished && !existingPub {
		now := time.Now()
		pubAt = &now
	} else if !totw.IsPublished {
		pubAt = nil
	}

	updateHeader := `
		UPDATE team_of_the_week
		SET competition_id = $1, event_day_id = $2, week_title = $3, headline = $4,
		    sub_headline = $5, is_published = $6, published_at = $7, updated_at = NOW()
		WHERE id = $8
		RETURNING updated_at
	`
	err = tx.QueryRow(ctx, updateHeader,
		totw.CompetitionID, totw.EventDayID, totw.WeekTitle, totw.Headline,
		totw.SubHeadline, totw.IsPublished, pubAt, totw.ID,
	).Scan(&totw.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to update totw header: %w", err)
	}

	// Replace players
	_, err = tx.Exec(ctx, `DELETE FROM team_of_the_week_players WHERE totw_id = $1`, totw.ID)
	if err != nil {
		return nil, err
	}

	for i, p := range players {
		insertPlayer := `
			INSERT INTO team_of_the_week_players (
				totw_id, player_id, slot_code, position, unit, coord_x, coord_y,
				rating, stat1_value, stat1_label, stat2_value, stat2_label,
				stat3_value, stat3_label, display_order, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
		`
		_, err := tx.Exec(ctx, insertPlayer,
			totw.ID, p.PlayerID, p.SlotCode, p.Position, p.Unit, p.CoordX, p.CoordY,
			p.Rating, p.Stat1Value, p.Stat1Label, p.Stat2Value, p.Stat2Label,
			p.Stat3Value, p.Stat3Label, i,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to update totw player %s: %w", p.SlotCode, err)
		}
	}

	if totw.IsPublished {
		countQuery := `
			SELECT tp.unit, COALESCE(p.gender, '')
			FROM team_of_the_week_players tp
			JOIN players p ON tp.player_id = p.id
			WHERE tp.totw_id = $1
		`
		cRows, err := tx.Query(ctx, countQuery, totw.ID)
		if err != nil {
			return nil, err
		}
		if err := checkFemaleQuota(cRows); err != nil {
			cRows.Close()
			return nil, err
		}
		cRows.Close()
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetTOTWByID(ctx, totw.ID)
}

func (r *PostgresTOTWRepository) DeleteTOTW(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM team_of_the_week WHERE id = $1`, id)
	return err
}

func (r *PostgresTOTWRepository) GetTOTWByID(ctx context.Context, id string) (*domain.TeamOfTheWeek, error) {
	query := `
		SELECT totw.id, totw.competition_id, totw.event_day_id::text, totw.week_title,
		       totw.headline, totw.sub_headline, totw.is_published, totw.published_at,
		       totw.created_by::text, totw.created_at, totw.updated_at,
		       c.id, c.name, COALESCE(c.logo, '')
		FROM team_of_the_week totw
		JOIN competitions c ON totw.competition_id = c.id
		WHERE totw.id = $1
	`
	var totw domain.TeamOfTheWeek
	totw.Competition = &domain.Competition{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&totw.ID, &totw.CompetitionID, &totw.EventDayID, &totw.WeekTitle,
		&totw.Headline, &totw.SubHeadline, &totw.IsPublished, &totw.PublishedAt,
		&totw.CreatedBy, &totw.CreatedAt, &totw.UpdatedAt,
		&totw.Competition.ID, &totw.Competition.Name, &totw.Competition.Logo,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("team of the week not found")
		}
		return nil, err
	}

	playersQuery := `
		SELECT tp.id, tp.totw_id, tp.player_id, tp.slot_code, tp.position, tp.unit,
		       tp.coord_x, tp.coord_y, tp.rating,
		       COALESCE(tp.stat1_value, ''), COALESCE(tp.stat1_label, ''),
		       COALESCE(tp.stat2_value, ''), COALESCE(tp.stat2_label, ''),
		       COALESCE(tp.stat3_value, ''), COALESCE(tp.stat3_label, ''),
		       tp.display_order, tp.created_at,
		       p.id, p.name, COALESCE(p.jersey_number, 0), COALESCE(p.position, '-'),
		       COALESCE(p.image, ''), COALESCE(p.team_id::text, ''),
		       COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       COALESCE(p.gender, '')
		FROM team_of_the_week_players tp
		JOIN players p ON tp.player_id = p.id
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE tp.totw_id = $1
		ORDER BY tp.display_order ASC
	`
	rows, err := r.db.Query(ctx, playersQuery, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []domain.TOTWPlayer
	for rows.Next() {
		var tp domain.TOTWPlayer
		tp.Player = &domain.Player{Team: &domain.Team{}}
		err := rows.Scan(
			&tp.ID, &tp.TOTWID, &tp.PlayerID, &tp.SlotCode, &tp.Position, &tp.Unit,
			&tp.CoordX, &tp.CoordY, &tp.Rating,
			&tp.Stat1Value, &tp.Stat1Label, &tp.Stat2Value, &tp.Stat2Label,
			&tp.Stat3Value, &tp.Stat3Label,
			&tp.DisplayOrder, &tp.CreatedAt,
			&tp.Player.ID, &tp.Player.Name, &tp.Player.JerseyNumber, &tp.Player.Position,
			&tp.Player.Image, &tp.Player.TeamID,
			&tp.Player.Team.Name, &tp.Player.Team.ShortName, &tp.Player.Team.Logo,
			&tp.Player.Gender,
		)
		if err != nil {
			return nil, err
		}
		tp.Player.Team.ID = tp.Player.TeamID
		players = append(players, tp)
	}

	totw.Players = players
	return &totw, nil
}

func (r *PostgresTOTWRepository) GetLatestPublishedTOTW(ctx context.Context, competitionID string) (*domain.TeamOfTheWeek, error) {
	where := "WHERE totw.is_published = true"
	var args []any
	if competitionID != "" {
		where += " AND totw.competition_id = $1"
		args = append(args, competitionID)
	}

	query := fmt.Sprintf(`
		SELECT totw.id
		FROM team_of_the_week totw
		%s
		ORDER BY totw.published_at DESC NULLS LAST, totw.created_at DESC
		LIMIT 1
	`, where)

	var id string
	err := r.db.QueryRow(ctx, query, args...).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("no published team of the week found")
		}
		return nil, err
	}

	return r.GetTOTWByID(ctx, id)
}

func (r *PostgresTOTWRepository) ListTOTWArchive(ctx context.Context, competitionID string, onlyPublished bool) ([]domain.TeamOfTheWeek, error) {
	where := "WHERE 1=1"
	var args []any
	argIndex := 1

	if onlyPublished {
		where += " AND totw.is_published = true"
	}
	if competitionID != "" {
		where += fmt.Sprintf(" AND totw.competition_id = $%d", argIndex)
		args = append(args, competitionID)
		argIndex++
	}

	query := fmt.Sprintf(`
		SELECT totw.id, totw.competition_id, totw.event_day_id::text, totw.week_title,
		       totw.headline, totw.sub_headline, totw.is_published, totw.published_at,
		       totw.created_at, totw.updated_at,
		       c.id, c.name, COALESCE(c.logo, '')
		FROM team_of_the_week totw
		JOIN competitions c ON totw.competition_id = c.id
		%s
		ORDER BY totw.published_at DESC NULLS LAST, totw.created_at DESC
	`, where)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.TeamOfTheWeek
	for rows.Next() {
		var totw domain.TeamOfTheWeek
		totw.Competition = &domain.Competition{}
		err := rows.Scan(
			&totw.ID, &totw.CompetitionID, &totw.EventDayID, &totw.WeekTitle,
			&totw.Headline, &totw.SubHeadline, &totw.IsPublished, &totw.PublishedAt,
			&totw.CreatedAt, &totw.UpdatedAt,
			&totw.Competition.ID, &totw.Competition.Name, &totw.Competition.Logo,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, totw)
	}

	return list, nil
}

func checkFemaleQuota(rows pgx.Rows) error {
	var offFemales, defFemales int
	for rows.Next() {
		var unit, gender string
		if err := rows.Scan(&unit, &gender); err == nil {
			if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(gender)), "F") {
				if strings.EqualFold(unit, "Offence") {
					offFemales++
				} else if strings.EqualFold(unit, "Defence") {
					defFemales++
				}
			}
		}
	}
	if offFemales < 3 {
		return fmt.Errorf("cannot publish: offence requires at least 3 female players (found %d of 3)", offFemales)
	}
	if defFemales < 3 {
		return fmt.Errorf("cannot publish: defence requires at least 3 female players (found %d of 3)", defFemales)
	}
	return nil
}

func (r *PostgresTOTWRepository) PublishTOTW(ctx context.Context, id string, isPublished bool) (*domain.TeamOfTheWeek, error) {
	if isPublished {
		countQuery := `
			SELECT tp.unit, COALESCE(p.gender, '')
			FROM team_of_the_week_players tp
			JOIN players p ON tp.player_id = p.id
			WHERE tp.totw_id = $1
		`
		cRows, err := r.db.Query(ctx, countQuery, id)
		if err != nil {
			return nil, err
		}
		if err := checkFemaleQuota(cRows); err != nil {
			cRows.Close()
			return nil, err
		}
		cRows.Close()
	}

	var pubAt *time.Time
	if isPublished {
		now := time.Now()
		pubAt = &now
	}

	query := `
		UPDATE team_of_the_week
		SET is_published = $1, published_at = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING updated_at
	`
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, query, isPublished, pubAt, id).Scan(&updatedAt)
	if err != nil {
		return nil, err
	}

	return r.GetTOTWByID(ctx, id)
}

// GetPlayerDayStats auto-aggregates key box-score stats for a player on an event day
func (r *PostgresTOTWRepository) GetPlayerDayStats(ctx context.Context, playerID string, eventDayID string) (map[string]string, error) {
	result := make(map[string]string)

	query := `
		SELECT 
			COUNT(ps.id),
			COALESCE(SUM(ps.completed_passes), 0),
			COALESCE(SUM(ps.passing_attempts), 0),
			COALESCE(SUM(ps.passing_yards), 0),
			COALESCE(SUM(ps.passing_tds), 0),
			COALESCE(SUM(ps.interceptions_thrown), 0),
			COALESCE(SUM(ps.receptions), 0),
			COALESCE(SUM(ps.receiving_yards), 0),
			COALESCE(SUM(ps.receiving_tds), 0),
			COALESCE(SUM(ps.extra_points_tds), 0),
			COALESCE(SUM(ps.drops), 0),
			COALESCE(SUM(ps.rushing_attempts), 0),
			COALESCE(SUM(ps.rushing_yards), 0),
			COALESCE(SUM(ps.rushing_tds), 0),
			COALESCE(SUM(ps.flag_pulls), 0),
			COALESCE(SUM(ps.pass_deflections), 0),
			COALESCE(SUM(ps.interceptions), 0),
			COALESCE(SUM(ps.defensive_tds), 0),
			COALESCE(SUM(ps.safety), 0),
			COALESCE(SUM(ps.defensive_xp_tds), 0),
			COALESCE(SUM(ps.def_sacks), 0),
			COALESCE(SUM(ps.qb_sacks), 0),
			COALESCE(SUM(ps.batted_down_passes), 0),
			COALESCE(SUM(ps.uncatchable_passes), 0),
			COALESCE(SUM(ps.thrown_away_passes), 0),
			COALESCE(SUM(ps.xp_attempts), 0),
			COALESCE(SUM(ps.xp_good), 0)
		FROM player_stats ps
		JOIN matches m ON ps.match_id = m.id
		WHERE ps.player_id = $1::uuid 
		  AND (m.event_day_id = $2::uuid OR m.date::date = (SELECT ed.date::date FROM event_days ed WHERE ed.id = $2::uuid))
	`
	var line domain.RatingStatLine
	var recYards, statRows int

	err := r.db.QueryRow(ctx, query, playerID, eventDayID).Scan(
		&statRows,
		&line.CompletedPasses,
		&line.PassingAttempts,
		&line.PassingYards,
		&line.PassingTDs,
		&line.InterceptionsThrown,
		&line.Receptions,
		&recYards,
		&line.ReceivingTDs,
		&line.ExtraPointTDs,
		&line.Drops,
		&line.RushingAttempts,
		&line.RushingYards,
		&line.RushingTDs,
		&line.FlagPulls,
		&line.PassDeflections,
		&line.Interceptions,
		&line.DefensiveTDs,
		&line.Safeties,
		&line.DefensiveXPTDs,
		&line.DefensiveSacks,
		&line.QBSacks,
		&line.BattedDownPasses,
		&line.UncatchablePasses,
		&line.ThrownAwayPasses,
		&line.XPAttempts,
		&line.XPGood,
	)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return result, err
		}
		return result, nil
	}

	// No stat rows for this player on the day: return nothing so the admin
	// page can say so instead of filling the slot with zeros.
	if statRows == 0 {
		return result, nil
	}

	// Populate direct stat keys for slot autofill
	result["pass_td"] = strconv.Itoa(line.PassingTDs)
	result["pass_yards"] = strconv.Itoa(line.PassingYards)
	result["pass_completions"] = strconv.Itoa(line.CompletedPasses)
	result["pass_attempts"] = strconv.Itoa(line.PassingAttempts)
	result["rush_yards"] = strconv.Itoa(line.RushingYards)
	result["rush_td"] = strconv.Itoa(line.RushingTDs)
	result["catches"] = strconv.Itoa(line.Receptions)
	result["rec_yards"] = strconv.Itoa(recYards)
	result["rec_td"] = strconv.Itoa(line.ReceivingTDs)
	result["flag_pulls"] = strconv.Itoa(line.FlagPulls)
	if line.PassingAttempts > 0 {
		result["cmp_pct"] = fmt.Sprintf("%d%%", line.CompletedPasses*100/line.PassingAttempts)
	} else {
		result["cmp_pct"] = "0%"
	}
	result["sacks"] = strconv.Itoa(line.DefensiveSacks)
	result["interceptions"] = strconv.Itoa(line.Interceptions)
	result["pass_defended"] = strconv.Itoa(line.PassDeflections + line.BattedDownPasses)

	// Fetch player position to calculate accurate rating
	var position string
	_ = r.db.QueryRow(ctx, `SELECT COALESCE(position, '-') FROM players WHERE id = $1::uuid`, playerID).Scan(&position)

	if res := domain.RateByPosition(position, line); res != nil && res.Status != domain.RatingStatusUnrated {
		result["rating"] = fmt.Sprintf("%.1f", res.FinalRating)
	}

	// Suggest smart stats based on whether player did passing, defense, or receiving
	if line.PassingAttempts > 0 {
		result["stat1_val"] = fmt.Sprintf("%d/%d", line.CompletedPasses, line.PassingAttempts)
		result["stat1_lbl"] = "Cmp / Att"
		result["stat2_val"] = fmt.Sprintf("%d", line.PassingYards)
		result["stat2_lbl"] = "Pass Yds"
		result["stat3_val"] = fmt.Sprintf("%d", line.PassingTDs)
		result["stat3_lbl"] = "Pass TDs"
	} else if line.FlagPulls > 0 || line.DefensiveSacks > 0 || line.Interceptions > 0 || line.PassDeflections > 0 {
		result["stat1_val"] = fmt.Sprintf("%d", line.FlagPulls)
		result["stat1_lbl"] = "Flag Pulls"
		disruptions := line.DefensiveSacks + line.PassDeflections + line.BattedDownPasses
		result["stat2_val"] = fmt.Sprintf("%d", disruptions)
		result["stat2_lbl"] = "Disruptions"
		result["stat3_val"] = fmt.Sprintf("%d", line.Interceptions)
		result["stat3_lbl"] = "Interceptions"
	} else if line.Receptions > 0 {
		result["stat1_val"] = fmt.Sprintf("%d", line.Receptions)
		result["stat1_lbl"] = "Catches"
		result["stat2_val"] = fmt.Sprintf("%d", recYards)
		result["stat2_lbl"] = "Rec Yds"
		result["stat3_val"] = fmt.Sprintf("%d", line.ReceivingTDs)
		result["stat3_lbl"] = "Rec TDs"
	} else if line.RushingAttempts > 0 || line.RushingYards > 0 {
		result["stat1_val"] = fmt.Sprintf("%d", line.RushingYards)
		result["stat1_lbl"] = "Rush Yds"
		result["stat2_val"] = fmt.Sprintf("%d", line.RushingTDs)
		result["stat2_lbl"] = "Rush TDs"
		result["stat3_val"] = fmt.Sprintf("%d", line.RushingAttempts)
		result["stat3_lbl"] = "Attempts"
	}

	return result, nil
}
