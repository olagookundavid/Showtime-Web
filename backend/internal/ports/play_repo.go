package ports

import (
	"context"
	"fmt"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PlayRepository interface {
	Create(ctx context.Context, p *domain.GamePlay) error
	Update(ctx context.Context, p *domain.GamePlay) error
	Delete(ctx context.Context, id string) error
	ListByMatch(ctx context.Context, matchID string) ([]*domain.GamePlay, error)
	MaxSeq(ctx context.Context, matchID string) (int, error)
	GetSeq(ctx context.Context, id string) (int, error)
	// ShiftSeqsForInsert bumps seq by 1 for every play at/after atSeq, opening a
	// gap so a new play can be inserted mid-sequence rather than only appended.
	ShiftSeqsForInsert(ctx context.Context, matchID string, atSeq int) error
	// UpdatePlaySituation rewrites only the derived situation fields (down/distance,
	// possession, drive) of a single play — the "re-derive from here" helper.
	UpdatePlaySituation(ctx context.Context, id string, driveNo int, down, toGo *int, offenseTeamID *string) error
	// ListMatchesWithPlays returns every match that has at least one logged play,
	// newest first, optionally scoped to a competition. Matches with NO play log
	// are deliberately excluded — their stats came from elsewhere (e.g. the
	// historical Excel import) and deriving over them would be destructive.
	ListMatchesWithPlays(ctx context.Context, competitionID string) ([]domain.MatchPlayCount, error)
	UpdateScore(ctx context.Context, id string, home, away int) error

	// Step 3 — rules config
	GetRules(ctx context.Context, competitionID string) (domain.GameRules, error)
	UpsertRules(ctx context.Context, r *domain.GameRules) error
}

type PlayPGRepository struct {
	db *pgxpool.Pool
}

func NewPlayRepository(db *pgxpool.Pool) PlayRepository {
	return &PlayPGRepository{db: db}
}

const playColumns = `
	seq, drive_no, quarter, clock, offense_team_id, down, to_go, ball_on,
	play_type, off_qb_id, target_id, yards, result, defender_id, rusher_id, dropped, batted_down, returned_for_td,
	penalty, penalty_team_id, penalty_player_id, penalty_yards,
	home_score_after, away_score_after, notes, uncatchable, center_id`

func (r *PlayPGRepository) Create(ctx context.Context, p *domain.GamePlay) error {
	query := `
		INSERT INTO game_plays (match_id, ` + playColumns + `)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
		RETURNING id, created_at, updated_at`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query,
		p.MatchID, p.Seq, p.DriveNo, p.Quarter, p.Clock, p.OffenseTeamID, p.Down, p.ToGo, p.BallOn,
		p.PlayType, p.OffQBID, p.TargetID, p.Yards, p.Result, p.DefenderID, p.RusherID, p.Dropped, p.BattedDown, p.ReturnedForTD,
		p.Penalty, p.PenaltyTeamID, p.PenaltyPlayerID, p.PenaltyYards,
		p.HomeScoreAfter, p.AwayScoreAfter, p.Notes, p.Uncatchable, p.CenterID,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create play: %w", err)
	}
	return nil
}

func (r *PlayPGRepository) Update(ctx context.Context, p *domain.GamePlay) error {
	query := `
		UPDATE game_plays SET
			seq = $2, drive_no = $3, quarter = $4, clock = $5, offense_team_id = $6,
			down = $7, to_go = $8, ball_on = $9, play_type = $10, off_qb_id = $11,
			target_id = $12, yards = $13, result = $14, defender_id = $15, rusher_id = $16, dropped = $17,
			batted_down = $18, returned_for_td = $19, penalty = $20, penalty_team_id = $21, penalty_player_id = $22,
			penalty_yards = $23, home_score_after = $24, away_score_after = $25, notes = $26,
			uncatchable = $27, center_id = $28,
			updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query,
		p.ID, p.Seq, p.DriveNo, p.Quarter, p.Clock, p.OffenseTeamID,
		p.Down, p.ToGo, p.BallOn, p.PlayType, p.OffQBID,
		p.TargetID, p.Yards, p.Result, p.DefenderID, p.RusherID, p.Dropped, p.BattedDown,
		p.ReturnedForTD, p.Penalty, p.PenaltyTeamID, p.PenaltyPlayerID,
		p.PenaltyYards, p.HomeScoreAfter, p.AwayScoreAfter, p.Notes, p.Uncatchable, p.CenterID,
	).Scan(&p.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to update play: %w", err)
	}
	return nil
}

func (r *PlayPGRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, `DELETE FROM game_plays WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete play: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("play not found")
	}
	return nil
}

func (r *PlayPGRepository) MaxSeq(ctx context.Context, matchID string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var maxSeq int
	err := r.db.QueryRow(ctx, `SELECT COALESCE(MAX(seq), 0) FROM game_plays WHERE match_id = $1`, matchID).Scan(&maxSeq)
	if err != nil {
		return 0, fmt.Errorf("failed to get max seq: %w", err)
	}
	return maxSeq, nil
}

func (r *PlayPGRepository) ShiftSeqsForInsert(ctx context.Context, matchID string, atSeq int) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, `UPDATE game_plays SET seq = seq + 1 WHERE match_id = $1 AND seq >= $2`, matchID, atSeq)
	if err != nil {
		return fmt.Errorf("failed to shift seqs for insert: %w", err)
	}
	return nil
}

func (r *PlayPGRepository) UpdatePlaySituation(ctx context.Context, id string, driveNo int, down, toGo *int, offenseTeamID *string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx,
		`UPDATE game_plays SET drive_no = $2, down = $3, to_go = $4, offense_team_id = $5, updated_at = NOW() WHERE id = $1`,
		id, driveNo, down, toGo, offenseTeamID)
	if err != nil {
		return fmt.Errorf("failed to update play situation: %w", err)
	}
	return nil
}

func (r *PlayPGRepository) ListMatchesWithPlays(ctx context.Context, competitionID string) ([]domain.MatchPlayCount, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// The JOIN onto game_plays is what scopes this to matches that actually have
	// a log — matches whose stats came from the historical import have no plays
	// and must never be derived over.
	query := `
		SELECT gp.match_id::text, COUNT(*) AS plays,
		       COALESCE(NULLIF(ht.short_name, ''), ht.name, 'TBD') || ' vs ' || COALESCE(NULLIF(at.short_name, ''), at.name, 'TBD') AS label,
		       TO_CHAR(m.date, 'YYYY-MM-DD') AS match_date
		FROM game_plays gp
		JOIN matches m ON m.id = gp.match_id
		LEFT JOIN teams ht ON m.home_team_id = ht.id
		LEFT JOIN teams at ON m.away_team_id = at.id`
	args := []any{}
	if competitionID != "" {
		query += ` WHERE m.competition_id = $1`
		args = append(args, competitionID)
	}
	query += ` GROUP BY gp.match_id, ht.short_name, ht.name, at.short_name, at.name, m.date
		ORDER BY m.date DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list matches with plays: %w", err)
	}
	defer rows.Close()

	out := []domain.MatchPlayCount{}
	for rows.Next() {
		var m domain.MatchPlayCount
		if err := rows.Scan(&m.MatchID, &m.Plays, &m.Label, &m.Date); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *PlayPGRepository) UpdateScore(ctx context.Context, id string, home, away int) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, `UPDATE game_plays SET home_score_after = $2, away_score_after = $3, updated_at = NOW() WHERE id = $1`, id, home, away)
	if err != nil {
		return fmt.Errorf("failed to update play score: %w", err)
	}
	return nil
}

func (r *PlayPGRepository) GetRules(ctx context.Context, competitionID string) (domain.GameRules, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rules := domain.DefaultGameRules(competitionID)
	query := `
		SELECT td_points, xp_run_points, xp_pass_points, safety_points, def_return_points,
		       downs_per_series, yards_to_first_down, first_down_model, created_at, updated_at
		FROM game_rules WHERE competition_id = $1`
	err := r.db.QueryRow(ctx, query, competitionID).Scan(
		&rules.TDPoints, &rules.XPRunPoints, &rules.XPPassPoints, &rules.SafetyPoints, &rules.DefReturnPoints,
		&rules.DownsPerSeries, &rules.YardsToFirstDown, &rules.FirstDownModel, &rules.CreatedAt, &rules.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			// No stored rules yet — return the defaults (not an error).
			return domain.DefaultGameRules(competitionID), nil
		}
		return rules, fmt.Errorf("failed to fetch game rules: %w", err)
	}
	return rules, nil
}

func (r *PlayPGRepository) UpsertRules(ctx context.Context, rules *domain.GameRules) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO game_rules (competition_id, td_points, xp_run_points, xp_pass_points, safety_points,
			def_return_points, downs_per_series, yards_to_first_down, first_down_model)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (competition_id) DO UPDATE SET
			td_points = EXCLUDED.td_points,
			xp_run_points = EXCLUDED.xp_run_points,
			xp_pass_points = EXCLUDED.xp_pass_points,
			safety_points = EXCLUDED.safety_points,
			def_return_points = EXCLUDED.def_return_points,
			downs_per_series = EXCLUDED.downs_per_series,
			yards_to_first_down = EXCLUDED.yards_to_first_down,
			first_down_model = EXCLUDED.first_down_model,
			updated_at = NOW()
		RETURNING created_at, updated_at`
	err := r.db.QueryRow(ctx, query,
		rules.CompetitionID, rules.TDPoints, rules.XPRunPoints, rules.XPPassPoints, rules.SafetyPoints,
		rules.DefReturnPoints, rules.DownsPerSeries, rules.YardsToFirstDown, rules.FirstDownModel,
	).Scan(&rules.CreatedAt, &rules.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to upsert game rules: %w", err)
	}
	return nil
}

func (r *PlayPGRepository) GetSeq(ctx context.Context, id string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var seq int
	err := r.db.QueryRow(ctx, `SELECT seq FROM game_plays WHERE id = $1`, id).Scan(&seq)
	if err != nil {
		return 0, fmt.Errorf("play not found: %w", err)
	}
	return seq, nil
}

func (r *PlayPGRepository) ListByMatch(ctx context.Context, matchID string) ([]*domain.GamePlay, error) {
	query := `
		SELECT
			gp.id, gp.match_id, gp.seq, gp.drive_no, gp.quarter, gp.clock, gp.offense_team_id,
			gp.down, gp.to_go, gp.ball_on, gp.play_type, gp.off_qb_id, gp.target_id, gp.yards,
			gp.result, gp.defender_id, gp.rusher_id, gp.dropped, gp.batted_down, gp.uncatchable, gp.returned_for_td, gp.penalty, gp.penalty_team_id,
			gp.penalty_player_id, gp.penalty_yards, gp.home_score_after, gp.away_score_after, gp.notes,
			gp.created_at, gp.updated_at, gp.center_id,
			ot.name, ot.short_name, ot.logo,
			po.name, po.jersey_number, po.position, po.gender,
			pt.name, pt.jersey_number, pt.position, pt.gender,
			pd.name, pd.jersey_number, pd.position, pd.gender,
			pr.name, pr.jersey_number, pr.position, pr.gender,
			pp.name, pp.jersey_number, pp.position, pp.gender,
			pc.name, pc.jersey_number, pc.position, pc.gender
		FROM game_plays gp
		LEFT JOIN teams   ot ON gp.offense_team_id  = ot.id
		LEFT JOIN players po ON gp.off_qb_id        = po.id
		LEFT JOIN players pt ON gp.target_id        = pt.id
		LEFT JOIN players pd ON gp.defender_id      = pd.id
		LEFT JOIN players pr ON gp.rusher_id        = pr.id
		LEFT JOIN players pp ON gp.penalty_player_id = pp.id
		LEFT JOIN players pc ON gp.center_id        = pc.id
		WHERE gp.match_id = $1
		ORDER BY gp.seq ASC`

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch plays: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.GamePlay, 0)
	for rows.Next() {
		var p domain.GamePlay
		var otName, otShort, otLogo *string
		var poName, poPos, poGen, ptName, ptPos, ptGen, pdName, pdPos, pdGen, prName, prPos, prGen, ppName, ppPos, ppGen, pcName, pcPos, pcGen *string
		var poNum, ptNum, pdNum, prNum, ppNum, pcNum *int

		if err := rows.Scan(
			&p.ID, &p.MatchID, &p.Seq, &p.DriveNo, &p.Quarter, &p.Clock, &p.OffenseTeamID,
			&p.Down, &p.ToGo, &p.BallOn, &p.PlayType, &p.OffQBID, &p.TargetID, &p.Yards,
			&p.Result, &p.DefenderID, &p.RusherID, &p.Dropped, &p.BattedDown, &p.Uncatchable, &p.ReturnedForTD, &p.Penalty, &p.PenaltyTeamID,
			&p.PenaltyPlayerID, &p.PenaltyYards, &p.HomeScoreAfter, &p.AwayScoreAfter, &p.Notes,
			&p.CreatedAt, &p.UpdatedAt, &p.CenterID,
			&otName, &otShort, &otLogo,
			&poName, &poNum, &poPos, &poGen,
			&ptName, &ptNum, &ptPos, &ptGen,
			&pdName, &pdNum, &pdPos, &pdGen,
			&prName, &prNum, &prPos, &prGen,
			&ppName, &ppNum, &ppPos, &ppGen,
			&pcName, &pcNum, &pcPos, &pcGen,
		); err != nil {
			return nil, fmt.Errorf("failed to scan play: %w", err)
		}

		if p.OffenseTeamID != nil && otName != nil {
			p.OffenseTeam = &domain.Team{ID: *p.OffenseTeamID, Name: *otName, ShortName: strDeref(otShort), Logo: strDeref(otLogo)}
		}
		p.OffQB = hydratePlayer(p.OffQBID, poName, poNum, poPos, poGen)
		p.Target = hydratePlayer(p.TargetID, ptName, ptNum, ptPos, ptGen)
		p.Defender = hydratePlayer(p.DefenderID, pdName, pdNum, pdPos, pdGen)
		p.Rusher = hydratePlayer(p.RusherID, prName, prNum, prPos, prGen)
		p.PenaltyPlayer = hydratePlayer(p.PenaltyPlayerID, ppName, ppNum, ppPos, ppGen)
		p.Center = hydratePlayer(p.CenterID, pcName, pcNum, pcPos, pcGen)

		out = append(out, &p)
	}
	return out, nil
}

func hydratePlayer(id *string, name *string, num *int, pos *string, gender *string) *domain.Player {
	if id == nil || name == nil {
		return nil
	}
	pl := &domain.Player{ID: *id, Name: *name, Position: strDeref(pos), Gender: strDeref(gender)}
	if num != nil {
		pl.JerseyNumber = *num
	}
	return pl
}

func strDeref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
