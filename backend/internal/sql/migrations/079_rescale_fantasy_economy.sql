-- +goose Up

-- The fantasy economy moves onto the modelled opening prices.
--
-- The old model was price = 10.00 × rating/5: an unbounded 0–20 spread against a
-- 230 budget. A poorly rated player cost almost nothing, and a manager could
-- afford 82% of a maximum squad, which is loose enough that most squads end up
-- looking alike. The new model prices between 3.0 and 12.5 against a budget of
-- 100, so a squad is 57% of the maximum and every pick costs something
-- elsewhere.
--
-- Prices are deleted rather than converted. They were derived from a formula
-- that no longer exists, and only the application can compute the replacements —
-- the new price is a percentile against a player's position, which SQL here has
-- no way to work out. The next repricing run rebuilds them all.
UPDATE fantasy_seasons SET budget = 100.00 WHERE budget <> 100.00;
ALTER TABLE fantasy_seasons ALTER COLUMN budget SET DEFAULT 100.00;

DELETE FROM fantasy_player_prices;

-- Squads and banks are left alone here on purpose: they are only coherent once
-- the new prices exist. `cmd/reprice_fantasy` recomputes prices and then
-- restates every squad against them.

-- +goose Down
ALTER TABLE fantasy_seasons ALTER COLUMN budget SET DEFAULT 230.00;
