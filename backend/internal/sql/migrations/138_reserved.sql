-- +goose Up
-- Reserved on purpose, does nothing. Clubs Arena's database changes are run by
-- hand on production (see internal/arena/sql/), not by this migrator, so this
-- number is kept free for them. Safe to delete or reuse before it has run
-- anywhere; once it has run on production, keep it.
SELECT 1;

-- +goose Down
SELECT 1;
