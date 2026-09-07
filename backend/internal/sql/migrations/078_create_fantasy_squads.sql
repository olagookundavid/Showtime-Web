-- +goose Up

-- Managers now own a squad and field a lineup from it, rather than rebuilding a
-- 14-man lineup inside the budget every gameweek.
--
-- The squad is what the money buys: 14 to 19 players, each purchased. The
-- lineup is the 14 of them that score on a given match day. Everyone else is a
-- substitute and scores nothing until they are brought in.

-- Ownership ledger. A sale stamps sold_at rather than deleting the row, so a
-- season's trading history — what was paid, what it fetched — survives, and the
-- partial unique index below still lets the same player be re-signed later.
CREATE TABLE IF NOT EXISTS fantasy_squad_players (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id        UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    player_id      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    purchase_price NUMERIC(10,2) NOT NULL,
    bought_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sold_price     NUMERIC(10,2),
    sold_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A player may be owned once at a time, and signed again after being sold.
CREATE UNIQUE INDEX IF NOT EXISTS uix_fantasy_squad_owned
    ON fantasy_squad_players (team_id, player_id)
    WHERE sold_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fantasy_squad_team
    ON fantasy_squad_players (team_id)
    WHERE sold_at IS NULL;

-- Unspent money. Held rather than derived from budget minus purchases, because
-- players are sold at the market price of the day: a squad bought for 200 and
-- sold for 210 leaves a bank that no sum of purchase prices can reconstruct.
-- The CHECK is the backstop that makes an overspend impossible to persist even
-- if a caller skips validation.
ALTER TABLE fantasy_teams
    ADD COLUMN IF NOT EXISTS bank NUMERIC(10,2) NOT NULL DEFAULT 0.00
        CHECK (bank >= 0);

-- +goose StatementBegin
-- Backfill: every existing manager keeps the squad they had. Their most recent
-- locked lineup becomes their owned squad at the prices they paid, and the bank
-- is whatever the season's budget left over. Without this, a season in progress
-- would come back with nobody owning anyone.
DO $$
DECLARE
    t RECORD;
    latest_lineup UUID;
    spent NUMERIC(10,2);
    season_budget NUMERIC(10,2);
BEGIN
    FOR t IN SELECT id, season_id FROM fantasy_teams LOOP
        -- Skip a team that has already been given a squad, so this is re-runnable.
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM fantasy_squad_players WHERE team_id = t.id AND sold_at IS NULL
        );

        SELECT COALESCE(budget, 230) INTO season_budget
        FROM fantasy_seasons WHERE id = t.season_id;

        SELECT l.id INTO latest_lineup
        FROM fantasy_lineups l
        JOIN fantasy_gameweeks g ON g.id = l.gameweek_id
        WHERE l.team_id = t.id
        ORDER BY (l.status = 'LOCKED') DESC, g.number DESC
        LIMIT 1;

        IF latest_lineup IS NOT NULL THEN
            INSERT INTO fantasy_squad_players (team_id, player_id, purchase_price)
            SELECT t.id, p.player_id, p.purchase_price
            FROM fantasy_lineup_picks p
            WHERE p.lineup_id = latest_lineup
            ON CONFLICT DO NOTHING;
        END IF;

        SELECT COALESCE(SUM(purchase_price), 0) INTO spent
        FROM fantasy_squad_players WHERE team_id = t.id AND sold_at IS NULL;

        -- A manager who never picked owns nothing and keeps the whole budget.
        -- Skipping them here would leave bank at its 0.00 default and they could
        -- never buy anyone.
        UPDATE fantasy_teams
        SET bank = GREATEST(season_budget - spent, 0)
        WHERE id = t.id;
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
ALTER TABLE fantasy_teams DROP COLUMN IF EXISTS bank;
DROP TABLE IF EXISTS fantasy_squad_players;
