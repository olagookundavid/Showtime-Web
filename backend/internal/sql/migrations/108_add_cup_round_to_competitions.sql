-- +goose Up
-- Migration 108: Add cup_round to competitions for tracking active stage in Cup tournaments.
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS cup_round TEXT;

-- +goose Down
ALTER TABLE competitions DROP COLUMN IF EXISTS cup_round;
