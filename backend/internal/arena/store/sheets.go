package store

import (
	"context"
	"sort"

	"showtime-backend/internal/arena/domain"
)

// GetSheet loads a club's team sheet for a match, or ErrNotFound if none exists.
func (s *Store) GetSheet(ctx context.Context, matchID, clubID string) (*domain.TeamSheet, error) {
	var t domain.TeamSheet
	err := s.db.QueryRow(ctx, `
		SELECT id, match_id, club_id, formation, captain_player_id::text, status, revision, submitted_at, review_reason
		FROM arena_team_sheets WHERE match_id = $1 AND club_id = $2`, matchID, clubID).
		Scan(&t.ID, &t.MatchID, &t.ClubID, &t.Formation, &t.CaptainPlayerID, &t.Status, &t.Revision, &t.SubmittedAt, &t.ReviewReason)
	if err != nil {
		return nil, notFound(err)
	}
	t.Starters = []domain.SheetSlot{}
	t.Bench = []string{}
	rows, err := s.db.Query(ctx, `
		SELECT player_id::text, slot_index, COALESCE(slot_position, ''), is_bench FROM arena_team_sheet_players WHERE sheet_id = $1`, t.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var pid string
		var idx *int16
		var pos string
		var bench bool
		if err := rows.Scan(&pid, &idx, &pos, &bench); err != nil {
			return nil, err
		}
		if bench || idx == nil {
			t.Bench = append(t.Bench, pid)
		} else {
			t.Starters = append(t.Starters, domain.SheetSlot{Index: int(*idx), Position: pos, PlayerID: pid})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(t.Starters, func(i, j int) bool { return t.Starters[i].Index < t.Starters[j].Index })
	sort.Strings(t.Bench)
	return &t, nil
}

// LockSheet makes sure the sheet row exists for the match and club and locks it.
func (s *Store) LockSheet(ctx context.Context, matchID, clubID string) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		INSERT INTO arena_team_sheets (match_id, club_id) VALUES ($1, $2)
		ON CONFLICT (match_id, club_id) DO UPDATE SET match_id = EXCLUDED.match_id
		RETURNING id::text`, matchID, clubID).Scan(&id)
	if err != nil {
		return "", err
	}
	var x string
	return id, s.db.QueryRow(ctx, `SELECT id::text FROM arena_team_sheets WHERE id = $1 FOR UPDATE`, id).Scan(&x)
}

// SaveSheet replaces a sheet's contents. status and revision are written as given.
func (s *Store) SaveSheet(ctx context.Context, sheetID string, in domain.SheetInput, f domain.Formation, status string, bumpRevision bool, reviewReason string) error {
	var captain *string
	if in.Captain != "" {
		captain = &in.Captain
	}
	submitted := "NULL"
	if status == domain.SheetSubmitted {
		submitted = "NOW()"
	}
	rev := "revision"
	if bumpRevision {
		rev = "revision + 1"
	}
	if _, err := s.db.Exec(ctx, `
		UPDATE arena_team_sheets
		SET formation = $2, captain_player_id = $3, status = $4, revision = `+rev+`, submitted_at = `+submitted+`,
		    review_reason = $5, updated_at = NOW()
		WHERE id = $1`, sheetID, in.Formation, captain, status, reviewReason); err != nil {
		return err
	}
	if _, err := s.db.Exec(ctx, `DELETE FROM arena_team_sheet_players WHERE sheet_id = $1`, sheetID); err != nil {
		return err
	}
	for idx, pid := range in.Starters {
		if idx < 0 || idx >= len(f.Slots) || pid == "" {
			continue
		}
		if _, err := s.db.Exec(ctx, `
			INSERT INTO arena_team_sheet_players (sheet_id, player_id, slot_index, slot_position, is_bench) VALUES ($1, $2, $3, $4, FALSE)`,
			sheetID, pid, idx, f.Slots[idx]); err != nil {
			return err
		}
	}
	for _, pid := range in.Bench {
		if _, err := s.db.Exec(ctx, `
			INSERT INTO arena_team_sheet_players (sheet_id, player_id, slot_index, slot_position, is_bench) VALUES ($1, $2, NULL, NULL, TRUE)
			ON CONFLICT (sheet_id, player_id) DO NOTHING`, sheetID, pid); err != nil {
			return err
		}
	}
	return nil
}

// ReopenSheets sends a club's submitted sheets for matches that haven't been
// played back to draft when a player leaves. It returns how many it reopened.
func (s *Store) ReopenSheets(ctx context.Context, clubID, playerID, reason string) (int64, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE arena_team_sheets t SET status = 'draft', review_reason = $3, updated_at = NOW()
		FROM arena_matches m
		WHERE t.match_id = m.id AND t.club_id = $1 AND t.status = 'submitted'
		  AND m.status IN ('scheduled', 'postponed')
		  AND EXISTS (SELECT 1 FROM arena_team_sheet_players sp WHERE sp.sheet_id = t.id AND sp.player_id = $2)`,
		clubID, playerID, reason)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// DropPlayerFromSheets removes a player who left from every unplayed match's sheet
// so a stale name can't be submitted.
func (s *Store) DropPlayerFromSheets(ctx context.Context, clubID, playerID string) error {
	_, err := s.db.Exec(ctx, `
		DELETE FROM arena_team_sheet_players sp
		USING arena_team_sheets t, arena_matches m
		WHERE sp.sheet_id = t.id AND t.match_id = m.id AND t.club_id = $1 AND sp.player_id = $2
		  AND m.status IN ('scheduled', 'postponed')`, clubID, playerID)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `
		UPDATE arena_team_sheets t SET captain_player_id = NULL
		FROM arena_matches m
		WHERE t.match_id = m.id AND t.club_id = $1 AND t.captain_player_id = $2 AND m.status IN ('scheduled', 'postponed')`, clubID, playerID)
	return err
}

// SubmittedSheetFor is the club's most recent submitted sheet, for showing its XI.
func (s *Store) LastSubmittedSheet(ctx context.Context, clubID string) (*domain.TeamSheet, error) {
	var matchID string
	err := s.db.QueryRow(ctx, `
		SELECT t.match_id::text FROM arena_team_sheets t JOIN arena_matches m ON m.id = t.match_id
		WHERE t.club_id = $1 AND t.status = 'submitted'
		ORDER BY m.kickoff_at DESC NULLS LAST LIMIT 1`, clubID).Scan(&matchID)
	if err != nil {
		return nil, notFound(err)
	}
	return s.GetSheet(ctx, matchID, clubID)
}
