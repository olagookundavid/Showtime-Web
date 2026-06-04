-- +goose Up

-- Link gallery entries to a competition so the public gallery can be filtered
-- by competition. Nullable + ON DELETE SET NULL so deleting a competition
-- preserves the gallery history, and pre-existing rows stay valid.
ALTER TABLE gallery
    ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gallery_competition_id ON gallery(competition_id);

-- +goose Down

DROP INDEX IF EXISTS idx_gallery_competition_id;
ALTER TABLE gallery DROP COLUMN IF EXISTS competition_id;
