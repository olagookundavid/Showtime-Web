-- +goose Up
ALTER TABLE matches
  ADD COLUMN second_leg_match_id UUID REFERENCES matches(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE matches DROP COLUMN second_leg_match_id;
