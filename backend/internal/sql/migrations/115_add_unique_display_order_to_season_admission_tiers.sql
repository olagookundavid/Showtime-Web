-- +goose Up

-- Only renumber if a duplicate display_order actually exists today, so
-- already-clean data (including whatever's already in production) is left
-- exactly as the admin set it.
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM season_admission_tiers
        GROUP BY display_order HAVING COUNT(*) > 1
    ) THEN
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY display_order, created_at) AS rn
            FROM season_admission_tiers
        )
        UPDATE season_admission_tiers t SET display_order = ranked.rn
        FROM ranked WHERE ranked.id = t.id;
    END IF;
END $$;
-- +goose StatementEnd

-- A season tier is matched to a display slot by this value, so two tiers
-- can't share one — the service checks this too (names the conflicting
-- tier), this is the backstop for a race between two admins.
CREATE UNIQUE INDEX IF NOT EXISTS uq_season_admission_tiers_display_order ON season_admission_tiers (display_order);

-- +goose Down
DROP INDEX IF EXISTS uq_season_admission_tiers_display_order;
