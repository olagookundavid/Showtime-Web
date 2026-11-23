package store

import (
	"context"
	"strings"
	"time"

	"showtime-backend/internal/arena/domain"

	"github.com/jackc/pgx/v5"
)

const contractSelect = `
	SELECT k.id, k.season_id, k.player_id, p.gamertag, k.club_id, c.name, c.short, c.color,
	       k.from_club_id::text, COALESCE(f.name, ''), k.squad_role, to_char(k.end_date, 'YYYY-MM-DD'), k.fee_ngn, k.terms,
	       k.status, k.signature, k.signed_at, k.reason, k.created_at, k.updated_at
	FROM arena_contracts k
	JOIN arena_players p ON p.id = k.player_id
	JOIN arena_clubs c ON c.id = k.club_id
	LEFT JOIN arena_clubs f ON f.id = k.from_club_id`

func scanContract(row pgx.Row) (*domain.Contract, error) {
	var k domain.Contract
	if err := row.Scan(&k.ID, &k.SeasonID, &k.PlayerID, &k.PlayerName, &k.ClubID, &k.ClubName, &k.ClubShort, &k.ClubColor,
		&k.FromClubID, &k.FromClubName, &k.SquadRole, &k.EndDate, &k.FeeNGN, &k.Terms,
		&k.Status, &k.Signature, &k.SignedAt, &k.Reason, &k.CreatedAt, &k.UpdatedAt); err != nil {
		return nil, notFound(err)
	}
	return &k, nil
}

type ContractFilter struct {
	SeasonID string
	ClubID   string // offers made by, or released from, this club
	PlayerID string
	Status   string // a status, or "open" for both awaiting statuses
	Limit    int
}

func (s *Store) ListContracts(ctx context.Context, f ContractFilter) ([]domain.Contract, error) {
	var where []string
	var args []any
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "?", "$"+itoa(len(args))))
	}
	if f.SeasonID != "" {
		add("k.season_id = ?", f.SeasonID)
	}
	if f.ClubID != "" {
		add("(k.club_id = ? OR (k.from_club_id = ? AND k.status = 'awaiting_release'))", f.ClubID)
	}
	if f.PlayerID != "" {
		add("k.player_id = ?", f.PlayerID)
	}
	switch f.Status {
	case "":
	case "open":
		where = append(where, "k.status IN ('awaiting_release', 'awaiting_player')")
	default:
		add("k.status = ?", f.Status)
	}
	sql := contractSelect
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	sql += " ORDER BY k.created_at DESC"
	if f.Limit > 0 {
		sql += " LIMIT " + itoa(f.Limit)
	}
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Contract{}
	for rows.Next() {
		k, err := scanContract(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *k)
	}
	return out, rows.Err()
}

func (s *Store) GetContract(ctx context.Context, id string) (*domain.Contract, error) {
	k, err := scanContract(s.db.QueryRow(ctx, contractSelect+` WHERE k.id = $1`, id))
	if err != nil {
		return nil, err
	}
	k.Events, err = s.ContractEvents(ctx, id)
	return k, err
}

// LockContract locks the offer so two people can't answer it at once.
func (s *Store) LockContract(ctx context.Context, id string) error {
	var x string
	return notFound(s.db.QueryRow(ctx, `SELECT id::text FROM arena_contracts WHERE id = $1 FOR UPDATE`, id).Scan(&x))
}

type NewContract struct {
	SeasonID   string
	PlayerID   string
	ClubID     string
	FromClubID *string
	SquadRole  string
	EndDate    time.Time
	FeeNGN     int64
	Terms      string
	Status     string
	CreatedBy  string
}

func (s *Store) CreateContract(ctx context.Context, c NewContract) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		INSERT INTO arena_contracts (season_id, player_id, club_id, from_club_id, squad_role, end_date, fee_ngn, terms, status, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10) RETURNING id::text`,
		c.SeasonID, c.PlayerID, c.ClubID, c.FromClubID, c.SquadRole, c.EndDate.Format("2006-01-02"), c.FeeNGN, c.Terms, c.Status, nullIfEmpty(c.CreatedBy)).Scan(&id)
	return id, err
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// SetContractStatus moves an offer to a new status.
func (s *Store) SetContractStatus(ctx context.Context, id, status, reason string) error {
	_, err := s.db.Exec(ctx, `UPDATE arena_contracts SET status = $2, reason = CASE WHEN $3 = '' THEN reason ELSE $3 END, updated_at = NOW() WHERE id = $1`,
		id, status, reason)
	return err
}

func (s *Store) MarkSigned(ctx context.Context, id, signature string) error {
	_, err := s.db.Exec(ctx, `UPDATE arena_contracts SET status = 'signed', signature = $2, signed_at = NOW(), updated_at = NOW() WHERE id = $1`, id, signature)
	return err
}

// WithdrawOtherOpenOffers closes a player's other open offers when they sign one.
// It returns the ids it closed so each can get a history line.
func (s *Store) WithdrawOtherOpenOffers(ctx context.Context, playerID, exceptID string) ([]string, error) {
	rows, err := s.db.Query(ctx, `
		UPDATE arena_contracts SET status = 'withdrawn', updated_at = NOW()
		WHERE player_id = $1 AND id <> $2 AND status IN ('awaiting_release', 'awaiting_player')
		RETURNING id::text`, playerID, exceptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Store) AddContractEvent(ctx context.Context, contractID, label, actorUserID string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO arena_contract_events (contract_id, label, actor_user_id) VALUES ($1, $2, $3)`,
		contractID, label, nullIfEmpty(actorUserID))
	return err
}

func (s *Store) ContractEvents(ctx context.Context, contractID string) ([]domain.ContractEvent, error) {
	rows, err := s.db.Query(ctx, `SELECT label, at FROM arena_contract_events WHERE contract_id = $1 ORDER BY at, id`, contractID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.ContractEvent{}
	for rows.Next() {
		var e domain.ContractEvent
		if err := rows.Scan(&e.Label, &e.At); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// OpenOfferExists reports whether the club already has an open offer to the player.
func (s *Store) OpenOfferExists(ctx context.Context, playerID, clubID string) (bool, error) {
	var b bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM arena_contracts WHERE player_id = $1 AND club_id = $2 AND status IN ('awaiting_release', 'awaiting_player'))`,
		playerID, clubID).Scan(&b)
	return b, err
}
