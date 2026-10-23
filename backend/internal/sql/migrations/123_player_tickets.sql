-- +goose Up
-- Player tickets: every player named on a team sheet gets a free ticket for that
-- match's game day. It is an ordinary row in tickets (purchase_type PLAYER), so the
-- gate looks it up and checks it in like any other; player_id and match_id say who
-- it admits and for which match. It takes no seat from any ticket product.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES matches(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchase_type_check;
ALTER TABLE tickets
    ADD CONSTRAINT tickets_purchase_type_check CHECK (purchase_type IN ('SINGLE', 'GAME_PASS', 'SEASON_PASS', 'PLAYER'));

-- One live ticket per player per match. A player taken off the sheet has theirs
-- cancelled, which frees the slot if they are put back.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_player_match_live
    ON tickets (match_id, player_id)
    WHERE purchase_type = 'PLAYER' AND status <> 'CANCELLED';

CREATE INDEX IF NOT EXISTS idx_tickets_match ON tickets (match_id) WHERE match_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_tickets_match;
DROP INDEX IF EXISTS idx_tickets_player_match_live;
DELETE FROM tickets WHERE purchase_type = 'PLAYER';
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchase_type_check;
ALTER TABLE tickets
    ADD CONSTRAINT tickets_purchase_type_check CHECK (purchase_type IN ('SINGLE', 'GAME_PASS', 'SEASON_PASS'));
ALTER TABLE tickets
    DROP COLUMN IF EXISTS match_id,
    DROP COLUMN IF EXISTS player_id;
