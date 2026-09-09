package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrAlreadyOwned is returned when a manager tries to sign a player they hold.
var ErrAlreadyOwned = errors.New("this player is already in your squad")

// ErrNotOwned is returned when a manager tries to sell someone they do not own.
var ErrNotOwned = errors.New("this player is not in your squad")

type IFantasySquadRepository interface {
	// ListSquad returns the players a manager currently owns, marking the ones
	// in the given gameweek's lineup as starters. Pass an empty gameweekID to
	// skip that marking.
	ListSquad(ctx context.Context, teamID, gameweekID string) ([]domain.SquadPlayer, error)
	// GetBank returns unspent money.
	GetBank(ctx context.Context, teamID string) (float64, error)
	// GetMarketPlayer returns what a player costs today and the club they play
	// for — the two things a purchase has to be checked against.
	GetMarketPlayer(ctx context.Context, seasonID, playerID string) (price float64, clubID string, err error)
	// BuyPlayer signs a player and debits the bank in one transaction.
	BuyPlayer(ctx context.Context, teamID, playerID string, price float64) error
	// SellPlayer releases a player, credits the bank, and drops them from any
	// lineup that still names them — including a locked one.
	SellPlayer(ctx context.Context, teamID, playerID string, price float64) (releasedFrom int, err error)
}

type FantasySquadRepository struct {
	pool *pgxpool.Pool
}

func NewFantasySquadRepository(pool *pgxpool.Pool) IFantasySquadRepository {
	return &FantasySquadRepository{pool: pool}
}

func (r *FantasySquadRepository) ListSquad(ctx context.Context, teamID, gameweekID string) ([]domain.SquadPlayer, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// The current price comes from the season's live market: the gameweek-
	// specific row when one exists, otherwise the opening price. It is what a
	// sale would fetch, and is deliberately not the price that was paid.
	rows, err := r.pool.Query(ctx, `
		SELECT sp.id::text, sp.team_id::text, sp.player_id::text, sp.purchase_price,
		       COALESCE((
		           SELECT pp.price FROM fantasy_player_prices pp
		           WHERE pp.player_id = sp.player_id AND pp.season_id = ft.season_id
		           ORDER BY (pp.gameweek_id IS NULL), pp.created_at DESC
		           LIMIT 1
		       ), sp.purchase_price) AS current_price,
		       p.name, COALESCE(p.position, ''), COALESCE(p.gender, ''),
		       COALESCE(p.team_id::text, ''),
		       EXISTS (
		           SELECT 1 FROM fantasy_lineup_picks flp
		           JOIN fantasy_lineups fl ON fl.id = flp.lineup_id
		           WHERE flp.player_id = sp.player_id
		             AND fl.team_id = sp.team_id
		             AND ($2 = '' OR fl.gameweek_id::text = $2)
		       ) AS starting,
		       (COALESCE(t.status, 'active') = 'active' AND p.team_id IS NOT NULL) AS team_active
		FROM fantasy_squad_players sp
		JOIN fantasy_teams ft ON ft.id = sp.team_id
		JOIN players p ON p.id = sp.player_id
		LEFT JOIN teams t ON t.id = p.team_id
		WHERE sp.team_id = $1 AND sp.sold_at IS NULL
		ORDER BY p.position, p.name, sp.player_id
	`, teamID, gameweekID)
	if err != nil {
		return nil, fmt.Errorf("failed to list squad: %w", err)
	}
	defer rows.Close()

	squad := make([]domain.SquadPlayer, 0)
	for rows.Next() {
		var s domain.SquadPlayer
		if err := rows.Scan(&s.ID, &s.TeamID, &s.PlayerID, &s.PurchasePrice, &s.CurrentPrice,
			&s.Name, &s.Position, &s.Gender, &s.ClubID, &s.Starting, &s.TeamActive); err != nil {
			return nil, fmt.Errorf("failed to scan squad player: %w", err)
		}
		squad = append(squad, s)
	}
	return squad, rows.Err()
}

func (r *FantasySquadRepository) GetBank(ctx context.Context, teamID string) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var bank float64
	if err := r.pool.QueryRow(ctx,
		`SELECT bank FROM fantasy_teams WHERE id = $1`, teamID).Scan(&bank); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, errors.New("team not found")
		}
		return 0, fmt.Errorf("failed to read bank: %w", err)
	}
	return bank, nil
}

// GetMarketPlayer reads the live price the same way ListSquad does: the
// gameweek row when one exists, otherwise the season's opening price.
// It verifies that the player belongs to an active club participating in this competition.
func (r *FantasySquadRepository) GetMarketPlayer(ctx context.Context, seasonID, playerID string) (float64, string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var price float64
	var clubID string
	var teamStatus string
	var compEligible bool
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE((
		           SELECT pp.price FROM fantasy_player_prices pp
		           WHERE pp.player_id = p.id AND pp.season_id = $1
		           ORDER BY (pp.gameweek_id IS NULL), pp.created_at DESC
		           LIMIT 1
		       ), 0),
		       COALESCE(p.team_id::text, ''),
		       COALESCE(t.status, 'active'),
		       EXISTS (
		           SELECT 1 FROM competition_teams ct
		           JOIN fantasy_seasons fs ON fs.id = $1
		           WHERE ct.competition_id = fs.competition_id AND ct.team_id = p.team_id
		       ) OR NOT EXISTS (
		           SELECT 1 FROM competition_teams ct
		           JOIN fantasy_seasons fs ON fs.id = $1
		           WHERE ct.competition_id = fs.competition_id
		       )
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE p.id = $2
	`, seasonID, playerID).Scan(&price, &clubID, &teamStatus, &compEligible)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, "", errors.New("player not found")
		}
		return 0, "", fmt.Errorf("failed to read the player's price: %w", err)
	}
	if clubID == "" || teamStatus != "active" {
		return 0, "", errors.New("players from inactive teams cannot be signed to a fantasy squad")
	}
	if !compEligible {
		return 0, "", errors.New("players whose teams are not participating in this competition cannot be signed")
	}
	return price, clubID, nil
}

// BuyPlayer signs a player at the given price.
//
// The bank row is locked first so two concurrent buys cannot both read the same
// balance and overspend it. The column's non-negative CHECK is the last line: an
// overdraft fails the transaction rather than persisting.
func (r *FantasySquadRepository) BuyPlayer(ctx context.Context, teamID, playerID string, price float64) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var bank float64
	if err := tx.QueryRow(ctx,
		`SELECT bank FROM fantasy_teams WHERE id = $1 FOR UPDATE`, teamID).Scan(&bank); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("team not found")
		}
		return err
	}
	if bank+domain.BudgetEpsilon < price {
		return fmt.Errorf("you have %.2f SC in the bank and this costs %.2f SC", bank, price)
	}

	tag, err := tx.Exec(ctx, `
		INSERT INTO fantasy_squad_players (team_id, player_id, purchase_price)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, teamID, playerID, price)
	if err != nil {
		return fmt.Errorf("failed to sign player: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrAlreadyOwned
	}

	if _, err := tx.Exec(ctx,
		`UPDATE fantasy_teams SET bank = bank - $1, updated_at = NOW() WHERE id = $2`,
		price, teamID); err != nil {
		return fmt.Errorf("failed to debit the bank: %w", err)
	}
	return tx.Commit(ctx)
}

// SellPlayer releases a player and credits the bank.
//
// A sold player is dropped from every lineup that still names them, locked ones
// included: you cannot field someone you no longer own, and leaving the pick in
// place would score points for a player who has been sold. The vacated slot
// simply scores nothing until it is refilled, which is the cost of selling mid
// gameweek. The lineup's points are re-totalled from what is left so the table
// stays honest.
func (r *FantasySquadRepository) SellPlayer(ctx context.Context, teamID, playerID string, price float64) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	// Lock the bank row first, in the same order BuyPlayer takes it, so a buy
	// and a sell running together cannot deadlock.
	if _, err := tx.Exec(ctx,
		`SELECT bank FROM fantasy_teams WHERE id = $1 FOR UPDATE`, teamID); err != nil {
		return 0, err
	}

	tag, err := tx.Exec(ctx, `
		UPDATE fantasy_squad_players
		SET sold_at = NOW(), sold_price = $3
		WHERE team_id = $1 AND player_id = $2 AND sold_at IS NULL
	`, teamID, playerID, price)
	if err != nil {
		return 0, fmt.Errorf("failed to release player: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return 0, ErrNotOwned
	}

	// A finalised gameweek is history and stays that way. Releasing the player
	// from one would retroactively rewrite a score that has already been
	// published, moving the league table for a match day that is over — a
	// manager could sell in gameweek 3 and lose points they earned in gameweek 1.
	// The current gameweek is fair game, locked or not: that is the cost of
	// selling mid-match-day, and is the intended behaviour.
	released, err := tx.Exec(ctx, `
		DELETE FROM fantasy_lineup_picks flp
		USING fantasy_lineups fl, fantasy_gameweeks fgw
		WHERE flp.lineup_id = fl.id
		  AND fgw.id = fl.gameweek_id
		  AND fl.team_id = $1
		  AND flp.player_id = $2
		  AND fgw.status <> 'FINALIZED'
	`, teamID, playerID)
	if err != nil {
		return 0, fmt.Errorf("failed to release the player from the lineup: %w", err)
	}

	// Re-total only the lineups that could have changed. Finalised gameweeks are
	// excluded for the same reason they were excluded above.
	if _, err := tx.Exec(ctx, `
		UPDATE fantasy_lineups fl
		SET points = COALESCE((
		        SELECT SUM(p.points) FROM fantasy_lineup_picks p WHERE p.lineup_id = fl.id
		    ), 0),
		    total_spent = COALESCE((
		        SELECT SUM(p.purchase_price) FROM fantasy_lineup_picks p WHERE p.lineup_id = fl.id
		    ), 0),
		    updated_at = NOW()
		FROM fantasy_gameweeks fgw
		WHERE fgw.id = fl.gameweek_id
		  AND fl.team_id = $1
		  AND fgw.status <> 'FINALIZED'
	`, teamID); err != nil {
		return 0, fmt.Errorf("failed to re-total the lineup: %w", err)
	}

	// The season total is rebuilt from the locked lineups rather than adjusted,
	// so it can never drift from the picks that remain.
	if _, err := tx.Exec(ctx, `
		UPDATE fantasy_teams ft
		SET bank = bank + $2,
		    total_points = COALESCE((
		        SELECT SUM(fl.points) FROM fantasy_lineups fl
		        WHERE fl.team_id = ft.id AND fl.status = 'LOCKED'
		    ), 0),
		    updated_at = NOW()
		WHERE ft.id = $1
	`, teamID, price); err != nil {
		return 0, fmt.Errorf("failed to credit the bank: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return int(released.RowsAffected()), nil
}
