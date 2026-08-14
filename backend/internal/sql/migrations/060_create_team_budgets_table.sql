-- +goose Up
CREATE TABLE IF NOT EXISTS team_budgets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
    total_budget BIGINT NOT NULL DEFAULT 15000000,
    spent        BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO team_budgets (team_id)
SELECT id FROM teams WHERE status = 'active'
ON CONFLICT (team_id) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS team_budgets;
